import fs from 'fs';
const data = JSON.parse(fs.readFileSync('data/catalog.db.json','utf8'));
const deep = data.products.filter(p => {
  const sd = p.ai_seat_depth || p.ai_visual_analysis?.seat_depth_category;
  return sd && sd.toLowerCase().includes('deep');
});

console.log(`Products tagged "deep seat": ${deep.length}\n`);

let fromText = 0, fromNothing = 0;
const noEvidence = [];

for (const p of deep) {
  const desc = (p.description || '').toLowerCase();
  const name = (p.product_name || '').toLowerCase();
  const allText = desc + ' ' + name + ' ' + (p.dimensions || '');

  if (allText.includes('deep') || allText.match(/seat.*depth.*2[2-9]/)) {
    fromText++;
  } else {
    fromNothing++;
    if (noEvidence.length < 8) {
      noEvidence.push({
        name: p.product_name,
        vendor: p.vendor_name,
        desc: (p.description || '').substring(0, 120),
        dims: p.dimensions || 'none',
        cushions: p.ai_visual_analysis?.cushions || 'none',
      });
    }
  }
}

console.log(`Has "deep" in name/desc/dims: ${fromText}`);
console.log(`NO text evidence (AI hallucinated): ${fromNothing}`);
console.log(`Hallucination rate: ${(fromNothing / deep.length * 100).toFixed(1)}%\n`);

if (noEvidence.length > 0) {
  console.log('Examples with NO text evidence for "deep seat":');
  for (const p of noEvidence) {
    console.log(`  ${p.name} | ${p.vendor}`);
    console.log(`    desc: ${p.desc}`);
    console.log(`    dims: ${p.dims}`);
    console.log(`    cushions: ${p.cushions}`);
    console.log('');
  }
}
