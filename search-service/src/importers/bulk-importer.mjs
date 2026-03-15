/**
 * Bulk Import Orchestrator
 *
 * Coordinates all 5 import methods across all vendors:
 *   1. Shopify API     — fastest, gets full catalog as JSON
 *   2. Product Feeds   — fast, standardized XML data
 *   3. Vendor APIs     — fast, structured JSON
 *   4. Sitemaps        — slower but comprehensive
 *   5. CSV upload      — manual fallback
 *
 * Runs methods in priority order. For each vendor, the first method
 * that yields results is used; remaining methods supplement with
 * any products not already discovered.
 */

import { priorityVendors } from "../config/vendors.mjs";
import { tradeVendors } from "../config/trade-vendors.mjs";
import { importFromShopify, importAllShopify, getShopifyProgress, clearShopifyProgress } from "./shopify-importer.mjs";
import { importFromFeed, importAllFeeds, getFeedProgress, clearFeedProgress } from "./feed-importer.mjs";
import { importFromApi, importAllApis, getApiProgress, clearApiProgress } from "./api-importer.mjs";
import { importFromSitemap, importAllSitemaps, getSitemapProgress, clearSitemapProgress } from "./sitemap-importer.mjs";
import { getCsvProgress } from "./csv-importer.mjs";

// ── Import state ─────────────────────────────────────────────

let importRunning = false;
let importProgress = null;

export function getImportStatus() {
  return {
    running: importRunning,
    progress: importProgress,
    methods: {
      shopify: getShopifyProgress(),
      feed: getFeedProgress(),
      api: getApiProgress(),
      sitemap: getSitemapProgress(),
      csv: getCsvProgress(),
    },
  };
}

// ── Vendor resolution ────────────────────────────────────────

/**
 * Build unified vendor list with profiles from priorityVendors
 * and tier/category data from tradeVendors.
 */
function getUnifiedVendors(vendorIds = null, maxTier = 4) {
  const profileMap = new Map();
  for (const v of priorityVendors) {
    profileMap.set(v.id, v);
  }

  let vendors = tradeVendors
    .filter((tv) => tv.tier <= maxTier)
    .map((tv) => {
      const profile = profileMap.get(tv.id);
      return {
        id: tv.id,
        name: tv.name,
        domain: tv.domain,
        tier: tv.tier,
        categories: tv.categories || [],
        profile: profile?.profile || {},
        discovery: profile?.discovery || {},
        shopify_domain: profile?.shopify_domain || null,
        shopify_collections: profile?.shopify_collections || [],
        flat_product_urls: profile?.flat_product_urls || false,
      };
    });

  if (vendorIds && vendorIds.length > 0) {
    const idSet = new Set(vendorIds);
    vendors = vendors.filter((v) => idSet.has(v.id));
  }

  // Sort by tier (highest priority first)
  vendors.sort((a, b) => a.tier - b.tier);

  return vendors;
}

// ── Single vendor import ─────────────────────────────────────

/**
 * Import products from a single vendor using all available methods.
 * Methods run in priority order; each contributes unique products.
 */
export async function importVendor(vendor, catalogDB, methods = ["shopify", "feed", "api", "sitemap"]) {
  const vendorResult = {
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    tier: vendor.tier,
    methods_tried: [],
    methods_succeeded: [],
    total_products: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
  };

  for (const method of methods) {
    let result;

    try {
      switch (method) {
        case "shopify":
          result = await importFromShopify(vendor, catalogDB);
          vendorResult.methods_tried.push("shopify");
          if (result.products_found > 0) {
            vendorResult.methods_succeeded.push({ method: "shopify", products: result.products_found });
            vendorResult.total_products += result.products_found;
          }
          break;

        case "feed":
          result = await importFromFeed(vendor, catalogDB);
          vendorResult.methods_tried.push("feed");
          if (result.products_found > 0) {
            vendorResult.methods_succeeded.push({ method: "feed", products: result.products_found });
            vendorResult.total_products += result.products_found;
          }
          break;

        case "api":
          result = await importFromApi(vendor, catalogDB);
          vendorResult.methods_tried.push("api");
          if (result.products_found > 0) {
            vendorResult.methods_succeeded.push({ method: "api", products: result.products_found });
            vendorResult.total_products += result.products_found;
          }
          break;

        case "sitemap":
          result = await importFromSitemap(vendor, catalogDB);
          vendorResult.methods_tried.push("sitemap");
          if (result.products_found > 0) {
            vendorResult.methods_succeeded.push({ method: "sitemap", products: result.products_found });
            vendorResult.total_products += result.products_found;
          }
          break;
      }
    } catch (err) {
      console.error(`[bulk-import] ${vendor.name} ${method} error:`, err.message);
    }

    // If we got a large batch from a fast method, skip slower methods
    if (vendorResult.total_products >= 100 && (method === "shopify" || method === "feed")) {
      break;
    }
  }

  vendorResult.completed_at = new Date().toISOString();
  return vendorResult;
}

// ── Bulk import all vendors ──────────────────────────────────

/**
 * Run the full bulk import across all vendors.
 *
 * @param {object} catalogDB - { insertProducts, getProductCount, ... }
 * @param {object} options - { vendor_ids?, max_tier?, methods?, concurrent_vendors? }
 * @returns {Promise<object>} Import results
 */
export async function runBulkImport(catalogDB, options = {}) {
  if (importRunning) {
    return { error: "Import already running", status: getImportStatus() };
  }

  importRunning = true;
  const startTime = Date.now();
  const startProductCount = catalogDB.getProductCount();

  const vendors = getUnifiedVendors(
    options.vendor_ids || null,
    options.max_tier ?? 4,
  );
  const methods = options.methods || ["shopify", "feed", "api", "sitemap"];
  const concurrentVendors = options.concurrent_vendors || 2;

  importProgress = {
    status: "running",
    vendors_total: vendors.length,
    vendors_completed: 0,
    products_before: startProductCount,
    products_after: startProductCount,
    vendor_results: [],
    started_at: new Date().toISOString(),
    completed_at: null,
    errors: [],
  };

  console.log(`[bulk-import] Starting import for ${vendors.length} vendors using methods: ${methods.join(", ")}`);

  try {
    // Process vendors with controlled concurrency
    let idx = 0;

    async function vendorWorker() {
      while (idx < vendors.length) {
        const vendor = vendors[idx++];

        try {
          const result = await importVendor(vendor, catalogDB, methods);
          // Store only lightweight summary to prevent memory buildup
          importProgress.vendor_results.push({
            vendor_id: result.vendor_id,
            vendor_name: result.vendor_name,
            tier: result.tier,
            total_products: result.total_products,
            methods_succeeded: result.methods_succeeded,
          });
          importProgress.vendors_completed++;
          importProgress.products_after = catalogDB.getProductCount();

          if (result.total_products > 0) {
            console.log(`[bulk-import] ${vendor.name}: ${result.total_products} products via ${result.methods_succeeded.map((m) => m.method).join("+") || "none"}`);
          }

          // Clear per-method progress maps to free memory from completed vendors
          clearShopifyProgress();
          clearFeedProgress();
          clearApiProgress();
          clearSitemapProgress();

          // Hint GC between vendors to prevent memory buildup
          if (global.gc) global.gc();
        } catch (err) {
          importProgress.errors.push({ vendor: vendor.id, error: err.message });
          importProgress.vendors_completed++;
        }
      }
    }

    const workers = [];
    for (let w = 0; w < Math.min(concurrentVendors, vendors.length); w++) {
      workers.push(vendorWorker());
    }
    await Promise.all(workers);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const newProducts = catalogDB.getProductCount() - startProductCount;

    importProgress.status = "completed";
    importProgress.products_after = catalogDB.getProductCount();
    importProgress.completed_at = new Date().toISOString();

    console.log(`[bulk-import] Complete: ${newProducts} new products added in ${elapsed}s (total: ${catalogDB.getProductCount()})`);

    return {
      ok: true,
      vendors_processed: vendors.length,
      products_before: startProductCount,
      products_after: catalogDB.getProductCount(),
      new_products: newProducts,
      elapsed_seconds: parseFloat(elapsed),
      vendor_results: importProgress.vendor_results,
      errors: importProgress.errors,
    };
  } catch (err) {
    importProgress.status = "error";
    importProgress.completed_at = new Date().toISOString();
    console.error("[bulk-import] Fatal error:", err.message);
    return { ok: false, error: err.message };
  } finally {
    importRunning = false;
  }
}
