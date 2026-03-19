#!/usr/bin/env node
/**
 * Generic Vendor Enrichment Script
 *
 * Visits product pages for a specified vendor and extracts:
 * - Description (og:description, meta description, JSON-LD, page text)
 * - Dimensions (W/D/H patterns in inches)
 * - Material (from page text)
 * - Better images (og:image, JSON-LD image)
 *
 * Only updates fields that are currently missing.
 *
 * Usage: node scripts/enrich-vendor.mjs --vendor bernhardt [--limit 50] [--dry-run]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import http from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/catalog.db.json");

const args = process.argv.slice(2);
const vendorFilter = args.includes("--vendor") ? args[args.indexOf("--vendor") + 1] : null;
const limit = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1]) : 9999;
const dryRun = args.includes("--dry-run");

if (!vendorFilter) {
  console.error("Usage: node scripts/enrich-vendor.mjs --vendor <vendor-id> [--limit N] [--dry-run]");
  process.exit(1);
}

console.log(`Loading catalog...`);
const raw = readFileSync(DB_PATH, "utf8");
const db = JSON.parse(raw);

// Find products needing enrichment
const products = db.products.filter(p => {
  if (p.vendor_id !== vendorFilter) return false;
  // Skip products that already have good data
  if (p.description && p.dimensions && p.material) return false;
  return true;
});

console.log(`Found ${products.length} products needing enrichment for ${vendorFilter}`);
if (dryRun) console.log("DRY RUN — no changes will be saved");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const newUrl = res.headers.location.startsWith("http") ? res.headers.location : new URL(res.headers.location, url).href;
        fetchPage(newUrl).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function extractDescription(html) {
  // Priority 1: JSON-LD description
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const json = JSON.parse(block.replace(/<\/?script[^>]*>/gi, ""));
        if (json.description && json.description.length > 20) {
          return cleanText(json.description);
        }
        if (json["@graph"]) {
          for (const item of json["@graph"]) {
            if (item.description && item.description.length > 20) return cleanText(item.description);
          }
        }
      } catch {}
    }
  }

  // Priority 2: og:description
  const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                   html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:description["']/i);
  if (ogMatch && ogMatch[1].length > 20) return cleanText(ogMatch[1]);

  // Priority 3: meta description
  const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                    html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
  if (metaMatch && metaMatch[1].length > 20) return cleanText(metaMatch[1]);

  // Priority 4: itemprop description
  const itemMatch = html.match(/itemprop=["']description["'][^>]*>([^<]{20,})/i);
  if (itemMatch) return cleanText(itemMatch[1]);

  // Priority 5: Specific vendor HTML elements
  // Hickory Chair: <div id="product-description">
  const hcMatch = html.match(/<div\s+id=["']product-description["'][^>]*>([\s\S]*?)<\/div>/i);
  if (hcMatch) {
    const t = cleanText(hcMatch[1]);
    if (t.length > 20) return t;
  }

  // Vanguard: <div class="DetailText"> (features section)
  const vgMatches = html.match(/<div[^>]*class=["'][^"']*DetailText[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi);
  if (vgMatches) {
    const combined = vgMatches.map(m => cleanText(m)).filter(t => t.length > 5).join(". ");
    if (combined.length > 20) return combined.slice(0, 500);
  }

  // Wesley Hall: <div class="pcsinfo"> (component specs)
  const whMatches = html.match(/<div[^>]*class=["']pcsinfo["'][^>]*>([\s\S]*?)<\/div>/gi);
  if (whMatches) {
    const combined = whMatches.map(m => cleanText(m)).filter(t => t.length > 5).join("; ");
    if (combined.length > 20) return combined.slice(0, 500);
  }

  // Priority 6: Any substantial paragraph in a product/description container
  const containerMatch = html.match(/<(?:div|section)[^>]*(?:class|id)=["'][^"']*(?:product|description|details|overview|summary)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
  if (containerMatch) {
    const t = cleanText(containerMatch[1]);
    if (t.length > 40) return t;
  }

  return null;
}

function extractDimensions(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

  const dims = {};

  // Pattern: "W 87" or "Width: 87" or "87W" or "87"W" — in inches
  const patterns = [
    // "Overall Width: 72 in." format (Century, Shopify vendors)
    { key: "width", re: /Overall\s+Width\s*:\s*([\d.]+)\s*(?:in\.?|inches?|")/i },
    { key: "depth", re: /Overall\s+Depth\s*:\s*([\d.]+)\s*(?:in\.?|inches?|")/i },
    { key: "height", re: /Overall\s+Height\s*:\s*([\d.]+)\s*(?:in\.?|inches?|")/i },
    // "Width: 87" or "Width 87" format (full word only, no single-letter to avoid JS noise)
    { key: "width", re: /\bWidth\s*[:=]?\s*([\d.]+)\s*(?:"|in|inches?)?/i },
    { key: "depth", re: /\bDepth\s*[:=]?\s*([\d.]+)\s*(?:"|in|inches?)?/i },
    { key: "height", re: /\bHeight\s*[:=]?\s*([\d.]+)\s*(?:"|in|inches?)?/i },
    // "87W x 39D x 35H" format
    { key: "width", re: /([\d.]+)\s*(?:"|'')?W\b/i },
    { key: "depth", re: /([\d.]+)\s*(?:"|'')?D\b/i },
    { key: "height", re: /([\d.]+)\s*(?:"|'')?H\b/i },
    // Seat height
    { key: "seatHeight", re: /Seat\s*(?:Height|H)\s*[:=]?\s*([\d.]+)/i },
    { key: "armHeight", re: /Arm\s*(?:Height|H)\s*[:=]?\s*([\d.]+)/i },
  ];

  for (const { key, re } of patterns) {
    if (dims[key]) continue;
    const m = text.match(re);
    if (m) {
      const val = parseFloat(m[1]);
      // Sanity check: furniture dimensions in inches should be 5-200
      if (val >= 5 && val <= 200) dims[key] = m[1];
    }
  }

  // Try "W48 D30 H30" pattern (Stickley format — letter before number)
  if (!dims.width) {
    const wdhMatch = text.match(/\bW\s*(\d{1,3}(?:\.\d+)?)\s+D\s*(\d{1,3}(?:\.\d+)?)\s+H\s*(\d{1,3}(?:\.\d+)?)/i);
    if (wdhMatch) {
      const a = parseFloat(wdhMatch[1]), b = parseFloat(wdhMatch[2]), c = parseFloat(wdhMatch[3]);
      if (a >= 5 && a <= 200 && b >= 5 && b <= 200 && c >= 5 && c <= 200) {
        dims.width = wdhMatch[1];
        dims.depth = wdhMatch[2];
        dims.height = wdhMatch[3];
      }
    }
  }

  // Also try "87 x 39 x 35" pattern (W x D x H)
  if (!dims.width) {
    const tripleMatch = text.match(/([\d.]+)\s*(?:"|''|in)?\s*[x×]\s*([\d.]+)\s*(?:"|''|in)?\s*[x×]\s*([\d.]+)/i);
    if (tripleMatch) {
      const a = parseFloat(tripleMatch[1]), b = parseFloat(tripleMatch[2]), c = parseFloat(tripleMatch[3]);
      if (a >= 5 && a <= 200 && b >= 5 && b <= 200 && c >= 5 && c <= 200) {
        dims.width = tripleMatch[1];
        dims.depth = tripleMatch[2];
        dims.height = tripleMatch[3];
      }
    }
  }

  if (!dims.width && !dims.depth && !dims.height) return null;

  const parts = [];
  if (dims.width) parts.push(`W: ${dims.width}"`);
  if (dims.depth) parts.push(`D: ${dims.depth}"`);
  if (dims.height) parts.push(`H: ${dims.height}"`);
  let result = parts.join(" x ");
  const extras = [];
  if (dims.seatHeight) extras.push(`Seat H: ${dims.seatHeight}"`);
  if (dims.armHeight) extras.push(`Arm H: ${dims.armHeight}"`);
  if (extras.length > 0) result += " | " + extras.join(", ");
  return result;
}

function extractMaterial(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").toLowerCase();

  // Look for explicit material mentions
  const materialPatterns = [
    { re: /material[s]?\s*[:=]\s*([^<.]{3,80})/i, source: "material-field" },
    { re: /construction\s*[:=]\s*([^<.]{3,80})/i, source: "construction-field" },
    { re: /frame\s*[:=]\s*([^<.]{3,80})/i, source: "frame-field" },
  ];

  for (const { re } of materialPatterns) {
    const m = html.replace(/<[^>]+>/g, " ").match(re);
    if (m && m[1].length > 3 && m[1].length < 80) return cleanText(m[1]);
  }

  // Infer from keywords
  const materials = [];
  if (text.includes("leather")) materials.push("Leather");
  if (text.includes("fabric") || text.includes("upholster")) materials.push("Upholstered Fabric");
  if (text.includes("walnut")) materials.push("Walnut");
  if (text.includes("mahogany")) materials.push("Mahogany");
  if (text.includes("oak")) materials.push("Oak");
  if (text.includes("cherry")) materials.push("Cherry");
  if (text.includes("maple")) materials.push("Maple");
  if (text.includes("hardwood") || text.includes("solid wood")) materials.push("Hardwood");
  if (text.includes("metal") || text.includes("iron") || text.includes("steel")) materials.push("Metal");
  if (text.includes("marble") || text.includes("stone")) materials.push("Stone");
  if (text.includes("glass")) materials.push("Glass");
  if (text.includes("rattan") || text.includes("wicker") || text.includes("cane")) materials.push("Rattan");

  if (materials.length > 0) return materials.slice(0, 3).join(", ");
  return null;
}

function extractBetterImage(html) {
  // JSON-LD image
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const json = JSON.parse(block.replace(/<\/?script[^>]*>/gi, ""));
        if (json.image) {
          const img = Array.isArray(json.image) ? json.image[0] : json.image;
          if (typeof img === "string" && img.startsWith("http")) return img;
          if (img?.url) return img.url;
        }
      } catch {}
    }
  }

  // og:image
  const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["'](https?:\/\/[^"']+)["']/i) ||
                   html.match(/<meta\s+content=["'](https?:\/\/[^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogMatch) return ogMatch[1];

  return null;
}

function extractProductName(html) {
  // JSON-LD name
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      try {
        const json = JSON.parse(block.replace(/<\/?script[^>]*>/gi, ""));
        if (json["@type"] === "Product" && json.name) return cleanText(json.name);
      } catch {}
    }
  }

  // og:title
  const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogMatch) {
    let name = ogMatch[1].replace(/\s*[-|].*$/, "").trim();
    if (name.length > 3) return name;
  }

  // h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)/i);
  if (h1Match && h1Match[1].trim().length > 3) return cleanText(h1Match[1]);

  return null;
}

function cleanText(text) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

// Main
let enriched = 0;
let failed = 0;
let skipped = 0;
let fieldsAdded = { description: 0, dimensions: 0, material: 0, image: 0, name: 0 };

const toProcess = products.slice(0, limit);
console.log(`Processing ${toProcess.length} products...`);

for (let i = 0; i < toProcess.length; i++) {
  const p = toProcess[i];
  const url = p.product_url;
  if (!url || !url.startsWith("http")) { skipped++; continue; }

  try {
    process.stdout.write(`\r[${i + 1}/${toProcess.length}] ${p.product_name?.slice(0, 40) || p.sku || "?"}...`);

    const html = await fetchPage(url);
    let changed = false;

    // Enrich description
    if (!p.description || p.description.length < 20) {
      const desc = extractDescription(html);
      if (desc && desc.length > 20) {
        if (!dryRun) p.description = desc;
        fieldsAdded.description++;
        changed = true;
      }
    }

    // Enrich dimensions
    if (!p.dimensions) {
      const dims = extractDimensions(html);
      if (dims) {
        if (!dryRun) p.dimensions = dims;
        fieldsAdded.dimensions++;
        changed = true;
      }
    }

    // Enrich material
    if (!p.material) {
      const mat = extractMaterial(html);
      if (mat) {
        if (!dryRun) p.material = mat;
        fieldsAdded.material++;
        changed = true;
      }
    }

    // Fix product name if it's just a SKU or number
    if (p.product_name && /^\d+[a-z]*$/i.test(p.product_name.trim())) {
      const betterName = extractProductName(html);
      if (betterName && betterName.length > 3) {
        if (!dryRun) p.product_name = betterName;
        fieldsAdded.name++;
        changed = true;
      }
    }

    // Fix broken image
    if (!p.image_url || p.image_quality === "broken" || (p.image_url && p.image_url.includes("no_selection"))) {
      const img = extractBetterImage(html);
      if (img) {
        if (!dryRun) {
          p.image_url = img;
          p.image_quality = null;
          delete p.bad_image;
        }
        fieldsAdded.image++;
        changed = true;
      }
    }

    if (changed) enriched++;
    await new Promise(r => setTimeout(r, 200));
  } catch (err) {
    failed++;
  }
}

console.log(`\n\nResults:`);
console.log(`  Enriched: ${enriched}`);
console.log(`  Failed: ${failed}`);
console.log(`  Skipped: ${skipped}`);
console.log(`  Fields added:`);
console.log(`    Description: ${fieldsAdded.description}`);
console.log(`    Dimensions: ${fieldsAdded.dimensions}`);
console.log(`    Material: ${fieldsAdded.material}`);
console.log(`    Image: ${fieldsAdded.image}`);
console.log(`    Name: ${fieldsAdded.name}`);

if (!dryRun && enriched > 0) {
  console.log("\nSaving catalog...");
  writeFileSync(DB_PATH, JSON.stringify(db, null, 0));
  console.log("Saved.");
}
