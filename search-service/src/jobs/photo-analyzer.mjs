/**
 * AI Photo Analysis Job
 * Analyzes product images using Claude Haiku vision to generate descriptive tags.
 * These tags make search dramatically more accurate — the AI literally looks at the
 * product photo and describes what it sees (cushion count, arm style, leg style, etc.)
 */

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const BATCH_SIZE = 20;
const DELAY_BETWEEN_CALLS_MS = 200;
const MAX_RETRIES = 2;

let running = false;
let stopRequested = false;
let stats = {
  total_analyzed: 0,
  total_skipped: 0,
  total_errors: 0,
  current_vendor: null,
  current_progress: 0,
  current_total: 0,
  estimated_cost_usd: 0,
  last_run: null,
  running: false,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Analyze a single product image with Claude Haiku vision.
 * Returns comma-separated descriptive tags or null on failure.
 */
async function analyzeImage(imageUrl, productName, apiKey) {
  if (!imageUrl || !imageUrl.startsWith("http")) return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "url", url: imageUrl } },
                {
                  type: "text",
                  text: "Describe this furniture piece for search indexing. Return ONLY comma-separated tags. Include: exact furniture type, subcategory, silhouette shape, arm style if applicable, back style if applicable, cushion configuration if applicable, leg style, material appearance, color, finish, style period, size impression, and any notable design details. Example output: sofa, three over three, track arm, loose back cushions, tapered wood legs, performance fabric, light gray, contemporary, large scale, clean lines, low profile",
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") || 30);
        console.log(`[photo-analyzer] Rate limited, waiting ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        if (attempt < MAX_RETRIES) {
          await sleep(2000);
          continue;
        }
        return null;
      }

      const result = await response.json();
      const text = result.content?.[0]?.text?.trim();
      if (!text) return null;

      // Estimate cost: ~$0.0004 per image analysis (haiku vision)
      stats.estimated_cost_usd += 0.0004;

      return text;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(2000);
        continue;
      }
      return null;
    }
  }
  return null;
}

/**
 * Check if a product needs visual analysis.
 * Skip products that already have ai_visual_tags or have rich text data.
 */
function needsAnalysis(product) {
  // Already analyzed
  if (product.ai_visual_tags && product.ai_visual_tags.length > 10) return false;
  // Must have an image
  if (!product.image_url || !product.image_url.startsWith("http")) return false;
  return true;
}

/**
 * Run photo analysis on products from specified vendors.
 * @param {object} catalogDB - Catalog DB interface with getAllProducts, updateProductDirect
 * @param {object} options - { vendors: string[], prioritizeLight: boolean }
 */
export async function runPhotoAnalysis(catalogDB, options = {}) {
  if (running) {
    console.log("[photo-analyzer] Already running, skipping");
    return stats;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[photo-analyzer] ANTHROPIC_API_KEY not set");
    return stats;
  }

  running = true;
  stopRequested = false;
  stats.running = true;
  stats.last_run = new Date().toISOString();

  const allProducts = [...catalogDB.getAllProducts()];
  const targetVendors = options.vendors || [
    "Bernhardt",
    "Hooker Furniture",
    "Century Furniture",
    "Universal Furniture",
  ];

  // Filter to target vendors and products needing analysis
  const toAnalyze = allProducts.filter(
    (p) => targetVendors.includes(p.vendor_name) && needsAnalysis(p)
  );

  // Sort: products with thin descriptions first (they benefit most)
  toAnalyze.sort((a, b) => {
    const aLen = (a.description || "").length + (a.tags || []).join("").length;
    const bLen = (b.description || "").length + (b.tags || []).join("").length;
    return aLen - bLen;
  });

  console.log(
    `[photo-analyzer] Starting analysis of ${toAnalyze.length} products across ${targetVendors.join(", ")}`
  );
  stats.current_total = toAnalyze.length;

  // Group by vendor for progress tracking
  const byVendor = new Map();
  for (const p of toAnalyze) {
    if (!byVendor.has(p.vendor_name)) byVendor.set(p.vendor_name, []);
    byVendor.get(p.vendor_name).push(p);
  }

  for (const [vendor, vendorProducts] of byVendor) {
    if (stopRequested) break;

    stats.current_vendor = vendor;
    console.log(
      `[photo-analyzer] Analyzing ${vendorProducts.length} ${vendor} products...`
    );

    let vendorAnalyzed = 0;
    let vendorErrors = 0;

    for (let i = 0; i < vendorProducts.length; i++) {
      if (stopRequested) break;

      const product = vendorProducts[i];
      stats.current_progress++;

      const tags = await analyzeImage(product.image_url, product.product_name, apiKey);

      if (tags) {
        // Save tags to product
        catalogDB.updateProductDirect(product.id, { ai_visual_tags: tags });
        vendorAnalyzed++;
        stats.total_analyzed++;

        if (vendorAnalyzed <= 3 || vendorAnalyzed % 50 === 0) {
          console.log(
            `[photo-analyzer] [${vendor}] ${vendorAnalyzed}/${vendorProducts.length} | ${product.product_name}: ${tags.slice(0, 80)}...`
          );
        }
      } else {
        vendorErrors++;
        stats.total_errors++;
      }

      // Rate limiting: pause between calls
      await sleep(DELAY_BETWEEN_CALLS_MS);

      // Log progress every 100 products
      if (stats.current_progress % 100 === 0) {
        console.log(
          `[photo-analyzer] Progress: ${stats.current_progress}/${stats.current_total} | Cost: $${stats.estimated_cost_usd.toFixed(2)} | Errors: ${stats.total_errors}`
        );
      }
    }

    console.log(
      `[photo-analyzer] ${vendor}: ${vendorAnalyzed} analyzed, ${vendorErrors} errors`
    );
  }

  running = false;
  stats.running = false;
  console.log(
    `[photo-analyzer] Complete. ${stats.total_analyzed} analyzed, ${stats.total_errors} errors, est. cost: $${stats.estimated_cost_usd.toFixed(2)}`
  );

  return stats;
}

export function getPhotoAnalysisStatus() {
  return { ...stats };
}

export function stopPhotoAnalysis() {
  stopRequested = true;
  console.log("[photo-analyzer] Stop requested");
}
