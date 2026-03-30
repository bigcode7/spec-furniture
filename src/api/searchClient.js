import { base44 } from "@/api/base44Client";
import { getAuthHeaders } from "@/lib/fingerprint";

const externalSearchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai";

// ── Search result cache — 5 min TTL ──
const _searchCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

function getCached(key) {
  const entry = _searchCache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  if (entry) _searchCache.delete(key);
  return null;
}

function setCache(key, data) {
  _searchCache.set(key, { data, ts: Date.now() });
  // Evict old entries if cache gets large
  if (_searchCache.size > 50) {
    const oldest = _searchCache.keys().next().value;
    _searchCache.delete(oldest);
  }
}

function timedFetch(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function handle402(response) {
  if (response.status === 402) {
    return response.json().then(data => {
      const err = new Error("subscription_required");
      err.status = 402;
      err.data = data;
      throw err;
    });
  }
  return null;
}

function handle429(response) {
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("retry-after") || "10", 10);
    const err = new Error("rate_limited");
    err.status = 429;
    err.retryAfter = retryAfter;
    throw err;
  }
}

export async function smartSearch(conversation) {
  if (!externalSearchServiceUrl) throw new Error("Search service not configured");

  // Cache single-message smart searches (initial queries)
  const lastMsg = conversation[conversation.length - 1]?.content || "";
  const isSimple = conversation.length === 1;
  const cacheKey = isSimple ? `smart:${lastMsg.toLowerCase().trim()}` : null;
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }

  const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/smart-search`, {
    method: "POST",
    headers: { "content-type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ conversation }),
  });
  handle429(response);
  const paywall = handle402(response);
  if (paywall) return paywall;
  if (!response.ok) throw new Error(`smart search error: ${response.status}`);
  const data = await response.json();
  const result = {
    ...data,
    products: Array.isArray(data.products) ? data.products.map(normalizeStandaloneResult) : [],
  };
  if (cacheKey) setCache(cacheKey, result);
  return result;
}

export async function searchProducts(query, options = {}) {
  if (externalSearchServiceUrl) {
    // Check cache for identical queries (no filters/pagination)
    const cacheKey = `search:${query.toLowerCase().trim()}:${JSON.stringify(options.filters || {})}:${options.page || 1}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/search`, {
      method: "POST",
      headers: { "content-type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        query,
        search_mode: "balanced",
        max_vendors: 12,
        per_vendor: 3,
        discovery_timeout_ms: 8000,
        allow_seed_results: true,
        exclude_ids: options.exclude_ids || [],
        page: options.page || 1,
        filters: options.filters || {},
      }),
    });

    handle429(response);
    const paywall = handle402(response);
    if (paywall) return paywall;

    if (!response.ok) {
      throw new Error(`search service error: ${response.status}`);
    }

    const data = await response.json();
    const result = {
      ...data,
      products: Array.isArray(data.products) ? data.products.map(normalizeStandaloneResult) : [],
    };
    setCache(cacheKey, result);
    return result;
  }

  const response = await base44.functions.invoke("aiSearchProducts", { query });
  return response.data;
}

// Prefetch a search query in the background (for hover prefetching)
export function prefetchSearch(query) {
  const cacheKey = `search:${query.toLowerCase().trim()}:{}:1`;
  if (getCached(cacheKey)) return; // Already cached
  searchProducts(query).catch(() => {}); // Fire and forget
}

function normalizeStandaloneResult(item) {
  const isAiDiscovery = item.ingestion_source === "ai-discovery";
  const isLiveResult = item.ingestion_source === "live-crawler" || item.ingestion_source === "live-discovery";
  const isVendorHostedImage = isLiveResult && item.image_verified && Boolean(item.image_url);
  const hasTrustedVendorUrl = isLiveResult && item.product_url_verified && isVendorAssetUrl(item.product_url, item.vendor_domain);
  const confidence = Number(item.retrieval_quality_score || 0);

  // For AI discovery, seed/fallback results, pass through image & URL if present
  const hasImage = isVendorHostedImage || isAiDiscovery || (!isLiveResult && Boolean(item.image_url));
  const hasUrl = hasTrustedVendorUrl || isAiDiscovery || (!isLiveResult && Boolean(item.product_url));

  return {
    id: item.id,
    product_name: item.product_name,
    manufacturer_name: item.vendor_name,
    portal_url: hasUrl ? item.product_url : "",
    image_url: hasImage ? item.image_url : "",
    thumbnail_url: hasImage ? item.image_url : "",
    snippet: item.description,
    source: item.ingestion_source || "search-service",
    query_used: "",
    material: item.material,
    style: item.style || null,
    product_type: item.category,
    wholesale_price: item.wholesale_price ?? null,
    retail_price: item.retail_price ?? null,
    price_verified: Boolean(item.price_verified),
    lead_time_weeks: item.lead_time_weeks,
    relevance_score: item.relevance_score,
    criteria_matched: item.tags || [],
    criteria_missed: [],
    reasoning: item.reasoning || item.description || "Catalog match",
    match_label: hasTrustedVendorUrl && isVendorHostedImage
      ? "Verified vendor result"
      : isAiDiscovery
        ? "AI discovered"
        : isLiveResult
          ? "Live result pending verification"
          : "Catalog match",
    domain: item.vendor_domain,
    product_page_confidence: confidence,
    vendor_signals: [item.vendor_name, ...(item.retrieval_signals || []), item.ingestion_source].filter(Boolean),
    image_verified: Boolean(item.image_verified),
    product_url_verified: Boolean(item.product_url_verified),
    verified_price: item.wholesale_price ?? item.retail_price ?? null,
    result_quality: hasTrustedVendorUrl && isVendorHostedImage ? "verified" : isAiDiscovery ? "ai-discovered" : isLiveResult ? "live-unverified" : "directional",
    sku: item.sku || "",
    collection: item.collection || "",
    // Spatial intelligence fields
    fit_score: item.fit_score || null,
    material_badges: item.material_badges || [],
    dimensions: item.dimensions || null,
    // AI visual tags
    ai_visual_tags: item.ai_visual_tags || "",
    // Extra fields for preview
    color: item.color || null,
    width: item.width || null,
    depth: item.depth || null,
    height: item.height || null,
    category: item.category || null,
    vendor_id: item.vendor_id || null,
    description: item.description || null,
    ingestion_source: item.ingestion_source || null,
    created_at: item.created_at || null,
    image_contain: item.image_contain || false,
    images: (item.images || []).map(img => typeof img === "string" ? img : (img && img.url ? img.url : "")).filter(Boolean),
  };
}

export async function listSearch(items) {
  if (!externalSearchServiceUrl) throw new Error("Search service not configured");
  const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/list-search`, {
    method: "POST",
    headers: { "content-type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ items }),
  });
  const paywall = handle402(response);
  if (paywall) return paywall;
  if (!response.ok) throw new Error(`list search error: ${response.status}`);
  const data = await response.json();
  return {
    ...data,
    items: (data.items || []).map(item => ({
      ...item,
      products: (item.products || []).map(normalizeStandaloneResult),
    })),
  };
}

export async function visualSearch(imageBase64) {
  if (!externalSearchServiceUrl) throw new Error("Search service not configured");
  const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/visual-search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image: imageBase64 }),
  });
  if (!response.ok) throw new Error(`visual search error: ${response.status}`);
  return response.json();
}

export async function getAutocomplete(partial) {
  if (!externalSearchServiceUrl) return { suggestions: [] };
  const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/autocomplete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ partial }),
  });
  if (!response.ok) return { suggestions: [] };
  return response.json();
}

export async function conversationalSearch(conversation, previousResults, sessionId) {
  if (!externalSearchServiceUrl) {
    throw new Error("Search service not configured");
  }
  try {
    const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/conversational-search`, {
      method: "POST",
      headers: { "content-type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({
        conversation,
        previous_results: previousResults.slice(0, 20),
        session_id: sessionId,
      }),
    });
    const paywall = handle402(response);
    if (paywall) return paywall;
    if (!response.ok) {
      throw new Error(`conversational search error: ${response.status}`);
    }
    const data = await response.json();
    return {
      ...data,
      products: Array.isArray(data.products) ? data.products.map(normalizeStandaloneResult) : [],
    };
  } catch (err) {
    console.error("Conversational search failed:", err);
    throw err;
  }
}

export async function findSimilarProducts(productId, limit = 20) {
  if (!externalSearchServiceUrl) throw new Error("Search service not configured");
  const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/similar`, {
    method: "POST",
    headers: { "content-type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ product_id: productId, limit }),
  });
  const paywall = handle402(response);
  if (paywall) return paywall;
  if (!response.ok) throw new Error(`similar products error: ${response.status}`);
  const data = await response.json();
  return {
    ...data,
    products: Array.isArray(data.products) ? data.products.map(normalizeStandaloneResult) : [],
  };
}

export async function getProduct(productId) {
  if (!externalSearchServiceUrl) throw new Error("Search service not configured");
  const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/product/${encodeURIComponent(productId)}`);
  if (!response.ok) throw new Error(`get product error: ${response.status}`);
  const data = await response.json();
  return data.product ? normalizeStandaloneResult(data.product) : null;
}

export async function getCatalogStats() {
  if (!externalSearchServiceUrl) return null;
  const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/catalog/stats`);
  if (!response.ok) return null;
  return response.json();
}

export async function trackProductClick(productId, vendorId) {
  if (!externalSearchServiceUrl) return;
  fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/analytics/click`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product_id: productId, vendor_id: vendorId }),
  }).catch(() => {});
}

export async function trackProductCompare(productId) {
  if (!externalSearchServiceUrl) return;
  fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/analytics/compare`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product_id: productId }),
  }).catch(() => {});
}

export async function getAnalytics() {
  if (!externalSearchServiceUrl) return null;
  const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/analytics`);
  if (!response.ok) return null;
  return response.json();
}

export async function getJobStatus() {
  if (!externalSearchServiceUrl) return null;
  const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/jobs/status`);
  if (!response.ok) return null;
  return response.json();
}

/**
 * Cross-match: get cosine similarity scores between selected products and candidates.
 * Used for cross-bucket auto-matching in room package feature.
 */
export async function crossMatchProducts(selectedIds, candidateIds) {
  if (!externalSearchServiceUrl) return {};
  try {
    const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/cross-match`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selected_ids: selectedIds, candidate_ids: candidateIds }),
    });
    if (!response.ok) return {};
    const data = await response.json();
    return data.scores || {};
  } catch {
    return {};
  }
}

// ── User Data (server-side persistence) ──

export async function fetchServerFavorites() {
  try {
    const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/user/favorites`, {
      headers: { ...getAuthHeaders() },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.favorites || [];
  } catch { return null; }
}

export async function syncFavoriteToServer(product, add) {
  try {
    if (add) {
      await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/user/favorites`, {
        method: "POST",
        headers: { "content-type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ product }),
      });
    } else {
      await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/user/favorites/${encodeURIComponent(product.id)}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
    }
  } catch (e) {
    console.error("[searchClient] Failed to sync favorite:", e.message || e);
  }
}

export async function fetchServerQuote() {
  try {
    const response = await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/user/quote`, {
      headers: { ...getAuthHeaders() },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.quote;
  } catch (e) {
    console.error("[searchClient] Failed to fetch quote:", e.message || e);
    return null;
  }
}

export async function syncQuoteToServer(quote) {
  try {
    await timedFetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/user/quote`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ quote }),
    });
  } catch (e) {
    console.error("[searchClient] Failed to sync quote:", e.message || e);
  }
}

function isVendorAssetUrl(url, vendorDomain) {
  if (!url || !vendorDomain) return false;
  try {
    return new URL(url).hostname.includes(vendorDomain.replace(/^www\./, ""));
  } catch {
    return false;
  }
}
