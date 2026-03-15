import { useState, useEffect } from "react";
import {
  Building2,
  Sparkles,
  Star,
  Clock,
  Target,
  Shield,
  AlertTriangle,
  Lightbulb,
  Search,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

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

const TIER_COLORS = {
  luxury: "bg-gold/20 text-gold border-gold/30",
  premium: "bg-gold/20 text-gold border-gold/30",
  "mid-market": "bg-green-500/20 text-green-400 border-green-500/30",
  value: "bg-white/10 text-white/50 border-white/20",
};

export default function VendorIntel() {
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
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-6 w-6 text-gold" />
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">
            Vendor Intelligence
          </h1>
        </div>
        <p className="text-white/30 text-sm mb-8">AI analysis of vendor positioning, strengths, and competitive landscape</p>

        {/* Loading */}
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <Sparkles className="h-8 w-8 text-gold animate-pulse mx-auto mb-4" />
            <p className="text-white/40">Analyzing vendor landscape...</p>
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
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-3">
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
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
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
                        <span key={s} className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-gold/70">
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
                  <div className="flex flex-wrap gap-3 text-xs text-white/30 pt-2 border-t border-white/5">
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
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <Building2 className="h-10 w-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/40">Unable to load vendor intelligence. Make sure the search service is running with an API key.</p>
            <Button onClick={() => { setLoading(true); fetchVendorIntelligence().then((r) => { setIntel(r); setLoading(false); }); }} className="mt-4" variant="outline">
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
