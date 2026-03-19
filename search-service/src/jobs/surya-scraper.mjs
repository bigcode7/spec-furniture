#!/usr/bin/env node
/**
 * Surya Scraper — Uses Surya's REST API to import furniture and rugs.
 *
 * Surya exposes a product catalog API at /api/v2/products with pagination,
 * expand support (content, images, variantTraits), and 96 items per page.
 *
 * Usage:
 *   node surya-scraper.mjs                    # scrape both furniture + rugs
 *   node surya-scraper.mjs --category furniture   # furniture only
 *   node surya-scraper.mjs --category rugs        # rugs only
 *   node surya-scraper.mjs --dry-run          # preview without saving
 */

import { initCatalogDB, insertProducts, getProductCount } from "../db/catalog-db.mjs";

const LOG = "[surya-scrape]";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BASE = "https://www.surya.com";
const PAGE_SIZE = 96;
const RATE_LIMIT_MS = 800;
const MAX_RETRIES = 3;

const CATEGORIES = {
  furniture: {
    categoryId: "5f8cfabd-1fb4-4869-bdfe-b09100768f84",
    label: "Furniture",
    expectedTotal: 1071,
  },
  rugs: {
    categoryId: "4edc6448-1a6a-4c75-8e92-b09100768f5e",
    label: "Rugs",
    expectedTotal: 9915,
  },
};

// ── CLI ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2);
    flags[key] = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
    if (flags[key] !== true) i++;
  }
}

const dryRun = flags["dry-run"] === true;
const categoryFilter = flags.category || "all";

// ── HTTP ─────────────────────────────────────────────────────

let lastRequestTime = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, retries = MAX_RETRIES) {
  const now = Date.now();
  const wait = Math.max(0, RATE_LIMIT_MS - (now - lastRequestTime));
  if (wait > 0) await sleep(wait);
  lastRequestTime = Date.now();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`${LOG} HTTP ${response.status} for ${url} (attempt ${attempt}/${retries})`);
        if (attempt < retries) {
          await sleep(2000 * attempt);
          continue;
        }
        return null;
      }
      return await response.json();
    } catch (err) {
      console.warn(`${LOG} Fetch error for ${url}: ${err.message} (attempt ${attempt}/${retries})`);
      if (attempt < retries) {
        await sleep(2000 * attempt);
        continue;
      }
      return null;
    }
  }
  return null;
}

// ── Image Verification ───────────────────────────────────────

async function verifyImage(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      method: "HEAD",
      headers: { "user-agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) return false;
    const contentType = response.headers.get("content-type") || "";
    return contentType.startsWith("image/");
  } catch {
    return false;
  }
}

// ── Product Extraction ───────────────────────────────────────

function extractProductName(apiProduct) {
  const html = apiProduct.content?.htmlContent || "";
  const brandName = apiProduct.brand?.name || "";
  const sku = apiProduct.productTitle || "";

  if (html && brandName) {
    const escapedBrand = escapeRegex(brandName);

    // Pattern 1: "the [Brand] [Product Type]." — e.g., "the Alexia End Table."
    const p1 = html.match(new RegExp(`the\\s+${escapedBrand}\\s+([A-Z][A-Za-z\\s]+?)[\\.\\,\\!]`, ""));
    if (p1 && p1[1].trim().length > 2 && p1[1].trim().length < 50) {
      return `${brandName} ${p1[1].trim()}`;
    }

    // Pattern 2: "[Brand] [Product Type]" at start of sentence
    const p2 = html.match(new RegExp(`(?:^|\\. |\\! )(?:The |Introducing the |Meet the )?${escapedBrand}\\s+([A-Z][A-Za-z\\s]+?)[\\.\\,\\!]`, ""));
    if (p2 && p2[1].trim().length > 2 && p2[1].trim().length < 50) {
      return `${brandName} ${p2[1].trim()}`;
    }

    // Pattern 3: "style [Brand] [Product Type]" — e.g., "Bohemian style Alexia End Table"
    const p3 = html.match(new RegExp(`style\\s+${escapedBrand}\\s+([A-Z][A-Za-z\\s]+?)[\\.\\,]`, ""));
    if (p3 && p3[1].trim().length > 2 && p3[1].trim().length < 50) {
      return `${brandName} ${p3[1].trim()}`;
    }

    // Pattern 4: Check metaKeywords for product type (e.g., "Furniture Garden Stool")
    const meta = apiProduct.content?.metaKeywords || "";
    const typeWords = ["Chair", "Table", "Sofa", "Bench", "Stool", "Ottoman", "Desk", "Lamp", "Pendant",
      "Mirror", "Cabinet", "Shelf", "Dresser", "Bed", "Nightstand", "Console", "Settee", "Pouf",
      "Planter", "Vase", "Basket", "Chandelier", "Sconce", "Bookcase"];
    for (const tw of typeWords) {
      if (meta.includes(tw) || html.includes(tw.toLowerCase())) {
        // Find the full type phrase in meta
        const typeMatch = meta.match(new RegExp(`((?:[A-Z][a-z]+\\s+)?${tw}s?)`, ""));
        if (typeMatch) return `${brandName} ${typeMatch[1]}`;
        return `${brandName} ${tw}`;
      }
    }

    return brandName;
  }

  return brandName || sku;
}

function extractMaterials(apiProduct) {
  const meta = apiProduct.content?.metaKeywords || "";
  // Materials often appear as "Top: Material; Base: Material" or just "Material"
  const matMatch = meta.match(/(?:Top|Base|Frame|Material)[:\s]+([^$]+?)(?:\s+(?:Outdoor|Global|Bohemian|Traditional|Modern|Contemporary|Transitional|$))/i);
  if (matMatch) return matMatch[1].trim().replace(/\s+/g, " ");

  // Check htmlContent for material mentions
  const html = apiProduct.content?.htmlContent || "";
  const htmlMat = html.match(/(?:made of|crafted from|constructed of|material[s]?:)\s+([^.]{5,80})/i);
  if (htmlMat) return htmlMat[1].trim();

  return null;
}

function extractColor(apiProduct) {
  const meta = apiProduct.content?.metaKeywords || "";
  // Colors in meta usually follow the collection keywords
  const colorMatch = meta.match(/(?:Blue|Red|Green|Gray|Grey|Black|White|Beige|Brown|Tan|Navy|Ivory|Cream|Gold|Silver|Orange|Yellow|Pink|Purple|Charcoal|Rust|Teal|Multi|Neutral|Natural)(?:\s+(?:Blue|Red|Green|Gray|Grey|Black|White|Beige|Brown|Tan|Navy|Ivory|Cream|Gold|Silver|Orange|Yellow|Pink|Purple|Charcoal|Rust|Teal|Multi|Neutral|Natural))*/i);
  return colorMatch ? colorMatch[0] : null;
}

function extractDimensions(apiProduct) {
  const meta = apiProduct.content?.metaKeywords || "";
  // Dimensions like "18" x 18" x 22""
  const dimMatch = meta.match(/(\d+(?:\.\d+)?["']\s*x\s*\d+(?:\.\d+)?["'](?:\s*x\s*\d+(?:\.\d+)?["'])?)/i);
  if (dimMatch) return dimMatch[1];

  // Try from variant traits — size descriptions
  const variants = apiProduct.variantTraits || [];
  for (const t of variants) {
    for (const v of (t.traitValues || [])) {
      const val = v.value || "";
      if (/\d+.*x.*\d+/.test(val) || /\d+'\s*\d*"/.test(val)) {
        return val;
      }
    }
  }

  // From htmlContent
  const html = apiProduct.content?.htmlContent || "";
  const htmlDim = html.match(/(\d+(?:\.\d+)?["']\s*[WwHhDdLl]\s*x\s*\d+(?:\.\d+)?["']\s*[WwHhDdLl](?:\s*x\s*\d+(?:\.\d+)?["']\s*[WwHhDdLl])?)/i);
  return htmlDim ? htmlDim[1] : null;
}

function extractStyle(apiProduct) {
  const meta = apiProduct.content?.metaKeywords || "";
  const styles = ["Bohemian", "Traditional", "Modern", "Contemporary", "Transitional", "Coastal", "Farmhouse", "Industrial", "Mid-Century", "Rustic", "Global", "Minimalist", "Scandinavian", "Art Deco"];
  for (const style of styles) {
    if (meta.includes(style) || (apiProduct.content?.htmlContent || "").includes(style)) {
      return style;
    }
  }
  return null;
}

function filterProductImages(apiProduct) {
  const images = apiProduct.images || [];
  const productImages = [];

  for (const img of images) {
    const path = img.largeImagePath || img.mediumImagePath || "";
    if (!path) continue;
    // Skip lifestyle/room scene images (contain "styleshot", "roomscene", "quilt", "quiltedbed")
    const lower = path.toLowerCase();
    if (lower.includes("styleshot") || lower.includes("roomscene") || lower.includes("quiltedbed") || lower.includes("quilt_")) continue;
    // Skip tiny icons
    if (lower.includes("icon") || lower.includes("logo") || lower.includes("badge")) continue;
    productImages.push(path);
  }

  // Fallback to main image
  if (productImages.length === 0) {
    const main = apiProduct.largeImagePath || apiProduct.mediumImagePath;
    if (main) productImages.push(main);
  }

  return [...new Set(productImages)];
}

function extractAvailableSizes(apiProduct) {
  const variants = apiProduct.variantTraits || [];
  const sizes = [];
  for (const t of variants) {
    for (const v of (t.traitValues || [])) {
      if (v.value) sizes.push(v.value);
    }
  }
  return sizes;
}

function buildProduct(apiProduct, category) {
  const sku = apiProduct.productTitle || apiProduct.productNumber || "";
  const collection = apiProduct.brand?.name || "";
  const name = extractProductName(apiProduct);
  const images = filterProductImages(apiProduct);
  const sizes = extractAvailableSizes(apiProduct);

  return {
    id: `surya_${sku.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    product_name: name || sku,
    vendor_id: "surya",
    vendor_name: "Surya",
    vendor_domain: "surya.com",
    vendor_tier: 2,
    category: category === "rugs" ? "rugs" : inferFurnitureCategory(apiProduct),
    sku: sku,
    collection: collection || null,
    description: (apiProduct.content?.htmlContent || "").slice(0, 500) || null,
    dimensions: extractDimensions(apiProduct) || (sizes.length > 0 ? `Available sizes: ${sizes.join(", ")}` : null),
    material: extractMaterials(apiProduct),
    color: extractColor(apiProduct),
    style: extractStyle(apiProduct),
    image_url: images[0] || null,
    images: images,
    product_url: `${BASE}${apiProduct.canonicalUrl || `/Product/${apiProduct.urlSegment}`}`,
    retail_price: apiProduct.unitListPrice > 0 ? apiProduct.unitListPrice : null,
    ingestion_source: "surya-api-scrape",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function inferFurnitureCategory(apiProduct) {
  const meta = (apiProduct.content?.metaKeywords || "").toLowerCase();
  const html = (apiProduct.content?.htmlContent || "").toLowerCase();
  const text = meta + " " + html;

  const map = {
    "sofa": "seating", "chair": "seating", "bench": "seating", "stool": "seating",
    "ottoman": "seating", "settee": "seating", "loveseat": "seating", "pouf": "seating",
    "table": "tables", "desk": "home-office", "console": "tables",
    "bed": "bedroom", "nightstand": "bedroom", "dresser": "bedroom", "headboard": "bedroom",
    "lamp": "lighting", "chandelier": "lighting", "pendant": "lighting", "sconce": "lighting",
    "cabinet": "storage", "shelf": "storage", "bookcase": "storage", "sideboard": "storage",
    "mirror": "mirrors", "pillow": "accents", "throw": "accents", "vase": "accents",
    "planter": "accents", "sculpture": "accents", "basket": "accents", "tray": "accents",
  };

  for (const [keyword, cat] of Object.entries(map)) {
    if (text.includes(keyword)) return cat;
  }
  return "accents";
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Surya Scraper (API-based)");
  console.log("═══════════════════════════════════════════════════════\n");

  const categoriesToScrape = categoryFilter === "all"
    ? Object.keys(CATEGORIES)
    : [categoryFilter];

  console.log(`Categories: ${categoriesToScrape.join(", ")}`);
  console.log(`Dry run: ${dryRun}\n`);

  if (!dryRun) {
    await initCatalogDB();
    console.log(`Catalog has ${getProductCount()} products before scrape\n`);
  }

  let grandTotal = 0;

  for (const catKey of categoriesToScrape) {
    const cat = CATEGORIES[catKey];
    if (!cat) {
      console.warn(`Unknown category: ${catKey}`);
      continue;
    }

    console.log(`\n── ${cat.label} ──────────────────────────────────`);

    // Paginate through all products
    let page = 1;
    let totalPages = 1;
    let totalItems = 0;
    const allProducts = [];
    const seenIds = new Set();

    while (page <= totalPages) {
      const url = `${BASE}/api/v2/products?categoryId=${cat.categoryId}&page=${page}&pageSize=${PAGE_SIZE}&sort=sortOrder&expand=content,images,varianttraits`;

      const data = await fetchJson(url);
      if (!data || !data.products) {
        console.warn(`  Failed to fetch page ${page}, retrying...`);
        // Already retried in fetchJson
        break;
      }

      totalPages = data.pagination?.numberOfPages || 1;
      totalItems = data.pagination?.totalItemCount || 0;

      if (page === 1) {
        console.log(`  Total: ${totalItems} products across ${totalPages} pages`);
      }

      for (const apiProduct of data.products) {
        // Skip if already seen (dedup by API id)
        if (seenIds.has(apiProduct.id)) continue;
        seenIds.add(apiProduct.id);

        // Skip variant children — only keep parent products
        // (isVariantParent = true means this is the parent, children are sizes)
        const product = buildProduct(apiProduct, catKey);
        allProducts.push(product);
      }

      process.stdout.write(`  Page ${page}/${totalPages} — ${allProducts.length} products collected\r`);
      page++;
    }

    console.log(`\n  Collected ${allProducts.length} unique products from ${totalItems} API items`);

    // Verify a sample of images
    console.log("  Verifying images (sample of 20)...");
    const sampleSize = Math.min(20, allProducts.length);
    const sampleIndices = [];
    for (let i = 0; i < sampleSize; i++) {
      sampleIndices.push(Math.floor(i * allProducts.length / sampleSize));
    }
    let validImages = 0;
    let invalidImages = 0;
    for (const idx of sampleIndices) {
      const p = allProducts[idx];
      if (p.image_url) {
        const valid = await verifyImage(p.image_url);
        if (valid) {
          validImages++;
        } else {
          invalidImages++;
          // Clear bad image
          p.image_url = null;
          p.images = [];
        }
      }
    }
    console.log(`  Image verification: ${validImages} valid, ${invalidImages} invalid out of ${sampleSize} sampled`);

    // If more than half of sampled images are bad, clear all unverified images
    if (invalidImages > validImages) {
      console.warn("  WARNING: Most sampled images are invalid — clearing unverified images");
      for (let i = 0; i < allProducts.length; i++) {
        if (!sampleIndices.includes(i)) {
          allProducts[i].image_url = null;
          allProducts[i].images = [];
        }
      }
    }

    if (dryRun) {
      console.log(`  [DRY RUN] Would insert ${allProducts.length} products`);
      console.log("  Sample products:");
      for (const p of allProducts.slice(0, 5)) {
        console.log(`    ${p.product_name} | SKU: ${p.sku} | Collection: ${p.collection} | Images: ${p.images.length}`);
      }
      grandTotal += allProducts.length;
      continue;
    }

    // Insert
    if (allProducts.length > 0) {
      const result = insertProducts(allProducts);
      console.log(`  Inserted: ${result.inserted} new, ${result.updated} updated`);
      grandTotal += result.inserted;
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
  if (dryRun) {
    console.log(`  DRY RUN complete — would add ${grandTotal} products`);
  } else {
    console.log(`  Done! ${grandTotal} new products added`);
    console.log(`  Catalog now has ${getProductCount()} products`);
  }
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(`${LOG} Fatal error:`, err);
  process.exit(1);
});
