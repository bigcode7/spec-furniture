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

// ── Embedding Pipeline ──

/**
 * Initialize the embedding model. Downloads on first run (~30MB), cached after.
 */
async function initPipeline() {
  if (embedPipeline) return;

  console.log("[vector-store] Loading embedding model (all-MiniLM-L6-v2)...");
  const startMs = Date.now();

  // Dynamic import to avoid issues if package not installed
  const { pipeline, env } = await import("@xenova/transformers");

  // Use local cache dir
  env.cacheDir = path.resolve(DATA_DIR, ".transformers-cache");
  env.allowLocalModels = true;

  embedPipeline = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    quantized: true, // Use quantized model for speed
  });

  console.log(`[vector-store] Model loaded in ${((Date.now() - startMs) / 1000).toFixed(1)}s`);
}

/**
 * Generate embedding for a text string.
 *
 * @param {string} text
 * @returns {Promise<Float32Array>} 384-dim normalized vector
 */
export async function embed(text) {
  if (!embedPipeline) await initPipeline();

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
export function buildProductText(product) {
  const parts = [];

  if (product.product_name) parts.push(product.product_name);
  if (product.vendor_name) parts.push(`by ${product.vendor_name}`);
  if (product.collection) parts.push(`${product.collection} collection`);
  if (product.category) parts.push(product.category.replace(/-/g, " "));
  if (product.style) parts.push(`${product.style} style`);
  if (product.material) parts.push(product.material);
  if (product.color) parts.push(product.color);
  if (product.description) parts.push(product.description.slice(0, 200));
  if (product.dimensions) parts.push(product.dimensions);
  if (product.ai_visual_tags) parts.push(product.ai_visual_tags.slice(0, 150));

  // Add top tags (skip single-letter and very common ones)
  const tags = (product.tags || [])
    .filter(t => t.length > 2 && !["the", "and", "for", "with"].includes(t))
    .slice(0, 15);
  if (tags.length > 0) parts.push(tags.join(" "));

  return parts.join(". ").slice(0, 512); // Truncate to model's sweet spot
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

  // Generate embeddings
  const newVectors = await batchEmbed(toEmbed);

  // Build new flat vector array
  const totalCount = (reindex ? 0 : existingProducts.length) + newVectors.length;
  const newFlat = new Float32Array(totalCount * DIM);
  const newIds = [];
  const newIdToIndex = new Map();

  // Copy existing vectors (if not reindexing)
  let offset = 0;
  if (!reindex) {
    for (const id of existingProducts) {
      const oldIdx = idToIndex.get(id);
      if (oldIdx !== undefined) {
        const srcOffset = oldIdx * DIM;
        for (let d = 0; d < DIM; d++) {
          newFlat[offset + d] = vectors[srcOffset + d];
        }
        newIdToIndex.set(id, newIds.length);
        newIds.push(id);
        offset += DIM;
      }
    }
  }

  // Add new vectors
  for (let i = 0; i < newVectors.length; i++) {
    const vec = newVectors[i];
    for (let d = 0; d < DIM; d++) {
      newFlat[offset + d] = vec[d];
    }
    newIdToIndex.set(toEmbedIds[i], newIds.length);
    newIds.push(toEmbedIds[i]);
    offset += DIM;
  }

  // Swap in new data
  vectors = newFlat;
  vectorIds = newIds;
  idToIndex = newIdToIndex;

  // Persist
  saveVectors();

  const timeMs = Date.now() - startMs;
  console.log(`[vector-store] Indexed ${totalCount} products (${newVectors.length} new) in ${(timeMs / 1000).toFixed(1)}s`);

  return { total: totalCount, new: newVectors.length, skipped: existingProducts.length, timeMs };
}

/**
 * Add or update a single product's vector.
 */
export async function indexProduct(product) {
  if (!ready) await initVectorStore();

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
  if (!ready || vectorIds.length === 0) return [];

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
