/**
 * METHOD 4 — Vendor internal API endpoint adapters
 *
 * Many vendor websites use internal AJAX/REST endpoints that their frontend
 * calls to load product data. These return clean JSON with all product info.
 *
 * We probe for common API patterns:
 *  - Shopify: /products.json (handled by shopify-importer)
 *  - Magento: /rest/V1/products, /graphql
 *  - WordPress/WooCommerce: /wp-json/wc/v3/products
 *  - Vendor custom: /api/products, /api/v1/catalog, etc.
 *  - BigCommerce: /api/storefront/catalog/products
 *  - Centuryfurniture.com (Shopify-based shop subdomain)
 *
 * Also includes vendor-specific adapters for known API patterns.
 */

const USER_AGENT = "SPEC-Catalog/1.0 (furniture-catalog; contact@spec.design)";
const FETCH_TIMEOUT_MS = 20_000;

// ── Progress ─────────────────────────────────────────────────

const vendorProgress = new Map();

export function getApiProgress() {
  const out = {};
  for (const [id, v] of vendorProgress) out[id] = { ...v };
  return out;
}

export function clearApiProgress() {
  vendorProgress.clear();
}

// ── HTTP ─────────────────────────────────────────────────────

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json", ...headers },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugify(text) {
  return (text || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ── API endpoint probing ─────────────────────────────────────

const API_PROBE_PATHS = [
  // WooCommerce
  "/wp-json/wc/v3/products?per_page=100",
  "/wp-json/wc/store/v1/products?per_page=100",
  // Custom REST APIs
  "/api/products?limit=100",
  "/api/v1/products?limit=100",
  "/api/v2/products?limit=100",
  "/api/catalog/products?limit=100",
  // Magento GraphQL (simplified probe)
  "/rest/V1/products?searchCriteria[pageSize]=100",
];

/**
 * Probe a domain for known API endpoints.
 * Returns { url, data, type } or null.
 */
async function probeApiEndpoints(domain) {
  const bases = [`https://${domain}`, `https://www.${domain}`];

  for (const base of bases) {
    for (const apiPath of API_PROBE_PATHS) {
      const url = `${base}${apiPath}`;
      const data = await fetchJson(url);
      if (data) {
        // WooCommerce returns array of products
        if (Array.isArray(data) && data.length > 0 && data[0].name) {
          return { url, data, type: "woocommerce" };
        }
        // Magento returns { items: [...] }
        if (data.items && Array.isArray(data.items)) {
          return { url, data: data.items, type: "magento" };
        }
        // Generic array of products
        if (Array.isArray(data) && data.length > 0) {
          return { url, data, type: "generic-array" };
        }
        // Object with products key
        if (data.products && Array.isArray(data.products)) {
          return { url, data: data.products, type: "generic-object" };
        }
      }
    }
  }

  return null;
}

// ── Magento GraphQL adapter ──────────────────────────────────

/**
 * Many furniture vendors run Magento PWA/Venia storefronts with GraphQL.
 * Probe for the /graphql endpoint and paginate through products.
 */
async function adaptMagentoGraphql(vendor) {
  const products = [];
  const bases = [`https://${vendor.domain}`, `https://www.${vendor.domain}`];

  for (const base of bases) {
    const graphqlUrl = `${base}/graphql`;
    let page = 1;
    const pageSize = 100;

    // Test with a simple query first
    const testQuery = `{ products(search: "", pageSize: 1) { total_count } }`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const testRes = await fetch(graphqlUrl, {
        method: "POST",
        headers: { "user-agent": USER_AGENT, "content-type": "application/json" },
        body: JSON.stringify({ query: testQuery }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!testRes.ok) continue;
      const testData = await testRes.json();
      if (!testData?.data?.products) continue;

      const totalCount = testData.data.products.total_count;
      if (!totalCount || totalCount === 0) continue;

      const maxPages = Math.min(Math.ceil(totalCount / pageSize), 20); // Cap at 2000 products

      while (page <= maxPages) {
        const query = `{
          products(search: "", pageSize: ${pageSize}, currentPage: ${page}) {
            items {
              name
              sku
              url_key
              url_suffix
              description { html }
              short_description { html }
              image { url label }
              price_range { minimum_price { regular_price { value currency } } }
              categories { name }
            }
          }
        }`;

        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        try {
          const res = await fetch(graphqlUrl, {
            method: "POST",
            headers: { "user-agent": USER_AGENT, "content-type": "application/json" },
            body: JSON.stringify({ query }),
            signal: ctrl.signal,
          });
          clearTimeout(t);
          if (!res.ok) break;
          const data = await res.json();
          const items = data?.data?.products?.items;
          if (!items || items.length === 0) break;

          for (const item of items) {
            if (!item.name) continue;
            const urlPath = item.url_key ? `/${item.url_key}${item.url_suffix || ""}` : null;
            products.push({
              id: `${vendor.id}_${slugify(item.name)}${item.sku ? "-" + slugify(item.sku) : ""}`,
              product_name: item.name,
              vendor_id: vendor.id,
              vendor_name: vendor.name,
              vendor_domain: vendor.domain,
              vendor_tier: vendor.tier,
              sku: item.sku || null,
              category: item.categories?.[0]?.name || null,
              image_url: item.image?.url || null,
              product_url: urlPath ? `${base}${urlPath}` : null,
              description: stripHtml(item.description?.html || item.short_description?.html || ""),
              retail_price: item.price_range?.minimum_price?.regular_price?.value || null,
              ingestion_source: "api-import",
            });
          }

          if (items.length < pageSize) break;
          page++;
          await sleep(1000);
        } catch {
          clearTimeout(t);
          break;
        }
      }

      if (products.length > 0) return products;
    } catch {
      clearTimeout(timer);
      continue;
    }
  }

  return products;
}

// ── Vendor-specific adapters ─────────────────────────────────

/**
 * Bernhardt uses Magento — try GraphQL.
 */
async function adaptBernhardt(vendor) {
  return adaptMagentoGraphql(vendor);
}

/**
 * Century Furniture has a Shopify-based shop subdomain.
 */
async function adaptCentury(vendor) {
  const bases = [
    `https://shop.centuryfurniture.com`,
    `https://www.centuryfurniture.com`,
  ];

  for (const base of bases) {
    const url = `${base}/products.json?limit=250`;
    const data = await fetchJson(url);
    if (data && Array.isArray(data.products)) {
      return data.products.map((sp) => ({
        id: `${vendor.id}_${slugify(sp.title || sp.handle)}`,
        product_name: sp.title,
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_domain: vendor.domain,
        vendor_tier: vendor.tier,
        sku: sp.variants?.[0]?.sku || null,
        category: sp.product_type || null,
        image_url: sp.images?.[0]?.src || null,
        product_url: `${base}/products/${sp.handle}`,
        description: stripHtml(sp.body_html || ""),
        retail_price: sp.variants?.[0]?.price ? parseFloat(sp.variants[0].price) : null,
        ingestion_source: "api-import",
      }));
    }
  }
  return [];
}

/**
 * Generic WooCommerce adapter — paginate through /wp-json/wc/store/v1/products.
 */
async function adaptWooCommerce(vendor, baseUrl) {
  const products = [];
  let page = 1;

  while (page <= 50) {
    const url = `${baseUrl}&page=${page}`;
    const data = await fetchJson(url);
    if (!data || !Array.isArray(data) || data.length === 0) break;

    for (const wp of data) {
      products.push({
        id: `${vendor.id}_${slugify(wp.name || wp.title)}`,
        product_name: wp.name || wp.title,
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_domain: vendor.domain,
        vendor_tier: vendor.tier,
        sku: wp.sku || null,
        category: wp.categories?.[0]?.name || null,
        image_url: wp.images?.[0]?.src || null,
        product_url: wp.permalink || wp.link || null,
        description: stripHtml(wp.description || wp.short_description || ""),
        retail_price: wp.price ? parseFloat(wp.price) : null,
        ingestion_source: "api-import",
      });
    }

    if (data.length < 100) break;
    page++;
    await sleep(1000);
  }

  return products;
}

function stripHtml(html) {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 500 ? text.slice(0, 500) + "..." : text;
}

// ── Vendor adapter registry ──────────────────────────────────

/**
 * Kincaid, Uttermost — also Magento PWA/Venia.
 */
async function adaptKincaid(vendor) {
  return adaptMagentoGraphql(vendor);
}
async function adaptUttermost(vendor) {
  return adaptMagentoGraphql(vendor);
}
async function adaptVanguard(vendor) {
  return adaptMagentoGraphql(vendor);
}
async function adaptHickoryChair(vendor) {
  return adaptMagentoGraphql(vendor);
}
async function adaptTheodoreAlexander(vendor) {
  return adaptMagentoGraphql(vendor);
}

const VENDOR_ADAPTERS = {
  "century": adaptCentury,
  "bernhardt": adaptBernhardt,
  "kincaid": adaptKincaid,
  "uttermost": adaptUttermost,
  "vanguard": adaptVanguard,
  "hickory-chair": adaptHickoryChair,
  "theodore-alexander": adaptTheodoreAlexander,
};

// ── Main export ──────────────────────────────────────────────

/**
 * Try to import products via API endpoints for a vendor.
 */
export async function importFromApi(vendor, catalogDB) {
  const progress = {
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    status: "Probing for API endpoints",
    api_type: null,
    products_found: 0,
    products_imported: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
    error: null,
  };
  vendorProgress.set(vendor.id, progress);

  try {
    let products = [];

    // 1. Try vendor-specific adapter first
    const adapter = VENDOR_ADAPTERS[vendor.id];
    if (adapter) {
      progress.status = `Running ${vendor.id} adapter`;
      products = await adapter(vendor);
      if (products.length > 0) {
        progress.api_type = "vendor-specific";
      }
    }

    // 2. Probe generic API endpoints
    if (products.length === 0) {
      const apiResult = await probeApiEndpoints(vendor.domain);
      if (apiResult) {
        progress.api_type = apiResult.type;
        progress.status = `Found ${apiResult.type} API at ${apiResult.url}`;

        if (apiResult.type === "woocommerce") {
          products = await adaptWooCommerce(vendor, apiResult.url);
        } else {
          // Generic: try to map whatever we got
          const rawProducts = Array.isArray(apiResult.data) ? apiResult.data : [];
          products = rawProducts
            .filter((p) => p.name || p.title || p.product_name)
            .map((p) => ({
              id: `${vendor.id}_${slugify(p.name || p.title || p.product_name)}`,
              product_name: p.name || p.title || p.product_name,
              vendor_id: vendor.id,
              vendor_name: vendor.name,
              vendor_domain: vendor.domain,
              vendor_tier: vendor.tier,
              sku: p.sku || p.id || null,
              category: p.category || p.product_type || p.type || null,
              image_url: p.image?.src || p.image_url || p.featured_image || null,
              product_url: p.url || p.permalink || p.link || null,
              description: stripHtml(p.description || p.body_html || ""),
              retail_price: typeof p.price === "number" ? p.price : parseFloat(p.price) || null,
              ingestion_source: "api-import",
            }))
            .filter((p) => p.product_name);
        }
      }
    }

    progress.products_found = products.length;

    // 3. Insert into catalog DB
    if (products.length > 0) {
      const result = catalogDB.insertProducts(products);
      progress.products_imported = result.inserted + result.updated;
    }

    progress.status = products.length > 0 ? `Complete: ${products.length} products` : "No API endpoint found";
    progress.completed_at = new Date().toISOString();

    return {
      vendor_id: vendor.id,
      products_found: products.length,
      products_imported: progress.products_imported,
      api_type: progress.api_type,
    };
  } catch (err) {
    progress.status = `Error: ${err.message}`;
    progress.error = err.message;
    progress.completed_at = new Date().toISOString();
    return { vendor_id: vendor.id, products_found: 0, products_imported: 0, error: err.message };
  }
}

/**
 * Try API import for all vendors.
 */
export async function importAllApis(vendors, catalogDB) {
  const results = [];
  for (const vendor of vendors) {
    const result = await importFromApi(vendor, catalogDB);
    results.push(result);
    if (result.products_found > 0) {
      console.log(`[api-import] ${vendor.name}: ${result.products_found} products via ${result.api_type}`);
    }
  }
  return results;
}
