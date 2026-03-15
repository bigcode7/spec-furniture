import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, GitCompare, Home, LogOut, FolderOpen, ClipboardList, Package2, Brain, BarChart3, ChevronDown, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useState, useEffect, useRef } from "react";
import CommandPalette from "@/components/CommandPalette";
import SpecChat from "@/components/SpecChat";
import AlertBell from "@/components/AlertBell";
import NotificationCenter from "@/components/NotificationCenter";

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

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
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
      <header className="glass-header sticky top-0 z-40">
        <div className="page-wrap">
          <div className="flex h-14 items-center justify-between gap-4">
            {/* Wordmark */}
            <Link to={createPageUrl("Landing")} className="flex items-center gap-2">
              <span className="spec-diamond mr-1" />
              <span className="font-display text-lg tracking-[0.12em] text-white/90" style={{ letterSpacing: "0.15em" }}>
                SPEC
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
                      active ? "text-gold" : "text-white/35 hover:text-white/60"
                    }`}
                  >
                    {item.label}
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full"
                        style={{
                          background: "var(--gold)",
                          boxShadow: "0 2px 12px rgba(201,169,110,0.4)",
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
                    isMoreActive ? "text-gold" : "text-white/35 hover:text-white/60"
                  }`}
                >
                  More
                  <ChevronDown className={`h-3 w-3 transition-transform ${moreOpen ? "rotate-180" : ""}`} />
                  {isMoreActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full"
                      style={{ background: "var(--gold)", boxShadow: "0 2px 12px rgba(201,169,110,0.4)" }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
                <AnimatePresence>
                  {moreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 top-full mt-2 w-52 glass-surface rounded-xl z-50 py-1.5 overflow-hidden"
                    >
                      {moreItems.map((item) => (
                        <Link
                          key={item.path}
                          to={createPageUrl(item.path)}
                          onClick={() => setMoreOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] transition-all ${
                            currentPageName === item.path
                              ? "text-gold bg-gold/5"
                              : "text-white/40 hover:text-gold/80 hover:bg-gold/5"
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

              <NotificationCenter />
              <AlertBell />

              {user && (
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white/80"
                    style={{
                      background: "rgba(201,169,110,0.15)",
                      border: "1px solid rgba(201,169,110,0.25)",
                      boxShadow: "0 0 12px rgba(201,169,110,0.1)",
                    }}
                  >
                    {(user.full_name || user.email || "U")[0].toUpperCase()}
                  </div>
                  <button
                    onClick={() => base44.auth.logout()}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white/20 transition-colors hover:bg-white/[0.06] hover:text-white/40"
                    title="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <SpecChat />
    </div>
  );
}
