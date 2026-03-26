/**
 * Browser fingerprinting + guest token management.
 * Uses FingerprintJS for stable device identification across sessions and incognito.
 * Triple-tracks: fingerprint + IP (server-side) + localStorage ID.
 */
import FingerprintJS from "@fingerprintjs/fingerprintjs";

const LS_ID_KEY = "spekd_device_id";
const GUEST_TOKEN_KEY = "spekd_guest_token";
const USAGE_KEY = "spekd_usage";

const searchServiceUrl = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

// Get or create localStorage device ID
function getOrCreateLsId() {
  try {
    let id = localStorage.getItem(LS_ID_KEY);
    if (!id) {
      id = "ls_" + crypto.randomUUID();
      localStorage.setItem(LS_ID_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

// Get or create fingerprint
let cachedFingerprint = null;
async function getFingerprint() {
  if (cachedFingerprint) return cachedFingerprint;
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedFingerprint = result.visitorId;
    return cachedFingerprint;
  } catch (err) {
    console.warn("[fingerprint] Failed:", err.message);
    // Fallback: use a random ID stored in localStorage
    return getOrCreateLsId();
  }
}

// Local usage tracking (supplementary to server-side)
function getLocalUsage() {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    return raw ? JSON.parse(raw) : { searches: 0, quotes: 0 };
  } catch {
    return { searches: 0, quotes: 0 };
  }
}

function incrementLocalUsage(type) {
  try {
    const usage = getLocalUsage();
    usage[type] = (usage[type] || 0) + 1;
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    return usage;
  } catch {
    return { searches: 0, quotes: 0 };
  }
}

// Guest token management
function getStoredGuestToken() {
  try { return localStorage.getItem(GUEST_TOKEN_KEY); } catch { return null; }
}

function storeGuestToken(token) {
  try { localStorage.setItem(GUEST_TOKEN_KEY, token); } catch {}
}

/**
 * Get or refresh guest token from server.
 * Returns { token, status, searches_remaining, quotes_remaining }
 */
async function ensureGuestToken() {
  const existing = getStoredGuestToken();
  const fingerprint = await getFingerprint();
  const lsId = getOrCreateLsId();

  try {
    const resp = await fetch(`${searchServiceUrl}/auth/guest-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint, ls_id: lsId }),
    });
    const data = await resp.json();
    if (data.token) {
      storeGuestToken(data.token);
      return data;
    }
  } catch (err) {
    console.warn("[guest-token] Failed to get token:", err.message);
  }

  // Return existing or fallback
  return {
    token: existing,
    status: "guest",
    searches_remaining: Math.max(0, 3 - getLocalUsage().searches),
    quotes_remaining: Math.max(0, 1 - getLocalUsage().quotes),
  };
}

/**
 * Get the auth headers for API requests.
 * Uses user auth token if logged in, otherwise guest token.
 */
function getAuthHeaders() {
  const userToken = localStorage.getItem("spec_auth_token");
  if (userToken) {
    return {
      Authorization: `Bearer ${userToken}`,
    };
  }

  const guestToken = getStoredGuestToken();
  const headers = {};
  if (guestToken) headers["Authorization"] = `Bearer ${guestToken}`;
  if (cachedFingerprint) headers["X-Fingerprint"] = cachedFingerprint;

  try {
    const lsId = localStorage.getItem(LS_ID_KEY);
    if (lsId) headers["X-Ls-Id"] = lsId;
  } catch {}

  return headers;
}

/**
 * Check subscription status from server.
 */
async function checkSubscriptionStatus() {
  try {
    const resp = await fetch(`${searchServiceUrl}/subscribe/status`, {
      headers: getAuthHeaders(),
    });
    const data = await resp.json();
    // Persist status so paywall gate hook can read it synchronously
    try {
      localStorage.setItem("spec_sub_status", data.status || "guest");
    } catch {}
    return data;
  } catch {
    return { status: "guest", searches_remaining: 3 };
  }
}

export {
  getFingerprint,
  getOrCreateLsId,
  getLocalUsage,
  incrementLocalUsage,
  ensureGuestToken,
  getAuthHeaders,
  getStoredGuestToken,
  checkSubscriptionStatus,
};
