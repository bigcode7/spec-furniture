/**
 * GuestGate — Frictionless onboarding system.
 *
 * Tracks anonymous search count in localStorage. After 10 searches, shows
 * a non-intrusive banner prompting account creation. Gates quote/project/save
 * features behind a signup modal.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { X, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SEARCH_COUNT_KEY = "spec_guest_search_count";
const BANNER_DISMISSED_KEY = "spec_signup_banner_dismissed";
const SEARCH_THRESHOLD = 10;

const GuestGateContext = createContext();

function getSearchCount() {
  try {
    return parseInt(localStorage.getItem(SEARCH_COUNT_KEY) || "0", 10);
  } catch {
    return 0;
  }
}

function setSearchCount(n) {
  try {
    localStorage.setItem(SEARCH_COUNT_KEY, String(n));
  } catch (e) {
    console.error("[GuestGate] Failed to save search count:", e.message || e);
  }
}

function isBannerDismissed() {
  try {
    return sessionStorage.getItem(BANNER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function GuestGateProvider({ children }) {
  const { user, isAuthenticated, navigateToLogin } = useAuth();
  const [searchCount, _setSearchCount] = useState(getSearchCount);
  const [showBanner, setShowBanner] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // { type, payload }

  const isGuest = !isAuthenticated || !user;

  // Increment search count (called from Search page after each search)
  const trackSearch = useCallback(() => {
    const next = getSearchCount() + 1;
    setSearchCount(next);
    _setSearchCount(next);

    if (next >= SEARCH_THRESHOLD && isGuest && !isBannerDismissed()) {
      setShowBanner(true);
    }
  }, [isGuest]);

  // Dismiss the soft banner for this session
  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    try {
      sessionStorage.setItem(BANNER_DISMISSED_KEY, "1");
    } catch (e) {
      console.error("[GuestGate] Failed to dismiss banner:", e.message || e);
    }
  }, []);

  // Gate a feature: if logged in, run the action. If guest, open auth modal.
  const requireAccount = useCallback((actionType, payload, action) => {
    if (!isGuest) {
      action();
      return;
    }
    setPendingAction({ type: actionType, payload, action });
    navigateToLogin("signup");
  }, [isGuest, navigateToLogin]);

  // After signup, run the pending action
  const completePendingAction = useCallback(() => {
    if (pendingAction?.action) {
      pendingAction.action();
    }
    setPendingAction(null);
    setShowSignupModal(false);
  }, [pendingAction]);

  const handleSignup = useCallback(() => {
    navigateToLogin("signup");
  }, [navigateToLogin]);

  // Check on mount if banner should show
  useEffect(() => {
    if (isGuest && getSearchCount() >= SEARCH_THRESHOLD && !isBannerDismissed()) {
      setShowBanner(true);
    }
  }, [isGuest]);

  return (
    <GuestGateContext.Provider value={{
      isGuest,
      searchCount,
      trackSearch,
      requireAccount,
      showSignupModal,
      setShowSignupModal,
    }}>
      {children}

      {/* Soft signup banner disabled — paywall handles conversion at 3 searches */}

    </GuestGateContext.Provider>
  );
}

export function useGuestGate() {
  const context = useContext(GuestGateContext);
  if (!context) {
    throw new Error("useGuestGate must be used within a GuestGateProvider");
  }
  return context;
}
