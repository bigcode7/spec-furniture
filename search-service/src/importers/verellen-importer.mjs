/**
 * Verellen Importer
 *
 * Verellen is a premium Belgian trade upholstery brand (verellen.biz).
 * Their site is a React SPA backed by Magento 2 at magento.verellen.biz.
 *
 * Strategy:
 *   1. Query Magento GraphQL API for all products
 *   2. Filter to furniture products only (skip fabrics, leathers, finishes)
 *   3. Map Magento categories to standard furniture categories
 *   4. Extract images, prices, descriptions, dimensions
 *   5. Upsert into catalog DB
 *
 * Rate limit: 1 request per second between pages.
 * Pagination: 20 products per page via GraphQL currentPage.
 */

import https from "node:https";

const GRAPHQL_URL = "https://magento.verellen.biz/graphql";
const PAGE_SIZE = 20;
const DELAY_MS = 1000;

// Categories that are NOT furniture (skip these)
const SKIP_CATEGORY_PATHS = [
  "materials-finishes",
];

// Map Magento category url_path segments to standard categories
const CATEGORY_MAP = {
  "sofas": "sofas",
  "sectionals": "sectionals",
  "loveseats": "loveseats",
  "settees": "settees",
  "club-chairs": "accent-chairs",
  "occasional-chairs": "accent-chairs",
  "swivel-chairs": "swivel-chairs",
  "dining-chairs": "dining-chairs",
  "lounge-chairs": "accent-chairs",
  "chairs": "accent-chairs",
  "ottomans": "ottomans",
  "poufs": "ottomans",
  "ottomans-poufs": "ottomans",
  "benches": "benches",
  "chaises": "chaises",
  "daybeds": "daybeds",
  "beds": "beds",
  "headboards": "headboards",
  "nightstands": "nightstands",
  "dressers": "dressers",
  "dining-tables": "dining-tables",
  "coffee-tables": "coffee-tables",
  "side-tables": "side-tables",
  "console-tables": "console-tables",
  "cocktail-tables": "coffee-tables",
  "end-tables": "side-tables",
  "tables": "side-tables",
  "desks": "desks",
  "bookshelves": "bookcases",
  "cabinets": "cabinets",
  "credenzas": "sideboards",
  "sideboards": "sideboards",
  "media-cabinets": "media-cabinets",
  "mirrors": "mirrors",
  "lighting": "table-lamps",
  "table-lamps": "table-lamps",
  "floor-lamps": "floor-lamps",
  "chandeliers": "chandeliers",
  "pendants": "pendants",
  "sconces": "sconces",
  "stools": "bar-stools",
  "barstools": "bar-stools",
  "counter-stools": "bar-stools",
  "pillows": "decorative-objects",
  "throws": "decorative-objects",
  "accessories": "decorative-objects",
};

// ── State ────────────────────────────────────────────────────

let running = false;
let shouldStop = false;
let stats = {
  running: false,
  started_at: null,
  finished_at: null,
  phase: null,
  progress: null,
  total_from_api: 0,
  furniture_products: 0,
  skipped_non_furniture: 0,
  products_inserted: 0,
  products_updated: 0,
  errors: [],
};

export function getVerellenStatus() {
  return { ...stats };
}

export function stopVerellen() {
  if (running) { shouldStop = true; return { message: "Stop requested" }; }
  return { message: "Not running" };
}

// ── HTTP helper ──────────────────────────────────────────────

function graphqlFetch(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const url = new URL(GRAPHQL_URL);

    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(`GraphQL errors: ${JSON.stringify(parsed.errors)}`));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    req.setTimeout(30000);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Product query ────────────────────────────────────────────

const PRODUCT_QUERY = `
query GetProducts($pageSize: Int!, $currentPage: Int!) {
  products(search: "", pageSize: $pageSize, currentPage: $currentPage) {
    total_count
    page_info {
      current_page
      page_size
      total_pages
    }
    items {
      name
      sku
      url_key
      __typename
      description { html }
      short_description { html }
      price_range {
        minimum_price { regular_price { value currency } }
        maximum_price { regular_price { value currency } }
      }
      image { url label }
      media_gallery { url label position }
      categories { name url_path level }
    }
  }
}
`;

// ── Category mapping ─────────────────────────────────────────

// Furniture keywords for name-based detection (uncategorized products)
const FURNITURE_KEYWORDS = [
  "sofa", "chair", "table", "bench", "ottoman", "bed", "chaise",
  "sectional", "loveseat", "settee", "stool", "daybed", "headboard",
  "desk", "cabinet", "credenza", "dresser", "nightstand", "mirror",
  "lamp", "chandelier", "pendant", "sconce", "pouf", "console",
];

function isFurnitureProduct(categories, productName) {
  // If no categories, check by product name
  if (!categories || categories.length === 0) {
    if (!productName) return false;
    const lower = productName.toLowerCase();
    return FURNITURE_KEYWORDS.some((kw) => lower.includes(kw));
  }

  // Check if ANY category is a furniture category
  const hasFurnitureCategory = categories.some((c) =>
    c.url_path && (
      c.url_path.startsWith("collections") ||
      c.url_path.startsWith("attic-products")
    )
  );

  if (hasFurnitureCategory) return true;

  // Check if ALL categories are materials/finishes (skip these)
  const allMaterials = categories.every((c) =>
    SKIP_CATEGORY_PATHS.some((skip) => c.url_path && c.url_path.startsWith(skip))
  );

  if (allMaterials) return false;

  // For uncategorized with unknown categories, check by name
  if (productName) {
    const lower = productName.toLowerCase();
    return FURNITURE_KEYWORDS.some((kw) => lower.includes(kw));
  }

  return false;
}

function mapCategory(productName, categories) {
  // First try to match from specific category paths
  if (categories && categories.length > 0) {
    // Sort by level descending (most specific first)
    const sorted = [...categories]
      .filter((c) => c.url_path && c.url_path.startsWith("collections/product-type"))
      .sort((a, b) => (b.level || 0) - (a.level || 0));

    for (const cat of sorted) {
      const segments = cat.url_path.split("/");
      // Check each segment from most specific to least
      for (let i = segments.length - 1; i >= 0; i--) {
        const mapped = CATEGORY_MAP[segments[i]];
        if (mapped) return mapped;
      }
    }
  }

  // Fallback: derive from product name
  const text = (productName || "").toLowerCase();
  if (text.includes("sectional")) return "sectionals";
  if (text.includes("sofa") && text.includes("sleeper")) return "sleeper-sofas";
  if (text.includes("sofa")) return "sofas";
  if (text.includes("loveseat")) return "loveseats";
  if (text.includes("settee")) return "settees";
  if (text.includes("swivel") && text.includes("chair")) return "swivel-chairs";
  if (text.includes("wing") && text.includes("chair")) return "accent-chairs";
  if (text.includes("club") && text.includes("chair")) return "accent-chairs";
  if (text.includes("accent") && text.includes("chair")) return "accent-chairs";
  if (text.includes("lounge") && text.includes("chair")) return "accent-chairs";
  if (text.includes("dining") && text.includes("chair")) return "dining-chairs";
  if (text.includes("chair")) return "accent-chairs";
  if (text.includes("ottoman")) return "ottomans";
  if (text.includes("pouf")) return "ottomans";
  if (text.includes("bench")) return "benches";
  if (text.includes("chaise")) return "chaises";
  if (text.includes("daybed")) return "daybeds";
  if (text.includes("bed")) return "beds";
  if (text.includes("headboard")) return "headboards";
  if (text.includes("stool")) return "bar-stools";
  if (text.includes("dining") && text.includes("table")) return "dining-tables";
  if (text.includes("coffee") && text.includes("table")) return "coffee-tables";
  if (text.includes("cocktail") && text.includes("table")) return "coffee-tables";
  if (text.includes("console")) return "console-tables";
  if (text.includes("side table") || text.includes("end table")) return "side-tables";
  if (text.includes("table")) return "side-tables";
  if (text.includes("desk")) return "desks";
  if (text.includes("cabinet")) return "cabinets";
  if (text.includes("credenza") || text.includes("sideboard") || text.includes("buffet")) return "sideboards";
  if (text.includes("lamp")) return "table-lamps";
  if (text.includes("pendant")) return "pendants";
  if (text.includes("chandelier")) return "chandeliers";
  if (text.includes("sconce")) return "sconces";
  if (text.includes("mirror")) return "mirrors";
  if (text.includes("pillow") || text.includes("throw")) return "decorative-objects";

  return "accent-chairs"; // safe fallback for an upholstery brand
}

// ── HTML stripping ───────────────────────────────────────────

function stripHtml(html) {
  if (!html) return null;
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim() || null;
}

// ── Dimension parsing ────────────────────────────────────────

function parseDimensions(text) {
  if (!text) return {};

  // Pattern: W x D x H with optional units
  const wxdxh = text.match(/(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Ww](?:ide|idth)?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Dd](?:eep|epth)?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Hh]/);
  if (wxdxh) {
    return {
      width: parseFloat(wxdxh[1]),
      depth: parseFloat(wxdxh[2]),
      height: parseFloat(wxdxh[3]),
      dimensions: `${wxdxh[1]}"W x ${wxdxh[2]}"D x ${wxdxh[3]}"H`,
    };
  }

  // Pattern: L x D x H
  const lxdxh = text.match(/(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Ll](?:ong|ength)?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Dd](?:eep|epth)?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Hh]/);
  if (lxdxh) {
    return {
      width: parseFloat(lxdxh[1]),
      depth: parseFloat(lxdxh[2]),
      height: parseFloat(lxdxh[3]),
      dimensions: `${lxdxh[1]}"L x ${lxdxh[2]}"D x ${lxdxh[3]}"H`,
    };
  }

  // Pattern: number x number x number (generic)
  const generic = text.match(/(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?/);
  if (generic) {
    return {
      width: parseFloat(generic[1]),
      depth: parseFloat(generic[2]),
      height: parseFloat(generic[3]),
      dimensions: `${generic[1]}" x ${generic[2]}" x ${generic[3]}"`,
    };
  }

  // Individual dimension keywords
  const result = {};
  const widthMatch = text.match(/(?:width|wide)\s*:?\s*(\d{1,3}(?:\.\d+)?)/i);
  const depthMatch = text.match(/(?:depth|deep)\s*:?\s*(\d{1,3}(?:\.\d+)?)/i);
  const heightMatch = text.match(/(?:height|high|tall)\s*:?\s*(\d{1,3}(?:\.\d+)?)/i);

  if (widthMatch) result.width = parseFloat(widthMatch[1]);
  if (depthMatch) result.depth = parseFloat(depthMatch[1]);
  if (heightMatch) result.height = parseFloat(heightMatch[1]);

  if (Object.keys(result).length > 0) {
    const parts = [];
    if (result.width) parts.push(`W: ${result.width}"`);
    if (result.depth) parts.push(`D: ${result.depth}"`);
    if (result.height) parts.push(`H: ${result.height}"`);
    result.dimensions = parts.join(" x ");
  }

  return result;
}

// ── Material extraction ──────────────────────────────────────

function extractMaterial(productName, description) {
  const text = `${productName || ""} ${description || ""}`.toLowerCase();

  if (text.includes("leather")) return "Leather";
  if (text.includes("velvet")) return "Velvet";
  if (text.includes("linen")) return "Linen";
  if (text.includes("cotton")) return "Cotton";
  if (text.includes("performance")) return "Performance Fabric";
  if (text.includes("boucl")) return "Boucle";
  if (text.includes("wool")) return "Wool";
  if (text.includes("silk")) return "Silk";
  if (text.includes("chenille")) return "Chenille";
  if (text.includes("slipcov")) return "Slipcovered Fabric";
  // Default for Verellen (upholstery brand)
  return "Upholstered Fabric";
}

// ── Collection extraction ────────────────────────────────────

function extractCollection(productName) {
  // Verellen uses "Product Name | Collection" format
  if (productName && productName.includes("|")) {
    const parts = productName.split("|");
    if (parts.length >= 2) {
      return parts[parts.length - 1].trim();
    }
  }
  return null;
}

function cleanProductName(productName) {
  // Remove collection suffix: "Ava Wing Chair | Attic" → "Ava Wing Chair"
  if (productName && productName.includes("|")) {
    return productName.split("|")[0].trim();
  }
  return productName;
}

// ── Product URL construction ─────────────────────────────────

function buildProductUrl(urlKey) {
  if (!urlKey) return null;
  return `https://verellen.biz/product/${urlKey}`;
}

// ── Transform Magento product → catalog format ──────────────

function transformProduct(item) {
  const name = item.name || "Verellen Product";
  const description = stripHtml(item.description?.html);
  const shortDesc = stripHtml(item.short_description?.html);
  const fullDesc = description || shortDesc || null;

  const dims = parseDimensions(fullDesc);
  const collection = extractCollection(name);
  const cleanName = cleanProductName(name);
  const material = extractMaterial(name, fullDesc);
  const category = mapCategory(name, item.categories);

  // Images
  const images = [];
  const seenUrls = new Set();

  // Sort media_gallery by position
  const gallery = (item.media_gallery || [])
    .filter(Boolean)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  for (const img of gallery) {
    if (img.url && !seenUrls.has(img.url)) {
      seenUrls.add(img.url);
      images.push(img.url);
    }
  }

  // Fallback to main image if gallery is empty
  if (images.length === 0 && item.image?.url) {
    images.push(item.image.url);
  }

  const heroImage = images[0] || item.image?.url || null;

  // Price
  const price = item.price_range?.minimum_price?.regular_price?.value;
  const retailPrice = (typeof price === "number" && price > 0) ? price : null;

  // SKU - Verellen uses comma-separated SKUs for variants
  const sku = item.sku ? item.sku.split(",")[0].trim() : null;

  // Generate stable ID from url_key (unique per product)
  const urlKey = item.url_key || slugify(name);
  const id = `verellen_${urlKey}`;

  return {
    id,
    product_name: cleanName,
    vendor_id: "verellen",
    vendor_name: "Verellen",
    vendor_domain: "verellen.biz",
    vendor_tier: 2,
    category,
    sku,
    collection,
    material,
    dimensions: dims.dimensions || null,
    width: dims.width || null,
    depth: dims.depth || null,
    height: dims.height || null,
    description: fullDesc,
    retail_price: retailPrice,
    wholesale_price: null,
    image_url: heroImage,
    images: images.slice(0, 20),
    product_url: buildProductUrl(urlKey),
    ingestion_source: "verellen-importer",
    created_at: new Date().toISOString(),
    com_available: true,      // Verellen is a trade upholstery brand, COM available
    customizable: true,       // All Verellen is made-to-order in custom fabrics
    made_to_order: true,
  };
}

function slugify(text) {
  return (text || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// ── Main import function ─────────────────────────────────────

export async function importVerellen(catalogDB, options = {}) {
  if (running) {
    console.log("[verellen] Already running");
    return stats;
  }

  running = true;
  shouldStop = false;
  stats = {
    running: true,
    started_at: new Date().toISOString(),
    finished_at: null,
    phase: "fetching",
    progress: null,
    total_from_api: 0,
    furniture_products: 0,
    skipped_non_furniture: 0,
    products_inserted: 0,
    products_updated: 0,
    errors: [],
  };

  console.log("[verellen] Starting import from Magento GraphQL API");

  try {
    const allProducts = [];
    let currentPage = 1;
    let totalPages = 1;
    let totalCount = 0;

    // Phase 1: Fetch all products from GraphQL API
    while (currentPage <= totalPages && !shouldStop) {
      stats.progress = `page ${currentPage}/${totalPages}`;
      console.log(`[verellen] Fetching page ${currentPage}/${totalPages}...`);

      try {
        const data = await graphqlFetch(PRODUCT_QUERY, {
          pageSize: PAGE_SIZE,
          currentPage,
        });

        const products = data.products;
        totalCount = products.total_count;
        totalPages = products.page_info.total_pages;
        stats.total_from_api = totalCount;

        for (const item of products.items) {
          // Filter: only furniture products (skip fabrics, leathers, finishes)
          if (!isFurnitureProduct(item.categories, item.name)) {
            stats.skipped_non_furniture++;
            continue;
          }

          const product = transformProduct(item);
          allProducts.push(product);
        }

        if (currentPage % 10 === 0 || currentPage === 1) {
          console.log(`[verellen] Page ${currentPage}: ${allProducts.length} furniture products collected, ${stats.skipped_non_furniture} non-furniture skipped`);
        }

        currentPage++;

        // Rate limit
        if (currentPage <= totalPages) {
          await sleep(DELAY_MS);
        }
      } catch (err) {
        console.error(`[verellen] Page ${currentPage} error: ${err.message}`);
        stats.errors.push(`page ${currentPage}: ${err.message}`);
        currentPage++;
        await sleep(DELAY_MS * 2); // extra delay on error
      }
    }

    stats.furniture_products = allProducts.length;
    console.log(`[verellen] Fetch complete: ${allProducts.length} furniture products from ${totalCount} total`);

    // Phase 2: Deduplicate by ID
    const deduped = new Map();
    for (const p of allProducts) {
      if (!deduped.has(p.id)) {
        deduped.set(p.id, p);
      }
    }
    const uniqueProducts = [...deduped.values()];
    console.log(`[verellen] After dedup: ${uniqueProducts.length} unique products`);

    // Phase 3: Insert into catalog DB
    stats.phase = "inserting";
    if (uniqueProducts.length > 0 && catalogDB) {
      console.log(`[verellen] Inserting ${uniqueProducts.length} products into catalog`);
      const result = catalogDB.insertProducts(uniqueProducts);
      stats.products_inserted = result.inserted || 0;
      stats.products_updated = result.updated || 0;
      console.log(`[verellen] Inserted: ${stats.products_inserted} new, ${stats.products_updated} updated`);
    }

    stats.phase = "complete";
    stats.finished_at = new Date().toISOString();

    // Print summary
    console.log(`\n[verellen] ═══ IMPORT COMPLETE ═══`);
    console.log(`[verellen] Total from API:        ${stats.total_from_api}`);
    console.log(`[verellen] Furniture products:     ${uniqueProducts.length}`);
    console.log(`[verellen] Non-furniture skipped:  ${stats.skipped_non_furniture}`);
    console.log(`[verellen] Inserted:               ${stats.products_inserted}`);
    console.log(`[verellen] Updated:                ${stats.products_updated}`);
    console.log(`[verellen] Errors:                 ${stats.errors.length}`);

    // Print 5 sample products
    console.log(`\n[verellen] ═══ SAMPLE PRODUCTS ═══`);
    const sampleIndices = [0, Math.floor(uniqueProducts.length * 0.25), Math.floor(uniqueProducts.length * 0.5), Math.floor(uniqueProducts.length * 0.75), uniqueProducts.length - 1];
    for (const idx of sampleIndices) {
      const p = uniqueProducts[idx];
      if (!p) continue;
      console.log(`\n[verellen] --- ${p.product_name} ---`);
      console.log(`[verellen]   Category: ${p.category}`);
      console.log(`[verellen]   Price: ${p.retail_price ? "$" + p.retail_price : "N/A"}`);
      console.log(`[verellen]   Images: ${p.images?.length || 0}`);
      console.log(`[verellen]   SKU: ${p.sku || "N/A"}`);
      console.log(`[verellen]   Collection: ${p.collection || "N/A"}`);
      console.log(`[verellen]   Material: ${p.material || "N/A"}`);
      console.log(`[verellen]   Description: ${p.description?.slice(0, 120) || "NONE"}...`);
      console.log(`[verellen]   Image: ${p.image_url || "NONE"}`);
      console.log(`[verellen]   URL: ${p.product_url || "NONE"}`);
    }

    return stats;
  } catch (err) {
    console.error("[verellen] Fatal error:", err);
    stats.phase = "error";
    stats.finished_at = new Date().toISOString();
    stats.errors.push(err.message);
    return stats;
  } finally {
    running = false;
    stats.running = false;
  }
}
