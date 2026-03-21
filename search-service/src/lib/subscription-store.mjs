/**
 * Subscription Store — manages guest usage tracking and subscription state.
 *
 * Guest tracking uses triple-identification: fingerprint + IP + localStorage ID.
 * If ANY ONE of the three has hit the limit, the limit applies.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const GUESTS_FILE = path.join(DATA_DIR, "guests.json");
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, "subscriptions.json");
const EVENTS_FILE = path.join(DATA_DIR, "subscription-events.json");

const FREE_SEARCH_LIMIT = 5;
const FREE_QUOTE_LIMIT = 1;
const FREE_QUOTE_ITEM_LIMIT = 5;
const GRACE_PERIOD_DAYS = 7;
const DATA_RETENTION_DAYS = 90;

// In-memory stores backed by JSON files
let guests = {};       // keyed by fingerprint
let subscriptions = {}; // keyed by user_id
let events = [];        // subscription events log

// Load/save helpers
function loadJSON(file) {
  try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
  return null;
}
function saveJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch (e) { console.error("[sub-store] save error:", e.message); }
}

// Debounced saves
let guestSaveTimer = null;
let subSaveTimer = null;
function saveGuestsDebounced() { clearTimeout(guestSaveTimer); guestSaveTimer = setTimeout(() => saveJSON(GUESTS_FILE, guests), 3000); }
function saveSubsDebounced() { clearTimeout(subSaveTimer); subSaveTimer = setTimeout(() => saveJSON(SUBSCRIPTIONS_FILE, subscriptions), 1000); }
function saveEventsImmediate() { saveJSON(EVENTS_FILE, events); }

// Init
function initSubscriptionStore() {
  guests = loadJSON(GUESTS_FILE) || {};
  subscriptions = loadJSON(SUBSCRIPTIONS_FILE) || {};
  events = loadJSON(EVENTS_FILE) || [];
  console.log(`[sub-store] Loaded ${Object.keys(guests).length} guest records, ${Object.keys(subscriptions).length} subscriptions`);
}

// ─── GUEST TRACKING ───

/**
 * Get or create a guest record. Uses fingerprint as primary key.
 * Also indexes by IP and localStorage ID for cross-reference.
 */
function getGuestUsage(fingerprint, ip, localStorageId) {
  // Check if any identifier has been seen before and is over limit
  let searchCount = 0;
  let quoteCount = 0;
  let matchedFingerprint = fingerprint;

  // Check by fingerprint
  if (fingerprint && guests[fingerprint]) {
    searchCount = Math.max(searchCount, guests[fingerprint].search_count || 0);
    quoteCount = Math.max(quoteCount, guests[fingerprint].quote_count || 0);
  }

  // Check by IP — only flag if 3+ different fingerprints from same IP all hit limit
  if (ip) {
    const ipMatches = Object.values(guests).filter(g => g.ip === ip && g.fingerprint !== fingerprint);
    const limitedFromIp = ipMatches.filter(g => (g.search_count || 0) >= FREE_SEARCH_LIMIT);
    if (limitedFromIp.length >= 3) {
      searchCount = FREE_SEARCH_LIMIT;
    }
  }

  // Check by localStorage ID
  if (localStorageId) {
    const lsMatches = Object.values(guests).filter(g => g.ls_id === localStorageId);
    for (const g of lsMatches) {
      searchCount = Math.max(searchCount, g.search_count || 0);
      quoteCount = Math.max(quoteCount, g.quote_count || 0);
    }
  }

  // Create/update the guest record
  if (fingerprint && !guests[fingerprint]) {
    guests[fingerprint] = {
      fingerprint,
      ip: ip || null,
      ls_id: localStorageId || null,
      search_count: 0,
      quote_count: 0,
      quote_items: 0,
      created_at: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    };
    saveGuestsDebounced();
  } else if (fingerprint && guests[fingerprint]) {
    guests[fingerprint].last_seen = new Date().toISOString();
    if (ip) guests[fingerprint].ip = ip;
    if (localStorageId) guests[fingerprint].ls_id = localStorageId;
  }

  // Use the max across all identifiers
  const effectiveSearchCount = fingerprint && guests[fingerprint]
    ? Math.max(guests[fingerprint].search_count || 0, searchCount)
    : searchCount;
  const effectiveQuoteCount = fingerprint && guests[fingerprint]
    ? Math.max(guests[fingerprint].quote_count || 0, quoteCount)
    : quoteCount;

  return {
    search_count: effectiveSearchCount,
    quote_count: effectiveQuoteCount,
    quote_items: fingerprint && guests[fingerprint] ? (guests[fingerprint].quote_items || 0) : 0,
    searches_remaining: Math.max(0, FREE_SEARCH_LIMIT - effectiveSearchCount),
    quotes_remaining: Math.max(0, FREE_QUOTE_LIMIT - effectiveQuoteCount),
    status: effectiveSearchCount >= FREE_SEARCH_LIMIT ? "trial_expired" : "guest",
  };
}

function incrementGuestSearch(fingerprint) {
  if (!fingerprint || !guests[fingerprint]) return;
  guests[fingerprint].search_count = (guests[fingerprint].search_count || 0) + 1;
  guests[fingerprint].last_seen = new Date().toISOString();
  saveGuestsDebounced();
}

function incrementGuestQuote(fingerprint) {
  if (!fingerprint || !guests[fingerprint]) return;
  guests[fingerprint].quote_count = (guests[fingerprint].quote_count || 0) + 1;
  saveGuestsDebounced();
}

function incrementGuestQuoteItems(fingerprint, count = 1) {
  if (!fingerprint || !guests[fingerprint]) return;
  guests[fingerprint].quote_items = (guests[fingerprint].quote_items || 0) + count;
  saveGuestsDebounced();
}

// ─── SUBSCRIPTION MANAGEMENT ───

function getSubscription(userId) {
  return subscriptions[userId] || null;
}

function getAllSubscriptions() {
  return subscriptions;
}

function setSubscription(userId, data) {
  subscriptions[userId] = {
    ...subscriptions[userId],
    ...data,
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  saveSubsDebounced();
}

/**
 * Determine effective access status for a user.
 * Returns: "active" | "past_due" | "cancelled" | "trial_expired" | "guest"
 */
function getUserStatus(userId) {
  if (!userId) return "guest";
  const sub = subscriptions[userId];
  if (!sub) return "guest";

  if (sub.status === "active") return "active";

  if (sub.status === "past_due") {
    // Check grace period
    const failedAt = new Date(sub.payment_failed_at || sub.updated_at);
    const graceDays = (Date.now() - failedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (graceDays <= GRACE_PERIOD_DAYS) return "past_due";
    return "trial_expired"; // Grace period exceeded
  }

  if (sub.status === "cancelled") {
    // Access continues until end of billing period
    const periodEnd = new Date(sub.current_period_end || 0);
    if (Date.now() < periodEnd.getTime()) return "cancelled"; // still has access
    return "trial_expired"; // period ended
  }

  return "trial_expired";
}

/**
 * Check if user has access to perform an action.
 * Returns { allowed: boolean, status: string, searches_remaining?: number, reason?: string }
 */
function checkAccess(userId, fingerprint, ip, localStorageId, action = "search") {
  // No identification at all — internal/API call, allow through
  // The paywall only applies to identified browser sessions (with fingerprint or guest token)
  if (!userId && !fingerprint && !localStorageId) {
    return { allowed: true, status: "internal" };
  }

  // Authenticated user with subscription
  if (userId) {
    const status = getUserStatus(userId);
    if (status === "active" || status === "cancelled") {
      // cancelled still has access until period end
      return { allowed: true, status };
    }
    if (status === "past_due") {
      // Still has access during grace period, but show warning
      const sub = subscriptions[userId];
      return { allowed: true, status: "past_due", warning: "Your payment failed. Update your card to keep your access.", payment_failed_at: sub.payment_failed_at };
    }
    // trial_expired or no sub — check if they have guest usage left
    // Fall through to guest check
  }

  // Guest/unsubscribed user
  const usage = getGuestUsage(fingerprint, ip, localStorageId);

  if (action === "search" || action === "similar") {
    if (usage.search_count >= FREE_SEARCH_LIMIT) {
      return { allowed: false, status: "trial_expired", searches_remaining: 0, reason: "Free trial searches exhausted" };
    }
    return { allowed: true, status: "guest", searches_remaining: usage.searches_remaining };
  }

  if (action === "quote") {
    if (usage.quote_count >= FREE_QUOTE_LIMIT) {
      return { allowed: false, status: "trial_expired", reason: "Free trial quote limit reached" };
    }
    return { allowed: true, status: "guest", quotes_remaining: usage.quotes_remaining };
  }

  if (action === "quote_item") {
    if (usage.quote_items >= FREE_QUOTE_ITEM_LIMIT) {
      return { allowed: false, status: "trial_expired", reason: "Free trial quote item limit reached" };
    }
    return { allowed: true, status: "guest" };
  }

  // Actions that require active subscription
  if (action === "pdf" || action === "favorites" || action === "trade_pricing") {
    if (userId && (getUserStatus(userId) === "active" || getUserStatus(userId) === "cancelled")) {
      return { allowed: true, status: getUserStatus(userId) };
    }
    return { allowed: false, status: userId ? "trial_expired" : "guest", reason: "Pro subscription required" };
  }

  return { allowed: true, status: "guest" };
}

// ─── SUBSCRIPTION EVENTS ───

function logSubscriptionEvent(type, data) {
  const event = {
    type, // new_subscription, renewal, cancellation, reactivation, failed_payment
    ...data,
    timestamp: new Date().toISOString(),
  };
  events.push(event);
  saveEventsImmediate();
  console.log(`[sub-store] Event: ${type}`, JSON.stringify(data));
}

// ─── REVENUE DASHBOARD ───

function getRevenueDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const allSubs = Object.values(subscriptions);
  const activeSubs = allSubs.filter(s => s.status === "active");

  // MRR calculation
  let mrr = 0;
  for (const sub of activeSubs) {
    if (sub.plan === "annual") mrr += 790 / 12;
    else mrr += 79;
  }

  // This month's events
  const monthEvents = events.filter(e => new Date(e.timestamp) >= monthStart);
  const newThisMonth = monthEvents.filter(e => e.type === "new_subscription").length;
  const cancelledThisMonth = monthEvents.filter(e => e.type === "cancellation").length;
  const revenueThisMonth = monthEvents
    .filter(e => e.type === "new_subscription" || e.type === "renewal" || e.type === "reactivation")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  // Churn rate
  const activeLastMonth = allSubs.filter(s => {
    const created = new Date(s.created_at || 0);
    return created < monthStart;
  }).length;
  const churnRate = activeLastMonth > 0 ? (cancelledThisMonth / activeLastMonth * 100).toFixed(1) : "0.0";

  return {
    total_active_subscribers: activeSubs.length,
    mrr: Math.round(mrr * 100) / 100,
    new_subscribers_this_month: newThisMonth,
    cancellations_this_month: cancelledThisMonth,
    churn_rate: parseFloat(churnRate),
    revenue_this_month: revenueThisMonth,
    total_guests: Object.keys(guests).length,
    trial_expired_guests: Object.values(guests).filter(g => (g.search_count || 0) >= FREE_SEARCH_LIMIT).length,
    total_events: events.length,
    recent_events: events.slice(-20).reverse(),
  };
}

// ─── GUEST TOKEN GENERATION ───

// Generate a short-lived token for guest users
function generateGuestToken(fingerprint, ip, localStorageId) {
  const usage = getGuestUsage(fingerprint, ip, localStorageId);
  const payload = {
    type: "guest",
    fp: fingerprint,
    ip: ip || null,
    ls: localStorageId || null,
    iat: Date.now(),
    exp: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
  };
  // Simple HMAC token
  const TOKEN_SECRET = process.env.AUTH_SECRET || "guest-token-secret";
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payloadB64).digest("base64url");
  return { token: `g.${payloadB64}.${sig}`, ...usage };
}

function verifyGuestToken(token) {
  if (!token || !token.startsWith("g.")) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadB64 = parts[1];
    const sig = parts[2];
    const TOKEN_SECRET = process.env.AUTH_SECRET || "guest-token-secret";
    const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(payloadB64).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Map fingerprint to user account (for anti-abuse)
function linkFingerprintToUser(fingerprint, userId) {
  if (!fingerprint) return;
  if (!guests[fingerprint]) {
    guests[fingerprint] = { fingerprint, search_count: 0, quote_count: 0, quote_items: 0, created_at: new Date().toISOString() };
  }
  guests[fingerprint].linked_user_id = userId;
  saveGuestsDebounced();
}

// Check if fingerprint is linked to multiple accounts (anti-abuse)
function checkMultiAccountAbuse(fingerprint) {
  if (!fingerprint) return { flagged: false };
  const linkedAccounts = Object.values(guests)
    .filter(g => g.fingerprint === fingerprint && g.linked_user_id)
    .map(g => g.linked_user_id);
  const unique = [...new Set(linkedAccounts)];
  return { flagged: unique.length > 1, accounts: unique };
}

export {
  initSubscriptionStore,
  getGuestUsage,
  incrementGuestSearch,
  incrementGuestQuote,
  incrementGuestQuoteItems,
  getSubscription,
  getAllSubscriptions,
  setSubscription,
  getUserStatus,
  checkAccess,
  logSubscriptionEvent,
  getRevenueDashboard,
  generateGuestToken,
  verifyGuestToken,
  linkFingerprintToUser,
  checkMultiAccountAbuse,
  FREE_SEARCH_LIMIT,
  FREE_QUOTE_LIMIT,
  FREE_QUOTE_ITEM_LIMIT,
};
