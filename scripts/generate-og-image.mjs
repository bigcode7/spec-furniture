/**
 * Generate OG image (1200x630) for spekd.ai
 * Dark navy background with SPEKD branding and tagline.
 * Uses @napi-rs/canvas (no native dependencies needed on most platforms).
 *
 * Usage: node scripts/generate-og-image.mjs
 */

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WIDTH = 1200;
const HEIGHT = 630;

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

// --- Background: dark navy gradient ---
const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
grad.addColorStop(0, '#0a0e1a');
grad.addColorStop(1, '#141b2d');
ctx.fillStyle = grad;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// --- Subtle grid pattern ---
ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
ctx.lineWidth = 1;
for (let x = 0; x < WIDTH; x += 40) {
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, HEIGHT);
  ctx.stroke();
}
for (let y = 0; y < HEIGHT; y += 40) {
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(WIDTH, y);
  ctx.stroke();
}

// --- Accent glow (top-right) ---
const glow = ctx.createRadialGradient(900, 100, 0, 900, 100, 400);
glow.addColorStop(0, 'rgba(196, 168, 116, 0.12)');
glow.addColorStop(1, 'rgba(196, 168, 116, 0)');
ctx.fillStyle = glow;
ctx.fillRect(0, 0, WIDTH, HEIGHT);

// --- "SPEKD" logo text ---
ctx.fillStyle = '#c4a874'; // gold accent
ctx.font = 'bold 96px sans-serif';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('SPEKD', WIDTH / 2, HEIGHT / 2 - 60);

// --- Tagline ---
ctx.fillStyle = '#ffffff';
ctx.font = '32px sans-serif';
ctx.fillText('AI-Powered Trade Furniture Sourcing', WIDTH / 2, HEIGHT / 2 + 30);

// --- Sub-tagline ---
ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
ctx.font = '22px sans-serif';
ctx.fillText('42,000+ products  •  20+ premium vendors', WIDTH / 2, HEIGHT / 2 + 80);

// --- Bottom accent line ---
ctx.fillStyle = '#c4a874';
ctx.fillRect(WIDTH / 2 - 60, HEIGHT / 2 + 110, 120, 3);

// --- Domain ---
ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
ctx.font = '18px sans-serif';
ctx.fillText('spekd.ai', WIDTH / 2, HEIGHT - 40);

// --- Save ---
const buffer = canvas.toBuffer('image/png');
const outPath = resolve(__dirname, '..', 'public', 'og-image.png');
writeFileSync(outPath, buffer);
console.log(`OG image saved to ${outPath} (${buffer.length} bytes)`);
