import fs from 'fs';
const data = JSON.parse(fs.readFileSync('data/catalog.db.json','utf8'));

const topFields = ['ai_skirt_style','ai_has_nailhead','ai_nailhead_finish','ai_tufting_pattern','ai_seat_depth','ai_cushion_config','ai_COM_eligible','ai_indoor_outdoor','ai_wood_species','ai_base_type','ai_adjustable','ai_formality_level','ai_design_era','ai_room_suitability','ai_client_profile','ai_price_tier','ai_visual_weight','ai_mood'];

console.log('=== Top-level ai_ fields ===');
for (const f of topFields) {
  const count = data.products.filter(p => p[f] != null && p[f] !== 'null' && p[f] !== '').length;
  console.log(`${f}: ${count}`);
}

console.log('\n=== In ai_visual_analysis ===');
const vaFields = ['skirt_style','has_nailhead','nailhead_finish','tufting_pattern','seat_depth_category','cushion_configuration','COM_eligible','indoor_outdoor','wood_species_visible','base_type','adjustable','formality_level','design_era','room_suitability','client_profile','price_tier','visual_weight','mood'];
for (const f of vaFields) {
  const count = data.products.filter(p => p.ai_visual_analysis && p.ai_visual_analysis[f] != null && p.ai_visual_analysis[f] !== 'null' && p.ai_visual_analysis[f] !== '').length;
  console.log(`${f}: ${count}`);
}

// Specific checks
const skirted = data.products.filter(p => {
  const va = p.ai_visual_analysis || {};
  const s = (p.ai_skirt_style || va.skirt_style || '').toString().toLowerCase();
  return s.includes('skirt');
});
console.log(`\n>>> Skirted products: ${skirted.length}`);
for (const p of skirted.slice(0, 5)) {
  console.log(`  ${p.product_name} => ${p.ai_skirt_style || p.ai_visual_analysis?.skirt_style}`);
}

const nailhead = data.products.filter(p => {
  const va = p.ai_visual_analysis || {};
  return p.ai_has_nailhead === true || va.has_nailhead === true || p.ai_has_nailhead === 'true' || va.has_nailhead === 'true';
});
console.log(`\n>>> Nailhead products: ${nailhead.length}`);
for (const p of nailhead.slice(0, 5)) {
  console.log(`  ${p.product_name} => ${p.ai_has_nailhead || p.ai_visual_analysis?.has_nailhead}`);
}

const formal = data.products.filter(p => {
  const va = p.ai_visual_analysis || {};
  const f = (p.ai_formality_level || va.formality_level || '').toString().toLowerCase();
  return f.includes('formal');
});
console.log(`\n>>> Formal products: ${formal.length}`);

const deepSeat = data.products.filter(p => {
  const va = p.ai_visual_analysis || {};
  const s = (p.ai_seat_depth || va.seat_depth_category || '').toString().toLowerCase();
  return s.includes('deep');
});
console.log(`>>> Deep seat products: ${deepSeat.length}`);

const comEligible = data.products.filter(p => {
  const va = p.ai_visual_analysis || {};
  return p.ai_COM_eligible === true || va.COM_eligible === true;
});
console.log(`>>> COM eligible products: ${comEligible.length}`);

const luxury = data.products.filter(p => {
  const va = p.ai_visual_analysis || {};
  const t = (p.ai_price_tier || va.price_tier || '').toString().toLowerCase();
  return t.includes('luxury');
});
console.log(`>>> Luxury price tier products: ${luxury.length}`);
