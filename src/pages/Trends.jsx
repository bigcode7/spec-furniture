import { useState, useEffect } from "react";
import {
  TrendingUp,
  Sparkles,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Search,
  Palette as PaletteIcon,
  Gem,
  Lightbulb,
  Eye,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

async function fetchTrends(category, style) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(`${searchServiceUrl.replace(/\/$/, "")}/trends`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category, style }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.trends;
  } catch {
    return null;
  }
}

const MOMENTUM_ICON = {
  rising: ArrowUp,
  peaking: ArrowRight,
  stabilizing: ArrowDown,
};

const MOMENTUM_COLOR = {
  rising: "text-green-400",
  peaking: "text-gold",
  stabilizing: "text-white/40",
};

const CATEGORIES = ["All", "Seating", "Tables", "Beds", "Storage", "Lighting", "Outdoor", "Office"];
const STYLES = ["All", "Modern", "Mid-Century", "Traditional", "Minimalist", "Bohemian", "Coastal", "Industrial"];

export default function Trends() {
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [style, setStyle] = useState("All");

  const loadTrends = async (cat, sty) => {
    setLoading(true);
    setTrends(null);
    const result = await fetchTrends(
      cat === "All" ? null : cat,
      sty === "All" ? null : sty,
    );
    setTrends(result);
    setLoading(false);
  };

  useEffect(() => {
    loadTrends(category, style);
  }, []);

  const handleFilter = (cat, sty) => {
    setCategory(cat);
    setStyle(sty);
    loadTrends(cat, sty);
  };

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="h-6 w-6 text-gold" />
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">
            Trends & Style Intelligence
          </h1>
        </div>
        <p className="text-white/30 text-sm mb-8">AI-powered analysis of current furniture and design trends</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-6 mb-8">
          <div>
            <div className="text-xs text-white/30 uppercase tracking-wider mb-2">Category</div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleFilter(cat, style)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    category === cat
                      ? "bg-gold text-black"
                      : "bg-white/5 text-white/40 hover:text-white/70"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/30 uppercase tracking-wider mb-2">Style</div>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((sty) => (
                <button
                  key={sty}
                  onClick={() => handleFilter(category, sty)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    style === sty
                      ? "bg-gold text-black"
                      : "bg-white/5 text-white/40 hover:text-white/70"
                  }`}
                >
                  {sty}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <Sparkles className="h-8 w-8 text-gold animate-pulse mx-auto mb-4" />
            <p className="text-white/40">Analyzing current design trends...</p>
          </div>
        )}

        {/* Results */}
        {trends && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Trending Now */}
            {trends.trending_now?.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-4">
                  Trending Now
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {trends.trending_now.map((trend) => {
                    const MomentumIcon = MOMENTUM_ICON[trend.momentum] || ArrowRight;
                    const momentumColor = MOMENTUM_COLOR[trend.momentum] || "text-white/40";
                    return (
                      <div
                        key={trend.trend}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] text-white/40 uppercase">
                            {trend.category}
                          </span>
                          <div className={`flex items-center gap-1 text-xs ${momentumColor}`}>
                            <MomentumIcon className="h-3 w-3" />
                            {trend.momentum}
                          </div>
                        </div>
                        <h3 className="text-white font-semibold mb-2">{trend.trend}</h3>
                        <p className="text-sm text-white/50 leading-relaxed mb-3">{trend.description}</p>
                        {trend.vendors_leading?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {trend.vendors_leading.map((v) => (
                              <span key={v} className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold/70">
                                {v}
                              </span>
                            ))}
                          </div>
                        )}
                        {trend.search_terms?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {trend.search_terms.map((t) => (
                              <span key={t} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/30">
                                <Search className="h-2.5 w-2.5 inline mr-0.5" />{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Emerging + Declining */}
            <div className="grid gap-4 sm:grid-cols-2">
              {trends.emerging?.length > 0 && (
                <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-green-400 mb-4">
                    <Eye className="h-4 w-4" /> Emerging
                  </div>
                  <div className="space-y-4">
                    {trends.emerging.map((e) => (
                      <div key={e.trend}>
                        <div className="text-sm font-semibold text-white mb-1">{e.trend}</div>
                        <p className="text-xs text-white/50">{e.description}</p>
                        {e.watch_for && (
                          <p className="text-xs text-green-400/70 mt-1">{e.watch_for}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {trends.declining?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/30 mb-4">
                    <ArrowDown className="h-4 w-4" /> Fading
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trends.declining.map((d) => (
                      <span key={d} className="rounded-full bg-white/5 px-3 py-1 text-sm text-white/30">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Color Forecast */}
            {trends.color_forecast?.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-4">
                  <PaletteIcon className="h-4 w-4" /> Color Forecast
                </div>
                <div className="flex gap-6 flex-wrap">
                  {trends.color_forecast.map((color) => (
                    <div key={color.name} className="text-center">
                      <div
                        className="w-14 h-14 rounded-xl border border-white/10 mb-2"
                        style={{ backgroundColor: color.hex }}
                      />
                      <div className="text-xs text-white/70 font-medium">{color.name}</div>
                      <div className="text-[10px] text-white/30">{color.usage}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Material Spotlight + Designer Tip */}
            <div className="grid gap-4 sm:grid-cols-2">
              {trends.material_spotlight && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-3">
                    <Gem className="h-4 w-4" /> Material Spotlight
                  </div>
                  <p className="text-white/70 text-sm leading-relaxed">{trends.material_spotlight}</p>
                </div>
              )}
              {trends.designer_tip && (
                <div className="rounded-2xl border border-gold/20 bg-gold/5 p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-3">
                    <Lightbulb className="h-4 w-4" /> Designer Tip
                  </div>
                  <p className="text-gold/80 text-sm leading-relaxed">{trends.designer_tip}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* No results */}
        {!loading && !trends && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <TrendingUp className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/40">Unable to load trends. Make sure the search service is running with an API key.</p>
            <Button onClick={() => loadTrends(category, style)} className="mt-4" variant="outline">
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
