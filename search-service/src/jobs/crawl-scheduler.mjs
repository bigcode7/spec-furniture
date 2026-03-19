/**
 * Background Crawl Scheduler for Spekd Furniture Search
 *
 * Crawls vendor websites on a tier-based schedule using direct HTTP requests
 * and HTML parsing. No AI API calls. Products are stored in the local catalog DB.
 *
 * Discovery methods:
 *   A) Direct vendor site crawling via search/category paths
 *   B) DuckDuckGo site-specific search (free, no API key)
 */

import { createHash } from "node:crypto";
import { priorityVendors } from "../config/vendors.mjs";
import { tradeVendors } from "../config/trade-vendors.mjs";

// ── Constants ───────────────────────────────────────────────────────────────

const LOG_PREFIX = "[crawl-scheduler]";
const USER_AGENT = "Spekd-Crawler/1.0 (furniture-search; contact@spekd.design)";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_HTML_SIZE = 500_000;
const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const STAGGER_DELAY_MS = 30_000; // 30 seconds between vendor crawls
const RATE_LIMIT_MS = 2_000; // 2 seconds between requests to same domain
const DDG_RATE_LIMIT_MS = 3_000; // 3 seconds between DuckDuckGo requests
const BACKOFF_DURATION_MS = 60 * 60 * 1000; // 1 hour backoff on 403/429

const TIER_INTERVALS_MS = {
  1: 4 * 60 * 60 * 1000,      // 4 hours
  2: 24 * 60 * 60 * 1000,     // 24 hours
  3: 7 * 24 * 60 * 60 * 1000, // 7 days
  4: 14 * 24 * 60 * 60 * 1000, // 14 days
};

const FURNITURE_CATEGORIES = [
  "sofas", "chairs", "tables", "beds", "dressers", "desks",
  "dining tables", "accent chairs", "nightstands", "bookcases",
  "sectionals", "ottomans", "benches", "consoles", "sideboards",
];

// ── Module State ────────────────────────────────────────────────────────────

let schedulerInterval = null;
let schedulerRunning = false;
let lastSchedulerRun = null;
let nextSchedulerRun = null;

/** Per-domain timestamps for rate limiting */
const domainLastRequest = new Map();

/** Vendors backed off due to 403/429 — maps vendorId to backoff expiry timestamp */
const vendorBackoffs = new Map();

/** Per-vendor crawl status for getCrawlStatus() */
const vendorCrawlStatus = new Map();

/** Track DuckDuckGo last request time */
let ddgLastRequest = 0;

// ── Vendor Resolution ───────────────────────────────────────────────────────

/**
 * Merge trade-vendors and priority vendor profiles into a unified list.
 * Each entry has: id, name, domain, tier, categories, profile, discovery.
 */
function getUnifiedVendors() {
  const profileMap = new Map();
  for (const v of priorityVendors) {
    profileMap.set(v.id, v);
  }

  return tradeVendors.map((tv) => {
    const profile = profileMap.get(tv.id);
    return {
      id: tv.id,
      name: tv.name,
      domain: tv.domain,
      tier: tv.tier,
      categories: tv.categories || [],
      profile: profile?.profile || {},
      discovery: profile?.discovery || {},
    };
  });
}

// ── HTTP Helpers ────────────────────────────────────────────────────────────

function log(...args) {
  console.log(LOG_PREFIX, new Date().toISOString(), ...args);
}

function warn(...args) {
  console.warn(LOG_PREFIX, new Date().toISOString(), ...args);
}

/**
 * Rate-limited fetch that respects per-domain delays.
 */
async function rateLimitedFetch(url, domain) {
  const now = Date.now();
  const lastReq = domainLastRequest.get(domain) || 0;
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastReq));
  if (wait > 0) {
    await sleep(wait);
  }
  domainLastRequest.set(domain, Date.now());
  return fetchHtml(url);
}

/**
 * Rate-limited DuckDuckGo fetch.
 */
async function ddgFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, DDG_RATE_LIMIT_MS - (now - ddgLastRequest));
  if (wait > 0) {
    await sleep(wait);
  }
  ddgLastRequest = Date.now();
  return fetchHtml(url);
}

/**
 * Fetch HTML from a URL with timeout and size limit.
 * Returns null on failure. Throws a special marker on 403/429.
 */
async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (response.status === 403 || response.status === 429) {
      const err = new Error(`HTTP ${response.status}`);
      err.rateLimited = true;
      throw err;
    }

    if (!response.ok) return null;
    const text = await response.text();
    return text.slice(0, MAX_HTML_SIZE);
  } catch (err) {
    if (err.rateLimited) throw err;
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Robots.txt ──────────────────────────────────────────────────────────────

const robotsCache = new Map();

/**
 * Basic robots.txt check. Returns true if the path is allowed.
 */
async function isPathAllowed(domain, path) {
  if (!robotsCache.has(domain)) {
    try {
      const robotsUrl = `https://${domain}/robots.txt`;
      const html = await fetchHtml(robotsUrl);
      robotsCache.set(domain, html || "");
    } catch {
      robotsCache.set(domain, "");
    }
  }

  const robotsTxt = robotsCache.get(domain);
  if (!robotsTxt) return true;

  // Simple check: look for Disallow lines that match our path
  const lines = robotsTxt.split("\n");
  let inWildcardAgent = false;

  for (const rawLine of lines) {
    const line = rawLine.trim().toLowerCase();
    if (line.startsWith("user-agent:")) {
      const agent = line.slice("user-agent:".length).trim();
      inWildcardAgent = agent === "*";
    } else if (inWildcardAgent && line.startsWith("disallow:")) {
      const disallowed = line.slice("disallow:".length).trim();
      if (disallowed && path.toLowerCase().startsWith(disallowed)) {
        return false;
      }
    }
  }

  return true;
}

// ── HTML Parsing (regex-based, no dependencies) ─────────────────────────────

/**
 * Extract product links from a vendor's listing/search page HTML.
 */
function extractProductLinks(html, vendor) {
  const links = new Set();
  const domain = vendor.domain;
  const productTokens = vendor.profile?.product_path_tokens || ["product", "products"];
  const rejectTokens = vendor.profile?.reject_path_tokens || [];

  // Extract all anchor hrefs
  const anchorPattern = /<a[^>]+href="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1];
    const resolved = resolveUrl(href, domain);
    if (!resolved) continue;

    // Must be on the vendor's domain
    try {
      const parsedUrl = new URL(resolved);
      const host = parsedUrl.hostname.replace(/^www\./, "");
      if (!host.endsWith(domain.replace(/^www\./, ""))) continue;

      const path = parsedUrl.pathname.toLowerCase();

      // Reject non-product paths
      if (rejectTokens.some((token) => path === `/${token}` || path === `/${token}/`)) continue;

      // Accept paths containing product tokens
      if (productTokens.some((token) => path.includes(`/${token}/`) || path.includes(`/${token}`))) {
        links.add(resolved);
      }
    } catch {
      continue;
    }
  }

  return Array.from(links);
}

/**
 * Extract product data from a product page HTML.
 */
function extractProductFromPage(html, url, vendor) {
  const product = {
    product_name: null,
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    vendor_domain: vendor.domain,
    vendor_tier: vendor.tier,
    category: null,
    material: null,
    style: null,
    image_url: null,
    product_url: url,
    description: null,
    retail_price: null,
    ingestion_source: "crawl",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // ── JSON-LD structured data (best source) ──
  const jsonLd = extractJsonLd(html);
  if (jsonLd) {
    product.product_name = product.product_name || jsonLd.name || null;
    product.description = product.description || jsonLd.description || null;
    product.image_url = product.image_url || normalizeImage(jsonLd.image, vendor) || null;
    product.category = product.category || jsonLd.category || null;
    product.material = product.material || jsonLd.material || null;
    if (jsonLd.offers) {
      const offers = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
      product.retail_price = parsePrice(offers.price || offers.highPrice) || null;
    }
  }

  // ── Open Graph meta tags ──
  product.product_name = product.product_name || extractMeta(html, "og:title") || null;
  product.image_url = product.image_url || extractMeta(html, "og:image") || null;
  product.description = product.description || extractMeta(html, "og:description") || null;

  // ── Standard meta tags ──
  product.description = product.description || extractMeta(html, "description") || null;

  // ── Title tag ──
  if (!product.product_name) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      let title = decodeHtmlEntities(titleMatch[1].trim());
      // Strip vendor suffixes
      const suffixes = vendor.profile?.title_suffixes || [];
      for (const suffix of suffixes) {
        if (title.endsWith(suffix)) {
          title = title.slice(0, -suffix.length).trim();
        }
      }
      product.product_name = title || null;
    }
  }

  // ── H1 tag (fallback for name) ──
  if (!product.product_name) {
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      product.product_name = decodeHtmlEntities(h1Match[1].trim()) || null;
    }
  }

  // ── Product image fallback ──
  if (!product.image_url) {
    product.image_url = extractProductImage(html, vendor) || null;
  }

  // ── Price fallback (common patterns) ──
  if (!product.retail_price) {
    product.retail_price = extractPrice(html) || null;
  }

  // ── Category from URL path ──
  if (!product.category) {
    product.category = inferCategoryFromUrl(url) || null;
  }

  // Skip products without a name
  if (!product.product_name) return null;

  // Generate stable ID
  product.id = `${vendor.id}_${slugify(product.product_name)}`;

  return product;
}

/**
 * Extract JSON-LD structured data from HTML.
 */
function extractJsonLd(html) {
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      // Handle @graph arrays
      const items = data["@graph"] || [data];
      for (const item of Array.isArray(items) ? items : [items]) {
        const type = item["@type"];
        if (type === "Product" || type === "IndividualProduct" ||
            (Array.isArray(type) && type.includes("Product"))) {
          return item;
        }
      }
    } catch {
      // Malformed JSON-LD, skip
    }
  }
  return null;
}

/**
 * Extract a meta tag value by property or name.
 */
function extractMeta(html, name) {
  // Try property="..." first (Open Graph)
  const propPattern = new RegExp(
    `<meta[^>]+property=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const propMatch = html.match(propPattern);
  if (propMatch) return decodeHtmlEntities(propMatch[1]);

  // Try content before property
  const propPattern2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(name)}["']`,
    "i"
  );
  const propMatch2 = html.match(propPattern2);
  if (propMatch2) return decodeHtmlEntities(propMatch2[1]);

  // Try name="..." (standard meta)
  const namePattern = new RegExp(
    `<meta[^>]+name=["']${escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const nameMatch = html.match(namePattern);
  if (nameMatch) return decodeHtmlEntities(nameMatch[1]);

  // Try content before name
  const namePattern2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegex(name)}["']`,
    "i"
  );
  const nameMatch2 = html.match(namePattern2);
  if (nameMatch2) return decodeHtmlEntities(nameMatch2[1]);

  return null;
}

/**
 * Extract a product image from HTML using vendor hints.
 */
function extractProductImage(html, vendor) {
  const imageHints = vendor.profile?.image_path_hints || ["/products/", "/images/", "/media/"];

  // Try img tags with hint paths
  const imgPattern = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = imgPattern.exec(html)) !== null) {
    const src = match[1];
    if (imageHints.some((hint) => src.includes(hint))) {
      return resolveUrl(src, vendor.domain);
    }
  }

  // Try data-src (lazy loading)
  const lazySrcPattern = /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi;
  while ((match = lazySrcPattern.exec(html)) !== null) {
    const src = match[1];
    if (imageHints.some((hint) => src.includes(hint))) {
      return resolveUrl(src, vendor.domain);
    }
  }

  // Fallback: first reasonably-sized image
  const allImgs = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi) || [];
  for (const imgTag of allImgs) {
    const src = imgTag.match(/src=["']([^"']+)["']/i)?.[1];
    if (!src) continue;
    // Skip tiny icons, tracking pixels, etc.
    if (src.includes("pixel") || src.includes("spacer") || src.includes(".gif") ||
        src.includes("logo") || src.includes("icon") || src.includes("svg")) continue;
    return resolveUrl(src, vendor.domain);
  }

  return null;
}

/**
 * Extract price from HTML using common patterns.
 */
function extractPrice(html) {
  // Common price patterns: $1,234.56 or $1234
  const pricePatterns = [
    /class=["'][^"']*price[^"']*["'][^>]*>\s*\$?([\d,]+(?:\.\d{2})?)/i,
    /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,
    /data-price=["']([\d,.]+)["']/i,
  ];

  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (match) {
      return parsePrice(match[1]);
    }
  }

  return null;
}

function parsePrice(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Infer a product category from its URL path.
 */
function inferCategoryFromUrl(url) {
  const categoryMap = {
    sofa: "seating", sofas: "seating", couch: "seating",
    chair: "seating", chairs: "seating", "accent-chair": "seating",
    sectional: "seating", sectionals: "seating",
    ottoman: "seating", ottomans: "seating",
    bench: "seating", benches: "seating",
    table: "tables", tables: "tables",
    "dining-table": "dining", "coffee-table": "tables",
    "side-table": "tables", "end-table": "tables",
    "console-table": "tables", console: "tables",
    desk: "home-office", desks: "home-office",
    bed: "bedroom", beds: "bedroom",
    dresser: "bedroom", dressers: "bedroom",
    nightstand: "bedroom", nightstands: "bedroom",
    bookcase: "storage", bookcases: "storage",
    cabinet: "storage", cabinets: "storage",
    sideboard: "storage", sideboards: "storage",
    buffet: "dining", credenza: "storage",
    lamp: "lighting", lamps: "lighting", lighting: "lighting",
    chandelier: "lighting", pendant: "lighting", sconce: "lighting",
    mirror: "mirrors", mirrors: "mirrors",
    rug: "rugs", rugs: "rugs",
  };

  try {
    const path = new URL(url).pathname.toLowerCase();
    const segments = path.split("/").filter(Boolean);
    for (const segment of segments) {
      if (categoryMap[segment]) return categoryMap[segment];
      // Check hyphenated segments
      for (const [key, value] of Object.entries(categoryMap)) {
        if (segment.includes(key)) return value;
      }
    }
  } catch {
    // skip
  }

  return null;
}

// ── String Utilities ────────────────────────────────────────────────────────

function slugify(text) {
  if (!text) return createHash("md5").update(String(Date.now())).digest("hex").slice(0, 12);
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function resolveUrl(href, domain) {
  if (!href) return null;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `https://${domain}${href}`;
  return null;
}

function normalizeImage(img, vendor) {
  if (!img) return null;
  if (Array.isArray(img)) img = img[0];
  if (typeof img === "object" && img.url) img = img.url;
  if (typeof img !== "string") return null;
  return resolveUrl(img, vendor.domain);
}

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&nbsp;/g, " ");
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── DuckDuckGo Discovery ────────────────────────────────────────────────────

/**
 * Search DuckDuckGo for vendor products (free, no API key).
 */
async function searchDuckDuckGo(domain, query) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${domain} ${query}`)}`;
  log(`DDG search: site:${domain} ${query}`);

  const html = await ddgFetch(searchUrl);
  if (!html) return [];

  return extractDdgResultLinks(html, domain);
}

/**
 * Extract result links from DuckDuckGo HTML response.
 */
function extractDdgResultLinks(html, domain) {
  const links = [];
  const anchorPattern = /<a[^>]+href="([^"]+)"[^>]*class="[^"]*result__a[^"]*"[^>]*>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const resolved = resolveDdgHref(match[1]);
    if (resolved && resolved.includes(domain)) {
      links.push(resolved);
    }
  }

  // Broader fallback: any href containing the domain
  if (links.length === 0) {
    const broadPattern = /<a[^>]+href="([^"]+)"[^>]*>/gi;
    while ((match = broadPattern.exec(html)) !== null) {
      const resolved = resolveDdgHref(match[1]);
      if (resolved && resolved.includes(domain)) {
        links.push(resolved);
      }
    }
  }

  return Array.from(new Set(links));
}

function resolveDdgHref(href) {
  if (!href) return null;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;

  try {
    const wrapped = new URL(href, "https://html.duckduckgo.com");
    const uddg = wrapped.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : null;
  } catch {
    return null;
  }
}

// ── Core Crawl Logic ────────────────────────────────────────────────────────

/**
 * Crawl a single vendor: discover product URLs, fetch pages, extract data.
 */
async function crawlVendor(vendor, catalogDB, queryTerms = null) {
  const vendorId = vendor.id;
  log(`Starting crawl for ${vendor.name} (tier ${vendor.tier})`);

  // Check backoff
  const backoffExpiry = vendorBackoffs.get(vendorId);
  if (backoffExpiry && Date.now() < backoffExpiry) {
    log(`Skipping ${vendor.name} — backed off until ${new Date(backoffExpiry).toISOString()}`);
    return [];
  }

  const discoveredProducts = [];
  const existingProducts = await safeCall(() => catalogDB.getProductsByVendor(vendorId));
  const existingUrls = new Set((existingProducts || []).map((p) => p.product_url).filter(Boolean));

  // Determine search terms
  const terms = queryTerms || selectCrawlTerms(vendor);

  try {
    // ── Method A: Direct vendor site crawling ──
    let productLinks = [];

    for (const term of terms) {
      // Search paths
      if (vendor.discovery?.search_paths) {
        for (const searchPath of vendor.discovery.search_paths) {
          const resolvedPath = searchPath.replace("{query}", encodeURIComponent(term));
          const searchUrl = `https://${vendor.domain}${resolvedPath}`;

          // Check robots.txt
          const pathOnly = new URL(searchUrl).pathname;
          if (!(await isPathAllowed(vendor.domain, pathOnly))) {
            log(`Robots.txt blocks ${pathOnly} on ${vendor.domain}, skipping`);
            continue;
          }

          try {
            const html = await rateLimitedFetch(searchUrl, vendor.domain);
            if (html) {
              const links = extractProductLinks(html, vendor);
              productLinks.push(...links);
              log(`Found ${links.length} product links from search: ${vendor.domain}${pathOnly}`);
            }
          } catch (err) {
            if (err.rateLimited) {
              handleRateLimit(vendor);
              return discoveredProducts;
            }
          }
        }
      }

      // Category paths
      if (vendor.discovery?.category_paths) {
        for (const [category, paths] of Object.entries(vendor.discovery.category_paths)) {
          for (const catPath of paths) {
            const catUrl = `https://${vendor.domain}${catPath}`;
            const pathOnly = new URL(catUrl).pathname;

            if (!(await isPathAllowed(vendor.domain, pathOnly))) {
              log(`Robots.txt blocks ${pathOnly} on ${vendor.domain}, skipping`);
              continue;
            }

            try {
              const html = await rateLimitedFetch(catUrl, vendor.domain);
              if (html) {
                const links = extractProductLinks(html, vendor);
                productLinks.push(...links);
                log(`Found ${links.length} product links from category "${category}": ${vendor.domain}${pathOnly}`);
              }
            } catch (err) {
              if (err.rateLimited) {
                handleRateLimit(vendor);
                return discoveredProducts;
              }
            }
          }
        }
      }
    }

    // ── Method B: DuckDuckGo fallback ──
    if (productLinks.length === 0) {
      log(`No direct links for ${vendor.name}, trying DuckDuckGo`);
      for (const term of terms.slice(0, 3)) {
        try {
          const ddgLinks = await searchDuckDuckGo(vendor.domain, term);
          productLinks.push(...ddgLinks);
          if (productLinks.length >= 10) break;
        } catch {
          // DDG failed, continue
        }
      }
    }

    // Deduplicate and filter already-known URLs
    productLinks = Array.from(new Set(productLinks))
      .filter((url) => !existingUrls.has(url))
      .slice(0, 20); // Cap at 20 product pages per crawl

    log(`${vendor.name}: ${productLinks.length} new product URLs to fetch`);

    // ── Fetch product pages and extract data ──
    for (const productUrl of productLinks) {
      try {
        const html = await rateLimitedFetch(productUrl, vendor.domain);
        if (!html) continue;

        const product = extractProductFromPage(html, productUrl, vendor);
        if (product && product.product_name) {
          discoveredProducts.push(product);
        }
      } catch (err) {
        if (err.rateLimited) {
          handleRateLimit(vendor);
          break;
        }
      }
    }

    // ── Store results ──
    if (discoveredProducts.length > 0) {
      await safeCall(() => catalogDB.insertProducts(discoveredProducts));
      log(`Inserted ${discoveredProducts.length} products for ${vendor.name}`);
    }

    // Update crawl metadata
    await safeCall(() =>
      catalogDB.setVendorCrawlMeta(vendorId, {
        last_crawled_at: new Date().toISOString(),
        product_count: (existingProducts?.length || 0) + discoveredProducts.length,
      })
    );

    vendorCrawlStatus.set(vendorId, {
      lastCrawl: new Date().toISOString(),
      productsFound: discoveredProducts.length,
      status: "ok",
    });

    log(`Finished crawl for ${vendor.name}: ${discoveredProducts.length} new products`);
  } catch (err) {
    warn(`Crawl error for ${vendor.name}:`, err.message);
    vendorCrawlStatus.set(vendorId, {
      lastCrawl: new Date().toISOString(),
      productsFound: 0,
      status: "error",
      error: err.message,
    });
  }

  return discoveredProducts;
}

/**
 * Select which furniture category terms to crawl for a vendor.
 * Pick terms relevant to the vendor's known categories.
 */
function selectCrawlTerms(vendor) {
  const categoryTermMap = {
    seating: ["sofas", "chairs", "accent chairs", "sectionals"],
    tables: ["tables", "coffee tables", "side tables", "console tables"],
    bedroom: ["beds", "dressers", "nightstands"],
    dining: ["dining tables", "dining chairs"],
    storage: ["bookcases", "cabinets", "sideboards"],
    "home-office": ["desks"],
    lighting: ["lamps", "chandeliers", "pendants"],
    accents: ["accent tables", "ottomans", "benches"],
    outdoor: ["outdoor furniture"],
    rugs: ["rugs"],
    mirrors: ["mirrors"],
  };

  const terms = new Set();
  for (const cat of vendor.categories || []) {
    const mapped = categoryTermMap[cat];
    if (mapped) {
      for (const term of mapped) terms.add(term);
    }
  }

  // Always include some core terms
  if (terms.size === 0) {
    return FURNITURE_CATEGORIES.slice(0, 6);
  }

  return Array.from(terms).slice(0, 8);
}

function handleRateLimit(vendor) {
  const expiry = Date.now() + BACKOFF_DURATION_MS;
  vendorBackoffs.set(vendor.id, expiry);
  warn(`${vendor.name} returned 403/429 — backing off until ${new Date(expiry).toISOString()}`);
  vendorCrawlStatus.set(vendor.id, {
    lastCrawl: new Date().toISOString(),
    productsFound: 0,
    status: "rate-limited",
    backoffUntil: new Date(expiry).toISOString(),
  });
}

async function safeCall(fn) {
  try {
    return await fn();
  } catch (err) {
    warn("DB operation failed:", err.message);
    return null;
  }
}

// ── Scheduler ───────────────────────────────────────────────────────────────

/**
 * Main scheduler tick: check which vendors are due for a crawl and run them.
 */
async function schedulerTick(catalogDB) {
  if (!schedulerRunning) return;

  const now = Date.now();
  lastSchedulerRun = new Date().toISOString();
  nextSchedulerRun = new Date(now + SCHEDULER_INTERVAL_MS).toISOString();

  const vendors = getUnifiedVendors();
  const dueCrawls = [];

  for (const vendor of vendors) {
    const intervalMs = TIER_INTERVALS_MS[vendor.tier] || TIER_INTERVALS_MS[4];
    const meta = await safeCall(() => catalogDB.getVendorCrawlMeta(vendor.id));
    const lastCrawled = meta?.last_crawled_at ? new Date(meta.last_crawled_at).getTime() : 0;

    if (now - lastCrawled >= intervalMs) {
      dueCrawls.push(vendor);
    }
  }

  if (dueCrawls.length === 0) {
    log("Scheduler tick: no vendors due for crawling");
    return;
  }

  log(`Scheduler tick: ${dueCrawls.length} vendors due for crawling`);

  // Sort by tier (highest priority first), then stagger
  dueCrawls.sort((a, b) => a.tier - b.tier);

  for (let i = 0; i < dueCrawls.length; i++) {
    if (!schedulerRunning) {
      log("Scheduler stopped mid-crawl");
      break;
    }

    const vendor = dueCrawls[i];
    await crawlVendor(vendor, catalogDB);

    // Stagger: wait between vendor crawls (skip delay after the last one)
    if (i < dueCrawls.length - 1) {
      await sleep(STAGGER_DELAY_MS);
    }
  }

  log("Scheduler tick complete");
}

// ── Exported Functions ──────────────────────────────────────────────────────

/**
 * Start the background crawl scheduler.
 *
 * @param {object} catalogDB - Database interface with:
 *   - insertProducts(products)
 *   - getVendorCrawlMeta(vendorId) => { last_crawled_at, product_count }
 *   - setVendorCrawlMeta(vendorId, meta)
 *   - getProductsByVendor(vendorId) => products[]
 */
export function startCrawlScheduler(catalogDB) {
  if (schedulerRunning) {
    warn("Scheduler is already running");
    return;
  }

  schedulerRunning = true;
  log("Starting crawl scheduler");

  // Run first tick immediately (async, don't block startup)
  schedulerTick(catalogDB).catch((err) => {
    warn("Initial scheduler tick error:", err.message);
  });

  // Schedule recurring ticks
  schedulerInterval = setInterval(() => {
    schedulerTick(catalogDB).catch((err) => {
      warn("Scheduler tick error:", err.message);
    });
  }, SCHEDULER_INTERVAL_MS);

  log(`Scheduler started — checking every ${SCHEDULER_INTERVAL_MS / 1000}s`);
}

/**
 * Stop the background crawl scheduler.
 */
export function stopCrawlScheduler() {
  if (!schedulerRunning) {
    warn("Scheduler is not running");
    return;
  }

  schedulerRunning = false;
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  log("Scheduler stopped");
}

/**
 * Manually trigger a crawl for a specific vendor.
 *
 * @param {string} vendorId
 * @param {object} catalogDB
 * @returns {Promise<object[]>} Discovered products
 */
export async function crawlVendorNow(vendorId, catalogDB) {
  const vendors = getUnifiedVendors();
  const vendor = vendors.find((v) => v.id === vendorId);
  if (!vendor) {
    warn(`Vendor not found: ${vendorId}`);
    return [];
  }

  log(`Manual crawl triggered for ${vendor.name}`);
  return crawlVendor(vendor, catalogDB);
}

/**
 * Get current crawl scheduler status.
 *
 * @returns {{ running: boolean, lastRun: string|null, nextRun: string|null, vendorStatus: object }}
 */
export function getCrawlStatus() {
  const vendorStatus = {};
  for (const [id, status] of vendorCrawlStatus.entries()) {
    vendorStatus[id] = status;
  }

  return {
    running: schedulerRunning,
    lastRun: lastSchedulerRun,
    nextRun: nextSchedulerRun,
    vendorStatus,
  };
}

/**
 * On-demand crawl for a specific search query (Tier 2 fallback).
 *
 * Called when the local catalog has fewer than 8 results for a query.
 * Quickly searches DuckDuckGo and fetches top results from relevant vendors.
 * Designed to complete in 2-5 seconds.
 *
 * @param {string} query - Search query (e.g., "mid century walnut desk")
 * @param {string[]} vendorIds - Vendor IDs to search (top 5 recommended)
 * @param {object} catalogDB
 * @returns {Promise<object[]>} Discovered products
 */
export async function crawlForQuery(query, vendorIds, catalogDB) {
  const startTime = Date.now();
  log(`On-demand crawl for query: "${query}" across ${vendorIds.length} vendors`);

  const vendors = getUnifiedVendors();
  const targetVendors = vendorIds
    .map((id) => vendors.find((v) => v.id === id))
    .filter(Boolean)
    .slice(0, 5);

  if (targetVendors.length === 0) {
    warn("No matching vendors found for crawlForQuery");
    return [];
  }

  const allProducts = [];

  // Run DDG searches in parallel for speed (one per vendor)
  const ddgSearches = targetVendors.map(async (vendor) => {
    // Check backoff
    const backoffExpiry = vendorBackoffs.get(vendor.id);
    if (backoffExpiry && Date.now() < backoffExpiry) return [];

    try {
      const links = await searchDuckDuckGo(vendor.domain, query);
      // Only take top 3 links per vendor for speed
      return links.slice(0, 3).map((url) => ({ url, vendor }));
    } catch {
      return [];
    }
  });

  const ddgResults = await Promise.allSettled(ddgSearches);
  const pagesToFetch = [];
  for (const result of ddgResults) {
    if (result.status === "fulfilled") {
      pagesToFetch.push(...result.value);
    }
  }

  log(`On-demand: ${pagesToFetch.length} pages to fetch for "${query}"`);

  // Fetch pages in parallel (limited concurrency for speed)
  const fetchPromises = pagesToFetch.slice(0, 10).map(async ({ url, vendor }) => {
    try {
      const html = await rateLimitedFetch(url, vendor.domain);
      if (!html) return null;
      return extractProductFromPage(html, url, vendor);
    } catch (err) {
      if (err.rateLimited) {
        handleRateLimit(vendor);
      }
      return null;
    }
  });

  const fetchResults = await Promise.allSettled(fetchPromises);
  for (const result of fetchResults) {
    if (result.status === "fulfilled" && result.value) {
      allProducts.push(result.value);
    }
  }

  // Deduplicate
  const seen = new Set();
  const deduped = [];
  for (const product of allProducts) {
    if (!seen.has(product.product_url)) {
      seen.add(product.product_url);
      deduped.push(product);
    }
  }

  // Insert into catalog
  if (deduped.length > 0) {
    await safeCall(() => catalogDB.insertProducts(deduped));
  }

  const elapsed = Date.now() - startTime;
  log(`On-demand crawl complete: ${deduped.length} products in ${elapsed}ms`);

  return deduped;
}
