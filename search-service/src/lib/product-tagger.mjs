/**
 * Smart Product Tagging Engine
 *
 * Extracts structured furniture-specific tags from product data
 * using pure regex and string matching. Zero API cost.
 *
 * Parses descriptions, names, materials, and categories to extract:
 * - Cushion configurations (3 over 3, bench seat, tight back)
 * - Arm styles (track arm, rolled arm, slope arm)
 * - Silhouettes (tufted, wingback, barrel, channel back)
 * - Size indicators (oversized, apartment size, dimensions)
 * - Material details (top grain leather, performance fabric, boucle)
 * - Design details (nailhead trim, turned legs, metal base)
 * - Room suitability (living room, bedroom, outdoor)
 * - Use context (hospitality, commercial, residential)
 */

// ── TAG EXTRACTION RULES ────────────────────────────────────
// Each rule: { tag, patterns: [regex or string] }
// Patterns are tested against the combined text of name + description + material + style + category

const CUSHION_CONFIGS = [
  { tag: "three-over-three", patterns: [/\b3\s*over\s*3\b/i, /\bthree\s*over\s*three\b/i, /\b3\/3\b/, /\bthree cushion seat and back\b/i, /\b3 seat 3 back\b/i] },
  { tag: "two-over-two", patterns: [/\b2\s*over\s*2\b/i, /\btwo\s*over\s*two\b/i, /\b2\/2\b/] },
  { tag: "bench-seat", patterns: [/\bbench\s*seat\b/i, /\bsingle\s*cushion\s*seat\b/i, /\bone\s*cushion\b/i, /\bbench\s*cushion\b/i] },
  { tag: "tight-back", patterns: [/\btight\s*back\b/i, /\battached\s*back\b/i, /\bfixed\s*back\b/i] },
  { tag: "loose-back", patterns: [/\bloose\s*back\b/i, /\bdetached\s*back\b/i, /\bpillow\s*back\b/i, /\bremovable\s*back\b/i] },
  { tag: "loose-cushion", patterns: [/\bloose\s*cushion/i, /\bremovable\s*cushion/i, /\breversible\s*cushion/i] },
  { tag: "tight-seat", patterns: [/\btight\s*seat\b/i, /\battached\s*seat\b/i, /\bfixed\s*seat\b/i] },
  { tag: "down-fill", patterns: [/\bdown\s*fill\b/i, /\bdown\s*blend\b/i, /\bdown\s*wrap/i, /\bfeather\s*down\b/i, /\bdown\s*cushion\b/i] },
  { tag: "spring-down", patterns: [/\bspring\s*down\b/i, /\bcoil\s*down\b/i] },
  { tag: "foam-cushion", patterns: [/\bfoam\s*cushion\b/i, /\bhigh\s*density\s*foam\b/i, /\bhigh\s*resiliency\b/i] },
];

const ARM_STYLES = [
  { tag: "track-arm", patterns: [/\btrack\s*arm/i, /\bstraight\s*arm/i, /\bsquare\s*arm/i] },
  { tag: "rolled-arm", patterns: [/\broll(?:ed)?\s*arm/i, /\bscroll\s*arm/i, /\bround\s*arm/i, /\bsock\s*arm/i] },
  { tag: "slope-arm", patterns: [/\bslope[d]?\s*arm/i, /\bangled\s*arm/i, /\bflared?\s*arm/i] },
  { tag: "english-arm", patterns: [/\benglish\s*arm/i, /\bbridgewater\s*arm/i] },
  { tag: "armless", patterns: [/\barmless\b/i, /\bno\s*arms?\b/i, /\bwithout\s*arms?\b/i] },
  { tag: "pillow-arm", patterns: [/\bpillow\s*arm/i, /\bpillow\s*top\s*arm/i] },
  { tag: "key-arm", patterns: [/\bkey\s*arm/i] },
  { tag: "pad-arm", patterns: [/\bpad(?:ded)?\s*arm/i] },
];

const SILHOUETTES = [
  { tag: "tufted", patterns: [/\btufted\b/i, /\bbutton\s*tuft/i, /\bdiamond\s*tuft/i, /\bbiscuit\s*tuft/i] },
  { tag: "channel-back", patterns: [/\bchannel\s*back\b/i, /\bchannel\s*tuft/i, /\bvertical\s*channel/i] },
  { tag: "wingback", patterns: [/\bwing\s*back\b/i, /\bwingback\b/i, /\bwing\s*chair\b/i] },
  { tag: "barrel", patterns: [/\bbarrel\s*back\b/i, /\bbarrel\s*chair\b/i, /\bcurved\s*back\b/i] },
  { tag: "skirted", patterns: [/\bskirted\b/i, /\bskirt\b/i, /\bdressmaker\b/i, /\bfully\s*skirted\b/i] },
  { tag: "low-profile", patterns: [/\blow\s*profile\b/i, /\blow[\s-]*back\b/i, /\blow[\s-]*slung\b/i] },
  { tag: "high-back", patterns: [/\bhigh[\s-]*back\b/i, /\btall[\s-]*back\b/i] },
  { tag: "camelback", patterns: [/\bcamel\s*back\b/i, /\bcamelback\b/i] },
  { tag: "lawson", patterns: [/\blawson\b/i] },
  { tag: "chesterfield", patterns: [/\bchesterfield\b/i] },
  { tag: "tuxedo", patterns: [/\btuxedo\b/i, /\btux\s*arm\b/i, /\beven\s*arm\b/i] },
  { tag: "bridgewater", patterns: [/\bbridgewater\b/i] },
  { tag: "mid-century", patterns: [/\bmid[\s-]*century\b/i, /\bmcm\b/i, /\bmidcentury\b/i] },
  { tag: "shelter-arm", patterns: [/\bshelter\s*arm/i, /\bshelter\s*sofa/i] },
  { tag: "sectional", patterns: [/\bsectional\b/i, /\bmodular\b/i, /\bl[\s-]*shaped?\b/i, /\bu[\s-]*shaped?\b/i] },
  { tag: "sleeper", patterns: [/\bsleeper\b/i, /\bsofa\s*bed\b/i, /\bpull[\s-]*out\s*bed\b/i, /\bconvertible\b/i] },
  { tag: "reclining", patterns: [/\breclining\b/i, /\brecliner\b/i, /\bpower\s*recline/i, /\bmotion\b/i] },
  { tag: "swivel", patterns: [/\bswivel\b/i, /\b360\b/i, /\brotating\b/i] },
];

const SIZE_KEYWORDS = [
  { tag: "oversized", patterns: [/\boversized?\b/i, /\bgrand\s*scale\b/i, /\bextra\s*large\b/i, /\blarge\s*scale\b/i] },
  { tag: "apartment-size", patterns: [/\bapartment\s*size\b/i, /\bsmall\s*scale\b/i, /\bcompact\b/i, /\bpetite\b/i, /\bcondo\s*size\b/i, /\bsmall\s*space\b/i] },
  { tag: "king", patterns: [/\bking\s*(?:size|bed)\b/i] },
  { tag: "queen", patterns: [/\bqueen\s*(?:size|bed)\b/i] },
  { tag: "twin", patterns: [/\btwin\s*(?:size|bed)\b/i] },
  { tag: "california-king", patterns: [/\bcalifornia\s*king\b/i, /\bcal[\s-]*king\b/i] },
];

const MATERIAL_DETAILS = [
  { tag: "top-grain-leather", patterns: [/\btop[\s-]*grain\s*leather\b/i, /\bfull[\s-]*grain\s*leather\b/i, /\bpremium\s*leather\b/i] },
  { tag: "performance-fabric", patterns: [/\bperformance\s*fabric\b/i, /\bstain[\s-]*resistant\b/i, /\beasy[\s-]*clean\b/i, /\bindoor[\s-]*outdoor\b/i] },
  { tag: "boucle", patterns: [/\bboucl[eé]\b/i, /\btextured\s*weave\b/i] },
  { tag: "velvet", patterns: [/\bvelvet\b/i, /\bvelour\b/i, /\bcrushed\s*velvet\b/i] },
  { tag: "linen", patterns: [/\blinen\b/i, /\bflax\b/i, /\blinen\s*blend\b/i] },
  { tag: "leather", patterns: [/\bleather\b/i] },
  { tag: "fabric", patterns: [/\bfabric\b/i, /\bupholstered\b/i] },
  { tag: "solid-wood", patterns: [/\bsolid\s*wood\b/i, /\bsolid\s*(?:walnut|oak|maple|cherry|mahogany|teak)\b/i] },
  { tag: "reclaimed-wood", patterns: [/\breclaimed\s*wood\b/i, /\breclaimed\b/i, /\bsalvaged\s*wood\b/i] },
  { tag: "marble-top", patterns: [/\bmarble\s*top\b/i, /\bcarrara\b/i, /\bcalacatta\b/i, /\bstone\s*top\b/i] },
  { tag: "glass-top", patterns: [/\bglass\s*top\b/i, /\btempered\s*glass\b/i] },
  { tag: "rattan", patterns: [/\brattan\b/i, /\bwicker\b/i, /\bwoven\b/i, /\bcane\b/i] },
  { tag: "metal", patterns: [/\bmetal\b/i, /\bsteel\b/i, /\biron\b/i] },
  { tag: "brass", patterns: [/\bbrass\b/i] },
  { tag: "gold-finish", patterns: [/\bgold\s*(?:finish|leaf|tone)\b/i, /\bgilt\b/i] },
  { tag: "chrome", patterns: [/\bchrome\b/i, /\bpolished\s*(?:nickel|steel)\b/i] },
  { tag: "hand-finished", patterns: [/\bhand[\s-]*finished\b/i, /\bhand[\s-]*crafted\b/i, /\bhandmade\b/i, /\bhand[\s-]*carved\b/i, /\bartisan\b/i] },
  { tag: "distressed", patterns: [/\bdistressed\b/i, /\bweathered\b/i, /\bantiqued\b/i, /\baged\b/i] },
  { tag: "lacquered", patterns: [/\blacquer(?:ed)?\b/i, /\bgloss\s*finish\b/i, /\bhigh[\s-]*gloss\b/i] },
];

const DESIGN_DETAILS = [
  { tag: "nailhead-trim", patterns: [/\bnail\s*head/i, /\bnailhead/i, /\bbrass\s*nail/i, /\bantique\s*nail/i] },
  { tag: "turned-legs", patterns: [/\bturned\s*legs?\b/i, /\bspindle\s*legs?\b/i] },
  { tag: "tapered-legs", patterns: [/\btapered\s*legs?\b/i, /\bpeg\s*legs?\b/i] },
  { tag: "metal-base", patterns: [/\bmetal\s*(?:base|legs?|frame)\b/i, /\bsteel\s*(?:base|legs?|frame)\b/i, /\biron\s*(?:base|legs?|frame)\b/i] },
  { tag: "wood-frame", patterns: [/\bwood\s*frame\b/i, /\bexposed\s*wood\b/i, /\bshow\s*wood\b/i] },
  { tag: "x-base", patterns: [/\bx[\s-]*base\b/i, /\bcross\s*base\b/i] },
  { tag: "pedestal-base", patterns: [/\bpedestal\b/i, /\bcolumn\s*base\b/i, /\btulip\s*base\b/i] },
  { tag: "hairpin-legs", patterns: [/\bhairpin\b/i] },
  { tag: "storage", patterns: [/\bstorage\b/i, /\bdrawers?\b/i, /\bshelf\b/i, /\bshelves\b/i, /\bcupboard\b/i] },
  { tag: "adjustable", patterns: [/\badjustable\b/i, /\bheight[\s-]*adjustable\b/i, /\bextend(?:able|ible)\b/i] },
  { tag: "with-leaf", patterns: [/\bwith\s*leaf\b/i, /\b(?:one|two|1|2)\s*leaf\b/i, /\bleaves\b/i, /\bextension\s*leaf\b/i] },
];

const ROOM_CONTEXT = [
  { tag: "living-room", patterns: [/\bliving\s*room\b/i, /\bfamily\s*room\b/i, /\bgreat\s*room\b/i, /\bden\b/i] },
  { tag: "bedroom", patterns: [/\bbedroom\b/i, /\bmaster\s*(?:bed|suite)\b/i, /\bguest\s*room\b/i] },
  { tag: "dining-room", patterns: [/\bdining\s*room\b/i, /\bbreakfast\s*(?:room|nook)\b/i] },
  { tag: "outdoor", patterns: [/\boutdoor\b/i, /\bpatio\b/i, /\bgarden\b/i, /\bterrace\b/i, /\bpool\b/i, /\ball[\s-]*weather\b/i] },
  { tag: "office", patterns: [/\boffice\b/i, /\bhome\s*office\b/i, /\bstudy\b/i, /\bworkspace\b/i] },
  { tag: "entryway", patterns: [/\bentry\b/i, /\bentryway\b/i, /\bfoyer\b/i, /\bhallway\b/i, /\bmudroom\b/i] },
  { tag: "bathroom", patterns: [/\bbathroom\b/i, /\bbath\b/i, /\bvanity\b/i, /\bpowder\s*room\b/i] },
];

const USE_CONTEXT = [
  { tag: "hospitality", patterns: [/\bhospitality\b/i, /\bhotel\b/i, /\bresort\b/i, /\blobby\b/i, /\bcommercial\s*grade\b/i, /\bcontract\s*grade\b/i, /\bcontract\b/i] },
  { tag: "quick-ship", patterns: [/\bquick\s*ship\b/i, /\bin\s*stock\b/i, /\bready\s*to\s*ship\b/i] },
  { tag: "customizable", patterns: [/\bcustom(?:izable)?\b/i, /\bmade[\s-]*to[\s-]*order\b/i, /\bcom\b(?!fort|plete|ponent|mand|puter|e\b|mon|b|edy|plex)/i, /\bcol\b(?!or|lect|laps|umn)/i] },
  { tag: "sustainable", patterns: [/\bsustainable\b/i, /\beco[\s-]*friendly\b/i, /\bfsc\b/i, /\brecycled\b/i, /\borganic\b/i] },
];

// Combine all rule sets
const ALL_RULES = [
  ...CUSHION_CONFIGS,
  ...ARM_STYLES,
  ...SILHOUETTES,
  ...SIZE_KEYWORDS,
  ...MATERIAL_DETAILS,
  ...DESIGN_DETAILS,
  ...ROOM_CONTEXT,
  ...USE_CONTEXT,
];

// ── DIMENSION EXTRACTION ─────────────────────────────────────

const DIM_PATTERNS = [
  // 72"W x 36"D x 30"H or 72" W x 36" D x 30" H
  /(\d+(?:\.\d+)?)\s*[""]?\s*[Ww](?:ide|idth)?\s*[x×X,]\s*(\d+(?:\.\d+)?)\s*[""]?\s*[Dd](?:eep|epth)?\s*[x×X,]\s*(\d+(?:\.\d+)?)\s*[""]?\s*[Hh](?:igh|eight)?/,
  // 72 x 36 x 30 (inches implied)
  /(\d{2,3})\s*[x×X]\s*(\d{2,3})\s*[x×X]\s*(\d{2,3})/,
  // W: 72" D: 36" H: 30"
  /[Ww](?:idth)?[:\s]+(\d+(?:\.\d+)?)\s*[""]?\s*[Dd](?:epth)?[:\s]+(\d+(?:\.\d+)?)\s*[""]?\s*[Hh](?:eight)?[:\s]+(\d+(?:\.\d+)?)/,
];

function extractDimensions(text) {
  if (!text) return null;
  for (const pattern of DIM_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const w = parseFloat(m[1]);
      const d = parseFloat(m[2]);
      const h = parseFloat(m[3]);
      if (w > 0 && d > 0 && h > 0) {
        return { width: w, depth: d, height: h };
      }
    }
  }
  return null;
}

// ── COLOR/FINISH EXTRACTION ──────────────────────────────────

const COLOR_MAP = {
  // Warm tones
  cognac: "brown", camel: "brown", saddle: "brown", espresso: "brown", chocolate: "brown",
  walnut: "brown", chestnut: "brown", cocoa: "brown", mocha: "brown", umber: "brown",
  sienna: "brown", tobacco: "brown", whiskey: "brown", bourbon: "brown",
  cream: "white", ivory: "white", pearl: "white", alabaster: "white", linen: "white", snow: "white",
  charcoal: "gray", slate: "gray", pewter: "gray", ash: "gray", smoke: "gray", fog: "gray",
  graphite: "gray", silver: "gray",
  navy: "blue", indigo: "blue", cobalt: "blue", sapphire: "blue", azure: "blue", ocean: "blue",
  denim: "blue", slate: "blue",
  emerald: "green", sage: "green", olive: "green", forest: "green", moss: "green", jade: "green",
  hunter: "green", eucalyptus: "green",
  blush: "pink", rose: "pink", coral: "pink", dusty: "pink", mauve: "pink",
  mustard: "yellow", gold: "yellow", amber: "yellow", saffron: "yellow",
  terracotta: "orange", rust: "orange", burnt: "orange", copper: "orange",
  black: "black", ebony: "black", onyx: "black", jet: "black",
  natural: "natural", sand: "natural", driftwood: "natural", oatmeal: "natural",
};

function extractColorTags(text) {
  if (!text) return [];
  const tags = new Set();
  const lower = text.toLowerCase();
  for (const [colorWord, family] of Object.entries(COLOR_MAP)) {
    if (lower.includes(colorWord)) {
      tags.add(colorWord);
      tags.add(family);
    }
  }
  return [...tags];
}

// ── MAIN TAG EXTRACTION ──────────────────────────────────────

/**
 * Extract structured furniture tags from a product.
 *
 * @param {object} product - Product with name, description, material, style, category, color fields
 * @returns {string[]} - Array of extracted tags
 */
export function extractTags(product) {
  // Build combined text from all available fields
  const parts = [
    product.product_name || "",
    product.description || "",
    product.material || "",
    product.style || "",
    product.category || "",
    product.color || "",
    product.collection || "",
  ];
  const text = parts.join(" ");
  if (text.length < 5) return [];

  const tags = new Set();

  // Run all rule sets
  for (const rule of ALL_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        tags.add(rule.tag);
        break; // One match per rule is enough
      }
    }
  }

  // Extract color tags
  for (const ct of extractColorTags(text)) {
    tags.add(ct);
  }

  // Extract dimensions and add size-range tags
  const dims = extractDimensions(text);
  if (dims) {
    if (dims.width >= 90) tags.add("oversized");
    if (dims.width >= 80 && dims.width < 90) tags.add("large");
    if (dims.width >= 60 && dims.width < 80) tags.add("medium");
    if (dims.width < 60 && dims.width > 20) tags.add("compact");
  }

  // Cap at 50 tags per product
  const result = [...tags];
  return result.length > 50 ? result.slice(0, 50) : result;
}

/**
 * Run the tagging engine on all products in a batch.
 * Returns a map of product_id -> extracted_tags.
 */
export function batchExtractTags(products) {
  const results = new Map();
  for (const p of products) {
    results.set(p.id, extractTags(p));
  }
  return results;
}
