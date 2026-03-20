#!/usr/bin/env node
/**
 * AI Visual Tagger v3 — 5-worker concurrent pipeline
 *
 * Splits catalog into 5 chunks, each worker processes independently.
 * Combined throughput: ~5 completions/sec → full catalog in ~2 hours.
 *
 * Safeguards:
 * - Full backup before starting
 * - Vendor count snapshot verified every 500 products
 * - ONLY ADDS ai_* fields — never deletes products or overwrites existing fields
 * - Skips already tagged products (ai_visual_analysis populated)
 * - Skips ALL rugs (any vendor)
 * - Progress saved to disk every 50 completions
 * - Immediate stop if vendor counts change
 * - Auto commit + push on completion
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'catalog.db.json');
const BACKUP_PATH = path.join(DATA_DIR, 'catalog-backup-before-tagging.db.json');
const SNAPSHOT_PATH = path.join(DATA_DIR, 'vendor-counts-pre-tagging.json');
const PROGRESS_PATH = path.join(DATA_DIR, 'tagger-progress.json');

// Load API key
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('ERROR: No ANTHROPIC_API_KEY in .env'); process.exit(1); }
const API_KEY = apiKeyMatch[1].trim();

const CONCURRENCY = 20;
const SAVE_EVERY = 50;
const VENDOR_CHECK_EVERY = 500;

// ── Shared mutable state (single process, no real mutex needed) ──
let completedCount = 0;
let totalCost = 0;
let failureCount = 0;
const failures = [];
let stopFlag = false;

const FURNITURE_PROMPT = `You are the most experienced furniture expert in the trade industry with 40 years of experience. You have worked with every major manufacturer, specified thousands of pieces, and can identify construction details, materials, and design lineage from a single photograph.

You are looking at one or two photos of the same piece of furniture from different angles. Use ALL images to give the most accurate analysis possible. The second image may reveal arm details, back construction, leg design, or features not visible in the first image.

Analyze this furniture product with extreme precision. Return ONLY a JSON object, no other text:

{
  "furniture_type": "the specific type — be precise: sofa, loveseat, sectional, accent chair, swivel chair, recliner, power recliner, chaise, ottoman, bench, dining chair, bar stool, counter stool, dining table, cocktail table, side table, console table, desk, bookcase, etagere, credenza, buffet, sideboard, dresser, chest, nightstand, bed, headboard, mirror, floor lamp, table lamp, chandelier, pendant, sconce, area rug, runner rug, accent rug",

  "silhouette": "describe the overall shape precisely — barrel, camelback, Chesterfield, Lawson, English roll arm, track arm, tuxedo, slope arm, flared arm, wingback, channel back, pillow back, tight back, shelter, slipper, parsons, klismos, Louis XVI, bergere, fauteuil, ladder back, Windsor, X-base, pedestal, trestle, waterfall, campaign, Bridgewater, mid-century, shelter arm",

  "arms": "arm style if applicable — rolled, track, flared, slope, English, sock, scroll, pad, saddle, shelter, no arms/armless, pillow arm, key arm, recessed",

  "back": "back style if applicable — tight, loose pillow, attached pillow, tufted, button tufted, diamond tufted, channel tufted, biscuit tufted, camelback, straight, curved, winged, cane, ladder, spindle, slatted, scoop, waterfall",

  "legs_base": "leg or base description — turned, tapered, cabriole, splayed, hairpin, sled, pedestal, trestle, X-base, waterfall, block, bun, caster, metal, wood, hidden/skirted, lucite, brass ferrule, fluted, reeded, square, round",

  "cushions": "cushion description if applicable — single bench seat, two seat cushions, three seat cushions, T-cushion, box cushion, knife edge, waterfall edge, tight seat, loose seat, spring down, foam, down wrapped",

  "upholstery_material": "what the upholstery or primary surface appears to be — leather, top grain leather, full grain leather, distressed leather, velvet, crushed velvet, boucle, linen, performance fabric, cotton, silk, chenille, tweed, herringbone, mohair, muslin, crypton, sunbrella. If case goods: solid wood, veneer, lacquer, painted, marble, granite, quartzite, travertine, glass, mirror, metal, rattan, wicker, cane, bamboo, shagreen, bone inlay, raffia, grasscloth. If rug: wool, jute, sisal, silk, polypropylene, cotton, viscose, hand-knotted, hand-tufted, flat-weave, power-loomed",

  "secondary_materials": "any additional materials visible — nailhead trim, brass nailheads, silver nailheads, metal legs, wood frame showing, glass top, marble top, stone top, woven shelf, leather wrapped, metal accents, brass hardware, iron details, chrome details, nickel hardware, carved wood detail, inlay, fretwork, stretcher bar",

  "color_primary": "the dominant color — be specific: ivory, cream, snow white, oatmeal, sand, camel, cognac, saddle brown, espresso, charcoal, slate gray, dove gray, fog, navy, midnight blue, indigo, sapphire, forest green, sage, olive, emerald, blush, dusty rose, terracotta, rust, burgundy, plum, mustard, gold, brass, bronze, matte black, natural wood, whitewashed, cerused",

  "color_secondary": "any secondary colors visible on the piece",

  "finish": "if wood or metal — the specific finish: natural, cerused, whitewashed, ebonized, distressed, weathered, reclaimed, driftwood, honey, amber, walnut, espresso, black, painted white, painted navy, lacquered, matte, satin, polished, antique brass, brushed nickel, oil rubbed bronze, champagne gold, matte black, polished chrome, oxidized iron",

  "style": "design style — traditional, transitional, contemporary, modern, mid century modern, Hollywood regency, art deco, coastal, bohemian, rustic, industrial, farmhouse, French country, English traditional, Chinoiserie, campaign, minimalist, organic modern, Japandi, Scandinavian, glam, luxury modern, quiet luxury, resort, casual contemporary",

  "era_influence": "what design era or movement it draws from — Georgian, Victorian, Edwardian, Arts and Crafts, Art Nouveau, Art Deco, Mid Century 1950s, Mid Century 1960s, Hollywood Regency 1930s, Campaign, Biedermeier, Louis XV, Louis XVI, Chippendale, Hepplewhite, Sheraton, Regency, or contemporary original if no specific era influence",

  "formality": "formal, semi-formal, casual, relaxed",

  "scale": "petite, small, medium, large, oversized, grand",

  "visual_weight": "light and airy, medium, substantial, heavy and grounded",

  "texture_description": "describe the visible texture — smooth, nubby, ribbed, tufted, quilted, woven, distressed, rough hewn, polished, matte, grainy, pebbled, hammered, brushed",

  "construction_details": "any visible construction details — eight way hand tied visible through tight back, spring down cushion appearance, sinuous spring visible, exposed joinery, dovetail visible, mortise and tenon, welted seams, double welting, contrast welt, French seam, decorative stitching, piping, blind tufting, hand tied button tufts",

  "distinctive_features": ["list EVERY notable feature you can see: nailhead trim, brass nailheads, tufting, button tufting, channel tufting, diamond tufting, skirted, slipcovered, welt cord, contrast welt, piping, fringe, tassel, carved details, turned spindles, stretcher bar, shelf, drawers, glass doors, adjustable shelves, soft close, USB ports, power recline, power headrest, swivel mechanism, glider mechanism, rocking mechanism, drop leaf, extension leaf, self-storing leaf, removable cushion covers, reversible cushions, arm caps, throw pillows included, kidney pillow, lumbar pillow, bolster"],

  "room_suitability": ["list all rooms: living room, family room, formal living, den, bedroom, master bedroom, guest bedroom, dining room, breakfast nook, kitchen, home office, study, library, foyer, entryway, hallway, mudroom, sunroom, covered porch, outdoor, commercial lobby, hotel room, restaurant, bar"],

  "mood": "what feeling does this piece evoke — cozy and inviting, sleek and sophisticated, warm and rustic, cool and minimal, opulent and dramatic, relaxed coastal, refined traditional, playful eclectic, serious and professional, quiet luxury, resort chic, collected vintage",

  "ideal_client": "what type of project or client this is perfect for — young professional first home, established family with kids, empty nesters downsizing, luxury penthouse, country estate, beach house, mountain retreat, boutique hotel, corporate office, law firm, medical office, restaurant, designer showhouse",

  "pairs_well_with": "describe 3-4 specific types of pieces that would complement this — be specific about style, material, and character",

  "durability_assessment": "based on what you see — high traffic suitable, moderate use, light use only, decorative. Note if performance fabric visible, if leather appears durable, if construction looks commercial grade",

  "search_terms": ["list 25-35 terms a designer might use to search for this exact piece — include formal terms, casual terms, slang, vibe words, feature words, problem-solving terms like 'kid friendly' or 'pet proof' or 'small space' if applicable"]
}

Be extremely precise. If you cannot clearly identify something from the images, say "unable to determine" for that field. Every field you DO fill should be accurate enough that a 40-year veteran designer would agree with your assessment.`;

// ────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function isRug(p) {
  const text = [p.category || '', p.product_name || '', p.category_group || ''].join(' ').toLowerCase();
  return text.includes('rug');
}

function getVendorCounts(data) {
  const c = {};
  for (const p of data.products) c[p.vendor_id] = (c[p.vendor_id] || 0) + 1;
  return c;
}

function vendorCountsMatch(a, b) {
  const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

function loadProgress() {
  if (fs.existsSync(PROGRESS_PATH)) return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8'));
  return { tagged_ids: [], failures: [], total_cost: 0, started_at: null };
}

function saveProgressFile(progress) {
  fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

// ────────────────────────────────────────────────────────
// API call
// ────────────────────────────────────────────────────────

async function analyzeProduct(product) {
  const content = [];
  content.push({ type: "image", source: { type: "url", url: product.image_url } });
  if (product.images && product.images.length > 1 && product.images[1].url) {
    content.push({ type: "image", source: { type: "url", url: product.images[1].url } });
  }
  content.push({
    type: "text",
    text: `Product: "${product.product_name || 'Unknown'}" by ${product.vendor_name || product.vendor_id}. SKU: ${product.sku || 'N/A'}. Analyze these images and return ONLY the JSON object.`
  });

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: [{ type: "text", text: FURNITURE_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: 'user', content }]
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API ${resp.status}: ${errText.substring(0, 200)}`);
  }

  const result = await resp.json();
  const inp = result.usage?.input_tokens || 0;
  const cached = result.usage?.cache_read_input_tokens || 0;
  const cacheCreate = result.usage?.cache_creation_input_tokens || 0;
  const out = result.usage?.output_tokens || 0;
  const cost = (inp * 0.80 + cached * 0.08 + cacheCreate * 1.00 + out * 4.0) / 1_000_000;

  let text = result.content?.[0]?.text || '';
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) text = m[1];
  const analysis = JSON.parse(text.trim());

  return { analysis, cost };
}

function applyAnalysis(product, analysis) {
  product.ai_visual_analysis = analysis;
  product.ai_furniture_type = analysis.furniture_type || null;
  product.ai_silhouette = analysis.silhouette || null;
  product.ai_arm_style = analysis.arms || null;
  product.ai_back_style = analysis.back || null;
  product.ai_leg_style = analysis.legs_base || null;
  product.ai_primary_material = analysis.upholstery_material || null;
  product.ai_primary_color = analysis.color_primary || null;
  product.ai_style = analysis.style || null;
  product.ai_formality = analysis.formality || null;
  product.ai_scale = analysis.scale || null;
  product.ai_mood = analysis.mood || null;
  product.ai_distinctive_features = analysis.distinctive_features || [];
  product.ai_search_terms = analysis.search_terms || [];
  const parts = [];
  if (analysis.furniture_type) parts.push(analysis.furniture_type);
  if (analysis.style) parts.push(`in ${analysis.style} style`);
  if (analysis.upholstery_material) parts.push(`with ${analysis.upholstery_material}`);
  if (analysis.color_primary) parts.push(`in ${analysis.color_primary}`);
  product.ai_description = parts.join(' ') || null;
}

// ────────────────────────────────────────────────────────
// Worker — processes a chunk sequentially, 1 req/sec
// ────────────────────────────────────────────────────────

async function worker(workerId, chunk, data, taggedIds, totalItems) {
  let workerTagged = 0;
  let workerFailed = 0;
  let retryDelay = 0;

  for (const idx of chunk) {
    if (stopFlag) break;

    const product = data.products[idx];

    // Double-check skip conditions (in case of race with resume)
    if (product.ai_visual_analysis) continue;

    const label = `${product.product_name || '?'}`.substring(0, 50);

    try {
      const { analysis, cost } = await analyzeProduct(product);
      applyAnalysis(product, analysis);

      // Update shared state
      completedCount++;
      totalCost += cost;
      taggedIds.push(product.id);
      workerTagged++;

      if (retryDelay > 0) retryDelay = 0; // Reset backoff on success

      console.log(`W${workerId} [${completedCount}/${totalItems}] ${label} — $${cost.toFixed(4)} | ${analysis.furniture_type || '?'}`);

    } catch (err) {
      const msg = err.message || String(err);
      completedCount++;
      failureCount++;
      workerFailed++;
      failures.push({ id: product.id, name: label, vendor: product.vendor_id, error: msg.substring(0, 200), at: new Date().toISOString() });

      console.log(`W${workerId} [${completedCount}/${totalItems}] ${label} — FAIL: ${msg.substring(0, 80)}`);

      // Rate limit backoff
      if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('overloaded')) {
        retryDelay = Math.min((retryDelay || 5000) * 2, 60000);
        console.log(`W${workerId} [BACKOFF] Waiting ${retryDelay / 1000}s...`);
        await sleep(retryDelay);
      }
      // Server errors
      if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
        await sleep(5000);
      }
    }

    // Short delay between requests per worker (API latency ~6s is the real throttle)
    await sleep(200);
  }

  return { workerTagged, workerFailed };
}

// ────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(60));
  console.log(`AI VISUAL TAGGER v3 — ${CONCURRENCY} concurrent workers`);
  console.log('='.repeat(60));
  console.log('');

  // ── Backup ──
  console.log('[BACKUP] Creating full database backup...');
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log(`[BACKUP] Saved (${(fs.statSync(BACKUP_PATH).size / 1024 / 1024).toFixed(1)} MB)`);

  // ── Load & snapshot ──
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const vendorSnapshot = getVendorCounts(data);
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(vendorSnapshot, null, 2));
  console.log('[SNAPSHOT] Vendor counts:');
  for (const [v, c] of Object.entries(vendorSnapshot).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v}: ${c}`);
  }
  console.log(`  TOTAL: ${data.products.length}`);
  console.log('');

  // ── Build work queue: skip rugs, no image, bad_image, already tagged ──
  const toTagIndices = [];
  let rugCount = 0;
  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i];
    if (isRug(p)) { rugCount++; continue; }
    if (!p.image_url) continue;
    if (p.bad_image) continue;
    if (p.ai_visual_analysis) continue;
    toTagIndices.push(i);
  }

  // Resume support
  const progress = loadProgress();
  const alreadyDone = new Set(progress.tagged_ids);
  const queue = toTagIndices.filter(idx => !alreadyDone.has(data.products[idx].id));

  // Re-apply already-tagged data from progress (products in memory may not have it)
  // They were already written to disk in previous saves, so just skip them

  totalCost = progress.total_cost;
  failureCount = progress.failures.length;
  const resumeCount = toTagIndices.length - queue.length;

  console.log(`[FILTER] Rugs skipped: ${rugCount}`);
  console.log(`[FILTER] Furniture to tag: ${toTagIndices.length}`);
  console.log(`[FILTER] Already tagged (resume): ${resumeCount}`);
  console.log(`[FILTER] Remaining: ${queue.length}`);
  console.log(`[CONFIG] Workers: ${CONCURRENCY}`);
  console.log(`[CONFIG] Rate: 1 req/sec/worker = ${CONCURRENCY} req/sec total`);
  console.log(`[CONFIG] Estimated time: ${fmt(queue.length * 1000 / CONCURRENCY + queue.length * 5000 / CONCURRENCY)}`);
  console.log(`[CONFIG] Estimated cost: ~$${(queue.length * 0.008).toFixed(0)}`);
  console.log('');

  if (!progress.started_at) progress.started_at = new Date().toISOString();
  const startTime = Date.now();
  const taggedIds = progress.tagged_ids;

  // ── Split queue into chunks for workers ──
  const chunkSize = Math.ceil(queue.length / CONCURRENCY);
  const chunks = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    chunks.push(queue.slice(i * chunkSize, (i + 1) * chunkSize));
  }

  console.log('Worker chunks:');
  for (let i = 0; i < chunks.length; i++) {
    console.log(`  Worker ${i + 1}: ${chunks[i].length} products`);
  }
  console.log('');

  // ── Periodic save & vendor check (runs alongside workers) ──
  let lastSaveCount = 0;
  let lastCheckCount = 0;

  const monitor = setInterval(() => {
    // Save progress
    if (completedCount - lastSaveCount >= SAVE_EVERY) {
      lastSaveCount = completedCount;
      const elapsed = Date.now() - startTime;
      const rate = (completedCount / (elapsed / 60000)).toFixed(1);
      const remaining = queue.length - completedCount;
      const eta = fmt((remaining / (completedCount / elapsed)) * 1000 || 0);

      progress.tagged_ids = taggedIds;
      progress.failures = failures;
      progress.total_cost = totalCost;

      try {
        data.saved_at = new Date().toISOString();
        fs.writeFileSync(DB_PATH, JSON.stringify(data));
        saveProgressFile(progress);
        console.log(`\n[SAVE] ${completedCount}/${queue.length} | $${totalCost.toFixed(2)} | ${rate}/min | ${fmt(elapsed)} elapsed | ETA ${eta}\n`);
      } catch (e) {
        console.error('[SAVE ERROR]', e.message);
      }
    }

    // Vendor count check
    if (completedCount - lastCheckCount >= VENDOR_CHECK_EVERY) {
      lastCheckCount = completedCount;
      const currentCounts = getVendorCounts(data);
      if (!vendorCountsMatch(currentCounts, vendorSnapshot)) {
        console.error('\n!!! CRITICAL: VENDOR COUNTS CHANGED — STOPPING ALL WORKERS !!!');
        stopFlag = true;
        fs.copyFileSync(BACKUP_PATH, DB_PATH);
        clearInterval(monitor);
        process.exit(1);
      }
      console.log(`[CHECK] ${completedCount}/${queue.length} tagged | All ${Object.keys(vendorSnapshot).length} vendors intact | Cost: $${totalCost.toFixed(2)}`);
    }
  }, 3000); // Check every 3 seconds

  // ── Launch workers ──
  console.log(`[START] Launching ${CONCURRENCY} workers...`);
  console.log('');

  const workerPromises = chunks.map((chunk, i) => worker(i + 1, chunk, data, taggedIds, queue.length));
  const workerResults = await Promise.all(workerPromises);

  clearInterval(monitor);

  // ── Final save ──
  console.log('');
  console.log('[FINAL SAVE] Writing catalog...');
  progress.tagged_ids = taggedIds;
  progress.failures = failures;
  progress.total_cost = totalCost;
  data.saved_at = new Date().toISOString();
  fs.writeFileSync(DB_PATH, JSON.stringify(data));
  saveProgressFile(progress);

  // ── Verify ──
  console.log('[VERIFY] Checking vendor counts...');
  const finalData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const finalCounts = getVendorCounts(finalData);
  if (!vendorCountsMatch(finalCounts, vendorSnapshot)) {
    console.error('!!! VENDOR COUNTS MISMATCH — RESTORING BACKUP !!!');
    fs.copyFileSync(BACKUP_PATH, DB_PATH);
    process.exit(1);
  }
  console.log('[VERIFY] All vendor counts match.');

  // ── Stats ──
  const elapsed = Date.now() - startTime;
  const vendorTagged = {};
  let totalTagged = 0;
  for (const p of finalData.products) {
    if (p.ai_visual_analysis) {
      vendorTagged[p.vendor_id] = (vendorTagged[p.vendor_id] || 0) + 1;
      totalTagged++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('TAGGING COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log('Per vendor:');
  for (const [v, c] of Object.entries(vendorTagged).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v}: ${c}/${vendorSnapshot[v]} tagged`);
  }
  console.log('');
  console.log(`Total tagged: ${totalTagged}`);
  console.log(`Total cost: $${totalCost.toFixed(2)}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Catalog size: ${finalData.products.length} products (unchanged)`);
  console.log(`Elapsed: ${fmt(elapsed)}`);
  console.log(`Rate: ${(completedCount / (elapsed / 60000)).toFixed(1)} products/min`);
  console.log('');

  // Worker stats
  for (let i = 0; i < workerResults.length; i++) {
    const r = workerResults[i];
    console.log(`Worker ${i + 1}: ${r.workerTagged} tagged, ${r.workerFailed} failed`);
  }

  if (failures.length > 0) {
    console.log('');
    console.log(`Failed products (last 20 of ${failures.length}):`);
    for (const f of failures.slice(-20)) {
      console.log(`  ${f.name} (${f.vendor}): ${f.error.substring(0, 80)}`);
    }
  }

  // ── Git commit & push ──
  console.log('');
  console.log('[GIT] Committing and pushing...');
  try {
    execSync('git add search-service/data/catalog.db.json', { cwd: PROJECT_ROOT, stdio: 'pipe' });
    const msg = `AI visual analysis complete — ${totalTagged} furniture products tagged across ${Object.keys(vendorTagged).length} vendors`;
    execSync(`git commit -m "${msg}\n\nCost: $${totalCost.toFixed(2)} | Time: ${fmt(elapsed)} | Failures: ${failureCount}\nModel: claude-haiku-4-5 | Workers: ${CONCURRENCY}"`, { cwd: PROJECT_ROOT, stdio: 'pipe' });
    execSync('git push', { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 120000 });
    console.log('[GIT] Pushed successfully.');
  } catch (gitErr) {
    console.error('[GIT] Error:', gitErr.stderr?.toString().substring(0, 200) || gitErr.message);
    console.error('[GIT] Run manually: git add search-service/data/catalog.db.json && git commit -m "AI visual analysis" && git push');
  }

  console.log('');
  console.log('Done.');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
