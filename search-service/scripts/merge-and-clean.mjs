import fs from 'fs';

const KEEP = new Set([
  'bernhardt', 'hooker', 'century', 'universal', 'vanguard',
  'cr-laine', 'lee-industries', 'sherrill', 'wesley-hall',
  'hancock-moore', 'hickory-chair', 'highland-house',
  'lexington', 'theodore-alexander', 'baker', 'caracole', 'stickley', 'rowe'
]);

// Load enriched (small) file — has better data for products it covers
const enriched = JSON.parse(fs.readFileSync('data/catalog.db.json.small', 'utf8'));
const enrichedProducts = enriched.products || {};

// Load backup — has all original products
const backup = JSON.parse(fs.readFileSync('data/catalog.db.json.bak', 'utf8'));
const backupProducts = backup.products || {};

console.log('Enriched file:', Object.keys(enrichedProducts).length, 'products');
console.log('Backup file:', Object.keys(backupProducts).length, 'products');

// Start with enriched products (only target vendors)
const merged = {};
let fromEnriched = 0;
let fromBackup = 0;
let skippedNonTrade = 0;

// Add all enriched products that are target vendors
for (const [id, p] of Object.entries(enrichedProducts)) {
  if (KEEP.has(p.vendor_id)) {
    merged[id] = p;
    fromEnriched++;
  }
}

// Add backup products for target vendors that aren't already in merged
for (const [id, p] of Object.entries(backupProducts)) {
  if (!KEEP.has(p.vendor_id)) {
    skippedNonTrade++;
    continue;
  }
  if (!merged[id]) {
    merged[id] = p;
    fromBackup++;
  }
}

console.log('\nMerged result:', Object.keys(merged).length, 'products');
console.log('  From enriched:', fromEnriched);
console.log('  From backup (missing):', fromBackup);
console.log('  Skipped non-trade:', skippedNonTrade);

// Per-vendor counts
const vendorCounts = {};
for (const p of Object.values(merged)) {
  vendorCounts[p.vendor_id] = (vendorCounts[p.vendor_id] || 0) + 1;
}
console.log('\nPer-vendor:');
for (const [v, c] of Object.entries(vendorCounts).sort((a, b) => b - a)) {
  console.log('  ' + v + ': ' + c);
}

// Save — DB expects products as an ARRAY, not object
const productsArray = Object.values(merged);
const output = {
  version: 1,
  saved_at: new Date().toISOString(),
  product_count: productsArray.length,
  products: productsArray,
  vendor_crawl_meta: backup.vendor_crawl_meta || {},
};
fs.writeFileSync('data/catalog.db.json', JSON.stringify(output));
console.log('\nSaved to catalog.db.json (' + productsArray.length + ' products as array)');
