/**
 * METHOD 2 — Shopify Product API bulk importer
 *
 * Shopify stores expose their full catalog as JSON at /products.json.
 * We paginate through all pages to get every product with title, images,
 * variants, pricing, etc. — no HTML parsing needed.
 *
 * Known Shopify vendors: Four Hands (fourhands.com), Caracole, Loloi,
 * Gabby, Noir, Bungalow 5, Worlds Away, Global Views, etc.
 *
 * Detection: Fetch /products.json — if it returns valid JSON, it's Shopify.
 */

const USER_AGENT = "SPEC-Catalog/1.0 (furniture-catalog; contact@spec.design)";
const FETCH_TIMEOUT_MS = 15_000;
const PAGE_SIZE = 250; // Shopify max per page
const MAX_PAGES = 100; // Safety cap

// ── Progress tracking ────────────────────────────────────────

const vendorProgress = new Map();

export function getShopifyProgress() {
  const out = {};
  for (const [id, v] of vendorProgress) out[id] = { ...v };
  return out;
}

export function clearShopifyProgress() {
  vendorProgress.clear();
}

// ── HTTP helpers ─────────────────────────────────────────────

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
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

// ── Shopify detection ────────────────────────────────────────

/**
 * Check if a domain is a Shopify store by probing /products.json.
 * Returns the base URL that works, or null.
 */
export async function detectShopify(domain) {
  const bases = [
    `https://${domain}`,
    `https://www.${domain}`,
  ];

  for (const base of bases) {
    try {
      const url = `${base}/products.json?limit=1`;
      const data = await fetchJson(url);
      if (data && Array.isArray(data.products)) {
        return base;
      }
    } catch { /* skip */ }
  }

  // Also try /collections/all/products.json
  for (const base of bases) {
    try {
      const url = `${base}/collections/all/products.json?limit=1`;
      const data = await fetchJson(url);
      if (data && Array.isArray(data.products)) {
        return `${base}/collections/all`;
      }
    } catch { /* skip */ }
  }

  return null;
}

// ── Product mapping ──────────────────────────────────────────

function slugify(text) {
  return (text || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function inferCategory(productType, tags) {
  if (!productType && (!tags || tags.length === 0)) return null;
  const text = [productType, ...(tags || [])].filter(Boolean).join(" ").toLowerCase();

  const map = {
    sofa: "sofa", couch: "sofa", sectional: "sectional",
    chair: "chair", "accent chair": "accent-chair", "swivel chair": "swivel-chair",
    "dining chair": "dining-chair", "bar stool": "bar-stool", "counter stool": "bar-stool",
    bench: "bench", ottoman: "ottoman",
    table: "table", "dining table": "dining-table", "coffee table": "coffee-table",
    "side table": "side-table", "end table": "side-table", "console table": "console-table",
    desk: "desk", bed: "bed", dresser: "dresser", nightstand: "nightstand",
    bookcase: "bookcase", cabinet: "cabinet", sideboard: "credenza", credenza: "credenza",
    lamp: "lighting", chandelier: "lighting", pendant: "lighting", lighting: "lighting",
    mirror: "mirror", rug: "rug",
  };

  // Check longest matches first
  const sorted = Object.entries(map).sort((a, b) => b[0].length - a[0].length);
  for (const [key, val] of sorted) {
    if (text.includes(key)) return val;
  }
  return productType || null;
}

/**
 * Map a Shopify product to our canonical product schema.
 */
function mapShopifyProduct(sp, vendor) {
  const variant = sp.variants?.[0];
  const image = sp.images?.[0];

  const product = {
    id: `${vendor.id}_${slugify(sp.title || sp.handle)}`,
    product_name: sp.title || null,
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    vendor_domain: vendor.domain,
    vendor_tier: vendor.tier,
    collection: sp.vendor || null,
    sku: variant?.sku || null,
    category: inferCategory(sp.product_type, sp.tags),
    material: null,
    style: null,
    color: variant?.title !== "Default Title" ? variant?.title : null,
    image_url: image?.src || null,
    images: (sp.images || []).map(i => i.src).filter(Boolean).slice(0, 20),
    product_url: `https://${vendor.domain}/products/${sp.handle}`,
    description: stripHtml(sp.body_html || ""),
    retail_price: variant?.price ? parseFloat(variant.price) : null,
    wholesale_price: variant?.compare_at_price ? parseFloat(variant.compare_at_price) : null,
    tags: sp.tags || [],
    ingestion_source: "shopify-import",
    created_at: sp.created_at || new Date().toISOString(),
    updated_at: sp.updated_at || new Date().toISOString(),
  };

  // Extract material/style from tags
  if (Array.isArray(sp.tags)) {
    const materialKeywords = ["leather", "velvet", "linen", "wood", "oak", "walnut", "marble", "metal", "fabric", "rattan", "boucle", "performance"];
    const styleKeywords = ["modern", "contemporary", "transitional", "coastal", "traditional", "mid-century", "minimalist", "industrial"];

    for (const tag of sp.tags) {
      const lower = tag.toLowerCase();
      if (!product.material && materialKeywords.some((m) => lower.includes(m))) {
        product.material = tag;
      }
      if (!product.style && styleKeywords.some((s) => lower.includes(s))) {
        product.style = tag;
      }
    }
  }

  return product;
}

function stripHtml(html) {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 500 ? text.slice(0, 500) + "..." : text;
}

// ── Main export ──────────────────────────────────────────────

/**
 * Import all products from a Shopify vendor.
 *
 * @param {object} vendor - { id, name, domain, tier, ... }
 * @param {object} catalogDB - { insertProducts }
 * @returns {Promise<{ vendor_id, products_found, products_imported, is_shopify, error? }>}
 */
export async function importFromShopify(vendor, catalogDB) {
  const progress = {
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    status: "Detecting Shopify",
    pages_fetched: 0,
    products_found: 0,
    products_imported: 0,
    is_shopify: false,
    started_at: new Date().toISOString(),
    completed_at: null,
    error: null,
  };
  vendorProgress.set(vendor.id, progress);

  try {
    // 1. Detect if Shopify
    const shopifyBase = await detectShopify(vendor.domain);
    if (!shopifyBase) {
      progress.status = "Not a Shopify store";
      progress.completed_at = new Date().toISOString();
      return { vendor_id: vendor.id, products_found: 0, products_imported: 0, is_shopify: false };
    }

    progress.is_shopify = true;
    progress.status = `Shopify detected at ${shopifyBase}`;

    // 2. Paginate through all products — insert in batches to avoid OOM
    const BATCH_SIZE = 200;
    let batch = [];
    let totalFound = 0;
    let totalImported = 0;
    let page = 1;

    while (page <= MAX_PAGES) {
      progress.status = `Fetching page ${page}`;
      const url = `${shopifyBase}/products.json?limit=${PAGE_SIZE}&page=${page}`;
      const data = await fetchJson(url);

      if (!data || !Array.isArray(data.products) || data.products.length === 0) {
        break;
      }

      for (const sp of data.products) {
        const product = mapShopifyProduct(sp, vendor);
        if (product.product_name) {
          batch.push(product);
          totalFound++;
          if (batch.length >= BATCH_SIZE) {
            const result = catalogDB.insertProducts(batch);
            totalImported += result.inserted + result.updated;
            batch = [];
          }
        }
      }

      progress.pages_fetched = page;
      progress.products_found = totalFound;

      // If we got fewer than PAGE_SIZE, we're done
      if (data.products.length < PAGE_SIZE) break;

      page++;
      await sleep(1000); // Polite delay between pages
    }

    // 3. Flush remaining batch
    if (batch.length > 0) {
      const result = catalogDB.insertProducts(batch);
      totalImported += result.inserted + result.updated;
      batch = [];
    }

    progress.products_imported = totalImported;
    progress.status = `Complete: ${totalFound} products`;
    progress.completed_at = new Date().toISOString();

    return {
      vendor_id: vendor.id,
      products_found: totalFound,
      products_imported: totalImported,
      is_shopify: true,
      pages: page,
    };
  } catch (err) {
    progress.status = `Error: ${err.message}`;
    progress.error = err.message;
    progress.completed_at = new Date().toISOString();
    return { vendor_id: vendor.id, products_found: 0, products_imported: 0, is_shopify: true, error: err.message };
  }
}

/**
 * Scan all vendors for Shopify stores and import products from each.
 */
export async function importAllShopify(vendors, catalogDB) {
  const results = [];
  for (const vendor of vendors) {
    const result = await importFromShopify(vendor, catalogDB);
    results.push(result);
    if (result.is_shopify) {
      console.log(`[shopify-import] ${vendor.name}: ${result.products_found} products`);
    }
  }
  return results;
}
