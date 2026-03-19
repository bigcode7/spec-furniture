#!/usr/bin/env node
/**
 * Norwalk Furniture Scraper — Full catalog import via Magento listing + detail pages
 *
 * Norwalk is a fully customizable, made-to-order manufacturer. All products are
 * shown in neutral gray fabric intentionally — this is NOT a data quality issue.
 *
 * Site: Magento 2 with server-side HTML
 * Pagination: ?p=N&product_list_limit=100 (526 products, ~6 pages at 100/page)
 *
 * Usage:
 *   node src/jobs/norwalk-scraper.mjs                # full scrape
 *   node src/jobs/norwalk-scraper.mjs --dry-run      # listing only, no detail pages
 *   node src/jobs/norwalk-scraper.mjs --limit 10     # scrape only N detail pages
 */

import { initCatalogDB, insertProducts, getProductCount } from "../db/catalog-db.mjs";

const LOG = "[norwalk]";
const BASE = "https://www.norwalkfurniture.com";
const LISTING_URL = `${BASE}/furniture`;
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const RATE_LIMIT_MS = 1_000;
const REQUEST_TIMEOUT_MS = 20_000;
const PRODUCTS_PER_PAGE = 100;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const detailLimit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;

// ── HTTP ─────────────────────────────────────────────────────

let lastRequestTime = 0;

async function fetchHtml(url, retries = 2) {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequestTime));
  if (wait > 0) await sleep(wait);
  lastRequestTime = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        console.warn(`${LOG} HTTP ${res.status} for ${url}`);
        if (attempt < retries) { await sleep(3000); continue; }
        return null;
      }
      return await res.text();
    } catch (err) {
      clearTimeout(timeout);
      console.warn(`${LOG} Fetch error (attempt ${attempt + 1}): ${err.message} — ${url}`);
      if (attempt < retries) await sleep(3000);
    }
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Listing Page Parser ──────────────────────────────────────

function parseListingPage(html) {
  const products = [];

  // Find all product links — Magento uses <a> tags with product URLs
  // Pattern: <a href="https://www.norwalkfurniture.com/SLUG" ...> with product info nearby
  // Product cards contain: link, image, name, SKU

  // Extract product items from the product list
  // Magento wraps each product in a product-item div with class="product-item-info"
  const itemRegex = /<li[^>]*class="[^"]*product-item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;

  while ((match = itemRegex.exec(html)) !== null) {
    const block = match[1];

    // Product URL
    const urlMatch = block.match(/href="(https:\/\/www\.norwalkfurniture\.com\/[^"]+)"/);
    if (!urlMatch) continue;
    const productUrl = urlMatch[1];

    // Skip non-product URLs
    if (productUrl.includes("/furniture") && productUrl.endsWith("/furniture")) continue;
    if (productUrl.includes("?") || productUrl.includes("#")) continue;

    // Product name from link text or img alt
    let name = null;
    const nameMatch = block.match(/<a[^>]*class="[^"]*product-item-link[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/a>/i);
    if (nameMatch) {
      name = nameMatch[1].replace(/<[^>]+>/g, "").trim();
    }
    if (!name) {
      const altMatch = block.match(/alt="([^"]+)"/i);
      if (altMatch) name = altMatch[1].trim();
    }
    if (!name) continue;

    // Thumbnail image
    let thumbnail = null;
    const imgMatch = block.match(/src="([^"]*\/media\/catalog\/product[^"]+)"/i);
    if (imgMatch) thumbnail = imgMatch[1];
    // Also check lazy-load src
    if (!thumbnail) {
      const lazySrc = block.match(/data-src="([^"]*\/media\/catalog\/product[^"]+)"/i);
      if (lazySrc) thumbnail = lazySrc[1];
    }

    // SKU / Style No from listing
    let sku = null;
    // Often in a <p> or <div> after the name, or as data attribute
    const skuMatch = block.match(/data-product-sku="([^"]+)"/i) ||
                     block.match(/<(?:p|span|div)[^>]*>\s*(?:Style\s*(?:No\.?|#)?:?\s*)?([A-Z0-9][-A-Z0-9]{3,})\s*<\//i);
    if (skuMatch) sku = skuMatch[1].trim();

    products.push({
      name: cleanName(name),
      url: productUrl,
      thumbnail,
      sku,
    });
  }

  // Fallback: if the item regex didn't match, try a broader approach
  if (products.length === 0) {
    // Look for all product links on the page
    const linkRegex = /href="(https:\/\/www\.norwalkfurniture\.com\/([a-z0-9][-a-z0-9]*))"/gi;
    const seen = new Set();
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1];
      const slug = match[2];
      // Skip known non-product paths
      if (["furniture", "about", "contact", "fabrics", "stores", "customer", "checkout",
           "catalogsearch", "cms", "wishlist", "privacy", "terms", "media"].includes(slug)) continue;
      if (seen.has(url)) continue;
      seen.add(url);

      // Try to get name from nearby text
      const nameFromAlt = html.match(new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>\\s*([^<]+)`, 'i'));
      const name = nameFromAlt ? cleanName(nameFromAlt[1]) : slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

      products.push({ name, url, thumbnail: null, sku: null });
    }
  }

  // Get total count from "Items X-Y of Z" text
  let totalCount = null;
  const countMatch = html.match(/Items\s+\d+[-–]\d+\s+of\s+(\d+)/i);
  if (countMatch) totalCount = parseInt(countMatch[1], 10);

  return { products, totalCount };
}

// ── Detail Page Parser ───────────────────────────────────────

function parseDetailPage(html, listingData) {
  const product = {
    name: listingData.name,
    url: listingData.url,
    sku: listingData.sku,
    images: [],
    description: null,
    dimensions: null,
    category: null,
    collection: null,
    construction: null,
  };

  // Product name from h1 (more authoritative than listing)
  const h1Match = html.match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i);
  if (h1Match) {
    const h1Name = h1Match[1].replace(/<[^>]+>/g, "").trim();
    if (h1Name && h1Name.length > 1 && h1Name.length < 200) {
      product.name = cleanName(h1Name);
    }
  }

  // SKU / Style No from detail page
  if (!product.sku) {
    const styleMatch = html.match(/Style\s*(?:No\.?|Number|#)?:?\s*<?\/?[^>]*>?\s*([A-Z0-9][-A-Z0-9a-z]{2,})/i);
    if (styleMatch) product.sku = styleMatch[1].trim();
  }
  // Also try meta or data attributes
  if (!product.sku) {
    const metaSku = html.match(/<meta[^>]*itemprop="sku"[^>]*content="([^"]+)"/i) ||
                    html.match(/<meta[^>]*content="([^"]+)"[^>]*itemprop="sku"/i);
    if (metaSku) product.sku = metaSku[1].trim();
  }
  // Try product-info-stock-sku area
  if (!product.sku) {
    const skuBlock = html.match(/class="[^"]*product-info-stock-sku[^"]*"[\s\S]*?<div[^>]*class="[^"]*value[^"]*"[^>]*>\s*(\S+)\s*<\/div>/i);
    if (skuBlock) product.sku = skuBlock[1].trim();
  }

  // Images — collect all product media images
  const imageSet = new Set();

  // Gallery images (Magento Fotorama)
  const galleryRegex = /(?:data-gallery-role|data-image-url|data-src|src)\s*=\s*"([^"]*\/media\/catalog\/product[^"]+)"/gi;
  let imgMatch;
  while ((imgMatch = galleryRegex.exec(html)) !== null) {
    const url = imgMatch[1];
    // Skip tiny placeholders and cache thumbnails — prefer originals
    if (!url.includes("placeholder") && !url.includes("_thumb")) {
      imageSet.add(url.startsWith("http") ? url : `${BASE}${url}`);
    }
  }

  // Also try JSON gallery data (Magento often embeds gallery as JSON)
  const jsonGallery = html.match(/\[\s*\{[^[\]]*"img"\s*:\s*"[^"]*media\/catalog[^[\]]*\}\s*\]/g);
  if (jsonGallery) {
    for (const chunk of jsonGallery) {
      try {
        const items = JSON.parse(chunk);
        for (const item of items) {
          if (item.img) imageSet.add(item.img.startsWith("http") ? item.img : `${BASE}${item.img}`);
          if (item.full) imageSet.add(item.full.startsWith("http") ? item.full : `${BASE}${item.full}`);
        }
      } catch {}
    }
  }

  // mage/gallery/gallery JSON data
  const mageGallery = html.match(/"mage\/gallery\/gallery":\s*\{[^}]*"data"\s*:\s*(\[[^\]]*\])/);
  if (mageGallery) {
    try {
      const items = JSON.parse(mageGallery[1]);
      for (const item of items) {
        if (item.img) imageSet.add(item.img.startsWith("http") ? item.img : `${BASE}${item.img}`);
        if (item.full) imageSet.add(item.full.startsWith("http") ? item.full : `${BASE}${item.full}`);
      }
    } catch {}
  }

  // If no gallery images, use listing thumbnail
  if (imageSet.size === 0 && listingData.thumbnail) {
    imageSet.add(listingData.thumbnail.startsWith("http") ? listingData.thumbnail : `${BASE}${listingData.thumbnail}`);
  }

  product.images = [...imageSet];

  // Description
  const descMatch = html.match(/<div[^>]*(?:id="description"|class="[^"]*product-description[^"]*"|itemprop="description")[^>]*>\s*([\s\S]*?)\s*<\/div>/i);
  if (descMatch) {
    product.description = descMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  }
  // Fallback: meta description
  if (!product.description) {
    const metaDesc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i) ||
                     html.match(/<meta\s+content="([^"]+)"\s+name="description"/i);
    if (metaDesc) product.description = metaDesc[1].trim().slice(0, 500);
  }

  // Dimensions — look for dimension patterns
  const dimPatterns = [
    /(?:Dimensions?|Size|Measurements?)\s*:?\s*([\d.]+(?:\s*[""'']\s*|\s*(?:in|inches?))?\s*[×xX]\s*[\d.]+(?:\s*[""'']\s*|\s*(?:in|inches?))?\s*(?:[×xX]\s*[\d.]+(?:\s*[""'']\s*|\s*(?:in|inches?))?)?)/i,
    /(\d+(?:\.\d+)?)\s*[""'']\s*[Ww]\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[""'']\s*[Dd]\s*[×xX]\s*(\d+(?:\.\d+)?)\s*[""'']\s*[Hh]/,
    /(?:Width|W)\s*:?\s*(\d+(?:\.\d+)?)\s*[""'']?[\s,]*(?:Depth|D)\s*:?\s*(\d+(?:\.\d+)?)\s*[""'']?[\s,]*(?:Height|H)\s*:?\s*(\d+(?:\.\d+)?)/i,
    /(\d{2,3})\s*[""'']\s*[wW]\s*[xX×]\s*(\d{2,3})\s*[""'']\s*[dD]\s*[xX×]\s*(\d{2,3})\s*[""'']\s*[hH]/,
  ];
  for (const pat of dimPatterns) {
    const dimMatch = html.match(pat);
    if (dimMatch) {
      product.dimensions = dimMatch[0].replace(/<[^>]+>/g, "").trim();
      break;
    }
  }

  // Also look in a specs/additional-info table
  const specsBlock = html.match(/<(?:table|div)[^>]*(?:id="product-attribute-specs-table"|class="[^"]*additional-attributes[^"]*")[^>]*>([\s\S]*?)<\/(?:table|div)>/i);
  if (specsBlock) {
    const specsText = specsBlock[1];
    // Dimensions
    if (!product.dimensions) {
      const specDim = specsText.match(/(?:Dimension|Size|Measurement)[^<]*<[^>]*>\s*([^<]+)/i);
      if (specDim) product.dimensions = specDim[1].trim();
    }
    // Construction details
    const construction = specsText.match(/(?:Construction|Frame|Spring|Cushion|Filling)[^<]*<[^>]*>\s*([^<]+)/i);
    if (construction) product.construction = construction[1].trim();
  }

  // Category from breadcrumbs
  const breadcrumbs = html.match(/<(?:ul|ol|nav|div)[^>]*class="[^"]*breadcrumb[^"]*"[^>]*>([\s\S]*?)<\/(?:ul|ol|nav|div)>/i);
  if (breadcrumbs) {
    const crumbs = [...breadcrumbs[1].matchAll(/<a[^>]*>\s*([^<]+)\s*<\/a>/gi)].map(m => m[1].trim());
    const filtered = crumbs.filter(c => !["Home", "Norwalk", "Furniture", ""].includes(c));
    if (filtered.length > 0) product.category = filtered[filtered.length - 1];
  }

  // Category from product name, SKU, or description
  if (!product.category) {
    product.category = inferCategoryFromProductName(product.name)
      || inferCategoryFromProductName(product.sku || "")
      || inferCategoryFromProductName(product.description || "");
  }

  // Collection — look for collection info
  const collMatch = html.match(/(?:Collection|Series)\s*:?\s*<?\/?[^>]*>?\s*([A-Z][a-zA-Z0-9 &'-]+)/i);
  if (collMatch && collMatch[1].length < 80) {
    product.collection = collMatch[1].trim();
  }

  return product;
}

// ── Category Inference ───────────────────────────────────────

function inferCategoryFromProductName(name) {
  if (!name) return null;
  const n = name.toLowerCase();

  const patterns = [
    [/\bsofa\b/, "sofas"],
    [/\bsectional\b/, "sectionals"],
    [/\bloveseat\b|\blove\s*seat\b/, "loveseats"],
    [/\bswivel\s*chair\b|\bswivel\b/, "swivel-chairs"],
    [/\baccent\s*chair\b|\bclub\s*chair\b|\bwing\s*chair\b|\blounge\s*chair\b/, "accent-chairs"],
    [/\bdining\s*chair\b|\bside\s*chair\b|\bhost\s*chair\b/, "dining-chairs"],
    [/\bchair\b/, "accent-chairs"],
    [/\bottoman\b|\botto\b/, "ottomans"],
    [/\bbench\b/, "benches"],
    [/\bchaise\b/, "chaises"],
    [/\bsleeper\b/, "sofas"],
    [/\bsettee\b/, "loveseats"],
    [/\brecliner\b|\brelaxor\b/, "recliners"],
    [/\bbar\s*stool\b|\bcounter\s*stool\b|\bstool\b/, "bar-stools"],
    [/\bbed\b/, "beds"],
    [/\bheadboard\b/, "headboards"],
    [/\btable\b/, "side-tables"],
    [/\bdesk\b/, "desks"],
    [/\bstorage\b|\bcabinet\b|\bcredenza\b/, "cabinets"],
    [/\bbookcase\b|\betagere\b/, "bookcases"],
  ];

  for (const [pat, cat] of patterns) {
    if (pat.test(n)) return cat;
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────

function cleanName(name) {
  return name
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .replace(/&\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Norwalk Furniture — Full Catalog Scraper");
  console.log("═══════════════════════════════════════════════════════\n");

  await initCatalogDB();
  const countBefore = getProductCount();
  console.log(`  Catalog before: ${countBefore.toLocaleString()} products\n`);

  // ── Phase 1: Crawl listing pages ──
  console.log("  ── Phase 1: Listing pages ──\n");

  const allListings = [];
  const seenUrls = new Set();
  let page = 1;
  let totalExpected = null;

  while (true) {
    const url = `${LISTING_URL}?p=${page}&product_list_limit=${PRODUCTS_PER_PAGE}`;
    console.log(`  Fetching page ${page}... ${url}`);

    const html = await fetchHtml(url);
    if (!html) {
      console.warn(`  Page ${page} failed — stopping pagination`);
      break;
    }

    const { products, totalCount } = parseListingPage(html);
    if (totalCount && !totalExpected) {
      totalExpected = totalCount;
      console.log(`  Total products expected: ${totalExpected}`);
    }

    let newOnPage = 0;
    for (const p of products) {
      if (!seenUrls.has(p.url)) {
        seenUrls.add(p.url);
        allListings.push(p);
        newOnPage++;
      }
    }

    console.log(`  Page ${page}: ${products.length} items (${newOnPage} new, ${allListings.length} total)`);

    if (products.length === 0 || newOnPage === 0) break;
    if (totalExpected && allListings.length >= totalExpected) break;
    page++;

    // Safety: don't go past 30 pages
    if (page > 30) break;
  }

  console.log(`\n  Listing phase complete: ${allListings.length} unique products found\n`);

  if (dryRun) {
    console.log("  [DRY RUN] Skipping detail page fetches");
    console.log(`  Sample products:`);
    for (const p of allListings.slice(0, 10)) {
      console.log(`    ${(p.name || "?").padEnd(40)} ${p.sku || "—"}`);
    }
    return;
  }

  // ── Phase 2: Fetch detail pages ──
  console.log("  ── Phase 2: Detail pages ──\n");

  const toFetch = allListings.slice(0, detailLimit);
  const results = [];
  let fetched = 0;
  let errors = 0;

  for (const listing of toFetch) {
    fetched++;
    if (fetched % 50 === 0 || fetched === 1) {
      console.log(`  Fetching detail ${fetched}/${toFetch.length}...`);
    }

    const html = await fetchHtml(listing.url);
    if (!html) {
      errors++;
      // Still add with listing data
      results.push({
        name: listing.name,
        url: listing.url,
        sku: listing.sku,
        images: listing.thumbnail ? [listing.thumbnail] : [],
        description: null,
        dimensions: null,
        category: inferCategoryFromProductName(listing.name),
        collection: null,
        construction: null,
      });
      continue;
    }

    const product = parseDetailPage(html, listing);
    results.push(product);
  }

  console.log(`\n  Detail phase complete: ${results.length} products, ${errors} errors\n`);

  // ── Phase 3: Import into catalog ──
  console.log("  ── Phase 3: Catalog import ──\n");

  const catalogProducts = results.map(p => ({
    id: `norwalk_${slugify(p.sku || p.name)}`,
    product_name: p.name,
    vendor_id: "norwalk",
    vendor_name: "Norwalk Furniture",
    vendor_domain: "norwalkfurniture.com",
    sku: p.sku,
    category: p.category,
    collection: p.collection,
    image_url: p.images[0] || null,
    images: p.images,
    product_url: p.url,
    description: p.description,
    dimensions: p.dimensions,
    material: p.construction,
    ingestion_source: "norwalk-scraper",
    com_available: true,
    customizable: true,
    made_to_order: true,
  }));

  // Dedup by ID
  const deduped = new Map();
  for (const p of catalogProducts) {
    if (!deduped.has(p.id)) deduped.set(p.id, p);
  }
  const uniqueProducts = [...deduped.values()];

  console.log(`  Unique products to import: ${uniqueProducts.length}`);

  const { inserted, updated } = insertProducts(uniqueProducts);
  console.log(`  Inserted: ${inserted}, Updated: ${updated}`);

  const countAfter = getProductCount();
  console.log(`\n  Catalog after:  ${countAfter.toLocaleString()} products`);
  console.log(`  Net change:     +${(countAfter - countBefore).toLocaleString()}`);

  // Sanity check — make sure we didn't lose products
  if (countAfter < countBefore) {
    console.error(`\n  ⚠ WARNING: Catalog shrunk! Before: ${countBefore}, After: ${countAfter}`);
    console.error(`  This should NEVER happen — investigate immediately!`);
  }

  // Stats
  const withImages = uniqueProducts.filter(p => p.images.length > 0).length;
  const withDesc = uniqueProducts.filter(p => p.description).length;
  const withDims = uniqueProducts.filter(p => p.dimensions).length;
  const withSku = uniqueProducts.filter(p => p.sku).length;
  const withCat = uniqueProducts.filter(p => p.category).length;

  console.log(`\n  ── Data quality ──`);
  console.log(`  With images:      ${withImages}/${uniqueProducts.length}`);
  console.log(`  With description: ${withDesc}/${uniqueProducts.length}`);
  console.log(`  With dimensions:  ${withDims}/${uniqueProducts.length}`);
  console.log(`  With SKU:         ${withSku}/${uniqueProducts.length}`);
  console.log(`  With category:    ${withCat}/${uniqueProducts.length}`);

  console.log("\n═══════════════════════════════════════════════════════\n");
}

function slugify(text) {
  return (text || "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
