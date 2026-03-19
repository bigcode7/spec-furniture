#!/usr/bin/env node
/**
 * Clean catalog to trade-only vendors.
 *
 * SAFETY: Now requires --force-delete-vendor=<name> for each vendor being removed.
 * Will NOT silently wipe vendors that aren't in the KEEP list.
 *
 * Usage:
 *   node clean-to-trade-only.mjs                                    # dry run
 *   node clean-to-trade-only.mjs --apply --force-delete-vendor=xxx  # apply with explicit vendor removal
 */

import { loadCatalog, safeSave, parseForceDeleteVendors } from "./lib/safe-catalog-write.mjs";
import { tradeVendors } from "../src/config/trade-vendors.mjs";

const apply = process.argv.includes("--apply");
const forceDeleteVendors = parseForceDeleteVendors();

// KEEP set derived from trade-vendors.mjs — single source of truth
const KEEP = new Set(tradeVendors.map(v => v.id));

const { data, products, vendorCounts } = loadCatalog();

const kept = products.filter(p => KEEP.has(p.vendor_id));
const removed = products.filter(p => !KEEP.has(p.vendor_id));

// Group removals by vendor
const removedByVendor = {};
for (const p of removed) {
  const v = p.vendor_id || "unknown";
  removedByVendor[v] = (removedByVendor[v] || 0) + 1;
}

console.log(`Before: ${products.length}`);
console.log(`Kept: ${kept.length} (${KEEP.size} target vendors)`);
console.log(`Would remove: ${removed.length}`);
for (const [v, c] of Object.entries(removedByVendor).sort((a, b) => b - a)) {
  const forced = forceDeleteVendors.has(v) ? " ✓ --force-delete-vendor" : " ✕ NOT AUTHORIZED";
  console.log(`  ${v}: ${c}${forced}`);
}

if (apply) {
  safeSave(data, kept, vendorCounts, { forceDeleteVendors });
} else {
  console.log("\n[DRY RUN] Use --apply to write changes");
}
