/**
 * Search Analytics — Track every search, click, compare, and quote action.
 *
 * In-memory store with periodic disk flush.
 * Provides aggregated stats for the admin dashboard.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const ANALYTICS_PATH = path.join(DATA_DIR, "analytics.json");

// ── In-Memory State ──

/** @type {Array<object>} */
let searchLog = [];

/** @type {Map<string, number>} query → count */
let queryCounts = new Map();

/** @type {Map<string, number>} productId → click count */
let productClicks = new Map();

/** @type {Map<string, number>} productId → compare count */
let productCompares = new Map();

/** @type {Map<string, number>} productId → quote count */
let productQuotes = new Map();

/** @type {Map<string, { impressions: number, clicks: number }>} vendorId → stats */
let vendorCTR = new Map();

/** @type {Array<string>} Queries that returned 0 results */
let zeroResultQueries = [];

let saveTimer = null;
const SAVE_INTERVAL = 60_000; // Flush every minute

// ── Load from disk ──

function loadFromDisk() {
  try {
    if (!fs.existsSync(ANALYTICS_PATH)) return;
    const raw = JSON.parse(fs.readFileSync(ANALYTICS_PATH, "utf8"));

    if (raw.queryCounts) {
      queryCounts = new Map(Object.entries(raw.queryCounts));
    }
    if (raw.productClicks) {
      productClicks = new Map(Object.entries(raw.productClicks));
    }
    if (raw.productCompares) {
      productCompares = new Map(Object.entries(raw.productCompares));
    }
    if (raw.productQuotes) {
      productQuotes = new Map(Object.entries(raw.productQuotes));
    }
    if (raw.vendorCTR) {
      vendorCTR = new Map(Object.entries(raw.vendorCTR));
    }
    if (Array.isArray(raw.zeroResultQueries)) {
      zeroResultQueries = raw.zeroResultQueries.slice(-200);
    }
    if (Array.isArray(raw.searchLog)) {
      searchLog = raw.searchLog.slice(-5000);
    }

    console.log(`[analytics] Loaded: ${queryCounts.size} queries tracked, ${productClicks.size} products clicked`);
  } catch (err) {
    console.error(`[analytics] Failed to load: ${err.message}`);
  }
}

function saveToDisk() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const data = {
      saved_at: new Date().toISOString(),
      queryCounts: Object.fromEntries(queryCounts),
      productClicks: Object.fromEntries(productClicks),
      productCompares: Object.fromEntries(productCompares),
      productQuotes: Object.fromEntries(productQuotes),
      vendorCTR: Object.fromEntries(vendorCTR),
      zeroResultQueries: zeroResultQueries.slice(-200),
      searchLog: searchLog.slice(-5000),
    };
    fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(data));
  } catch (err) {
    console.error(`[analytics] Failed to save: ${err.message}`);
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveToDisk();
    saveTimer = null;
  }, SAVE_INTERVAL);
}

// ── Public API ──

/**
 * Initialize analytics (load from disk).
 */
export function initAnalytics() {
  loadFromDisk();
}

/**
 * Track a search event.
 *
 * @param {object} event
 * @param {string} event.query
 * @param {number} event.resultCount
 * @param {string[]} [event.productIds] - IDs of returned products
 * @param {string[]} [event.vendorIds] - Vendor IDs in results
 * @param {number} [event.tier] - Search tier used (1/2/3)
 * @param {boolean} [event.cacheHit]
 */
export function trackSearch(event) {
  const entry = {
    query: event.query,
    result_count: event.resultCount,
    tier: event.tier || 1,
    cache_hit: event.cacheHit || false,
    timestamp: Date.now(),
  };
  searchLog.push(entry);

  // Keep searchLog bounded
  if (searchLog.length > 10000) {
    searchLog = searchLog.slice(-5000);
  }

  // Count queries
  const q = event.query.toLowerCase().trim();
  queryCounts.set(q, (queryCounts.get(q) || 0) + 1);

  // Track zero-result queries
  if (event.resultCount === 0) {
    zeroResultQueries.push(q);
    if (zeroResultQueries.length > 500) {
      zeroResultQueries = zeroResultQueries.slice(-200);
    }
  }

  // Track vendor impressions
  if (Array.isArray(event.vendorIds)) {
    for (const vid of event.vendorIds) {
      const existing = vendorCTR.get(vid) || { impressions: 0, clicks: 0 };
      existing.impressions++;
      vendorCTR.set(vid, existing);
    }
  }

  scheduleSave();
}

/**
 * Track a product click.
 *
 * @param {string} productId
 * @param {string} [vendorId]
 */
export function trackClick(productId, vendorId) {
  productClicks.set(productId, (productClicks.get(productId) || 0) + 1);

  if (vendorId) {
    const existing = vendorCTR.get(vendorId) || { impressions: 0, clicks: 0 };
    existing.clicks++;
    vendorCTR.set(vendorId, existing);
  }

  scheduleSave();
}

/**
 * Track a product compare action.
 */
export function trackCompare(productId) {
  productCompares.set(productId, (productCompares.get(productId) || 0) + 1);
  scheduleSave();
}

/**
 * Track a product quote action.
 */
export function trackQuote(productId) {
  productQuotes.set(productId, (productQuotes.get(productId) || 0) + 1);
  scheduleSave();
}

/**
 * Get analytics dashboard data.
 */
export function getAnalyticsDashboard() {
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  // Recent searches (last 7 days)
  const recentSearches = searchLog.filter((s) => now - s.timestamp < oneWeek);
  const todaySearches = searchLog.filter((s) => now - s.timestamp < oneDay);

  // Top queries this week
  const weekQueryCounts = new Map();
  for (const s of recentSearches) {
    const q = s.query.toLowerCase().trim();
    weekQueryCounts.set(q, (weekQueryCounts.get(q) || 0) + 1);
  }
  const topQueries = [...weekQueryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([query, count]) => ({ query, count }));

  // Zero-result queries (deduplicated with counts)
  const zeroCountMap = new Map();
  for (const q of zeroResultQueries) {
    zeroCountMap.set(q, (zeroCountMap.get(q) || 0) + 1);
  }
  const zeroResults = [...zeroCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([query, count]) => ({ query, count }));

  // Most clicked products
  const topClicked = [...productClicks.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, clicks]) => ({ product_id: id, clicks }));

  // Most compared
  const topCompared = [...productCompares.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id, compares]) => ({ product_id: id, compares }));

  // Most quoted
  const topQuoted = [...productQuotes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, quotes]) => ({ product_id: id, quotes }));

  // Vendor CTR
  const vendorStats = [...vendorCTR.entries()]
    .map(([id, stats]) => ({
      vendor_id: id,
      impressions: stats.impressions,
      clicks: stats.clicks,
      ctr: stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(1) + "%" : "0%",
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);

  // Search volume by hour (last 24h)
  const hourlyVolume = new Array(24).fill(0);
  for (const s of todaySearches) {
    const hour = new Date(s.timestamp).getHours();
    hourlyVolume[hour]++;
  }

  return {
    overview: {
      total_searches: searchLog.length,
      searches_today: todaySearches.length,
      searches_this_week: recentSearches.length,
      unique_queries: queryCounts.size,
      zero_result_count: zeroResultQueries.length,
      avg_results_per_search: recentSearches.length > 0
        ? Math.round(recentSearches.reduce((sum, s) => sum + s.result_count, 0) / recentSearches.length)
        : 0,
    },
    top_queries: topQueries,
    zero_result_queries: zeroResults,
    top_clicked_products: topClicked,
    top_compared_products: topCompared,
    top_quoted_products: topQuoted,
    vendor_ctr: vendorStats,
    hourly_volume: hourlyVolume,
  };
}
