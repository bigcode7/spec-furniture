#!/usr/bin/env node
/**
 * Century Furniture Re-Scrape via Shopify API
 *
 * Century uses a Shopify storefront at shop.centuryfurniture.com.
 * This script pulls ALL products from the Shopify products.json API,
 * then updates existing catalog entries with:
 *   - Working image URLs (from cdn.shopify.com)
 *   - All alternate images
 *   - Dimensions (from body_html or metafields)
 *   - Materials, descriptions
 *   - Collection names
 *
 * The Shopify API returns 250 products per page max.
 *
 * Usage:
 *   node century-rescrape.mjs           # dry run
 *   node century-rescrape.mjs --apply   # apply to catalog
 */

import fs from "node:fs";
import { loadCatalog, safeSave } from "./lib/safe-catalog-write.mjs";

const apply = process.argv.includes("--apply");
const DB_PATH = "./search-service/data/catalog.db.json";
const BASE = "https://shop.centuryfurniture.com";
const PAGE_SIZE = 250;
const RATE_LIMIT_MS = 1000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Fetch all Century products from Shopify ─────────────────
async function fetchAllShopifyProducts() {
  const all = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${BASE}/products.json?limit=${PAGE_SIZE}&page=${page}`;
    console.log(`  Fetching page ${page}...`);

    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; SpekdBot/1.0)" },
    });

    if (!response.ok) {
      console.error(`  HTTP ${response.status} on page ${page}`);
      break;
    }

    const data = await response.json();
    const products = data.products || [];

    if (products.length === 0) {
      hasMore = false;
    } else {
      all.push(...products);
      console.log(`  Page ${page}: ${products.length} products (total: ${all.length})`);
      if (products.length < PAGE_SIZE) hasMore = false;
      page++;
    }

    await sleep(RATE_LIMIT_MS);
  }

  return all;
}

// ── Extract structured data from Shopify product ────────────
function parseShopifyProduct(sp) {
  const bodyHtml = sp.body_html || "";
  const text = bodyHtml.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

  // Extract dimensions from body (patterns: W: 24" D: 18" H: 30" or 24"W x 18"D x 30"H)
  let width = null, depth = null, height = null, dimensions = null;
  const dimPatterns = [
    /W(?:idth)?[:\s]*(\d+(?:\.\d+)?)["\u201D]?\s*[xX×,\s]*D(?:epth)?[:\s]*(\d+(?:\.\d+)?)["\u201D]?\s*[xX×,\s]*H(?:eight)?[:\s]*(\d+(?:\.\d+)?)["\u201D]?/i,
    /(\d+(?:\.\d+)?)["\u201D]?\s*[Ww]\s*[xX×]\s*(\d+(?:\.\d+)?)["\u201D]?\s*[Dd]\s*[xX×]\s*(\d+(?:\.\d+)?)["\u201D]?\s*[Hh]/,
    /(\d+(?:\.\d+)?)["\u201D]?\s*x\s*(\d+(?:\.\d+)?)["\u201D]?\s*x\s*(\d+(?:\.\d+)?)["\u201D]?/,
  ];
  for (const pat of dimPatterns) {
    const m = text.match(pat);
    if (m) {
      width = parseFloat(m[1]);
      depth = parseFloat(m[2]);
      height = parseFloat(m[3]);
      dimensions = `${width}"W x ${depth}"D x ${height}"H`;
      break;
    }
  }

  // Extract materials
  let material = null;
  const matMatch = text.match(/(?:Material|Construction|Frame)[:\s]+([^.]{5,100})/i);
  if (matMatch) material = matMatch[1].trim();

  // Extract collection from tags
  const collection = sp.tags?.find(t => /collection/i.test(t))?.replace(/collection[:\s]*/i, "").trim()
    || sp.product_type || null;

  // Description — first 300 chars of clean text
  const description = text.slice(0, 300) || null;

  // Images
  const images = (sp.images || []).map((img, i) => ({
    url: img.src,
    type: i === 0 ? "hero" : "alternate_angle",
    priority: i === 0 ? 1 : 2,
    width: img.width,
    height: img.height,
  }));

  return {
    image_url: images[0]?.url || null,
    images,
    width,
    depth,
    height,
    dimensions,
    material,
    collection,
    description,
    product_type: sp.product_type || null,
    shopify_handle: sp.handle,
    product_url: `${BASE}/products/${sp.handle}`,
    retail_price: sp.variants?.[0]?.price ? parseFloat(sp.variants[0].price) : null,
  };
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Century Furniture Re-Scrape (Shopify API)");
  console.log("═══════════════════════════════════════════════════════\n");

  // 1. Fetch all Century products from Shopify
  console.log("Fetching from Shopify API...\n");
  const shopifyProducts = await fetchAllShopifyProducts();
  console.log(`\nTotal Shopify products: ${shopifyProducts.length}\n`);

  if (shopifyProducts.length === 0) {
    console.error("No products found! Check if the API is accessible.");
    process.exit(1);
  }

  // 2. Build lookup by title (normalized)
  const shopifyByTitle = new Map();
  const shopifyByHandle = new Map();
  for (const sp of shopifyProducts) {
    const key = (sp.title || "").toLowerCase().trim();
    shopifyByTitle.set(key, sp);
    shopifyByHandle.set(sp.handle, sp);
  }

  // 3. Load catalog
  const catalog = loadCatalog(DB_PATH);
  const data = catalog.data;
  const vendorCounts = catalog.vendorCounts;
  const century = data.products.filter(p => p.vendor_id === "century");
  console.log(`Century products in catalog: ${century.length}`);

  // 4. Match and update
  let matched = 0, unmatched = 0;
  let imagesFixed = 0, dimsAdded = 0, descsAdded = 0, matsAdded = 0, pricesAdded = 0;

  for (const product of century) {
    const titleKey = (product.product_name || "").toLowerCase().trim();

    // Try matching by title
    let shopify = shopifyByTitle.get(titleKey);

    // Try matching by product URL handle
    if (!shopify && product.product_url) {
      const handleMatch = product.product_url.match(/\/products\/([^?#]+)/);
      if (handleMatch) {
        shopify = shopifyByHandle.get(handleMatch[1]);
      }
    }

    // Try fuzzy match — remove SKU prefix and try
    if (!shopify) {
      const cleanTitle = titleKey.replace(/^[a-z0-9][-a-z0-9]{1,20}\s*[-–—]\s+/i, "").trim();
      shopify = shopifyByTitle.get(cleanTitle);
    }

    if (!shopify) {
      unmatched++;
      continue;
    }

    matched++;
    const parsed = parseShopifyProduct(shopify);

    if (apply) {
      // Update image
      if (parsed.image_url) {
        product.image_url = parsed.image_url;
        product.images = parsed.images;
        imagesFixed++;
      }

      // Update dimensions
      if (parsed.dimensions && !product.dimensions) {
        product.dimensions = parsed.dimensions;
        product.width = parsed.width;
        product.depth = parsed.depth;
        product.height = parsed.height;
        dimsAdded++;
      }

      // Update material
      if (parsed.material && !product.material) {
        product.material = parsed.material;
        matsAdded++;
      }

      // Update description
      if (parsed.description && (!product.description || product.description.length < 20)) {
        product.description = parsed.description;
        descsAdded++;
      }

      // Update collection
      if (parsed.collection && !product.collection) {
        product.collection = parsed.collection;
      }

      // Update product URL to current
      if (parsed.product_url) {
        product.product_url = parsed.product_url;
      }

      // Update price
      if (parsed.retail_price && !product.retail_price) {
        product.retail_price = parsed.retail_price;
        pricesAdded++;
      }

      product.updated_at = new Date().toISOString();
      product.last_verified_at = new Date().toISOString();
    }
  }

  // 5. Handle Shopify products NOT in catalog (new products)
  const catalogTitles = new Set(century.map(p => (p.product_name || "").toLowerCase().trim()));
  const newProducts = [];
  for (const sp of shopifyProducts) {
    const key = (sp.title || "").toLowerCase().trim();
    if (!catalogTitles.has(key)) {
      const parsed = parseShopifyProduct(sp);
      newProducts.push({
        id: `century_${sp.handle}`,
        product_name: sp.title,
        vendor_id: "century",
        vendor_name: "Century Furniture",
        vendor_domain: "centuryfurniture.com",
        vendor_tier: 1,
        category: parsed.product_type || "furniture",
        sku: sp.variants?.[0]?.sku || null,
        collection: parsed.collection,
        description: parsed.description,
        dimensions: parsed.dimensions,
        width: parsed.width,
        depth: parsed.depth,
        height: parsed.height,
        material: parsed.material,
        image_url: parsed.image_url,
        images: parsed.images,
        product_url: parsed.product_url,
        retail_price: parsed.retail_price,
        ingestion_source: "shopify-rescrape",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  console.log(`\n─── RESULTS ────────────────────────────────────────\n`);
  console.log(`  Matched to Shopify: ${matched}`);
  console.log(`  Unmatched: ${unmatched}`);
  console.log(`  New from Shopify: ${newProducts.length}`);
  console.log(`  Images fixed: ${imagesFixed}`);
  console.log(`  Dimensions added: ${dimsAdded}`);
  console.log(`  Materials added: ${matsAdded}`);
  console.log(`  Descriptions updated: ${descsAdded}`);
  console.log(`  Prices added: ${pricesAdded}`);

  // Stats
  const afterCentury = apply ? century : century; // just for counting
  const withImage = afterCentury.filter(p => p.image_url);
  const withDims = afterCentury.filter(p => p.dimensions || p.width);
  const withDesc = afterCentury.filter(p => p.description && p.description.length > 10);

  console.log(`\n  Century stats after fix:`);
  console.log(`    Total: ${century.length}`);
  console.log(`    Working images: ${apply ? imagesFixed : withImage.length}`);
  console.log(`    With dimensions: ${apply ? dimsAdded + withDims.length : withDims.length}`);
  console.log(`    With descriptions: ${apply ? descsAdded + withDesc.length : withDesc.length}`);

  if (apply) {
    // Add new products
    if (newProducts.length > 0) {
      data.products.push(...newProducts);
      console.log(`\n  Added ${newProducts.length} new Century products`);
    }

    safeSave(data, data.products, vendorCounts, { dbPath: DB_PATH });
    console.log("  ✓ Catalog saved");
  } else {
    console.log("\n  [DRY RUN] Use --apply to write changes");
  }

  console.log("\n═══════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
