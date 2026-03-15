/**
 * Query Category Filter — Hard category enforcement for search results.
 *
 * Detects the product type from natural language queries and applies
 * HARD FILTERS (not boosts) to eliminate category leakage.
 *
 * "modern credenza" → ONLY return credenzas/sideboards/buffets
 * "walnut dining table" → ONLY return dining tables
 * "boucle accent chair" → ONLY return accent chairs + swivel chairs
 *
 * Zero API cost — pure pattern matching.
 */

import { CATEGORY_TREE } from "./category-normalizer.mjs";
import { NATURAL_LANGUAGE_CATEGORIES } from "./furniture-dictionary.mjs";

// ── Category Detection Patterns ─────────────────────────────
// Order matters — more specific patterns must come FIRST.
// "dining chair" must match before "chair", "coffee table" before "table".

const CATEGORY_PATTERNS = [
  // Specific chair types (must come before generic "chair")
  { match: ["dining chair", "dining chairs", "side chair", "side chairs", "arm chair", "host chair", "hostess chair"], categories: ["dining-chairs"], related: [] },
  { match: ["swivel chair", "swivel chairs", "barrel chair", "barrel chairs"], categories: ["swivel-chairs"], related: ["accent-chairs"] },
  { match: ["accent chair", "accent chairs", "lounge chair", "lounge chairs", "club chair", "club chairs", "wing chair", "wingback chair", "slipper chair"], categories: ["accent-chairs"], related: ["swivel-chairs"] },
  { match: ["bar stool", "bar stools", "barstool", "barstools", "counter stool", "counter stools"], categories: ["bar-stools"], related: [] },
  { match: ["recliner", "recliners", "reclining chair"], categories: ["recliners"], related: [] },
  { match: ["office chair", "desk chair", "task chair"], categories: ["accent-chairs", "swivel-chairs"], related: [] },

  // Specific table types (must come before generic "table")
  { match: ["dining table", "dining tables", "extension table", "extension dining table", "trestle table", "pedestal table", "gathering table"], categories: ["dining-tables"], related: [] },
  { match: ["coffee table", "coffee tables", "cocktail table", "cocktail tables"], categories: ["coffee-tables"], related: [] },
  { match: ["side table", "side tables", "end table", "end tables", "accent table", "accent tables", "drink table", "martini table", "lamp table"], categories: ["side-tables"], related: [] },
  { match: ["console table", "console tables", "console", "entry table", "hall table", "foyer table", "sofa table"], categories: ["console-tables"], related: [] },
  { match: ["nightstand", "nightstands", "night stand", "night table", "bedside table", "bedside tables"], categories: ["nightstands"], related: [] },

  // Seating
  { match: ["sofa", "sofas", "couch", "couches", "settee", "settees", "divan"], categories: ["sofas"], related: ["sectionals", "loveseats"] },
  { match: ["sectional", "sectionals", "sectional sofa", "modular sofa", "modular sectional"], categories: ["sectionals"], related: ["sofas"] },
  { match: ["loveseat", "loveseats", "love seat"], categories: ["loveseats"], related: ["sofas"] },
  { match: ["ottoman", "ottomans", "pouf", "poufs", "pouffe", "footstool"], categories: ["ottomans"], related: [] },
  { match: ["bench", "benches", "entryway bench", "bedroom bench", "dining bench"], categories: ["benches"], related: [] },
  { match: ["chaise", "chaises", "chaise lounge", "chaise longue", "daybed chaise"], categories: ["chaises"], related: [] },
  // Generic "chair" — only match if no more specific pattern matched
  { match: ["chair", "chairs"], categories: ["accent-chairs", "swivel-chairs"], related: ["dining-chairs"] },

  // Storage
  { match: ["credenza", "credenzas", "sideboard", "sideboards", "buffet", "buffets", "server"], categories: ["credenzas"], related: ["media-consoles"] },
  { match: ["media console", "media consoles", "tv stand", "tv console", "entertainment center", "entertainment console", "media cabinet"], categories: ["media-consoles"], related: ["credenzas"] },
  { match: ["dresser", "dressers", "chest of drawers", "double dresser", "tall dresser", "bureau"], categories: ["dressers"], related: ["chests"] },
  { match: ["bookcase", "bookcases", "bookshelf", "bookshelves", "etagere", "etageres", "shelving", "display shelf"], categories: ["bookcases"], related: [] },
  { match: ["cabinet", "cabinets", "bar cabinet", "china cabinet", "curio cabinet", "display cabinet", "hutch"], categories: ["cabinets"], related: [] },
  { match: ["chest", "chests", "blanket chest", "trunk", "trunks", "lingerie chest"], categories: ["chests"], related: ["dressers"] },
  { match: ["armoire", "wardrobe", "wardrobes"], categories: ["wardrobes"], related: [] },
  { match: ["desk", "desks", "writing desk", "executive desk", "secretary desk"], categories: ["desks"], related: [] },

  // Beds
  { match: ["bed", "beds", "platform bed", "canopy bed", "panel bed", "sleigh bed", "poster bed", "upholstered bed", "king bed", "queen bed", "twin bed", "full bed", "cal king bed"], categories: ["beds"], related: ["headboards"] },
  { match: ["headboard", "headboards", "upholstered headboard"], categories: ["headboards"], related: ["beds"] },
  { match: ["daybed", "daybeds", "day bed", "trundle bed"], categories: ["daybeds"], related: [] },

  // Lighting
  { match: ["chandelier", "chandeliers"], categories: ["chandeliers"], related: ["pendants"] },
  { match: ["pendant", "pendants", "pendant light", "pendant lights", "hanging light", "lantern"], categories: ["pendants"], related: ["chandeliers"] },
  { match: ["sconce", "sconces", "wall sconce", "wall light"], categories: ["sconces"], related: [] },
  { match: ["table lamp", "table lamps", "desk lamp", "accent lamp", "buffet lamp"], categories: ["table-lamps"], related: [] },
  { match: ["floor lamp", "floor lamps", "arc lamp", "torchiere"], categories: ["floor-lamps"], related: [] },
  { match: ["lamp", "lamps"], categories: ["table-lamps", "floor-lamps"], related: [] },

  // Rugs
  { match: ["rug", "rugs", "area rug", "area rugs", "runner", "carpet"], categories: ["area-rugs"], related: [] },

  // Decor
  { match: ["mirror", "mirrors", "wall mirror", "floor mirror"], categories: ["mirrors"], related: [] },
  { match: ["pillow", "pillows", "throw pillow", "accent pillow"], categories: ["pillows"], related: [] },
  { match: ["throw", "throws", "blanket", "blankets"], categories: ["throws"], related: [] },
  { match: ["vase", "vases"], categories: ["vases"], related: [] },

  // Generic "table" — last resort, very broad
  { match: ["table", "tables"], categories: ["dining-tables", "coffee-tables", "side-tables", "console-tables"], related: [] },
];

// ── Room Context Mappings ────────────────────────────────────

const ROOM_CATEGORIES = {
  bedroom: ["beds", "headboards", "nightstands", "dressers", "chests", "benches", "mirrors", "table-lamps", "area-rugs", "throws", "pillows"],
  "living room": ["sofas", "sectionals", "loveseats", "accent-chairs", "swivel-chairs", "coffee-tables", "side-tables", "console-tables", "ottomans", "media-consoles", "area-rugs", "table-lamps", "floor-lamps", "mirrors", "pillows", "throws", "decorative-objects", "wall-art"],
  "dining room": ["dining-tables", "dining-chairs", "credenzas", "bar-stools", "benches", "chandeliers", "pendants", "area-rugs", "mirrors", "wall-art", "cabinets"],
  office: ["desks", "accent-chairs", "swivel-chairs", "bookcases", "table-lamps", "floor-lamps", "area-rugs"],
  study: ["desks", "accent-chairs", "swivel-chairs", "bookcases", "table-lamps", "floor-lamps", "area-rugs"],
  outdoor: ["sofas", "accent-chairs", "dining-tables", "dining-chairs", "side-tables", "coffee-tables", "benches", "ottomans"],
  entryway: ["console-tables", "mirrors", "benches", "table-lamps", "decorative-objects", "area-rugs"],
  foyer: ["console-tables", "mirrors", "benches", "table-lamps", "chandeliers", "decorative-objects", "area-rugs"],
  nursery: ["beds", "dressers", "accent-chairs", "swivel-chairs", "area-rugs", "table-lamps", "wall-art"],
  bathroom: ["mirrors", "cabinets", "benches", "decorative-objects"],
};

const ROOM_PATTERNS = Object.keys(ROOM_CATEGORIES);

/**
 * Detect the category filter from a search query.
 *
 * Returns:
 * - categories: array of allowed category slugs (HARD FILTER)
 * - detected: what was detected ("sofa", "bedroom", "vendor-only", or null)
 * - type: "product" | "room" | "vendor" | "open"
 *
 * @param {string} query - Raw search query
 * @param {string|null} vendorId - Detected vendor ID (if any)
 * @returns {{ categories: string[]|null, detected: string|null, type: string }}
 */
export function detectQueryCategory(query, vendorId = null) {
  if (!query) return { categories: null, detected: null, type: "open" };

  const q = query.toLowerCase().trim();

  // STEP 0.5: Natural language category detection
  // "something to put behind my sofa" → console-tables
  for (const [phrase, category] of Object.entries(NATURAL_LANGUAGE_CATEGORIES)) {
    if (q.includes(phrase)) {
      return {
        categories: [category],
        detected: phrase,
        type: "natural-language",
      };
    }
  }

  // STEP 1: Try to detect a specific product type
  for (const pattern of CATEGORY_PATTERNS) {
    for (const term of pattern.match) {
      // Match as whole word(s) within the query
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
      if (regex.test(q)) {
        return {
          categories: pattern.categories,
          related: pattern.related,
          detected: term,
          type: "product",
        };
      }
    }
  }

  // STEP 2: Try to detect a room context
  for (const room of ROOM_PATTERNS) {
    const regex = new RegExp(`\\b${escapeRegex(room)}\\b`, "i");
    if (regex.test(q)) {
      return {
        categories: ROOM_CATEGORIES[room],
        detected: room,
        type: "room",
      };
    }
  }

  // STEP 3: If only a vendor was detected with no product/room context, return all
  if (vendorId) {
    return { categories: null, detected: "vendor-only", type: "vendor" };
  }

  // STEP 4: No specific category detected — open search
  return { categories: null, detected: null, type: "open" };
}

/**
 * Check if a product's category matches the allowed categories.
 *
 * @param {object} product - Product object with .category field
 * @param {string[]} allowedCategories - Array of category slugs to allow
 * @returns {boolean}
 */
export function productMatchesCategory(product, allowedCategories) {
  if (!allowedCategories || allowedCategories.length === 0) return true;

  const productCat = (product.category || "").toLowerCase();
  const productName = (product.product_name || "").toLowerCase();
  const productGroup = (product.category_group || "").toLowerCase();

  // Direct category match
  if (allowedCategories.some(c => productCat === c || productCat.includes(c))) {
    return true;
  }

  // Check if the product's category_group maps to any allowed category
  // e.g. category_group "seating" allows accent-chairs, sofas, etc.
  for (const allowed of allowedCategories) {
    const group = getCategoryGroupForSlug(allowed);
    if (group && productGroup === group) {
      // Group matches but we need finer category check
      // Only allow if the specific category is in allowed list
      // This prevents "sofa" search matching "dining-chairs" even though both are "seating"
    }
  }

  // Fallback: check product name for category keywords
  // This catches products with wrong/missing categories
  for (const allowed of allowedCategories) {
    const keywords = categoryToKeywords(allowed);
    if (keywords.some(kw => productName.includes(kw))) {
      return true;
    }
  }

  return false;
}

/**
 * Infer category from product name when the category field is empty or wrong.
 *
 * @param {string} productName
 * @returns {string|null} Inferred category slug or null
 */
export function inferCategoryFromName(productName) {
  if (!productName) return null;
  const name = productName.toLowerCase();

  for (const pattern of CATEGORY_PATTERNS) {
    for (const term of pattern.match) {
      const regex = new RegExp(`\\b${escapeRegex(term)}\\b`, "i");
      if (regex.test(name)) {
        return pattern.categories[0]; // Return primary category
      }
    }
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Map category slug to group
function getCategoryGroupForSlug(slug) {
  for (const [groupId, group] of Object.entries(CATEGORY_TREE)) {
    if (group.categories.includes(slug)) return groupId;
  }
  return null;
}

// Map category slug to search keywords for name-based fallback matching
function categoryToKeywords(category) {
  const map = {
    "sofas": ["sofa", "couch", "settee"],
    "sectionals": ["sectional", "modular sofa"],
    "loveseats": ["loveseat", "love seat"],
    "accent-chairs": ["accent chair", "lounge chair", "club chair", "wing chair", "slipper chair", "armchair"],
    "swivel-chairs": ["swivel chair", "barrel chair", "swivel"],
    "dining-chairs": ["dining chair", "side chair", "host chair"],
    "bar-stools": ["bar stool", "barstool", "counter stool"],
    "benches": ["bench"],
    "ottomans": ["ottoman", "pouf", "footstool"],
    "chaises": ["chaise"],
    "recliners": ["recliner"],
    "dining-tables": ["dining table", "extension table", "trestle table"],
    "coffee-tables": ["coffee table", "cocktail table"],
    "side-tables": ["side table", "end table", "accent table", "drink table"],
    "console-tables": ["console table", "console", "entry table", "hall table"],
    "nightstands": ["nightstand", "night stand", "bedside table"],
    "desks": ["desk"],
    "beds": ["bed", "platform bed", "canopy bed", "panel bed", "poster bed", "upholstered bed"],
    "headboards": ["headboard"],
    "dressers": ["dresser", "chest of drawers", "bureau"],
    "credenzas": ["credenza", "sideboard", "buffet"],
    "media-consoles": ["media console", "tv stand", "tv console", "entertainment"],
    "bookcases": ["bookcase", "bookshelf", "etagere", "shelving"],
    "cabinets": ["cabinet", "hutch"],
    "chests": ["chest", "trunk"],
    "wardrobes": ["armoire", "wardrobe"],
    "area-rugs": ["rug", "runner", "carpet"],
    "mirrors": ["mirror"],
    "chandeliers": ["chandelier"],
    "pendants": ["pendant"],
    "sconces": ["sconce"],
    "table-lamps": ["table lamp", "desk lamp"],
    "floor-lamps": ["floor lamp"],
    "pillows": ["pillow"],
    "throws": ["throw", "blanket"],
    "vases": ["vase"],
    "wall-art": ["art", "painting", "print"],
    "decorative-objects": ["decorative", "accessory"],
    "sculptures": ["sculpture", "figurine", "statue"],
  };
  return map[category] || [category.replace(/-/g, " ")];
}
