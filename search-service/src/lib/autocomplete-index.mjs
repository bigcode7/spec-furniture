/**
 * Smart Autocomplete Index
 *
 * Builds an autocomplete index from actual catalog data:
 *   - Product names
 *   - Vendor names
 *   - Collections
 *   - Categories
 *   - Materials
 *   - Styles
 *   - Popular search terms
 *
 * All local, zero API cost. Prefix-match with popularity weighting.
 */

/** @type {Map<string, { text: string, type: string, count: number }>} */
let entries = new Map();

/** @type {string[]} sorted entries for binary-search prefix matching */
let sortedKeys = [];

/** Track popular searches */
const popularSearches = new Map();

/** Whether index has been built */
let built = false;

/**
 * Build the autocomplete index from all products.
 *
 * @param {Iterable<object>} products - All products in catalog
 */
export function buildAutocompleteIndex(products) {
  entries = new Map();
  const nameCounts = new Map();
  const vendorCounts = new Map();
  const collectionCounts = new Map();
  const categoryCounts = new Map();
  const materialCounts = new Map();
  const styleCounts = new Map();

  for (const product of products) {
    // Vendor names
    if (product.vendor_name) {
      const v = product.vendor_name.trim();
      vendorCounts.set(v, (vendorCounts.get(v) || 0) + 1);
    }

    // Collections
    if (product.collection) {
      const c = product.collection.trim();
      if (c.length > 2) {
        collectionCounts.set(c, (collectionCounts.get(c) || 0) + 1);
      }
    }

    // Categories
    if (product.category) {
      const cat = product.category.replace(/-/g, " ").trim();
      if (cat.length > 2) {
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
      }
    }

    // Materials
    if (product.material) {
      const m = product.material.trim();
      if (m.length > 2) {
        materialCounts.set(m, (materialCounts.get(m) || 0) + 1);
      }
    }

    // Styles
    if (product.style) {
      const s = product.style.trim();
      if (s.length > 2) {
        styleCounts.set(s, (styleCounts.get(s) || 0) + 1);
      }
    }

    // Product names — only add distinctive ones (skip if too generic)
    if (product.product_name && product.product_name.length > 5) {
      const n = product.product_name.trim();
      nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
    }
  }

  // Add vendors (high priority)
  for (const [text, count] of vendorCounts) {
    const key = text.toLowerCase();
    entries.set(`vendor:${key}`, { text, type: "vendor", count: count * 10 });
  }

  // Add categories
  for (const [text, count] of categoryCounts) {
    const key = text.toLowerCase();
    entries.set(`category:${key}`, { text, type: "category", count: count * 5 });
  }

  // Add collections (filter to those with 3+ products)
  for (const [text, count] of collectionCounts) {
    if (count >= 3) {
      const key = text.toLowerCase();
      entries.set(`collection:${key}`, { text, type: "collection", count: count * 3 });
    }
  }

  // Add materials (filter to those with 5+ products)
  for (const [text, count] of materialCounts) {
    if (count >= 5) {
      const key = text.toLowerCase();
      entries.set(`material:${key}`, { text, type: "material", count: count * 2 });
    }
  }

  // Add styles
  for (const [text, count] of styleCounts) {
    if (count >= 5) {
      const key = text.toLowerCase();
      entries.set(`style:${key}`, { text, type: "style", count: count * 2 });
    }
  }

  // Add top product names (limit to avoid bloat)
  const topNames = [...nameCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2000);
  for (const [text, count] of topNames) {
    const key = text.toLowerCase();
    entries.set(`product:${key}`, { text, type: "product", count });
  }

  // Add AI-suggested refinements for common categories
  const refinements = [
    "leather sofa", "velvet sofa", "sectional sofa", "performance fabric sofa",
    "walnut dining table", "round dining table", "extension dining table",
    "marble coffee table", "glass coffee table", "wood coffee table",
    "mid-century modern", "contemporary", "transitional", "coastal",
    "boucle accent chair", "swivel accent chair", "leather accent chair",
    "natural oak", "white oak", "walnut", "mahogany", "teak",
  ];
  for (const text of refinements) {
    const key = text.toLowerCase();
    if (!entries.has(`suggestion:${key}`)) {
      entries.set(`suggestion:${key}`, { text, type: "suggestion", count: 1 });
    }
  }

  // Build sorted keys for prefix search
  sortedKeys = [...entries.keys()].sort();
  built = true;

  console.log(`[autocomplete] Index built: ${entries.size} entries (${vendorCounts.size} vendors, ${collectionCounts.size} collections, ${categoryCounts.size} categories)`);
}

/**
 * Search the autocomplete index with a prefix query.
 *
 * @param {string} query - Partial search input
 * @param {number} limit - Max suggestions (default 8)
 * @returns {Array<{ text: string, type: string }>}
 */
export function autocompleteSearch(query, limit = 8) {
  if (!built || !query) return [];

  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const matches = [];

  // Search all entries for prefix or substring match
  for (const [key, entry] of entries) {
    const searchable = key.split(":").slice(1).join(":");

    let relevance = 0;
    if (searchable.startsWith(q)) {
      relevance = 3 + entry.count; // Prefix match — best
    } else if (searchable.includes(q)) {
      relevance = 1 + entry.count * 0.5; // Substring match
    } else if (entry.text.toLowerCase().includes(q)) {
      relevance = 0.5 + entry.count * 0.3; // Text substring
    }

    if (relevance > 0) {
      matches.push({ ...entry, relevance });
    }
  }

  // Also check popular searches
  for (const [text, count] of popularSearches) {
    if (text.includes(q)) {
      matches.push({ text, type: "recent", count, relevance: 2 + count });
    }
  }

  // Sort by relevance (type priority + count)
  matches.sort((a, b) => {
    // Type priority: vendor > category > collection > material > suggestion > product > recent
    const typePriority = { vendor: 6, category: 5, collection: 4, material: 3, style: 3, suggestion: 2, product: 1, recent: 1.5 };
    const aPri = typePriority[a.type] || 0;
    const bPri = typePriority[b.type] || 0;
    if (Math.abs(aPri - bPri) > 1) return bPri - aPri;
    return b.relevance - a.relevance;
  });

  // Deduplicate by text (case-insensitive)
  const seen = new Set();
  const results = [];
  for (const match of matches) {
    const key = match.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ text: match.text, type: match.type });
    if (results.length >= limit) break;
  }

  return results;
}

/**
 * Record a search query for popularity tracking.
 *
 * @param {string} query
 */
export function recordSearch(query) {
  if (!query || query.length < 3) return;
  const q = query.toLowerCase().trim();
  popularSearches.set(q, (popularSearches.get(q) || 0) + 1);

  // Keep only top 500 searches
  if (popularSearches.size > 600) {
    const sorted = [...popularSearches.entries()].sort((a, b) => b[1] - a[1]);
    popularSearches.clear();
    for (const [k, v] of sorted.slice(0, 500)) {
      popularSearches.set(k, v);
    }
  }
}

/**
 * Get whether the index is built.
 */
export function isAutocompleteReady() {
  return built;
}
