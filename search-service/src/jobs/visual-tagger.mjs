/**
 * Visual Product Tagger Job
 *
 * Sends each product's image to Claude Haiku for AI-powered visual analysis.
 * Returns structured comma-separated tags describing what the AI actually sees:
 * furniture type, silhouette, arm/back/cushion/leg style, material, color, etc.
 *
 * Features:
 *   - Batch processing with configurable rate limits (default 10/batch, 6s delay)
 *   - Progress persistence to disk for resume capability
 *   - Visual tag validation (filters logos, placeholders, non-product images)
 *   - Category mismatch detection between AI tags and existing product category
 *   - Graceful stop, retry with backoff, and detailed progress tracking
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Constants ───────────────────────────────────────────────

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_DELAY_MS = 6000;
const DEFAULT_MAX_PRODUCTS = Infinity;
const MAX_RETRIES = 3;
const COST_PER_IMAGE = 0.0015;

const PROGRESS_PATH = path.resolve(__dirname, "../../data/visual-tagger-progress.json");

const NOT_PRODUCT_MARKERS = [
  "logo", "placeholder", "room scene", "not furniture",
  "multiple items", "website", "screenshot",
];

const INVALID_IMAGE_PATTERNS = [
  (url) => url.toLowerCase().includes("logo"),
  (url) => url.toLowerCase().endsWith(".svg"),
  (url) => url.length < 15,
];

// ── State ───────────────────────────────────────────────────

let running = false;
let stopRequested = false;

let progress = {
  total: 0,
  processed: 0,
  tagged: 0,
  skipped: 0,
  errors: 0,
  estimated_cost: 0,
  started_at: null,
  finished_at: null,
  running: false,
  last_product_id: null,
};

// ── Helpers ─────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_PATH)) {
      const data = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
      if (data && typeof data === "object") {
        progress = { ...progress, ...data, running: false };
      }
    }
  } catch {
    // Ignore corrupt progress file
  }
}

function saveProgress() {
  try {
    const dir = path.dirname(PROGRESS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress, null, 2));
  } catch {
    // Non-critical — log and continue
  }
}

/**
 * Check whether an image URL is worth sending to the API.
 */
function isValidImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  if (!url.startsWith("http")) return false;
  for (const check of INVALID_IMAGE_PATTERNS) {
    if (check(url)) return false;
  }
  return true;
}

/**
 * Compute a priority score for processing order.
 * Lower score = processed first (thinnest records benefit most).
 */
function priorityScore(product) {
  let score = 0;
  if (product.description && product.description.length > 20) score += 3;
  if (product.material) score += 2;
  if (product.style) score += 1;
  return score;
}

/**
 * Check if the AI response indicates a non-product image.
 */
function isNotProduct(text) {
  const lower = text.toLowerCase();
  return NOT_PRODUCT_MARKERS.some((marker) => lower.includes(marker));
}

/**
 * Normalize a tag string for comparison (lowercase, trim, strip articles).
 */
function normalizeTag(tag) {
  return (tag || "")
    .toLowerCase()
    .replace(/^(a|an|the)\s+/i, "")
    .trim();
}

/**
 * Check if the AI's first tag (furniture type) roughly matches the product's category.
 */
function checkCategoryMismatch(aiFirstTag, productCategory) {
  if (!productCategory || !aiFirstTag) return false;
  const aiNorm = normalizeTag(aiFirstTag);
  const catNorm = normalizeTag(productCategory);
  // Simple containment check — if either contains the other, it's a match
  if (catNorm.includes(aiNorm) || aiNorm.includes(catNorm)) return false;
  return true;
}

// ── Core API Call ───────────────────────────────────────────

/**
 * Send a product image to Claude Haiku for visual tagging.
 * Returns the raw text response or null on failure.
 */
async function tagImage(imageUrl, apiKey) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 300,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "url", url: imageUrl } },
              {
                type: "text",
                text: `You are a furniture industry expert examining a product photo. Describe exactly what you see in precise trade terminology. Return comma-separated tags covering ALL of these:

FURNITURE TYPE: exact type (sofa, accent chair, swivel chair, dining chair, dining table, cocktail table, console table, bed, nightstand, dresser, credenza, bookcase, ottoman, bench, bar stool, desk, chandelier, floor lamp, table lamp, mirror, rug)

SILHOUETTE: specific shape name if recognizable (chesterfield, lawson, english roll arm, track arm, tuxedo, camelback, wingback, barrel, shelter arm, parsons, pedestal, trestle, four poster, panel bed, sleigh bed, platform)

CONSTRUCTION DETAILS: what you can see (tufted, button tufted, channel back, biscuit tufted, nailhead trim, welt, skirted, tight back, loose cushion, bench seat, T-cushion, turned legs, tapered legs, cabriole legs, saber legs, hairpin legs, metal base, wood base, pedestal base, X base)

CUSHION CONFIG: if visible (single cushion, two cushion, three cushion, 2 over 2, 3 over 3, bench seat, tight seat)

MATERIALS: what it appears to be made of (leather, velvet, boucle, linen, performance fabric, chenille, wood, oak, walnut, mahogany, marble, stone, travertine, glass, metal, brass, iron, chrome, rattan, wicker, cane)

COLORS: specific colors visible (ivory, cream, white, beige, tan, camel, cognac, brown, espresso, charcoal, gray, slate, navy, blue, green, sage, emerald, burgundy, rust, blush, gold, black)

STYLE: design aesthetic (traditional, contemporary, modern, mid-century modern, transitional, coastal, glam, minimalist, industrial, rustic, farmhouse, bohemian)

SIZE IMPRESSION: (petite, small, medium, large, oversized, grand scale)

Return ONLY the comma-separated tags. Be specific. Skip anything you cannot determine from the image.`,
              },
            ],
          }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Rate limited — respect retry-after header
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") || 30);
        console.log(`[visual-tagger] Rate limited, waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        // Image fetch error (the API couldn't load the image)
        if (response.status === 400 && errText.includes("Could not")) {
          return { error: "broken_image" };
        }
        if (attempt < MAX_RETRIES - 1) {
          await sleep(2000 * (attempt + 1));
          continue;
        }
        return null;
      }

      const result = await response.json();
      const text = result.content?.[0]?.text?.trim();
      if (!text) return null;

      return { text };
    } catch (err) {
      if (attempt < MAX_RETRIES - 1) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      return null;
    }
  }
  return null;
}

// ── Main Job ────────────────────────────────────────────────

/**
 * Run the visual tagger across catalog products.
 *
 * @param {object} catalogDB - Catalog DB interface (getAllProducts, updateProductDirect, getProductsByVendor)
 * @param {object} options
 * @param {string[]} [options.vendors]       - Only process these vendor IDs
 * @param {number}   [options.batchSize=10]  - Products per batch
 * @param {number}   [options.delayMs=6000]  - Delay between batches (ms)
 * @param {number}   [options.maxProducts]   - Max products to process
 * @param {boolean}  [options.dryRun=false]  - Log what would happen without API calls
 * @param {boolean}  [options.skipTagged=true] - Skip products that already have ai_visual_tags
 */
export async function runVisualTagger(catalogDB, options = {}) {
  if (running) {
    console.log("[visual-tagger] Already running, skipping");
    return progress;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[visual-tagger] ANTHROPIC_API_KEY not set");
    return progress;
  }

  const {
    vendors,
    batchSize = DEFAULT_BATCH_SIZE,
    delayMs = DEFAULT_DELAY_MS,
    maxProducts = DEFAULT_MAX_PRODUCTS,
    dryRun = false,
    skipTagged = true,
  } = options;

  running = true;
  stopRequested = false;

  // Load any previous progress for resume
  loadProgress();

  progress.started_at = new Date().toISOString();
  progress.finished_at = null;
  progress.running = true;
  progress.processed = 0;
  progress.tagged = 0;
  progress.skipped = 0;
  progress.errors = 0;
  progress.estimated_cost = 0;

  // ── Gather products to process ────────────────────────────

  let allProducts;
  if (vendors && vendors.length > 0) {
    // Fetch products for specific vendors
    const vendorProducts = [];
    for (const vendorId of vendors) {
      const vp = catalogDB.getProductsByVendor(vendorId, 100000);
      if (vp) vendorProducts.push(...(Array.isArray(vp) ? vp : [...vp]));
    }
    allProducts = vendorProducts;
  } else {
    allProducts = [...catalogDB.getAllProducts()];
  }

  // Filter to processable products
  const toProcess = allProducts.filter((p) => {
    // Must have a valid image URL
    if (!isValidImageUrl(p.image_url)) return false;
    // Skip already tagged (unless overridden)
    if (skipTagged && p.ai_visual_tags && p.ai_visual_tags.length > 0) return false;
    return true;
  });

  // Sort: thinnest records first (no description > no material > no style > has all)
  toProcess.sort((a, b) => priorityScore(a) - priorityScore(b));

  // Cap at maxProducts
  const candidates = toProcess.slice(0, maxProducts);
  progress.total = candidates.length;

  console.log(
    `[visual-tagger] Starting: ${candidates.length} products to process` +
    (vendors ? ` (vendors: ${vendors.join(", ")})` : "") +
    (dryRun ? " [DRY RUN]" : "")
  );

  saveProgress();

  // ── Process in batches ────────────────────────────────────

  for (let i = 0; i < candidates.length; i += batchSize) {
    if (stopRequested) {
      console.log("[visual-tagger] Stop requested, halting");
      break;
    }

    const batch = candidates.slice(i, i + batchSize);

    if (dryRun) {
      for (const product of batch) {
        console.log(`[visual-tagger] [dry-run] Would tag: ${product.product_name} (${product.image_url})`);
        progress.processed++;
        progress.skipped++;
      }
    } else {
      // Process entire batch in parallel
      const results = await Promise.all(
        batch.map(async (product) => {
          try {
            const result = await tagImage(product.image_url, apiKey);
            return { product, result };
          } catch (err) {
            return { product, result: null };
          }
        })
      );

      for (const { product, result } of results) {
        if (stopRequested) break;

        progress.processed++;
        progress.last_product_id = product.id;

        if (!result) {
          progress.errors++;
          continue;
        }

        if (result.error === "broken_image") {
          catalogDB.updateProductDirect(product.id, { image_quality: "broken" });
          progress.skipped++;
          continue;
        }

        const text = result.text;

        if (isNotProduct(text)) {
          catalogDB.updateProductDirect(product.id, { image_quality: "not-product" });
          progress.skipped++;
          continue;
        }

        const tags = text.trim();
        const updates = { ai_visual_tags: tags };

        const tagParts = tags.split(",").map((t) => t.trim()).filter(Boolean);
        const aiFirstTag = tagParts[0] || "";

        if (product.category && checkCategoryMismatch(aiFirstTag, product.category)) {
          updates.ai_category_mismatch = true;
          updates.ai_suggested_category = aiFirstTag;
        }

        catalogDB.updateProductDirect(product.id, updates);
        progress.tagged++;
        progress.estimated_cost += COST_PER_IMAGE;
      }

      if (progress.processed % 500 < batchSize || progress.processed === progress.total) {
        const elapsed = (Date.now() - new Date(progress.started_at).getTime()) / 1000;
        const rate = progress.processed / (elapsed / 60);
        const remaining = progress.total - progress.processed;
        const etaMin = remaining / rate;
        console.log(
          `[visual-tagger] Progress: ${progress.processed}/${progress.total} | ` +
          `Tagged: ${progress.tagged} | Skipped: ${progress.skipped} | Errors: ${progress.errors} | ` +
          `Cost: $${progress.estimated_cost.toFixed(2)} | Rate: ${rate.toFixed(0)}/min | ETA: ${etaMin.toFixed(0)}min`
        );
      }
    }

    // Save progress after each batch
    saveProgress();

    // Rate-limit delay between batches (skip after last batch)
    if (i + batchSize < candidates.length && !stopRequested) {
      await sleep(delayMs);
    }
  }

  // ── Finalize ──────────────────────────────────────────────

  progress.finished_at = new Date().toISOString();
  progress.running = false;
  running = false;
  saveProgress();

  console.log(
    `[visual-tagger] Complete. Tagged: ${progress.tagged}, Skipped: ${progress.skipped}, ` +
    `Errors: ${progress.errors}, Cost: $${progress.estimated_cost.toFixed(2)}`
  );

  return progress;
}

/**
 * Get current visual tagger progress.
 */
export function getVisualTaggerStatus() {
  // Load from disk if not running (for resume info)
  if (!running) loadProgress();
  return { ...progress };
}

/**
 * Gracefully stop the visual tagger job.
 */
export function stopVisualTagger() {
  if (!running) {
    console.log("[visual-tagger] Not running");
    return;
  }
  stopRequested = true;
  console.log("[visual-tagger] Stop requested, will halt after current product");
}
