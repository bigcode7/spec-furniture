import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/catalog.db.json', 'utf8'));
const products = data.products || {};

const KEEP = new Set([
  'bernhardt', 'hooker', 'century', 'universal', 'vanguard',
  'cr-laine', 'lee-industries', 'sherrill', 'wesley-hall',
  'hancock-moore', 'hickory-chair', 'highland-house',
  'lexington', 'theodore-alexander', 'baker', 'caracole', 'stickley', 'rowe'
]);

const vendorCounts = {};
let toDelete = 0;
let toKeep = 0;
for (const [id, p] of Object.entries(products)) {
  const vid = p.vendor_id || 'unknown';
  if (!KEEP.has(vid)) {
    vendorCounts[vid] = (vendorCounts[vid] || 0) + 1;
    toDelete++;
  } else {
    toKeep++;
  }
}

console.log('KEEP: ' + toKeep + ' products from ' + KEEP.size + ' vendors');
console.log('DELETE: ' + toDelete + ' products from ' + Object.keys(vendorCounts).length + ' vendors');
console.log('');
console.log('Vendors to delete:');
const sorted = Object.entries(vendorCounts).sort((a,b) => b[1]-a[1]);
for (const [vid, count] of sorted) {
  console.log('  ' + vid + ': ' + count);
}
