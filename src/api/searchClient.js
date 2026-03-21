import { base44 } from "@/api/base44Client";
import { getAuthHeaders } from "@/lib/fingerprint";

const externalSearchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app";

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

export async function smartSearch(conversation) {
  if (!externalSearchServiceUrl) throw new Error("Search service not configured");
  const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/smart-search`, {
    method: "POST",
    headers: { "content-type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({ conversation }),
  });
  const paywall = handle402(response);
  if (paywall) return paywall;
  if (!response.ok) throw new Error(`smart search error: ${response.status}`);
  const data = await response.json();
  return {
    ...data,
    products: Array.isArray(data.products) ? data.products.map(normalizeStandaloneResult) : [],
  };
}

export async function searchProducts(query, options = {}) {
  if (externalSearchServiceUrl) {
    const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/search`, {
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

    const paywall = handle402(response);
    if (paywall) return paywall;

    if (!response.ok) {
      throw new Error(`search service error: ${response.status}`);
    }

    const data = await response.json();
    return {
      ...data,
      products: Array.isArray(data.products) ? data.products.map(normalizeStandaloneResult) : [],
    };
  }

  const response = await base44.functions.invoke("aiSearchProducts", { query });
  return response.data;
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
  const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/list-search`, {
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
  const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/visual-search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image: imageBase64 }),
  });
  if (!response.ok) throw new Error(`visual search error: ${response.status}`);
  return response.json();
}

export async function getAutocomplete(partial) {
  if (!externalSearchServiceUrl) return { suggestions: [] };
  const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/autocomplete`, {
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
    const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/conversational-search`, {
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
  const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/similar`, {
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
  const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/product/${encodeURIComponent(productId)}`);
  if (!response.ok) throw new Error(`get product error: ${response.status}`);
  const data = await response.json();
  return data.product ? normalizeStandaloneResult(data.product) : null;
}

export async function getCatalogStats() {
  if (!externalSearchServiceUrl) return null;
  const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/catalog/stats`);
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
  const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/analytics`);
  if (!response.ok) return null;
  return response.json();
}

export async function getJobStatus() {
  if (!externalSearchServiceUrl) return null;
  const response = await fetch(`${externalSearchServiceUrl.replace(/\/$/, "")}/jobs/status`);
  if (!response.ok) return null;
  return response.json();
}

function isVendorAssetUrl(url, vendorDomain) {
  if (!url || !vendorDomain) return false;
  try {
    return new URL(url).hostname.includes(vendorDomain.replace(/^www\./, ""));
  } catch {
    return false;
  }
}
