/**
 * Full Vanguard Furniture catalog crawl.
 * Scrapes all subcategory pages from vanguardfurniture.com/styles,
 * extracts products, matches against existing catalog, updates or inserts.
 */

import https from "node:https";
import { initCatalogDB, getAllProducts, updateProductDirect, insertProduct, flushToDisk } from "../src/db/catalog-db.mjs";

await initCatalogDB();

const BASE = "https://www.vanguardfurniture.com";
const DELAY_MS = 1200;
const PRODUCT_DELAY_MS = 300;
const BATCH_SIZE = 10;

// All subcategory URLs (avoids the 200/page cap on room-level pages)
const CATEGORY_URLS = [
  // Bedroom
  "/styles?Room=BR&ProdType=002",
  "/styles?Room=BR&ProdType=008",
  "/styles?Room=BR&ProdType=016",
  "/styles?Room=BR&ProdType=018",
  "/styles?Room=BR&ProdType=035",
  // Dining
  "/styles?Room=DR&ProdType=005|036",
  "/styles?Room=DR&ProdType=007",
  "/styles?Room=DR&ProdType=008",
  "/styles?Room=DR&ProdType=014|013",
  // Living Room
  "/styles?Room=LR&ProdType=003|009|082",
  "/styles?Room=LR&ProdType=004",
  "/styles?Room=LR&ProdType=008",
  "/styles?Room=LR&ProdType=011",
  "/styles?Room=LR&ProdType=012",
  "/styles?Room=LR&ProdType=017",
  "/styles?Room=LR&ProdType=018|001",
  "/styles?Room=LR&ProdType=024",
  "/styles?Room=LR&ProdType=025|034|072|046",
  "/styles?Room=LR&ProdType=029",
  "/styles?Room=LR&ProdType=036",
  "/styles?Room=LR&ProdType=038",
  "/styles?Room=LR&ProdType=081",
  // Outdoor
  "/styles?Room=OD&ProdType=001|018",
  "/styles?Room=OD&ProdType=003|009|082",
  "/styles?Room=OD&ProdType=004",
  "/styles?Room=OD&ProdType=006",
  "/styles?Room=OD&ProdType=007",
  "/styles?Room=OD&ProdType=012",
  "/styles?Room=OD&ProdType=013|014",
  "/styles?Room=OD&ProdType=017",
  "/styles?Room=OD&ProdType=034|025|072|046",
  "/styles?Room=OD&ProdType=036",
  // Office
  "/styles?Room=OF&ProdType=011",
  "/styles?Room=OF&ProdType=012",
  "/styles?Room=OF&ProdType=029",
  "/styles?Room=OF&ProdType=047",
];

// Room+ProdType → category mapping
const CATEGORY_MAP = {
  "002": "beds", "008": "accent-tables", "016": "chests-dressers", "018": "benches-ottomans", "035": "nightstands",
  "005|036": "dining-tables", "007": "dining-chairs", "014|013": "sideboards-buffets",
  "003|009|082": "sofas", "004": "accent-chairs", "011": "desks", "012": "bookcases-cabinets",
  "017": "recliners", "018|001": "benches-ottomans", "024": "chaises",
  "025|034|072|046": "accent-tables", "025|034|046": "accent-tables",
  "029": "media-consoles", "036": "bar-carts", "038": "stools", "081": "swivel-chairs",
  "006": "outdoor-seating", "013|014": "outdoor-dining",
  "034|025": "accent-tables",
  "047": "file-cabinets",
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchPage(url, timeout = 15000) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (val) => { if (!resolved) { resolved = true; resolve(val); } };
    const req = https.get(url, {
      timeout,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith("http") ? res.headers.location : BASE + res.headers.location;
        res.resume();
        return fetchPage(loc, timeout).then(finish);
      }
      if (res.statusCode !== 200) { res.resume(); return finish(null); }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => { body += c; if (body.length > 600000) res.destroy(); });
      res.on("end", () => finish(body));
      res.on("close", () => finish(body));
    });
    req.on("error", () => finish(null));
    req.on("timeout", () => { req.destroy(); finish(null); });
  });
}

function extractProductLinks(html) {
  const products = [];
  const skus = new Set();
  let match;
  const linkPattern = /href='\/styles\/sku\/([^']+)'/gi;
  while ((match = linkPattern.exec(html)) !== null) {
    skus.add(match[1]);
  }

  for (const sku of skus) {
    const product = {
      sku,
      product_url: `${BASE}/styles/sku/${sku}`,
      image_url: null,
    };

    const skuIdx = html.indexOf(`/styles/sku/${sku}'`);
    if (skuIdx >= 0) {
      const chunk = html.substring(Math.max(0, skuIdx - 3000), skuIdx + 500);
      const imgMatches = [...chunk.matchAll(/src='([^']*cloudfront[^']*\.(?:jpg|jpeg|png|webp)[^']*)'/gi)];
      if (imgMatches.length > 0) {
        let imgUrl = imgMatches[imgMatches.length - 1][1];
        imgUrl = imgUrl.replace(/\/80x80\//g, "/600x600/").replace(/__80x80\./g, "__600x600.");
        product.image_url = imgUrl;
      }
    }
    products.push(product);
  }
  return products;
}

function extractProductDetails(html) {
  if (!html) return null;
  const details = {};

  // Product name from h1 or title
  const h1Match = html.match(/<h1[^>]*>([^<]+)</i);
  if (h1Match && h1Match[1].trim().length > 3) {
    details.product_name = h1Match[1].trim();
  } else {
    const titleMatch = html.match(/<title[^>]*>([^<]+)</i);
    if (titleMatch) {
      let name = titleMatch[1].replace(/\s*\|.*$/, "").trim();
      if (name.length > 3) details.product_name = name;
    }
  }

  // Description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (descMatch) details.description = descMatch[1].trim();

  // Dimensions
  const dimMatch = html.match(/(\d+(?:\.\d+)?)\s*[""]?\s*[Ww]\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[""]?\s*[Dd]\s*[xX×]\s*(\d+(?:\.\d+)?)\s*[""]?\s*[Hh]/);
  if (dimMatch) {
    details.width = parseFloat(dimMatch[1]);
    details.depth = parseFloat(dimMatch[2]);
    details.height = parseFloat(dimMatch[3]);
  }

  // Best image
  const allImgs = [...html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)];
  const productImgs = allImgs
    .map(m => m[1])
    .filter(s => s.indexOf("logo") === -1 && s.indexOf("icon") === -1 && s.indexOf("svg") === -1 && s.indexOf("404") === -1);

  const scored = productImgs.map(src => {
    let score = 0;
    const sizeInName = src.match(/__(\d{2,4})x(\d{2,4})\./i);
    if (sizeInName) score = parseInt(sizeInName[1], 10);
    if (/600x600/i.test(src)) score += 300;
    if (/RoomScene/i.test(src)) score += 200;
    if (/80x80|50x50/i.test(src)) score -= 500;
    return { src, score };
  });
  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0 && scored[0].score > 0) {
    let best = scored[0].src;
    best = best.replace(/\/80x80\//g, "/600x600/").replace(/__80x80\./g, "__600x600.");
    details.image_url = best;
  }

  return details;
}

// ── Build existing product index ──
const allProducts = [...getAllProducts()];
const existingByUrl = new Map();
const existingBySku = new Map();
let vanguardBefore = 0;

for (const p of allProducts) {
  if (/vanguard/i.test(p.vendor_name)) {
    vanguardBefore++;
    if (p.product_url) existingByUrl.set(p.product_url.toLowerCase(), p);
    if (p.sku) existingBySku.set(p.sku.toLowerCase(), p);
  }
}

console.log(`[vanguard-crawl] Existing Vanguard products: ${vanguardBefore}`);

// ── Phase 1: Crawl all subcategory listing pages ──
const allScraped = new Map(); // sku -> { sku, product_url, image_url, category }

for (const catUrl of CATEGORY_URLS) {
  const url = `${BASE}${catUrl}`;
  const prodTypeMatch = catUrl.match(/ProdType=([^&]+)/);
  const prodType = prodTypeMatch ? prodTypeMatch[1] : "";
  const category = CATEGORY_MAP[prodType] || "";

  console.log(`[vanguard-crawl] Fetching ${catUrl} (${category})...`);
  const html = await fetchPage(url);
  if (!html) {
    console.log(`[vanguard-crawl] Failed: ${catUrl}`);
    continue;
  }

  const products = extractProductLinks(html);
  let newInPage = 0;
  for (const p of products) {
    if (!allScraped.has(p.sku)) {
      p.category = category;
      allScraped.set(p.sku, p);
      newInPage++;
    }
  }
  console.log(`[vanguard-crawl]   ${products.length} products (${newInPage} new unique)`);

  if (products.length >= 200) {
    console.log(`[vanguard-crawl]   ⚠ Hit 200 cap — may be missing products in this category`);
  }

  await sleep(DELAY_MS);
}

// Also scrape base + room pages for anything missed
for (const extra of ["/styles", "/styles?Room=BR", "/styles?Room=DR", "/styles?Room=LR", "/styles?Room=OD", "/styles?Room=OF"]) {
  const html = await fetchPage(`${BASE}${extra}`);
  if (!html) continue;
  const products = extractProductLinks(html);
  let added = 0;
  for (const p of products) {
    if (!allScraped.has(p.sku)) {
      allScraped.set(p.sku, p);
      added++;
    }
  }
  if (added > 0) console.log(`[vanguard-crawl] ${extra}: +${added} new`);
  await sleep(DELAY_MS);
}

console.log(`\n[vanguard-crawl] Total unique SKUs scraped: ${allScraped.size}`);

// ── Phase 2: Fetch individual product pages for details ──
const skuList = [...allScraped.values()];
let updated = 0, added = 0, skipped = 0, imgFixed = 0;

for (let i = 0; i < skuList.length; i += BATCH_SIZE) {
  const batch = skuList.slice(i, i + BATCH_SIZE);

  await Promise.all(batch.map(async (scraped) => {
    const productUrl = scraped.product_url.toLowerCase();
    const skuLower = scraped.sku.toLowerCase();
    const existing = existingByUrl.get(productUrl) || existingBySku.get(skuLower);

    let details = null;
    try {
      const pageHtml = await fetchPage(scraped.product_url);
      details = extractProductDetails(pageHtml);
    } catch {}

    if (existing) {
      const updates = {};
      const currentImg = existing.image_url || "";
      const isBadImg = currentImg.length < 5 || currentImg.indexOf("logo") >= 0 ||
        (currentImg.indexOf("cloudfront.net") >= 0 && currentImg.indexOf(".jpg") === -1 && currentImg.indexOf(".png") === -1 && currentImg.indexOf(".webp") === -1);

      if (isBadImg) {
        const newImg = (details && details.image_url) || scraped.image_url;
        if (newImg) {
          updates.image_url = newImg;
          updates.image_verified = false;
          imgFixed++;
        }
      }

      if (details) {
        if (!existing.width && details.width) updates.width = details.width;
        if (!existing.depth && details.depth) updates.depth = details.depth;
        if (!existing.height && details.height) updates.height = details.height;
        if (!existing.description && details.description) updates.description = details.description;
        if (!existing.category && scraped.category) updates.category = scraped.category;
      }

      if (Object.keys(updates).length > 0) {
        updateProductDirect(existing.id, updates);
        updated++;
      } else {
        skipped++;
      }
    } else {
      const productName = (details && details.product_name) || `Vanguard ${scraped.sku}`;
      const imageUrl = (details && details.image_url) || scraped.image_url || "";

      insertProduct({
        product_name: productName,
        vendor_name: "Vanguard Furniture",
        vendor_id: "vanguard",
        vendor_domain: "vanguardfurniture.com",
        sku: scraped.sku,
        product_url: scraped.product_url,
        image_url: imageUrl,
        description: details?.description || "",
        category: scraped.category || details?.category || "",
        width: details?.width || null,
        depth: details?.depth || null,
        height: details?.height || null,
        material: "",
        style: "",
        collection: "",
        ingestion_source: "vanguard-scraper",
      });
      added++;
    }
  }));

  if ((i + BATCH_SIZE) % 100 < BATCH_SIZE) {
    console.log(`[vanguard-crawl] Progress: ${Math.min(i + BATCH_SIZE, skuList.length)}/${skuList.length} | Updated: ${updated} | Added: ${added} | ImgFixed: ${imgFixed}`);
  }

  await sleep(PRODUCT_DELAY_MS);
}

console.log(`\n[vanguard-crawl] ═══════════════════════════════`);
console.log(`  BEFORE:       ${vanguardBefore} Vanguard products`);
console.log(`  SCRAPED:      ${allScraped.size} unique SKUs from website`);
console.log(`  UPDATED:      ${updated} existing products enriched`);
console.log(`  IMAGES FIXED: ${imgFixed}`);
console.log(`  NEW ADDED:    ${added}`);
console.log(`  UNCHANGED:    ${skipped}`);
console.log(`  NEW TOTAL:    ${vanguardBefore + added}`);
console.log(`═══════════════════════════════`);

console.log(`\nFlushing to disk...`);
flushToDisk();
console.log(`Done!`);
