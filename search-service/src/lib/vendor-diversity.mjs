/**
 * Vendor Diversity Ranking
 *
 * Re-ranks search results using round-robin interleaving across vendors
 * so no single vendor dominates the results page.
 */

import { VENDOR_SPECIALTIES } from "./furniture-dictionary.mjs";

/**
 * Apply vendor specialty boost to a product's relevance score.
 *
 * @param {object} product - Product with vendor_id, relevance_score
 * @param {string[]} queryTerms - Tokenized query terms
 * @returns {number} - Boosted score
 */
function applyVendorBoost(product, queryTerms) {
  const specialty = VENDOR_SPECIALTIES[product.vendor_id];
  if (!specialty) return product.relevance_score || 0;

  const score = product.relevance_score || 0;
  const matchesSpecialty = specialty.boost.some((term) =>
    queryTerms.some((qt) => qt.includes(term) || term.includes(qt))
  );

  return matchesSpecialty ? score * specialty.strength : score;
}

/**
 * Diversify search results across vendors using round-robin interleaving.
 *
 * Algorithm:
 *   1. Apply vendor specialty boosts
 *   2. Group products by vendor
 *   3. Sort each group by boosted relevance score
 *   4. Round-robin pick: best from each vendor, then second-best, etc.
 *   5. Cap max products per vendor in the top slice
 *
 * @param {object[]} products - Array of products with relevance_score, vendor_id
 * @param {object} options
 * @param {number} [options.maxPerVendor=5] - Max products from same vendor in top results
 * @param {number} [options.topSlice=20] - How many "top" results to enforce diversity in
 * @param {number} [options.totalLimit=60] - Max total results
 * @param {string[]} [options.queryTerms=[]] - Tokenized query for vendor specialty boosts
 * @param {string|null} [options.vendorFilter=null] - If set, skip diversity (user wants specific vendor)
 * @returns {object[]} - Re-ranked products
 */
export function diversifyResults(products, options = {}) {
  const {
    maxPerVendor = 5,
    topSlice = 20,
    totalLimit = 60,
    queryTerms = [],
    vendorFilter = null,
  } = options;

  // If user is filtering by a specific vendor, skip diversity
  if (vendorFilter) {
    return products.slice(0, totalLimit);
  }

  if (products.length === 0) return [];

  // Apply vendor specialty boosts
  const boosted = products.map((p) => ({
    ...p,
    _boosted_score: applyVendorBoost(p, queryTerms),
  }));

  // Group by vendor
  const vendorGroups = new Map();
  for (const p of boosted) {
    const vid = p.vendor_id || "unknown";
    if (!vendorGroups.has(vid)) vendorGroups.set(vid, []);
    vendorGroups.get(vid).push(p);
  }

  // Sort each group by boosted score descending
  for (const group of vendorGroups.values()) {
    group.sort((a, b) => b._boosted_score - a._boosted_score);
  }

  // Sort vendors by their best product's score (highest first)
  const sortedVendors = [...vendorGroups.entries()]
    .sort((a, b) => b[1][0]._boosted_score - a[1][0]._boosted_score);

  // Round-robin interleave for top slice
  const result = [];
  const vendorCounts = new Map();
  let round = 0;
  let added = true;

  while (added && result.length < totalLimit) {
    added = false;
    for (const [vendorId, group] of sortedVendors) {
      if (round >= group.length) continue;

      // In top slice, enforce max per vendor
      const currentCount = vendorCounts.get(vendorId) || 0;
      if (result.length < topSlice && currentCount >= maxPerVendor) continue;

      const product = group[round];
      result.push(product);
      vendorCounts.set(vendorId, currentCount + 1);
      added = true;

      if (result.length >= totalLimit) break;
    }
    round++;
  }

  // Clean up internal field
  for (const p of result) {
    delete p._boosted_score;
  }

  return result;
}

/**
 * Get vendor diversity stats for a result set.
 */
export function getVendorDiversityStats(products) {
  const counts = new Map();
  for (const p of products) {
    const vid = p.vendor_id || "unknown";
    counts.set(vid, (counts.get(vid) || 0) + 1);
  }
  return {
    total_products: products.length,
    unique_vendors: counts.size,
    vendor_counts: Object.fromEntries(counts),
  };
}
