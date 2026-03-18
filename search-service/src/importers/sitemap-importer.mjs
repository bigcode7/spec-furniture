/**
 * METHOD 1 — Sitemap-based bulk product importer
 *
 * Fetches sitemap.xml / sitemap_index.xml from vendor websites,
 * extracts product page URLs, then batch-fetches pages in parallel
 * (concurrency-limited with per-domain rate limiting) to extract
 * product data from JSON-LD, Open Graph, and HTML meta tags.
 *
 * Expected yield: 500–5000 product URLs per vendor.
 */

const USER_AGENT = "SPEC-Catalog/1.0 (furniture-catalog; contact@spec.design)";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_SIZE = 200_000; // 200KB — enough for meta/JSON-LD extraction
const CONCURRENCY = 3;
const DOMAIN_DELAY_MS = 1000; // 1s between requests to same domain
const MAX_PRODUCTS_PER_VENDOR = 15000;

// ── Progress tracking ────────────────────────────────────────

const vendorProgress = new Map();

export function getSitemapProgress() {
  const out = {};
  for (const [id, v] of vendorProgress) out[id] = { ...v };
  return out;
}

export function clearSitemapProgress() {
  vendorProgress.clear();
}

// ── HTTP helpers ─────────────────────────────────────────────

async function fetchText(url, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 500_000); // 500KB cap
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Sitemap XML parsing ──────────────────────────────────────

/**
 * Discover sitemap URL(s) for a domain.
 * Tries robots.txt first, then common paths.
 */
async function discoverSitemaps(domain) {
  const sitemaps = new Set();

  // 1. Check robots.txt for Sitemap: directives
  const robotsUrl = `https://${domain}/robots.txt`;
  const robots = await fetchText(robotsUrl, 8000);
  if (robots) {
    const lines = robots.split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
      if (m) sitemaps.add(m[1].trim());
    }
  }

  // 2. Try common sitemap locations
  const candidates = [
    `https://${domain}/sitemap.xml`,
    `https://www.${domain}/sitemap.xml`,
    `https://${domain}/sitemap_index.xml`,
    `https://www.${domain}/sitemap_index.xml`,
    `https://${domain}/sitemap_products.xml`,
    `https://${domain}/sitemap-products.xml`,
  ];
  for (const c of candidates) {
    if (!sitemaps.has(c)) sitemaps.add(c);
  }

  return [...sitemaps];
}

/**
 * Parse a sitemap XML string. Handles both sitemap index files
 * (which reference child sitemaps) and regular sitemaps (which list URLs).
 */
function parseSitemapXml(xml) {
  const childSitemaps = [];
  const urls = [];

  // Check for <sitemapindex> with <sitemap><loc>
  const sitemapLocPattern = /<sitemap>\s*<loc>([^<]+)<\/loc>/gi;
  let m;
  while ((m = sitemapLocPattern.exec(xml)) !== null) {
    childSitemaps.push(m[1].trim());
  }

  // Extract <url><loc> entries
  const urlLocPattern = /<url>\s*<loc>([^<]+)<\/loc>/gi;
  while ((m = urlLocPattern.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }

  return { childSitemaps, urls };
}

/**
 * Recursively fetch and parse all sitemaps for a domain.
 * Returns a flat list of all discovered URLs.
 */
async function fetchAllSitemapUrls(domain, progressObj) {
  const candidateUrls = await discoverSitemaps(domain);
  const allUrls = new Set();
  const visited = new Set();

  const queue = [...candidateUrls];

  while (queue.length > 0) {
    const sitemapUrl = queue.shift();
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    progressObj.status = `Fetching sitemap: ${sitemapUrl}`;
    const xml = await fetchText(sitemapUrl, 20000);
    if (!xml) continue;

    const { childSitemaps, urls } = parseSitemapXml(xml);

    for (const child of childSitemaps) {
      if (!visited.has(child)) queue.push(child);
    }

    for (const url of urls) {
      allUrls.add(url);
    }

    progressObj.sitemaps_found = visited.size;
  }

  return [...allUrls];
}

// ── Product URL filtering ────────────────────────────────────

/**
 * Filter sitemap URLs to those that are likely product pages.
 *
 * Strategy:
 *   1. Token-match: URL path contains a known product path token (e.g. /products/, /shop/)
 *   2. Deep-path match: URL has 4+ path segments (e.g. /living/seating/sofas/product-name/)
 *   3. Flat-URL heuristic: for vendors flagged `flat_product_urls`, accept single-segment
 *      slug paths that look like product names (contain hyphens, end with optional SKU)
 *   4. ASP.NET match: URLs containing iteminformation.aspx (Palecek-style)
 */
function filterProductUrls(urls, vendor) {
  const productTokens = vendor.profile?.product_path_tokens || ["product", "products", "item", "shop"];
  const rejectTokens = vendor.profile?.reject_path_tokens || [];
  const isFlatUrlVendor = vendor.flat_product_urls === true;
  const minSegments = vendor.profile?.min_path_segments || 0;

  // Also accept Shopify-style /products/ paths and Magento /catalog/product/ paths
  const productPatterns = [
    ...productTokens.map((t) => `/${t}/`),
    "/catalog/product/",
    "/p/",
  ];

  // Reject non-product paths
  const rejectPatterns = [
    ...rejectTokens.map((t) => `/${t}/`),
    ...rejectTokens.map((t) => `/${t}`),
    "/blog/",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/faq",
    "/help",
    "/account",
    "/cart",
    "/checkout",
    "/login",
    "/register",
    "/sitemap",
    "/feed",
    "/page/",
    "/tag/",
    "/category/",
    "/customer/",
    "/cms/",
    "/catalogsearch/",
    "/newsletter",
    "/wishlist",
    "/returns",
    "/shipping",
    "/trade-program",
    "/designers",
    "/showroom",
    "/press",
    "/careers",
    "/media/",
    ".pdf",
    ".jpg",
    ".png",
    ".gif",
    ".css",
    ".js",
  ];

  return urls.filter((url) => {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      const segments = path.split("/").filter(Boolean);

      // Must not match any reject pattern
      const isRejected = rejectPatterns.some((p) => path.includes(p));
      if (isRejected) return false;

      // 1. Token match — URL contains a known product path token
      const tokenMatch = productPatterns.some((p) => path.includes(p));
      if (tokenMatch) return true;

      // 2. ASP.NET style (Palecek)
      if (path.includes("iteminformation.aspx")) return true;

      // 3. Deep path — 4+ segments likely means room/category/type/product
      if (minSegments > 0 && segments.length >= minSegments) return true;

      // 4. Flat-URL heuristic for vendors with product slugs at root level
      //    Accept URLs like /product-name-with-sku-12345 (single segment, has hyphens)
      if (isFlatUrlVendor && segments.length === 1) {
        const slug = segments[0];
        // Must have hyphens (product name), be reasonably long, and not be a generic page
        if (slug.includes("-") && slug.length >= 8) return true;
        // SKU-only URLs like Bernhardt's /shop/B4266G are caught by token match above
      }

      return false;
    } catch {
      return false;
    }
  });
}

// ── HTML product extraction ──────────────────────────────────

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ").replace(/&#x2F;/g, "/");
}

function extractMeta(html, name) {
  for (const attr of ["property", "name"]) {
    // content after attribute
    const p1 = new RegExp(`<meta[^>]+${attr}=["']${escRe(name)}["'][^>]+content=["']([^"']+)["']`, "i");
    const m1 = html.match(p1);
    if (m1) return decodeEntities(m1[1]);
    // content before attribute
    const p2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${escRe(name)}["']`, "i");
    const m2 = html.match(p2);
    if (m2) return decodeEntities(m2[1]);
  }
  return null;
}

function escRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractJsonLd(html) {
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = pattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const items = data["@graph"] || [data];
      for (const item of Array.isArray(items) ? items : [items]) {
        const type = item["@type"];
        if (type === "Product" || type === "IndividualProduct" ||
            (Array.isArray(type) && type.includes("Product"))) {
          return item;
        }
      }
    } catch { /* skip malformed */ }
  }
  return null;
}

function parsePrice(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

function inferCategoryFromUrl(url) {
  const map = {
    sofa: "sofa", sofas: "sofa", couch: "sofa",
    chair: "chair", chairs: "chair",
    "accent-chair": "accent-chair", "accent-chairs": "accent-chair",
    "swivel-chair": "swivel-chair", "swivel-chairs": "swivel-chair",
    "dining-chair": "dining-chair", "dining-chairs": "dining-chair",
    sectional: "sectional", sectionals: "sectional",
    table: "table", tables: "table",
    "dining-table": "dining-table", "dining-tables": "dining-table",
    "coffee-table": "coffee-table", "cocktail-table": "coffee-table",
    "side-table": "side-table", "end-table": "side-table",
    "console-table": "console-table", console: "console-table",
    desk: "desk", desks: "desk",
    bed: "bed", beds: "bed",
    dresser: "dresser", dressers: "dresser",
    nightstand: "nightstand", nightstands: "nightstand",
    bookcase: "bookcase", bookcases: "bookcase",
    cabinet: "cabinet", cabinets: "cabinet",
    ottoman: "ottoman", ottomans: "ottoman",
    bench: "bench", benches: "bench",
    rug: "rug", rugs: "rug",
    lamp: "lighting", lamps: "lighting", lighting: "lighting",
    chandelier: "lighting", pendant: "lighting",
    mirror: "mirror", mirrors: "mirror",
    sideboard: "credenza", credenza: "credenza", buffet: "credenza",
    "bar-stool": "bar-stool", "counter-stool": "bar-stool",
    outdoor: "outdoor",
  };
  try {
    const segs = new URL(url).pathname.toLowerCase().split("/").filter(Boolean);
    for (const seg of segs) {
      if (map[seg]) return map[seg];
      for (const [k, v] of Object.entries(map)) {
        if (seg.includes(k)) return v;
      }
    }
  } catch { /* skip */ }
  return null;
}

function slugify(text) {
  return (text || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Extract product data from a fetched HTML page.
 */
function extractProductFromHtml(html, url, vendor) {
  const product = {
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    vendor_domain: vendor.domain,
    vendor_tier: vendor.tier,
    product_url: url,
    ingestion_source: "sitemap-import",
  };

  // ── JSON-LD (best source) ──
  const ld = extractJsonLd(html);
  if (ld) {
    product.product_name = ld.name || null;
    product.description = ld.description || null;
    product.sku = ld.sku || ld.mpn || null;
    product.material = ld.material || null;
    product.category = ld.category || null;
    if (ld.image) {
      const ldImages = Array.isArray(ld.image) ? ld.image : [ld.image];
      const resolvedLdImages = ldImages
        .map(i => typeof i === "object" ? i.url : i)
        .map(i => resolveUrl(i, vendor.domain))
        .filter(Boolean);
      if (resolvedLdImages.length > 0) {
        product.image_url = resolvedLdImages[0];
        product._ld_images = resolvedLdImages;
      }
    }
    if (ld.offers) {
      const offers = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
      product.retail_price = parsePrice(offers.price || offers.highPrice || offers.lowPrice);
    }
    if (ld.brand) {
      const brandName = typeof ld.brand === "object" ? ld.brand.name : ld.brand;
      if (brandName) product.collection = brandName;
    }
    if (ld.color) {
      product.color = typeof ld.color === "string" ? ld.color : null;
    }
  }

  // ── Open Graph ──
  product.product_name = product.product_name || extractMeta(html, "og:title") || null;
  product.image_url = product.image_url || extractMeta(html, "og:image") || null;
  product.description = product.description || extractMeta(html, "og:description") || null;

  // ── Standard meta ──
  product.description = product.description || extractMeta(html, "description") || null;

  // ── Title tag fallback ──
  if (!product.product_name) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      let title = decodeEntities(titleMatch[1].trim());
      // Strip vendor suffixes
      const suffixes = vendor.profile?.title_suffixes || [];
      for (const suf of suffixes) {
        if (title.endsWith(suf)) title = title.slice(0, -suf.length).trim();
        const pipeIdx = title.lastIndexOf("|");
        if (pipeIdx > 0) title = title.slice(0, pipeIdx).trim();
        const dashIdx = title.lastIndexOf(" - ");
        if (dashIdx > 0) title = title.slice(0, dashIdx).trim();
      }
      product.product_name = title || null;
    }
  }

  // ── H1 fallback ──
  if (!product.product_name) {
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) {
      product.product_name = decodeEntities(h1[1].replace(/<[^>]+>/g, "").trim()) || null;
    }
  }

  // ── Collect ALL product images from HTML ──
  const allHtmlImages = [];
  const imgHints = vendor.profile?.image_path_hints || ["/products/", "/images/", "/media/"];
  const imgPattern = /<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  const seenSrcs = new Set();
  let im;
  while ((im = imgPattern.exec(html)) !== null) {
    const src = resolveUrl(im[1], vendor.domain);
    if (src && !seenSrcs.has(src) && imgHints.some((h) => src.includes(h))) {
      seenSrcs.add(src);
      allHtmlImages.push(src);
    }
  }

  // Also grab og:image tags (some pages have multiple)
  const ogPattern = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi;
  let og;
  while ((og = ogPattern.exec(html)) !== null) {
    const src = resolveUrl(og[1], vendor.domain);
    if (src && !seenSrcs.has(src)) {
      seenSrcs.add(src);
      allHtmlImages.push(src);
    }
  }

  // Image fallback for primary
  if (!product.image_url && allHtmlImages.length > 0) {
    product.image_url = allHtmlImages[0];
  }

  // ── Assemble images array: LD images first, then HTML images, deduped ──
  const finalImages = [];
  const finalSeen = new Set();
  for (const src of [...(product._ld_images || []), ...allHtmlImages]) {
    if (!finalSeen.has(src)) {
      finalSeen.add(src);
      finalImages.push(src);
    }
  }
  // Ensure primary image_url is first
  if (product.image_url && !finalSeen.has(product.image_url)) {
    finalImages.unshift(product.image_url);
  } else if (product.image_url && finalImages[0] !== product.image_url) {
    const idx = finalImages.indexOf(product.image_url);
    if (idx > 0) {
      finalImages.splice(idx, 1);
      finalImages.unshift(product.image_url);
    }
  }
  product.images = finalImages.slice(0, 20); // cap at 20 images
  delete product._ld_images;

  // ── Price fallback ──
  if (!product.retail_price) {
    const pricePatterns = [
      /class=["'][^"']*price[^"']*["'][^>]*>\s*\$?([\d,]+(?:\.\d{2})?)/i,
      /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,
      /data-price=["']([\d,.]+)["']/i,
    ];
    for (const pp of pricePatterns) {
      const pm = html.match(pp);
      if (pm) { product.retail_price = parsePrice(pm[1]); break; }
    }
  }

  // ── Category from URL ──
  product.category = product.category || inferCategoryFromUrl(url);

  // Skip products without a name
  if (!product.product_name || product.product_name.length < 3) return null;

  // Generate ID
  product.id = `${vendor.id}_${slugify(product.product_name)}`;

  return product;
}

function resolveUrl(href, domain) {
  if (!href) return null;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `https://${domain}${href}`;
  return null;
}

// ── Concurrency-limited batch fetcher ────────────────────────

/**
 * Fetch and extract products from a list of URLs with concurrency control.
 * Inserts products in batches of BATCH_INSERT_SIZE to avoid memory spikes.
 */
const BATCH_INSERT_SIZE = 50;

async function batchFetchProducts(urls, vendor, progressObj, catalogDB, concurrency = CONCURRENCY) {
  let totalProducts = 0;
  let idx = 0;
  const domainDelay = new Map();
  let pendingBatch = [];

  async function flushBatch() {
    if (pendingBatch.length === 0) return;
    if (catalogDB) {
      catalogDB.insertProducts(pendingBatch);
    }
    totalProducts += pendingBatch.length;
    pendingBatch = [];
  }

  async function worker() {
    while (idx < urls.length) {
      const i = idx++;
      const url = urls[i];

      // Per-domain rate limiting
      let domain;
      try { domain = new URL(url).hostname; } catch { continue; }
      const lastReq = domainDelay.get(domain) || 0;
      const wait = Math.max(0, DOMAIN_DELAY_MS - (Date.now() - lastReq));
      if (wait > 0) await sleep(wait);
      domainDelay.set(domain, Date.now());

      try {
        const html = await fetchText(url);
        if (html) {
          const product = extractProductFromHtml(html, url, vendor);
          if (product) {
            pendingBatch.push(product);
            if (pendingBatch.length >= BATCH_INSERT_SIZE) {
              await flushBatch();
            }
          }
        }
      } catch { /* skip failed pages */ }

      progressObj.pages_fetched = (progressObj.pages_fetched || 0) + 1;
      progressObj.products_found = totalProducts + pendingBatch.length;
      if (i % 25 === 0) {
        progressObj.status = `Fetching page ${i + 1}/${urls.length} (${totalProducts + pendingBatch.length} products)`;
      }
    }
  }

  // Launch workers
  const workers = [];
  for (let w = 0; w < Math.min(concurrency, urls.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  // Flush remaining
  await flushBatch();

  return totalProducts;
}

// ── Main export ──────────────────────────────────────────────

/**
 * Import products from a single vendor via sitemap parsing.
 *
 * @param {object} vendor - { id, name, domain, tier, profile, ... }
 * @param {object} catalogDB - { insertProducts }
 * @returns {Promise<{ vendor_id, products_found, products_imported, urls_discovered, error? }>}
 */
export async function importFromSitemap(vendor, catalogDB) {
  const progress = {
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    status: "Starting sitemap discovery",
    sitemaps_found: 0,
    urls_discovered: 0,
    product_urls: 0,
    pages_fetched: 0,
    products_found: 0,
    products_imported: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
    error: null,
  };
  vendorProgress.set(vendor.id, progress);

  try {
    // 1. Discover and fetch all sitemap URLs
    let allUrls = await fetchAllSitemapUrls(vendor.domain, progress);
    // Also try with www. prefix
    if (allUrls.length === 0) {
      const wwwUrls = await fetchAllSitemapUrls(`www.${vendor.domain}`, progress);
      allUrls.push(...wwwUrls);
    }
    progress.urls_discovered = allUrls.length;

    if (allUrls.length === 0) {
      progress.status = "No sitemap found";
      progress.completed_at = new Date().toISOString();
      return { vendor_id: vendor.id, products_found: 0, products_imported: 0, urls_discovered: 0, error: "No sitemap found" };
    }

    // 2. Filter to product URLs
    const productUrls = filterProductUrls(allUrls, vendor).slice(0, MAX_PRODUCTS_PER_VENDOR);
    // Release the full URL set — we only need the filtered product URLs from here
    allUrls = null;
    progress.product_urls = productUrls.length;
    progress.status = `Found ${productUrls.length} product URLs`;

    if (productUrls.length === 0) {
      progress.status = "No product URLs found in sitemap";
      progress.completed_at = new Date().toISOString();
      return { vendor_id: vendor.id, products_found: 0, products_imported: 0, urls_discovered: allUrls.length, error: "No product URLs in sitemap" };
    }

    // 3. Batch-fetch, extract, and insert products incrementally
    progress.status = `Fetching ${productUrls.length} product pages`;
    const totalProducts = await batchFetchProducts(productUrls, vendor, progress, catalogDB);
    progress.products_found = totalProducts;
    progress.products_imported = totalProducts;

    progress.status = `Complete: ${totalProducts} products`;
    progress.completed_at = new Date().toISOString();

    return {
      vendor_id: vendor.id,
      products_found: totalProducts,
      products_imported: totalProducts,
      urls_discovered: allUrls.length,
      product_urls: productUrls.length,
    };
  } catch (err) {
    progress.status = `Error: ${err.message}`;
    progress.error = err.message;
    progress.completed_at = new Date().toISOString();
    return { vendor_id: vendor.id, products_found: 0, products_imported: 0, urls_discovered: 0, error: err.message };
  }
}

/**
 * Import from sitemaps for multiple vendors.
 */
export async function importAllSitemaps(vendors, catalogDB, concurrentVendors = 3) {
  const results = [];
  let idx = 0;

  async function vendorWorker() {
    while (idx < vendors.length) {
      const vendor = vendors[idx++];
      const result = await importFromSitemap(vendor, catalogDB);
      results.push(result);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(concurrentVendors, vendors.length); i++) {
    workers.push(vendorWorker());
  }
  await Promise.all(workers);

  return results;
}
