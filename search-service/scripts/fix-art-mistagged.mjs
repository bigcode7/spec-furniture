#!/usr/bin/env node
/**
 * Fix wall art, decorative objects, mirrors, and accessories that got
 * mistagged by the AI as furniture (sofa, chair, table, etc.).
 * The AI saw the subject of the artwork and tagged it as that furniture type.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'catalog.db.json');

console.log('[LOAD] Reading catalog...');
const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
console.log(`[LOAD] ${data.products.length} products`);

const NON_FURNITURE_CATEGORIES = [
  'wall-art', 'art', 'prints', 'decorative-objects', 'decor', 'accessories',
  'mirrors', 'lighting', 'lamps', 'chandeliers', 'sconces', 'pendants',
  'rugs', 'pillows', 'throws', 'bedding', 'curtains', 'hardware',
  'tabletop', 'vases', 'candles', 'frames', 'clocks',
];

const NON_FURNITURE_NAME_PATTERNS = [
  /\b(print|painting|canvas|artwork|lithograph|photograph|poster|giclee)\b/i,
  /\b(pillow|throw|blanket|rug|runner|mat)\b/i,
  /\b(lamp|sconce|chandelier|pendant|lantern)\b/i,
  /\b(vase|candle|tray|bowl|frame|clock|figurine|sculpture)\b/i,
  /\bside rail(s)?\b/i,
  /\bbed pillow(s)?\b/i,
  /\bglass top\b/i,
];

const FURNITURE_TYPES = [
  'sofa', 'chair', 'table', 'bed', 'bench', 'ottoman', 'desk', 'sectional',
  'dresser', 'chest', 'nightstand', 'credenza', 'sideboard', 'bookcase',
  'cabinet', 'headboard', 'loveseat', 'settee', 'stool', 'console',
];

let fixed = 0;
let kept = 0;

for (const p of data.products) {
  const cat = (p.category || '').toLowerCase();
  const name = (p.product_name || '').toLowerCase();
  const ft = (p.ai_furniture_type || '').toLowerCase();

  if (!ft) continue;

  // Check if category suggests non-furniture
  const isNonFurnitureCat = NON_FURNITURE_CATEGORIES.some(c => cat.includes(c));
  const isNonFurnitureName = NON_FURNITURE_NAME_PATTERNS.some(r => r.test(name));
  const hasFurnitureTag = FURNITURE_TYPES.some(t => ft.includes(t));

  if ((isNonFurnitureCat || isNonFurnitureName) && hasFurnitureTag) {
    // This is non-furniture mistagged as furniture — clear the furniture type
    // so it doesn't pollute search results
    p.ai_furniture_type = null;
    if (p.ai_visual_analysis) {
      p.ai_visual_analysis.furniture_type = null;
    }
    fixed++;
  } else {
    kept++;
  }
}

console.log(`\nFixed: ${fixed} non-furniture products had mistagged ai_furniture_type removed`);
console.log(`Kept: ${kept} products with valid furniture tags`);

data.saved_at = new Date().toISOString();
fs.writeFileSync(DB_PATH, JSON.stringify(data));
console.log('[SAVE] Done.');
