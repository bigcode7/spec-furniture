/**
 * Vendor Blocklist — permanently blocked vendors that must never appear in the catalog.
 *
 * These vendors are blocked for business/licensing reasons. The blocklist is checked:
 *   1. During ingest (ingest.mjs) — products from blocked vendors are silently dropped
 *   2. During discovery (discover.mjs) — blocked vendor IDs are skipped
 *   3. During product insertion (catalog-db.mjs) — blocked vendor products are rejected
 *   4. On server startup — any existing products from blocked vendors are purged
 *
 * To add a vendor: add their vendor_id to BLOCKED_VENDOR_IDS below.
 * To remove a vendor from the blocklist: remove their ID.
 */

export const BLOCKED_VENDOR_IDS = new Set([
  "holly-hunt",
  "lee-industries",
  "fourhands",
  "visual-comfort",
  "loloi",
]);

/**
 * Check if a vendor ID is blocked.
 */
export function isVendorBlocked(vendorId) {
  if (!vendorId) return false;
  return BLOCKED_VENDOR_IDS.has(vendorId.toLowerCase());
}
