/**
 * Duplicate Detection & Merging Job
 *
 * Finds and merges duplicate products within each vendor:
 *   1. Exact URL match (after normalizing)
 *   2. Exact image URL match (same image = same product)
 *   3. Fuzzy name match (85%+ similarity within same vendor)
 *
 * Keeps the record with more complete data, merges missing fields.
 */

let running = false;
let stats = {
  vendors_checked: 0,
  duplicates_found: 0,
  products_merged: 0,
  products_removed: 0,
  by_vendor: {},
  started_at: null,
  finished_at: null,
  running: false,
};

/**
 * Normalize a URL for comparison: remove trailing slash, query params, fragment, lowercase.
 */
function normalizeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return (u.origin + u.pathname).toLowerCase().replace(/\/+$/, "");
  } catch {
    return url.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Optimization: if lengths differ by more than 30%, skip
  if (Math.abs(a.length - b.length) / Math.max(a.length, b.length) > 0.3) {
    return Math.max(a.length, b.length);
  }

  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Similarity ratio between two strings (0-1).
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  const al = a.toLowerCase().trim();
  const bl = b.toLowerCase().trim();
  if (al === bl) return 1;
  const maxLen = Math.max(al.length, bl.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(al, bl) / maxLen;
}

/**
 * Score a product's data completeness (for deciding which duplicate to keep).
 */
function completenessScore(product) {
  let score = 0;
  if (product.image_url) score += 3;
  if (product.image_verified) score += 2;
  if (product.description && product.description.length > 50) score += 3;
  if (product.description && product.description.length > 10) score += 1;
  if (product.material) score += 2;
  if (product.style) score += 2;
  if (product.dimensions) score += 2;
  if (product.collection) score += 1;
  if (product.retail_price || product.wholesale_price) score += 2;
  if ((product.tags || []).length > 5) score += 1;
  if (product.color) score += 1;
  return score;
}

/**
 * Merge fields from secondary product into primary (fill missing only).
 */
function mergeProducts(primary, secondary) {
  const merged = { ...primary };
  const fillable = ["description", "material", "style", "color", "dimensions", "collection", "retail_price", "wholesale_price", "sku", "image_url"];

  for (const field of fillable) {
    if (!merged[field] && secondary[field]) {
      merged[field] = secondary[field];
    }
  }

  // Merge tags
  if (secondary.tags && secondary.tags.length > 0) {
    const tagSet = new Set(merged.tags || []);
    for (const t of secondary.tags) tagSet.add(t);
    merged.tags = [...tagSet].slice(0, 80);
  }

  return merged;
}

/**
 * Run deduplication job.
 *
 * @param {object} catalogDB - { getAllProducts, getProductsByVendorGrouped, updateProductDirect, deleteProduct }
 */
export async function runDeduplication(catalogDB) {
  if (running) {
    console.log("[dedup] Already running, skipping");
    return stats;
  }

  running = true;
  stats = {
    vendors_checked: 0,
    duplicates_found: 0,
    products_merged: 0,
    products_removed: 0,
    by_vendor: {},
    started_at: new Date().toISOString(),
    finished_at: null,
    running: true,
  };

  console.log("[dedup] Starting deduplication job...");

  const vendorGroups = catalogDB.getProductsByVendorGrouped();

  for (const [vendorId, vendorProducts] of vendorGroups) {
    stats.vendors_checked++;
    let vendorDupes = 0;

    // Skip tiny groups
    if (vendorProducts.length < 2) continue;

    // ── Phase 1: Exact URL dedup ──
    const urlMap = new Map();
    const toRemove = new Set();

    for (const product of vendorProducts) {
      if (toRemove.has(product.id)) continue;
      const nUrl = normalizeUrl(product.product_url);
      if (!nUrl) continue;

      if (urlMap.has(nUrl)) {
        const existing = urlMap.get(nUrl);
        const existingScore = completenessScore(existing);
        const newScore = completenessScore(product);

        if (newScore > existingScore) {
          // New product is better — merge and replace
          const merged = mergeProducts(product, existing);
          catalogDB.updateProductDirect(product.id, merged);
          toRemove.add(existing.id);
          urlMap.set(nUrl, product);
        } else {
          const merged = mergeProducts(existing, product);
          catalogDB.updateProductDirect(existing.id, merged);
          toRemove.add(product.id);
        }
        vendorDupes++;
      } else {
        urlMap.set(nUrl, product);
      }
    }

    // ── Phase 2: Exact image URL dedup ──
    const imageMap = new Map();
    for (const product of vendorProducts) {
      if (toRemove.has(product.id)) continue;
      if (!product.image_url) continue;

      const imgKey = product.image_url.toLowerCase().replace(/[?#].*$/, "");
      if (imageMap.has(imgKey)) {
        const existing = imageMap.get(imgKey);
        const existingScore = completenessScore(existing);
        const newScore = completenessScore(product);

        if (newScore > existingScore) {
          const merged = mergeProducts(product, existing);
          catalogDB.updateProductDirect(product.id, merged);
          toRemove.add(existing.id);
          imageMap.set(imgKey, product);
        } else {
          const merged = mergeProducts(existing, product);
          catalogDB.updateProductDirect(existing.id, merged);
          toRemove.add(product.id);
        }
        vendorDupes++;
      } else {
        imageMap.set(imgKey, product);
      }
    }

    // ── Phase 3: Fuzzy name match (only within manageable groups) ──
    const remaining = vendorProducts.filter((p) => !toRemove.has(p.id));
    if (remaining.length <= 5000) {
      // Sort by name to make comparison faster (similar names cluster together)
      remaining.sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""));

      for (let i = 0; i < remaining.length; i++) {
        if (toRemove.has(remaining[i].id)) continue;

        // Only compare nearby products (name-sorted, window of 10)
        for (let j = i + 1; j < Math.min(i + 10, remaining.length); j++) {
          if (toRemove.has(remaining[j].id)) continue;

          const sim = similarity(remaining[i].product_name, remaining[j].product_name);
          if (sim >= 0.85) {
            const scoreI = completenessScore(remaining[i]);
            const scoreJ = completenessScore(remaining[j]);

            if (scoreJ > scoreI) {
              const merged = mergeProducts(remaining[j], remaining[i]);
              catalogDB.updateProductDirect(remaining[j].id, merged);
              toRemove.add(remaining[i].id);
            } else {
              const merged = mergeProducts(remaining[i], remaining[j]);
              catalogDB.updateProductDirect(remaining[i].id, merged);
              toRemove.add(remaining[j].id);
            }
            vendorDupes++;
          }
        }
      }
    }

    // Remove duplicates
    for (const id of toRemove) {
      catalogDB.deleteProduct(id);
      stats.products_removed++;
    }

    if (vendorDupes > 0) {
      stats.duplicates_found += vendorDupes;
      stats.products_merged += vendorDupes;
      stats.by_vendor[vendorId] = vendorDupes;
    }

    // Yield every 5 vendors
    if (stats.vendors_checked % 5 === 0) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  stats.finished_at = new Date().toISOString();
  stats.running = false;
  running = false;

  console.log(`[dedup] Complete: ${stats.duplicates_found} duplicates found, ${stats.products_removed} removed across ${stats.vendors_checked} vendors`);

  return stats;
}

/**
 * Get current job status.
 */
export function getDedupStatus() {
  return { ...stats };
}
