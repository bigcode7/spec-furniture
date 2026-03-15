/**
 * Product Quality Scorer
 *
 * Assigns a 0-100 quality score to each product based on data completeness.
 * Used as a tiebreaker in search ranking — richer products rank higher
 * when relevance scores are equal.
 *
 * Zero API cost — pure field inspection.
 */

/**
 * Compute quality score for a product.
 *
 * Scoring:
 *   Has verified working image:          +30
 *   Has description > 50 chars:          +15
 *   Has material identified:             +10
 *   Has style identified:                +10
 *   Has collection name:                  +5
 *   Has dimensions:                      +10
 *   Has multiple images:                  +5
 *   Has price (retail or wholesale):     +10
 *   Product page URL present:             +5
 *
 * @param {object} product - Product from catalog DB
 * @returns {number} Score 0-100
 */
export function computeQualityScore(product) {
  let score = 0;

  // Image: +30 for verified, +15 for unverified but present
  if (product.image_verified === true) {
    score += 30;
  } else if (product.image_url) {
    score += 15;
  }

  // Description: +15 if longer than 50 chars
  if (product.description && product.description.length > 50) {
    score += 15;
  } else if (product.description && product.description.length > 10) {
    score += 5;
  }

  // Material: +10
  if (product.material) {
    score += 10;
  }

  // Style: +10
  if (product.style) {
    score += 10;
  }

  // Collection: +5
  if (product.collection) {
    score += 5;
  }

  // Dimensions: +10
  if (product.dimensions) {
    score += 10;
  }

  // Multiple images: +5
  if (Array.isArray(product.image_urls) && product.image_urls.length > 1) {
    score += 5;
  }

  // Price: +10
  if (product.retail_price || product.wholesale_price) {
    score += 10;
  }

  // Product URL: +5
  if (product.product_url) {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * Batch compute quality scores for products.
 *
 * @param {Iterable<object>} products - Products to score
 * @returns {{ scored: number, avgScore: number, distribution: object }}
 */
export function batchComputeQualityScores(products) {
  let total = 0;
  let sum = 0;
  const buckets = { "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0 };

  for (const product of products) {
    const score = computeQualityScore(product);
    product.quality_score = score;
    sum += score;
    total++;

    if (score <= 20) buckets["0-20"]++;
    else if (score <= 40) buckets["21-40"]++;
    else if (score <= 60) buckets["41-60"]++;
    else if (score <= 80) buckets["61-80"]++;
    else buckets["81-100"]++;
  }

  return {
    scored: total,
    avgScore: total > 0 ? Math.round(sum / total) : 0,
    distribution: buckets,
  };
}
