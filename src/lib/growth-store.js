import { syncFavoriteToServer, syncQuoteToServer, fetchServerFavorites, fetchServerQuote } from "@/api/searchClient";

const isBrowser = typeof window !== "undefined";

function isLoggedIn() {
  if (!isBrowser) return false;
  return !!window.localStorage.getItem("spec_auth_token");
}

// Debounce quote sync to server
let _quoteSyncTimer = null;
function debouncedQuoteSync(quote) {
  if (!isLoggedIn()) return;
  clearTimeout(_quoteSyncTimer);
  _quoteSyncTimer = setTimeout(() => {
    syncQuoteToServer(quote).catch(() => {});
  }, 2000);
}

const STORAGE_KEYS = {
  favorites: "spec_growth_favorites",
  recentSearches: "spec_growth_recent_searches",
  savedSearches: "spec_growth_saved_searches",
  compareItems: "spec_growth_compare_items",
  projects: "spec_growth_projects",
  alerts: "spec_growth_alerts",
  alertNotifications: "spec_growth_alert_notifications",
  styleInteractions: "spec_growth_style_interactions",
  notifications: "spec_growth_notifications",
  recentlyViewed: "spec_growth_recently_viewed",
  quote: "spec_growth_quote",
  quoteSettings: "spec_growth_quote_settings",
};

function readJson(key, fallback) {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed != null ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!isBrowser) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getFavorites() {
  return readJson(STORAGE_KEYS.favorites, []);
}

export function toggleFavorite(item) {
  const current = getFavorites();
  const exists = current.some((entry) => entry.id === item.id);
  const next = exists
    ? current.filter((entry) => entry.id !== item.id)
    : [{ ...item, savedAt: new Date().toISOString() }, ...current].slice(0, 40);
  writeJson(STORAGE_KEYS.favorites, next);
  // Sync to server
  syncFavoriteToServer(item, !exists).catch(() => {});
  return { next, added: !exists };
}

export function getRecentSearches() {
  return readJson(STORAGE_KEYS.recentSearches, []);
}

export function pushRecentSearch(query) {
  if (!query?.trim()) return getRecentSearches();
  const next = [
    query.trim(),
    ...getRecentSearches().filter((entry) => entry.toLowerCase() !== query.trim().toLowerCase()),
  ].slice(0, 8);
  writeJson(STORAGE_KEYS.recentSearches, next);
  return next;
}

export function getSavedSearches() {
  return readJson(STORAGE_KEYS.savedSearches, []);
}

export function saveSearch(query, metadata = {}) {
  if (!query?.trim()) return getSavedSearches();
  const next = [
    {
      query: query.trim(),
      savedAt: new Date().toISOString(),
      ...metadata,
    },
    ...getSavedSearches().filter((entry) => entry.query.toLowerCase() !== query.trim().toLowerCase()),
  ].slice(0, 12);
  writeJson(STORAGE_KEYS.savedSearches, next);
  return next;
}

export function removeSavedSearch(query) {
  const next = getSavedSearches().filter((entry) => entry.query !== query);
  writeJson(STORAGE_KEYS.savedSearches, next);
  return next;
}

export function getCompareItems() {
  return readJson(STORAGE_KEYS.compareItems, []);
}

export function toggleCompareItem(item) {
  const current = getCompareItems();
  const exists = current.some((entry) => entry.id === item.id);
  const next = exists
    ? current.filter((entry) => entry.id !== item.id)
    : [...current, item].slice(0, 6);
  writeJson(STORAGE_KEYS.compareItems, next);
  return { next, added: !exists, limitReached: !exists && current.length >= 6 };
}

export function removeCompareItem(id) {
  const next = getCompareItems().filter((entry) => entry.id !== id);
  writeJson(STORAGE_KEYS.compareItems, next);
  return next;
}

export function clearCompareItems() {
  writeJson(STORAGE_KEYS.compareItems, []);
  return [];
}

// ── Project Management ──────────────────────────────────────

export function getProjects() {
  return readJson(STORAGE_KEYS.projects, []);
}

export function createProject({ name, room_type, budget, notes }) {
  const projects = getProjects();
  const project = {
    id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: name || "Untitled Project",
    room_type: room_type || "",
    budget: Number(budget) || 0,
    notes: notes || "",
    products: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  writeJson(STORAGE_KEYS.projects, [project, ...projects]);
  return project;
}

export function updateProject(id, updates) {
  const projects = getProjects().map((p) =>
    p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p,
  );
  writeJson(STORAGE_KEYS.projects, projects);
  return projects.find((p) => p.id === id);
}

export function deleteProject(id) {
  const next = getProjects().filter((p) => p.id !== id);
  writeJson(STORAGE_KEYS.projects, next);
  return next;
}

export function addProductToProject(projectId, product) {
  const projects = getProjects().map((p) => {
    if (p.id !== projectId) return p;
    const exists = p.products.some((pp) => pp.id === product.id);
    if (exists) return p;
    return { ...p, products: [...p.products, product], updated_at: new Date().toISOString() };
  });
  writeJson(STORAGE_KEYS.projects, projects);
  return projects.find((p) => p.id === projectId);
}

export function removeProductFromProject(projectId, productId) {
  const projects = getProjects().map((p) => {
    if (p.id !== projectId) return p;
    return { ...p, products: p.products.filter((pp) => pp.id !== productId), updated_at: new Date().toISOString() };
  });
  writeJson(STORAGE_KEYS.projects, projects);
  return projects.find((p) => p.id === projectId);
}

// ── Alerts ──────────────────────────────────────────────────

export function getAlerts() {
  return readJson(STORAGE_KEYS.alerts, []);
}

export function createAlert(alert) {
  const alerts = getAlerts();
  const newAlert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    query: alert.query || "",
    vendor: alert.vendor || null,
    category: alert.category || null,
    active: true,
    created_at: new Date().toISOString(),
  };
  writeJson(STORAGE_KEYS.alerts, [newAlert, ...alerts]);
  return newAlert;
}

export function deleteAlert(id) {
  const next = getAlerts().filter((a) => a.id !== id);
  writeJson(STORAGE_KEYS.alerts, next);
  return next;
}

export function getAlertNotifications() {
  return readJson(STORAGE_KEYS.alertNotifications, []);
}

export function addAlertNotification(notification) {
  const current = getAlertNotifications();
  const next = [{ ...notification, id: `notif_${Date.now()}`, read: false, created_at: new Date().toISOString() }, ...current].slice(0, 50);
  writeJson(STORAGE_KEYS.alertNotifications, next);
  return next;
}

export function markNotificationsRead() {
  const next = getAlertNotifications().map((n) => ({ ...n, read: true }));
  writeJson(STORAGE_KEYS.alertNotifications, next);
  return next;
}

// ── Style Interaction Tracking ──────────────────────────────
// Tracks every product a designer clicks, saves, compares, or adds to project.
// Used to compute their visual taste profile (Style DNA).

export function getStyleInteractions() {
  return readJson(STORAGE_KEYS.styleInteractions, []);
}

export function trackStyleInteraction(productId, action) {
  if (!productId) return getStyleInteractions();
  const current = getStyleInteractions();
  const entry = {
    product_id: productId,
    action, // "click" | "favorite" | "compare" | "project" | "search"
    timestamp: new Date().toISOString(),
  };
  const next = [entry, ...current].slice(0, 200); // Keep last 200 interactions
  writeJson(STORAGE_KEYS.styleInteractions, next);
  return next;
}

// ── In-App Notifications ──────────────────────────────────

export function getNotifications() {
  return readJson(STORAGE_KEYS.notifications, []);
}

export function addNotification(notification) {
  const current = getNotifications();
  const next = [{
    ...notification,
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    read: false,
    created_at: new Date().toISOString(),
  }, ...current].slice(0, 50);
  writeJson(STORAGE_KEYS.notifications, next);
  return next;
}

export function markNotificationRead(id) {
  const next = getNotifications().map(n => n.id === id ? { ...n, read: true } : n);
  writeJson(STORAGE_KEYS.notifications, next);
  return next;
}

export function markAllNotificationsRead() {
  const next = getNotifications().map(n => ({ ...n, read: true }));
  writeJson(STORAGE_KEYS.notifications, next);
  return next;
}

export function getUnreadNotificationCount() {
  return getNotifications().filter(n => !n.read).length;
}

export function normalizeSearchResult(result) {
  return {
    id: result.id,
    name: result.product_name,
    product_name: result.product_name,
    manufacturer_name: result.manufacturer_name,
    thumbnail: result.image_url,
    image_url: result.image_url,
    portal_url: result.portal_url,
    wholesale_price: result.wholesale_price,
    retail_price: result.retail_price,
    lead_time_weeks: result.lead_time_max_weeks || result.lead_time_weeks,
    material: result.material,
    style: result.style || result.product_type,
    snippet: result.snippet,
    sku: result.sku,
    collection: result.collection,
    domain: result.domain,
  };
}

// ── Recently Viewed Products ────────────────────────────────

export function getRecentlyViewed() {
  return readJson(STORAGE_KEYS.recentlyViewed, []);
}

export function pushRecentlyViewed(product) {
  if (!product?.id) return getRecentlyViewed();
  const current = getRecentlyViewed().filter((entry) => entry.id !== product.id);
  const entry = {
    id: product.id,
    product_name: product.product_name,
    manufacturer_name: product.manufacturer_name,
    image_url: product.image_url,
    portal_url: product.portal_url,
    material: product.material,
    style: product.style,
    collection: product.collection,
    timestamp: new Date().toISOString(),
  };
  const next = [entry, ...current].slice(0, 10);
  writeJson(STORAGE_KEYS.recentlyViewed, next);
  return next;
}

// ── Quote Builder ────────────────────────────────────────────

export function getQuote() {
  return readJson(STORAGE_KEYS.quote, {
    id: null,
    name: "",
    client_name: "",
    designer_name: "",
    rooms: [{ id: "room_default", name: "Living Room", items: [] }],
    markup_percent: 0,
    notes: "",
    terms: "Prices valid for 30 days from quote date. Lead times are estimates and may vary. All items subject to availability.",
    created_at: null,
    updated_at: null,
  });
}

export function saveQuote(quote) {
  const updated = { ...quote, updated_at: new Date().toISOString() };
  writeJson(STORAGE_KEYS.quote, updated);
  debouncedQuoteSync(updated);
}

export function addToQuote(product, roomId) {
  const quote = getQuote();
  if (!quote.id) {
    quote.id = `quote_${Date.now()}`;
    quote.created_at = new Date().toISOString();
  }
  // Find target room or use first
  let room = quote.rooms.find(r => r.id === roomId) || quote.rooms[0];
  if (!room) {
    room = { id: "room_default", name: "Living Room", items: [] };
    quote.rooms.push(room);
  }
  // Check if already in any room
  for (const r of quote.rooms) {
    if (r.items.some(i => i.id === product.id)) return { quote, added: false, alreadyExists: true };
  }
  room.items.push({
    id: product.id,
    product_name: product.product_name,
    manufacturer_name: product.manufacturer_name,
    image_url: product.image_url,
    portal_url: product.portal_url || product.product_url,
    product_url: product.product_url || product.portal_url,
    retail_price: product.retail_price || null,
    wholesale_price: product.wholesale_price || null,
    material: product.material,
    style: product.style,
    sku: product.sku || "",
    collection: product.collection || "",
    dimensions: product.dimensions || null,
    width: product.width || null,
    depth: product.depth || null,
    height: product.height || null,
    description: product.description || product.snippet || "",
    category: product.category || product.product_type || "",
    vendor_id: product.vendor_id || "",
    image_contain: product.image_contain || false,
    quantity: 1,
    notes: "",
    added_at: new Date().toISOString(),
  });
  saveQuote(quote);
  return { quote, added: true, alreadyExists: false };
}

export function removeFromQuote(productId) {
  const quote = getQuote();
  for (const room of quote.rooms) {
    room.items = room.items.filter(i => i.id !== productId);
  }
  saveQuote(quote);
  return quote;
}

export function updateQuoteItem(productId, updates) {
  const quote = getQuote();
  for (const room of quote.rooms) {
    const item = room.items.find(i => i.id === productId);
    if (item) Object.assign(item, updates);
  }
  saveQuote(quote);
  return quote;
}

export function moveItemToRoom(productId, targetRoomId) {
  const quote = getQuote();
  let movedItem = null;
  for (const room of quote.rooms) {
    const idx = room.items.findIndex(i => i.id === productId);
    if (idx !== -1) {
      movedItem = room.items.splice(idx, 1)[0];
      break;
    }
  }
  if (movedItem) {
    const target = quote.rooms.find(r => r.id === targetRoomId);
    if (target) target.items.push(movedItem);
  }
  saveQuote(quote);
  return quote;
}

export function addQuoteRoom(name) {
  const quote = getQuote();
  if (!quote.id) {
    quote.id = `quote_${Date.now()}`;
    quote.created_at = new Date().toISOString();
  }
  const room = {
    id: `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name || "New Room",
    items: [],
  };
  quote.rooms.push(room);
  saveQuote(quote);
  return { quote, room };
}

export function removeQuoteRoom(roomId) {
  const quote = getQuote();
  quote.rooms = quote.rooms.filter(r => r.id !== roomId);
  if (quote.rooms.length === 0) {
    quote.rooms.push({ id: "room_default", name: "Living Room", items: [] });
  }
  saveQuote(quote);
  return quote;
}

export function renameQuoteRoom(roomId, name) {
  const quote = getQuote();
  const room = quote.rooms.find(r => r.id === roomId);
  if (room) room.name = name;
  saveQuote(quote);
  return quote;
}

export function getQuoteItemCount() {
  const quote = getQuote();
  return quote.rooms.reduce((sum, r) => sum + r.items.length, 0);
}

export function clearQuote() {
  writeJson(STORAGE_KEYS.quote, null);
  // Sync the empty state to server so it doesn't restore on next login
  const empty = { rooms: [{ id: "room_default", name: "Living Room", items: [] }], updated_at: new Date().toISOString() };
  syncQuoteToServer(empty).catch(() => {});
}

export function getQuoteSettings() {
  return readJson(STORAGE_KEYS.quoteSettings, {
    designer_name: "",
    business_name: "",
    email: "",
    phone: "",
    accent_color: "#c4a882",
    logo_data_url: "",
  });
}

export function saveQuoteSettings(settings) {
  writeJson(STORAGE_KEYS.quoteSettings, settings);
}

// ── Server sync on login ──
// Call this after login to merge server data with localStorage

const LAST_USER_KEY = "spec_growth_last_user_id";

function getCurrentUserId() {
  try {
    const raw = window.localStorage.getItem("spec_auth_user");
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id || user?.email || null;
  } catch { return null; }
}

function clearLocalUserData() {
  // Clear quote, favorites, and other per-user data when switching accounts
  writeJson(STORAGE_KEYS.quote, null);
  writeJson(STORAGE_KEYS.favorites, []);
  writeJson(STORAGE_KEYS.compareItems, []);
  writeJson(STORAGE_KEYS.projects, []);
  writeJson(STORAGE_KEYS.quoteSettings, null);
}

export async function syncFromServer() {
  if (!isLoggedIn()) return;

  // Detect account switch: if user ID changed, clear local data first
  const currentUserId = getCurrentUserId();
  if (currentUserId) {
    try {
      const lastUserId = window.localStorage.getItem(LAST_USER_KEY);
      if (lastUserId && lastUserId !== currentUserId) {
        clearLocalUserData();
      }
      window.localStorage.setItem(LAST_USER_KEY, currentUserId);
    } catch {}
  }

  try {
    const [serverFavs, serverQuote] = await Promise.all([
      fetchServerFavorites(),
      fetchServerQuote(),
    ]);
    // Favorites: server wins, then merge any local-only items
    if (serverFavs && serverFavs.length > 0) {
      const local = getFavorites();
      const merged = new Map();
      for (const f of serverFavs) merged.set(f.id, f);
      for (const f of local) { if (!merged.has(f.id)) merged.set(f.id, f); }
      writeJson(STORAGE_KEYS.favorites, [...merged.values()].slice(0, 40));
    }
    // Quote: always use server version for this account (only if it has items)
    const serverItemCount = serverQuote?.rooms?.reduce((s, r) => s + (r.items?.length || 0), 0) || 0;
    if (serverQuote && serverQuote.rooms && serverItemCount > 0) {
      writeJson(STORAGE_KEYS.quote, serverQuote);
    } else {
      // Server has no quote — check if local has items that belong to this user
      const localQuote = getQuote();
      const localItemCount = localQuote.rooms.reduce((s, r) => s + r.items.length, 0);
      if (localItemCount > 0) {
        syncQuoteToServer(localQuote).catch(() => {});
      }
    }
  } catch (err) {
    console.warn("[growth-store] Server sync failed:", err);
  }
}

export function normalizeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    product_name: product.name,
    manufacturer_name: product.manufacturer_name,
    thumbnail: product.thumbnail || product.images?.[0] || "",
    portal_url: product.portal_url || "",
    wholesale_price: product.price_wholesale_tier1,
    lead_time_weeks: product.lead_time_weeks,
  };
}
