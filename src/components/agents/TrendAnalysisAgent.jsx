import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, ExternalLink, TrendingUp, Clock, Target, Zap } from "lucide-react";

const PHASE_COLOR = {
  emerging: "bg-gold/20 text-gold/70 border-gold/30",
  rising: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  mainstream: "bg-green-500/20 text-green-300 border-green-500/30",
  declining: "bg-red-500/20 text-red-300 border-red-500/30"
};

const SUGGESTIONS = ["boucle", "japandi", "quiet luxury", "curved sofa", "travertine", "mushroom color", "rattan", "fluted furniture"];

export default function TrendAnalysisAgent() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const analyze = async (trend) => {
    const t = trend || query;
    if (!t.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await base44.functions.invoke('trendAnalysisAgent', { trend: t.trim() });
    setResult(res.data);
    setLoading(false);
  };

  const { analysis, signals } = result || {};

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <p className="text-sm text-gray-400 mb-3">Ask about any furniture trend — get a full breakdown of <em>why</em> it's happening, how long it'll last, and what to do about it.</p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && analyze()}
              placeholder='e.g. "Why is boucle trending?" or just "boucle"'
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5A0]/50"
            />
          </div>
          <button
            onClick={() => analyze()}
            disabled={loading || !query.trim()}
            className="bg-[#00E5A0] text-black font-bold px-5 py-3 rounded-xl hover:bg-[#00cc8e] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => { setQuery(s); analyze(s); }} className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-gray-400 hover:text-white hover:border-white/30 transition-all capitalize">
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-[#00E5A0] mx-auto mb-3" />
          <p className="text-gray-400">Scanning Google Trends, Reddit, TikTok, news publications…</p>
          <p className="text-gray-600 text-sm mt-1">~20 seconds</p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-5">
          {/* Summary banner */}
          <div className="bg-[#00E5A0]/5 border border-[#00E5A0]/20 rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
              <h2 className="text-xl font-black capitalize">{result.trend}</h2>
              <div className="flex items-center gap-3">
                {analysis?.timeline?.currentPhase && (
                  <span className={`text-xs px-3 py-1 rounded-full font-bold border ${PHASE_COLOR[analysis.timeline.currentPhase] || PHASE_COLOR.emerging}`}>
                    {analysis.timeline.currentPhase}
                  </span>
                )}
                {analysis?.confidence && (
                  <span className="text-[#00E5A0] font-black text-lg">{analysis.confidence}%</span>
                )}
              </div>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">{analysis?.summary}</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: TrendingUp, label: "Google Interest", value: `${signals?.googleInterest || 0}/100` },
              { icon: Clock, label: "Expected Duration", value: analysis?.timeline?.expectedDuration || '—' },
              { icon: Target, label: "Peak Intensity", value: analysis?.timeline?.peakIntensity || '—' },
            ].map((s, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <s.icon className="w-5 h-5 text-[#00E5A0] mx-auto mb-2" />
                <div className="font-bold text-sm">{s.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Drivers */}
          {analysis?.drivers?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-4">Why It's Trending</h3>
              <div className="space-y-3">
                {analysis.drivers.map((d, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-[#00E5A0] font-black text-lg leading-none mt-0.5">{i + 1}</span>
                    <div>
                      <div className="font-semibold text-sm">{d.category}</div>
                      <div className="text-gray-400 text-xs mt-0.5">{d.explanation}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Similar past trends */}
          {analysis?.similarPastTrends?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-bold text-sm text-gray-400 uppercase tracking-widest mb-4">Similar Past Trends</h3>
              <div className="space-y-3">
                {analysis.similarPastTrends.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/5 rounded-xl p-3">
                    <div className="w-2 h-2 rounded-full bg-[#00E5A0] mt-1.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-sm">{t.name}</span>
                      <span className="text-gray-500 text-xs ml-2">{t.year} · {t.duration}</span>
                      <p className="text-gray-400 text-xs mt-0.5">{t.outcome}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {(analysis?.manufacturerAction || analysis?.retailerAction) && (
            <div className="grid md:grid-cols-2 gap-3">
              {analysis.manufacturerAction && (
                <div className="bg-gold/10 border border-gold/20 rounded-xl p-4">
                  <div className="text-gold/70 text-xs font-bold uppercase tracking-widest mb-2">Manufacturer Action</div>
                  <p className="text-sm text-gray-300">{analysis.manufacturerAction}</p>
                </div>
              )}
              {analysis.retailerAction && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="text-purple-300 text-xs font-bold uppercase tracking-widest mb-2">Retailer Action</div>
                  <p className="text-sm text-gray-300">{analysis.retailerAction}</p>
                </div>
              )}
            </div>
          )}

          {/* Source signals */}
          <div className="grid md:grid-cols-2 gap-3">
            {signals?.redditPosts?.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Reddit Discussions</div>
                <div className="space-y-1.5">
                  {signals.redditPosts.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-xs text-gray-400 hover:text-white transition-colors">
                      <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{p.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
            {signals?.newsArticles?.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">News Coverage</div>
                <div className="space-y-1.5">
                  {signals.newsArticles.map((a, i) => (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-xs text-gray-400 hover:text-white transition-colors">
                      <ExternalLink className="w-3 h-3 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{a.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Images */}
          {signals?.images?.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Visual References</div>
              <div className="flex gap-3 flex-wrap">
                {signals.images.map((img, i) => img.thumbnail && (
                  <a key={i} href={img.link} target="_blank" rel="noreferrer" className="group">
                    <img src={img.thumbnail} alt={img.title} className="w-24 h-24 object-cover rounded-xl group-hover:opacity-80 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}