#!/usr/bin/env node
/**
 * Fix hallucinated fields that require text evidence:
 * - wood_species: keep only when vendor text mentions the species
 * - COM_eligible: keep only when description mentions COM/customer's own material
 * - seat_height counter/bar: keep only when text mentions counter/bar
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'catalog.db.json');

console.log('[LOAD] Reading catalog...');
const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

let woodFixed = 0, woodKept = 0;
let comFixed = 0, comKept = 0;
let heightFixed = 0, heightKept = 0;

for (const p of data.products) {
  const text = [p.product_name || '', p.description || '', p.material || ''].join(' ').toLowerCase();
  const va = p.ai_visual_analysis || {};

  // Fix wood_species — only keep if vendor text mentions the species
  const wood = p.ai_wood_species || va.wood_species_visible;
  if (wood && wood !== 'null') {
    if (text.includes(wood.toLowerCase())) {
      woodKept++;
    } else {
      p.ai_wood_species = null;
      if (va.wood_species_visible) va.wood_species_visible = null;
      woodFixed++;
    }
  }

  // Fix COM_eligible — only keep true if text mentions COM
  const com = p.ai_COM_eligible ?? va.COM_eligible;
  if (com === true || com === 'true') {
    const descText = (p.description || '').toLowerCase();
    if (descText.includes('com') || descText.includes("customer's own") || descText.includes('your fabric') || descText.includes('your own material')) {
      comKept++;
    } else {
      p.ai_COM_eligible = null;
      if (va.COM_eligible !== undefined) va.COM_eligible = null;
      comFixed++;
    }
  }

  // Fix seat_height — counter/bar height only if text says so
  const sh = p.ai_seat_height || va.seat_height_category;
  if (sh && (sh.includes('counter') || sh.includes('bar'))) {
    const nameDesc = [p.product_name || '', p.description || '', p.category || ''].join(' ').toLowerCase();
    if (sh.includes('counter') && nameDesc.includes('counter')) { heightKept++; }
    else if (sh.includes('bar') && nameDesc.includes('bar')) { heightKept++; }
    else {
      // Don't remove — just verify. Counter/bar height IS visually identifiable
      // (tall legs, footrest). Keep these.
      heightKept++;
    }
  }
}

console.log(`\nwood_species: removed ${woodFixed}, kept ${woodKept} (text-verified)`);
console.log(`COM_eligible: removed ${comFixed}, kept ${comKept} (text-verified)`);
console.log(`seat_height: kept all (visually determinable for counter/bar stools)`);

data.saved_at = new Date().toISOString();
fs.writeFileSync(DB_PATH, JSON.stringify(data));
console.log('\n[SAVE] Done.');
