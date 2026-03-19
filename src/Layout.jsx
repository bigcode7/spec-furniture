import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, FileText, LogOut, UserPlus } from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { useState, useEffect } from "react";
import { getQuoteItemCount } from "@/lib/growth-store";
import { useAuth } from "@/lib/AuthContext";

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

export default function Layout({ children, currentPageName }) {
  const { user, navigateToLogin, logout } = useAuth();
  const [quoteCount, setQuoteCount] = useState(0);
  const location = useLocation();

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

  return (
    <div className="min-h-screen text-white">
      <AppAtmosphere />

      <header className="glass-header sticky top-0 z-40">
        <div className="page-wrap">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Logo */}
            <Link to={createPageUrl("Search")} className="flex items-center gap-2">
              <span className="spec-diamond mr-1" />
              <span className="font-brand text-lg tracking-[0.2em] text-white/90 font-medium">
                SPEKD
              </span>
            </Link>

            {/* Center nav */}
            <nav className="flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
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

            {/* Right side — account only */}
            <div className="flex items-center gap-2.5">
              {user ? (
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white/80"
                    style={{
                      background: "rgba(79,107,255,0.15)",
                      border: "1px solid rgba(79,107,255,0.25)",
                      boxShadow: "0 0 12px rgba(79,107,255,0.1)",
                    }}
                  >
                    {(user.full_name || user.email || "U")[0].toUpperCase()}
                  </div>
                  <button
                    onClick={() => logout()}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white/20 transition-colors hover:bg-white/[0.06] hover:text-white/40"
                    title="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
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

      <div className="nav-separator" />
      <ScrollProgress />

      <main className="relative">
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

      <footer className="relative mt-20 border-t border-white/[0.04] py-6">
        <p className="text-[10px] text-white/10 text-center max-w-xl mx-auto leading-relaxed">
          All product images and content are property of their respective vendors. Spekd.ai is a discovery platform and does not claim ownership of any vendor assets.
        </p>
      </footer>
    </div>
  );
}
