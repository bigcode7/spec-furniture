/**
 * Sherrill Furniture scraper
 * Scrapes all ~561 products from sherrillfurniture.com
 * and imports them into the catalog via the search service API.
 */

import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://www.sherrillfurniture.com";
const SEARCH_URL = `${BASE}/search-results?items_per_page=All&`;
const API_BASE = "http://127.0.0.1:4310";
const PROGRESS_FILE = path.join(import.meta.dirname, "sherrill-progress.json");

const DELAY_MS = 250; // polite delay between detail page fetches
const BATCH_SIZE = 5;  // concurrent detail page fetches

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── HTTP helpers ──

function fetchHttps(url, timeout = 20000) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (val) => { if (!resolved) { resolved = true; resolve(val); } };
    const req = https.get(url, {
      timeout,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith("http") ? res.headers.location : BASE + res.headers.location;
        res.resume();
        return fetchHttps(loc, timeout).then(finish);
      }
      if (res.statusCode !== 200) { res.resume(); return finish(null); }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => { body += c; });
      res.on("end", () => finish(body));
      res.on("close", () => finish(body));
    });
    req.on("error", () => finish(null));
    req.on("timeout", () => { req.destroy(); finish(null); });
  });
}

function postJson(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const payload = JSON.stringify(data);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req = http.request(opts, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function deleteJson(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "DELETE",
    }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => body += c);
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch { resolve(body); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Category detection ──

function detectCategory(name, productType) {
  const n = (name + " " + productType).toLowerCase();
  if (n.includes("sectional")) return "sectionals";
  if (n.includes("sofa")) return "sofas";
  if (n.includes("loveseat")) return "loveseats";
  if (n.includes("settee")) return "settees";
  if (n.includes("chaise")) return "chaises";
  if (n.includes("recliner")) return "recliners";
  if (n.includes("swivel")) return "swivel-chairs";
  if (n.includes("ottoman")) return "ottomans";
  if (n.includes("bench")) return "benches";
  if (n.includes("banquette")) return "benches";
  if (n.includes("dining") && n.includes("chair")) return "dining-chairs";
  if (n.includes("chair")) return "accent-chairs";
  if (n.includes("lounge")) return "accent-chairs";
  if (n.includes("carved")) return "accent-chairs";
  return "accent-chairs"; // Sherrill is primarily upholstery
}

// ── Parse listing page ──

function parseListingPage(html) {
  const products = [];
  // Actual structure:
  // <a class="product-results-tile w-inline-block" href="/catalog/SLUG?items_per_page=All">
  //   <img typeof="foaf:Image" src="URL" ... />
  //   <h3 class="product-number">Model  SKU</h3><div class="product-name">Type</div>
  // </a>
  const cardPattern = /<a\s+class="product-results-tile[^"]*"\s+href="\/catalog\/([^"?]+)[^"]*"[^>]*>[\s\S]*?<img[^>]+src="([^"]*)"[^>]*>[\s\S]*?<h3[^>]*>([^<]*)<\/h3>\s*<div[^>]*class="product-name"[^>]*>([^<]*)<\/div>/gi;
  let match;
  while ((match = cardPattern.exec(html)) !== null) {
    const slug = match[1];
    let imageUrl = match[2];
    const modelName = match[3].trim();
    const productType = match[4].trim();

    // Upgrade image from medium to full-size by removing /styles/medium/public
    if (imageUrl.includes("/styles/medium/public/")) {
      imageUrl = imageUrl.replace("/styles/medium/public/", "/");
    }
    // Remove query string token
    imageUrl = imageUrl.split("?")[0];
    // Ensure absolute URL
    if (imageUrl.startsWith("/")) {
      imageUrl = BASE + imageUrl;
    }

    products.push({
      slug,
      sku: modelName.replace(/^Model\s+/i, "").trim(),
      product_name: modelName.replace(/^Model\s+/i, "").trim(),
      product_type: productType,
      product_url: `${BASE}/catalog/${slug}`,
      image_url: imageUrl,
      category: detectCategory(modelName, productType),
    });
  }
  return products;
}

// ── Parse detail page ──

function parseDetailPage(html) {
  if (!html) return null;
  const details = {};

  // Product name from h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) details.product_name = h1Match[1].trim();

  // Description - look for description/spec text
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (descMatch) details.description = descMatch[1].trim();

  // Also look for descriptive text near specs
  // Sherrill puts description text like "Loose Pillow Back. Standard Throw Pillows..."
  // Try to find it in the page content
  const specTextMatch = html.match(/(?:Loose|Tight|Attached|Standard|Nail|Button|Tufted|Channeled)[^<]{10,200}/i);
  if (specTextMatch && (!details.description || details.description.length < specTextMatch[0].length)) {
    details.description = specTextMatch[0].trim();
  }

  // Dimensions - look for Width/Dia, Depth, Height fields
  const widthMatch = html.match(/Width(?:\/Dia)?[:\s]*(\d+(?:\.\d+)?)/i);
  const depthMatch = html.match(/(?:Overall\s+)?Depth[:\s]*(\d+(?:\.\d+)?)/i);
  const heightMatch = html.match(/Height[:\s]*(\d+(?:\.\d+)?)/i);
  if (widthMatch) details.width = parseFloat(widthMatch[1]);
  if (depthMatch) details.depth = parseFloat(depthMatch[1]);
  if (heightMatch) details.height = parseFloat(heightMatch[1]);

  // W x D x H pattern fallback
  if (!details.width) {
    const dimMatch = html.match(/(\d+(?:\.\d+)?)\s*[""]?\s*[Ww]\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[""]?\s*[Dd]\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[""]?\s*[Hh]/);
    if (dimMatch) {
      details.width = parseFloat(dimMatch[1]);
      details.depth = parseFloat(dimMatch[2]);
      details.height = parseFloat(dimMatch[3]);
    }
  }

  // Series / Collection from dataLayer
  const seriesMatch = html.match(/series_name[^}]*"(\d+\s*Series)"/i);
  if (seriesMatch) details.collection = seriesMatch[1].trim();

  // Also look for collection in breadcrumbs or links
  const collectionLink = html.match(/href="\/[\w-]+-series"[^>]*>([^<]+Series[^<]*)</i);
  if (collectionLink && !details.collection) details.collection = collectionLink[1].trim();

  // Best image - look for full-size catalog images (not /styles/medium/)
  const allImgs = [...html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+\.(jpg|jpeg|png|webp)[^"']*)["']/gi)];
  const catalogImgs = allImgs
    .map(m => m[1])
    .filter(s =>
      s.includes("/catalog/") &&
      !s.includes("logo") &&
      !s.includes("icon") &&
      !s.includes("PZ015") // detail/hardware images
    );

  // Prefer FRONT images, then largest
  const frontImgs = catalogImgs.filter(s => /FRONT/i.test(s));
  if (frontImgs.length > 0) {
    let img = frontImgs[0];
    if (img.includes("/styles/medium/public/")) {
      img = img.replace("/styles/medium/public/", "/");
    }
    details.image_url = img.split("?")[0];
  } else if (catalogImgs.length > 0) {
    let img = catalogImgs[0];
    if (img.includes("/styles/medium/public/")) {
      img = img.replace("/styles/medium/public/", "/");
    }
    details.image_url = img.split("?")[0];
  }

  // Fabric/material
  const fabricMatch = html.match(/fabric[^<]*?:\s*([^<\n]+)/i) || html.match(/Rayburn|Oatmeal|Linen|Velvet|Leather|Cotton|Polyester/i);
  if (fabricMatch) details.material = fabricMatch[1] ? fabricMatch[1].trim() : fabricMatch[0].trim();

  return details;
}

// ── Progress save/load ──

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

function loadProgress() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  } catch {
    return null;
  }
}

// ══════════════════════════════════════
//  MAIN
// ══════════════════════════════════════

async function main() {
  console.log("[sherrill] Starting Sherrill Furniture scraper...");

  // ── Step 1: Delete existing Sherrill products ──
  console.log("[sherrill] Deleting existing Sherrill products from catalog...");
  try {
    const delResult = await postJson(`${API_BASE}/catalog/delete`, { vendor_name: "Sherrill Furniture" });
    console.log("[sherrill] Delete result:", delResult);
  } catch (e) {
    console.log("[sherrill] Delete failed:", e.message);
  }

  // ── Step 2: Fetch listing page ──
  let products;
  const progress = loadProgress();

  if (progress && progress.products && progress.products.length > 0 && progress.detailsFetched) {
    console.log(`[sherrill] Resuming from saved progress (${progress.products.length} products, details fetched)`);
    products = progress.products;
  } else {
    console.log("[sherrill] Fetching listing page...");
    const listingHtml = await fetchHttps(SEARCH_URL);
    if (!listingHtml) {
      console.error("[sherrill] Failed to fetch listing page!");
      process.exit(1);
    }
    console.log(`[sherrill] Listing page size: ${listingHtml.length} bytes`);

    products = parseListingPage(listingHtml);
    console.log(`[sherrill] Found ${products.length} products on listing page`);

    if (products.length === 0) {
      console.error("[sherrill] No products found! Check the HTML parsing.");
      // Save HTML for debugging
      fs.writeFileSync(path.join(import.meta.dirname, "sherrill-listing-debug.html"), listingHtml);
      console.log("[sherrill] Saved listing HTML for debugging");
      process.exit(1);
    }

    saveProgress({ products, detailsFetched: false });

    // ── Step 3: Fetch detail pages in batches ──
    console.log(`[sherrill] Fetching detail pages for ${products.length} products...`);
    let fetched = 0;
    let enriched = 0;

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async (product) => {
        try {
          const html = await fetchHttps(product.product_url);
          const details = parseDetailPage(html);
          if (details) {
            if (details.product_name) product.product_name = details.product_name;
            if (details.description) product.description = details.description;
            if (details.width) product.width = details.width;
            if (details.depth) product.depth = details.depth;
            if (details.height) product.height = details.height;
            if (details.collection) product.collection = details.collection;
            if (details.material) product.material = details.material;
            if (details.image_url) product.image_url = details.image_url;
            enriched++;
          }
        } catch (e) {
          console.log(`[sherrill] Error fetching ${product.slug}: ${e.message}`);
        }
        fetched++;
      }));

      if (fetched % 50 === 0 || fetched === products.length) {
        console.log(`[sherrill] Detail pages: ${fetched}/${products.length} fetched, ${enriched} enriched`);
        saveProgress({ products, detailsFetched: false });
      }

      await sleep(DELAY_MS);
    }

    console.log(`[sherrill] Finished fetching detail pages. Enriched ${enriched}/${products.length}`);
    saveProgress({ products, detailsFetched: true });
  }

  // ── Step 4: Build catalog objects and import ──
  console.log("[sherrill] Building catalog objects...");

  const catalogProducts = products.map(p => ({
    id: `sherrill_${(p.sku || p.slug).replace(/[^a-zA-Z0-9_-]/g, "_")}`,
    product_name: p.product_name || `Sherrill ${p.sku}`,
    sku: p.sku || p.slug,
    vendor_id: "sherrill",
    manufacturer_name: "Sherrill Furniture",
    category: p.category || "accent-chairs",
    product_url: p.product_url,
    image_url: p.image_url || "",
    description: p.description || "",
    width: p.width || null,
    depth: p.depth || null,
    height: p.height || null,
    collection: p.collection || "",
    material: p.material || "",
    style: "",
    retail_price: null,
    wholesale_price: null,
    ingestion_source: "sherrill-scraper-v1",
    ingestion_date: new Date().toISOString(),
  }));

  // Deduplicate by id
  const seen = new Set();
  const unique = [];
  for (const p of catalogProducts) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      unique.push(p);
    }
  }

  console.log(`[sherrill] ${unique.length} unique products ready for import`);

  // Category breakdown
  const catCounts = {};
  for (const p of unique) {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  }
  console.log("[sherrill] Category breakdown:");
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Dimension coverage
  const withDims = unique.filter(p => p.width && p.depth && p.height).length;
  console.log(`[sherrill] Products with dimensions: ${withDims}/${unique.length}`);

  // Import in batches of 50
  const IMPORT_BATCH = 50;
  let imported = 0;
  let errors = 0;

  for (let i = 0; i < unique.length; i += IMPORT_BATCH) {
    const batch = unique.slice(i, i + IMPORT_BATCH);
    try {
      const result = await postJson(`${API_BASE}/catalog/insert`, { products: batch });
      imported += batch.length;
      if (i % 200 === 0) {
        console.log(`[sherrill] Imported ${imported}/${unique.length}...`, result);
      }
    } catch (e) {
      console.error(`[sherrill] Import error at batch ${i}: ${e.message}`);
      errors++;
    }
  }

  console.log(`\n[sherrill] ════════════════════════════════════`);
  console.log(`  PRODUCTS SCRAPED:  ${products.length}`);
  console.log(`  UNIQUE PRODUCTS:   ${unique.length}`);
  console.log(`  IMPORTED:          ${imported}`);
  console.log(`  ERRORS:            ${errors}`);
  console.log(`  WITH DIMENSIONS:   ${withDims}`);
  console.log(`════════════════════════════════════`);
}

main().catch(e => {
  console.error("[sherrill] Fatal error:", e);
  process.exit(1);
});
