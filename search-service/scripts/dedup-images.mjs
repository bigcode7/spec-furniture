#!/usr/bin/env node
/**
 * Remove duplicate images from product images arrays.
 * The hero image (image_url) is often duplicated in the images array.
 * Also deduplicates within the images array itself.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'catalog.db.json');

console.log('[LOAD] Reading catalog...');
const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
console.log(`[LOAD] ${data.products.length} products`);

function normalizeForDedup(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    for (const k of ['w', 'h', 'width', 'height', 'fit', 'q', 'quality', 'format', 'fm', 'auto', 'dpr', 'crop', 'ar', 'pad', 'bg', 'trim', 'blur', 'sharp', 'sat', 'bri', 'con', 'hue', 'exp', 'vib', 'v']) {
      u.searchParams.delete(k);
    }
    let p = u.pathname
      .replace(/[_-]\d{2,4}x\d{2,4}/g, '')
      .replace(/[_-](small|medium|large|thumb|xlarge|xxlarge|original|full|master|grande|compact|pico|icon)/gi, '');
    return (u.hostname + p).toLowerCase();
  } catch {
    return url.toLowerCase().trim();
  }
}

let productsFixed = 0;
let totalRemoved = 0;
let emptyArraysCleaned = 0;

for (const p of data.products) {
  let images = p.images;
  if (!images || !Array.isArray(images)) continue;

  // Normalize: extract URLs from objects
  const originalUrls = images.map(i => typeof i === 'string' ? i : i?.url || '').filter(Boolean);
  if (originalUrls.length === 0) {
    if (images.length > 0) {
      p.images = [];
      emptyArraysCleaned++;
    }
    continue;
  }

  const hero = p.image_url || '';
  const heroNorm = normalizeForDedup(hero);

  const seen = new Set();
  if (heroNorm) seen.add(heroNorm);

  const deduped = [];
  for (const url of originalUrls) {
    const norm = normalizeForDedup(url);
    if (!norm) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    deduped.push(url);
  }

  const removed = originalUrls.length - deduped.length;
  if (removed > 0) {
    p.images = deduped;
    productsFixed++;
    totalRemoved += removed;
  }
}

console.log(`\nProducts cleaned: ${productsFixed}`);
console.log(`Duplicate images removed: ${totalRemoved}`);
console.log(`Empty arrays cleaned: ${emptyArraysCleaned}`);

data.saved_at = new Date().toISOString();
fs.writeFileSync(DB_PATH, JSON.stringify(data));
console.log('[SAVE] Done.');
