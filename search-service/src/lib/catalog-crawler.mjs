/**
 * Catalog Crawler
 *
 * Builds a local product catalog from trade furniture manufacturers.
 * Uses AI web search to discover products from each vendor's website,
 * then extracts structured data and stores it locally.
 *
 * Strategy:
 * 1. For each vendor, generate category-specific search queries
 * 2. AI web search finds real product pages on the vendor's site
 * 3. Extract structured product data from each discovered page
 * 4. Normalize and dedupe into catalog store
 * 5. Run periodically to keep catalog fresh
 */

import fs from "node:fs";
import path from "node:path";
import { tradeVendors } from "../config/trade-vendors.mjs";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = "claude-sonnet-4-20250514";

const catalogDir = path.resolve("search-service/data");
const catalogPath = path.join(catalogDir, "trade-catalog.json");
const crawlLogPath = path.join(catalogDir, "crawl-log.json");

// ── Catalog Store ──────────────────────────────────────────

function ensureCatalogDir() {
  fs.mkdirSync(catalogDir, { recursive: true });
}

export function readTradeCatalog() {
  ensureCatalogDir();
  if (!fs.existsSync(catalogPath)) {
    return { products: [], vendors: {}, updated_at: null, crawl_count: 0 };
  }
  try {
    return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  } catch {
    return { products: [], vendors: {}, updated_at: null, crawl_count: 0 };
  }
}

function writeTradeCatalog(catalog) {
  ensureCatalogDir();
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
}

function appendCrawlLog(entry) {
  ensureCatalogDir();
  let log = { entries: [] };
  if (fs.existsSync(crawlLogPath)) {
    try { log = JSON.parse(fs.readFileSync(crawlLogPath, "utf8")); } catch {}
  }
  log.entries = [entry, ...(log.entries || [])].slice(0, 200);
  fs.writeFileSync(crawlLogPath, JSON.stringify(log, null, 2));
}

// ── AI API Call ────────────────────────────────────────────

async function callAnthropic({ system, prompt, tools, maxTokens = 8192 }) {
  if (!ANTHROPIC_API_KEY) return null;

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  };
  if (system) body.system = system;
  if (tools) body.tools = tools;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[catalog-crawler] API error ${response.status}: ${errText.slice(0, 200)}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error(`[catalog-crawler] API call failed:`, err.message);
    return null;
  }
}

function extractTextFromResponse(response) {
  if (!response?.content) return "";
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

// ── Category Search Queries ────────────────────────────────

const CATEGORY_QUERIES = [
  "sofas",
  "sectionals",
  "accent chairs",
  "dining tables",
  "dining chairs",
  "coffee tables",
  "side tables console tables",
  "beds headboards",
  "dressers nightstands",
  "bookcases cabinets storage",
  "desks office furniture",
  "bar stools counter stools",
  "benches ottomans",
  "media consoles entertainment",
  "outdoor furniture",
];

function buildVendorQueries(vendor) {
  // Generate targeted search queries for each vendor + category
  return CATEGORY_QUERIES.map((cat) => `site:${vendor.domain} ${cat}`);
}

// ── Crawl Single Vendor ────────────────────────────────────

const DISCOVER_SYSTEM = `You are a furniture product data extractor. You search vendor websites and extract structured product information.

When you find products on a vendor's website, extract this data for EACH product:
- product_name: The full product name
- collection: The collection name if mentioned
- sku: SKU or item number if visible
- category: One of: sofa, sectional, chair, accent-chair, dining-table, dining-chair, coffee-table, side-table, console-table, desk, bed, headboard, dresser, nightstand, bookcase, cabinet, media-console, bar-stool, bench, ottoman, rug, lighting, mirror, accent
- material: Primary materials (e.g., "solid walnut", "performance fabric", "leather")
- dimensions: Width x Depth x Height if available
- style: Design style (e.g., "modern", "transitional", "traditional", "mid-century")
- image_url: Direct URL to the primary product image
- product_url: Direct URL to the product page
- description: Brief product description (1-2 sentences max)

IMPORTANT:
- Only extract products that are ACTUALLY on the vendor's website
- Use the REAL URLs you find — do not fabricate URLs
- Extract as many products as you can find (aim for 10-20 per search)
- Skip non-product pages (about, contact, blog, etc.)`;

async function discoverVendorProducts(vendor, categoryQuery) {
  const prompt = `Search for "${categoryQuery}" and find real furniture products. For each product you find, extract the structured data.

Return a JSON array of products. Each product should have these fields:
- product_name (string, required)
- collection (string or null)
- sku (string or null)
- category (string, required)
- material (string or null)
- dimensions (string or null)
- style (string or null)
- image_url (string or null)
- product_url (string, required)
- description (string or null)

Return ONLY the JSON array, no other text. Example:
[{"product_name": "...", "collection": "...", ...}]`;

  const response = await callAnthropic({
    system: DISCOVER_SYSTEM,
    prompt,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    maxTokens: 8192,
  });

  if (!response) return [];

  const text = extractTextFromResponse(response);
  if (!text) return [];

  // Extract JSON array from response
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const products = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(products)) return [];

    // Validate and tag each product
    return products
      .filter((p) => p.product_name && p.product_url)
      .map((p) => ({
        id: `${vendor.id}_${generateProductId(p)}`,
        product_name: String(p.product_name).trim(),
        vendor_id: vendor.id,
        vendor_name: vendor.name,
        vendor_domain: vendor.domain,
        vendor_tier: vendor.tier,
        collection: p.collection || null,
        sku: p.sku || null,
        category: normalizeCategory(p.category),
        material: p.material || null,
        dimensions: p.dimensions || null,
        style: p.style || null,
        image_url: p.image_url || null,
        product_url: p.product_url || null,
        description: p.description || null,
        ingestion_source: "catalog-crawler",
        crawled_at: new Date().toISOString(),
      }));
  } catch (err) {
    console.error(`[catalog-crawler] JSON parse error for ${vendor.name}/${categoryQuery}:`, err.message);
    return [];
  }
}

function generateProductId(product) {
  const name = (product.product_name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const sku = (product.sku || "").replace(/[^a-z0-9]/gi, "").slice(0, 12);
  return sku ? `${sku}_${name}` : name;
}

function normalizeCategory(raw) {
  if (!raw) return "accent";
  const c = raw.toLowerCase().replace(/[^a-z-]/g, "");
  const MAP = {
    sofa: "sofa", sofas: "sofa", couch: "sofa",
    sectional: "sectional", sectionals: "sectional",
    chair: "chair", chairs: "chair", "accent-chair": "accent-chair", "accentchair": "accent-chair",
    "dining-table": "dining-table", "diningtable": "dining-table",
    "dining-chair": "dining-chair", "diningchair": "dining-chair",
    "coffee-table": "coffee-table", "coffeetable": "coffee-table",
    "side-table": "side-table", "sidetable": "side-table", "end-table": "side-table",
    "console-table": "console-table", "consoletable": "console-table", console: "console-table",
    desk: "desk", desks: "desk",
    bed: "bed", beds: "bed",
    headboard: "headboard", headboards: "headboard",
    dresser: "dresser", dressers: "dresser",
    nightstand: "nightstand", nightstands: "nightstand",
    bookcase: "bookcase", bookcases: "bookcase",
    cabinet: "cabinet", cabinets: "cabinet",
    "media-console": "media-console", "mediaconsole": "media-console",
    "bar-stool": "bar-stool", "barstool": "bar-stool",
    bench: "bench", benches: "bench",
    ottoman: "ottoman", ottomans: "ottoman",
    rug: "rug", rugs: "rug",
    lighting: "lighting", lamp: "lighting", lamps: "lighting", chandelier: "lighting",
    mirror: "mirror", mirrors: "mirror",
    accent: "accent", accents: "accent",
    table: "table", tables: "table",
    storage: "storage",
  };
  return MAP[c] || "accent";
}

// ── Crawl All Vendors ──────────────────────────────────────

/**
 * Crawl a single vendor across all categories.
 * Returns array of discovered products.
 */
export async function crawlVendor(vendorId, options = {}) {
  const vendor = tradeVendors.find((v) => v.id === vendorId);
  if (!vendor) {
    console.error(`[catalog-crawler] Unknown vendor: ${vendorId}`);
    return [];
  }

  const maxCategories = options.maxCategories || 8;
  const queries = buildVendorQueries(vendor).slice(0, maxCategories);
  const allProducts = [];
  const seenUrls = new Set();

  console.log(`[catalog-crawler] Crawling ${vendor.name} (${queries.length} categories)...`);

  // Run queries sequentially to avoid rate limits
  for (const query of queries) {
    console.log(`[catalog-crawler]   Searching: ${query}`);
    const products = await discoverVendorProducts(vendor, query);

    for (const product of products) {
      const key = product.product_url || product.product_name;
      if (!seenUrls.has(key)) {
        seenUrls.add(key);
        allProducts.push(product);
      }
    }

    // Longer pause between queries to respect 30K tokens/min rate limit
    await new Promise((r) => setTimeout(r, 15000));
  }

  console.log(`[catalog-crawler] ${vendor.name}: discovered ${allProducts.length} unique products`);
  return allProducts;
}

/**
 * Crawl all registered trade vendors and build the catalog.
 * This is the main entry point for building/refreshing the catalog.
 */
export async function crawlAllVendors(options = {}) {
  const vendorIds = options.vendorIds || tradeVendors.map((v) => v.id);
  const maxCategories = options.maxCategories || 6; // fewer categories per vendor to stay within rate limits
  const startTime = Date.now();
  const results = {};

  console.log(`\n[catalog-crawler] Starting full catalog crawl for ${vendorIds.length} vendors...`);
  console.log(`[catalog-crawler] Categories per vendor: ${maxCategories}\n`);

  const existingCatalog = readTradeCatalog();
  const existingProducts = existingCatalog.products || [];
  const existingByUrl = new Map();
  for (const p of existingProducts) {
    if (p.product_url) existingByUrl.set(p.product_url, p);
  }

  let newProducts = [];

  for (const vendorId of vendorIds) {
    const vendorProducts = await crawlVendor(vendorId, { maxCategories });
    results[vendorId] = {
      discovered: vendorProducts.length,
      new: 0,
    };

    for (const product of vendorProducts) {
      if (!existingByUrl.has(product.product_url)) {
        newProducts.push(product);
        existingByUrl.set(product.product_url, product);
        results[vendorId].new++;
      }
    }

    // Longer pause between vendors to respect rate limits
    await new Promise((r) => setTimeout(r, 30000));
  }

  // Merge new products into catalog
  const mergedProducts = [...existingProducts, ...newProducts];

  const catalog = {
    products: mergedProducts,
    vendors: {},
    updated_at: new Date().toISOString(),
    crawl_count: (existingCatalog.crawl_count || 0) + 1,
  };

  // Build vendor summary
  for (const product of mergedProducts) {
    if (!catalog.vendors[product.vendor_id]) {
      catalog.vendors[product.vendor_id] = {
        name: product.vendor_name,
        count: 0,
        categories: new Set(),
      };
    }
    catalog.vendors[product.vendor_id].count++;
    catalog.vendors[product.vendor_id].categories.add(product.category);
  }

  // Convert Sets to arrays for JSON serialization
  for (const v of Object.values(catalog.vendors)) {
    v.categories = [...v.categories];
  }

  writeTradeCatalog(catalog);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const logEntry = {
    timestamp: new Date().toISOString(),
    vendors_crawled: vendorIds.length,
    new_products: newProducts.length,
    total_products: mergedProducts.length,
    elapsed_seconds: Number(elapsed),
    vendor_results: results,
  };
  appendCrawlLog(logEntry);

  console.log(`\n[catalog-crawler] Crawl complete in ${elapsed}s`);
  console.log(`[catalog-crawler] New products: ${newProducts.length}`);
  console.log(`[catalog-crawler] Total catalog: ${mergedProducts.length}`);
  console.log(`[catalog-crawler] Vendors:`, JSON.stringify(results, null, 2));

  return logEntry;
}

// ── Search Trade Catalog ───────────────────────────────────

/**
 * Search the local trade catalog using text matching.
 * Fast, runs locally, no API calls needed.
 */
export function searchTradeCatalog(query, filters = {}, limit = 50) {
  const catalog = readTradeCatalog();
  if (!catalog.products || catalog.products.length === 0) return [];

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return catalog.products.slice(0, limit);

  // Score each product
  const scored = catalog.products.map((product) => {
    let score = 0;
    const searchText = [
      product.product_name,
      product.vendor_name,
      product.collection,
      product.category,
      product.material,
      product.style,
      product.description,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const term of terms) {
      if (searchText.includes(term)) {
        score += 1;
        // Bonus for name match
        if ((product.product_name || "").toLowerCase().includes(term)) score += 2;
        // Bonus for category match
        if ((product.category || "").toLowerCase().includes(term)) score += 1.5;
        // Bonus for vendor match
        if ((product.vendor_name || "").toLowerCase().includes(term)) score += 1;
        // Bonus for material match
        if ((product.material || "").toLowerCase().includes(term)) score += 1;
      }
    }

    // Apply filters
    if (filters.vendor_id && product.vendor_id !== filters.vendor_id) score = 0;
    if (filters.category && product.category !== filters.category) score = 0;
    if (filters.tier && product.vendor_tier !== filters.tier) score = 0;
    if (filters.style && product.style && !product.style.toLowerCase().includes(filters.style.toLowerCase())) {
      score *= 0.5;
    }

    return { ...product, relevance_score: score };
  });

  return scored
    .filter((p) => p.relevance_score > 0)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit);
}

/**
 * Get catalog statistics
 */
export function getTradeCatalogStats() {
  const catalog = readTradeCatalog();
  const products = catalog.products || [];

  const byVendor = {};
  const byCategory = {};
  for (const p of products) {
    byVendor[p.vendor_name] = (byVendor[p.vendor_name] || 0) + 1;
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }

  return {
    total_products: products.length,
    vendors: byVendor,
    categories: byCategory,
    updated_at: catalog.updated_at,
    crawl_count: catalog.crawl_count || 0,
  };
}
