/**
 * Trade Pricing Store
 *
 * Persists per-vendor trade discount percentages in localStorage.
 * Designers enter their discount once per vendor; it stays forever.
 * Also stores the default discount for vendors without a specific entry.
 *
 * Storage key: spec_trade_discounts
 * Shape: { default_discount: 45, vendors: { "bernhardt": 48, "hooker": 42, ... } }
 */

const STORAGE_KEY = "spec_trade_discounts";
const PRICING_MODE_KEY = "spec_pricing_mode"; // "retail" | "trade" (session only)
const MARKUP_KEY = "spec_client_markup";
const SHOW_PRICING_KEY = "spec_show_pricing";

// ── Show/Hide Pricing Toggle ──

export function getShowPricing() {
  try {
    const val = localStorage.getItem(SHOW_PRICING_KEY);
    return val === null ? true : val === "true";
  } catch {
    return true;
  }
}

export function setShowPricing(show) {
  try {
    localStorage.setItem(SHOW_PRICING_KEY, String(show));
    window.dispatchEvent(new CustomEvent("spec-show-pricing-change", { detail: show }));
  } catch (e) {
    console.error("[trade-pricing] Error saving show pricing preference:", e.message);
  }
}

// ── Read / Write ──

export function getTradeDiscounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error("[trade-pricing] Error reading trade discounts:", e.message);
  }
  return { default_discount: 0, vendors: {} };
}

export function saveTradeDiscounts(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("spec-trade-change"));
  } catch (e) {
    console.error("[trade-pricing] Error saving trade discounts:", e.message);
  }
}

export function getVendorDiscount(vendorId) {
  const data = getTradeDiscounts();
  if (!vendorId) return data.default_discount || 0;
  return data.vendors[vendorId] ?? data.default_discount ?? 0;
}

export function setVendorDiscount(vendorId, percent) {
  const data = getTradeDiscounts();
  if (!data.vendors) data.vendors = {};
  data.vendors[vendorId] = percent;
  saveTradeDiscounts(data);
}

export function setDefaultDiscount(percent) {
  const data = getTradeDiscounts();
  data.default_discount = percent;
  saveTradeDiscounts(data);
}

export function hasAnyDiscounts() {
  const data = getTradeDiscounts();
  return (data.default_discount > 0) || Object.values(data.vendors || {}).some(v => v > 0);
}

// ── Pricing Mode (session only — defaults to retail on page load) ──

export function getPricingMode() {
  try {
    return sessionStorage.getItem(PRICING_MODE_KEY) || "retail";
  } catch {
    return "retail";
  }
}

export function setPricingMode(mode) {
  try {
    sessionStorage.setItem(PRICING_MODE_KEY, mode);
    window.dispatchEvent(new CustomEvent("spec-pricing-mode-change", { detail: mode }));
  } catch (e) {
    console.error("[trade-pricing] Error saving pricing mode:", e.message);
  }
}

// ── Client Markup ──

export function getClientMarkup() {
  try {
    const raw = localStorage.getItem(MARKUP_KEY);
    return raw ? parseFloat(raw) : 0;
  } catch {
    return 0;
  }
}

export function setClientMarkup(percent) {
  try {
    localStorage.setItem(MARKUP_KEY, String(percent));
  } catch (e) {
    console.error("[trade-pricing] Error saving client markup:", e.message);
  }
}

// ── Price Calculation ──

/**
 * Calculate the estimated trade price for a product.
 * @param {number} retailPrice - The retail/MSRP price
 * @param {string} vendorId - The vendor ID for discount lookup
 * @returns {number|null} Estimated trade price, or null if no discount set
 */
export function calcTradePrice(retailPrice, vendorId) {
  if (!retailPrice || retailPrice <= 0) return null;
  const discount = getVendorDiscount(vendorId);
  if (!discount || discount <= 0) return null;
  return Math.round(retailPrice * (1 - discount / 100));
}

/**
 * Get the display price based on current pricing mode.
 * @param {object} product - Product with retail_price, wholesale_price, vendor_id
 * @param {string} mode - "retail" or "trade"
 * @returns {{ price: number|null, label: string, isTrade: boolean }}
 */
export function getDisplayPrice(product, mode) {
  const retail = Number(product.retail_price) || Number(product.wholesale_price) || 0;
  if (!retail) return { price: null, label: "", isTrade: false };

  if (mode === "trade") {
    const vendorId = product.vendor_id || "";
    const trade = calcTradePrice(retail, vendorId);
    if (trade) {
      return { price: trade, label: "Est. Trade", isTrade: true };
    }
  }

  return { price: retail, label: "MSRP", isTrade: false };
}

/**
 * Format a price for display.
 */
export function formatPrice(price) {
  if (!price && price !== 0) return null;
  return `$${Math.round(Number(price)).toLocaleString()}`;
}
