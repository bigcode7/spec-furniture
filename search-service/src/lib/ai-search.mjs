import { buildSearchIntent, buildQueryVariants } from "./query-intelligence.mjs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL_FAST = "claude-haiku-4-5-20251001";  // cheap, for query understanding
const MODEL_SMART = "claude-sonnet-4-20250514";   // expensive, for web search discovery

// API call counter for monitoring costs
let apiCallCount = { haiku: 0, sonnet: 0, total: 0 };
export function getApiCallStats() { return { ...apiCallCount }; }

// Track rate limit state so we don't waste time on calls that will fail
let rateLimitedUntil = 0;

function isRateLimited() {
  return Date.now() < rateLimitedUntil;
}

async function callAnthropic({ messages, maxTokens = 4096, tools = null, system = null, retries = 2, model = null }) {
  if (isRateLimited()) {
    throw new Error("Skipping — rate limited");
  }

  const useModel = model || MODEL_FAST;

  // Track API calls by model
  if (useModel === MODEL_FAST) {
    apiCallCount.haiku++;
  } else {
    apiCallCount.sonnet++;
  }
  apiCallCount.total++;

  const body = {
    model: useModel,
    max_tokens: maxTokens,
    messages,
  };
  if (tools) body.tools = tools;
  if (system) body.system = system;

  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (process.env.ANTHROPIC_API_KEY) {
    headers["x-api-key"] = process.env.ANTHROPIC_API_KEY;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (response.status === 429) {
        clearTimeout(timeout);
        const retryAfter = Number(response.headers.get("retry-after") || 30);
        rateLimitedUntil = Date.now() + retryAfter * 1000;
        const wait = Math.min(retryAfter, 45) * 1000;
        console.log(`Anthropic rate limited, waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${retries + 1})`);
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw new Error("Anthropic API rate limited after retries");
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Anthropic API ${response.status}: ${text.slice(0, 200)}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

function extractTextFromResponse(response) {
  if (!response?.content) return "";
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function safeJsonParse(text) {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/) || text.match(/(\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1].trim());
    } catch {
      // fall through
    }
  }
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// 1. AI PARSE INTENT — Universal query understanding
// ────────────────────────────────────────────────────────────

const PARSE_SYSTEM = `You are a to-the-trade furniture industry expert AI for SPEC, a platform built for interior designers and trade professionals. You understand every product category, style, material, manufacturer, and piece of designer jargon in the professional furniture world.

SPEC ONLY indexes products from established home furnishings manufacturers and trade brands — companies like Bernhardt, Hooker Furniture, Century, Vanguard, Lexington, Universal, Hickory Chair, Theodore Alexander, Four Hands, Caracole, Baker, Lee Industries, CR Laine, Arteriors, Currey & Company, Visual Comfort, and similar trade brands that show at High Point Market.

We do NOT show products from consumer/retail brands (no IKEA, Wayfair, West Elm, Pottery Barn, CB2, Target, Amazon, Article, Castlery, or any DTC brand).

Your job: take ANY search query and extract structured fields. You understand:
- Abbreviations: MCM = mid-century modern, RH = Restoration Hardware (trade program)
- Synonyms: credenza/sideboard/buffet, sofa/couch/settee, dresser/chest/bureau, ottoman/pouf
- Jargon: "performance fabric" is a material category, "bouclé" is a textile, "travertine" is a stone
- Trade vendor expertise: Bernhardt = high-end case goods, Four Hands = organic modern, Caracole = glamorous contemporary, Century = traditional luxury, Hooker = versatile mid-to-high, Lee Industries = custom upholstery, Arteriors = statement lighting & accents
- Product types: seating, tables, beds, storage, lighting, rugs, outdoor, office, accessories
- Size conventions: "72 inch" or "6ft" refers to width typically for tables/credenzas
- Price qualifiers: "under 2k" = max $2000, "investment" or "luxury" = $3000+

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "product_type": "the normalized furniture category or null",
  "style": "the design style or null",
  "material": "the primary material or null",
  "color": "the color preference or null",
  "vendor": "the specific trade manufacturer name or null",
  "max_price": null or number,
  "room_type": "living room/bedroom/dining/office/outdoor or null",
  "size": "any size specification or null",
  "attributes": ["list", "of", "other", "notable", "attributes"],
  "summary": "A brief natural-language summary of what they're looking for"
}`;

export async function aiParseIntent(query) {
  try {
    const response = await callAnthropic({
      system: PARSE_SYSTEM,
      messages: [{ role: "user", content: query }],
      maxTokens: 1024,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);
    if (parsed && typeof parsed === "object") {
      return {
        summary: parsed.summary || `Searching for ${query}`,
        product_type: parsed.product_type || null,
        style: parsed.style || null,
        material: parsed.material || null,
        color: parsed.color || null,
        vendor: parsed.vendor || null,
        max_price: typeof parsed.max_price === "number" ? parsed.max_price : null,
        max_lead_time_weeks: null,
        room_type: parsed.room_type || null,
        size: parsed.size || null,
        attributes: Array.isArray(parsed.attributes) ? parsed.attributes : [],
        sustainable: false,
        ergonomic: false,
        ai_parsed: true,
      };
    }
  } catch (error) {
    console.error("aiParseIntent failed, using fallback:", error.message);
  }
  return { ...buildSearchIntent(query), ai_parsed: false };
}

// ────────────────────────────────────────────────────────────
// 2. AI EXPAND QUERY — Intelligent query expansion
// ────────────────────────────────────────────────────────────

const EXPAND_SYSTEM = `You are a furniture industry search expert. Given a user's search query and parsed intent, generate 8-12 search variant strings that would help find the right products across different vendor websites.

Use real furniture industry knowledge:
- Synonym chains: sofa/couch/settee, credenza/sideboard/buffet, dresser/chest/bureau, ottoman/pouf/footstool
- Style expansions: MCM → "mid century modern", "glam" → "glamorous Hollywood regency"
- Material variants: "wood" → also try specific species like "oak", "walnut", "mahogany"
- Vendor-specific phrasings: how actual vendor sites title their products
- Category adjacents: if searching for "credenza", also try "media console" or "storage cabinet"
- URL-friendly versions: "dining-table" as well as "dining table"

Respond with ONLY a JSON array of strings (no markdown, no explanation):
["variant 1", "variant 2", ...]`;

export async function aiExpandQuery(query, intent) {
  try {
    const intentSummary = intent
      ? `Intent: ${JSON.stringify({ product_type: intent.product_type, style: intent.style, material: intent.material, color: intent.color, vendor: intent.vendor, max_price: intent.max_price })}`
      : "";

    const response = await callAnthropic({
      system: EXPAND_SYSTEM,
      messages: [{ role: "user", content: `Query: "${query}"\n${intentSummary}` }],
      maxTokens: 1024,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const variants = [query, ...parsed.map(String).filter(Boolean)];
      return Array.from(new Set(variants)).slice(0, 12);
    }
  } catch (error) {
    console.error("aiExpandQuery failed, using fallback:", error.message);
  }
  return buildQueryVariants(query, intent || buildSearchIntent(query));
}

// ────────────────────────────────────────────────────────────
// 3. AI DISCOVER PRODUCTS — Live web search via Anthropic API
// ────────────────────────────────────────────────────────────

function buildDiscoverPrompt(searchQuery, priceTier) {
  const tierGuidance = priceTier === "luxury" || priceTier === "high-end"
    ? "Focus on luxury trade manufacturers: Bernhardt, Century Furniture, Baker, Theodore Alexander, Caracole, Marge Carson, EJ Victor, Vanguard, Hickory Chair, Holly Hunt."
    : priceTier === "premium"
    ? "Focus on premium trade manufacturers: Four Hands, Hooker Furniture, Universal Furniture, Lexington, Lee Industries, CR Laine, Stickley, Arteriors, Made Goods."
    : "Search across established trade manufacturers ONLY: Bernhardt, Four Hands, Hooker Furniture, Century, Vanguard, Lexington, Universal, Hickory Chair, Theodore Alexander, Caracole, Baker, Lee Industries, CR Laine, Stickley, Sherrill, Arteriors, Currey & Company, Visual Comfort, Noir, Gabby, Palecek, Surya, Loloi.";

  return `Find real furniture products matching: "${searchQuery}"

IMPORTANT: ONLY search established trade furniture manufacturer websites. These are brands that sell through interior designers, dealer networks, and to-the-trade showrooms. Do NOT include any consumer/retail brands (no IKEA, Wayfair, West Elm, Pottery Barn, CB2, Target, Amazon, Article, Castlery, or any DTC brand).

${tierGuidance}

Search these manufacturer websites and find REAL products that actually exist. For each product found return:
- The EXACT product name as listed on the manufacturer's website
- The manufacturer/brand name
- The direct URL to the product page on the manufacturer's site
- The product image URL from the manufacturer's site
- Price if visible (many trade sites show "contact for pricing" — that's fine, return null)

Return ONLY a JSON array. Each item:
{ "product_name": "exact name from site", "vendor_name": "manufacturer", "vendor_domain": "domain.com", "product_url": "https://...", "image_url": "https://...", "retail_price": null or number, "category": "type", "material": "material or null", "style": "style or null", "description": "brief" }

Find 5-10 real products from trade manufacturers. Every URL must be a real page that exists on the manufacturer website.`;
}

export async function aiDiscoverProducts(query, intent, searchQueries) {
  // Run parallel web searches across multiple query variants
  const queries = (searchQueries && searchQueries.length > 1)
    ? searchQueries.slice(0, 5) // top 5 search queries in parallel
    : [query];

  const priceTier = intent?.price_tier || null;
  const tasks = queries.map((q) => aiDiscoverSingle(q, priceTier));
  const results = await Promise.allSettled(tasks);

  const allProducts = [];
  for (const result of results) {
    if (result.status === "fulfilled" && Array.isArray(result.value)) {
      allProducts.push(...result.value);
    }
  }

  // Dedupe by product URL
  const seen = new Map();
  const deduped = [];
  for (const product of allProducts) {
    const key = (product.product_url || product.product_name || "").toLowerCase();
    if (key && !seen.has(key)) {
      seen.set(key, true);
      deduped.push(product);
    }
  }

  return deduped;
}

async function aiDiscoverSingle(searchQuery, priceTier) {
  try {
    const prompt = buildDiscoverPrompt(searchQuery, priceTier);
    const response = await callAnthropic({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      model: MODEL_SMART,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && item.product_name && item.vendor_name)
        .map((item, idx) => normalizeAiProduct(item, idx));
    }
  } catch (error) {
    console.error(`aiDiscoverSingle failed for "${searchQuery}":`, error.message);
  }
  return [];
}

function normalizeAiProduct(item, index) {
  return {
    id: `ai-discovery-${Date.now()}-${index}`,
    product_name: String(item.product_name || "").trim(),
    vendor_name: String(item.vendor_name || "").trim(),
    vendor_id: slugify(item.vendor_name || "unknown"),
    vendor_domain: String(item.vendor_domain || "").trim(),
    product_url: String(item.product_url || "").trim(),
    image_url: String(item.image_url || "").trim(),
    retail_price: typeof item.retail_price === "number" ? item.retail_price : null,
    wholesale_price: null,
    category: String(item.category || "").trim() || null,
    material: String(item.material || "").trim() || null,
    style: String(item.style || "").trim() || null,
    description: String(item.description || "").trim() || null,
    colors: Array.isArray(item.colors) ? item.colors : [],
    tags: [],
    sku: "",
    collection: "",
    lead_time_weeks: null,
    price_verified: typeof item.retail_price === "number",
    image_verified: Boolean(item.image_url),
    product_url_verified: Boolean(item.product_url),
    ingestion_source: "ai-discovery",
    retrieval_quality_score: 60,
    retrieval_signals: ["ai-web-search"],
  };
}

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

// ────────────────────────────────────────────────────────────
// 4. AI RANK RESULTS — Semantic relevance ranking
// ────────────────────────────────────────────────────────────

const RANK_SYSTEM = `You are a to-the-trade furniture search relevance expert for SPEC, a platform used by interior designers and trade professionals. Given a search query, parsed intent, and a list of product candidates from trade manufacturers, re-rank them by TRUE relevance to what the designer actually wants.

SPEC only indexes established trade manufacturers (Bernhardt, Hooker, Century, Four Hands, Vanguard, Lexington, Universal, Hickory Chair, Theodore Alexander, Caracole, Baker, Lee Industries, etc.). Any consumer/DTC brand results should score 0.

Consider:
- Does the product actually match the product TYPE? (a "dining table" query should only return dining tables)
- Does the SHAPE match? (if they said "round", only round products should score high)
- Does the PRICE TIER match? Luxury → Bernhardt, Baker, Century, Theodore Alexander, Marge Carson. Premium → Four Hands, Hooker, Universal, Lexington.
- Does the material/style/color match?
- Is the manufacturer a recognized trade brand? Trade manufacturers should always outrank any consumer brand.
- Products with real product URLs and images should score higher
- PENALIZE products that don't match the core request (wrong product type, wrong shape)
- Score 0 for any consumer/retail brand (IKEA, Wayfair, West Elm, Pottery Barn, CB2, Target, Amazon, Article, Castlery)

Respond with ONLY a JSON array of objects (no markdown, no explanation):
[{ "index": 0, "relevance_score": 95, "reasoning": "brief explanation" }, ...]

Score 0-99. Return ALL products, re-ordered and re-scored.`;

export async function aiRankResults(query, intent, products) {
  if (!products || products.length === 0) return products;

  const candidateCount = Math.min(products.length, 30);
  const candidates = products.slice(0, candidateCount);
  const remainder = products.slice(candidateCount);

  try {
    const productSummaries = candidates.map((p, i) => ({
      index: i,
      name: p.product_name,
      vendor: p.vendor_name,
      category: p.category,
      material: p.material,
      style: p.style,
      price: p.retail_price || p.wholesale_price,
      has_image: Boolean(p.image_url),
      has_url: Boolean(p.product_url),
      source: p.ingestion_source,
    }));

    const intentSummary = {
      product_type: intent?.product_type,
      shape: intent?.shape,
      style: intent?.style,
      material: intent?.material,
      color: intent?.color,
      price_tier: intent?.price_tier,
      max_price: intent?.max_price,
      summary: intent?.summary,
    };

    const response = await callAnthropic({
      system: RANK_SYSTEM,
      messages: [{
        role: "user",
        content: `Query: "${query}"\nIntent: ${JSON.stringify(intentSummary)}\n\nProducts:\n${JSON.stringify(productSummaries, null, 1)}`,
      }],
      maxTokens: 2048,
    });
    const text = extractTextFromResponse(response);
    const rankings = safeJsonParse(text);

    if (Array.isArray(rankings) && rankings.length > 0) {
      const ranked = rankings
        .filter((r) => typeof r.index === "number" && r.index >= 0 && r.index < candidates.length)
        .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
        .map((r) => ({
          ...candidates[r.index],
          relevance_score: Math.max(0, Math.min(99, Number(r.relevance_score) || 0)),
          reasoning: r.reasoning || candidates[r.index].reasoning || "AI ranked",
          ai_ranked: true,
        }));

      // Add any candidates that weren't in the ranking response
      const rankedIndices = new Set(rankings.map((r) => r.index));
      for (let i = 0; i < candidates.length; i++) {
        if (!rankedIndices.has(i)) {
          ranked.push(candidates[i]);
        }
      }

      return [...ranked, ...remainder];
    }
  } catch (error) {
    console.error("aiRankResults failed, using existing order:", error.message);
  }
  return products;
}

// ────────────────────────────────────────────────────────────
// 5. AI SEARCH SUMMARY — Natural language results summary
// ────────────────────────────────────────────────────────────

const SUMMARY_SYSTEM = `You are a furniture search assistant. Generate a brief, insightful 1-2 sentence summary of search results for a furniture buyer or interior designer.

Be specific — mention:
- How many products and from how many vendors
- Which vendors have the strongest matches
- Price range if available
- Any notable style/material trends in the results
- Actionable suggestion if relevant (e.g., "Consider narrowing by material" or "Bernhardt and Hooker have the strongest options in this category")

Do NOT be generic. Do NOT say "Here are your results". Be a knowledgeable design consultant.

Respond with ONLY the summary text (no JSON, no markdown, no quotes).`;

export async function aiGenerateSummary(query, intent, products) {
  if (!products || products.length === 0) {
    return `No products found for "${query}". Try broadening your search or checking specific vendor sites.`;
  }

  try {
    const vendors = [...new Set(products.map((p) => p.vendor_name).filter(Boolean))];
    const prices = products
      .map((p) => p.retail_price || p.wholesale_price)
      .filter((p) => typeof p === "number" && p > 0);
    const priceRange = prices.length > 0
      ? `$${Math.min(...prices).toLocaleString()} - $${Math.max(...prices).toLocaleString()}`
      : "prices vary";
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
    const materials = [...new Set(products.map((p) => p.material).filter(Boolean))];

    const context = `Query: "${query}"
Intent: ${intent?.summary || query}
Results: ${products.length} products from ${vendors.length} vendors
Vendors: ${vendors.slice(0, 10).join(", ")}
Price range: ${priceRange}
Categories: ${categories.slice(0, 5).join(", ")}
Materials: ${materials.slice(0, 5).join(", ")}
Top 5 products: ${products.slice(0, 5).map((p) => `${p.product_name} by ${p.vendor_name} (${p.retail_price ? "$" + p.retail_price : "price TBD"})`).join("; ")}`;

    const response = await callAnthropic({
      system: SUMMARY_SYSTEM,
      messages: [{ role: "user", content: context }],
      maxTokens: 256,
    });
    const text = extractTextFromResponse(response).trim();
    if (text && text.length > 20) return text;
  } catch (error) {
    console.error("aiGenerateSummary failed:", error.message);
  }

  // Fallback: generate a basic summary without AI
  const vendorCount = new Set(products.map((p) => p.vendor_name).filter(Boolean)).size;
  return `Found ${products.length} products across ${vendorCount} vendors for "${query}".`;
}

// ────────────────────────────────────────────────────────────
// Combined AI parse + expand in one call for efficiency
// ────────────────────────────────────────────────────────────

const COMBINED_SYSTEM = `You are a furniture industry expert AI. You understand every product category, style, material, vendor, and piece of designer jargon in the furniture world.

Given a search query, do TWO things:

1. PARSE the query into structured fields. You understand:
   - Abbreviations: MCM = mid-century modern, RH = RH Trade Program, HC = Hickory Chair, TA = Theodore Alexander
   - Synonyms: credenza/sideboard/buffet, sofa/couch/settee, dresser/chest/bureau
   - Jargon: "performance fabric" is a material, "bouclé" is a textile, "travertine" is stone
   - Vendor expertise: Bernhardt = high-end case goods, Four Hands = organic modern, Hickory Chair = custom upholstery
   - Size: "72 inch" typically refers to width for tables/credenzas
   - Price: "under 2k" = $2000, "under 5k" = $5000
   - Price tier: "luxury" = Baker, Century, Marge Carson, EJ Victor, Holly Hunt, Donghia, Ralph Lauren Home
                 "high-end" = Bernhardt, Theodore Alexander, Caracole, Hickory Chair, Stickley, RH Trade
                 "premium" = Four Hands, Vanguard, Hooker, Universal, Lexington, Lee Industries
                 "trade standard" = Riverside, Kincaid, Highland House, Wesley Hall
   - IMPORTANT: SPEC is a trade-only platform. Only suggest trade manufacturers — NEVER consumer/DTC brands like IKEA, Wayfair, West Elm, Pottery Barn, CB2, Article, etc.

2. GENERATE 10 search queries optimized to find REAL products on REAL vendor websites. These are not synonym expansions — these are actual searches you would type to find products on vendor sites. Think about:
   - What words do vendors actually use in their product titles and descriptions?
   - A designer searching "higher end round dining table" needs queries like:
     "Bernhardt round dining table", "Hooker Furniture round dining table", "Four Hands round dining table",
     "RH round dining table", "round pedestal dining table luxury", "60 inch round dining table solid wood"
   - A designer searching "comfortable reading chair" needs:
     "upholstered accent chair", "lounge chair", "reading chair high back", "Bernhardt accent chair",
     "Four Hands lounge chair", "club chair comfortable"
   - Match the price tier to the right vendors
   - Include both vendor-specific searches AND generic product-type searches

Respond with ONLY a JSON object (no markdown):
{
  "intent": {
    "product_type": "normalized category or null",
    "shape": "round/rectangular/square/oval or null",
    "style": "style or null",
    "material": "material or null",
    "color": "color or null",
    "vendor": "vendor name or null",
    "max_price": null or number,
    "price_tier": "budget | mid-range | premium | high-end | luxury or null",
    "room_type": "room type or null",
    "size": "size spec or null",
    "attributes": [],
    "summary": "natural language summary of what they want"
  },
  "search_queries": ["query 1 optimized for vendor sites", "query 2", "... up to 10"]
}`;

export async function aiParseAndExpand(query) {
  try {
    const response = await callAnthropic({
      system: COMBINED_SYSTEM,
      messages: [{ role: "user", content: query }],
      maxTokens: 1536,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);

    if (parsed && parsed.intent && Array.isArray(parsed.search_queries)) {
      const intent = {
        summary: parsed.intent.summary || `Searching for ${query}`,
        product_type: parsed.intent.product_type || null,
        shape: parsed.intent.shape || null,
        style: parsed.intent.style || null,
        material: parsed.intent.material || null,
        color: parsed.intent.color || null,
        vendor: parsed.intent.vendor || null,
        max_price: typeof parsed.intent.max_price === "number" ? parsed.intent.max_price : null,
        price_tier: parsed.intent.price_tier || null,
        max_lead_time_weeks: null,
        room_type: parsed.intent.room_type || null,
        size: parsed.intent.size || null,
        attributes: Array.isArray(parsed.intent.attributes) ? parsed.intent.attributes : [],
        sustainable: false,
        ergonomic: false,
        ai_parsed: true,
      };
      const searchQueries = [query, ...parsed.search_queries.map(String).filter(Boolean)];
      return {
        intent,
        variants: Array.from(new Set(searchQueries)).slice(0, 12),
      };
    }
  } catch (error) {
    console.error("aiParseAndExpand failed, using fallback:", error.message);
  }

  const intent = buildSearchIntent(query);
  const variants = buildQueryVariants(query, intent);
  return { intent: { ...intent, ai_parsed: false }, variants };
}

// ────────────────────────────────────────────────────────────
// 6. AI COMPARE ANALYSIS — Designer-level product comparison
// ────────────────────────────────────────────────────────────

const COMPARE_SYSTEM = `You are a senior interior designer and furniture sourcing expert. A designer is comparing products side-by-side and needs your expert analysis.

Analyze the products and provide:
1. A brief overall comparison (2-3 sentences)
2. For each product, a short insight (1-2 sentences) covering strengths, weaknesses, and best use case
3. A recommendation based on different scenarios (budget-conscious, quality-first, fast delivery, hospitality/commercial, residential)

Consider:
- Price-to-quality ratio
- Material and construction quality signals (e.g., performance fabric > polyester, solid wood > engineered)
- Vendor reputation and positioning (Baker/Century = ultra-luxury, Bernhardt/Theodore Alexander = high-end, Four Hands/Hooker = premium trade)
- Lead time implications for project timelines
- Style coherence — do these products work together or are they from different design languages?
- Trade vs retail pricing when both are shown

Be specific and opinionated like a real designer would be. Use actual numbers from the data.

Respond with ONLY a JSON object (no markdown):
{
  "overview": "2-3 sentence comparison overview",
  "products": [
    {
      "id": "product id",
      "insight": "1-2 sentence insight about this specific product",
      "strengths": ["strength 1", "strength 2"],
      "weaknesses": ["weakness 1"]
    }
  ],
  "recommendations": [
    { "scenario": "Best value", "product_id": "id", "reasoning": "why" },
    { "scenario": "Highest quality", "product_id": "id", "reasoning": "why" },
    { "scenario": "Fastest delivery", "product_id": "id", "reasoning": "why" }
  ],
  "style_notes": "Do these products work together stylistically? What ties them together or sets them apart?"
}`;

export async function aiCompareProducts(products) {
  if (!products || products.length < 2) {
    return null;
  }

  try {
    const productData = products.map((p) => ({
      id: p.id,
      name: p.product_name,
      vendor: p.manufacturer_name || p.vendor_name,
      category: p.product_type || p.category,
      material: p.material,
      style: p.style,
      collection: p.collection,
      sku: p.sku,
      retail_price: p.retail_price,
      wholesale_price: p.wholesale_price,
      lead_time_weeks: p.lead_time_weeks,
      description: p.snippet || p.description,
    }));

    const response = await callAnthropic({
      system: COMPARE_SYSTEM,
      messages: [{ role: "user", content: `Compare these ${products.length} products:\n${JSON.stringify(productData, null, 2)}` }],
      maxTokens: 2048,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);

    if (parsed && parsed.overview) {
      return {
        overview: parsed.overview,
        products: Array.isArray(parsed.products) ? parsed.products : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        style_notes: parsed.style_notes || null,
        ai_generated: true,
      };
    }
  } catch (error) {
    console.error("aiCompareProducts failed:", error.message);
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// 7. AI QUOTE NARRATIVES — Per-product stories for PDF quotes
// ────────────────────────────────────────────────────────────

const QUOTE_SYSTEM = `You are a senior interior designer writing a product specification document for a client. For each product, write a short narrative (2-3 sentences) explaining why this piece was selected and what makes it special.

Your writing should:
- Sound like a designer presenting to a high-end client
- Reference specific product attributes (material, construction, finish, proportions)
- Explain how the piece fits into the broader project vision
- Mention the vendor's reputation when relevant
- Be warm but professional — not salesy

Also write a brief project introduction (2-3 sentences) that frames the overall selection.

Respond with ONLY a JSON object (no markdown):
{
  "project_intro": "2-3 sentence introduction to the overall product selection",
  "products": [
    {
      "id": "product id",
      "narrative": "2-3 sentence narrative for this product",
      "specification_note": "Brief technical note (e.g., 'Specify in Ivory performance fabric for high-traffic applications')"
    }
  ]
}`;

export async function aiGenerateQuoteNarratives(products, projectName) {
  if (!products || products.length === 0) {
    return null;
  }

  try {
    const productData = products.map((p) => ({
      id: p.id,
      name: p.product_name,
      vendor: p.manufacturer_name || p.vendor_name,
      category: p.product_type || p.category,
      material: p.material,
      style: p.style,
      collection: p.collection,
      sku: p.sku,
      retail_price: p.retail_price,
      wholesale_price: p.wholesale_price,
      lead_time_weeks: p.lead_time_weeks,
      description: p.snippet || p.description,
    }));

    const prompt = `Project: "${projectName || "Untitled Project"}"

Products selected for this project:
${JSON.stringify(productData, null, 2)}`;

    const response = await callAnthropic({
      system: QUOTE_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2048,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);

    if (parsed && parsed.products) {
      return {
        project_intro: parsed.project_intro || null,
        products: Array.isArray(parsed.products) ? parsed.products : [],
        ai_generated: true,
      };
    }
  } catch (error) {
    console.error("aiGenerateQuoteNarratives failed:", error.message);
  }
  return null;
}

// ────────────────────────────────────────────────────────────
// 8. CLIENT PRESENTATION AGENT — Mood board & presentation
// ────────────────────────────────────────────────────────────

const PRESENTATION_SYSTEM = `You are a senior interior designer creating a client presentation. Given a set of selected products and project context, generate a complete presentation structure.

Create:
1. A compelling project narrative (3-4 sentences) that sets the design vision
2. A color palette derived from the selected products (4-6 colors with hex codes and names)
3. Style direction summary — what ties the selection together
4. Room context — how these pieces work in the space
5. Product pairings — which products complement each other and why
6. Mood keywords (8-12 evocative words that capture the design direction)
7. For each product: a presentation-ready description (1-2 sentences, client-facing)

Respond with ONLY a JSON object (no markdown):
{
  "project_narrative": "3-4 sentence design vision",
  "color_palette": [
    { "name": "Warm Ivory", "hex": "#F5F0E8", "role": "dominant" },
    { "name": "Aged Brass", "hex": "#C9A96E", "role": "accent" }
  ],
  "style_direction": "2-3 sentences on the overall style",
  "room_context": "How these pieces work together in the space",
  "pairings": [
    { "product_ids": ["id1", "id2"], "reasoning": "why these work together" }
  ],
  "mood_keywords": ["refined", "organic", "textural"],
  "products": [
    { "id": "product id", "presentation_text": "client-facing description", "placement_suggestion": "where in the room" }
  ]
}`;

export async function aiGeneratePresentation(products, projectContext) {
  if (!products || products.length === 0) return null;
  try {
    const productData = products.map((p) => ({
      id: p.id, name: p.product_name || p.name, vendor: p.manufacturer_name || p.vendor_name || p.vendor,
      category: p.product_type || p.category, material: p.material, style: p.style,
      collection: p.collection, retail_price: p.retail_price, description: p.snippet || p.description,
    }));
    const prompt = `Project: "${projectContext?.name || "Design Project"}"\nRoom type: ${projectContext?.room_type || "Not specified"}\nClient notes: ${projectContext?.notes || "None"}\n\nProducts:\n${JSON.stringify(productData, null, 2)}`;
    const response = await callAnthropic({ system: PRESENTATION_SYSTEM, messages: [{ role: "user", content: prompt }], maxTokens: 2048 });
    const parsed = safeJsonParse(extractTextFromResponse(response));
    if (parsed?.project_narrative) return { ...parsed, ai_generated: true };
  } catch (error) { console.error("aiGeneratePresentation failed:", error.message); }
  return null;
}

// ────────────────────────────────────────────────────────────
// 9. VENDOR INTELLIGENCE AGENT — Vendor analysis & insights
// ────────────────────────────────────────────────────────────

const VENDOR_INTEL_SYSTEM = `You are a furniture industry analyst specializing in the professional trade market. You have deep knowledge of trade manufacturers — the brands that show at High Point Market and sell through to-the-trade showrooms. SPEC is a trade-only platform — NEVER reference consumer/DTC brands like IKEA, Wayfair, West Elm, Pottery Barn, CB2, Article, or any mass-market retailer.

Analyze trade manufacturer positioning, strengths, lead times, specialties, and competitive landscape within the professional furniture industry.

Respond with ONLY a JSON object (no markdown):
{
  "vendors": [
    { "id": "vendor id", "name": "vendor name", "tier": "luxury | high-end | premium | trade-standard",
      "specialties": ["best categories"], "strengths": ["key strengths"], "considerations": ["watch for"],
      "typical_lead_time": "X-Y weeks", "price_positioning": "brief", "best_for": "project types",
      "competes_with": ["similar vendors"] }
  ],
  "industry_context": "2-3 sentences on market state",
  "sourcing_tips": ["actionable tips"]
}`;

export async function aiVendorIntelligence(vendors, catalogSummary) {
  if (!vendors || vendors.length === 0) return null;
  try {
    const vendorData = vendors.map((v) => ({ id: v.id, name: v.name, domain: v.domain }));
    const prompt = `Analyze these furniture vendors:\n${JSON.stringify(vendorData, null, 2)}\n${catalogSummary ? `Catalog summary: ${JSON.stringify(catalogSummary)}` : ""}`;
    const response = await callAnthropic({ system: VENDOR_INTEL_SYSTEM, messages: [{ role: "user", content: prompt }], maxTokens: 3072 });
    const parsed = safeJsonParse(extractTextFromResponse(response));
    if (parsed?.vendors) return { ...parsed, ai_generated: true };
  } catch (error) { console.error("aiVendorIntelligence failed:", error.message); }
  return null;
}

// ────────────────────────────────────────────────────────────
// 10. PROJECT ANALYSIS AGENT — Project gap analysis
// ────────────────────────────────────────────────────────────

const PROJECT_SYSTEM = `You are a senior interior designer reviewing a project's product specifications. Analyze coverage, style coherence, budget, timeline risks, and missing categories.

Respond with ONLY a JSON object (no markdown):
{
  "project_health": "on-track | needs-attention | at-risk",
  "health_score": 75,
  "summary": "2-3 sentence status",
  "specified_categories": ["covered categories"],
  "missing_categories": ["needed categories"],
  "style_coherence": "assessment",
  "budget_analysis": { "total_estimated": 0, "assessment": "brief analysis" },
  "timeline_risk": "assessment",
  "action_items": [{ "priority": "high | medium | low", "action": "what to do", "category": "optional" }],
  "search_suggestions": ["searches to fill gaps"]
}`;

export async function aiAnalyzeProject(project) {
  if (!project) return null;
  try {
    const prompt = `Project: "${project.name || "Untitled"}"\nRoom type: ${project.room_type || "Not specified"}\nBudget: ${project.budget ? "$" + project.budget.toLocaleString() : "Not set"}\nNotes: ${project.notes || "None"}\n\nProducts (${(project.products || []).length}):\n${JSON.stringify((project.products || []).map((p) => ({ name: p.product_name, vendor: p.manufacturer_name, category: p.product_type, material: p.material, style: p.style, price: p.retail_price || p.wholesale_price, lead_time: p.lead_time_weeks })), null, 2)}`;
    const response = await callAnthropic({ system: PROJECT_SYSTEM, messages: [{ role: "user", content: prompt }], maxTokens: 2048 });
    const parsed = safeJsonParse(extractTextFromResponse(response));
    if (parsed?.project_health) return { ...parsed, ai_generated: true };
  } catch (error) { console.error("aiAnalyzeProject failed:", error.message); }
  return null;
}

// ────────────────────────────────────────────────────────────
// 11. TREND & STYLE AGENT — Industry trend analysis
// ────────────────────────────────────────────────────────────

const TREND_SYSTEM = `You are a furniture industry trend analyst tracking design trends, trade shows (High Point Market, ICFF, Salone del Mobile), and emerging styles.

Respond with ONLY a JSON object (no markdown):
{
  "trending_now": [{ "trend": "name", "category": "material|color|style|form|texture", "momentum": "rising|peaking|stabilizing", "description": "brief", "vendors_leading": ["vendors"], "search_terms": ["terms"] }],
  "emerging": [{ "trend": "name", "description": "what's appearing", "watch_for": "what to look for" }],
  "declining": ["fading trends"],
  "color_forecast": [{ "name": "color", "hex": "#hex", "usage": "where" }],
  "material_spotlight": "material having a moment and why",
  "designer_tip": "one actionable insight"
}`;

export async function aiTrendAnalysis(category, style) {
  try {
    let prompt = "What are the current furniture and interior design trends?";
    if (category) prompt += ` Focus on trends in ${category}.`;
    if (style) prompt += ` The designer works in a ${style} aesthetic.`;
    prompt += ` Today is ${new Date().toISOString().split("T")[0]}.`;
    const response = await callAnthropic({ system: TREND_SYSTEM, messages: [{ role: "user", content: prompt }], maxTokens: 2048, tools: [{ type: "web_search_20250305", name: "web_search" }], model: MODEL_SMART });
    const parsed = safeJsonParse(extractTextFromResponse(response));
    if (parsed?.trending_now) return { ...parsed, ai_generated: true };
  } catch (error) { console.error("aiTrendAnalysis failed:", error.message); }
  return null;
}

// ────────────────────────────────────────────────────────────
// 12. PRODUCT EXTRACTION AGENT — AI-enhanced extraction
// ────────────────────────────────────────────────────────────

const EXTRACTION_SYSTEM = `You are a furniture product data extraction expert. Extract structured data from vendor page content.

Respond with ONLY a JSON object (no markdown):
{
  "product_name": "exact name", "vendor_name": "brand", "sku": null, "collection": null,
  "dimensions": { "width": null, "depth": null, "height": null, "seat_height": null },
  "materials": { "primary": "main material", "secondary": null, "finish": null },
  "colors": [], "retail_price": null, "wholesale_price": null, "lead_time_weeks": null,
  "description": "description", "category": "category", "style": "style", "features": []
}`;

export async function aiExtractProduct(pageContent, sourceUrl) {
  if (!pageContent) return null;
  try {
    const truncated = pageContent.slice(0, 8000);
    const response = await callAnthropic({ system: EXTRACTION_SYSTEM, messages: [{ role: "user", content: `URL: ${sourceUrl || "unknown"}\n\nPage content:\n${truncated}` }], maxTokens: 1024 });
    const parsed = safeJsonParse(extractTextFromResponse(response));
    if (parsed?.product_name) return { ...parsed, ai_extracted: true };
  } catch (error) { console.error("aiExtractProduct failed:", error.message); }
  return null;
}

// ────────────────────────────────────────────────────────────
// 13. AI CHAT — Conversational furniture assistant
// ────────────────────────────────────────────────────────────

const CHAT_SYSTEM = `You are SPEC AI, an expert furniture sourcing assistant for interior designers and trade professionals. You have deep knowledge of trade furniture manufacturers — their product lines, pricing tiers, lead times, materials, and design styles.

SPEC is a TRADE-ONLY platform. You ONLY recommend products from established home furnishings manufacturers and trade brands:
- Tier 1: Bernhardt, Hooker, Century, Vanguard, Lexington, Universal, Hickory Chair, Theodore Alexander, Four Hands, Caracole, Baker, Stickley, CR Laine, Lee Industries, Sherrill
- Tier 2: Arteriors, Gabby, Noir, Currey & Company, Visual Comfort, Uttermost, Surya, Loloi, Jaipur Living, Palecek, Bungalow 5, Worlds Away, Global Views, Aidan Gray, Made Goods
- Tier 3: Maitland Smith, Hancock & Moore, Bradington-Young, Riverside, Marge Carson, EJ Victor, Highland House, Pearson, Wesley Hall
- Tier 4: RH Trade, Holly Hunt, Donghia, Kravet, Ralph Lauren Home, Hickory White, Kincaid

NEVER recommend consumer/DTC brands (IKEA, Wayfair, West Elm, Pottery Barn, CB2, Article, Target, Amazon, Castlery, etc.)

You can help designers with:
- Product recommendations and alternatives from trade manufacturers
- Vendor comparisons and trade program insights
- Material and construction guidance
- Budget planning and allocation across trade price tiers
- Design style guidance
- Industry knowledge (High Point Market, trade shows, new collections)

When recommending specific products, use your web search capability to find REAL products on trade manufacturer websites. Always provide specific product names, vendor names, and approximate trade pricing when possible.

Be conversational, knowledgeable, and opinionated like a senior designer who works the trade would be. Use specific vendor and product knowledge. Don't be generic.

When you find specific products, include them in a "products" array in your response. Otherwise just respond with text.

Respond with ONLY a JSON object:
{
  "message": "your conversational response with markdown formatting",
  "products": [
    { "product_name": "name", "vendor_name": "vendor", "product_url": "url", "image_url": "url or null", "retail_price": null or number, "description": "brief" }
  ] or null,
  "suggested_searches": ["search query 1", "search query 2"] or null,
  "action": null or { "type": "search|add_to_project|generate_quote", "payload": {} }
}`;

export async function aiChat(messages) {
  try {
    const response = await callAnthropic({
      system: CHAT_SYSTEM,
      messages,
      maxTokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      model: MODEL_SMART,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);
    if (parsed?.message) return parsed;
    // If not JSON, wrap plain text
    if (text.trim()) return { message: text.trim(), products: null, suggested_searches: null, action: null };
  } catch (error) { console.error("aiChat failed:", error.message); }
  return { message: "I'm having trouble connecting right now. Please try again in a moment.", products: null, suggested_searches: null, action: null };
}

// ────────────────────────────────────────────────────────────
// 14. VISUAL SEARCH — Image-based product identification
// ────────────────────────────────────────────────────────────

export async function aiVisualSearch(imageBase64, mimeType) {
  try {
    const identifyResponse = await callAnthropic({
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: imageBase64 } },
          { type: "text", text: `You are a furniture identification expert. Look at this image and identify the furniture piece(s). For each piece, provide:
1. What type of furniture it is (sofa, chair, table, etc.)
2. The likely style (mid-century modern, traditional, contemporary, etc.)
3. Materials visible (wood, leather, fabric, metal, marble, etc.)
4. Colors
5. Approximate dimensions if possible
6. Which vendors might carry similar products
7. 5 search queries to find similar products on vendor websites

Respond with ONLY a JSON object:
{
  "items": [{
    "type": "furniture type",
    "style": "design style",
    "material": "primary material",
    "colors": ["colors"],
    "description": "detailed description",
    "similar_vendors": ["vendors likely to carry this"],
    "search_queries": ["query1", "query2", "query3", "query4", "query5"],
    "estimated_price_range": "$X - $Y"
  }]
}` }
        ],
      }],
      maxTokens: 1536,
    });
    const identifyText = extractTextFromResponse(identifyResponse);
    const identification = safeJsonParse(identifyText);
    if (!identification?.items?.length) return null;

    // Now search for similar products using the generated queries
    const item = identification.items[0];
    const searchQueries = item.search_queries || [];
    const searchTasks = searchQueries.slice(0, 3).map((q) => aiDiscoverSingle(q, null));
    const searchResults = await Promise.allSettled(searchTasks);
    const products = [];
    for (const result of searchResults) {
      if (result.status === "fulfilled") products.push(...result.value);
    }
    // Dedupe
    const seen = new Map();
    const deduped = products.filter((p) => {
      const key = (p.product_url || p.product_name || "").toLowerCase();
      if (seen.has(key)) return false;
      seen.set(key, true);
      return true;
    });

    return { identification: identification.items, products: deduped };
  } catch (error) { console.error("aiVisualSearch failed:", error.message); }
  return null;
}

// ────────────────────────────────────────────────────────────
// 15. AI ROOM PLANNER — Full room product recommendations
// ────────────────────────────────────────────────────────────

export async function aiRoomPlan(roomSpec) {
  try {
    const prompt = `A designer needs a complete furniture plan for this room:

Room: ${roomSpec.room_type || "Living Room"}
Dimensions: ${roomSpec.dimensions || "Not specified"}
Style: ${roomSpec.style || "Not specified"}
Color Palette: ${roomSpec.palette || "Not specified"}
Budget: ${roomSpec.budget ? "$" + Number(roomSpec.budget).toLocaleString() : "Not specified"}
Needed items: ${roomSpec.items || "Not specified"}
Notes: ${roomSpec.notes || "None"}

Search vendor websites and find REAL products for each category needed. For each item, recommend a primary pick and 1-2 alternatives at different price points.

Return ONLY a JSON object:
{
  "room_plan": {
    "concept": "2-3 sentence design concept for this room",
    "budget_allocation": [{ "category": "Sofa", "allocated": 5000 }],
    "estimated_total": 25000
  },
  "categories": [
    {
      "category": "Sofa",
      "allocated_budget": 5000,
      "primary": { "product_name": "name", "vendor_name": "vendor", "product_url": "url", "image_url": "url or null", "retail_price": 4500, "material": "material", "why": "why this pick" },
      "alternatives": [
        { "product_name": "name", "vendor_name": "vendor", "product_url": "url", "image_url": "url or null", "retail_price": 3200, "material": "material", "why": "why this alternative" }
      ]
    }
  ],
  "styling_notes": "tips for pulling the room together",
  "vendor_summary": "which vendors featured and why"
}`;
    const response = await callAnthropic({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 8192,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10 }],
      model: MODEL_SMART,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);
    if (parsed?.categories) return { ...parsed, ai_generated: true };
  } catch (error) { console.error("aiRoomPlan failed:", error.message); }
  return null;
}

// ────────────────────────────────────────────────────────────
// 16. AI DESIGN BRIEF — Project intake & sourcing plan
// ────────────────────────────────────────────────────────────

export async function aiDesignBrief(briefInput) {
  try {
    const prompt = `Generate a comprehensive sourcing brief for this interior design project:

Project Name: ${briefInput.project_name || "New Project"}
Room Types: ${briefInput.room_types || "Not specified"}
Style Direction: ${briefInput.style || "Not specified"}
Budget Range: ${briefInput.budget || "Not specified"}
Timeline: ${briefInput.timeline || "Not specified"}
Vendor Preferences: ${briefInput.vendor_preferences || "None"}
Products to Avoid: ${briefInput.avoid || "None"}
Client Notes: ${briefInput.notes || "None"}

Return ONLY a JSON object:
{
  "brief_summary": "2-3 sentence project summary",
  "rooms": [
    {
      "room": "Living Room",
      "budget_allocation": 15000,
      "categories_needed": ["Sofa", "Accent Chairs (2)", "Coffee Table", "Rug", "Table Lamps (2)"],
      "recommended_vendors": [{ "name": "vendor", "reason": "why good for this room" }],
      "style_notes": "specific direction for this room",
      "priority": "high | medium | low"
    }
  ],
  "timeline": {
    "sourcing_weeks": 4,
    "ordering_deadline": "date consideration",
    "notes": "timeline considerations"
  },
  "budget_summary": { "total": 50000, "by_room": [{ "room": "Living Room", "amount": 15000 }] },
  "vendor_strategy": "overall vendor approach",
  "risk_factors": ["potential issues"],
  "first_searches": ["immediate search queries to start sourcing"]
}`;
    const response = await callAnthropic({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);
    if (parsed?.rooms) return { ...parsed, ai_generated: true };
  } catch (error) { console.error("aiDesignBrief failed:", error.message); }
  return null;
}

// ────────────────────────────────────────────────────────────
// 17. AI AUTOCOMPLETE — Smart search suggestions
// ────────────────────────────────────────────────────────────

export async function aiAutocomplete(partial) {
  if (!partial || partial.length < 2) return [];
  try {
    const response = await callAnthropic({
      messages: [{ role: "user", content: `A designer is typing a furniture search query. So far they've typed: "${partial}"

Suggest 6 completions. Think about what furniture products, styles, materials, or vendors they might be looking for. Be specific and use real furniture industry terminology.

Return ONLY a JSON array of strings: ["suggestion 1", "suggestion 2", ...]` }],
      maxTokens: 256,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);
    if (Array.isArray(parsed)) return parsed.slice(0, 6);
  } catch (error) { console.error("aiAutocomplete failed:", error.message); }
  return [];
}

// ────────────────────────────────────────────────────────────
// 18. AI WEEKLY DIGEST — Curated industry digest
// ────────────────────────────────────────────────────────────

export async function aiWeeklyDigest(userContext) {
  try {
    const recentSearches = userContext?.recent_searches || [];
    const projectTypes = userContext?.project_types || [];
    const prompt = `Generate a weekly furniture industry digest for a designer.
${recentSearches.length ? `Their recent searches: ${recentSearches.join(", ")}` : ""}
${projectTypes.length ? `Their active project types: ${projectTypes.join(", ")}` : ""}
Today is ${new Date().toISOString().split("T")[0]}.

Search the web for the latest furniture industry news, new collections, and design trends.

Return ONLY a JSON object:
{
  "week_of": "date",
  "headline": "catchy headline for this week's digest",
  "editor_picks": [
    { "product_name": "name", "vendor_name": "vendor", "product_url": "url", "image_url": "url or null", "retail_price": null or number, "why_picked": "why this is an editor pick" }
  ],
  "trending_searches": ["popular search terms"],
  "industry_news": [
    { "headline": "news headline", "summary": "1-2 sentences", "source": "source name" }
  ],
  "new_collections": [
    { "vendor": "vendor name", "collection": "collection name", "description": "brief" }
  ],
  "personalized": [
    { "recommendation": "what to check out", "reason": "why based on their history" }
  ],
  "pro_tip": "one actionable industry insight"
}`;
    const response = await callAnthropic({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      model: MODEL_SMART,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);
    if (parsed?.headline) return { ...parsed, ai_generated: true };
  } catch (error) { console.error("aiWeeklyDigest failed:", error.message); }
  return null;
}

// ────────────────────────────────────────────────────────────
// 19. CONVERSATIONAL SEARCH — Multi-turn search refinement
// ────────────────────────────────────────────────────────────

/**
 * Conversational search refinement.
 * Takes the full conversation history and returns a refined search intent + new results.
 * Each message in the thread builds on the previous context.
 */
export async function aiConversationalSearch(conversationHistory, previousResults) {
  const previousContext = buildPreviousResultsContext(previousResults);

  const system = `You are a senior furniture sourcing specialist at SPEC, a to-the-trade furniture platform used by interior designers and trade professionals. You're helping a designer refine a product search through conversation.

CONTEXT — CURRENT RESULTS:
${previousContext}

YOUR ROLE:
- Each message from the designer builds on the previous search context
- You understand furniture-specific refinements: "warmer tones", "more high end", "something similar but bigger", "what goes with this", "show me the whole collection"
- Recognize action commands:
  - "compare the first and third one" → action: "compare" with product indices
  - "add the second one to my project" → action: "add_to_project" with product index
  - "generate a quote with these top 3" → action: "generate_quote" with product indices
  - "save this search" → action: "save_search"
- Respond conversationally but concisely — like a knowledgeable trade rep, not a chatbot. 1-3 sentences max.

TRADE BRAND KNOWLEDGE:
- SPEC is trade-only. NEVER suggest consumer brands (no IKEA, Wayfair, West Elm, Pottery Barn, CB2, Target, Amazon, Article, Castlery).
- Luxury/high-end: Baker, Century, Marge Carson, Holly Hunt, EJ Victor, Hickory Chair, Theodore Alexander
- Premium: Bernhardt, Vanguard, Caracole, Lexington, Stickley, Made Goods
- Accessible trade: Four Hands, Universal, Kincaid, Hooker Furniture, CR Laine, Lee Industries
- When the designer says "more high end", shift toward Baker, Century, Marge Carson, Holly Hunt
- When they say "more affordable" or "value", shift toward Four Hands, Universal, Kincaid

RESPONSE FORMAT — respond with ONLY a JSON object (no markdown, no explanation):
{
  "intent": {
    "product_type": "normalized category or null",
    "style": "design style or null",
    "material": "primary material or null",
    "color": "color preference or null",
    "vendor": "specific vendor or null",
    "max_price": null or number,
    "price_tier": "luxury|premium|accessible or null",
    "room_type": "room type or null",
    "size": "size spec or null",
    "shape": "shape or null",
    "attributes": ["other", "notable", "attributes"],
    "summary": "brief natural-language summary of refined search"
  },
  "search_queries": ["query1", "query2", "query3", "query4", "query5", "query6"],
  "assistant_message": "Your conversational response to the designer (1-3 sentences, knowledgeable, concise)",
  "action": "refine" | "new_search" | "compare" | "add_to_project" | "generate_quote" | "save_search" | null,
  "action_params": { "product_indices": [0, 2] } or null,
  "discovered_products": []
}

NEW SEARCH vs REFINEMENT — THIS IS CRITICAL:
- "new_search": The user mentions a DIFFERENT furniture category or product type. Examples:
  - Previous results showed sofas → user says "credenzas" = NEW SEARCH (completely different product)
  - Previous results showed dining tables → user says "what about beds" = NEW SEARCH
  - Previous results showed accent chairs → user says "now show me coffee tables" = NEW SEARCH
  - User types just a product type name like "ottomans" or "bar stools" = NEW SEARCH
- "refine": The user is adjusting the SAME product type. Examples:
  - "show me in leather" = REFINE (same product, different material)
  - "what about from Bernhardt" = REFINE (same product, different vendor)
  - "something bigger" = REFINE (same product, different size)
  - "more modern" = REFINE (same product, different style)
  - "more like the third one" = REFINE
- "related": New category but related context — carry over style/material/vendor preferences:
  - "what accent chairs go with these" = RELATED (new category, keep style context)
  - "show me matching nightstands" = RELATED

When action is "new_search", the search_queries and intent MUST reflect ONLY the new product type. Do NOT carry over the previous category. If user says "credenzas" after looking at sofas, intent.product_type must be "credenzas" and search_queries must be about credenzas, NOT sofas.

GUIDELINES:
- Generate 5-8 search queries reflecting the correct context based on action type
- For "new_search": queries should be ONLY about the new product, fresh start
- For "refine": queries should build on previous context with modifications
- For "related": queries should be about the new category but carry over style/material preferences
- For "compare", "add_to_project", "generate_quote" — extract the referenced product indices from the conversation
- Keep assistant_message brief and useful — suggest specific vendors or approaches when relevant`;

  try {
    const response = await callAnthropic({
      system,
      messages: conversationHistory,
      maxTokens: 512,
      model: MODEL_FAST,
    });
    const text = extractTextFromResponse(response);
    const parsed = safeJsonParse(text);

    if (parsed && parsed.intent) {
      const intent = {
        summary: parsed.intent.summary || "Refined search",
        product_type: parsed.intent.product_type || null,
        shape: parsed.intent.shape || null,
        style: parsed.intent.style || null,
        material: parsed.intent.material || null,
        color: parsed.intent.color || null,
        vendor: parsed.intent.vendor || null,
        max_price: typeof parsed.intent.max_price === "number" ? parsed.intent.max_price : null,
        price_tier: parsed.intent.price_tier || null,
        max_lead_time_weeks: null,
        room_type: parsed.intent.room_type || null,
        size: parsed.intent.size || null,
        attributes: Array.isArray(parsed.intent.attributes) ? parsed.intent.attributes : [],
        sustainable: false,
        ergonomic: false,
        ai_parsed: true,
      };
      const searchQueries = Array.isArray(parsed.search_queries) ? parsed.search_queries.map(String).filter(Boolean) : [];
      const rawMessage = parsed.assistant_message || "Here are your refined results.";
      const assistantMessage = rawMessage.replace(/<cite[^>]*>|<\/cite>/g, "");
      const action = parsed.action || null;
      const actionParams = parsed.action_params || null;
      const discoveredProducts = Array.isArray(parsed.discovered_products)
        ? parsed.discovered_products
            .filter((item) => item && item.product_name && item.vendor_name)
            .map((item, idx) => normalizeAiProduct(item, idx))
        : [];

      return {
        intent,
        searchQueries,
        assistantMessage,
        action,
        actionParams,
        discoveredProducts,
      };
    }
  } catch (error) {
    console.error("aiConversationalSearch failed:", error.message);
  }

  // Fallback: extract last user message and build a basic intent
  const lastUserMsg = [...conversationHistory].reverse().find((m) => m.role === "user");
  const fallbackQuery = lastUserMsg?.content || "furniture";
  return {
    intent: { ...buildSearchIntent(fallbackQuery), ai_parsed: false },
    searchQueries: buildQueryVariants(fallbackQuery, buildSearchIntent(fallbackQuery)),
    assistantMessage: "Let me search for that.",
    action: "refine",
    actionParams: null,
    discoveredProducts: [],
  };
}

function buildPreviousResultsContext(previousResults) {
  if (!previousResults || previousResults.length === 0) {
    return "No results currently shown.";
  }
  const summaries = previousResults.slice(0, 20).map((p, i) => {
    const price = p.retail_price ? `$${p.retail_price.toLocaleString()}` : (p.wholesale_price ? `$${p.wholesale_price.toLocaleString()} wholesale` : "price TBD");
    return `${i + 1}. ${p.product_name || "Unknown"} by ${p.vendor_name || p.manufacturer_name || "Unknown"} — ${p.category || p.product_type || "uncategorized"}, ${p.material || "material N/A"}, ${price}`;
  });
  return `Currently showing ${previousResults.length} products:\n${summaries.join("\n")}`;
}
