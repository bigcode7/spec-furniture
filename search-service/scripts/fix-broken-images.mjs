#!/usr/bin/env node
/**
 * Fix Broken Images Script
 *
 * Visits the product page for each product with a broken/low-quality image,
 * extracts the og:image or main product image, and updates the catalog.
 *
 * Usage: node scripts/fix-broken-images.mjs [--vendor hooker] [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/catalog.db.json");

const args = process.argv.slice(2);
const vendorFilter = args.includes("--vendor") ? args[args.indexOf("--vendor") + 1] : null;
const dryRun = args.includes("--dry-run");

console.log("Loading catalog...");
const raw = readFileSync(DB_PATH, "utf8");
const db = JSON.parse(raw);

// Find products with broken/low-quality images
const bad = db.products.filter(p => {
  if (vendorFilter && p.vendor_id !== vendorFilter) return false;
  return p.image_quality === "broken" || p.image_quality === "low-quality" || p.bad_image;
});

console.log(`Found ${bad.length} products with bad images${vendorFilter ? ` (vendor: ${vendorFilter})` : ""}`);
if (dryRun) console.log("DRY RUN — no changes will be saved");

async function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      timeout: 15000,
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchPage(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function extractImage(html, productUrl) {
  // Priority 1: og:image
  const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                   html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogMatch) return ogMatch[1];

  // Priority 2: Main product image (Magento pattern)
  const magentoMatch = html.match(/class="gallery-placeholder__image"[^>]*src="([^"]+)"/i) ||
                       html.match(/data-gallery-role="main-image"[^>]*src="([^"]+)"/i);
  if (magentoMatch) return magentoMatch[1];

  // Priority 3: First large product image
  const imgMatch = html.match(/<img[^>]+src="(https?:\/\/[^"]*\/media\/catalog\/product[^"]+)"/i);
  if (imgMatch) return imgMatch[1];

  // Priority 4: JSON-LD image
  const jsonLdMatch = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+)"/i);
  if (jsonLdMatch) return jsonLdMatch[1];

  return null;
}

async function checkImageSize(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.request(url, { method: "HEAD", timeout: 10000 }, (res) => {
      const len = parseInt(res.headers["content-length"] || "0");
      resolve({ status: res.statusCode, size: len, type: res.headers["content-type"] });
    });
    req.on("error", () => resolve({ status: 0, size: 0, type: "" }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, size: 0, type: "" }); });
    req.end();
  });
}

let fixed = 0;
let failed = 0;
let skipped = 0;

for (let i = 0; i < bad.length; i++) {
  const p = bad[i];
  const url = p.product_url;
  if (!url) { skipped++; continue; }

  try {
    process.stdout.write(`\r[${i + 1}/${bad.length}] Fixing: ${p.product_name?.slice(0, 40)}...`);

    const html = await fetchPage(url);
    const newImage = extractImage(html, url);

    if (!newImage || newImage === p.image_url) {
      failed++;
      continue;
    }

    // Verify the new image works
    const check = await checkImageSize(newImage);
    if (check.status !== 200 || check.size < 5000) {
      failed++;
      continue;
    }

    if (!dryRun) {
      p.image_url = newImage;
      p.image_quality = check.size > 50000 ? "verified-hq" : "verified";
      delete p.bad_image;
    }
    fixed++;

    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  } catch (err) {
    failed++;
  }
}

console.log(`\n\nResults:`);
console.log(`  Fixed: ${fixed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Skipped: ${skipped}`);

if (!dryRun && fixed > 0) {
  console.log("Saving catalog...");
  writeFileSync(DB_PATH, JSON.stringify(db, null, 0));
  console.log("Saved.");
}
