/**
 * Vector Store — Local semantic search using Transformers.js
 *
 * Uses all-MiniLM-L6-v2 (384 dimensions) for product embeddings.
 * Runs entirely locally in Node.js via WASM — zero API cost.
 *
 * Capabilities:
 *   - Embed product text into 384-dim vectors
 *   - Nearest neighbor search by cosine similarity
 *   - Filtered search (vendor, category, style, material)
 *   - Fast: <100ms for 55k products
 *   - Auto-persists vectors to disk
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const VECTORS_PATH = path.join(DATA_DIR, "vectors.bin");
const META_PATH = path.join(DATA_DIR, "vectors.meta.json");

// ── State ──

/** @type {import('@xenova/transformers').Pipeline|null} */
let embedPipeline = null;

/** @type {Float32Array} Flat array of all vectors: [v0_d0, v0_d1, ..., v0_d383, v1_d0, ...] */
let vectors = null;

/** @type {string[]} Product IDs in same order as vectors */
let vectorIds = [];

/** @type {Map<string, number>} productId → index in vectors array */
let idToIndex = new Map();

/** Embedding dimension */
const DIM = 384;

/** Whether the store is ready */
let ready = false;
let initializing = false;
let unavailable = false; // true if @xenova/transformers is missing

// ── Embedding Pipeline ──

/**
 * Initialize the embedding model. Downloads on first run (~30MB), cached after.
 */
async function initPipeline() {
  if (embedPipeline) return;
  if (unavailable) return;

  console.log("[vector-store] Loading embedding model (all-MiniLM-L6-v2)...");
  const startMs = Date.now();

  try {
    // Dynamic import — gracefully handles missing package
    const { pipeline: createPipeline, env } = await import("@xenova/transformers");

    // Use local cache dir
    env.cacheDir = path.resolve(DATA_DIR, ".transformers-cache");
    env.allowLocalModels = true;

    embedPipeline = await createPipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
      quantized: true, // Use quantized model for speed
    });

    console.log(`[vector-store] Model loaded in ${((Date.now() - startMs) / 1000).toFixed(1)}s`);
  } catch (err) {
    unavailable = true;
    console.warn(`[vector-store] Embedding model unavailable — vector search disabled. (${err.message})`);
  }
}

/**
 * Generate embedding for a text string.
 *
 * @param {string} text
 * @returns {Promise<Float32Array>} 384-dim normalized vector
 */
export async function embed(text) {
  if (!embedPipeline) await initPipeline();
  if (unavailable || !embedPipeline) return null;

  const output = await embedPipeline(text, {
    pooling: "mean",
    normalize: true,
  });

  return new Float32Array(output.data);
}

/**
 * Batch embed multiple texts.
 *
 * @param {string[]} texts
 * @param {number} batchSize - Texts per batch (model handles one at a time in WASM)
 * @returns {Promise<Float32Array[]>}
 */
async function batchEmbed(texts, batchSize = 1) {
  if (!embedPipeline) await initPipeline();
  if (unavailable || !embedPipeline) return [];

  const results = [];
  for (let i = 0; i < texts.length; i++) {
    const output = await embedPipeline(texts[i], {
      pooling: "mean",
      normalize: true,
    });
    results.push(new Float32Array(output.data));

    // Progress logging
    if ((i + 1) % 500 === 0 || i === texts.length - 1) {
      console.log(`[vector-store] Embedded ${i + 1}/${texts.length}`);
    }

    // Yield to event loop every 50 embeddings so server can handle requests
    if ((i + 1) % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  return results;
}

// ── Vector Operations ──

/**
 * Cosine similarity between two normalized vectors.
 * Since vectors are pre-normalized, this is just the dot product.
 */
function cosineSim(a, aOffset, b) {
  let dot = 0;
  for (let i = 0; i < DIM; i++) {
    dot += a[aOffset + i] * b[i];
  }
  return dot;
}

// ── Disk Persistence ──

function saveVectors() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Save binary vectors
  const buffer = Buffer.from(vectors.buffer, vectors.byteOffset, vectors.byteLength);
  fs.writeFileSync(VECTORS_PATH, buffer);

  // Save metadata
  fs.writeFileSync(META_PATH, JSON.stringify({
    version: 1,
    dim: DIM,
    count: vectorIds.length,
    ids: vectorIds,
    saved_at: new Date().toISOString(),
  }));
}

function loadVectors() {
  if (!fs.existsSync(VECTORS_PATH) || !fs.existsSync(META_PATH)) return false;

  try {
    const meta = JSON.parse(fs.readFileSync(META_PATH, "utf8"));
    if (meta.dim !== DIM) return false;

    const buffer = fs.readFileSync(VECTORS_PATH);
    vectors = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4);

    vectorIds = meta.ids;
    idToIndex = new Map();
    for (let i = 0; i < vectorIds.length; i++) {
      idToIndex.set(vectorIds[i], i);
    }

    console.log(`[vector-store] Loaded ${vectorIds.length} vectors from disk`);
    return true;
  } catch (err) {
    console.error(`[vector-store] Failed to load vectors: ${err.message}`);
    return false;
  }
}

// ── Public API ──

/**
 * Initialize the vector store. Loads existing vectors from disk.
 * Call this at startup, then call indexAllProducts() to fill/update vectors.
 */
export async function initVectorStore() {
  if (ready || initializing) return;
  initializing = true;

  await initPipeline();

  if (unavailable) {
    // Model not available — vector store runs in degraded mode
    vectors = new Float32Array(0);
    vectorIds = [];
    idToIndex = new Map();
    ready = false;
    initializing = false;
    return;
  }

  const loaded = loadVectors();
  if (!loaded) {
    vectors = new Float32Array(0);
    vectorIds = [];
    idToIndex = new Map();
  }

  ready = true;
  initializing = false;
  console.log(`[vector-store] Ready — ${vectorIds.length} vectors loaded`);
}

/**
 * Build the product text string for embedding.
 * Combines all relevant fields into a natural sentence.
 */
/**
 * Build structured product text for embedding using AI visual analysis fields.
 * Format matches the vector_query format Haiku generates for searches.
 * Tagged products get rich structured text; untagged get basic fields.
 */
export function buildProductText(product) {
  const va = product.ai_visual_analysis;

  if (va) {
    // ── AI-tagged product: full structured format ──
    const parts = [
      va.furniture_type ? `type:${va.furniture_type}` : null,
      va.silhouette ? `silhouette:${va.silhouette}` : null,
      va.arms ? `arms:${va.arms}` : null,
      va.back ? `back:${va.back}` : null,
      va.legs_base ? `legs:${va.legs_base}` : null,
      va.cushions ? `cushions:${va.cushions}` : null,
      va.upholstery_material ? `material:${va.upholstery_material}` : null,
      va.secondary_materials ? `secondary:${va.secondary_materials}` : null,
      va.color_primary ? `color:${va.color_primary}` : null,
      va.finish ? `finish:${va.finish}` : null,
      va.style ? `style:${va.style}` : null,
      va.era_influence ? `era:${va.era_influence}` : null,
      va.formality ? `formality:${va.formality}` : null,
      va.scale ? `scale:${va.scale}` : null,
      va.visual_weight ? `weight:${va.visual_weight}` : null,
      va.texture_description ? `texture:${va.texture_description}` : null,
      va.construction_details ? `construction:${va.construction_details}` : null,
      va.distinctive_features?.length ? `features:${va.distinctive_features.join(", ")}` : null,
      va.mood ? `mood:${va.mood}` : null,
      va.ideal_client ? `client:${va.ideal_client}` : null,
      va.pairs_well_with ? `pairs:${va.pairs_well_with}` : null,
      va.durability_assessment ? `durability:${va.durability_assessment}` : null,
      va.search_terms?.length ? `terms:${va.search_terms.join(", ")}` : null,
      product.vendor_name ? `vendor:${product.vendor_name}` : null,
      product.retail_price ? `price:${product.retail_price}` : null,
      (product.width || product.depth || product.height) ? `dimensions: W:${product.width || ""} D:${product.depth || ""} H:${product.height || ""}` : null,
      va.description ? `description:${va.description}` : null,
    ].filter(v => v && !v.endsWith(":") && !v.endsWith(":null") && !v.endsWith(":undefined"));

    return parts.join(" | ");
  }

  // ── Untagged product: basic fields ──
  const parts = [
    product.product_name,
    product.vendor_name ? `vendor:${product.vendor_name}` : null,
    product.description ? product.description.slice(0, 200) : null,
    product.material ? `material:${product.material}` : null,
    product.category ? `type:${product.category.replace(/-/g, " ")}` : null,
    product.style ? `style:${product.style}` : null,
    product.color ? `color:${product.color}` : null,
  ].filter(Boolean);

  return parts.join(" | ");
}

/**
 * Index all products from the catalog. Generates embeddings for any products
 * not yet in the vector store.
 *
 * @param {Iterable<object>} products - All products from catalog DB
 * @param {object} options
 * @param {boolean} [options.reindex=false] - Force re-embed all products
 * @returns {Promise<{ total: number, new: number, skipped: number, timeMs: number }>}
 */
export async function indexAllProducts(products, options = {}) {
  if (!ready) await initVectorStore();
  if (unavailable) return { total: 0, new: 0, skipped: 0, timeMs: 0 };

  const { reindex = false } = options;
  const startMs = Date.now();

  // Collect products that need embedding
  const toEmbed = [];
  const toEmbedIds = [];
  const existingProducts = [];

  for (const product of products) {
    if (!reindex && idToIndex.has(product.id)) {
      existingProducts.push(product.id);
      continue;
    }
    toEmbed.push(buildProductText(product));
    toEmbedIds.push(product.id);
  }

  if (toEmbed.length === 0) {
    console.log(`[vector-store] All ${existingProducts.length} products already indexed`);
    return { total: existingProducts.length, new: 0, skipped: existingProducts.length, timeMs: Date.now() - startMs };
  }

  console.log(`[vector-store] Generating embeddings for ${toEmbed.length} products (${existingProducts.length} already indexed)...`);

  // Start with existing vectors if not reindexing
  let currentIds = [];
  let currentIdToIndex = new Map();
  let currentFlat;
  let currentOffset = 0;

  // Pre-allocate for full size
  const totalCount = (reindex ? 0 : existingProducts.length) + toEmbed.length;
  currentFlat = new Float32Array(totalCount * DIM);

  if (!reindex) {
    for (const id of existingProducts) {
      const oldIdx = idToIndex.get(id);
      if (oldIdx !== undefined) {
        const srcOffset = oldIdx * DIM;
        for (let d = 0; d < DIM; d++) {
          currentFlat[currentOffset + d] = vectors[srcOffset + d];
        }
        currentIdToIndex.set(id, currentIds.length);
        currentIds.push(id);
        currentOffset += DIM;
      }
    }
    // Make partially-indexed vectors available immediately
    vectors = currentFlat;
    vectorIds = currentIds;
    idToIndex = currentIdToIndex;
  }

  // Embed one at a time, adding to the live index incrementally
  if (!embedPipeline) await initPipeline();
  if (unavailable || !embedPipeline) return { total: 0, new: 0, skipped: 0, timeMs: 0 };

  let newCount = 0;
  for (let i = 0; i < toEmbed.length; i++) {
    const output = await embedPipeline(toEmbed[i], { pooling: "mean", normalize: true });
    const vec = new Float32Array(output.data);

    // Add to flat array
    for (let d = 0; d < DIM; d++) {
      currentFlat[currentOffset + d] = vec[d];
    }
    currentIdToIndex.set(toEmbedIds[i], currentIds.length);
    currentIds.push(toEmbedIds[i]);
    currentOffset += DIM;
    newCount++;

    // Update live references so searches can use partial data
    vectors = currentFlat;
    vectorIds = currentIds;
    idToIndex = currentIdToIndex;

    // Progress logging
    if ((i + 1) % 500 === 0 || i === toEmbed.length - 1) {
      console.log(`[vector-store] Embedded ${i + 1}/${toEmbed.length} (${currentIds.length} total searchable)`);
    }

    // Yield to event loop every 50 embeddings
    if ((i + 1) % 50 === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Save checkpoint every 2000 embeddings
    if ((i + 1) % 2000 === 0) {
      saveVectors();
    }
  }

  // Final save
  saveVectors();

  const timeMs = Date.now() - startMs;
  console.log(`[vector-store] Indexed ${currentIds.length} products (${newCount} new) in ${(timeMs / 1000).toFixed(1)}s`);

  return { total: currentIds.length, new: newCount, skipped: existingProducts.length, timeMs };
}

/**
 * Add or update a single product's vector.
 */
export async function indexProduct(product) {
  if (!ready) await initVectorStore();
  if (unavailable) return;

  const text = buildProductText(product);
  const vec = await embed(text);

  const existingIdx = idToIndex.get(product.id);
  if (existingIdx !== undefined) {
    // Update in place
    const offset = existingIdx * DIM;
    for (let d = 0; d < DIM; d++) {
      vectors[offset + d] = vec[d];
    }
  } else {
    // Append
    const newFlat = new Float32Array(vectors.length + DIM);
    newFlat.set(vectors);
    const offset = vectors.length;
    for (let d = 0; d < DIM; d++) {
      newFlat[offset + d] = vec[d];
    }
    vectors = newFlat;
    idToIndex.set(product.id, vectorIds.length);
    vectorIds.push(product.id);
  }

  // Don't save on every single product — let it batch via debounce
}

/**
 * Remove a product's vector.
 */
export function removeVector(productId) {
  // Mark as removed — actual cleanup happens on next full reindex
  // For now, just remove from the ID map so it won't appear in results
  idToIndex.delete(productId);
}

/**
 * Search for nearest neighbors by query text.
 *
 * @param {string} queryText - Natural language search query
 * @param {object} options
 * @param {number} [options.limit=50]
 * @param {Set<string>|null} [options.candidateIds=null] - If set, only search within these IDs
 * @param {function|null} [options.filter=null] - Filter function: (productId) => boolean
 * @returns {Promise<Array<{ id: string, score: number }>>}
 */
export async function vectorSearch(queryText, options = {}) {
  if (unavailable || !ready || vectorIds.length === 0) return [];

  const { limit = 50, candidateIds = null, filter = null } = options;

  const queryVec = await embed(queryText);

  // Brute-force cosine similarity (fast enough for 55k @ 384 dims)
  const scores = [];

  for (let i = 0; i < vectorIds.length; i++) {
    const id = vectorIds[i];

    // Skip if not in ID map (removed)
    if (!idToIndex.has(id)) continue;

    // Apply candidate filter
    if (candidateIds && !candidateIds.has(id)) continue;

    // Apply custom filter
    if (filter && !filter(id)) continue;

    const score = cosineSim(vectors, i * DIM, queryVec);
    scores.push({ id, score });
  }

  // Partial sort — only need top N
  scores.sort((a, b) => b.score - a.score);

  return scores.slice(0, limit);
}

/**
 * Find similar products by product ID using vector similarity.
 *
 * @param {string} productId
 * @param {number} limit
 * @param {function|null} filter
 * @returns {Array<{ id: string, score: number }>}
 */
export function vectorFindSimilar(productId, limit = 20, filter = null) {
  if (!ready || vectorIds.length === 0) return [];

  const idx = idToIndex.get(productId);
  if (idx === undefined) return [];

  const sourceOffset = idx * DIM;
  const scores = [];

  for (let i = 0; i < vectorIds.length; i++) {
    if (i === idx) continue;
    const id = vectorIds[i];
    if (!idToIndex.has(id)) continue;
    if (filter && !filter(id)) continue;

    const score = cosineSim(vectors, i * DIM, vectors.subarray(sourceOffset, sourceOffset + DIM));
    scores.push({ id, score });
  }

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, limit);
}

/**
 * Find similar using a pre-computed source vector (avoids double lookup).
 */
function vectorFindSimilarByVec(sourceVec, limit, filter) {
  const scores = [];
  for (let i = 0; i < vectorIds.length; i++) {
    const id = vectorIds[i];
    if (!idToIndex.has(id)) continue;
    if (filter && !filter(id)) continue;
    const score = cosineSim(vectors, i * DIM, sourceVec);
    scores.push({ id, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, limit);
}

/**
 * Get vector store stats.
 */
export function getVectorStoreStats() {
  return {
    ready,
    unavailable,
    total_vectors: vectorIds.length,
    active_vectors: idToIndex.size,
    dimension: DIM,
    memory_mb: vectors ? ((vectors.byteLength) / (1024 * 1024)).toFixed(1) : "0",
  };
}

/**
 * Save current vectors to disk (call periodically or on shutdown).
 */
export function persistVectors() {
  if (vectorIds.length > 0) {
    saveVectors();
  }
}
