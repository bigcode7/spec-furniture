import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
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
  Newspaper,
  Star,
  Megaphone,
  Package,
  ExternalLink,
  ImageOff,
  RefreshCw,
  Building2,
  Clock,
  Target,
  Shield,
  AlertTriangle,
  Brain,
} from "lucide-react";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

/* ════════════════════════════════════════════════════
   API helpers
   ════════════════════════════════════════════════════ */

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

async function fetchDigest() {
  if (!searchServiceUrl) return null;
  let recentSearches = [];
  try {
    const raw = localStorage.getItem("spec_growth_recent_searches");
    if (raw) recentSearches = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  try {
    const response = await fetch(`${searchServiceUrl.replace(/\/$/, "")}/weekly-digest`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recent_searches: recentSearches,
        project_types: [],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.digest;
  } catch {
    return null;
  }
}

async function fetchVendorIntelligence() {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(`${searchServiceUrl.replace(/\/$/, "")}/vendor-intelligence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.intelligence;
  } catch {
    return null;
  }
}

/* ════════════════════════════════════════════════════
   Shared constants & helpers
   ════════════════════════════════════════════════════ */

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

const CATEGORIES = [
  "All", "Seating", "Tables", "Lighting", "Storage", "Rugs", "Outdoor", "Bedroom", "Accessories",
];
const STYLES = [
  "All", "Modern", "Mid-Century", "Coastal", "Traditional", "Minimalist", "Bohemian", "Industrial", "Transitional",
];

const TIER_COLORS = {
  luxury: "bg-gold/20 text-gold border-gold/30",
  premium: "bg-gold/20 text-gold border-gold/30",
  "mid-market": "bg-green-500/20 text-green-400 border-green-500/30",
  value: "bg-white/10 text-white/50 border-white/20",
};

/* ════════════════════════════════════════════════════
   Digest skeleton helpers
   ════════════════════════════════════════════════════ */

function ShimmerBlock({ className }) {
  return (
    <div className={`animate-pulse rounded-xl bg-white/[0.04] ${className || ""}`} />
  );
}

function SkeletonCards({ count = 3 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerBlock key={i} className="h-56" />
      ))}
    </div>
  );
}

function SkeletonPills() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <ShimmerBlock key={i} className="h-8 w-24 rounded-full" />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-10">
      <ShimmerBlock className="h-10 w-64" />
      <ShimmerBlock className="h-28" />
      <div>
        <ShimmerBlock className="h-6 w-40 mb-4" />
        <SkeletonCards count={3} />
      </div>
      <div>
        <ShimmerBlock className="h-6 w-40 mb-4" />
        <SkeletonPills />
      </div>
      <div>
        <ShimmerBlock className="h-6 w-40 mb-4" />
        <SkeletonCards count={2} />
      </div>
      <div>
        <ShimmerBlock className="h-6 w-40 mb-4" />
        <SkeletonCards count={2} />
      </div>
    </div>
  );
}

/* Digest section wrapper */
function Section({ icon: Icon, iconColor, title, children, delay = 0 }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <h2 className="font-display text-xl font-semibold text-white">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

/* Digest editor pick card */
function EditorPickCard({ pick }) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="glass-surface rounded-2xl overflow-hidden flex flex-col"
    >
      <div className="relative h-44 bg-white/[0.02] flex items-center justify-center overflow-hidden">
        {pick.image_url && !imgError ? (
          <img
            src={pick.image_url}
            alt={pick.product_name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageOff className="h-8 w-8 text-white/20" />
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs text-white/40 mb-1">{pick.vendor_name}</p>
        <h3 className="text-sm font-medium text-white leading-snug mb-1">{pick.product_name}</h3>
        {pick.retail_price && (
          <p className="text-gold text-sm font-semibold mb-2">{pick.retail_price}</p>
        )}
        {pick.why_picked && (
          <p className="text-white/30 text-xs leading-relaxed mb-3 flex-1">{pick.why_picked}</p>
        )}
        {pick.product_url && (
          <a
            href={pick.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold/70 transition-colors mt-auto"
          >
            View on vendor site <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════
   Tab 1 — TrendsTab
   ════════════════════════════════════════════════════ */

function TrendsTab() {
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
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-6">
        <div>
          <div className="label-caps text-white/30 mb-2">Category</div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => handleFilter(cat, style)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  category === cat
                    ? "bg-gold text-black"
                    : "bg-white/[0.03] text-white/40 hover:text-white/70"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label-caps text-white/30 mb-2">Style</div>
          <div className="flex flex-wrap gap-1.5">
            {STYLES.map((sty) => (
              <button
                key={sty}
                onClick={() => handleFilter(category, sty)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  style === sty
                    ? "bg-gold text-black"
                    : "bg-white/[0.03] text-white/40 hover:text-white/70"
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
        <div className="glass-surface rounded-2xl p-12 text-center">
          <Sparkles className="h-8 w-8 text-gold animate-pulse mx-auto mb-4" />
          <p className="text-white/40">Analyzing current design trends...</p>
        </div>
      )}

      {/* No data */}
      {!loading && !trends && (
        <div className="glass-surface rounded-2xl p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-white/20 mx-auto mb-4" />
          <p className="text-white/50 mb-2">Trend analysis unavailable</p>
          <p className="text-white/25 text-sm">The AI service is not responding. Check that your Anthropic API key is configured.</p>
          <button
            onClick={() => loadTrends(category, style)}
            className="mt-4 inline-flex items-center gap-2 text-sm text-gold hover:text-gold/70"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
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
              <div className="label-caps text-gold mb-4">
                Trending Now
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trends.trending_now.map((trend) => {
                  const MomentumIcon = MOMENTUM_ICON[trend.momentum] || ArrowRight;
                  const momentumColor = MOMENTUM_COLOR[trend.momentum] || "text-white/40";
                  return (
                    <div
                      key={trend.trend}
                      className="glass-surface rounded-2xl p-5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="rounded-full bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-white/40 uppercase">
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
                            <span key={v} className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold/70 border border-gold/15">
                              {v}
                            </span>
                          ))}
                        </div>
                      )}
                      {trend.search_terms?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {trend.search_terms.map((t) => (
                            <Link
                              key={t}
                              to={`${createPageUrl("Search")}?q=${encodeURIComponent(t)}`}
                              className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/30 hover:bg-gold/10 hover:text-gold transition-colors cursor-pointer"
                            >
                              <Search className="h-2.5 w-2.5 inline mr-0.5" />{t}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Emerging + Fading */}
          <div className="grid gap-4 sm:grid-cols-2">
            {trends.emerging?.length > 0 && (
              <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
                <div className="flex items-center gap-2 label-caps text-green-400 mb-4">
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
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <div className="flex items-center gap-2 label-caps text-white/30 mb-4">
                  <ArrowDown className="h-4 w-4" /> Fading
                </div>
                <div className="flex flex-wrap gap-2">
                  {trends.declining.map((d) => (
                    <span key={d} className="rounded-full bg-white/[0.03] px-3 py-1 text-sm text-white/30">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Color Forecast */}
          {trends.color_forecast?.length > 0 && (
            <div className="glass-surface rounded-2xl p-6">
              <div className="label-caps flex items-center gap-2 text-gold mb-4">
                <PaletteIcon className="h-4 w-4" /> Color Forecast
              </div>
              <div className="flex gap-6 flex-wrap">
                {trends.color_forecast.map((color) => (
                  <div key={color.name} className="text-center">
                    <div
                      className="w-14 h-14 rounded-xl border border-white/[0.06] mb-2"
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
              <div className="glass-surface rounded-2xl p-6">
                <div className="label-caps flex items-center gap-2 text-gold mb-3">
                  <Gem className="h-4 w-4" /> Material Spotlight
                </div>
                <p className="text-white/70 text-sm leading-relaxed">{trends.material_spotlight}</p>
              </div>
            )}
            {trends.designer_tip && (
              <div className="rounded-2xl border border-gold/20 bg-gold/5 p-6">
                <div className="flex items-center gap-2 label-caps text-gold mb-3">
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
        <div className="glass-surface rounded-2xl p-12 text-center">
          <TrendingUp className="h-10 w-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40">Unable to load trends. Make sure the search service is running with an API key.</p>
          <Button onClick={() => loadTrends(category, style)} className="mt-4 btn-gold" variant="outline">
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   Tab 2 — DigestTab
   ════════════════════════════════════════════════════ */

function DigestTab() {
  const [digest, setDigest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    const result = await fetchDigest();
    if (!result) {
      setError(true);
    } else {
      setDigest(result);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      {digest?.week_of && (
        <p className="text-white/30 text-sm mb-6">Week of {digest.week_of}</p>
      )}
      {!digest?.week_of && !loading && <div className="mb-6" />}
      {loading && <p className="text-white/30 text-sm mb-6">Loading...</p>}

      {/* Loading */}
      {loading && <LoadingSkeleton />}

      {/* Error */}
      {error && !loading && (
        <div className="glass-surface rounded-2xl p-12 text-center">
          <Megaphone className="h-8 w-8 text-red-400 mx-auto mb-4" />
          <p className="text-white/50 mb-4">Unable to load digest</p>
          <Button
            variant="outline"
            onClick={load}
            className="gap-2 border-white/[0.06] text-white/70 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Content */}
      {digest && !loading && (
        <div className="space-y-10">
          {/* Headline card */}
          {digest.headline && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.06] to-transparent p-6 md:p-8"
            >
              <Sparkles className="h-5 w-5 text-gold mb-3" />
              <p className="font-display text-lg md:text-xl text-white leading-relaxed">
                {digest.headline}
              </p>
            </motion.div>
          )}

          {/* Editor's Picks */}
          {digest.editor_picks?.length > 0 && (
            <Section icon={Star} iconColor="text-gold" title="Editor's Picks" delay={0.1}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {digest.editor_picks.map((pick, i) => (
                  <EditorPickCard key={i} pick={pick} />
                ))}
              </div>
            </Section>
          )}

          {/* Trending This Week */}
          {digest.trending_searches?.length > 0 && (
            <Section icon={TrendingUp} iconColor="text-green-400" title="Trending This Week" delay={0.15}>
              <div className="flex flex-wrap gap-2">
                {digest.trending_searches.map((term, i) => (
                  <Link
                    key={i}
                    to={`${createPageUrl("Search")}?q=${encodeURIComponent(term)}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5 text-sm text-white/60 hover:text-gold hover:border-gold/20 hover:bg-gold/5 transition-all"
                  >
                    <Search className="h-3 w-3" />
                    {term}
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {/* Industry News */}
          {digest.industry_news?.length > 0 && (
            <Section icon={Megaphone} iconColor="text-gold" title="Industry News" delay={0.2}>
              <div className="grid gap-4 sm:grid-cols-2">
                {digest.industry_news.map((news, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -2 }}
                    className="glass-surface rounded-2xl p-5"
                  >
                    <h3 className="text-sm font-medium text-white mb-2 leading-snug">
                      {news.headline}
                    </h3>
                    <p className="text-white/30 text-xs leading-relaxed mb-3">{news.summary}</p>
                    {news.source && (
                      <p className="text-white/20 text-xs">Source: {news.source}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            </Section>
          )}

          {/* New Collections */}
          {digest.new_collections?.length > 0 && (
            <Section icon={Package} iconColor="text-gold/70" title="New Collections" delay={0.25}>
              <div className="grid gap-4 sm:grid-cols-2">
                {digest.new_collections.map((col, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ y: -2 }}
                    className="glass-surface rounded-2xl p-5"
                  >
                    <p className="text-xs text-white/40 mb-1">{col.vendor}</p>
                    <h3 className="text-sm font-medium text-white mb-2">{col.collection}</h3>
                    <p className="text-white/30 text-xs leading-relaxed">{col.description}</p>
                  </motion.div>
                ))}
              </div>
            </Section>
          )}

          {/* For You */}
          {digest.personalized?.length > 0 && (
            <Section icon={Sparkles} iconColor="text-gold" title="For You" delay={0.3}>
              <div className="space-y-3">
                {digest.personalized.map((item, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ x: 4 }}
                    className="glass-surface rounded-xl p-4 flex items-start gap-3"
                  >
                    <Star className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm text-white leading-snug">{item.recommendation}</p>
                      {item.reason && (
                        <p className="text-white/30 text-xs mt-1">{item.reason}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </Section>
          )}

          {/* Pro Tip */}
          {digest.pro_tip && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.05] to-transparent p-5 flex items-start gap-3"
            >
              <Lightbulb className="h-5 w-5 text-gold shrink-0 mt-0.5" />
              <div>
                <p className="label-caps text-gold mb-1">
                  Pro Tip
                </p>
                <p className="text-sm text-white/70 leading-relaxed">{digest.pro_tip}</p>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   Tab 3 — VendorsTab
   ════════════════════════════════════════════════════ */

function VendorsTab() {
  const [intel, setIntel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchVendorIntelligence().then((result) => {
      setIntel(result);
      setLoading(false);
    });
  }, []);

  const vendors = intel?.vendors || [];
  const tiers = [...new Set(vendors.map((v) => v.tier))];
  const filtered = vendors.filter((v) => {
    if (filter !== "all" && v.tier !== filter) return false;
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Loading */}
      {loading && (
        <div className="glass-surface rounded-2xl p-12 text-center">
          <Sparkles className="h-8 w-8 text-gold animate-pulse mx-auto mb-4" />
          <p className="text-white/40">Analyzing vendor landscape...</p>
        </div>
      )}

      {!loading && !intel && (
        <div className="glass-surface rounded-2xl p-12 text-center">
          <Building2 className="h-8 w-8 text-white/20 mx-auto mb-4" />
          <p className="text-white/50 mb-2">Vendor intelligence unavailable</p>
          <p className="text-white/25 text-sm">The AI service is not responding. Check that your Anthropic API key is configured.</p>
          <button
            onClick={() => { setLoading(true); fetchVendorIntelligence().then((r) => { setIntel(r); setLoading(false); }); }}
            className="mt-4 inline-flex items-center gap-2 text-sm text-gold hover:text-gold/70"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      )}

      {intel && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Industry Context */}
          {intel.industry_context && (
            <div className="rounded-2xl border border-gold/20 bg-gold/5 p-6">
              <div className="label-caps flex items-center gap-2 text-gold mb-3">
                <Target className="h-4 w-4" /> Market Context
              </div>
              <p className="text-white/70 text-sm leading-relaxed">{intel.industry_context}</p>
            </div>
          )}

          {/* Sourcing Tips */}
          {intel.sourcing_tips?.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {intel.sourcing_tips.map((tip, i) => (
                <div key={i} className="rounded-xl border border-gold/20 bg-gold/5 p-4">
                  <Lightbulb className="h-4 w-4 text-gold mb-2" />
                  <p className="text-sm text-gold/80">{tip}</p>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/20" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vendors..."
                className="h-9 pl-9 pr-4 rounded-full border border-white/[0.06] bg-white/[0.03] text-sm text-white placeholder:text-white/20 outline-none focus:border-gold/30"
              />
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filter === "all" ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                }`}
              >
                All ({vendors.length})
              </button>
              {tiers.map((tier) => (
                <button
                  key={tier}
                  onClick={() => setFilter(tier)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    filter === tier ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {tier} ({vendors.filter((v) => v.tier === tier).length})
                </button>
              ))}
            </div>
          </div>

          {/* Vendor Cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((vendor) => (
              <motion.div
                key={vendor.id || vendor.name}
                layout
                className="glass-surface rounded-2xl p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{vendor.name}</h3>
                    <span className={`inline-block mt-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase ${TIER_COLORS[vendor.tier] || TIER_COLORS.value}`}>
                      {vendor.tier}
                    </span>
                  </div>
                  {vendor.typical_lead_time && (
                    <div className="flex items-center gap-1 text-xs text-white/30">
                      <Clock className="h-3 w-3" /> {vendor.typical_lead_time}
                    </div>
                  )}
                </div>

                {vendor.price_positioning && (
                  <p className="text-xs text-white/40 mb-3">{vendor.price_positioning}</p>
                )}

                {/* Specialties */}
                {vendor.specialties?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {vendor.specialties.map((s) => (
                      <span key={s} className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold/70 border border-gold/15">
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Strengths */}
                {vendor.strengths?.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1 text-[10px] text-green-400/70 uppercase mb-1">
                      <Star className="h-2.5 w-2.5" /> Strengths
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {vendor.strengths.map((s) => (
                        <span key={s} className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Considerations */}
                {vendor.considerations?.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1 text-[10px] text-yellow-400/70 uppercase mb-1">
                      <AlertTriangle className="h-2.5 w-2.5" /> Considerations
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {vendor.considerations.map((c) => (
                        <span key={c} className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] text-yellow-400">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Best For + Competes With */}
                <div className="flex flex-wrap gap-3 text-xs text-white/30 pt-2 border-t border-white/[0.06]">
                  {vendor.best_for && (
                    <span><Shield className="h-3 w-3 inline mr-1" />Best for: {vendor.best_for}</span>
                  )}
                  {vendor.competes_with?.length > 0 && (
                    <span>Competes with: {vendor.competes_with.join(", ")}</span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {!loading && !intel && (
        <div className="glass-surface rounded-2xl p-12 text-center">
          <Building2 className="h-10 w-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40">Unable to load vendor intelligence. Make sure the search service is running with an API key.</p>
          <Button
            onClick={() => {
              setLoading(true);
              fetchVendorIntelligence().then((r) => {
                setIntel(r);
                setLoading(false);
              });
            }}
            className="mt-4 btn-gold"
            variant="outline"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   Main — Intelligence hub
   ════════════════════════════════════════════════════ */

const TABS = [
  { key: "trends", label: "Trends", icon: TrendingUp },
  { key: "digest", label: "Digest", icon: Newspaper },
  { key: "vendors", label: "Vendors", icon: Building2 },
];

const VALID_TABS = new Set(TABS.map((t) => t.key));

export default function Intelligence() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    VALID_TABS.has(tabFromUrl) ? tabFromUrl : "trends"
  );

  /* Keep URL in sync when tab changes */
  useEffect(() => {
    const current = searchParams.get("tab");
    if (current !== activeTab) {
      setSearchParams({ tab: activeTab }, { replace: true });
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] py-8 md:py-10">
      <div className="page-wrap max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-2"
        >
          <Brain className="h-6 w-6 text-gold" />
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">
            Intelligence
          </h1>
        </motion.div>
        <p className="text-white/30 text-sm mb-6">
          AI-powered trends, digest, and vendor analysis in one place
        </p>

        {/* Tab buttons */}
        <div className="flex gap-1.5 mb-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-gold bg-gold/10 border border-gold/20"
                    : "text-white/30 hover:text-white/70 hover:bg-white/[0.03]"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === "trends" && <TrendsTab />}
            {activeTab === "digest" && <DigestTab />}
            {activeTab === "vendors" && <VendorsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
