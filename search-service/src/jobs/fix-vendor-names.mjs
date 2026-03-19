#!/usr/bin/env node
/**
 * Fix Vendor Names — Assigns vendor_name to products missing it
 *
 * Matches products to vendors using:
 *  1. vendor_id field → look up name from trade-vendors registry
 *  2. vendor_domain field → match to known vendor domain
 *  3. product_url field → extract domain, match to vendor
 *  4. image_url field → match asset_hosts from vendor profiles
 *
 * Also removes products that can't be matched to any vendor
 * (these are likely garbage imports from boilerplate/template data).
 *
 * Usage:
 *   node src/jobs/fix-vendor-names.mjs              # Fix and report
 *   node src/jobs/fix-vendor-names.mjs --dry-run    # Report only
 *   node src/jobs/fix-vendor-names.mjs --delete-unmatched  # Delete products that can't be matched
 */

import { initCatalogDB, getAllProducts, insertProducts, getProductCount } from "../db/catalog-db.mjs";
import { tradeVendors } from "../config/trade-vendors.mjs";
import { priorityVendors } from "../config/vendors.mjs";

const LOG = "[fix-vendor-names]";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const deleteUnmatched = args.includes("--delete-unmatched");

// Build lookup maps
function buildVendorLookups() {
  const byId = new Map();
  const byDomain = new Map();
  const byAssetHost = new Map();

  for (const tv of tradeVendors) {
    byId.set(tv.id, tv);
    byDomain.set(tv.domain.replace(/^www\./, "").toLowerCase(), tv);
  }

  for (const pv of priorityVendors) {
    const tv = byId.get(pv.id) || { id: pv.id, name: pv.name };
    for (const host of pv.profile?.asset_hosts || []) {
      byAssetHost.set(host.replace(/^www\./, "").toLowerCase(), tv);
    }
    // Also add main domain
    byDomain.set(pv.domain.replace(/^www\./, "").toLowerCase(), tv);
  }

  return { byId, byDomain, byAssetHost };
}

function extractDomain(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  Fix Vendor Names");
  console.log("═══════════════════════════════════════════════════════\n");

  await initCatalogDB();
  const allProducts = getAllProducts();
  console.log(`Total products: ${allProducts.length}`);

  const { byId, byDomain, byAssetHost } = buildVendorLookups();

  // Find products missing vendor_name
  const noVendor = allProducts.filter(p => !p.vendor_name || p.vendor_name.trim() === "");
  console.log(`Products with no vendor_name: ${noVendor.length}\n`);

  if (noVendor.length === 0) {
    console.log("Nothing to fix!");
    return;
  }

  const fixed = [];
  const unmatched = [];
  const matchCounts = {};

  for (const product of noVendor) {
    let matched = null;

    // Method 1: vendor_id lookup
    if (product.vendor_id && byId.has(product.vendor_id)) {
      matched = byId.get(product.vendor_id);
    }

    // Method 2: vendor_domain lookup
    if (!matched && product.vendor_domain) {
      const domain = product.vendor_domain.replace(/^www\./, "").toLowerCase();
      if (byDomain.has(domain)) matched = byDomain.get(domain);
    }

    // Method 3: product_url domain
    if (!matched && product.product_url) {
      const domain = extractDomain(product.product_url);
      if (domain) {
        if (byDomain.has(domain)) matched = byDomain.get(domain);
        // Check if domain ends with a known vendor domain
        if (!matched) {
          for (const [knownDomain, vendor] of byDomain) {
            if (domain.endsWith(knownDomain)) {
              matched = vendor;
              break;
            }
          }
        }
      }
    }

    // Method 4: image_url asset host
    if (!matched && product.image_url) {
      const domain = extractDomain(product.image_url);
      if (domain) {
        if (byAssetHost.has(domain)) matched = byAssetHost.get(domain);
        if (!matched) {
          for (const [host, vendor] of byAssetHost) {
            if (domain.endsWith(host)) {
              matched = vendor;
              break;
            }
          }
        }
      }
    }

    // Method 5: check images array
    if (!matched && Array.isArray(product.images)) {
      for (const img of product.images) {
        const domain = extractDomain(img);
        if (domain && byAssetHost.has(domain)) {
          matched = byAssetHost.get(domain);
          break;
        }
      }
    }

    if (matched) {
      product.vendor_name = matched.name;
      product.vendor_id = product.vendor_id || matched.id;
      product.vendor_domain = product.vendor_domain || matched.domain;
      product.vendor_tier = product.vendor_tier || matched.tier || null;
      fixed.push(product);
      matchCounts[matched.name] = (matchCounts[matched.name] || 0) + 1;
    } else {
      unmatched.push(product);
    }
  }

  console.log(`Matched ${fixed.length} products to vendors:`);
  for (const [name, count] of Object.entries(matchCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count}`);
  }
  console.log(`\nUnmatched: ${unmatched.length} products`);

  if (unmatched.length > 0) {
    console.log("\nSample unmatched products:");
    for (const p of unmatched.slice(0, 10)) {
      console.log(`  - "${(p.product_name || "").slice(0, 50)}" | url: ${(p.product_url || "none").slice(0, 60)} | id: ${p.id}`);
    }
  }

  if (dryRun) {
    console.log("\n[DRY RUN] No changes saved.");
    return;
  }

  // Save fixed products
  if (fixed.length > 0) {
    console.log(`\nSaving ${fixed.length} fixed products...`);
    const result = insertProducts(fixed);
    console.log(`Updated: ${result.updated}, Inserted: ${result.inserted}`);
  }

  // Optionally delete unmatched
  if (deleteUnmatched && unmatched.length > 0) {
    console.log(`\nDeleting ${unmatched.length} unmatched products...`);
    // We need direct access to delete — use the catalog-db module
    const { deleteProduct } = await import("../db/catalog-db.mjs");
    let deleted = 0;
    for (const p of unmatched) {
      try {
        deleteProduct(p.id);
        deleted++;
      } catch { /* skip */ }
    }
    console.log(`Deleted: ${deleted} products`);
  }

  console.log(`\nDone! Catalog now has ${getProductCount()} products`);
}

main().catch((err) => {
  console.error(`${LOG} Fatal error:`, err);
  process.exit(1);
});
