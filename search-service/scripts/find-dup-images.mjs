#!/usr/bin/env node
/**
 * Find products with duplicate images in their images array.
 */
import fs from 'fs';
const data = JSON.parse(fs.readFileSync('data/catalog.db.json', 'utf8'));

let dupeProducts = 0;
let totalDupesRemoved = 0;
const examples = [];

function normalizeForDedup(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Remove all sizing/quality params
    for (const k of ['w', 'h', 'width', 'height', 'fit', 'q', 'quality', 'format', 'fm', 'auto', 'dpr', 'crop', 'ar', 'pad', 'bg', 'trim', 'blur', 'sharp', 'sat', 'bri', 'con', 'hue', 'exp', 'vib']) {
      u.searchParams.delete(k);
    }
    // Remove size suffixes from path
    let path = u.pathname.replace(/[_-]\d{2,4}x\d{2,4}/g, '').replace(/[_-](small|medium|large|thumb|xlarge|xxlarge|original|full|master|grande|compact|pico|icon)/gi, '');
    return u.hostname + path;
  } catch {
    return url.toLowerCase();
  }
}

for (const p of data.products) {
  const images = p.images || [];
  if (images.length < 2) continue;

  const hero = p.image_url || '';
  const allUrls = [hero, ...images.map(i => typeof i === 'string' ? i : i?.url || '')].filter(Boolean);

  const seen = new Set();
  const unique = [];
  const dupes = [];

  for (const url of allUrls) {
    const norm = normalizeForDedup(url);
    if (seen.has(norm)) {
      dupes.push(url);
    } else {
      seen.add(norm);
      unique.push(url);
    }
  }

  if (dupes.length > 0) {
    dupeProducts++;
    totalDupesRemoved += dupes.length;
    if (examples.length < 15) {
      examples.push({
        name: p.product_name,
        vendor: p.vendor_name,
        total_images: allUrls.length,
        unique_images: unique.length,
        dupes: dupes.length,
        hero: hero.substring(0, 80),
        first_dupe: dupes[0].substring(0, 80),
      });
    }
  }
}

console.log(`Products with duplicate images: ${dupeProducts}`);
console.log(`Total duplicate images to remove: ${totalDupesRemoved}`);
console.log(`\nExamples:`);
for (const e of examples) {
  console.log(`  ${e.name} (${e.vendor}) — ${e.total_images} images, ${e.dupes} dupes`);
  console.log(`    hero: ${e.hero}`);
  console.log(`    dupe: ${e.first_dupe}`);
  console.log();
}
