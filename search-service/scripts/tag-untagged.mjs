#!/usr/bin/env node
/**
 * Tag Untagged Products — Full visual analysis + advanced tags in ONE pass
 *
 * Targets the ~4,600 non-rug products that were missed in the original tagging round.
 * Uses image analysis (Haiku 4.5) to generate ALL fields at once:
 *   - Base visual analysis (25 fields from original tagger)
 *   - Advanced structured tags (17 fields)
 *   - NEW creative trade-intelligence fields (12 extra fields)
 *
 * Total: 54 structured fields per product in a single API call.
 *
 * Safeguards:
 *   - Full backup before starting
 *   - Skips rugs and already-tagged products
 *   - Vendor count verification
 *   - Progress resume capability
 *   - Auto commit + push on completion
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'catalog.db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PROGRESS_PATH = path.join(DATA_DIR, 'untagged-tagger-progress.json');
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
const TEST_MODE = args.includes('--test');
const TEST_LIMIT = TEST_MODE ? 50 : Infinity;

// ── The mega prompt — base analysis + advanced tags + creative trade fields in ONE shot ──
const MEGA_PROMPT = `You are the most experienced furniture expert in the trade industry with 40 years of experience. You have worked with every major manufacturer, specified thousands of pieces, and can identify construction details, materials, and design lineage from a single photograph.

Analyze this furniture product with extreme precision. Return ONLY a JSON object with ALL of these fields:

=== CORE IDENTIFICATION ===
{
  "furniture_type": "the specific type — be precise: sofa, loveseat, sectional, accent chair, club chair, swivel chair, recliner, power recliner, chaise, ottoman, bench, dining chair, bar stool, counter stool, dining table, cocktail table, coffee table, side table, end table, console table, desk, writing desk, executive desk, bookcase, etagere, credenza, buffet, sideboard, server, dresser, chest, nightstand, bed, headboard, daybed, mirror, floor lamp, table lamp, chandelier, pendant, sconce, media console, entertainment center, vanity, armoire, hutch, wine cabinet, bar cabinet, accent table, nesting tables, plant stand, room divider, coat rack, umbrella stand, magazine rack, blanket ladder, fireplace screen",

  "silhouette": "the overall shape — barrel, camelback, Chesterfield, Lawson, English roll arm, track arm, tuxedo, slope arm, flared arm, wingback, channel back, pillow back, tight back, shelter, slipper, parsons, klismos, Louis XVI, bergere, fauteuil, ladder back, Windsor, X-base, pedestal, trestle, waterfall, campaign, Bridgewater, mid-century, shelter arm, serpentine, bombe, demilune, breakfront, bow front",

  "arms": "arm style if applicable — rolled, track, flared, slope, English, sock, scroll, pad, saddle, shelter, no arms/armless, pillow arm, key arm, recessed, panel arm, pleated arm",
  "back": "back style — tight, loose pillow, attached pillow, tufted, button tufted, diamond tufted, channel tufted, biscuit tufted, camelback, straight, curved, winged, cane, ladder, spindle, slatted, scoop, waterfall, rail back, open back",
  "legs_base": "leg or base description — turned, tapered, cabriole, splayed, hairpin, sled, pedestal, trestle, X-base, waterfall, block, bun, caster, metal, wood, hidden/skirted, lucite, brass ferrule, fluted, reeded, square, round, sawhorse, A-frame, plinth, floating",

  "cushions": "cushion description if applicable — single bench seat, two seat cushions, three seat cushions, T-cushion, box cushion, knife edge, waterfall edge, tight seat, loose seat, spring down, foam, down wrapped",

  "upholstery_material": "primary surface — leather, top grain leather, full grain leather, distressed leather, velvet, crushed velvet, boucle, linen, performance fabric, cotton, silk, chenille, tweed, herringbone, mohair, muslin, crypton, sunbrella. If case goods: solid wood, veneer, lacquer, painted, marble, granite, quartzite, travertine, glass, mirror, metal, rattan, wicker, cane, bamboo, shagreen, bone inlay, raffia, grasscloth, concrete, resin, acrylic, terrazzo",
  "secondary_materials": "any additional materials visible",
  "color_primary": "dominant color — be specific: ivory, cream, snow white, oatmeal, sand, camel, cognac, saddle brown, espresso, charcoal, slate gray, dove gray, fog, navy, midnight blue, indigo, sapphire, forest green, sage, olive, emerald, blush, dusty rose, terracotta, rust, burgundy, plum, mustard, gold, brass, bronze, matte black, natural wood, whitewashed, cerused",
  "color_secondary": "any secondary colors",
  "finish": "wood or metal finish — natural, cerused, whitewashed, ebonized, distressed, weathered, reclaimed, driftwood, honey, amber, walnut, espresso, black, painted, lacquered, matte, satin, polished, antique brass, brushed nickel, oil rubbed bronze, champagne gold, matte black, polished chrome, oxidized iron, patina",

  "style": "design style — traditional, transitional, contemporary, modern, mid century modern, Hollywood regency, art deco, coastal, bohemian, rustic, industrial, farmhouse, French country, English traditional, Chinoiserie, campaign, minimalist, organic modern, Japandi, Scandinavian, glam, luxury modern, quiet luxury, resort, casual contemporary, Memphis, postmodern, brutalist, wabi-sabi",
  "era_influence": "design era influence — Georgian, Victorian, Edwardian, Arts and Crafts, Art Nouveau, Art Deco, Mid Century 1950s, Mid Century 1960s, Hollywood Regency 1930s, Campaign, Biedermeier, Louis XV, Louis XVI, Chippendale, Hepplewhite, Sheraton, Regency, or contemporary original",
  "formality": "formal, semi-formal, casual, relaxed",
  "scale": "petite, small, medium, large, oversized, grand",
  "visual_weight": "light and airy, medium, substantial, heavy and grounded",
  "texture_description": "visible texture",
  "construction_details": "visible construction details",
  "distinctive_features": ["list ALL notable features"],
  "room_suitability": ["list all suitable rooms"],
  "mood": "feeling this piece evokes",
  "ideal_client": "type of project/client this is perfect for",
  "pairs_well_with": "3-4 specific complementary piece types",
  "durability_assessment": "high traffic suitable, moderate use, light use only, decorative",
  "search_terms": ["25-35 terms a designer would use to find this piece"],

=== ADVANCED STRUCTURAL TAGS ===
  "cushion_configuration": "3 over 3" | "2 over 2" | "2 over 3" | "3 over 2" | "bench seat" | "single cushion" | "tight seat" | null,
  "back_cushion_count": integer or null,
  "seat_cushion_count": integer or null,
  "seat_depth_category": "deep seat" | "standard" | "shallow" | null,
  "seat_height_category": "low profile" | "standard" | "counter height" | "bar height" | null,
  "tufting_pattern": "diamond tufted" | "biscuit tufted" | "channel tufted" | "button tufted" | "blind tufted" | "none" | null,
  "skirt_style": "skirted" | "tailored skirt" | "bullion fringe" | "kick pleat skirt" | "waterfall skirt" | "none" | null,
  "has_nailhead": true | false,
  "nailhead_finish": "brass" | "pewter" | "antique brass" | "nickel" | "silver" | "bronze" | null,
  "edge_profile": "waterfall" | "knife edge" | "boxed" | "bullnose" | "rolled" | "T-cushion" | "beveled" | "live edge" | "eased" | null,
  "wood_species_visible": "walnut" | "oak" | "mahogany" | "maple" | "ash" | "pine" | "cherry" | "birch" | "teak" | "cedar" | "elm" | "acacia" | "mango" | null,
  "hardware_visible": "brass pulls" | "nickel knobs" | "iron handles" | "leather wrapped handles" | "crystal knobs" | "ring pulls" | "concealed" | "none" | null,
  "base_type": "pedestal" | "trestle" | "X-base" | "hairpin" | "sled" | "cantilever" | "four leg" | "turned pedestal" | "double pedestal" | "waterfall" | "plinth" | "floating" | "wall mounted" | null,
  "joinery_visible": "exposed joinery" | "mortise and tenon" | "dovetail" | "finger joint" | "dowel" | null,
  "adjustable": "reclining" | "power reclining" | "swivel" | "height adjustable" | "power headrest" | "glider" | "rocker" | "tilt" | "none" | null,
  "indoor_outdoor": "indoor" | "outdoor" | "indoor/outdoor",
  "COM_eligible": true | false | null,

=== CREATIVE TRADE-INTELLIGENCE TAGS ===
  "weight_class": "ultralight (<15 lbs)" | "light (15-40 lbs)" | "medium (40-80 lbs)" | "heavy (80-150 lbs)" | "very heavy (150+ lbs)" — estimate based on size, material, construction,
  "assembly_complexity": "no assembly" | "minimal (attach legs)" | "moderate (multiple components)" | "complex (built-in/wall mount)" — estimate based on visible construction,
  "cleanability": "wipeable" | "spot clean" | "professional clean only" | "machine washable covers" | null — based on material,
  "pet_friendliness": "pet friendly" | "somewhat pet friendly" | "not pet friendly" — based on material durability and texture,
  "kid_friendliness": "kid friendly" | "somewhat kid friendly" | "adults only" — based on material, edges, fragility,
  "space_efficiency": "space saving" | "standard footprint" | "statement piece" | "room anchor" — how much space it demands,
  "stackable_nestable": "stackable" | "nestable" | "foldable" | "modular" | "none",
  "light_reflectivity": "matte" | "satin" | "semi-gloss" | "high gloss" | "mirror" | "mixed" — overall surface light behavior,
  "pattern_type": "solid" | "striped" | "geometric" | "floral" | "abstract" | "animal print" | "plaid" | "textured solid" | "two-tone" | null,
  "sustainability_signals": "reclaimed materials" | "FSC wood" | "natural fibers" | "recyclable metal" | "handcrafted" | null — only if visible/obvious,
  "designer_silhouette_match": "like a Milo Baughman" | "like a Vladimir Kagan" | "like a Charles Eames" | "like a Florence Knoll" | "like a Jean Prouve" | "like a Gio Ponti" | "like a Hans Wegner" | "like a Pierre Jeanneret" | "like a Le Corbusier" | "like a Eileen Gray" | null — if the design clearly references an iconic designer's language,
  "sourcing_difficulty": "readily available" | "made to order" | "limited edition" | "artisan/one of a kind" — estimate based on construction complexity and materials
}

Be extremely precise. If you cannot clearly identify something from the images, say null for that field. Every field you DO fill should be accurate enough that a 40-year veteran designer would agree.`;

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

// ── API call with image analysis ──

async function analyzeProduct(product) {
  const content = [];

  // Add product image(s)
  if (product.image_url) {
    content.push({ type: "image", source: { type: "url", url: product.image_url } });
  }
  // Add second image if available for better analysis
  if (product.images && product.images.length > 0) {
    const secondImg = product.images.find(img => {
      const url = typeof img === 'string' ? img : (img && img.url ? img.url : '');
      return url && url !== product.image_url;
    });
    if (secondImg) {
      const url = typeof secondImg === 'string' ? secondImg : secondImg.url;
      content.push({ type: "image", source: { type: "url", url } });
    }
  }

  // Text context
  const textParts = [];
  textParts.push(`Product: "${product.product_name || 'Unknown'}" by ${product.vendor_name || product.vendor_id}`);
  if (product.sku) textParts.push(`SKU: ${product.sku}`);
  if (product.description) textParts.push(`Description: ${(product.description || '').substring(0, 1000)}`);
  if (product.category) textParts.push(`Category: ${product.category}`);
  if (product.material) textParts.push(`Material: ${product.material}`);
  if (product.dimensions) textParts.push(`Dimensions: ${product.dimensions}`);
  if (product.wholesale_price) textParts.push(`Wholesale: $${product.wholesale_price}`);
  if (product.retail_price) textParts.push(`Retail: $${product.retail_price}`);

  content.push({
    type: "text",
    text: textParts.join('\n') + '\n\nAnalyze the image(s) and return ONLY the JSON object with ALL fields.'
  });

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: [{ type: "text", text: MEGA_PROMPT, cache_control: { type: "ephemeral" } }],
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
  // Haiku pricing: $0.80/M input, $0.08/M cache read, $1.00/M cache create, $4.00/M output
  const cost = (inp * 0.80 + cached * 0.08 + cacheCreate * 1.00 + out * 4.0) / 1_000_000;

  let text = result.content?.[0]?.text || '';
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) text = m[1];
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');
  const analysis = JSON.parse(jsonMatch[0]);

  return { analysis, cost };
}

// ── Apply ALL tags to product ──

function applyFullAnalysis(product, analysis) {
  // Store the full analysis in ai_visual_analysis
  product.ai_visual_analysis = analysis;

  // === Base identification fields (from original tagger) ===
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

  // Build AI description
  const parts = [];
  if (analysis.furniture_type) parts.push(analysis.furniture_type);
  if (analysis.style) parts.push(`in ${analysis.style} style`);
  if (analysis.upholstery_material) parts.push(`with ${analysis.upholstery_material}`);
  if (analysis.color_primary) parts.push(`in ${analysis.color_primary}`);
  product.ai_description = parts.join(' ') || null;

  // AI visual tags string for search
  const tagParts = [];
  if (analysis.furniture_type) tagParts.push(analysis.furniture_type);
  if (analysis.silhouette) tagParts.push(analysis.silhouette);
  if (analysis.arms) tagParts.push(analysis.arms);
  if (analysis.back) tagParts.push(analysis.back);
  if (analysis.legs_base) tagParts.push(analysis.legs_base);
  if (analysis.upholstery_material) tagParts.push(analysis.upholstery_material);
  if (analysis.color_primary) tagParts.push(analysis.color_primary);
  if (analysis.style) tagParts.push(analysis.style);
  product.ai_visual_tags = tagParts.join(', ');

  // === Advanced structural tags ===
  product.ai_cushion_config = analysis.cushion_configuration || null;
  product.ai_back_cushion_count = analysis.back_cushion_count ?? null;
  product.ai_seat_cushion_count = analysis.seat_cushion_count ?? null;
  product.ai_tufting_pattern = analysis.tufting_pattern || null;
  product.ai_has_nailhead = analysis.has_nailhead ?? null;
  product.ai_nailhead_finish = analysis.nailhead_finish || null;
  product.ai_edge_profile = analysis.edge_profile || null;
  product.ai_base_type = analysis.base_type || null;
  product.ai_indoor_outdoor = analysis.indoor_outdoor || null;
  product.ai_COM_eligible = analysis.COM_eligible ?? null;
  product.ai_skirt_style = analysis.skirt_style || null;
  product.ai_seat_depth = analysis.seat_depth_category || null;
  product.ai_seat_height = analysis.seat_height_category || null;
  product.ai_wood_species = analysis.wood_species_visible || null;
  product.ai_adjustable = analysis.adjustable || null;

  // === Creative trade-intelligence tags ===
  product.ai_weight_class = analysis.weight_class || null;
  product.ai_assembly_complexity = analysis.assembly_complexity || null;
  product.ai_cleanability = analysis.cleanability || null;
  product.ai_pet_friendly = analysis.pet_friendliness || null;
  product.ai_kid_friendly = analysis.kid_friendliness || null;
  product.ai_space_efficiency = analysis.space_efficiency || null;
  product.ai_stackable = analysis.stackable_nestable || null;
  product.ai_light_reflectivity = analysis.light_reflectivity || null;
  product.ai_pattern_type = analysis.pattern_type || null;
  product.ai_sustainability = analysis.sustainability_signals || null;
  product.ai_designer_match = analysis.designer_silhouette_match || null;
  product.ai_sourcing_difficulty = analysis.sourcing_difficulty || null;

  // Mark as fully tagged with advanced
  product.ai_advanced_tagged = true;
  product.ai_advanced_tagged_at = new Date().toISOString();
  product.ai_tagged_at = new Date().toISOString();
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
      const { analysis, cost } = await analyzeProduct(product);
      applyFullAnalysis(product, analysis);

      completedCount++;
      totalCost += cost;
      taggedIds.push(product.id);
      workerTagged++;

      if (retryDelay > 0) retryDelay = 0;

      console.log(`W${workerId} [${completedCount}/${totalItems}] ${label} — $${cost.toFixed(4)} | ${analysis.furniture_type || '?'} | ${analysis.style || '?'}`);

    } catch (err) {
      const msg = err.message || String(err);
      completedCount++;
      failureCount++;
      workerFailed++;
      failures.push({ id: product.id, name: label, vendor: product.vendor_id, error: msg.substring(0, 200), at: new Date().toISOString() });

      console.log(`W${workerId} [${completedCount}/${totalItems}] ${label} — FAIL: ${msg.substring(0, 80)}`);

      if (msg.includes('429') || msg.includes('rate_limit') || msg.includes('overloaded')) {
        retryDelay = Math.min((retryDelay || 5000) * 2, 60000);
        console.log(`W${workerId} [BACKOFF] Waiting ${retryDelay / 1000}s...`);
        await sleep(retryDelay);
      }
      if (msg.includes('500') || msg.includes('502') || msg.includes('503')) {
        await sleep(5000);
      }
    }

    await sleep(200);
  }

  return { workerTagged, workerFailed };
}

// ── Main ──

async function main() {
  console.log('');
  console.log('='.repeat(60));
  console.log('TAG UNTAGGED PRODUCTS — Full visual + advanced + trade intel');
  console.log('='.repeat(60));
  console.log('');

  if (TEST_MODE) console.log(`[MODE] TEST — processing first ${TEST_LIMIT} products only\n`);

  // Load catalog
  console.log('[LOAD] Reading catalog...');
  const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  console.log(`[LOAD] ${data.products.length} products loaded`);

  // Backup
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `catalog.backup-untagged-${new Date().toISOString().replace(/:/g, '-')}.json`);
  console.log(`[BACKUP] Saving to ${path.basename(backupPath)}...`);
  fs.writeFileSync(backupPath, JSON.stringify(data));

  const vendorSnapshot = getVendorCounts(data);

  // Build work queue: untagged, non-rug, has image
  const toTagIndices = [];
  let rugCount = 0;
  let alreadyTagged = 0;
  let noImage = 0;

  for (let i = 0; i < data.products.length; i++) {
    const p = data.products[i];
    if (isRug(p)) { rugCount++; continue; }
    if (p.ai_furniture_type || p.ai_visual_analysis) { alreadyTagged++; continue; }
    if (!p.image_url) { noImage++; continue; }
    toTagIndices.push(i);
  }

  // Resume support
  const progress = loadProgress();
  const alreadyDone = new Set(progress.tagged_ids);
  const queue = toTagIndices.filter(idx => !alreadyDone.has(data.products[idx].id));
  const finalQueue = queue.slice(0, TEST_LIMIT);

  totalCost = progress.total_cost;
  failureCount = progress.failures.length;

  console.log('');
  console.log(`[FILTER] Rugs skipped: ${rugCount}`);
  console.log(`[FILTER] Already tagged (ai_furniture_type): ${alreadyTagged}`);
  console.log(`[FILTER] No image URL: ${noImage}`);
  console.log(`[FILTER] Untagged furniture to process: ${toTagIndices.length}`);
  console.log(`[FILTER] Resumed (skip): ${toTagIndices.length - queue.length}`);
  console.log(`[FILTER] Remaining: ${finalQueue.length}`);
  console.log(`[CONFIG] Workers: ${CONCURRENCY}`);
  console.log(`[CONFIG] Estimated cost: ~$${(finalQueue.length * 0.005).toFixed(2)} (image analysis)`);
  console.log(`[CONFIG] Estimated time: ${fmt(finalQueue.length * 6000 / CONCURRENCY)}`);

  // Show vendor breakdown of untagged
  const untaggedVendors = {};
  for (const idx of toTagIndices) {
    const v = data.products[idx].vendor_id || 'unknown';
    untaggedVendors[v] = (untaggedVendors[v] || 0) + 1;
  }
  console.log('\n[VENDORS] Untagged product breakdown:');
  for (const [v, c] of Object.entries(untaggedVendors).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v}: ${c}`);
  }
  console.log('');

  if (finalQueue.length === 0) {
    console.log('[DONE] Nothing to process.');
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
      const remaining = finalQueue.length - completedCount;
      const eta = fmt((remaining / (completedCount / elapsed)) * 1000 || 0);

      progress.tagged_ids = taggedIds;
      progress.failures = failures;
      progress.total_cost = totalCost;

      try {
        data.saved_at = new Date().toISOString();
        fs.writeFileSync(DB_PATH, JSON.stringify(data));
        saveProgressFile(progress);
        console.log(`\n[SAVE] ${completedCount}/${finalQueue.length} | $${totalCost.toFixed(2)} | ${rate}/min | ${fmt(elapsed)} elapsed | ETA ${eta}\n`);
      } catch (e) {
        console.error('[SAVE ERROR]', e.message);
      }

      // Vendor count check
      const currentCounts = getVendorCounts(data);
      if (!vendorCountsMatch(currentCounts, vendorSnapshot)) {
        console.error('\n!!! VENDOR COUNTS CHANGED — STOPPING !!!');
        stopFlag = true;
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
  let newlyTagged = 0;
  for (const p of finalData.products) {
    if (taggedIds.includes(p.id)) newlyTagged++;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('UNTAGGED PRODUCT TAGGING COMPLETE');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Products tagged: ${newlyTagged}`);
  console.log(`Cost: $${totalCost.toFixed(2)}`);
  console.log(`Failures: ${failureCount}`);
  console.log(`Time: ${fmt(elapsed)}`);
  console.log(`Rate: ${(completedCount / (elapsed / 60000)).toFixed(1)} products/min`);
  console.log(`Fields per product: 54 (base + advanced + trade intel)`);

  // Count total searchable products now
  let totalSearchable = 0;
  for (const p of finalData.products) {
    if (p.ai_furniture_type) totalSearchable++;
  }
  console.log(`\nTotal searchable products (with ai_furniture_type): ${totalSearchable}`);
  console.log(`Total catalog: ${finalData.products.length}`);

  if (failures.length > 0) {
    console.log('');
    console.log(`Failed products (last 20 of ${failures.length}):`);
    for (const f of failures.slice(-20)) {
      console.log(`  ${f.name} (${f.vendor}): ${f.error.substring(0, 80)}`);
    }
  }

  // Git commit if not test mode
  if (!TEST_MODE) {
    console.log('');
    console.log('[GIT] Committing...');
    try {
      execSync('git add search-service/data/catalog.db.json', { cwd: PROJECT_ROOT, stdio: 'pipe' });
      const msg = `Tag ${newlyTagged} previously-untagged products — full visual + advanced + trade intel`;
      execSync(`git commit -m "${msg}\n\nCost: $${totalCost.toFixed(2)} | Time: ${fmt(elapsed)} | Failures: ${failureCount}\nModel: claude-haiku-4-5 | Workers: ${CONCURRENCY} | Fields: 54 per product"`, { cwd: PROJECT_ROOT, stdio: 'pipe' });
      execSync('git push', { cwd: PROJECT_ROOT, stdio: 'pipe', timeout: 120000 });
      console.log('[GIT] Pushed.');
    } catch (gitErr) {
      console.error('[GIT] Error:', gitErr.stderr?.toString().substring(0, 200) || gitErr.message);
    }
  }

  console.log('\nDone.');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
