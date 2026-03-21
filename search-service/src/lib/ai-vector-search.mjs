/**
 * AI Vector Search — Haiku field matching + MiniLM ranking.
 *
 * Architecture:
 *   1. User query → Haiku (with full catalog field index + conversation history)
 *   2. Haiku returns search_fields + exclude_fields + semantic_query
 *   3. Direct field matching against database (exact contains matching)
 *   4. MiniLM ranks candidates by semantic_query similarity
 *   5. Top 80 ranked candidates returned
 *
 * MiniLM never decides what's in or out — only the ORDER of confirmed matches.
 */

import { embed, vectorSearch, getVectorStoreStats, vectorFindSimilar } from "./vector-store.mjs";
import { getAllProducts, getProduct, getProductCount } from "../db/catalog-db.mjs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

// ── Catalog Field Index ──
let catalogFieldIndex = {};
let catalogIndexPromptText = "";

// Field accessors — maps search_fields keys to how to read them from a product
const FIELD_ACCESSORS = {
  ai_furniture_type: p => p.ai_furniture_type,
  ai_primary_material: p => p.ai_primary_material,
  ai_distinctive_features: p => p.ai_distinctive_features, // array
  ai_style: p => p.ai_style,
  ai_primary_color: p => p.ai_primary_color,
  ai_silhouette: p => p.ai_silhouette,
  ai_arm_style: p => p.ai_arm_style,
  ai_back_style: p => p.ai_back_style,
  ai_leg_style: p => p.ai_leg_style,
  ai_formality: p => p.ai_formality,
  ai_scale: p => p.ai_scale,
  ai_mood: p => p.ai_mood,
  ai_cushions: p => p.ai_visual_analysis?.cushions,
  ai_finish: p => p.ai_visual_analysis?.finish,
  ai_era_influence: p => p.ai_visual_analysis?.era_influence,
  ai_texture_description: p => p.ai_visual_analysis?.texture_description,
  ai_construction_details: p => {
    const v = p.ai_visual_analysis?.construction_details;
    return typeof v === "string" ? v : null;
  },
  ai_durability_assessment: p => p.ai_visual_analysis?.durability_assessment,
  ai_visual_weight: p => p.ai_visual_analysis?.visual_weight,
  ai_ideal_client: p => p.ai_visual_analysis?.ideal_client,
  vendor_name: p => p.vendor_name,
};

// How many top values to include in Haiku prompt per field
const FIELD_LIMITS = {
  ai_furniture_type: 120,
  ai_primary_material: 100,
  ai_distinctive_features: 200,
  ai_style: 80,
  ai_primary_color: 80,
  ai_silhouette: 80,
  ai_arm_style: 60,
  ai_back_style: 60,
  ai_leg_style: 60,
  ai_formality: 30,
  ai_scale: 30,
  ai_mood: 80,
  ai_cushions: 60,
  ai_finish: 40,
  ai_era_influence: 60,
  ai_texture_description: 40,
  ai_construction_details: 40,
  ai_durability_assessment: 30,
  ai_visual_weight: 20,
  ai_ideal_client: 40,
  vendor_name: 50,
};

// Values to filter out of catalog index
const SKIP_VALUES = new Set([
  "not applicable", "unable to determine", "n/a", "none", "none visible",
  "unable to determine from line drawing", "unable to determine from image",
]);

/**
 * Build catalog field index from all products.
 * Collects unique values with counts for every searchable AI field.
 */
export function buildCatalogIndex(products) {
  // Convert to array if iterator
  const productArray = Array.isArray(products) ? products : [...products];

  catalogFieldIndex = {};
  let totalTagged = 0;
  let totalUntagged = 0;
  const priceByType = {};

  // Collect all field values in a single pass through products
  const fieldTermMaps = {};
  for (const fieldName of Object.keys(FIELD_ACCESSORS)) {
    if (fieldName === "ai_distinctive_features") continue;
    fieldTermMaps[fieldName] = {};
  }
  const featureTerms = {};

  for (const p of productArray) {
    if (p.ai_visual_analysis) totalTagged++;
    else totalUntagged++;

    // Collect string field values
    for (const [fieldName, accessor] of Object.entries(FIELD_ACCESSORS)) {
      if (fieldName === "ai_distinctive_features") continue;
      const val = accessor(p);
      if (!val || typeof val !== "string") continue;

      const terms = fieldTermMaps[fieldName];
      if (fieldName === "vendor_name") {
        terms[val] = (terms[val] || 0) + 1;
      } else {
        // Split compound values (e.g., "velvet or linen-blend performance fabric")
        // into individual indexable terms, plus keep the full value
        const normalized = val.toLowerCase().trim();
        if (SKIP_VALUES.has(normalized)) continue;

        // Index the full value
        terms[normalized] = (terms[normalized] || 0) + 1;

        // Also index individual comma-separated parts
        if (normalized.includes(",")) {
          for (const part of normalized.split(",")) {
            const trimmed = part.trim();
            if (trimmed && !SKIP_VALUES.has(trimmed) && trimmed !== normalized) {
              terms[trimmed] = (terms[trimmed] || 0) + 1;
            }
          }
        }

        // Also index key material/style terms (split by "or", "and", "with")
        if (fieldName === "ai_primary_material" || fieldName === "ai_style") {
          for (const part of normalized.split(/\s+(?:or|and|with)\s+/)) {
            const trimmed = part.trim();
            if (trimmed && trimmed.length > 2 && !SKIP_VALUES.has(trimmed) && trimmed !== normalized) {
              terms[trimmed] = (terms[trimmed] || 0) + 1;
            }
          }
        }
      }
    }

    // Collect feature array values
    const features = p.ai_distinctive_features;
    if (Array.isArray(features)) {
      for (const f of features) {
        const fl = f.toLowerCase().trim();
        if (fl && !SKIP_VALUES.has(fl)) {
          featureTerms[fl] = (featureTerms[fl] || 0) + 1;
        }
      }
    }

    // Price stats by furniture type
    if (p.retail_price && p.retail_price > 0 && p.ai_furniture_type) {
      const type = p.ai_furniture_type.toLowerCase().trim();
      if (!priceByType[type]) priceByType[type] = { min: Infinity, max: 0, sum: 0, count: 0 };
      priceByType[type].min = Math.min(priceByType[type].min, p.retail_price);
      priceByType[type].max = Math.max(priceByType[type].max, p.retail_price);
      priceByType[type].sum += p.retail_price;
      priceByType[type].count++;
    }
  }

  // Build sorted indexes per field
  for (const [fieldName, terms] of Object.entries(fieldTermMaps)) {
    const limit = FIELD_LIMITS[fieldName] || 50;
    catalogFieldIndex[fieldName] = Object.entries(terms)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }
  catalogFieldIndex.ai_distinctive_features = Object.entries(featureTerms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, FIELD_LIMITS.ai_distinctive_features);

  // Build the prompt text
  const formatField = (fieldName) => {
    const entries = catalogFieldIndex[fieldName] || [];
    return entries.map(([val, count]) => `${val} (${count})`).join(", ");
  };

  // Price ranges by type (top 20 types)
  const priceRanges = Object.entries(priceByType)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([type, stats]) => `${type}: $${stats.min}-$${stats.max} (avg $${Math.round(stats.sum / stats.count)})`)
    .join("\n");

  catalogIndexPromptText = `Catalog: ${totalTagged + totalUntagged} products (${totalTagged} AI-tagged, ${totalUntagged} untagged).

ai_furniture_type values: ${formatField("ai_furniture_type")}

ai_primary_material values: ${formatField("ai_primary_material")}

ai_distinctive_features values: ${formatField("ai_distinctive_features")}

ai_style values: ${formatField("ai_style")}

ai_primary_color values: ${formatField("ai_primary_color")}

ai_silhouette values: ${formatField("ai_silhouette")}

ai_arm_style values: ${formatField("ai_arm_style")}

ai_back_style values: ${formatField("ai_back_style")}

ai_leg_style values: ${formatField("ai_leg_style")}

ai_formality values: ${formatField("ai_formality")}

ai_scale values: ${formatField("ai_scale")}

ai_mood values: ${formatField("ai_mood")}

ai_cushions values: ${formatField("ai_cushions")}

ai_finish values: ${formatField("ai_finish")}

ai_era_influence values: ${formatField("ai_era_influence")}

ai_texture_description values: ${formatField("ai_texture_description")}

ai_construction_details values: ${formatField("ai_construction_details")}

ai_durability_assessment values: ${formatField("ai_durability_assessment")}

ai_visual_weight values: ${formatField("ai_visual_weight")}

ai_ideal_client values: ${formatField("ai_ideal_client")}

vendor_name values: ${formatField("vendor_name")}

Price ranges by furniture type:
${priceRanges}`;

  console.log(`[ai-vector-search] Catalog index built: ${totalTagged} tagged, ${totalUntagged} untagged products`);
  console.log(`[ai-vector-search] Index prompt size: ${catalogIndexPromptText.length} chars`);
  return catalogIndexPromptText;
}

// ── Haiku System Prompt ──

function getSystemPrompt() {
  return `You are the search brain for SPEKD, an AI-powered trade furniture sourcing platform. You receive a designer's search query and return the exact field values from our catalog that match what they want.

Our product database has these searchable fields with these values:

${catalogIndexPromptText}

Your job: Read the designer's query and pick values from the lists above that match what they want. Use CONTAINS matching — your values will be checked with case-insensitive substring matching against product fields. So "leather" will match "distressed leather, top grain leather". Only populate fields the designer actually mentioned or implied. Leave everything else null — null means don't filter on that field.

For conversational follow-ups, full history is provided. Combine context from all previous messages naturally. If they said 'leather sofa' first then 'just from Baker' next, your response should include furniture_type, material, AND vendor.

You understand furniture deeply. You know:
- 'couch' means sofa
- 'coffee table' means cocktail table
- 'nailhead' means look in ai_distinctive_features for nailhead trim, brass nailheads
- 'comfortable' means look for casual/relaxed formality, loose pillow or pillow back, down cushions
- 'kid friendly' means performance fabric, high durability
- 'quiet luxury' is a mood — use ai_mood
- 'mid century' is a style — use ai_style
- 'barrel' is a silhouette — use ai_silhouette
- 'tight back' is a back style — use ai_back_style
- 'track arm' is an arm style — use ai_arm_style
- 'eight way hand tied' is construction — use ai_construction_details
- 'spring down' or 'down cushions' — use ai_cushions
- Dimension requests like 'seats 8' means width 96+ inches. 'apartment size' means the designer wants a compact sofa — use ai_scale with ["small", "compact", "apartment"] but do NOT set width constraints (most products lack dimension data)
- Price requests like 'under $3000' or 'budget friendly' should set price_max
- Negations like 'not rustic' or 'hates brown' mean EXCLUDE those values via exclude_fields
- When a designer asks for a vibe like 'mountain house' or 'quiet luxury', use ai_mood, ai_style, ai_formality, ai_primary_material — pick values that match the vibe
- For 'doesn't look like a recliner', use ai_furniture_type for recliner but also set ai_silhouette to non-traditional shapes, and ai_style to contemporary/transitional

CRITICAL RULES:
- Use values that EXIST in the lists above. Use substring terms that would match via contains.
- For ai_distinctive_features, use short terms like "nailhead", "channel back", "tufted" — they will match via contains against feature strings.
- You can provide MULTIPLE values per field — any match counts (OR logic within a field). ALL non-null fields must match (AND logic between fields).
- FEWER FIELDS = MORE RESULTS. Every non-null field NARROWS the results. Only set fields the designer EXPLICITLY asked about. Let semantic_query handle the nuance.
  - "sofa with nailhead" → set ai_furniture_type and ai_distinctive_features ONLY. 2 fields.
  - "leather recliner" → set ai_furniture_type and ai_primary_material ONLY. 2 fields.
  - "mid century but make it cozy" → set ai_style ONLY (maybe ai_mood). Let semantic_query rank by coziness. 1-2 fields max.
  - "quiet luxury accent chair" → set ai_furniture_type ONLY. Let semantic_query rank by luxury mood. 1 field.
  - "mountain house that doesn't feel rustic" → set ai_style with warm/organic values, put "rustic" in exclude_fields. 1-2 fields.
  - Vibe/mood searches → 1-2 fields max. Use semantic_query for mood ranking.
  - Precise searches ("Theodore Alexander velvet sofa") → 3 fields (vendor, type, material).
  - "something like the RH cloud sofa but not RH" → set ai_furniture_type: ["sofa"] ONLY, exclude vendor_name: ["Restoration Hardware"]. Let semantic_query describe the cloud sofa characteristics (deep, plush, oversized, loose pillow back). 1 field + exclude.
  - "like X but not Y" queries → set MINIMAL fields (usually just furniture type), use exclude_fields for the brand/style to avoid, and put ALL the descriptive characteristics in semantic_query for ranking.
- For vibe searches without a specific furniture type, you can set ai_furniture_type to multiple types like ["sofa", "accent chair", "sectional", "ottoman"] to broaden results.
- For ai_mood, use simple terms from the catalog that capture the vibe — they match via contains.
- DO NOT set color, arm_style, back_style, formality, cushions, finish, texture, construction, durability, visual_weight, ideal_client unless the designer EXPLICITLY asked about those attributes. These fields are for semantic_query ranking, not filtering.
- For ai_scale, use short individual terms like ["small"], ["medium"], ["compact"] — NOT compound phrases like "small to medium". Each value is checked via contains matching.
- IMPORTANT: Most products lack price and dimension data. Use price_min/price_max and width/height/depth constraints sparingly — many valid matches will be excluded if these are set. Prefer using semantic_query to rank by size/price instead.

Return ONLY this JSON (no markdown, no backticks):
{
  "search_fields": {
    "ai_furniture_type": ["value1", "value2"] or null,
    "ai_primary_material": ["value1"] or null,
    "ai_distinctive_features": ["value1", "value2"] or null,
    "ai_style": ["value1"] or null,
    "ai_primary_color": ["value1", "value2"] or null,
    "ai_silhouette": ["value1"] or null,
    "ai_arm_style": ["value1"] or null,
    "ai_back_style": ["value1"] or null,
    "ai_leg_style": ["value1"] or null,
    "ai_formality": ["value1"] or null,
    "ai_scale": ["value1"] or null,
    "ai_mood": ["value1"] or null,
    "ai_cushions": ["value1"] or null,
    "ai_finish": ["value1"] or null,
    "ai_era_influence": ["value1"] or null,
    "ai_texture_description": ["value1"] or null,
    "ai_construction_details": ["value1"] or null,
    "ai_durability_assessment": ["value1"] or null,
    "ai_visual_weight": ["value1"] or null,
    "ai_ideal_client": ["value1"] or null,
    "vendor_name": ["Exact Vendor Name"] or null,
    "price_min": number or null,
    "price_max": number or null,
    "width_min": number or null,
    "width_max": number or null,
    "height_min": number or null,
    "height_max": number or null,
    "depth_min": number or null,
    "depth_max": number or null
  },
  "exclude_fields": {
    "ai_style": ["rustic"] or null,
    "ai_primary_color": ["brown", "espresso"] or null,
    "ai_primary_material": ["velvet"] or null,
    "vendor_name": ["Restoration Hardware"] or null
  },
  "semantic_query": "natural language description of the ideal product for ranking",
  "response": "2-3 sentence expert designer response about what you are showing them"
}`;
}

function getListSystemPrompt() {
  return `You are the search brain for SPEKD, an AI-powered trade furniture sourcing platform. A designer has pasted a list of items they need to source.

Our catalog fields: ai_furniture_type, ai_primary_material, ai_distinctive_features, ai_style, ai_primary_color, ai_silhouette, ai_arm_style, ai_back_style, ai_formality, ai_mood, vendor_name.

${catalogIndexPromptText}

For each item, return search_fields using values from our catalog. Use contains-matching terms.

Return ONLY this JSON (no markdown, no backticks):
{
  "items": [
    {
      "search_fields": { "ai_furniture_type": ["sectional"], "ai_primary_material": ["performance fabric"] },
      "exclude_fields": {},
      "semantic_query": "large performance fabric sectional neutral tones",
      "label": "Sectional - performance fabric neutral"
    }
  ],
  "response": "2-3 sentence overview of what you found and sourcing advice"
}`;
}

// ── Result Cache ──
const queryCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

function getCached(key) {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    queryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setQueryCache(key, value) {
  queryCache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  if (queryCache.size > 300) {
    const now = Date.now();
    for (const [k, v] of queryCache) {
      if (now > v.expires) queryCache.delete(k);
    }
  }
}

// ── Haiku API Call ──

/**
 * Call Haiku to translate query into search_fields + semantic_query.
 */
export async function translateQueryWithHaiku(query, conversationHistory = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ai-vector-search] No API key — using raw query fallback");
    return {
      search_fields: {},
      exclude_fields: {},
      semantic_query: query,
      response: "Searching catalog...",
    };
  }

  const messages = [];
  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: "user", content: query });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const callStart = Date.now();

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: getSystemPrompt(),
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ai-vector-search] Haiku API error ${resp.status}: ${errText.slice(0, 200)}`);
      return { search_fields: {}, exclude_fields: {}, semantic_query: query, response: "Searching catalog..." };
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[ai-vector-search] Haiku returned non-JSON:", text.slice(0, 200));
      return { search_fields: {}, exclude_fields: {}, semantic_query: query, response: "Searching catalog..." };
    }

    console.log(`[ai-vector-search] Haiku responded in ${Date.now() - callStart}ms`);
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      search_fields: parsed.search_fields || {},
      exclude_fields: parsed.exclude_fields || {},
      semantic_query: parsed.semantic_query || query,
      response: parsed.response || "Here are your results.",
    };
  } catch (err) {
    console.error(`[ai-vector-search] Haiku call failed: ${err.message}`);
    // Safety net: fall back to raw vector search
    return { search_fields: {}, exclude_fields: {}, semantic_query: query, response: "Showing best matches for your search." };
  }
}

/**
 * Call Haiku for paste list search.
 */
export async function translateListWithHaiku(items) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      items: items.map(item => ({
        search_fields: {},
        exclude_fields: {},
        semantic_query: item,
        label: item,
      })),
      response: "Searching catalog for each item...",
    };
  }

  const listText = items.map((item, i) => `${i + 1}. ${item}`).join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        system: getListSystemPrompt(),
        messages: [{ role: "user", content: listText }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        items: items.map(item => ({ search_fields: {}, exclude_fields: {}, semantic_query: item, label: item })),
        response: "Searching catalog for each item...",
      };
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        items: items.map(item => ({ search_fields: {}, exclude_fields: {}, semantic_query: item, label: item })),
        response: "Searching catalog for each item...",
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`[ai-vector-search] List parse failed: ${err.message}`);
    return {
      items: items.map(item => ({ search_fields: {}, exclude_fields: {}, semantic_query: item, label: item })),
      response: "Searching catalog for each item...",
    };
  }
}

// ── Field Matching Engine ──

/**
 * Check if a product field value contains any of the search terms.
 * For string fields: case-insensitive substring match.
 * For array fields (ai_distinctive_features): any element contains any term.
 */
function fieldContains(productValue, searchTerms) {
  if (!searchTerms || searchTerms.length === 0) return true;

  // Product MUST have the field to match — missing field = no match
  if (!productValue) return false;

  if (Array.isArray(productValue)) {
    if (productValue.length === 0) return false;
    const joined = productValue.join(" ").toLowerCase();
    return searchTerms.some(term => joined.includes(term.toLowerCase()));
  }

  if (typeof productValue === "string") {
    if (productValue.trim() === "") return false;
    const valLower = productValue.toLowerCase();
    return searchTerms.some(term => valLower.includes(term.toLowerCase()));
  }

  return false;
}

/**
 * Check if a product field value does NOT contain any of the excluded terms.
 */
function fieldExcludes(productValue, excludeTerms) {
  if (!productValue || !excludeTerms || excludeTerms.length === 0) return true;

  if (Array.isArray(productValue)) {
    const joined = productValue.join(" ").toLowerCase();
    return excludeTerms.every(term => !joined.includes(term.toLowerCase()));
  }

  if (typeof productValue === "string") {
    const valLower = productValue.toLowerCase();
    return excludeTerms.every(term => !valLower.includes(term.toLowerCase()));
  }

  return true;
}

/**
 * Direct field matching — find all products matching the search_fields.
 * Product must match ALL non-null fields (AND between fields).
 * Within each field, any value matching counts (OR within field).
 */
function fieldMatch(searchFields, excludeFields, excludeIds) {
  const candidates = [];
  const allProducts = getAllProducts();

  // Extract dimension/price filters
  const priceMin = searchFields.price_min || null;
  const priceMax = searchFields.price_max || null;
  const widthMin = searchFields.width_min || null;
  const widthMax = searchFields.width_max || null;
  const heightMin = searchFields.height_min || null;
  const heightMax = searchFields.height_max || null;
  const depthMin = searchFields.depth_min || null;
  const depthMax = searchFields.depth_max || null;

  // Build list of field filters (only non-null fields)
  const fieldFilters = [];
  for (const [fieldName, accessor] of Object.entries(FIELD_ACCESSORS)) {
    const searchVals = searchFields[fieldName];
    if (searchVals && Array.isArray(searchVals) && searchVals.length > 0) {
      fieldFilters.push({ fieldName, accessor, searchVals });
    }
  }

  // Build list of exclude filters
  const excludeFilters = [];
  if (excludeFields) {
    for (const [fieldName, accessor] of Object.entries(FIELD_ACCESSORS)) {
      const excludeVals = excludeFields[fieldName];
      if (excludeVals && Array.isArray(excludeVals) && excludeVals.length > 0) {
        excludeFilters.push({ fieldName, accessor, excludeVals });
      }
    }
  }

  let scanned = 0;
  for (const product of allProducts) {
    scanned++;

    // Exclude by ID
    if (excludeIds && excludeIds.size > 0 && excludeIds.has(product.id)) continue;

    // Price filters
    if (priceMin && product.retail_price && product.retail_price < priceMin) continue;
    if (priceMax && product.retail_price && product.retail_price > priceMax) continue;

    // Dimension filters
    if (widthMin && product.width && product.width < widthMin) continue;
    if (widthMax && product.width && product.width > widthMax) continue;
    if (heightMin && product.height && product.height < heightMin) continue;
    if (heightMax && product.height && product.height > heightMax) continue;
    if (depthMin && product.depth && product.depth < depthMin) continue;
    if (depthMax && product.depth && product.depth > depthMax) continue;

    // All search fields must match (AND logic)
    let matchesAll = true;
    for (const { accessor, searchVals } of fieldFilters) {
      const val = accessor(product);
      if (!fieldContains(val, searchVals)) {
        matchesAll = false;
        break;
      }
    }
    if (!matchesAll) continue;

    // No excluded fields should match
    let excluded = false;
    for (const { accessor, excludeVals } of excludeFilters) {
      const val = accessor(product);
      if (!fieldExcludes(val, excludeVals)) {
        excluded = true;
        break;
      }
    }
    if (excluded) continue;

    candidates.push(product);
  }

  console.log(`[ai-vector-search] Field match: ${candidates.length} candidates from ${scanned} products (${fieldFilters.length} field filters, ${excludeFilters.length} exclude filters)`);
  return candidates;
}

// ── Search Pipeline ──

/**
 * Complete search pipeline: Query → Haiku → Field Match → MiniLM Rank → Results.
 */
export async function searchPipeline(query, options = {}) {
  const { conversation = [], excludeIds = new Set(), page = 1, filters = {} } = options;

  // ── Check cache ──
  const cacheKey = `fsearch:${query.toLowerCase()}:${JSON.stringify(filters)}:p${page}`;
  if (excludeIds.size === 0 && conversation.length === 0) {
    const cached = getCached(cacheKey);
    if (cached) return { ...cached, cache_hit: true };
  }

  // ── Step 1: Haiku translates query → search_fields + semantic_query ──
  const haiku = await translateQueryWithHaiku(query, conversation);
  const hasFieldFilters = Object.values(haiku.search_fields).some(v =>
    v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0) && typeof v !== "number"
  );

  console.log(`[ai-vector-search] Query: "${query}" → Fields: ${JSON.stringify(haiku.search_fields).slice(0, 200)}`);
  console.log(`[ai-vector-search] Semantic: "${haiku.semantic_query?.slice(0, 120)}"`);

  let results = [];
  const vectorStats = getVectorStoreStats();

  if (hasFieldFilters) {
    // ── Step 2: Direct field matching ──
    const candidates = fieldMatch(haiku.search_fields, haiku.exclude_fields, excludeIds);

    // ── Step 3: MiniLM ranking within candidates ──
    if (candidates.length > 0 && vectorStats.ready && vectorStats.total_vectors > 0 && haiku.semantic_query) {
      const candidateIds = new Set(candidates.map(p => p.id));
      const ranked = await vectorSearch(haiku.semantic_query, {
        limit: candidates.length,
        candidateIds,
      });

      // Build ranked results, preserving vector score
      const rankedMap = new Map(ranked.map(r => [r.id, r.score]));
      for (const product of candidates) {
        product.relevance_score = rankedMap.get(product.id) || 0;
        product._vector_score = product.relevance_score;
      }
      candidates.sort((a, b) => b.relevance_score - a.relevance_score);
    }

    // ── Vendor diversity: re-sort to avoid one vendor dominating results ──
    results = applyVendorDiversity(candidates);
  } else {
    // ── Safety net: no field filters (Haiku failed or vibe search) ──
    // Fall back to pure vector search
    if (vectorStats.ready && vectorStats.total_vectors > 0) {
      const searchText = haiku.semantic_query || query;
      const rawResults = await vectorSearch(searchText, { limit: 200 });
      for (const { id, score } of rawResults) {
        const product = getProduct(id);
        if (product && !(excludeIds.size > 0 && excludeIds.has(id))) {
          product.relevance_score = score;
          product._vector_score = score;
          results.push(product);
        }
      }
      console.log(`[ai-vector-search] Fallback vector search: ${results.length} results`);
    }
    results = applyVendorDiversity(results);
  }

  // ── Step 4: Apply UI facet filters ──
  results = applyFacetFilters(results, filters);

  // ── Step 5: Build response ──
  const totalAvailable = results.length;
  const pageResults = results.slice(0, 80);

  const response = {
    query,
    intent: { summary: haiku.response, product_type: null },
    ai_filter: null,
    ai_summary: haiku.response,
    assistant_message: haiku.response,
    total: pageResults.length,
    total_available: totalAvailable,
    has_more: totalAvailable > 80,
    page,
    result_mode: "ai-field-match",
    tier_used: 1,
    ai_called: true,
    cache_hit: false,
    facets: computeSimpleFacets(results),
    diagnostics: {
      ai_filter_used: true,
      total_catalog_size: getProductCount(),
      vector_indexed: vectorStats.total_vectors,
      tier_used: 1,
      search_fields: haiku.search_fields,
      exclude_fields: haiku.exclude_fields,
      semantic_query: haiku.semantic_query,
      field_match_count: totalAvailable,
      haiku_response: haiku.response,
    },
    products: pageResults,
  };

  // Cache (skip conversational searches)
  if (excludeIds.size === 0 && conversation.length === 0) {
    setQueryCache(cacheKey, response);
  }

  return response;
}

/**
 * Find similar products — pure vector similarity, cross-vendor diversity.
 */
export function findSimilar(productId, limit = 20) {
  const sourceProduct = getProduct(productId);
  if (!sourceProduct) return [];

  const sourceVendorId = sourceProduct.vendor_id;

  const filter = (id) => {
    const p = getProduct(id);
    return p && p.vendor_id !== sourceVendorId;
  };

  const results = vectorFindSimilar(productId, limit, filter);

  return results.map(({ id, score }) => {
    const product = getProduct(id);
    if (!product) return null;
    product.relevance_score = score;
    product._similarity = score;
    return product;
  }).filter(Boolean);
}

/**
 * List search pipeline — paste list → Haiku → field match + rank per item.
 */
export async function listSearchPipeline(items) {
  const haiku = await translateListWithHaiku(items);

  const results = [];
  for (const item of haiku.items) {
    const candidates = fieldMatch(item.search_fields || {}, item.exclude_fields || {});

    // Rank within candidates
    if (candidates.length > 0 && item.semantic_query) {
      const candidateIds = new Set(candidates.map(p => p.id));
      const ranked = await vectorSearch(item.semantic_query, {
        limit: Math.min(candidates.length, 20),
        candidateIds,
      });
      const rankedMap = new Map(ranked.map(r => [r.id, r.score]));
      for (const p of candidates) {
        p.relevance_score = rankedMap.get(p.id) || 0;
      }
      candidates.sort((a, b) => b.relevance_score - a.relevance_score);
    }

    const topProducts = candidates.slice(0, 20);
    results.push({
      item_number: results.length + 1,
      original_text: item.original_text || item.label,
      summary: item.label,
      products: topProducts,
      total: topProducts.length,
      feasibility: topProducts.length >= 5 ? "strong" : topProducts.length >= 1 ? "possible" : "unlikely",
    });
  }

  return {
    overview_message: haiku.response,
    items: results,
    total_items: results.length,
    total_products: results.reduce((sum, r) => sum + r.products.length, 0),
  };
}

// ── Internal helpers ──

/**
 * Re-sort results for vendor diversity. Greedy selection: at each step, pick
 * the highest-scoring remaining product after applying a penalty based on how
 * many products from that vendor have already been selected.
 *
 * Penalty: each prior selection from the same vendor reduces the effective
 * score by 3%. This interleaves vendors naturally while still respecting
 * relevance — a highly relevant product still beats a mediocre one from
 * a different vendor.
 */
function applyVendorDiversity(results) {
  if (results.length <= 1) return results;

  const uniqueVendors = new Set(results.map(p => p.vendor_name));
  if (uniqueVendors.size <= 2) return results;

  const selected = [];
  const remaining = results.map((p, i) => ({ product: p, idx: i }));
  const vendorCounts = {};

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i].product;
      const vendor = p.vendor_name || "Unknown";
      const seen = vendorCounts[vendor] || 0;
      const score = (p.relevance_score || 0) - (seen * 0.03);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const picked = remaining.splice(bestIdx, 1)[0];
    const vendor = picked.product.vendor_name || "Unknown";
    vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
    selected.push(picked.product);
  }

  return selected;
}

function applyFacetFilters(results, filters) {
  if (!filters || Object.keys(filters).length === 0) return results;
  let filtered = results;

  if (filters.materials?.length > 0) {
    filtered = filtered.filter(p => {
      const mat = `${p.material || ""} ${p.ai_primary_material || ""}`.toLowerCase();
      return filters.materials.some(m => mat.includes(m.toLowerCase()));
    });
  }
  if (filters.categories?.length > 0) {
    filtered = filtered.filter(p => {
      const cat = (p.category || "").toLowerCase();
      return filters.categories.some(c => cat.includes(c.toLowerCase().replace(/ /g, "-")));
    });
  }
  if (filters.styles?.length > 0) {
    filtered = filtered.filter(p => {
      const style = (p.style || "").toLowerCase();
      return filters.styles.some(s => style === s.toLowerCase());
    });
  }
  if (filters.price_min != null) {
    filtered = filtered.filter(p => !p.retail_price || p.retail_price >= filters.price_min);
  }
  if (filters.price_max != null) {
    filtered = filtered.filter(p => !p.retail_price || p.retail_price <= filters.price_max);
  }
  if (filters.vendors?.length > 0) {
    filtered = filtered.filter(p =>
      filters.vendors.some(v =>
        (p.vendor_name || "").toLowerCase() === v.toLowerCase() ||
        (p.vendor_id || "").toLowerCase() === v.toLowerCase()
      )
    );
  }

  return filtered;
}

function computeSimpleFacets(results) {
  const vendorCounts = {};
  const categoryCounts = {};
  const materialCounts = {};
  const styleCounts = {};
  const colorCounts = {};

  for (const p of results) {
    const v = p.vendor_name || "Unknown";
    vendorCounts[v] = (vendorCounts[v] || 0) + 1;
    const cat = p.category || "other";
    const catDisplay = cat.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    categoryCounts[catDisplay] = (categoryCounts[catDisplay] || 0) + 1;
    if (p.material) {
      const mat = p.material.split(",")[0].trim();
      if (mat) materialCounts[mat] = (materialCounts[mat] || 0) + 1;
    }
    if (p.style) styleCounts[p.style] = (styleCounts[p.style] || 0) + 1;
    const color = p.ai_primary_color || p.color;
    if (color) colorCounts[color] = (colorCounts[color] || 0) + 1;
  }

  const toFacet = (obj, limit = 15) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ value, count }));

  return {
    vendor: toFacet(vendorCounts),
    category: toFacet(categoryCounts),
    material: toFacet(materialCounts),
    style: toFacet(styleCounts),
    color: toFacet(colorCounts),
  };
}

export function clearVectorSearchCache() {
  queryCache.clear();
}
