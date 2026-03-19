import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import {
  getPricingMode, setPricingMode as storePricingMode,
  getTradeDiscounts, saveTradeDiscounts,
  getVendorDiscount, setVendorDiscount as storeVendorDiscount,
  setDefaultDiscount as storeDefaultDiscount,
  hasAnyDiscounts,
  getDisplayPrice, calcTradePrice, formatPrice,
  getClientMarkup, setClientMarkup as storeClientMarkup,
} from "@/lib/trade-pricing";

const TradePricingContext = createContext(null);

export function TradePricingProvider({ children }) {
  const [mode, setMode] = useState(getPricingMode); // "retail" | "trade"
  const [discounts, setDiscounts] = useState(getTradeDiscounts);
  const [clientMarkup, setClientMarkup] = useState(getClientMarkup);

  // Listen for external changes (other tabs, etc.)
  useEffect(() => {
    const onTradeChange = () => setDiscounts(getTradeDiscounts());
    const onModeChange = (e) => setMode(e.detail || getPricingMode());
    window.addEventListener("spec-trade-change", onTradeChange);
    window.addEventListener("spec-pricing-mode-change", onModeChange);
    return () => {
      window.removeEventListener("spec-trade-change", onTradeChange);
      window.removeEventListener("spec-pricing-mode-change", onModeChange);
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

  // Helper: get price info for a product in current mode
  const getPrice = useCallback((product) => {
    return getDisplayPrice(product, mode);
  }, [mode]);

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
  }), [mode, toggleMode, discounts, hasDiscounts, clientMarkup, updateClientMarkup, setVendorDiscount, setDefaultDiscount, getPrice, fmtPrice]);

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
