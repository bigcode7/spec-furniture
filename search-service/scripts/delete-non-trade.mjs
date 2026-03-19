#!/usr/bin/env node
/**
 * Delete non-trade products from catalog.
 *
 * SAFETY: Now requires --force-delete-vendor=<name> for each vendor being removed.
 * Will NOT silently wipe vendors.
 *
 * Usage:
 *   node delete-non-trade.mjs                                      # dry run
 *   node delete-non-trade.mjs --apply --force-delete-vendor=xxx    # apply
 */

import { loadCatalog, safeSave, parseForceDeleteVendors } from "./lib/safe-catalog-write.mjs";

const apply = process.argv.includes("--apply");
const forceDeleteVendors = parseForceDeleteVendors();

const KEEP = new Set([
  'bernhardt', 'hooker', 'century', 'universal', 'vanguard',
  'cr-laine', 'lee-industries', 'sherrill', 'wesley-hall',
  'hancock-moore', 'hickory-chair', 'highland-house',
  'lexington', 'theodore-alexander', 'baker', 'caracole',
  'stickley', 'rowe', 'norwalk', 'surya', 'gabby',
]);

const { data, products, vendorCounts } = loadCatalog();

const kept = products.filter(p => KEEP.has(p.vendor_id));
const removed = products.filter(p => !KEEP.has(p.vendor_id));

const removedByVendor = {};
for (const p of removed) {
  const v = p.vendor_id || "unknown";
  removedByVendor[v] = (removedByVendor[v] || 0) + 1;
}

console.log(`Before: ${products.length}`);
console.log(`Kept: ${kept.length}`);
console.log(`Would remove: ${removed.length}`);
for (const [v, c] of Object.entries(removedByVendor)) {
  const forced = forceDeleteVendors.has(v) ? " ✓ authorized" : " ✕ NOT AUTHORIZED";
  console.log(`  ${v}: ${c}${forced}`);
}

if (apply) {
  safeSave(data, kept, vendorCounts, { forceDeleteVendors });
} else {
  console.log("\n[DRY RUN] Use --apply to write changes");
}
