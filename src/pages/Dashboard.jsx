import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Search,
  ArrowRight,
  FolderKanban,
  Camera,
  Building2,
  Compass,
} from "lucide-react";
import { motion } from "framer-motion";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

const SUGGESTED_SEARCHES = [
  "channel back swivel chair",
  "live edge dining table",
  "brass and marble side table",
  "skirted sofa traditional",
  "rattan outdoor lounge",
  "boucle accent chair",
  "walnut credenza mid-century",
  "performance fabric sectional",
  "travertine coffee table",
  "cane back dining chair",
  "linen slipcovered sofa",
  "iron four poster bed",
  "terrazzo side table",
  "velvet channel tufted bench",
  "ceramic table lamp sculptural",
  "leather club chair cognac",
  "fluted wood console",
  "woven rattan pendant light",
  "marble waterfall edge table",
  "curved modular sofa",
  "shagreen desk accessories",
  "teak outdoor dining set",
  "mohair throw pillow set",
  "hammered brass chandelier",
  "stone pedestal dining table",
  "bouclé barrel chair",
  "reclaimed wood bookshelf",
  "alabaster flush mount light",
  "block print upholstered ottoman",
  "minimalist platform bed oak",
];

const STYLE_CARDS = [
  { label: "Modern", query: "modern style furniture" },
  { label: "Traditional", query: "traditional style furniture" },
  { label: "Transitional", query: "transitional style furniture" },
  { label: "Coastal", query: "coastal style furniture" },
  { label: "Mid-Century", query: "mid-century modern furniture" },
];

const STAGGER = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const [vendors, setVendors] = useState([]);
  const [stats, setStats] = useState({ products: 0, vendors: 0 });

  const suggestions = useMemo(() => {
    const shuffled = [...SUGGESTED_SEARCHES].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 8);
  }, []);

  useEffect(() => {
    fetch(`${SEARCH_URL}/catalog/stats`)
      .then((r) => r.json())
      .then((data) => {
        const cat = data.catalog || data;
        setStats({ products: cat.total_products || 0, vendors: cat.total_vendors || 0 });
      })
      .catch(() => {});

    fetch(`${SEARCH_URL}/vendors`)
      .then((r) => r.json())
      .then((data) => {
        const v = (data.vendors || []).sort(() => Math.random() - 0.5);
        setVendors(v.slice(0, 5));
        setStats((prev) => ({ ...prev, vendors: data.vendors?.length || prev.vendors }));
      })
      .catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`${createPageUrl("Search")}?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center pt-16 md:pt-24 pb-12 px-4">
      <motion.div
        variants={STAGGER}
        initial="hidden"
        animate="visible"
        className="w-full max-w-3xl"
      >

        {/* ═══════ SEARCH — THE ONLY THING THAT MATTERS ═══════ */}
        <motion.section variants={FADE_UP} className="mb-6">
          <form onSubmit={handleSearch} className="relative">
            <div
              className="absolute -inset-10 pointer-events-none transition-opacity duration-500 rounded-3xl"
              style={{
                background: "radial-gradient(ellipse, rgba(79,107,255,0.12) 0%, transparent 70%)",
                filter: "blur(40px)",
                opacity: searchFocused ? 1 : 0,
              }}
            />
            <div
              className={`search-bar-glow relative flex items-center rounded-2xl bg-white/[0.03] px-6 gap-3 transition-all duration-300 ${
                searchFocused ? "shadow-[0_0_40px_rgba(79,107,255,0.15),0_0_80px_rgba(79,107,255,0.05)]" : ""
              }`}
              style={{ height: 64 }}
            >
              <Search className="h-5 w-5 text-white/20 shrink-0" />
              <input
                type="text"
                placeholder="What are you looking for?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/20 outline-none"
                autoFocus
              />
              <button
                type="submit"
                className="btn-gold h-10 rounded-xl px-6 text-sm font-semibold shrink-0"
                style={{ padding: "0 24px" }}
              >
                Search
              </button>
            </div>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {suggestions.map((term) => (
              <Link
                key={term}
                to={`${createPageUrl("Search")}?q=${encodeURIComponent(term)}`}
                className="filter-chip"
              >
                {term}
              </Link>
            ))}
          </div>
        </motion.section>

        {/* ═══════ LIVE STATS BAR ═══════ */}
        <motion.section variants={FADE_UP} className="mb-10">
          <div
            className="rounded-xl px-5 py-3 flex items-center justify-center gap-5 flex-wrap text-[13px]"
            style={{
              background: "var(--glass-bg)",
              backdropFilter: "blur(40px)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <span className="text-white/30">
              <span className="text-gold font-semibold">{stats.products.toLocaleString()}</span> products
            </span>
            <span className="text-white/10">·</span>
            <span className="text-white/30">
              <span className="text-gold font-semibold">{stats.vendors}</span> vendors
            </span>
            <span className="text-white/10">·</span>
            <span className="text-white/30">
              <span className="text-gold font-semibold">100%</span> source verified
            </span>
          </div>
        </motion.section>

        {/* ═══════ DISCOVER — VENDORS + STYLES ═══════ */}
        <motion.section variants={FADE_UP} className="mb-10">
          <div className="grid md:grid-cols-2 gap-6">

            {/* Vendors */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="section-label text-gold">By Vendor</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
                <Link to={createPageUrl("Manufacturers")} className="text-[11px] text-gold/50 hover:text-gold transition-colors">
                  All
                </Link>
              </div>
              <div className="space-y-1.5">
                {vendors.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
                        <div className="skeleton w-8 h-8 rounded-lg" />
                        <div className="flex-1 space-y-1">
                          <div className="skeleton h-3 w-28" />
                          <div className="skeleton h-2 w-16" />
                        </div>
                      </div>
                    ))
                  : vendors.map((v) => (
                      <Link
                        key={v.name}
                        to={`${createPageUrl("Search")}?q=${encodeURIComponent(v.name)}`}
                        className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-white/[0.03]"
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gold/70 text-xs font-display shrink-0"
                          style={{ background: "rgba(79,107,255,0.06)", border: "1px solid rgba(79,107,255,0.1)" }}
                        >
                          {v.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white/70 group-hover:text-white transition-colors truncate">
                            {v.name}
                          </div>
                          <div className="text-[11px] text-white/20">
                            {(v.product_count || v.active_skus || 0).toLocaleString()} products
                          </div>
                        </div>
                        <ArrowRight className="h-3 w-3 text-white/10 group-hover:text-gold/40 transition-colors shrink-0" />
                      </Link>
                    ))}
              </div>
            </div>

            {/* Styles */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="section-label text-gold">By Style</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>
              <div className="space-y-1.5">
                {STYLE_CARDS.map((style) => (
                  <Link
                    key={style.label}
                    to={`${createPageUrl("Search")}?q=${encodeURIComponent(style.query)}`}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all hover:bg-white/[0.03]"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 text-xs font-display shrink-0"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {style.label[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white/70 group-hover:text-white transition-colors">
                        {style.label}
                      </div>
                      <div className="text-[11px] text-white/20">
                        Browse {style.label.toLowerCase()} furniture
                      </div>
                    </div>
                    <ArrowRight className="h-3 w-3 text-white/10 group-hover:text-gold/40 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ═══════ QUICK ACTIONS ═══════ */}
        <motion.section variants={FADE_UP}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {[
              { icon: Search, label: "Search", desc: "AI-powered search", to: "Search" },
              { icon: FolderKanban, label: "Projects", desc: "Sourcing projects", to: "Projects" },
              { icon: Building2, label: "Vendors", desc: "Browse catalogs", to: "Manufacturers" },
              { icon: Compass, label: "Visual", desc: "Search by photo", to: "Discover" },
            ].map((item) => (
              <Link
                key={item.label}
                to={createPageUrl(item.to)}
                className="group flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition-all hover:border-gold/15 hover:bg-white/[0.03]"
              >
                <item.icon className="h-4 w-4 text-gold/50 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-white/60 group-hover:text-white/80 transition-colors">{item.label}</div>
                  <div className="text-[10px] text-white/20 truncate">{item.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </motion.section>

      </motion.div>
    </div>
  );
}
