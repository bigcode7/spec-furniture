#!/usr/bin/env node
/**
 * Multi-Vendor Shopify JSON API Importer
 *
 * Paginates through /products.json for each vendor,
 * maps to our catalog schema, and saves to catalog.db.json.
 *
 * Same approach as crawl-gabby.mjs but handles 7 vendors in sequence.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "catalog.db.json");

const DELAY_MS = 1200; // 1.2s between requests per vendor

// ── Vendor definitions ──────────────────────────────────────
const VENDORS = [
  {
    id: "made-goods",
    name: "Made Goods",
    domain: "www.madegoods.com",
    urlBase: "https://www.madegoods.com",
  },
  {
    id: "noir",
    name: "Noir Furniture",
    domain: "www.noirfurniturela.com",
    urlBase: "https://www.noirfurniturela.com",
  },
  {
    id: "bungalow5",
    name: "Bungalow 5",
    domain: "www.bungalow5.com",
    urlBase: "https://www.bungalow5.com",
  },
  {
    id: "palecek",
    name: "Palecek",
    domain: "www.palecek.com",
    urlBase: "https://www.palecek.com",
  },
  {
    id: "arteriors",
    name: "Arteriors",
    domain: "www.arteriorshome.com",
    urlBase: "https://www.arteriorshome.com",
  },
  {
    id: "worlds-away",
    name: "Worlds Away",
    domain: "www.worldsaway.com",
    urlBase: "https://www.worldsaway.com",
  },
  {
    id: "currey",
    name: "Currey & Company",
    domain: "www.curreyandcompany.com",
    urlBase: "https://www.curreyandcompany.com",
  },
];

// ── Category mapping ────────────────────────────────────────
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
  "pendant": "pendants",
  "lighting": "lighting",
  "hanging lighting": "chandeliers",
  "floor lamps": "floor-lamps",
  "table lamps": "table-lamps",
  "lamps": "table-lamps",
  "sconces": "sconces",
  "wall sconces": "sconces",
  "flush mounts": "flush-mounts",
  "lanterns": "chandeliers",
  "rugs": "rugs",
  "accessories": "accessories",
  "decorative accessories": "accessories",
  "vases": "accessories",
  "sculptures": "accessories",
  "trays": "accessories",
  "boxes": "accessories",
  "planters": "accessories",
  "picture frames": "accessories",
  "objects": "accessories",
  "wall art": "wall-art",
  "wall decor": "wall-art",
  "art": "wall-art",
  "pillows": "pillows",
  "throws": "throws",
  "etageres": "bookcases",
  "étagères": "bookcases",
  "media consoles": "media-consoles",
  "entertainment": "media-consoles",
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
  if (lower.includes("bookcase") || lower.includes("etagere") || lower.includes("shelf")) return "bookcases";
  if (lower.includes("desk")) return "desks";
  if (lower.includes("chest")) return "chests";
  if (lower.includes("dresser")) return "dressers";
  if (lower.includes("nightstand")) return "nightstands";
  if (lower.includes("chandelier")) return "chandeliers";
  if (lower.includes("pendant")) return "pendants";
  if (lower.includes("sconce")) return "sconces";
  if (lower.includes("flush")) return "flush-mounts";
  if (lower.includes("lantern")) return "chandeliers";
  if (lower.includes("console")) return "console-tables";
  if (lower.includes("credenza") || lower.includes("sideboard") || lower.includes("buffet")) return "buffets";
  if (lower.includes("light")) return "lighting";
  if (lower.includes("pillow") || lower.includes("cushion")) return "pillows";
  if (lower.includes("vase") || lower.includes("planter") || lower.includes("sculpture")) return "accessories";
  if (lower.includes("art") || lower.includes("wall")) return "wall-art";
  return "accessories";
}

// ── Material extraction ─────────────────────────────────────
function extractMaterial(tags, bodyHtml) {
  const text = ((tags || []).join(" ") + " " + (bodyHtml || "")).toLowerCase();
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
    [/\bshell\b/, "Shell"],
    [/\bbone\b/, "Bone"],
    [/\bmother.of.pearl\b/, "Mother of Pearl"],
    [/\babalone\b/, "Abalone"],
    [/\bcapiz\b/, "Capiz"],
    [/\bparchment\b/, "Parchment"],
    [/\bshagreen\b/, "Shagreen"],
    [/\baluminum\b/, "Aluminum"],
    [/\bcopper\b/, "Copper"],
    [/\bbronze\b/, "Bronze"],
    [/\bcrystal\b/, "Crystal"],
    [/\bseagrass\b/, "Seagrass"],
    [/\bjute\b/, "Jute"],
    [/\babaca\b/, "Abaca"],
  ];

  for (const [re, label] of matMap) {
    if (re.test(text)) materials.push(label);
  }

  return materials.length > 0 ? materials.slice(0, 3).join(", ") : null;
}

function extractStyle(tags, title) {
  const text = ((tags || []).join(" ") + " " + (title || "")).toLowerCase();

  if (/\bcoastal\b/.test(text)) return "Coastal";
  if (/\bmodern\b/.test(text)) return "Modern";
  if (/\bcontemporary\b/.test(text)) return "Contemporary";
  if (/\btransitional\b/.test(text)) return "Transitional";
  if (/\btraditional\b/.test(text)) return "Traditional";
  if (/\bfarmhouse\b/.test(text)) return "Farmhouse";
  if (/\bindustrial\b/.test(text)) return "Industrial";
  if (/\bbohemian\b|\bboho\b/.test(text)) return "Bohemian";
  if (/\brushtic\b/.test(text)) return "Rustic";
  if (/\bglam\b/.test(text)) return "Glam";
  if (/\bmid.century\b/.test(text)) return "Mid-Century Modern";
  if (/\bart\s+deco\b/.test(text)) return "Art Deco";
  if (/\borganic\b/.test(text)) return "Organic Modern";
  if (/\bminimalist\b/.test(text)) return "Modern";

  return "Transitional";
}

// ── Dimensions extraction ───────────────────────────────────
function extractDimensions(bodyHtml) {
  if (!bodyHtml) return null;
  const text = bodyHtml.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");

  const dims = {};
  const wMatch = text.match(/(?:Overall\s+)?(?:Width|W)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in|inches?)?/i);
  const dMatch = text.match(/(?:Overall\s+)?(?:Depth|D)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in|inches?)?/i);
  const hMatch = text.match(/(?:Overall\s+)?(?:Height|H)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in|inches?)?/i);

  if (wMatch) dims.width = wMatch[1];
  if (dMatch) dims.depth = dMatch[1];
  if (hMatch) dims.height = hMatch[1];

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

// ── Color extraction ────────────────────────────────────────
function extractColors(tags) {
  const colorKeywords = [
    "white", "black", "gray", "grey", "blue", "navy", "green", "red",
    "brown", "tan", "beige", "cream", "ivory", "gold", "silver",
    "brass", "bronze", "copper", "natural", "walnut", "oak",
    "charcoal", "taupe", "blush", "pink", "coral", "teal",
    "sage", "olive", "rust", "mustard", "indigo", "slate",
  ];

  const colors = [];
  const tagStr = (tags || []).join(" ").toLowerCase();
  for (const c of colorKeywords) {
    if (tagStr.includes(c)) colors.push(c.charAt(0).toUpperCase() + c.slice(1));
  }
  return colors.length > 0 ? colors.slice(0, 5) : null;
}

// ── Description cleaner ─────────────────────────────────────
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

// ── Collection extraction ───────────────────────────────────
function extractCollection(tags) {
  for (const tag of (tags || [])) {
    if (tag.startsWith("collections:")) {
      return tag.replace("collections:", "").trim();
    }
  }
  return null;
}

// ── Map Shopify product to catalog schema ───────────────────
function mapProduct(sp, vendor) {
  const variant = sp.variants?.[0] || {};
  const images = (sp.images || []).sort((a, b) => a.position - b.position);
  const heroImage = images[0]?.src || null;
  const altImages = images.slice(1).map(img => img.src);
  const tags = sp.tags || [];

  const retailPrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
  const wholesalePrice = variant.price ? parseFloat(variant.price) : null;

  return {
    id: `${vendor.id}_${sp.handle}`,
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    manufacturer_name: vendor.name,
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
    product_url: sp.handle ? `${vendor.urlBase}/products/${sp.handle}` : null,
    product_url_verified: !!sp.handle,
    tags: tags.filter(t => !t.startsWith("collections:")),
    shopify_id: sp.id,
    available: variant.available || false,
    ingestion_source: "shopify-json",
    ingested_at: new Date().toISOString(),
  };
}

// ── Fetch all products for a vendor ─────────────────────────
async function fetchAllProducts(vendor) {
  const allProducts = [];
  let page = 1;

  // Try multiple URL patterns
  const urlPatterns = [
    `${vendor.urlBase}/products.json`,
    `${vendor.urlBase}/collections/all/products.json`,
  ];

  // Also try without www
  const noWww = vendor.urlBase.replace("://www.", "://");
  if (noWww !== vendor.urlBase) {
    urlPatterns.push(`${noWww}/products.json`);
    urlPatterns.push(`${noWww}/collections/all/products.json`);
  }

  let workingUrl = null;

  // Find working URL
  for (const testUrl of urlPatterns) {
    try {
      const testRes = await fetch(`${testUrl}?limit=1&page=1`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      });
      if (testRes.ok) {
        const testData = await testRes.json();
        if (testData.products) {
          workingUrl = testUrl;
          console.log(`  [${vendor.id}] Found working URL: ${testUrl}`);
          break;
        }
      } else {
        console.log(`  [${vendor.id}] ${testUrl} returned ${testRes.status}`);
      }
    } catch (err) {
      console.log(`  [${vendor.id}] ${testUrl} failed: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  if (!workingUrl) {
    console.error(`  [${vendor.id}] NO WORKING URL FOUND — skipping vendor`);
    return { products: [], error: "no_url" };
  }

  while (true) {
    const url = `${workingUrl}?limit=250&page=${page}`;
    console.log(`  [${vendor.id}] Fetching page ${page}...`);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          "Accept": "application/json",
        },
      });

      if (!res.ok) {
        console.error(`  [${vendor.id}] HTTP ${res.status} on page ${page}`);
        break;
      }

      const data = await res.json();
      const products = data.products || [];

      if (products.length === 0) {
        console.log(`  [${vendor.id}] Page ${page} empty — done.`);
        break;
      }

      console.log(`  [${vendor.id}] Page ${page}: ${products.length} products`);
      allProducts.push(...products);
      page++;

      // Rate limiting
      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (err) {
      console.error(`  [${vendor.id}] Error on page ${page}: ${err.message}`);
      break;
    }
  }

  return { products: allProducts, error: null };
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  console.log("=== Multi-Vendor Shopify Importer ===\n");
  console.log(`Importing ${VENDORS.length} vendors...\n`);

  // Load existing catalog
  const { loadCatalog, safeSave } = await import("./lib/safe-catalog-write.mjs");
  const catalog = loadCatalog(DB_PATH);
  const db = catalog.data;
  const beforeTotal = db.products.length;
  console.log(`Current catalog: ${beforeTotal} products\n`);

  const results = {};
  const allNewProducts = [];
  const vendorIds = new Set(VENDORS.map(v => v.id));

  for (const vendor of VENDORS) {
    console.log(`\n${"─".repeat(50)}`);
    console.log(`Importing: ${vendor.name} (${vendor.domain})`);
    console.log(`${"─".repeat(50)}`);

    const { products: shopifyProducts, error } = await fetchAllProducts(vendor);

    if (error) {
      results[vendor.id] = { name: vendor.name, count: 0, error };
      continue;
    }

    console.log(`  [${vendor.id}] Total raw products: ${shopifyProducts.length}`);

    // Deduplicate by handle
    const seen = new Set();
    const unique = [];
    for (const sp of shopifyProducts) {
      if (!seen.has(sp.handle)) {
        seen.add(sp.handle);
        unique.push(sp);
      }
    }
    console.log(`  [${vendor.id}] After dedup: ${unique.length}`);

    // Map to our schema
    const mapped = unique.map(sp => mapProduct(sp, vendor));
    allNewProducts.push(...mapped);

    // Stats
    const stats = {
      total: mapped.length,
      withImage: mapped.filter(p => p.image_url).length,
      withPrice: mapped.filter(p => p.retail_price || p.wholesale_price).length,
      withDesc: mapped.filter(p => p.description).length,
      withDims: mapped.filter(p => p.dimensions).length,
      withMaterial: mapped.filter(p => p.material).length,
    };

    console.log(`  [${vendor.id}] Stats: ${stats.total} products, ${stats.withImage} images, ${stats.withPrice} prices, ${stats.withDesc} descs, ${stats.withDims} dims, ${stats.withMaterial} materials`);

    results[vendor.id] = { name: vendor.name, count: mapped.length, stats, samples: mapped.slice(0, 3) };
  }

  // Remove existing products for these vendors only
  const removedCounts = {};
  const existingOther = [];
  for (const p of db.products) {
    if (vendorIds.has(p.vendor_id)) {
      removedCounts[p.vendor_id] = (removedCounts[p.vendor_id] || 0) + 1;
    } else {
      existingOther.push(p);
    }
  }

  // Merge: keep all other vendors + add new products
  const finalProducts = [...existingOther, ...allNewProducts];

  // Use safeSave with forceDeleteVendors for any vendors being replaced
  const forceDelete = new Set();
  for (const v of VENDORS) {
    forceDelete.add(v.id);
  }

  db.products = finalProducts;
  safeSave(db, finalProducts, catalog.vendorCounts, {
    dbPath: DB_PATH,
    forceDeleteVendors: forceDelete,
    allowMassDeletion: true,
  });

  // ── Final report ────────────────────────────────────────
  console.log(`\n\n${"═".repeat(60)}`);
  console.log("  IMPORT COMPLETE — FINAL REPORT");
  console.log(`${"═".repeat(60)}\n`);

  let totalNew = 0;
  for (const [vid, r] of Object.entries(results)) {
    const status = r.error ? `FAILED (${r.error})` : `${r.count} products`;
    console.log(`  ${r.name}: ${status}`);
    if (r.count > 0) {
      if (removedCounts[vid]) {
        console.log(`    (replaced ${removedCounts[vid]} existing)`);
      }
      totalNew += r.count;
    }
  }

  console.log(`\n  Total new products added: ${totalNew}`);
  console.log(`  Previous catalog: ${beforeTotal}`);
  console.log(`  New catalog total: ${finalProducts.length}`);

  // Verify no existing vendors lost products
  console.log(`\n  Vendor integrity check:`);
  const newCounts = {};
  for (const p of finalProducts) {
    const v = p.vendor_name || p.vendor_id;
    newCounts[v] = (newCounts[v] || 0) + 1;
  }

  // Check existing vendors weren't affected
  let integrityOk = true;
  for (const [vendor, prevCount] of Object.entries(catalog.vendorCounts)) {
    if (!vendorIds.has(vendor) && vendor !== "unknown") {
      const newCount = newCounts[vendor] || 0;
      if (newCount !== prevCount) {
        console.log(`    WARNING: ${vendor}: ${prevCount} → ${newCount}`);
        integrityOk = false;
      }
    }
  }
  if (integrityOk) {
    console.log(`    All existing vendors preserved.`);
  }

  // Sample products
  console.log(`\n${"═".repeat(60)}`);
  console.log("  SAMPLE PRODUCTS (3 per vendor)");
  console.log(`${"═".repeat(60)}`);

  for (const [vid, r] of Object.entries(results)) {
    if (!r.samples || r.samples.length === 0) continue;
    console.log(`\n  ── ${r.name} ──`);
    for (const p of r.samples) {
      console.log(`\n    ${p.product_name}`);
      console.log(`      SKU: ${p.sku || "—"} | Category: ${p.category} | Style: ${p.style}`);
      console.log(`      Material: ${p.material || "—"}`);
      console.log(`      Retail: $${p.retail_price || "—"} | Wholesale: $${p.wholesale_price || "—"}`);
      console.log(`      Dims: ${p.dimensions || "—"}`);
      console.log(`      Images: 1 hero + ${p.alternate_images?.length || 0} alternates`);
      console.log(`      Image: ${p.image_url || "none"}`);
      console.log(`      URL: ${p.product_url || "—"}`);
    }
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
