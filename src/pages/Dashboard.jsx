import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Search,
  ArrowRight,
  Sparkles,
  Heart,
  BookmarkPlus,
  GitCompare,
  FolderKanban,
  TrendingUp,
  Clock,
  ImageOff,
  Package,
  CheckCircle,
  Compass,
} from "lucide-react";
import StyleDNA from "@/components/StyleDNA";
import {
  getCompareItems,
  getFavorites,
  getRecentSearches,
  getSavedSearches,
  getProjects,
} from "@/lib/growth-store";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

export default function Dashboard() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [stats, setStats] = useState({
    favorites: 0,
    savedSearches: 0,
    compareItems: 0,
    projects: 0,
    recentSearches: [],
    compareProducts: [],
  });
  const [serverProjects, setServerProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  useEffect(() => {
    setStats({
      favorites: getFavorites().length,
      savedSearches: getSavedSearches().length,
      compareItems: getCompareItems().length,
      projects: getProjects().length,
      recentSearches: getRecentSearches(),
      compareProducts: getCompareItems().slice(0, 4),
    });
    // Fetch active projects from server
    fetch(`${SEARCH_URL}/projects`)
      .then((r) => r.json())
      .then((data) => { setServerProjects(data.projects || []); setProjectsLoading(false); })
      .catch(() => setProjectsLoading(false));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`${createPageUrl("Search")}?q=${encodeURIComponent(query.trim())}`);
  };

  const quickSearches = ["velvet sectional", "marble coffee table", "mid-century chair", "rattan outdoor", "walnut credenza"];

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-6xl">

        {/* Hero Search */}
        <section className="mb-10">
          <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 flex items-center gap-2 mb-5">
            <span className="spec-diamond" />
            <Sparkles className="h-3.5 w-3.5" /> AI-powered furniture sourcing
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-white/90 tracking-tight max-w-2xl">
            Find the perfect piece,
            <span className="text-gold"> faster.</span>
          </h1>
          <p className="section-copy mt-3 max-w-xl">
            Search across 28+ vendors, compare side-by-side, generate client presentations, and track design trends — all in one place.
          </p>

          <form onSubmit={handleSearch} className="mt-7 flex gap-3 max-w-2xl">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 spec-diamond scale-75 opacity-40" />
              <input
                type="text"
                placeholder='Try "emerald velvet sofa", "MCM accent chair under 2k"...'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 w-full rounded-full border border-white/[0.06] bg-white/[0.03] pl-11 pr-4 text-sm text-white placeholder:text-white/25 outline-none transition-all focus:border-gold/30 focus:ring-2 focus:ring-gold/10 focus:shadow-[0_0_20px_rgba(201,169,110,0.08)]"
              />
            </div>
            <button
              type="submit"
              className="btn-gold h-12 rounded-full px-6 text-sm font-semibold"
            >
              Search
            </button>
          </form>

          <div className="mt-4 flex flex-wrap gap-2">
            {quickSearches.map((term) => (
              <Link
                key={term}
                to={`${createPageUrl("Search")}?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-white/40 transition-colors hover:bg-white/[0.06] hover:text-gold/70 hover:border-gold/20"
              >
                {term}
              </Link>
            ))}
          </div>
        </section>

        {/* Workspace Stats */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70">Workspace</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Favorites", value: stats.favorites, icon: Heart, color: "text-red-400", to: null },
              { label: "Saved Searches", value: stats.savedSearches, icon: BookmarkPlus, color: "text-gold/70", to: null },
              { label: "Compare Queue", value: stats.compareItems, icon: GitCompare, color: "text-emerald-400", to: "Compare" },
              { label: "Projects", value: stats.projects, icon: FolderKanban, color: "text-gold", to: "ProjectWorkflow" },
            ].map((stat) => {
              const inner = (
                <div className="glass-surface rounded-2xl p-5 transition-all hover:border-gold/20 hover:shadow-[0_0_30px_rgba(201,169,110,0.04)]">
                  <stat.icon className={`h-4 w-4 ${stat.color} mb-3`} />
                  <div className="text-2xl font-display text-white tracking-tight">{stat.value}</div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/25 mt-1.5">{stat.label}</div>
                </div>
              );
              return stat.to ? (
                <Link key={stat.label} to={createPageUrl(stat.to)}>{inner}</Link>
              ) : (
                <div key={stat.label}>{inner}</div>
              );
            })}
          </div>
        </section>

        {/* Agent Quick Links */}
        <section className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70">AI Agents</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Compass,
                title: "Visual Discovery",
                desc: "Find furniture by color, texture, and vibe — or drop a photo",
                to: "Discover",
                color: "text-purple-400",
                border: "border-purple-500/20",
              },
              {
                icon: Search,
                title: "Search & Discovery",
                desc: "AI-powered search across 28+ vendors with web discovery",
                to: "Search",
                color: "text-gold",
                border: "border-gold/20",
              },
              {
                icon: GitCompare,
                title: "Compare & Analyze",
                desc: "Side-by-side comparison with AI design analysis",
                to: "Compare",
                color: "text-emerald-400",
                border: "border-emerald-500/20",
              },
              {
                icon: FolderKanban,
                title: "Projects",
                desc: "Full workflow: brief, plan, source, and present — all in one place",
                to: "ProjectWorkflow",
                color: "text-gold",
                border: "border-gold/20",
              },
              {
                icon: TrendingUp,
                title: "Intelligence",
                desc: "Market trends, vendor analysis, and weekly industry digest",
                to: "Intelligence",
                color: "text-emerald-400",
                border: "border-emerald-500/20",
              },
            ].map((agent) => (
              <Link
                key={agent.title}
                to={createPageUrl(agent.to)}
                className={`group glass-surface rounded-2xl p-5 transition-all hover:border-gold/20 hover:shadow-[0_0_30px_rgba(201,169,110,0.04)]`}
              >
                <agent.icon className={`h-5 w-5 ${agent.color} mb-3`} />
                <div className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                  {agent.title}
                  <ArrowRight className="h-3.5 w-3.5 text-white/20 transition-transform group-hover:translate-x-1 group-hover:text-gold/50" />
                </div>
                <p className="text-xs text-white/35 leading-relaxed">{agent.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Active Projects */}
        {serverProjects.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70">Active Projects</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <Link to={createPageUrl("SourcingBoard")} className="text-xs text-gold/70 hover:text-gold transition-colors">
                View all
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {serverProjects.slice(0, 3).map((proj) => {
                const totalItems = proj.rooms?.reduce((sum, r) => sum + (r.items?.length || 0), 0) || proj.item_count || 0;
                const needsSourcing = proj.rooms?.reduce((sum, r) => sum + (r.items || []).filter((i) => i.status === "sourcing").length, 0) || 0;
                const selected = proj.rooms?.reduce((sum, r) => sum + (r.items || []).filter((i) => i.status === "selected" || i.status === "ordered" || i.status === "delivered").length, 0) || 0;
                const progress = totalItems > 0 ? Math.round((selected / totalItems) * 100) : 0;
                return (
                  <Link
                    key={proj.id}
                    to={`${createPageUrl("SourcingBoard")}?project=${proj.id}`}
                    className="group glass-surface rounded-2xl p-5 transition-all hover:border-gold/20 hover:shadow-[0_0_30px_rgba(201,169,110,0.04)]"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <FolderKanban className="h-4 w-4 text-gold" />
                      <h3 className="text-sm font-medium text-white truncate">{proj.name}</h3>
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div className="h-full bg-gold/60 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[10px] text-white/30">{progress}%</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/30">
                      <span className="flex items-center gap-1">
                        <Package className="h-2.5 w-2.5" /> {totalItems} items
                      </span>
                      {needsSourcing > 0 && (
                        <span className="flex items-center gap-1 text-gold/50">
                          <Search className="h-2.5 w-2.5" /> {needsSourcing} need sourcing
                        </span>
                      )}
                      {selected > 0 && (
                        <span className="flex items-center gap-1 text-emerald-400/60">
                          <CheckCircle className="h-2.5 w-2.5" /> {selected} done
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Style DNA */}
        <section className="mb-10">
          <StyleDNA />
        </section>

        {/* Bottom row: Recent searches + Compare preview */}
        <div className="grid gap-6 lg:grid-cols-2">

          {/* Recent Searches */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70">Recent Searches</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
              <Link to={createPageUrl("Search")} className="text-xs text-gold/70 hover:text-gold transition-colors">
                View all
              </Link>
            </div>
            {stats.recentSearches.length === 0 ? (
              <div className="glass-surface rounded-2xl p-8 text-center">
                <Clock className="h-6 w-6 text-white/10 mx-auto mb-2" />
                <p className="text-white/25 text-sm">No recent searches yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.recentSearches.slice(0, 5).map((term) => (
                  <Link
                    key={term}
                    to={`${createPageUrl("Search")}?q=${encodeURIComponent(term)}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 transition-all hover:bg-white/[0.05] hover:border-gold/20"
                  >
                    <Search className="h-3.5 w-3.5 text-white/20 shrink-0" />
                    <span className="text-sm text-white/60 truncate">{term}</span>
                    <ArrowRight className="h-3 w-3 text-white/10 ml-auto shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Compare Preview */}
          <section>
            <div className="flex items-center gap-3 mb-5">
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70">Compare Queue</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
              {stats.compareItems > 0 && (
                <Link to={createPageUrl("Compare")} className="text-xs text-gold/70 hover:text-gold transition-colors">
                  Open compare
                </Link>
              )}
            </div>
            {stats.compareProducts.length === 0 ? (
              <div className="glass-surface rounded-2xl p-8 text-center">
                <GitCompare className="h-6 w-6 text-white/10 mx-auto mb-2" />
                <p className="text-white/25 text-sm">No products in compare</p>
                <Link to={createPageUrl("Search")} className="inline-block mt-3 text-xs text-gold/70 hover:text-gold transition-colors">
                  Search to add products
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {stats.compareProducts.map((product) => (
                  <div
                    key={product.id}
                    className="glass-surface rounded-xl overflow-hidden"
                  >
                    <div className="aspect-[4/3] bg-white/[0.03]">
                      {(product.thumbnail || product.image_url) ? (
                        <img
                          src={product.thumbnail || product.image_url}
                          alt={product.product_name}
                          className="h-full w-full object-cover"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ImageOff className="h-5 w-5 text-white/10" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-[10px] text-gold/70 mb-0.5">{product.manufacturer_name}</div>
                      <div className="text-xs text-white/60 font-medium line-clamp-1">{product.product_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
