/**
 * Furniture Knowledge Dictionary
 *
 * Single source of truth for furniture industry terminology,
 * synonyms, abbreviations, and trade jargon. Powers query expansion
 * and product tagging — all zero API cost.
 */

// ── SYNONYM MAP ─────────────────────────────────────────────
// Key = canonical term, Value = array of equivalents
// Bidirectional: any term in the array matches any other

export const SYNONYMS = {
  // ── Product types ──
  sofa: ["couch", "settee", "divan", "davenport", "cloud sofa", "deep sofa"],
  loveseat: ["love-seat", "two-seater", "apartment sofa"],
  sectional: ["modular sofa", "l-shaped sofa", "u-shaped sofa"],
  chair: ["seat", "seating"],
  "accent chair": ["occasional chair", "side chair", "pull-up chair"],
  "swivel chair": ["swivel", "rotating chair", "360 chair"],
  "club chair": ["lounge chair", "tub chair"],
  recliner: ["reclining chair", "power recliner", "motion chair"],
  ottoman: ["footstool", "pouf", "pouffe", "hassock"],
  bench: ["banquette", "settee bench", "entry bench"],
  chaise: ["chaise lounge", "chaise longue", "daybed"],

  // ── Tables ──
  "coffee table": ["cocktail table", "center table"],
  "side table": ["end table", "accent table", "drink table", "occasional table", "lamp table"],
  "console table": ["console", "sofa table", "entry table", "hall table"],
  "dining table": ["dinner table", "kitchen table", "eating table"],
  desk: ["writing desk", "work desk", "executive desk", "secretary desk"],
  "bar cart": ["drinks trolley", "serving cart", "beverage cart"],
  "nesting tables": ["nesting", "stackable tables", "bunching tables"],

  // ── Storage / Case Goods ──
  credenza: ["sideboard", "buffet", "server", "media console", "media cabinet"],
  dresser: ["chest of drawers", "bureau", "highboy", "lowboy"],
  nightstand: ["night table", "bedside table", "night stand", "bedside"],
  bookcase: ["bookshelf", "shelving", "etagere", "display shelf"],
  cabinet: ["armoire", "wardrobe", "hutch", "curio", "vitrine"],
  chest: ["storage chest", "trunk", "blanket chest", "hope chest"],
  "case goods": ["storage", "casegoods"],

  // ── Bedroom ──
  bed: ["bedframe", "bed frame", "platform bed", "panel bed", "poster bed", "canopy bed"],
  headboard: ["head board", "upholstered headboard"],

  // ── Lighting ──
  chandelier: ["pendant light", "hanging light", "suspension light"],
  "table lamp": ["desk lamp", "accent lamp", "buffet lamp"],
  "floor lamp": ["standing lamp", "torchiere", "arc lamp"],
  sconce: ["wall sconce", "wall light", "wall lamp", "vanity light"],
  pendant: ["pendant light", "hanging pendant", "drop light"],

  // ── Decor ──
  mirror: ["wall mirror", "floor mirror", "vanity mirror", "accent mirror"],
  rug: ["area rug", "carpet", "runner", "mat"],
  pillow: ["throw pillow", "accent pillow", "decorative pillow", "cushion"],

  // ── Upholstery / Cushion Configs ──
  "three over three": ["3 over 3", "3/3", "three cushion seat and back", "3 seat 3 back"],
  "two over two": ["2 over 2", "2/2", "two cushion seat and back"],
  "bench seat": ["single cushion seat", "one cushion", "bench cushion"],
  "tight back": ["attached back", "fixed back"],
  "loose back": ["detached back", "removable back cushion", "pillow back"],
  "loose cushion": ["removable cushion", "reversible cushion"],
  "tight seat": ["attached seat", "fixed seat"],

  // ── Arm Styles ──
  "track arm": ["straight arm", "square arm", "modern arm"],
  "rolled arm": ["scroll arm", "round arm", "sock arm"],
  "slope arm": ["sloped arm", "angled arm", "flared arm"],
  "english arm": ["bridgewater arm"],
  armless: ["no arms", "without arms"],

  // ── Silhouettes & Styles ──
  tufted: ["button tufted", "diamond tufted", "biscuit tufted", "channel tufted"],
  "channel back": ["channel tufted back", "vertical channel"],
  wingback: ["wing back", "wing chair", "ear chair"],
  barrel: ["barrel back", "barrel chair", "curved back"],
  skirted: ["skirt", "dressmaker", "fully skirted"],
  "low profile": ["low back", "low-slung", "low to ground"],
  "high back": ["tall back", "high-back"],
  camelback: ["camel back", "humpback"],
  lawson: ["lawson style"],
  chesterfield: ["tufted sofa", "button-tufted sofa"],
  bridgewater: ["english roll arm"],
  tuxedo: ["tux arm", "even arm"],
  "mid century modern": ["mcm", "mid-century modern", "mid-century", "midcentury"],
  contemporary: ["modern", "current"],
  transitional: ["updated traditional", "classic modern"],
  traditional: ["classic", "timeless"],
  coastal: ["beach", "nautical", "seaside", "resort", "tropical"],
  farmhouse: ["rustic farmhouse", "country", "cottage"],
  industrial: ["urban industrial", "loft style"],
  "art deco": ["deco", "art-deco", "glamour"],
  bohemian: ["boho", "eclectic"],
  minimalist: ["minimal", "clean-lined", "simple"],
  glam: ["glamorous", "hollywood regency", "luxe"],
  scandinavian: ["scandi", "nordic", "danish modern"],
  rustic: ["distressed", "reclaimed", "weathered"],

  // ── Materials ──
  leather: ["hide", "full grain leather", "top grain leather", "aniline leather", "semi-aniline", "bonded leather", "faux leather", "vegan leather"],
  "top grain leather": ["full grain", "premium leather", "grade a leather"],
  "performance fabric": ["stain resistant", "durable fabric", "indoor outdoor fabric", "easy clean", "crypton", "sunbrella", "revolution"],
  velvet: ["velour", "crushed velvet", "plush", "mohair"],
  linen: ["linen blend", "flax", "belgian linen"],
  boucle: ["bouclé", "boucle fabric", "textured weave", "nubby"],
  chenille: ["chenille fabric", "soft chenille"],
  tweed: ["tweed fabric", "herringbone"],
  silk: ["raw silk", "dupioni"],
  cotton: ["cotton blend", "canvas", "duck cloth"],
  wool: ["wool blend", "felted wool"],
  walnut: ["american walnut", "black walnut", "walnut veneer"],
  oak: ["white oak", "red oak", "cerused oak", "rift oak", "quarter sawn oak"],
  mahogany: ["african mahogany", "genuine mahogany", "sapele"],
  cherry: ["american cherry", "wild cherry"],
  maple: ["hard maple", "sugar maple", "bird's eye maple"],
  ash: ["white ash", "ash wood"],
  pine: ["white pine", "reclaimed pine", "knotty pine"],
  teak: ["burmese teak", "plantation teak", "reclaimed teak"],
  acacia: ["acacia wood", "monkey pod"],
  mango: ["mango wood"],
  marble: ["carrara marble", "calacatta", "marble top", "nero marquina", "travertine"],
  stone: ["natural stone", "limestone", "slate", "granite", "quartz", "concrete"],
  glass: ["tempered glass", "glass top", "smoked glass", "frosted glass"],
  brass: ["brushed brass", "polished brass", "antique brass", "satin brass"],
  iron: ["wrought iron", "forged iron", "cast iron"],
  steel: ["stainless steel", "brushed steel", "polished steel"],
  gold: ["gold leaf", "gold finish", "gilded", "gold tone"],
  nickel: ["brushed nickel", "polished nickel", "satin nickel"],
  chrome: ["polished chrome", "chrome finish"],
  bronze: ["oil rubbed bronze", "antique bronze", "dark bronze"],
  copper: ["hammered copper", "copper finish"],
  rattan: ["wicker", "woven", "cane", "seagrass", "water hyacinth", "abaca"],
  bamboo: ["bamboo rattan"],
  "down fill": ["down blend", "down wrapped", "feather down", "down cushion"],
  foam: ["high density foam", "memory foam", "poly foam"],
  "upholstered": ["upholstery", "fabric covered", "fully upholstered"],

  // ── Design Details ──
  "nailhead trim": ["nailhead", "nail head", "nail-head", "brass nail", "antique nail"],
  "turned legs": ["turned", "spindle legs"],
  "tapered legs": ["tapered", "peg legs"],
  "metal base": ["metal legs", "steel base", "iron base"],
  "wood frame": ["exposed wood", "show wood"],
  "skirted base": ["fully skirted", "dressmaker skirt"],
  "x-base": ["x base", "cross base"],
  "pedestal base": ["pedestal", "column base", "tulip base"],
  "hairpin legs": ["hairpin", "mid-century legs"],

  // ── Size ──
  oversized: ["grand scale", "extra large", "xl", "large scale"],
  "apartment size": ["small scale", "compact", "petite", "condo size", "small space"],

  // ── Trade Jargon ──
  com: ["customers own material", "customer's own material", "c.o.m."],
  col: ["customers own leather", "customer's own leather", "c.o.l."],
  "hospitality grade": ["commercial grade", "contract", "contract grade"],
  "quick ship": ["in stock", "ready to ship", "quick delivery"],
  "to the trade": ["trade only", "designer only", "trade program"],
  msrp: ["retail price", "list price", "suggested retail"],
  net: ["wholesale", "trade price", "dealer price", "net price"],
};

// ── REVERSE INDEX ────────────────────────────────────────────
// Maps every synonym to its canonical term + all other synonyms

const _reverseIndex = new Map();

function _buildReverseIndex() {
  for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
    const allTerms = [canonical, ...synonyms];
    for (const term of allTerms) {
      const key = term.toLowerCase();
      if (!_reverseIndex.has(key)) _reverseIndex.set(key, new Set());
      for (const t of allTerms) {
        _reverseIndex.get(key).add(t.toLowerCase());
      }
    }
  }
}
_buildReverseIndex();

/**
 * Get all synonyms for a term (including the term itself).
 */
export function getSynonyms(term) {
  const key = term.toLowerCase();
  return _reverseIndex.has(key) ? [..._reverseIndex.get(key)] : [key];
}

// ── VENDOR SPECIALTIES ───────────────────────────────────────
// Boost scores for vendors known for specific product types

export const VENDOR_SPECIALTIES = {
  bernhardt: { boost: ["upholstery", "sofa", "chair", "sectional", "bedroom"], strength: 1.3 },
  century: { boost: ["upholstery", "sofa", "chair", "case goods", "dining"], strength: 1.3 },
  hooker: { boost: ["case goods", "desk", "bookcase", "dresser", "home-office"], strength: 1.3 },
  fourhands: { boost: ["modern", "accent", "industrial", "contemporary"], strength: 1.2 },
  "four-hands": { boost: ["modern", "accent", "industrial", "contemporary"], strength: 1.2 },
  caracole: { boost: ["glam", "art deco", "bedroom", "dining", "modern"], strength: 1.3 },
  lexington: { boost: ["coastal", "resort", "outdoor", "bedroom", "tommy bahama"], strength: 1.3 },
  stickley: { boost: ["traditional", "mission", "craftsman", "solid wood", "american", "arts and crafts"], strength: 1.3 },
  vanguard: { boost: ["transitional", "upholstery", "sofa", "chair", "custom"], strength: 1.2 },
  "visual-comfort": { boost: ["lighting", "chandelier", "sconce", "pendant", "lamp"], strength: 1.5 },
  arteriors: { boost: ["lighting", "accent", "table", "modern"], strength: 1.3 },
  loloi: { boost: ["rug", "area rug", "runner", "carpet"], strength: 1.5 },
  surya: { boost: ["rug", "lighting", "accent", "pillow"], strength: 1.4 },
  "jonathan-adler": { boost: ["modern", "glam", "eclectic", "accent", "lighting"], strength: 1.3 },
  "lulu-and-georgia": { boost: ["rug", "pillow", "modern", "bedroom", "living"], strength: 1.2 },
  "mcgee-and-co": { boost: ["transitional", "modern farmhouse", "living", "bedroom"], strength: 1.2 },
  flexsteel: { boost: ["recliner", "motion", "upholstery", "sofa", "sectional"], strength: 1.3 },
  universal: { boost: ["bedroom", "dining", "storage", "case goods", "transitional"], strength: 1.2 },
  baker: { boost: ["luxury", "traditional", "dining", "bedroom", "upholstery"], strength: 1.3 },
  "baker-furniture": { boost: ["luxury", "traditional", "dining", "bedroom", "upholstery"], strength: 1.3 },
  uttermost: { boost: ["lighting", "mirror", "accent", "table"], strength: 1.3 },
  currey: { boost: ["lighting", "chandelier", "accent"], strength: 1.4 },
  // Upholstery powerhouses
  "cr-laine": { boost: ["upholstery", "sofa", "chair", "custom", "fabric", "sectional"], strength: 1.3 },
  "lee-industries": { boost: ["upholstery", "sofa", "chair", "custom", "slipcover", "sectional", "performance fabric"], strength: 1.3 },
  sherrill: { boost: ["upholstery", "sofa", "chair", "traditional", "transitional", "custom"], strength: 1.3 },
  "sherrill-furniture": { boost: ["upholstery", "sofa", "chair", "traditional", "transitional", "custom"], strength: 1.3 },
  "wesley-hall": { boost: ["upholstery", "sofa", "chair", "bench made", "custom", "traditional"], strength: 1.3 },
  "hancock-and-moore": { boost: ["leather", "recliner", "chair", "sofa", "traditional", "motion"], strength: 1.4 },
  "hancock-moore": { boost: ["leather", "recliner", "chair", "sofa", "traditional", "motion"], strength: 1.4 },
  "highland-house": { boost: ["upholstery", "sofa", "chair", "transitional", "custom"], strength: 1.2 },
  "hickory-chair": { boost: ["traditional", "chair", "sofa", "dining", "upholstery", "luxury"], strength: 1.3 },
  "theodore-alexander": { boost: ["luxury", "traditional", "accent", "dining", "bedroom", "case goods"], strength: 1.3 },
};

// ── MATERIAL HIERARCHY ──────────────────────────────────────
// Maps abstract/descriptive material terms to specific searchable materials
// "dark wood" → walnut, mahogany, espresso, ebony, etc.

export const MATERIAL_HIERARCHY = {
  // Wood color families
  "dark wood": ["walnut", "mahogany", "espresso", "ebony", "dark brown", "java", "chocolate", "mink", "charcoal", "black wood", "wenge", "dark oak", "dark stain"],
  "light wood": ["oak", "ash", "maple", "birch", "pine", "natural", "blonde", "whitewash", "cerused", "bleached", "light oak", "white oak", "drift"],
  "medium wood": ["cherry", "teak", "pecan", "medium brown", "honey", "amber", "cognac", "warm brown", "chestnut"],
  "reclaimed wood": ["reclaimed", "salvaged", "distressed wood", "rustic wood", "barnwood", "recycled wood"],
  "solid wood": ["hardwood", "real wood", "all wood", "genuine wood"],

  // Metal families
  "dark metal": ["black metal", "dark bronze", "oil rubbed bronze", "matte black", "iron", "wrought iron", "gunmetal", "blackened"],
  "warm metal": ["brass", "gold", "copper", "rose gold", "antique brass", "brushed brass", "gilded", "gold leaf"],
  "cool metal": ["chrome", "nickel", "silver", "polished chrome", "brushed nickel", "stainless steel", "platinum"],
  "mixed metal": ["two tone", "mixed metals", "multi metal"],

  // Upholstery families
  "soft fabric": ["velvet", "chenille", "boucle", "mohair", "plush", "silk"],
  "durable fabric": ["performance fabric", "crypton", "sunbrella", "indoor outdoor", "stain resistant", "easy clean"],
  "natural fabric": ["linen", "cotton", "hemp", "jute", "wool", "burlap"],
  "woven": ["rattan", "wicker", "cane", "seagrass", "rope", "abaca", "water hyacinth"],

  // Stone families
  "natural stone": ["marble", "travertine", "limestone", "slate", "granite", "onyx", "quartzite"],
  "white stone": ["carrara", "calacatta", "white marble", "white quartz"],
  "dark stone": ["nero marquina", "black marble", "soapstone", "dark granite"],
};

// Build reverse material hierarchy for fast lookup
const _materialReverseMap = new Map();
for (const [abstract, specifics] of Object.entries(MATERIAL_HIERARCHY)) {
  for (const s of specifics) {
    if (!_materialReverseMap.has(s)) _materialReverseMap.set(s, []);
    _materialReverseMap.get(s).push(abstract);
  }
}

/**
 * Expand an abstract material term into specific searchable terms.
 * "dark wood" → ["walnut", "mahogany", "espresso", ...]
 * "marble" → ["marble"] (already specific)
 */
export function expandMaterial(term) {
  const lower = term.toLowerCase();
  // Direct hierarchy match
  if (MATERIAL_HIERARCHY[lower]) return MATERIAL_HIERARCHY[lower];
  // Already a specific term — return as-is plus any synonyms
  const syns = getSynonyms(lower);
  return syns.length > 1 ? syns : [lower];
}

// ── NATURAL LANGUAGE CATEGORY MAP ───────────────────────────
// Maps natural language descriptions to furniture categories

export const NATURAL_LANGUAGE_CATEGORIES = {
  "something to put behind my sofa": "console-tables",
  "something to put behind a sofa": "console-tables",
  "put behind a sofa": "console-tables",
  "put behind my sofa": "console-tables",
  "behind a sofa against a wall": "console-tables",
  "behind a sofa against the wall": "console-tables",
  "behind the sofa": "console-tables",
  "behind my sofa": "console-tables",
  "behind a sofa": "console-tables",
  "behind a couch": "console-tables",
  "something behind a sofa": "console-tables",
  "something behind the couch": "console-tables",
  "table behind sofa": "console-tables",
  "table behind couch": "console-tables",
  "something for behind a couch": "console-tables",
  "goes behind a sofa": "console-tables",
  "go behind a sofa": "console-tables",
  "narrow table for hallway": "console-tables",
  "narrow table for entryway": "console-tables",
  "something for the entryway": "console-tables",
  "entry furniture": "console-tables",
  "something to sit on": "accent-chairs",
  "somewhere to sit": "accent-chairs",
  "extra seating": "accent-chairs",
  "something to put my feet up": "ottomans",
  "foot rest": "ottomans",
  "put my drink on": "side-tables",
  "set my drink": "side-tables",
  "somewhere to set my drink": "side-tables",
  "place for drinks": "side-tables",
  "place to set a drink": "side-tables",
  "something next to my bed": "nightstands",
  "table next to bed": "nightstands",
  "bedside": "nightstands",
  "something to store books": "bookcases",
  "book storage": "bookcases",
  "display shelves": "bookcases",
  "somewhere to put the tv": "media-consoles",
  "tv furniture": "media-consoles",
  "tv stand": "media-consoles",
  "something to eat at": "dining-tables",
  "kitchen table": "dining-tables",
  "gather around": "dining-tables",
  "seats 8": "dining-tables",
  "seats 10": "dining-tables",
  "seats 12": "dining-tables",
  "reading chair": "accent-chairs",
  "reading nook": "accent-chairs",
  "cozy chair": "accent-chairs",
  "work from home": "desks",
  "home office": "desks",
  "work desk": "desks",
  "vanity": "desks",
  "makeup table": "desks",
  "bar seating": "bar-stools",
  "kitchen island seating": "bar-stools",
  "counter seating": "bar-stools",
  "place to lie down": "chaises",
  "somewhere to nap": "chaises",
  "wine storage": "cabinets",
  "bar area": "cabinets",
  "clothes storage": "dressers",
  "storing clothes": "dressers",

  // Competitor product references → what they actually are
  "rh cloud": "sofas",
  "cloud sofa": "sofas",
  "cloud couch": "sectionals",
  "pottery barn": "sofas",
  "crate and barrel": "sofas",
  "west elm": "accent-chairs",
  "similar to rh": "sofas",
};

// ── DIMENSION PATTERNS ──────────────────────────────────────
// Parse dimension constraints from natural language queries

/**
 * Extract dimension constraints from a query string.
 * Returns { width_max, width_min, depth_max, depth_min, height_max, height_min, seats }
 * All dimensions in inches. Returns null if no dimensions found.
 */
export function parseDimensionConstraints(query) {
  const q = query.toLowerCase();
  const constraints = {};
  let found = false;

  // "under X inches" / "less than X inches" / "X inches or less" / "max X inches"
  // Look ahead for deep/wide/tall qualifiers AND look behind for "X inches deep/wide/tall"
  const underMatch = q.match(/(?:under|less than|smaller than|no (?:wider|longer|taller|deeper) than|max|maximum|up to)\s+(\d+(?:\.\d+)?)\s*(?:inches|inch|in|"|'')?\s*(?:wide|width|deep|depth|tall|height|high|w\b|d\b|h\b)?/gi);
  if (underMatch) {
    for (const m of underMatch) {
      const val = parseFloat(m.match(/(\d+(?:\.\d+)?)/)[1]);
      // Skip values that are clearly prices (>=100 without inch/dimension indicator)
      if (val >= 100 && !/inches|inch|in\b|"|''|wide|deep|tall|width|depth|height/i.test(m)) continue;
      if (/deep|depth/i.test(m)) { constraints.depth_max = val; found = true; }
      else if (/tall|height|high/i.test(m)) { constraints.height_max = val; found = true; }
      else if (/wide|width/i.test(m)) { constraints.width_max = val; found = true; }
      else { constraints.width_max = val; found = true; } // Default to width
    }
  }

  // Also check "X inches deep/wide/tall" pattern (qualifier AFTER the number)
  const postQualMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:inches|inch|in|"|'')\s*(deep|wide|tall|high)/gi);
  if (postQualMatch) {
    for (const m of postQualMatch) {
      const val = parseFloat(m.match(/(\d+(?:\.\d+)?)/)[1]);
      if (/deep/i.test(m)) { constraints.depth_max = val; found = true; }
      else if (/tall|high/i.test(m)) { constraints.height_max = val; found = true; }
      else if (/wide/i.test(m)) { constraints.width_max = val; found = true; }
    }
  }

  // "over X inches" / "more than X inches" / "at least X"
  const overMatch = q.match(/(?:over|more than|bigger than|at least|larger than|min|minimum)\s+(\d+(?:\.\d+)?)\s*(?:inches|inch|in|"|'')?\s*(?:wide|width|deep|depth|tall|height|high|w\b|d\b|h\b)?/gi);
  if (overMatch) {
    for (const m of overMatch) {
      const val = parseFloat(m.match(/(\d+(?:\.\d+)?)/)[1]);
      if (val >= 100 && !/inches|inch|in\b|"|''|wide|deep|tall|width|depth|height/i.test(m)) continue;
      if (/deep|depth/i.test(m)) { constraints.depth_min = val; found = true; }
      else if (/tall|height|high/i.test(m)) { constraints.height_min = val; found = true; }
      else if (/wide|width/i.test(m)) { constraints.width_min = val; found = true; }
      else { constraints.width_min = val; found = true; }
    }
  }

  // Standalone "XX inches wide/long/tall" or "XX inch sofa"
  const dimMatch = q.match(/(\d+(?:\.\d+)?)\s*(?:inches|inch|in|"|'')?\s*(?:wide|width)/);
  if (dimMatch && !constraints.width_max && !constraints.width_min) {
    // Treat as approximate — ±10%
    const val = parseFloat(dimMatch[1]);
    constraints.width_min = Math.round(val * 0.9);
    constraints.width_max = Math.round(val * 1.1);
    found = true;
  }

  // "X inch sofa" without wide/tall qualifier — assume width
  const inchProduct = q.match(/(\d+)\s*(?:inches|inch|in|"|'')\s+(?:sofa|couch|table|desk|bed|dresser|credenza|bookcase|console|cabinet)/);
  if (inchProduct && !found) {
    const val = parseFloat(inchProduct[1]);
    constraints.width_max = val;
    found = true;
  }

  // "seats X" / "seat X" for dining tables
  const seatMatch = q.match(/seats?\s+(\d+)/i);
  if (seatMatch) {
    constraints.seats = parseInt(seatMatch[1]);
    // Infer minimum width from seating: ~24" per person, 2 sides
    const seats = constraints.seats;
    if (seats >= 10) { constraints.width_min = 108; }
    else if (seats >= 8) { constraints.width_min = 84; }
    else if (seats >= 6) { constraints.width_min = 66; }
    else if (seats >= 4) { constraints.width_min = 48; }
    found = true;
  }

  // "large" / "small" / "compact" modifiers
  if (/\blarge\b|\bbig\b|\bgrand\b|\boversized\b/.test(q) && !found) {
    constraints.width_min = 80;
    found = true;
  }
  if (/\bsmall\b|\bcompact\b|\bpetite\b|\bapartment\b|\bcondo\b|\bnarrow\b/.test(q) && !found) {
    constraints.width_max = 72;
    found = true;
  }

  return found ? constraints : null;
}

// ── PRICE SIGNALS ───────────────────────────────────────────

/**
 * Extract price constraints from a query string.
 * Returns { price_min, price_max, price_tier } or null.
 */
export function parsePriceSignals(query) {
  const q = query.toLowerCase();
  const result = {};
  let found = false;

  // Explicit price: "under $2000", "less than $5000"
  const underPrice = q.match(/(?:under|less than|below|up to|max|budget)\s*\$?\s*(\d[\d,]*)/);
  if (underPrice) {
    result.price_max = parseInt(underPrice[1].replace(/,/g, ''));
    found = true;
  }

  // "over $1000", "starting at $500"
  const overPrice = q.match(/(?:over|above|more than|starting at|at least|min)\s*\$?\s*(\d[\d,]*)/);
  if (overPrice) {
    result.price_min = parseInt(overPrice[1].replace(/,/g, ''));
    found = true;
  }

  // Range: "$1000-$3000" or "$1000 to $3000"
  const rangePrice = q.match(/\$?\s*(\d[\d,]*)\s*(?:-|to)\s*\$?\s*(\d[\d,]*)/);
  if (rangePrice) {
    result.price_min = parseInt(rangePrice[1].replace(/,/g, ''));
    result.price_max = parseInt(rangePrice[2].replace(/,/g, ''));
    found = true;
  }

  // Tier signals
  if (/\baffordable\b|\bbudget\b|\binexpensive\b|\bcheap\b|\bvalue\b/.test(q)) {
    result.price_tier = "value";
    if (!result.price_max) result.price_max = 2000;
    found = true;
  }
  if (/\bluxury\b|\bhigh end\b|\bhigh-end\b|\bpremium\b|\bfinest\b|\bbest\b|\btop of the line\b/.test(q)) {
    result.price_tier = "luxury";
    found = true;
  }
  if (/\bmid range\b|\bmid-range\b|\bmoderate\b|\bmiddle\b/.test(q)) {
    result.price_tier = "mid";
    if (!result.price_min) result.price_min = 1000;
    if (!result.price_max) result.price_max = 5000;
    found = true;
  }

  return found ? result : null;
}

// ── COLLECTION KEYWORDS ─────────────────────────────────────
// Known collection names across vendors for collection-aware search

export const KNOWN_COLLECTIONS = [
  // Baker
  "Barbara Barry", "Thomas Pheasant", "Bill Sofield", "Laura Kirar", "Jean-Louis Deniot", "Jacques Garcia",
  "McGuire", "Milling Road",
  // Stickley
  "Mission", "Harvey Ellis", "Metropolitan", "Collector Edition", "Nichols and Stone",
  "Highlands", "Sterling",
  // Caracole
  "Classic", "Signature", "Modern", "La Vie", "Compositions",
  // Century
  "Monarch", "Grand Tour", "Omni", "Thomas O Brien", "Carrier and Company",
  // Bernhardt
  "Interiors", "Criteria", "Linea", "Albion", "Profile", "Soliloquy", "Loft",
  // Lexington
  "Tommy Bahama", "Barclay Butera", "Ariana", "Carlyle", "Silverado", "Shadow Play",
  // Theodore Alexander
  "Alexa Hampton", "Steve Leung", "Michael Berman", "Studio",
  // Hickory Chair
  "Suzanne Kasler", "Mariette Himes Gomez", "Mark Hampton", "Ray Booth",
  // Universal
  "Coastal Living", "Modern Farmhouse", "Midtown",
  // Hooker
  "Cynthia Rowley", "Mélange", "Sanctuary", "Archivist",
];

// ── QUERY EXPANSION ──────────────────────────────────────────

/**
 * Expand a query's tokens with synonyms and trade jargon.
 * Returns expanded set of search tokens.
 *
 * @param {string[]} tokens - Tokenized query
 * @returns {string[]} - Expanded tokens (includes originals + synonyms)
 */
export function expandQuery(tokens) {
  const expanded = new Set(tokens);

  // Try matching multi-word phrases first (up to 4-grams)
  const text = tokens.join(" ");
  for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
    const allTerms = [canonical, ...synonyms];
    for (const term of allTerms) {
      if (text.includes(term)) {
        // Add all synonyms for matched term
        for (const t of allTerms) {
          for (const word of t.split(/\s+/)) {
            expanded.add(word);
          }
        }
      }
    }
  }

  // Single-token synonym expansion
  for (const token of tokens) {
    const syns = getSynonyms(token);
    for (const s of syns) {
      for (const word of s.split(/\s+/)) {
        expanded.add(word);
      }
    }
  }

  return [...expanded];
}

/**
 * Get related search terms for a concept (used by Find Similar).
 */
export function getRelatedTerms(term) {
  return getSynonyms(term);
}

/**
 * Detect a collection name in a query string.
 * Returns the collection name or null.
 */
// Terms that are both style names AND collection names — only match as collection
// if followed by "collection" or preceded by a vendor name
const AMBIGUOUS_COLLECTION_NAMES = new Set(["mission", "modern", "classic", "contemporary"]);

export function detectCollectionInQuery(query) {
  const q = query.toLowerCase();

  // Check "X collection" pattern first (highest confidence)
  const collMatch = query.match(/(\w[\w\s]+?)\s+collection/i);
  if (collMatch) return collMatch[1].trim();

  for (const coll of KNOWN_COLLECTIONS) {
    const collLower = coll.toLowerCase();
    if (q.includes(collLower)) {
      // Skip ambiguous names unless explicitly used as collection
      if (AMBIGUOUS_COLLECTION_NAMES.has(collLower)) continue;
      return coll;
    }
  }

  return null;
}
