import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, GitCompare, Home, LogOut, FolderOpen, ClipboardList, Package2, Brain, BarChart3, ChevronDown, Sparkles, FileText, UserPlus } from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import CommandPalette from "@/components/CommandPalette";
import SpecChat from "@/components/SpecChat";
import AlertBell from "@/components/AlertBell";
import NotificationCenter from "@/components/NotificationCenter";
import QuotePanel from "@/components/QuotePanel";
import { getQuoteItemCount } from "@/lib/growth-store";
import { useAuth } from "@/lib/AuthContext";
import PriceToggle from "@/components/PriceToggle";
import TradeDiscountSettings from "@/components/TradeDiscountSettings";

const EASE = [0.22, 1, 0.36, 1];

const PRIMARY_NAV = [
  { label: "Home", path: "Dashboard", icon: Home },
  { label: "Search", path: "Search", icon: Search },
  { label: "Projects", path: "Projects", icon: FolderOpen },
  { label: "Intelligence", path: "Intelligence", icon: Brain },
];

const MORE_NAV = [
  { label: "Compare", path: "Compare", icon: GitCompare },
  { label: "Showcase", path: "Showcase", icon: Sparkles },
  { label: "Vendor Portal", path: "VendorDashboard", icon: BarChart3 },
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

// ── App-wide gradient atmosphere ──
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteCount, setQuoteCount] = useState(0);
  const [tradeSettingsOpen, setTradeSettingsOpen] = useState(false);
  const moreRef = useRef(null);
  const location = useLocation();

  // Track quote item count — refresh on storage events and periodically
  useEffect(() => {
    setQuoteCount(getQuoteItemCount());
    const onStorage = (e) => {
      if (e.key === "spec_growth_quote") setQuoteCount(getQuoteItemCount());
    };
    window.addEventListener("storage", onStorage);
    // Also listen for custom event dispatched when quote changes within same tab
    const onQuoteChange = () => setQuoteCount(getQuoteItemCount());
    window.addEventListener("spec-quote-change", onQuoteChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("spec-quote-change", onQuoteChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const roleItems = [
    ...(user?.role === "designer" ? [{ label: "Projects", path: "Projects", icon: FolderOpen }] : []),
    ...(user?.role === "manufacturer" || user?.role === "admin" ? [{ label: "Catalog", path: "ManufacturerCatalog", icon: Package2 }] : []),
    ...(user?.role ? [{ label: "Orders", path: "Orders", icon: ClipboardList }] : []),
  ];

  const moreItems = [...MORE_NAV, ...roleItems];
  const isMoreActive = moreItems.some((item) => currentPageName === item.path);

  useEffect(() => {
    const handleClick = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (currentPageName === "Landing") return <>{children}</>;

  return (
    <div className="min-h-screen text-white">
      {/* Living gradient atmosphere on every page */}
      <AppAtmosphere />

      <header className="glass-header sticky top-0 z-40">
        <div className="page-wrap">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Wordmark */}
            <Link to={createPageUrl("Landing")} className="flex items-center gap-2">
              <span className="spec-diamond mr-1" />
              <span className="font-brand text-lg tracking-[0.2em] text-white/90 font-medium">
                SPEKD
              </span>
            </Link>

            {/* Nav */}
            <nav className="hidden xl:flex items-center gap-0.5">
              {PRIMARY_NAV.map((item) => {
                const active = currentPageName === item.path;
                return (
                  <Link
                    key={item.path}
                    to={createPageUrl(item.path)}
                    className={`relative inline-flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                      active ? "text-white" : "text-white/35 hover:text-white/60"
                    }`}
                  >
                    {item.label}
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

              {/* More dropdown */}
              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`relative inline-flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                    isMoreActive ? "text-white" : "text-white/35 hover:text-white/60"
                  }`}
                >
                  More
                  <ChevronDown className={`h-3 w-3 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                  {isMoreActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full"
                      style={{ background: "var(--gold)", boxShadow: "0 2px 12px rgba(79,107,255,0.4)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
                <AnimatePresence>
                  {moreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="absolute left-0 top-full mt-2 w-52 rounded-xl z-50 py-1.5 overflow-hidden"
                      style={{
                        background: "rgba(15, 17, 25, 0.9)",
                        backdropFilter: "blur(24px)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.1)",
                      }}
                    >
                      {moreItems.map((item) => (
                        <Link
                          key={item.path}
                          to={createPageUrl(item.path)}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] transition-all ${
                            currentPageName === item.path
                              ? "text-white bg-gold/8"
                              : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                          }`}
                        >
                          <item.icon className="h-3.5 w-3.5 opacity-50" />
                          {item.label}
                        </Link>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setCommandOpen(true)}
                className="flex h-8 items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 text-xs text-white/25 transition-all hover:border-gold/20 hover:text-white/40"
              >
                <Search className="h-3 w-3" />
                <span className="hidden sm:inline">Search...</span>
                <kbd className="hidden sm:inline rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-white/15 font-mono">
                  ⌘K
                </kbd>
              </button>

              {/* Trade pricing toggle */}
              <PriceToggle />

              {/* Quote counter */}
              <button
                onClick={() => setQuoteOpen(true)}
                className="relative flex h-8 items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 text-xs transition-all hover:border-gold/20 hover:bg-white/[0.06]"
                title="Quote Builder"
              >
                <FileText className="h-3.5 w-3.5 text-white/30" />
                {quoteCount > 0 ? (
                  <>
                    <span className="text-white/50">Quote</span>
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full text-[10px] font-bold px-1"
                      style={{ background: "rgba(201,169,110,0.25)", color: "#C9A96E" }}
                    >
                      {quoteCount}
                    </span>
                  </>
                ) : (
                  <span className="text-white/25">Quote</span>
                )}
              </button>

              <NotificationCenter />
              <AlertBell />

              {/* Trade discount settings */}
              {user && (
                <button
                  onClick={() => setTradeSettingsOpen(true)}
                  className="flex h-8 items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 text-[10px] font-semibold uppercase tracking-wider transition-all hover:border-emerald-400/20 hover:bg-white/[0.06]"
                  style={{ color: "rgba(110,180,140,0.5)" }}
                  title="Trade Discount Settings"
                >
                  %
                </button>
              )}

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

      {/* Thin gradient separator below nav */}
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

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <SpecChat />
      <QuotePanel
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        onCountChange={(count) => setQuoteCount(count)}
      />
      <TradeDiscountSettings
        open={tradeSettingsOpen}
        onClose={() => setTradeSettingsOpen(false)}
      />
    </div>
  );
}
