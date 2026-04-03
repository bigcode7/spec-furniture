import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { House, Search, FileText, LogOut, UserPlus, User, Settings, HelpCircle, ChevronDown, Tag, Sparkles } from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { getQuoteItemCount } from "@/lib/growth-store";
import { useAuth } from "@/lib/AuthContext";
import { checkSubscriptionStatus } from "@/lib/fingerprint";

const EASE = [0.22, 1, 0.36, 1];

const NAV_ITEMS = [
  { label: "Home", path: "Dashboard", icon: House },
  { label: "Search", path: "Search", icon: Search },
  { label: "Quotes", path: "Quotes", icon: FileText },
];

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 50, restDelta: 0.001 });
  return (
    <motion.div
      className="scroll-progress"
      style={{ scaleX, width: "100%", height: "2px", background: "#2C3E2D" }}
    />
  );
}

function AppAtmosphere() {
  return (
    <div className="app-atmosphere">
      <div className="glow glow-1" />
      <div className="glow glow-2" />
      <div className="glow glow-3" />
    </div>
  );
}

function AccountDropdown({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const initial = (user.full_name || user.email || "U")[0].toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-1 py-1 transition-colors hover:bg-black/[0.04]"
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
          style={{
            background: "rgba(44,62,45,0.10)",
            border: "1px solid rgba(44,62,45,0.15)",
            color: "#2C3E2D",
          }}
        >
          {initial}
        </div>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "#9B9590" }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden z-50"
            style={{
              background: "rgba(255,255,255,0.95)",
              border: "1px solid rgba(44,62,45,0.08)",
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            {/* Accent line at top */}
            <div
              className="h-[1px] w-full"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(44,62,45,0.15), transparent)",
              }}
            />

            {/* User info header */}
            <div className="px-4 py-3.5" style={{ borderBottom: "1px solid rgba(44,62,45,0.06)" }}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold shrink-0"
                  style={{
                    background: "rgba(44,62,45,0.08)",
                    border: "1px solid rgba(44,62,45,0.12)",
                    color: "#2C3E2D",
                  }}
                >
                  {initial}
                </div>
                <div className="min-w-0">
                  {user.full_name && (
                    <p className="text-sm font-medium truncate" style={{ color: "#1A1A18" }}>{user.full_name}</p>
                  )}
                  <p className="text-[11px] truncate" style={{ color: "#9B9590" }}>{user.email}</p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <Link
                to="/Account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-xs transition-colors"
                style={{ color: "#6B6560" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#1A1A18"; e.currentTarget.style.background = "rgba(44,62,45,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#6B6560"; e.currentTarget.style.background = "transparent"; }}
              >
                <User className="h-4 w-4" style={{ color: "#9B9590" }} />
                My Account
              </Link>
              <Link
                to="/Account?section=discounts"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-xs transition-colors"
                style={{ color: "#6B6560" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#1A1A18"; e.currentTarget.style.background = "rgba(44,62,45,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#6B6560"; e.currentTarget.style.background = "transparent"; }}
              >
                <Tag className="h-4 w-4" style={{ color: "#9B9590" }} />
                My Trade Discounts
              </Link>
              <Link
                to="/Account?section=preferences"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-xs transition-colors"
                style={{ color: "#6B6560" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#1A1A18"; e.currentTarget.style.background = "rgba(44,62,45,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#6B6560"; e.currentTarget.style.background = "transparent"; }}
              >
                <Settings className="h-4 w-4" style={{ color: "#9B9590" }} />
                Settings
              </Link>
              <a
                href="mailto:support@spekd.ai"
                className="flex items-center gap-3 px-4 py-2.5 text-xs transition-colors"
                style={{ color: "#6B6560" }}
                onClick={() => setOpen(false)}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#1A1A18"; e.currentTarget.style.background = "rgba(44,62,45,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#6B6560"; e.currentTarget.style.background = "transparent"; }}
              >
                <HelpCircle className="h-4 w-4" style={{ color: "#9B9590" }} />
                Help / Feedback
              </a>
            </div>

            {/* Sign out */}
            <div className="py-1.5" style={{ borderTop: "1px solid rgba(44,62,45,0.06)" }}>
              <button
                onClick={() => { logout(); setOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-xs transition-colors cursor-pointer"
                style={{ color: "#9B9590" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.background = "rgba(220,38,38,0.04)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#9B9590"; e.currentTarget.style.background = "transparent"; }}
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DropdownItem({ icon: Icon, label, disabled }) {
  return (
    <button
      disabled={disabled}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-xs transition-colors ${
        disabled
          ? "text-white/25 cursor-default"
          : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
      }`}
    >
      <Icon className="h-4 w-4 text-white/25" />
      {label}
      {disabled && <span className="ml-auto text-[9px] text-white/15">Soon</span>}
    </button>
  );
}

function AppFooter() {
  return (
    <footer className="relative mt-20" style={{ background: "#2C3E2D" }}>
      <div className="page-wrap-wide py-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)" }}>
                <img src="/logo.png" alt="SPEKD" className="h-6 w-6 object-contain rounded brightness-[2] invert" />
              </div>
              <div className="flex flex-col">
                <span className="font-brand text-sm tracking-[0.24em] text-white/80 font-medium">SPEKD</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">Interior Sourcing Studio</span>
              </div>
            </div>
            <span className="hidden md:inline text-white/15">|</span>
            <span className="text-[11px] text-white/30">
              &copy; {new Date().getFullYear()} SPEKD. All rights reserved.
            </span>
          </div>

          <nav className="flex items-center gap-4 text-[11px]">
            <Link to={createPageUrl("About")} className="text-white/40 hover:text-white/70 transition-colors">About</Link>
            <span className="text-white/15">&middot;</span>
            <a href="mailto:support@spekd.ai" className="text-white/40 hover:text-white/70 transition-colors">Contact</a>
            <span className="text-white/15">&middot;</span>
            <Link to={createPageUrl("Privacy")} className="text-white/40 hover:text-white/70 transition-colors">Privacy</Link>
            <span className="text-white/15">&middot;</span>
            <Link to={createPageUrl("Terms")} className="text-white/40 hover:text-white/70 transition-colors">Terms</Link>
          </nav>

          <div className="flex items-center gap-2.5">
            <a href="https://linkedin.com/company/spekd" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full text-white/25 hover:text-white/50 transition-all cursor-pointer" title="LinkedIn" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a href="https://instagram.com/spekd.ai" target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-full text-white/25 hover:text-white/50 transition-all cursor-pointer" title="Instagram" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </a>
          </div>
        </div>

        <p className="text-[10px] text-white/15 text-center mt-8 max-w-xl mx-auto leading-relaxed">
          All product images and content are property of their respective vendors. Spekd.ai is a discovery platform and does not claim ownership of any vendor assets.
        </p>
      </div>
    </footer>
  );
}

export default function Layout({ children, currentPageName }) {
  const { user, navigateToLogin, logout } = useAuth();
  const [quoteCount, setQuoteCount] = useState(0);
  const [subWarning, setSubWarning] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);
  const location = useLocation();

  useEffect(() => {
    checkSubscriptionStatus().then(status => {
      setSubStatus(status.status);
      if (status.trial_days_remaining != null) {
        setTrialDaysLeft(status.trial_days_remaining);
      }
      if (status.status === "past_due") {
        setSubWarning("Your payment failed. Update your card to keep your access.");
      }
    });
  }, [location.search, user]); // Re-check when URL changes or user changes

  // Listen for subscription changes (e.g. after Stripe checkout verification)
  useEffect(() => {
    const handler = (e) => {
      const { status, trial_days_remaining } = e.detail || {};
      if (status) setSubStatus(status);
      if (trial_days_remaining != null) setTrialDaysLeft(trial_days_remaining);
    };
    window.addEventListener("spec:subscription-changed", handler);
    return () => window.removeEventListener("spec:subscription-changed", handler);
  }, []);

  useEffect(() => {
    setQuoteCount(getQuoteItemCount());
    const onStorage = (e) => {
      if (e.key === "spec_growth_quote") setQuoteCount(getQuoteItemCount());
    };
    window.addEventListener("storage", onStorage);
    const onQuoteChange = () => setQuoteCount(getQuoteItemCount());
    window.addEventListener("spec-quote-change", onQuoteChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("spec-quote-change", onQuoteChange);
    };
  }, []);

  // Landing page renders without nav chrome
  if (currentPageName === "Landing") return <>{children}</>;

  return (
    <div className="app-shell min-h-screen flex flex-col" style={{ color: "#1A1A18" }}>

      <header className="sticky top-0 z-40" style={{ background: "rgba(245,240,232,0.85)", backdropFilter: "blur(20px) saturate(1.2)", WebkitBackdropFilter: "blur(20px) saturate(1.2)", borderBottom: "1px solid rgba(44,62,45,0.06)" }}>
        <div className="page-wrap-wide">
          <div className="flex h-[68px] sm:h-[72px] items-center justify-between gap-3 sm:gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl shrink-0" style={{ background: "rgba(255,255,255,0.70)", border: "1px solid rgba(44,62,45,0.08)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <img src="/logo.png" alt="SPEKD" className="h-6 w-6 sm:h-7 sm:w-7 object-contain rounded-lg" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="font-brand text-base sm:text-lg tracking-[0.24em] sm:tracking-[0.28em] font-medium truncate" style={{ color: "#2C3E2D" }}>
                  SPEKD
                </span>
                <span className="hidden sm:block text-[10px] uppercase tracking-[0.24em]" style={{ color: "#9B9590" }}>
                  Interior Sourcing Studio
                </span>
              </div>
            </Link>

            {/* Center nav — hidden on mobile, shown on md+ */}
            <nav className="hidden md:flex items-center gap-1 rounded-full px-2 py-1.5" style={{ background: "rgba(255,255,255,0.50)", border: "1px solid rgba(44,62,45,0.06)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
              {NAV_ITEMS.map((item) => {
                // Hide Quotes nav for guests
                if (item.path === "Quotes" && !user) return null;
                const active = currentPageName === item.path;
                return (
                  <Link
                    key={item.path}
                    to={createPageUrl(item.path)}
                    className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                      active ? "" : "hover:opacity-70"
                    }`}
                    style={{ color: active ? "#2C3E2D" : "#9B9590" }}
                  >
                    <item.icon className="h-3.5 w-3.5 relative z-[1]" />
                    <span className="relative z-[1]">{item.label}</span>
                    {item.path === "Quotes" && quoteCount > 0 && (
                      <span
                        className="relative z-[1] flex h-4 min-w-[16px] items-center justify-center rounded-full text-[10px] font-bold px-1"
                        style={{ background: "rgba(44,62,45,0.10)", color: "#2C3E2D" }}
                      >
                        {quoteCount}
                      </span>
                    )}
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: "rgba(44,62,45,0.08)",
                          border: "1px solid rgba(44,62,45,0.10)",
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right side — account + trial CTA */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {currentPageName === "Quotes" && (
                <Link
                  to={createPageUrl("Search")}
                  className="hidden sm:flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all hover:opacity-90"
                  style={{
                    background: "rgba(44,62,45,0.06)",
                    border: "1px solid rgba(44,62,45,0.10)",
                    color: "#2C3E2D",
                  }}
                >
                  <Search className="h-3.5 w-3.5" />
                  Start Search
                </Link>
              )}
              {/* Trial countdown — shown when user has active trial */}
              {user && subStatus === "trialing" && trialDaysLeft != null && (
                <div
                  className="flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-medium"
                  style={{
                    background: "rgba(184,149,106,0.10)",
                    border: "1px solid rgba(184,149,106,0.20)",
                    color: "#96744D",
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="hidden sm:inline">Pro Trial — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left</span>
                  <span className="sm:hidden">{trialDaysLeft}d left</span>
                </div>
              )}
              {/* Start Free Trial — shown for logged-in users without subscription */}
              {user && subStatus && subStatus !== "active" && subStatus !== "trialing" && subStatus !== "cancelled" && (
                <Link
                  to={createPageUrl("Search") + "?upgrade=true"}
                  className="flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold transition-all hover:opacity-90"
                  style={{
                    background: "#2C3E2D",
                    border: "1px solid rgba(44,62,45,0.3)",
                    color: "#fff",
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="hidden sm:inline">Start Free Trial</span>
                  <span className="sm:hidden">Trial</span>
                </Link>
              )}
              {user ? (
                <AccountDropdown user={user} logout={logout} />
              ) : (
                <button
                  onClick={() => navigateToLogin("signup")}
                  className="flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 text-[11px] sm:text-xs font-semibold transition-all hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, rgba(196,162,101,0.2), rgba(196,162,101,0.1))",
                    border: "1px solid rgba(196,162,101,0.3)",
                    color: "#C4A265",
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Sign Up Free
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Subtle bottom line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1px]"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(44,62,45,0.06), rgba(44,62,45,0.10), rgba(44,62,45,0.06), transparent)",
          }}
        />
      </header>

      {subWarning && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-center">
          <span className="text-xs text-amber-400">{subWarning}</span>
          <button
            onClick={async () => {
              const token = localStorage.getItem("spec_auth_token");
              const resp = await fetch(`${(import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "")}/subscribe/portal`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              });
              const data = await resp.json();
              if (data.portal_url) window.location.href = data.portal_url;
            }}
            className="ml-3 text-xs font-semibold text-amber-400 underline hover:text-amber-300"
          >
            Update payment
          </button>
        </div>
      )}

      <div className="nav-separator" />
      <ScrollProgress />

      <main className="relative flex-1 pb-20 md:pb-0">
        <motion.div
          key={currentPageName}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </motion.div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden" style={{ background: "rgba(245,240,232,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid rgba(44,62,45,0.06)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around h-[68px]">
          {[
            { path: "Dashboard", icon: House, label: "Home" },
            { path: "Search", icon: Search, label: "Search" },
          ].map((item) => {
            const active = currentPageName === item.path;
            return (
              <Link
                key={item.path}
                to={createPageUrl(item.path)}
                className="flex flex-col items-center gap-1 px-4 py-2"
                style={{ color: active ? "#2C3E2D" : "#9B9590" }}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
                {active && (
                  <span
                    className="absolute bottom-2 h-1 w-1 rounded-full"
                    style={{ background: "rgba(196,162,101,0.8)", boxShadow: "0 0 6px rgba(196,162,101,0.5)" }}
                  />
                )}
              </Link>
            );
          })}
          {user && (
            <Link
              to={createPageUrl("Quotes")}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 ${currentPageName === "Quotes" ? "text-gold" : "text-white/35"}`}
            >
              <FileText className="h-5 w-5" />
              <span className="text-[10px] font-medium">Quotes</span>
              {quoteCount > 0 && (
                <span className="absolute -top-0.5 right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full text-[9px] font-bold px-1" style={{ background: "rgba(196,162,101,0.25)", color: "#C4A265" }}>{quoteCount}</span>
              )}
              {currentPageName === "Quotes" && (
                <span
                  className="absolute bottom-2 h-1 w-1 rounded-full"
                  style={{ background: "rgba(196,162,101,0.8)", boxShadow: "0 0 6px rgba(196,162,101,0.5)" }}
                />
              )}
            </Link>
          )}
          <Link
            to={user ? "/Account" : "#"}
            onClick={(e) => { if (!user) { e.preventDefault(); navigateToLogin("signup"); } }}
            className={`relative flex flex-col items-center gap-1 px-4 py-2 ${currentPageName === "Account" ? "text-gold" : "text-white/35"}`}
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-medium">{user ? "Account" : "Sign Up"}</span>
            {currentPageName === "Account" && (
              <span
                className="absolute bottom-2 h-1 w-1 rounded-full"
                style={{ background: "rgba(196,162,101,0.8)", boxShadow: "0 0 6px rgba(196,162,101,0.5)" }}
              />
            )}
          </Link>
        </div>
      </nav>

      <AppFooter />
    </div>
  );
}
