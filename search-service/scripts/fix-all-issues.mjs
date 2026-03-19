#!/usr/bin/env node
/**
 * Fix All Data Quality Issues
 *
 * 1. Clean Century product names (SKU prefixes + abbreviations)
 * 2. Check Century image URLs with HEAD requests
 * 3. Fix Universal secondary images (remove mismatched)
 * 4. Remove Stickley rug brochure + all non-products across catalog
 * 5. Remove Sherrill number-only SKU products
 *
 * Usage:
 *   node fix-all-issues.mjs               # dry run
 *   node fix-all-issues.mjs --apply       # apply fixes
 */

import fs from "node:fs";
import https from "node:https";
import http from "node:http";
import { loadCatalog, safeSave } from "./lib/safe-catalog-write.mjs";

const apply = process.argv.includes("--apply");
const DB_PATH = "./search-service/data/catalog.db.json";

// ── HEAD request helper ─────────────────────────────────────
function checkUrl(url, timeoutMs = 8000) {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith("https") ? https : http;
      const req = mod.request(url, { method: "HEAD", timeout: timeoutMs }, (res) => {
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
      });
      req.on("error", () => resolve({ ok: false, status: 0 }));
      req.on("timeout", () => { req.destroy(); resolve({ ok: false, status: 0 }); });
      req.end();
    } catch {
      resolve({ ok: false, status: 0 });
    }
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Century name cleaning ───────────────────────────────────
const ABBREVIATIONS = {
  "Strght": "Straight",
  "Strgt": "Straight",
  "W/": "With ",
  " Uph ": " Upholstered ",
  " Uph.": " Upholstered",
  "Uph ": "Upholstered ",
  " Sm ": " Small ",
  " Lg ": " Large ",
  " Sml ": " Small ",
  " Lrg ": " Large ",
  " Tbl": " Table",
  "Chrs": "Chairs",
  "Bkcs": "Bookcase",
  "Cktl": "Cocktail",
  "Rect ": "Rectangular ",
  "Rnd ": "Round ",
  "Stkng": "Stacking",
  " Adj ": " Adjustable ",
  "Adj ": "Adjustable ",
  " Bk ": " Back ",
  " Tp ": " Top ",
  " Wd ": " Wood ",
  " Mtl ": " Metal ",
  " Uphol ": " Upholstered ",
  " Flt ": " Flat ",
  " Swvl ": " Swivel ",
  " Sgl ": " Single ",
  " Dbl ": " Double ",
  " Ext ": " Extension ",
  " Lvs ": " Leaves ",
  " Drwr": " Drawer",
  " Dr ": " Door ",
  " Drs": " Doors",
  " Ht ": " Height ",
  " Lft ": " Left ",
  " Rt ": " Right ",
  " Ctr ": " Center ",
  " Cnr ": " Corner ",
  " Sq ": " Square ",
  "Btn": "Button",
  "Nailhd": "Nailhead",
  " Cs ": " Casters ",
  "/Casters": " With Casters",
  " Fin ": " Finish ",
  " Rtn ": " Return ",
  " Flr ": " Floor ",
  " Mir ": " Mirror ",
  " Wth ": " With ",
  " Pnl ": " Panel ",
  " Shp ": " Shape ",
  " Glss": " Glass",
};

// SKU prefix patterns for Century — match the full SKU before the product name dash
// Patterns seen: "3370-1C - Name", "AE-3361 - Name", "11-2126S - Name",
// "LR-1048-8 - Name", "PLR-6508-CHARCOAL - Name", "ES9-1335-8 - Name",
// "AE-11-1076 - Name", "AE-11-2007 - Name"
// Strategy: match everything before " - Name" if it looks like a SKU (alphanumeric with dashes)
const SKU_PREFIX = /^[A-Z0-9][-A-Z0-9]{1,20}\s*[-–—]\s+(?=[A-Z])/i;
// Fallback: patterns like "PLR-6508-CHARCOAL - " (all-caps before dash-space-uppercase)
const SKU_PREFIX2 = /^[A-Z0-9][-A-Z0-9]{3,25}\s*[-–—]\s+/;

function cleanCenturyName(name) {
  let cleaned = name;

  // Remove SKU prefix
  cleaned = cleaned.replace(SKU_PREFIX, "");
  cleaned = cleaned.replace(SKU_PREFIX2, "");

  // Apply abbreviation expansions
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    // Use case-insensitive replacement
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(escaped, "gi"), full);
  }

  // Clean up double spaces, leading/trailing whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Title case if ALL CAPS
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 3) {
    cleaned = cleaned.replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());
  }

  return cleaned;
}

// ── Non-product detection ───────────────────────────────────
function isNonProduct(product) {
  const name = (product.product_name || "").trim();

  // Too short
  if (name.length < 3) return "Name too short";

  // Only numbers/SKU (no letters or very few)
  if (/^[\d\s\-\.]+$/.test(name)) return "Name is only numbers/SKU";

  // Known non-product patterns
  const patterns = [
    [/\bbrochure\b/i, "Brochure"],
    [/\bcatalog\b(?!\s+(?:shelf|table|cabinet|stand|rack))/i, "Catalog"],
    [/\bswatch\s*(card|book)?\b/i, "Swatch"],
    [/\bfabric\s+sample\b/i, "Fabric sample"],
    [/\bfinish\s+sample\b/i, "Finish sample"],
    [/\bapplication\s+form\b/i, "Application form"],
    [/\blogin\b/i, "Login page"],
    [/\bbrowse\s+all\b/i, "Browse page"],
    [/\bview\s+all\b/i, "View all page"],
    [/^shop\s*\|/i, "Shop page"],
    [/^collection\s*\|/i, "Collection page"],
    [/\ball\s+products?\b/i, "All products page"],
    [/\bdealer\s+locator\b/i, "Dealer locator"],
    [/\bpress\s+release\b/i, "Press release"],
    [/\bnewsletter\b/i, "Newsletter"],
    [/\bgift\s+card\b/i, "Gift card"],
    [/\bwarranty\s+(registration|card|form)\b/i, "Warranty form"],
  ];

  for (const [pat, reason] of patterns) {
    if (pat.test(name)) return reason;
  }

  return null;
}

// ── Magazine pedestal / magazine rack are REAL products ──────
function isRealMagazineProduct(name) {
  const lower = name.toLowerCase();
  return lower.includes("magazine pedestal") ||
         lower.includes("magazine rack") ||
         lower.includes("magazine table") ||
         lower.includes("magazine stand") ||
         lower.includes("magazine cabinet");
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  FIX ALL DATA QUALITY ISSUES");
  console.log("═══════════════════════════════════════════════════════\n");

  const catalog = loadCatalog(DB_PATH);
  const data = catalog.data;
  let products = catalog.products;
  const vendorCounts = catalog.vendorCounts;
  data.products = products; // ensure array reference
  console.log(`Total products in catalog: ${products.length}\n`);

  // ────────────────────────────────────────────────────────────
  // 1. CENTURY NAME CLEANING
  // ────────────────────────────────────────────────────────────
  console.log("─── 1. CENTURY NAME CLEANING ───────────────────────\n");
  const century = products.filter(p => p.vendor_id === "century");
  let namesCleaned = 0;
  const nameSamples = [];

  for (const p of century) {
    const original = p.product_name;
    const cleaned = cleanCenturyName(original);
    if (cleaned !== original) {
      namesCleaned++;
      if (nameSamples.length < 20) {
        nameSamples.push({ before: original, after: cleaned });
      }
      if (apply) p.product_name = cleaned;
    }
  }

  console.log(`  Century products: ${century.length}`);
  console.log(`  Names that will be cleaned: ${namesCleaned}`);
  console.log("\n  Sample transformations:");
  for (const s of nameSamples) {
    console.log(`    "${s.before}"`);
    console.log(`    → "${s.after}"\n`);
  }

  // ────────────────────────────────────────────────────────────
  // 2. CENTURY IMAGE VERIFICATION
  // ────────────────────────────────────────────────────────────
  console.log("─── 2. CENTURY IMAGE VERIFICATION ──────────────────\n");
  const centuryWithImages = century.filter(p => p.image_url);
  console.log(`  Checking ${centuryWithImages.length} Century image URLs...`);

  // Check a sample first
  const sampleSize = Math.min(100, centuryWithImages.length);
  let brokenCount = 0;
  const brokenUrls = [];

  for (let i = 0; i < sampleSize; i++) {
    const p = centuryWithImages[i];
    const result = await checkUrl(p.image_url);
    if (!result.ok) {
      brokenCount++;
      brokenUrls.push({ name: p.product_name, url: p.image_url, status: result.status });
    }
    if ((i + 1) % 25 === 0) process.stdout.write(`  Checked ${i + 1}/${sampleSize}...\r`);
    await sleep(100); // rate limit
  }

  const brokenPercent = ((brokenCount / sampleSize) * 100).toFixed(1);
  console.log(`\n  Sample of ${sampleSize}: ${brokenCount} broken (${brokenPercent}%)`);
  if (brokenUrls.length > 0) {
    console.log("  Broken samples:");
    for (const b of brokenUrls.slice(0, 10)) {
      console.log(`    [${b.status}] ${b.name} → ${b.url}`);
    }
  }

  if (brokenCount / sampleSize > 0.20) {
    console.log("\n  ⚠ >20% broken — Century images need re-scraping");
  } else {
    console.log(`\n  ✓ ${brokenPercent}% broken — within acceptable range`);
  }

  // ────────────────────────────────────────────────────────────
  // 3. UNIVERSAL SECONDARY IMAGES
  // ────────────────────────────────────────────────────────────
  console.log("\n─── 3. UNIVERSAL SECONDARY IMAGES ──────────────────\n");
  const universal = products.filter(p => p.vendor_id === "universal");
  const withSecondary = universal.filter(p => p.images && Array.isArray(p.images) && p.images.length > 1);
  console.log(`  Universal products: ${universal.length}`);
  console.log(`  With secondary images: ${withSecondary.length}`);

  // Check for cross-product image contamination
  // Universal images use URLs like: .../rrd U330040_front.jpg
  // If secondary images contain different product codes, they're wrong
  let universalFixed = 0;
  const universalSamples = [];

  for (const p of withSecondary) {
    const heroUrl = p.image_url || "";
    // Extract product code from hero URL
    const heroMatch = heroUrl.match(/[\/\s]([A-Z]?\d{5,8}(?:_\w+)?)\.\w+$/i);
    const heroCode = heroMatch ? heroMatch[1].replace(/_\w+$/, "") : null;

    if (!heroCode) continue;

    const originalCount = p.images.length;
    // Keep only images that match the hero product code
    const filtered = p.images.filter(img => {
      const imgUrl = typeof img === "string" ? img : img.url;
      if (!imgUrl) return false;
      // Same URL as hero is fine
      if (imgUrl === heroUrl) return true;
      // Different resolution of same product is fine
      const imgMatch = imgUrl.match(/[\/\s]([A-Z]?\d{5,8}(?:_\w+)?)\.\w+$/i);
      const imgCode = imgMatch ? imgMatch[1].replace(/_\w+$/, "") : null;
      // Keep if same product code OR no code extractable (could be valid)
      if (!imgCode) return true;
      return imgCode === heroCode;
    });

    if (filtered.length < originalCount) {
      const removed = originalCount - filtered.length;
      universalFixed++;
      if (universalSamples.length < 10) {
        universalSamples.push({
          name: p.product_name,
          heroCode,
          before: originalCount,
          after: filtered.length,
          removed,
        });
      }
      if (apply) {
        p.images = filtered.length > 0 ? filtered : [{ url: heroUrl, type: "hero", priority: 1 }];
      }
    }
  }

  console.log(`  Products with mismatched secondary images: ${universalFixed}`);
  if (universalSamples.length > 0) {
    console.log("  Samples:");
    for (const s of universalSamples) {
      console.log(`    ${s.name} (code: ${s.heroCode}): ${s.before} → ${s.after} images (removed ${s.removed})`);
    }
  }

  // ────────────────────────────────────────────────────────────
  // 4. NON-PRODUCT CLEANUP (FULL CATALOG)
  // ────────────────────────────────────────────────────────────
  console.log("\n─── 4. NON-PRODUCT CLEANUP ─────────────────────────\n");

  const toRemove = [];
  for (const p of products) {
    const name = (p.product_name || "").trim();

    // Skip real magazine furniture
    if (isRealMagazineProduct(name)) continue;

    const reason = isNonProduct(p);
    if (reason) {
      toRemove.push({ id: p.id, name: p.product_name, vendor: p.vendor_id || p.vendor_name, reason, url: p.product_url });
    }
  }

  // Stickley brochure specifically
  const stickyBrochure = products.find(p => p.vendor_id === "stickley" && (p.product_name || "").toLowerCase().includes("brochure"));
  if (stickyBrochure && !toRemove.find(r => r.id === stickyBrochure.id)) {
    toRemove.push({ id: stickyBrochure.id, name: stickyBrochure.product_name, vendor: "stickley", reason: "Brochure", url: stickyBrochure.product_url });
  }

  // Group by vendor for display
  const byVendor = {};
  for (const item of toRemove) {
    if (!byVendor[item.vendor]) byVendor[item.vendor] = [];
    byVendor[item.vendor].push(item);
  }

  console.log(`  Total non-products to remove: ${toRemove.length}\n`);
  for (const [vendor, items] of Object.entries(byVendor).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${vendor} (${items.length}):`);
    for (const item of items) {
      console.log(`    [${item.reason}] "${item.name}" | ${item.url || "no url"}`);
    }
    console.log();
  }

  if (apply) {
    const removeIds = new Set(toRemove.map(r => r.id));
    const before = products.length;
    products = products.filter(p => !removeIds.has(p.id));
    data.products = products;
    console.log(`  Removed ${before - products.length} non-products`);
  }

  // ────────────────────────────────────────────────────────────
  // 5. SUMMARY
  // ────────────────────────────────────────────────────────────
  console.log("\n─── SUMMARY ────────────────────────────────────────\n");
  console.log(`  Century names cleaned: ${namesCleaned}`);
  console.log(`  Century broken images: ${brokenCount}/${sampleSize} sample (${brokenPercent}%)`);
  console.log(`  Universal images fixed: ${universalFixed}`);
  console.log(`  Non-products removed: ${toRemove.length}`);
  console.log(`  Final product count: ${products.length}`);

  if (apply) {
    console.log("\n  Writing updated catalog...");
    safeSave(data, products, vendorCounts, { dbPath: DB_PATH });
    console.log("  ✓ Catalog saved");
  } else {
    console.log("\n  [DRY RUN] Use --apply to write changes");
  }

  console.log("\n═══════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
