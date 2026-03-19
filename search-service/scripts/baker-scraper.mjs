#!/usr/bin/env node
/**
 * Baker Furniture Scraper v1
 *
 * Uses Baker's Umbraco RefineSearch API to pull all products.
 * No Puppeteer needed — the API returns structured JSON.
 *
 * Image URLs come from Scene7 CDN and are appended with quality params.
 * Products are deduplicated by Product_ID across categories.
 * Progress is saved to a JSON file for resumability.
 */

import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.bakerfurniture.com";
const SEARCH_SERVICE = "http://127.0.0.1:4310";
const API_URL =
  "https://www.bakerfurniture.com/umbraco/api/searchapi/RefineSearch?httproute=True";
const ROOT_ID = 1121;
const PAGE_SIZE = 12;
const DELAY_MS = 200;
const BATCH_SIZE = 25;

const PROGRESS_FILE = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "baker-scraper-progress.json"
);

// ── API categories to scrape ──
// The Baker API uses broad categories (e.g. "Tables", "Lighting").
// Subcategory assignment (cocktail tables, floor lamps, etc.) is done
// post-hoc based on product name and URL patterns.
const API_CATEGORIES = [
  "Sofas",
  "Chairs",
  "Sectionals",
  "Chaises",
  "Benches",
  "Ottomans",
  "Chests",
  "Cabinets",
  "Servers",
  "Etageres",
  "Tables",
  "Lighting",
  "Accessories",
  "Beds",
  "Nightstands",
  "Desks",
  "Stools",
];

// ── Category inference ──
// Determines the normalized category based on product name, URL, and API category.
function inferCategory(item, apiCategory) {
  const name = (item.Product_Name || "").toLowerCase();
  const url = (item.Url || "").toLowerCase();
  const text = `${name} ${url}`;
  const isOutdoor = url.includes("/outdoor/");

  // ── Tables subcategories ──
  if (apiCategory === "Tables" || /table/.test(name)) {
    if (/cocktail\s*table|coffee\s*table/.test(text)) return "coffee-tables";
    if (/console/.test(text)) return "console-tables";
    if (/dining\s*table/.test(text)) return "dining-tables";
    if (/nightstand|night\s*stand|bedside/.test(text)) return "nightstands";
    if (/writing\s*table|writing\s*desk/.test(text)) return "desks";
    if (
      /side\s*table|spot\s*table|end\s*table|accent\s*table|nesting/.test(text)
    )
      return "side-tables";
    if (/center\s*table/.test(text)) return "side-tables";
    // Default tables based on URL context
    if (url.includes("/dining/")) return "dining-tables";
    if (url.includes("/bedroom/")) return "nightstands";
    return "side-tables";
  }

  // ── Lighting subcategories ──
  if (apiCategory === "Lighting" || /lamp|light|chandel|sconce|pendant/.test(name)) {
    if (/floor\s*lamp/.test(text)) return "floor-lamps";
    if (/table\s*lamp|taper\s*lamp|desk\s*lamp/.test(text)) return "table-lamps";
    if (/chandelier|pendant/.test(text)) return "chandeliers";
    if (/sconce|wall\s*light/.test(text)) return "sconces";
    // Default: if it says "lamp" it's probably table lamp
    if (/lamp/.test(text)) return "table-lamps";
    return "table-lamps";
  }

  // ── Accessories subcategories ──
  if (apiCategory === "Accessories") {
    if (/mirror/.test(text)) return "mirrors";
    return "decorative-objects";
  }

  // ── Seating ──
  if (apiCategory === "Sofas" || /\bsofa\b|loveseat|settee/.test(text))
    return "sofas";
  if (apiCategory === "Sectionals" || /sectional/.test(text))
    return "sectionals";
  if (apiCategory === "Chaises" || /chaise/.test(text)) return "chaises";
  if (apiCategory === "Ottomans" || /ottoman|pouf/.test(text))
    return "ottomans";
  if (apiCategory === "Benches" || /\bbench\b/.test(text)) return "benches";
  if (apiCategory === "Stools" || /stool|counter|bar\s*seat/.test(text))
    return "bar-stools";
  if (apiCategory === "Chairs") {
    if (url.includes("/dining/")) return "dining-chairs";
    return "accent-chairs";
  }

  // ── Storage ──
  if (apiCategory === "Chests" || /\bchest\b/.test(text)) return "chests";
  if (apiCategory === "Cabinets" || /cabinet|bookcase|vitrine|display/.test(text))
    return "cabinets";
  if (apiCategory === "Servers" || /credenza|buffet|sideboard|server/.test(text))
    return "credenzas";
  if (apiCategory === "Etageres" || /etagere|\u00e9tag\u00e8re/.test(text))
    return "bookcases";

  // ── Bedroom ──
  if (apiCategory === "Beds" || /\bbed\b|headboard/.test(text)) return "beds";
  if (apiCategory === "Nightstands" || /nightstand/.test(text))
    return "nightstands";

  // ── Workspace ──
  if (apiCategory === "Desks" || /\bdesk\b/.test(text)) return "desks";

  return "decorative-objects";
}

// ── HTTP helpers ──

function apiPost(data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(API_URL);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://www.bakerfurniture.com/",
        },
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (responseBody += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
          } catch (e) {
            resolve({
              status: res.statusCode,
              data: null,
              error: responseBody.slice(0, 300),
            });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function httpPost(url, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(url);
    const mod = urlObj.protocol === "https:" ? https : http;
    const req = mod.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let responseBody = "";
        res.on("data", (c) => (responseBody += c));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
          } catch (e) {
            resolve({ status: res.statusCode, data: null, raw: responseBody.slice(0, 300) });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Build product object matching required schema ──

function buildProduct(item, apiCategory) {
  const sku = item.Item_No || "";
  const name = item.Product_Name || "";
  const category = inferCategory(item, apiCategory);
  const slug =
    sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    (item.Product_ID || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Image: Scene7 URL — append sizing for high quality on clean background
  let imageUrl = item.Image || "";
  if (imageUrl && !imageUrl.includes("?")) {
    imageUrl += "?wid=1200&hei=1200&fmt=jpeg&qlt=85";
  } else if (imageUrl && !imageUrl.includes("wid=")) {
    imageUrl += "&wid=1200&hei=1200&fmt=jpeg&qlt=85";
  }

  const collection = item.Collection || "";
  const brand = (item.Brand_Category || [])[0] || "Baker";

  return {
    id: `baker_${slug}`,
    product_name: name,
    sku: sku,
    vendor_id: "baker",
    manufacturer_name: "Baker Furniture",
    category: category,
    product_url: item.Url ? BASE + item.Url : "",
    image_url: imageUrl,
    description: item.ImageCaption || "",
    width: item.Width || null,
    depth: item.Depth || null,
    height: item.Height || null,
    collection: collection,
    material: "",
    style: brand !== "Baker" ? brand : "",
    retail_price: null,
    wholesale_price: null,
    ingestion_source: "baker-scraper-v1",
    ingestion_date: new Date().toISOString(),
  };
}

// ── Fetch all products for one API category, paginating ──

async function fetchCategory(apiCategoryName) {
  const products = [];
  let page = 0;
  let totalCount = 0;

  while (true) {
    const res = await apiPost({
      Query: "",
      Categories: [apiCategoryName],
      Collections: [],
      Brands: [],
      Showrooms: [],
      InStock: false,
      NewArrival: false,
      PriceHigh: "",
      PriceLow: "",
      Page: page,
      Order: "",
      PriceAttribute: "",
      RootId: ROOT_ID,
    });

    if (!res.data?.Success && res.data?.Result) {
      // Some responses have Success=undefined but still have results
    }
    if (!res.data?.Result?.value?.length) break;

    if (page === 0) {
      totalCount = res.data.Result["@odata.count"] || 0;
    }

    const items = res.data.Result.value;
    for (const item of items) {
      products.push({ raw: item, apiCategory: apiCategoryName });
    }

    const fetched = products.length;
    if (fetched >= totalCount) break;

    page++;
    await delay(DELAY_MS);
  }

  return { products, total: totalCount };
}

// ── Save/load progress ──

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
    }
  } catch {
    // ignore
  }
  return null;
}

// ── Post products to search service ──

async function postProducts(products) {
  let posted = 0;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    try {
      const result = await httpPost(`${SEARCH_SERVICE}/catalog/insert`, {
        products: batch,
      });
      if (result.status !== 200) {
        console.error(
          `  POST error ${result.status}: ${result.raw || JSON.stringify(result.data).slice(0, 200)}`
        );
      }
    } catch (e) {
      console.error(`  POST network error: ${e.message}`);
    }
    posted += batch.length;
    if (posted % 100 === 0 || posted === products.length) {
      console.log(`  Posted: ${posted}/${products.length}`);
    }
    await delay(50);
  }
  return posted;
}

// ── Delete existing Baker products ──

async function deleteExistingBakerProducts() {
  console.log("Deleting existing Baker products...");
  try {
    const result = await httpPost(`${SEARCH_SERVICE}/catalog/delete`, {
      vendor_name: "Baker Furniture",
    });
    console.log(
      `  Deleted ${result.data?.deleted || 0} existing products (total remaining: ${result.data?.total || "?"})`
    );
  } catch (e) {
    console.error(`  Delete error: ${e.message}`);
  }

  // Also try deleting by searching for baker vendor_id pattern
  // The /catalog/delete endpoint supports vendor_name matching
  await delay(200);
}

// ── Main ──

async function main() {
  console.log("=== Baker Furniture Scraper v1 ===");
  console.log(`API: ${API_URL}`);
  console.log(`Search service: ${SEARCH_SERVICE}`);
  console.log(`Progress file: ${PROGRESS_FILE}\n`);

  const allProducts = new Map(); // Product_ID -> built product

  // Check for saved progress
  const saved = loadProgress();
  const completedCategories = new Set(saved?.completedCategories || []);
  if (saved?.products) {
    for (const p of saved.products) {
      allProducts.set(p.id, p);
    }
    console.log(
      `Loaded ${allProducts.size} products from progress file (${completedCategories.size} categories done)\n`
    );
  }

  // Phase 1: Fetch all categories from API
  console.log("Phase 1: Fetching products by category from Baker API...\n");

  for (const apiCat of API_CATEGORIES) {
    if (completedCategories.has(apiCat)) {
      console.log(`  ${apiCat}: skipped (already done)`);
      continue;
    }

    try {
      const { products, total } = await fetchCategory(apiCat);
      let newCount = 0;

      for (const { raw, apiCategory } of products) {
        // Skip fabrics
        if (raw.IsFabric) continue;
        const name = (raw.Product_Name || "").toLowerCase();
        if (name.includes("fabric swatch") || name.includes("fabric sample"))
          continue;

        const product = buildProduct(raw, apiCategory);
        if (!allProducts.has(product.id)) {
          allProducts.set(product.id, product);
          newCount++;
        }
      }

      const pages = Math.ceil(total / PAGE_SIZE);
      console.log(
        `  ${apiCat}: ${total} total, ${products.length} fetched, +${newCount} new | unique: ${allProducts.size} (${pages} pages)`
      );

      completedCategories.add(apiCat);

      // Save progress after each category
      saveProgress({
        completedCategories: [...completedCategories],
        products: [...allProducts.values()],
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error(`  ${apiCat}: ERROR - ${e.message}`);
    }

    await delay(DELAY_MS);
  }

  // Phase 2: Catch-all pass (empty category filter) to find any missed products
  console.log("\nPhase 2: Catch-all pass (no category filter)...");

  if (!completedCategories.has("__CATCH_ALL__")) {
    let page = 0;
    let catchAllNew = 0;

    while (true) {
      const res = await apiPost({
        Query: "",
        Categories: [],
        Collections: [],
        Brands: [],
        Showrooms: [],
        InStock: false,
        NewArrival: false,
        PriceHigh: "",
        PriceLow: "",
        Page: page,
        Order: "",
        PriceAttribute: "",
        RootId: ROOT_ID,
      });

      if (!res.data?.Result?.value?.length) break;

      const totalCount = res.data.Result["@odata.count"] || 0;
      const items = res.data.Result.value;

      for (const item of items) {
        if (item.IsFabric) continue;
        const name = (item.Product_Name || "").toLowerCase();
        if (name.includes("fabric swatch") || name.includes("fabric sample"))
          continue;

        // Guess the API category from the Product_Category facet match
        const guessedCat =
          API_CATEGORIES.find(
            (c) =>
              c.toLowerCase() ===
              (item.Product_Category || "").toLowerCase()
          ) || "Accessories";

        const product = buildProduct(item, guessedCat);
        if (!allProducts.has(product.id)) {
          allProducts.set(product.id, product);
          catchAllNew++;
        }
      }

      const fetched = (page + 1) * PAGE_SIZE;
      if (page % 25 === 0) {
        console.log(
          `  Page ${page}/${Math.ceil(totalCount / PAGE_SIZE)} | unique: ${allProducts.size}`
        );
      }

      if (fetched >= totalCount) break;
      page++;
      await delay(DELAY_MS);
    }

    console.log(
      `  Catch-all: +${catchAllNew} new products | total unique: ${allProducts.size}`
    );

    completedCategories.add("__CATCH_ALL__");
    saveProgress({
      completedCategories: [...completedCategories],
      products: [...allProducts.values()],
      timestamp: new Date().toISOString(),
    });
  } else {
    console.log("  Catch-all: skipped (already done)");
  }

  // Filter out any remaining fabric/non-furniture items
  const furniture = [...allProducts.values()].filter((p) => {
    const name = p.product_name.toLowerCase();
    if (name.includes("fabric swatch") || name.includes("fabric sample"))
      return false;
    if (!p.image_url) return false; // must have an image
    return true;
  });

  console.log(
    `\nTotal unique products with images: ${furniture.length} (excluded ${allProducts.size - furniture.length})\n`
  );

  // Phase 3: Delete existing Baker products and insert new ones
  console.log("Phase 3: Importing to catalog...\n");

  await deleteExistingBakerProducts();
  await delay(500);

  console.log(`Posting ${furniture.length} products to ${SEARCH_SERVICE}...`);
  const posted = await postProducts(furniture);

  // Summary
  const withDims = furniture.filter(
    (p) => p.width && p.depth && p.height
  ).length;
  const withCollection = furniture.filter((p) => p.collection).length;
  const withDesc = furniture.filter((p) => p.description).length;

  const byCat = {};
  for (const p of furniture) byCat[p.category] = (byCat[p.category] || 0) + 1;

  console.log(`
============================================================
=== BAKER FURNITURE SCRAPER v1 SUMMARY ===
============================================================
Total unique products:  ${furniture.length}
Posted to catalog:      ${posted}
With image:             ${furniture.length} (100% - filtered)
With dimensions:        ${withDims} (${Math.round((100 * withDims) / furniture.length)}%)
With collection:        ${withCollection} (${Math.round((100 * withCollection) / furniture.length)}%)
With description:       ${withDesc} (${Math.round((100 * withDesc) / furniture.length)}%)

By category:
${Object.entries(byCat)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `  ${k}: ${v}`)
  .join("\n")}
============================================================`);

  // Clean up progress file on success
  try {
    fs.unlinkSync(PROGRESS_FILE);
    console.log("\nProgress file cleaned up.");
  } catch {
    // ignore
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
