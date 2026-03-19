import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import { Sparkles, Palette, Layers, Building2, DollarSign, ArrowRight, Loader2 } from "lucide-react";
import { getStyleInteractions } from "@/lib/growth-store";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

/**
 * StyleDNA Card — Shows the designer's visual taste profile
 * computed from their interactions (clicks, saves, compares, project additions).
 *
 * Usage: <StyleDNA />
 * Designed for Dashboard or profile pages.
 */
export default function StyleDNA() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interactions = getStyleInteractions();
    if (interactions.length < 3) {
      setLoading(false);
      return;
    }

    fetch(`${SEARCH_URL}/style-profile`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ interactions }),
    })
      .then(r => r.json())
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
      </div>
    );
  }

  if (!profile || profile.total_interactions < 3) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-display font-semibold text-white">Your Style DNA</h3>
        </div>
        <p className="text-xs text-white/30 mb-4">
          Search, save, and compare products to build your visual taste profile.
        </p>
        <Link
          to={createPageUrl("Search") + "?mode=discover"}
          className="inline-flex items-center gap-1.5 text-xs text-gold hover:text-gold transition-colors"
        >
          Start discovering <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  const topColors = profile.colors?.slice(0, 6) || [];
  const topMaterials = profile.materials?.slice(0, 4) || [];
  const topStyles = profile.styles?.slice(0, 3) || [];
  const topVendors = profile.vendors?.slice(0, 3) || [];
  const priceLabel = profile.avg_price
    ? `$${Number(profile.avg_price).toLocaleString()}`
    : null;

  // Simple radar chart approximation using CSS
  const styleMax = topStyles.length > 0 ? topStyles[0].count : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.06] glass-surface p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-display font-semibold text-white">Your Style DNA</h3>
        </div>
        <span className="text-[10px] text-white/20">
          {profile.total_interactions} interactions
        </span>
      </div>

      {/* Color Palette Bar */}
      {topColors.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Palette className="w-3 h-3 text-white/30" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Color Preferences</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden">
            {topColors.map((c, i) => {
              const colorMap = {
                black: "#1a1a1a", white: "#fafafa", gray: "#808080", brown: "#8B4513",
                beige: "#D4C5A9", cream: "#FFFDD0", navy: "#000080", blue: "#4169E1",
                green: "#2E8B57", red: "#DC143C", gold: "#DAA520", silver: "#C0C0C0",
                ivory: "#FFFFF0", charcoal: "#36454F", walnut: "#5C4033", oak: "#C19A6B",
                espresso: "#3C1414", natural: "#DEB887", tan: "#D2B48C",
              };
              const bgColor = colorMap[c.value.toLowerCase()] || "#666";
              const width = `${Math.max(c.count / profile.total_interactions * 100, 8)}%`;
              return (
                <div
                  key={i}
                  className="h-full"
                  style={{ backgroundColor: bgColor, width, minWidth: "12px" }}
                  title={`${c.value} (${c.count})`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {topColors.slice(0, 4).map((c, i) => (
              <span key={i} className="text-[10px] text-white/25">{c.value}</span>
            ))}
          </div>
        </div>
      )}

      {/* Style Bars */}
      {topStyles.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Layers className="w-3 h-3 text-white/30" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Style Profile</span>
          </div>
          <div className="space-y-1.5">
            {topStyles.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 w-24 truncate">{s.value}</span>
                <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.count / styleMax) * 100}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className="h-full bg-gold/60 rounded-full"
                  />
                </div>
                <span className="text-[10px] text-white/20 w-6 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Go-to Vendors */}
      {topVendors.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-3 h-3 text-white/30" />
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Go-to Vendors</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {topVendors.map((v, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[10px] text-white/50">
                {v.name} <span className="text-white/20">({v.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sweet Spot Summary */}
      <div className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <DollarSign className="w-3 h-3 text-white/30" />
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Your Sweet Spot</span>
        </div>
        <p className="text-xs text-white/60">
          {priceLabel && `${priceLabel} avg`}
          {topStyles[0] && ` ${topStyles[0].value}`}
          {topMaterials[0] && ` in ${topMaterials[0].value}`}
          {topColors[0] && ` (${topColors[0].value} tones)`}
        </p>
      </div>

      {/* CTA */}
      <Link
        to={createPageUrl("Search") + "?mode=discover"}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-gold/70 hover:text-gold transition-colors"
      >
        Discover new products matching your taste <ArrowRight className="w-3 h-3" />
      </Link>
    </motion.div>
  );
}
