/**
 * Catalog Cleanup Job — Scan and fix ALL products
 *
 * Comprehensive quality cleanup across the entire catalog:
 * 1. Product name cleanup (strip vendor names, SKUs, internal labels)
 * 2. Description cleanup (strip JSON, HTML, CSS, JS, spam)
 * 3. Image URL validation (404 checks, logo/placeholder detection, duplicate detection)
 * 4. Flag bad_image products so search ranking deprioritizes them
 * 5. Enhanced images array with type + priority classification
 * 6. Report totals
 */

import { tradeVendors } from "../config/trade-vendors.mjs";
import { BLOCKED_VENDOR_IDS, isVendorBlocked } from "../config/vendor-blocklist.mjs";

// ── Module state ──────────────────────────────────────────────

let running = false;
let stopRequested = false;
let status = {
  started_at: null,
  finished_at: null,
  phase: null,
  progress: null,
  totals: {
    products_scanned: 0,
    names_cleaned: 0,
    descriptions_fixed: 0,
    descriptions_nulled: 0,
    images_flagged_bad: 0,
    images_swapped: 0,
    image_404s: 0,
    duplicate_image_groups: 0,
    products_no_usable_image: 0,
    images_classified: 0,
    bad_image_set: 0,
  },
  errors: [],
};

export function getCatalogCleanupStatus() {
  return { running, ...status };
}

export function stopCatalogCleanup() {
  if (running) {
    stopRequested = true;
    return { message: "Stop requested" };
  }
  return { message: "Not running" };
}

// ── Vendor name patterns ──────────────────────────────────────

// Build per-vendor name patterns — only strip a vendor's own name from its products
const VENDOR_PATTERNS_MAP = buildVendorPatternsMap();

function buildVendorPatternsMap() {
  const map = new Map();

  const extras = {
    "hooker": ["Hooker Furnishings", "Hooker Furniture Corporation", "HF Custom"],
    "bernhardt": ["Bernhardt Furniture", "Bernhardt Interiors"],
    "cr-laine": ["C.R. Laine", "C R Laine", "CRLAINE"],
    "lee-industries": ["Lee Ind", "Lee Ind."],
    "hickory-chair": ["Hickory Chair Co"],
    "century": ["Century Furniture LLC"],
    "vanguard": ["Vanguard Furniture Company"],
    "lexington": ["Lexington Home Brands", "Lexington Furniture"],
    "universal": ["Universal Furniture International"],
    "theodore-alexander": ["TA Studio"],
    "caracole": ["Caracole Furniture"],
    "baker": ["Baker Furniture", "Baker, Knapp & Tubbs"],
    "stickley": ["Stickley Furniture", "L. & J.G. Stickley"],
    "sherrill": ["Sherrill Furniture Company"],
    "wesley-hall": ["Wesley Hall Inc"],
    "hancock-moore": ["Hancock & Moore", "Hancock and Moore"],
    "highland-house": ["Highland House Furniture"],
    "fourhands": ["Four Hands", "FourHands"],
  };

  for (const v of tradeVendors) {
    const patterns = [];
    const names = new Set([v.name]);
    names.add(v.domain.replace(/\.com$/, "").replace(/^www\./, ""));
    names.add(v.id.replace(/-/g, " "));

    if (extras[v.id]) {
      for (const extra of extras[v.id]) {
        names.add(extra);
      }
    }

    // Sort by length descending so longer patterns match first
    const sorted = [...names].filter(n => n.length >= 3).sort((a, b) => b.length - a.length);
    for (const name of sorted) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      patterns.push(new RegExp(`\\b${escaped}\\b`, "gi"));
    }

    map.set(v.id, patterns);
  }

  return map;
}

// ── SKU patterns ──────────────────────────────────────────────

// Common SKU formats: 4126-05SW, 9051-16, ABC-1234, 1234-5678-90
const SKU_PATTERNS = [
  /\b[A-Z]{1,4}[-\s]?\d{3,5}[-\s]?\d{0,4}[A-Z]{0,3}\b/g,  // ABC-12345, 4126-05SW
  /\b\d{4,6}[-]\d{2,4}[A-Z]{0,3}\b/g,                       // 9051-16, 1234-5678
  /\b[A-Z]{2,5}\d{4,8}\b/g,                                  // AB12345678
  /\bStyle\s*#?\s*\d+\b/gi,                                   // Style #1234
  /\bItem\s*#?\s*\d+\b/gi,                                    // Item #1234
  /\bModel\s*#?\s*\d+\b/gi,                                   // Model #1234
  /\bSKU\s*:?\s*\S+/gi,                                       // SKU: ABC123
];

// ── Internal label patterns ───────────────────────────────────

const INTERNAL_LABELS = [
  /\b(Pre-?Made\s+)?Sample\b/gi,
  /\bSpecial\s+Order\b/gi,
  /\bQuick\s+Ship\b/gi,
  /\bCustom\s+Order\b/gi,
  /\bMade\s+to\s+Order\b/gi,
  /\b(?:Grade\s+[A-Z0-9]+)\b/gi,           // Grade A, Grade 1
  /\bCOM\b/g,                                // Customer's Own Material
  /\bCOL\b/g,                                // Customer's Own Leather
  /\bAs\s+Shown\b/gi,
  /\bDiscontinued\b/gi,
  /\bClearance\b/gi,
  /\bIn\s+Stock\b/gi,
  /\bShips?\s+(in\s+)?\d+[-–]\d+\s+(weeks?|days?)\b/gi,
  /\bNew\s+Arrival\b/gi,
  /\bBest\s+Seller\b/gi,
  /\bExclusive\b/gi,
  /\bLimited\s+(Edition|Time)\b/gi,
  /\b(Starting\s+at|From)\s+\$[\d,.]+\b/gi,
  /\$[\d,.]+/g,                              // Any price
];

// ── Name cleanup ──────────────────────────────────────────────

function cleanProductName(name, vendorId, vendorName) {
  if (!name) return { cleaned: name, changed: false };

  let cleaned = name;
  const original = name;

  // 1a. Strip "- Vendor Name" or "| Vendor Name" suffix patterns first
  // e.g. "Traditions 6/6 Rails - Hooker Furnishings" → "Traditions 6/6 Rails"
  const vendorPatterns = VENDOR_PATTERNS_MAP.get(vendorId) || [];
  for (const pattern of vendorPatterns) {
    // Create a suffix version: " - VendorName" or " | VendorName"
    const src = pattern.source; // e.g. \bHooker Furnishings\b
    const suffixRe = new RegExp(`\\s*[-–—|]\\s*${src}\\s*$`, "gi");
    cleaned = cleaned.replace(suffixRe, "");
  }

  // 1b. Strip THIS vendor's name only (not all vendor names)
  for (const pattern of vendorPatterns) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, " ");
  }

  // 2. Strip SKU patterns (only if name has other meaningful content)
  const beforeSkuStrip = cleaned;
  for (const pattern of SKU_PATTERNS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, " ");
  }
  // If stripping SKUs left us with < 2 real words, revert
  const remainingWords = cleaned.replace(/[^a-zA-Z]/g, " ").trim().split(/\s+/).filter(w => w.length > 2);
  if (remainingWords.length < 2) {
    cleaned = beforeSkuStrip; // Revert SKU stripping
  }

  // 3. Strip internal labels
  for (const pattern of INTERNAL_LABELS) {
    pattern.lastIndex = 0;
    cleaned = cleaned.replace(pattern, " ");
  }

  // 4. Strip standalone industry words left over after vendor name removal
  // NOTE: Do NOT strip "Company", "Home" — they appear in product names (e.g. "Three's Company")
  cleaned = cleaned.replace(/\b(Furnishings?|Furniture|Home\s+Brands?|Industries|Inc\.?|LLC|Co\.?|Corporation|International)\b/gi, " ");

  // 5. Strip trailing pipe-separated suffixes (page titles like "SKU | Name | Collection | Vendor")
  // Repeatedly strip from right if the suffix is a vendor name, brand tag, or generic label
  for (let _pass = 0; _pass < 5; _pass++) {
    const pipeMatch = cleaned.match(/^(.+?)\s*\|\s*([^|]+?)\s*$/);
    if (!pipeMatch) break;
    const before = pipeMatch[1].trim();
    const suffix = pipeMatch[2].trim();
    if (before.length < 3) break; // Don't strip if nothing meaningful remains
    // Strip if it matches a vendor pattern or a known generic tag
    const isVendorTag = vendorPatterns.some(p => { p.lastIndex = 0; return p.test(suffix); });
    const isGenericTag = /^(Upholstery|Home\s*Brands?|Furniture|Collection|Trade|Design|Studio|Custom|Indoor|Outdoor)\b/i.test(suffix);
    if (isVendorTag || isGenericTag) {
      cleaned = before;
    } else {
      break;
    }
  }

  // 5b. Strip leading "SKU | " prefix (e.g. "1609-11 | Wilshire Chair")
  cleaned = cleaned.replace(/^\s*\d{3,6}[-]\d{1,4}[A-Z]{0,3}\s*\|\s*/, "");

  // 6. Strip trailing/leading prepositions/articles left dangling (AFTER pipe strip)
  cleaned = cleaned
    .replace(/\s+(for|by|from)\s*$/gi, "")
    ; // Don't strip leading words — they're often part of product names

  // 7. Clean up artifacts
  cleaned = cleaned
    .replace(/\s*[-–—|/\\]+\s*$/, "")    // Trailing separators
    .replace(/^\s*[-–—|/\\]+\s*/, "")    // Leading separators
    .replace(/\s*,\s*$/, "")              // Trailing commas
    .replace(/\(\s*\)/g, "")              // Empty parens
    .replace(/\[\s*\]/g, "")              // Empty brackets
    .replace(/\s*-\s*-\s*/g, " ")        // Double dashes
    .replace(/\s{2,}/g, " ")             // Multiple spaces
    .trim();

  // 5. Title case if all caps or all lower
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = titleCase(cleaned);
  }

  const changed = cleaned !== original && cleaned.length > 0;
  return { cleaned: cleaned || original, changed };
}

function titleCase(str) {
  const lower = ["a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", "to", "by", "in", "of", "with"];
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((word, i) => {
      if (i === 0 || !lower.includes(word)) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      return word;
    })
    .join(" ");
}

// ── Description cleanup ───────────────────────────────────────

function cleanDescription(desc) {
  if (!desc) return { cleaned: null, action: "none" };

  let cleaned = desc;

  // 1. Detect and reject JSON fragments
  if (/^\s*[\[{]/.test(cleaned) && /[\]}]\s*$/.test(cleaned)) {
    return { cleaned: null, action: "nulled_json" };
  }
  // JSON-like content embedded
  if (/"\w+":\s*["\[{]/.test(cleaned) || /\{\s*"/.test(cleaned)) {
    // Try to extract any readable text before/after
    cleaned = cleaned.replace(/\{[^}]*"[^"]*":\s*[^}]*\}/g, "").trim();
    if (cleaned.length < 10) return { cleaned: null, action: "nulled_json" };
  }

  // 2. Strip HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // 3. Strip CSS
  cleaned = cleaned.replace(/[a-z-]+\s*:\s*[^;]+;/gi, " ");
  cleaned = cleaned.replace(/\.[a-z_-]+\s*\{[^}]*\}/gi, " ");

  // 4. Strip JavaScript
  cleaned = cleaned.replace(/function\s*\([^)]*\)\s*\{[^}]*\}/gi, " ");
  cleaned = cleaned.replace(/var\s+\w+\s*=/gi, " ");
  cleaned = cleaned.replace(/document\.\w+/gi, " ");
  cleaned = cleaned.replace(/window\.\w+/gi, " ");

  // 5. Strip URL-heavy content (SEO spam)
  const urlCount = (cleaned.match(/https?:\/\//g) || []).length;
  if (urlCount > 3) {
    cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, "").trim();
  }

  // 6. Strip keyword stuffing (same word repeated 5+ times)
  const words = cleaned.toLowerCase().split(/\s+/);
  const freq = {};
  for (const w of words) {
    if (w.length > 3) freq[w] = (freq[w] || 0) + 1;
  }
  const maxFreq = Math.max(0, ...Object.values(freq));
  if (maxFreq > 8 && words.length < 100) {
    return { cleaned: null, action: "nulled_spam" };
  }

  // 7. Strip job listing content
  if (/\b(apply now|resume|salary|hiring|job (description|posting)|equal opportunity)\b/i.test(cleaned)) {
    return { cleaned: null, action: "nulled_job_listing" };
  }

  // 8. Clean up whitespace
  cleaned = cleaned
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // 9. Too short after cleaning
  if (cleaned.length < 10) {
    return { cleaned: null, action: "nulled_too_short" };
  }

  // 10. Description is just the product name repeated
  // (will check against product name in the main loop)

  // 11. Cap at 500 chars
  if (cleaned.length > 500) {
    cleaned = cleaned.slice(0, 497) + "...";
  }

  const changed = cleaned !== desc;
  return { cleaned, action: changed ? "fixed" : "none" };
}

// ── Image URL validation ──────────────────────────────────────

const BAD_IMAGE_PATTERNS = [
  /logo/i,
  /placeholder/i,
  /no.?image/i,
  /default/i,
  /spacer/i,
  /blank/i,
  /header/i,
  /banner/i,
  /badge/i,
  /icon/i,
  /sprite/i,
  /loading/i,
  /pixel\.gif/i,
  /1x1/i,
  /\.svg$/i,
  /mid-cluster/i,
  /hp_.*cluster/i,
  /essentials-/i,
  /marketing/i,
  /promo/i,
  /newsletter/i,
  /social-/i,
  /facebook|twitter|instagram|pinterest/i,
  /arrow|chevron|caret/i,
  /btn|button/i,
  /close|dismiss/i,
  /cart|checkout/i,
  /search-icon/i,
  /menu/i,
  /nav[_-]/i,
  /footer/i,
  /favicon/i,
  /retired\./i,
  /no_selection/i,
  /resizeimage$/i,
  /image-404/i,
  /ms-gray\./i,
  /lex-meta/i,
  /imagecabinet\/finishes/i,
];

// Patterns that suggest fabric texture closeups rather than full product shots
const FABRIC_TEXTURE_PATTERNS = [
  /swatch/i,
  /fabric[_-]?detail/i,
  /material[_-]?close/i,
  /texture[_-]/i,
  /weave[_-]/i,
  /upholstery[_-]?sample/i,
  /color[_-]?chip/i,
  /finish[_-]?sample/i,
];

function isKnownBadImageUrl(url) {
  if (!url || typeof url !== "string") return true;
  if (url.length < 15) return true;

  const lower = url.toLowerCase();

  // CSS class names or broken paths
  if (lower.includes("{") || lower.includes("}")) return true;
  if (lower.startsWith("data:")) return true;
  if (!lower.startsWith("http")) return true;

  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(lower)) return true;
  }

  return false;
}

function isFabricTexture(url) {
  if (!url) return false;
  for (const pattern of FABRIC_TEXTURE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  return false;
}

// ── Batch image URL checking ──────────────────────────────────

async function checkImageUrl(url) {
  if (!url || isKnownBadImageUrl(url)) return { ok: false, reason: "bad_pattern" };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: { "user-agent": "Spekd-Catalog/1.0" },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!res.ok) return { ok: false, reason: "http_" + res.status };

    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return { ok: false, reason: "not_image" };

    return { ok: true };
  } catch {
    return { ok: false, reason: "fetch_error" };
  }
}

// ── Image type classification ─────────────────────────────────

function classifyImageType(url, index, total) {
  if (!url) return "unknown";
  const lower = typeof url === "string" ? url.toLowerCase() : "";

  if (/swatch|fabric[_-]?option|material[_-]?option|color[_-]?option/i.test(lower)) return "fabric_options";
  if (/dimension|measurement|spec[_-]?sheet/i.test(lower)) return "dimensions";
  if (/room[_-]?scene|lifestyle|styled|vignette|setting|roomscene/i.test(lower)) return "room_scene";
  if (/detail|closeup|close-up|zoom/i.test(lower)) return "detail";
  if (/back|rear|side|angle|alt|alternate/i.test(lower)) return "alternate_angle";

  // First image is hero, second/third alternate, rest by type
  if (index === 0) return "hero";
  if (index <= 2) return "alternate_angle";
  if (index <= total - 2) return "detail";
  return "room_scene";
}

function classifyAndPrioritize(images) {
  if (!Array.isArray(images)) return [];

  const priorityMap = {
    hero: 1,
    alternate_angle: 2,
    detail: 4,
    room_scene: 5,
    fabric_options: 6,
    dimensions: 7,
    unknown: 8,
  };

  return images.map((img, i) => {
    const url = typeof img === "string" ? img : img?.url;
    if (!url) return null;

    // Already classified
    if (typeof img === "object" && img.type && img.priority) {
      return img;
    }

    const type = classifyImageType(url, i, images.length);
    return {
      url,
      type,
      priority: priorityMap[type] || 8,
    };
  }).filter(Boolean);
}

// ── Duplicate image detection ─────────────────────────────────

function findDuplicateImageGroups(allProducts) {
  const urlToProducts = new Map();

  for (const product of allProducts) {
    const primaryUrl = product.image_url;
    if (primaryUrl && typeof primaryUrl === "string" && primaryUrl.startsWith("http")) {
      // Normalize URL (strip query params for comparison)
      const normalized = primaryUrl.split("?")[0].toLowerCase();
      if (!urlToProducts.has(normalized)) urlToProducts.set(normalized, []);
      urlToProducts.get(normalized).push(product.id);
    }
  }

  // Groups with 3+ products sharing the same hero image
  const duplicateGroups = [];
  for (const [url, productIds] of urlToProducts) {
    if (productIds.length >= 3) {
      duplicateGroups.push({ url, count: productIds.length, product_ids: productIds.slice(0, 10) });
    }
  }

  return duplicateGroups.sort((a, b) => b.count - a.count);
}

// ── Non-furniture detection ───────────────────────────────────

const NON_FURNITURE_NAME_PATTERNS = [
  // Application / account pages crawled by mistake
  /\b(Application\s+Submitted|Login|Log\s+In|Sign\s+In|My\s+Account|Register|Create\s+Account|Forgot\s+Password|Reset\s+Password)\b/i,
  // Swatches, samples, color cards (also handle "81swatch" with no space)
  /swatch\s*(card)?/i,
  /\bFinish\s+Sample\b/i,
  /\bColor\s+Card\b/i,
  /\bLeather\s+Card\b/i,
  /\bFabric\s+Card\b/i,
  /\bSample\s+(Chip|Card|Kit|Pack|Set|Ring)\b/i,
  /\bWood\s+Sample\b/i,
  /\bStain\s+Sample\b/i,
  /\bFinish\s+Chip\b/i,
  // Material swatches identified by pattern: "Material Name Teardrop/Swatch"
  /\bTeardrop\b/i,
  // Standalone fabric names (SKU + "Fabric" like "4957-91 Fabric")
  /^\d{3,6}[-]\d{1,3}\s+Fabric$/i,
  // Warranty / care / info pages
  /\b(Warranty\s+Info|Care\s+Instructions|Shipping\s+Policy|Privacy\s+Policy|Terms\s+(of|&)\s+(Service|Use))\b/i,
  // Gift cards
  /\bGift\s+Card\b/i,
  // Catalog / brochure requests
  /\b(Request\s+a?\s*Catalog|Catalog\s+Request|Brochure\s+Request)\b/i,
  // Books, puzzles, non-furniture merchandise
  /\bJigsaw\s+Puzzle\b/i,
  /\b(Upholstery|Leather)\s+Index\b/i,
  // Pillows (standalone special-order pillows, not furniture with pillows)
  /^Pillow\s+\d+x\d+/i,
  // Finish samples named by material pattern
  /\bFinish\s+Sample\b/i,
];

// Image URL patterns that indicate a swatch/sample rather than furniture
const SWATCH_IMAGE_PATTERNS = [
  /swatch/i,
  /fabric[_-]?sample/i,
  /color[_-]?chip/i,
  /finish[_-]?chip/i,
  /material[_-]?sample/i,
  /leather[_-]?sample/i,
  /stain[_-]?sample/i,
  /wood[_-]?sample/i,
];

function isNonFurnitureProduct(product) {
  const name = product.product_name || "";

  // Check name patterns
  for (const pattern of NON_FURNITURE_NAME_PATTERNS) {
    if (pattern.test(name)) return true;
  }

  // Check visual tags if available — product tagged as fabric/swatch/texture but NOT as any furniture type
  if (Array.isArray(product.visual_tags) && product.visual_tags.length > 0) {
    const tags = product.visual_tags.map(t => (typeof t === "string" ? t : t.tag || "").toLowerCase());
    const swatchTags = tags.filter(t => /fabric|swatch|texture|material.?sample|color.?chip/.test(t));
    const furnitureTags = tags.filter(t => /sofa|chair|table|bed|desk|cabinet|dresser|shelf|lamp|mirror|rug|ottoman|bench|stool|console|bookcase|chest/.test(t));
    if (swatchTags.length > 0 && furnitureTags.length === 0) return true;
  }

  // Check if image URL looks like a swatch
  const imgUrl = product.image_url || "";
  for (const pattern of SWATCH_IMAGE_PATTERNS) {
    if (pattern.test(imgUrl)) {
      // Only flag if name also looks swatch-like (not just URL coincidence)
      if (/coal|grey|gray|tan|brown|cream|ivory|white|black|navy|blue|red|green|beige|taupe|cognac|camel|espresso|chocolate|mocha|charcoal|sage|olive|rust|amber|gold|silver|pearl|platinum|pewter/i.test(name)) {
        return true;
      }
    }
  }

  return false;
}

// ── Within-product image deduplication ────────────────────────

const MAX_IMAGES_PER_PRODUCT = 6;

/**
 * Normalize an image URL for dedup comparison — strips CDN transforms, query params,
 * size suffixes, and normalizes to hostname + clean path.
 */
function normalizeImageUrlForDedup(url) {
  if (!url || typeof url !== "string") return "";
  try {
    const u = new URL(typeof url === "object" ? url.url : url);
    // Remove common CDN transform params
    for (const key of ["w", "h", "width", "height", "fit", "q", "quality", "format", "fm",
                        "auto", "dpr", "crop", "cs", "fl", "blur", "sharp", "sat",
                        "bg", "trim", "pad", "border", "rect", "or", "rot",
                        "wid", "hei", "op_sharpen", "resMode", "op_usm",
                        "$", "sw", "sh", "sm", "sfrm", "bgcolor"]) {
      u.searchParams.delete(key);
    }
    let path = u.pathname.replace(/\/+$/, "").toLowerCase();
    // Remove size suffixes like _800x800, _large, _1024x1024
    path = path.replace(/_\d+x\d+/g, "");
    path = path.replace(/_(large|medium|small|thumb|thumbnail|compact|grande|master|original|pico|icon)/g, "");
    return `${u.hostname}${path}${u.searchParams.toString() ? "?" + u.searchParams.toString() : ""}`;
  } catch {
    return (typeof url === "object" ? url.url : url).toLowerCase().split("?")[0].replace(/\/+$/, "");
  }
}

/**
 * Extract just the filename from a URL for secondary dedup check.
 */
function extractImageFilename(url) {
  const raw = typeof url === "string" ? url : url?.url || "";
  if (!raw) return "";
  try {
    return new URL(raw).pathname.split("/").pop().split("?")[0].toLowerCase();
  } catch {
    return raw.split("/").pop().split("?")[0].toLowerCase();
  }
}

/**
 * Deduplicate images within a single product's images array.
 * Returns { deduped: Array, removed: number }
 */
function dedupeWithinProduct(images) {
  if (!Array.isArray(images) || images.length <= 1) {
    return { deduped: images || [], removed: 0 };
  }

  const seenNorm = new Map();   // normalizedUrl → first url
  const seenFnames = new Map(); // filename → first url
  const unique = [];

  for (const img of images) {
    const url = typeof img === "string" ? img : img?.url;
    if (!url || typeof url !== "string") continue;

    // Pass 1: exact normalized URL match
    const norm = normalizeImageUrlForDedup(url);
    if (seenNorm.has(norm)) continue;

    // Pass 2: same filename (vendors upload same photo with different path)
    const fname = extractImageFilename(url);
    if (fname && fname.length > 5 && seenFnames.has(fname)) continue;

    seenNorm.set(norm, url);
    if (fname && fname.length > 5) seenFnames.set(fname, url);
    unique.push(img);
  }

  // Cap at MAX_IMAGES_PER_PRODUCT
  const capped = unique.slice(0, MAX_IMAGES_PER_PRODUCT);

  return {
    deduped: capped,
    removed: images.length - capped.length,
  };
}

// ── Main cleanup ──────────────────────────────────────────────

export async function runCatalogCleanup(catalogDB, options = {}) {
  if (running) return { error: "Already running" };

  running = true;
  stopRequested = false;
  status = {
    started_at: new Date().toISOString(),
    finished_at: null,
    phase: "initializing",
    progress: null,
    totals: {
      products_scanned: 0,
      names_cleaned: 0,
      descriptions_fixed: 0,
      descriptions_nulled: 0,
      images_flagged_bad: 0,
      images_swapped: 0,
      image_404s: 0,
      duplicate_image_groups: 0,
      products_no_usable_image: 0,
      images_classified: 0,
      bad_image_set: 0,
      non_furniture_deleted: 0,
    },
    errors: [],
    sample_name_fixes: [],
    sample_desc_fixes: [],
    sample_non_furniture: [],
    duplicate_groups: [],
  };

  try {
    // Collect all products
    const allProducts = [];
    for (const p of catalogDB.getAllProducts()) {
      allProducts.push(p);
    }
    const totalProducts = allProducts.length;
    console.log(`[catalog-cleanup] Starting cleanup of ${totalProducts} products`);

    // ── PHASE 0: Delete non-furniture products ─────────────
    status.phase = "non_furniture_removal";
    console.log(`[catalog-cleanup] Phase 0: Non-furniture product removal`);

    const toDelete = [];
    for (const product of allProducts) {
      if (isNonFurnitureProduct(product)) {
        toDelete.push(product);
        if (status.sample_non_furniture.length < 30) {
          status.sample_non_furniture.push({
            id: product.id,
            vendor: product.vendor_id,
            name: product.product_name,
          });
        }
      }
    }

    for (const product of toDelete) {
      catalogDB.deleteProduct(product.id);
      const idx = allProducts.indexOf(product);
      if (idx !== -1) allProducts.splice(idx, 1);
      status.totals.non_furniture_deleted++;
    }

    console.log(`[catalog-cleanup] Non-furniture deleted: ${status.totals.non_furniture_deleted}`);
    if (status.sample_non_furniture.length > 0) {
      console.log(`[catalog-cleanup] Sample deletions:`);
      for (const s of status.sample_non_furniture.slice(0, 10)) {
        console.log(`[catalog-cleanup]   ${s.vendor}: "${s.name}"`);
      }
    }

    // ── PHASE 0b: Blocked vendor purge ─────────────────────
    if (!stopRequested && BLOCKED_VENDOR_IDS.size > 0) {
      status.phase = "blocked_vendor_purge";
      console.log(`[catalog-cleanup] Phase 0b: Purging blocked vendors: ${[...BLOCKED_VENDOR_IDS].join(", ")}`);

      if (!status.totals.blocked_vendors_purged) status.totals.blocked_vendors_purged = {};
      if (!status.totals.total_blocked_removed) status.totals.total_blocked_removed = 0;

      const blockedToDelete = [];
      for (const product of catalogDB.getAllProducts()) {
        if (isVendorBlocked(product.vendor_id)) {
          blockedToDelete.push(product.id);
          const vid = product.vendor_id;
          status.totals.blocked_vendors_purged[vid] = (status.totals.blocked_vendors_purged[vid] || 0) + 1;
          status.totals.total_blocked_removed++;
        }
      }

      for (const id of blockedToDelete) {
        catalogDB.deleteProduct(id);
      }
      // Also remove from our local array
      for (let i = allProducts.length - 1; i >= 0; i--) {
        if (isVendorBlocked(allProducts[i].vendor_id)) {
          allProducts.splice(i, 1);
        }
      }

      console.log(`[catalog-cleanup] Purged ${status.totals.total_blocked_removed} products from blocked vendors`);
      for (const [vid, count] of Object.entries(status.totals.blocked_vendors_purged)) {
        console.log(`[catalog-cleanup]   ${vid}: ${count} products removed`);
      }
    }

    // ── PHASE 0c: Within-product image deduplication ───────
    if (!stopRequested) {
      status.phase = "image_dedup";
      console.log(`[catalog-cleanup] Phase 0c: Within-product image deduplication (cap: ${MAX_IMAGES_PER_PRODUCT})`);

      if (!status.totals.image_dedup_products) status.totals.image_dedup_products = 0;
      if (!status.totals.image_dedup_total_removed) status.totals.image_dedup_total_removed = 0;
      if (!status.totals.image_dedup_by_vendor) status.totals.image_dedup_by_vendor = {};
      if (!status.totals.image_count_distribution) status.totals.image_count_distribution = {};

      for (let i = 0; i < allProducts.length; i++) {
        if (stopRequested) break;
        const product = allProducts[i];
        const images = product.images || [];

        if (images.length > 1) {
          const { deduped, removed } = dedupeWithinProduct(images);

          if (removed > 0) {
            status.totals.image_dedup_products++;
            status.totals.image_dedup_total_removed += removed;

            const vid = product.vendor_id || "unknown";
            if (!status.totals.image_dedup_by_vendor[vid]) {
              status.totals.image_dedup_by_vendor[vid] = { products_affected: 0, images_removed: 0 };
            }
            status.totals.image_dedup_by_vendor[vid].products_affected++;
            status.totals.image_dedup_by_vendor[vid].images_removed += removed;

            catalogDB.updateProductDirect(product.id, {
              images: deduped,
              image_url: (typeof deduped[0] === "string" ? deduped[0] : deduped[0]?.url) || product.image_url,
            });
            product.images = deduped; // Update local copy
          }
        }

        if (i % 5000 === 0) {
          status.progress = `${i}/${allProducts.length} image dedup`;
        }
      }

      // Compute image count distribution
      for (const product of allProducts) {
        const imgCount = (product.images || []).length || (product.image_url ? 1 : 0);
        const key = String(Math.min(imgCount, MAX_IMAGES_PER_PRODUCT));
        status.totals.image_count_distribution[key] = (status.totals.image_count_distribution[key] || 0) + 1;
      }

      console.log(`[catalog-cleanup] Image dedup: ${status.totals.image_dedup_products} products affected, ${status.totals.image_dedup_total_removed} images removed`);
      // Show worst vendors
      const sortedVendors = Object.entries(status.totals.image_dedup_by_vendor)
        .sort((a, b) => b[1].images_removed - a[1].images_removed);
      if (sortedVendors.length > 0) {
        console.log(`[catalog-cleanup] Worst vendors for image duplication:`);
        for (const [vid, s] of sortedVendors.slice(0, 10)) {
          console.log(`[catalog-cleanup]   ${vid}: ${s.products_affected} products, ${s.images_removed} images removed`);
        }
      }
      console.log(`[catalog-cleanup] Image count distribution:`, JSON.stringify(status.totals.image_count_distribution));
    }

    // ── PHASE 0d: Broken image vendor cleanup ──────────────
    if (!stopRequested && options.brokenImageVendors && options.brokenImageVendors.length > 0) {
      status.phase = "broken_image_cleanup";
      const vendorSet = new Set(options.brokenImageVendors.map(v => v.toLowerCase()));
      console.log(`[catalog-cleanup] Phase 0d: Broken image cleanup for vendors: ${[...vendorSet].join(", ")}`);

      if (!status.totals.broken_image_removed) status.totals.broken_image_removed = 0;
      if (!status.totals.broken_image_by_vendor) status.totals.broken_image_by_vendor = {};

      const brokenToDelete = [];
      for (const product of allProducts) {
        if (!vendorSet.has((product.vendor_id || "").toLowerCase())) continue;
        if (product.image_verified === false || product.image_quality === "broken" || product.bad_image === true) {
          brokenToDelete.push(product.id);
          const vid = product.vendor_id;
          status.totals.broken_image_by_vendor[vid] = (status.totals.broken_image_by_vendor[vid] || 0) + 1;
          status.totals.broken_image_removed++;
        }
      }

      for (const id of brokenToDelete) {
        catalogDB.deleteProduct(id);
      }
      // Remove from local array
      const brokenSet = new Set(brokenToDelete);
      for (let i = allProducts.length - 1; i >= 0; i--) {
        if (brokenSet.has(allProducts[i].id)) {
          allProducts.splice(i, 1);
        }
      }

      console.log(`[catalog-cleanup] Removed ${status.totals.broken_image_removed} products with broken images`);
      for (const [vid, count] of Object.entries(status.totals.broken_image_by_vendor)) {
        console.log(`[catalog-cleanup]   ${vid}: ${count} broken-image products removed`);
      }
    }

    // ── PHASE 1: Product Name Cleanup ──────────────────────
    status.phase = "name_cleanup";
    console.log(`[catalog-cleanup] Phase 1: Name cleanup`);

    for (let i = 0; i < allProducts.length; i++) {
      if (stopRequested) break;

      const product = allProducts[i];
      status.progress = `${i + 1}/${totalProducts} names`;
      status.totals.products_scanned = i + 1;

      const originalName = product.product_name;
      const { cleaned, changed } = cleanProductName(
        originalName,
        product.vendor_id,
        product.vendor_name
      );

      if (changed) {
        catalogDB.updateProductDirect(product.id, { product_name: cleaned });
        product.product_name = cleaned; // Update local copy
        status.totals.names_cleaned++;

        // Save samples (first 20)
        if (status.sample_name_fixes.length < 20) {
          status.sample_name_fixes.push({
            id: product.id,
            vendor: product.vendor_id,
            before: originalName,
            after: cleaned,
          });
        }
      }
    }

    console.log(`[catalog-cleanup] Names cleaned: ${status.totals.names_cleaned}`);

    // ── PHASE 2: Description Cleanup ──────────────────────
    if (!stopRequested) {
      status.phase = "description_cleanup";
      console.log(`[catalog-cleanup] Phase 2: Description cleanup`);

      for (let i = 0; i < allProducts.length; i++) {
        if (stopRequested) break;

        const product = allProducts[i];
        status.progress = `${i + 1}/${totalProducts} descriptions`;

        let { cleaned, action } = cleanDescription(product.description);

        // Check if description is just the product name repeated
        if (cleaned && product.product_name) {
          const descLower = cleaned.toLowerCase().trim();
          const nameLower = product.product_name.toLowerCase().trim();
          if (descLower === nameLower || descLower.length < nameLower.length + 5) {
            cleaned = null;
            action = "nulled_name_repeat";
          }
        }

        if (action !== "none") {
          const updates = { description: cleaned };
          catalogDB.updateProductDirect(product.id, updates);
          product.description = cleaned;

          if (action.startsWith("nulled")) {
            status.totals.descriptions_nulled++;
          } else {
            status.totals.descriptions_fixed++;
          }

          if (status.sample_desc_fixes.length < 20) {
            status.sample_desc_fixes.push({
              id: product.id,
              vendor: product.vendor_id,
              action,
              before_len: product.description?.length || 0,
              after_len: cleaned?.length || 0,
            });
          }
        }
      }

      console.log(`[catalog-cleanup] Descriptions fixed: ${status.totals.descriptions_fixed}, nulled: ${status.totals.descriptions_nulled}`);
    }

    // ── PHASE 3: Image URL Validation & Cleanup ───────────
    if (!stopRequested) {
      status.phase = "image_validation";
      console.log(`[catalog-cleanup] Phase 3: Image validation`);

      // 3a. Find duplicate image groups
      const dupGroups = findDuplicateImageGroups(allProducts);
      status.totals.duplicate_image_groups = dupGroups.length;
      status.duplicate_groups = dupGroups.slice(0, 30);
      console.log(`[catalog-cleanup] Found ${dupGroups.length} duplicate image groups`);

      // Create set of duplicate URLs for flagging
      const duplicateUrls = new Set();
      const highDuplicateUrls = new Set(); // 10+ = definitely a placeholder/logo
      for (const group of dupGroups) {
        duplicateUrls.add(group.url);
        if (group.count >= 10) {
          highDuplicateUrls.add(group.url);
        }
      }

      // 3b. Check each product's images
      const batchSize = 20;
      for (let i = 0; i < allProducts.length; i += batchSize) {
        if (stopRequested) break;

        const batch = allProducts.slice(i, i + batchSize);
        status.progress = `${Math.min(i + batchSize, totalProducts)}/${totalProducts} images`;

        await Promise.all(batch.map(async (product) => {
          const updates = {};
          let imageUrl = product.image_url;
          let images = Array.isArray(product.images) ? [...product.images] : [];
          let needsUpdate = false;

          // Check primary image URL
          if (imageUrl) {
            if (isKnownBadImageUrl(imageUrl)) {
              updates.bad_image = true;
              status.totals.images_flagged_bad++;
              needsUpdate = true;

              // Try to find a better image from images array
              const betterImg = images.find(img => {
                const url = typeof img === "string" ? img : img?.url;
                return url && !isKnownBadImageUrl(url) && !isFabricTexture(url);
              });
              if (betterImg) {
                const betterUrl = typeof betterImg === "string" ? betterImg : betterImg.url;
                updates.image_url = betterUrl;
                status.totals.images_swapped++;
                updates.bad_image = false;
              }
            } else if (isFabricTexture(imageUrl)) {
              // Fabric texture as hero — try to swap
              const betterImg = images.find(img => {
                const url = typeof img === "string" ? img : img?.url;
                return url && url !== imageUrl && !isKnownBadImageUrl(url) && !isFabricTexture(url);
              });
              if (betterImg) {
                const betterUrl = typeof betterImg === "string" ? betterImg : betterImg.url;
                updates.image_url = betterUrl;
                status.totals.images_swapped++;
                needsUpdate = true;
              }
            }

            // Check if primary image is a known duplicate (shared by 3+ products)
            const normalizedUrl = imageUrl.split("?")[0].toLowerCase();
            if (duplicateUrls.has(normalizedUrl)) {
              updates.shared_hero_image = true;
              needsUpdate = true;
              // 10+ products sharing = definitely a placeholder/logo, mark as bad
              if (highDuplicateUrls.has(normalizedUrl)) {
                updates.bad_image = true;
                status.totals.images_flagged_bad++;
              }
            }
          }

          // No usable image at all
          if (!imageUrl && images.length === 0) {
            updates.bad_image = true;
            status.totals.products_no_usable_image++;
            needsUpdate = true;
          } else if (imageUrl && isKnownBadImageUrl(imageUrl) && !updates.image_url) {
            // Primary image is bad and we couldn't find a replacement
            updates.bad_image = true;
            status.totals.products_no_usable_image++;
            status.totals.bad_image_set++;
            needsUpdate = true;
          }

          // 3c. Detect product-on-white images → set image_contain for proper display
          const heroUrl = (updates.image_url || imageUrl || "").toLowerCase();
          const heroImages = Array.isArray(product.images) ? product.images : [];
          const heroType = heroImages[0]?.type || classifyImageType(heroUrl, 0, 1);
          // Product shots on white/light backgrounds should use object-contain
          // Room scenes and lifestyle photos should keep object-cover
          if (heroType !== "room_scene" && heroUrl) {
            // Most manufacturer product URLs indicate studio/catalog shots
            const isStudioShot = (
              /product[_-]?image|catalog[_-]?image|thumbnail|products?\//i.test(heroUrl) ||
              /\.lookbookcloud\.|\.shopify\.|media\.?"?\//i.test(heroUrl) ||
              // Known vendor catalog image patterns
              /bernhardt\.com|hookerfurniture\.com|centuryfurniture\.com|universalfurniture\.com/i.test(heroUrl) ||
              /vanguardfurniture\.com|wesleyhall\.com|hancockandmoore\.com|hickorychair\.com/i.test(heroUrl) ||
              /highlandhousefurniture\.com|lexington\.com|theodorealexander/i.test(heroUrl) ||
              /baker.*furniture|caracole\.com|stickley\.com|sherrill.*furniture/i.test(heroUrl) ||
              /crlaine\.com|lee.*industries/i.test(heroUrl) ||
              /viewmastercms\.com|cloudfront\.net.*vdir/i.test(heroUrl)
            );
            if (isStudioShot) {
              updates.image_contain = true;
              needsUpdate = true;
            }
          }

          // 3d. Classify and prioritize images array
          if (images.length > 0) {
            // Filter out bad URLs from images array
            const validImages = images.filter(img => {
              const url = typeof img === "string" ? img : img?.url;
              return url && !isKnownBadImageUrl(url);
            });

            if (validImages.length !== images.length || !images[0]?.type) {
              const classified = classifyAndPrioritize(validImages);
              // Move fabric textures to the end
              classified.sort((a, b) => {
                const aFabric = isFabricTexture(a.url) ? 1 : 0;
                const bFabric = isFabricTexture(b.url) ? 1 : 0;
                if (aFabric !== bFabric) return aFabric - bFabric;
                return a.priority - b.priority;
              });
              updates.images = classified;
              status.totals.images_classified++;
              needsUpdate = true;

              // If hero was a fabric texture and we have a better classified image, update image_url
              if (classified.length > 0 && !updates.image_url) {
                const heroCandidate = classified[0];
                if (heroCandidate.url !== imageUrl) {
                  updates.image_url = heroCandidate.url;
                  status.totals.images_swapped++;
                }
              }
            }
          }

          if (needsUpdate) {
            catalogDB.updateProductDirect(product.id, updates);
          }
        }));

        // Small delay between batches
        await new Promise(r => setTimeout(r, 50));
      }

      console.log(`[catalog-cleanup] Images flagged: ${status.totals.images_flagged_bad}, swapped: ${status.totals.images_swapped}, no usable: ${status.totals.products_no_usable_image}`);
    }

    // ── PHASE 4: Batch HTTP image checks (sample) ─────────
    if (!stopRequested && options.checkImageUrls) {
      status.phase = "image_http_check";
      console.log(`[catalog-cleanup] Phase 4: HTTP image URL checks`);

      // Check a sample of image URLs (full check would be too slow for 40K products)
      const sampleSize = Math.min(options.httpCheckSample || 2000, allProducts.length);
      const step = Math.max(1, Math.floor(allProducts.length / sampleSize));

      let checked = 0;
      for (let i = 0; i < allProducts.length && checked < sampleSize; i += step) {
        if (stopRequested) break;

        const product = allProducts[i];
        if (!product.image_url || product.bad_image) continue;

        const result = await checkImageUrl(product.image_url);
        checked++;
        status.progress = `${checked}/${sampleSize} HTTP checks`;

        if (!result.ok) {
          status.totals.image_404s++;
          catalogDB.updateProductDirect(product.id, { bad_image: true });

          if (result.reason.startsWith("http_")) {
            // Try images array for replacement
            const images = Array.isArray(product.images) ? product.images : [];
            for (const img of images) {
              const url = typeof img === "string" ? img : img?.url;
              if (url && url !== product.image_url) {
                const altResult = await checkImageUrl(url);
                if (altResult.ok) {
                  catalogDB.updateProductDirect(product.id, { image_url: url, bad_image: false });
                  status.totals.images_swapped++;
                  break;
                }
              }
            }
          }
        }

        // Rate limit
        if (checked % 50 === 0) {
          await new Promise(r => setTimeout(r, 200));
        }
      }

      console.log(`[catalog-cleanup] HTTP checks: ${checked} checked, ${status.totals.image_404s} 404s`);
    }

    // ── PHASE 5: Set bad_image flag on search ranking ─────
    if (!stopRequested) {
      status.phase = "finalize_bad_image";
      console.log(`[catalog-cleanup] Phase 5: Finalizing bad_image flags`);

      let badCount = 0;
      for (const product of allProducts) {
        if (product.bad_image) badCount++;
      }
      status.totals.bad_image_set = badCount;
      console.log(`[catalog-cleanup] Total products with bad_image: ${badCount}`);
    }

    // Done
    status.phase = "complete";
    status.finished_at = new Date().toISOString();
    status.progress = null;

    console.log(`[catalog-cleanup] ═══ CLEANUP COMPLETE ═══`);
    console.log(`[catalog-cleanup] Products scanned:     ${status.totals.products_scanned}`);
    console.log(`[catalog-cleanup] Names cleaned:        ${status.totals.names_cleaned}`);
    console.log(`[catalog-cleanup] Descriptions fixed:   ${status.totals.descriptions_fixed}`);
    console.log(`[catalog-cleanup] Descriptions nulled:  ${status.totals.descriptions_nulled}`);
    console.log(`[catalog-cleanup] Images flagged bad:   ${status.totals.images_flagged_bad}`);
    console.log(`[catalog-cleanup] Images swapped:       ${status.totals.images_swapped}`);
    console.log(`[catalog-cleanup] Image 404s:           ${status.totals.image_404s}`);
    console.log(`[catalog-cleanup] Duplicate groups:     ${status.totals.duplicate_image_groups}`);
    console.log(`[catalog-cleanup] No usable image:      ${status.totals.products_no_usable_image}`);
    console.log(`[catalog-cleanup] Images classified:    ${status.totals.images_classified}`);
    console.log(`[catalog-cleanup] bad_image products:   ${status.totals.bad_image_set}`);

    return status;

  } catch (err) {
    status.phase = "error";
    status.finished_at = new Date().toISOString();
    status.errors.push(err.message);
    console.error(`[catalog-cleanup] Fatal error:`, err);
    return status;
  } finally {
    running = false;
  }
}
