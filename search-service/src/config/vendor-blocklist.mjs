/**
 * Vendor Blocklist — permanently blocked vendors that must never appear in the catalog.
 *
 * These vendors are blocked for business/licensing reasons. The blocklist is checked:
 *   1. During ingest (ingest.mjs) — products from blocked vendors are silently dropped
 *   2. During discovery (discover.mjs) — blocked vendor IDs are skipped
 *   3. During product insertion (catalog-db.mjs) — blocked vendor products are rejected
 *   4. On server startup — any existing products from blocked vendors are purged
 *
 * To add a vendor: add their vendor_id AND all name variations to the arrays below.
 * To remove a vendor from the blocklist: remove all their entries.
 */

// Canonical vendor IDs (slug form used in vendor_id field)
export const BLOCKED_VENDOR_IDS = new Set([
  "holly-hunt",
  "hollyhunt",
  "holly_hunt",
  "lee-industries",
  "leeindustries",
  "lee_industries",
  "fourhands",
  "four-hands",
  "four_hands",
  "visual-comfort",
  "visualcomfort",
  "visual_comfort",
  "loloi",
]);

// Human-readable names (matched case-insensitively against manufacturer_name, vendor_name)
const BLOCKED_VENDOR_NAMES = [
  "holly hunt",
  "hollyhunt",
  "lee industries",
  "four hands",
  "fourhands",
  "visual comfort",
  "loloi",
];

// Pre-compiled lowercase set for fast lookup
const _blockedNamesLower = new Set(BLOCKED_VENDOR_NAMES.map(n => n.toLowerCase()));

/**
 * Check if a vendor ID is blocked.
 */
export function isVendorBlocked(vendorId) {
  if (!vendorId) return false;
  return BLOCKED_VENDOR_IDS.has(vendorId.toLowerCase().trim());
}

/**
 * Check if a vendor name (manufacturer_name or vendor_name) is blocked.
 * Matches against all known name variations, case-insensitive.
 */
export function isVendorNameBlocked(name) {
  if (!name) return false;
  return _blockedNamesLower.has(name.toLowerCase().trim());
}

/**
 * Check if a product belongs to a blocked vendor by checking ALL identifier fields.
 * This is the most thorough check — use at ingestion boundaries.
 */
export function isProductBlocked(product) {
  if (!product) return false;
  return (
    isVendorBlocked(product.vendor_id) ||
    isVendorNameBlocked(product.vendor_name) ||
    isVendorNameBlocked(product.manufacturer_name)
  );
}
