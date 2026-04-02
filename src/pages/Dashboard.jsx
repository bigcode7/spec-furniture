import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, ArrowRight, FileText, Camera, Heart, Compass, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { getFavorites, getQuoteItemCount } from "@/lib/growth-store";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

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
  { label: "Warm Modern", query: "warm modern living room furniture" },
  { label: "Transitional", query: "transitional furniture refined" },
  { label: "Coastal", query: "coastal furniture elevated" },
  { label: "European", query: "european inspired furniture" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState({ products: 0, vendors: 0 });
  const [favorites, setFavorites] = useState([]);
  const [quoteCount, setQuoteCount] = useState(0);

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
    <div className="min-h-screen bg-[#120f0d] text-white">
      <div className="page-wrap-wide py-12 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="atelier-panel paper-grain px-6 py-8 sm:px-8 md:px-10"
        >
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="workspace-kicker mb-5">Home</div>
              <h1 className="workspace-heading max-w-4xl">Start every sourcing session from one calm, useful launch page.</h1>
              <p className="workspace-subhead mt-4">Launch a search and jump back into active work without hunting through the app.</p>

              <form onSubmit={handleSearch} className="mt-8">
                <div className="luxe-input relative">
                  <div className="flex items-center">
                    <Search className="ml-4 h-4 w-4 text-white/22 shrink-0" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by piece, material, room, or mood..."
                      className="h-14 w-full bg-transparent pl-3 pr-28 text-[15px] text-white/82 placeholder:text-white/22 outline-none"
                    />
                    <button
                      type="submit"
                      className="absolute right-2 top-1/2 flex h-10 -translate-y-1/2 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all"
                      style={{ background: "linear-gradient(135deg, #c6a16a, #e0bb85)", color: "#1c1917" }}
                    >
                      Search
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </form>

              <div className="mt-5 flex flex-wrap gap-2">
                {suggestions.map((term) => (
                  <Link
                    key={term}
                    to={`${createPageUrl("Search")}?q=${encodeURIComponent(term)}`}
                    className="control-chip px-3 py-1.5 text-[11px] text-white/46 hover:text-gold/78 transition-all"
                  >
                    {term}
                  </Link>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="atelier-panel-soft px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">Catalog</div>
                <div className="mt-2 text-2xl font-semibold text-white/92">{stats.products ? stats.products.toLocaleString() : "40k+"}</div>
                <div className="mt-1 text-xs text-white/40">{stats.vendors ? `${stats.vendors} brands represented` : "Trade-ready products"}</div>
              </div>
              <div className="atelier-panel-soft px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">Quote Board</div>
                <div className="mt-2 text-2xl font-semibold text-white/92">{quoteCount}</div>
                <div className="mt-1 text-xs text-white/40">Selections ready to present</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="atelier-panel px-6 py-6"
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gold/55">
              <Sparkles className="h-3.5 w-3.5" />
              Continue Working
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { to: "Search", icon: Search, label: "Search Workspace", desc: "Run a new sourcing brief or continue refining a result set." },
                { to: "Quotes", icon: FileText, label: "Quote Studio", desc: "Review rooms, export PDFs, and share client-ready presentations." },
                { to: "Account", icon: Heart, label: "Account", desc: "Manage profile and trade-facing settings." },
                { to: "Landing", icon: Compass, label: "Landing Page", desc: "Review the public entry experience." },
              ].map((item) => (
                <Link key={item.label} to={createPageUrl(item.to)} className="editorial-card px-4 py-4 transition-all hover:border-gold/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                      <item.icon className="h-4 w-4 text-gold/60" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white/84">{item.label}</div>
                      <div className="mt-1 text-[12px] leading-5 text-white/38">{item.desc}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="atelier-panel px-6 py-6"
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-gold/55">
              <Camera className="h-3.5 w-3.5" />
              Suggested Directions
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {STYLE_DIRECTIONS.map((style) => (
                <Link
                  key={style.label}
                  to={`${createPageUrl("Search")}?q=${encodeURIComponent(style.query)}`}
                  className="group rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-4 py-4 transition-all hover:border-gold/20 hover:bg-white/[0.03]"
                >
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/28">Direction</div>
                  <div className="mt-2 text-xl text-white/88">{style.label}</div>
                  <div className="mt-2 text-[12px] text-white/38">Open a pre-shaped search brief for this design language.</div>
                  <div className="mt-4 inline-flex items-center gap-1 text-[11px] text-gold/68">
                    Explore
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
