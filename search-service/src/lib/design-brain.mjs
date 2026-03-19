/**
 * Spekd Design Brain — The Thinking Layer
 *
 * Every search flows through this module first. It doesn't match keywords —
 * it REASONS about what a designer wants before touching the catalog.
 *
 * This is a rule-based expert system encoding decades of furniture industry
 * knowledge. No API calls. No tokens burned. Instant and free.
 *
 * Pipeline:
 *   1. analyzeQuery()   → Build mental model of designer intent
 *   2. buildSearchPlan() → Translate thinking into structured search params
 *   3. applySearchPlan() → Execute plan against catalog with boosting/filtering
 *   4. groupResults()    → Organize results into meaningful sections
 */

import { tradeVendors } from "../config/trade-vendors.mjs";
import { getSynonyms, SYNONYMS, VENDOR_SPECIALTIES } from "./furniture-dictionary.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE BASE — The Designer's Brain encoded in data
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TIER SIGNALS — What language tells us about quality expectations
 */
const TIER_SIGNALS = {
  luxury: {
    triggers: [
      "high end", "high-end", "highest end", "luxury", "luxurious",
      "top of the line", "finest", "showroom quality", "heirloom quality",
      "investment piece", "forever piece", "museum quality", "couture",
      "bespoke", "heirloom", "world class", "flagship",
      // Luxury vendor names as signals
      "baker", "holly hunt", "donghia", "ej victor", "ralph lauren home",
      "marge carson", "hickory chair", "hancock moore", "kravet",
    ],
    vendor_tiers: [1, 2],
    quality_minimum: 40,
    price_floor: 2000,
  },
  premium: {
    triggers: [
      "designer", "design quality", "trade", "to the trade", "trade quality",
      "quality", "well made", "well-made", "beautifully made", "solid construction",
      "showroom", "professional", "design forward",
      // Premium vendor names
      "bernhardt", "century", "vanguard", "theodore alexander", "caracole",
      "lexington", "four hands",
    ],
    vendor_tiers: [1, 2],
    quality_minimum: 60,
    price_floor: 1500,
  },
  upper_mid: {
    triggers: [
      "good quality", "well priced", "value", "practical", "family friendly",
      "family-friendly", "durable", "everyday", "real life", "kid friendly",
      "pet friendly", "livable", "comfortable",
      // Upper-mid vendor signals
      "universal", "hooker", "flexsteel", "stickley",
    ],
    vendor_tiers: [1, 2, 3],
    quality_minimum: 45,
    price_floor: 800,
  },
  commercial: {
    triggers: [
      "hotel", "hospitality", "commercial", "commercial grade", "contract",
      "contract grade", "hospitality grade", "high traffic", "lobby",
      "restaurant", "office", "corporate", "healthcare", "senior living",
      "multifamily", "model home", "staging",
    ],
    vendor_tiers: [1, 2, 3],
    quality_minimum: 50,
    requires_commercial: true,
  },
  mid: {
    triggers: [
      "affordable", "budget", "budget friendly", "inexpensive", "starter",
      "first apartment", "rental",
    ],
    vendor_tiers: [1, 2, 3, 4],
    quality_minimum: 30,
    price_floor: 0,
  },
};

/**
 * ROOM CONTEXTS — What the room tells us about material + durability needs
 */
const ROOM_CONTEXTS = {
  // ── Living Spaces ──
  "family room": {
    material_preferences: ["performance fabric", "leather", "durable fabric", "stain resistant"],
    material_exclusions: ["silk", "natural linen", "delicate", "dry clean only"],
    attributes: ["durable", "stain resistant", "comfortable", "deep seat", "kid friendly", "pet friendly"],
    durability: "high",
    style_lean: "casual",
    default_categories: ["sectional sofa", "sofa", "ottoman", "coffee table", "side table", "rug"],
  },
  "living room": {
    material_preferences: ["performance fabric", "velvet", "leather", "linen"],
    material_exclusions: [],
    attributes: ["refined", "comfortable", "well proportioned"],
    durability: "medium",
    style_lean: "balanced",
    default_categories: ["sofa", "accent chair", "coffee table", "side table", "console table", "rug", "lighting"],
  },
  "formal living room": {
    material_preferences: ["velvet", "silk", "high-end fabric", "leather", "damask"],
    material_exclusions: ["performance fabric"],
    attributes: ["elegant", "refined", "detailed", "impressive"],
    durability: "low",
    style_lean: "formal",
    default_categories: ["sofa", "accent chair", "coffee table", "side table", "console table", "lighting"],
  },
  "great room": {
    material_preferences: ["performance fabric", "leather", "durable"],
    material_exclusions: [],
    attributes: ["large scale", "comfortable", "durable", "versatile"],
    durability: "high",
    style_lean: "casual",
    default_categories: ["sectional sofa", "sofa", "coffee table", "accent chair", "rug", "lighting"],
  },
  "den": {
    material_preferences: ["leather", "performance fabric", "velvet"],
    material_exclusions: [],
    attributes: ["comfortable", "cozy", "relaxed", "intimate"],
    durability: "medium",
    style_lean: "casual",
    default_categories: ["sofa", "accent chair", "ottoman", "side table", "rug"],
  },
  "sitting room": {
    material_preferences: ["velvet", "linen", "silk blend", "boucle"],
    material_exclusions: [],
    attributes: ["elegant", "conversational", "refined"],
    durability: "low",
    style_lean: "formal",
    default_categories: ["accent chair", "sofa", "side table", "console table", "lighting"],
  },
  "sunroom": {
    material_preferences: ["performance fabric", "rattan", "wicker", "indoor outdoor"],
    material_exclusions: ["silk", "velvet", "dark leather"],
    attributes: ["light", "airy", "fade resistant", "casual"],
    durability: "medium",
    style_lean: "casual",
    default_categories: ["sofa", "accent chair", "side table", "coffee table"],
  },

  // ── Dining ──
  "dining room": {
    material_preferences: ["wood", "upholstered seat", "leather", "performance fabric"],
    material_exclusions: [],
    attributes: ["well proportioned", "refined", "comfortable seating"],
    durability: "medium",
    style_lean: "balanced",
    default_categories: ["dining table", "dining chair", "credenza", "lighting", "rug", "mirror"],
  },
  "formal dining room": {
    material_preferences: ["mahogany", "walnut", "velvet", "silk", "leather"],
    material_exclusions: [],
    attributes: ["impressive", "elegant", "detailed", "large scale"],
    durability: "low",
    style_lean: "formal",
    default_categories: ["dining table", "dining chair", "credenza", "chandelier", "mirror"],
  },
  "breakfast nook": {
    material_preferences: ["performance fabric", "wood", "painted finish"],
    material_exclusions: [],
    attributes: ["casual", "compact", "comfortable", "easy clean"],
    durability: "high",
    style_lean: "casual",
    default_categories: ["dining table", "dining chair", "bench", "lighting"],
  },
  "kitchen": {
    material_preferences: ["performance fabric", "metal", "wood", "leather", "easy clean"],
    material_exclusions: ["silk", "velvet"],
    attributes: ["durable", "easy clean", "compact"],
    durability: "high",
    style_lean: "casual",
    default_categories: ["bar stool", "counter stool", "dining table", "lighting"],
  },

  // ── Bedroom ──
  "master bedroom": {
    material_preferences: ["velvet", "linen", "boucle", "performance fabric", "leather"],
    material_exclusions: [],
    attributes: ["luxurious", "comfortable", "personal", "serene"],
    durability: "medium",
    style_lean: "refined",
    default_categories: ["bed", "nightstand", "dresser", "bench", "accent chair", "rug", "lighting", "mirror"],
  },
  "primary bedroom": {
    material_preferences: ["velvet", "linen", "boucle", "performance fabric", "leather"],
    material_exclusions: [],
    attributes: ["luxurious", "comfortable", "personal", "serene"],
    durability: "medium",
    style_lean: "refined",
    default_categories: ["bed", "nightstand", "dresser", "bench", "accent chair", "rug", "lighting", "mirror"],
  },
  "guest bedroom": {
    material_preferences: ["performance fabric", "linen", "cotton"],
    material_exclusions: [],
    attributes: ["welcoming", "comfortable", "practical"],
    durability: "medium",
    style_lean: "balanced",
    default_categories: ["bed", "nightstand", "dresser", "bench", "rug", "lighting"],
  },
  "kids room": {
    material_preferences: ["performance fabric", "durable", "easy clean", "painted finish"],
    material_exclusions: ["silk", "velvet", "natural linen", "white fabric"],
    attributes: ["durable", "fun", "safe", "easy clean", "stain resistant"],
    durability: "high",
    style_lean: "casual",
    default_categories: ["bed", "nightstand", "dresser", "desk", "bookcase", "rug"],
  },
  "nursery": {
    material_preferences: ["performance fabric", "painted finish", "natural wood"],
    material_exclusions: ["glass", "sharp edges", "heavy marble"],
    attributes: ["safe", "soft", "calming", "practical"],
    durability: "high",
    style_lean: "casual",
    default_categories: ["dresser", "accent chair", "rug", "lighting", "bookcase"],
  },

  // ── Work ──
  "home office": {
    material_preferences: ["leather", "wood", "metal", "performance fabric"],
    material_exclusions: [],
    attributes: ["functional", "organized", "professional", "comfortable"],
    durability: "medium",
    style_lean: "balanced",
    default_categories: ["desk", "office chair", "bookcase", "lighting", "rug"],
  },
  "study": {
    material_preferences: ["leather", "wood", "brass"],
    material_exclusions: [],
    attributes: ["scholarly", "refined", "warm", "focused"],
    durability: "medium",
    style_lean: "refined",
    default_categories: ["desk", "chair", "bookcase", "lighting"],
  },
  "library": {
    material_preferences: ["leather", "wood", "velvet", "brass"],
    material_exclusions: [],
    attributes: ["scholarly", "classic", "rich", "warm"],
    durability: "low",
    style_lean: "formal",
    default_categories: ["bookcase", "accent chair", "desk", "lighting", "rug", "side table"],
  },

  // ── Transition / Utility ──
  "entryway": {
    material_preferences: ["durable", "metal", "wood", "stone"],
    material_exclusions: ["delicate fabric"],
    attributes: ["compact", "functional", "welcoming", "durable"],
    durability: "high",
    style_lean: "balanced",
    default_categories: ["console table", "bench", "mirror", "lighting", "rug"],
  },
  "foyer": {
    material_preferences: ["marble", "metal", "wood", "stone"],
    material_exclusions: [],
    attributes: ["impressive", "elegant", "welcoming", "statement"],
    durability: "medium",
    style_lean: "formal",
    default_categories: ["console table", "mirror", "lighting", "bench", "rug"],
  },
  "hallway": {
    material_preferences: ["durable", "narrow", "compact"],
    material_exclusions: [],
    attributes: ["narrow", "compact", "functional"],
    durability: "medium",
    style_lean: "balanced",
    default_categories: ["console table", "mirror", "lighting", "rug"],
  },
  "mudroom": {
    material_preferences: ["performance fabric", "metal", "painted finish", "durable"],
    material_exclusions: ["silk", "velvet", "leather"],
    attributes: ["extremely durable", "easy clean", "functional", "storage"],
    durability: "high",
    style_lean: "casual",
    default_categories: ["bench", "bookcase", "mirror"],
  },
  "powder room": {
    material_preferences: ["metal", "marble", "glass", "brass"],
    material_exclusions: [],
    attributes: ["statement", "elegant", "compact"],
    durability: "low",
    style_lean: "formal",
    default_categories: ["mirror", "lighting", "console table"],
  },

  // ── Outdoor ──
  "patio": {
    material_preferences: ["outdoor fabric", "teak", "aluminum", "resin wicker", "stone"],
    material_exclusions: ["indoor fabric", "silk", "velvet", "untreated wood"],
    attributes: ["weather resistant", "UV resistant", "outdoor rated", "durable"],
    durability: "high",
    style_lean: "casual",
    requires_outdoor: true,
    default_categories: ["outdoor sofa", "outdoor dining", "side table", "outdoor lighting"],
  },
  "deck": {
    material_preferences: ["outdoor fabric", "teak", "aluminum", "resin wicker"],
    material_exclusions: ["indoor fabric", "silk", "velvet"],
    attributes: ["weather resistant", "outdoor rated", "casual"],
    durability: "high",
    style_lean: "casual",
    requires_outdoor: true,
    default_categories: ["outdoor sofa", "outdoor dining", "bar stool", "lighting"],
  },
  "pool": {
    material_preferences: ["quick dry", "outdoor fabric", "aluminum", "resin", "teak"],
    material_exclusions: ["fabric", "wood", "iron"],
    attributes: ["water resistant", "fade resistant", "quick dry", "outdoor rated"],
    durability: "high",
    style_lean: "casual",
    requires_outdoor: true,
    default_categories: ["outdoor sofa", "side table", "outdoor dining"],
  },
  "porch": {
    material_preferences: ["outdoor fabric", "wicker", "teak", "painted wood"],
    material_exclusions: ["indoor fabric"],
    attributes: ["weather resistant", "relaxed", "inviting"],
    durability: "high",
    style_lean: "casual",
    requires_outdoor: true,
    default_categories: ["outdoor sofa", "accent chair", "side table", "rug"],
  },
  "outdoor": {
    material_preferences: ["outdoor fabric", "teak", "aluminum", "resin wicker", "stone", "concrete"],
    material_exclusions: ["indoor fabric", "silk", "velvet", "untreated wood"],
    attributes: ["weather resistant", "UV resistant", "outdoor rated"],
    durability: "high",
    style_lean: "balanced",
    requires_outdoor: true,
    default_categories: ["outdoor sofa", "outdoor dining", "side table", "lighting"],
  },
  "garden": {
    material_preferences: ["teak", "stone", "concrete", "wrought iron", "aluminum"],
    material_exclusions: ["fabric", "untreated wood"],
    attributes: ["weather resistant", "natural", "organic"],
    durability: "high",
    style_lean: "casual",
    requires_outdoor: true,
    default_categories: ["bench", "dining table", "side table"],
  },

  // ── Commercial ──
  "hotel lobby": {
    material_preferences: ["commercial grade", "performance fabric", "leather", "metal", "stone"],
    material_exclusions: ["residential only", "delicate", "silk", "dry clean only"],
    attributes: ["hospitality grade", "high traffic", "impressive scale", "durable", "statement"],
    durability: "high",
    style_lean: "formal",
    requires_commercial: true,
    default_categories: ["sofa", "accent chair", "coffee table", "console table", "lighting", "rug"],
  },
  "hotel room": {
    material_preferences: ["performance fabric", "leather", "durable", "commercial grade"],
    material_exclusions: ["delicate", "dry clean only"],
    attributes: ["commercial grade", "comfortable", "clean lines"],
    durability: "high",
    style_lean: "balanced",
    requires_commercial: true,
    default_categories: ["bed", "nightstand", "desk", "accent chair", "bench", "lighting"],
  },
  "boutique hotel": {
    material_preferences: ["performance fabric", "velvet", "leather", "brass", "marble"],
    material_exclusions: ["cheap", "plastic"],
    attributes: ["design forward", "unique", "statement", "hospitality grade", "instagram worthy"],
    durability: "high",
    style_lean: "refined",
    requires_commercial: true,
    default_categories: ["accent chair", "sofa", "coffee table", "lighting", "rug", "mirror"],
  },
  "restaurant": {
    material_preferences: ["commercial grade", "performance fabric", "metal", "wood"],
    material_exclusions: ["delicate", "light colored fabric"],
    attributes: ["commercial grade", "compact", "stackable", "easy clean"],
    durability: "high",
    style_lean: "balanced",
    requires_commercial: true,
    default_categories: ["dining chair", "bar stool", "dining table", "bench", "lighting"],
  },
  "office": {
    material_preferences: ["commercial grade", "leather", "metal", "laminate"],
    material_exclusions: ["residential only"],
    attributes: ["commercial grade", "ergonomic", "professional"],
    durability: "high",
    style_lean: "balanced",
    requires_commercial: true,
    default_categories: ["desk", "office chair", "bookcase", "conference table", "lighting"],
  },
  "waiting room": {
    material_preferences: ["commercial grade", "performance fabric", "vinyl", "metal"],
    material_exclusions: ["residential only", "delicate"],
    attributes: ["commercial grade", "easy clean", "durable", "comfortable"],
    durability: "high",
    style_lean: "balanced",
    requires_commercial: true,
    default_categories: ["accent chair", "sofa", "side table", "lighting"],
  },
};

/**
 * STYLE DEPTH — Going beyond a single style label into sub-styles
 * with specific silhouettes, details, materials, and vendor strengths
 */
const STYLE_DEPTH = {
  traditional: {
    formal: {
      triggers: ["formal", "formal traditional", "high end traditional", "classic formal", "elegant traditional", "english", "european"],
      silhouettes: ["rolled arm", "camelback", "english roll arm", "chesterfield", "wingback", "cabriole leg"],
      details: ["nailhead trim", "turned legs", "tufting", "skirt", "carved frame", "rope detail", "ball and claw", "finial"],
      materials: ["velvet", "damask", "leather", "mahogany", "cherry", "walnut", "silk", "brass"],
      vendors_strong: ["baker", "hickory-chair", "ej-victor", "hancock-moore", "century", "marge-carson", "stickley"],
      vendors_avoid: [],
    },
    casual: {
      triggers: ["casual traditional", "relaxed traditional", "comfortable traditional", "family traditional"],
      silhouettes: ["slipcovered", "rolled arm", "bridgewater", "lawson", "english arm"],
      details: ["loose cushions", "relaxed tailoring", "washable slipcover", "soft edge"],
      materials: ["linen", "cotton", "performance fabric", "painted wood", "distressed finish"],
      vendors_strong: ["lee-industries", "cr-laine", "universal", "lexington", "vanguard"],
      vendors_avoid: [],
    },
    updated: {
      triggers: ["updated traditional", "modern traditional", "transitional traditional", "fresh traditional", "new traditional"],
      silhouettes: ["track arm with traditional proportions", "shelter arm", "tuxedo", "modified wingback"],
      details: ["clean welt", "modern legs on classic frame", "mixed materials", "simplified detail"],
      materials: ["performance fabric", "leather", "walnut", "brass", "mixed metal"],
      vendors_strong: ["bernhardt", "century", "vanguard", "hickory-chair", "theodore-alexander"],
      vendors_avoid: [],
    },
    southern: {
      triggers: ["southern", "southern traditional", "plantation", "charleston"],
      silhouettes: ["camelback", "rolled arm", "wingback", "skirted"],
      details: ["skirted base", "turned legs", "welt detail", "nailhead"],
      materials: ["linen", "cotton", "mahogany", "cypress", "brass"],
      vendors_strong: ["hickory-chair", "century", "cr-laine", "lee-industries", "sherrill"],
      vendors_avoid: [],
    },
  },

  modern: {
    minimal: {
      triggers: ["minimal", "minimalist", "minimal modern", "clean", "clean lines", "sleek", "streamlined", "simple"],
      silhouettes: ["track arm", "armless", "low profile", "platform", "flat arm", "thin profile"],
      details: ["metal legs", "thin arms", "no ornamentation", "clean lines", "geometric"],
      materials: ["leather", "boucle", "performance fabric", "metal", "glass", "concrete", "stone"],
      vendors_strong: ["fourhands", "noir", "arteriors", "bernhardt"],
      vendors_avoid: ["stickley", "marge-carson"],
    },
    warm: {
      triggers: ["warm modern", "soft modern", "organic modern", "california modern", "relaxed modern", "approachable modern"],
      silhouettes: ["curved", "organic shape", "barrel", "sculptural", "rounded", "soft edge"],
      details: ["wood base", "rounded edges", "natural materials mixed with modern form", "textural contrast"],
      materials: ["boucle", "velvet", "oak", "walnut", "travertine", "linen", "plaster", "ceramic"],
      vendors_strong: ["fourhands", "caracole", "bernhardt", "theodore-alexander", "palecek"],
      vendors_avoid: [],
    },
    glam: {
      triggers: ["modern glam", "glam", "glamorous", "hollywood regency", "luxe modern", "jewel tone"],
      silhouettes: ["channel back", "barrel", "curved", "sculptural", "tufted"],
      details: ["gold legs", "brass accents", "channel tufting", "mirrored surfaces", "lacquer"],
      materials: ["velvet", "brass", "gold metal", "marble", "mirrored glass", "lacquer", "acrylic"],
      vendors_strong: ["caracole", "jonathan-adler", "worlds-away", "bungalow5", "arteriors"],
      vendors_avoid: ["stickley"],
    },
    luxury: {
      triggers: ["modern luxury", "luxury modern", "high end modern", "like rh", "like restoration hardware"],
      silhouettes: ["deep seat", "oversized", "low profile", "shelter arm", "floating"],
      details: ["performance fabric", "oversized proportions", "deep cushions", "minimal detail"],
      materials: ["performance fabric", "leather", "oak", "concrete", "iron", "boucle"],
      vendors_strong: ["bernhardt", "fourhands", "vanguard", "rh-trade", "century"],
      vendors_avoid: [],
    },
    sculptural: {
      triggers: ["sculptural", "statement", "artistic", "conversation piece", "eye catching", "showstopper", "gallery"],
      silhouettes: ["asymmetric", "organic", "geometric", "architectural", "unusual", "unexpected"],
      details: ["unique form", "art-like", "bold silhouette", "one of a kind feel"],
      materials: ["mixed media", "resin", "bronze", "stone", "plaster", "boucle", "velvet"],
      vendors_strong: ["fourhands", "noir", "arteriors", "caracole", "theodore-alexander", "made-goods"],
      vendors_avoid: ["universal", "flexsteel"],
    },
  },

  transitional: {
    classic: {
      triggers: ["transitional", "updated classic", "timeless", "classic modern", "bridge"],
      silhouettes: ["shelter arm", "track arm", "modified wingback", "clean roll arm"],
      details: ["simple welt", "tapered legs", "subtle detail", "balanced proportions"],
      materials: ["performance fabric", "leather", "walnut", "brass", "mixed metal"],
      vendors_strong: ["bernhardt", "vanguard", "century", "universal", "hickory-chair"],
      vendors_avoid: [],
    },
    warm: {
      triggers: ["warm transitional", "like pottery barn but nicer", "elevated casual", "approachable"],
      silhouettes: ["soft lines", "gentle curves", "comfortable proportions"],
      details: ["textural fabrics", "mixed materials", "warm metals", "wood accents"],
      materials: ["performance fabric", "linen", "oak", "brass", "leather", "boucle"],
      vendors_strong: ["vanguard", "universal", "bernhardt", "lexington", "mcgee-and-co"],
      vendors_avoid: [],
    },
  },

  coastal: {
    classic: {
      triggers: ["coastal", "classic coastal", "beach", "nautical", "seaside", "cape cod", "hamptons", "nantucket"],
      silhouettes: ["slipcovered", "rolled arm", "relaxed", "ladder back"],
      details: ["washable fabric", "weathered finish", "natural fiber", "rope detail", "painted finish"],
      materials: ["performance fabric", "linen", "rattan", "white oak", "jute", "cotton", "slipcover"],
      vendors_strong: ["lexington", "universal", "lee-industries", "cr-laine", "palecek"],
      vendors_avoid: ["caracole", "marge-carson"],
    },
    modern: {
      triggers: ["modern coastal", "california coastal", "contemporary coastal", "coastal modern", "malibu"],
      silhouettes: ["clean lines", "low profile", "organic", "streamlined"],
      details: ["light finishes", "natural textures", "minimal ornamentation", "mixed materials"],
      materials: ["light oak", "travertine", "linen", "boucle", "rattan", "concrete", "teak"],
      vendors_strong: ["fourhands", "palecek", "bernhardt", "lexington", "made-goods"],
      vendors_avoid: [],
    },
    tropical: {
      triggers: ["tropical", "resort", "island", "caribbean", "palm beach", "florida"],
      silhouettes: ["relaxed", "rattan", "woven", "lounge"],
      details: ["rattan detail", "woven texture", "natural finish", "plantation style"],
      materials: ["rattan", "bamboo", "teak", "linen", "performance fabric", "wicker"],
      vendors_strong: ["palecek", "lexington", "gabby", "universal"],
      vendors_avoid: [],
    },
    mediterranean: {
      triggers: ["mediterranean", "tuscan", "spanish", "italian villa", "greek", "moroccan"],
      silhouettes: ["arched", "ornate but organic", "stone", "wrought iron"],
      details: ["iron detail", "stone top", "terracotta", "mosaic", "hand-painted"],
      materials: ["stone", "wrought iron", "terracotta", "travertine", "leather", "linen", "ceramic"],
      vendors_strong: ["theodore-alexander", "maitland-smith", "century", "hooker"],
      vendors_avoid: [],
    },
  },

  "mid-century-modern": {
    classic: {
      triggers: ["mid century", "mid-century", "mcm", "midcentury", "1950s", "1960s", "eames era", "atomic age"],
      silhouettes: ["tapered legs", "organic curves", "low profile", "clean lines", "splayed legs"],
      details: ["exposed wood frame", "tapered legs", "button tufting", "hairpin legs", "starburst"],
      materials: ["walnut", "teak", "leather", "wool", "brass", "rosewood"],
      vendors_strong: ["fourhands", "noir", "hooker", "bernhardt"],
      vendors_avoid: ["marge-carson", "ej-victor"],
    },
    modern_interpretation: {
      triggers: ["modern mcm", "updated mid century", "new mid century", "inspired by mcm"],
      silhouettes: ["organic", "sculptural", "tapered leg", "curved", "thin profile"],
      details: ["mixed materials", "updated proportions", "modern finishes"],
      materials: ["walnut", "brass", "boucle", "velvet", "oak", "leather"],
      vendors_strong: ["fourhands", "caracole", "bernhardt", "theodore-alexander"],
      vendors_avoid: [],
    },
  },

  farmhouse: {
    classic: {
      triggers: ["farmhouse", "country", "cottage", "rustic farmhouse", "rural"],
      silhouettes: ["ladder back", "slipcovered", "bench", "trestle"],
      details: ["distressed finish", "turned legs", "cross back", "shiplap", "planked"],
      materials: ["reclaimed wood", "painted wood", "cotton", "linen", "wrought iron", "galvanized metal"],
      vendors_strong: ["hooker", "universal", "stickley", "kincaid"],
      vendors_avoid: ["caracole", "jonathan-adler"],
    },
    modern: {
      triggers: ["modern farmhouse", "updated farmhouse", "contemporary farmhouse", "joanna gaines"],
      silhouettes: ["clean lines", "mixed materials", "simple"],
      details: ["black metal", "natural wood", "mixed materials", "simple hardware"],
      materials: ["oak", "metal", "performance fabric", "concrete", "natural fiber"],
      vendors_strong: ["hooker", "universal", "fourhands", "mcgee-and-co"],
      vendors_avoid: [],
    },
  },

  industrial: {
    classic: {
      triggers: ["industrial", "urban", "loft", "factory", "warehouse", "raw"],
      silhouettes: ["angular", "utilitarian", "metal frame", "exposed structure"],
      details: ["exposed rivets", "raw edge", "metal mesh", "pipe frame", "caster wheels"],
      materials: ["iron", "steel", "reclaimed wood", "leather", "concrete", "raw metal"],
      vendors_strong: ["fourhands", "noir", "hooker", "arteriors"],
      vendors_avoid: ["hickory-chair", "baker", "marge-carson"],
    },
  },

  "art-deco": {
    classic: {
      triggers: ["art deco", "deco", "1920s", "1930s", "gatsby"],
      silhouettes: ["geometric", "stepped", "fan shape", "sunburst", "streamline"],
      details: ["geometric pattern", "lacquer", "inlay", "mirror accent", "gold detail"],
      materials: ["velvet", "brass", "marble", "lacquer", "mirror", "shagreen", "gold leaf"],
      vendors_strong: ["caracole", "jonathan-adler", "worlds-away", "bungalow5", "theodore-alexander"],
      vendors_avoid: [],
    },
  },

  bohemian: {
    classic: {
      triggers: ["bohemian", "boho", "eclectic", "global", "collected", "world traveler"],
      silhouettes: ["low slung", "floor cushion", "rattan", "mixed styles", "layered"],
      details: ["mixed patterns", "global textile", "macrame", "fringe", "mixed materials"],
      materials: ["rattan", "jute", "kilim", "cotton", "wood", "brass", "ceramic"],
      vendors_strong: ["palecek", "jaipur-living", "loloi", "surya", "gabby"],
      vendors_avoid: [],
    },
  },

  scandinavian: {
    classic: {
      triggers: ["scandinavian", "scandi", "nordic", "danish", "swedish", "hygge", "finnish"],
      silhouettes: ["clean lines", "organic curves", "lightweight", "minimal"],
      details: ["dowel legs", "spindle", "minimal detail", "functional", "light finish"],
      materials: ["light oak", "birch", "wool", "linen", "leather", "ash"],
      vendors_strong: ["fourhands", "bernhardt", "universal"],
      vendors_avoid: ["marge-carson", "ej-victor"],
    },
  },

  rustic: {
    classic: {
      triggers: ["rustic", "cabin", "mountain", "lodge", "western", "ranch"],
      silhouettes: ["heavy", "substantial", "raw edge", "live edge"],
      details: ["live edge", "distressed", "raw texture", "hand hewn", "rough sawn"],
      materials: ["reclaimed wood", "leather", "iron", "stone", "antler", "cowhide"],
      vendors_strong: ["hooker", "stickley", "fourhands", "noir"],
      vendors_avoid: ["caracole", "jonathan-adler"],
    },
  },

  japandi: {
    classic: {
      triggers: ["japandi", "japanese modern", "wabi sabi", "zen", "japanese minimalist"],
      silhouettes: ["low profile", "platform", "simple", "grounded", "horizontal"],
      details: ["joinery detail", "minimal hardware", "raw texture", "asymmetric balance"],
      materials: ["light oak", "walnut", "linen", "ceramic", "stone", "paper", "bamboo"],
      vendors_strong: ["fourhands", "noir", "palecek"],
      vendors_avoid: ["caracole", "marge-carson"],
    },
  },
};

/**
 * USE-CASE DESCRIPTORS — What adjectives imply about construction + materials
 */
const USE_CASE_SIGNALS = {
  comfortable: {
    attributes: ["deep seat", "soft cushion", "plush", "down fill", "high back option", "lumbar support"],
    material_preferences: ["down fill", "performance fabric", "velvet", "boucle"],
    construction: ["loose cushion", "spring down", "8 way hand tied"],
  },
  durable: {
    attributes: ["high traffic", "stain resistant", "fade resistant", "commercial grade"],
    material_preferences: ["performance fabric", "leather", "hardwood frame", "kiln dried"],
    construction: ["sinuous spring", "hardwood frame", "corner blocked"],
  },
  "kid friendly": {
    attributes: ["stain resistant", "washable", "rounded corners", "stable", "no sharp edges"],
    material_preferences: ["performance fabric", "slipcover", "leather"],
    material_exclusions: ["silk", "velvet", "natural linen", "glass top", "marble"],
  },
  "pet friendly": {
    attributes: ["scratch resistant", "easy clean", "durable", "hair resistant"],
    material_preferences: ["performance fabric", "leather", "crypton", "microfiber"],
    material_exclusions: ["velvet", "silk", "boucle", "chenille", "loose weave"],
  },
  "quick ship": {
    attributes: ["in stock", "fast delivery", "ready to ship"],
    lead_time_max_weeks: 6,
  },
  oversized: {
    attributes: ["grand scale", "deep seat", "extra wide", "generous proportions"],
    size_signal: "large",
  },
  compact: {
    attributes: ["apartment size", "small scale", "space saving", "narrow", "petite"],
    size_signal: "small",
  },
  "statement": {
    attributes: ["unique", "sculptural", "eye catching", "conversation piece", "showstopper"],
    style_lean: "bold",
  },
  "investment": {
    attributes: ["heirloom quality", "timeless", "forever piece", "highest construction"],
    tier_signal: "luxury",
  },
  practical: {
    attributes: ["functional", "easy care", "durable", "sensible"],
    material_preferences: ["performance fabric", "leather"],
    tier_signal: "upper_mid",
  },
  elegant: {
    attributes: ["refined", "sophisticated", "graceful", "polished"],
    style_lean: "formal",
  },
  cozy: {
    attributes: ["soft", "plush", "warm", "inviting", "enveloping"],
    material_preferences: ["velvet", "boucle", "chenille", "down fill", "shearling"],
  },
  modern: {
    attributes: ["contemporary", "clean lines", "current"],
    style_lean: "modern",
  },
  rustic: {
    attributes: ["raw", "natural", "unfinished", "organic", "hand crafted"],
    material_preferences: ["reclaimed wood", "iron", "leather", "stone"],
    style_lean: "rustic",
  },
};

/**
 * COMPARISON PHRASES — "like X but Y" patterns
 */
const COMPARISON_MAP = {
  "like rh": {
    means: "oversized, deep seated, modern luxury, neutral palette, performance fabric",
    tier: "premium",
    style_key: "modern.luxury",
    attributes: ["oversized", "deep seat", "low profile", "performance fabric"],
  },
  "like restoration hardware": {
    means: "oversized, deep seated, modern luxury, neutral palette, performance fabric",
    tier: "premium",
    style_key: "modern.luxury",
    attributes: ["oversized", "deep seat", "low profile", "performance fabric"],
  },
  "like pottery barn": {
    means: "transitional, warm, approachable, upper-mid quality",
    tier: "upper_mid",
    style_key: "transitional.warm",
    attributes: ["comfortable", "warm", "approachable"],
  },
  "like pottery barn but nicer": {
    means: "transitional warm but higher quality and more refined",
    tier: "premium",
    style_key: "transitional.warm",
    attributes: ["comfortable", "refined", "elevated"],
  },
  "like pottery barn but better": {
    means: "transitional warm but higher quality and more refined",
    tier: "premium",
    style_key: "transitional.warm",
    attributes: ["comfortable", "refined", "elevated"],
  },
  "like cb2": {
    means: "modern, clean lines, trending, accessible modern",
    tier: "upper_mid",
    style_key: "modern.minimal",
    attributes: ["clean lines", "modern", "trending"],
  },
  "like cb2 but trade": {
    means: "modern, clean lines but from premium trade vendors",
    tier: "premium",
    style_key: "modern.minimal",
    attributes: ["clean lines", "modern", "trade quality"],
  },
  "like west elm": {
    means: "mid-century influenced, accessible modern, mixed materials",
    tier: "upper_mid",
    style_key: "mid-century-modern.modern_interpretation",
    attributes: ["mid century", "accessible", "mixed materials"],
  },
  "like west elm but better": {
    means: "mid-century modern but from trade-quality vendors",
    tier: "premium",
    style_key: "mid-century-modern.classic",
    attributes: ["mid century", "quality construction", "trade grade"],
  },
  "like arhaus": {
    means: "rustic modern, natural materials, organic, artisan",
    tier: "premium",
    style_key: "modern.warm",
    attributes: ["organic", "natural", "artisan", "warm"],
  },
  "like crate and barrel": {
    means: "clean transitional, simple, well-priced",
    tier: "upper_mid",
    style_key: "transitional.classic",
    attributes: ["simple", "clean", "functional"],
  },
  "hotel quality": {
    means: "commercial grade durability, performance materials, impressive but not delicate",
    tier: "commercial",
    attributes: ["commercial grade", "durable", "impressive", "performance"],
  },
  "forever piece": {
    means: "investment quality, timeless style, highest durability, luxury materials",
    tier: "luxury",
    attributes: ["heirloom", "timeless", "investment", "highest quality"],
  },
  "conversation piece": {
    means: "unique, sculptural, eye-catching, design-forward",
    style_key: "modern.sculptural",
    attributes: ["unique", "sculptural", "eye catching", "statement"],
  },
  "showstopper": {
    means: "dramatic, impressive, unique",
    style_key: "modern.sculptural",
    attributes: ["dramatic", "unique", "statement", "impressive"],
  },
  "like mcgee": {
    means: "warm transitional, curated, elevated farmhouse",
    tier: "premium",
    style_key: "transitional.warm",
    attributes: ["warm", "curated", "natural materials"],
  },
  "like studio mcgee": {
    means: "warm transitional, curated, elevated farmhouse",
    tier: "premium",
    style_key: "transitional.warm",
    attributes: ["warm", "curated", "natural materials"],
  },
  "joanna gaines": {
    means: "modern farmhouse, warm, accessible",
    tier: "upper_mid",
    style_key: "farmhouse.modern",
    attributes: ["farmhouse", "warm", "accessible"],
  },
  "like four seasons": {
    means: "luxury hospitality, impressive, refined, premium commercial",
    tier: "luxury",
    style_key: "transitional.classic",
    attributes: ["luxury", "hospitality", "impressive", "refined"],
    requires_commercial: true,
  },
  "like soho house": {
    means: "eclectic luxury, vintage-inspired, collected feel, moody",
    tier: "premium",
    style_key: "bohemian.classic",
    attributes: ["eclectic", "collected", "moody", "layered"],
  },
  "like ace hotel": {
    means: "industrial modern, eclectic, design-forward, youthful",
    tier: "premium",
    style_key: "industrial.classic",
    attributes: ["industrial", "eclectic", "design forward"],
    requires_commercial: true,
  },
};

/**
 * EXCLUSION SIGNALS — What to filter OUT based on query signals
 */
const EXCLUSION_RULES = [
  { trigger: "no glass", exclude_materials: ["glass", "glass top", "tempered glass"] },
  { trigger: "no marble", exclude_materials: ["marble", "marble top", "faux marble"] },
  { trigger: "no velvet", exclude_materials: ["velvet", "velour"] },
  { trigger: "no leather", exclude_materials: ["leather", "faux leather", "bonded leather"] },
  { trigger: "not formal", exclude_styles: ["formal", "ornate"], exclude_details: ["carved", "gilt"] },
  { trigger: "not ornate", exclude_details: ["carved", "ornate", "heavy detail", "gilt", "rococo"] },
  { trigger: "not traditional", exclude_styles: ["traditional", "classic", "formal"], exclude_details: ["turned legs", "nailhead", "skirt"] },
  { trigger: "not modern", exclude_styles: ["modern", "contemporary", "minimal"], exclude_details: ["metal legs", "chrome"] },
  { trigger: "no wood", exclude_materials: ["wood", "oak", "walnut", "mahogany", "teak", "pine"] },
  { trigger: "no metal", exclude_materials: ["metal", "iron", "steel", "chrome", "brass"] },
  { trigger: "simple", exclude_details: ["ornate", "carved", "heavy detail", "gilt", "tufted"] },
  { trigger: "clean", exclude_details: ["ornate", "carved", "heavy detail", "tufted", "nailhead"] },
  { trigger: "family room", exclude_materials: ["silk", "natural linen", "dry clean only"] },
  { trigger: "kids", exclude_materials: ["silk", "glass top", "marble", "sharp edges"] },
  { trigger: "pet", exclude_materials: ["velvet", "silk", "boucle", "chenille", "loose weave"] },
];

/**
 * PRODUCT TYPE INTELLIGENCE — Deeper understanding of furniture categories
 */
const PRODUCT_TYPE_DEPTH = {
  "sectional": {
    aliases: ["sectional sofa", "sectional", "l-shaped", "u-shaped", "modular"],
    typical_sizes: { small: "80-100 inches", medium: "100-130 inches", large: "130-160 inches", oversized: "160+ inches" },
    key_decisions: ["configuration (L/U/modular)", "arm style", "seat depth", "fabric", "chaise side"],
    seating_capacity: { small: "4-5", medium: "5-7", large: "7-9" },
    search_expand: ["sectional sofa", "modular sofa", "l-shaped sofa", "sofa with chaise", "chaise sectional"],
  },
  "sofa": {
    aliases: ["sofa", "couch", "settee", "loveseat"],
    typical_sizes: { small: "60-72 inches", medium: "72-88 inches", large: "88-96 inches", oversized: "96+ inches" },
    key_decisions: ["arm style", "cushion config", "back style", "leg finish", "fabric"],
    search_expand: ["sofa", "couch", "loveseat", "settee"],
  },
  "accent chair": {
    aliases: ["accent chair", "lounge chair", "occasional chair", "side chair", "club chair"],
    key_decisions: ["arm vs armless", "swivel vs stationary", "scale", "fabric"],
    search_expand: ["accent chair", "lounge chair", "occasional chair", "club chair", "arm chair"],
  },
  "dining table": {
    aliases: ["dining table", "extension table", "pedestal table", "trestle table"],
    typical_sizes: { "seats 4": "48-54 inches", "seats 6": "60-72 inches", "seats 8": "84-96 inches", "seats 10": "108-120 inches", "seats 12": "120-144 inches" },
    key_decisions: ["shape (round/rect/oval)", "base style", "extension capability", "material", "finish"],
    search_expand: ["dining table", "extension table", "pedestal table", "trestle table", "farm table"],
  },
  "coffee table": {
    aliases: ["coffee table", "cocktail table", "center table"],
    key_decisions: ["shape", "material", "height", "storage"],
    search_expand: ["coffee table", "cocktail table", "center table"],
  },
  "side table": {
    aliases: ["side table", "end table", "accent table", "accent tables", "drink table", "occasional table", "lamp table"],
    key_decisions: ["shape", "material", "height", "storage"],
    search_expand: ["side table", "end table", "accent table", "occasional table", "drink table"],
  },
  "credenza": {
    aliases: ["credenza", "sideboard", "buffet", "media console", "server"],
    key_decisions: ["width", "storage config", "finish", "hardware"],
    search_expand: ["credenza", "sideboard", "buffet", "media console"],
  },
  "bed": {
    aliases: ["bed", "bed frame", "upholstered bed", "panel bed", "poster bed", "platform bed", "canopy bed"],
    key_decisions: ["size (queen/king/cal king)", "headboard style", "footboard", "upholstered vs wood"],
    search_expand: ["bed", "bed frame", "upholstered bed", "panel bed", "platform bed"],
  },
  "nightstand": {
    aliases: ["nightstand", "bedside table", "night table"],
    key_decisions: ["size", "drawer count", "open shelf", "finish"],
    search_expand: ["nightstand", "bedside table", "night table"],
  },
  "desk": {
    aliases: ["desk", "writing desk", "executive desk", "home office desk"],
    key_decisions: ["size", "drawer config", "material", "cable management"],
    search_expand: ["desk", "writing desk", "executive desk", "home office desk"],
  },
  "bar stool": {
    aliases: ["bar stool", "counter stool", "stool"],
    key_decisions: ["height (bar 30\" vs counter 26\")", "back vs backless", "swivel", "arms"],
    search_expand: ["bar stool", "counter stool", "stool"],
  },
  "bookcase": {
    aliases: ["bookcase", "etagere", "shelving", "display shelf", "bookshelf"],
    key_decisions: ["height", "width", "open vs closed", "material"],
    search_expand: ["bookcase", "etagere", "shelving", "bookshelf"],
  },
  "ottoman": {
    aliases: ["ottoman", "pouf", "footstool", "cocktail ottoman"],
    key_decisions: ["shape", "storage", "tufted vs smooth", "size"],
    search_expand: ["ottoman", "pouf", "footstool", "cocktail ottoman"],
  },
  "console table": {
    aliases: ["console table", "console", "entry table", "sofa table", "hall table"],
    key_decisions: ["width", "depth", "storage", "material"],
    search_expand: ["console table", "console", "entry table", "sofa table"],
  },
  "mirror": {
    aliases: ["mirror", "wall mirror", "floor mirror", "vanity mirror"],
    key_decisions: ["shape", "size", "frame material", "mounting"],
    search_expand: ["mirror", "wall mirror", "floor mirror"],
  },
  "rug": {
    aliases: ["rug", "area rug", "runner", "carpet"],
    key_decisions: ["size", "material", "pattern", "pile height"],
    search_expand: ["rug", "area rug", "runner"],
  },
  "lighting": {
    aliases: ["lamp", "chandelier", "pendant", "sconce", "floor lamp", "table lamp"],
    key_decisions: ["type", "size/scale", "finish", "shade"],
    search_expand: ["lamp", "chandelier", "pendant", "sconce", "lighting", "floor lamp", "table lamp"],
  },
  "bench": {
    aliases: ["bench", "entry bench", "bedroom bench", "dining bench", "banquette"],
    key_decisions: ["size", "upholstered vs wood", "storage", "back vs backless"],
    search_expand: ["bench", "entry bench", "bedroom bench", "banquette"],
  },
};

/**
 * SIZE SIGNALS — Parse size requirements from queries
 */
const SIZE_PATTERNS = [
  { pattern: /seats?\s*(\d+)/i, type: "seating_capacity" },
  { pattern: /(\d+)\s*(?:inch|in|")\s*(?:wide|w)/i, type: "width" },
  { pattern: /(\d+)\s*(?:inch|in|")\s*(?:long|l|length)/i, type: "length" },
  { pattern: /(\d+)\s*(?:inch|in|")\s*(?:deep|d|depth)/i, type: "depth" },
  { pattern: /(\d+)\s*(?:inch|in|")\s*(?:tall|h|height|high)/i, type: "height" },
  { pattern: /(?:under|less than|max)\s*(\d+)\s*(?:inch|in|")/i, type: "max_dimension" },
  { pattern: /(\d+)\s*(?:foot|feet|ft|')\s*(?:wide|long|table)?/i, type: "feet_dimension" },
];


// ─────────────────────────────────────────────────────────────────────────────
// ANALYSIS ENGINE — Step 1: Think Before Searching
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyze a search query and build a mental model of what the designer wants.
 * This is the core thinking step — it reasons about the query, not just
 * extracts keywords.
 *
 * @param {string} query - The raw search query
 * @returns {object} - Complete analysis of designer intent
 */
export function analyzeQuery(query) {
  const raw = String(query || "").trim();
  const lower = raw.toLowerCase();

  const analysis = {
    raw_query: raw,
    // WHO is this for?
    audience: detectAudience(lower),
    room_context: detectRoomContext(lower),
    // WHAT are they looking for?
    product_types: detectProductTypes(lower),
    implied_needs: [],
    // WHAT quality level?
    tier: detectTier(lower),
    // WHAT style specifically?
    style: detectStyleDepth(lower),
    // WHAT should we exclude?
    exclusions: detectExclusions(lower),
    // Comparison reference?
    comparison: detectComparison(lower),
    // Use case signals
    use_cases: detectUseCases(lower),
    // Specific vendor request?
    vendor_lock: detectVendorLock(lower),
    // Size/dimension needs
    size: detectSize(raw),
    // Material preferences from query
    material_preferences: detectMaterials(lower),
    // Color preferences
    color_preferences: detectColors(lower),
    // Price constraints
    price: detectPrice(raw),
    // Lead time
    lead_time: detectLeadTime(lower),
  };

  // Cross-reference: room context adds to implied needs
  if (analysis.room_context) {
    const room = ROOM_CONTEXTS[analysis.room_context];
    if (room) {
      analysis.implied_needs.push(...(room.attributes || []));
      if (room.material_preferences) {
        for (const m of room.material_preferences) {
          if (!analysis.material_preferences.includes(m)) {
            analysis.material_preferences.push(m);
          }
        }
      }
      if (room.material_exclusions) {
        // Don't exclude materials the user explicitly asked for
        const explicitMaterials = analysis.material_preferences.map(m => m.toLowerCase());
        const safeExclusions = room.material_exclusions.filter(
          excl => !explicitMaterials.some(em => em.includes(excl.toLowerCase()) || excl.toLowerCase().includes(em))
        );
        analysis.exclusions.materials.push(...safeExclusions);
      }
      if (room.requires_outdoor) analysis.requires_outdoor = true;
      if (room.requires_commercial) analysis.requires_commercial = true;
    }
  }

  // Cross-reference: use cases add to implied needs
  for (const uc of analysis.use_cases) {
    const info = USE_CASE_SIGNALS[uc];
    if (info) {
      analysis.implied_needs.push(...(info.attributes || []));
      if (info.material_preferences) {
        for (const m of info.material_preferences) {
          if (!analysis.material_preferences.includes(m)) {
            analysis.material_preferences.push(m);
          }
        }
      }
      if (info.material_exclusions) {
        // Don't exclude materials the user explicitly asked for
        const explicitMaterials = analysis.material_preferences.map(m => m.toLowerCase());
        const safeExclusions = info.material_exclusions.filter(
          excl => !explicitMaterials.some(em => em.includes(excl.toLowerCase()) || excl.toLowerCase().includes(em))
        );
        analysis.exclusions.materials.push(...safeExclusions);
      }
      if (info.tier_signal && !analysis.tier.explicit) {
        analysis.tier = { ...analysis.tier, inferred: info.tier_signal };
      }
    }
  }

  // Cross-reference: comparison overrides
  if (analysis.comparison) {
    if (analysis.comparison.tier && !analysis.tier.explicit) {
      // Map tier name to full tier info
      const tierInfo = TIER_SIGNALS[analysis.comparison.tier];
      if (tierInfo) {
        analysis.tier = {
          name: analysis.comparison.tier,
          explicit: false,
          vendor_tiers: tierInfo.vendor_tiers,
          quality_minimum: tierInfo.quality_minimum,
          price_floor: tierInfo.price_floor || 0,
        };
      }
    }
    if (analysis.comparison.style_key && !analysis.style.explicit) {
      // Resolve the style_key to full style info
      const [family, sub] = analysis.comparison.style_key.split(".");
      const styleFamily = STYLE_DEPTH[family];
      if (styleFamily && sub && styleFamily[sub]) {
        analysis.style = {
          family,
          sub,
          explicit: false,
          ...styleFamily[sub],
          style_key: analysis.comparison.style_key,
          from_comparison: true,
        };
      } else {
        analysis.style = { ...analysis.style, from_comparison: analysis.comparison.style_key };
      }
    }
    if (analysis.comparison.requires_commercial) {
      analysis.requires_commercial = true;
    }
    if (analysis.comparison.attributes) {
      analysis.implied_needs.push(...analysis.comparison.attributes);
    }
  }

  // Deduplicate
  analysis.implied_needs = [...new Set(analysis.implied_needs)];
  analysis.exclusions.materials = [...new Set(analysis.exclusions.materials)];

  // Final safety: never exclude materials the user explicitly mentioned in the query
  const explicitMats = analysis.material_preferences.map(m => m.toLowerCase());
  analysis.exclusions.materials = analysis.exclusions.materials.filter(
    excl => !explicitMats.some(em => em.includes(excl.toLowerCase()) || excl.toLowerCase().includes(em))
  );

  return analysis;
}


// ── Detection Functions ─────────────────────────────────────────────────────

function detectAudience(lower) {
  if (/\b(family|families|kids?|children|toddler|baby)\b/.test(lower)) {
    return { type: "family", durability: "high", kid_friendly: true };
  }
  if (/\b(pet|dog|cat|pets)\b/.test(lower)) {
    return { type: "pet_owner", durability: "high", pet_friendly: true };
  }
  if (/\b(hotel|hospitality|lobby|restaurant|commercial|contract|office|corporate|healthcare)\b/.test(lower)) {
    return { type: "commercial", durability: "high", commercial_grade: true };
  }
  if (/\b(client|designer|trade|specifier|interior designer)\b/.test(lower)) {
    return { type: "trade_designer", tier_default: "premium" };
  }
  if (/\b(staging|model home|flip)\b/.test(lower)) {
    return { type: "staging", tier_default: "upper_mid", durability: "low" };
  }
  // Default: trade designer, mid-to-premium
  return { type: "trade_designer", tier_default: "premium" };
}

function detectRoomContext(lower) {
  // Check longest matches first (e.g., "formal living room" before "living room")
  const roomKeys = Object.keys(ROOM_CONTEXTS).sort((a, b) => b.length - a.length);
  for (const room of roomKeys) {
    // Use word boundary matching to avoid false positives ("credenza" matching "den")
    const escaped = room.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(lower)) return room;
  }
  // Partial matches
  if (/\blobby\b/.test(lower)) return "hotel lobby";
  if (/\bpatio\b/.test(lower)) return "patio";
  if (/\bdeck\b/.test(lower)) return "deck";
  if (/\bpool\b/.test(lower)) return "pool";
  return null;
}

function detectProductTypes(lower) {
  const found = [];
  // Check product type depth first (longer matches)
  const typeKeys = Object.keys(PRODUCT_TYPE_DEPTH).sort((a, b) => b.length - a.length);
  for (const type of typeKeys) {
    const info = PRODUCT_TYPE_DEPTH[type];
    for (const alias of info.aliases) {
      // Use word boundary to avoid "bed" matching inside "bedroom"
      const escaped = alias.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(lower)) {
        if (!found.includes(type)) found.push(type);
        break;
      }
    }
  }

  // Room-based category expansion: "bedroom" means all bedroom furniture
  if (found.length === 0) {
    if (/\bbedroom\b/.test(lower)) found.push("bed", "nightstand", "dresser", "bench", "lighting", "mirror", "rug");
    if (/\bdining\b/.test(lower) && !found.some(f => f.includes("dining"))) found.push("dining table", "dining chair");
    if (/\bliving\s*room\b/.test(lower)) found.push("sofa", "accent chair", "coffee table", "side table");
    if (/\boffice\b/.test(lower) || /\bworkspace\b/.test(lower)) found.push("desk", "bookcase");
    if (/\bseat(?:ing)?\b/.test(lower)) found.push("accent chair", "sofa");
    if (/\bstorage\b/.test(lower)) found.push("credenza", "bookcase");
    if (/\btable(?:s)?\b/.test(lower) && !found.some(f => f.includes("table"))) found.push("coffee table", "side table");
  }
  return found;
}

function detectTier(lower) {
  // Check from highest to lowest
  for (const [tierName, tier] of Object.entries(TIER_SIGNALS)) {
    for (const trigger of tier.triggers) {
      if (lower.includes(trigger.toLowerCase())) {
        return {
          name: tierName,
          explicit: true,
          vendor_tiers: tier.vendor_tiers,
          quality_minimum: tier.quality_minimum,
          price_floor: tier.price_floor || 0,
          requires_commercial: tier.requires_commercial || false,
        };
      }
    }
  }
  // Default for trade designers: premium
  return {
    name: "premium",
    explicit: false,
    vendor_tiers: [1, 2],
    quality_minimum: 50,
    price_floor: 0,
  };
}

function detectStyleDepth(lower) {
  let bestMatch = null;
  let bestMatchLen = 0;

  // Try to match specific sub-styles first
  for (const [family, subStyles] of Object.entries(STYLE_DEPTH)) {
    for (const [subName, subStyle] of Object.entries(subStyles)) {
      for (const trigger of subStyle.triggers) {
        const tLower = trigger.toLowerCase();
        if (lower.includes(tLower) && tLower.length > bestMatchLen) {
          bestMatch = {
            family,
            sub: subName,
            explicit: true,
            ...subStyle,
            style_key: `${family}.${subName}`,
          };
          bestMatchLen = tLower.length;
        }
      }
    }
  }

  if (bestMatch) return bestMatch;

  // Try matching just the family
  for (const family of Object.keys(STYLE_DEPTH)) {
    const familyNorm = family.replace(/-/g, " ").replace(/ /g, "[ -]?");
    const regex = new RegExp(`\\b${familyNorm}\\b`, "i");
    if (regex.test(lower)) {
      // Default to the first (most common) sub-style
      const firstSub = Object.keys(STYLE_DEPTH[family])[0];
      const subStyle = STYLE_DEPTH[family][firstSub];
      return {
        family,
        sub: firstSub,
        explicit: true,
        ...subStyle,
        style_key: `${family}.${firstSub}`,
      };
    }
  }

  return { family: null, sub: null, explicit: false };
}

function detectComparison(lower) {
  // Normalize articles out for matching: "like the CB2" → "like cb2"
  const stripped = lower.replace(/\blike\s+(?:the|a|an)\s+/g, "like ");

  // Sort by length descending for longest match
  const phrases = Object.keys(COMPARISON_MAP).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    const phraseNorm = phrase.toLowerCase();
    if (lower.includes(phraseNorm) || stripped.includes(phraseNorm)) {
      return { phrase, ...COMPARISON_MAP[phrase] };
    }
  }

  // Check for "like X" pattern generically
  const likeMatch = lower.match(/like\s+(?:the\s+|a\s+|an\s+)?(\w[\w\s]{1,30}?)(?:\s+but|\s*$)/);
  if (likeMatch) {
    return { phrase: likeMatch[0].trim(), means: likeMatch[1].trim(), generic: true };
  }

  return null;
}

function detectExclusions(lower) {
  const materials = [];
  const styles = [];
  const details = [];

  for (const rule of EXCLUSION_RULES) {
    if (lower.includes(rule.trigger.toLowerCase())) {
      if (rule.exclude_materials) materials.push(...rule.exclude_materials);
      if (rule.exclude_styles) styles.push(...rule.exclude_styles);
      if (rule.exclude_details) details.push(...rule.exclude_details);
    }
  }

  // Explicit "not X" / "no X" patterns
  const notPatterns = lower.matchAll(/\b(?:not?|without|exclude|skip)\s+([\w\s]{2,20}?)(?:\s+and|\s*,|\s*$)/gi);
  for (const match of notPatterns) {
    const term = match[1].trim();
    // Could be material, style, or detail — add to all for safety
    materials.push(term);
    styles.push(term);
  }

  return {
    materials: [...new Set(materials)],
    styles: [...new Set(styles)],
    details: [...new Set(details)],
  };
}

function detectUseCases(lower) {
  const found = [];
  for (const [name, info] of Object.entries(USE_CASE_SIGNALS)) {
    const nameNorm = name.toLowerCase();
    if (lower.includes(nameNorm)) {
      found.push(name);
    }
  }

  // Infer from signals
  if (/\b(kid|child|children|toddler|family)\b/.test(lower) && !found.includes("kid friendly")) found.push("kid friendly");
  if (/\b(pet|dog|cat)\b/.test(lower) && !found.includes("pet friendly")) found.push("pet friendly");
  if (/\b(quick ship|in stock|ready to ship|need fast|need quick|rush|asap)\b/.test(lower) && !found.includes("quick ship")) found.push("quick ship");
  if (/\b(large|oversized|grand|extra large|big|huge)\b/.test(lower) && !found.includes("oversized")) found.push("oversized");
  if (/\b(small|compact|apartment|petite|narrow|condo|tiny)\b/.test(lower) && !found.includes("compact")) found.push("compact");
  if (/\b(statement|sculptural|eye.?catching|showstopper|conversation|unique|bold)\b/.test(lower) && !found.includes("statement")) found.push("statement");
  if (/\b(cozy|comfy|snuggl|plush|soft)\b/.test(lower) && !found.includes("cozy")) found.push("cozy");
  if (/\b(elegant|sophisticated|refined|graceful|polished)\b/.test(lower) && !found.includes("elegant")) found.push("elegant");

  return found;
}

function detectVendorLock(lower) {
  // Sort by name length descending so "Four Hands" matches before "Hands"
  const sorted = [...tradeVendors].sort((a, b) => b.name.length - a.name.length);

  // Phrases that contain vendor names as substrings (false positives)
  const falsePositivePatterns = [
    /\bmid[\s-]?century\b/i,     // "mid century" is not "Century Furniture"
    /\bhigh[\s-]?fashion\b/i,    // "high fashion" could be a style signal
    /\blee\s+(?!industries)/i,   // "lee" alone is too ambiguous unless "lee industries"
  ];

  for (const vendor of sorted) {
    const nameNorm = vendor.name.toLowerCase();
    const idNorm = vendor.id.toLowerCase();

    // Use word boundary matching for vendor names
    const nameEscaped = nameNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = new RegExp(`\\b${nameEscaped}\\b`, "i");
    const idEscaped = idNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const idRegex = new RegExp(`\\b${idEscaped}\\b`, "i");

    const nameMatch = nameRegex.test(lower);
    const idMatch = idRegex.test(lower);

    if (!nameMatch && !idMatch) continue;

    // Check if this is a comparison reference rather than a lock
    if (/\blike\s/.test(lower)) return null;

    // Check false positive patterns
    let isFalsePositive = false;
    for (const fp of falsePositivePatterns) {
      if (fp.test(lower)) {
        // Check if the vendor name is entirely contained within the false positive phrase
        const fpMatch = lower.match(fp);
        if (fpMatch && fpMatch[0].toLowerCase().includes(nameNorm.substring(0, 4))) {
          isFalsePositive = true;
          break;
        }
      }
    }
    if (isFalsePositive) continue;

    return { vendor_id: vendor.id, vendor_name: vendor.name, vendor_tier: vendor.tier };
  }
  return null;
}

function detectMaterials(lower) {
  const materials = [];
  const materialTerms = [
    "performance fabric", "velvet", "leather", "linen", "boucle", "bouclé",
    "silk", "cotton", "wool", "chenille", "microfiber", "crypton",
    "marble", "travertine", "granite", "quartz", "stone", "concrete",
    "walnut", "oak", "teak", "mahogany", "cherry", "maple", "pine", "birch", "ash", "rosewood",
    "brass", "iron", "steel", "chrome", "nickel", "gold", "copper", "bronze",
    "rattan", "wicker", "bamboo", "cane", "jute", "seagrass",
    "glass", "acrylic", "lucite", "resin", "lacquer", "shagreen",
    "cowhide", "shearling", "mohair", "down",
  ];

  for (const mat of materialTerms) {
    if (lower.includes(mat)) materials.push(mat);
  }
  return materials;
}

function detectColors(lower) {
  const colors = [];
  const colorTerms = [
    "white", "ivory", "cream", "bone", "snow",
    "black", "ebony", "jet",
    "gray", "grey", "charcoal", "slate", "graphite", "smoke", "pewter",
    "brown", "cognac", "espresso", "chocolate", "mocha", "camel", "tan", "saddle",
    "beige", "taupe", "sand", "oatmeal", "linen", "wheat", "mushroom",
    "blue", "navy", "sapphire", "cobalt", "indigo", "cerulean", "ocean", "azure",
    "green", "emerald", "sage", "olive", "moss", "hunter", "forest", "jade",
    "red", "burgundy", "crimson", "oxblood", "wine", "berry",
    "pink", "blush", "rose", "mauve", "dusty rose",
    "orange", "rust", "terracotta", "burnt orange", "copper",
    "yellow", "gold", "mustard", "amber",
    "purple", "plum", "eggplant", "aubergine", "lavender",
    "neutral", "earth tone", "jewel tone", "muted",
  ];

  for (const color of colorTerms) {
    if (lower.includes(color)) colors.push(color);
  }
  return colors;
}

function detectPrice(raw) {
  const lower = raw.toLowerCase();
  const result = { min: null, max: null };

  // "under $X" / "below $X" / "less than $X" / "max $X"
  const maxMatch = lower.match(/(?:under|below|less than|max(?:imum)?|up to|budget)\s*\$?\s*(\d[\d,]*)/i);
  if (maxMatch) result.max = Number(maxMatch[1].replace(/,/g, ""));

  // "X k" shorthand
  const kMatch = lower.match(/\$?\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch && !result.max) result.max = Math.round(Number(kMatch[1]) * 1000);

  // "over $X" / "above $X" / "at least $X"
  const minMatch = lower.match(/(?:over|above|at least|minimum|starting at|from)\s*\$?\s*(\d[\d,]*)/i);
  if (minMatch) result.min = Number(minMatch[1].replace(/,/g, ""));

  // Price range: "$X - $Y" or "$X to $Y"
  const rangeMatch = lower.match(/\$\s*(\d[\d,]*)\s*(?:-|to)\s*\$?\s*(\d[\d,]*)/i);
  if (rangeMatch) {
    result.min = Number(rangeMatch[1].replace(/,/g, ""));
    result.max = Number(rangeMatch[2].replace(/,/g, ""));
  }

  return (result.min || result.max) ? result : null;
}

function detectLeadTime(lower) {
  const weekMatch = lower.match(/(\d{1,2})\s*(?:week|weeks|wk)\b/);
  if (weekMatch) return Number(weekMatch[1]);
  if (/\b(quick ship|in stock|ready to ship|immediate|fast)\b/.test(lower)) return 6;
  return null;
}

function detectSize(raw) {
  const lower = raw.toLowerCase();
  const size = {};

  for (const { pattern, type } of SIZE_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      const val = Number(match[1]);
      if (type === "seating_capacity") size.seats = val;
      else if (type === "width") size.width_in = val;
      else if (type === "length") size.length_in = val;
      else if (type === "depth") size.depth_in = val;
      else if (type === "height") size.height_in = val;
      else if (type === "max_dimension") size.max_dimension_in = val;
      else if (type === "feet_dimension") size.width_in = val * 12;
    }
  }

  // Contextual size inference from product type
  if (size.seats) {
    const ptInfo = PRODUCT_TYPE_DEPTH["dining table"];
    if (ptInfo?.typical_sizes) {
      const sizeKey = `seats ${size.seats}`;
      if (ptInfo.typical_sizes[sizeKey]) {
        const range = ptInfo.typical_sizes[sizeKey];
        const numbers = range.match(/\d+/g);
        if (numbers && numbers.length >= 1) {
          size.min_width_in = Number(numbers[0]);
          if (numbers.length >= 2) size.max_width_in = Number(numbers[1]);
        }
      }
    }
  }

  return Object.keys(size).length > 0 ? size : null;
}


// ─────────────────────────────────────────────────────────────────────────────
// SEARCH PLAN BUILDER — Step 2: Translate Thinking into Search Parameters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a structured search plan from the analysis.
 * This plan tells the search engine exactly what to do.
 *
 * @param {object} analysis - Output of analyzeQuery()
 * @returns {object} - Structured search plan
 */
export function buildSearchPlan(analysis) {
  const plan = {
    // Primary search terms
    primary_search: buildPrimarySearch(analysis),
    // Expanded search terms (for BM25 and variant queries)
    expanded_terms: buildExpandedTerms(analysis),
    // Vector search query (richer, for semantic matching)
    vector_query: buildVectorQuery(analysis),
    // Hard filters (must match)
    filters: {
      vendor_id: analysis.vendor_lock?.vendor_id || null,
      vendor_tiers: analysis.tier.vendor_tiers || [1, 2],
      quality_minimum: analysis.tier.quality_minimum || 50,
      categories: analysis.product_types.length > 0 ? buildCategoryFilters(analysis.product_types) : null,
      price_max: analysis.price?.max || null,
      price_min: analysis.price?.min || (analysis.tier.price_floor > 0 ? analysis.tier.price_floor : null),
      requires_outdoor: analysis.requires_outdoor || false,
      requires_commercial: analysis.requires_commercial || false,
    },
    // Soft scoring boosts
    boosts: {
      // Vendors to boost (from style depth + tier)
      vendor_boost: buildVendorBoosts(analysis),
      // Material preferences (boost, don't require)
      material_preferences: analysis.material_preferences,
      // Required attributes (strong boost)
      required_attributes: buildRequiredAttributes(analysis),
      // Preferred attributes (lighter boost)
      preferred_attributes: buildPreferredAttributes(analysis),
      // Color preference boost
      color_preferences: analysis.color_preferences,
    },
    // Things to exclude
    exclusions: {
      materials: analysis.exclusions.materials,
      styles: analysis.exclusions.styles,
      details: analysis.exclusions.details,
    },
    // Result grouping strategy
    grouping: determineGrouping(analysis),
    // Human-readable context
    context_note: buildContextNote(analysis),
    // The full analysis for reference
    _analysis: analysis,
  };

  return plan;
}

function buildPrimarySearch(analysis) {
  const parts = [];

  // Style terms
  if (analysis.style.family) {
    const fam = analysis.style.family.replace(/-/g, " ");
    if (analysis.style.sub && analysis.style.sub !== "classic") {
      parts.push(`${analysis.style.sub.replace(/_/g, " ")} ${fam}`);
    } else {
      parts.push(fam);
    }
  }

  // Material
  if (analysis.material_preferences.length > 0 && analysis.material_preferences.length <= 2) {
    parts.push(analysis.material_preferences[0]);
  }

  // Color
  if (analysis.color_preferences.length > 0 && analysis.color_preferences.length <= 2) {
    parts.push(analysis.color_preferences[0]);
  }

  // Product type
  if (analysis.product_types.length > 0) {
    parts.push(analysis.product_types[0]);
  }

  // If we got nothing, use the raw query
  if (parts.length === 0) return analysis.raw_query;

  return parts.join(" ");
}

function buildExpandedTerms(analysis) {
  const terms = new Set();

  // Add all product type expansions
  for (const type of analysis.product_types) {
    const info = PRODUCT_TYPE_DEPTH[type];
    if (info?.search_expand) {
      for (const t of info.search_expand) terms.add(t);
    }
    // Also add synonyms
    for (const syn of getSynonyms(type)) terms.add(syn);
  }

  // Style-related terms
  if (analysis.style.silhouettes) {
    for (const s of analysis.style.silhouettes) terms.add(s);
  }
  if (analysis.style.details) {
    for (const d of analysis.style.details) terms.add(d);
  }
  if (analysis.style.materials) {
    for (const m of analysis.style.materials) terms.add(m);
  }

  // Material synonyms
  for (const mat of analysis.material_preferences) {
    for (const syn of getSynonyms(mat)) terms.add(syn);
  }

  // Use case attributes
  for (const need of analysis.implied_needs) {
    terms.add(need);
  }

  return [...terms];
}

function buildVectorQuery(analysis) {
  // Build a rich, descriptive query for semantic search
  const parts = [];

  if (analysis.style.family) {
    parts.push(analysis.style.family.replace(/-/g, " "));
    if (analysis.style.sub) parts.push(analysis.style.sub.replace(/_/g, " "));
  }

  for (const mat of analysis.material_preferences.slice(0, 3)) parts.push(mat);
  for (const col of analysis.color_preferences.slice(0, 2)) parts.push(col);
  for (const type of analysis.product_types) parts.push(type);

  // Add key silhouettes for style matching
  if (analysis.style.silhouettes) {
    parts.push(...analysis.style.silhouettes.slice(0, 3));
  }

  // Add implied needs
  parts.push(...analysis.implied_needs.slice(0, 5));

  // Comparison context
  if (analysis.comparison?.means) parts.push(analysis.comparison.means);

  // Fallback
  if (parts.length === 0) parts.push(analysis.raw_query);

  return parts.join(" ");
}

function buildCategoryFilters(productTypes) {
  const categories = new Set();
  for (const type of productTypes) {
    categories.add(type);
    const info = PRODUCT_TYPE_DEPTH[type];
    if (info?.aliases) {
      for (const alias of info.aliases) categories.add(alias);
    }
  }
  return [...categories];
}

function buildVendorBoosts(analysis) {
  const boosts = new Map(); // vendor_id → boost multiplier

  // From style depth
  if (analysis.style.vendors_strong) {
    for (const vid of analysis.style.vendors_strong) {
      boosts.set(vid, (boosts.get(vid) || 1.0) + 0.3);
    }
  }

  // Vendor lock = massive boost (but we filter to this vendor anyway)
  if (analysis.vendor_lock) {
    boosts.set(analysis.vendor_lock.vendor_id, 5.0);
  }

  // From tier: boost tier 1 vendors slightly if tier is luxury/premium
  if (analysis.tier.name === "luxury" || analysis.tier.name === "premium") {
    for (const v of tradeVendors.filter(tv => tv.tier === 1)) {
      if (!boosts.has(v.id)) boosts.set(v.id, 1.1);
    }
  }

  // Anti-boost from style depth (vendors to avoid)
  if (analysis.style.vendors_avoid) {
    for (const vid of analysis.style.vendors_avoid) {
      boosts.set(vid, 0.5);
    }
  }

  return Object.fromEntries(boosts);
}

function buildRequiredAttributes(analysis) {
  const attrs = [];

  // Silhouettes from style depth are strong signals
  if (analysis.style.silhouettes) {
    attrs.push(...analysis.style.silhouettes.slice(0, 3));
  }

  return attrs;
}

function buildPreferredAttributes(analysis) {
  const attrs = [];

  // Details from style depth
  if (analysis.style.details) {
    attrs.push(...analysis.style.details);
  }

  // Remaining silhouettes
  if (analysis.style.silhouettes && analysis.style.silhouettes.length > 3) {
    attrs.push(...analysis.style.silhouettes.slice(3));
  }

  // Implied needs
  attrs.push(...analysis.implied_needs.filter(n => !attrs.includes(n)));

  return attrs;
}

function determineGrouping(analysis) {
  if (analysis.vendor_lock) return "by_collection";
  if (analysis.product_types.length > 1) return "by_category";
  if (analysis.tier.name === "luxury") return "by_tier";
  return "by_relevance";
}

function buildContextNote(analysis) {
  const parts = [];

  // Audience
  if (analysis.audience.type === "commercial") {
    parts.push("Commercial/hospitality project");
  } else if (analysis.audience.type === "family") {
    parts.push("Family-friendly, durable materials needed");
  } else {
    parts.push("Trade designer project");
  }

  // Room
  if (analysis.room_context) {
    parts.push(`for ${analysis.room_context}`);
  }

  // Style
  if (analysis.style.family) {
    const styleName = analysis.style.sub
      ? `${analysis.style.sub.replace(/_/g, " ")} ${analysis.style.family.replace(/-/g, " ")}`
      : analysis.style.family.replace(/-/g, " ");
    parts.push(`${styleName} style`);
  }

  // Tier
  parts.push(`${analysis.tier.name} tier`);

  // Comparison
  if (analysis.comparison?.means) {
    parts.push(`(${analysis.comparison.phrase}: ${analysis.comparison.means})`);
  }

  // Product
  if (analysis.product_types.length > 0) {
    parts.push(`looking for: ${analysis.product_types.join(", ")}`);
  }

  return parts.join(". ") + ".";
}


// ─────────────────────────────────────────────────────────────────────────────
// SEARCH PLAN EXECUTOR — Step 3: Apply the Plan to Search Results
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply the search plan's boosting/filtering/exclusion to a set of products.
 * This runs AFTER BM25 + vector search have returned candidates.
 *
 * @param {object[]} products - Raw search results
 * @param {object} plan - Output of buildSearchPlan()
 * @returns {object[]} - Re-scored and filtered products
 */
export function applySearchPlan(products, plan) {
  if (!products || products.length === 0) return [];

  let results = [...products];

  // ── FILTER: Vendor tiers ──
  if (plan.filters.vendor_tiers && !plan.filters.vendor_id) {
    results = results.filter(p => {
      if (!p.vendor_tier) return true; // Keep untiered products (don't know their tier)
      return plan.filters.vendor_tiers.includes(p.vendor_tier);
    });
  }

  // ── FILTER: Vendor lock ──
  if (plan.filters.vendor_id) {
    results = results.filter(p =>
      (p.vendor_id || "").toLowerCase() === plan.filters.vendor_id.toLowerCase()
    );
  }

  // ── BOOST: Quality score ──
  // Quality is a soft signal (boost), not a hard filter. Products with richer
  // data (images, descriptions, dimensions) rank higher, but products with
  // minimal data still appear — better to show a sparse result than nothing.
  // Previously this was a hard filter that removed most scraped products.

  // ── FILTER: Price ──
  if (plan.filters.price_max) {
    results = results.filter(p =>
      !p.retail_price || p.retail_price <= plan.filters.price_max
    );
  }
  if (plan.filters.price_min) {
    results = results.filter(p =>
      !p.retail_price || p.retail_price >= plan.filters.price_min
    );
  }

  // ── SOFT EXCLUSION: Materials (penalize heavily, don't remove) ──
  // We penalize rather than hard-filter because product data might not have
  // detailed material info — we don't want to accidentally exclude good matches.

  // ── BOOST: Apply design brain scoring ──
  for (const product of results) {
    let boost = 1.0;

    // Quality boost — richer data products rank higher
    if (product.quality_score && plan.filters.quality_minimum > 0) {
      if (product.quality_score >= plan.filters.quality_minimum) {
        boost *= 1.2; // Good quality data
      } else if (product.quality_score < 25) {
        boost *= 0.85; // Sparse data, slight penalty
      }
    }

    // Vendor boost
    const vendorId = (product.vendor_id || "").toLowerCase();
    const vendorBoost = plan.boosts.vendor_boost[vendorId];
    if (vendorBoost) boost *= vendorBoost;

    // Material preference boost
    const productMaterial = (product.material || "").toLowerCase();
    const productDesc = (product.description || "").toLowerCase();
    const productTags = (product.tags || []).join(" ").toLowerCase();
    const productText = `${productMaterial} ${productDesc} ${productTags} ${(product.product_name || "").toLowerCase()}`;

    for (const mat of plan.boosts.material_preferences) {
      if (productText.includes(mat.toLowerCase())) {
        boost *= 1.15;
        break; // One material match is enough
      }
    }

    // Required attribute boost (strong)
    let requiredHits = 0;
    for (const attr of plan.boosts.required_attributes) {
      if (productText.includes(attr.toLowerCase())) {
        requiredHits++;
      }
    }
    if (requiredHits > 0) {
      boost *= (1 + requiredHits * 0.2); // +20% per required attribute match
    }

    // Preferred attribute boost (lighter)
    let preferredHits = 0;
    for (const attr of plan.boosts.preferred_attributes) {
      if (productText.includes(attr.toLowerCase())) {
        preferredHits++;
      }
    }
    if (preferredHits > 0) {
      boost *= (1 + Math.min(preferredHits, 5) * 0.1); // +10% per preferred, max 5
    }

    // Color preference boost
    for (const color of plan.boosts.color_preferences) {
      const productColor = (product.color || "").toLowerCase();
      if (productColor.includes(color.toLowerCase()) || productText.includes(color.toLowerCase())) {
        boost *= 1.1;
        break;
      }
    }

    // Material exclusion penalty
    for (const excMat of plan.exclusions.materials) {
      if (productText.includes(excMat.toLowerCase())) {
        boost *= 0.4; // Heavy penalty
        break;
      }
    }

    // Style exclusion penalty
    const productStyle = (product.style || "").toLowerCase();
    for (const excStyle of plan.exclusions.styles) {
      if (productStyle.includes(excStyle.toLowerCase())) {
        boost *= 0.5;
        break;
      }
    }

    // Apply boost to relevance score
    product._brain_boost = boost;
    product._brain_score = (product.relevance_score || 0) * boost;
  }

  // ── SORT by brain-adjusted score ──
  results.sort((a, b) => (b._brain_score || 0) - (a._brain_score || 0));

  return results;
}


// ─────────────────────────────────────────────────────────────────────────────
// RESULT GROUPING — Step 4: Organize Results Meaningfully
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Group search results into meaningful sections with explanations.
 *
 * @param {object[]} products - Scored and filtered products
 * @param {object} plan - The search plan
 * @returns {object} - Grouped results with section metadata
 */
export function groupResults(products, plan) {
  if (!products || products.length === 0) {
    return { sections: [], all_products: [] };
  }

  const strategy = plan.grouping;

  if (strategy === "by_collection" && plan.filters.vendor_id) {
    return groupByCollection(products, plan);
  }

  if (strategy === "by_category") {
    return groupByCategory(products, plan);
  }

  // Default: by relevance with smart sections
  return groupByRelevance(products, plan);
}

function groupByRelevance(products, plan) {
  const sections = [];
  const used = new Set();

  // Section 1: Top Picks — highest brain_score, diverse vendors
  const topPicks = [];
  const topVendors = new Set();
  for (const p of products) {
    if (used.has(p.id)) continue;
    const vid = p.vendor_id || "unknown";
    if (topVendors.size >= 5 && topVendors.has(vid) && topPicks.length >= 3) continue;
    topPicks.push(p);
    topVendors.add(vid);
    used.add(p.id);
    if (topPicks.length >= 12) break;
  }

  if (topPicks.length > 0) {
    const vendorCount = new Set(topPicks.map(p => p.vendor_name)).size;
    sections.push({
      title: "Top Picks",
      description: `Best matches from ${vendorCount} vendor${vendorCount > 1 ? "s" : ""} known for this style and category`,
      products: topPicks,
    });
  }

  // Section 2: Strong Alternatives — next batch, different vendors preferred
  const alternatives = [];
  for (const p of products) {
    if (used.has(p.id)) continue;
    alternatives.push(p);
    used.add(p.id);
    if (alternatives.length >= 12) break;
  }

  if (alternatives.length > 0) {
    sections.push({
      title: "Strong Alternatives",
      description: "Excellent options with slightly different interpretations",
      products: alternatives,
    });
  }

  // Section 3: Different Direction — remaining products
  const different = [];
  for (const p of products) {
    if (used.has(p.id)) continue;
    different.push(p);
    used.add(p.id);
    if (different.length >= 12) break;
  }

  if (different.length > 0) {
    sections.push({
      title: "Different Direction",
      description: "Same category, different take — worth considering",
      products: different,
    });
  }

  return {
    sections,
    all_products: products,
    context_note: plan.context_note,
  };
}

function groupByCollection(products, plan) {
  const byCollection = new Map();
  for (const p of products) {
    const col = p.collection || "Other";
    if (!byCollection.has(col)) byCollection.set(col, []);
    byCollection.get(col).push(p);
  }

  const sections = [];
  for (const [collection, prods] of byCollection) {
    sections.push({
      title: collection,
      description: `${prods.length} piece${prods.length > 1 ? "s" : ""} from ${prods[0]?.vendor_name || "this vendor"}`,
      products: prods,
    });
  }

  // Sort sections: largest collections first
  sections.sort((a, b) => b.products.length - a.products.length);

  return { sections, all_products: products, context_note: plan.context_note };
}

function groupByCategory(products, plan) {
  const byCategory = new Map();
  for (const p of products) {
    const cat = p.category || p.category_group || "Other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(p);
  }

  const sections = [];
  // Order categories based on the requested product types
  const requestedTypes = plan._analysis.product_types;
  const orderedKeys = [...byCategory.keys()].sort((a, b) => {
    const aMatch = requestedTypes.findIndex(t => a.toLowerCase().includes(t));
    const bMatch = requestedTypes.findIndex(t => b.toLowerCase().includes(t));
    if (aMatch >= 0 && bMatch >= 0) return aMatch - bMatch;
    if (aMatch >= 0) return -1;
    if (bMatch >= 0) return 1;
    return (byCategory.get(b)?.length || 0) - (byCategory.get(a)?.length || 0);
  });

  for (const cat of orderedKeys) {
    const prods = byCategory.get(cat);
    sections.push({
      title: formatCategoryTitle(cat),
      description: `${prods.length} option${prods.length > 1 ? "s" : ""}`,
      products: prods,
    });
  }

  return { sections, all_products: products, context_note: plan.context_note };
}

function formatCategoryTitle(cat) {
  return cat
    .replace(/-/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}


// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT — The full Design Brain pipeline
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the full Design Brain pipeline for a search query.
 * Returns the analysis, search plan, and helper functions.
 *
 * @param {string} query - Raw search query
 * @returns {object} - { analysis, plan, applyToResults, groupResults }
 */
export function think(query) {
  const analysis = analyzeQuery(query);
  const plan = buildSearchPlan(analysis);

  return {
    analysis,
    plan,
    /** Apply the plan's boosting/filtering to search results */
    applyToResults: (products) => applySearchPlan(products, plan),
    /** Group results into meaningful sections */
    groupResults: (products) => groupResults(products, plan),
  };
}

// Export knowledge bases for testing/inspection
export const KNOWLEDGE = {
  TIER_SIGNALS,
  ROOM_CONTEXTS,
  STYLE_DEPTH,
  USE_CASE_SIGNALS,
  COMPARISON_MAP,
  EXCLUSION_RULES,
  PRODUCT_TYPE_DEPTH,
};
