import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'catalog.db.json'),'utf8'));
const catalog = raw.products || raw;
const tagged = catalog.filter(p => p.ai_advanced_tagged);
const samples = [
  tagged.find(p => p.ai_furniture_type === 'sofa'),
  tagged.find(p => p.ai_furniture_type === 'dining chair'),
  tagged.find(p => p.ai_furniture_type === 'coffee table'),
  tagged.find(p => p.ai_furniture_type === 'bed'),
  tagged.find(p => p.ai_furniture_type === 'dresser'),
].filter(Boolean);
const fields = ['ai_cushion_config','ai_back_cushion_count','ai_seat_cushion_count','ai_tufting_pattern','ai_skirt_style','ai_has_nailhead','ai_nailhead_finish','ai_edge_profile','ai_base_type','ai_wood_species','ai_indoor_outdoor','ai_COM_eligible','ai_seat_depth','ai_seat_height','ai_adjustable','ai_joinery_visible','ai_hardware_visible'];
for (const p of samples) {
  console.log('━'.repeat(60));
  console.log(p.product_name, '|', p.vendor_name);
  console.log('Type:', p.ai_furniture_type, '| Style:', p.ai_style, '| Scale:', p.ai_scale);
  console.log('Advanced fields:');
  for (const f of fields) {
    if (p[f] !== null && p[f] !== undefined) console.log('  ', f, '=', p[f]);
  }
}
