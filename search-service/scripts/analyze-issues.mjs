#!/usr/bin/env node
/**
 * Analyze data quality issues across the catalog.
 */
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync("./search-service/data/catalog.db.json", "utf8"));
const products = data.products;

console.log("Total products:", products.length);

// === CENTURY ===
const century = products.filter(p => p.vendor_id === "century");
console.log("\n=== CENTURY STATS ===");
console.log("Total:", century.length);

// Sample names
console.log("\nSample names (first 15):");
century.slice(0, 15).forEach(p => console.log("  " + p.product_name));

// Count with SKU prefix pattern
const skuPattern = /^\d{2,5}-\d{1,3}[A-Z]?\s*[-–]\s*/;
const hasSkuPrefix = century.filter(p => skuPattern.test(p.product_name));
console.log("\nWith SKU prefix:", hasSkuPrefix.length, "/", century.length);

// Count with abbreviations
const abbrevPatterns = ["Strght", "W/", " Uph ", "Uph.", " Sm ", " Lg ", " Tbl", "Chrs", "Bkcs", "Cktl", "Rect ", "Rnd ", "Stkng", " Adj "];
let abCount = 0;
for (const p of century) {
  if (abbrevPatterns.some(a => p.product_name.includes(a))) abCount++;
}
console.log("With abbreviations:", abCount);

// Check images
const noImage = century.filter(p => !p.image_url);
console.log("\nNo image_url:", noImage.length);
const withImage = century.filter(p => !!p.image_url);
console.log("With image_url:", withImage.length);

// Check dimensions
const hasDims = century.filter(p => p.dimensions || p.width || p.depth || p.height);
console.log("Has dimensions:", hasDims.length);

// Check descriptions
const hasDesc = century.filter(p => p.description && p.description.length > 10);
console.log("Has description:", hasDesc.length);

// Check materials
const hasMat = century.filter(p => !!p.material);
console.log("Has material:", hasMat.length);

// Sample image URLs
console.log("\nSample image URLs:");
withImage.slice(0, 5).forEach(p => console.log("  " + p.image_url));

// === SURYA ===
const surya = products.filter(p => p.vendor_id === "surya" || (p.vendor_name || "").toLowerCase().includes("surya"));
console.log("\n=== SURYA ===");
console.log("Products in catalog:", surya.length);

// === UNIVERSAL ===
const universal = products.filter(p => p.vendor_id === "universal");
console.log("\n=== UNIVERSAL FURNITURE ===");
console.log("Total:", universal.length);
const withSecondary = universal.filter(p => p.images && Array.isArray(p.images) && p.images.length > 0);
console.log("With secondary images array:", withSecondary.length);
// Sample
if (withSecondary.length > 0) {
  console.log("\nSample product with images:");
  const sample = withSecondary[0];
  console.log("  Name:", sample.product_name);
  console.log("  Hero:", sample.image_url);
  console.log("  Images array:", JSON.stringify(sample.images, null, 2).slice(0, 500));
}

// === STICKLEY ===
const stickley = products.filter(p => p.vendor_id === "stickley");
console.log("\n=== STICKLEY ===");
console.log("Total:", stickley.length);
// Check for magazine/catalog
const stickyMag = stickley.filter(p => {
  const name = (p.product_name || "").toLowerCase();
  return name.includes("magazine") || name.includes("catalog") || name.includes("brochure") || name.includes("rug");
});
if (stickyMag.length > 0) {
  console.log("Suspicious items:");
  stickyMag.forEach(p => console.log("  [" + p.id + "] " + p.product_name + " | " + p.product_url));
}

// === GLOBAL NON-PRODUCT SCAN ===
console.log("\n=== NON-PRODUCT SCAN ===");
const badPatterns = [
  /magazine/i, /catalog(?!\s*\w)/i, /brochure/i, /swatch/i,
  /\bsample\b/i, /application form/i, /login/i, /browse all/i,
  /view all/i, /shop \|/i, /collection \|/i, /\ball products\b/i,
  /dealer locator/i, /press release/i, /blog post/i, /news article/i,
];

const suspects = [];
for (const p of products) {
  const name = p.product_name || "";

  // Name too short
  if (name.length < 3) {
    suspects.push({ reason: "Name too short (<3 chars)", ...p });
    continue;
  }

  // Name is only a number/SKU
  if (/^[\d\s\-\.]+$/.test(name.trim())) {
    suspects.push({ reason: "Name is only numbers/SKU", ...p });
    continue;
  }

  // Check patterns
  for (const pat of badPatterns) {
    if (pat.test(name)) {
      suspects.push({ reason: `Matches pattern: ${pat}`, ...p });
      break;
    }
  }
}

console.log("Suspicious items found:", suspects.length);
// Group by vendor
const byVendor = {};
for (const s of suspects) {
  const v = s.vendor_id || s.vendor_name || "unknown";
  if (!byVendor[v]) byVendor[v] = [];
  byVendor[v].push(s);
}
for (const [vendor, items] of Object.entries(byVendor).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${vendor} (${items.length}):`);
  for (const item of items) {
    console.log(`    [${item.reason}] "${item.product_name}" | ${item.product_url || "no URL"}`);
  }
}
