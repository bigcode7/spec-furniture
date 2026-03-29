/**
 * Admin Store — persistent data store for health checks, comp logs,
 * activity logs, and alerts.
 *
 * In-memory data backed by a JSON file on disk, following the same
 * pattern as subscription-store.mjs.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isVendorBlocked, isProductBlocked } from "../config/vendor-blocklist.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const STORE_FILE = path.join(DATA_DIR, "admin-store.json");

const MAX_ACTIVITY_LOG = 500;
const ALERT_RETENTION_DAYS = 30;

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
let store = {
  compLog: [],        // { id, user_id, email, days, note, comped_at, expires_at }
  activityLog: [],    // { id, action, target, details, timestamp }
  healthChecks: {},   // keyed by vendor_id
  healthAlerts: [],   // { id, severity, vendor_id, message, created_at, dismissed, auto_fixable }
  lastHealthRun: null,
  vendorSnapshots: {} // keyed by vendor_id → { product_count, timestamp }
};

// ---------------------------------------------------------------------------
// Load / save helpers
// ---------------------------------------------------------------------------
function loadJSON(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch { /* ignore */ }
  return null;
}

function saveJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("[admin-store] save error:", e.message);
  }
}

let saveTimer = null;

function persistAdminStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveJSON(STORE_FILE, store), 2000);
}

function initAdminStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const loaded = loadJSON(STORE_FILE);
  if (loaded) {
    store.compLog = loaded.compLog || [];
    store.activityLog = loaded.activityLog || [];
    store.healthChecks = loaded.healthChecks || {};
    store.healthAlerts = loaded.healthAlerts || [];
    store.lastHealthRun = loaded.lastHealthRun || null;
    store.vendorSnapshots = loaded.vendorSnapshots || {};
  }
  console.log(
    `[admin-store] loaded — ${store.compLog.length} comps, ` +
    `${store.activityLog.length} activity entries, ` +
    `${store.healthAlerts.length} alerts`
  );
}

// ---------------------------------------------------------------------------
// Comp log
// ---------------------------------------------------------------------------
function logCompAction({ user_id, email, days, note, expires_at }) {
  const entry = {
    id: crypto.randomUUID(),
    user_id,
    email,
    days,
    note,
    comped_at: new Date().toISOString(),
    expires_at
  };
  store.compLog.push(entry);
  logAdminAction("comp_grant", email, { user_id, days, note, expires_at });
  persistAdminStore();
  return entry;
}

function getCompLog() {
  return [...store.compLog].sort(
    (a, b) => new Date(b.comped_at) - new Date(a.comped_at)
  );
}

function getActiveComps() {
  const now = new Date();
  return store.compLog.filter((c) => new Date(c.expires_at) > now);
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------
function logAdminAction(action, target, details) {
  const entry = {
    id: crypto.randomUUID(),
    action,
    target,
    details,
    timestamp: new Date().toISOString()
  };
  store.activityLog.push(entry);
  if (store.activityLog.length > MAX_ACTIVITY_LOG) {
    store.activityLog = store.activityLog.slice(-MAX_ACTIVITY_LOG);
  }
  persistAdminStore();
  return entry;
}

function getActivityLog(limit = 50) {
  return store.activityLog.slice(-limit).reverse();
}

// ---------------------------------------------------------------------------
// Health checks
// ---------------------------------------------------------------------------
function saveHealthCheckResult(vendorId, result) {
  const previous = store.healthChecks[vendorId] || null;
  store.healthChecks[vendorId] = {
    ...result,
    last_checked: new Date().toISOString()
  };

  // Detect new image breakage compared to previous run
  if (previous && result.images_broken > previous.images_broken) {
    const delta = result.images_broken - previous.images_broken;
    createAlert(
      "WARNING",
      vendorId,
      `${delta} new broken image(s) detected (${previous.images_broken} → ${result.images_broken})`,
      false
    );
  }

  persistAdminStore();
}

function getHealthCheckResults() {
  return { ...store.healthChecks };
}

function getLastHealthRun() {
  return store.lastHealthRun;
}

function setLastHealthRun(timestamp) {
  store.lastHealthRun = timestamp;
  persistAdminStore();
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
function createAlert(severity, vendorId, message, autoFixable = false) {
  const alert = {
    id: crypto.randomUUID(),
    severity,
    vendor_id: vendorId,
    message,
    created_at: new Date().toISOString(),
    dismissed: false,
    auto_fixable: autoFixable
  };
  store.healthAlerts.push(alert);
  persistAdminStore();
  return alert;
}

function getHealthAlerts() {
  return store.healthAlerts.filter((a) => !a.dismissed);
}

function dismissAlert(alertId) {
  const alert = store.healthAlerts.find((a) => a.id === alertId);
  if (alert) {
    alert.dismissed = true;
    logAdminAction("alert_dismiss", alertId, { message: alert.message, vendor_id: alert.vendor_id });
    persistAdminStore();
  }
  return alert || null;
}

function clearOldAlerts() {
  const cutoff = Date.now() - ALERT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const before = store.healthAlerts.length;
  store.healthAlerts = store.healthAlerts.filter(
    (a) => !(a.dismissed && new Date(a.created_at).getTime() < cutoff)
  );
  const removed = before - store.healthAlerts.length;
  if (removed > 0) persistAdminStore();
  return removed;
}

// ---------------------------------------------------------------------------
// Catalog health check (local data analysis — no network requests)
// ---------------------------------------------------------------------------
async function runCatalogHealthCheck(getAllProductsFn) {
  const products = await getAllProductsFn();

  // Group by vendor_id (skip blocked vendors)
  const byVendor = {};
  for (const p of products) {
    const vid = p.vendor_id || "unknown";
    if (isVendorBlocked(vid)) continue;
    if (!byVendor[vid]) byVendor[vid] = [];
    byVendor[vid].push(p);
  }

  for (const [vendorId, vendorProducts] of Object.entries(byVendor)) {
    const total = vendorProducts.length;

    // Broken images: image_broken flag is true, or image_url is empty/null
    const brokenImages = vendorProducts.filter(
      (p) => p.image_broken === true || !p.image_url
    );
    const imagesGood = total - brokenImages.length;

    const missingDescriptions = vendorProducts.filter(
      (p) => !p.description
    ).length;

    const aiTagged = vendorProducts.filter(
      (p) => p.ai_furniture_type || (p.ai_visual_tags && p.ai_visual_tags.length > 0)
    ).length;

    const brokenImageUrls = brokenImages
      .filter((p) => p.image_url)
      .map((p) => p.image_url);

    // Sample products for preview
    const sampleProducts = vendorProducts.slice(0, 5).map((p) => ({
      id: p.id,
      product_name: p.product_name,
      image_url: p.image_url
    }));

    const result = {
      products_total: total,
      images_good: imagesGood,
      images_broken: brokenImages.length,
      broken_image_urls: brokenImageUrls,
      missing_descriptions: missingDescriptions,
      ai_tagged: aiTagged,
      vendor_site_status: "ok",
      previous_product_count: store.vendorSnapshots[vendorId]?.product_count ?? null,
      sample_products: sampleProducts
    };

    // Compare product count vs previous snapshot — detect significant drops
    const prevSnapshot = store.vendorSnapshots[vendorId];
    if (prevSnapshot) {
      const drop = prevSnapshot.product_count - total;
      const dropPct = prevSnapshot.product_count > 0
        ? (drop / prevSnapshot.product_count) * 100
        : 0;
      if (drop > 10 && dropPct > 10) {
        createAlert(
          "WARNING",
          vendorId,
          `Product count dropped by ${drop} (${dropPct.toFixed(1)}%): ${prevSnapshot.product_count} → ${total}`,
          false
        );
      }
    }

    // saveHealthCheckResult handles breakage detection internally
    saveHealthCheckResult(vendorId, result);

    // Update vendor snapshot
    store.vendorSnapshots[vendorId] = {
      product_count: total,
      timestamp: new Date().toISOString()
    };
  }

  store.lastHealthRun = new Date().toISOString();
  persistAdminStore();
}

// ---------------------------------------------------------------------------
// Vendor health summary
// ---------------------------------------------------------------------------
function getVendorHealthSummary() {
  // Purge blocked vendors from stored health data
  for (const vid of Object.keys(store.healthChecks)) {
    if (isVendorBlocked(vid)) {
      delete store.healthChecks[vid];
      delete store.vendorSnapshots[vid];
    }
  }

  const checks = store.healthChecks;
  const vendorIds = Object.keys(checks);

  let totalProducts = 0;
  let totalBrokenImages = 0;
  let totalMissingDescriptions = 0;
  let totalAiTagged = 0;

  const vendors = vendorIds.map((vendorId) => {
    const c = checks[vendorId];
    totalProducts += c.products_total;
    totalBrokenImages += c.images_broken;
    totalMissingDescriptions += c.missing_descriptions;
    totalAiTagged += c.ai_tagged;

    const t = c.products_total || 1; // avoid division by zero
    const imagesPct = c.images_good / t;
    const descPct = (t - c.missing_descriptions) / t;
    const aiPct = c.ai_tagged / t;
    const healthPct = (imagesPct * 0.5 + descPct * 0.25 + aiPct * 0.25) * 100;

    const color = healthPct >= 95 ? "green" : healthPct >= 80 ? "yellow" : "red";

    return {
      vendor_id: vendorId,
      vendor_name: vendorId,
      products_total: c.products_total,
      images_good: c.images_good,
      images_broken: c.images_broken,
      missing_descriptions: c.missing_descriptions,
      ai_tagged: c.ai_tagged,
      health_pct: Math.round(healthPct * 100) / 100,
      color,
      last_checked: c.last_checked,
      sample_products: c.sample_products || []
    };
  });

  // Sort by health_pct ascending (worst first)
  vendors.sort((a, b) => a.health_pct - b.health_pct);

  return {
    total_products: totalProducts,
    total_vendors: vendorIds.length,
    total_broken_images: totalBrokenImages,
    total_missing_descriptions: totalMissingDescriptions,
    total_ai_tagged: totalAiTagged,
    last_health_run: store.lastHealthRun,
    next_health_run: null,
    vendors
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  initAdminStore,
  persistAdminStore,
  logCompAction,
  getCompLog,
  getActiveComps,
  logAdminAction,
  getActivityLog,
  saveHealthCheckResult,
  getHealthCheckResults,
  getLastHealthRun,
  setLastHealthRun,
  createAlert,
  getHealthAlerts,
  dismissAlert,
  clearOldAlerts,
  runCatalogHealthCheck,
  getVendorHealthSummary
};
