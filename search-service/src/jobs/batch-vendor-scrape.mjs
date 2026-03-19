#!/usr/bin/env node
/**
 * Batch Vendor Scrape — Scrapes ALL products from vendor category URLs
 *
 * Unlike the crawl-scheduler (incremental, capped), this script:
 *  - Fetches every category_url configured for a vendor
 *  - Follows ALL product links found (no cap)
 *  - Extracts full product data (multiple images, dimensions, SKU)
 *  - Deduplicates by product name + vendor before insert
 *
 * Usage:
 *   node src/jobs/batch-vendor-scrape.mjs --vendor century
 *   node src/jobs/batch-vendor-scrape.mjs --vendor century,baker,lee-industries
 *   node src/jobs/batch-vendor-scrape.mjs --vendor all-configured
 *   node src/jobs/batch-vendor-scrape.mjs --vendor century --dry-run
 */

import { initCatalogDB, insertProducts, getProductCount } from "../db/catalog-db.mjs";
import { priorityVendors } from "../config/vendors.mjs";
import { tradeVendors } from "../config/trade-vendors.mjs";

const LOG = "[batch-scrape]";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_HTML_SIZE = 2_000_000; // 2MB — category pages can be large
const RATE_LIMIT_MS = 1_500;
const CONCURRENT_FETCHES = 5;

// ── CLI Args ──────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2);
    flags[key] = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
    if (flags[key] !== true) i++;
  }
}

const vendorArg = flags.vendor || flags.vendors;
const dryRun = flags["dry-run"] === true;

if (!vendorArg) {
  console.error("Usage: node batch-vendor-scrape.mjs --vendor <vendor-id,...>");
  console.error("  --vendor century,baker   Scrape specific vendors");
  console.error("  --vendor all-configured  Scrape all vendors with category_urls");
  console.error("  --dry-run                Show what would be scraped, don't save");
  process.exit(1);
}

// ── HTTP ──────────────────────────────────────────────────────

let lastRequestTime = 0;

async function fetchHtml(url) {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequestTime));
  if (wait > 0) await sleep(wait);
  lastRequestTime = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`${LOG} HTTP ${response.status} for ${url}`);
      return null;
    }
    const text = await response.text();
    return text.slice(0, MAX_HTML_SIZE);
  } catch (err) {
    console.warn(`${LOG} Fetch error for ${url}: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── HTML Parsing ─────────────────────────────────────────────

function extractProductLinks(html, vendor) {
  const links = new Set();
  const domain = vendor.domain;
  const productTokens = vendor.profile?.product_path_tokens || ["product", "products"];
  const rejectTokens = vendor.profile?.reject_path_tokens || [];
  const minPathSegments = vendor.profile?.min_path_segments || 0;

  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1];
    const resolved = resolveUrl(href, domain);
    if (!resolved) continue;

    try {
      const parsedUrl = new URL(resolved);
      const host = parsedUrl.hostname.replace(/^www\./, "");
      if (!host.endsWith(domain.replace(/^www\./, ""))) continue;

      const path = parsedUrl.pathname.toLowerCase();
      const fullUrl = (path + parsedUrl.search).toLowerCase();

      // Reject non-product paths
      if (rejectTokens.some((token) => path === `/${token}` || path === `/${token}/`)) continue;

      // Min path segments check (e.g., Baker needs 4+ segments)
      if (minPathSegments > 0) {
        const segments = path.split("/").filter(Boolean);
        if (segments.length < minPathSegments) continue;
      }

      // Accept paths containing product tokens (check both path and full URL for query params)
      const isProduct = productTokens.some((token) => {
        const lower = token.toLowerCase();
        return path.includes(`/${lower}/`) || path.includes(`/${lower}`) ||
               path.includes(`${lower}.aspx`) || path.includes(`${lower}.php`) ||
               fullUrl.includes(`/${lower}/`);
      });

      if (isProduct) {
        links.add(resolved);
      }
    } catch {
      continue;
    }
  }

  return Array.from(links);
}

function extractProductFromPage(html, url, vendor) {
  const product = {
    product_name: null,
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    vendor_domain: vendor.domain,
    vendor_tier: vendor.tier,
    category: null,
    material: null,
    style: null,
    color: null,
    dimensions: null,
    sku: null,
    collection: null,
    image_url: null,
    images: [],
    product_url: url,
    description: null,
    retail_price: null,
    ingestion_source: "batch-scrape",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // ── JSON-LD structured data (best source) ──
  const jsonLd = extractJsonLd(html);
  if (jsonLd) {
    product.product_name = jsonLd.name || null;
    product.description = jsonLd.description || null;
    product.image_url = normalizeImage(jsonLd.image, vendor) || null;
    product.category = jsonLd.category || null;
    product.material = jsonLd.material || null;
    product.sku = jsonLd.sku || jsonLd.mpn || jsonLd.productID || null;
    product.color = jsonLd.color || null;
    // Collect all JSON-LD images
    if (jsonLd.image) {
      const imgs = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
      for (const img of imgs) {
        const resolved = normalizeImage(img, vendor);
        if (resolved) product.images.push(resolved);
      }
    }
    if (jsonLd.offers) {
      const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      product.retail_price = parsePrice(offers.price || offers.highPrice) || null;
    }
  }

  // ── Open Graph meta tags ──
  product.product_name = product.product_name || extractMeta(html, "og:title") || null;
  product.image_url = product.image_url || extractMeta(html, "og:image") || null;
  product.description = product.description || extractMeta(html, "og:description") || null;
  product.description = product.description || extractMeta(html, "description") || null;

  // ── SKU ──
  if (!product.sku) {
    const skuPatterns = [
      /itemprop=["']sku["'][^>]*content=["']([^"']+)["']/i,
      /data-sku=["']([^"']+)["']/i,
      /(?:sku|item\s*#?|model|style\s*#?)[\s:]*([A-Z0-9][\w-]{2,20})/i,
    ];
    for (const pat of skuPatterns) {
      const m = html.match(pat);
      if (m) { product.sku = m[1]; break; }
    }
  }

  // ── Dimensions ──
  if (!product.dimensions) {
    const dimPatterns = [
      /(?:dimensions?|overall\s*dimensions?|size|measurements?)[\s:]*([^<\n]{5,120})/i,
      /(\d+(?:\.\d+)?["″]\s*[WHDLwhd]\s*[x×X]\s*\d+(?:\.\d+)?["″]\s*[WHDLwhd](?:\s*[x×X]\s*\d+(?:\.\d+)?["″]\s*[WHDLwhd])?)/i,
    ];
    for (const pat of dimPatterns) {
      const m = html.match(pat);
      if (m) { product.dimensions = decodeHtmlEntities(m[1].trim()).slice(0, 120); break; }
    }
  }

  // ── Title tag ──
  if (!product.product_name) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      let title = decodeHtmlEntities(titleMatch[1].trim());
      const suffixes = vendor.profile?.title_suffixes || [];
      for (const suffix of suffixes) {
        if (title.endsWith(suffix)) title = title.slice(0, -suffix.length).trim();
      }
      product.product_name = title || null;
    }
  }

  // ── H1 tag (fallback for name) ──
  if (!product.product_name) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) product.product_name = decodeHtmlEntities(h1Match[1].trim()) || null;
  }

  // ── Collect ALL product images ──
  if (!product.image_url) {
    product.image_url = extractProductImage(html, vendor) || null;
  }
  const allImgs = extractAllProductImages(html, vendor);
  for (const img of allImgs) {
    if (!product.images.includes(img)) product.images.push(img);
  }
  if (product.image_url && !product.images.includes(product.image_url)) {
    product.images.unshift(product.image_url);
  }
  product.images = [...new Set(product.images)];

  // ── Price fallback ──
  if (!product.retail_price) {
    product.retail_price = extractPrice(html) || null;
  }

  // ── Category from URL path ──
  if (!product.category) {
    product.category = inferCategoryFromUrl(url) || null;
  }

  if (!product.product_name) return null;

  product.id = `${vendor.id}_${slugify(product.product_name)}`;
  return product;
}

// ── Extraction Helpers ───────────────────────────────────────

function extractJsonLd(html) {
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const items = data["@graph"] || [data];
      for (const item of Array.isArray(items) ? items : [items]) {
        const type = item["@type"];
        if (type === "Product" || type === "IndividualProduct" ||
            (Array.isArray(type) && type.includes("Product"))) {
          return item;
        }
      }
    } catch { /* skip */ }
  }
  return null;
}

function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(name)}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegex(name)}["']`, "i"),
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function extractProductImage(html, vendor) {
  const imageHints = vendor.profile?.image_path_hints || ["/products/", "/images/", "/media/"];
  const imgPattern = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    const src = match[1];
    if (imageHints.some((hint) => src.includes(hint))) {
      return resolveUrl(src, vendor.domain);
    }
  }
  return null;
}

function extractAllProductImages(html, vendor) {
  const imageHints = vendor.profile?.image_path_hints || ["/products/", "/images/", "/media/"];
  const images = [];
  const seen = new Set();
  const imgPattern = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    const src = match[1];
    if (imageHints.some((hint) => src.includes(hint))) {
      const resolved = resolveUrl(src, vendor.domain);
      if (resolved && !seen.has(resolved)) {
        if (/swatch|logo|icon|pixel|spacer|\.gif|\.svg|50x50|75x75|100x100/i.test(resolved.toLowerCase())) continue;
        seen.add(resolved);
        images.push(resolved);
      }
    }
  }
  return images;
}

function extractPrice(html) {
  const pricePatterns = [
    /class=["'][^"']*price[^"']*["'][^>]*>\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,
    /data-price=["']([\d,.]+)["']/i,
  ];
  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) return parsePrice(match[1]);
  }
  return null;
}

function inferCategoryFromUrl(url) {
  const map = {
    sofa: "seating", sofas: "seating", couch: "seating",
    chair: "seating", chairs: "seating", "accent-chair": "seating",
    sectional: "seating", sectionals: "seating",
    ottoman: "seating", ottomans: "seating",
    bench: "seating", benches: "seating",
    table: "tables", tables: "tables",
    desk: "home-office", desks: "home-office",
    bed: "bedroom", beds: "bedroom",
    dresser: "bedroom", nightstand: "bedroom",
    cabinet: "storage", sideboard: "storage",
    lamp: "lighting", chandelier: "lighting", sconce: "lighting",
    mirror: "mirrors", rug: "rugs",
    chaise: "seating", stool: "seating", stools: "seating",
    "bar-stool": "seating", barcounterstools: "seating",
    sleeper: "seating", relaxor: "seating", recliner: "seating",
    dining: "dining", outdoor: "outdoor", living: "seating",
  };
  try {
    const path = new URL(url).pathname.toLowerCase();
    for (const segment of path.split("/").filter(Boolean)) {
      if (map[segment]) return map[segment];
      for (const [key, value] of Object.entries(map)) {
        if (segment.includes(key)) return value;
      }
    }
  } catch { /* skip */ }
  return null;
}

// ── Utility ──────────────────────────────────────────────────

function parsePrice(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

function slugify(text) {
  if (!text) return `unknown-${Date.now()}`;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function resolveUrl(href, domain) {
  if (!href) return null;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `https://${domain}${href}`;
  return null;
}

function normalizeImage(img, vendor) {
  if (!img) return null;
  if (Array.isArray(img)) img = img[0];
  if (typeof img === "object" && img.url) img = img.url;
  if (typeof img !== "string") return null;
  return resolveUrl(img, vendor.domain);
}

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/").replace(/&nbsp;/g, " ");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Batch Concurrency ────────────────────────────────────────

async function fetchInBatches(urls, fn, concurrency = CONCURRENT_FETCHES) {
  const results = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const r of batchResults) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
    if (i + concurrency < urls.length) {
      process.stdout.write(`  ${Math.min(i + concurrency, urls.length)}/${urls.length} pages fetched\r`);
    }
  }
  return results;
}

// ── MT Company AJAX Scraper ──────────────────────────────────

async function scrapeMtCompanyViaAjax(vendor, dryRun) {
  const ajaxCategories = vendor.discovery?.ajax_categories || [];
  const ajaxEndpoint = vendor.discovery?.ajax_endpoint || "/inc/ajax/filter_furniture.php";
  const domain = vendor.domain;

  console.log(`  Using AJAX endpoint for ${ajaxCategories.length} categories`);

  // Step 1: Discover all product URLs via AJAX pagination
  const allProducts = new Map(); // url → { name, sku, image, category }

  for (const cat of ajaxCategories) {
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        category: cat,
        limit: "60",
        page: String(page),
        view: "1",
      });
      const url = `https://${domain}${ajaxEndpoint}?${params}`;
      const html = await fetchHtml(url);
      if (!html) { hasMore = false; break; }

      // Extract product cards from AJAX response
      const productPattern = /href="furniture\/detail\/([^"]+)"[^>]*title="([^"]*)"[\s\S]*?src="([^"]+)"[\s\S]*?<span class="small">([^<]*)<\/span>/g;
      let match;
      let pageCount = 0;
      while ((match = productPattern.exec(html)) !== null) {
        const detailPath = match[1];
        const name = decodeHtmlEntities(match[2]);
        const image = match[3];
        const sku = match[4].trim();
        const productUrl = `https://${domain}/furniture/detail/${detailPath}`;

        if (!allProducts.has(productUrl)) {
          allProducts.set(productUrl, { name, sku, image, category: cat });
          pageCount++;
        }
      }

      // Check if there's a next page
      const nextPageMatch = html.match(/PAGE\s+\d+\s+of\s+(\d+)/);
      const totalPages = nextPageMatch ? parseInt(nextPageMatch[1]) : 1;
      hasMore = page < totalPages;
      page++;

      if (pageCount > 0) {
        console.log(`  ${cat} page ${page - 1}/${totalPages} → ${pageCount} new products`);
      }

      await sleep(800); // Rate limit between AJAX calls
    }
  }

  console.log(`\n  Total unique products from AJAX: ${allProducts.size}`);

  if (dryRun) {
    console.log("  [DRY RUN] Would fetch detail pages and import");
    return 0;
  }

  if (allProducts.size === 0) return 0;

  // Step 2: Fetch each detail page for full product data
  console.log("  Fetching product detail pages...");
  const productUrls = Array.from(allProducts.keys());
  const seenNames = new Set();
  const products = [];

  const extracted = await fetchInBatches(productUrls, async (url) => {
    const listing = allProducts.get(url);
    const html = await fetchHtml(url);

    const baseListing = {
      id: `miles-talbott_${slugify(listing?.name || "unknown")}`,
      product_name: listing?.name || null,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      vendor_domain: vendor.domain,
      vendor_tier: vendor.tier,
      category: inferCategoryFromUrl(url),
      sku: listing?.sku || null,
      image_url: listing?.image ? resolveUrl(listing.image, domain) : null,
      images: listing?.image ? [resolveUrl(listing.image, domain)] : [],
      product_url: url,
      description: null,
      dimensions: null,
      collection: null,
      color: null,
      material: null,
      style: null,
      retail_price: null,
      ingestion_source: "batch-scrape",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (!html) return baseListing.product_name ? baseListing : null;

    // Enrich from detail page
    return extractMtProductFromPage(html, url, vendor, baseListing);
  }, CONCURRENT_FETCHES);

  for (const product of extracted) {
    // Dedup by name+sku since MT has variants (e.g., sofa vs loveseat with same name)
    const nameKey = `${product.product_name}_${product.sku || ""}`.toLowerCase().trim();
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);
    products.push(product);
  }

  console.log(`\n  Extracted: ${extracted.length} products`);
  console.log(`  After dedup: ${products.length} unique products`);

  if (products.length > 0) {
    const result = insertProducts(products);
    console.log(`  Inserted: ${result.inserted} new, ${result.updated} updated`);
    return result.inserted;
  }
  return 0;
}

function extractMtProductFromPage(html, url, vendor, baseListing) {
  const product = { ...baseListing };

  // MT-specific: product name from h3 (og:title and h1 are always "The MT Company")
  const h3Match = html.match(/<h3[^>]*class="[^"]*Playfair[^"]*"[^>]*>([^<]+)<\/h3>/i);
  if (h3Match) {
    product.product_name = decodeHtmlEntities(h3Match[1].trim());
  }
  // Listing name is more reliable — keep it if h3 is missing
  if (!product.product_name && baseListing.product_name) {
    product.product_name = baseListing.product_name;
  }
  if (!product.product_name) return null;

  product.id = `miles-talbott_${slugify(product.product_name)}`;

  // MT-specific: SKU from page (e.g., THO-880-S)
  const skuMatch = html.match(/Furniture\s*\|\s*\w+\s*\|\s*([A-Z0-9][\w-]+)\s*\|/i);
  if (skuMatch) product.sku = skuMatch[1];

  // MT-specific dimensions: "86W x 31D x 31H" pattern
  const dimMatch = html.match(/(\d+)W\s*x\s*(\d+)D\s*x\s*(\d+)H/i);
  if (dimMatch) product.dimensions = dimMatch[0];

  // Arm/seat dimensions
  const seatHeight = html.match(/Seat\s*Height[:\s]*(\d+)/i);
  const seatDepth = html.match(/Seat\s*Depth[:\s]*(\d+)/i);
  const armHeight = html.match(/Arm\s*Height[:\s]*(\d+)/i);
  if (product.dimensions && (seatHeight || seatDepth || armHeight)) {
    const extras = [];
    if (seatHeight) extras.push(`SH: ${seatHeight[1]}"`);
    if (seatDepth) extras.push(`SD: ${seatDepth[1]}"`);
    if (armHeight) extras.push(`AH: ${armHeight[1]}"`);
    product.dimensions += ` (${extras.join(", ")})`;
  }

  // MT-specific: description from meta description
  product.description = extractMeta(html, "description") || null;

  // MT-specific: collection
  const collMatch = html.match(/<a[^>]*href="[^"]*collection[^"]*"[^>]*>([^<]+)<\/a>/i);
  if (collMatch) product.collection = decodeHtmlEntities(collMatch[1].trim());

  // MT-specific: hero images (primary + numbered variants)
  const heroImgPattern = /src="(\/uploads\/images\/furniture\/hero\/[^"]+\.jpg)"/gi;
  let imgMatch;
  while ((imgMatch = heroImgPattern.exec(html)) !== null) {
    const imgUrl = `https://${vendor.domain}${imgMatch[1]}`;
    if (!product.images.includes(imgUrl)) {
      product.images.push(imgUrl);
    }
  }
  if (product.images.length > 0) {
    product.image_url = product.images[0];
  }

  // MT-specific: style features (arm, back, cushion, base)
  const armStyle = html.match(/Arm\s*Style[:\s]*<[^>]*>([^<]+)/i);
  const backStyle = html.match(/Back\s*Style[:\s]*<[^>]*>([^<]+)/i);
  if (armStyle || backStyle) {
    product.style = [armStyle?.[1], backStyle?.[1]].filter(Boolean).join(", ");
  }

  return product;
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Batch Vendor Scrape");
  console.log("═══════════════════════════════════════════════════════\n");

  // Resolve vendors
  const vendorIds = vendorArg === "all-configured"
    ? priorityVendors.filter(v => v.discovery?.category_urls?.length > 0).map(v => v.id)
    : vendorArg.split(",").map(s => s.trim());

  console.log(`Vendors: ${vendorIds.join(", ")}`);
  console.log(`Dry run: ${dryRun}\n`);

  if (!dryRun) {
    console.log("Initializing catalog database...");
    await initCatalogDB();
    console.log(`Catalog has ${getProductCount()} products before scrape\n`);
  }

  let totalNew = 0;

  for (const vendorId of vendorIds) {
    const vendorProfile = priorityVendors.find(v => v.id === vendorId);
    const tradeVendor = tradeVendors.find(v => v.id === vendorId);

    if (!vendorProfile) {
      console.warn(`${LOG} Vendor profile not found: ${vendorId}, skipping`);
      continue;
    }

    const vendor = {
      ...vendorProfile,
      tier: tradeVendor?.tier || 3,
      categories: tradeVendor?.categories || [],
    };

    console.log(`\n── ${vendor.name} ──────────────────────────────────`);

    // MT Company uses AJAX-based discovery
    if (vendor.discovery?.ajax_categories?.length > 0) {
      const added = await scrapeMtCompanyViaAjax(vendor, dryRun);
      totalNew += added;
      continue;
    }

    const categoryUrls = vendor.discovery?.category_urls || [];
    if (categoryUrls.length === 0) {
      console.warn(`${LOG} No category_urls for ${vendor.name}, skipping`);
      continue;
    }

    console.log(`  ${categoryUrls.length} category pages to fetch`);

    // Step 1: Fetch all category pages and extract product links
    const allProductLinks = new Set();

    for (const catPath of categoryUrls) {
      const catUrl = `https://${vendor.domain}${catPath}`;
      const html = await fetchHtml(catUrl);
      if (!html) {
        console.warn(`  Failed to fetch: ${catPath}`);
        continue;
      }

      const links = extractProductLinks(html, vendor);
      for (const link of links) allProductLinks.add(link);
      console.log(`  ${catPath.slice(0, 60)}... → ${links.length} product links`);
    }

    console.log(`\n  Total unique product URLs: ${allProductLinks.size}`);

    if (dryRun) {
      console.log("  [DRY RUN] Would fetch and import these products");
      continue;
    }

    if (allProductLinks.size === 0) {
      console.log("  No product links found, skipping");
      continue;
    }

    // Step 2: Fetch each product page and extract data
    console.log(`  Fetching product pages...`);
    const productUrls = Array.from(allProductLinks);
    const seenNames = new Set();
    const products = [];

    const extracted = await fetchInBatches(productUrls, async (url) => {
      const html = await fetchHtml(url);
      if (!html) return null;
      return extractProductFromPage(html, url, vendor);
    }, CONCURRENT_FETCHES);

    // Deduplicate by product name (within this vendor)
    for (const product of extracted) {
      const nameKey = product.product_name.toLowerCase().trim();
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);
      products.push(product);
    }

    console.log(`\n  Extracted: ${extracted.length} products`);
    console.log(`  After dedup: ${products.length} unique products`);

    // Step 3: Insert into catalog
    if (products.length > 0) {
      const result = insertProducts(products);
      console.log(`  Inserted: ${result.inserted} new, ${result.updated} updated`);
      totalNew += result.inserted;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
  if (dryRun) {
    console.log("  DRY RUN complete — no data was saved");
  } else {
    console.log(`  Done! ${totalNew} new products added`);
    console.log(`  Catalog now has ${getProductCount()} products`);
  }
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(`${LOG} Fatal error:`, err);
  process.exit(1);
});
