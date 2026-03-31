#!/usr/bin/env node
/**
 * Fix Gabby products: identify broken images, check if products still exist,
 * flag dead products so they don't show in search results.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'catalog.db.json');

console.log('[LOAD] Reading catalog...');
const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const gabby = data.products.filter(p =>
  (p.vendor_id || '').toLowerCase().includes('gabby') && p.ai_furniture_type
);
console.log(`Gabby furniture products: ${gabby.length}`);

// Phase 1: Check all images
console.log('\n[PHASE 1] Checking image URLs...');
const broken = [];
const working = [];

for (let i = 0; i < gabby.length; i += 30) {
  const batch = gabby.slice(i, i + 30);
  const results = await Promise.all(batch.map(async p => {
    try {
      const r = await fetch(p.image_url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) });
      return { p, ok: r.ok };
    } catch { return { p, ok: false }; }
  }));
  for (const { p, ok } of results) {
    if (ok) working.push(p);
    else broken.push(p);
  }
  if ((i + 30) % 150 === 0) process.stdout.write(`  ${i + 30}/${gabby.length}... `);
}
console.log(`\n  Working: ${working.length}`);
console.log(`  Broken: ${broken.length}`);

// Phase 2: Check if product pages still exist
console.log('\n[PHASE 2] Checking product pages for broken products...');
let pageAlive = 0, pageDead = 0;

for (let i = 0; i < broken.length; i += 20) {
  const batch = broken.slice(i, i + 20);
  const results = await Promise.all(batch.map(async p => {
    if (!p.product_url) return { p, alive: false };
    try {
      const r = await fetch(p.product_url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) });
      return { p, alive: r.ok };
    } catch { return { p, alive: false }; }
  }));
  for (const { p, alive } of results) {
    if (alive) pageAlive++;
    else {
      pageDead++;
      // Product is completely dead — flag it
      p.bad_image = true;
      p.image_dead = true;
      p.product_url_dead = true;
    }
  }
}
console.log(`  Product page alive (image just changed): ${pageAlive}`);
console.log(`  Product page dead (removed from site): ${pageDead}`);

// Phase 3: For products with dead images but alive pages, try to get new image
if (pageAlive > 0) {
  console.log(`\n[PHASE 3] Attempting to scrape new images for ${pageAlive} alive products...`);
  let scraped = 0;
  const aliveProducts = broken.filter(p => !p.product_url_dead);

  for (let i = 0; i < aliveProducts.length; i += 5) {
    const batch = aliveProducts.slice(i, i + 5);
    await Promise.all(batch.map(async p => {
      try {
        const r = await fetch(p.product_url, { redirect: 'follow', signal: AbortSignal.timeout(10000) });
        const html = await r.text();
        // Try various image extraction methods
        const ogImg = html.match(/property="og:image"\s+content="([^"]+)"/);
        const jsonLd = html.match(/"image"\s*:\s*"(https:\/\/[^"]+\.(jpg|png|webp)[^"]*)"/);
        const cdnImg = html.match(/https:\/\/cdn\.shopify\.com\/[^"'\s]+\.(jpg|png|webp)/);

        const newUrl = ogImg?.[1] || jsonLd?.[1] || cdnImg?.[0];
        if (newUrl) {
          // Verify new URL works
          const check = await fetch(newUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
          if (check.ok) {
            p.image_url = newUrl;
            p.bad_image = false;
            p.image_dead = false;
            scraped++;
          }
        }
      } catch {}
    }));
  }
  console.log(`  Successfully scraped new images: ${scraped}`);
}

// Summary
const totalFlagged = data.products.filter(p =>
  (p.vendor_id || '').toLowerCase().includes('gabby') && p.image_dead
).length;

console.log(`\n${'═'.repeat(50)}`);
console.log('GABBY FIX SUMMARY');
console.log('═'.repeat(50));
console.log(`Total Gabby furniture: ${gabby.length}`);
console.log(`Images working: ${working.length}`);
console.log(`Images broken: ${broken.length}`);
console.log(`  - Product removed from site: ${pageDead} (flagged as dead)`);
console.log(`  - Product alive, image rotated: ${pageAlive}`);
console.log(`Products flagged as dead: ${totalFlagged}`);

// Save
data.saved_at = new Date().toISOString();
fs.writeFileSync(DB_PATH, JSON.stringify(data));
console.log('\n[SAVE] Done.');
