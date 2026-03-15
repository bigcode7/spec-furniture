import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

type Manufacturer = {
  domain: string;
  name: string;
  aliases?: string[];
};

type SearchIntent = {
  product_type: string;
  style: string | null;
  material: string | null;
  color: string | null;
  max_price: number | null;
  max_lead_time_weeks: number | null;
  comfort_level: string | null;
  ergonomic: boolean;
  sustainable: boolean;
  room_context: string | null;
  must_haves: string[];
  preferred_terms: string[];
  avoid_terms: string[];
  search_queries: string[];
  confidence: number;
  summary: string;
};

type RawProduct = {
  id: string;
  key: string;
  product_name: string;
  manufacturer_name: string;
  domain: string;
  portal_url: string;
  image_url: string | null;
  thumbnail_url: string | null;
  snippet: string;
  source: string;
  query_used: string;
  title_text: string;
  metadata: Record<string, unknown>;
};

type PageEnrichment = {
  canonical_url: string | null;
  product_name: string | null;
  image_url: string | null;
  description: string | null;
  brand: string | null;
  product_page_confidence: number;
  signals: string[];
};

type VendorAdapter = {
  domains: string[];
  productPathKeywords?: string[];
  rejectPathKeywords?: string[];
  titleSuffixes?: string[];
  preferredImageHosts?: string[];
  extractors?: Array<(html: string, url: string) => Partial<PageEnrichment> | null>;
};

const MANUFACTURERS: Manufacturer[] = [
  { domain: "hookerfurniture.com", name: "Hooker Furniture", aliases: ["hooker", "hooker furnishings"] },
  { domain: "bernhardt.com", name: "Bernhardt" },
  { domain: "fourhands.com", name: "Four Hands" },
  { domain: "universalfurniture.com", name: "Universal Furniture" },
  { domain: "theodorealexander.com", name: "Theodore Alexander" },
  { domain: "vanguardfurniture.com", name: "Vanguard Furniture" },
  { domain: "hickorychair.com", name: "Hickory Chair" },
  { domain: "caracole.com", name: "Caracole" },
  { domain: "lexington.com", name: "Lexington Home Brands", aliases: ["lexington home brands"] },
  { domain: "bassettfurniture.com", name: "Bassett Furniture" },
  { domain: "highlandhouse.com", name: "Highland House" },
  { domain: "craftmasterfurniture.com", name: "Craftmaster Furniture", aliases: ["craftmaster.com", "craftmaster"] },
  { domain: "stickley.com", name: "Stickley", aliases: ["stickleyfurniture.com", "stickley furniture"] },
  { domain: "bradington-young.com", name: "Bradington-Young", aliases: ["bradingtonyoung.com"] },
  { domain: "broyhillfurniture.com", name: "Broyhill", aliases: ["broyhill.com"] },
  { domain: "thomasville.com", name: "Thomasville" },
  { domain: "drexelheritage.com", name: "Drexel Heritage" },
  { domain: "hekman.com", name: "Hekman Furniture" },
  { domain: "hfdesignhouse.com", name: "Hooker Furnishings Upholstery", aliases: ["hfdesignhouse"] },
  { domain: "rowefurniture.com", name: "Rowe Furniture", aliases: ["rowe-furniture.com"] },
  { domain: "leejofa.com", name: "Lee Jofa" },
  { domain: "arteriorshome.com", name: "Arteriors" },
  { domain: "curreyandcompany.com", name: "Currey & Company" },
  { domain: "visualcomfort.com", name: "Visual Comfort" },
  { domain: "palecek.com", name: "Palecek" },
  { domain: "johnrichard.com", name: "John-Richard", aliases: ["john richard"] },
  { domain: "schumacher.com", name: "Schumacher" },
  { domain: "donghia.com", name: "Donghia" },
  { domain: "designmasterfurniture.com", name: "Designmaster Furniture", aliases: ["designmaster.com"] },
  { domain: "bakerfurniture.com", name: "Baker Furniture" },
  { domain: "centuryfurniture.com", name: "Century Furniture" },
  { domain: "maitland-smith.com", name: "Maitland-Smith", aliases: ["maitland smith"] },
  { domain: "margecarson.com", name: "Marge Carson" },
  { domain: "kindelfurniture.com", name: "Kindel Furniture" },
  { domain: "globalviews.com", name: "Global Views" },
  { domain: "gabby.com", name: "Gabby" },
  { domain: "surya.com", name: "Surya" },
  { domain: "uttermost.com", name: "Uttermost" },
  { domain: "jaipurliving.com", name: "Jaipur Living" },
  { domain: "loloi.com", name: "Loloi" },
  { domain: "caracole.com", name: "Caracole" },
  { domain: "bernhardt.com", name: "Bernhardt" },
  { domain: "mfafurniture.com", name: "MFA Furniture" },
  { domain: "ofsfurniture.com", name: "OFS" },
  { domain: "hbf.com", name: "HBF" },
  { domain: "knoll.com", name: "Knoll" },
  { domain: "hay.com", name: "HAY" },
  { domain: "muuto.com", name: "Muuto" },
  { domain: "ethanallen.com", name: "Ethan Allen" },
  { domain: "flexsteel.com", name: "Flexsteel" },
  { domain: "coasterfurniture.com", name: "Coaster Fine Furniture" },
  { domain: "ashleyfurniture.com", name: "Ashley Furniture" },
  { domain: "artfurniture.com", name: "ART Furniture" },
];

const NORMALIZED_MANUFACTURERS = dedupeManufacturers(MANUFACTURERS);
const DOMAIN_MAP = buildDomainMap(NORMALIZED_MANUFACTURERS);
const DOMAIN_CHUNKS = chunk(NORMALIZED_MANUFACTURERS, 10).map((items) => items.map((item) => item.domain));
const PRIORITY_VENDOR_DOMAINS = [
  "hookerfurniture.com",
  "bernhardt.com",
  "fourhands.com",
  "universalfurniture.com",
  "theodorealexander.com",
  "caracole.com",
  "centuryfurniture.com",
  "bakerfurniture.com",
  "vanguardfurniture.com",
  "lexington.com",
  "bassettfurniture.com",
  "stickley.com",
];
const PRODUCT_TYPES = [
  "sofa", "sectional", "chair", "accent chair", "office chair", "dining chair", "counter stool", "bar stool",
  "dining table", "coffee table", "side table", "console table", "end table", "bed", "dresser", "nightstand",
  "credenza", "sideboard", "desk", "bookshelf", "bookcase", "bench", "ottoman", "rug", "lighting", "sconce",
  "chandelier", "pendant", "outdoor sofa", "outdoor chair"
];
const VENDOR_ADAPTERS: VendorAdapter[] = [
  {
    domains: ["fourhands.com"],
    productPathKeywords: ["/product/", "/products/", "/catalog/", "/item/"],
    rejectPathKeywords: ["/search", "/trade-program", "/collections"],
    titleSuffixes: ["| Four Hands", "| Shop Four Hands"],
    preferredImageHosts: ["cdn.fourhands.com"],
    extractors: [extractApolloStateProduct, extractRegexProductPayload],
  },
  {
    domains: ["bernhardt.com"],
    productPathKeywords: ["/product/", "/products/", "/collection/"],
    rejectPathKeywords: ["/search", "/furniture/"],
    titleSuffixes: ["| Bernhardt", "| Bernhardt Furniture"],
    extractors: [extractNextDataProduct, extractRegexProductPayload],
  },
  {
    domains: ["hookerfurniture.com", "hfdesignhouse.com"],
    productPathKeywords: ["/product/", "/products/", "/item/"],
    rejectPathKeywords: ["/search", "/collections", "/catalogs"],
    titleSuffixes: ["| Hooker Furniture", "| Hooker Furnishings", "| HF Design House"],
    extractors: [extractMagentoProductData, extractRegexProductPayload],
  },
  {
    domains: ["universalfurniture.com", "vanguardfurniture.com", "caracole.com"],
    productPathKeywords: ["/product/", "/products/", "/item/"],
    rejectPathKeywords: ["/search", "/collections"],
    titleSuffixes: ["| Universal Furniture", "| Vanguard Furniture", "| Caracole"],
    extractors: [extractNextDataProduct, extractApolloStateProduct],
  },
  {
    domains: ["theodorealexander.com"],
    productPathKeywords: ["/product/", "/products/", "/collection/", "/item/"],
    rejectPathKeywords: ["/search", "/collections", "/catalogs"],
    titleSuffixes: ["| Theodore Alexander"],
    extractors: [extractNextDataProduct, extractRegexProductPayload],
  },
  {
    domains: ["centuryfurniture.com", "bakerfurniture.com", "lexington.com", "bassettfurniture.com", "stickley.com"],
    productPathKeywords: ["/product/", "/products/", "/item/", "/details/", "/sku/"],
    rejectPathKeywords: ["/search", "/collections", "/inspiration", "/room/", "/shop/"],
    titleSuffixes: ["| Century Furniture", "| Baker Furniture", "| Lexington", "| Bassett Furniture", "| Stickley"],
    extractors: [extractMagentoProductData, extractApolloStateProduct, extractRegexProductPayload],
  },
  {
    domains: ["vanguardfurniture.com", "hickorychair.com"],
    productPathKeywords: ["/product/", "/products/", "/item/"],
    rejectPathKeywords: ["/search", "/fabrics", "/finishes"],
    titleSuffixes: ["| Vanguard Furniture", "| Hickory Chair"],
    extractors: [extractRegexProductPayload],
  },
  {
    domains: ["arteriorshome.com", "visualcomfort.com", "curreyandcompany.com", "johnrichard.com"],
    productPathKeywords: ["/product/", "/products/", "/sku/", "/item/"],
    rejectPathKeywords: ["/search", "/category/", "/catalog/"],
    titleSuffixes: ["| Arteriors", "| Visual Comfort", "| Currey & Company", "| John-Richard"],
    extractors: [extractShopifyProductJson, extractRegexProductPayload],
  },
  {
    domains: ["palecek.com", "schumacher.com", "donghia.com", "bakerfurniture.com", "centuryfurniture.com"],
    productPathKeywords: ["/product/", "/products/", "/item/"],
    rejectPathKeywords: ["/search", "/collection", "/inspiration"],
    titleSuffixes: ["| Palecek", "| Schumacher", "| Donghia", "| Baker Furniture", "| Century Furniture"],
    extractors: [extractRegexProductPayload, extractMagentoProductData],
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { query } = await req.json();
    if (!query?.trim()) return Response.json({ error: "Query required" }, { status: 400 });

    const serpApiKey = Deno.env.get("SERPAPI_KEY");
    if (!serpApiKey) return Response.json({ error: "SERPAPI_KEY not configured" }, { status: 500 });

    const intent = await parseIntent(base44, query.trim());
    const queryVariants = buildQueryVariants(query.trim(), intent);
    const searchResults = await runVendorSearches(queryVariants, serpApiKey);
    const fallbackVendorResults = [];
    const initialRawProducts = mergeSearchResults(searchResults);
    if (initialRawProducts.length < 18) {
      const focusedResults = await runFocusedVendorSearches(queryVariants, serpApiKey);
      fallbackVendorResults.push(...focusedResults);
    }
    const catalogFallbackProducts = await fetchInternalCatalogFallback(base44, query.trim(), intent);
    const rawProducts = mergeRawProductLists([
      initialRawProducts,
      mergeSearchResults(fallbackVendorResults),
      catalogFallbackProducts,
    ]);

    if (rawProducts.length === 0) {
      return Response.json({
        query,
        intent,
        products: [],
        total: 0,
        diagnostics: {
          query_variants: queryVariants,
          manufacturer_count: NORMALIZED_MANUFACTURERS.length,
          domains_queried: DOMAIN_CHUNKS.flat().length,
          fallback_mode: true,
        },
      });
    }

    const heuristicallyScored = scoreHeuristically(rawProducts, intent, query.trim());
    const enrichedProducts = await enrichTopProducts(heuristicallyScored);
    const rerankedProducts = await rerankWithAI(base44, enrichedProducts, intent, query.trim());
    const products = finalizeProducts(rerankedProducts, intent);

    return Response.json({
      query,
      intent,
      products,
      total: products.length,
      diagnostics: {
        query_variants: queryVariants,
        manufacturer_count: new Set(products.map((product) => product.manufacturer_name)).size,
        raw_count: rawProducts.length,
        domain_pool_size: NORMALIZED_MANUFACTURERS.length,
        source_breakdown: countBy(products, "source"),
        enriched_count: products.filter((product) => product.product_page_confidence >= 60).length,
        manufacturer_breakdown: countBy(products, "manufacturer_name"),
        fallback_vendor_queries: fallbackVendorResults.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
});

async function parseIntent(base44: any, query: string): Promise<SearchIntent> {
  const prompt = `You are an expert furniture sourcing search planner for interior designers, retailers, and trade buyers.

Parse the search request into structured sourcing intent.

User query:
"${query}"

Rules:
- Focus on actual furniture/product sourcing intent.
- Product type must be a concrete furniture or decor type.
- search_queries should be highly targeted manufacturer-site search phrases.
- must_haves are non-negotiable requirements inferred from the query.
- preferred_terms are softer descriptors worth boosting.
- avoid_terms are attributes or product types to avoid if implied by the query.
- Use null when unknown. Return valid JSON only.
`;

  const parsed = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        product_type: { type: "string" },
        style: { type: ["string", "null"] },
        material: { type: ["string", "null"] },
        color: { type: ["string", "null"] },
        max_price: { type: ["number", "null"] },
        max_lead_time_weeks: { type: ["number", "null"] },
        comfort_level: { type: ["string", "null"] },
        ergonomic: { type: "boolean" },
        sustainable: { type: "boolean" },
        room_context: { type: ["string", "null"] },
        must_haves: { type: "array", items: { type: "string" } },
        preferred_terms: { type: "array", items: { type: "string" } },
        avoid_terms: { type: "array", items: { type: "string" } },
        search_queries: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
        summary: { type: "string" },
      },
    },
  });

  return {
    product_type: sanitizeText(parsed?.product_type) || "furniture",
    style: sanitizeNullableText(parsed?.style),
    material: sanitizeNullableText(parsed?.material),
    color: sanitizeNullableText(parsed?.color),
    max_price: typeof parsed?.max_price === "number" ? parsed.max_price : null,
    max_lead_time_weeks: typeof parsed?.max_lead_time_weeks === "number" ? parsed.max_lead_time_weeks : null,
    comfort_level: sanitizeNullableText(parsed?.comfort_level),
    ergonomic: Boolean(parsed?.ergonomic),
    sustainable: Boolean(parsed?.sustainable),
    room_context: sanitizeNullableText(parsed?.room_context),
    must_haves: sanitizeStringArray(parsed?.must_haves),
    preferred_terms: sanitizeStringArray(parsed?.preferred_terms),
    avoid_terms: sanitizeStringArray(parsed?.avoid_terms),
    search_queries: sanitizeStringArray(parsed?.search_queries),
    confidence: typeof parsed?.confidence === "number" ? parsed.confidence : 70,
    summary: sanitizeText(parsed?.summary) || query,
  };
}

function buildQueryVariants(query: string, intent: SearchIntent): string[] {
  const variants = new Set<string>();
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  variants.add(normalizedQuery);

  for (const candidate of intent.search_queries.slice(0, 4)) {
    variants.add(candidate);
  }

  const deterministic = [
    [intent.color, intent.material, intent.style, intent.product_type].filter(Boolean).join(" "),
    [intent.style, intent.product_type, intent.room_context].filter(Boolean).join(" "),
    [intent.material, intent.product_type, ...intent.must_haves.slice(0, 2)].filter(Boolean).join(" "),
    [intent.product_type, ...intent.preferred_terms.slice(0, 3)].filter(Boolean).join(" "),
  ];

  for (const candidate of deterministic) {
    if (candidate.trim()) variants.add(candidate.trim());
  }

  return Array.from(variants)
    .map((entry) => entry.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 4);
}

async function runVendorSearches(queryVariants: string[], serpApiKey: string) {
  const jobs = [];

  for (const query of queryVariants) {
    for (const domains of DOMAIN_CHUNKS) {
      const siteQuery = domains.map((domain) => `site:${domain}`).join(" OR ");
      const fullQuery = `${query} (${siteQuery})`;
      jobs.push(fetchSerpApi("google_images", fullQuery, serpApiKey, 20, query, domains));
      jobs.push(fetchSerpApi("google", fullQuery, serpApiKey, 20, query, domains));
    }
  }

  const settled = await Promise.allSettled(jobs);
  return settled
    .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter(Boolean);
}

async function runFocusedVendorSearches(queryVariants: string[], serpApiKey: string) {
  const jobs = [];
  const variants = queryVariants.slice(0, 2);

  for (const query of variants) {
    for (const domain of PRIORITY_VENDOR_DOMAINS) {
      const fullQuery = `${query} site:${domain}`;
      jobs.push(fetchSerpApi("google_images", fullQuery, serpApiKey, 8, query, [domain]));
      jobs.push(fetchSerpApi("google", fullQuery, serpApiKey, 8, query, [domain]));
    }
  }

  const settled = await Promise.allSettled(jobs);
  return settled
    .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter(Boolean);
}

async function fetchSerpApi(
  engine: "google" | "google_images",
  fullQuery: string,
  serpApiKey: string,
  num: number,
  queryVariant: string,
  domains: string[],
) {
  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", engine);
  url.searchParams.set("q", fullQuery);
  url.searchParams.set("api_key", serpApiKey);
  url.searchParams.set("num", String(num));
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");

  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const data = await response.json();

  return {
    engine,
    queryVariant,
    domains,
    imageResults: Array.isArray(data?.images_results) ? data.images_results : [],
    organicResults: Array.isArray(data?.organic_results) ? data.organic_results : [],
  };
}

function mergeSearchResults(searchPayloads: any[]): RawProduct[] {
  const merged = new Map<string, RawProduct>();

  for (const payload of searchPayloads) {
    for (const result of payload.imageResults || []) {
      const candidate = toRawProduct(result, payload.queryVariant, "image");
      if (candidate) upsertRawProduct(merged, candidate);
    }

    for (const result of payload.organicResults || []) {
      const candidate = toRawProduct(result, payload.queryVariant, "web");
      if (candidate) upsertRawProduct(merged, candidate);
    }
  }

  return Array.from(merged.values());
}

function mergeRawProductLists(productLists: RawProduct[][]) {
  const merged = new Map<string, RawProduct>();

  for (const list of productLists) {
    for (const product of list) {
      upsertRawProduct(merged, product);
    }
  }

  return Array.from(merged.values());
}

function toRawProduct(result: any, queryUsed: string, source: string): RawProduct | null {
  const link = result?.link || result?.source || result?.thumbnail || "";
  const domain = extractDomain(link);
  const manufacturer = findManufacturer(domain, `${result?.title || ""} ${result?.snippet || ""}`);
  if (!manufacturer) return null;

  const title = sanitizeText(result?.title);
  const productName = cleanProductName(title || sanitizeText(result?.snippet) || manufacturer.name);
  const portalUrl = normalizeUrl(result?.link || result?.source || "");
  if (!portalUrl) return null;

  const key = `${manufacturer.domain}::${canonicalizeUrl(portalUrl)}::${normalizeText(productName)}`;
  const imageUrl = normalizeUrl(result?.original || result?.thumbnail || result?.thumbnail_url || result?.image || "");

  return {
    id: crypto.randomUUID(),
    key,
    product_name: productName,
    manufacturer_name: manufacturer.name,
    domain: manufacturer.domain,
    portal_url: portalUrl,
    image_url: imageUrl,
    thumbnail_url: imageUrl,
    snippet: sanitizeText(result?.snippet) || "",
    source,
    query_used: queryUsed,
    title_text: title,
    metadata: {
      position: result?.position ?? null,
      source,
    },
  };
}

async function fetchInternalCatalogFallback(base44: any, originalQuery: string, intent: SearchIntent): Promise<RawProduct[]> {
  const fallback: RawProduct[] = [];
  const searchText = normalizeText([
    originalQuery,
    intent.product_type,
    intent.style,
    intent.material,
    intent.color,
    ...intent.must_haves,
    ...intent.preferred_terms,
  ].filter(Boolean).join(" "));

  try {
    const [listings, products] = await Promise.all([
      safelyListEntity(base44, "ManufacturerListing", 200),
      safelyListEntity(base44, "Product", 200),
    ]);

    for (const listing of listings) {
      const haystack = normalizeText([
        listing.product_name,
        listing.manufacturer_name,
        listing.material,
        listing.style_name,
        listing.dimensions_summary,
        ...(listing.key_features || []),
      ].filter(Boolean).join(" "));

      if (!isRelevantFallbackMatch(haystack, searchText, intent)) continue;
      fallback.push({
        id: listing.id || crypto.randomUUID(),
        key: `${extractDomain(listing.portal_url || "")}::${canonicalizeUrl(listing.portal_url || listing.image_url || listing.id || crypto.randomUUID())}::${normalizeText(listing.product_name || "")}`,
        product_name: cleanProductName(sanitizeText(listing.product_name)),
        manufacturer_name: sanitizeText(listing.manufacturer_name) || "Manufacturer",
        domain: extractDomain(listing.portal_url || ""),
        portal_url: normalizeUrl(listing.portal_url) || `https://catalog.local/listing/${encodeURIComponent(listing.id || normalizeText(listing.product_name || "listing"))}`,
        image_url: normalizeUrl(listing.image_url) || null,
        thumbnail_url: normalizeUrl(listing.image_url) || null,
        snippet: sanitizeText(listing.description || listing.dimensions_summary || ""),
        source: "catalog_listing",
        query_used: originalQuery,
        title_text: sanitizeText(listing.product_name),
        metadata: { internal: true },
      });
    }

    for (const product of products) {
      const haystack = normalizeText([
        product.name,
        product.manufacturer_name,
        product.category,
        product.style,
        product.material,
        product.description,
        ...(product.features || []),
      ].filter(Boolean).join(" "));

      if (!isRelevantFallbackMatch(haystack, searchText, intent)) continue;
      const imageUrl = normalizeUrl(product.thumbnail || product.images?.[0] || "");
      fallback.push({
        id: product.id || crypto.randomUUID(),
        key: `${normalizeText(product.manufacturer_name)}::${normalizeText(product.name)}::product`,
        product_name: cleanProductName(sanitizeText(product.name)),
        manufacturer_name: sanitizeText(product.manufacturer_name) || "Manufacturer",
        domain: "",
        portal_url: normalizeUrl(product.portal_url) || `https://catalog.local/${encodeURIComponent(product.id || normalizeText(product.name))}`,
        image_url: imageUrl,
        thumbnail_url: imageUrl,
        snippet: sanitizeText(product.description),
        source: "catalog_product",
        query_used: originalQuery,
        title_text: sanitizeText(product.name),
        metadata: { internal: true },
      });
    }
  } catch {
    return [];
  }

  return fallback;
}

function upsertRawProduct(store: Map<string, RawProduct>, candidate: RawProduct) {
  const existing = store.get(candidate.key);
  if (!existing) {
    store.set(candidate.key, candidate);
    return;
  }

  store.set(candidate.key, {
    ...existing,
    image_url: existing.image_url || candidate.image_url,
    thumbnail_url: existing.thumbnail_url || candidate.thumbnail_url,
    snippet: longestText(existing.snippet, candidate.snippet),
    source: existing.source === "image" || candidate.source !== "image" ? existing.source : candidate.source,
    query_used: existing.query_used,
    title_text: longestText(existing.title_text, candidate.title_text),
  });
}

function scoreHeuristically(products: RawProduct[], intent: SearchIntent, originalQuery: string) {
  const intentTokens = tokenize([
    originalQuery,
    intent.product_type,
    intent.style,
    intent.material,
    intent.color,
    intent.room_context,
    ...intent.must_haves,
    ...intent.preferred_terms,
  ].filter(Boolean).join(" "));

  return products.map((product) => {
    const haystack = `${product.product_name} ${product.snippet} ${product.query_used} ${product.manufacturer_name}`.toLowerCase();
    let score = 20;
    const criteriaMatched: string[] = [];
    const criteriaMissed: string[] = [];

    if (matchesPhrase(haystack, intent.product_type)) {
      score += 28;
      criteriaMatched.push(intent.product_type);
    } else {
      const inferredType = inferProductType(haystack);
      if (inferredType && inferredType === normalizeText(intent.product_type)) {
        score += 18;
        criteriaMatched.push(intent.product_type);
      } else {
        criteriaMissed.push(intent.product_type);
      }
    }

    if (intent.style) {
      if (matchesPhrase(haystack, intent.style)) {
        score += 16;
        criteriaMatched.push(intent.style);
      } else {
        criteriaMissed.push(intent.style);
      }
    }

    if (intent.material) {
      if (matchesPhrase(haystack, intent.material) || extractMaterial(haystack) === normalizeText(intent.material)) {
        score += 16;
        criteriaMatched.push(intent.material);
      } else {
        criteriaMissed.push(intent.material);
      }
    }

    if (intent.color) {
      if (matchesPhrase(haystack, intent.color)) {
        score += 10;
        criteriaMatched.push(intent.color);
      } else {
        criteriaMissed.push(intent.color);
      }
    }

    if (intent.sustainable) {
      if (containsAny(haystack, ["sustainable", "recycled", "eco", "fsc", "greenguard", "certified"])) {
        score += 8;
        criteriaMatched.push("sustainable");
      } else {
        criteriaMissed.push("sustainable");
      }
    }

    if (intent.ergonomic) {
      if (containsAny(haystack, ["ergonomic", "lumbar", "support", "task chair", "office"])) {
        score += 8;
        criteriaMatched.push("ergonomic");
      } else {
        criteriaMissed.push("ergonomic");
      }
    }

    for (const token of intent.must_haves.slice(0, 5)) {
      if (matchesPhrase(haystack, token)) {
        score += 6;
        criteriaMatched.push(token);
      } else {
        criteriaMissed.push(token);
      }
    }

    for (const token of intent.preferred_terms.slice(0, 5)) {
      if (matchesPhrase(haystack, token)) {
        score += 3;
        criteriaMatched.push(token);
      }
    }

    for (const token of intent.avoid_terms.slice(0, 5)) {
      if (matchesPhrase(haystack, token)) {
        score -= 12;
        criteriaMissed.push(`avoid:${token}`);
      }
    }

    const lexicalOverlap = countTokenOverlap(intentTokens, tokenize(haystack));
    score += Math.min(12, lexicalOverlap * 1.5);

    if (product.image_url) score += 6;
    if (product.source === "image") score += 5;
    if (looksLikeProductPage(product.portal_url)) score += 8;

    return {
      ...product,
      material: extractMaterial(haystack),
      inferred_product_type: inferProductType(haystack),
      relevance_score: Math.max(5, Math.min(99, Math.round(score))),
      criteria_matched: unique(criteriaMatched).slice(0, 8),
      criteria_missed: unique(criteriaMissed).slice(0, 8),
      reasoning: buildReasoning(product, intent, criteriaMatched),
      product_page_confidence: looksLikeProductPage(product.portal_url) ? 55 : 25,
      vendor_signals: [],
    };
  }).sort((a, b) => b.relevance_score - a.relevance_score);
}

async function enrichTopProducts(products: any[]) {
  const candidates = products.slice(0, 24);
  const remaining = products.slice(24);
  const enriched: any[] = [];

  for (const group of chunk(candidates, 6)) {
    const batch = await Promise.all(group.map(async (product) => {
      const enrichment = await fetchPageEnrichment(product.portal_url);
      return mergeEnrichment(product, enrichment);
    }));
    enriched.push(...batch);
  }

  return [...enriched, ...remaining];
}

async function rerankWithAI(base44: any, products: any[], intent: SearchIntent, query: string) {
  const topCandidates = products.slice(0, 50);
  const batches = chunk(topCandidates, 15);
  const aiScores = new Map<string, any>();

  for (const group of batches) {
    const prompt = `You are ranking manufacturer-site furniture search results.

User query: "${query}"
Intent:
${JSON.stringify(intent, null, 2)}

Candidates:
${group.map((product, index) => (
      `${index}: ${product.product_name} | ${product.manufacturer_name} | ${product.snippet} | heuristic=${product.relevance_score} | page_confidence=${product.product_page_confidence || 0} | signals=${(product.vendor_signals || []).join(", ")}`
)).join("\n")}

Return JSON only. Adjust the score for true relevance to the user's request. Favor exact product type, style/material/color alignment, likely product pages, manufacturer-site specificity, and candidates enriched from page metadata or structured product data. Penalize category pages or vague matches.
`;

    try {
      const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            scores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "number" },
                  score: { type: "number" },
                  reasoning: { type: "string" },
                  match_label: { type: "string" },
                  criteria_matched: { type: "array", items: { type: "string" } },
                  criteria_missed: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      });

      for (const item of response?.scores || []) {
        const product = group[item.index];
        if (!product) continue;
        aiScores.set(product.key, item);
      }
    } catch {
      // Heuristic scores remain the fallback.
    }
  }

  return products.map((product) => {
    const ai = aiScores.get(product.key);
    if (!ai) return product;
    return {
      ...product,
      relevance_score: Math.max(product.relevance_score, Math.min(99, Math.round(ai.score || product.relevance_score))),
      reasoning: sanitizeText(ai.reasoning) || product.reasoning,
      criteria_matched: unique([...(product.criteria_matched || []), ...(ai.criteria_matched || [])]).slice(0, 8),
      criteria_missed: unique([...(ai.criteria_missed || []), ...(product.criteria_missed || [])]).slice(0, 8),
      match_label: sanitizeText(ai.match_label) || product.match_label,
    };
  }).sort((a, b) => b.relevance_score - a.relevance_score);
}

function finalizeProducts(products: any[], intent: SearchIntent) {
  return products
    .filter((product) => product.relevance_score >= 48)
    .slice(0, 48)
    .map((product) => ({
      id: product.id,
      product_name: product.product_name,
      manufacturer_name: product.manufacturer_name,
      portal_url: product.portal_url,
      image_url: product.image_url,
      thumbnail_url: product.thumbnail_url,
      snippet: product.snippet,
      source: product.source,
      query_used: product.query_used,
      material: product.material,
      product_type: product.inferred_product_type || normalizeText(intent.product_type),
      relevance_score: product.relevance_score,
      criteria_matched: product.criteria_matched || [],
      criteria_missed: product.criteria_missed || [],
      reasoning: product.reasoning || "Strong manufacturer-site match.",
      match_label: product.match_label || deriveMatchLabel(product.relevance_score),
      domain: product.domain,
      product_page_confidence: product.product_page_confidence || 0,
      vendor_signals: product.vendor_signals || [],
    }));
}

function buildReasoning(product: RawProduct, intent: SearchIntent, criteriaMatched: string[]) {
  const segments = [];
  if (criteriaMatched.length > 0) segments.push(`Matches ${criteriaMatched.slice(0, 3).join(", ")}`);
  if (product.source === "image") segments.push("includes product image");
  if (looksLikeProductPage(product.portal_url)) segments.push("direct product page");
  if (intent.product_type && !segments.length) segments.push(`best available match for ${intent.product_type}`);
  return segments.join(" · ");
}

async function fetchPageEnrichment(url: string): Promise<PageEnrichment | null> {
  if (!url) return null;

  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; SPECBot/1.0; +https://spec.app)",
        "accept": "text/html,application/xhtml+xml",
      },
    }, 4500);

    if (!response.ok) return null;
    const html = (await response.text()).slice(0, 300_000);
    return parsePageEnrichment(html, url);
  } catch {
    return null;
  }
}

function parsePageEnrichment(html: string, fallbackUrl: string): PageEnrichment | null {
  const adapter = getVendorAdapter(fallbackUrl);
  const ogTitle = cleanAdapterTitle(
    extractMetaContent(html, "property", "og:title") || extractMetaContent(html, "name", "twitter:title"),
    adapter,
  );
  const ogImage = extractMetaContent(html, "property", "og:image") || extractMetaContent(html, "name", "twitter:image");
  const description = extractMetaContent(html, "property", "og:description")
    || extractMetaContent(html, "name", "description")
    || extractMetaContent(html, "name", "twitter:description");
  const canonical = extractCanonicalUrl(html) || fallbackUrl;
  const titleTag = cleanAdapterTitle(extractTagTitle(html), adapter);
  const jsonLd = extractProductFromJsonLd(html);
  const adapterExtraction = runVendorExtractors(adapter, html, fallbackUrl);
  const productName = cleanProductName(
    adapterExtraction?.product_name
    || jsonLd?.name
    || ogTitle
    || titleTag
    || "",
  ) || null;
  const imageUrl = pickPreferredImage(
    [
      adapterExtraction?.image_url || "",
      jsonLd?.image || "",
      ogImage || "",
    ],
    adapter,
  );
  const brand = cleanProductName(adapterExtraction?.brand || jsonLd?.brand || "");
  const signals: string[] = [];
  let confidence = 20;

  if (jsonLd?.name) {
    confidence += 30;
    signals.push("jsonld-product");
  }
  if (imageUrl) {
    confidence += 15;
    signals.push("page-image");
  }
  if (extractMetaContent(html, "property", "og:type")?.toLowerCase() === "product") {
    confidence += 20;
    signals.push("og-product");
  }
  if (looksLikeProductPage(canonical)) {
    confidence += 10;
    signals.push("product-url");
  }
  if (description || adapterExtraction?.description) signals.push("page-description");
  if (adapter) {
    confidence += adapterProductConfidence(adapter, canonical);
    signals.push("vendor-adapter");
  }
  if (adapterExtraction?.signals?.length) {
    signals.push(...adapterExtraction.signals);
  }

  return {
    canonical_url: normalizeUrl(canonical),
    product_name: productName,
    image_url: imageUrl,
    description: adapterExtraction?.description || description || null,
    brand: brand || null,
    product_page_confidence: Math.min(95, confidence),
    signals: unique(signals),
  };
}

function mergeEnrichment(product: any, enrichment: PageEnrichment | null) {
  if (!enrichment) return product;

  const nextProductName = chooseBetterProductName(product.product_name, enrichment.product_name);
  const nextPortalUrl = enrichment.canonical_url || product.portal_url;
  const nextImageUrl = enrichment.image_url || product.image_url || product.thumbnail_url || null;
  const nextSnippet = longestText(product.snippet, enrichment.description || "");
  const nextSignals = unique([...(product.vendor_signals || []), ...(enrichment.signals || [])]);
  const confidenceBoost = Math.round((enrichment.product_page_confidence || 0) / 10);

  return {
    ...product,
    product_name: nextProductName,
    portal_url: nextPortalUrl,
    image_url: nextImageUrl,
    thumbnail_url: nextImageUrl,
    snippet: nextSnippet,
    product_page_confidence: Math.max(product.product_page_confidence || 0, enrichment.product_page_confidence || 0),
    vendor_signals: nextSignals,
    relevance_score: Math.min(99, (product.relevance_score || 0) + confidenceBoost),
    key: `${product.domain}::${canonicalizeUrl(nextPortalUrl)}::${normalizeText(nextProductName)}`,
  };
}

function deriveMatchLabel(score: number) {
  if (score >= 92) return "Excellent match";
  if (score >= 80) return "Great match";
  if (score >= 65) return "Strong match";
  return "Relevant match";
}

function buildDomainMap(manufacturers: Manufacturer[]) {
  const map: Record<string, Manufacturer> = {};
  for (const manufacturer of manufacturers) {
    map[manufacturer.domain] = manufacturer;
  }
  return map;
}

function dedupeManufacturers(manufacturers: Manufacturer[]) {
  const seen = new Map<string, Manufacturer>();
  for (const manufacturer of manufacturers) {
    const domain = manufacturer.domain.toLowerCase().replace(/^www\./, "");
    if (!seen.has(domain)) {
      seen.set(domain, { ...manufacturer, domain });
    }
  }
  return Array.from(seen.values());
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

function findManufacturer(domain: string, context = ""): Manufacturer | null {
  if (!domain && !context) return null;
  if (DOMAIN_MAP[domain]) return DOMAIN_MAP[domain];

  for (const [key, manufacturer] of Object.entries(DOMAIN_MAP)) {
    if (domain.endsWith(key) || domain.includes(key)) return manufacturer;
  }

  const normalizedContext = normalizeText(context);
  for (const manufacturer of NORMALIZED_MANUFACTURERS) {
    if (normalizedContext.includes(normalizeText(manufacturer.name))) return manufacturer;
    for (const alias of manufacturer.aliases || []) {
      if (normalizedContext.includes(normalizeText(alias))) return manufacturer;
    }
  }

  return null;
}

function cleanProductName(title: string) {
  return title
    .replace(/\s*[\|\-–].*$/g, "")
    .replace(/\$[\d,]+(?:\.\d+)?/g, "")
    .replace(/\b(shop|buy|sale|available|wholesale)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractMaterial(text: string | null | undefined) {
  const lower = (text || "").toLowerCase();
  if (containsAny(lower, ["performance fabric", "crypton"])) return "performance fabric";
  if (containsAny(lower, ["boucle", "bouclé"])) return "boucle";
  if (containsAny(lower, ["velvet"])) return "velvet";
  if (containsAny(lower, ["leather"])) return "leather";
  if (containsAny(lower, ["linen"])) return "linen";
  if (containsAny(lower, ["rattan", "wicker", "cane"])) return "rattan";
  if (containsAny(lower, ["marble", "travertine", "stone"])) return "marble";
  if (containsAny(lower, ["walnut", "oak", "wood", "wooden", "pine", "ash"])) return "wood";
  if (containsAny(lower, ["metal", "iron", "brass", "steel", "aluminum"])) return "metal";
  if (containsAny(lower, ["glass"])) return "glass";
  if (containsAny(lower, ["recycled", "sustainable", "eco"])) return "sustainable";
  return null;
}

function inferProductType(text: string) {
  const normalized = normalizeText(text);
  for (const productType of PRODUCT_TYPES) {
    if (normalized.includes(normalizeText(productType))) {
      return normalizeText(productType);
    }
  }
  return null;
}

function tokenize(text: string) {
  return unique(
    normalizeText(text)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
}

function normalizeText(text: string | null | undefined) {
  return (text || "")
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function safelyListEntity(base44: any, entityName: string, limit: number) {
  try {
    return await base44.asServiceRole.entities[entityName].list("-created_date", limit);
  } catch {
    try {
      return await base44.asServiceRole.entities[entityName].list(undefined, limit);
    } catch {
      return [];
    }
  }
}

function sanitizeNullableText(value: unknown) {
  const text = sanitizeText(value);
  return text || null;
}

function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => sanitizeText(item)).filter(Boolean).slice(0, 8);
}

function matchesPhrase(haystack: string, phrase: string | null | undefined) {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;
  return haystack.includes(normalizedPhrase);
}

function isRelevantFallbackMatch(haystack: string, searchText: string, intent: SearchIntent) {
  const required = normalizeText(intent.product_type);
  const overlap = countTokenOverlap(tokenize(haystack), tokenize(searchText));
  if (required && haystack.includes(required)) return true;
  if (intent.material && haystack.includes(normalizeText(intent.material)) && overlap >= 2) return true;
  if (intent.style && haystack.includes(normalizeText(intent.style)) && overlap >= 2) return true;
  return overlap >= 3;
}

function containsAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}

function countTokenOverlap(a: string[], b: string[]) {
  const setB = new Set(b);
  return a.reduce((count, token) => count + (setB.has(token) ? 1 : 0), 0);
}

function looksLikeProductPage(url: string) {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();

  return !containsAny(path, ["/search", "/category", "/categories", "/collections", "/catalog", "/products?", "/shop/"]);
}

function normalizeUrl(value: string | null | undefined) {
  const text = sanitizeText(value);
  if (!text) return null;
  try {
    return new URL(text).toString();
  } catch {
    return null;
  }
}

function canonicalizeUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function longestText(a: string, b: string) {
  return (b || "").length > (a || "").length ? b : a;
}

function chooseBetterProductName(existing: string, incoming: string | null) {
  const current = sanitizeText(existing);
  const next = sanitizeText(incoming);
  if (!next) return current;
  if (!current) return next;

  const currentQuality = scoreProductNameQuality(current);
  const nextQuality = scoreProductNameQuality(next);
  return nextQuality > currentQuality ? next : current;
}

function cleanAdapterTitle(value: string, adapter: VendorAdapter | null) {
  let next = sanitizeText(value);
  if (!next || !adapter?.titleSuffixes?.length) return next;
  for (const suffix of adapter.titleSuffixes) {
    if (next.toLowerCase().endsWith(suffix.toLowerCase())) {
      next = next.slice(0, -suffix.length).trim().replace(/[\|\-–:]+$/g, "").trim();
    }
  }
  return next;
}

function getVendorAdapter(url: string) {
  const domain = extractDomain(url);
  return VENDOR_ADAPTERS.find((adapter) => adapter.domains.some((entry) => domain.endsWith(entry))) || null;
}

function adapterProductConfidence(adapter: VendorAdapter, url: string) {
  const path = safePathname(url);
  let score = 0;
  if (adapter.productPathKeywords?.some((keyword) => path.includes(keyword))) score += 18;
  if (adapter.rejectPathKeywords?.some((keyword) => path.includes(keyword))) score -= 20;
  return score;
}

function runVendorExtractors(adapter: VendorAdapter | null, html: string, url: string) {
  if (!adapter?.extractors?.length) return null;
  const aggregate: Partial<PageEnrichment> = { signals: [] };
  for (const extractor of adapter.extractors) {
    const result = extractor(html, url);
    if (!result) continue;
    if (result.product_name && !aggregate.product_name) aggregate.product_name = result.product_name;
    if (result.image_url && !aggregate.image_url) aggregate.image_url = result.image_url;
    if (result.description && !aggregate.description) aggregate.description = result.description;
    if (result.brand && !aggregate.brand) aggregate.brand = result.brand;
    if (Array.isArray(result.signals)) {
      aggregate.signals = unique([...(aggregate.signals || []), ...result.signals]);
    }
  }
  return aggregate;
}

function pickPreferredImage(candidates: string[], adapter: VendorAdapter | null) {
  const urls = candidates.map((candidate) => normalizeUrl(candidate)).filter(Boolean) as string[];
  if (!urls.length) return null;
  if (!adapter?.preferredImageHosts?.length) return urls[0];
  const preferred = urls.find((entry) => adapter.preferredImageHosts?.some((host) => extractDomain(entry).includes(host)));
  return preferred || urls[0];
}

function scoreProductNameQuality(value: string) {
  let score = Math.min(40, value.length);
  if (!/\bhome|shop|sale|category|furniture\b/i.test(value)) score += 20;
  if (/\bsofa|sectional|chair|table|bed|dresser|desk|bookcase|lighting|ottoman|bench\b/i.test(value)) score += 20;
  if (/[A-Z][a-z]+/.test(value)) score += 8;
  return score;
}

function safePathname(url: string) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractMetaContent(html: string, attrName: string, attrValue: string) {
  const escapedValue = escapeRegExp(attrValue);
  const attrPattern = new RegExp(
    `<meta[^>]+${attrName}=["']${escapedValue}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${escapedValue}["'][^>]*>`,
    "i",
  );
  const match = html.match(attrPattern);
  return decodeHtmlEntities(match?.[1] || match?.[2] || "");
}

function extractCanonicalUrl(html: string) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  return match?.[1] || null;
}

function extractTagTitle(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return decodeHtmlEntities(match?.[1] || "");
}

function extractProductFromJsonLd(html: string) {
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

  for (const block of matches) {
    const raw = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
    const parsed = safeJsonParse(raw);
    const products = flattenJsonLdProducts(parsed);
    if (products.length > 0) {
      const product = products[0];
      return {
        name: sanitizeText(product?.name),
        image: Array.isArray(product?.image) ? sanitizeText(product.image[0]) : sanitizeText(product?.image),
        brand: typeof product?.brand === "object" ? sanitizeText(product.brand?.name) : sanitizeText(product?.brand),
      };
    }
  }

  return null;
}

function extractNextDataProduct(html: string) {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  const parsed = safeJsonParse(match?.[1] || "");
  const candidates = deepFindProductCandidates(parsed);
  const product = candidates[0];
  if (!product) return null;

  return {
    product_name: sanitizeText(product.name || product.productName || product.title),
    image_url: normalizeUrl(
      sanitizeText(product.image?.url)
      || sanitizeText(Array.isArray(product.images) ? product.images[0]?.url || product.images[0] : "")
      || sanitizeText(product.primaryImage?.url),
    ),
    description: sanitizeText(product.description || product.shortDescription),
    brand: sanitizeText(product.brand?.name || product.brand),
    signals: ["next-data-product"],
  };
}

function extractShopifyProductJson(html: string) {
  const match = html.match(/<script[^>]*>\s*window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?})\s*<\/script>/i)
    || html.match(/<script[^>]*>\s*var\s+meta\s*=\s*({[\s\S]*?product[\s\S]*?})\s*;\s*<\/script>/i);
  const parsed = safeJsonParse(match?.[1] || "");
  const candidates = deepFindProductCandidates(parsed);
  const product = candidates[0];
  if (!product) return null;

  return {
    product_name: sanitizeText(product.title || product.name),
    image_url: normalizeUrl(
      sanitizeText(product.featured_image)
      || sanitizeText(Array.isArray(product.images) ? product.images[0]?.src || product.images[0] : ""),
    ),
    description: sanitizeText(product.description),
    brand: sanitizeText(product.vendor || product.brand),
    signals: ["shopify-product"],
  };
}

function extractMagentoProductData(html: string) {
  const match = html.match(/"sku"\s*:\s*"[^"]+"[\s\S]{0,3000}?"name"\s*:\s*"([^"]+)"[\s\S]{0,3000}?"image"\s*:\s*"([^"]+)"/i)
    || html.match(/"name"\s*:\s*"([^"]+)"[\s\S]{0,3000}?"small_image"\s*:\s*"([^"]+)"/i);
  if (!match) return null;

  return {
    product_name: sanitizeText(match[1]),
    image_url: normalizeUrl(match[2]),
    signals: ["magento-product"],
  };
}

function extractApolloStateProduct(html: string) {
  const match = html.match(/<script[^>]*>\s*window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?})\s*<\/script>/i);
  const parsed = safeJsonParse(match?.[1] || "");
  const candidates = deepFindProductCandidates(parsed);
  const product = candidates[0];
  if (!product) return null;

  return {
    product_name: sanitizeText(product.name || product.productName || product.displayName || product.title),
    image_url: normalizeUrl(
      sanitizeText(product.primaryImage?.url)
      || sanitizeText(product.image?.url)
      || sanitizeText(Array.isArray(product.images) ? product.images[0]?.url || product.images[0] : ""),
    ),
    description: sanitizeText(product.description || product.shortDescription),
    brand: sanitizeText(product.brand?.name || product.brand),
    signals: ["apollo-product"],
  };
}

function extractRegexProductPayload(html: string) {
  const nameMatch = html.match(/"(?:productName|displayName|name|title)"\s*:\s*"([^"]{6,180})"/i);
  const imageMatch = html.match(/"(?:primaryImage|featuredImage|heroImage|image|thumbnail)"\s*:\s*(?:{[\s\S]{0,200}?"url"\s*:\s*"([^"]+)"|"([^"]+\.(?:jpg|jpeg|png|webp))")/i);
  const descMatch = html.match(/"(?:description|shortDescription|metaDescription)"\s*:\s*"([^"]{20,500})"/i);
  if (!nameMatch && !imageMatch && !descMatch) return null;

  return {
    product_name: sanitizeText(nameMatch?.[1]),
    image_url: normalizeUrl(imageMatch?.[1] || imageMatch?.[2] || ""),
    description: sanitizeText(descMatch?.[1]),
    signals: ["regex-product-payload"],
  };
}

function deepFindProductCandidates(input: any, depth = 0): any[] {
  if (!input || depth > 6) return [];
  if (Array.isArray(input)) {
    return input.flatMap((item) => deepFindProductCandidates(item, depth + 1));
  }
  if (typeof input !== "object") return [];

  const keys = Object.keys(input);
  const looksProductLike = (
    (typeof input.name === "string" || typeof input.title === "string")
    && ("image" in input || "images" in input || "description" in input || "brand" in input || "vendor" in input)
  );
  const matchesType = String(input["@type"] || input.type || "").toLowerCase().includes("product");
  const results = (looksProductLike || matchesType) ? [input] : [];

  for (const key of keys.slice(0, 20)) {
    results.push(...deepFindProductCandidates(input[key], depth + 1));
  }

  return results;
}

function flattenJsonLdProducts(value: any): any[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenJsonLdProducts(item));
  }
  if (typeof value === "object") {
    const type = Array.isArray(value["@type"]) ? value["@type"].join(" ").toLowerCase() : String(value["@type"] || "").toLowerCase();
    if (type.includes("product")) return [value];
    if (Array.isArray(value["@graph"])) return flattenJsonLdProducts(value["@graph"]);
  }
  return [];
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(raw.replace(/[\u0000-\u001F]+/g, " "));
    } catch {
      return null;
    }
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function chunk<T>(values: T[], size: number) {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
}

function countBy(items: Record<string, any>[], key: string) {
  return items.reduce((acc, item) => {
    const bucket = String(item[key] || "unknown");
    acc[bucket] = (acc[bucket] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}
