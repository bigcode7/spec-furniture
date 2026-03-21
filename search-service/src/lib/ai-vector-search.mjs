/**
 * AI Vector Search — Pure AI-to-vector search pipeline.
 *
 * Architecture:
 *   1. User query → Haiku (with catalog context + conversation history)
 *   2. Haiku returns vector_query + designer response
 *   3. vector_query → MiniLM embedding → cosine similarity
 *   4. Top 80 results returned
 *
 * No parser. No filters. No keyword search. No synonym maps. Pure AI.
 */

import { embed, vectorSearch, getVectorStoreStats, vectorFindSimilar } from "./vector-store.mjs";
import { getAllProducts, getProduct, getProductCount } from "../db/catalog-db.mjs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

// ── Catalog Index (built at startup, injected into Haiku system prompt) ──
let catalogIndexText = "";

/**
 * Build a live catalog index from product data.
 * Aggregates counts by furniture type, material, style, color, vendor, and features.
 */
export function buildCatalogIndex(products) {
  const types = {};
  const materials = {};
  const styles = {};
  const colors = {};
  const vendors = {};
  const features = {};
  const formalities = {};
  const moods = {};
  let totalTagged = 0;
  let totalUntagged = 0;

  for (const p of products) {
    const va = p.ai_visual_analysis;
    const vname = p.vendor_name || p.vendor_id || "Unknown";
    vendors[vname] = (vendors[vname] || 0) + 1;

    if (va) {
      totalTagged++;
      if (va.furniture_type) types[va.furniture_type] = (types[va.furniture_type] || 0) + 1;
      if (va.upholstery_material) materials[va.upholstery_material.split(",")[0].trim()] = (materials[va.upholstery_material.split(",")[0].trim()] || 0) + 1;
      if (va.style) styles[va.style] = (styles[va.style] || 0) + 1;
      if (va.color_primary) colors[va.color_primary] = (colors[va.color_primary] || 0) + 1;
      if (va.formality) formalities[va.formality] = (formalities[va.formality] || 0) + 1;
      if (va.mood) {
        const firstMood = va.mood.split(",")[0].trim();
        moods[firstMood] = (moods[firstMood] || 0) + 1;
      }
      if (va.distinctive_features) {
        for (const f of va.distinctive_features) {
          const fl = f.toLowerCase().split(" ").slice(0, 3).join(" "); // Normalize to first 3 words
          features[fl] = (features[fl] || 0) + 1;
        }
      }
    } else {
      totalUntagged++;
      // Use traditional fields for untagged
      if (p.category) types[p.category.replace(/-/g, " ")] = (types[p.category.replace(/-/g, " ")] || 0) + 1;
      if (p.material) materials[p.material.split(",")[0].trim()] = (materials[p.material.split(",")[0].trim()] || 0) + 1;
    }
  }

  const sortDesc = (obj, limit = 30) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k, v]) => `${k} (${v})`).join(", ");

  catalogIndexText = `Catalog: ${totalTagged + totalUntagged} products (${totalTagged} AI-tagged, ${totalUntagged} untagged).

Furniture types: ${sortDesc(types, 40)}
Materials: ${sortDesc(materials, 25)}
Styles: ${sortDesc(styles, 20)}
Colors: ${sortDesc(colors, 25)}
Features: ${sortDesc(features, 30)}
Formality levels: ${sortDesc(formalities, 10)}
Vendors: ${sortDesc(vendors, 30)}`;

  console.log(`[ai-vector-search] Catalog index built: ${totalTagged} tagged, ${totalUntagged} untagged products`);
  return catalogIndexText;
}

/**
 * Build the Haiku system prompt with live catalog data.
 */
function getSystemPrompt() {
  return `You are the search brain for SPEKD, an AI-powered trade furniture sourcing platform. You receive a designer's search query and convert it into the ideal vector search text to match products in our vector database.

Our product vectors are built from expert AI analysis of every product photo. Each vector was generated from this structured text format:

type:[furniture type] | silhouette:[shape] | arms:[arm style] | back:[back style] | legs:[leg style] | cushions:[cushion type] | material:[primary material] | secondary:[secondary materials] | color:[primary color] | finish:[finish] | style:[design style] | era:[era influence] | formality:[level] | scale:[size] | weight:[visual weight] | texture:[texture] | construction:[details] | features:[distinctive features] | mood:[feeling] | client:[ideal project] | pairs:[complementary pieces] | durability:[assessment] | terms:[search terms] | vendor:[vendor name] | description:[expert description]

Our catalog contains:
${catalogIndexText}

Your job: Take the designer's natural language query and construct a vector search string using the EXACT same format as our product vectors. Use the field labels (type:, material:, features:, etc.) and use values that EXIST in our catalog data above.

IMPORTANT RULES:
- If the designer mentions a specific vendor, include vendor:[exact vendor name] in the vector query
- If the designer mentions a price constraint, note it in your response but vectors don't encode price — the system handles price filtering separately
- If the designer uses vibe language ("quiet luxury", "cozy", "statement piece"), translate it into concrete vector fields: style, mood, formality, texture, material
- If the designer says "not X" or "no X", DO NOT include X in the vector query. Instead, emphasize the opposite qualities.
- For conversational follow-ups, the full conversation history is provided. Combine context from previous messages with the new request naturally.
- Be specific and detailed in the vector_query — more fields = better matches
- Always include type: if you can infer the furniture type
- Use the same vocabulary that appears in our catalog data above

CRITICAL: Your vector_query should emphasize the furniture TYPE strongly. Repeat the type term 2-3 times in the query text so the embedding model weights it properly. For example:
- "sofa with nailhead" → "sofa sofa type:sofa | features:brass nailhead trim | material:leather | mood:traditional sophisticated"
- "leather recliner" → "recliner recliner type:recliner | material:leather | style:transitional"

Return ONLY this JSON (no markdown, no backticks):
{
  "vector_query": "the constructed search text matching our vector format — REPEAT the furniture type for emphasis",
  "furniture_type": "the primary furniture type the user is looking for (sofa, chair, recliner, table, bed, sectional, etc.) or null if vibe/general search",
  "material_filter": "specific material the designer asked for (leather, velvet, boucle, linen, etc.) or null if no specific material required",
  "feature_filter": "specific feature/detail the designer asked for (nailhead, channel back, tufted, skirted, etc.) or null if no specific feature required",
  "response": "2-3 sentence expert designer response about what you're showing them and any relevant sourcing advice",
  "price_min": null,
  "price_max": null,
  "vendor_filter": null,
  "exclude_vendors": null
}

For furniture_type, return the SINGULAR primary type being searched for (null for vibe searches like "quiet luxury" or "mountain house").
For material_filter, return the specific material ONLY when the designer explicitly names a material (e.g., "leather recliner" → "leather", "velvet sofa" → "velvet"). Return null for general/vibe searches.
For feature_filter, return the specific feature ONLY when the designer explicitly names a feature (e.g., "sofa with nailhead" → "nailhead", "tufted chair" → "tufted", "channel back dining chair" → "channel"). Return null for general searches.
For price_min/price_max, extract any price constraints from the query (numbers only, null if none).
For vendor_filter, extract the exact vendor name if the designer wants a specific vendor (null if none).
For exclude_vendors, extract vendor names to exclude (array or null). Example: "not from RH" → ["RH"].`;
}

/**
 * Build system prompt for list/paste search.
 */
function getListSystemPrompt() {
  return `You are the search brain for SPEKD, an AI-powered trade furniture sourcing platform. A designer has pasted a list of items they need to source.

Our product vectors use this format:
type:[furniture type] | silhouette:[shape] | arms:[arm style] | back:[back style] | legs:[leg style] | material:[primary material] | color:[primary color] | style:[design style] | features:[distinctive features] | mood:[feeling] | terms:[search terms] | vendor:[vendor name] | description:[expert description]

Our catalog contains:
${catalogIndexText}

For each item in the designer's list, construct a vector search string using our product vector format. Be specific and use vocabulary from our catalog.

Return ONLY this JSON (no markdown, no backticks):
{
  "items": [
    {
      "vector_query": "type:... | material:... | ...",
      "label": "short description of what this item is",
      "original_text": "the original text from the designer's list"
    }
  ],
  "response": "2-3 sentence overview of what you found and any sourcing advice"
}`;
}

// ── Result Cache ──
const queryCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
  // Evict expired entries
  if (queryCache.size > 300) {
    const now = Date.now();
    for (const [k, v] of queryCache) {
      if (now > v.expires) queryCache.delete(k);
    }
  }
}

/**
 * Call Haiku to translate a query into a vector search string.
 *
 * @param {string} query - The designer's search query
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<{vector_query: string, furniture_type: string|null, response: string, price_min: number|null, price_max: number|null, vendor_filter: string|null, exclude_vendors: string[]|null}>}
 */
export async function translateQueryWithHaiku(query, conversationHistory = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: return raw query as vector search text
    console.warn("[ai-vector-search] No API key — using raw query as vector text");
    return { vector_query: query, furniture_type: null, material_filter: null, feature_filter: null, response: "Searching catalog...", price_min: null, price_max: null, vendor_filter: null, exclude_vendors: null };
  }

  // Build messages array from conversation history
  const messages = [];
  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  // Add current query
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
        max_tokens: 600,
        system: getSystemPrompt(),
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ai-vector-search] Haiku API error ${resp.status}: ${errText.slice(0, 200)}`);
      return { vector_query: query, furniture_type: null, material_filter: null, feature_filter: null, response: "Searching catalog...", price_min: null, price_max: null, vendor_filter: null, exclude_vendors: null };
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[ai-vector-search] Haiku returned non-JSON:", text.slice(0, 200));
      return { vector_query: query, furniture_type: null, material_filter: null, feature_filter: null, response: "Searching catalog...", price_min: null, price_max: null, vendor_filter: null, exclude_vendors: null };
    }

    console.log(`[ai-vector-search] Haiku responded in ${Date.now() - callStart}ms`);
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      vector_query: parsed.vector_query || query,
      furniture_type: parsed.furniture_type || null,
      material_filter: parsed.material_filter || null,
      feature_filter: parsed.feature_filter || null,
      response: parsed.response || "Here are your results.",
      price_min: parsed.price_min || null,
      price_max: parsed.price_max || null,
      vendor_filter: parsed.vendor_filter || null,
      exclude_vendors: parsed.exclude_vendors || null,
    };
  } catch (err) {
    console.error(`[ai-vector-search] Haiku call failed: ${err.message}`);
    // Safety net: embed raw query directly
    return { vector_query: query, furniture_type: null, material_filter: null, feature_filter: null, response: "Searching catalog...", price_min: null, price_max: null, vendor_filter: null, exclude_vendors: null };
  }
}

/**
 * Translate a paste list into multiple vector queries via Haiku.
 */
export async function translateListWithHaiku(items) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      items: items.map(item => ({ vector_query: item, label: item, original_text: item })),
      response: "Searching catalog for each item...",
    };
  }

  const listText = items.map((item, i) => `${i + 1}. ${item}`).join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: getListSystemPrompt(),
        messages: [{ role: "user", content: listText }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        items: items.map(item => ({ vector_query: item, label: item, original_text: item })),
        response: "Searching catalog for each item...",
      };
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        items: items.map(item => ({ vector_query: item, label: item, original_text: item })),
        response: "Searching catalog for each item...",
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`[ai-vector-search] List parse failed: ${err.message}`);
    return {
      items: items.map(item => ({ vector_query: item, label: item, original_text: item })),
      response: "Searching catalog for each item...",
    };
  }
}

/**
 * The complete search pipeline. Query → Haiku → Vector → Results.
 *
 * @param {string} query
 * @param {object} options
 * @param {Array} options.conversation - Conversation history
 * @param {Set} options.excludeIds - Product IDs to exclude
 * @param {number} options.page - Page number
 * @param {object} options.filters - UI facet filters
 * @returns {Promise<object>} Search response
 */
export async function searchPipeline(query, options = {}) {
  const { conversation = [], excludeIds = new Set(), page = 1, filters = {} } = options;

  // ── Check cache ──
  const cacheKey = `vsearch:${query.toLowerCase()}:${JSON.stringify(filters)}:p${page}`;
  if (excludeIds.size === 0) {
    const cached = getCached(cacheKey);
    if (cached) return { ...cached, cache_hit: true };
  }

  // ── Step 1: Haiku translates query → vector_query ──
  const haiku = await translateQueryWithHaiku(query, conversation);
  console.log(`[ai-vector-search] Query: "${query}" → Vector: "${haiku.vector_query.slice(0, 120)}..."`);

  // ── Step 2: Vector similarity search ──
  const vectorStats = getVectorStoreStats();
  let results = [];

  if (vectorStats.ready && vectorStats.total_vectors > 0) {
    // Build filter function for vendor/price/exclusion constraints
    const filterFn = buildFilterFn(haiku, filters, excludeIds);
    // Fetch extra candidates to ensure enough type-matching results after re-ranking
    const fetchLimit = haiku.furniture_type ? 500 : 200;
    const rawResults = await vectorSearch(haiku.vector_query, { limit: fetchLimit, filter: filterFn });

    // Hydrate with full product data
    let hydrateFailures = 0;
    for (const { id, score } of rawResults) {
      const product = getProduct(id);
      if (product) {
        product.relevance_score = score;
        product._vector_score = score;
        results.push(product);
      } else {
        hydrateFailures++;
      }
    }
    console.log(`[ai-vector-search] Vector returned ${rawResults.length} candidates, hydrated ${results.length} (${hydrateFailures} missing from catalog)`);
  } else {
    console.warn("[ai-vector-search] Vector store not ready — returning empty results");
  }

  // ── Step 3: Type-aware re-ranking ──
  // MiniLM doesn't differentiate furniture types well in structured text.
  // Haiku tells us what type the user wants; we boost matching products.
  if (haiku.furniture_type && results.length > 0) {
    results = typeAwareRerank(results, haiku.furniture_type);
  }

  // ── Step 3b: Material filtering ──
  // When user explicitly asks for a material (e.g., "leather recliner"),
  // filter to products that actually have that material.
  if (haiku.material_filter && results.length > 0) {
    results = materialFilter(results, haiku.material_filter);
  }

  // ── Step 3c: Feature filtering ──
  // When user explicitly asks for a feature (e.g., "nailhead trim"),
  // filter to products that actually have that feature.
  if (haiku.feature_filter && results.length > 0) {
    results = featureFilter(results, haiku.feature_filter);
  }

  // ── Step 4: Apply UI facet filters ──
  results = applyFacetFilters(results, filters);

  // ── Step 5: Build response ──
  const totalAvailable = results.length;
  const pageResults = results.slice(0, 80);
  const vendorCount = new Set(pageResults.map(p => p.vendor_name)).size;

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
    result_mode: "ai-vector",
    tier_used: 1,
    ai_called: true,
    cache_hit: false,
    facets: computeSimpleFacets(results),
    diagnostics: {
      ai_filter_used: true,
      total_catalog_size: getProductCount(),
      vector_indexed: vectorStats.total_vectors,
      tier_used: 1,
      vector_query: haiku.vector_query,
      furniture_type: haiku.furniture_type,
      material_filter: haiku.material_filter,
      feature_filter: haiku.feature_filter,
      haiku_response: haiku.response,
    },
    products: pageResults,
  };

  // Cache
  if (excludeIds.size === 0) {
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

  // Exclude same vendor for cross-vendor diversity
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
 * List search pipeline — paste list → Haiku → multiple vector searches.
 */
export async function listSearchPipeline(items) {
  const haiku = await translateListWithHaiku(items);

  const results = [];
  for (const item of haiku.items) {
    const rawResults = await vectorSearch(item.vector_query, { limit: 20 });
    const products = rawResults.map(({ id, score }) => {
      const product = getProduct(id);
      if (!product) return null;
      product.relevance_score = score;
      return product;
    }).filter(Boolean);

    results.push({
      item_number: results.length + 1,
      original_text: item.original_text || item.label,
      summary: item.label,
      products,
      total: products.length,
      feasibility: products.length >= 5 ? "strong" : products.length >= 1 ? "possible" : "unlikely",
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
 * Type-aware re-ranking. Boosts products matching the Haiku-identified furniture type.
 * Not a hard filter — non-matching types can still appear if highly vector-relevant,
 * but type-matching products get significant score boost.
 *
 * Uses both category and AI visual analysis furniture_type for matching.
 */
function typeAwareRerank(results, furnitureType) {
  const typeLower = furnitureType.toLowerCase().replace(/-/g, " ");

  // Find matching aliases — check the type itself and all words in it
  let typeAliases = TYPE_ALIASES[typeLower];
  if (!typeAliases) {
    // Try each word in the type (e.g., "power recliner" → check "recliner")
    const words = typeLower.split(/\s+/);
    for (const word of words) {
      if (TYPE_ALIASES[word]) {
        typeAliases = TYPE_ALIASES[word];
        break;
      }
    }
    if (!typeAliases) typeAliases = [typeLower];
  }

  const matching = [];
  const nonMatching = [];

  for (const product of results) {
    const cat = (product.category || "").toLowerCase().replace(/-/g, " ");
    const aiType = (product.ai_furniture_type || "").toLowerCase();
    const name = (product.product_name || "").toLowerCase();
    const vaType = product.ai_visual_analysis?.furniture_type?.toLowerCase() || "";

    const matchesType = typeAliases.some(alias =>
      cat.includes(alias) || aiType.includes(alias) || vaType.includes(alias) || name.includes(alias)
    );

    if (matchesType) {
      matching.push(product);
    } else {
      nonMatching.push(product);
    }
  }

  // Type-matching products first, then minimal backfill only if needed
  // If we have 20+ type matches, limit backfill to preserve accuracy
  const minResults = 80;
  const backfillNeeded = Math.max(0, minResults - matching.length);
  const backfill = nonMatching.slice(0, backfillNeeded);

  console.log(`[ai-vector-search] Type rerank: ${matching.length} type-match, ${backfill.length} backfill (type="${typeLower}", aliases=${typeAliases.join(",")})`);

  return [...matching, ...backfill];
}

/**
 * Type aliases — maps a furniture type to all category/type terms that should match.
 * e.g., "sofa" should also match "sofas", "loveseat", etc.
 */
const TYPE_ALIASES = {
  "sofa": ["sofa", "sofas"],
  "sectional": ["sectional", "sectionals"],
  "recliner": ["recliner", "recliners"],
  "chair": ["chair", "chairs", "accent chair", "accent chairs", "swivel chair", "swivel chairs"],
  "accent chair": ["accent chair", "accent chairs", "chair", "chairs", "swivel chair"],
  "dining chair": ["dining chair", "dining chairs"],
  "table": ["table", "tables"],
  "dining table": ["dining table", "dining tables"],
  "coffee table": ["coffee table", "coffee tables"],
  "side table": ["side table", "side tables"],
  "console table": ["console table", "console tables"],
  "bed": ["bed", "beds"],
  "dresser": ["dresser", "dressers"],
  "nightstand": ["nightstand", "nightstands"],
  "ottoman": ["ottoman", "ottomans"],
  "bench": ["bench", "benches"],
  "bar stool": ["bar stool", "bar stools"],
  "desk": ["desk", "desks"],
  "bookcase": ["bookcase", "bookcases"],
  "cabinet": ["cabinet", "cabinets"],
  "credenza": ["credenza", "credenzas"],
  "chaise": ["chaise", "chaises"],
  "settee": ["settee", "settees"],
};

/**
 * Filter results to only products matching a specific material.
 * Checks material, ai_primary_material, ai_visual_analysis.upholstery_material, description.
 */
function materialFilter(results, material) {
  const matLower = material.toLowerCase();
  const matching = results.filter(p => {
    const fields = [
      p.material,
      p.ai_primary_material,
      p.ai_visual_analysis?.upholstery_material,
      p.ai_visual_analysis?.secondary_materials,
      p.description,
    ].filter(Boolean).join(" ").toLowerCase();
    return fields.includes(matLower);
  });

  console.log(`[ai-vector-search] Material filter "${material}": ${matching.length}/${results.length} match`);

  // Only apply if we get meaningful results — don't return empty
  return matching.length >= 5 ? matching : results;
}

/**
 * Filter results to only products matching a specific feature.
 * Checks distinctive_features, visual_tags, construction_details, description.
 */
function featureFilter(results, feature) {
  const featLower = feature.toLowerCase();
  const matching = results.filter(p => {
    const va = p.ai_visual_analysis || {};
    const fields = [
      JSON.stringify(p.ai_distinctive_features || []),
      p.ai_visual_tags,
      JSON.stringify(va.distinctive_features || []),
      typeof va.construction_details === "string" ? va.construction_details : JSON.stringify(va.construction_details || ""),
      va.description,
      p.description,
    ].filter(Boolean).join(" ").toLowerCase();
    return fields.includes(featLower);
  });

  console.log(`[ai-vector-search] Feature filter "${feature}": ${matching.length}/${results.length} match`);
  return matching.length >= 5 ? matching : results;
}

function buildFilterFn(haiku, uiFilters, excludeIds) {
  return (id) => {
    if (excludeIds.size > 0 && excludeIds.has(id)) return false;

    const p = getProduct(id);
    if (!p) return false;

    // Vendor filter from Haiku
    if (haiku.vendor_filter) {
      const vendorLower = haiku.vendor_filter.toLowerCase();
      const pVendor = (p.vendor_name || "").toLowerCase();
      const pVendorId = (p.vendor_id || "").toLowerCase();
      if (!pVendor.includes(vendorLower) && !pVendorId.includes(vendorLower.replace(/\s+/g, "-"))) {
        return false;
      }
    }

    // Exclude vendors from Haiku
    if (haiku.exclude_vendors?.length > 0) {
      const pVendor = (p.vendor_name || "").toLowerCase();
      const pVendorId = (p.vendor_id || "").toLowerCase();
      for (const ev of haiku.exclude_vendors) {
        const evl = ev.toLowerCase();
        if (pVendor.includes(evl) || pVendorId.includes(evl.replace(/\s+/g, "-"))) {
          return false;
        }
      }
    }

    // Price filters from Haiku
    if (haiku.price_max && p.retail_price && p.retail_price > haiku.price_max) return false;
    if (haiku.price_min && p.retail_price && p.retail_price < haiku.price_min) return false;

    // UI facet vendor filter
    if (uiFilters.vendors?.length > 0) {
      if (!uiFilters.vendors.some(v =>
        (p.vendor_name || "").toLowerCase() === v.toLowerCase() ||
        (p.vendor_id || "").toLowerCase() === v.toLowerCase()
      )) return false;
    }

    return true;
  };
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
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([value, count]) => ({ value, count }));

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
