#!/usr/bin/env node
/**
 * Gabby Shopify JSON API Scraper
 *
 * Paginates through gabby.com/products.json to fetch all products,
 * then maps them to our catalog schema and saves to catalog.db.json.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "catalog.db.json");

const VENDOR_ID = "gabby";
const VENDOR_NAME = "Gabby";
const BASE_URL = "https://gabby.com/products.json";
const PRODUCT_URL_BASE = "https://gabby.com/products/";
const DELAY_MS = 1200;

// ── Category mapping from Shopify product_type to our categories ──
const CATEGORY_MAP = {
  "beds": "beds",
  "headboards": "beds",
  "nightstands": "nightstands",
  "dressers": "dressers",
  "chests": "chests",
  "accent chairs": "accent-chairs",
  "arm chairs": "accent-chairs",
  "chairs": "accent-chairs",
  "dining chairs": "dining-chairs",
  "side chairs": "dining-chairs",
  "dining side chairs": "dining-chairs",
  "bar stools": "bar-stools",
  "counter stools": "counter-stools",
  "bar & counter stools": "bar-stools",
  "benches": "benches",
  "banquettes": "benches",
  "ottomans": "ottomans",
  "stools": "ottomans",
  "sofas": "sofas",
  "loveseats": "loveseats",
  "settees": "settees",
  "sectionals": "sectionals",
  "coffee tables": "cocktail-tables",
  "cocktail tables": "cocktail-tables",
  "side tables": "side-tables",
  "end tables": "side-tables",
  "accent tables": "side-tables",
  "console tables": "console-tables",
  "consoles": "console-tables",
  "dining tables": "dining-tables",
  "desks": "desks",
  "cabinets": "bar-cabinets",
  "bookcases": "bookcases",
  "credenzas": "credenzas",
  "sideboards": "buffets",
  "buffets": "buffets",
  "serving carts": "bar-cabinets",
  "bar carts": "bar-cabinets",
  "storage": "bar-cabinets",
  "mirrors": "mirrors",
  "chandeliers": "chandeliers",
  "pendants": "pendants",
  "lighting": "lighting",
  "hanging lighting": "chandeliers",
  "floor lamps": "floor-lamps",
  "table lamps": "table-lamps",
  "rugs": "rugs",
  "accessories": "accessories",
};

function mapCategory(productType) {
  if (!productType) return "accessories";
  const lower = productType.toLowerCase().trim();
  return CATEGORY_MAP[lower] || inferCategory(lower);
}

function inferCategory(lower) {
  if (lower.includes("chair")) return "accent-chairs";
  if (lower.includes("table")) return "side-tables";
  if (lower.includes("sofa")) return "sofas";
  if (lower.includes("bed")) return "beds";
  if (lower.includes("cabinet")) return "bar-cabinets";
  if (lower.includes("lamp")) return "table-lamps";
  if (lower.includes("mirror")) return "mirrors";
  if (lower.includes("rug")) return "rugs";
  if (lower.includes("stool")) return "bar-stools";
  if (lower.includes("bench")) return "benches";
  if (lower.includes("ottoman")) return "ottomans";
  if (lower.includes("bookcase")) return "bookcases";
  if (lower.includes("desk")) return "desks";
  if (lower.includes("chest")) return "chests";
  if (lower.includes("dresser")) return "dressers";
  if (lower.includes("nightstand")) return "nightstands";
  return "accessories";
}

// ── Extract material and style from tags + description ──
function extractMaterial(tags, bodyHtml) {
  const text = (tags.join(" ") + " " + (bodyHtml || "")).toLowerCase();
  const materials = [];

  const matMap = [
    [/\boak\b/, "Oak"],
    [/\bwalnut\b/, "Walnut"],
    [/\bmahogany\b/, "Mahogany"],
    [/\bteak\b/, "Teak"],
    [/\bmaple\b/, "Maple"],
    [/\bash\b/, "Ash"],
    [/\bbirch\b/, "Birch"],
    [/\bpine\b/, "Pine"],
    [/\brattan\b/, "Rattan"],
    [/\bwicker\b/, "Wicker"],
    [/\bcane\b/, "Cane"],
    [/\bbamboo\b/, "Bamboo"],
    [/\biron\b/, "Iron"],
    [/\bbrass\b/, "Brass"],
    [/\bsteel\b/, "Steel"],
    [/\bgold\b(?!en)/, "Gold"],
    [/\bnickel\b/, "Nickel"],
    [/\bmarble\b/, "Marble"],
    [/\bstone\b/, "Stone"],
    [/\bconcrete\b/, "Concrete"],
    [/\bglass\b/, "Glass"],
    [/\bacrylic\b/, "Acrylic"],
    [/\bleather\b/, "Leather"],
    [/\bvelvet\b/, "Velvet"],
    [/\blinen\b/, "Linen"],
    [/\bcotton\b/, "Cotton"],
    [/\bperformance\s+fabric\b/, "Performance Fabric"],
    [/\bfabric\b/, "Fabric"],
    [/\bupholster/, "Upholstered"],
    [/\bresin\b/, "Resin"],
    [/\bceramic\b/, "Ceramic"],
    [/\bterracotta\b/, "Terracotta"],
    [/\bwood\b/, "Wood"],
  ];

  for (const [re, label] of matMap) {
    if (re.test(text)) materials.push(label);
  }

  return materials.length > 0 ? materials.slice(0, 3).join(", ") : null;
}

function extractStyle(tags, title) {
  const text = (tags.join(" ") + " " + (title || "")).toLowerCase();

  if (/\bcoastal\b/.test(text)) return "Coastal";
  if (/\bmodern\b/.test(text)) return "Modern";
  if (/\bcontemporary\b/.test(text)) return "Contemporary";
  if (/\btransitional\b/.test(text)) return "Transitional";
  if (/\btraditional\b/.test(text)) return "Traditional";
  if (/\bfarmhouse\b/.test(text)) return "Farmhouse";
  if (/\bindustrial\b/.test(text)) return "Industrial";
  if (/\bbohemian\b|\bboho\b/.test(text)) return "Bohemian";
  if (/\brustic\b/.test(text)) return "Rustic";
  if (/\bglam\b/.test(text)) return "Glam";
  if (/\bmid.century\b/.test(text)) return "Mid-Century Modern";
  if (/\bart\s+deco\b/.test(text)) return "Art Deco";

  return "Transitional"; // Gabby is mostly transitional/coastal
}

// ── Extract dimensions from body_html ──
function extractDimensions(bodyHtml) {
  if (!bodyHtml) return null;
  const text = bodyHtml.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");

  // Overall Width/Depth/Height patterns
  const dims = {};
  const wMatch = text.match(/(?:Overall\s+)?(?:Width|W)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in|inches?)?/i);
  const dMatch = text.match(/(?:Overall\s+)?(?:Depth|D)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in|inches?)?/i);
  const hMatch = text.match(/(?:Overall\s+)?(?:Height|H)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in|inches?)?/i);

  if (wMatch) dims.width = wMatch[1];
  if (dMatch) dims.depth = dMatch[1];
  if (hMatch) dims.height = hMatch[1];

  // WxDxH pattern
  if (!dims.width) {
    const wdh = text.match(/(\d+\.?\d*)\s*["']?\s*[xX×]\s*(\d+\.?\d*)\s*["']?\s*[xX×]\s*(\d+\.?\d*)\s*["']?/);
    if (wdh) {
      dims.width = wdh[1];
      dims.depth = wdh[2];
      dims.height = wdh[3];
    }
  }

  if (Object.keys(dims).length > 0) {
    const parts = [];
    if (dims.width) parts.push(`W${dims.width}"`);
    if (dims.depth) parts.push(`D${dims.depth}"`);
    if (dims.height) parts.push(`H${dims.height}"`);
    return parts.join(" x ");
  }

  return null;
}

// ── Extract colors from tags ──
function extractColors(tags) {
  const colorKeywords = [
    "white", "black", "gray", "grey", "blue", "navy", "green", "red",
    "brown", "tan", "beige", "cream", "ivory", "gold", "silver",
    "brass", "bronze", "copper", "natural", "walnut", "oak",
    "charcoal", "taupe", "blush", "pink", "coral", "teal",
    "sage", "olive", "rust", "mustard", "indigo", "slate",
  ];

  const colors = [];
  const tagStr = tags.join(" ").toLowerCase();
  for (const c of colorKeywords) {
    if (tagStr.includes(c)) colors.push(c.charAt(0).toUpperCase() + c.slice(1));
  }
  return colors.length > 0 ? colors.slice(0, 5) : null;
}

// ── Clean HTML to plain text description ──
function cleanDescription(html) {
  if (!html) return null;
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text.length > 10 ? text.slice(0, 1000) : null;
}

// ── Extract collection from tags ──
function extractCollection(tags) {
  for (const tag of tags) {
    if (tag.startsWith("collections:")) {
      return tag.replace("collections:", "").trim();
    }
  }
  return null;
}

// ── Map Shopify product to our catalog schema ──
function mapProduct(sp) {
  const variant = sp.variants?.[0] || {};
  const images = (sp.images || []).sort((a, b) => a.position - b.position);
  const heroImage = images[0]?.src || null;
  const altImages = images.slice(1).map(img => img.src);
  const tags = sp.tags || [];

  const retailPrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
  const wholesalePrice = variant.price ? parseFloat(variant.price) : null;

  return {
    id: `${VENDOR_ID}_${sp.handle}`,
    vendor_id: VENDOR_ID,
    vendor_name: VENDOR_NAME,
    manufacturer_name: VENDOR_NAME,
    product_name: sp.title || "Unknown",
    sku: variant.sku || null,
    category: mapCategory(sp.product_type),
    product_type_raw: sp.product_type || null,
    description: cleanDescription(sp.body_html),
    material: extractMaterial(tags, sp.body_html),
    style: extractStyle(tags, sp.title),
    colors: extractColors(tags),
    dimensions: extractDimensions(sp.body_html),
    collection: extractCollection(tags),
    retail_price: retailPrice,
    wholesale_price: wholesalePrice,
    price_verified: !!(retailPrice || wholesalePrice),
    image_url: heroImage,
    image_verified: !!heroImage,
    image_width: images[0]?.width || null,
    image_height: images[0]?.height || null,
    alternate_images: altImages.length > 0 ? altImages : null,
    product_url: sp.handle ? `${PRODUCT_URL_BASE}${sp.handle}` : null,
    product_url_verified: !!sp.handle,
    tags: tags.filter(t => !t.startsWith("collections:")),
    shopify_id: sp.id,
    available: variant.available || false,
    ingestion_source: "shopify-json",
    ingested_at: new Date().toISOString(),
  };
}

// ── Fetch all products via pagination ──
async function fetchAllProducts() {
  const allProducts = [];
  let page = 1;

  while (true) {
    const url = `${BASE_URL}?limit=250&page=${page}`;
    console.log(`[gabby] Fetching page ${page}...`);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`[gabby] HTTP ${res.status} on page ${page}`);
      break;
    }

    const data = await res.json();
    const products = data.products || [];

    if (products.length === 0) {
      console.log(`[gabby] Page ${page} empty — done.`);
      break;
    }

    console.log(`[gabby] Page ${page}: ${products.length} products`);
    allProducts.push(...products);
    page++;

    // Rate limiting
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  return allProducts;
}

// ── Main ──
async function main() {
  console.log("=== Gabby Shopify Scraper ===\n");

  const shopifyProducts = await fetchAllProducts();
  console.log(`\n[gabby] Total raw products from API: ${shopifyProducts.length}`);

  // Deduplicate by handle (product URL slug)
  const seen = new Set();
  const unique = [];
  for (const sp of shopifyProducts) {
    if (!seen.has(sp.handle)) {
      seen.add(sp.handle);
      unique.push(sp);
    }
  }
  console.log(`[gabby] After dedup by handle: ${unique.length}`);

  // Map to our schema
  const mapped = unique.map(mapProduct);

  // Stats
  const stats = {
    total: mapped.length,
    withDesc: mapped.filter(p => p.description).length,
    withDims: mapped.filter(p => p.dimensions).length,
    withImage: mapped.filter(p => p.image_url).length,
    withPrice: mapped.filter(p => p.retail_price || p.wholesale_price).length,
    withMaterial: mapped.filter(p => p.material).length,
    withStyle: mapped.filter(p => p.style).length,
    withSku: mapped.filter(p => p.sku).length,
    withAltImages: mapped.filter(p => p.alternate_images?.length > 0).length,
  };

  console.log("\n=== Gabby Product Stats ===");
  console.log(`Total:        ${stats.total}`);
  console.log(`Descriptions: ${stats.withDesc} (${Math.round(stats.withDesc/stats.total*100)}%)`);
  console.log(`Dimensions:   ${stats.withDims} (${Math.round(stats.withDims/stats.total*100)}%)`);
  console.log(`Images:       ${stats.withImage} (${Math.round(stats.withImage/stats.total*100)}%)`);
  console.log(`Alt Images:   ${stats.withAltImages} (${Math.round(stats.withAltImages/stats.total*100)}%)`);
  console.log(`Prices:       ${stats.withPrice} (${Math.round(stats.withPrice/stats.total*100)}%)`);
  console.log(`Material:     ${stats.withMaterial} (${Math.round(stats.withMaterial/stats.total*100)}%)`);
  console.log(`Style:        ${stats.withStyle} (${Math.round(stats.withStyle/stats.total*100)}%)`);
  console.log(`SKU:          ${stats.withSku} (${Math.round(stats.withSku/stats.total*100)}%)`);

  // Category breakdown
  const cats = {};
  for (const p of mapped) {
    cats[p.category] = (cats[p.category] || 0) + 1;
  }
  console.log("\n=== Category Breakdown ===");
  for (const [cat, count] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  // Load existing catalog and merge
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

  // Remove any existing Gabby products
  const before = db.products.length;
  db.products = db.products.filter(p => p.vendor_id !== VENDOR_ID);
  const removed = before - db.products.length;
  if (removed > 0) console.log(`\nRemoved ${removed} existing Gabby products`);

  // Add new products
  db.products.push(...mapped);
  db.product_count = db.products.length;
  db.saved_at = new Date().toISOString();

  fs.writeFileSync(DB_PATH, JSON.stringify(db));
  console.log(`\nSaved to catalog. Total catalog products: ${db.product_count}`);

  // Sample products
  console.log("\n=== Sample Products ===");
  for (const p of mapped.slice(0, 5)) {
    console.log(`\n  ${p.product_name}`);
    console.log(`    SKU: ${p.sku} | Category: ${p.category} | Style: ${p.style}`);
    console.log(`    Material: ${p.material || "—"}`);
    console.log(`    Retail: $${p.retail_price || "—"} | Wholesale: $${p.wholesale_price || "—"}`);
    console.log(`    Dims: ${p.dimensions || "—"}`);
    console.log(`    Images: 1 hero + ${p.alternate_images?.length || 0} alternates`);
    console.log(`    Desc: ${(p.description || "—").slice(0, 100)}...`);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
