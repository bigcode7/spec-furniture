#!/usr/bin/env node
/**
 * Fix Shared Images — Removes incorrectly shared images from products.
 *
 * When multiple products share the same image_url, it means the image
 * was pulled from a category page listing rather than the individual
 * product page. Better to show no image than a wrong one.
 *
 * Usage:
 *   node fix-shared-images.mjs               # dry run
 *   node fix-shared-images.mjs --apply       # apply fixes
 */

import { initCatalogDB, getProductCount, insertProducts } from "../db/catalog-db.mjs";

const apply = process.argv.includes("--apply");

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Fix Shared Images");
  console.log("═══════════════════════════════════════════════════════\n");

  await initCatalogDB();

  // Load raw data
  const fs = await import("fs");
  const data = JSON.parse(fs.readFileSync("./search-service/data/catalog.db.json", "utf8"));

  // Build image usage counts
  const imgCount = {};
  for (const p of data.products) {
    if (p.image_url) {
      if (imgCount[p.image_url] === undefined) imgCount[p.image_url] = [];
      imgCount[p.image_url].push(p.id);
    }
  }

  // Find shared images (used by 2+ products)
  const sharedImages = new Set();
  for (const [img, ids] of Object.entries(imgCount)) {
    if (ids.length > 1) sharedImages.add(img);
  }

  console.log(`  Shared images found: ${sharedImages.size}`);

  // Count affected products by vendor
  const vendorCounts = {};
  const toFix = [];
  for (const p of data.products) {
    if (p.image_url && sharedImages.has(p.image_url)) {
      const vendor = p.vendor_name || p.vendor_id || "unknown";
      vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
      toFix.push(p);
    }
  }

  console.log(`  Products with shared images: ${toFix.length}\n`);
  console.log("  By vendor:");
  for (const [vendor, count] of Object.entries(vendorCounts).sort((a, b) => b - a)) {
    console.log(`    ${vendor.padEnd(30)} ${count}`);
  }

  if (!apply) {
    console.log("\n  [DRY RUN] Use --apply to null out shared images");
    return;
  }

  // Null out shared images
  let fixed = 0;
  for (const p of toFix) {
    p.image_url = null;
    // Also remove from images array if it was the shared one
    if (p.images && Array.isArray(p.images)) {
      p.images = p.images.filter(img => !sharedImages.has(img));
    }
    fixed++;
  }

  // Write back using safe utility
  const { safeSave, loadCatalog } = await import("../../scripts/lib/safe-catalog-write.mjs");
  const snapshot = {};
  for (const p of data.products) {
    const v = p.vendor_id || "unknown";
    snapshot[v] = (snapshot[v] || 0) + 1;
  }
  safeSave(data, data.products, snapshot, { dbPath: "./search-service/data/catalog.db.json" });
  console.log(`\n  Fixed: ${fixed} products — shared images removed`);
  console.log(`  Catalog still has ${data.products.length} products`);
  console.log("  Run batch scraper to re-populate correct per-product images");

  console.log("\n═══════════════════════════════════════════════════════\n");
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
