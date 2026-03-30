#!/usr/bin/env node
/**
 * Creative Trade-Intelligence Retagger — Adds 12 creative fields to already-tagged products
 *
 * Text-only (no images) — uses existing AI tags + product text to extract:
 *   weight_class, assembly_complexity, cleanability, pet_friendliness,
 *   kid_friendliness, space_efficiency, stackable_nestable, light_reflectivity,
 *   pattern_type, sustainability_signals, designer_silhouette_match, sourcing_difficulty
 *
 * Runs AFTER the advanced retagger. Only processes products that have ai_advanced_tagged
 * but lack the creative fields.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'catalog.db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PROGRESS_PATH = path.join(DATA_DIR, 'creative-retagger-progress.json');
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const envPath = path.resolve(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/ANTHROPIC_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('ERROR: No ANTHROPIC_API_KEY in .env'); process.exit(1); }
const API_KEY = apiKeyMatch[1].trim();

const CONCURRENCY = 15;
const SAVE_EVERY = 50;

let completedCount = 0;
let totalCost = 0;
let failureCount = 0;
const failures = [];
let stopFlag = false;

const args = process.argv.slice(2);
const TEST_MODE = args.includes('--test');
const TEST_LIMIT = TEST_MODE ? 100 : Infinity;

const CREATIVE_PROMPT = `You are an expert furniture trade consultant with deep knowledge of interior design, commercial specification, and residential furnishing. You analyze furniture products to provide practical intelligence that helps designers make buying decisions.

Given a furniture product's name, description, existing AI analysis, and specifications, extract ONLY the fields below. Be practical and precise — think like a designer evaluating products for real client projects.

Return ONLY a JSON object:

{
  "weight_class": "ultralight (<15 lbs)" | "light (15-40 lbs)" | "medium (40-80 lbs)" | "heavy (80-150 lbs)" | "very heavy (150+ lbs)" — estimate based on size, material density, and construction. A solid wood dining table is heavy. An acrylic side table is light. A marble-top console is very heavy. A rattan chair is light.,

  "assembly_complexity": "no assembly" | "minimal (attach legs)" | "moderate (multiple components)" | "complex (built-in/wall mount)" — most upholstered seating = no assembly. Tables with detachable legs = minimal. Modular systems = moderate. Built-ins = complex.,

  "cleanability": "wipeable" | "spot clean" | "professional clean only" | "machine washable covers" | null — leather/vinyl/lacquer/glass/metal = wipeable. Performance fabric = wipeable. Velvet/silk/boucle = spot clean or professional. Slipcovers = machine washable. Unfinished wood = spot clean.,

  "pet_friendliness": "pet friendly" | "somewhat pet friendly" | "not pet friendly" — performance fabric/leather/metal/outdoor material = pet friendly. Tight weave fabric/distressed leather = somewhat. Velvet/silk/boucle/delicate materials/light colors = not pet friendly.,

  "kid_friendliness": "kid friendly" | "somewhat kid friendly" | "adults only" — wipeable surfaces, rounded edges, durable materials = kid friendly. Glass tops, sharp edges, delicate materials, light colors = adults only.,

  "space_efficiency": "space saving" | "standard footprint" | "statement piece" | "room anchor" — consider the product's scale tag. Petite/small items or multipurpose pieces = space saving. Large sectionals/king beds = room anchor. Oversized accent chairs, dramatic lighting = statement piece.,

  "stackable_nestable": "stackable" | "nestable" | "foldable" | "modular" | "none" — dining chairs can be stackable. Side tables/nesting tables = nestable. Sectionals with configurable pieces = modular. Most pieces = none.,

  "light_reflectivity": "matte" | "satin" | "semi-gloss" | "high gloss" | "mirror" | "mixed" — based on primary surface material and finish. Linen/matte fabric = matte. Satin wood/brushed metal = satin. Lacquer = high gloss. Glass/polished chrome = mirror. Wood body + metal legs = mixed.,

  "pattern_type": "solid" | "striped" | "geometric" | "floral" | "abstract" | "animal print" | "plaid" | "textured solid" | "two-tone" | null — based on upholstery/surface pattern. Most trade pieces are solid or textured solid. Boucle/herringbone/chenille = textured solid. Two different colors clearly visible = two-tone.,

  "sustainability_signals": "reclaimed materials" | "FSC wood" | "natural fibers" | "recyclable metal" | "handcrafted" | null — ONLY if clearly indicated by material (reclaimed wood, rattan, jute, sisal, bamboo = natural fibers; wrought iron/steel = recyclable metal; described as handcrafted/artisan). Most products = null.,

  "designer_silhouette_match": "like a Milo Baughman" | "like a Vladimir Kagan" | "like a Charles Eames" | "like a Florence Knoll" | "like a Jean Prouve" | "like a Gio Ponti" | "like a Hans Wegner" | "like a Pierre Jeanneret" | "like a Le Corbusier" | "like a Eileen Gray" | "like a Marcel Breuer" | "like a Isamu Noguchi" | "like a George Nelson" | "like a Finn Juhl" | "like a Arne Jacobsen" | null — ONLY if the design CLEARLY references an iconic designer's visual language. A barrel swivel chair in chrome = like a Milo Baughman. A sculptural curved sofa = like a Vladimir Kagan. A molded plywood chair = like a Charles Eames. Most products = null.,

  "sourcing_difficulty": "readily available" | "made to order" | "limited edition" | "artisan/one of a kind" — standard production furniture from major vendors = readily available. Custom upholstery/finish options = made to order. Artisan/handmade pieces with complex construction = artisan. Most trade furniture = readily available or made to order.
}

RULES:
1. Be PRACTICAL. A designer reading these tags should instantly know: Can I use this for a family with kids and dogs? How heavy is it to install? Will it show every mark?
2. weight_class: Use common sense — a stone coffee table is heavy, a rattan side table is light, a 10' sectional is very heavy.
3. pet_friendliness and kid_friendliness: Think about REAL durability. Crypton/Sunbrella/performance fabric = pet and kid friendly. White velvet = neither.
4. designer_silhouette_match: Only populate if there's a CLEAR visual reference. Don't force a match.
5. pattern_type: Most trade furniture is "solid" or "textured solid". Only use specific patterns if clearly described.
6. If uncertain, return null. Precision > recall.`;

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

function buildProductContext(product) {
  const va = product.ai_visual_analysis || {};
  const parts = [];
  parts.push(`Product: "${product.product_name || 'Unknown'}" by ${product.vendor_name || product.vendor_id || 'Unknown'}`);
  if (product.sku) parts.push(`SKU: ${product.sku}`);
  if (product.description) parts.push(`Description: ${(product.description || '').substring(0, 600)}`);
  if (product.category) parts.push(`Category: ${product.category}`);

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
  if (va.color_primary) aiFields.push(`Color: ${va.color_primary}`);
  if (va.scale) aiFields.push(`Scale: ${va.scale}`);
  if (va.formality) aiFields.push(`Formality: ${va.formality}`);
  if (va.style) aiFields.push(`Style: ${va.style}`);
  if (va.durability_assessment) aiFields.push(`Durability: ${va.durability_assessment}`);
  if (va.texture_description) aiFields.push(`Texture: ${va.texture_description}`);
  if (Array.isArray(va.distinctive_features) && va.distinctive_features.length > 0) {
    aiFields.push(`Features: ${va.distinctive_features.join(', ')}`);
  }

  if (aiFields.length > 0) parts.push(`\nExisting AI Analysis:\n${aiFields.join('\n')}`);
  if (product.material && product.material !== va.upholstery_material) {
    parts.push(`Raw material: ${product.material}`);
  }
  if (product.dimensions) parts.push(`Dimensions: ${product.dimensions}`);
  if (product.wholesale_price) parts.push(`Wholesale: $${product.wholesale_price}`);

  return parts.join('\n');
}

async function extractCreativeTags(product) {
  const context = buildProductContext(product);

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: [{ type: "text", text: CREATIVE_PROMPT, cache_control: { type: "ephemeral" } }],
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
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  const tags = JSON.parse(jsonMatch[0]);

  return { tags, cost };
}

function applyCreativeTags(product, tags) {
  const va = product.ai_visual_analysis || {};

  // Store in ai_visual_analysis
  if (tags.weight_class != null) va.weight_class = tags.weight_class;
  if (tags.assembly_complexity != null) va.assembly_complexity = tags.assembly_complexity;
  if (tags.cleanability != null) va.cleanability = tags.cleanability;
  if (tags.pet_friendliness != null) va.pet_friendliness = tags.pet_friendliness;
  if (tags.kid_friendliness != null) va.kid_friendliness = tags.kid_friendliness;
  if (tags.space_efficiency != null) va.space_efficiency = tags.space_efficiency;
  if (tags.stackable_nestable != null) va.stackable_nestable = tags.stackable_nestable;
  if (tags.light_reflectivity != null) va.light_reflectivity = tags.light_reflectivity;
  if (tags.pattern_type != null) va.pattern_type = tags.pattern_type;
  if (tags.sustainability_signals != null) va.sustainability_signals = tags.sustainability_signals;
  if (tags.designer_silhouette_match != null) va.designer_silhouette_match = tags.designer_silhouette_match;
  if (tags.sourcing_difficulty != null) va.sourcing_difficulty = tags.sourcing_difficulty;

  product.ai_visual_analysis = va;

  // Top-level convenience fields
  product.ai_weight_class = tags.weight_class || null;
  product.ai_assembly_complexity = tags.assembly_complexity || null;
  product.ai_cleanability = tags.cleanability || null;
  product.ai_pet_friendly = tags.pet_friendliness || null;
  product.ai_kid_friendly = tags.kid_friendliness || null;
  product.ai_space_efficiency = tags.space_efficiency || null;
  product.ai_stackable = tags.stackable_nestable || null;
  product.ai_light_reflectivity = tags.light_reflectivity || null;
  product.ai_pattern_type = tags.pattern_type || null;
  product.ai_sustainability = tags.sustainability_signals || null;
  product.ai_designer_match = tags.designer_silhouette_match || null;
  product.ai_sourcing_difficulty = tags.sourcing_difficulty || null;

  product.ai_creative_tagged = true;
  product.ai_creative_tagged_at = new Date().toISOString();
}

async function worker(workerId, chunk, data, taggedIds, totalItems) {
  let workerTagged = 0;
  let workerFailed = 0;
  let retryDelay = 0;

  for (const idx of chunk) {
    if (stopFlag) break;

    const product = data.products[idx];
    const label = `${product.product_name || '?'}`.substring(0, 45);

    try {
      const { tags, cost } = await extractCreativeTags(product);
      applyCreativeTags(product, tags);

      completedCount++;
      totalCost += cost;
      taggedIds.push(product.id);
      workerTagged++;

      if (retryDelay > 0) retryDelay = 0;

      const populated = Object.values(tags).filter(v => v != null && v !== 'none' && v !== 'null').length;
      if (completedCount <= 20 || completedCount % 200 === 0) {
        console.log(`W${workerId} [${completedCount}/${totalItems}] ${label} — $${cost.toFixed(4)} | ${populated}/12 fields`);
      }

    } catch (err) {
      const msg = err.message || String(err);
      completedCount++;
      failureCount++;
      workerFailed++;
      failures.push({ id: product.id, name: label, vendor: product.vendor_id, error: msg.substring(0, 200), at: new Date().toISOString() });

      if (completedCount <= 50 || completedCount % 200 === 0) {
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

    await sleep(100);
  }

  return { workerTagged, workerFailed };
}

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('CREATIVE TRADE-INTELLIGENCE RETAGGER — 12 new fields');
  console.log('='.repeat(60));
  console.log('');

  if (TEST_MODE) console.log(`[MODE] TEST — processing first ${TEST_LIMIT} products only\n`);

  console.log('[LOAD] Reading catalog...');
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`[LOAD] ${data.products.length} products loaded`);

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `catalog.backup-creative-${new Date().toISOString().replace(/:/g, '-')}.json`);
  console.log(`[BACKUP] Saving to ${path.basename(backupPath)}...`);
  fs.writeFileSync(backupPath, JSON.stringify(data));

  const vendorSnapshot = getVendorCounts(data);

  // Build work queue: has ai_furniture_type, not yet creative-tagged
  const toTagIndices = [];
  let rugCount = 0;
  let noType = 0;
  let alreadyCreative = 0;

  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i];
    if (isRug(p)) { rugCount++; continue; }
    if (!p.ai_furniture_type) { noType++; continue; }
    if (p.ai_creative_tagged) { alreadyCreative++; continue; }
    toTagIndices.push(i);
  }

  const progress = loadProgress();
  const alreadyDone = new Set(progress.tagged_ids);
  const queue = toTagIndices.filter(idx => !alreadyDone.has(data.products[idx].id));
  const finalQueue = queue.slice(0, TEST_LIMIT);

  totalCost = progress.total_cost;
  failureCount = progress.failures.length;

  console.log('');
  console.log(`[FILTER] Rugs skipped: ${rugCount}`);
  console.log(`[FILTER] No ai_furniture_type: ${noType}`);
  console.log(`[FILTER] Already creative-tagged: ${alreadyCreative}`);
  console.log(`[FILTER] To process: ${toTagIndices.length}`);
  console.log(`[FILTER] Resumed (skip): ${toTagIndices.length - queue.length}`);
  console.log(`[FILTER] Remaining: ${finalQueue.length}`);
  console.log(`[CONFIG] Workers: ${CONCURRENCY}`);
  console.log(`[CONFIG] Estimated cost: ~$${(finalQueue.length * 0.002).toFixed(2)} (text-only)`);
  console.log(`[CONFIG] Estimated time: ${fmt(finalQueue.length * 1000 / CONCURRENCY)}`);
  console.log('');

  if (finalQueue.length === 0) {
    console.log('[DONE] Nothing to process.');
    return;
  }

  if (!progress.started_at) progress.started_at = new Date().toISOString();
  const startTime = Date.now();
  const taggedIds = progress.tagged_ids;

  const chunkSize = Math.ceil(finalQueue.length / CONCURRENCY);
  const chunks = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const chunk = finalQueue.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunk.length > 0) chunks.push(chunk);
  }

  console.log(`[START] Launching ${chunks.length} workers...`);

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

  const workerResults = await Promise.all(chunks.map((chunk, i) => worker(i + 1, chunk, data, taggedIds, finalQueue.length)));
  clearInterval(monitor);

  console.log('\n[FINAL SAVE] Writing catalog...');
  progress.tagged_ids = taggedIds;
  progress.failures = failures;
  progress.total_cost = totalCost;
  data.saved_at = new Date().toISOString();
  fs.writeFileSync(DB_PATH, JSON.stringify(data));
  saveProgressFile(progress);

  const finalData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  const finalCounts = getVendorCounts(finalData);
  if (!vendorCountsMatch(finalCounts, vendorSnapshot)) {
    console.error('!!! VENDOR COUNTS MISMATCH !!!');
  } else {
    console.log('[VERIFY] All vendor counts match.');
  }

  const elapsed = Date.now() - startTime;
  const FIELDS = ['weight_class', 'assembly_complexity', 'cleanability', 'pet_friendliness',
    'kid_friendliness', 'space_efficiency', 'stackable_nestable', 'light_reflectivity',
    'pattern_type', 'sustainability_signals', 'designer_silhouette_match', 'sourcing_difficulty'];
  const fieldCounts = {};
  for (const f of FIELDS) fieldCounts[f] = 0;
  let totalCreative = 0;

  for (const p of finalData.products) {
    if (!p.ai_creative_tagged) continue;
    totalCreative++;
    const va = p.ai_visual_analysis || {};
    for (const f of FIELDS) {
      if (va[f] != null && va[f] !== 'null' && va[f] !== 'none') fieldCounts[f]++;
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('CREATIVE TAGGING COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Products tagged: ${totalCreative}`);
  console.log(`Cost: $${totalCost.toFixed(2)}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Time: ${fmt(elapsed)}`);
  console.log(`Rate: ${(completedCount / (elapsed / 60000)).toFixed(1)} products/min`);
  console.log('');
  console.log('Field population:');
  for (const [f, c] of Object.entries(fieldCounts).sort((a, b) => b[1] - a[1])) {
    const pct = totalCreative > 0 ? (c / totalCreative * 100).toFixed(1) : '0';
    console.log(`  ${f}: ${c}/${totalCreative} (${pct}%)`);
  }

  if (failures.length > 0) {
    console.log('');
    console.log(`Failed products (last 10 of ${failures.length}):`);
    for (const f of failures.slice(-10)) {
      console.log(`  ${f.name} (${f.vendor}): ${f.error.substring(0, 80)}`);
    }
  }

  if (!TEST_MODE) {
    console.log('');
    console.log('[GIT] Committing...');
    try {
      execSync('git add search-service/data/catalog.db.json', { cwd: PROJECT_ROOT, stdio: 'pipe' });
      const msg = `Creative trade-intel tags — ${totalCreative} products, 12 new fields`;
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
