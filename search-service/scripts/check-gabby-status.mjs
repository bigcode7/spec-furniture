import fs from 'fs';
const data = JSON.parse(fs.readFileSync('data/catalog.db.json','utf8'));
const gabby = data.products.filter(p =>
  (p.vendor_id||'').toLowerCase().includes('gabby') && p.ai_furniture_type
);

const withBadImage = gabby.filter(p => p.bad_image === true);
const withImageDead = gabby.filter(p => p.image_dead === true);
console.log('bad_image flagged:', withBadImage.length);
console.log('image_dead flagged:', withImageDead.length);

// Sample broken URLs
console.log('\nSample broken image URLs:');
for (const p of withBadImage.slice(0, 5)) {
  console.log('  IMG:', p.image_url?.substring(0, 130));
  console.log('  PAGE:', p.product_url?.substring(0, 80));
  console.log();
}

// Sample working
const goodOnes = gabby.filter(p => p.bad_image !== true);
console.log('Sample working image URLs:');
for (const p of goodOnes.slice(0, 3)) {
  console.log('  IMG:', p.image_url?.substring(0, 130));
}
