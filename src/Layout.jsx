import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, FileText, LogOut, UserPlus, User, Settings, HelpCircle, ChevronDown, Tag, Menu, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { getQuoteItemCount } from "@/lib/growth-store";
import { useAuth } from "@/lib/AuthContext";
import { checkSubscriptionStatus } from "@/lib/fingerprint";

const EASE = [0.22, 1, 0.36, 1];

const NAV_ITEMS = [
  { label: "Search", path: "Search", icon: Search },
  { label: "Quotes", path: "Quotes", icon: FileText },
];

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 50, restDelta: 0.001 });
  return (
    <motion.div
      className="scroll-progress"
      style={{ scaleX, width: "100%" }}
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
        className="flex items-center gap-1.5 rounded-full px-1 py-1 transition-colors hover:bg-white/[0.04]"
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white/80"
          style={{
            background: "rgba(79,107,255,0.15)",
            border: "1px solid rgba(79,107,255,0.25)",
            boxShadow: "0 0 12px rgba(79,107,255,0.1)",
          }}
        >
          {initial}
        </div>
        <ChevronDown className={`h-3 w-3 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden shadow-2xl z-50"
            style={{
              background: "rgba(16,17,24,0.97)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* User info header */}
            <div className="px-4 py-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white/80 shrink-0"
                  style={{
                    background: "rgba(79,107,255,0.15)",
                    border: "1px solid rgba(79,107,255,0.25)",
                  }}
                >
                  {initial}
                </div>
                <div className="min-w-0">
                  {user.full_name && (
                    <p className="text-sm font-medium text-white/80 truncate">{user.full_name}</p>
                  )}
                  <p className="text-[11px] text-white/35 truncate">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <Link
                to="/Account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
              >
                <User className="h-4 w-4 text-white/25" />
                My Account
              </Link>
              <Link
                to="/Account?section=discounts"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
              >
                <Tag className="h-4 w-4 text-white/25" />
                My Trade Discounts
              </Link>
              <Link
                to="/Account?section=preferences"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
              >
                <Settings className="h-4 w-4 text-white/25" />
                Settings
              </Link>
              <a
                href="mailto:support@spekd.ai"
                className="flex items-center gap-3 px-4 py-2.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
                onClick={() => setOpen(false)}
              >
                <HelpCircle className="h-4 w-4 text-white/25" />
                Help / Feedback
              </a>
            </div>

            {/* Sign out */}
            <div className="border-t border-white/[0.06] py-1.5">
              <button
                onClick={() => { logout(); setOpen(false); }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-xs text-white/40 hover:text-red-400/80 hover:bg-white/[0.04] transition-colors"
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
    <footer className="relative mt-20 border-t border-white/[0.06]">
      <div className="page-wrap py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left */}
          <div className="text-[11px] text-white/25">
            &copy; {new Date().getFullYear()} SPEKD. All rights reserved.
          </div>

          {/* Center — links */}
          <nav className="flex items-center gap-4 text-[11px]">
            <Link to={createPageUrl("About")} className="text-white/30 hover:text-white/60 transition-colors">
              About
            </Link>
            <span className="text-white/10">·</span>
            <a href="mailto:support@spekd.ai" className="text-white/30 hover:text-white/60 transition-colors">
              Contact
            </a>
            <span className="text-white/10">·</span>
            <Link to={createPageUrl("Privacy")} className="text-white/30 hover:text-white/60 transition-colors">
              Privacy Policy
            </Link>
            <span className="text-white/10">·</span>
            <Link to={createPageUrl("Terms")} className="text-white/30 hover:text-white/60 transition-colors">
              Terms of Service
            </Link>
          </nav>

          {/* Right — social icons */}
          <div className="flex items-center gap-3">
            <a
              href="https://linkedin.com/company/spekd"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
              title="LinkedIn"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            <a
              href="https://instagram.com/spekd.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
              title="Instagram"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
              </svg>
            </a>
          </div>
        </div>

        <p className="text-[10px] text-white/10 text-center mt-6 max-w-xl mx-auto leading-relaxed">
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
  const location = useLocation();

  useEffect(() => {
    checkSubscriptionStatus().then(status => {
      setSubStatus(status.status);
      if (status.status === "past_due") {
        setSubWarning("Your payment failed. Update your card to keep your access.");
      }
    });
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
    <div className="min-h-screen text-white flex flex-col">
      <AppAtmosphere />

      <header className="glass-header sticky top-0 z-40">
        <div className="page-wrap">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <span className="spec-diamond mr-1" />
              <span className="font-brand text-lg tracking-[0.2em] text-white/90 font-medium">
                SPEKD
              </span>
            </Link>

            {/* Center nav — hidden on mobile, shown on md+ */}
            <nav className="hidden md:flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                // Hide Quotes nav for guests
                if (item.path === "Quotes" && !user) return null;
                const active = currentPageName === item.path;
                return (
                  <Link
                    key={item.path}
                    to={createPageUrl(item.path)}
                    className={`relative inline-flex items-center gap-2 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                      active ? "text-white" : "text-white/35 hover:text-white/60"
                    }`}
                  >
                    {item.label}
                    {item.path === "Quotes" && quoteCount > 0 && (
                      <span
                        className="flex h-4 min-w-[16px] items-center justify-center rounded-full text-[10px] font-bold px-1"
                        style={{ background: "rgba(201,169,110,0.25)", color: "#C9A96E" }}
                      >
                        {quoteCount}
                      </span>
                    )}
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full"
                        style={{
                          background: "var(--gold)",
                          boxShadow: "0 2px 12px rgba(79,107,255,0.4)",
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right side — account + trial CTA */}
            <div className="flex items-center gap-2.5">
              {user && subStatus && subStatus !== "active" && subStatus !== "trialing" && subStatus !== "cancelled" && (
                <Link
                  to={createPageUrl("Search") + "?upgrade=true"}
                  className="flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-[11px] sm:text-xs font-semibold transition-all hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, rgba(201,169,110,0.2), rgba(201,169,110,0.1))",
                    border: "1px solid rgba(201,169,110,0.3)",
                    color: "#C9A96E",
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
                  className="flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all hover:brightness-110"
                  style={{
                    background: "linear-gradient(135deg, rgba(201,169,110,0.2), rgba(201,169,110,0.1))",
                    border: "1px solid rgba(201,169,110,0.3)",
                    color: "#C9A96E",
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Sign Up Free
                </button>
              )}
            </div>
          </div>
        </div>
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

      <main className="relative flex-1 pb-16 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden border-t border-white/[0.06] bg-[#08090E]/95 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around h-14">
          <Link
            to={createPageUrl("Search")}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 ${currentPageName === "Search" ? "text-gold" : "text-white/35"}`}
          >
            <Search className="h-5 w-5" />
            <span className="text-[10px] font-medium">Search</span>
          </Link>
          {user && (
            <Link
              to={createPageUrl("Quotes")}
              className={`relative flex flex-col items-center gap-0.5 px-4 py-1.5 ${currentPageName === "Quotes" ? "text-gold" : "text-white/35"}`}
            >
              <FileText className="h-5 w-5" />
              <span className="text-[10px] font-medium">Quotes</span>
              {quoteCount > 0 && (
                <span className="absolute -top-0.5 right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full text-[9px] font-bold px-1" style={{ background: "rgba(201,169,110,0.25)", color: "#C9A96E" }}>{quoteCount}</span>
              )}
            </Link>
          )}
          <Link
            to={user ? "/Account" : "#"}
            onClick={(e) => { if (!user) { e.preventDefault(); navigateToLogin("signup"); } }}
            className={`flex flex-col items-center gap-0.5 px-4 py-1.5 ${currentPageName === "Account" ? "text-gold" : "text-white/35"}`}
          >
            <User className="h-5 w-5" />
            <span className="text-[10px] font-medium">{user ? "Account" : "Sign Up"}</span>
          </Link>
        </div>
      </nav>

      <AppFooter />
    </div>
  );
}
