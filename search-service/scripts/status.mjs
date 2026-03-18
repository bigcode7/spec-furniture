import fs from 'fs';

const data = JSON.parse(fs.readFileSync('data/catalog.db.json', 'utf8'));
const products = Array.isArray(data.products) ? data.products : [];
const vendors = {};
let multiImg = 0, noImg = 0, total = 0;

for (const p of products) {
  const vid = p.vendor_id || 'unknown';
  if (!vendors[vid]) vendors[vid] = { total: 0, multi: 0, noImg: 0 };
  vendors[vid].total++;
  total++;
  const imgs = Array.isArray(p.images) ? p.images.length : 0;
  if (imgs > 1) { vendors[vid].multi++; multiImg++; }
  if (!p.image_url || !p.image_url.startsWith('http')) { vendors[vid].noImg++; noImg++; }
}

console.log(`CATALOG: ${total} products | ${multiImg} multi-image (${Math.round(multiImg/total*100)}%) | ${noImg} no image`);
console.log('');
console.log('  Vendor                   Count   Multi-Img       No-Img');
console.log('  ' + '─'.repeat(55));
for (const [v, d] of Object.entries(vendors).sort((a, b) => b[1].total - a[1].total)) {
  const pct = d.total > 0 ? Math.round(d.multi / d.total * 100) : 0;
  const noImgStr = d.noImg > 0 ? String(d.noImg) : '';
  console.log(`  ${v.padEnd(25)} ${String(d.total).padStart(5)}   ${String(d.multi).padStart(5)} (${String(pct).padStart(3)}%)   ${noImgStr}`);
}

const TARGET = new Set([
  'bernhardt', 'hooker', 'century', 'universal', 'vanguard',
  'cr-laine', 'lee-industries', 'sherrill', 'wesley-hall',
  'hancock-moore', 'hickory-chair', 'highland-house',
  'lexington', 'theodore-alexander', 'baker', 'caracole', 'stickley', 'rowe'
]);

const missing = [...TARGET].filter(v => !vendors[v]);
if (missing.length > 0) {
  console.log('\nMISSING VENDORS: ' + missing.join(', '));
}
