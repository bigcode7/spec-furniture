import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  getPricingMode, setPricingMode as storePricingMode,
  getTradeDiscounts, saveTradeDiscounts,
  getVendorDiscount, setVendorDiscount as storeVendorDiscount,
  setDefaultDiscount as storeDefaultDiscount,
  hasAnyDiscounts,
  getDisplayPrice, calcTradePrice, formatPrice,
  getClientMarkup, setClientMarkup as storeClientMarkup,
  getShowPricing, setShowPricing as storeShowPricing,
} from "@/lib/trade-pricing";

const TradePricingContext = createContext(null);

export function TradePricingProvider({ children }) {
  const [mode, setMode] = useState(getPricingMode); // "retail" | "trade"
  const [discounts, setDiscounts] = useState(getTradeDiscounts);
  const [clientMarkup, setClientMarkup] = useState(getClientMarkup);
  const [showPricing, setShowPricingState] = useState(getShowPricing);

  // Listen for external changes (other tabs, etc.)
  useEffect(() => {
    const onTradeChange = () => setDiscounts(getTradeDiscounts());
    const onModeChange = (e) => setMode(e.detail || getPricingMode());
    const onShowChange = (e) => setShowPricingState(e.detail ?? getShowPricing());
    window.addEventListener("spec-trade-change", onTradeChange);
    window.addEventListener("spec-pricing-mode-change", onModeChange);
    window.addEventListener("spec-show-pricing-change", onShowChange);
    return () => {
      window.removeEventListener("spec-trade-change", onTradeChange);
      window.removeEventListener("spec-pricing-mode-change", onModeChange);
      window.removeEventListener("spec-show-pricing-change", onShowChange);
    };
  }, []);

  const toggleMode = useCallback(() => {
    const next = mode === "retail" ? "trade" : "retail";
    storePricingMode(next);
    setMode(next);
  }, [mode]);

  const setVendorDiscount = useCallback((vendorId, percent) => {
    storeVendorDiscount(vendorId, percent);
    setDiscounts(getTradeDiscounts());
  }, []);

  const setDefaultDiscount = useCallback((percent) => {
    storeDefaultDiscount(percent);
    setDiscounts(getTradeDiscounts());
  }, []);

  const updateClientMarkup = useCallback((percent) => {
    storeClientMarkup(percent);
    setClientMarkup(percent);
  }, []);

  const hasDiscounts = useMemo(() => hasAnyDiscounts(), [discounts]);

  const toggleShowPricing = useCallback(() => {
    const next = !showPricing;
    storeShowPricing(next);
    setShowPricingState(next);
  }, [showPricing]);

  // Helper: get price info for a product in current mode
  const getPrice = useCallback((product) => {
    if (!showPricing) return { price: null, label: "", isTrade: false };
    return getDisplayPrice(product, mode);
  }, [mode, showPricing]);

  // Helper: format a price number
  const fmtPrice = useCallback((price) => {
    return formatPrice(price);
  }, []);

  const value = useMemo(() => ({
    mode,
    toggleMode,
    discounts,
    hasDiscounts,
    clientMarkup,
    updateClientMarkup,
    setVendorDiscount,
    setDefaultDiscount,
    getPrice,
    fmtPrice,
    calcTradePrice,
    getVendorDiscount,
    showPricing,
    toggleShowPricing,
  }), [mode, toggleMode, discounts, hasDiscounts, clientMarkup, updateClientMarkup, setVendorDiscount, setDefaultDiscount, getPrice, fmtPrice, showPricing, toggleShowPricing]);

  return (
    <TradePricingContext.Provider value={value}>
      {children}
    </TradePricingContext.Provider>
  );
}

export function useTradePricing() {
  const ctx = useContext(TradePricingContext);
  if (!ctx) throw new Error("useTradePricing must be used within TradePricingProvider");
  return ctx;
}
