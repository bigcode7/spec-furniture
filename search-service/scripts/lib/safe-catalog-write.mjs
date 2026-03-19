/**
 * Safe Catalog Write Utility
 *
 * Wraps catalog.db.json writes with safety checks:
 * 1. Creates a backup before writing
 * 2. Validates no vendors were accidentally wiped
 * 3. Validates total product count didn't drop by >500 unexpectedly
 * 4. Requires --force-delete-vendor=<name> to allow vendor wipes
 *
 * Usage:
 *   import { loadCatalog, safeSave } from "./lib/safe-catalog-write.mjs";
 *   const { data, products } = loadCatalog();
 *   // ... modify products ...
 *   safeSave(data, products);
 */

import fs from "node:fs";
import path from "node:path";

const DEFAULT_DB_PATH = "./search-service/data/catalog.db.json";

/**
 * Load catalog and take a vendor snapshot.
 */
export function loadCatalog(dbPath = DEFAULT_DB_PATH) {
  const raw = fs.readFileSync(dbPath, "utf8");
  const data = JSON.parse(raw);
  const products = Array.isArray(data.products) ? data.products : Object.values(data.products || {});

  // Snapshot vendor counts at load time
  const vendorCounts = {};
  for (const p of products) {
    const v = p.vendor_id || "unknown";
    vendorCounts[v] = (vendorCounts[v] || 0) + 1;
  }

  return { data, products, vendorCounts, dbPath };
}

/**
 * Safely write catalog back to disk.
 *
 * @param {object} data - The full catalog data object
 * @param {Array} newProducts - The new products array
 * @param {object} vendorCounts - Vendor counts from loadCatalog()
 * @param {object} opts
 * @param {string} opts.dbPath - Path to catalog file
 * @param {Set<string>} opts.forceDeleteVendors - Vendors allowed to be wiped
 * @param {boolean} opts.allowMassDeletion - Skip the >500 drop check
 */
export function safeSave(data, newProducts, vendorCounts, opts = {}) {
  const dbPath = opts.dbPath || DEFAULT_DB_PATH;
  const forceDeleteVendors = opts.forceDeleteVendors || new Set();
  const allowMassDeletion = opts.allowMassDeletion || false;

  // Count new vendor distribution
  const newCounts = {};
  for (const p of newProducts) {
    const v = p.vendor_id || "unknown";
    newCounts[v] = (newCounts[v] || 0) + 1;
  }

  const errors = [];

  // Check for wiped vendors
  for (const [vendor, prevCount] of Object.entries(vendorCounts)) {
    const newCount = newCounts[vendor] || 0;
    if (prevCount >= 10 && newCount === 0 && !forceDeleteVendors.has(vendor)) {
      errors.push(`VENDOR WIPED: "${vendor}" had ${prevCount} products, now has 0. Use --force-delete-vendor=${vendor} to allow.`);
    }
  }

  // Check total drop
  const prevTotal = Object.values(vendorCounts).reduce((a, b) => a + b, 0);
  const newTotal = newProducts.length;
  const dropped = prevTotal - newTotal;
  if (dropped > 500 && !allowMassDeletion) {
    errors.push(`MASS DELETION: ${dropped} products lost (${prevTotal} → ${newTotal}). Use --allow-mass-deletion to override.`);
  }

  if (errors.length > 0) {
    console.error("\n⚠ SAFETY CHECK FAILED — write blocked:\n");
    for (const e of errors) console.error(`  ✕ ${e}`);
    console.error(`\nCatalog file was NOT modified.\n`);
    process.exit(1);
  }

  // Create backup
  const backupDir = path.join(path.dirname(dbPath), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `catalog.backup-${timestamp}.json`);

  // Only keep last 5 backups to avoid filling disk
  try {
    const existing = fs.readdirSync(backupDir).filter(f => f.startsWith("catalog.backup-")).sort();
    while (existing.length >= 5) {
      fs.unlinkSync(path.join(backupDir, existing.shift()));
    }
  } catch { /* ignore */ }

  fs.copyFileSync(dbPath, backupPath);
  console.log(`  Backup: ${backupPath}`);

  // Write
  data.products = newProducts;
  data.product_count = newProducts.length;
  data.saved_at = new Date().toISOString();
  fs.writeFileSync(dbPath, JSON.stringify(data));

  // Summary
  console.log(`  Saved ${newProducts.length} products (was ${prevTotal})`);
  if (dropped > 0) console.log(`  Removed: ${dropped}`);
  if (newTotal > prevTotal) console.log(`  Added: ${newTotal - prevTotal}`);

  // Show vendor changes
  for (const [vendor, prevCount] of Object.entries(vendorCounts)) {
    const newCount = newCounts[vendor] || 0;
    if (newCount !== prevCount) {
      console.log(`    ${vendor}: ${prevCount} → ${newCount} (${newCount >= prevCount ? "+" : ""}${newCount - prevCount})`);
    }
  }
  // New vendors
  for (const [vendor, count] of Object.entries(newCounts)) {
    if (!(vendor in vendorCounts)) {
      console.log(`    ${vendor}: 0 → ${count} (NEW)`);
    }
  }
}

/**
 * Parse --force-delete-vendor=<name> flags from process.argv.
 */
export function parseForceDeleteVendors() {
  const vendors = new Set();
  for (const arg of process.argv) {
    const m = arg.match(/^--force-delete-vendor=(.+)$/);
    if (m) vendors.add(m[1]);
  }
  return vendors;
}
