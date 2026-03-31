#!/usr/bin/env node
/**
 * Advanced Re-Tagger — Adds 17 new structured fields to already-tagged products
 *
 * This script does NOT re-analyze images. It uses existing AI tags + product text
 * to extract structured fields via Haiku. Much cheaper than full visual analysis
 * since it's text-only (no image tokens).
 *
 * New fields added (all ADDITIVE — existing tags preserved):
 *   cushion_configuration, back_cushion_count, seat_cushion_count,
 *   seat_depth_category, seat_height_category, tufting_pattern, skirt_style,
 *   has_nailhead, nailhead_finish, edge_profile, wood_species_visible,
 *   hardware_visible, base_type, joinery_visible, adjustable, indoor_outdoor,
 *   COM_eligible
 *
 * Safeguards:
 *   - Full backup before starting
 *   - Only processes products with existing ai_visual_analysis
 *   - Skips rugs
 *   - Never overwrites existing ai_* fields
 *   - Progress saved every 50 products for resume capability
 *   - Vendor count verification
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'catalog.db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PROGRESS_PATH = path.join(DATA_DIR, 'advanced-retagger-progress.json');
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Load API key
const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('ERROR: No ANTHROPIC_API_KEY in .env'); process.exit(1); }
const API_KEY = apiKeyMatch[1].trim();

const CONCURRENCY = 15;
const SAVE_EVERY = 50;

// ── Shared state ──
let completedCount = 0;
let totalCost = 0;
let failureCount = 0;
const failures = [];
let stopFlag = false;

// ── CLI args ──
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TEST_MODE = args.includes('--test');
const TEST_LIMIT = TEST_MODE ? 100 : Infinity;
const SKIP_UNTAGGED = !args.includes('--include-untagged');

// ── Prompt ──
const ADVANCED_TAG_PROMPT = `You are extracting structured trade-specification tags from furniture product data. You will receive the product name, description, vendor, existing AI tags, and existing AI visual analysis.

Your job: extract ONLY the fields below from the provided data. Be extremely precise — only populate a field if there is CLEAR EVIDENCE in the data. If uncertain, return null. Never guess or hallucinate.

Return ONLY a JSON object with these fields:

{
  "cushion_configuration": "3 over 3" | "2 over 2" | "2 over 3" | "3 over 2" | "bench seat" | "single cushion" | "tight seat" | null,
  "back_cushion_count": integer or null — only if explicitly stated or clearly implied (e.g. "3 over 3" = 3 back cushions),
  "seat_cushion_count": integer or null — only if explicitly stated or clearly implied (e.g. "3 over 3" = 3 seat cushions),

  "seat_depth_category": "deep seat" | "standard" | "shallow" | null — ONLY populate if the product name/description EXPLICITLY says "deep seat", "deep seating", "extra deep", or lists a seat depth measurement > 22". Do NOT guess from cushion appearance or product type. Most products = null.,
  "seat_height_category": "low profile" | "standard" | "counter height" | "bar height" | null,

  "tufting_pattern": "diamond tufted" | "biscuit tufted" | "channel tufted" | "button tufted" | "blind tufted" | "none" | null,
  "skirt_style": "skirted" | "tailored skirt" | "bullion fringe" | "kick pleat skirt" | "waterfall skirt" | "none" | null,
  "has_nailhead": true | false | null,
  "nailhead_finish": "brass" | "pewter" | "antique brass" | "nickel" | "silver" | "bronze" | null — ONLY if has_nailhead is true,
  "edge_profile": "waterfall" | "knife edge" | "boxed" | "bullnose" | "rolled" | "T-cushion" | null — refers to cushion edge or table edge profile,

  "wood_species_visible": "walnut" | "oak" | "mahogany" | "maple" | "ash" | "pine" | "cherry" | "birch" | "teak" | "cedar" | "elm" | null — only if wood species is explicitly named,
  "hardware_visible": "brass pulls" | "nickel knobs" | "iron handles" | "leather wrapped handles" | "crystal knobs" | "ring pulls" | "none" | null,

  "base_type": "pedestal" | "trestle" | "X-base" | "hairpin" | "sled" | "cantilever" | "four leg" | "turned pedestal" | "double pedestal" | "waterfall" | "plinth" | null,
  "joinery_visible": "exposed joinery" | "mortise and tenon" | "dovetail" | "finger joint" | null — ONLY if explicitly mentioned in description,

  "adjustable": "reclining" | "power reclining" | "swivel" | "height adjustable" | "power headrest" | "glider" | "rocker" | "none" | null,
  "indoor_outdoor": "indoor" | "outdoor" | "indoor/outdoor" | null — "outdoor" if name/description contains outdoor/patio/exterior/garden/all-weather,

  "COM_eligible": true | false | null — ONLY true if description explicitly mentions "COM", "Customer's Own Material", "available in your fabric", "COM yardage", or similar. Never assume.
}

CRITICAL RULES:
1. COM_eligible — only true if EXPLICITLY mentioned. Most products don't state this.
2. joinery_visible — only populate if description EXPLICITLY mentions a joinery technique.
3. back_cushion_count and seat_cushion_count — only populate if a number is EXPLICITLY stated or clearly implied by "X over X" language, "three seat cushions", etc.
4. indoor_outdoor — "outdoor" ONLY if product name/description explicitly contains outdoor/patio/garden/all-weather/exterior. Everything else is "indoor" unless unclear (then null).
5. has_nailhead — check both secondary_materials and distinctive_features for "nailhead" mentions.
6. tufting_pattern — check back style, distinctive_features, and description for specific tufting type.
7. If a field is not clearly determinable from the data, return null. Precision > recall.`;

// ── Helpers ──

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
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

// ── Build product context for Haiku (text-only, no images) ──

function buildProductContext(product) {
  const va = product.ai_visual_analysis || {};
  const parts = [];
  parts.push(`Product: "${product.product_name || 'Unknown'}" by ${product.vendor_name || product.vendor_id || 'Unknown'}`);
  if (product.sku) parts.push(`SKU: ${product.sku}`);
  if (product.description) parts.push(`Description: ${(product.description || '').substring(0, 800)}`);
  if (product.category) parts.push(`Category: ${product.category}`);

  // Include existing AI tags as context
  const aiFields = [];
  if (va.furniture_type) aiFields.push(`Type: ${va.furniture_type}`);
  if (va.silhouette) aiFields.push(`Silhouette: ${va.silhouette}`);
  if (va.arms) aiFields.push(`Arms: ${va.arms}`);
  if (va.back) aiFields.push(`Back: ${va.back}`);
  if (va.legs_base) aiFields.push(`Legs/Base: ${va.legs_base}`);
  if (va.cushions) aiFields.push(`Cushions: ${va.cushions}`);
  if (va.upholstery_material) aiFields.push(`Material: ${va.upholstery_material}`);
  if (va.secondary_materials) aiFields.push(`Secondary materials: ${va.secondary_materials}`);
  if (va.finish) aiFields.push(`Finish: ${va.finish}`);
  if (va.construction_details) aiFields.push(`Construction: ${va.construction_details}`);
  if (va.texture_description) aiFields.push(`Texture: ${va.texture_description}`);
  if (Array.isArray(va.distinctive_features) && va.distinctive_features.length > 0) {
    aiFields.push(`Features: ${va.distinctive_features.join(', ')}`);
  }
  if (va.scale) aiFields.push(`Scale: ${va.scale}`);
  if (va.formality) aiFields.push(`Formality: ${va.formality}`);
  if (va.style) aiFields.push(`Style: ${va.style}`);
  if (Array.isArray(va.room_suitability) && va.room_suitability.length > 0) {
    aiFields.push(`Rooms: ${va.room_suitability.join(', ')}`);
  }

  if (aiFields.length > 0) {
    parts.push(`\nExisting AI Analysis:\n${aiFields.join('\n')}`);
  }

  // Include raw material/style if different from AI tags
  if (product.material && product.material !== va.upholstery_material) {
    parts.push(`Raw material field: ${product.material}`);
  }
  if (product.dimensions) parts.push(`Dimensions: ${product.dimensions}`);

  return parts.join('\n');
}

// ── API call ──

async function extractAdvancedTags(product) {
  const context = buildProductContext(product);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: [{ type: "text", text: ADVANCED_TAG_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: 'user', content: context }]
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
  // Try to find JSON object in response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  const tags = JSON.parse(jsonMatch[0]);

  return { tags, cost };
}

// ── Apply tags to product (additive only) ──

function applyAdvancedTags(product, tags) {
  // Store in ai_visual_analysis for consistency
  const va = product.ai_visual_analysis || {};

  // Add new fields to ai_visual_analysis
  if (tags.cushion_configuration != null) va.cushion_configuration = tags.cushion_configuration;
  if (tags.back_cushion_count != null) va.back_cushion_count = tags.back_cushion_count;
  if (tags.seat_cushion_count != null) va.seat_cushion_count = tags.seat_cushion_count;
  if (tags.seat_depth_category != null) va.seat_depth_category = tags.seat_depth_category;
  if (tags.seat_height_category != null) va.seat_height_category = tags.seat_height_category;
  if (tags.tufting_pattern != null) va.tufting_pattern = tags.tufting_pattern;
  if (tags.skirt_style != null) va.skirt_style = tags.skirt_style;
  if (tags.has_nailhead != null) va.has_nailhead = tags.has_nailhead;
  if (tags.nailhead_finish != null) va.nailhead_finish = tags.nailhead_finish;
  if (tags.edge_profile != null) va.edge_profile = tags.edge_profile;
  if (tags.wood_species_visible != null) va.wood_species_visible = tags.wood_species_visible;
  if (tags.hardware_visible != null) va.hardware_visible = tags.hardware_visible;
  if (tags.base_type != null) va.base_type = tags.base_type;
  if (tags.joinery_visible != null) va.joinery_visible = tags.joinery_visible;
  if (tags.adjustable != null) va.adjustable = tags.adjustable;
  if (tags.indoor_outdoor != null) va.indoor_outdoor = tags.indoor_outdoor;
  if (tags.COM_eligible != null) va.COM_eligible = tags.COM_eligible;

  product.ai_visual_analysis = va;

  // Also set top-level convenience fields for search pipeline
  product.ai_cushion_config = tags.cushion_configuration || null;
  product.ai_back_cushion_count = tags.back_cushion_count ?? null;
  product.ai_seat_cushion_count = tags.seat_cushion_count ?? null;
  product.ai_tufting_pattern = tags.tufting_pattern || null;
  product.ai_has_nailhead = tags.has_nailhead ?? null;
  product.ai_edge_profile = tags.edge_profile || null;
  product.ai_base_type = tags.base_type || null;
  product.ai_indoor_outdoor = tags.indoor_outdoor || null;
  product.ai_COM_eligible = tags.COM_eligible ?? null;
  product.ai_skirt_style = tags.skirt_style || null;
  product.ai_seat_depth = tags.seat_depth_category || null;
  product.ai_wood_species = tags.wood_species_visible || null;
  product.ai_adjustable = tags.adjustable || null;

  // Mark as advanced-tagged
  product.ai_advanced_tagged = true;
  product.ai_advanced_tagged_at = new Date().toISOString();
}

// ── Worker ──

async function worker(workerId, chunk, data, taggedIds, totalItems) {
  let workerTagged = 0;
  let workerFailed = 0;
  let retryDelay = 0;

  for (const idx of chunk) {
    if (stopFlag) break;

    const product = data.products[idx];
    const label = `${product.product_name || '?'}`.substring(0, 45);

    try {
      const { tags, cost } = await extractAdvancedTags(product);
      applyAdvancedTags(product, tags);

      completedCount++;
      totalCost += cost;
      taggedIds.push(product.id);
      workerTagged++;

      if (retryDelay > 0) retryDelay = 0;

      // Compact log
      const populated = Object.values(tags).filter(v => v != null && v !== false && v !== 'none').length;
      if (completedCount <= 20 || completedCount % 100 === 0) {
        console.log(`W${workerId} [${completedCount}/${totalItems}] ${label} — $${cost.toFixed(4)} | ${populated}/17 fields`);
      }

    } catch (err) {
      const msg = err.message || String(err);
      completedCount++;
      failureCount++;
      workerFailed++;
      failures.push({ id: product.id, name: label, vendor: product.vendor_id, error: msg.substring(0, 200), at: new Date().toISOString() });

      if (completedCount <= 50 || completedCount % 100 === 0) {
        console.log(`W${workerId} [${completedCount}/${totalItems}] ${label} — FAIL: ${msg.substring(0, 80)}`);
      }

      if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('overloaded')) {
        retryDelay = Math.min((retryDelay || 5000) * 2, 60000);
        console.log(`W${workerId} [BACKOFF] Waiting ${retryDelay / 1000}s...`);
        await sleep(retryDelay);
      }
      if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
        await sleep(5000);
      }
    }

    // Small delay between requests per worker
    await sleep(100);
  }

  return { workerTagged, workerFailed };
}

// ── Main ──

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('ADVANCED RE-TAGGER — Adding 17 structured fields');
  console.log('='.repeat(60));
  console.log('');

  if (DRY_RUN) console.log('[MODE] DRY RUN — no API calls, no writes');
  if (TEST_MODE) console.log(`[MODE] TEST — processing first ${TEST_LIMIT} products only`);
  console.log('');

  // Load catalog
  console.log('[LOAD] Reading catalog...');
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`[LOAD] ${data.products.length} products loaded`);

  // Backup
  if (!DRY_RUN) {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const backupPath = path.join(BACKUP_DIR, `catalog.backup-${new Date().toISOString().replace(/:/g, '-')}.json`);
    console.log(`[BACKUP] Saving to ${path.basename(backupPath)}...`);
    fs.writeFileSync(backupPath, JSON.stringify(data));
  }

  const vendorSnapshot = getVendorCounts(data);

  // Build work queue
  const toTagIndices = [];
  let rugCount = 0;
  let noVaCount = 0;
  let alreadyAdvanced = 0;

  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i];
    if (isRug(p)) { rugCount++; continue; }
    if (!p.ai_furniture_type) { noVaCount++; continue; }
    if (p.ai_advanced_tagged && !TEST_MODE) { alreadyAdvanced++; continue; }
    toTagIndices.push(i);
  }

  // Resume support
  const progress = loadProgress();
  const alreadyDone = new Set(progress.tagged_ids);
  const queue = toTagIndices.filter(idx => !alreadyDone.has(data.products[idx].id));

  // Apply test limit
  const finalQueue = queue.slice(0, TEST_LIMIT);

  totalCost = progress.total_cost;
  failureCount = progress.failures.length;

  console.log('');
  console.log(`[FILTER] Rugs skipped: ${rugCount}`);
  console.log(`[FILTER] No ai_furniture_type: ${noVaCount}`);
  console.log(`[FILTER] Already advanced-tagged: ${alreadyAdvanced}`);
  console.log(`[FILTER] To process: ${toTagIndices.length}`);
  console.log(`[FILTER] Resumed (skip): ${toTagIndices.length - queue.length}`);
  console.log(`[FILTER] Remaining: ${finalQueue.length}`);
  console.log(`[CONFIG] Workers: ${CONCURRENCY}`);
  console.log(`[CONFIG] Estimated cost: ~$${(finalQueue.length * 0.002).toFixed(2)} (text-only, no images)`);
  console.log(`[CONFIG] Estimated time: ${fmt(finalQueue.length * 1000 / CONCURRENCY)}`);
  console.log('');

  if (finalQueue.length === 0) {
    console.log('[DONE] Nothing to process.');
    return;
  }

  if (DRY_RUN) {
    console.log('[DRY RUN] Would process these products:');
    for (let i = 0; i < Math.min(10, finalQueue.length); i++) {
      const p = data.products[finalQueue[i]];
      console.log(`  ${p.product_name} (${p.vendor_name}) — ${p.ai_furniture_type}`);
    }
    console.log(`  ... and ${Math.max(0, finalQueue.length - 10)} more`);
    return;
  }

  if (!progress.started_at) progress.started_at = new Date().toISOString();
  const startTime = Date.now();
  const taggedIds = progress.tagged_ids;

  // Split into worker chunks
  const chunkSize = Math.ceil(finalQueue.length / CONCURRENCY);
  const chunks = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const chunk = finalQueue.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunk.length > 0) chunks.push(chunk);
  }

  console.log(`[START] Launching ${chunks.length} workers...`);

  // Periodic save
  let lastSaveCount = 0;
  const monitor = setInterval(() => {
    if (completedCount - lastSaveCount >= SAVE_EVERY) {
      lastSaveCount = completedCount;
      const elapsed = Date.now() - startTime;
      const rate = (completedCount / (elapsed / 60000)).toFixed(1);

      progress.tagged_ids = taggedIds;
      progress.failures = failures;
      progress.total_cost = totalCost;

      try {
        data.saved_at = new Date().toISOString();
        fs.writeFileSync(DB_PATH, JSON.stringify(data));
        saveProgressFile(progress);
        console.log(`\n[SAVE] ${completedCount}/${finalQueue.length} | $${totalCost.toFixed(2)} | ${rate}/min | ${fmt(elapsed)} elapsed\n`);
      } catch (e) {
        console.error('[SAVE ERROR]', e.message);
      }
    }
  }, 3000);

  // Run workers
  const workerResults = await Promise.all(chunks.map((chunk, i) => worker(i + 1, chunk, data, taggedIds, finalQueue.length)));
  clearInterval(monitor);

  // Final save
  console.log('\n[FINAL SAVE] Writing catalog...');
  progress.tagged_ids = taggedIds;
  progress.failures = failures;
  progress.total_cost = totalCost;
  data.saved_at = new Date().toISOString();
  fs.writeFileSync(DB_PATH, JSON.stringify(data));
  saveProgressFile(progress);

  // Verify vendor counts
  const finalData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const finalCounts = getVendorCounts(finalData);
  if (!vendorCountsMatch(finalCounts, vendorSnapshot)) {
    console.error('!!! VENDOR COUNTS MISMATCH !!!');
  } else {
    console.log('[VERIFY] All vendor counts match.');
  }

  // Stats
  const elapsed = Date.now() - startTime;
  const fieldCounts = {};
  const FIELDS = ['cushion_configuration', 'back_cushion_count', 'seat_cushion_count',
    'seat_depth_category', 'seat_height_category', 'tufting_pattern', 'skirt_style',
    'has_nailhead', 'nailhead_finish', 'edge_profile', 'wood_species_visible',
    'hardware_visible', 'base_type', 'joinery_visible', 'adjustable', 'indoor_outdoor', 'COM_eligible'];
  for (const f of FIELDS) fieldCounts[f] = 0;

  let totalAdvanced = 0;
  for (const p of finalData.products) {
    if (!p.ai_advanced_tagged) continue;
    totalAdvanced++;
    const va = p.ai_visual_analysis || {};
    for (const f of FIELDS) {
      if (va[f] != null && va[f] !== false && va[f] !== 'none' && va[f] !== 'unable to determine') {
        fieldCounts[f]++;
      }
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('ADVANCED TAGGING COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Products tagged: ${totalAdvanced}`);
  console.log(`Cost: $${totalCost.toFixed(2)}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Time: ${fmt(elapsed)}`);
  console.log(`Rate: ${(completedCount / (elapsed / 60000)).toFixed(1)} products/min`);
  console.log('');
  console.log('Field population counts:');
  for (const [f, c] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    const pct = totalAdvanced > 0 ? (c / totalAdvanced * 100).toFixed(1) : '0';
    console.log(`  ${f}: ${c}/${totalAdvanced} (${pct}%)`);
  }

  if (failures.length > 0) {
    console.log('');
    console.log(`Failed products (last 10 of ${failures.length}):`);
    for (const f of failures.slice(-10)) {
      console.log(`  ${f.name} (${f.vendor}): ${f.error.substring(0, 80)}`);
    }
  }

  // Git commit if not test mode
  if (!TEST_MODE) {
    console.log('');
    console.log('[GIT] Committing...');
    try {
      execSync('git add search-service/data/catalog.db.json', { cwd: PROJECT_ROOT, stdio: 'pipe' });
      const msg = `Advanced tags added — ${totalAdvanced} products, 17 new fields`;
      execSync(`git commit -m "${msg}\n\nCost: $${totalCost.toFixed(2)} | Time: ${fmt(elapsed)} | Failures: ${failureCount}"`, { cwd: PROJECT_ROOT, stdio: 'pipe' });
      execSync('git push', { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 120000 });
      console.log('[GIT] Pushed.');
    } catch (gitErr) {
      console.error('[GIT] Error:', gitErr.stderr?.toString().substring(0, 200) || gitErr.message);
    }
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
