import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle, AlertTriangle, XCircle, DollarSign, BarChart2 } from "lucide-react";

const PRICE_POINTS = ["budget ($200-800)", "mid-market ($800-3,000)", "upper-mid ($3,000-8,000)", "luxury ($8,000+)"];
const LEAD_TIMES = ["2-4 weeks", "4-8 weeks", "8-12 weeks", "12+ weeks"];
const MARKETS = ["millennials (25-40)", "gen X (40-55)", "boomers (55+)", "interior designers", "contract/hospitality", "all consumers"];
const CAPACITIES = ["small (under 500 units/month)", "mid (500-2,000 units/month)", "large (2,000-10,000 units/month)", "enterprise (10,000+/month)"];

export default function CustomerInsightAgent() {
  const [step, setStep] = useState(0); // 0 = pick trend, 1-4 = questions, 5 = result
  const [trend, setTrend] = useState("");
  const [profile, setProfile] = useState({ capacity: "", leadTime: "", pricePoint: "", targetMarket: "", monthlyUnits: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const QUESTIONS = [
    {
      key: "capacity",
      question: "What's your production capacity?",
      options: CAPACITIES
    },
    {
      key: "leadTime",
      question: "What's your manufacturing lead time?",
      options: LEAD_TIMES
    },
    {
      key: "pricePoint",
      question: "What's your price point?",
      options: PRICE_POINTS
    },
    {
      key: "targetMarket",
      question: "What's your primary target market?",
      options: MARKETS
    }
  ];

  const startAnalysis = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('customerInsightAgent', { trend, profile });
    setResult(res.data);
    setStep(5);
    setLoading(false);
  };

  const reset = () => { setStep(0); setTrend(""); setProfile({ capacity: "", leadTime: "", pricePoint: "", targetMarket: "" }); setResult(null); };

  const REC_CONFIG = {
    YES: { color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", icon: CheckCircle },
    NO: { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: XCircle },
    CONDITIONAL: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20", icon: AlertTriangle }
  };

  return (
    <div className="space-y-6">
      {/* Step 0: Enter trend */}
      {step === 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-1">Should I manufacture this trend?</h3>
          <p className="text-gray-400 text-sm mb-5">Tell me which trend you're considering — then I'll ask 4 quick questions about your operation and give you a go/no-go recommendation.</p>
          <div className="flex gap-3">
            <input
              value={trend}
              onChange={e => setTrend(e.target.value)}
              placeholder='e.g. "boucle sofa", "curved sectional", "japandi bed"'
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5A0]/50"
            />
            <button
              onClick={() => trend.trim() && setStep(1)}
              disabled={!trend.trim()}
              className="bg-[#00E5A0] text-black font-bold px-5 py-3 rounded-xl hover:bg-[#00cc8e] disabled:opacity-50 transition-all"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Steps 1-4: Questions */}
      {step >= 1 && step <= 4 && (
        <div className="space-y-4">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-2">
            {[1,2,3,4].map(i => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-[#00E5A0]' : 'bg-white/10'}`} />
            ))}
            <span className="text-xs text-gray-500 ml-1">{step}/4</span>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="text-[#00E5A0] text-xs font-bold uppercase tracking-widest mb-2">Analyzing: {trend}</div>
            <h3 className="font-bold text-lg mb-5">{QUESTIONS[step-1].question}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {QUESTIONS[step-1].options.map(opt => (
                <button
                  key={opt}
                  onClick={() => {
                    setProfile(p => ({ ...p, [QUESTIONS[step-1].key]: opt }));
                    if (step < 4) setStep(step + 1);
                    else startAnalysis();
                  }}
                  className="text-left bg-white/5 border border-white/10 hover:border-[#00E5A0]/50 hover:bg-[#00E5A0]/5 rounded-xl p-3 text-sm text-gray-300 transition-all capitalize"
                >
                  {opt}
                </button>
              ))}
            </div>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="text-xs text-gray-600 hover:text-gray-400 mt-4 transition-colors">← Back</button>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-10 h-10 animate-spin text-[#00E5A0] mx-auto mb-3" />
          <p className="text-gray-400">Analyzing your profile against live market data for "{trend}"…</p>
          <p className="text-gray-600 text-sm mt-1">~15 seconds</p>
        </div>
      )}

      {/* Result */}
      {step === 5 && result && !loading && (
        <div className="space-y-5">
          {/* Recommendation banner */}
          {result.advice && (() => {
            const cfg = REC_CONFIG[result.advice.recommendation] || REC_CONFIG.CONDITIONAL;
            return (
              <div className={`border rounded-2xl p-6 ${cfg.bg}`}>
                <div className="flex items-center gap-3 mb-3">
                  <cfg.icon className={`w-7 h-7 ${cfg.color}`} />
                  <div>
                    <div className={`font-black text-2xl ${cfg.color}`}>{result.advice.recommendation}</div>
                    <div className="text-sm text-gray-300 mt-0.5">{result.advice.headline}</div>
                  </div>
                </div>
                {/* Reasons */}
                {result.advice.reasons?.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {result.advice.reasons.map((r, i) => (
                      <div key={i} className="flex gap-2 text-sm text-gray-300">
                        <CheckCircle className={`w-4 h-4 ${cfg.color} shrink-0 mt-0.5`} />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Warnings */}
          {result.advice?.warnings?.length > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 space-y-2">
              <div className="text-yellow-300 text-xs font-bold uppercase tracking-widest mb-2">⚠️ Timing Warnings</div>
              {result.advice.warnings.map((w, i) => (
                <div key={i} className="flex gap-2 text-sm text-gray-300">
                  <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Timing */}
          {result.advice?.timing && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">📅 Production Timeline</div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Start Production", value: result.advice.timing.startProduction, color: "text-green-400" },
                  { label: "Ship to Retail", value: result.advice.timing.shipToRetail, color: "text-[#00E5A0]" },
                  { label: "Discontinue", value: result.advice.timing.discontinue, color: "text-red-400" },
                ].map((t, i) => (
                  <div key={i}>
                    <div className={`font-bold text-sm ${t.color}`}>{t.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{t.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Financials */}
          {result.advice?.financials && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">📊 Financial Projection</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { icon: BarChart2, label: "Units to Make", value: result.advice.financials.recommendedUnits?.toLocaleString() },
                  { icon: BarChart2, label: "Sell-Through", value: result.advice.financials.expectedSellThrough },
                  { icon: DollarSign, label: "Est. Revenue", value: result.advice.financials.estimatedRevenue },
                  { icon: DollarSign, label: "Est. Profit", value: result.advice.financials.estimatedProfit },
                  { icon: DollarSign, label: "ROI", value: result.advice.financials.roi },
                ].filter(f => f.value).map((f, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="font-bold text-[#00E5A0]">{f.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{f.label}</div>
                  </div>
                ))}
              </div>
              {result.advice.pricePositioning && (
                <p className="text-xs text-gray-400 mt-4 pt-4 border-t border-white/10">{result.advice.pricePositioning}</p>
              )}
            </div>
          )}

          {/* Market data */}
          {result.marketData?.priceRange && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Live Market Prices for "{trend}"</div>
              <div className="flex gap-4 text-sm mb-3">
                <span>Range: <span className="text-white font-bold">${result.marketData.priceRange.min?.toLocaleString()} – ${result.marketData.priceRange.max?.toLocaleString()}</span></span>
                <span>Avg: <span className="text-[#00E5A0] font-bold">${result.marketData.priceRange.avg?.toLocaleString()}</span></span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {result.marketData.competingProducts?.map((p, i) => p.thumbnail && (
                  <a key={i} href={p.link} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-white/5 rounded-lg p-2 hover:bg-white/10 transition-all group text-xs">
                    <img src={p.thumbnail} alt={p.title} className="w-10 h-10 object-cover rounded" />
                    <div>
                      <div className="text-gray-300 line-clamp-1 group-hover:text-[#00E5A0] transition-colors">{p.title}</div>
                      <div className="text-[#00E5A0] font-bold">{p.price}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <button onClick={reset} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">← Analyze another trend</button>
        </div>
      )}
    </div>
  );
}
