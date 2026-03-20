/**
 * Search Enhancer — Six zero-cost improvements using existing data
 *
 * 1. Visual Tag Reverse Index — instant lookup of products by AI visual tag
 * 2. Tag Synonym Expansion — "barrel" also matches "curved back", "tub", etc.
 * 3. Collection Intelligence — inherit tags from collection siblings
 * 4. Vendor Style Profiles — aggregate visual tags per vendor for style matching
 * 5. Quality Gate — boost products with visual tags + verified images
 * 6. Click-Weighted Learning — CTR-based score adjustments from analytics
 */

// ── 1. VISUAL TAG REVERSE INDEX ─────────────────────────────

/** @type {Map<string, Set<string>>} tag → Set<productId> */
let visualTagIndex = new Map();

/** @type {Map<string, string[]>} productId → parsed tag array */
let productTagCache = new Map();

/**
 * Build the reverse index of visual tags → product IDs.
 * Call after catalog loads and after visual tagger runs.
 *
 * @param {Iterable<object>} products - All products from catalog DB
 */
export function buildVisualTagIndex(products) {
  visualTagIndex = new Map();
  productTagCache = new Map();
  let indexed = 0;

  for (const product of products) {
    if (!product.ai_visual_tags) continue;

    const tags = parseVisualTags(product.ai_visual_tags);
    productTagCache.set(product.id, tags);

    for (const tag of tags) {
      let set = visualTagIndex.get(tag);
      if (!set) {
        set = new Set();
        visualTagIndex.set(tag, set);
      }
      set.add(product.id);
    }
    indexed++;
  }

  console.log(`[search-enhancer] Visual tag index: ${indexed} products, ${visualTagIndex.size} unique tags`);
}

/**
 * Parse a comma-separated visual tag string into normalized individual tags.
 */
function parseVisualTags(tagString) {
  if (!tagString) return [];
  return tagString
    .toLowerCase()
    .split(",")
    .map(t => t.trim())
    .filter(t => t.length > 1);
}

/**
 * Find all product IDs that have a specific visual tag.
 *
 * @param {string} tag
 * @returns {Set<string>} product IDs
 */
export function getProductsByVisualTag(tag) {
  return visualTagIndex.get(tag.toLowerCase()) || new Set();
}

/**
 * Find all product IDs matching ANY of the given tags (union).
 *
 * @param {string[]} tags
 * @returns {Set<string>}
 */
export function getProductsByVisualTags(tags) {
  const result = new Set();
  for (const tag of tags) {
    const ids = visualTagIndex.get(tag.toLowerCase());
    if (ids) {
      for (const id of ids) result.add(id);
    }
  }
  return result;
}

// ── 2. TAG SYNONYM EXPANSION ────────────────────────────────

const TAG_SYNONYMS = {
  "barrel": ["barrel", "curved back", "round back", "tub", "barrel back"],
  "tufted": ["tufted", "button tufted", "diamond tufted", "biscuit tufted"],
  "nailhead": ["nailhead", "nailhead trim", "nail trim", "brass tacks"],
  "track arm": ["track arm", "straight arm", "square arm", "flat arm"],
  "rolled arm": ["rolled arm", "round arm", "scroll arm", "english arm"],
  "skirted": ["skirted", "skirt", "dressmaker", "tailored skirt"],
  "tight back": ["tight back", "attached back", "fixed back"],
  "loose back": ["loose back", "loose cushion back", "pillow back", "removable back"],
  "turned legs": ["turned legs", "turned leg", "spindle legs"],
  "tapered legs": ["tapered legs", "tapered leg", "conical legs"],
  "cabriole": ["cabriole", "cabriole leg", "queen anne leg"],
  "platform": ["platform", "platform bed", "low profile"],
  "pedestal": ["pedestal", "pedestal base", "column base", "tulip base"],
  "trestle": ["trestle", "trestle base", "sawhorse"],
  "parsons": ["parsons", "parsons style", "fully upholstered"],
  "performance fabric": ["performance fabric", "performance", "crypton", "sunbrella", "stain resistant", "indoor outdoor fabric"],
  "boucle": ["boucle", "bouclé", "textured wool", "nubby texture"],
  "velvet": ["velvet", "crushed velvet", "cotton velvet", "silk velvet"],
  "leather": ["leather", "top grain leather", "full grain leather", "aniline leather"],
  "linen": ["linen", "linen blend", "belgian linen", "natural linen"],
  "marble": ["marble", "marble top", "stone top", "calcutta", "carrara"],
  "travertine": ["travertine", "travertine top", "stone"],
  "walnut": ["walnut", "american walnut", "dark walnut", "walnut finish", "walnut veneer"],
  "oak": ["oak", "white oak", "cerused oak", "french oak", "weathered oak"],
  "brass": ["brass", "antique brass", "brushed brass", "polished brass", "brass hardware", "brass accents"],
  "cream": ["cream", "ivory", "off white", "vanilla", "parchment"],
  "cognac": ["cognac", "saddle", "caramel", "camel", "tan leather"],
  "navy": ["navy", "dark blue", "midnight blue", "indigo"],
  "sage": ["sage", "sage green", "muted green", "soft green"],
  "charcoal": ["charcoal", "dark gray", "dark grey", "anthracite", "graphite"],
  "modern": ["modern", "contemporary", "clean lines", "minimal"],
  "traditional": ["traditional", "classic", "formal", "timeless", "english"],
  "transitional": ["transitional", "updated traditional", "bridge", "classic modern"],
  "coastal": ["coastal", "beach", "nautical", "seaside", "resort"],
  "mid-century": ["mid-century", "mid century modern", "mcm", "retro modern", "atomic age"],
  "glam": ["glam", "glamorous", "hollywood regency", "luxe", "jeweled"],
  "farmhouse": ["farmhouse", "modern farmhouse", "rustic", "country"],
  "industrial": ["industrial", "loft", "urban", "factory", "raw"],
  "chesterfield": ["chesterfield", "chesterfield sofa", "button tufted sofa"],
  "wingback": ["wingback", "wing back", "wing chair", "high back"],
  "channel back": ["channel back", "channel tufted", "channeled", "vertical channel"],
  "saber legs": ["saber legs", "saber leg", "sabre legs"],
  "hairpin legs": ["hairpin legs", "hairpin", "wire legs"],
  "x base": ["x base", "x-base", "cross base"],
  "bench seat": ["bench seat", "single cushion", "one cushion"],
  "chenille": ["chenille", "soft texture", "plush fabric"],
  "rattan": ["rattan", "wicker", "cane", "woven"],
  "iron": ["iron", "wrought iron", "black metal", "forged"],
  "chrome": ["chrome", "polished chrome", "silver metal", "stainless"],
  "emerald": ["emerald", "emerald green", "jewel green", "deep green"],
  "blush": ["blush", "blush pink", "soft pink", "rose", "dusty rose"],
  "rust": ["rust", "terracotta", "burnt orange", "sienna"],
  "espresso": ["espresso", "dark brown", "dark finish", "java"],
  "camelback": ["camelback", "camel back", "arched back"],
  "shelter arm": ["shelter arm", "shelter", "high arm"],
  "sleigh bed": ["sleigh bed", "sleigh", "curved headboard footboard"],
  "four poster": ["four poster", "four-poster", "poster bed", "canopy"],
};

// Build reverse lookup: any synonym → canonical tag + all its synonyms
const synonymReverseLookup = new Map();
for (const [canonical, synonyms] of Object.entries(TAG_SYNONYMS)) {
  for (const syn of synonyms) {
    synonymReverseLookup.set(syn.toLowerCase(), synonyms);
  }
}

/**
 * Expand a search term through the synonym map.
 * Returns all equivalent terms, or just the original if no synonyms found.
 *
 * @param {string} term
 * @returns {string[]}
 */
export function expandTagSynonyms(term) {
  const lower = term.toLowerCase();
  const synonyms = synonymReverseLookup.get(lower);
  if (synonyms) return [...synonyms];

  // Try partial match: "barrel chair" contains "barrel"
  for (const [key, syns] of synonymReverseLookup) {
    if (lower.includes(key) || key.includes(lower)) {
      return [...syns];
    }
  }

  return [lower];
}

/**
 * Expand an array of keywords through the synonym map.
 * Returns deduplicated expanded keywords.
 *
 * @param {string[]} keywords
 * @returns {string[]}
 */
export function expandAllSynonyms(keywords) {
  const expanded = new Set();
  for (const kw of keywords) {
    for (const syn of expandTagSynonyms(kw)) {
      expanded.add(syn);
    }
  }
  return [...expanded];
}

/**
 * Find all product IDs matching a search term, expanded through synonyms.
 * Uses the visual tag reverse index for instant lookup.
 *
 * @param {string} term
 * @returns {Set<string>}
 */
export function findProductsBySynonymExpansion(term) {
  const expanded = expandTagSynonyms(term);
  return getProductsByVisualTags(expanded);
}

// ── 3. COLLECTION-LEVEL INTELLIGENCE ────────────────────────

/** @type {Map<string, string[]>} "vendorId:collection" → common tags */
let collectionProfiles = new Map();

/**
 * Build collection-level tag profiles from visual tags.
 * For each vendor+collection, compute the most common tags.
 *
 * @param {Iterable<object>} products
 */
export function buildCollectionProfiles(products) {
  // Group products by vendor + collection
  const groups = new Map(); // "vendorId:collection" → [tagArrays]

  for (const product of products) {
    if (!product.collection || !product.vendor_id) continue;
    const key = `${product.vendor_id}:${product.collection.toLowerCase()}`;

    if (!groups.has(key)) groups.set(key, []);
    const tags = productTagCache.get(product.id) || parseVisualTags(product.ai_visual_tags);
    if (tags.length > 0) {
      groups.get(key).push({ id: product.id, tags });
    }
  }

  collectionProfiles = new Map();
  let enriched = 0;

  for (const [key, items] of groups) {
    if (items.length < 3) continue; // Need at least 3 tagged products

    // Count tag frequencies
    const tagCounts = new Map();
    for (const { tags } of items) {
      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Tags that appear in >50% of collection products
    const threshold = items.length * 0.5;
    const commonTags = [...tagCounts.entries()]
      .filter(([_, count]) => count >= threshold)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 10);

    if (commonTags.length > 0) {
      collectionProfiles.set(key, commonTags);
      enriched++;
    }
  }

  console.log(`[search-enhancer] Collection profiles: ${enriched} collections with shared tags`);
}

/**
 * Get collection-level tags for a product.
 * Returns inherited tags from the collection profile.
 *
 * @param {object} product
 * @returns {string[]}
 */
export function getCollectionTags(product) {
  if (!product.collection || !product.vendor_id) return [];
  const key = `${product.vendor_id}:${product.collection.toLowerCase()}`;
  return collectionProfiles.get(key) || [];
}

// ── 4. VENDOR STYLE PROFILES ────────────────────────────────

/** @type {Map<string, { topTags: string[], tagCounts: Map<string, number> }>} */
let vendorProfiles = new Map();

/**
 * Build vendor-level style profiles from visual tags.
 *
 * @param {Iterable<object>} products
 */
export function buildVendorProfiles(products) {
  const vendorTags = new Map(); // vendorId → Map<tag, count>

  for (const product of products) {
    if (!product.vendor_id) continue;
    const tags = productTagCache.get(product.id) || parseVisualTags(product.ai_visual_tags);
    if (tags.length === 0) continue;

    if (!vendorTags.has(product.vendor_id)) {
      vendorTags.set(product.vendor_id, new Map());
    }
    const counts = vendorTags.get(product.vendor_id);
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  vendorProfiles = new Map();

  for (const [vendorId, counts] of vendorTags) {
    const totalProducts = [...counts.values()].reduce((a, b) => a + b, 0);
    const topTags = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag]) => tag);

    vendorProfiles.set(vendorId, { topTags, tagCounts: counts });
  }

  console.log(`[search-enhancer] Vendor profiles: ${vendorProfiles.size} vendors profiled`);
}

/**
 * Get vendors whose style profile matches the given search terms.
 * Returns a Map of vendorId → match score (0-1).
 *
 * @param {string[]} searchTerms
 * @returns {Map<string, number>}
 */
export function getMatchingVendors(searchTerms) {
  const expanded = expandAllSynonyms(searchTerms);
  const expandedSet = new Set(expanded);
  const matches = new Map();

  for (const [vendorId, profile] of vendorProfiles) {
    let hits = 0;
    for (const tag of profile.topTags.slice(0, 10)) {
      if (expandedSet.has(tag)) hits++;
      // Also check if any expanded term is contained in the tag or vice versa
      for (const term of expanded) {
        if (tag.includes(term) || term.includes(tag)) {
          hits += 0.5;
          break;
        }
      }
    }
    if (hits > 0) {
      matches.set(vendorId, Math.min(hits / 3, 1.0)); // Normalize to 0-1
    }
  }

  return matches;
}

// ── 5. QUALITY GATE SCORING ─────────────────────────────────

/**
 * Compute a quality gate score for search result ranking.
 *
 * @param {object} product
 * @returns {number} bonus points (0-35)
 */
export function qualityGateScore(product) {
  let bonus = 0;

  // Has visual tags: +20 (AI looked at this product and described it)
  if (product.ai_visual_tags && product.ai_visual_tags.length > 10) {
    bonus += 20;
  }

  // Has a working image: +15
  if (product.image_url && product.image_url.length > 10) {
    if (product.image_quality === "verified-hq") {
      bonus += 15;
    } else if (product.image_quality !== "broken" && product.image_quality !== "missing") {
      bonus += 10;
    }
    // broken/missing images get 0
  }

  // No visual tags AND no image: penalty
  if (!product.ai_visual_tags && (!product.image_url || product.image_quality === "broken" || product.image_quality === "missing")) {
    bonus -= 15;
  }

  return bonus;
}

// ── 6. CLICK-WEIGHTED LEARNING ──────────────────────────────

/** @type {Map<string, number>} productId → click-based score adjustment */
let clickBoosts = new Map();

/**
 * Build click-weighted adjustments from analytics data.
 * Products with above-average CTR get boosted, below-average get reduced.
 *
 * @param {Map<string, number>} productClicks - productId → click count
 * @param {number} totalSearches - total search count for normalization
 */
export function buildClickBoosts(productClicks, totalSearches) {
  clickBoosts = new Map();

  if (!productClicks || productClicks.size === 0) return;

  // Compute average clicks per clicked product
  let totalClicks = 0;
  for (const clicks of productClicks.values()) {
    totalClicks += clicks;
  }
  const avgClicks = totalClicks / productClicks.size;

  for (const [productId, clicks] of productClicks) {
    if (clicks >= avgClicks * 2) {
      clickBoosts.set(productId, 15); // Well above average
    } else if (clicks >= avgClicks) {
      clickBoosts.set(productId, 10); // Above average
    } else if (clicks >= 2) {
      clickBoosts.set(productId, 5); // Some engagement
    }
    // Products with 1 click: no boost (could be noise)
  }

  console.log(`[search-enhancer] Click boosts: ${clickBoosts.size} products with engagement signals`);
}

/**
 * Get the click-based score adjustment for a product.
 *
 * @param {string} productId
 * @returns {number}
 */
export function getClickBoost(productId) {
  return clickBoosts.get(productId) || 0;
}

// ── UNIFIED SCORING FUNCTION ────────────────────────────────

/**
 * Compute the full enhanced score for a product in search results.
 * Combines all 6 improvements into a single score adjustment.
 *
 * @param {object} product
 * @param {string[]} searchKeywords - expanded keywords from query
 * @param {Map<string, number>} vendorMatchScores - from getMatchingVendors()
 * @returns {number} total score adjustment to add to existing score
 */
export function computeEnhancedScore(product, searchKeywords, vendorMatchScores) {
  let bonus = 0;

  // 1. VISUAL TAG MATCHING — equal weight to product name
  const productTags = productTagCache.get(product.id) || parseVisualTags(product.ai_visual_tags);
  const collTags = getCollectionTags(product);
  const allTags = [...productTags, ...collTags];

  if (allTags.length > 0) {
    // Expand search keywords through synonyms
    const expandedKeywords = expandAllSynonyms(searchKeywords);

    for (const kw of expandedKeywords) {
      for (const tag of allTags) {
        if (tag === kw) {
          bonus += 25; // Exact visual tag match — equal to product name weight
          break;
        } else if (tag.includes(kw) || kw.includes(tag)) {
          bonus += 15; // Partial visual tag match
          break;
        }
      }
    }
  }

  // 1b. AI FIELD MATCHING — search_terms and distinctive_features
  const aiTerms = product.ai_search_terms || [];
  const aiFeatures = product.ai_distinctive_features || [];
  if (aiTerms.length > 0 || aiFeatures.length > 0) {
    const expandedKeywords = expandAllSynonyms(searchKeywords);
    for (const kw of expandedKeywords) {
      for (const term of aiTerms) {
        const tLower = term.toLowerCase();
        if (tLower === kw) { bonus += 20; break; }
        else if (tLower.includes(kw) || kw.includes(tLower)) { bonus += 12; break; }
      }
      for (const feat of aiFeatures) {
        const fLower = feat.toLowerCase();
        if (fLower === kw) { bonus += 18; break; }
        else if (fLower.includes(kw) || kw.includes(fLower)) { bonus += 10; break; }
      }
    }
  }

  // 4. VENDOR STYLE PROFILE BOOST
  if (vendorMatchScores && vendorMatchScores.has(product.vendor_id)) {
    bonus += vendorMatchScores.get(product.vendor_id) * 10; // Up to +10
  }

  // 5. QUALITY GATE
  bonus += qualityGateScore(product);

  // 6. CLICK-WEIGHTED LEARNING
  bonus += getClickBoost(product.id);

  return bonus;
}

// ── INITIALIZATION ──────────────────────────────────────────

/**
 * Initialize all search enhancements.
 * Call after catalog DB is loaded.
 *
 * @param {Iterable<object>} products - All products
 * @param {{ productClicks: Map<string, number>, totalSearches: number }} analytics
 */
export function initSearchEnhancer(products, analytics = {}) {
  const startMs = Date.now();

  // Convert to array for multiple iterations
  const productArray = [...products];

  // 1. Build visual tag reverse index
  buildVisualTagIndex(productArray);

  // 3. Build collection profiles (depends on visual tag cache from step 1)
  buildCollectionProfiles(productArray);

  // 4. Build vendor profiles
  buildVendorProfiles(productArray);

  // 6. Build click boosts
  if (analytics.productClicks) {
    buildClickBoosts(analytics.productClicks, analytics.totalSearches || 0);
  }

  console.log(`[search-enhancer] All enhancements initialized in ${Date.now() - startMs}ms`);
}

/**
 * Get enhancer stats for the admin dashboard.
 */
export function getEnhancerStats() {
  return {
    visual_tag_index_size: visualTagIndex.size,
    products_with_tags: productTagCache.size,
    collection_profiles: collectionProfiles.size,
    vendor_profiles: vendorProfiles.size,
    click_boosts: clickBoosts.size,
    synonym_groups: Object.keys(TAG_SYNONYMS).length,
  };
}
