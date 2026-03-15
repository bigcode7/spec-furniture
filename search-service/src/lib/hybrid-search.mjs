/**
 * Hybrid Search — Combines keyword search + vector semantic search.
 *
 * Fusion strategy (Reciprocal Rank Fusion):
 *   - Products in BOTH keyword + vector results get highest rank
 *   - Vector-only matches (semantic) ranked next
 *   - Keyword-only matches ranked last
 *
 * This means:
 *   "cozy reading nook chair" matches "Anders Lounge Chair" via vectors
 *   "cloud sofa" matches oversized deep-seated sofas via semantic meaning
 *   "Bernhardt Albion" still works via exact keyword match
 */

import { vectorSearch, vectorFindSimilar, getVectorStoreStats } from "./vector-store.mjs";

/**
 * Reciprocal Rank Fusion constant.
 * Higher k = more weight to lower-ranked items.
 */
const RRF_K = 60;

/**
 * Run hybrid search: keyword results + vector results merged via RRF.
 *
 * @param {string} query - Original search query
 * @param {Array<object>} keywordResults - Results from searchCatalogDB (already scored/sorted)
 * @param {object} options
 * @param {number} [options.limit=200]
 * @param {number} [options.vectorWeight=0.5] - Weight for vector scores (0-1)
 * @param {number} [options.keywordWeight=0.5] - Weight for keyword scores (0-1)
 * @param {function|null} [options.filter=null] - Filter function for vector search
 * @param {function} [options.getProduct] - Function to get product by ID
 * @returns {Promise<Array<object>>} Merged results with hybrid_score
 */
export async function hybridSearch(query, keywordResults, options = {}) {
  const {
    limit = 200,
    vectorWeight = 0.6,
    keywordWeight = 0.4,
    filter = null,
    getProduct = null,
    candidateIds = null,
  } = options;

  // Check if vector store is ready
  const vectorStats = getVectorStoreStats();
  if (!vectorStats.ready || vectorStats.total_vectors === 0) {
    // Fall back to keyword-only
    return keywordResults.slice(0, limit);
  }

  // Run vector search in parallel with keyword (keyword already done)
  // When candidateIds is set, vector search only scores those products
  const vectorResults = await vectorSearch(query, {
    limit: Math.min(limit, 200),
    filter,
    candidateIds,
  });

  // Build keyword rank map
  const keywordRanks = new Map();
  for (let i = 0; i < keywordResults.length; i++) {
    keywordRanks.set(keywordResults[i].id, {
      rank: i + 1,
      score: keywordResults[i].relevance_score || 0,
      product: keywordResults[i],
    });
  }

  // Build vector rank map
  const vectorRanks = new Map();
  for (let i = 0; i < vectorResults.length; i++) {
    vectorRanks.set(vectorResults[i].id, {
      rank: i + 1,
      score: vectorResults[i].score,
    });
  }

  // Reciprocal Rank Fusion
  const allIds = new Set([...keywordRanks.keys(), ...vectorRanks.keys()]);
  const fusedResults = [];

  for (const id of allIds) {
    const kw = keywordRanks.get(id);
    const vec = vectorRanks.get(id);

    // RRF score: 1/(k + rank) for each list the product appears in
    let rrfScore = 0;
    let inBoth = false;

    if (kw) {
      rrfScore += keywordWeight * (1 / (RRF_K + kw.rank));
    }
    if (vec) {
      rrfScore += vectorWeight * (1 / (RRF_K + vec.rank));
    }

    // Bonus for appearing in BOTH lists (strong signal)
    if (kw && vec) {
      rrfScore *= 1.5;
      inBoth = true;
    }

    // Get the product object
    let product = kw?.product;
    if (!product && getProduct) {
      product = getProduct(id);
    }
    if (!product) continue;

    fusedResults.push({
      ...product,
      relevance_score: rrfScore,
      _keyword_rank: kw?.rank || null,
      _vector_rank: vec?.rank || null,
      _vector_score: vec?.score || null,
      _in_both: inBoth,
      _search_method: kw && vec ? "hybrid" : kw ? "keyword" : "semantic",
    });
  }

  // Sort by fused score descending
  fusedResults.sort((a, b) => b.relevance_score - a.relevance_score);

  return fusedResults.slice(0, limit);
}

/**
 * Semantic similar products — uses vector cosine similarity.
 * Much better than tag-based Jaccard because it understands meaning.
 *
 * @param {string} productId
 * @param {number} limit
 * @param {function|null} filter - e.g., exclude same vendor
 * @param {function} getProduct - Lookup product by ID
 * @returns {Array<object>} Similar products with similarity_score
 */
export function semanticSimilar(productId, limit = 20, filter = null, getProduct = null) {
  const vectorStats = getVectorStoreStats();
  if (!vectorStats.ready || vectorStats.total_vectors === 0) {
    return [];
  }

  const results = vectorFindSimilar(productId, limit * 2, filter);

  return results
    .map(({ id, score }) => {
      const product = getProduct ? getProduct(id) : null;
      if (!product) return null;
      return { ...product, similarity_score: score };
    })
    .filter(Boolean)
    .slice(0, limit);
}
