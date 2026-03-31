#!/usr/bin/env node
/**
 * Flag Gabby products with broken CDN images so search results
 * can show a placeholder instead of a broken image.
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

// Check all images
console.log('\n[CHECK] Testing image URLs...');
let broken = 0, working = 0;

for (let i = 0; i < gabby.length; i += 30) {
  const batch = gabby.slice(i, i + 30);
  const results = await Promise.all(batch.map(async p => {
    try {
      const r = await fetch(p.image_url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(5000) });
      return { p, ok: r.ok };
    } catch { return { p, ok: false }; }
  }));
  for (const { p, ok } of results) {
    if (ok) {
      working++;
      // Clear any stale flags
      if (p.bad_image) { delete p.bad_image; delete p.image_dead; }
    } else {
      broken++;
      p.bad_image = true;
    }
  }
  if ((i + 30) % 150 === 0) process.stdout.write(`  ${Math.min(i + 30, gabby.length)}/${gabby.length}... `);
}

console.log(`\n\nWorking: ${working}`);
console.log(`Broken (flagged bad_image=true): ${broken}`);

data.saved_at = new Date().toISOString();
fs.writeFileSync(DB_PATH, JSON.stringify(data));
console.log('\n[SAVE] Done.');
