import fs from 'fs';

const DB_PATH = 'data/catalog.db.json';
const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
const products = data.products || {};

const KEEP = new Set([
  'bernhardt', 'hooker', 'century', 'universal', 'vanguard',
  'cr-laine', 'lee-industries', 'sherrill', 'wesley-hall',
  'hancock-moore', 'hickory-chair', 'highland-house',
  'lexington', 'theodore-alexander', 'baker', 'caracole', 'stickley', 'rowe'
]);

const before = Object.keys(products).length;
let deleted = 0;

for (const id of Object.keys(products)) {
  const vid = products[id].vendor_id || 'unknown';
  if (!KEEP.has(vid)) {
    delete products[id];
    deleted++;
  }
}

const after = Object.keys(products).length;
console.log(`Before: ${before} products`);
console.log(`Deleted: ${deleted} products`);
console.log(`After: ${after} products`);

// Write back
fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
console.log('Saved.');
