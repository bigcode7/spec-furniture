/**
 * Category Normalizer — Master category tree for furniture products.
 *
 * Maps every vendor's inconsistent category names to a clean hierarchy:
 *   Group > Category
 *
 * Zero API cost — pure string matching.
 */

export const CATEGORY_TREE = {
  seating: {
    label: "Seating",
    categories: ["sofas", "sectionals", "accent-chairs", "swivel-chairs", "dining-chairs", "bar-stools", "benches", "ottomans", "chaises", "recliners", "loveseats"],
  },
  tables: {
    label: "Tables",
    categories: ["dining-tables", "coffee-tables", "side-tables", "console-tables", "desks", "nightstands"],
  },
  storage: {
    label: "Storage",
    categories: ["dressers", "credenzas", "bookcases", "media-consoles", "chests", "cabinets", "wardrobes"],
  },
  beds: {
    label: "Beds",
    categories: ["beds", "headboards", "daybeds"],
  },
  lighting: {
    label: "Lighting",
    categories: ["table-lamps", "floor-lamps", "chandeliers", "pendants", "sconces"],
  },
  rugs: {
    label: "Rugs",
    categories: ["area-rugs"],
  },
  decor: {
    label: "Decor",
    categories: ["mirrors", "wall-art", "decorative-objects", "pillows", "throws", "vases", "sculptures", "clocks"],
  },
};

// Reverse lookup: category → group
const categoryToGroup = new Map();
for (const [groupId, group] of Object.entries(CATEGORY_TREE)) {
  for (const cat of group.categories) {
    categoryToGroup.set(cat, groupId);
  }
}

/**
 * Raw category string → normalized { category, group }
 *
 * The mapping table covers hundreds of vendor-specific terms.
 */
const CATEGORY_MAP = {
  // ── Seating ──
  "sofa": "sofas", "sofas": "sofas", "couch": "sofas", "couches": "sofas",
  "settee": "settees", "settees": "settees", "divan": "sofas", "divans": "sofas",
  "loveseat": "loveseats", "loveseats": "loveseats", "love seat": "loveseats",
  "sectional": "sectionals", "sectionals": "sectionals",
  "sectional sofa": "sectionals", "sectional sofas": "sectionals",
  "modular sofa": "sectionals", "modular sectional": "sectionals",
  "accent chair": "accent-chairs", "accent chairs": "accent-chairs",
  "accent-chair": "accent-chairs", "arm chair": "accent-chairs",
  "armchair": "accent-chairs", "armchairs": "accent-chairs",
  "lounge chair": "accent-chairs", "lounge chairs": "accent-chairs",
  "club chair": "accent-chairs", "club chairs": "accent-chairs",
  "wing chair": "accent-chairs", "wingback chair": "accent-chairs",
  "slipper chair": "accent-chairs", "slipper chairs": "accent-chairs",
  "swivel chair": "swivel-chairs", "swivel chairs": "swivel-chairs",
  "swivel-chair": "swivel-chairs", "swivel accent chair": "swivel-chairs",
  "barrel chair": "swivel-chairs",
  "dining chair": "dining-chairs", "dining chairs": "dining-chairs",
  "dining-chair": "dining-chairs", "side chair": "dining-chairs",
  "host chair": "dining-chairs", "hostess chair": "dining-chairs",
  "bar stool": "bar-stools", "bar stools": "bar-stools",
  "bar-stool": "bar-stools", "barstool": "bar-stools", "barstools": "bar-stools",
  "counter stool": "bar-stools", "counter stools": "bar-stools",
  "counter-stool": "bar-stools",
  "bench": "benches", "benches": "benches",
  "dining bench": "benches", "entryway bench": "benches",
  "bedroom bench": "benches", "storage bench": "benches",
  "ottoman": "ottomans", "ottomans": "ottomans",
  "pouf": "ottomans", "poufs": "ottomans", "pouffe": "ottomans",
  "footstool": "ottomans",
  "chaise": "chaises", "chaises": "chaises",
  "chaise lounge": "chaises", "chaise longue": "chaises",
  "daybed chaise": "chaises",
  "recliner": "recliners", "recliners": "recliners",
  "reclining chair": "recliners",
  "chair": "accent-chairs", "chairs": "accent-chairs",

  // ── Tables ──
  "dining table": "dining-tables", "dining tables": "dining-tables",
  "dining-table": "dining-tables", "extension table": "dining-tables",
  "extension dining table": "dining-tables", "gathering table": "dining-tables",
  "pub table": "dining-tables", "trestle table": "dining-tables",
  "pedestal table": "dining-tables",
  "coffee table": "coffee-tables", "coffee tables": "coffee-tables",
  "coffee-table": "coffee-tables",
  "cocktail table": "coffee-tables", "cocktail tables": "coffee-tables",
  "side table": "side-tables", "side tables": "side-tables",
  "side-table": "side-tables",
  "end table": "side-tables", "end tables": "side-tables",
  "end-table": "side-tables",
  "accent table": "side-tables", "accent tables": "side-tables",
  "drink table": "side-tables", "martini table": "side-tables",
  "lamp table": "side-tables",
  "console table": "console-tables", "console tables": "console-tables",
  "console-table": "console-tables",
  "console": "console-tables", "sofa table": "console-tables",
  "entry table": "console-tables", "hall table": "console-tables",
  "foyer table": "console-tables",
  "desk": "desks", "desks": "desks",
  "writing desk": "desks", "executive desk": "desks",
  "secretary desk": "desks", "home office desk": "desks",
  "nightstand": "nightstands", "nightstands": "nightstands",
  "night stand": "nightstands", "night table": "nightstands",
  "bedside table": "nightstands", "bedside tables": "nightstands",
  "table": "side-tables", "tables": "side-tables",

  // ── Storage ──
  "dresser": "dressers", "dressers": "dressers",
  "chest of drawers": "dressers", "double dresser": "dressers",
  "tall dresser": "dressers",
  "credenza": "credenzas", "credenzas": "credenzas",
  "sideboard": "credenzas", "sideboards": "credenzas",
  "buffet": "credenzas", "buffets": "credenzas",
  "server": "credenzas",
  "bookcase": "bookcases", "bookcases": "bookcases",
  "bookshelf": "bookcases", "bookshelves": "bookcases",
  "etagere": "bookcases", "etageres": "bookcases",
  "etag\u00e8re": "bookcases",
  "display shelf": "bookcases", "shelving unit": "bookcases",
  "media console": "media-consoles", "media consoles": "media-consoles",
  "media-console": "media-consoles",
  "tv stand": "media-consoles", "tv console": "media-consoles",
  "entertainment center": "media-consoles", "entertainment console": "media-consoles",
  "media cabinet": "media-consoles",
  "chest": "chests", "chests": "chests",
  "blanket chest": "chests", "trunk": "chests", "trunks": "chests",
  "lingerie chest": "chests", "tall chest": "chests",
  "cabinet": "cabinets", "cabinets": "cabinets",
  "bar cabinet": "cabinets", "china cabinet": "cabinets",
  "curio cabinet": "cabinets", "display cabinet": "cabinets",
  "hutch": "cabinets", "armoire": "wardrobes",
  "wardrobe": "wardrobes", "wardrobes": "wardrobes",
  "storage": "cabinets",

  // ── Beds ──
  "bed": "beds", "beds": "beds",
  "platform bed": "beds", "canopy bed": "beds",
  "panel bed": "beds", "sleigh bed": "beds",
  "poster bed": "beds", "upholstered bed": "beds",
  "king bed": "beds", "queen bed": "beds",
  "headboard": "headboards", "headboards": "headboards",
  "upholstered headboard": "headboards",
  "daybed": "daybeds", "daybeds": "daybeds",
  "day bed": "daybeds", "trundle bed": "daybeds",

  // ── Lighting ──
  "table lamp": "table-lamps", "table lamps": "table-lamps",
  "table-lamps": "table-lamps", "table-lamp": "table-lamps",
  "desk lamp": "table-lamps", "accent lamp": "table-lamps",
  "buffet lamp": "table-lamps",
  "floor lamp": "floor-lamps", "floor lamps": "floor-lamps",
  "floor-lamps": "floor-lamps", "floor-lamp": "floor-lamps",
  "arc lamp": "floor-lamps", "torchiere": "floor-lamps",
  "chandelier": "chandeliers", "chandeliers": "chandeliers",
  "pendant": "pendants", "pendants": "pendants",
  "pendant light": "pendants", "pendant lights": "pendants",
  "hanging light": "pendants", "lantern": "pendants",
  "sconce": "sconces", "sconces": "sconces",
  "wall sconce": "sconces", "wall light": "sconces",
  "lighting": "table-lamps", "lamp": "table-lamps", "lamps": "table-lamps",
  "light": "pendants",

  // ── Rugs ──
  "rug": "area-rugs", "rugs": "area-rugs",
  "area rug": "area-rugs", "area rugs": "area-rugs",
  "runner": "area-rugs", "carpet": "area-rugs",

  // ── Decor ──
  "mirror": "mirrors", "mirrors": "mirrors",
  "wall mirror": "mirrors", "floor mirror": "mirrors",
  "vanity mirror": "mirrors",
  "wall art": "wall-art", "art": "wall-art",
  "artwork": "wall-art", "painting": "wall-art", "print": "wall-art",
  "decorative object": "decorative-objects", "decorative objects": "decorative-objects",
  "object": "decorative-objects", "accessories": "decorative-objects",
  "accessory": "decorative-objects", "decor": "decorative-objects",
  "pillow": "pillows", "pillows": "pillows",
  "throw pillow": "pillows", "accent pillow": "pillows",
  "throw": "throws", "throws": "throws",
  "blanket": "throws",
  "vase": "vases", "vases": "vases",
  "sculpture": "sculptures", "sculptures": "sculptures",
  "figurine": "sculptures", "statue": "sculptures",
  "clock": "clocks", "clocks": "clocks",
  "wall clock": "clocks",
  "accent": "decorative-objects",
};

/**
 * Normalize a raw category string to { category, group }.
 *
 * @param {string} raw - Raw category from vendor data
 * @returns {{ category: string, group: string }}
 */
export function normalizeToMasterCategory(raw) {
  if (!raw) return { category: "decorative-objects", group: "decor" };

  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();

  // If already a valid category slug in the tree, return it directly
  if (categoryToGroup.has(cleaned)) {
    return { category: cleaned, group: categoryToGroup.get(cleaned) };
  }

  // Direct lookup
  const mapped = CATEGORY_MAP[cleaned];
  if (mapped) {
    return { category: mapped, group: categoryToGroup.get(mapped) || "decor" };
  }

  // Try removing trailing 's' for plurals
  if (cleaned.endsWith("s")) {
    const singular = CATEGORY_MAP[cleaned.slice(0, -1)];
    if (singular) return { category: singular, group: categoryToGroup.get(singular) || "decor" };
  }

  // Try substring matching — if the raw string contains a known category
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (cleaned.includes(key) && key.length > 3) {
      return { category: value, group: categoryToGroup.get(value) || "decor" };
    }
  }

  // Fallback: slugify and put in decor
  const slug = cleaned.replace(/\s+/g, "-") || "decorative-objects";
  return { category: slug, group: categoryToGroup.get(slug) || "decor" };
}

/**
 * Get the group label for a category.
 */
export function getCategoryGroup(category) {
  return categoryToGroup.get(category) || "decor";
}

/**
 * Get the full category tree for UI rendering.
 */
export function getCategoryTree() {
  return CATEGORY_TREE;
}

/**
 * Get all categories in a group. If given a category slug, returns sibling categories.
 * If given a group name, returns all categories in that group.
 *
 * @param {string} categoryOrGroup
 * @returns {string[]} Array of category slugs
 */
export function getSubcategories(categoryOrGroup) {
  const lower = (categoryOrGroup || "").toLowerCase().replace(/\s+/g, "-");
  // Check if it's a group
  if (CATEGORY_TREE[lower]) {
    return CATEGORY_TREE[lower].categories;
  }
  // Check if it's a category — return all siblings in same group
  const group = categoryToGroup.get(lower);
  if (group && CATEGORY_TREE[group]) {
    return CATEGORY_TREE[group].categories;
  }
  return [lower];
}

/**
 * Get ancestor chain: [group, category]
 *
 * @param {string} category
 * @returns {{ group: string, groupLabel: string, category: string }}
 */
export function getAncestors(category) {
  const cat = (category || "").toLowerCase().replace(/\s+/g, "-");
  const group = categoryToGroup.get(cat) || "decor";
  const groupLabel = CATEGORY_TREE[group]?.label || "Decor";
  return { group, groupLabel, category: cat };
}

/**
 * Get flat list of all categories with their group.
 *
 * @returns {Array<{ category: string, group: string, groupLabel: string }>}
 */
export function getAllCategories() {
  const result = [];
  for (const [groupId, group] of Object.entries(CATEGORY_TREE)) {
    for (const cat of group.categories) {
      result.push({ category: cat, group: groupId, groupLabel: group.label });
    }
  }
  return result;
}
