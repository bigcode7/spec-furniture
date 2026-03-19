#!/usr/bin/env node
/**
 * Full Catalog Audit & Cleanup Script
 *
 * Steps:
 * 1. Remove non-products (category pages, swatches, samples, etc.)
 * 2. Clean product names (remove vendor prefixes, SKUs, internal labels)
 * 3. Clean descriptions (remove HTML, JSON, CSS, JS, SEO spam)
 * 4. Report per-vendor stats
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, "../data/catalog.db.json");

console.log("Loading catalog...");
const raw = readFileSync(DB_PATH, "utf8");
const db = JSON.parse(raw);
const products = db.products || [];

console.log(`Loaded ${products.length} products\n`);

// ══════════════════════════════════════════════════════════════
// STEP 1: Identify and remove non-products
// ══════════════════════════════════════════════════════════════

const NON_PRODUCT_NAME_PATTERNS = [
  /^shop\s*\|/i,
  /^all\s*products/i,
  /^browse\s/i,
  /^view\s*all/i,
  /^category\s/i,
  /^collection\s*\|/i,
  /\bapplication\b.*\bform\b/i,
  /^swatch\b/i,
  /\bswatch\s*card/i,
  /\bfinish\s*card/i,
  /\bcolor\s*card/i,
  /\bsample\s*(?:card|order|request)/i,
  /^(?:login|sign\s*in|register|dealer|trade)\b/i,
  /^page\s*\d/i,
  /^home\s*page/i,
  /^landing\s*page/i,
  /^products?\s*by\s*room/i,
  /^products?\s*by\s*category/i,
];

const NON_PRODUCT_URL_PATTERNS = [
  /\/(?:category|categories|shop|browse|all-products|collections?)\/?$/i,
  /\/(?:login|register|sign-in|dealer|trade-application|contact)\/?$/i,
  /\/products?\/?$/i,
  /\/(?:living-room|bedroom|dining-room|office|outdoor|lighting)\/?$/i,
  /\?.*(?:page|filter|sort|view)/i,
  /\/(?:swatches?|samples?|finish-cards?|color-cards?)\/?$/i,
];

// Check for garbage names (too short, all caps nonsense, contains CSS/HTML/JS)
function isGarbageName(name) {
  if (!name || name.length < 3) return true;
  if (/^[^a-zA-Z]*$/.test(name)) return true; // No letters at all
  if (/\{[\s\S]*\}/.test(name)) return true; // Contains JSON/CSS
  if (/<[a-z][\s\S]*>/i.test(name)) return true; // Contains HTML tags
  if (/(?:function|var |const |let |import |export |class )\s/i.test(name)) return true; // JS code
  if (/(?:border-radius|font-size|margin|padding|display|position)\s*:/i.test(name)) return true; // CSS
  if (/(?:cssanimation|borderradius|boxshadow)/i.test(name)) return true; // Minified CSS
  return false;
}

function isNonProduct(product) {
  const name = product.product_name || "";
  const url = product.product_url || "";

  for (const pattern of NON_PRODUCT_NAME_PATTERNS) {
    if (pattern.test(name)) return `name matches: ${pattern}`;
  }

  for (const pattern of NON_PRODUCT_URL_PATTERNS) {
    if (pattern.test(url)) return `url matches: ${pattern}`;
  }

  if (isGarbageName(name)) return `garbage name: "${name.slice(0, 60)}"`;

  return false;
}

// ══════════════════════════════════════════════════════════════
// STEP 2: Clean product names
// ══════════════════════════════════════════════════════════════

const VENDOR_PREFIXES = [
  "Theodore Alexander", "Bernhardt", "Hooker Furniture", "Hooker",
  "Baker Furniture", "Baker", "Century Furniture", "Century",
  "Caracole", "Lexington Home Brands", "Lexington",
  "Lee Industries", "Stickley", "Universal Furniture", "Universal",
  "Vanguard Furniture", "Vanguard", "CR Laine", "C.R. Laine",
  "Sherrill Furniture", "Sherrill", "Wesley Hall", "Hancock & Moore",
  "Hancock and Moore", "Hickory Chair", "Highland House",
  "Rowe Furniture", "Rowe", "Robin Bruce", "Four Hands",
  "Visual Comfort", "Loloi Rugs", "Loloi",
];

function cleanProductName(name, vendor) {
  if (!name) return name;
  let cleaned = name;

  // Remove vendor name prefix (case insensitive)
  for (const prefix of VENDOR_PREFIXES) {
    const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—|:]?\\s*`, "i");
    cleaned = cleaned.replace(re, "");
  }

  // Remove trailing SKU patterns like " - 4126-05SW" or " (H5425-002)"
  cleaned = cleaned.replace(/\s*[-–]\s*[A-Z0-9]{2,}[-/][A-Z0-9]+(?:[-/][A-Z0-9]+)*\s*$/i, "");
  cleaned = cleaned.replace(/\s*\([A-Z0-9]{2,}[-/][A-Z0-9]+(?:[-/][A-Z0-9]+)*\)\s*$/i, "");

  // Remove internal labels
  const INTERNAL_LABELS = [
    "Special Order", "Pre-Made Sample", "Quick Ship", "Express",
    "Custom Order", "Stock Program", "Made to Order", "MTO",
    "Trade Only", "COM Required", "As Shown",
  ];
  for (const label of INTERNAL_LABELS) {
    const re = new RegExp(`\\s*[-–|,]?\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, "i");
    cleaned = cleaned.replace(re, "");
    // Also remove from beginning
    const re2 = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–|,]?\\s*`, "i");
    cleaned = cleaned.replace(re2, "");
  }

  // Remove any remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");

  // Remove excess whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Capitalize first letter of each word if all lowercase
  if (cleaned === cleaned.toLowerCase() && cleaned.length > 3) {
    cleaned = cleaned.replace(/\b\w/g, c => c.toUpperCase());
  }

  return cleaned || name; // Fall back to original if cleaning emptied it
}

// ══════════════════════════════════════════════════════════════
// STEP 3: Clean descriptions
// ══════════════════════════════════════════════════════════════

function cleanDescription(desc) {
  if (!desc) return null;

  let cleaned = desc;

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // Remove HTML entities
  cleaned = cleaned.replace(/&amp;/g, "&");
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&lt;/g, "<");
  cleaned = cleaned.replace(/&gt;/g, ">");
  cleaned = cleaned.replace(/&nbsp;/g, " ");
  cleaned = cleaned.replace(/&#?\w+;/g, "");

  // Remove JSON/CSS/JS fragments
  if (/\{[\s\S]{10,}\}/.test(cleaned) && !/\binclude|\bfeature|\bwith\b/i.test(cleaned)) {
    // Likely JSON/CSS — nuke the whole thing
    return null;
  }
  if (/(?:function|var |const |let |import |export )\s/.test(cleaned)) return null;
  if (/(?:border-radius|font-size|margin|padding|display|position)\s*:/.test(cleaned)) return null;
  if (/(?:cssanimation|borderradius|boxshadow)/i.test(cleaned)) return null;

  // Remove SEO spam (keyword-stuffed paragraphs)
  if (/(?:buy|shop|order|click|purchase)\s+(?:online|now|today|here)/i.test(cleaned) &&
      cleaned.length < 200) return null;

  // Remove if it's just the product name repeated
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  if (cleaned.length < 10) return null;

  // Cap at 1000 chars
  if (cleaned.length > 1000) cleaned = cleaned.slice(0, 997) + "...";

  return cleaned;
}

// ══════════════════════════════════════════════════════════════
// MAIN: Process all products
// ══════════════════════════════════════════════════════════════

const vendorStats = {};
const toRemove = [];
let namesChanged = 0;
let descsCleaned = 0;

for (let i = 0; i < products.length; i++) {
  const p = products[i];
  const vendor = p.vendor_name || p.vendor_id || "Unknown";

  if (!vendorStats[vendor]) {
    vendorStats[vendor] = {
      before: 0,
      removed: 0,
      after: 0,
      goodImages: 0,
      badImages: 0,
      noImages: 0,
      withDescription: 0,
      withDimensions: 0,
      withMaterial: 0,
      withPrice: 0,
      withCollection: 0,
      withSku: 0,
      completeData: 0,
      missingCritical: 0,
      namesFixed: 0,
      descsFixed: 0,
    };
  }
  vendorStats[vendor].before++;

  // Check if non-product
  const nonProductReason = isNonProduct(p);
  if (nonProductReason) {
    toRemove.push({ id: p.id, name: p.product_name, vendor, reason: nonProductReason });
    vendorStats[vendor].removed++;
    continue;
  }

  // Clean name
  const originalName = p.product_name;
  const cleanedName = cleanProductName(p.product_name, vendor);
  if (cleanedName !== originalName) {
    p.product_name = cleanedName;
    namesChanged++;
    vendorStats[vendor].namesFixed++;
  }

  // Clean description
  const originalDesc = p.description;
  const cleanedDesc = cleanDescription(p.description);
  if (cleanedDesc !== originalDesc) {
    p.description = cleanedDesc;
    descsCleaned++;
    vendorStats[vendor].descsFixed++;
  }

  // Count stats
  vendorStats[vendor].after++;

  const hasImage = p.image_url && p.image_url.startsWith("http");
  const imageVerified = p.image_verified || p.image_quality === "verified-hq" || p.image_quality === "verified";
  const imageBad = p.image_quality === "broken" || p.image_quality === "missing" || p.bad_image;

  if (!hasImage) vendorStats[vendor].noImages++;
  else if (imageBad) vendorStats[vendor].badImages++;
  else vendorStats[vendor].goodImages++;

  if (p.description && p.description.length > 15) vendorStats[vendor].withDescription++;
  if (p.dimensions) vendorStats[vendor].withDimensions++;
  if (p.material) vendorStats[vendor].withMaterial++;
  if (p.retail_price) vendorStats[vendor].withPrice++;
  if (p.collection) vendorStats[vendor].withCollection++;
  if (p.sku) vendorStats[vendor].withSku++;

  // "Complete data" = has description + dimensions + material
  if (p.description && p.dimensions && p.material) {
    vendorStats[vendor].completeData++;
  } else {
    vendorStats[vendor].missingCritical++;
  }
}

// Remove non-products
console.log(`\n${"═".repeat(70)}`);
console.log(`NON-PRODUCTS TO REMOVE: ${toRemove.length}`);
console.log(`${"═".repeat(70)}`);

const removeByVendor = {};
for (const item of toRemove) {
  if (!removeByVendor[item.vendor]) removeByVendor[item.vendor] = [];
  removeByVendor[item.vendor].push(item);
}

for (const [vendor, items] of Object.entries(removeByVendor).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${vendor}: ${items.length} non-products`);
  for (const item of items.slice(0, 5)) {
    console.log(`    ✕ "${item.name?.slice(0, 50)}" — ${item.reason}`);
  }
  if (items.length > 5) console.log(`    ... and ${items.length - 5} more`);
}

// Actually remove them
const removeIds = new Set(toRemove.map(r => r.id));
const cleanedProducts = products.filter(p => !removeIds.has(p.id));

console.log(`\n${"═".repeat(70)}`);
console.log(`CLEANUP SUMMARY`);
console.log(`${"═".repeat(70)}`);
console.log(`Names cleaned: ${namesChanged}`);
console.log(`Descriptions cleaned: ${descsCleaned}`);
console.log(`Non-products removed: ${toRemove.length}`);
console.log(`Products remaining: ${cleanedProducts.length}`);

// Print per-vendor stats
console.log(`\n${"═".repeat(70)}`);
console.log(`PER-VENDOR AUDIT`);
console.log(`${"═".repeat(70)}`);

const vendorOrder = Object.entries(vendorStats).sort((a, b) => b[1].after - a[1].after);
for (const [vendor, s] of vendorOrder) {
  if (s.before === 0) continue;
  const pct = (n, total) => total > 0 ? Math.round(n / total * 100) : 0;

  console.log(`\n┌─ ${vendor} ─────────────────────────`);
  console.log(`│  Before: ${s.before}  →  Removed: ${s.removed}  →  After: ${s.after}`);
  console.log(`│  Names fixed: ${s.namesFixed}  |  Descriptions fixed: ${s.descsFixed}`);
  console.log(`│  Images:  good=${s.goodImages} bad=${s.badImages} none=${s.noImages}`);
  console.log(`│  Data:    desc=${s.withDescription}(${pct(s.withDescription, s.after)}%) dims=${s.withDimensions}(${pct(s.withDimensions, s.after)}%) mat=${s.withMaterial}(${pct(s.withMaterial, s.after)}%)`);
  console.log(`│           price=${s.withPrice}(${pct(s.withPrice, s.after)}%) coll=${s.withCollection}(${pct(s.withCollection, s.after)}%) sku=${s.withSku}(${pct(s.withSku, s.after)}%)`);
  console.log(`│  Complete (desc+dims+mat): ${s.completeData}(${pct(s.completeData, s.after)}%)  Missing critical: ${s.missingCritical}`);
  console.log(`└──────────────────────────────────────`);
}

// Save cleaned catalog
console.log(`\nSaving cleaned catalog...`);
db.products = cleanedProducts;
writeFileSync(DB_PATH, JSON.stringify(db, null, 0));
console.log(`Saved ${cleanedProducts.length} products to ${DB_PATH}`);

// Final summary
console.log(`\n${"═".repeat(70)}`);
console.log(`FINAL CATALOG STATS`);
console.log(`${"═".repeat(70)}`);
let totalGoodImg = 0, totalBadImg = 0, totalNoImg = 0, totalComplete = 0, totalMissing = 0;
for (const s of Object.values(vendorStats)) {
  totalGoodImg += s.goodImages;
  totalBadImg += s.badImages;
  totalNoImg += s.noImages;
  totalComplete += s.completeData;
  totalMissing += s.missingCritical;
}
console.log(`Total products: ${cleanedProducts.length}`);
console.log(`Good images: ${totalGoodImg}`);
console.log(`Bad/missing images: ${totalBadImg + totalNoImg}`);
console.log(`Complete data (desc+dims+mat): ${totalComplete}`);
console.log(`Missing critical data: ${totalMissing}`);
