import { useAuth } from "@/lib/AuthContext";
import { useState, useCallback } from "react";

/**
 * Hook to gate features behind paywall.
 * Returns { gateAction, showUpgradeModal, setShowUpgradeModal, upgradeMessage }
 *
 * Usage:
 *   const { gateAction, showUpgradeModal, setShowUpgradeModal, upgradeMessage } = usePaywallGate();
 *   const handleFavorite = gateAction("favorites", "Upgrade to save products", () => doSomething());
 */
export function usePaywallGate() {
  const { user, isAuthenticated } = useAuth();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  const isSubscribed = useCallback(() => {
    if (!isAuthenticated) return false;
    // Check localStorage for subscription status
    try {
      const status = localStorage.getItem("spec_sub_status");
      return status === "active" || status === "trialing" || status === "cancelled"; // trialing/cancelled still have access
    } catch {
      return false;
    }
  }, [isAuthenticated]);

  const gateAction = useCallback((feature, message, action) => {
    return (...args) => {
      if (isSubscribed()) {
        return action(...args);
      }
      setUpgradeMessage(message);
      setShowUpgradeModal(true);
    };
  }, [isSubscribed]);

  return { gateAction, showUpgradeModal, setShowUpgradeModal, upgradeMessage, isSubscribed };
}
