/**
 * Auth API client — talks to search-service /auth/* endpoints.
 */

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app";
const baseUrl = searchServiceUrl.replace(/\/$/, "");

const AUTH_TOKEN_KEY = "spec_auth_token";
const AUTH_USER_KEY = "spec_auth_user";

function getStoredToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeAuth(token, user) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  } catch {}
}

function clearAuth() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  } catch {}
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function authFetch(path, options = {}) {
  const token = getStoredToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const data = await resp.json();
  return { status: resp.status, data };
}

export async function register({ email, password, full_name, business_name }) {
  const { status, data } = await authFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, full_name, business_name }),
  });
  if (data.ok && data.token) {
    storeAuth(data.token, data.user);
  }
  return data;
}

export async function login({ email, password }) {
  const { status, data } = await authFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (data.ok && data.token) {
    storeAuth(data.token, data.user);
  }
  return data;
}

export async function getMe() {
  const token = getStoredToken();
  if (!token) return { ok: false, error: "Not logged in" };

  const { status, data } = await authFetch("/auth/me");
  if (data.ok) {
    storeAuth(token, data.user);
  } else {
    clearAuth();
  }
  return data;
}

export async function updateMe(updates) {
  const { status, data } = await authFetch("/auth/me", {
    method: "PUT",
    body: JSON.stringify(updates),
  });
  if (data.ok) {
    const token = getStoredToken();
    storeAuth(token, data.user);
  }
  return data;
}

export function logout() {
  clearAuth();
  window.location.reload();
}

export function isLoggedIn() {
  return !!getStoredToken();
}

export function getCachedUser() {
  return getStoredUser();
}

export function getToken() {
  return getStoredToken();
}
