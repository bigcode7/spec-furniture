#!/usr/bin/env node
/**
 * Advanced Accuracy Test — Tests specific new field queries
 */
import { initCatalogDB, getAllProducts } from '../src/db/catalog-db.mjs';

await initCatalogDB();
const products = [...getAllProducts()];
const tagged = products.filter(p => p.ai_furniture_type);

console.log(`\nCatalog: ${products.length} total, ${tagged.length} searchable\n`);

const QUERIES = [
  {
    name: "skirted sofa nailhead trim traditional",
    filters: { ai_furniture_type: "sofa", ai_skirt_style: "skirted", ai_has_nailhead: true, ai_style: "traditional" },
    minResults: 1,
  },
  {
    name: "deep seat sofa",
    filters: { ai_furniture_type: "sofa", ai_seat_depth: "deep" },
    minResults: 1,
  },
  {
    name: "COM eligible upholstered chair",
    filters: { ai_furniture_type: ["accent chair", "dining chair", "club chair"], ai_COM_eligible: true },
    minResults: 1,
  },
  {
    name: "formal living room luxury",
    filters: { ai_formality: "formal" },
    minResults: 1,
  },
  // Additional coverage tests
  {
    name: "channel tufted sofa",
    filters: { ai_furniture_type: "sofa", ai_tufting_pattern: "channel" },
    minResults: 1,
  },
  {
    name: "pedestal dining table",
    filters: { ai_furniture_type: "dining table", ai_base_type: "pedestal" },
    minResults: 1,
  },
  {
    name: "pet friendly sofa",
    filters: { ai_furniture_type: "sofa", ai_pet_friendly: "pet friendly" },
    minResults: 1,
  },
  {
    name: "kid friendly sectional",
    filters: { ai_furniture_type: "sectional", ai_kid_friendly: "kid friendly" },
    minResults: 1,
  },
  {
    name: "wipeable dining chair",
    filters: { ai_furniture_type: "dining chair", ai_cleanability: "wipeable" },
    minResults: 1,
  },
  {
    name: "stackable dining chair",
    filters: { ai_furniture_type: "dining chair", ai_stackable: "stackable" },
    minResults: 1,
  },
  {
    name: "modular sectional",
    filters: { ai_furniture_type: "sectional", ai_stackable: "modular" },
    minResults: 1,
  },
  {
    name: "swivel accent chair",
    filters: { ai_furniture_type: ["accent chair", "club chair", "swivel chair"], ai_adjustable: "swivel" },
    minResults: 1,
  },
  {
    name: "geometric pattern accent chair",
    filters: { ai_furniture_type: ["accent chair", "club chair"], ai_pattern_type: "geometric" },
    minResults: 1,
  },
  {
    name: "matte finish console table",
    filters: { ai_furniture_type: "console table", ai_light_reflectivity: "matte" },
    minResults: 1,
  },
  {
    name: "reclaimed wood dining table",
    filters: { ai_furniture_type: "dining table", ai_sustainability: "reclaimed" },
    minResults: 1,
  },
];

function matchesFilter(product, field, value) {
  let pVal = product[field];
  if (pVal === undefined || pVal === null) {
    const va = product.ai_visual_analysis || {};
    const vaMap = {
      ai_furniture_type: 'furniture_type', ai_back_style: 'back', ai_arm_style: 'arms',
      ai_silhouette: 'silhouette', ai_primary_material: 'upholstery_material',
      ai_primary_color: 'color_primary', ai_style: 'style', ai_formality: 'formality',
      ai_scale: 'scale', ai_mood: 'mood', ai_leg_style: 'legs_base',
      ai_tufting_pattern: 'tufting_pattern', ai_skirt_style: 'skirt_style',
      ai_has_nailhead: 'has_nailhead', ai_base_type: 'base_type',
      ai_wood_species: 'wood_species_visible', ai_indoor_outdoor: 'indoor_outdoor',
      ai_seat_depth: 'seat_depth_category', ai_seat_height: 'seat_height_category',
      ai_adjustable: 'adjustable', ai_pet_friendly: 'pet_friendliness',
      ai_kid_friendly: 'kid_friendliness', ai_COM_eligible: 'COM_eligible',
      ai_cleanability: 'cleanability', ai_stackable: 'stackable_nestable',
      ai_pattern_type: 'pattern_type', ai_light_reflectivity: 'light_reflectivity',
      ai_sustainability: 'sustainability_signals',
    };
    pVal = va[vaMap[field] || field.replace('ai_', '')];
  }
  if (pVal === undefined || pVal === null) return false;
  const pStr = String(pVal).toLowerCase();
  const values = Array.isArray(value) ? value : [value];
  return values.some(v => {
    const vStr = String(v).toLowerCase();
    return pStr.includes(vStr) || vStr.includes(pStr);
  });
}

console.log('═'.repeat(70));
console.log('ADVANCED FIELD ACCURACY TEST');
console.log('═'.repeat(70));
console.log('');

let pass = 0, fail = 0;

for (const q of QUERIES) {
  const matches = tagged.filter(p => {
    for (const [field, value] of Object.entries(q.filters)) {
      if (!matchesFilter(p, field, value)) return false;
    }
    return true;
  });

  const top80 = matches.slice(0, 80);
  const ok = matches.length >= q.minResults;
  if (ok) pass++; else fail++;

  const status = ok ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}  "${q.name}"`);
  console.log(`       ${matches.length} total matches in catalog | showing top ${top80.length}`);
  if (top80.length > 0) {
    for (const p of top80.slice(0, 3)) {
      console.log(`       → ${p.product_name} (${p.vendor_name || 'unknown'})`);
    }
  }
  console.log('');
}

console.log('═'.repeat(70));
console.log(`RESULTS: ${pass}/${QUERIES.length} PASS | ${fail}/${QUERIES.length} FAIL`);
console.log('═'.repeat(70));
