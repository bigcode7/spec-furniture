/**
 * Trade Vendor Registry
 *
 * SPEC is a trade-only platform for the professional furniture industry.
 * These are established home furnishings manufacturers and trade brands
 * that sell through retailers, designers, reps, and dealer networks.
 * They show at High Point Market and sell through to-the-trade showrooms.
 *
 * NO consumer/DTC brands: no IKEA, Wayfair, West Elm, Pottery Barn,
 * CB2, Target, Amazon, Article, Castlery, or any mass-market retailer.
 */

export const tradeVendors = [
  // ── TIER 1 — TOP PRIORITY ──────────────────────────────
  { id: "bernhardt", name: "Bernhardt", domain: "bernhardt.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "storage", "accents"] },
  { id: "hooker", name: "Hooker Furniture", domain: "hookerfurnishings.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "storage", "home-office"] },
  { id: "century", name: "Century Furniture", domain: "centuryfurniture.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "storage", "accents"] },
  { id: "vanguard", name: "Vanguard Furniture", domain: "vanguardfurniture.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "accents"] },
  { id: "lexington", name: "Lexington Home Brands", domain: "lexington.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "storage", "outdoor"] },
  { id: "universal", name: "Universal Furniture", domain: "universalfurniture.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "storage"] },
  { id: "hickory-chair", name: "Hickory Chair", domain: "hickorychair.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "accents"] },
  { id: "theodore-alexander", name: "Theodore Alexander", domain: "theodorealexander.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "storage", "accents", "lighting"] },
  { id: "fourhands", name: "Four Hands", domain: "fourhands.com", tier: 1, categories: ["seating", "tables", "storage", "lighting", "accents", "outdoor"] },
  { id: "caracole", name: "Caracole", domain: "caracole.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "accents"] },
  { id: "baker", name: "Baker Furniture", domain: "bakerfurniture.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "accents"] },
  { id: "stickley", name: "Stickley", domain: "stickley.com", tier: 1, categories: ["seating", "tables", "bedroom", "dining", "storage"] },
  { id: "cr-laine", name: "CR Laine", domain: "crlaine.com", tier: 1, categories: ["seating", "accents"] },
  { id: "lee-industries", name: "Lee Industries", domain: "leeindustries.com", tier: 1, categories: ["seating", "tables", "accents", "outdoor"] },
  { id: "sherrill", name: "Sherrill Furniture", domain: "sherrillfurniture.com", tier: 1, categories: ["seating", "tables", "accents"] },

  // ── TIER 2 — HIGH PRIORITY ─────────────────────────────
  { id: "arteriors", name: "Arteriors", domain: "arteriorshome.com", tier: 2, categories: ["lighting", "tables", "accents", "mirrors", "storage"] },
  { id: "gabby", name: "Gabby", domain: "gabbyhome.com", tier: 2, categories: ["seating", "tables", "accents", "lighting", "storage"] },
  { id: "noir", name: "Noir Furniture", domain: "noirfurniturela.com", tier: 2, categories: ["seating", "tables", "bedroom", "accents", "lighting"] },
  { id: "currey", name: "Currey & Company", domain: "currey.com", tier: 2, categories: ["lighting", "tables", "accents", "seating"] },
  { id: "visual-comfort", name: "Visual Comfort", domain: "visualcomfort.com", tier: 2, categories: ["lighting"] },
  { id: "uttermost", name: "Uttermost", domain: "uttermost.com", tier: 2, categories: ["lighting", "mirrors", "accents", "tables"] },
  { id: "surya", name: "Surya", domain: "surya.com", tier: 2, categories: ["rugs", "lighting", "accents"] },
  { id: "loloi", name: "Loloi Rugs", domain: "loloirugs.com", tier: 2, categories: ["rugs"] },
  { id: "jaipur-living", name: "Jaipur Living", domain: "jaipurliving.com", tier: 2, categories: ["rugs", "accents"] },
  { id: "palecek", name: "Palecek", domain: "palecek.com", tier: 2, categories: ["seating", "tables", "lighting", "accents"] },
  { id: "bungalow5", name: "Bungalow 5", domain: "bungalow5.com", tier: 2, categories: ["tables", "storage", "accents", "lighting"] },
  { id: "worlds-away", name: "Worlds Away", domain: "worldsaway.com", tier: 2, categories: ["tables", "storage", "lighting", "mirrors", "accents"] },
  { id: "global-views", name: "Global Views", domain: "globalviews.com", tier: 2, categories: ["accents", "tables", "lighting"] },
  { id: "aidan-gray", name: "Aidan Gray", domain: "aidangray.com", tier: 2, categories: ["lighting", "tables", "accents", "mirrors"] },
  { id: "made-goods", name: "Made Goods", domain: "madegoods.com", tier: 2, categories: ["seating", "tables", "lighting", "accents", "storage"] },

  // ── TIER 3 — IMPORTANT ─────────────────────────────────
  { id: "maitland-smith", name: "Maitland Smith", domain: "maitland-smith.com", tier: 3, categories: ["tables", "storage", "accents", "lighting"] },
  { id: "hancock-moore", name: "Hancock & Moore", domain: "hancockandmoore.com", tier: 3, categories: ["seating"] },
  { id: "bradington-young", name: "Bradington-Young", domain: "bradingtonyoung.com", tier: 3, categories: ["seating"] },
  { id: "riverside", name: "Riverside Furniture", domain: "riversidefurniture.com", tier: 3, categories: ["tables", "bedroom", "storage", "home-office"] },
  { id: "marge-carson", name: "Marge Carson", domain: "margecarson.com", tier: 3, categories: ["seating", "tables", "bedroom", "dining"] },
  { id: "ej-victor", name: "EJ Victor", domain: "ejvictor.com", tier: 3, categories: ["seating", "tables", "bedroom", "dining"] },
  { id: "highland-house", name: "Highland House", domain: "highlandhousefurniture.com", tier: 3, categories: ["seating", "tables", "accents"] },
  { id: "pearson", name: "Pearson Furniture", domain: "pearsonco.com", tier: 3, categories: ["seating"] },
  { id: "wesley-hall", name: "Wesley Hall", domain: "wesleyhall.com", tier: 3, categories: ["seating", "tables"] },
  { id: "huntington-house", name: "Huntington House", domain: "huntingtonhouse.com", tier: 3, categories: ["seating"] },
  { id: "younger", name: "Younger Furniture", domain: "younger.com", tier: 3, categories: ["seating"] },
  { id: "precedent", name: "Precedent Furniture", domain: "precedentfurniture.com", tier: 3, categories: ["seating", "tables"] },

  // ── TIER 4 — EXPAND TO ─────────────────────────────────
  { id: "rh-trade", name: "RH (Trade Program)", domain: "rh.com", tier: 4, categories: ["seating", "tables", "bedroom", "dining", "lighting", "outdoor"] },
  { id: "holly-hunt", name: "Holly Hunt", domain: "hollyhunt.com", tier: 4, categories: ["seating", "tables", "lighting", "accents"] },
  { id: "donghia", name: "Donghia", domain: "donghia.com", tier: 4, categories: ["seating", "tables", "accents"] },
  { id: "kravet", name: "Kravet Furniture", domain: "kravet.com", tier: 4, categories: ["seating", "tables", "accents"] },
  { id: "ralph-lauren-home", name: "Ralph Lauren Home", domain: "ralphlaurenhome.com", tier: 4, categories: ["seating", "tables", "bedroom", "dining", "lighting"] },
  { id: "hickory-white", name: "Hickory White", domain: "hickorywhite.com", tier: 4, categories: ["seating", "tables", "bedroom", "dining"] },
  { id: "kincaid", name: "Kincaid", domain: "kincaidfurniture.com", tier: 4, categories: ["seating", "tables", "bedroom", "dining", "storage"] },
  // ── TIER 2+ — ADDITIONAL SHOPIFY VENDORS ─────────────
  { id: "jonathan-adler", name: "Jonathan Adler", domain: "jonathanadler.com", tier: 2, categories: ["seating", "tables", "lighting", "accents", "rugs"] },
  { id: "abc-home", name: "ABC Home", domain: "abchome.com", tier: 3, categories: ["seating", "tables", "lighting", "rugs", "accents", "bedroom"] },
  { id: "jayson-home", name: "Jayson Home", domain: "jaysonhome.com", tier: 3, categories: ["seating", "tables", "lighting", "accents"] },
  { id: "high-fashion-home", name: "High Fashion Home", domain: "highfashionhome.com", tier: 3, categories: ["seating", "tables", "lighting", "bedroom", "accents"] },
  { id: "flexsteel", name: "Flexsteel", domain: "flexsteel.com", tier: 2, categories: ["seating", "tables", "bedroom", "dining", "home-office"] },
  { id: "lulu-and-georgia", name: "Lulu and Georgia", domain: "luluandgeorgia.com", tier: 3, categories: ["seating", "tables", "lighting", "rugs", "bedroom", "accents"] },
  { id: "mcgee-and-co", name: "McGee & Co", domain: "mcgeeandco.com", tier: 3, categories: ["seating", "tables", "lighting", "rugs", "bedroom", "accents"] },
  { id: "schoolhouse", name: "Schoolhouse Electric", domain: "schoolhouseelectric.com", tier: 3, categories: ["lighting", "accents"] },

  // ── ADDITIONAL VENDORS (from full catalog crawl spec) ───
  { id: "sam-moore", name: "Sam Moore", domain: "sammoore.com", tier: 3, categories: ["seating"] },
  { id: "fairfield-chair", name: "Fairfield Chair", domain: "fairfieldchair.com", tier: 3, categories: ["seating"] },
  { id: "american-drew", name: "American Drew", domain: "americandrew.com", tier: 3, categories: ["bedroom", "dining", "storage"] },
  { id: "hammary", name: "Hammary", domain: "hammary.com", tier: 3, categories: ["tables", "accents", "storage"] },
  { id: "thomasville", name: "Thomasville", domain: "thomasville.com", tier: 3, categories: ["seating", "tables", "bedroom", "dining", "storage"] },
];

export function getTradeVendor(id) {
  return tradeVendors.find((v) => v.id === id) || null;
}

export function getTradeVendorByDomain(domain) {
  const clean = domain.replace(/^www\./, "").toLowerCase();
  return tradeVendors.find((v) => v.domain.replace(/^www\./, "").toLowerCase() === clean) || null;
}

export function getTier1Vendors() {
  return tradeVendors.filter((v) => v.tier === 1);
}

export function getVendorsByTier(tier) {
  return tradeVendors.filter((v) => v.tier === tier);
}

export function getAllVendorNames() {
  return tradeVendors.map((v) => v.name);
}
