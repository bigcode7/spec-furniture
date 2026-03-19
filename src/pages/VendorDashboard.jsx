import { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  Eye,
  MousePointer,
  FileText,
  FolderPlus,
  TrendingUp,
  Search,
  Building2,
  Lock,
  Sparkles,
  ArrowUp,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

// Deterministic pseudo-random from a string seed
function seededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function () {
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967295;
  };
}

function randBetween(rng, min, max) {
  return Math.round(min + rng() * (max - min));
}

const SEARCH_TERMS_BY_KEYWORD = {
  default: [
    "modern sofa", "luxury dining table", "upholstered chair", "accent table",
    "bedroom set", "console table", "sectional sofa", "bar stool",
    "coffee table marble", "nightstand",
  ],
  bernhardt: [
    "luxury dining table", "upholstered bed high end", "bernhardt sofa",
    "traditional accent chair", "formal living room set", "elegant console table",
    "wood dining chair premium", "luxury sectional", "bernhardt bedroom",
    "transitional furniture",
  ],
  four: [
    "reclaimed wood dining table", "industrial bookshelf", "four hands furniture",
    "rustic console table", "modern farmhouse chair", "live edge table",
    "artisan coffee table", "vintage-inspired sideboard", "woven accent chair",
    "iron frame shelving",
  ],
  hooker: [
    "hooker furniture sofa", "home office desk", "entertainment console",
    "leather recliner", "hooker bedroom set", "dining room hutch",
    "craft desk", "executive chair", "hooker storage cabinet",
    "traditional bookcase",
  ],
  century: [
    "century furniture sofa", "custom upholstered chair", "luxury dining table",
    "century bedroom collection", "traditional credenza", "formal living room",
    "hand-carved accent table", "century sectional", "high-end console table",
    "bespoke dining chair",
  ],
  caracole: [
    "caracole sofa", "contemporary dining table", "glam bedroom furniture",
    "caracole accent chair", "modern cocktail table", "mirrored nightstand",
    "caracole dining chair", "luxury console", "caracole gold accents",
    "contemporary side table",
  ],
  theodore: [
    "theodore alexander sofa", "luxury accent table", "hand-painted cabinet",
    "theodore alexander dining", "traditional desk", "ornate mirror",
    "leather accent chair", "theodore alexander lighting", "brass chandelier",
    "luxury credenza",
  ],
};

function getSearchTermsForVendor(vendorName) {
  const lower = vendorName.toLowerCase();
  for (const key of Object.keys(SEARCH_TERMS_BY_KEYWORD)) {
    if (key !== "default" && lower.includes(key)) {
      return SEARCH_TERMS_BY_KEYWORD[key];
    }
  }
  return SEARCH_TERMS_BY_KEYWORD.default;
}

const TRENDING_TERMS = [
  { term: "quiet luxury furniture", change: 34 },
  { term: "boucle accent chair", change: 22 },
  { term: "japandi dining table", change: 18 },
  { term: "curved sofa modern", change: 12 },
  { term: "fluted sideboard", change: 8 },
];

const cardAnim = {
  hidden: { opacity: 0, y: 20 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
};

export default function VendorDashboard() {
  const [vendors, setVendors] = useState([]);
  const [selectedVendorId, setSelectedVendorId] = useState(null);
  const [vendorIntel, setVendorIntel] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  // Fetch vendors list
  useEffect(() => {
    if (!searchServiceUrl) {
      setVendorsLoading(false);
      return;
    }
    fetch(`${searchServiceUrl.replace(/\/$/, "")}/vendors`)
      .then((r) => r.json())
      .then((data) => {
        const list = data.vendors || [];
        setVendors(list);
        if (list.length > 0) setSelectedVendorId(list[0].id);
      })
      .catch(() => {})
      .finally(() => setVendorsLoading(false));
  }, []);

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId);
  const vendorName = selectedVendor?.name || "Vendor";

  // Fetch vendor intelligence when selection changes
  useEffect(() => {
    if (!selectedVendor || !searchServiceUrl) return;
    setIntelLoading(true);
    setVendorIntel(null);
    fetch(`${searchServiceUrl.replace(/\/$/, "")}/vendor-intelligence`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ vendors: [selectedVendor.name] }),
    })
      .then((r) => r.json())
      .then((data) => {
        const intel = data.intelligence?.vendors || [];
        const match = intel.find(
          (v) => v.name.toLowerCase() === selectedVendor.name.toLowerCase()
        );
        setVendorIntel(match || intel[0] || null);
      })
      .catch(() => setVendorIntel(null))
      .finally(() => setIntelLoading(false));
  }, [selectedVendorId]);

  // Seeded metrics
  const metrics = useMemo(() => {
    const rng = seededRandom(vendorName);
    return {
      impressions: randBetween(rng, 1000, 5000),
      clicks: randBetween(rng, 100, 800),
      quotes: randBetween(rng, 20, 150),
      projectAdds: randBetween(rng, 10, 80),
    };
  }, [vendorName]);

  // Search terms bar chart data
  const searchTerms = useMemo(() => {
    const rng = seededRandom(vendorName + "_search");
    return getSearchTermsForVendor(vendorName).map((term) => ({
      term,
      count: randBetween(rng, 30, 300),
    }));
  }, [vendorName]);

  const maxSearchCount = Math.max(...searchTerms.map((s) => s.count));

  // Competitor data
  const competitors = useMemo(() => {
    const rng = seededRandom(vendorName + "_comp");
    const compNames = vendors
      .filter((v) => v.id !== selectedVendorId)
      .slice(0, 3)
      .map((v) => v.name);
    while (compNames.length < 3) {
      compNames.push(["Competitor A", "Competitor B", "Competitor C"][compNames.length]);
    }
    const rows = [
      {
        name: vendorName,
        isSelected: true,
        searchAppearances: metrics.impressions,
        clickRate: (((metrics.clicks / metrics.impressions) * 100) || 0).toFixed(1),
        quoteRate: (((metrics.quotes / metrics.clicks) * 100) || 0).toFixed(1),
      },
      ...compNames.map((name) => {
        const appearances = randBetween(rng, 800, 4500);
        const cr = (5 + rng() * 20).toFixed(1);
        const qr = (2 + rng() * 15).toFixed(1);
        return { name, isSelected: false, searchAppearances: appearances, clickRate: cr, quoteRate: qr };
      }),
    ];
    return rows;
  }, [vendorName, vendors, selectedVendorId, metrics]);

  const metricCards = [
    { label: "Search Impressions", value: metrics.impressions.toLocaleString(), icon: Eye, color: "text-gold" },
    { label: "Click-throughs", value: metrics.clicks.toLocaleString(), icon: MousePointer, color: "text-emerald-400" },
    { label: "Quote Inclusions", value: metrics.quotes.toLocaleString(), icon: FileText, color: "text-gold" },
    { label: "Project Adds", value: metrics.projectAdds.toLocaleString(), icon: FolderPlus, color: "text-purple-400" },
  ];

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="label-caps text-gold mb-2">Analytics</p>
            <div className="flex items-center gap-3 mb-1">
              <BarChart3 className="h-6 w-6 text-gold" />
              <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">
                Vendor Analytics Portal
              </h1>
            </div>
            <p className="text-white/30 text-sm">
              Performance insights &amp; designer engagement data
            </p>
          </div>

          {/* Vendor selector */}
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-white/40" />
            <select
              value={selectedVendorId || ""}
              onChange={(e) => setSelectedVendorId(e.target.value)}
              className="bg-white/[0.03] border border-white/[0.06] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40 appearance-none cursor-pointer min-w-[200px]"
            >
              {vendorsLoading && <option value="">Loading vendors…</option>}
              {!vendorsLoading && vendors.length === 0 && (
                <option value="">No vendors found</option>
              )}
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metricCards.map((card, i) => (
            <motion.div
              key={card.label}
              custom={i}
              variants={cardAnim}
              initial="hidden"
              animate="show"
              className="glass-surface rounded-2xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <card.icon className={`h-5 w-5 ${card.color}`} />
                <span className="label-caps text-white/20">
                  30d
                </span>
              </div>
              <div className="text-2xl font-bold text-gold">{card.value}</div>
              <div className="text-xs text-white/40 mt-1">{card.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Two-column: Search Terms + Gap Analysis */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* What Designers Are Searching For */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-surface rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Search className="h-5 w-5 text-gold" />
              <h2 className="font-display text-lg font-semibold text-white">
                What Designers Are Searching For
              </h2>
            </div>
            <div className="space-y-3">
              {searchTerms.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-white/30 w-4 text-right">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-white/70 truncate">{item.term}</span>
                      <span className="text-[10px] text-white/30 ml-auto shrink-0">
                        {item.count}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.count / maxSearchCount) * 100}%` }}
                        transition={{ delay: 0.4 + i * 0.05, duration: 0.6 }}
                        className="h-full rounded-full bg-gradient-to-r from-gold/80 to-gold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Gap Analysis */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-surface rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Sparkles className="h-5 w-5 text-gold" />
              <h2 className="font-display text-lg font-semibold text-white">
                Gap Analysis
              </h2>
              <span className="ml-auto label-caps text-gold/60 border border-gold/20 rounded px-2 py-0.5">
                AI Generated
              </span>
            </div>

            {intelLoading && (
              <div className="flex items-center justify-center py-12">
                <Sparkles className="h-6 w-6 text-gold animate-pulse" />
                <span className="ml-3 text-white/40 text-sm">Analyzing {vendorName}…</span>
              </div>
            )}

            {!intelLoading && !vendorIntel && (
              <p className="text-white/30 text-sm py-8 text-center">
                No intelligence data available. Ensure the search service is running.
              </p>
            )}

            {!intelLoading && vendorIntel && (
              <div className="space-y-4 text-sm">
                {vendorIntel.specialties && vendorIntel.specialties.length > 0 && (
                  <div>
                    <h3 className="label-caps text-white/50 mb-2">
                      Specialties
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {vendorIntel.specialties.map((s, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 rounded-full bg-gold/10 text-gold text-xs border border-gold/20"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {vendorIntel.strengths && vendorIntel.strengths.length > 0 && (
                  <div>
                    <h3 className="label-caps text-white/50 mb-2">
                      Strengths
                    </h3>
                    <ul className="space-y-1">
                      {vendorIntel.strengths.map((s, i) => (
                        <li key={i} className="text-white/60 flex items-start gap-2">
                          <span className="text-emerald-400 mt-0.5">+</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {vendorIntel.considerations && vendorIntel.considerations.length > 0 && (
                  <div>
                    <h3 className="label-caps text-white/50 mb-2">
                      Considerations
                    </h3>
                    <ul className="space-y-1">
                      {vendorIntel.considerations.map((s, i) => (
                        <li key={i} className="text-white/60 flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">!</span> {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {vendorIntel.competes_with && vendorIntel.competes_with.length > 0 && (
                  <div>
                    <h3 className="label-caps text-white/50 mb-2">
                      Competes With
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {vendorIntel.competes_with.map((c, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 rounded-full bg-white/[0.06] text-white/50 text-xs border border-white/[0.06]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>

        {/* Two-column: Trending + Competitor Visibility */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Trending in Your Category */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-surface rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <h2 className="font-display text-lg font-semibold text-white">
                Trending in Your Category
              </h2>
            </div>
            <div className="space-y-3">
              {TRENDING_TERMS.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-white/20 w-4 text-right">{i + 1}</span>
                    <span className="text-sm text-white/70">{item.term}</span>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-400 text-sm font-medium">
                    <ArrowUp className="h-3 w-3" />
                    +{item.change}%
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Competitor Visibility */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass-surface rounded-2xl p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Eye className="h-5 w-5 text-purple-400" />
              <h2 className="font-display text-lg font-semibold text-white">
                Competitor Visibility
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="label-caps text-white/30">
                    <th className="text-left pb-3 font-medium">Vendor</th>
                    <th className="text-right pb-3 font-medium">Search Appearances</th>
                    <th className="text-right pb-3 font-medium">Click Rate</th>
                    <th className="text-right pb-3 font-medium">Quote Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-t border-white/[0.04] ${
                        row.isSelected ? "bg-gold/[0.06]" : ""
                      }`}
                    >
                      <td className="py-3 text-left">
                        <span
                          className={
                            row.isSelected
                              ? "text-gold font-medium"
                              : "text-white/50"
                          }
                        >
                          {row.name}
                        </span>
                      </td>
                      <td className="py-3 text-right text-white/60">
                        {row.searchAppearances.toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-white/60">{row.clickRate}%</td>
                      <td className="py-3 text-right text-white/60">{row.quoteRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Upgrade CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] to-purple-500/[0.06] p-8 text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <Lock className="h-5 w-5 text-gold" />
            <h2 className="font-display text-xl font-semibold text-white">
              Upgrade to Pro
            </h2>
          </div>
          <p className="text-white/50 text-sm max-w-lg mx-auto mb-5">
            Get full analytics, real-time alerts, and designer intent data.
            Understand exactly what designers are looking for and how your products
            are performing against the competition.
          </p>
          <Button
            className="btn-gold px-6"
            onClick={() => window.location.href = "mailto:sales@spekd.design"}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Contact sales@spekd.design
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
