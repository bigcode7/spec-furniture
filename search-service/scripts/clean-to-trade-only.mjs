import fs from 'fs';

const DB_PATH = 'data/catalog.db.json';
const raw = fs.readFileSync(DB_PATH, 'utf8');
const data = JSON.parse(raw);

const KEEP = new Set([
  'bernhardt', 'hooker', 'century', 'universal', 'vanguard',
  'cr-laine', 'lee-industries', 'sherrill', 'wesley-hall',
  'hancock-moore', 'hickory-chair', 'highland-house',
  'lexington', 'theodore-alexander', 'baker', 'caracole', 'stickley', 'rowe'
]);

const products = Array.isArray(data.products) ? data.products : Object.values(data.products || {});
const kept = products.filter(p => KEEP.has(p.vendor_id));
const deleted = products.length - kept.length;

console.log(`Before: ${products.length}`);
console.log(`Kept: ${kept.length} (${KEEP.size} target vendors)`);
console.log(`Deleted: ${deleted}`);

const output = {
  version: 1,
  saved_at: new Date().toISOString(),
  product_count: kept.length,
  products: kept,
  vendor_crawl_meta: data.vendor_crawl_meta || {},
};
fs.writeFileSync(DB_PATH, JSON.stringify(output));
console.log('Saved.');
