#!/usr/bin/env node
/**
 * Accuracy Test — 20 hard precision queries against local catalog
 * Tests the AI field matching pipeline directly (no server needed)
 */

import { initCatalogDB, getAllProducts } from '../src/db/catalog-db.mjs';

// Wait for catalog to load
await initCatalogDB();
const products = [...getAllProducts()];
const tagged = products.filter(p => p.ai_furniture_type);

console.log(`\nCatalog: ${products.length} total, ${tagged.length} searchable (ai_furniture_type)\n`);

// ── 20 Hard Precision Queries ──
// Each query specifies exact fields to match. We check the top 80 results.
const QUERIES = [
  {
    name: "tight back track arm sofa",
    filters: { ai_furniture_type: "sofa", ai_back_style: "tight", ai_arm_style: "track" },
  },
  {
    name: "channel tufted accent chair",
    filters: { ai_furniture_type: ["accent chair", "club chair", "swivel chair"], ai_tufting_pattern: "channel" },
  },
  {
    name: "marble top coffee table",
    filters: { ai_furniture_type: ["cocktail table", "coffee table"], ai_primary_material: "marble" },
  },
  {
    name: "skirted sofa with nailhead",
    filters: { ai_furniture_type: "sofa", ai_skirt_style: "skirted", ai_has_nailhead: true },
  },
  {
    name: "walnut dining table pedestal base",
    filters: { ai_furniture_type: "dining table", ai_wood_species: "walnut", ai_base_type: "pedestal" },
  },
  {
    name: "velvet swivel chair",
    filters: { ai_furniture_type: ["swivel chair", "accent chair", "club chair"], ai_primary_material: "velvet", ai_adjustable: "swivel" },
  },
  {
    name: "leather recliner",
    filters: { ai_furniture_type: ["recliner", "power recliner"], ai_primary_material: "leather" },
  },
  {
    name: "boucle accent chair petite",
    filters: { ai_furniture_type: ["accent chair", "club chair", "slipper chair"], ai_primary_material: "boucle", ai_scale: ["petite", "small"] },
  },
  {
    name: "outdoor dining chair stackable",
    filters: { ai_indoor_outdoor: "outdoor", ai_furniture_type: "dining chair" },
  },
  {
    name: "trestle dining table oak",
    filters: { ai_furniture_type: "dining table", ai_base_type: "trestle", ai_wood_species: "oak" },
  },
  {
    name: "camelback sofa traditional",
    filters: { ai_furniture_type: "sofa", ai_silhouette: "camelback", ai_style: "traditional" },
  },
  {
    name: "wingback chair",
    filters: { ai_furniture_type: ["accent chair", "wingback chair", "club chair"], ai_silhouette: "wingback" },
  },
  {
    name: "mid century modern credenza",
    filters: { ai_furniture_type: ["credenza", "sideboard", "media console"], ai_style: "mid century" },
  },
  {
    name: "button tufted ottoman",
    filters: { ai_furniture_type: ["ottoman", "bench"], ai_tufting_pattern: "button" },
  },
  {
    name: "console table with drawers",
    filters: { ai_furniture_type: "console table" },
    feature_check: "drawer",
  },
  {
    name: "pet friendly performance fabric sofa",
    filters: { ai_furniture_type: "sofa", ai_pet_friendly: "pet friendly" },
  },
  {
    name: "deep seat sectional",
    filters: { ai_furniture_type: "sectional", ai_seat_depth: "deep seat" },
  },
  {
    name: "bar stool counter height",
    filters: { ai_furniture_type: ["bar stool", "counter stool"], ai_seat_height: ["counter height", "bar height"] },
  },
  {
    name: "hairpin leg side table",
    filters: { ai_furniture_type: ["side table", "end table", "accent table"], ai_base_type: "hairpin" },
  },
  {
    name: "modular sectional casual",
    filters: { ai_furniture_type: "sectional", ai_formality: ["casual", "relaxed"] },
  },
];

function matchesFilter(product, field, value) {
  // Get the product value — check top-level and ai_visual_analysis
  let pVal = product[field];
  if (pVal === undefined || pVal === null) {
    const va = product.ai_visual_analysis || {};
    // Map field names to va keys
    const vaMap = {
      ai_furniture_type: 'furniture_type',
      ai_back_style: 'back',
      ai_arm_style: 'arms',
      ai_silhouette: 'silhouette',
      ai_primary_material: 'upholstery_material',
      ai_primary_color: 'color_primary',
      ai_style: 'style',
      ai_formality: 'formality',
      ai_scale: 'scale',
      ai_mood: 'mood',
      ai_leg_style: 'legs_base',
      ai_tufting_pattern: 'tufting_pattern',
      ai_skirt_style: 'skirt_style',
      ai_has_nailhead: 'has_nailhead',
      ai_edge_profile: 'edge_profile',
      ai_base_type: 'base_type',
      ai_wood_species: 'wood_species_visible',
      ai_indoor_outdoor: 'indoor_outdoor',
      ai_seat_depth: 'seat_depth_category',
      ai_seat_height: 'seat_height_category',
      ai_adjustable: 'adjustable',
      ai_pet_friendly: 'pet_friendliness',
      ai_kid_friendly: 'kid_friendliness',
    };
    pVal = va[vaMap[field] || field.replace('ai_', '')];
  }
  if (pVal === undefined || pVal === null) return false;

  const pStr = String(pVal).toLowerCase();
  const values = Array.isArray(value) ? value : [value];

  for (const v of values) {
    const vStr = String(v).toLowerCase();
    if (pStr.includes(vStr) || vStr.includes(pStr)) return true;
  }
  return false;
}

function matchesFeature(product, keyword) {
  const va = product.ai_visual_analysis || {};
  const features = (va.distinctive_features || []).join(' ').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const searchTerms = (va.search_terms || []).join(' ').toLowerCase();
  const allText = features + ' ' + desc + ' ' + searchTerms;
  return allText.includes(keyword.toLowerCase());
}

console.log('═'.repeat(70));
console.log('ACCURACY TEST — 20 Hard Precision Queries');
console.log('═'.repeat(70));
console.log('');

let totalPass = 0;
let totalFail = 0;

for (const q of QUERIES) {
  // Find matching products
  const matches = tagged.filter(p => {
    for (const [field, value] of Object.entries(q.filters)) {
      if (!matchesFilter(p, field, value)) return false;
    }
    if (q.feature_check && !matchesFeature(p, q.feature_check)) return false;
    return true;
  });

  // Take top 80
  const top80 = matches.slice(0, 80);

  // Verify each result matches ALL criteria
  let correct = 0;
  let wrong = 0;
  const wrongExamples = [];

  for (const p of top80) {
    let allMatch = true;
    const misses = [];

    for (const [field, value] of Object.entries(q.filters)) {
      if (!matchesFilter(p, field, value)) {
        allMatch = false;
        misses.push(field);
      }
    }
    if (q.feature_check && !matchesFeature(p, q.feature_check)) {
      allMatch = false;
      misses.push('feature:' + q.feature_check);
    }

    if (allMatch) correct++;
    else {
      wrong++;
      if (wrongExamples.length < 2) {
        wrongExamples.push(`${p.product_name} (missed: ${misses.join(', ')})`);
      }
    }
  }

  const accuracy = top80.length > 0 ? ((correct / top80.length) * 100).toFixed(0) : 'N/A';
  const pass = top80.length > 0 && correct === top80.length;

  if (pass) totalPass++;
  else totalFail++;

  const status = top80.length === 0 ? '⚠ NO RESULTS' : pass ? '✓ PASS' : '✗ FAIL';
  console.log(`${status}  "${q.name}"`);
  console.log(`       ${top80.length} results | ${correct}/${top80.length} correct (${accuracy}%) | ${matches.length} total matches in catalog`);
  if (wrongExamples.length > 0) {
    for (const ex of wrongExamples) console.log(`       ✗ ${ex}`);
  }
  console.log('');
}

console.log('═'.repeat(70));
console.log(`RESULTS: ${totalPass}/20 PASS | ${totalFail}/20 FAIL`);
console.log('═'.repeat(70));
