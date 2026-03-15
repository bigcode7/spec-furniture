#!/usr/bin/env node
/**
 * Full Catalog Crawl — Standalone CLI
 *
 * Systematically imports products from all trade vendors using the best
 * available method for each: Shopify API → Sitemap → Feed → Direct crawl.
 *
 * Usage:
 *   node src/jobs/full-catalog-crawl.mjs [--tier 1,2] [--vendors four-hands,noir] [--verify-images]
 *
 * After import: re-indexes vectors, optionally runs image verification.
 */

import { initCatalogDB, insertProducts, getAllProducts, getProductCount } from "../db/catalog-db.mjs";
import { runBulkImport, getImportStatus } from "../importers/bulk-importer.mjs";
import { initVectorStore, indexAllProducts } from "../lib/vector-store.mjs";
import { runImageVerification } from "./image-verifier.mjs";
import { buildAutocompleteIndex } from "../lib/autocomplete-index.mjs";

// Parse CLI args
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    const key = args[i].slice(2);
    flags[key] = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
    if (flags[key] !== true) i++;
  }
}

const maxTier = flags.tier ? Math.max(...String(flags.tier).split(",").map(Number)) : 2;
const vendorIds = flags.vendors ? String(flags.vendors).split(",").map(s => s.trim()) : null;
const verifyImages = flags["verify-images"] === true;

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Full Catalog Crawl");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Max tier: ${maxTier}`);
  if (vendorIds) console.log(`  Vendors: ${vendorIds.join(", ")}`);
  console.log(`  Verify images: ${verifyImages}`);
  console.log("");

  // Step 1: Init catalog DB
  console.log("[crawl] Initializing catalog database...");
  await initCatalogDB();
  const beforeCount = getProductCount();
  console.log(`[crawl] Catalog has ${beforeCount} products before import\n`);

  // Step 2: Create catalog interface for bulk importer
  const catalogInterface = {
    insertProducts: (products) => insertProducts(products),
    getAllProducts: () => getAllProducts(),
    getProductCount: () => getProductCount(),
    updateProductDirect: (id, fields) => {
      // Simple no-op for crawl — full updates happen via insertProducts
    },
  };

  // Step 3: Run bulk import
  console.log("[crawl] Starting bulk import (Shopify → Feeds → APIs → Sitemaps)...\n");
  const startTime = Date.now();

  try {
    await runBulkImport(catalogInterface, {
      vendor_ids: vendorIds || undefined,
      max_tier: maxTier,
      methods: ["shopify", "feed", "api", "sitemap"],
      concurrent_vendors: 3,
    });
  } catch (err) {
    console.error("[crawl] Bulk import error:", err.message);
  }

  const afterCount = getProductCount();
  const newProducts = afterCount - beforeCount;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n[crawl] Import complete in ${elapsed}s`);
  console.log(`[crawl] Added ${newProducts} new products (${beforeCount} → ${afterCount})\n`);

  // Step 4: Re-index vectors
  console.log("[crawl] Re-indexing vectors...");
  try {
    await initVectorStore();
    await indexAllProducts(getAllProducts(), { reindex: false });
    console.log("[crawl] Vector indexing complete\n");
  } catch (err) {
    console.error("[crawl] Vector indexing error:", err.message);
  }

  // Step 5: Rebuild autocomplete
  console.log("[crawl] Rebuilding autocomplete index...");
  buildAutocompleteIndex(getAllProducts());
  console.log("[crawl] Autocomplete index rebuilt\n");

  // Step 6: Optional image verification
  if (verifyImages) {
    console.log("[crawl] Running image verification...");
    try {
      const verifyResult = await runImageVerification(catalogInterface, {
        batchSize: 15,
        delayMs: 300,
        cacheImages: true,
      });
      console.log(`[crawl] Image verification: HQ:${verifyResult.verified_hq} OK:${verifyResult.verified} Broken:${verifyResult.broken}\n`);
    } catch (err) {
      console.error("[crawl] Image verification error:", err.message);
    }
  }

  // Final report
  const status = getImportStatus();
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Crawl Complete");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  Products: ${beforeCount} → ${afterCount} (+${newProducts})`);
  console.log(`  Time: ${elapsed}s`);
  if (status.progress) {
    console.log(`  Methods: ${JSON.stringify(status.progress)}`);
  }
  console.log("═══════════════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
