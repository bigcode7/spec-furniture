import fs from 'fs';

const DB_PATH = 'data/catalog.db.json';
const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const products = Array.isArray(data.products) ? data.products : [];

console.log('Before:', products.length, 'products');

// Group by vendor_id + product_name (normalized)
const groups = new Map();
for (const p of products) {
  const key = (p.vendor_id || '') + '::' + (p.product_name || '').toLowerCase().trim();
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(p);
}

// For each group, keep the best product (most images, most data)
const kept = [];
let dupsRemoved = 0;

for (const [key, group] of groups) {
  if (group.length === 1) {
    kept.push(group[0]);
    continue;
  }

  // Score each duplicate — prefer the one with more data
  group.sort((a, b) => {
    const scoreA = (Array.isArray(a.images) ? a.images.length * 10 : 0)
      + (a.description ? a.description.length : 0)
      + (a.dimensions ? 20 : 0)
      + (a.material ? 15 : 0)
      + (a.retail_price ? 10 : 0)
      + (a.product_url ? 5 : 0);
    const scoreB = (Array.isArray(b.images) ? b.images.length * 10 : 0)
      + (b.description ? b.description.length : 0)
      + (b.dimensions ? 20 : 0)
      + (b.material ? 15 : 0)
      + (b.retail_price ? 10 : 0)
      + (b.product_url ? 5 : 0);
    return scoreB - scoreA;
  });

  // Keep the best one, but merge images from others
  const best = group[0];
  const allImages = new Set();
  for (const p of group) {
    if (Array.isArray(p.images)) {
      for (const img of p.images) {
        const url = typeof img === 'string' ? img : img?.url;
        if (url) allImages.add(url);
      }
    }
    if (p.image_url) allImages.add(p.image_url);
  }
  if (allImages.size > 0) {
    best.images = [...allImages].slice(0, 20);
    if (!best.image_url && best.images.length > 0) {
      best.image_url = best.images[0];
    }
  }

  kept.push(best);
  dupsRemoved += group.length - 1;
}

console.log('After:', kept.length, 'products');
console.log('Duplicates removed:', dupsRemoved);

// Per-vendor counts
const vendors = {};
for (const p of kept) {
  vendors[p.vendor_id] = (vendors[p.vendor_id] || 0) + 1;
}
for (const [v, c] of Object.entries(vendors).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + v.padEnd(25) + String(c).padStart(6));
}

const output = {
  version: 1,
  saved_at: new Date().toISOString(),
  product_count: kept.length,
  products: kept,
  vendor_crawl_meta: data.vendor_crawl_meta || {},
};
fs.writeFileSync(DB_PATH, JSON.stringify(output));
console.log('Saved.');
