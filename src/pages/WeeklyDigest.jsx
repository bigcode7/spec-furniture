import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Newspaper,
  Star,
  TrendingUp,
  Megaphone,
  Package,
  Lightbulb,
  Search,
  ExternalLink,
  Sparkles,
  ImageOff,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

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

/* -- shimmer helpers -- */

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

/* -- section wrapper -- */

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

/* -- product card with image -- */

function EditorPickCard({ pick }) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden flex flex-col"
    >
      {/* image */}
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
            className="inline-flex items-center gap-1.5 text-xs text-gold/70 hover:text-gold transition-colors mt-auto"
          >
            View on vendor site <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

/* -- main component -- */

export default function WeeklyDigest() {
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
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-4xl">
        {/* -- Header -- */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-2"
        >
          <Newspaper className="h-6 w-6 text-gold" />
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">
            Weekly Digest
          </h1>
        </motion.div>
        {digest?.week_of && (
          <p className="text-white/30 text-sm mb-8">Week of {digest.week_of}</p>
        )}
        {!digest?.week_of && !loading && <div className="mb-8" />}
        {loading && <p className="text-white/30 text-sm mb-8">Loading...</p>}

        {/* -- Loading -- */}
        {loading && <LoadingSkeleton />}

        {/* -- Error -- */}
        {error && !loading && (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-12 text-center">
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

        {/* -- Content -- */}
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
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.04] px-3.5 py-1.5 text-sm text-white/60 hover:text-white hover:border-white/20 hover:bg-white/[0.07] transition-all"
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
              <Section icon={Megaphone} iconColor="text-gold/70" title="Industry News" delay={0.2}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {digest.industry_news.map((news, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ y: -2 }}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
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
              <Section icon={Package} iconColor="text-purple-400" title="New Collections" delay={0.25}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {digest.new_collections.map((col, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ y: -2 }}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
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
              <Section icon={Sparkles} iconColor="text-pink-400" title="For You" delay={0.3}>
                <div className="space-y-3">
                  {digest.personalized.map((item, i) => (
                    <motion.div
                      key={i}
                      whileHover={{ x: 4 }}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 flex items-start gap-3"
                    >
                      <Star className="h-4 w-4 text-pink-400 mt-0.5 shrink-0" />
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
                  <p className="text-xs font-semibold text-gold mb-1 uppercase tracking-wider">
                    Pro Tip
                  </p>
                  <p className="text-sm text-white/70 leading-relaxed">{digest.pro_tip}</p>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
