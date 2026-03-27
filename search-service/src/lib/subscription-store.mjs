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
const TEAMS_FILE = path.join(DATA_DIR, "teams.json");

const FREE_SEARCH_LIMIT = 3;
const FREE_QUOTE_LIMIT = 1;
const FREE_QUOTE_ITEM_LIMIT = 5;

// Admin/founder emails — permanent full Pro, no paywall, no Stripe required
// Override via ADMIN_EMAILS env var (comma-separated), defaults to tyler@spekd.ai
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || "tyler@spekd.ai")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
);

function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.has(email.toLowerCase().trim());
}
const GRACE_PERIOD_DAYS = 7;
const DATA_RETENTION_DAYS = 90;

// In-memory stores backed by JSON files
let guests = {};       // keyed by fingerprint
let subscriptions = {}; // keyed by user_id
let events = [];        // subscription events log
let teams = {};         // keyed by teamId

// In-memory only stores (not persisted)
let sessions = {};          // keyed by userId → { sessionToken, fingerprint, ip, userAgent, created_at, last_active }
let sharingActivity = {};   // keyed by userId → [{ fingerprint, ip, timestamp }]
let sharingWarnings = {};   // keyed by userId → [timestamp]

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
let teamSaveTimer = null;
function saveTeamsDebounced() { clearTimeout(teamSaveTimer); teamSaveTimer = setTimeout(() => saveJSON(TEAMS_FILE, teams), 1000); }

// Init
function initSubscriptionStore() {
  guests = loadJSON(GUESTS_FILE) || {};
  subscriptions = loadJSON(SUBSCRIPTIONS_FILE) || {};
  events = loadJSON(EVENTS_FILE) || [];
  teams = loadJSON(TEAMS_FILE) || {};
  console.log(`[sub-store] Loaded ${Object.keys(guests).length} guest records, ${Object.keys(subscriptions).length} subscriptions, ${Object.keys(teams).length} teams`);
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

  // Check by IP — count total searches across ALL fingerprints from this IP.
  // Prevents incognito abuse: new fingerprint each session, but same IP.
  // Cap: max FREE_SEARCH_LIMIT * 2 total anonymous searches per IP.
  if (ip) {
    const ipMatches = Object.values(guests).filter(g => g.ip === ip);
    const totalIpSearches = ipMatches.reduce((sum, g) => sum + (g.search_count || 0), 0);
    if (totalIpSearches >= FREE_SEARCH_LIMIT * 2) {
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
  if (sub.status === "trialing") {
    // Check if trial has ended
    const trialEnd = new Date(sub.trial_end || 0);
    if (Date.now() < trialEnd.getTime()) return "trialing";
    // Trial ended but no payment yet — will be caught by webhook
    return "trialing"; // Stripe manages the transition
  }

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
    // Check sharing violation restriction
    const sharingCheck = checkSharingViolation(userId);
    if (sharingCheck.flagged && sharingCheck.restrict) {
      return { allowed: false, reason: "account_sharing_restricted" };
    }

    // Check team membership
    const team = getTeamByUser(userId);
    if (team) {
      const adminSub = subscriptions[team.admin_user_id];
      if (adminSub && (adminSub.status === "active" || adminSub.status === "cancelled")) {
        const adminStatus = getUserStatus(team.admin_user_id);
        if (adminStatus === "active" || adminStatus === "cancelled") {
          return { allowed: true, status: adminStatus };
        }
      }
    }

    const status = getUserStatus(userId);
    if (status === "active" || status === "trialing" || status === "cancelled") {
      // trialing = 7-day trial, cancelled still has access until period end
      const sub = subscriptions[userId];
      return {
        allowed: true,
        status,
        trial_end: sub?.trial_end || null,
        current_period_end: sub?.current_period_end || null,
      };
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
    if (sub.plan === "team_annual") {
      const teamEntry = Object.values(teams).find(t => t.admin_user_id === sub.user_id);
      const extraSeats = teamEntry ? teamEntry.extra_seats || 0 : 0;
      mrr += 2490 / 12 + (49 * extraSeats);
    } else if (sub.plan === "team_monthly") {
      const teamEntry = Object.values(teams).find(t => t.admin_user_id === sub.user_id);
      const extraSeats = teamEntry ? teamEntry.extra_seats || 0 : 0;
      mrr += 249 + (49 * extraSeats);
    } else if (sub.plan === "annual") {
      mrr += 990 / 12;
    } else {
      mrr += 99;
    }
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

// ─── SESSION TRACKING ───

/**
 * Create a new session for a user. For Pro plans, replaces any existing session
 * (single active session enforcement).
 */
function createSession(userId, fingerprint, ip, userAgent) {
  const sessionToken = crypto.randomUUID();
  const session = {
    sessionToken,
    fingerprint,
    ip,
    userAgent,
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
  };

  // For Pro plans, enforce single active session by replacing existing
  const sub = subscriptions[userId];
  if (sub && (sub.plan === "monthly" || sub.plan === "annual")) {
    sessions[userId] = session;
  } else {
    sessions[userId] = session;
  }

  return sessionToken;
}

/**
 * Validate a session token for a user.
 */
function validateSession(userId, sessionToken) {
  const session = sessions[userId];
  if (!session) {
    return { valid: false, reason: "signed_in_from_another_device" };
  }
  if (session.sessionToken !== sessionToken) {
    return { valid: false, reason: "signed_in_from_another_device" };
  }
  session.last_active = new Date().toISOString();
  return { valid: true };
}

/**
 * Get the current active session for a user.
 */
function getActiveSession(userId) {
  return sessions[userId] || null;
}

// ─── SHARING DETECTION ───

/**
 * Track user activity (IP and fingerprint) for sharing detection.
 */
function trackActivity(userId, fingerprint, ip) {
  if (!sharingActivity[userId]) {
    sharingActivity[userId] = [];
  }
  sharingActivity[userId].push({
    fingerprint,
    ip,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Check if a user's account shows signs of credential sharing.
 */
function checkSharingViolation(userId) {
  const now = Date.now();
  const activities = sharingActivity[userId] || [];
  const warnings = sharingWarnings[userId] || [];

  // Count warnings in past 30 days
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
  const recentWarnings = warnings.filter(ts => new Date(ts).getTime() > thirtyDaysAgo);

  // 3+ warnings in past 30 days → restrict
  if (recentWarnings.length >= 3) {
    return { flagged: true, reason: "account_sharing_detected", restrict: true, warning_count: recentWarnings.length };
  }

  // 5+ unique IPs in past 7 days → flag
  const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
  const recentActivities7d = activities.filter(a => new Date(a.timestamp).getTime() > sevenDaysAgo);
  const uniqueIPs = new Set(recentActivities7d.map(a => a.ip).filter(Boolean));

  if (uniqueIPs.size >= 5) {
    if (!sharingWarnings[userId]) sharingWarnings[userId] = [];
    sharingWarnings[userId].push(new Date().toISOString());
    const updatedWarnings = sharingWarnings[userId].filter(ts => new Date(ts).getTime() > thirtyDaysAgo);
    if (updatedWarnings.length >= 3) {
      return { flagged: true, reason: "account_sharing_detected", restrict: true, warning_count: updatedWarnings.length };
    }
    return { flagged: true, reason: "too_many_ips", warning_count: updatedWarnings.length };
  }

  // 3+ unique fingerprints in past 24 hours → warning
  const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
  const recentActivities24h = activities.filter(a => new Date(a.timestamp).getTime() > twentyFourHoursAgo);
  const uniqueFingerprints = new Set(recentActivities24h.map(a => a.fingerprint).filter(Boolean));

  if (uniqueFingerprints.size >= 3) {
    if (!sharingWarnings[userId]) sharingWarnings[userId] = [];
    sharingWarnings[userId].push(new Date().toISOString());
    const updatedWarnings = sharingWarnings[userId].filter(ts => new Date(ts).getTime() > thirtyDaysAgo);
    if (updatedWarnings.length >= 3) {
      return { flagged: true, reason: "account_sharing_detected", restrict: true, warning_count: updatedWarnings.length };
    }
    return { flagged: false, reason: "multiple_fingerprints_warning", warning_count: updatedWarnings.length };
  }

  return { flagged: false, warning_count: recentWarnings.length };
}

// ─── TEAM MANAGEMENT ───

/**
 * Create a new team with the given admin user.
 */
function createTeam(adminUserId, teamName) {
  const teamId = crypto.randomUUID();
  const team = {
    id: teamId,
    name: teamName,
    admin_user_id: adminUserId,
    members: [
      {
        user_id: adminUserId,
        email: null,
        role: "admin",
        joined_at: new Date().toISOString(),
      },
    ],
    seats: 5,
    extra_seats: 0,
    plan: "team_monthly",
    created_at: new Date().toISOString(),
  };
  teams[teamId] = team;
  saveTeamsDebounced();
  return team;
}

/**
 * Get a team by its ID.
 */
function getTeam(teamId) {
  return teams[teamId] || null;
}

/**
 * Find the team where the given user is admin or member.
 */
function getTeamByUser(userId) {
  return Object.values(teams).find(t =>
    t.admin_user_id === userId ||
    t.members.some(m => m.user_id === userId)
  ) || null;
}

/**
 * Invite a member to a team (admin only). Adds member if seats are available.
 */
function inviteMember(teamId, adminUserId, memberEmail) {
  const team = teams[teamId];
  if (!team) return { error: "team_not_found" };
  if (team.admin_user_id !== adminUserId) return { error: "not_admin" };

  const totalSeats = team.seats + (team.extra_seats || 0);
  if (team.members.length >= totalSeats) {
    return { error: "no_seats_available" };
  }

  // Check if already a member
  if (team.members.some(m => m.email === memberEmail)) {
    return { error: "already_member" };
  }

  const member = {
    user_id: null,
    email: memberEmail,
    role: "member",
    joined_at: new Date().toISOString(),
  };
  team.members.push(member);
  saveTeamsDebounced();
  return { success: true, member };
}

/**
 * Remove a member from a team (admin only).
 */
function removeMember(teamId, adminUserId, memberUserId) {
  const team = teams[teamId];
  if (!team) return { error: "team_not_found" };
  if (team.admin_user_id !== adminUserId) return { error: "not_admin" };
  if (memberUserId === adminUserId) return { error: "cannot_remove_admin" };

  const idx = team.members.findIndex(m => m.user_id === memberUserId);
  if (idx === -1) return { error: "member_not_found" };

  team.members.splice(idx, 1);
  saveTeamsDebounced();
  return { success: true };
}

/**
 * Add an extra seat to a team at $49/mo (admin only).
 */
function addSeat(teamId, adminUserId) {
  const team = teams[teamId];
  if (!team) return { error: "team_not_found" };
  if (team.admin_user_id !== adminUserId) return { error: "not_admin" };

  team.extra_seats = (team.extra_seats || 0) + 1;
  saveTeamsDebounced();
  return { success: true, extra_seats: team.extra_seats, cost_per_seat: 49 };
}

/**
 * Get all members of a team with their roles.
 */
function getTeamMembers(teamId) {
  const team = teams[teamId];
  if (!team) return [];
  return team.members;
}

// ─── FUNNEL METRICS ───

function getFunnelMetrics() {
  const allGuests = Object.values(guests);
  const allSubs = Object.values(subscriptions);

  const anonymousVisitors = allGuests.length;
  const usedAllFreeSearches = allGuests.filter(g => (g.search_count || 0) >= FREE_SEARCH_LIMIT).length;
  const trialSignups = allSubs.filter(s => s.created_at).length;
  const trialActive = allSubs.filter(s => s.status === "trialing").length;
  const convertedToPro = allSubs.filter(s => s.status === "active").length;
  const cancelled = allSubs.filter(s => s.status === "cancelled" || s.status === "trial_expired").length;

  // Trials expiring in next 48 hours
  const now = Date.now();
  const in48h = now + 48 * 60 * 60 * 1000;
  const trialsExpiringSoon = allSubs.filter(s => {
    if (s.status !== "trialing" || !s.trial_end) return false;
    const end = new Date(s.trial_end).getTime();
    return end > now && end <= in48h;
  });

  // Failed payments needing attention
  const failedPayments = allSubs.filter(s => s.status === "past_due");

  // Conversion rates
  const signupRate = anonymousVisitors > 0 ? (trialSignups / usedAllFreeSearches * 100).toFixed(1) : "0.0";
  const conversionRate = trialSignups > 0 ? (convertedToPro / trialSignups * 100).toFixed(1) : "0.0";

  return {
    anonymous_visitors: anonymousVisitors,
    used_all_free_searches: usedAllFreeSearches,
    trial_signups: trialSignups,
    trial_active: trialActive,
    converted_to_pro: convertedToPro,
    cancelled,
    signup_rate: parseFloat(signupRate),
    conversion_rate: parseFloat(conversionRate),
    trials_expiring_soon: trialsExpiringSoon.map(s => ({
      user_id: s.user_id,
      trial_end: s.trial_end,
      plan: s.plan,
    })),
    failed_payments: failedPayments.map(s => ({
      user_id: s.user_id,
      payment_failed_at: s.payment_failed_at,
      plan: s.plan,
    })),
  };
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
  createSession,
  validateSession,
  getActiveSession,
  trackActivity,
  checkSharingViolation,
  createTeam,
  getTeam,
  getTeamByUser,
  inviteMember,
  removeMember,
  addSeat,
  getTeamMembers,
  getFunnelMetrics,
  FREE_SEARCH_LIMIT,
  FREE_QUOTE_LIMIT,
  FREE_QUOTE_ITEM_LIMIT,
  isAdminEmail,
  ADMIN_EMAILS,
};
