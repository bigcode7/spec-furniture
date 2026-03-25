/**
 * Catalog Database — Persistent JSON-backed product store with in-memory indexing
 *
 * Foundation of the three-tier search architecture for Spekd furniture platform.
 * Tier 1 (this): local catalog handles ~95% of searches with zero API cost.
 *
 * Storage: JSON file at search-service/data/catalog.db.json
 * Indexing: in-memory inverted index rebuilt on load/mutation
 * Search:   tokenized full-text with field-weighted scoring
 *
 * No external dependencies — uses only node:fs, node:path, node:crypto.
 */

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { tradeVendors } from "../config/trade-vendors.mjs";
import { getSynonyms, expandQuery, expandMaterial, parseDimensionConstraints, parsePriceSignals, detectCollectionInQuery } from "../lib/furniture-dictionary.mjs";
import { extractTags } from "../lib/product-tagger.mjs";
import { normalizeToMasterCategory } from "../lib/category-normalizer.mjs";
import { computeQualityScore } from "../lib/quality-scorer.mjs";
import { inferCategoryFromName, detectQueryCategory } from "../lib/query-category-filter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Paths ────────────────────────────────────────────────────

const DATA_DIR = path.resolve(__dirname, "../../data");
const DB_PATH = path.join(DATA_DIR, "catalog.db.json");

// ── In-Memory State ──────────────────────────────────────────

/** @type {Map<string, object>} id → product */
let products = new Map();

/** @type {Map<string, Set<string>>} token → Set<productId> */
let invertedIndex = new Map();

/** @type {Map<string, object>} vendorId → { last_crawled_at, product_count } */
let vendorCrawlMeta = new Map();

/** Debounce timer for disk writes */
let saveTimer = null;
const SAVE_DEBOUNCE_MS = 5000; // 5s debounce (longer to batch bulk imports)

/** Whether the DB has been initialized */
let initialized = false;

// ── Search Cache ─────────────────────────────────────────────

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/** @type {Map<string, { results: Array, expires: number }>} */
let searchCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

// Synonyms now powered by furniture-dictionary.mjs (imported above)

// ── Tokenization ─────────────────────────────────────────────

/**
 * Normalize and tokenize a string into search tokens.
 * Strips punctuation, lowercases, splits on whitespace.
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

// ── Tag Generation ───────────────────────────────────────────

/**
 * Auto-generate search tags from product fields.
 * Uses the furniture dictionary for synonyms and the product tagger
 * for deep extraction from descriptions.
 */
function generateTags(product, rawDescription) {
  const tagSet = new Set();

  // Split product_name into words
  const nameTokens = tokenize(product.product_name);
  for (const t of nameTokens) tagSet.add(t);

  // Add core fields as tags
  if (product.category) {
    for (const t of tokenize(product.category)) tagSet.add(t);
  }
  if (product.material) {
    for (const t of tokenize(product.material)) tagSet.add(t);
  }
  if (product.style) {
    for (const t of tokenize(product.style)) tagSet.add(t);
  }
  if (product.color) {
    for (const t of tokenize(product.color)) tagSet.add(t);
  }
  if (product.vendor_name) {
    for (const t of tokenize(product.vendor_name)) tagSet.add(t);
  }

  // Add collection words
  if (product.collection) {
    for (const t of tokenize(product.collection)) tagSet.add(t);
  }

  // ── Smart tagging: extract furniture-specific tags from description ──
  // Use the full raw description (not truncated) for better extraction
  const productForTagger = {
    ...product,
    description: rawDescription || product.description,
  };
  const smartTags = extractTags(productForTagger);
  for (const st of smartTags) tagSet.add(st);

  // ── Dictionary synonyms: expand key tags with furniture synonyms ──
  const tagsArray = [...tagSet];
  for (const tag of tagsArray) {
    const syns = getSynonyms(tag);
    if (syns.length > 1) { // getSynonyms always returns at least the input
      for (const syn of syns) {
        for (const word of syn.split(/\s+/)) {
          tagSet.add(word);
        }
      }
    }
  }

  // Cap at 80 tags to keep index manageable
  const result = [...tagSet];
  return result.length > 80 ? result.slice(0, 80) : result;
}

// ── Search Text Builder ──────────────────────────────────────

/**
 * Build a pre-computed lowercase search string from all product fields.
 * Used for fast full-text matching.
 */
function buildSearchText(product) {
  return [
    product.product_name,
    product.vendor_name,
    product.vendor_id,
    product.collection,
    product.category,
    product.material,
    product.style,
    product.color,
    product.description,
    product.sku,
    ...(product.tags || []),
    product.ai_visual_tags,
    // AI visual analysis fields — the goldmine for semantic search
    product.ai_furniture_type,
    product.ai_silhouette,
    product.ai_arm_style,
    product.ai_back_style,
    product.ai_leg_style,
    product.ai_primary_material,
    product.ai_primary_color,
    product.ai_style,
    product.ai_formality,
    product.ai_scale,
    product.ai_mood,
    product.ai_description,
    ...(product.ai_distinctive_features || []),
    ...(product.ai_search_terms || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// ── Product Normalization ────────────────────────────────────

/**
 * Normalize a raw product object into the canonical schema.
 * Handles data from sample-catalog, crawl results, and manual entries.
 */
function normalizeProduct(raw, source = "manual") {
  const now = new Date().toISOString();

  // Handle 'colors' array from sample catalog → take first as 'color'
  const color = raw.color || (Array.isArray(raw.colors) && raw.colors.length > 0 ? raw.colors[0] : null);

  const product = {
    id: raw.id || `${raw.vendor_id || "unknown"}_${slugify(raw.product_name || "product")}`,
    product_name: raw.product_name || "",
    vendor_id: raw.vendor_id || "",
    vendor_name: raw.vendor_name || "",
    vendor_domain: raw.vendor_domain || "",
    vendor_tier: raw.vendor_tier ?? (tradeVendors.find(tv => tv.id === raw.vendor_id)?.tier || null),
    collection: raw.collection || null,
    sku: raw.sku || null,
    category: normalizeCategory(raw.category || ""),
    material: raw.material || null,
    dimensions: raw.dimensions || null,
    style: raw.style || null,
    color: color,
    image_url: raw.image_url || null,
    images: Array.isArray(raw.images) ? raw.images : (raw.image_url ? [raw.image_url] : []),
    product_url: raw.product_url || null,
    description: raw.description ? String(raw.description).slice(0, 300) : null,
    retail_price: typeof raw.retail_price === "number" ? raw.retail_price : null,
    wholesale_price: typeof raw.wholesale_price === "number" ? raw.wholesale_price : null,
    tags: [],
    ingestion_source: raw.ingestion_source || source,
    created_at: raw.created_at || now,
    updated_at: now,
    last_verified_at: raw.last_verified_at || null,
    ai_visual_tags: raw.ai_visual_tags || null,
    ai_category_mismatch: raw.ai_category_mismatch || null,
    ai_suggested_category: raw.ai_suggested_category || null,
    image_quality: raw.image_quality || null,
    com_available: raw.com_available || false,
    customizable: raw.customizable || false,
    made_to_order: raw.made_to_order || false,
    search_text: "",
  };

  // Category group from master tree
  const { category: masterCat, group } = normalizeToMasterCategory(raw.category || "");
  product.category_group = group;

  // Infer category from product name — fixes both fallback categories AND misclassifications
  if (product.product_name) {
    const inferred = inferCategoryFromName(product.product_name);
    if (inferred && inferred !== product.category) {
      product.category = inferred;
      const { group: inferredGroup } = normalizeToMasterCategory(inferred);
      product.category_group = inferredGroup;
    }
  }

  // Generate tags (pass full raw description for deep extraction) and search text
  product.tags = generateTags(product, raw.description ? String(raw.description) : null);
  product.search_text = buildSearchText(product);

  // Quality score
  product.quality_score = computeQualityScore(product);

  return product;
}

/**
 * Normalize category strings to canonical master category.
 * Delegates to the full category normalizer with master tree.
 */
function normalizeCategory(raw) {
  if (!raw) return "decorative-objects";
  const { category } = normalizeToMasterCategory(raw);
  return category;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ── Inverted Index ───────────────────────────────────────────

/**
 * Rebuild the entire inverted index from all products.
 * Tokenizes each product's search_text and maps tokens → product IDs.
 */
function rebuildIndex() {
  invertedIndex = new Map();
  for (const [id, product] of products) {
    indexProduct(id, product);
  }
}

/**
 * Add a single product to the inverted index.
 */
function indexProduct(id, product) {
  const tokens = tokenize(product.search_text);
  const unique = new Set(tokens);
  for (const token of unique) {
    let set = invertedIndex.get(token);
    if (!set) {
      set = new Set();
      invertedIndex.set(token, set);
    }
    set.add(id);
  }
}

/**
 * Remove a single product from the inverted index.
 */
function unindexProduct(id, product) {
  const tokens = tokenize(product.search_text);
  const unique = new Set(tokens);
  for (const token of unique) {
    const set = invertedIndex.get(token);
    if (set) {
      set.delete(id);
      if (set.size === 0) invertedIndex.delete(token);
    }
  }
}

// ── Disk Persistence ─────────────────────────────────────────

/**
 * Load the database from disk. Returns true if a file was loaded.
 */
async function resolveLFSPointer() {
  if (!fs.existsSync(DB_PATH)) return;
  const head = fs.readFileSync(DB_PATH, "utf8").slice(0, 200);
  if (!head.startsWith("version https://git-lfs")) return;

  // This is an LFS pointer — download the real file from GitHub
  console.log("[catalog-db] LFS pointer detected, downloading catalog from GitHub...");
  const oidMatch = head.match(/oid sha256:([a-f0-9]+)/);
  if (!oidMatch) { console.error("[catalog-db] Could not parse LFS OID"); return; }
  const oid = oidMatch[1];
  const sizeMatch = head.match(/size (\d+)/);
  const expectedSize = sizeMatch ? parseInt(sizeMatch[1]) : 0;

  try {
    // Use GitHub LFS batch API (works for public repos without auth)
    const batchResp = await fetch("https://github.com/bigcode7/spec-furniture.git/info/lfs/objects/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/vnd.git-lfs+json" },
      body: JSON.stringify({ operation: "download", transfers: ["basic"], objects: [{ oid, size: expectedSize }] }),
    });
    if (!batchResp.ok) throw new Error(`LFS batch API returned ${batchResp.status}`);
    const batch = await batchResp.json();
    const obj = batch.objects?.[0];
    const downloadUrl = obj?.actions?.download?.href;
    if (!downloadUrl) throw new Error("No download URL in LFS response");

    console.log(`[catalog-db] Downloading ${(expectedSize / 1024 / 1024).toFixed(0)}MB catalog...`);
    const dlResp = await fetch(downloadUrl);
    if (!dlResp.ok) throw new Error(`Download failed: ${dlResp.status}`);
    const buffer = Buffer.from(await dlResp.arrayBuffer());
    fs.writeFileSync(DB_PATH, buffer);
    console.log(`[catalog-db] Catalog downloaded successfully (${(buffer.length / 1024 / 1024).toFixed(0)}MB)`);
  } catch (err) {
    console.error(`[catalog-db] LFS download failed: ${err.message}`);
  }
}

/**
 * Download catalog from CATALOG_URL if the file doesn't exist on disk.
 * Supports direct download URLs (S3, R2, Dropbox, Google Drive, etc.)
 */
let catalogDownloadedFromURL = false;

async function downloadCatalogIfMissing() {
  // Skip download if catalog exists and is large enough (>50MB = real catalog)
  if (fs.existsSync(DB_PATH)) {
    const size = fs.statSync(DB_PATH).size;
    console.log(`[catalog-db] Existing catalog file: ${(size / 1024 / 1024).toFixed(1)}MB`);
    if (size > 50_000_000) {
      // Full catalog on volume — disable disk writes to protect it
      if (process.env.CATALOG_URL) catalogDownloadedFromURL = true;
      return;
    }
    console.log(`[catalog-db] Catalog too small (${(size / 1024 / 1024).toFixed(1)}MB < 50MB) — re-downloading full catalog`);
    fs.unlinkSync(DB_PATH);
  }

  // Support single URL or comma-separated URLs for split catalogs
  const urlEnv = process.env.CATALOG_URL;
  if (!urlEnv) return;
  const urls = urlEnv.split(",").map(u => u.trim()).filter(Boolean);

  console.log(`[catalog-db] No catalog on disk — downloading ${urls.length} part(s) from CATALOG_URL...`);
  try {
    let mergedProducts = [];
    let baseData = {};

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[catalog-db] Downloading part ${i + 1}/${urls.length}...`);
      const resp = await fetch(url, { redirect: "follow" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
      let buffer = Buffer.from(await resp.arrayBuffer());
      // Auto-detect gzip (magic bytes 1f 8b)
      if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
        buffer = gunzipSync(buffer);
      }
      const part = JSON.parse(buffer.toString("utf8"));
      if (i === 0) baseData = { ...part, products: undefined };
      if (part.products) mergedProducts.push(...part.products);
    }

    const merged = { ...baseData, products: mergedProducts };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(merged));
    catalogDownloadedFromURL = true;
    console.log(`[catalog-db] Downloaded catalog — ${mergedProducts.length} products`);
  } catch (err) {
    console.error(`[catalog-db] Catalog download failed: ${err.message}`);
  }
}

function loadFromDisk() {
  if (!fs.existsSync(DB_PATH)) return false;

  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const data = JSON.parse(raw);

    // Load products
    products = new Map();
    if (Array.isArray(data.products)) {
      for (const p of data.products) {
        if (p.id) products.set(p.id, p);
      }
    }

    // Load vendor crawl metadata
    vendorCrawlMeta = new Map();
    if (data.vendor_crawl_meta && typeof data.vendor_crawl_meta === "object") {
      for (const [k, v] of Object.entries(data.vendor_crawl_meta)) {
        vendorCrawlMeta.set(k, v);
      }
    }

    // Take initial vendor snapshot for safety checks
    lastKnownVendorCounts = snapshotVendorCounts();
    console.log(`[catalog-db] Vendor snapshot: ${lastKnownVendorCounts.size} vendors tracked`);

    return true;
  } catch (err) {
    console.error(`[catalog-db] Failed to load from disk: ${err.message}`);
    return false;
  }
}

/** Track vendor counts for safety checks */
let lastKnownVendorCounts = new Map();

function snapshotVendorCounts() {
  const counts = new Map();
  for (const product of products.values()) {
    const vid = product.vendor_id || "unknown";
    counts.set(vid, (counts.get(vid) || 0) + 1);
  }
  return counts;
}

/**
 * Safety check: detect if any vendor lost all products or if total dropped too much.
 * Returns { safe: boolean, warnings: string[] }
 */
function validateBeforeWrite() {
  const warnings = [];
  const currentCounts = snapshotVendorCounts();

  if (lastKnownVendorCounts.size > 0) {
    // Check for vendors that completely disappeared
    for (const [vendor, prevCount] of lastKnownVendorCounts) {
      const newCount = currentCounts.get(vendor) || 0;
      if (prevCount >= 10 && newCount === 0) {
        warnings.push(`VENDOR WIPED: "${vendor}" had ${prevCount} products, now has 0`);
      }
    }

    // Check for unexpected large drops (>500 products lost)
    const prevTotal = [...lastKnownVendorCounts.values()].reduce((a, b) => a + b, 0);
    const newTotal = products.size;
    const dropped = prevTotal - newTotal;
    if (dropped > 500) {
      warnings.push(`MASS DELETION: ${dropped} products lost (${prevTotal} → ${newTotal})`);
    }
  }

  return { safe: warnings.length === 0, warnings };
}

/**
 * Serialize and write the database to disk.
 */
function writeToDisk() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Safety check before writing
  const { safe, warnings } = validateBeforeWrite();
  if (!safe) {
    for (const w of warnings) console.error(`[catalog-db] ⚠ SAFETY WARNING: ${w}`);
    console.error(`[catalog-db] ⚠ Write blocked — ${warnings.length} safety violation(s). Use forceWriteToDisk() to override.`);
    return;
  }

  // Update vendor snapshot after successful validation
  lastKnownVendorCounts = snapshotVendorCounts();

  // Stream-write products to avoid holding entire JSON in memory.
  // Exclude search_text and tags from disk (rebuilt on load).
  const tmpPath = DB_PATH + ".tmp";
  const fd = fs.openSync(tmpPath, "w");

  fs.writeSync(fd, `{"version":1,"saved_at":"${new Date().toISOString()}","product_count":${products.size},"products":[\n`);

  let first = true;
  for (const product of products.values()) {
    if (!first) fs.writeSync(fd, ",\n");
    first = false;
    // Strip search_text and tags (rebuilt from fields on load)
    const { search_text, tags, ...slim } = product;
    fs.writeSync(fd, JSON.stringify(slim));
  }

  fs.writeSync(fd, `\n],"vendor_crawl_meta":${JSON.stringify(Object.fromEntries(vendorCrawlMeta))}}\n`);
  fs.closeSync(fd);

  // Atomic rename
  fs.renameSync(tmpPath, DB_PATH);
  console.log(`[catalog-db] Saved ${products.size} products to disk`);
}

/**
 * Force write to disk, bypassing safety checks. Use only when you intentionally
 * want to allow large deletions (e.g. cleanup scripts with --force flag).
 */
function forceWriteToDisk() {
  console.warn(`[catalog-db] ⚠ Force-writing ${products.size} products (safety checks bypassed)`);
  lastKnownVendorCounts = snapshotVendorCounts();

  const tmpPath = DB_PATH + ".tmp";
  const fd = fs.openSync(tmpPath, "w");
  fs.writeSync(fd, `{"version":1,"saved_at":"${new Date().toISOString()}","product_count":${products.size},"products":[\n`);
  let first = true;
  for (const product of products.values()) {
    if (!first) fs.writeSync(fd, ",\n");
    first = false;
    const { search_text, tags, ...slim } = product;
    fs.writeSync(fd, JSON.stringify(slim));
  }
  fs.writeSync(fd, `\n],"vendor_crawl_meta":${JSON.stringify(Object.fromEntries(vendorCrawlMeta))}}\n`);
  fs.closeSync(fd);
  fs.renameSync(tmpPath, DB_PATH);
  console.warn(`[catalog-db] Force-saved ${products.size} products`);
}

/**
 * Schedule a debounced write to disk.
 * Waits SAVE_DEBOUNCE_MS after the last mutation before writing.
 */
function scheduleSave() {
  // On Railway (ephemeral filesystem), skip disk writes — catalog is downloaded fresh each deploy
  if (catalogDownloadedFromURL) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      writeToDisk();
    } catch (err) {
      console.error(`[catalog-db] Disk write failed: ${err.message}`);
    }
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

// ── Search Cache Helpers ─────────────────────────────────────

/**
 * Build a deterministic cache key from query + filters.
 */
function buildCacheKey(query, filters, limit) {
  const normalized = query.toLowerCase().trim().replace(/\s+/g, " ");
  const filterStr = JSON.stringify(filters, Object.keys(filters).sort());
  return createHash("md5").update(`${normalized}|${filterStr}|${limit}`).digest("hex");
}

/**
 * Prune expired entries from the search cache.
 */
function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of searchCache) {
    if (entry.expires <= now) searchCache.delete(key);
  }
}

// ── Fuzzy Matching Helpers ────────────────────────────────────

/** Common misspelling/accent normalizations */
const FUZZY_MAP = {
  "boucle": "bouclé", "boucl\u00e9": "boucle",
  "midcentury": "mid-century", "mid-century": "midcentury",
  "mid century": "mid-century",
  "midmod": "mid-century-modern", "mcm": "mid-century-modern",
  "grey": "gray",
  "catalogue": "catalog",
  "colour": "color",
  "etagere": "\u00e9tag\u00e8re",
  "papier mache": "papier-mâché",
  "cafe": "caf\u00e9",
  "naive": "na\u00efve",
  "chaise longue": "chaise-lounge",
};

function fuzzyNormalize(token) {
  // Strip accents for matching
  const stripped = token.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return FUZZY_MAP[stripped] || FUZZY_MAP[token] || stripped;
}

// ── Scoring Engine ───────────────────────────────────────────

/**
 * Score a product against a set of query tokens.
 *
 * Scoring tiers:
 *   - Exact phrase match in product_name: +5.0 bonus
 *   - Exact word match:   base score
 *   - Prefix match:       0.7x base
 *   - Substring match:    0.4x base
 *   - Fuzzy match:        0.5x base
 *
 * Field boosts:
 *   - product_name:  3.5x (highest — strongest signal)
 *   - collection:    2.5x
 *   - category:      2.5x
 *   - vendor_name:   2.0x
 *   - material:      2.0x
 *   - style:         1.5x
 *   - color:         1.5x
 *   - dimensions:    1.0x
 *   - tags:          1.0x
 *   - description:   0.8x
 *
 * Quality score tiebreaker: +0 to +0.5 based on data completeness
 */
function scoreProduct(product, queryTokens, originalQuery) {
  let totalScore = 0;

  // ── Exact phrase match bonus ──
  if (originalQuery) {
    const queryLower = originalQuery.toLowerCase();
    if (product.product_name && product.product_name.toLowerCase().includes(queryLower)) {
      totalScore += 8.0; // Big bonus for exact phrase in name
    }
    // AI description/search_terms phrase match
    if (product.ai_description && product.ai_description.toLowerCase().includes(queryLower)) {
      totalScore += 6.0;
    }
    if (product.ai_search_terms?.some(t => t.toLowerCase().includes(queryLower))) {
      totalScore += 7.0;
    }
  }

  // Pre-tokenize fields for exact matching
  // AI fields contribute ~70% of relevance, old metadata ~30%
  const fields = [
    // ── AI fields (high boosts — these are the goldmine) ──
    { tokens: [...(product.ai_search_terms || []).map(t => t.toLowerCase())], boost: 7.0 },
    { tokens: tokenize(product.ai_furniture_type), boost: 6.0 },
    { tokens: [...(product.ai_distinctive_features || []).map(t => t.toLowerCase())], boost: 6.0 },
    { tokens: tokenize(product.ai_silhouette), boost: 5.0 },
    { tokens: tokenize(product.ai_arm_style), boost: 5.0 },
    { tokens: tokenize(product.ai_back_style), boost: 5.0 },
    { tokens: tokenize(product.ai_leg_style), boost: 4.5 },
    { tokens: tokenize(product.ai_mood), boost: 4.0 },
    { tokens: tokenize(product.ai_style), boost: 4.0 },
    { tokens: tokenize(product.ai_primary_material), boost: 4.0 },
    { tokens: tokenize(product.ai_primary_color), boost: 3.5 },
    { tokens: tokenize(product.ai_formality), boost: 3.0 },
    { tokens: tokenize(product.ai_scale), boost: 2.5 },
    { tokens: tokenize(product.ai_description), boost: 2.0 },
    { tokens: tokenize(product.ai_visual_tags), boost: 5.0 },
    // ── Traditional fields (lower boosts) ──
    { tokens: tokenize(product.product_name), boost: 3.5 },
    { tokens: tokenize(product.category), boost: 2.5 },
    { tokens: tokenize(product.collection), boost: 1.5 },
    { tokens: tokenize(product.vendor_name), boost: 1.2 },
    { tokens: tokenize(product.material), boost: 1.5 },
    { tokens: tokenize(product.style), boost: 1.0 },
    { tokens: tokenize(product.color), boost: 1.0 },
    { tokens: tokenize(product.dimensions), boost: 0.3 },
    { tokens: product.tags || [], boost: 0.6 },
    { tokens: tokenize(product.description), boost: 0.4 },
  ];

  for (const qt of queryTokens) {
    let bestTokenScore = 0;
    const fuzzyQt = fuzzyNormalize(qt);

    for (const field of fields) {
      for (const ft of field.tokens) {
        let matchScore = 0;

        if (ft === qt) {
          // Exact word match
          matchScore = 1.0 * field.boost;
        } else if (ft.startsWith(qt) || qt.startsWith(ft)) {
          // Prefix match
          matchScore = 0.7 * field.boost;
        } else if (ft.includes(qt) || qt.includes(ft)) {
          // Substring match
          matchScore = 0.4 * field.boost;
        } else if (fuzzyQt !== qt) {
          // Fuzzy match — try normalized version
          const fuzzyFt = fuzzyNormalize(ft);
          if (fuzzyFt === fuzzyQt || fuzzyFt.includes(fuzzyQt) || fuzzyQt.includes(fuzzyFt)) {
            matchScore = 0.5 * field.boost;
          }
        }

        if (matchScore > bestTokenScore) {
          bestTokenScore = matchScore;
        }
      }
    }

    totalScore += bestTokenScore;
  }

  // Quality score boost (#10): 0 to 1.5 points (increased from 0.5)
  const qs = product.quality_score || 0;
  if (qs > 70) totalScore += 1.5;
  else if (qs > 50) totalScore += 1.0;
  else if (qs > 30) totalScore += 0.5;
  else totalScore += qs / 200;

  // Data richness bonus (#10): products with images + dims + materials rank higher
  if (product.image_url && product.image_url.length > 10) totalScore += 0.3;
  if (product.dimensions) totalScore += 0.2;
  if (product.material) totalScore += 0.2;

  // Vendor tier boost (#9): trade vendors (tier 1-2) rank higher
  const tier = product.vendor_tier;
  if (tier === 1) totalScore += 2.0;
  else if (tier === 2) totalScore += 1.0;

  // Deprioritize known retail/non-trade vendors
  const retailVendors = ["abc-home", "lulu-and-georgia", "mcgee-and-co", "high-fashion-home", "schoolhouse"];
  if (retailVendors.includes(product.vendor_id)) {
    totalScore *= 0.6;
  }

  // Image quality: broken/missing ranked lower, HQ boosted
  if (product.bad_image) {
    totalScore *= 0.40; // Heavy penalty — bad_image products must NOT appear in top 20
  } else if (product.image_quality === "broken" || product.image_quality === "missing") {
    totalScore *= 0.80; // Stronger penalty
  } else if (product.needs_better_image) {
    totalScore *= 0.92; // Mild penalty for known-bad images
  } else if (product.image_quality === "verified-hq") {
    totalScore *= 1.08;
  }

  return totalScore;
}

// ── Sample Catalog Seeding ───────────────────────────────────

/**
 * Import products from the sample catalog and seed the database.
 * Only adds products that don't already exist.
 */
async function seedFromSampleCatalog() {
  try {
    const samplePath = path.resolve(__dirname, "../data/sample-catalog.mjs");
    const { sampleCatalog } = await import(samplePath);

    if (!Array.isArray(sampleCatalog) || sampleCatalog.length === 0) {
      console.log("[catalog-db] No sample catalog data found");
      return 0;
    }

    let added = 0;
    for (const raw of sampleCatalog) {
      const product = normalizeProduct(raw, "sample-catalog");
      if (!products.has(product.id)) {
        products.set(product.id, product);
        indexProduct(product.id, product);
        added++;
      }
    }

    if (added > 0) {
      scheduleSave();
      console.log(`[catalog-db] Seeded ${added} products from sample catalog`);
    }

    return added;
  } catch (err) {
    console.error(`[catalog-db] Failed to seed from sample catalog: ${err.message}`);
    return 0;
  }
}

// ── Exported API ─────────────────────────────────────────────

/**
 * Initialize the catalog database.
 * Loads existing data from disk, builds indices, and seeds from sample catalog.
 */
export async function initCatalogDB() {
  await resolveLFSPointer();
  await downloadCatalogIfMissing();
  const loaded = loadFromDisk();
  if (loaded) {
    console.log(`[catalog-db] Loaded ${products.size} products from disk`);
  } else {
    console.log("[catalog-db] No existing database found, starting fresh");
  }

  // Regenerate tags and search_text for all products (stripped from disk to save space)
  // Also backfill missing/wrong categories from product names
  let categoryBackfilled = 0;
  for (const [id, product] of products) {
    // Category backfill: if product has fallback category OR name strongly suggests a different one
    const cat = (product.category || "").toLowerCase();
    const isFallback = !cat || cat === "decorative-objects" || cat === "furniture" || cat === "default" || cat === "miscellaneous";
    const inferred = inferCategoryFromName(product.product_name);
    if (inferred && inferred !== cat) {
      // Name-based inference disagrees with stored category — trust the name
      // inferCategoryFromName does specific-before-generic matching, so "floor lamp"
      // won't match the generic "lamp" pattern. Its result is authoritative.
      product.category = inferred;
      const { group } = normalizeToMasterCategory(inferred);
      product.category_group = group;
      categoryBackfilled++;
    } else if (isFallback && !inferred) {
      // Leave as-is — no better inference available
    }
    product.tags = generateTags(product);
    product.search_text = buildSearchText(product);
  }
  if (categoryBackfilled > 0) {
    console.log(`[catalog-db] Backfilled ${categoryBackfilled} product categories from names`);
  }

  // Build the inverted index
  rebuildIndex();

  // Free search_text from memory after indexing
  for (const product of products.values()) {
    product.search_text = "";
  }
  console.log(`[catalog-db] Index built: ${invertedIndex.size} unique tokens`);

  // Seed from sample catalog (only adds missing products)
  await seedFromSampleCatalog();

  // Reset cache
  searchCache = new Map();
  cacheHits = 0;
  cacheMisses = 0;

  initialized = true;
  console.log(`[catalog-db] Ready — ${products.size} products indexed`);
}

/**
 * Upsert a single product into the database.
 * If a product with the same ID exists, it is updated.
 * Rebuilds the index entry and schedules a disk save.
 *
 * @param {object} raw - Product data (will be normalized)
 * @returns {object} The normalized product
 */
export function insertProduct(raw) {
  const product = normalizeProduct(raw, raw.ingestion_source || "manual");

  // Remove old index entry if updating
  const existing = products.get(product.id);
  if (existing) {
    unindexProduct(product.id, existing);
    // Preserve original created_at on update
    product.created_at = existing.created_at;
    // Preserve existing images if new product has none
    if ((!product.images || product.images.length === 0) && existing.images?.length > 0) {
      product.images = existing.images;
    }
  }

  products.set(product.id, product);
  indexProduct(product.id, product);
  clearSearchCache();
  scheduleSave();

  return product;
}

/**
 * Bulk upsert products into the database.
 * More efficient than calling insertProduct() in a loop — rebuilds index once.
 *
 * @param {Array<object>} rawProducts - Array of product data
 * @returns {{ inserted: number, updated: number }}
 */
export function insertProducts(rawProducts) {
  let inserted = 0;
  let updated = 0;

  for (const raw of rawProducts) {
    const product = normalizeProduct(raw, raw.ingestion_source || "manual");

    const existing = products.get(product.id);
    if (existing) {
      product.created_at = existing.created_at;
      // Preserve existing images if new product has none
      if ((!product.images || product.images.length === 0) && existing.images?.length > 0) {
        product.images = existing.images;
      }
      unindexProduct(product.id, existing);
      updated++;
    } else {
      inserted++;
    }

    products.set(product.id, product);
    indexProduct(product.id, product);

    // Free search_text from memory after indexing (saves ~40% RAM)
    product.search_text = "";
  }

  clearSearchCache();
  scheduleSave();

  return { inserted, updated };
}

/**
 * Full-text search with scoring and filtering.
 *
 * Uses the inverted index for candidate retrieval, then scores each
 * candidate using field-weighted matching.
 *
 * @param {string} query - Search query
 * @param {object} filters - Optional filters: vendor_id, category, style, material, max_price, vendor_tier
 * @param {number} limit - Maximum results (default 50)
 * @returns {Array<object>} Products sorted by relevance score
 */
export function searchCatalogDB(query, filters = {}, limit = 50) {
  const cacheKey = buildCacheKey(query || "", filters, limit);

  // Check cache
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    cacheHits++;
    return cached.results
      .map(({ id, score }) => {
        const p = products.get(id);
        return p ? { ...p, relevance_score: score } : null;
      })
      .filter(Boolean);
  }
  cacheMisses++;

  // ── Parse negative terms — "not X", "-X", "no X", "without X", "exclude X" ──
  let cleanedQuery = (query || "").trim();
  const negativeTerms = [];

  // "not X"
  const negMatch = cleanedQuery.match(/\bnot\s+(\S+)/gi);
  if (negMatch) {
    for (const m of negMatch) negativeTerms.push(m.replace(/^not\s+/i, "").toLowerCase());
    cleanedQuery = cleanedQuery.replace(/\bnot\s+\S+/gi, "").trim();
  }
  // "no X" (but not "no." abbreviation, and handle multiple: "no X no Y")
  let noM;
  const noRegex = /\bno\s+([a-z]\w*)/gi;
  while ((noM = noRegex.exec(cleanedQuery)) !== null) {
    const term = noM[1].toLowerCase();
    if (!["more", "less", "than", "the", "a"].includes(term)) {
      negativeTerms.push(term);
    }
  }
  cleanedQuery = cleanedQuery.replace(/\bno\s+[a-z]\w*/gi, "").trim();
  // "without X"
  const withoutMatch = cleanedQuery.match(/\bwithout\s+(\S+)/gi);
  if (withoutMatch) {
    for (const m of withoutMatch) negativeTerms.push(m.replace(/^without\s+/i, "").toLowerCase());
    cleanedQuery = cleanedQuery.replace(/\bwithout\s+\S+/gi, "").trim();
  }
  // "exclude X"
  const excludeMatch = cleanedQuery.match(/\bexclude\s+(\S+)/gi);
  if (excludeMatch) {
    for (const m of excludeMatch) negativeTerms.push(m.replace(/^exclude\s+/i, "").toLowerCase());
    cleanedQuery = cleanedQuery.replace(/\bexclude\s+\S+/gi, "").trim();
  }
  // Minus prefix: "chair -swivel"
  const minusMatch = cleanedQuery.match(/\s-(\S+)/g);
  if (minusMatch) {
    for (const m of minusMatch) negativeTerms.push(m.replace(/^\s*-/, "").toLowerCase());
    cleanedQuery = cleanedQuery.replace(/\s-\S+/g, "").trim();
  }

  // ── Parse dimension constraints from query ──
  const dimConstraints = parseDimensionConstraints(cleanedQuery);
  // Clean dimension tokens from query so they don't pollute keyword search
  if (dimConstraints) {
    cleanedQuery = cleanedQuery
      .replace(/(?:under|less than|over|more than|at least|max|min|up to)\s+\d+(?:\.\d+)?\s*(?:inches?|in|"|'')?(?:\s*(?:wide|width|deep|depth|tall|height|high|w|d|h))?\b/gi, "")
      .replace(/\d+\s*(?:inches?|in|"|'')\s+(?:wide|deep|tall|long)/gi, "")
      .replace(/seats?\s+\d+/gi, "")
      .trim();
  }

  // ── Parse price signals from query ──
  const priceSignals = parsePriceSignals(cleanedQuery);
  if (priceSignals) {
    cleanedQuery = cleanedQuery
      .replace(/(?:under|over|above|below|less than|more than|starting at|up to|budget|max|min)\s*\$?\s*\d[\d,]*/gi, "")
      .replace(/\$\s*\d[\d,]*\s*(?:-|to)\s*\$?\s*\d[\d,]*/gi, "")
      .trim();
  }

  // ── Detect collection in query ──
  const collectionHint = detectCollectionInQuery(cleanedQuery);

  const queryTokens = tokenize(cleanedQuery);

  // ── Detect vendor name as hard filter ──
  // If a query token exactly matches a vendor name, treat as a hard filter
  let vendorHardFilter = filters.vendor || null;
  const nonVendorTokens = [];
  if (!vendorHardFilter) {
    const queryLower = cleanedQuery.toLowerCase();
    for (const v of tradeVendors) {
      const vName = v.name.toLowerCase();
      if (queryLower.includes(vName) || queryLower.includes(v.id)) {
        vendorHardFilter = v.id;
        // Remove vendor name tokens from search
        const vendorTokens = tokenize(vName);
        for (const qt of queryTokens) {
          if (!vendorTokens.includes(qt)) nonVendorTokens.push(qt);
        }
        break;
      }
    }
  }
  const searchTokens = nonVendorTokens.length > 0 ? nonVendorTokens : queryTokens;

  // ── Find candidate products using inverted index ──
  let candidateIds;

  if (searchTokens.length === 0) {
    candidateIds = new Set(products.keys());
  } else {
    candidateIds = new Set();

    for (const qt of searchTokens) {
      const fuzzyQt = fuzzyNormalize(qt);

      for (const [indexedToken, productIds] of invertedIndex) {
        if (
          indexedToken === qt ||
          indexedToken.startsWith(qt) ||
          indexedToken.includes(qt) ||
          qt.startsWith(indexedToken)
        ) {
          for (const id of productIds) candidateIds.add(id);
        }
        // Fuzzy index match
        if (fuzzyQt !== qt) {
          const fuzzyIndexed = fuzzyNormalize(indexedToken);
          if (fuzzyIndexed === fuzzyQt || fuzzyIndexed.startsWith(fuzzyQt)) {
            for (const id of productIds) candidateIds.add(id);
          }
        }
      }
    }

    // Synonym expansion
    const expandedTokens = expandQuery(searchTokens);
    for (const st of expandedTokens) {
      if (searchTokens.includes(st)) continue;
      for (const [indexedToken, productIds] of invertedIndex) {
        if (indexedToken === st || indexedToken.startsWith(st)) {
          for (const id of productIds) candidateIds.add(id);
        }
      }
    }
  }

  // ── Score and filter candidates ──
  const results = [];

  for (const id of candidateIds) {
    const product = products.get(id);
    if (!product) continue;

    // Vendor hard filter (from query or explicit filter)
    if (vendorHardFilter) {
      const matchesVendor = product.vendor_id === vendorHardFilter ||
        (product.vendor_name || "").toLowerCase().includes(vendorHardFilter.toLowerCase());
      if (!matchesVendor) continue;
    }

    // Other filters
    if (filters.vendor_id && product.vendor_id !== filters.vendor_id) continue;
    if (filters.category && product.category !== normalizeCategory(filters.category)) continue;
    if (filters.style && product.style !== filters.style) continue;
    if (filters.material) {
      const mat = (product.material || "").toLowerCase();
      if (!mat.includes(filters.material.toLowerCase())) continue;
    }
    if (filters.max_price != null && product.retail_price != null) {
      if (product.retail_price > filters.max_price) continue;
    }
    if (filters.vendor_tier != null && product.vendor_tier !== filters.vendor_tier) continue;

    // Extended array filters (from faceted filtering UI)
    if (filters.categories?.length) {
      const cat = (product.category || "").toLowerCase();
      if (!filters.categories.some(f => cat === f.toLowerCase() || cat.includes(f.toLowerCase().replace(/ /g, "-")))) continue;
    }
    if (filters.materials?.length) {
      const mat = (product.material || "").toLowerCase();
      if (!filters.materials.some(f => mat.includes(f.toLowerCase()))) continue;
    }
    if (filters.vendors?.length) {
      const vName = (product.vendor_name || "").toLowerCase();
      const vId = (product.vendor_id || "").toLowerCase();
      if (!filters.vendors.some(f => vName === f.toLowerCase() || vId === f.toLowerCase())) continue;
    }
    if (filters.styles?.length) {
      const st = (product.style || "").toLowerCase();
      if (!filters.styles.some(f => st === f.toLowerCase())) continue;
    }
    if (filters.min_price != null && product.retail_price != null) {
      if (product.retail_price < filters.min_price) continue;
    }

    // Negative term exclusion (#4 enhanced)
    if (negativeTerms.length > 0) {
      const productText = (product.product_name + " " + (product.category || "") + " " + (product.material || "") + " " + (product.tags || []).join(" ")).toLowerCase();
      const excluded = negativeTerms.some((neg) => productText.includes(neg));
      if (excluded) continue;
    }

    // Dimension filtering (#3)
    if (dimConstraints) {
      const w = parseFloat(product.width) || 0;
      const d = parseFloat(product.depth) || 0;
      const h = parseFloat(product.height) || 0;
      // Only filter products that have dimensions (keep products without dims)
      if (w > 0 || d > 0 || h > 0) {
        if (dimConstraints.width_max && w > 0 && w > dimConstraints.width_max) continue;
        if (dimConstraints.width_min && w > 0 && w < dimConstraints.width_min) continue;
        if (dimConstraints.depth_max && d > 0 && d > dimConstraints.depth_max) continue;
        if (dimConstraints.depth_min && d > 0 && d < dimConstraints.depth_min) continue;
        if (dimConstraints.height_max && h > 0 && h > dimConstraints.height_max) continue;
        if (dimConstraints.height_min && h > 0 && h < dimConstraints.height_min) continue;
      }
    }

    // Price filtering (#9)
    if (priceSignals) {
      const price = product.retail_price || product.wholesale_price;
      if (price != null) {
        if (priceSignals.price_max && price > priceSignals.price_max) continue;
        if (priceSignals.price_min && price < priceSignals.price_min) continue;
      }
    }

    // Score (pass original query for phrase matching)
    let score = searchTokens.length > 0 ? scoreProduct(product, searchTokens, cleanedQuery) : 1;

    // Collection match boost (#8)
    if (collectionHint) {
      const coll = (product.collection || "").toLowerCase();
      const name = (product.product_name || "").toLowerCase();
      const collLower = collectionHint.toLowerCase();
      if (coll.includes(collLower)) score += 5.0;
      else if (name.includes(collLower)) score += 3.0;
    }

    // Dimension fit bonus (#3) — products that match requested dimensions rank higher
    if (dimConstraints) {
      const w = parseFloat(product.width) || 0;
      if (w > 0) score += 1.0; // Has dimensions = bonus
      if (dimConstraints.width_max && w > 0 && w <= dimConstraints.width_max) score += 1.5;
      if (dimConstraints.width_min && w > 0 && w >= dimConstraints.width_min) score += 1.5;
    }

    if (score > 0) {
      results.push({ ...product, relevance_score: score });
    }
  }

  // ── Rug demotion — prevent 10k rugs from drowning out furniture ──
  // Explicit rug queries ("rug", "area rug", "runner") → no change
  // Category-specific queries ("dining table", "sofa") → exclude rugs entirely
  // Open/room queries ("modern living room") → demote rugs below furniture
  const queryCat = detectQueryCategory(cleanedQuery, vendorHardFilter);
  const isRugQuery = queryCat.type === "product" && queryCat.categories?.includes("area-rugs");

  if (!isRugQuery && results.length > 0) {
    const isSpecificCategory = queryCat.type === "product" || queryCat.type === "natural-language";

    for (let i = results.length - 1; i >= 0; i--) {
      const cat = (results[i].category || "").toLowerCase();
      const isRug = cat === "area-rugs" || cat === "rugs" || cat.includes("rug");

      if (isRug) {
        if (isSpecificCategory) {
          // Hard exclude: "dining table" should NEVER return rugs
          results.splice(i, 1);
        } else {
          // Soft demote: open/room/vendor queries — push rugs below furniture
          results[i].relevance_score = Math.max(results[i].relevance_score * 0.3, 0.1);
        }
      }
    }
  }

  // Sort by score descending, then by quality_score, then by name
  results.sort((a, b) => {
    if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
    return (a.product_name || "").localeCompare(b.product_name || "");
  });

  const limited = results.slice(0, limit);

  // Cache
  searchCache.set(cacheKey, {
    results: limited.map((r) => ({ id: r.id, score: r.relevance_score })),
    expires: Date.now() + CACHE_TTL_MS,
  });

  if (searchCache.size > 500) pruneCache();

  return limited;
}

/**
 * Get a single product by ID.
 *
 * @param {string} id - Product ID
 * @returns {object|null} Product or null
 */
export function getProduct(id) {
  return products.get(id) || null;
}

/**
 * Get all products for a given vendor.
 *
 * @param {string} vendorId - Vendor ID
 * @param {number} limit - Maximum results (default 100)
 * @returns {Array<object>} Products
 */
export function getProductsByVendor(vendorId, limit = 100) {
  const results = [];
  for (const product of products.values()) {
    if (product.vendor_id === vendorId) {
      results.push(product);
      if (results.length >= limit) break;
    }
  }
  return results;
}

/**
 * Get total number of products in the catalog.
 *
 * @returns {number}
 */
export function getProductCount() {
  return products.size;
}

/**
 * Find products similar to a given product based on tag overlap.
 * Returns products from DIFFERENT vendors sorted by tag similarity.
 *
 * @param {string} productId - Source product ID
 * @param {number} limit - Max results (default 20)
 * @param {boolean} sameVendor - Include same vendor (default false)
 * @returns {Array<object>} Similar products with similarity_score
 */
export function findSimilarProducts(productId, limit = 20, sameVendor = false) {
  const source = products.get(productId);
  if (!source) return [];

  const sourceTags = new Set(source.tags || []);
  // Remove generic tokens that don't help with similarity
  const stopTags = new Set(["the", "and", "for", "with", "from"]);
  for (const st of stopTags) sourceTags.delete(st);

  if (sourceTags.size === 0) return [];

  // Use inverted index to find candidates efficiently
  const candidateScores = new Map();

  for (const tag of sourceTags) {
    const pids = invertedIndex.get(tag);
    if (!pids) continue;
    for (const pid of pids) {
      if (pid === productId) continue;
      candidateScores.set(pid, (candidateScores.get(pid) || 0) + 1);
    }
  }

  // Score and filter
  const results = [];
  for (const [pid, overlapCount] of candidateScores) {
    const candidate = products.get(pid);
    if (!candidate) continue;
    if (!sameVendor && candidate.vendor_id === source.vendor_id) continue;

    // Jaccard-like score: overlap / union
    const candidateTags = new Set(candidate.tags || []);
    for (const st of stopTags) candidateTags.delete(st);
    const unionSize = new Set([...sourceTags, ...candidateTags]).size;
    const similarity = unionSize > 0 ? overlapCount / unionSize : 0;

    // Boost if same category
    const categoryBoost = candidate.category === source.category ? 1.5 : 1.0;
    // Boost if same style
    const styleBoost = source.style && candidate.style === source.style ? 1.3 : 1.0;

    const finalScore = similarity * categoryBoost * styleBoost;
    if (finalScore > 0.05) { // Minimum threshold
      results.push({ ...candidate, similarity_score: finalScore });
    }
  }

  results.sort((a, b) => b.similarity_score - a.similarity_score);
  return results.slice(0, limit);
}

/**
 * Get comprehensive catalog statistics including image verification stats.
 */
export function getCatalogDBStats() {
  const byVendor = {};
  const byCategory = {};
  const byCategoryGroup = {};
  const bySource = {};
  const byTier = {};
  let verifiedImages = 0;
  let brokenImages = 0;
  let noImage = 0;
  let qualitySum = 0;

  for (const product of products.values()) {
    const vKey = product.vendor_name || product.vendor_id || "unknown";
    byVendor[vKey] = (byVendor[vKey] || 0) + 1;

    const cat = product.category || "uncategorized";
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    const grp = product.category_group || "other";
    byCategoryGroup[grp] = (byCategoryGroup[grp] || 0) + 1;

    const src = product.ingestion_source || "unknown";
    bySource[src] = (bySource[src] || 0) + 1;

    const tier = product.vendor_tier != null ? `tier_${product.vendor_tier}` : "untiered";
    byTier[tier] = (byTier[tier] || 0) + 1;

    // Image stats
    if (product.image_verified === true) verifiedImages++;
    else if (product.image_verified === false) brokenImages++;
    else if (!product.image_url) noImage++;

    qualitySum += product.quality_score || 0;
  }

  return {
    total_products: products.size,
    index_tokens: invertedIndex.size,
    images: {
      verified: verifiedImages,
      broken: brokenImages,
      no_image: noImage,
      unchecked: products.size - verifiedImages - brokenImages - noImage,
    },
    avg_quality_score: products.size > 0 ? Math.round(qualitySum / products.size) : 0,
    by_vendor: byVendor,
    by_category: byCategory,
    by_category_group: byCategoryGroup,
    by_source: bySource,
    by_tier: byTier,
    cache: getCacheStats(),
    db_path: DB_PATH,
    initialized,
  };
}

/**
 * Compute facets (filter counts) from a set of search results.
 * Returns sorted arrays of { value, count } for each facet dimension.
 */
export function computeFacets(results) {
  const buckets = {
    category: {},
    category_group: {},
    material: {},
    vendor: {},
    style: {},
    price_range: {},
    lead_time: {},
  };

  for (const p of results) {
    // Category
    if (p.category) {
      const cat = p.category.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      buckets.category[cat] = (buckets.category[cat] || 0) + 1;
    }
    // Category group
    if (p.category_group) {
      const grp = (p.category_group || "").replace(/\b\w/g, c => c.toUpperCase());
      buckets.category_group[grp] = (buckets.category_group[grp] || 0) + 1;
    }
    // Material — extract primary material keyword
    if (p.material) {
      const mat = p.material.split(/[,;\/]/)[0].trim();
      if (mat) {
        const matLabel = mat.replace(/\b\w/g, c => c.toUpperCase());
        buckets.material[matLabel] = (buckets.material[matLabel] || 0) + 1;
      }
    }
    // Vendor
    const vendor = p.vendor_name || p.vendor_id;
    if (vendor) buckets.vendor[vendor] = (buckets.vendor[vendor] || 0) + 1;
    // Style
    if (p.style) {
      const style = p.style.replace(/\b\w/g, c => c.toUpperCase());
      buckets.style[style] = (buckets.style[style] || 0) + 1;
    }
    // Price range
    const price = p.retail_price || p.wholesale_price;
    if (price != null) {
      const range = price < 500 ? "Under $500"
        : price < 1000 ? "$500 – $1,000"
        : price < 2000 ? "$1,000 – $2,000"
        : price < 5000 ? "$2,000 – $5,000"
        : "Over $5,000";
      buckets.price_range[range] = (buckets.price_range[range] || 0) + 1;
    }
    // Lead time
    if (p.lead_time_weeks) {
      const lt = Number(p.lead_time_weeks);
      const label = lt <= 1 ? "In Stock" : lt <= 4 ? "2–4 Weeks" : lt <= 8 ? "4–8 Weeks" : "8+ Weeks";
      buckets.lead_time[label] = (buckets.lead_time[label] || 0) + 1;
    }
  }

  // Convert to sorted arrays
  const toSorted = (obj) =>
    Object.entries(obj)
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);

  return {
    category: toSorted(buckets.category),
    category_group: toSorted(buckets.category_group),
    material: toSorted(buckets.material),
    vendor: toSorted(buckets.vendor),
    style: toSorted(buckets.style),
    price_range: toSorted(buckets.price_range),
    lead_time: toSorted(buckets.lead_time),
  };
}

// ── Job support functions ────────────────────────────────────

/**
 * Get all products as an iterable (for background jobs).
 */
export function getAllProducts() {
  return products.values();
}

/**
 * Update specific fields on a product without full re-normalization.
 * Used by background jobs (image verifier, enrichment, dedup).
 */
export function updateProductDirect(id, fields) {
  const product = products.get(id);
  if (!product) return false;

  Object.assign(product, fields);
  product.updated_at = new Date().toISOString();

  // Recompute quality score if relevant fields changed
  if (fields.image_verified !== undefined || fields.description || fields.material ||
      fields.dimensions || fields.retail_price || fields.image_urls) {
    product.quality_score = computeQualityScore(product);
  }

  // Re-index if searchable fields changed (ai_visual_tags, description, tags)
  if (fields.ai_visual_tags || fields.description || fields.tags) {
    unindexProduct(id, product);
    product.search_text = buildSearchText(product);
    indexProduct(id, product);
    product.search_text = ""; // Free memory
  }

  scheduleSave();
  return true;
}

/**
 * Delete a product by ID. Used by dedup job.
 * Safety: tracks per-vendor deletion counts and blocks if a vendor is being wiped.
 */
const _deletionBatch = new Map(); // vendor_id → count in current batch
let _deletionBatchTimer = null;

export function deleteProduct(id) {
  const product = products.get(id);
  if (!product) return false;

  // Track vendor-level deletion counts
  const vid = product.vendor_id || "unknown";
  _deletionBatch.set(vid, (_deletionBatch.get(vid) || 0) + 1);

  // Check if we're deleting too many from one vendor (>90% of their products)
  const vendorTotal = lastKnownVendorCounts.get(vid) || 0;
  const deletedFromVendor = _deletionBatch.get(vid);
  if (vendorTotal >= 20 && deletedFromVendor >= vendorTotal * 0.9) {
    console.error(`[catalog-db] ⚠ BLOCKED: Attempted to delete ${deletedFromVendor}/${vendorTotal} "${vid}" products. Use --force-delete-vendor=${vid} to override.`);
    return false;
  }

  unindexProduct(id, product);
  products.delete(id);
  clearSearchCache();
  scheduleSave();

  // Reset batch tracker after inactivity
  if (_deletionBatchTimer) clearTimeout(_deletionBatchTimer);
  _deletionBatchTimer = setTimeout(() => { _deletionBatch.clear(); _deletionBatchTimer = null; }, 10000);

  return true;
}

/**
 * Force-delete a product, bypassing vendor protection.
 * Only use when explicitly intended (e.g. --force-delete-vendor flag).
 */
export function forceDeleteProduct(id) {
  const product = products.get(id);
  if (!product) return false;
  unindexProduct(id, product);
  products.delete(id);
  clearSearchCache();
  scheduleSave();
  return true;
}

/**
 * Get all products grouped by vendor ID. Used by dedup job.
 */
export function getProductsByVendorGrouped() {
  const groups = new Map();
  for (const product of products.values()) {
    const vid = product.vendor_id || "unknown";
    if (!groups.has(vid)) groups.set(vid, []);
    groups.get(vid).push(product);
  }
  return groups;
}

/**
 * Re-normalize all categories using the master category tree.
 * Run once to clean up existing data.
 */
export function renormalizeAllCategories() {
  let changed = 0;
  for (const product of products.values()) {
    const oldCat = product.category;
    const { category, group } = normalizeToMasterCategory(oldCat);
    if (product.category !== category || product.category_group !== group) {
      product.category = category;
      product.category_group = group;
      changed++;
    }
  }
  if (changed > 0) {
    clearSearchCache();
    scheduleSave();
  }
  console.log(`[catalog-db] Re-normalized ${changed} product categories`);
  return changed;
}

/**
 * Recompute quality scores for all products.
 */
export function recomputeAllQualityScores() {
  let sum = 0;
  for (const product of products.values()) {
    product.quality_score = computeQualityScore(product);
    sum += product.quality_score;
  }
  const avg = products.size > 0 ? Math.round(sum / products.size) : 0;
  scheduleSave();
  console.log(`[catalog-db] Recomputed quality scores: avg=${avg}`);
  return avg;
}

/**
 * Get crawl metadata for a vendor.
 *
 * @param {string} vendorId
 * @returns {object|null} { last_crawled_at, product_count, ... }
 */
export function getVendorCrawlMeta(vendorId) {
  return vendorCrawlMeta.get(vendorId) || null;
}

/**
 * Set crawl metadata for a vendor.
 *
 * @param {string} vendorId
 * @param {object} meta - Metadata to store (e.g., { last_crawled_at, product_count })
 */
export function setVendorCrawlMeta(vendorId, meta) {
  vendorCrawlMeta.set(vendorId, {
    ...meta,
    updated_at: new Date().toISOString(),
  });
  scheduleSave();
}

/**
 * Clear the search cache and reset stats.
 */
export function flushToDisk() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  writeToDisk();
}

export { forceWriteToDisk, snapshotVendorCounts };

export function clearSearchCache() {
  searchCache.clear();
  // Don't reset hit/miss counters — they track lifetime stats
}

/**
 * Get search cache statistics.
 *
 * @returns {{ hits: number, misses: number, hit_rate: string, size: number }}
 */
export function getCacheStats() {
  const total = cacheHits + cacheMisses;
  const hitRate = total > 0 ? ((cacheHits / total) * 100).toFixed(1) + "%" : "0.0%";
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hit_rate: hitRate,
    size: searchCache.size,
  };
}
