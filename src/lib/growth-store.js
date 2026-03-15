const isBrowser = typeof window !== "undefined";

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
};

function readJson(key, fallback) {
  if (!isBrowser) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
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
