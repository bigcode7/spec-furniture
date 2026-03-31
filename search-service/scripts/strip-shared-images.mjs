#!/usr/bin/env node
/**
 * Strip shared/swatch images from product galleries.
 *
 * Many vendors (especially Caracole on Shopify) include material/finish swatch
 * images in every product's image array. These swatches appear across dozens
 * or hundreds of products with the exact same URL.
 *
 * This script removes any image URL that appears in 2+ products from the same
 * vendor — those are swatches, not product photos.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'catalog.db.json');

console.log('[LOAD] Reading catalog...');
const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
console.log(`[LOAD] ${data.products.length} products`);

// Phase 1: Count how many products each image URL appears in, per vendor
const vendorImageCounts = new Map(); // vendor -> Map<url, count>

for (const p of data.products) {
  const vendor = p.vendor_id || p.vendor_name || '';
  if (!vendor) continue;

  if (!vendorImageCounts.has(vendor)) {
    vendorImageCounts.set(vendor, new Map());
  }
  const counts = vendorImageCounts.get(vendor);

  const images = p.images || [];
  const urls = new Set(); // dedupe within single product
  for (const img of images) {
    const url = typeof img === 'string' ? img : (img?.url || '');
    if (url) urls.add(url);
  }

  for (const url of urls) {
    counts.set(url, (counts.get(url) || 0) + 1);
  }
}

// Phase 2: Build set of shared image URLs (appear in 2+ products from same vendor)
const sharedUrls = new Set();
let totalSharedUrls = 0;

for (const [vendor, counts] of vendorImageCounts) {
  for (const [url, count] of counts) {
    if (count >= 2) {
      sharedUrls.add(url);
      totalSharedUrls++;
    }
  }
}

console.log(`\n[ANALYSIS] Found ${totalSharedUrls} shared image URLs (swatches) across all vendors`);

// Show top vendors by shared image count
const vendorSharedCounts = new Map();
for (const [vendor, counts] of vendorImageCounts) {
  let shared = 0;
  for (const [, count] of counts) {
    if (count >= 2) shared++;
  }
  if (shared > 0) vendorSharedCounts.set(vendor, shared);
}

const topVendors = [...vendorSharedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log('\nTop vendors by shared images:');
for (const [vendor, count] of topVendors) {
  console.log(`  ${vendor}: ${count} shared image URLs`);
}

// Phase 3: Strip shared images from all products
let productsFixed = 0;
let totalRemoved = 0;

for (const p of data.products) {
  const images = p.images;
  if (!images || !Array.isArray(images) || images.length === 0) continue;

  const originalUrls = images.map(i => typeof i === 'string' ? i : (i?.url || '')).filter(Boolean);
  const cleaned = [];
  let removed = 0;

  for (const url of originalUrls) {
    if (sharedUrls.has(url)) {
      removed++;
    } else {
      cleaned.push(url);
    }
  }

  if (removed > 0) {
    p.images = cleaned;
    productsFixed++;
    totalRemoved += removed;
  }
}

console.log(`\n[RESULT] Products cleaned: ${productsFixed}`);
console.log(`[RESULT] Swatch images removed: ${totalRemoved}`);
console.log(`[RESULT] Average swatches per affected product: ${productsFixed > 0 ? (totalRemoved / productsFixed).toFixed(1) : 0}`);

data.saved_at = new Date().toISOString();
fs.writeFileSync(DB_PATH, JSON.stringify(data));
console.log('[SAVE] Done.');
