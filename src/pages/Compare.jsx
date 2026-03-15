import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  GitCompare,
  ExternalLink,
  X,
  ImageOff,
  FileText,
  Download,
  Sparkles,
  Brain,
  Star,
  Clock,
  DollarSign,
  Lightbulb,
  Palette,
  Layout,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getCompareItems, clearCompareItems, removeCompareItem } from "@/lib/growth-store";
import { generateQuotePdf } from "@/lib/quote-generator";
import PresentationGenerator from "@/components/PresentationGenerator";
import PresentationTemplates from "@/components/PresentationTemplates";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

const SPEC_ROWS = [
  { label: "Vendor", key: "manufacturer_name" },
  { label: "Material", key: "material", fallback: "—" },
  { label: "Style", key: "style", fallback: "—" },
  { label: "Collection", key: "collection", fallback: "—" },
  { label: "SKU", key: "sku", fallback: "—" },
  {
    label: "Price",
    render: (item) => {
      if (item.retail_price) return `$${Number(item.retail_price).toLocaleString()}`;
      if (item.wholesale_price) return `$${Number(item.wholesale_price).toLocaleString()}`;
      return "Contact vendor";
    },
  },
  { label: "Lead Time", render: (item) => (item.lead_time_weeks ? `${item.lead_time_weeks} weeks` : "—") },
];

const TABS = [
  { id: "compare", label: "Compare", icon: GitCompare },
  { id: "presentation", label: "Presentation", icon: Palette },
  { id: "builder", label: "Builder", icon: Layout },
];

async function fetchCompareAnalysis(products) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(`${searchServiceUrl.replace(/\/$/, "")}/compare-analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ products }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.analysis;
  } catch {
    return null;
  }
}

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "compare";

  const [selected, setSelected] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    setSelected(getCompareItems());
  }, []);

  useEffect(() => {
    if (selected.length >= 2) {
      setAnalyzing(true);
      setAnalysis(null);
      fetchCompareAnalysis(selected).then((result) => {
        setAnalysis(result);
        setAnalyzing(false);
      });
    } else {
      setAnalysis(null);
    }
  }, [selected.length]);

  const handleRemove = (id) => {
    const next = removeCompareItem(id);
    setSelected(next);
  };

  const handleClear = () => {
    setSelected(clearCompareItems());
  };

  const handleGenerateQuote = async () => {
    setGenerating(true);
    try {
      await generateQuotePdf(selected, projectName || "Untitled Project");
    } finally {
      setGenerating(false);
    }
  };

  const getProductInsight = (id) => {
    if (!analysis?.products) return null;
    return analysis.products.find((p) => p.id === id);
  };

  const handleTabChange = (tabId) => {
    if (tabId === "compare") {
      setSearchParams({});
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <GitCompare className="h-6 w-6 text-gold" />
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">Compare Products</h1>
            <span className="text-sm text-white/30">{selected.length}/6</span>
          </div>
          {selected.length > 0 && activeTab === "compare" && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleClear}
                className="text-sm text-white/30 hover:text-gold/70 transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="mb-8">
          <div className="inline-flex bg-white/[0.03] border border-white/[0.06] rounded-full p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isActive
                      ? "text-gold bg-gold/10 border border-gold/20 shadow-sm"
                      : "text-white/30 hover:text-white/50 border border-transparent"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "compare" && (
          <>
            {/* Empty state */}
            {selected.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-24"
              >
                <GitCompare className="h-14 w-14 text-gold/20 mx-auto mb-4" />
                <p className="font-display text-white/40 text-lg mb-2">No products to compare</p>
                <p className="text-white/25 text-sm mb-8">
                  Search for products and click the compare icon to add them here.
                </p>
                <Link to={createPageUrl("Search")}>
                  <Button className="btn-gold">Go to Search</Button>
                </Link>
              </motion.div>
            )}

            {/* Compare Grid */}
            {selected.length > 0 && (
              <div className="space-y-8">
                {/* AI Analysis Card */}
                {(analyzing || analysis) && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-surface rounded-none border border-gold/20 p-6"
                  >
                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-4">
                      <Brain className="h-4 w-4" />
                      AI Design Analysis
                      {analyzing && (
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-gold/30 border-t-gold animate-spin ml-2" />
                      )}
                    </div>

                    {analyzing && !analysis && (
                      <div className="flex items-center gap-3 text-white/40 text-sm border-l-2 border-gold/20 pl-3">
                        <Sparkles className="h-4 w-4 animate-pulse text-gold/50" />
                        Analyzing products like a designer would...
                      </div>
                    )}

                    {analysis && (
                      <div className="space-y-5">
                        {/* Overview */}
                        <p className="text-white/80 text-sm leading-relaxed border-l-2 border-gold/20 pl-3">{analysis.overview}</p>

                        {/* Style Notes */}
                        {analysis.style_notes && (
                          <div className="flex gap-3 border border-white/[0.06] bg-white/[0.03] p-4">
                            <Lightbulb className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                            <p className="text-white/60 text-sm leading-relaxed">{analysis.style_notes}</p>
                          </div>
                        )}

                        {/* Recommendations */}
                        {analysis.recommendations?.length > 0 && (
                          <div className="grid gap-3 sm:grid-cols-3">
                            {analysis.recommendations.map((rec) => {
                              const matchedProduct = selected.find((p) => p.id === rec.product_id);
                              const icon = rec.scenario.toLowerCase().includes("value") ? DollarSign
                                : rec.scenario.toLowerCase().includes("quality") ? Star
                                : Clock;
                              const Icon = icon;
                              return (
                                <div key={rec.scenario} className="border border-white/[0.06] bg-white/[0.03] p-4">
                                  <div className="flex items-center gap-2 text-xs font-semibold text-white/50 mb-2">
                                    <Icon className="h-3.5 w-3.5" />
                                    {rec.scenario}
                                  </div>
                                  {matchedProduct && (
                                    <div className="text-sm font-medium text-white mb-1">{matchedProduct.product_name}</div>
                                  )}
                                  <p className="text-xs text-white/40 leading-relaxed">{rec.reasoning}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Product Cards Row */}
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(selected.length, 6)}, 1fr)` }}>
                  <AnimatePresence>
                    {selected.map((item) => {
                      const insight = getProductInsight(item.id);
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative border border-white/[0.06] bg-white/[0.03] overflow-hidden"
                        >
                          {/* Remove button */}
                          <button
                            onClick={() => handleRemove(item.id)}
                            className="absolute top-3 right-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white/50 transition-colors hover:bg-red-500/80 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>

                          {/* Image */}
                          <div className="aspect-[4/3] bg-white/[0.03]">
                            {item.thumbnail || item.image_url ? (
                              <img
                                src={item.thumbnail || item.image_url}
                                alt={item.product_name}
                                className="h-full w-full object-cover"
                                onError={(e) => { e.target.style.display = "none"; }}
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center">
                                <ImageOff className="h-8 w-8 text-white/10" />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-4">
                            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-1">{item.manufacturer_name}</div>
                            <div className="text-sm font-display text-white leading-tight line-clamp-2">{item.product_name}</div>

                            {/* AI Insight */}
                            {insight && (
                              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                                <p className="text-xs text-white/50 leading-relaxed">{insight.insight}</p>
                                {insight.strengths?.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {insight.strengths.map((s) => (
                                      <span key={s} className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">{s}</span>
                                    ))}
                                  </div>
                                )}
                                {insight.weaknesses?.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {insight.weaknesses.map((w) => (
                                      <span key={w} className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] text-red-400">{w}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {item.portal_url && (
                              <a
                                href={item.portal_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 mt-3 text-xs text-white/40 hover:text-gold/70 transition-colors"
                              >
                                View on vendor site <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Specs Table */}
                <div className="border border-white/[0.06] bg-white/[0.03] overflow-hidden">
                  {SPEC_ROWS.map((row, rowIdx) => (
                    <div
                      key={row.label}
                      className={`grid gap-0 ${rowIdx < SPEC_ROWS.length - 1 ? "border-b border-white/[0.06]" : ""}`}
                      style={{ gridTemplateColumns: `160px repeat(${selected.length}, 1fr)` }}
                    >
                      <div className="p-4 text-[9px] font-bold text-gold/50 uppercase tracking-[0.3em] flex items-center">
                        {row.label}
                      </div>
                      {selected.map((item) => (
                        <div key={item.id} className="p-4 text-sm text-white/70 border-l border-white/[0.06]">
                          {row.render
                            ? row.render(item)
                            : item[row.key] || row.fallback || "—"}
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Visit Vendor Row */}
                  <div
                    className="grid gap-0 border-t border-white/[0.06]"
                    style={{ gridTemplateColumns: `160px repeat(${selected.length}, 1fr)` }}
                  >
                    <div className="p-4" />
                    {selected.map((item) => (
                      <div key={item.id} className="p-4 border-l border-white/[0.06]">
                        {item.portal_url ? (
                          <a
                            href={item.portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-gold flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white transition-colors"
                          >
                            Visit vendor <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : (
                          <div className="text-center text-xs text-white/20">Link unavailable</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quote Generator */}
                <div className="glass-surface border border-gold/20 p-6">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-2">
                        <FileText className="h-4 w-4" /> Generate AI Quote
                      </div>
                      <p className="text-white/40 text-sm mb-4">
                        Create a professional PDF proposal with AI-written narratives for each product, ready to share with clients.
                      </p>
                      <input
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="Project name (optional)"
                        className="h-10 w-full max-w-xs border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-gold/30 transition-colors"
                      />
                    </div>
                    <Button
                      onClick={handleGenerateQuote}
                      disabled={generating || selected.length < 1}
                      className="btn-gold shrink-0"
                    >
                      {generating ? (
                        <div className="h-4 w-4 rounded-full border-2 border-black/20 border-t-black animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {generating ? "Generating..." : "Download PDF Quote"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "presentation" && (
          <PresentationGenerator products={selected} />
        )}

        {activeTab === "builder" && (
          <PresentationTemplates products={selected} />
        )}
      </div>
    </div>
  );
}
