import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, ArrowRight, FileText, Heart, ChevronRight, Layers, User, LayoutGrid } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { getFavorites, getQuoteItemCount } from "@/lib/growth-store";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");
const EASE = [0.22, 1, 0.36, 1];

const SUGGESTED_SEARCHES = [
  "walnut dining table sculptural",
  "boucle accent chair",
  "travertine coffee table",
  "linen slipcovered sofa",
  "brass and marble side table",
  "performance fabric sectional",
  "curved modular sofa",
  "cane back dining chair",
];

const STYLE_DIRECTIONS = [
  { label: "Warm Modern", query: "warm modern living room furniture", pattern: "radial-gradient(circle at 80% 20%, rgba(184,149,106,0.06) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(194,204,186,0.06) 0%, transparent 50%)" },
  { label: "Transitional", query: "transitional furniture refined", pattern: "radial-gradient(circle at 30% 30%, rgba(184,149,106,0.06) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(44,62,45,0.04) 0%, transparent 50%)" },
  { label: "Coastal", query: "coastal furniture elevated", pattern: "radial-gradient(circle at 60% 10%, rgba(194,204,186,0.08) 0%, transparent 50%), radial-gradient(circle at 40% 90%, rgba(44,62,45,0.04) 0%, transparent 50%)" },
  { label: "European", query: "european inspired furniture", pattern: "radial-gradient(circle at 20% 50%, rgba(184,149,106,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(194,204,186,0.06) 0%, transparent 50%)" },
];

function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState({ products: 0, vendors: 0 });
  const [favorites, setFavorites] = useState([]);
  const [quoteCount, setQuoteCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const suggestions = useMemo(() => SUGGESTED_SEARCHES, []);

  useEffect(() => {
    setFavorites(getFavorites());
    setQuoteCount(getQuoteItemCount());

    fetch(`${SEARCH_URL}/catalog/stats`)
      .then((r) => r.json())
      .then((data) => {
        const catalog = data.catalog || data;
        setStats({
          products: catalog.total_products || 0,
          vendors: catalog.total_vendors || 0,
        });
      })
      .catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    navigate(`${createPageUrl("Search")}?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="min-h-screen relative" style={{ color: "#1A1A18" }}>

      <div className="relative z-10 page-wrap-wide py-10 md:py-14">

        {/* ── Greeting + Status ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="mb-10 md:mb-12"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div className="relative flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 10px rgba(52,211,153,0.5)" }} />
              </span>
              <span className="label-caps" style={{ color: "#9B9590" }}>Workspace</span>
            </div>
          </div>
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.05]"
            style={{ color: "#1A1A18" }}>
            Your sourcing<br />
            <span style={{ color: "#2C3E2D" }}>command center</span>
          </h1>
          <p className="mt-4 text-[14px] sm:text-[15px] tracking-wide max-w-lg" style={{ color: "#9B9590" }}>
            Search, discover, and quote from one workspace.
          </p>
        </motion.div>

        {/* ── Hero search ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE }}
          className="mb-10"
        >
          <form onSubmit={handleSearch} className="relative max-w-3xl w-full">
            {/* Glow ring on focus */}
            <div className="absolute -inset-[2px] rounded-2xl transition-opacity duration-500 pointer-events-none"
              style={{
                opacity: isFocused ? 1 : 0,
                background: "linear-gradient(135deg, rgba(44,62,45,0.18), rgba(44,62,45,0.04), rgba(184,149,106,0.12))",
                filter: "blur(2px)",
              }} />
            <div className="relative rounded-2xl overflow-hidden transition-all duration-300"
              style={{
                background: "rgba(255,255,255,0.80)",
                border: isFocused ? "1px solid rgba(44,62,45,0.20)" : "1px solid rgba(44,62,45,0.06)",
                backdropFilter: "blur(12px)",
                boxShadow: isFocused
                  ? "0 8px 40px rgba(0,0,0,0.06), 0 0 0 1px rgba(44,62,45,0.08)"
                  : "0 4px 24px rgba(0,0,0,0.03)",
              }}>
              <div className="flex items-center">
                <Search className="ml-5 h-4.5 w-4.5 shrink-0" style={{ color: "#9B9590" }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Search by piece, material, room, or mood..."
                  className="h-16 w-full bg-transparent pl-4 pr-48 text-[15px] sm:text-[16px] outline-none"
                  style={{ color: "#1A1A18", "::placeholder": { color: "#9B9590" } }}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3">
                  <button
                    type="submit"
                    className="flex h-10 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium text-white transition-colors duration-200"
                    style={{ background: "#2C3E2D" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#3a5240"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#2C3E2D"}
                  >
                    Search
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Suggestion chips */}
          <div className="mt-4 flex flex-wrap gap-2 max-w-3xl">
            {suggestions.map((term) => (
              <Link
                key={term}
                to={`${createPageUrl("Search")}?q=${encodeURIComponent(term)}`}
                className="group inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] transition-all duration-300"
                style={{ border: "1px solid rgba(44,62,45,0.08)", background: "rgba(255,255,255,0.50)", color: "#9B9590" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(44,62,45,0.18)"; e.currentTarget.style.color = "#2C3E2D"; e.currentTarget.style.background = "rgba(255,255,255,0.80)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(44,62,45,0.08)"; e.currentTarget.style.color = "#9B9590"; e.currentTarget.style.background = "rgba(255,255,255,0.50)"; }}
              >
                <Search className="h-2.5 w-2.5 opacity-40 group-hover:opacity-70 transition-opacity" />
                {term}
              </Link>
            ))}
          </div>
        </motion.div>

        {/* ── Stats ribbon ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: EASE }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10"
        >
          {[
            { label: "Products", value: stats.products ? stats.products.toLocaleString() : "42k+", sub: "In catalog" },
            { label: "Vendors", value: stats.vendors || "20+", sub: "Trade brands" },
            { label: "Favorites", value: favorites.length, sub: "Saved pieces" },
            { label: "Quote Items", value: quoteCount, sub: "Ready to present" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="relative rounded-[18px] overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.80)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(44,62,45,0.06)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.03)",
              }}
            >
              {/* Subtle top gradient line */}
              <div
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{ background: "linear-gradient(90deg, transparent, rgba(44,62,45,0.15), transparent)" }}
              />
              <div className="px-5 py-5">
                <div className="label-caps" style={{ color: "#9B9590" }}>{stat.label}</div>
                <div className="mt-2 text-3xl sm:text-4xl font-display font-semibold leading-none" style={{ color: "#1A1A18" }}>{stat.value}</div>
                <div className="mt-1.5 text-[11px]" style={{ color: "#9B9590" }}>{stat.sub}</div>
              </div>
            </div>
          ))}
        </motion.div>

        {/* ── Quick actions + Style Directions grid ── */}
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] mb-10">

          {/* Continue Working */}
          <Reveal>
            <div className="rounded-[24px] px-6 py-6 sm:px-7 sm:py-7"
              style={{
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(44,62,45,0.06)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.03)",
              }}>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(44,62,45,0.08)", border: "1px solid rgba(44,62,45,0.10)" }}>
                  <LayoutGrid className="h-3.5 w-3.5" style={{ color: "#2C3E2D" }} />
                </div>
                <span className="label-caps" style={{ color: "#6B6560" }}>Continue Working</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { to: createPageUrl("Search"), icon: Search, label: "New Search", desc: "Start a sourcing brief" },
                  { to: createPageUrl("Quotes"), icon: FileText, label: "Quote Builder", desc: "Review & export PDFs" },
                  { to: createPageUrl("Account"), icon: User, label: "Account", desc: "Profile & preferences" },
                  { to: "/", icon: ArrowRight, label: "Landing", desc: "View landing page" },
                ].map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="group flex items-center gap-4 rounded-[18px] px-4 py-4 transition-all duration-300"
                    style={{ border: "1px solid rgba(44,62,45,0.06)", background: "rgba(255,255,255,0.50)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(44,62,45,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.90)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(44,62,45,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.50)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl shrink-0" style={{ background: "rgba(44,62,45,0.06)", border: "1px solid rgba(44,62,45,0.08)" }}>
                      <item.icon className="h-4 w-4 transition-colors duration-300" style={{ color: "#2C3E2D" }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-medium transition-colors" style={{ color: "#1A1A18" }}>{item.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: "#9B9590" }}>{item.desc}</div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 transition-all duration-300 group-hover:translate-x-1 shrink-0" style={{ color: "#9B9590" }} />
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Style Directions */}
          <Reveal delay={0.08}>
            <div className="rounded-[24px] px-6 py-6 sm:px-7 sm:py-7"
              style={{
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(44,62,45,0.06)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.03)",
              }}>
              <div className="flex items-center gap-2.5 mb-6">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(44,62,45,0.08)", border: "1px solid rgba(44,62,45,0.10)" }}>
                  <Layers className="h-3.5 w-3.5" style={{ color: "#2C3E2D" }} />
                </div>
                <span className="label-caps" style={{ color: "#6B6560" }}>Style Directions</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {STYLE_DIRECTIONS.map((style) => (
                  <Link
                    key={style.label}
                    to={`${createPageUrl("Search")}?q=${encodeURIComponent(style.query)}`}
                    className="group relative overflow-hidden rounded-[18px] px-5 py-5 transition-all duration-300"
                    style={{ border: "1px solid rgba(44,62,45,0.06)", background: "rgba(255,255,255,0.50)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(44,62,45,0.14)"; e.currentTarget.style.background = "rgba(255,255,255,0.90)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(44,62,45,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.50)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    {/* Background texture pattern on hover */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                      style={{ background: style.pattern }}
                    />
                    <div className="relative">
                      <div className="label-caps transition-colors" style={{ color: "#9B9590" }}>Direction</div>
                      <div className="mt-3 text-xl font-display leading-tight transition-colors" style={{ color: "#1A1A18" }}>{style.label}</div>
                      <div className="mt-4 inline-flex items-center gap-2 text-[11px] transition-all duration-300" style={{ color: "#B8956A" }}>
                        <span className="font-medium">Explore</span>
                        <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1.5" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* ── Recent Activity — Favorites Row ── */}
        <Reveal delay={0.12}>
          <div className="rounded-[24px] px-6 py-6 sm:px-7 sm:py-7"
            style={{
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(44,62,45,0.06)",
              boxShadow: "0 4px 24px rgba(0,0,0,0.03)",
            }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "rgba(44,62,45,0.08)", border: "1px solid rgba(44,62,45,0.10)" }}>
                  <Heart className="h-3.5 w-3.5" style={{ color: "#2C3E2D" }} />
                </div>
                <span className="label-caps" style={{ color: "#6B6560" }}>Recent Activity</span>
              </div>
              {favorites.length > 0 && (
                <Link
                  to={`${createPageUrl("Search")}?favorites=true`}
                  className="text-[11px] transition-colors flex items-center gap-1"
                  style={{ color: "#9B9590" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#2C3E2D"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "#9B9590"}
                >
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>

            {favorites.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                {favorites.slice(0, 6).map((fav, i) => (
                  <Link
                    key={fav.id || fav.product_id || i}
                    to={`${createPageUrl("Search")}?q=${encodeURIComponent(fav.name || fav.product_name || "")}`}
                    className="group flex-shrink-0 w-[160px] sm:w-[180px] rounded-[16px] overflow-hidden transition-all duration-300"
                    style={{ border: "1px solid rgba(44,62,45,0.06)", background: "rgba(255,255,255,0.60)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(44,62,45,0.14)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.05)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(44,62,45,0.06)"; e.currentTarget.style.boxShadow = "none"; }}
                  >
                    <div className="aspect-square w-full overflow-hidden" style={{ background: "rgba(44,62,45,0.03)" }}>
                      {(fav.image || fav.image_url || fav.thumbnail) ? (
                        <img
                          src={fav.image || fav.image_url || fav.thumbnail}
                          alt={fav.name || fav.product_name || "Product"}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <LayoutGrid className="h-6 w-6" style={{ color: "#C2CCBA" }} />
                        </div>
                      )}
                    </div>
                    <div className="px-3 py-3">
                      <div className="text-[12px] font-medium transition-colors truncate" style={{ color: "#1A1A18" }}>
                        {fav.name || fav.product_name || "Saved Product"}
                      </div>
                      <div className="text-[10px] mt-0.5 truncate" style={{ color: "#9B9590" }}>
                        {fav.vendor || fav.vendor_name || fav.brand || ""}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-10 rounded-[16px]" style={{ border: "1px dashed rgba(44,62,45,0.10)", background: "rgba(255,255,255,0.40)" }}>
                <div className="text-center">
                  <Heart className="h-6 w-6 mx-auto mb-3" style={{ color: "#C2CCBA" }} />
                  <p className="text-[13px]" style={{ color: "#9B9590" }}>Save your first favorite from Search to see it here</p>
                  <Link
                    to={createPageUrl("Search")}
                    className="inline-flex items-center gap-1.5 mt-3 text-[11px] transition-colors"
                    style={{ color: "#B8956A" }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#2C3E2D"}
                    onMouseLeave={(e) => e.currentTarget.style.color = "#B8956A"}
                  >
                    Go to Search
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </Reveal>

      </div>
    </div>
  );
}
