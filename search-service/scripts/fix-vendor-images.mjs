/**
 * Fix missing product images for Lee Industries and Vanguard.
 * Scrapes product pages for real image URLs and updates the catalog.
 *
 * Usage: node scripts/fix-vendor-images.mjs
 */

import https from "node:https";
import { initCatalogDB, getAllProducts, updateProductDirect } from "../src/db/catalog-db.mjs";

await initCatalogDB();

const BATCH_SIZE = 10;
const DELAY_MS = 500;

function fetchPage(url, timeout = 12000) {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    const req = https.get(url, {
      timeout,
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 SPEC-Bot/1.0" },
    }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return finish(null); }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => { body += c; if (body.length > 350000) res.destroy(); });
      res.on("end", () => finish(body));
      res.on("close", () => finish(body));
    });
    req.on("error", () => finish(null));
    req.on("timeout", () => { req.destroy(); finish(null); });
  });
}

function extractBestImage(body, vendor) {
  if (!body) return null;

  // og:image
  const ogMatch = body.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
    || body.match(/content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogMatch && ogMatch[1]) return ogMatch[1];

  // All absolute image URLs
  const allImgs = [...body.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)];
  const productImgs = allImgs
    .map(m => m[1])
    .filter(s => !s.includes("logo") && !s.includes("icon") && !s.includes("svg") && !s.includes("spacer") && !s.includes("404"));

  const scored = productImgs.map(src => {
    let score = 0;
    const widthParam = src.match(/width=(\d+)/i);
    if (widthParam) score = parseInt(widthParam[1], 10);
    const sizeInPath = src.match(/\/(\d{3,4})x(\d{3,4})\//i);
    if (sizeInPath) score = Math.max(score, parseInt(sizeInPath[1], 10));
    const sizeInName = src.match(/__(\d{2,4})x(\d{2,4})\./i);
    if (sizeInName) score = Math.max(score, parseInt(sizeInName[1], 10));
    if (/hires|large|hero|main|detail/i.test(src)) score += 800;
    if (/product/i.test(src)) score += 300;
    if (/thumbnail|thumb/i.test(src)) score += 100;
    if (/80x80|50x50|tiny/i.test(src)) score -= 500;
    return { src, score };
  });

  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    let best = scored[0].src;
    // Upscale Vanguard 80x80 → 600x600
    if (best.includes("80x80")) {
      best = best.replace(/\/80x80\//g, "/600x600/").replace(/__80x80\./g, "__600x600.");
    }
    if (scored[0].score > 0 || productImgs.length === 1) return best;
  }

  return null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Collect products needing images
const all = [...getAllProducts()];
const needsImage = all.filter(p => {
  const isTarget = /lee industries|vanguard/i.test(p.vendor_name);
  const missingImage = !p.image_url || p.image_url.includes("logo");
  return isTarget && missingImage && p.product_url;
});

console.log(`[fix-vendor-images] ${needsImage.length} products need images`);

let found = 0;
let failed = 0;
let errors = 0;

for (let i = 0; i < needsImage.length; i += BATCH_SIZE) {
  const batch = needsImage.slice(i, i + BATCH_SIZE);

  await Promise.all(batch.map(async (product) => {
    try {
      const body = await fetchPage(product.product_url);
      const imageUrl = extractBestImage(body, product.vendor_name);

      if (imageUrl) {
        updateProductDirect(product.id, {
          image_url: imageUrl,
          image_verified: false, // will be verified by image-verifier later
        });
        found++;
      } else {
        failed++;
      }
    } catch {
      errors++;
    }
  }));

  if ((i + BATCH_SIZE) % 100 < BATCH_SIZE) {
    console.log(`[fix-vendor-images] Progress: ${Math.min(i + BATCH_SIZE, needsImage.length)}/${needsImage.length} | Found: ${found} | Failed: ${failed} | Errors: ${errors}`);
  }

  await sleep(DELAY_MS);
}

console.log(`[fix-vendor-images] Done! Found: ${found} | Failed: ${failed} | Errors: ${errors}`);
