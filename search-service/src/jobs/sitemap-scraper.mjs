#!/usr/bin/env node
/**
 * Sitemap Scraper — Imports products from vendor sitemaps
 *
 * For JS-rendered sites where HTML scraping doesn't work, sitemaps
 * provide a complete list of product URLs (and often images + descriptions).
 *
 * Step 1: Parse sitemap.xml for product URLs
 * Step 2: Fetch each product page for full data (name, SKU, dims, images)
 * Step 3: Deduplicate and insert into catalog
 *
 * Usage:
 *   node src/jobs/sitemap-scraper.mjs --vendor baker
 *   node src/jobs/sitemap-scraper.mjs --vendor baker --sitemap-only   # Just parse sitemap, don't fetch pages
 *   node src/jobs/sitemap-scraper.mjs --vendor baker --dry-run
 */

import { initCatalogDB, insertProducts, getProductCount } from "../db/catalog-db.mjs";
import { priorityVendors } from "../config/vendors.mjs";
import { tradeVendors } from "../config/trade-vendors.mjs";

const LOG = "[sitemap-scraper]";
const USER_AGENT = "Spekd-Crawler/1.0 (furniture-search; contact@spekd.design)";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_HTML_SIZE = 2_000_000;
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
const sitemapOnly = flags["sitemap-only"] === true;

if (!vendorArg) {
  console.error("Usage: node sitemap-scraper.mjs --vendor <vendor-id>");
  process.exit(1);
}

// ── HTTP ──────────────────────────────────────────────────────

let lastRequestTime = 0;

async function fetchUrl(url, maxSize = MAX_HTML_SIZE) {
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
    if (!response.ok) return null;
    const text = await response.text();
    return text.slice(0, maxSize);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Sitemap Parser ───────────────────────────────────────────

function parseSitemapUrls(xml, vendor) {
  const productTokens = vendor.profile?.product_path_tokens || ["product", "products"];
  const rejectTokens = vendor.profile?.reject_path_tokens || [];
  const minPathSegments = vendor.profile?.min_path_segments || 0;
  const acceptAll = vendor.profile?.accept_all_sitemap_urls || false;
  const results = [];

  // Handle sitemap index (contains other sitemaps)
  if (xml.includes("<sitemapindex")) {
    // This is a sitemap index, not a urlset — caller should handle sub-sitemaps
    const subSitemaps = [];
    const sitemapPattern = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
    let sm;
    while ((sm = sitemapPattern.exec(xml)) !== null) {
      const locMatch = sm[1].match(/<loc>([^<]+)<\/loc>/i);
      if (locMatch) subSitemaps.push(locMatch[1].trim());
    }
    // Return empty but log sub-sitemaps
    if (subSitemaps.length > 0) {
      console.log(`  Sitemap index with ${subSitemaps.length} sub-sitemaps: ${subSitemaps.join(", ")}`);
    }
    return results;
  }

  // Extract all <url> entries
  const urlPattern = /<url>([\s\S]*?)<\/url>/gi;
  let match;
  while ((match = urlPattern.exec(xml)) !== null) {
    const block = match[1];

    // Extract <loc>
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/i);
    if (!locMatch) continue;
    const loc = locMatch[1].trim();

    // Skip non-HTML resources
    if (/\.(jpg|png|gif|svg|css|js|pdf|xml)$/i.test(loc)) continue;

    if (!acceptAll) {
      // Check if this is a product URL
      try {
        const parsedUrl = new URL(loc);
        const path = parsedUrl.pathname.toLowerCase();

        // Reject non-product paths
        if (rejectTokens.some((token) => path === `/${token}` || path === `/${token}/`)) continue;

        // Min segments check
        const segments = path.split("/").filter(Boolean);
        if (minPathSegments > 0 && segments.length < minPathSegments) continue;

        // Product token check
        const isProduct = productTokens.some((token) => {
          const lower = token.toLowerCase();
          return path.includes(`/${lower}/`) || path.includes(`/${lower}`);
        });
        if (!isProduct) continue;
      } catch {
        continue;
      }
    } else {
      // Accept all URLs from sitemap (for sites where products are at root paths)
      try {
        const path = new URL(loc).pathname;
        // Skip obviously non-product paths (homepage, login, etc.)
        if (path === "/" || path.split("/").filter(Boolean).length === 0) continue;
      } catch {
        continue;
      }
    }

    // Extract images from <image:image> blocks
    const images = [];
    const imgPattern = /<image:loc>([^<]+)<\/image:loc>/gi;
    let imgMatch;
    while ((imgMatch = imgPattern.exec(block)) !== null) {
      images.push(imgMatch[1].trim());
    }

    // Extract image caption (often has description)
    const captionMatch = block.match(/<image:caption>([^<]+)<\/image:caption>/i);
    const caption = captionMatch ? decodeHtmlEntities(captionMatch[1].trim()) : null;

    // Extract image title
    const titleMatch = block.match(/<image:title>([^<]+)<\/image:title>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;

    results.push({ url: loc, images, caption, title });
  }

  return results;
}

// ── Product Extraction from Page ─────────────────────────────

function extractProductFromPage(html, url, vendor, sitemapData = null) {
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
    images: sitemapData?.images || [],
    product_url: url,
    description: sitemapData?.caption || null,
    retail_price: null,
    ingestion_source: "sitemap-scrape",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // JSON-LD
  const jsonLd = extractJsonLd(html);
  if (jsonLd) {
    product.product_name = jsonLd.name || null;
    product.description = product.description || jsonLd.description || null;
    product.sku = jsonLd.sku || jsonLd.mpn || jsonLd.productID || null;
    product.material = jsonLd.material || null;
    product.color = jsonLd.color || null;
    if (jsonLd.image) {
      const imgs = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image];
      for (const img of imgs) {
        const resolved = normalizeImage(img, vendor);
        if (resolved && !product.images.includes(resolved)) product.images.push(resolved);
      }
    }
    if (jsonLd.offers) {
      const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      product.retail_price = parsePrice(offers.price || offers.highPrice) || null;
    }
  }

  // OG tags
  product.product_name = product.product_name || extractMeta(html, "og:title") || null;
  const ogImage = extractMeta(html, "og:image");
  if (ogImage && !product.images.includes(ogImage)) product.images.push(ogImage);
  product.description = product.description || extractMeta(html, "og:description") || null;

  // SKU
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

  // Dimensions
  if (!product.dimensions) {
    const dimPatterns = [
      /(?:dimensions?|overall\s*dimensions?|size|measurements?)[\s:]*([^<\n]{5,120})/i,
      /(\d+(?:\.\d+)?["″]\s*[WHDLwhd]\s*[x×X]\s*\d+(?:\.\d+)?["″])/i,
      /(?:width|W)[\s:]*(\d+(?:\.\d+)?)\s*(?:"|in).*?(?:depth|D)[\s:]*(\d+(?:\.\d+)?)\s*(?:"|in).*?(?:height|H)[\s:]*(\d+(?:\.\d+)?)\s*(?:"|in)/i,
    ];
    for (const pat of dimPatterns) {
      const m = html.match(pat);
      if (m) {
        product.dimensions = m[3]
          ? `W: ${m[1]}in x D: ${m[2]}in x H: ${m[3]}in`
          : decodeHtmlEntities(m[1].trim()).slice(0, 120);
        break;
      }
    }
  }

  // Title tag
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

  // H1 fallback
  if (!product.product_name) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) product.product_name = decodeHtmlEntities(h1Match[1].trim()) || null;
  }

  // Extract name from URL slug as last resort
  if (!product.product_name) {
    try {
      const segments = new URL(url).pathname.split("/").filter(Boolean);
      const slug = segments[segments.length - 1];
      if (slug && slug.length > 3) {
        product.product_name = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      }
    } catch { /* skip */ }
  }

  // Set primary image
  if (product.images.length > 0 && !product.image_url) {
    product.image_url = product.images[0];
  }

  // Category from URL
  if (!product.category) {
    product.category = inferCategoryFromUrl(url) || null;
  }

  if (!product.product_name) return null;

  product.id = `${vendor.id}_${slugify(product.product_name)}`;
  product.images = [...new Set(product.images)];

  return product;
}

// ── Sitemap-only product (no page fetch) ─────────────────────

function productFromSitemapEntry(entry, vendor) {
  const product = {
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    vendor_domain: vendor.domain,
    vendor_tier: vendor.tier,
    image_url: entry.images[0] || null,
    images: entry.images,
    product_url: entry.url,
    description: entry.caption || null,
    category: inferCategoryFromUrl(entry.url) || null,
    ingestion_source: "sitemap-import",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Extract name from URL slug
  try {
    const segments = new URL(entry.url).pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1];
    if (slug && slug.length > 3) {
      // Remove trailing SKU pattern (e.g., "parlor-sofa-baa4406s" → "Parlor Sofa")
      const cleanSlug = slug.replace(/-[a-z]{2,3}\d{3,5}[a-z]?$/i, "");
      product.product_name = cleanSlug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    }
  } catch { /* skip */ }

  if (!product.product_name) return null;

  product.id = `${vendor.id}_${slugify(product.product_name)}`;

  return product;
}

// ── Helpers ──────────────────────────────────────────────────

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
            (Array.isArray(type) && type.includes("Product"))) return item;
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
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) return decodeHtmlEntities(m[1]);
  }
  return null;
}

function inferCategoryFromUrl(url) {
  const map = {
    sofa: "seating", sofas: "seating", chair: "seating", chairs: "seating",
    sectional: "seating", sectionals: "seating", ottoman: "seating", ottomans: "seating",
    bench: "seating", benches: "seating", chaise: "seating", chaises: "seating",
    stool: "seating", stools: "seating", barcounterstools: "seating",
    table: "tables", tables: "tables", nightstand: "bedroom", nightstands: "bedroom",
    desk: "home-office", desks: "home-office", bed: "bedroom", beds: "bedroom",
    cabinet: "storage", cabinets: "storage", chest: "storage", chests: "storage",
    etagere: "storage", etageres: "storage", server: "storage", servers: "storage",
    lamp: "lighting", chandelier: "lighting", sconce: "lighting", lighting: "lighting",
    mirror: "mirrors", mirrors: "mirrors", accessories: "decorative-objects",
    dining: "dining", outdoor: "outdoor", living: "seating", workspace: "home-office",
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

function parsePrice(raw) {
  if (raw == null) return null;
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  return isNaN(num) || num <= 0 ? null : num;
}

function slugify(text) {
  if (!text) return `unknown-${Date.now()}`;
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

function normalizeImage(img, vendor) {
  if (!img) return null;
  if (Array.isArray(img)) img = img[0];
  if (typeof img === "object" && img.url) img = img.url;
  if (typeof img !== "string") return null;
  if (img.startsWith("//")) return `https:${img}`;
  if (img.startsWith("http")) return img;
  if (img.startsWith("/")) return `https://${vendor.domain}${img}`;
  return null;
}

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Sitemap Scraper");
  console.log("═══════════════════════════════════════════════════════\n");

  const vendorIds = vendorArg.split(",").map(s => s.trim());

  if (!dryRun) {
    await initCatalogDB();
    console.log(`Catalog has ${getProductCount()} products before scrape\n`);
  }

  for (const vendorId of vendorIds) {
    const vendorProfile = priorityVendors.find(v => v.id === vendorId);
    const tradeVendor = tradeVendors.find(v => v.id === vendorId);

    if (!vendorProfile) {
      console.warn(`${LOG} Vendor not found: ${vendorId}`);
      continue;
    }

    const vendor = {
      ...vendorProfile,
      tier: tradeVendor?.tier || 3,
    };

    console.log(`\n── ${vendor.name} ──────────────────────────────────`);

    // Fetch sitemap
    const sitemapUrl = vendor.sitemap_url || `https://${vendor.domain}/sitemap.xml`;
    console.log(`Fetching sitemap: ${sitemapUrl}`);
    const xml = await fetchUrl(sitemapUrl, 10_000_000); // 10MB for large sitemaps
    if (!xml) {
      console.warn(`Failed to fetch sitemap for ${vendor.name}`);
      continue;
    }

    // Parse product URLs
    const entries = parseSitemapUrls(xml, vendor);
    console.log(`Found ${entries.length} product URLs in sitemap`);

    if (entries.length === 0) continue;

    if (sitemapOnly || dryRun) {
      // Just import from sitemap data (no page fetches)
      const products = [];
      const seenNames = new Set();

      for (const entry of entries) {
        const product = productFromSitemapEntry(entry, vendor);
        if (!product) continue;
        const key = product.product_name.toLowerCase();
        if (seenNames.has(key)) continue;
        seenNames.add(key);
        products.push(product);
      }

      console.log(`Extracted ${products.length} unique products from sitemap data`);

      if (dryRun) {
        console.log("[DRY RUN] Would import these products");
        console.log("Sample:", products.slice(0, 3).map(p => `${p.product_name} (${p.images.length} imgs)`));
        continue;
      }

      if (products.length > 0) {
        const result = insertProducts(products);
        console.log(`Inserted: ${result.inserted} new, ${result.updated} updated`);
      }
      continue;
    }

    // Full scrape: fetch each product page
    console.log(`Fetching ${entries.length} product pages...`);
    const products = [];
    const seenNames = new Set();
    let fetched = 0;

    for (let i = 0; i < entries.length; i += CONCURRENT_FETCHES) {
      const batch = entries.slice(i, i + CONCURRENT_FETCHES);
      const results = await Promise.allSettled(batch.map(async (entry) => {
        const html = await fetchUrl(entry.url);
        if (!html) return productFromSitemapEntry(entry, vendor); // Fallback to sitemap data
        return extractProductFromPage(html, entry.url, vendor, entry);
      }));

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          const product = r.value;
          const key = product.product_name.toLowerCase();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            products.push(product);
          }
        }
      }

      fetched += batch.length;
      process.stdout.write(`  ${fetched}/${entries.length} pages fetched, ${products.length} products\r`);
    }

    console.log(`\nExtracted ${products.length} unique products`);

    if (products.length > 0) {
      const result = insertProducts(products);
      console.log(`Inserted: ${result.inserted} new, ${result.updated} updated`);
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
  if (dryRun) {
    console.log("  DRY RUN complete");
  } else {
    console.log(`  Done! Catalog now has ${getProductCount()} products`);
  }
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(`${LOG} Fatal error:`, err);
  process.exit(1);
});
