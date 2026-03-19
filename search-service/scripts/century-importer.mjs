#!/usr/bin/env node
/**
 * Century Furniture Importer
 *
 * Scrapes all Century product category pages, extracts products,
 * fetches detail pages for descriptions/dimensions, and imports
 * into the catalog database.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const OUTPUT_FILE = path.join(DATA_DIR, "century-import.json");
const BASE = "https://www.centuryfurniture.com";

// Category pages to scrape
const CATEGORY_PAGES = [
  { url: "/products.aspx?TypeID=81", category: "accent-chairs" },
  { url: "/products.aspx?TypeID=32", category: "chests" },
  { url: "/products.aspx?TypeID=72", category: "console-tables" },
  { url: "/products.aspx?TypeID=34", category: "desks" },
  { url: "/products.aspx?TypeID=134", category: "dining-chairs" },
  { url: "/products.aspx?TypeID=132", category: "dining-tables" },
  { url: "/products.aspx?TypeID=84", category: "dressers" },
  { url: "/products.aspx?TypeID=83", category: "beds" },
  { url: "/products.aspx?TypeID=76", category: "sofas" },
  { url: "/products.aspx?Search=recliner", category: "recliners" },
  { url: "/products.aspx?search=sectional", category: "sectionals" },
  { url: "/products.aspx?TypeID=48", category: "settees" },
  { url: "/products.aspx?TypeID=55", category: "side-tables" },
  { url: "/products.aspx?TypeID=79", category: "cocktail-tables" },
  { url: "/products.aspx?TypeID=82", category: "nightstands" },
  { url: "/products.aspx?TypeID=70", category: "ottomans" },
  { url: "/products.aspx?TypeID=61", category: "mirrors" },
  { url: "/products.aspx?TypeID=73", category: "bookcases" },
  { url: "/products.aspx?TypeID=74", category: "media-cabinets" },
  { url: "/products.aspx?TypeID=25", category: "bar-stools" },
  { url: "/products.aspx?TypeID=29", category: "benches" },
  { url: "/products.aspx?SubTypeID=82", category: "swivel-chairs" },
  { url: "/products.aspx?TypeID=143", category: "outdoor-dining" },
  { url: "/products.aspx?TypeID=137", category: "outdoor-seating" },
  { url: "/products.aspx?TypeID=139", category: "outdoor-tables" },
  { url: "/products.aspx?TypeID=140", category: "outdoor-tables" },
  { url: "/products.aspx?TypeID=148", category: "outdoor" },
  { url: "/products.aspx?TypeID=142", category: "outdoor" },
  { url: "/products.aspx?TypeID=141", category: "outdoor" },
  { url: "/products.aspx?TypeID=146", category: "outdoor" },
  { url: "/products.aspx?TypeID=138", category: "outdoor" },
  { url: "/products.aspx?TypeID=136", category: "outdoor" },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Extract product links from a category page HTML
function extractProductsFromHTML(html, category) {
  const products = [];
  // Match product cards — pattern: /product-detail.aspx?sku=XXX
  const skuRegex = /product-detail\.aspx\?sku=([^&"'\s]+)/gi;
  const matches = [...html.matchAll(skuRegex)];
  const seenSkus = new Set();

  for (const match of matches) {
    const sku = match[1];
    if (seenSkus.has(sku.toUpperCase())) continue;
    seenSkus.add(sku.toUpperCase());

    // Find image and name near this SKU reference in the HTML
    const skuIdx = html.indexOf(sku);
    let imageUrl = "";
    if (skuIdx > -1) {
      const nearby = html.substring(Math.max(0, skuIdx - 2000), Math.min(html.length, skuIdx + 2000));
      const imgNearby = nearby.match(/\/prod-images\/[^"'\s]+_medium\.jpg/i);
      if (imgNearby) {
        imageUrl = BASE + imgNearby[0];
      }
    }

    // Try to extract product name from alt text or title
    let productName = sku; // fallback
    if (skuIdx > -1) {
      const nearby = html.substring(Math.max(0, skuIdx - 1000), Math.min(html.length, skuIdx + 500));
      // Look for alt="Product Name" near the SKU
      const altMatch = nearby.match(/alt="([^"]{3,100})"/i);
      if (altMatch && !altMatch[1].includes("Century")) {
        productName = altMatch[1];
      }
      // Or look for title text
      const titleMatch = nearby.match(/title="([^"]{3,100})"/i);
      if (titleMatch && productName === sku) {
        productName = titleMatch[1];
      }
    }

    products.push({
      sku,
      product_name: productName,
      product_url: `${BASE}/product-detail.aspx?sku=${sku}`,
      image_url: imageUrl,
      category,
    });
  }

  return products;
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      console.error(`  HTTP ${response.status} for ${url}`);
      return null;
    }
    return await response.text();
  } catch (err) {
    console.error(`  Fetch error for ${url}: ${err.message}`);
    return null;
  }
}

// Fetch product detail page for description and dimensions
async function fetchProductDetail(product) {
  const html = await fetchPage(product.product_url);
  if (!html) return product;

  // Extract description
  const descMatch = html.match(/class="[^"]*description[^"]*"[^>]*>([^<]+)/i) ||
                    html.match(/id="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\//i);
  if (descMatch) {
    product.description = descMatch[1].replace(/<[^>]+>/g, "").trim().substring(0, 500);
  }

  // Extract dimensions — look for W x D x H patterns
  const dimMatch = html.match(/(\d+(?:\.\d+)?)\s*"?\s*[Ww]\s*x\s*(\d+(?:\.\d+)?)\s*"?\s*[Dd]\s*x\s*(\d+(?:\.\d+)?)\s*"?\s*[Hh]/);
  if (dimMatch) {
    product.width = parseFloat(dimMatch[1]);
    product.depth = parseFloat(dimMatch[2]);
    product.height = parseFloat(dimMatch[3]);
  }

  // Extract collection name
  const collMatch = html.match(/collection[^>]*>([^<]{2,60})</i);
  if (collMatch) {
    product.collection = collMatch[1].trim();
  }

  // Better product name from detail page
  const nameMatch = html.match(/<h1[^>]*>([^<]+)/i) ||
                    html.match(/<title>([^|<]+)/i);
  if (nameMatch) {
    const cleanName = nameMatch[1].replace(/\s*[-|]\s*Century.*$/i, "").trim();
    if (cleanName.length > 3 && cleanName.length < 120) {
      product.product_name = cleanName;
    }
  }

  // Extract higher-res image if available
  const hiresMatch = html.match(/\/prod-images\/[^"'\s]+(?:_large|_hero|_full)\.\w+/i);
  if (hiresMatch) {
    product.image_url = BASE + hiresMatch[0];
  }

  return product;
}

async function main() {
  console.log("Century Furniture Importer");
  console.log("=========================\n");

  const allProducts = new Map(); // deduplicate by SKU

  // Phase 1: Scrape all category pages
  console.log("Phase 1: Scraping category pages...\n");
  for (const page of CATEGORY_PAGES) {
    const url = BASE + page.url;
    console.log(`  Fetching ${page.category} (${page.url})...`);
    const html = await fetchPage(url);
    if (!html) {
      console.log(`    SKIP — failed to fetch`);
      continue;
    }

    const products = extractProductsFromHTML(html, page.category);
    let newCount = 0;
    for (const p of products) {
      const key = p.sku.toUpperCase();
      if (!allProducts.has(key)) {
        allProducts.set(key, p);
        newCount++;
      }
    }
    console.log(`    Found ${products.length} products (${newCount} new)`);
    await sleep(500); // be polite
  }

  console.log(`\nTotal unique products: ${allProducts.size}`);

  // Phase 2: Fetch detail pages for top products (first 50 to get names/descriptions)
  // We'll do this in batches to be polite to the server
  console.log("\nPhase 2: Fetching product details (batch of 50)...\n");
  const productList = [...allProducts.values()];
  const detailBatchSize = 50;
  let detailCount = 0;

  for (let i = 0; i < Math.min(detailBatchSize, productList.length); i++) {
    const p = productList[i];
    if (p.product_name === p.sku) { // Only fetch if name is just the SKU
      await fetchProductDetail(p);
      detailCount++;
      if (detailCount % 10 === 0) {
        console.log(`  Fetched ${detailCount} detail pages...`);
      }
      await sleep(300);
    }
  }

  // Phase 3: Build import-ready product objects
  console.log("\nPhase 3: Building import data...\n");
  const importProducts = productList.map(p => ({
    id: `century_${p.sku.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`,
    product_name: p.product_name,
    sku: p.sku,
    vendor_id: "century",
    manufacturer_name: "Century Furniture",
    category: p.category,
    product_url: p.product_url,
    image_url: p.image_url || "",
    description: p.description || "",
    width: p.width || null,
    depth: p.depth || null,
    height: p.height || null,
    collection: p.collection || "",
    material: "",
    style: "",
    retail_price: null,
    wholesale_price: null,
    ingestion_source: "century-importer-v1",
    ingestion_date: new Date().toISOString(),
  }));

  // Save to disk
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(importProducts, null, 2));
  console.log(`Saved ${importProducts.length} products to ${OUTPUT_FILE}`);

  // Phase 4: Import into running search service
  console.log("\nPhase 4: Importing into search service...\n");
  try {
    const response = await fetch("http://127.0.0.1:4310/catalog/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: importProducts }),
    });
    if (response.ok) {
      const result = await response.json();
      console.log(`  Import result:`, result);
    } else {
      console.log(`  Import endpoint returned ${response.status}`);
      console.log(`  Will try direct file insertion instead...`);
    }
  } catch (err) {
    console.log(`  Import via API failed: ${err.message}`);
    console.log(`  Products saved to ${OUTPUT_FILE} — restart search service to pick them up.`);
  }

  console.log("\nDone!");
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
