#!/usr/bin/env node
/**
 * Multi-vendor Shopify JSON API Scraper
 *
 * Tests and scrapes multiple vendors via /products.json.
 * Paginates until empty, deduplicates by handle, maps to catalog schema.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "data", "catalog.db.json");
const DELAY_MS = 1500;

// ── Vendors to try ──
const VENDORS = [
  { id: "noir", name: "Noir Furniture", domains: ["noirfurniturela.com", "noirfurniture.com"] },
  { id: "made-goods", name: "Made Goods", domains: ["madegoods.com"] },
  { id: "palecek", name: "Palecek", domains: ["palecek.com"] },
  { id: "arteriors", name: "Arteriors", domains: ["arteriorshome.com", "arteriors.com"] },
  { id: "bungalow5", name: "Bungalow 5", domains: ["bungalow5.com"] },
  { id: "worlds-away", name: "Worlds Away", domains: ["worldsaway.com"] },
  { id: "currey", name: "Currey & Company", domains: ["curreyandcompany.com", "currey.com"] },
];

// ── Category mapping ──
const CATEGORY_MAP = {
  "beds": "beds", "headboards": "beds",
  "nightstands": "nightstands", "night stands": "nightstands",
  "dressers": "dressers", "chests": "chests",
  "accent chairs": "accent-chairs", "arm chairs": "accent-chairs", "chairs": "accent-chairs",
  "lounge chairs": "accent-chairs", "club chairs": "accent-chairs", "occasional chairs": "accent-chairs",
  "dining chairs": "dining-chairs", "side chairs": "dining-chairs",
  "bar stools": "bar-stools", "counter stools": "counter-stools", "barstools": "bar-stools",
  "bar & counter stools": "bar-stools", "stools": "bar-stools",
  "benches": "benches", "ottomans": "ottomans",
  "sofas": "sofas", "loveseats": "loveseats", "settees": "settees", "sectionals": "sectionals",
  "coffee tables": "cocktail-tables", "cocktail tables": "cocktail-tables",
  "side tables": "side-tables", "end tables": "side-tables", "accent tables": "side-tables",
  "console tables": "console-tables", "consoles": "console-tables", "entry tables": "console-tables",
  "dining tables": "dining-tables",
  "desks": "desks", "writing desks": "desks",
  "cabinets": "bar-cabinets", "bar cabinets": "bar-cabinets", "media cabinets": "media-cabinets",
  "bookcases": "bookcases", "etageres": "bookcases", "étagères": "bookcases", "shelving": "bookcases",
  "credenzas": "credenzas", "sideboards": "buffets", "buffets": "buffets",
  "mirrors": "mirrors",
  "chandeliers": "chandeliers", "pendants": "pendants", "pendant lights": "pendants",
  "sconces": "lighting", "wall sconces": "lighting", "wall lights": "lighting",
  "floor lamps": "floor-lamps", "table lamps": "table-lamps", "desk lamps": "table-lamps",
  "lamps": "table-lamps", "lighting": "lighting", "flush mounts": "lighting",
  "rugs": "rugs",
  "accessories": "accessories", "decor": "accessories", "decorative objects": "accessories",
  "vases": "accessories", "sculptures": "accessories", "trays": "accessories",
  "pillows": "accessories", "throws": "accessories",
  "outdoor": "outdoor-seating", "outdoor seating": "outdoor-seating",
  "outdoor dining": "outdoor-dining", "outdoor tables": "outdoor-tables",
  "planters": "accessories", "garden": "accessories",
};

function mapCategory(productType) {
  if (!productType) return "accessories";
  const lower = productType.toLowerCase().trim();
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];
  // Fuzzy match
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  // Infer
  if (lower.includes("chair")) return "accent-chairs";
  if (lower.includes("table")) return "side-tables";
  if (lower.includes("sofa")) return "sofas";
  if (lower.includes("bed")) return "beds";
  if (lower.includes("lamp")) return "table-lamps";
  if (lower.includes("light")) return "lighting";
  if (lower.includes("mirror")) return "mirrors";
  if (lower.includes("rug")) return "rugs";
  if (lower.includes("stool")) return "bar-stools";
  if (lower.includes("bench")) return "benches";
  if (lower.includes("cabinet")) return "bar-cabinets";
  if (lower.includes("desk")) return "desks";
  if (lower.includes("bookcase") || lower.includes("etagere")) return "bookcases";
  return "accessories";
}

function extractMaterial(tags, bodyHtml) {
  const text = ((tags || []).join(" ") + " " + (bodyHtml || "")).toLowerCase();
  const materials = [];
  const matMap = [
    [/\boak\b/, "Oak"], [/\bwalnut\b/, "Walnut"], [/\bmahogany\b/, "Mahogany"],
    [/\bteak\b/, "Teak"], [/\bmaple\b/, "Maple"], [/\bash\b/, "Ash"],
    [/\bbirch\b/, "Birch"], [/\bpine\b/, "Pine"], [/\bmango\b/, "Mango Wood"],
    [/\brattan\b/, "Rattan"], [/\bwicker\b/, "Wicker"], [/\bcane\b/, "Cane"],
    [/\bbamboo\b/, "Bamboo"], [/\bseagrass\b/, "Seagrass"], [/\babaca\b/, "Abaca"],
    [/\bjute\b/, "Jute"],
    [/\biron\b/, "Iron"], [/\bbrass\b/, "Brass"], [/\bsteel\b/, "Steel"],
    [/\baluminum\b/, "Aluminum"], [/\bnickel\b/, "Nickel"], [/\bcopper\b/, "Copper"],
    [/\bbronze\b/, "Bronze"], [/\bzinc\b/, "Zinc"],
    [/\bmarble\b/, "Marble"], [/\bstone\b/, "Stone"], [/\bgranite\b/, "Granite"],
    [/\btravertine\b/, "Travertine"], [/\bquartz\b/, "Quartz"], [/\bonyx\b/, "Onyx"],
    [/\bconcrete\b/, "Concrete"], [/\bterrazzo\b/, "Terrazzo"],
    [/\bglass\b/, "Glass"], [/\bacrylic\b/, "Acrylic"], [/\blucite\b/, "Lucite"],
    [/\bresin\b/, "Resin"], [/\bbone\b/, "Bone"], [/\bhorn\b/, "Horn"],
    [/\bshagreen\b/, "Shagreen"], [/\bshell\b/, "Shell"], [/\bmother.of.pearl\b/, "Mother of Pearl"],
    [/\bleather\b/, "Leather"], [/\bvelvet\b/, "Velvet"], [/\blinen\b/, "Linen"],
    [/\bcotton\b/, "Cotton"], [/\bperformance\s+fabric\b/, "Performance Fabric"],
    [/\bboucle\b/, "Bouclé"], [/\bmohair\b/, "Mohair"],
    [/\bfabric\b/, "Fabric"], [/\bupholster/, "Upholstered"],
    [/\bceramic\b/, "Ceramic"], [/\bporcelain\b/, "Porcelain"],
    [/\bterracotta\b/, "Terracotta"], [/\bpapier.mache\b/, "Papier-Mâché"],
    [/\bwood\b/, "Wood"],
  ];
  for (const [re, label] of matMap) {
    if (re.test(text)) materials.push(label);
  }
  return materials.length > 0 ? materials.slice(0, 4).join(", ") : null;
}

function extractStyle(tags, title, productType) {
  const text = ((tags || []).join(" ") + " " + (title || "") + " " + (productType || "")).toLowerCase();
  if (/\bcoastal\b/.test(text)) return "Coastal";
  if (/\bmodern\b/.test(text)) return "Modern";
  if (/\bcontemporary\b/.test(text)) return "Contemporary";
  if (/\btransitional\b/.test(text)) return "Transitional";
  if (/\btraditional\b/.test(text)) return "Traditional";
  if (/\bindustrial\b/.test(text)) return "Industrial";
  if (/\bbohemian\b|\bboho\b/.test(text)) return "Bohemian";
  if (/\brushtic\b/.test(text)) return "Rustic";
  if (/\bglam\b/.test(text)) return "Glam";
  if (/\bmid.century\b/.test(text)) return "Mid-Century Modern";
  if (/\borganic\b/.test(text)) return "Organic Modern";
  if (/\bminimalist\b/.test(text)) return "Modern";
  return "Transitional";
}

function extractDimensions(bodyHtml) {
  if (!bodyHtml) return null;
  const text = bodyHtml.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ");
  const dims = {};

  // Overall Width/Depth/Height
  const wm = text.match(/(?:Overall\s+)?(?:Width|W)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in|'')?/i);
  const dm = text.match(/(?:Overall\s+)?(?:Depth|D)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in|'')?/i);
  const hm = text.match(/(?:Overall\s+)?(?:Height|H)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in|'')?/i);
  if (wm) dims.width = wm[1];
  if (dm) dims.depth = dm[1];
  if (hm) dims.height = hm[1];

  // WxDxH
  if (!dims.width) {
    const m = text.match(/(\d+\.?\d*)\s*["']?\s*[xX×]\s*(\d+\.?\d*)\s*["']?\s*[xX×]\s*(\d+\.?\d*)\s*["']?/);
    if (m) { dims.width = m[1]; dims.depth = m[2]; dims.height = m[3]; }
  }
  // Diameter
  if (!dims.width) {
    const dm2 = text.match(/(?:Diameter|Dia\.?)\s*[:=]?\s*(\d+\.?\d*)\s*(?:"|in)?/i);
    if (dm2) dims.width = dm2[1];
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

function extractColors(tags) {
  const colorWords = [
    "white", "black", "gray", "grey", "blue", "navy", "green", "red",
    "brown", "tan", "beige", "cream", "ivory", "gold", "silver",
    "brass", "bronze", "copper", "natural", "charcoal", "taupe",
    "blush", "pink", "coral", "teal", "sage", "olive", "rust",
    "mustard", "indigo", "slate", "cognac", "amber", "bone",
  ];
  const colors = [];
  const tagStr = (tags || []).join(" ").toLowerCase();
  for (const c of colorWords) {
    if (tagStr.includes(c)) colors.push(c.charAt(0).toUpperCase() + c.slice(1));
  }
  return colors.length > 0 ? colors.slice(0, 5) : null;
}

function cleanDescription(html) {
  if (!html) return null;
  let text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.length > 10 ? text.slice(0, 1000) : null;
}

function extractCollection(tags) {
  for (const tag of (tags || [])) {
    if (tag.toLowerCase().startsWith("collection:")) return tag.replace(/^collection:\s*/i, "").trim();
    if (tag.toLowerCase().startsWith("collections:")) return tag.replace(/^collections:\s*/i, "").trim();
  }
  return null;
}

function mapProduct(sp, vendorId, vendorName, domain) {
  const variant = sp.variants?.[0] || {};
  const images = (sp.images || []).sort((a, b) => a.position - b.position);
  const heroImage = images[0]?.src || null;
  const altImages = images.slice(1).map(img => img.src);
  const tags = sp.tags || [];

  const retailPrice = variant.compare_at_price ? parseFloat(variant.compare_at_price) : null;
  const wholesalePrice = variant.price ? parseFloat(variant.price) : null;

  return {
    id: `${vendorId}_${sp.handle}`,
    vendor_id: vendorId,
    vendor_name: vendorName,
    manufacturer_name: vendorName,
    product_name: sp.title || "Unknown",
    sku: variant.sku || null,
    category: mapCategory(sp.product_type),
    product_type_raw: sp.product_type || null,
    description: cleanDescription(sp.body_html),
    material: extractMaterial(tags, sp.body_html),
    style: extractStyle(tags, sp.title, sp.product_type),
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
    product_url: sp.handle ? `https://${domain}/products/${sp.handle}` : null,
    product_url_verified: !!sp.handle,
    tags: tags.filter(t => !/^collections?:/i.test(t)),
    shopify_id: sp.id,
    available: variant.available || false,
    ingestion_source: "shopify-json",
    ingested_at: new Date().toISOString(),
  };
}

async function fetchAllProducts(domain) {
  const allProducts = [];
  let page = 1;

  while (true) {
    const url = `https://${domain}/products.json?limit=250&page=${page}`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        if (page === 1) return { ok: false, status: res.status, products: [] };
        break; // Ran out of pages
      }

      const data = await res.json();
      const products = data.products || [];

      if (products.length === 0) break;

      console.log(`    Page ${page}: ${products.length} products`);
      allProducts.push(...products);
      page++;
      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (err) {
      if (page === 1) return { ok: false, status: err.message, products: [] };
      break;
    }
  }

  return { ok: true, products: allProducts };
}

async function main() {
  console.log("=== Multi-Vendor Shopify Scraper ===\n");

  const results = [];
  const failed = [];

  for (const vendor of VENDORS) {
    console.log(`\n── ${vendor.name} ──`);
    let success = false;
    let workingDomain = null;

    for (const domain of vendor.domains) {
      console.log(`  Trying ${domain}...`);
      const result = await fetchAllProducts(domain);

      if (result.ok && result.products.length > 0) {
        workingDomain = domain;

        // Deduplicate by handle
        const seen = new Set();
        const unique = [];
        for (const sp of result.products) {
          if (!seen.has(sp.handle)) {
            seen.add(sp.handle);
            unique.push(sp);
          }
        }

        const mapped = unique.map(sp => mapProduct(sp, vendor.id, vendor.name, domain));

        const stats = {
          total: mapped.length,
          desc: mapped.filter(p => p.description).length,
          dims: mapped.filter(p => p.dimensions).length,
          img: mapped.filter(p => p.image_url).length,
          price: mapped.filter(p => p.price_verified).length,
          material: mapped.filter(p => p.material).length,
        };

        console.log(`  ✓ ${vendor.name}: ${mapped.length} products from ${domain}`);
        console.log(`    Descriptions: ${stats.desc} (${Math.round(stats.desc/stats.total*100)}%)`);
        console.log(`    Dimensions:   ${stats.dims} (${Math.round(stats.dims/stats.total*100)}%)`);
        console.log(`    Images:       ${stats.img} (${Math.round(stats.img/stats.total*100)}%)`);
        console.log(`    Prices:       ${stats.price} (${Math.round(stats.price/stats.total*100)}%)`);
        console.log(`    Material:     ${stats.material} (${Math.round(stats.material/stats.total*100)}%)`);

        // Sample products
        console.log("    Sample products:");
        for (const p of mapped.slice(0, 3)) {
          console.log(`      - ${p.product_name} (${p.category}) $${p.retail_price || p.wholesale_price || "?"}`);
        }

        // Category breakdown
        const cats = {};
        for (const p of mapped) cats[p.category] = (cats[p.category] || 0) + 1;
        const topCats = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 8);
        console.log("    Top categories:", topCats.map(([c, n]) => `${c}(${n})`).join(", "));

        results.push({ vendor, mapped, domain });
        success = true;
        break;
      } else {
        console.log(`    ✗ ${domain}: ${result.status}`);
      }
    }

    if (!success) {
      failed.push(vendor);
      console.log(`  ✗ ${vendor.name}: FAILED (not Shopify or blocked)`);
    }

    // Delay between vendors
    await new Promise(r => setTimeout(r, 2000));
  }

  // ── Save to catalog ──
  if (results.length > 0) {
    console.log("\n\n=== Saving to catalog ===");
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));

    for (const { vendor, mapped } of results) {
      const before = db.products.length;
      db.products = db.products.filter(p => p.vendor_id !== vendor.id);
      const removed = before - db.products.length;
      if (removed > 0) console.log(`  Removed ${removed} existing ${vendor.name} products`);

      db.products.push(...mapped);
      console.log(`  Added ${mapped.length} ${vendor.name} products`);
    }

    db.product_count = db.products.length;
    db.saved_at = new Date().toISOString();
    fs.writeFileSync(DB_PATH, JSON.stringify(db));
    console.log(`\n  Total catalog: ${db.product_count} products`);
  }

  // ── Summary ──
  console.log("\n\n=== SUMMARY ===");
  console.log(`Succeeded: ${results.length} vendors`);
  for (const { vendor, mapped, domain } of results) {
    console.log(`  ✓ ${vendor.name}: ${mapped.length} products (${domain})`);
  }
  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length} vendors (not Shopify or blocked)`);
    for (const v of failed) {
      console.log(`  ✗ ${v.name} (${v.domains.join(", ")})`);
    }
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
