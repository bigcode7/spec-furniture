#!/usr/bin/env node
/**
 * Fix hallucinated seat_depth tags — remove "deep seat" where there's no text evidence.
 * Seat depth CANNOT be determined from a photo. Only keep it when the product
 * description/name explicitly says "deep seat" or lists a measurement > 22".
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'catalog.db.json');

console.log('[LOAD] Reading catalog...');
const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
console.log(`[LOAD] ${data.products.length} products`);

let fixed = 0;
let kept = 0;

for (const p of data.products) {
  const sd = p.ai_seat_depth || (p.ai_visual_analysis && p.ai_visual_analysis.seat_depth_category);
  if (!sd) continue;

  const allText = [
    p.product_name || '',
    p.description || '',
    p.dimensions || '',
  ].join(' ').toLowerCase();

  // Keep only if explicitly mentioned
  const hasEvidence =
    allText.includes('deep seat') ||
    allText.includes('deep seating') ||
    allText.includes('extra deep') ||
    allText.match(/seat\s*depth[:\s]*2[2-9]/) ||
    allText.match(/seat\s*depth[:\s]*3\d/);

  if (hasEvidence) {
    kept++;
  } else {
    // Remove hallucinated tag
    p.ai_seat_depth = null;
    if (p.ai_visual_analysis) {
      p.ai_visual_analysis.seat_depth_category = null;
    }
    fixed++;
  }
}

console.log(`\nFixed: ${fixed} products had hallucinated seat_depth removed`);
console.log(`Kept: ${kept} products have text-verified seat_depth`);

data.saved_at = new Date().toISOString();
fs.writeFileSync(DB_PATH, JSON.stringify(data));
console.log('[SAVE] Done.');
