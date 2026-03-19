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
  } catch {}
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
    } catch {}
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

      {/* Soft signup banner — shows after 10 searches */}
      <AnimatePresence>
        {showBanner && isGuest && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-16 left-0 right-0 z-50 mx-auto max-w-3xl px-4"
          >
            <div
              className="flex items-center gap-4 rounded-xl px-5 py-3.5"
              style={{
                background: "linear-gradient(135deg, rgba(79,107,255,0.12), rgba(201,169,110,0.12))",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(201,169,110,0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90 font-medium">
                  You've been sourcing like a pro.
                </p>
                <p className="text-xs text-white/50 mt-0.5">
                  Create a free account to save searches, build quotes, and organize projects.
                </p>
              </div>
              <button
                onClick={handleSignup}
                className="flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #C9A96E, #B8944F)",
                  color: "#0A0B10",
                }}
              >
                Create Free Account
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={dismissBanner}
                className="text-white/30 hover:text-white/60 transition-colors p-1"
                title="Maybe Later"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
