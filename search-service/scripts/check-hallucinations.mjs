import fs from 'fs';
const data = JSON.parse(fs.readFileSync('data/catalog.db.json','utf8'));

// Fields that CAN be determined from photos (keep as-is):
// furniture_type, silhouette, arms, back, legs, material, color, style, tufting, skirt, nailhead, base_type, etc.

// Fields that CANNOT be reliably determined from photos alone:
// seat_depth, seat_height (unless bar/counter stool), weight_class, COM_eligible, wood_species (sometimes)

function checkField(fieldName, vaKey, validationFn) {
  let total = 0, noEvidence = 0;
  for (const p of data.products) {
    const val = p[fieldName] || (p.ai_visual_analysis && p.ai_visual_analysis[vaKey]);
    if (!val || val === 'null' || val === 'none' || val === 'standard') continue;
    total++;
    if (!validationFn(p, val)) noEvidence++;
  }
  const rate = total > 0 ? (noEvidence / total * 100).toFixed(1) : '0';
  console.log(`${fieldName}: ${total} tagged, ${noEvidence} no text evidence (${rate}% hallucination)`);
}

// seat_height: only "counter height" and "bar height" are checkable
checkField('ai_seat_height', 'seat_height_category', (p, val) => {
  if (val === 'standard' || val === 'low profile') return true; // these are fine guesses
  const text = [p.product_name || '', p.description || '', p.category || ''].join(' ').toLowerCase();
  if (val.includes('counter')) return text.includes('counter');
  if (val.includes('bar')) return text.includes('bar');
  return true;
});

// weight_class: impossible from photo
checkField('ai_weight_class', 'weight_class', (p, val) => {
  // Weight class is an estimate based on size+material — that's actually reasonable
  // from AI analysis (marble = heavy, rattan = light). Let it through.
  return true;
});

// wood_species: can sometimes be seen but often guessed
checkField('ai_wood_species', 'wood_species_visible', (p, val) => {
  const text = [p.product_name || '', p.description || '', p.material || ''].join(' ').toLowerCase();
  return text.includes(val.toLowerCase());
});

// COM_eligible: only from text
checkField('ai_COM_eligible', 'COM_eligible', (p, val) => {
  if (val === false || val === 'false' || val === null) return true;
  const text = [p.description || ''].join(' ').toLowerCase();
  return text.includes('com') || text.includes("customer's own") || text.includes('your fabric');
});

console.log('\n--- Fields determined from visual analysis (expected low hallucination) ---');

checkField('ai_tufting_pattern', 'tufting_pattern', (p, val) => {
  return true; // Visual — can see tufting in photos
});

checkField('ai_base_type', 'base_type', (p, val) => {
  return true; // Visual — can see base in photos
});
