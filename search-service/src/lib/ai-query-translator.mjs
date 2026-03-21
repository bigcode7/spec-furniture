/**
 * AI Query Translator — Enhanced Haiku intent parser.
 *
 * One cheap Haiku call converts natural language into structured intent:
 * - Category detection (including natural language: "something behind my sofa" → console-tables)
 * - Dimension constraints ("sofa under 84 inches")
 * - Negative filtering ("no sectionals")
 * - Material hierarchy ("dark wood" → walnut, mahogany, espresso)
 * - Collection/vendor detection
 * - Price signals
 * - Style inference
 *
 * ~$0.001 per query. Falls back to local parsing if API unavailable.
 */

import { parseDimensionConstraints, parsePriceSignals, expandMaterial, detectCollectionInQuery, MATERIAL_HIERARCHY, NATURAL_LANGUAGE_CATEGORIES, getSynonyms } from "./furniture-dictionary.mjs";
import { detectQueryCategory } from "./query-category-filter.mjs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

let callCount = 0;
let rateLimitedUntil = 0;

export function getAIQueryStats() {
  return { calls: callCount };
}

const SYSTEM_PROMPT = `You are the AI brain of a luxury furniture search engine for interior designers. Parse search queries into structured JSON intent.

VALID CATEGORIES:
sofas, sectionals, loveseats, accent-chairs, swivel-chairs, dining-chairs, bar-stools, recliners, ottomans, benches, chaises,
beds, headboards, nightstands, dressers, chests, wardrobes, mirrors,
dining-tables, coffee-tables, console-tables, side-tables, desks,
credenzas, media-consoles, bookcases, cabinets,
floor-lamps, table-lamps, chandeliers, pendants, sconces,
area-rugs, pillows, decorative-objects

VENDORS IN CATALOG:
Bernhardt, Four Hands, Century Furniture, Vanguard Furniture, Hooker Furniture, Lee Industries, Theodore Alexander, Hickory Chair, Baker Furniture, CR Laine, Caracole, Lexington Home Brands, Universal Furniture, Stickley, Sherrill Furniture, Wesley Hall, Hancock and Moore, Highland House

Return ONLY a JSON object:
{
  "category": "exact slug or null",
  "categories": ["array of slugs if multi-category, else null"],
  "vendor": "single vendor name if specified, else null",
  "vendors": ["array of vendor names if user names multiple vendors, else null — e.g. 'hooker and bernhardt' → ['Hooker Furniture', 'Bernhardt']"],
  "collection": "collection name if mentioned (e.g. Barbara Barry, Mission, Tommy Bahama), else null",
  "style": "modern|traditional|transitional|coastal|mid-century|glam|contemporary|minimalist|industrial|rustic|art-deco|mission|craftsman|farmhouse|bohemian|scandinavian or null",
  "material": "primary material or null",
  "material_expanded": ["array of specific materials to search — e.g. for 'dark wood': walnut, mahogany, espresso, ebony"],
  "color": "color or null",
  "keywords": ["3-8 search terms for matching product names/descriptions"],
  "exclude_terms": ["words/phrases the user does NOT want — from 'no X', 'not X', 'without X', 'exclude X'"],
  "exclude_categories": ["categories to exclude"],
  "dimensions": {"width_max": null, "width_min": null, "depth_max": null, "height_max": null, "seats": null},
  "price_max": null,
  "price_min": null,
  "price_tier": "value|mid|luxury or null",
  "sort_preference": "relevance"
}

CRITICAL RULES:
- "something to put behind my sofa" → category: "console-tables"
- "sofa under 84 inches" → category: "sofas", dimensions.width_max: 84
- "no sectionals" / "not sectionals" → exclude_terms: ["sectional"], exclude_categories: ["sectionals"]
- "dark wood dining table" → material: "dark wood", material_expanded: ["walnut","mahogany","espresso","ebony","dark brown","java","dark oak"]
- "Hancock and Moore leather recliner" → vendor: "Hancock and Moore", material: "leather", category: "recliners"
- "just hooker and bernhardt sofas" → vendors: ["Hooker Furniture", "Bernhardt"], category: "sofas"
- "only from Caracole" → vendor: "Caracole"
- "Barbara Barry collection" → collection: "Barbara Barry", vendor: "Baker Furniture"
- "mission style bookcase" → style: "mission", category: "bookcases", vendor hint: "Stickley"
- "large dining table seats 10" → category: "dining-tables", dimensions.width_min: 108, dimensions.seats: 10
- For room queries like "bedroom" use categories array: ["beds","nightstands","dressers","chests","mirrors"]
- CUSHION CONFIGS are trade terms, NOT dimensions or prices: "3 over 3" = three back cushions over three seat cushions, "2 over 2" = two over two, "bench seat" = single seat cushion, "tight back" = no back cushions. Include these as keywords, NOT as dimensions or price values.
- SYNONYM EXPANSION is critical. The "keywords" array must include the TRADE TERMS that match the user's intent, not just their exact words. Interior designers and consumers use different words for the same thing:
  - "cozy round chair" → keywords should include: "barrel chair", "tub chair", "swivel chair", "round back", "curved", "upholstered"
  - "big comfy sofa" → keywords should include: "deep seat", "oversized", "extra deep", "wide", "plush", "feather down"
  - "skinny table for behind couch" → keywords should include: "console table", "sofa table", "narrow", "slim"
  - "fancy dining table" → keywords should include: "formal", "luxury", "pedestal", "extension", "inlay"
  - "dark moody bedroom" → keywords should include: "espresso", "ebony", "dark finish", "charcoal", "noir", "java"
  - Always include 3-5 furniture TRADE TERMS that match the user's natural language meaning
- Return ONLY valid JSON. No markdown, no explanation.`;

const EXAMPLES = [
  {
    query: "traditional sofa",
    response: '{"category":"sofas","categories":null,"vendor":null,"collection":null,"style":"traditional","material":null,"material_expanded":null,"color":null,"keywords":["traditional","sofa","classic","rolled arm","sofa"],"exclude_terms":[],"exclude_categories":["sectionals","accent-chairs","ottomans","dining-chairs","beds"],"dimensions":null,"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "walnut dining table",
    response: '{"category":"dining-tables","categories":null,"vendor":null,"collection":null,"style":null,"material":"walnut","material_expanded":["walnut","american walnut","black walnut","walnut veneer"],"color":null,"keywords":["walnut","dining","table","wood","dining table"],"exclude_terms":[],"exclude_categories":["dining-chairs","coffee-tables","side-tables","accent-chairs"],"dimensions":null,"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "something to put behind my sofa",
    response: '{"category":"console-tables","categories":null,"vendor":null,"collection":null,"style":null,"material":null,"material_expanded":null,"color":null,"keywords":["console","table","sofa table","entry table","hall table","narrow"],"exclude_terms":[],"exclude_categories":["sofas","beds","dining-tables","area-rugs"],"dimensions":null,"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "sofa under 84 inches no sectionals",
    response: '{"category":"sofas","categories":null,"vendor":null,"collection":null,"style":null,"material":null,"material_expanded":null,"color":null,"keywords":["sofa","couch","settee"],"exclude_terms":["sectional"],"exclude_categories":["sectionals"],"dimensions":{"width_max":84,"width_min":null,"depth_max":null,"height_max":null,"seats":null},"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "large dark wood dining table seats 10 traditional",
    response: '{"category":"dining-tables","categories":null,"vendor":null,"collection":null,"style":"traditional","material":"dark wood","material_expanded":["walnut","mahogany","espresso","ebony","dark brown","java","dark oak","dark stain"],"color":"dark","keywords":["dining table","large","traditional","dark wood","extension","seats 10"],"exclude_terms":[],"exclude_categories":["dining-chairs","coffee-tables","side-tables"],"dimensions":{"width_max":null,"width_min":108,"depth_max":null,"height_max":null,"seats":10},"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "Hancock and Moore leather recliner",
    response: '{"category":"recliners","categories":null,"vendor":"Hancock and Moore","collection":null,"style":null,"material":"leather","material_expanded":["leather","full grain leather","top grain leather","aniline leather"],"color":null,"keywords":["leather","recliner","reclining","hancock","moore"],"exclude_terms":[],"exclude_categories":["sofas","accent-chairs","dining-chairs"],"dimensions":null,"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "Barbara Barry collection",
    response: '{"category":null,"categories":null,"vendor":"Baker Furniture","collection":"Barbara Barry","style":null,"material":null,"material_expanded":null,"color":null,"keywords":["barbara","barry","baker","collection"],"exclude_terms":[],"exclude_categories":[],"dimensions":null,"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "mission style bookcase",
    response: '{"category":"bookcases","categories":null,"vendor":null,"collection":null,"style":"mission","material":"wood","material_expanded":["oak","quarter sawn oak","cherry","solid wood"],"color":null,"keywords":["mission","bookcase","bookshelf","arts and crafts","craftsman","stickley","shelving"],"exclude_terms":[],"exclude_categories":["cabinets","credenzas","media-consoles"],"dimensions":null,"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "3 over 3 sofa",
    response: '{"category":"sofas","categories":null,"vendor":null,"collection":null,"style":null,"material":null,"material_expanded":null,"color":null,"keywords":["3 over 3","three over three","three cushion","loose back","loose cushion","sofa"],"exclude_terms":[],"exclude_categories":["sectionals","loveseats","accent-chairs"],"dimensions":null,"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "cozy round chair",
    response: '{"category":"accent-chairs","categories":["accent-chairs","swivel-chairs"],"vendor":null,"collection":null,"style":null,"material":null,"material_expanded":null,"color":null,"keywords":["barrel chair","tub chair","swivel chair","round back","curved","upholstered","club chair","cozy","round"],"exclude_terms":[],"exclude_categories":["dining-chairs","bar-stools","desks"],"dimensions":null,"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "big comfy sofa",
    response: '{"category":"sofas","categories":["sofas","sectionals"],"vendor":null,"collection":null,"style":null,"material":null,"material_expanded":null,"color":null,"keywords":["deep seat","oversized","extra deep","wide","plush","feather down","sofa","large","comfortable"],"exclude_terms":[],"exclude_categories":["loveseats","accent-chairs","dining-chairs"],"dimensions":null,"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
  {
    query: "skinny table for behind couch",
    response: '{"category":"console-tables","categories":null,"vendor":null,"collection":null,"style":null,"material":null,"material_expanded":null,"color":null,"keywords":["console table","sofa table","narrow","slim","behind sofa","hall table","entry table"],"exclude_terms":[],"exclude_categories":["dining-tables","coffee-tables","desks","beds"],"dimensions":{"width_max":null,"width_min":null,"depth_max":18,"height_max":null,"seats":null},"price_max":null,"price_min":null,"price_tier":null,"sort_preference":"relevance"}'
  },
];

/**
 * Call Haiku to translate a search query into structured intent.
 * Returns enriched filter object or null on failure.
 */
export async function translateQuery(query) {
  if (!process.env.ANTHROPIC_API_KEY) return localParse(query);
  if (Date.now() < rateLimitedUntil) return localParse(query);

  callCount++;

  // Build messages with few-shot examples
  const messages = [];
  for (const ex of EXAMPLES) {
    messages.push({ role: "user", content: ex.query });
    messages.push({ role: "assistant", content: ex.response });
  }
  messages.push({ role: "user", content: query });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") || 60);
      rateLimitedUntil = Date.now() + retryAfter * 1000;
      return localParse(query);
    }

    if (!response.ok) return localParse(query);

    const result = await response.json();
    const text = result.content?.[0]?.text?.trim();
    if (!text) return localParse(query);

    // Parse JSON — handle markdown code fences if present
    const jsonStr = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
    const filter = JSON.parse(jsonStr);

    // Validate: must be an object with at least keywords
    if (!filter || typeof filter !== "object") return localParse(query);
    if (!Array.isArray(filter.keywords) || filter.keywords.length === 0) return localParse(query);

    // Enrich with local parsing for dimensions/price that AI might miss
    enrichWithLocalParsing(filter, query);

    // Sanitize garbage numeric values AFTER enrichment (e.g. "3 over 3" → price_min: 3, width_min: 3)
    sanitizeNumericValues(filter, query);

    return filter;
  } catch (err) {
    // Fall back to local parsing
    return localParse(query);
  }
}

/**
 * Sanitize garbage numeric values from AI parse.
 * Trade terms like "3 over 3" get misinterpreted as price_min: 3 or dimensions.width_min: 3.
 * Real furniture dimensions are never < 10 inches. Real prices are never < $50.
 */
function sanitizeNumericValues(filter, query) {
  // Price sanity: luxury furniture is never under $50
  if (filter.price_min != null && filter.price_min < 50) filter.price_min = null;
  if (filter.price_max != null && filter.price_max < 50) filter.price_max = null;

  // Dimension sanity: no real furniture dimension is under 10 inches
  if (filter.dimensions && typeof filter.dimensions === "object") {
    for (const key of Object.keys(filter.dimensions)) {
      const val = filter.dimensions[key];
      if (val != null && typeof val === "number" && key !== "seats" && val < 10) {
        filter.dimensions[key] = null;
      }
    }
    // Remove dimensions object if all values are null
    if (Object.values(filter.dimensions).every(v => v == null)) {
      filter.dimensions = null;
    }
  }
}

/**
 * Enrich an AI-generated filter with local parsing results.
 * Catches dimensions/price that the AI might miss or parse differently.
 */
function enrichWithLocalParsing(filter, query) {
  // Merge dimension constraints
  const dims = parseDimensionConstraints(query);
  if (dims) {
    if (!filter.dimensions) filter.dimensions = {};
    for (const [k, v] of Object.entries(dims)) {
      if (v != null && !filter.dimensions[k]) filter.dimensions[k] = v;
    }
  }

  // Merge price signals
  const price = parsePriceSignals(query);
  if (price) {
    if (price.price_max && !filter.price_max) filter.price_max = price.price_max;
    if (price.price_min && !filter.price_min) filter.price_min = price.price_min;
    if (price.price_tier && !filter.price_tier) filter.price_tier = price.price_tier;
  }

  // Expand material hierarchy if AI didn't
  if (filter.material && (!filter.material_expanded || filter.material_expanded.length === 0)) {
    const expanded = expandMaterial(filter.material);
    if (expanded.length > 1 || expanded[0] !== filter.material.toLowerCase()) {
      filter.material_expanded = expanded;
    }
  }

  // Detect collection if AI missed it
  if (!filter.collection) {
    const coll = detectCollectionInQuery(query);
    if (coll) filter.collection = coll;
  }

  // Parse exclude terms from query locally (catch "no X", "without X")
  if (!filter.exclude_terms) filter.exclude_terms = [];
  const q = query.toLowerCase();
  const noMatch = q.match(/\bno\s+(\w+(?:\s+\w+)?)/gi);
  if (noMatch) {
    for (const m of noMatch) {
      const term = m.replace(/^no\s+/i, "").trim();
      if (!filter.exclude_terms.includes(term)) filter.exclude_terms.push(term);
    }
  }
  const withoutMatch = q.match(/\bwithout\s+(\w+(?:\s+\w+)?)/gi);
  if (withoutMatch) {
    for (const m of withoutMatch) {
      const term = m.replace(/^without\s+/i, "").trim();
      if (!filter.exclude_terms.includes(term)) filter.exclude_terms.push(term);
    }
  }
  const excludeMatch = q.match(/\bexclude\s+(\w+(?:\s+\w+)?)/gi);
  if (excludeMatch) {
    for (const m of excludeMatch) {
      const term = m.replace(/^exclude\s+/i, "").trim();
      if (!filter.exclude_terms.includes(term)) filter.exclude_terms.push(term);
    }
  }
}

// ── Known vendors for local parsing ──
const LOCAL_VENDORS = [
  { names: ["bernhardt"], id: "bernhardt", display: "Bernhardt" },
  { names: ["four hands", "fourhands"], id: "four-hands", display: "Four Hands" },
  { names: ["century", "century furniture"], id: "century", display: "Century Furniture" },
  { names: ["vanguard", "vanguard furniture"], id: "vanguard", display: "Vanguard Furniture" },
  { names: ["hooker", "hooker furniture"], id: "hooker", display: "Hooker Furniture" },
  { names: ["lee industries"], id: "lee-industries", display: "Lee Industries" },
  { names: ["theodore alexander"], id: "theodore-alexander", display: "Theodore Alexander" },
  { names: ["hickory chair"], id: "hickory-chair", display: "Hickory Chair" },
  { names: ["baker", "baker furniture"], id: "baker-furniture", display: "Baker Furniture" },
  { names: ["cr laine", "c.r. laine"], id: "cr-laine", display: "CR Laine" },
  { names: ["caracole"], id: "caracole", display: "Caracole" },
  { names: ["lexington", "lexington home brands"], id: "lexington", display: "Lexington Home Brands" },
  { names: ["universal", "universal furniture"], id: "universal", display: "Universal Furniture" },
  { names: ["stickley"], id: "stickley", display: "Stickley" },
  { names: ["sherrill", "sherrill furniture"], id: "sherrill", display: "Sherrill Furniture" },
  { names: ["wesley hall"], id: "wesley-hall", display: "Wesley Hall" },
  { names: ["hancock and moore", "hancock & moore", "hancock moore"], id: "hancock-moore", display: "Hancock & Moore" },
  { names: ["highland house"], id: "highland-house", display: "Highland House" },
];

// ── Collection → vendor mapping ──
const COLLECTION_VENDOR_MAP = {
  "barbara barry": "Baker Furniture",
  "thomas pheasant": "Baker Furniture",
  "bill sofield": "Baker Furniture",
  "laura kirar": "Baker Furniture",
  "mcguire": "Baker Furniture",
  "milling road": "Baker Furniture",
  // "mission" is a style, not a collection — don't auto-lock to Stickley
  "harvey ellis": "Stickley",
  "tommy bahama": "Lexington Home Brands",
  "barclay butera": "Lexington Home Brands",
  "suzanne kasler": "Hickory Chair",
  "ray booth": "Hickory Chair",
  "alexa hampton": "Theodore Alexander",
  "coastal living": "Universal Furniture",
  "cynthia rowley": "Hooker Furniture",
};

/**
 * Local (free) intent parsing fallback when API is unavailable.
 * Comprehensive pattern matching using the dictionary.
 */
export function localParse(query) {
  if (!query) return null;
  const q = query.toLowerCase().trim();

  const filter = {
    category: null,
    categories: null,
    vendor: null,
    vendors: null, // array for multi-vendor queries ("Bernhardt and Hooker")
    collection: null,
    style: null,
    material: null,
    material_expanded: null,
    color: null,
    keywords: [],
    exclude_terms: [],
    exclude_categories: [],
    dimensions: null,
    price_max: null,
    price_min: null,
    price_tier: null,
    sort_preference: "relevance",
  };

  // ── Vendor detection (supports multiple vendors) ──
  // Use word boundary matching to avoid "century" matching in "mid century"
  const detectedVendors = [];
  for (const v of LOCAL_VENDORS) {
    for (const name of v.names) {
      const regex = new RegExp(`(?:^|\\b)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\b|$)`, "i");
      if (regex.test(q)) {
        // Extra check: "century" alone should NOT match "mid century" / "mid-century"
        if (name === "century" && /mid[\s-]?century/i.test(q)) continue;
        if (!detectedVendors.find(dv => dv.id === v.id)) {
          detectedVendors.push(v);
        }
        break; // break inner loop (names), continue outer loop (vendors)
      }
    }
  }
  if (detectedVendors.length === 1) {
    filter.vendor = detectedVendors[0].display;
    filter.vendor_ids = [detectedVendors[0].id];
    filter.vendors = null;
  } else if (detectedVendors.length > 1) {
    filter.vendor = null; // don't set single vendor — use vendors array
    filter.vendors = detectedVendors.map(v => v.display);
    filter.vendor_ids = detectedVendors.map(v => v.id);
  }

  // ── Category detection via query-category-filter ──
  const catDetect = detectQueryCategory(query, filter.vendor ? filter.vendor.toLowerCase().replace(/\s+/g, "-") : null);
  if (catDetect.type === "product" || catDetect.type === "natural-language") {
    if (catDetect.categories?.length === 1) {
      filter.category = catDetect.categories[0];
    } else if (catDetect.categories?.length > 1) {
      filter.categories = catDetect.categories;
    }
  } else if (catDetect.type === "room") {
    filter.categories = catDetect.categories;
    filter._room_context = catDetect.detected;
  }

  // ── Natural language category (highest priority) ──
  for (const [phrase, cat] of Object.entries(NATURAL_LANGUAGE_CATEGORIES)) {
    if (q.includes(phrase)) {
      filter.category = cat;
      filter.categories = null;
      break;
    }
  }

  // ── Exclude categories based on detected category ──
  if (filter.category) {
    const allCats = ["sofas", "sectionals", "accent-chairs", "dining-chairs", "dining-tables", "coffee-tables", "side-tables", "beds", "ottomans", "area-rugs"];
    filter.exclude_categories = allCats.filter(c => c !== filter.category && !(filter.categories || []).includes(c)).slice(0, 5);
  }

  // ── Dimensions (explicit) ──
  const dims = parseDimensionConstraints(query);
  if (dims) filter.dimensions = dims;

  // ── Dimensions (implicit — Layer 2) ──
  parseImplicitDimensions(query, filter);

  // ── Cross-field concepts (Layer 3) ──
  filter._cross_field_concepts = detectCrossFieldConcepts(query);

  // ── Price ──
  const price = parsePriceSignals(query);
  if (price) {
    filter.price_max = price.price_max || null;
    filter.price_min = price.price_min || null;
    filter.price_tier = price.price_tier || null;
  }

  // ── Collection ──
  filter.collection = detectCollectionInQuery(query);
  // If collection detected, infer vendor
  if (filter.collection && !filter.vendor) {
    const collLower = filter.collection.toLowerCase();
    if (COLLECTION_VENDOR_MAP[collLower]) {
      filter.vendor = COLLECTION_VENDOR_MAP[collLower];
    }
  }

  // ── Material hierarchy ──
  // First, collect excluded materials (from "not glass", "no leather", etc.)
  const excludedMaterials = new Set(filter.exclude_terms.map(t => t.toLowerCase()));

  // Check abstract materials first ("dark wood", "soft fabric", etc.)
  for (const [abstract, specifics] of Object.entries(MATERIAL_HIERARCHY)) {
    if (q.includes(abstract) && !excludedMaterials.has(abstract)) {
      filter.material = abstract;
      filter.material_expanded = specifics;
      break;
    }
  }
  // Check specific materials — skip if the material is in a negation context
  if (!filter.material) {
    const materials = ["leather", "velvet", "boucle", "linen", "performance fabric", "walnut", "oak", "mahogany", "cherry", "maple", "marble", "brass", "iron", "rattan", "teak", "glass", "stone", "wool", "cotton", "silk", "chenille"];
    for (const m of materials) {
      if (q.includes(m) && !excludedMaterials.has(m)) {
        // Also check it's not preceded by "not ", "no ", "without "
        const negRegex = new RegExp(`\\b(?:not|no|without|exclude)\\s+${m}`, "i");
        if (!negRegex.test(q)) {
          filter.material = m;
          filter.material_expanded = expandMaterial(m);
          break;
        }
      }
    }
  }

  // ── Exclude terms ──
  // Catch all negation patterns including natural language
  const negPatterns = [
    /\bno\s+(\w+(?:\s+\w+)?)/gi,
    /\bnot\s+(\w+(?:\s+\w+)?)/gi,
    /\bwithout\s+(\w+(?:\s+\w+)?)/gi,
    /\bexclude\s+(\w+(?:\s+\w+)?)/gi,
    /\bavoid\s+(\w+(?:\s+\w+)?)/gi,
    /\bskip\s+(\w+(?:\s+\w+)?)/gi,
    /\bhates?\s+(\w+(?:\s+\w+)?)/gi,
    /\bdon'?t\s+(?:want|like|need)\s+(\w+(?:\s+\w+)?)/gi,
    /\bdoesn'?t\s+(?:feel|look|want)\s+(\w+(?:\s+\w+)?)/gi,
    /\bnever\s+(\w+(?:\s+\w+)?)/gi,
    /\bbut\s+not\s+(\w+(?:\s+\w+)?)/gi,
  ];
  const negStopWords = new Set(["more", "the", "a", "an", "than", "less", "this", "that", "it", "just", "too", "so", "very", "really", "feel", "look", "want", "like", "need"]);
  for (const regex of negPatterns) {
    let m;
    while ((m = regex.exec(q)) !== null) {
      // Extract meaningful words from the captured group
      const words = m[1].trim().toLowerCase().split(/\s+/).filter(w => !negStopWords.has(w));
      for (const term of words) {
        if (term.length < 3) continue;
        if (!filter.exclude_terms.includes(term)) {
          filter.exclude_terms.push(term);
        }
      }
    }
  }

  // ── Style detection (skip negated styles) ──
  const styles = [
    "mid-century", "mid century", "midcentury", "mcm",
    "art-deco", "art deco",
    "modern", "traditional", "transitional", "coastal", "glam",
    "contemporary", "minimalist", "industrial", "rustic",
    "mission", "craftsman", "arts and crafts",
    "farmhouse", "bohemian", "scandinavian",
  ];
  for (const s of styles) {
    if (q.includes(s)) {
      // Skip if this style is in the exclude list (negated)
      const styleNorm = s.replace(/\s+/g, "-");
      const styleWords = s.split(/[\s-]+/);
      if (filter.exclude_terms.some(ex => styleWords.includes(ex) || ex === styleNorm || ex === s)) continue;
      // Skip if preceded by negation phrase
      const negStyleRegex = new RegExp(`(?:not|no|without|doesn'?t\\s+feel|doesn'?t\\s+look|avoid|hate|hates|never|but\\s+not)\\s+(?:\\w+\\s+)*${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
      if (negStyleRegex.test(q)) continue;
      filter.style = styleNorm;
      break;
    }
  }

  // ── Color detection (skip negated colors) ──
  const colors = ["white", "black", "gray", "grey", "brown", "beige", "cream", "ivory", "navy", "blue", "green", "red", "gold", "silver", "tan", "taupe", "charcoal", "espresso", "natural", "cognac"];
  for (const c of colors) {
    if (q.includes(c)) {
      // Skip if this color is in the exclude list (negated)
      if (filter.exclude_terms.includes(c)) continue;
      // Skip if preceded by negation
      const negColorRegex = new RegExp(`(?:not|no|without|hates?|avoid|never|don'?t\\s+(?:want|like))\\s+(?:\\w+\\s+)*${c}`, "i");
      if (negColorRegex.test(q)) continue;
      filter.color = c;
      break;
    }
  }

  // ── AI feature detection (nailhead, tufted, channel, barrel, etc.) ──
  const featurePatterns = [
    "nailhead", "nailhead trim", "nail head",
    "tufted", "button tufted", "diamond tufted", "channel tufted", "biscuit tufted",
    "skirted", "pleated skirt",
    "slipcovered", "slipcover",
    "wingback", "wing back",
    "pillow back", "pillow top",
    "bench seat", "bench cushion",
    "turned legs", "cabriole legs", "tapered legs", "splayed legs",
    "casters", "swivel",
    "reclining", "recliner", "power recliner",
    "storage", "drawers",
    "adjustable", "modular",
    "reversible cushions",
    "welt", "welted", "contrast welt",
    "carved", "hand carved",
  ];
  filter.ai_features = [];
  for (const feat of featurePatterns) {
    if (q.includes(feat)) {
      filter.ai_features.push(feat);
    }
  }

  // ── AI arm style detection ──
  const armStyles = [
    "track arm", "track arms",
    "rolled arm", "rolled arms", "roll arm",
    "slope arm", "sloped arm",
    "shelter arm",
    "english arm",
    "flared arm",
    "pad arm",
    "no arms", "armless",
    "scroll arm",
  ];
  filter.ai_arm_style = null;
  for (const arm of armStyles) {
    if (q.includes(arm)) {
      filter.ai_arm_style = arm.replace(/s$/, ""); // normalize plural
      break;
    }
  }

  // ── AI back style detection ──
  const backStyles = [
    "tight back", "tight-back",
    "loose back", "loose pillow back",
    "channel back", "channel-back", "channel tufted",
    "button back",
    "camelback", "camel back",
    "pillow back",
    "tufted back",
    "ladder back",
    "slat back",
    "cane back",
  ];
  filter.ai_back_style = null;
  for (const back of backStyles) {
    if (q.includes(back)) {
      filter.ai_back_style = back;
      break;
    }
  }

  // ── AI silhouette detection ──
  const silhouettes = [
    "barrel", "barrel back",
    "lawson",
    "chesterfield",
    "tuxedo",
    "bridgewater",
    "english roll",
    "cabriole",
    "klismos",
    "parsons",
    "wishbone",
    "windsor",
    "slipper",
  ];
  filter.ai_silhouette = null;
  for (const sil of silhouettes) {
    if (q.includes(sil)) {
      filter.ai_silhouette = sil;
      break;
    }
  }

  // ── Cushion config detection (trade terms like "3 over 3", "2 over 2") ──
  const cushionMatch = q.match(/\b(\d)\s+over\s+(\d)\b/i);
  if (cushionMatch) {
    const phrase = cushionMatch[0]; // e.g. "3 over 3"
    filter.keywords.push(phrase);
    filter.keywords.push("loose cushion", "loose back");
    // Nullify any dimensions/price extracted from the cushion config number
    filter.dimensions = null;
    filter.price_min = null;
    filter.price_max = null;
  }

  // ── Build keywords ──
  // Remove stop words, vendor names, dimension/price fragments
  const stopWords = new Set(["the", "a", "an", "and", "or", "for", "in", "on", "to", "of", "my", "me", "i", "is", "it", "with", "that", "this", "from", "its", "something", "put", "behind", "want", "looking", "need", "find", "show", "get"]);
  let cleanQ = q;
  // Remove vendor names from keywords
  if (filter.vendor || filter.vendors?.length) {
    for (const v of LOCAL_VENDORS) {
      for (const name of v.names) {
        cleanQ = cleanQ.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "");
      }
    }
  }
  // Remove exclude phrases
  cleanQ = cleanQ.replace(/\b(no|not|without|exclude)\s+\w+/gi, "");
  // Remove dimension phrases
  cleanQ = cleanQ.replace(/(?:under|over|less than|more than|at least|up to)\s+\d+\s*(?:inches?|in|"|'')?(?:\s*(?:wide|deep|tall))?/gi, "");
  cleanQ = cleanQ.replace(/seats?\s+\d+/gi, "");

  const words = cleanQ.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  // Merge with any keywords already added (e.g. cushion config phrases)
  const existingKw = filter.keywords || [];
  filter.keywords = [...new Set([...existingKw, ...words])];

  // Add category-related keywords
  if (filter.category) {
    const catWords = filter.category.replace(/-/g, " ").split(" ");
    for (const w of catWords) {
      if (!filter.keywords.includes(w)) filter.keywords.push(w);
    }
    // Add synonyms for the category
    const catSyns = getSynonyms(filter.category.replace(/-/g, " "));
    for (const syn of catSyns.slice(0, 3)) {
      for (const w of syn.split(/\s+/)) {
        if (w.length > 2 && !filter.keywords.includes(w)) filter.keywords.push(w);
      }
    }
  }

  // Add collection keyword
  if (filter.collection) {
    for (const w of filter.collection.toLowerCase().split(/\s+/)) {
      if (w.length > 2 && !filter.keywords.includes(w)) filter.keywords.push(w);
    }
  }

  // Return filter if we have keywords OR a vendor/vendors/category/collection detected
  if (filter.keywords.length > 0 || filter.vendor || filter.vendors?.length || filter.category || filter.categories?.length || filter.collection) {
    // If vendor-only query with no keywords, add vendor name as keyword for search
    if (filter.keywords.length === 0 && (filter.vendor || filter.vendors?.length)) {
      const vendorNames = filter.vendors?.length > 0 ? filter.vendors : [filter.vendor];
      for (const vn of vendorNames) {
        for (const w of vn.toLowerCase().split(/\s+/)) {
          if (w.length > 2 && !["furniture", "home", "brands"].includes(w)) {
            filter.keywords.push(w);
          }
        }
      }
    }
    sanitizeNumericValues(filter, query);
    return filter;
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════
// LAYER 1: SYNONYM INTELLIGENCE — comprehensive synonym maps
// ══════════════════════════════════════════════════════════════════════

const FURNITURE_TYPE_SYNONYMS = {
  "coffee table": ["coffee table", "cocktail table", "center table"],
  "cocktail table": ["coffee table", "cocktail table", "center table"],
  "couch": ["sofa", "couch"],
  "sofa": ["sofa", "couch"],
  "credenza": ["credenza", "sideboard", "buffet", "server"],
  "sideboard": ["credenza", "sideboard", "buffet", "server"],
  "buffet": ["credenza", "sideboard", "buffet", "server"],
  "etagere": ["etagere", "bookcase", "bookshelf", "shelving"],
  "bookcase": ["bookcase", "bookshelf", "etagere", "shelving"],
  "bookshelf": ["bookcase", "bookshelf", "etagere"],
  "settee": ["settee", "loveseat"],
  "loveseat": ["loveseat", "settee"],
  "club chair": ["club chair", "accent chair", "lounge chair", "occasional chair"],
  "accent chair": ["accent chair", "club chair", "lounge chair", "occasional chair"],
  "lounge chair": ["lounge chair", "accent chair", "club chair", "occasional chair"],
  "ottoman": ["ottoman", "footstool", "pouf"],
  "footstool": ["ottoman", "footstool", "pouf"],
  "dresser": ["dresser", "chest of drawers", "bureau"],
  "bureau": ["dresser", "chest of drawers", "bureau"],
  "nightstand": ["nightstand", "night stand", "bedside table", "night table", "bedside chest"],
  "armoire": ["armoire", "wardrobe"],
  "wardrobe": ["armoire", "wardrobe"],
  "recliner": ["recliner", "lounger", "power recliner"],
  "lounger": ["recliner", "lounger"],
  "bar stool": ["bar stool", "barstool", "bar chair"],
  "barstool": ["bar stool", "barstool", "bar chair"],
  "counter stool": ["counter stool", "counter height stool"],
  "chaise": ["chaise", "chaise lounge", "chaise longue", "fainting couch"],
  "console table": ["console table", "sofa table", "entry table", "hall table"],
  "sofa table": ["console table", "sofa table", "entry table", "hall table"],
  "side table": ["side table", "end table", "lamp table", "accent table"],
  "end table": ["end table", "side table", "lamp table", "accent table"],
  "hutch": ["hutch", "china cabinet", "display cabinet"],
  "china cabinet": ["hutch", "china cabinet", "display cabinet"],
  "secretary": ["secretary", "secretary desk"],
  "bench": ["bench", "bedroom bench", "dining bench"],
};

const MATERIAL_SYNONYMS = {
  "boucle": ["boucle", "bouclé", "nubby texture", "nubby"],
  "bouclé": ["boucle", "bouclé", "nubby texture", "nubby"],
  "performance fabric": ["performance fabric", "crypton", "sunbrella", "revolution", "stain resistant", "indoor outdoor"],
  "crypton": ["performance fabric", "crypton", "stain resistant"],
  "sunbrella": ["performance fabric", "sunbrella", "solution dyed", "outdoor fabric"],
  "leather": ["leather", "top grain leather", "full grain leather", "premium leather", "genuine leather"],
  "top grain leather": ["leather", "top grain leather", "full grain leather", "premium leather"],
  "full grain leather": ["leather", "top grain leather", "full grain leather", "premium leather"],
  "marble": ["marble", "stone", "calcutta", "carrara", "calacatta"],
  "stone": ["marble", "stone", "travertine", "limestone", "natural stone"],
  "walnut": ["walnut", "american walnut"],
  "oak": ["oak", "white oak", "red oak"],
  "brass": ["brass", "gold metal", "antique gold", "brushed gold"],
  "chrome": ["chrome", "polished metal", "nickel", "brushed nickel", "polished nickel"],
  "iron": ["iron", "wrought iron", "blackened iron", "dark metal"],
  "velvet": ["velvet", "crushed velvet"],
  "linen": ["linen", "flax", "belgian linen"],
  "rattan": ["rattan", "wicker", "woven"],
  "wicker": ["rattan", "wicker", "woven"],
  "travertine": ["travertine", "natural stone", "limestone"],
  "lacquer": ["lacquer", "lacquered", "high gloss"],
};

const STYLE_SYNONYMS = {
  "modern": ["modern", "contemporary"],
  "contemporary": ["modern", "contemporary"],
  "mid century": ["mid century", "mid-century", "midcentury", "mcm", "mid century modern"],
  "mid-century": ["mid century", "mid-century", "midcentury", "mcm", "mid century modern"],
  "midcentury": ["mid century", "mid-century", "midcentury", "mcm", "mid century modern"],
  "mcm": ["mid century", "mid-century", "midcentury", "mcm", "mid century modern"],
  "traditional": ["traditional", "classic", "timeless"],
  "classic": ["traditional", "classic", "timeless"],
  "transitional": ["transitional", "updated traditional", "classic contemporary"],
  "coastal": ["coastal", "beach", "resort", "nautical", "seaside"],
  "farmhouse": ["farmhouse", "rustic", "country", "cottage"],
  "rustic": ["farmhouse", "rustic", "country", "lodge", "cabin"],
  "country": ["farmhouse", "rustic", "country", "cottage"],
  "glam": ["glam", "glamour", "glamorous", "hollywood regency", "luxe", "luxury modern", "hollywood"],
  "hollywood regency": ["glam", "glamour", "hollywood regency", "luxe", "hollywood"],
  "organic modern": ["organic modern", "japandi", "scandinavian", "nordic"],
  "japandi": ["organic modern", "japandi", "scandinavian", "nordic"],
  "scandinavian": ["organic modern", "japandi", "scandinavian", "nordic"],
  "industrial": ["industrial", "loft", "urban"],
  "bohemian": ["bohemian", "boho", "eclectic"],
  "boho": ["bohemian", "boho", "eclectic"],
  "art deco": ["art deco", "deco"],
  "art-deco": ["art deco", "deco"],
  "french country": ["french country", "provence", "french provincial"],
  "campaign": ["campaign", "british colonial"],
  "chinoiserie": ["chinoiserie", "asian inspired"],
  "minimalist": ["minimalist", "modern", "contemporary"],
};

const FEATURE_SYNONYMS = {
  "nailhead": ["nailhead", "nailhead trim", "nail head", "tack trim", "brass tacks", "brass nailhead"],
  "tufted": ["tufted", "button tufted", "diamond tufted", "biscuit tufted"],
  "channel": ["channel", "channel tufted", "channel back", "channeled", "vertical channel"],
  "slipcovered": ["slipcovered", "slipcover", "removable cover", "washable cover"],
  "power": ["power", "power reclining", "electric", "motorized", "power motion"],
  "swivel": ["swivel", "rotating", "360", "swivel base"],
  "skirted": ["skirted", "kick pleat", "waterfall skirt"],
  "welt": ["welt", "welted", "piping", "cord trim"],
  "carved": ["carved", "hand carved", "carved detail"],
  "distressed": ["distressed", "weathered", "aged", "antiqued", "reclaimed"],
};

function expandSynonyms(term, synonymMap) {
  const lower = term.toLowerCase();
  return synonymMap[lower] || [lower];
}

// ══════════════════════════════════════════════════════════════════════
// LAYER 2: DIMENSIONAL SEARCH — implicit dimension parsing
// ══════════════════════════════════════════════════════════════════════

function parseImplicitDimensions(query, filter) {
  const q = query.toLowerCase();
  const dims = filter.dimensions || {};

  // Seating capacity → width
  const seatsMatch = q.match(/seats?\s+(\d+)/);
  if (seatsMatch) {
    const seats = parseInt(seatsMatch[1]);
    const inchPerSeat = 24;
    if (seats <= 4) { dims.width_min = seats * inchPerSeat - 12; dims.width_max = seats * inchPerSeat + 12; }
    else if (seats <= 6) { dims.width_min = 60; dims.width_max = 84; }
    else if (seats <= 8) { dims.width_min = 84; dims.width_max = 108; }
    else if (seats <= 10) { dims.width_min = 108; dims.width_max = 132; }
    else { dims.width_min = 132; }
  }

  // Implicit size keywords
  if (/\b(apartment\s*size|small\s*space|compact|petite)\b/.test(q)) {
    const cat = (filter.category || "").toLowerCase();
    if (cat.includes("sofa") || cat.includes("couch")) dims.width_max = 78;
    else if (cat.includes("sectional")) dims.width_max = 100;
    else if (cat.includes("table")) dims.width_max = 48;
  }
  if (/\b(oversized|extra\s*large|grand)\b/.test(q)) {
    const cat = (filter.category || "").toLowerCase();
    if (cat.includes("sectional")) dims.width_min = 120;
    else if (cat.includes("sofa")) dims.width_min = 96;
    else if (cat.includes("table")) dims.width_min = 84;
  }
  if (/\bnarrow\b/.test(q)) { dims.depth_max = 16; }
  if (/\b(low\s*profile)\b/.test(q)) { dims.height_max = 32; }
  if (/\btall\b/.test(q) && /bookcase|shelf|etagere|cabinet/.test(q)) { dims.height_min = 72; }

  // Stool heights
  if (/\bcounter\s*(height|stool)\b/.test(q)) { dims.seat_height_min = 24; dims.seat_height_max = 26; }
  if (/\bbar\s*(height|stool)\b/.test(q)) { dims.seat_height_min = 28; dims.seat_height_max = 32; }

  // Bed sizes
  if (/\bking\s*bed\b/.test(q) && !/\bcal(ifornia)?\b/.test(q)) { filter._bed_size = "king"; }
  if (/\bqueen\s*bed\b/.test(q)) { filter._bed_size = "queen"; }
  if (/\bcal(ifornia)?\s*king\b/.test(q)) { filter._bed_size = "california king"; }

  // Explicit "fits through X inch door"
  const doorMatch = q.match(/fit.*?(\d+)\s*(?:inch|in|")\s*door/);
  if (doorMatch) { dims.depth_max = parseInt(doorMatch[1]) - 1; }

  if (Object.keys(dims).length > 0) filter.dimensions = dims;
}

// ══════════════════════════════════════════════════════════════════════
// LAYER 3: CROSS-FIELD INTELLIGENCE — abstract concept scoring
// ══════════════════════════════════════════════════════════════════════

const PREMIUM_VENDORS = new Set(["baker", "theodore-alexander", "hickory-chair", "century", "hancock-moore", "maitland-smith"]);
const VALUE_VENDORS = new Set(["hooker", "universal", "rowe", "surya"]);

const CROSS_FIELD_CONCEPTS = {
  comfortable: {
    triggers: ["comfortable", "comfy", "cozy", "cushy", "sink into"],
    checks: [
      (p) => /down|spring down|down wrapped/i.test(p.ai_distinctive_features?.join(" ") || ""),
      (p) => /loose pillow|pillow back/i.test(p.ai_back_style || ""),
      (p) => /casual|relaxed/i.test(p.ai_formality || ""),
      (p) => /cozy|inviting|relaxed|comfortable/i.test(p.ai_mood || ""),
      (p) => /large|oversized|deep|generous/i.test(p.ai_scale || ""),
    ],
    minMatch: 2,
    boost: 25,
  },
  kid_friendly: {
    triggers: ["kid friendly", "kid proof", "family friendly", "durable", "child friendly", "kids"],
    checks: [
      (p) => /performance|crypton|sunbrella|stain resistant|solution dyed/i.test(p.ai_primary_material || ""),
      (p) => /high traffic|durable|heavy use/i.test(p.ai_description || ""),
      (p) => /removable|slipcovered|washable/i.test(p.ai_distinctive_features?.join(" ") || ""),
    ],
    minMatch: 1,
    boost: 20,
  },
  pet_friendly: {
    triggers: ["pet friendly", "pet proof", "dog friendly", "cat friendly", "pets"],
    checks: [
      (p) => /performance|crypton|sunbrella|stain resistant|leather|solution dyed/i.test(p.ai_primary_material || ""),
      (p) => /smooth|flat|tight weave/i.test(p.ai_description || ""),
      (p) => /removable|slipcovered|washable/i.test(p.ai_distinctive_features?.join(" ") || ""),
      (p) => /leather/i.test(p.ai_primary_material || ""),
    ],
    minMatch: 1,
    boost: 20,
  },
  luxury: {
    triggers: ["high end", "luxury", "premium", "top tier", "the good stuff", "finest"],
    checks: [
      (p) => PREMIUM_VENDORS.has(p.vendor_id || ""),
      (p) => /eight.way|hand tied|hand.?crafted|bench.?made/i.test(p.ai_description || ""),
      (p) => /luxury|opulent|refined|sophisticated|quiet luxury/i.test(p.ai_mood || ""),
      (p) => /formal|semi.formal/i.test(p.ai_formality || ""),
    ],
    minMatch: 2,
    boost: 20,
  },
  budget: {
    triggers: ["affordable", "budget friendly", "value", "inexpensive", "budget"],
    checks: [
      (p) => VALUE_VENDORS.has(p.vendor_id || ""),
      (p) => !/luxury|opulent|premium/i.test(p.ai_mood || ""),
    ],
    minMatch: 1,
    boost: 15,
  },
  statement: {
    triggers: ["statement piece", "show stopper", "wow factor", "conversation starter", "statement"],
    checks: [
      (p) => /large|oversized|grand|dramatic/i.test(p.ai_scale || ""),
      (p) => /dramatic|opulent|bold|striking|showstopper/i.test(p.ai_mood || ""),
      (p) => /glam|hollywood|art deco|luxury/i.test(p.ai_style || ""),
      (p) => /emerald|navy|burgundy|mustard|teal|ruby|sapphire/i.test(p.ai_primary_color || ""),
    ],
    minMatch: 2,
    boost: 20,
  },
  casual: {
    triggers: ["laid back", "casual", "relaxed", "lived in", "not too formal", "easy going", "easygoing"],
    checks: [
      (p) => /casual|relaxed|informal/i.test(p.ai_formality || ""),
      (p) => /cozy|relaxed|inviting|laid.back|easy|comfortable/i.test(p.ai_mood || ""),
      (p) => /coastal|farmhouse|bohemian|organic modern|boho/i.test(p.ai_style || ""),
    ],
    minMatch: 2,
    boost: 20,
  },
  formal: {
    triggers: ["dressy", "formal", "elegant", "sophisticated"],
    checks: [
      (p) => /formal|semi.formal/i.test(p.ai_formality || ""),
      (p) => /sophisticated|refined|elegant|polished/i.test(p.ai_mood || ""),
      (p) => /traditional|glam|luxury modern|hollywood/i.test(p.ai_style || ""),
    ],
    minMatch: 2,
    boost: 20,
  },
  trending: {
    triggers: ["trendy", "on trend", "instagram", "pinterest", "trending"],
    checks: [
      (p) => /boucle|bouclé|travertine|rattan|performance/i.test(p.ai_primary_material || ""),
      (p) => /organic modern|japandi|quiet luxury/i.test(p.ai_style || ""),
      (p) => /barrel|curved/i.test(p.ai_silhouette || ""),
      (p) => /sage|terracotta|cream|oatmeal|mushroom/i.test(p.ai_primary_color || ""),
    ],
    minMatch: 2,
    boost: 20,
  },
  // Designer slang
  clean_lines: {
    triggers: ["clean lines", "clean-lined", "sleek"],
    checks: [
      (p) => /modern|contemporary|minimalist/i.test(p.ai_style || ""),
      (p) => /track|parsons|tuxedo|straight/i.test(p.ai_silhouette || "") || /track/i.test(p.ai_arm_style || ""),
    ],
    minMatch: 2,
    boost: 20,
  },
  california_casual: {
    triggers: ["california casual", "cali casual"],
    checks: [
      (p) => /coastal|organic modern|relaxed/i.test(p.ai_style || ""),
      (p) => /casual|relaxed|informal/i.test(p.ai_formality || ""),
      (p) => /linen|rattan|natural|light wood/i.test(p.ai_primary_material || ""),
    ],
    minMatch: 2,
    boost: 25,
  },
  quiet_luxury: {
    triggers: ["quiet luxury"],
    checks: [
      (p) => /quiet luxury|refined|understated/i.test(p.ai_mood || ""),
      (p) => /semi.formal|formal/i.test(p.ai_formality || ""),
      (p) => PREMIUM_VENDORS.has(p.vendor_id || ""),
    ],
    minMatch: 2,
    boost: 25,
  },
  grandmillennial: {
    triggers: ["grandmillennial", "grand millennial"],
    checks: [
      (p) => /traditional/i.test(p.ai_style || ""),
      (p) => /tufted|skirted|fringe|tassel|chintz|floral/i.test(p.ai_distinctive_features?.join(" ") || ""),
    ],
    minMatch: 2,
    boost: 25,
  },
  warmth: {
    triggers: ["warmth", "warm", "wants warmth", "warm tones", "warm feeling"],
    checks: [
      (p) => /warm|inviting|cozy|welcoming/i.test(p.ai_mood || ""),
      (p) => /cognac|amber|honey|gold|terracotta|rust|cream|camel|caramel|copper|blush|sand|oatmeal|warm/i.test(p.ai_primary_color || ""),
      (p) => /wood|walnut|oak|leather|linen|wool|boucle/i.test(p.ai_primary_material || ""),
    ],
    minMatch: 2,
    boost: 20,
  },
  magazine_worthy: {
    triggers: ["magazine", "photographs well", "editorial", "showroom", "instagram worthy"],
    checks: [
      (p) => /formal|semi.formal/i.test(p.ai_formality || ""),
      (p) => /refined|sophisticated|elegant|dramatic|sculptural|striking/i.test(p.ai_mood || ""),
      (p) => /large|oversized|grand|statement/i.test(p.ai_scale || ""),
      (p) => PREMIUM_VENDORS.has(p.vendor_id || ""),
    ],
    minMatch: 2,
    boost: 20,
  },
  mountain_modern: {
    triggers: ["mountain house", "mountain home", "ski lodge", "cabin modern", "lodge but modern"],
    checks: [
      (p) => /transitional|organic modern|contemporary|modern/i.test(p.ai_style || ""),
      (p) => /wood|leather|stone|iron/i.test(p.ai_primary_material || ""),
      (p) => /warm|cozy|inviting/i.test(p.ai_mood || ""),
      (p) => !/rustic|farmhouse|country|cabin/i.test(p.ai_style || ""),
    ],
    minMatch: 3,
    boost: 25,
  },
  transitional_crossover: {
    triggers: ["both modern and traditional", "modern and traditional", "works in both"],
    checks: [
      (p) => /transitional|updated traditional|classic contemporary/i.test(p.ai_style || ""),
      (p) => /semi.formal/i.test(p.ai_formality || ""),
    ],
    minMatch: 2,
    boost: 25,
  },
  cloud_sofa: {
    triggers: ["cloud sofa", "cloud couch", "like the rh cloud", "like rh cloud"],
    checks: [
      (p) => /deep|oversized|generous|large/i.test(p.ai_scale || ""),
      (p) => /down|feather|plush|sink/i.test(p.ai_distinctive_features?.join(" ") || ""),
      (p) => /cozy|comfortable|relaxed|inviting/i.test(p.ai_mood || ""),
      (p) => /loose pillow|pillow back/i.test(p.ai_back_style || ""),
    ],
    minMatch: 2,
    boost: 25,
  },
  doesnt_look_like: {
    triggers: ["doesn't look like a recliner", "doesnt look like a recliner", "doesn't look like recliner"],
    checks: [
      (p) => /modern|contemporary|transitional/i.test(p.ai_style || ""),
      (p) => /refined|sophisticated|sleek/i.test(p.ai_mood || ""),
      (p) => !/bulky|oversized|traditional recliner/i.test(p.ai_mood || ""),
    ],
    minMatch: 2,
    boost: 25,
  },
};

function detectCrossFieldConcepts(query) {
  const q = query.toLowerCase();
  const matched = [];
  for (const [name, concept] of Object.entries(CROSS_FIELD_CONCEPTS)) {
    if (concept.triggers.some(t => q.includes(t))) {
      matched.push(name);
    }
  }
  return matched;
}

function scoreCrossFieldConcepts(product, concepts) {
  let totalBoost = 0;
  for (const conceptName of concepts) {
    const concept = CROSS_FIELD_CONCEPTS[conceptName];
    if (!concept) continue;
    const hits = concept.checks.filter(check => check(product)).length;
    if (hits >= concept.minMatch) {
      totalBoost += concept.boost;
    }
  }
  return totalBoost;
}

// ══════════════════════════════════════════════════════════════════════

/**
 * Strict AI field matching — checks if a product's ai_* field contains a search term.
 * Uses substring matching with word boundaries for precision.
 */
function aiFieldContains(fieldValue, searchTerm) {
  if (!fieldValue || !searchTerm) return false;
  const fv = fieldValue.toLowerCase();
  const st = searchTerm.toLowerCase();
  return fv.includes(st);
}

function aiArrayContains(arr, searchTerm) {
  if (!arr || !Array.isArray(arr) || !searchTerm) return false;
  const st = searchTerm.toLowerCase();
  return arr.some(item => {
    const lower = item.toLowerCase();
    if (!lower.includes(st)) return false;
    const idx = lower.indexOf(st);

    // Reject negated matches — check text BEFORE the term
    if (idx > 0) {
      const before = lower.substring(Math.max(0, idx - 12), idx);
      if (/\bno[- ]?$/.test(before) || /\bnon[- ]?$/.test(before) || /\bwithout\s?$/.test(before) || /\bno\s+visible\s?$/.test(before) || /\bno\s$/.test(before)) return false;
    }

    // Reject contextual false positives — term followed by "alternative", "free", "less"
    const after = lower.substring(idx + st.length, idx + st.length + 15);
    if (/^\s*(alternative|free|less|optional)\b/.test(after)) return false;

    return true;
  });
}

/**
 * STRICT AI FILTER — Every query component becomes a hard filter on the matching ai_* field.
 * Returns { strict: [...], relaxed: [...], relaxedMessage: string|null }
 * If strict returns 0, progressively relaxes one filter at a time.
 */
function strictAIFilter(products, filter) {
  // Build list of active AI filters from the parsed intent
  const aiFilters = [];

  // Category → ai_furniture_type (with synonym expansion)
  if (filter.category) {
    const catWord = filter.category.toLowerCase().replace(/-/g, " ").replace(/s$/, "");
    // Expand category synonyms via Layer 1 comprehensive map
    const expanded = expandSynonyms(catWord, FURNITURE_TYPE_SYNONYMS);
    aiFilters.push({
      name: "furniture type",
      field: "ai_furniture_type",
      term: catWord,
      test: (p) => expanded.some(c => aiFieldContains(p.ai_furniture_type, c)),
    });
  }

  // Material → ai_primary_material (with Layer 1 synonym expansion)
  if (filter.material) {
    const mat = filter.material.toLowerCase();
    // Merge material_expanded from AI/local parse with Layer 1 synonym map
    const matFromFilter = (filter.material_expanded || []).map(m => m.toLowerCase());
    const matFromSynonyms = expandSynonyms(mat, MATERIAL_SYNONYMS).map(m => m.toLowerCase());
    const matExpanded = [...new Set([mat, ...matFromFilter, ...matFromSynonyms])];
    aiFilters.push({
      name: "material",
      field: "ai_primary_material",
      term: mat,
      test: (p) => {
        if (!p.ai_primary_material) return false;
        const aiMat = p.ai_primary_material.toLowerCase();
        return matExpanded.some(m => aiMat.includes(m));
      },
    });
  }

  // Color → ai_primary_color
  if (filter.color) {
    const color = filter.color.toLowerCase();
    aiFilters.push({
      name: "color",
      field: "ai_primary_color",
      term: color,
      test: (p) => aiFieldContains(p.ai_primary_color, color),
    });
  }

  // Style → ai_style (with synonym expansion)
  if (filter.style) {
    const style = filter.style.toLowerCase().replace(/-/g, " ");
    // Expand style synonyms via Layer 1 comprehensive map
    const expanded = expandSynonyms(style, STYLE_SYNONYMS);
    aiFilters.push({
      name: "style",
      field: "ai_style",
      term: style,
      test: (p) => expanded.some(s => aiFieldContains(p.ai_style, s)),
    });
  }

  // Arm style → ai_arm_style
  if (filter.ai_arm_style) {
    const arm = filter.ai_arm_style.toLowerCase();
    const armKey = arm.replace(/\s*(arm|arms|style)\s*/g, "").trim();
    aiFilters.push({
      name: "arm style",
      field: "ai_arm_style",
      term: arm,
      test: (p) => aiFieldContains(p.ai_arm_style, arm) || aiFieldContains(p.ai_arm_style, armKey),
    });
  }

  // Back style → ai_back_style
  if (filter.ai_back_style) {
    const back = filter.ai_back_style.toLowerCase();
    // Extract key word for matching (e.g., "channel back" → match "channel" in ai_back_style)
    const backKey = back.replace(/\s*(back|style)\s*/g, "").trim();
    aiFilters.push({
      name: "back style",
      field: "ai_back_style",
      term: back,
      test: (p) => aiFieldContains(p.ai_back_style, back) || aiFieldContains(p.ai_back_style, backKey),
    });
  }

  // Silhouette → ai_silhouette
  if (filter.ai_silhouette) {
    const sil = filter.ai_silhouette.toLowerCase();
    aiFilters.push({
      name: "silhouette",
      field: "ai_silhouette",
      term: sil,
      test: (p) => aiFieldContains(p.ai_silhouette, sil),
    });
  }

  // Features → VERIFIED ai_distinctive_features only (hard filter)
  // ai_unverified_features are used for soft scoring only, NOT hard filtering.
  // ai_search_terms alone is NOT enough — the tagger puts false positives there.
  if (filter.ai_features?.length > 0) {
    for (const feat of filter.ai_features) {
      const f = feat.toLowerCase();
      const featExpanded = expandSynonyms(f, FEATURE_SYNONYMS);
      aiFilters.push({
        name: `feature "${feat}"`,
        field: "ai_distinctive_features",
        term: f,
        test: (p) => {
          // ONLY check verified ai_distinctive_features — hard gate
          return featExpanded.some(fe => aiArrayContains(p.ai_distinctive_features, fe));
        },
      });
    }
  }

  if (aiFilters.length === 0) return null; // No AI filters to apply

  // Only filter products that have AI tags — keep untagged out of strict results
  const taggedProducts = products.filter(p => p.ai_visual_analysis);
  const untaggedProducts = products.filter(p => !p.ai_visual_analysis);

  // Apply ALL filters strictly (intersection)
  let strict = taggedProducts.filter(p => aiFilters.every(f => f.test(p)));

  if (strict.length > 0) {
    return { strict, relaxed: null, relaxedMessage: null };
  }

  // Progressive relaxation — drop one filter at a time, least important first
  // Try dropping filters from the end (features, then style, then color, etc.)
  for (let drop = aiFilters.length - 1; drop >= 0; drop--) {
    const remaining = aiFilters.filter((_, i) => i !== drop);
    if (remaining.length === 0) continue;
    const relaxed = taggedProducts.filter(p => remaining.every(f => f.test(p)));
    if (relaxed.length > 0) {
      const droppedName = aiFilters[drop].name;
      const keptNames = remaining.map(f => f.term).join(", ");
      return {
        strict: relaxed,
        relaxed: null,
        relaxedMessage: `No exact matches for all criteria. Showing results matching ${keptNames} (relaxed: ${droppedName}).`,
      };
    }
  }

  // If still nothing, try with just the first filter (usually furniture type)
  const typeOnly = taggedProducts.filter(p => aiFilters[0].test(p));
  if (typeOnly.length > 0) {
    return {
      strict: typeOnly,
      relaxed: null,
      relaxedMessage: `No exact matches. Showing all ${aiFilters[0].term} products.`,
    };
  }

  return null; // No AI-filtered results possible
}

/**
 * Apply AI-generated filter to search results from the catalog.
 * Enhanced with strict AI field filtering, dimension filtering, material expansion,
 * collection matching, exclude terms, and quality boosting.
 */
export function applyAIFilter(products, filter) {
  if (!filter || !products?.length) return products;

  let results = [...products];

  // ══════════════════════════════════════════════════════════════
  // STRICT AI FILTER — use ai_* fields as hard filters
  // Every query component (type, material, color, style, features,
  // arm style, back style, silhouette) must match the product's
  // AI-tagged data. This is the INTERSECTION of all filters.
  // ══════════════════════════════════════════════════════════════
  const strictResult = strictAIFilter(results, filter);
  if (strictResult) {
    results = strictResult.strict;
    if (strictResult.relaxedMessage) {
      // Store message on first product for the UI to display
      if (results.length > 0) {
        results[0]._relaxed_message = strictResult.relaxedMessage;
      }
    }
  }

  // ── HARD FILTER: Category (fallback for untagged products) ──
  // Only apply legacy category filter if strict AI filter didn't run
  if (!strictResult && filter.category) {
    const fc = filter.category.toLowerCase().replace(/\s+/g, "-");
    const catWord = fc.replace(/-/g, " ");
    const catSingular = catWord.replace(/s$/, "");
    const catFiltered = results.filter(p => {
      const cat = (p.category || "").toLowerCase();
      const name = (p.product_name || "").toLowerCase();
      // Exact category match or singular/plural
      const catMatch = cat === fc || cat === fc + "s" || cat + "s" === fc || cat.startsWith(fc + "-") || fc.startsWith(cat + "-");
      // Name-based fallback
      const nameMatch = name.includes(catSingular) || name.includes(catWord);
      if (!catMatch && !nameMatch) return false;
      // Cross-check: reject products whose name clearly indicates a DIFFERENT product type
      // e.g., "Sofa with Hidden Console" should NOT appear in console-tables results
      if (nameContainsConflictingType(name, fc)) return false;
      return true;
    });
    if (catFiltered.length > 0) results = catFiltered;
  } else if (filter.categories?.length > 0) {
    const catNorms = filter.categories.map(c => c.toLowerCase().replace(/\s+/g, "-"));
    const catFiltered = results.filter(p => {
      const cat = (p.category || "").toLowerCase();
      const name = (p.product_name || "").toLowerCase();
      const catMatch = catNorms.some(fc => cat === fc || cat === fc + "s" || cat + "s" === fc);
      if (catMatch) {
        // Cross-check: reject products with conflicting type in name
        if (catNorms.every(fc => nameContainsConflictingType(name, fc))) return false;
        return true;
      }
      // Name-based fallback
      for (const fc of catNorms) {
        const catWord = fc.replace(/-/g, " ");
        const catSingular = catWord.replace(/s$/, "");
        if (name.includes(catSingular) || name.includes(catWord)) return true;
      }
      return false;
    });
    if (catFiltered.length > 0) results = catFiltered;
  }

  // ── HARD FILTER: Exclude categories ──
  if (filter.exclude_categories?.length > 0) {
    const excludeSet = new Set(filter.exclude_categories.map(c => c.toLowerCase()));
    results = results.filter(p => {
      const cat = (p.category || "").toLowerCase();
      return !excludeSet.has(cat);
    });
  }

  // ── HARD FILTER: Exclude terms (no sectionals, without leather, hates brown, etc.) ──
  if (filter.exclude_terms?.length > 0) {
    // Expand exclude terms to include singular/plural variants
    const expandedExclude = [];
    for (const term of filter.exclude_terms) {
      const t = term.toLowerCase();
      expandedExclude.push(t);
      if (t.endsWith("s")) expandedExclude.push(t.slice(0, -1));
      else expandedExclude.push(t + "s");
    }
    const uniqueExclude = [...new Set(expandedExclude)];

    // Check which exclude terms are styles, colors, or materials for AI field filtering
    const allStyles = ["modern", "traditional", "transitional", "coastal", "glam", "contemporary", "minimalist", "industrial", "rustic", "farmhouse", "bohemian", "scandinavian", "mid-century", "midcentury", "art-deco", "mission", "craftsman"];
    const allColors = ["white", "black", "gray", "grey", "brown", "beige", "cream", "ivory", "navy", "blue", "green", "red", "gold", "silver", "tan", "taupe", "charcoal", "espresso", "cognac"];
    const allMaterials = ["leather", "velvet", "boucle", "linen", "wood", "marble", "brass", "iron", "rattan", "glass", "stone", "veneer", "mdf", "laminate"];

    const excludeStyles = uniqueExclude.filter(t => allStyles.includes(t));
    const excludeColors = uniqueExclude.filter(t => allColors.includes(t));
    const excludeMaterials = uniqueExclude.filter(t => allMaterials.includes(t));

    results = results.filter(p => {
      // Check traditional text fields
      const text = `${p.product_name || ""} ${p.category || ""} ${p.material || ""} ${p.description || ""} ${(p.tags || []).join(" ")}`.toLowerCase();
      if (uniqueExclude.some(term => text.includes(term))) return false;

      // Check AI style field
      if (excludeStyles.length > 0 && p.ai_style) {
        const aiStyle = p.ai_style.toLowerCase();
        if (excludeStyles.some(s => aiStyle.includes(s))) return false;
      }
      // Check AI color field
      if (excludeColors.length > 0 && p.ai_primary_color) {
        const aiColor = p.ai_primary_color.toLowerCase();
        if (excludeColors.some(c => aiColor.includes(c))) return false;
      }
      // Check AI material field
      if (excludeMaterials.length > 0 && p.ai_primary_material) {
        const aiMat = p.ai_primary_material.toLowerCase();
        if (excludeMaterials.some(m => aiMat.includes(m))) return false;
      }
      return true;
    });
  }

  // ── HARD FILTER: Vendor (single or multi) ──
  const vendorList = filter.vendors?.length > 0
    ? filter.vendors
    : filter.vendor ? [filter.vendor] : [];
  const vendorIdList = filter.vendor_ids || [];

  if (vendorList.length > 0 || vendorIdList.length > 0) {
    const vendorMatchers = vendorList.map(v => {
      const vLower = v.toLowerCase();
      const vNorm = vLower.replace(/[&]/g, "").replace(/\s+/g, " ").trim();
      const vSlug = vNorm.replace(/\s+/g, "-");
      return { lower: vLower, norm: vNorm, slug: vSlug };
    });
    const idSet = new Set(vendorIdList.map(id => id.toLowerCase()));
    const vendorResults = results.filter(p => {
      const pName = (p.vendor_name || "").toLowerCase();
      const pId = (p.vendor_id || "").toLowerCase();
      // Fast path: match by vendor_id directly
      if (idSet.size > 0 && idSet.has(pId)) return true;
      // Fallback: fuzzy name matching
      return vendorMatchers.some(vm =>
        pName.includes(vm.lower) ||
        pName.replace(/[&]/g, "").includes(vm.norm) ||
        pId.includes(vm.slug) ||
        pId.includes(vm.lower.replace(/\s+/g, "-"))
      );
    });
    if (vendorResults.length > 0) results = vendorResults;
  }

  // ── HARD FILTER: Dimensions ──
  if (filter.dimensions) {
    const d = filter.dimensions;
    const dimFiltered = results.filter(p => {
      // Parse product width from various fields
      const w = parseFloat(p.width) || parseFloat(p.dimensions_width) || parseDimFromString(p.dimensions, 'w');
      const dep = parseFloat(p.depth) || parseFloat(p.dimensions_depth) || parseDimFromString(p.dimensions, 'd');
      const h = parseFloat(p.height) || parseFloat(p.dimensions_height) || parseDimFromString(p.dimensions, 'h');

      // If product has no dimensions, keep it (don't penalize missing data)
      if (!w && !dep && !h) return true;

      if (d.width_max && w && w > d.width_max) return false;
      if (d.width_min && w && w < d.width_min) return false;
      if (d.depth_max && dep && dep > d.depth_max) return false;
      if (d.depth_min && dep && dep < d.depth_min) return false;
      if (d.height_max && h && h > d.height_max) return false;
      if (d.height_min && h && h < d.height_min) return false;
      return true;
    });
    // Only apply if keeps some results
    if (dimFiltered.length > 0) results = dimFiltered;
  }

  // ── SOFT FILTER: Material (expanded hierarchy) ──
  // Only apply as hard filter if it keeps enough results; otherwise use for scoring only
  if (filter.material) {
    const matTerms = filter.material_expanded?.length > 0
      ? filter.material_expanded.map(m => m.toLowerCase())
      : [filter.material.toLowerCase()];

    const matResults = results.filter(p => {
      const text = `${p.material || ""} ${p.description || ""} ${p.product_name || ""} ${(p.tags || []).join(" ")} ${p.ai_visual_tags || ""}`.toLowerCase();
      return matTerms.some(m => text.includes(m));
    });
    // Only hard filter if it keeps at least 10 results — otherwise just boost in scoring
    if (matResults.length >= 10) {
      results = matResults;
    } else if (matResults.length >= 1) {
      // Put material matches first, then the rest
      const matSet = new Set(matResults.map(p => p.id));
      const rest = results.filter(p => !matSet.has(p.id));
      results = [...matResults, ...rest];
    }
  }

  // ── SCORING: Enhanced keyword relevance ──
  let keywords = (filter.keywords || []).map(k => k.toLowerCase());

  // ── VIBE EXPANSION: Map abstract vibe phrases to concrete search terms ──
  const queryLower = (filter._original_query || keywords.join(" ")).toLowerCase();
  const vibeExpansions = expandVibeKeywords(queryLower);
  if (vibeExpansions.length > 0) {
    keywords = [...keywords, ...vibeExpansions];
  }

  const filterCategory = (filter.category || "").toLowerCase().replace(/\s+/g, "-");
  const filterCategories = (filter.categories || []).map(c => c.toLowerCase().replace(/\s+/g, "-"));
  const allFilterCats = filterCategory ? [filterCategory, ...filterCategories] : filterCategories;

  for (const p of results) {
    const name = (p.product_name || "").toLowerCase();
    const desc = (p.description || "").toLowerCase();
    const collection = (p.collection || "").toLowerCase();
    const material = (p.material || "").toLowerCase();
    const visualTags = (p.ai_visual_tags || "").toLowerCase();
    const productCat = (p.category || "").toLowerCase();
    const searchable = `${name} ${desc} ${collection} ${material} ${visualTags}`;

    // AI fields for scoring
    const aiSearchTerms = (p.ai_search_terms || []).map(t => t.toLowerCase());
    const aiFeatures = (p.ai_distinctive_features || []).map(t => t.toLowerCase());
    const aiUnverifiedFeatures = (p.ai_unverified_features || []).map(t => t.toLowerCase());
    const aiType = (p.ai_furniture_type || "").toLowerCase();
    const aiSilhouette = (p.ai_silhouette || "").toLowerCase();
    const aiArmStyle = (p.ai_arm_style || "").toLowerCase();
    const aiBackStyle = (p.ai_back_style || "").toLowerCase();
    const aiLegStyle = (p.ai_leg_style || "").toLowerCase();
    const aiMood = (p.ai_mood || "").toLowerCase();
    const aiStyle = (p.ai_style || "").toLowerCase();
    const aiFormality = (p.ai_formality || "").toLowerCase();
    const aiScale = (p.ai_scale || "").toLowerCase();
    const aiMaterial = (p.ai_primary_material || "").toLowerCase();
    const aiColor = (p.ai_primary_color || "").toLowerCase();
    const aiDesc = (p.ai_description || "").toLowerCase();

    let score = 0;

    // ── EXACT CATEGORY MATCH: +30 ──
    if (allFilterCats.length > 0) {
      if (allFilterCats.some(fc => productCat === fc || productCat === fc + "s" || productCat + "s" === fc)) {
        score += 30;
      }
    }

    // ── AI SEARCH TERMS: +25 per hit (the goldmine) ──
    for (const kw of keywords) {
      let aiHit = false;
      // Check ai_search_terms first — strongest AI signal
      for (const term of aiSearchTerms) {
        if (term.includes(kw) || kw.includes(term)) { score += 25; aiHit = true; break; }
      }
      // Check ai_distinctive_features — nailhead, tufted, skirted, etc.
      if (!aiHit) {
        for (const feat of aiFeatures) {
          if (feat.includes(kw) || kw.includes(feat)) { score += 22; aiHit = true; break; }
        }
      }
      // Check ai_unverified_features — lower weight soft boost (not hard filter)
      if (!aiHit) {
        for (const feat of aiUnverifiedFeatures) {
          if (feat.includes(kw) || kw.includes(feat)) { score += 8; aiHit = true; break; }
        }
      }
      // Check ai silhouette/arm/back/leg styles
      if (!aiHit) {
        if (aiSilhouette.includes(kw) || aiArmStyle.includes(kw) || aiBackStyle.includes(kw) || aiLegStyle.includes(kw)) {
          score += 20; aiHit = true;
        }
      }
      // Check ai mood/style/formality
      if (!aiHit) {
        if (aiMood.includes(kw) || aiStyle.includes(kw) || aiFormality.includes(kw)) {
          score += 18; aiHit = true;
        }
      }
      // Check ai description
      if (!aiHit) {
        if (aiDesc.includes(kw)) { score += 12; aiHit = true; }
      }
      // Traditional field scoring (lower weight)
      if (!aiHit) {
        if (name.includes(kw)) score += 15;
        else if (visualTags.includes(kw)) score += 12;
        else if (collection.includes(kw)) score += 8;
        else if (desc.includes(kw)) score += 5;
        else if (searchable.includes(kw)) score += 2;
      }
    }

    // ── AI FURNITURE TYPE MATCH: +20 ──
    if (allFilterCats.length > 0) {
      for (const fc of allFilterCats) {
        const catWord = fc.replace(/-/g, " ").replace(/s$/, "");
        if (aiType.includes(catWord)) { score += 20; break; }
      }
    }

    // ── AI MATERIAL MATCH: +15 ──
    if (filter.material) {
      const matLower = filter.material.toLowerCase();
      if (aiMaterial.includes(matLower)) score += 15;
      else if (material.includes(matLower) || name.includes(matLower)) score += 8;
    }

    // ── AI COLOR MATCH: +12 ──
    if (filter.color) {
      const colorLower = filter.color.toLowerCase();
      if (aiColor.includes(colorLower)) score += 12;
      else if ((p.color || "").toLowerCase().includes(colorLower) || name.includes(colorLower)) score += 6;
    }

    // ── AI STYLE MATCH: +15 ──
    if (filter.style) {
      const styleLower = filter.style.toLowerCase();
      if (aiStyle.includes(styleLower) || aiMood.includes(styleLower)) score += 15;
      else if (name.includes(styleLower) || (p.style || "").toLowerCase().includes(styleLower)) score += 8;
    }

    // ── VENDOR MATCH: +40 when vendor is in query ──
    if (filter.vendor || filter.vendors?.length) {
      const vendorNames = filter.vendors?.length > 0 ? filter.vendors : [filter.vendor];
      const pVendor = (p.vendor_name || "").toLowerCase();
      if (vendorNames.some(v => pVendor.includes(v.toLowerCase()))) {
        score += 40;
      }
    }

    // Collection match bonus (#8)
    if (filter.collection) {
      const collLower = filter.collection.toLowerCase();
      if (collection.includes(collLower)) {
        score += 50;
      } else if (name.includes(collLower)) {
        score += 35;
      }
      const coreCats = ["sofas", "sectionals", "accent-chairs", "dining-tables", "dining-chairs", "beds", "credenzas", "coffee-tables", "desks", "dressers", "nightstands", "bookcases", "console-tables"];
      if (coreCats.includes(productCat)) {
        score += 15;
      }
    }

    // Material hierarchy match bonus (#6)
    if (filter.material_expanded?.length > 0) {
      const matText = `${material} ${aiMaterial} ${desc} ${name} ${visualTags}`;
      let matHits = 0;
      for (const m of filter.material_expanded) {
        if (matText.includes(m.toLowerCase())) matHits++;
      }
      score += matHits * 8;
    }

    // Dimension fit bonus (#3)
    if (filter.dimensions) {
      const w = parseFloat(p.width) || parseDimFromString(p.dimensions, 'w');
      if (w > 0) {
        score += 10;
        const d = filter.dimensions;
        if (d.width_max && w <= d.width_max) score += 15;
        if (d.width_min && w >= d.width_min) score += 15;
      }
    }

    // ── AI-tagged product bonus: products with AI analysis get a small boost ──
    if (p.ai_visual_analysis) score += 5;

    // Quality score factor
    const qs = p.quality_score || 0;
    if (qs > 70) score += 10;
    else if (qs > 50) score += 6;
    else if (qs > 30) score += 3;

    // Image presence boost
    if (p.image_url && p.image_url.length > 10) score += 5;
    if (p.image_quality === "verified-hq") score += 3;
    else if (p.image_quality === "broken" || p.image_quality === "missing") score -= 10;

    // Data richness boost
    if (p.dimensions) score += 3;
    if (p.material) score += 2;

    // ── LAYER 3: Cross-field concept scoring ──
    if (filter._cross_field_concepts?.length > 0) {
      score += scoreCrossFieldConcepts(p, filter._cross_field_concepts);
    }

    // ── ROOM CONTEXT: core furniture types rank above accessories ──
    if (filter._room_context) {
      const ROOM_CORE_FURNITURE = {
        "dining room": ["dining-tables", "dining-chairs", "credenzas", "cabinets"],
        "living room": ["sofas", "sectionals", "loveseats", "accent-chairs", "coffee-tables", "side-tables"],
        "bedroom": ["beds", "headboards", "nightstands", "dressers"],
        "office": ["desks", "accent-chairs", "swivel-chairs", "bookcases"],
        "study": ["desks", "accent-chairs", "swivel-chairs", "bookcases"],
        "entryway": ["console-tables", "mirrors", "benches"],
        "foyer": ["console-tables", "mirrors", "chandeliers"],
      };
      const coreCats = ROOM_CORE_FURNITURE[filter._room_context];
      if (coreCats && coreCats.some(cc => productCat === cc || productCat.includes(cc.replace(/-/g, "")) || cc.includes(productCat))) {
        score += 25; // Core furniture for this room
      }
    }

    p._ai_score = score;
  }

  // Sort by AI score descending
  results.sort((a, b) => (b._ai_score || 0) - (a._ai_score || 0));

  // ── Category diversity: when multiple categories requested, ensure each is represented ──
  if (filter.categories?.length > 1) {
    const catBuckets = new Map();
    for (const p of results) {
      const cat = (p.category || "").toLowerCase();
      if (!catBuckets.has(cat)) catBuckets.set(cat, []);
      catBuckets.get(cat).push(p);
    }
    const interleaved = [];
    const seen = new Set();
    let added = true;
    let round = 0;
    while (added && interleaved.length < results.length) {
      added = false;
      for (const cat of filter.categories) {
        const bucket = catBuckets.get(cat);
        if (bucket && round < bucket.length) {
          const p = bucket[round];
          if (!seen.has(p.id)) {
            interleaved.push(p);
            seen.add(p.id);
            added = true;
          }
        }
      }
      round++;
    }
    for (const p of results) {
      if (!seen.has(p.id)) {
        interleaved.push(p);
        seen.add(p.id);
      }
    }
    return interleaved;
  }

  return results;
}

/**
 * VIBE EXPANSION — Map abstract aesthetic phrases to concrete furniture attributes.
 * These phrases don't match product names directly, so we expand them into
 * searchable terms that DO appear in product descriptions and tags.
 */
const VIBE_MAP = {
  "quiet luxury": ["refined", "subtle", "natural", "muted", "understated", "elegant", "premium", "cashmere", "linen", "silk", "walnut", "oak", "brass"],
  "moody": ["dark", "rich", "deep", "dramatic", "charcoal", "ebony", "espresso", "noir", "black", "mahogany"],
  "moody dark": ["dark", "rich", "dramatic", "charcoal", "ebony", "espresso", "noir", "black", "mahogany", "smoked"],
  "light airy": ["light", "airy", "white", "cream", "ivory", "natural", "linen", "rattan", "wicker", "whitewash", "bleached"],
  "warm modern": ["warm", "modern", "texture", "natural", "wood", "boucle", "linen", "woven", "organic", "oak", "walnut"],
  "old money": ["traditional", "classic", "refined", "mahogany", "leather", "brass", "library", "tufted", "nailhead", "carved"],
  "california casual": ["casual", "relaxed", "natural", "linen", "wood", "woven", "organic", "coastal", "rattan", "light"],
  "lots of texture": ["textured", "boucle", "woven", "rattan", "linen", "chenille", "wool", "raffia", "jute", "carved"],
  "hotel lobby": ["commercial", "hospitality", "statement", "large scale", "durable", "premium", "upholstered"],
  "commercial grade": ["commercial", "hospitality", "contract", "durable", "performance"],
  "formal dining": ["formal", "traditional", "elegant", "upholstered", "carved", "mahogany"],
  "statement": ["bold", "sculptural", "dramatic", "unique", "accent", "showpiece"],
  "collected": ["eclectic", "vintage", "antique", "curated", "layered"],
  "cozy": ["comfortable", "plush", "soft", "upholstered", "deep seat", "cushion"],
};

function expandVibeKeywords(query) {
  const expansions = [];
  for (const [vibe, terms] of Object.entries(VIBE_MAP)) {
    if (query.includes(vibe)) {
      for (const term of terms) {
        if (!expansions.includes(term)) expansions.push(term);
      }
    }
  }
  return expansions;
}

/**
 * Cross-check: does a product name contain a product type that conflicts
 * with the target category? Catches miscategorized products.
 * e.g., "Power Sofa with Hidden Console" → conflicts with "console-tables"
 */
const CONFLICTING_TYPES = {
  "console-tables": ["sofa", "sectional", "recliner", "loveseat", "chair", "bed", "dresser", "desk"],
  "side-tables": ["sofa", "sectional", "recliner", "loveseat", "bed", "dresser", "desk"],
  "coffee-tables": ["sofa", "sectional", "recliner", "loveseat", "bed", "dresser", "desk"],
  "sofas": ["dining table", "coffee table", "console table", "nightstand", "dresser", "bookcase", "desk", "bed"],
  "accent-chairs": ["sofa", "sectional", "dining table", "coffee table", "bed", "dresser", "desk"],
  "dining-chairs": ["sofa", "sectional", "coffee table", "bed", "dresser", "desk", "bookcase"],
  "dining-tables": ["sofa", "sectional", "bed", "dresser", "bookcase", "desk"],
  "beds": ["sofa", "dining table", "coffee table", "desk", "bookcase"],
  "credenzas": ["sofa", "bed", "dining table", "desk", "bookcase", "display cabinet"],
  "bookcases": ["sofa", "bed", "dining table", "credenza", "dresser"],
  "nightstands": ["sofa", "dining table", "coffee table", "desk", "bed", "dresser"],
};

function nameContainsConflictingType(name, targetCategory) {
  const conflicts = CONFLICTING_TYPES[targetCategory];
  if (!conflicts) return false;
  for (const conflict of conflicts) {
    // Check as whole word to avoid false positives
    const regex = new RegExp(`\\b${conflict}s?\\b`, "i");
    if (regex.test(name)) return true;
  }
  return false;
}

/**
 * Parse a dimension value from a dimension string like "84\"W x 36\"D x 32\"H"
 */
function parseDimFromString(dimStr, which) {
  if (!dimStr) return 0;
  const s = dimStr.toLowerCase();
  let match;
  if (which === 'w') {
    match = s.match(/([\d.]+)\s*"?\s*w/);
  } else if (which === 'd') {
    match = s.match(/([\d.]+)\s*"?\s*d/);
  } else if (which === 'h') {
    match = s.match(/([\d.]+)\s*"?\s*h/);
  }
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Detect follow-up intent and build a merged filter from the previous context.
 * Handles: "now show me X", "just X", "only X", "switch to X", "also show X", "add X", "what about X"
 *
 * @param {string} followUp - The follow-up query text
 * @param {object} previousFilter - The AI filter from the previous search
 * @returns {object|null} - Merged filter or null if not a follow-up
 */
export function localParseFollowUp(followUp, previousFilter) {
  if (!followUp || !previousFilter) return null;
  const q = followUp.toLowerCase().trim();

  // ── Detect follow-up intent ──
  // RESET patterns: "now show me X", "now just X", "switch to X", "what about X"
  const resetPatterns = [
    /^now\s+(?:show\s+me\s+)?(?:just\s+|only\s+)?(.+)/i,
    /^(?:just|only)\s+(.+)/i,
    /^switch\s+to\s+(.+)/i,
    /^what\s+about\s+(.+)/i,
    /^show\s+me\s+(?:just\s+|only\s+)?(.+)/i,
  ];

  // ADD patterns: "also show X", "add X too", "and X", "include X"
  const addPatterns = [
    /^also\s+(?:show|add|include)\s+(.+)/i,
    /^add\s+(.+?)(?:\s+too)?$/i,
    /^include\s+(.+?)(?:\s+too|as well)?$/i,
  ];

  let intent = null; // "reset" | "add"
  let restOfQuery = q;

  // Check ADD patterns first (more specific)
  for (const pat of addPatterns) {
    const m = q.match(pat);
    if (m) {
      intent = "add";
      restOfQuery = m[1].trim();
      break;
    }
  }

  // Check RESET patterns
  if (!intent) {
    for (const pat of resetPatterns) {
      const m = q.match(pat);
      if (m) {
        intent = "reset";
        restOfQuery = m[1].trim();
        break;
      }
    }
  }

  // If no follow-up pattern detected, treat as a new search
  if (!intent) return null;

  // Parse the rest of the query for vendors/categories
  const newParse = localParse(restOfQuery);
  if (!newParse) return null;

  if (intent === "reset") {
    // REPLACE: use new parse but carry forward non-conflicting fields from previous
    // If the new parse has a vendor, that completely replaces the old vendor(s)
    // If the new parse has a category, use it; otherwise keep previous category context
    const merged = { ...newParse };
    if (!merged.category && !merged.categories?.length && previousFilter.category) {
      merged.category = previousFilter.category;
    }
    if (!merged.categories?.length && previousFilter.categories?.length && !merged.category) {
      merged.categories = previousFilter.categories;
    }
    // Carry forward vendor UNLESS the new parse explicitly sets a different vendor
    if (!merged.vendor && !merged.vendors?.length && (previousFilter.vendor || previousFilter.vendors?.length)) {
      merged.vendor = previousFilter.vendor;
      merged.vendors = previousFilter.vendors;
      merged.vendor_ids = previousFilter.vendor_ids;
    }
    // Carry forward style if not overridden
    if (!merged.style && previousFilter.style) {
      merged.style = previousFilter.style;
    }
    // Carry forward material if not overridden
    if (!merged.material && previousFilter.material) {
      merged.material = previousFilter.material;
      merged.material_expanded = previousFilter.material_expanded;
    }
    // Carry forward exclude terms
    if (previousFilter.exclude_terms?.length) {
      merged.exclude_terms = [...new Set([...(merged.exclude_terms || []), ...previousFilter.exclude_terms])];
    }
    return merged;
  }

  if (intent === "add") {
    // ADD: merge new vendors into previous vendor list
    const merged = { ...previousFilter };

    // Build combined vendor display names
    const prevVendors = previousFilter.vendors?.length > 0
      ? [...previousFilter.vendors]
      : previousFilter.vendor ? [previousFilter.vendor] : [];

    const newVendors = newParse.vendors?.length > 0
      ? newParse.vendors
      : newParse.vendor ? [newParse.vendor] : [];

    const allVendors = [...prevVendors];
    for (const v of newVendors) {
      if (!allVendors.some(av => av.toLowerCase() === v.toLowerCase())) {
        allVendors.push(v);
      }
    }

    // Build combined vendor IDs
    const prevIds = previousFilter.vendor_ids?.length > 0
      ? [...previousFilter.vendor_ids]
      : [];
    // If no vendor_ids, try to resolve from display names
    if (prevIds.length === 0 && prevVendors.length > 0) {
      for (const pv of prevVendors) {
        const found = LOCAL_VENDORS.find(lv => lv.display.toLowerCase() === pv.toLowerCase());
        if (found) prevIds.push(found.id);
      }
    }
    const newIds = newParse.vendor_ids?.length > 0
      ? newParse.vendor_ids
      : [];
    const allIds = [...prevIds];
    for (const id of newIds) {
      if (!allIds.includes(id)) allIds.push(id);
    }

    if (allVendors.length > 1) {
      merged.vendor = null;
      merged.vendors = allVendors;
      merged.vendor_ids = allIds;
    } else if (allVendors.length === 1) {
      merged.vendor = allVendors[0];
      merged.vendors = null;
      merged.vendor_ids = allIds.length > 0 ? allIds : null;
    }

    // Merge keywords
    const kwSet = new Set([...(merged.keywords || []), ...(newParse.keywords || [])]);
    merged.keywords = [...kwSet];

    return merged;
  }

  return null;
}

/**
 * Translate a follow-up/refinement query given a previous filter.
 */
export async function translateFollowUp(followUp, previousFilter) {
  // Try local follow-up parsing first (works without API key)
  const localResult = localParseFollowUp(followUp, previousFilter);
  if (localResult) return localResult;

  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (Date.now() < rateLimitedUntil) return null;

  callCount++;

  const messages = [
    { role: "user", content: `Previous search filter: ${JSON.stringify(previousFilter)}\n\nThe user now says: "${followUp}"\n\nUpdate the filter JSON to reflect this refinement. Keep everything from the previous filter unless the user explicitly changes it.` },
  ];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return null;

    const result = await response.json();
    const text = result.content?.[0]?.text?.trim();
    if (!text) return null;

    const jsonStr = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "").trim();
    const filter = JSON.parse(jsonStr);
    if (filter) enrichWithLocalParsing(filter, followUp);
    return filter;
  } catch {
    return null;
  }
}
