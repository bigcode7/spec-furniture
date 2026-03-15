import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, Bell, TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";
import { LineChart, Line, Tooltip, ResponsiveContainer } from "recharts";

const SEVERITY_CONFIG = {
  critical: { label: "CRITICAL", bg: "bg-red-500/10 border-red-500/30", text: "text-red-300", dot: "bg-red-400" },
  high: { label: "HIGH", bg: "bg-orange-500/10 border-orange-500/30", text: "text-orange-300", dot: "bg-orange-400" },
  medium: { label: "MEDIUM", bg: "bg-yellow-500/10 border-yellow-500/30", text: "text-yellow-300", dot: "bg-yellow-400" }
};

const TYPE_ICON = {
  viral_spike: Zap,
  rising_fast: TrendingUp,
  growth_phase: TrendingUp,
  declining: TrendingDown,
  notable_movement: Minus
};

export default function AlertAgent() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const scan = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('trendAlertAgent', {});
    setData(res.data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Monitors 17 trending keywords. Fires alerts when something moves ±20% in 24h or ±50% in 7 days.</p>
          {data?.scannedAt && <p className="text-xs text-gray-600 mt-1">Last scan: {new Date(data.scannedAt).toLocaleString()}</p>}
        </div>
        <button
          onClick={scan}
          disabled={loading}
          className="flex items-center gap-2 bg-[#00E5A0] text-black font-bold px-5 py-2.5 rounded-xl hover:bg-[#00cc8e] disabled:opacity-50 transition-all text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Scanning…' : 'Scan Now'}
        </button>
      </div>

      {loading && (
        <div className="text-center py-16">
          <div className="w-10 h-10 border-2 border-[#00E5A0] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400">Scanning 17 trends across Google Trends…</p>
          <p className="text-gray-600 text-sm mt-1">~30 seconds</p>
        </div>
      )}

      {!data && !loading && (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
          <Bell className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">No alerts yet.</p>
          <p className="text-gray-600 text-sm">Click "Scan Now" to check for trend spikes across the watchlist.</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Alert count */}
          <div className="flex items-center gap-3">
            <span className={`text-2xl font-black ${data.alertCount > 0 ? 'text-[#00E5A0]' : 'text-gray-600'}`}>{data.alertCount}</span>
            <span className="text-gray-400">{data.alertCount === 1 ? 'alert' : 'alerts'} firing right now</span>
          </div>

          {/* Alerts */}
          {data.alerts?.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Active Alerts</h3>
              {data.alerts.map((alert, i) => {
                const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
                const Icon = TYPE_ICON[alert.type] || TrendingUp;
                const chartData = alert.timeline?.map((v, j) => ({ week: j + 1, value: v })) || [];
                return (
                  <div key={i} className={`border rounded-2xl p-4 ${cfg.bg}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot} animate-pulse`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Icon className={`w-4 h-4 ${cfg.text}`} />
                          <span className="font-bold capitalize">{alert.keyword}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold bg-black/20 ${cfg.text}`}>{cfg.label}</span>
                        </div>
                        <p className={`text-sm ${cfg.text} mb-2`}>{alert.message}</p>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>24h: <span className={alert.change24h >= 0 ? 'text-green-400' : 'text-red-400'}>{alert.change24h >= 0 ? '+' : ''}{alert.change24h}%</span></span>
                          <span>7d: <span className={alert.change7d >= 0 ? 'text-green-400' : 'text-red-400'}>{alert.change7d >= 0 ? '+' : ''}{alert.change7d}%</span></span>
                          <span>Interest: <span className="text-white">{alert.current}/100</span></span>
                        </div>
                        {chartData.length > 3 && (
                          <div className="mt-3 h-12">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chartData}>
                                <Line type="monotone" dataKey="value" stroke="#00E5A0" strokeWidth={1.5} dot={false} />
                                <Tooltip
                                  contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 6, fontSize: 10 }}
                                  formatter={v => [v, 'Interest']}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 text-center">
              <div className="text-green-400 font-bold mb-1">All Clear ✓</div>
              <p className="text-sm text-gray-400">No significant movements detected. All 17 tracked trends are within normal range.</p>
            </div>
          )}

          {/* Full snapshot */}
          {data.snapshot?.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Full Watchlist Snapshot</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {data.snapshot.map((item, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400 capitalize truncate pr-2">{item.keyword.replace(' furniture', '')}</span>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white">{item.current}</div>
                      <div className={`text-xs font-semibold ${item.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {item.change24h >= 0 ? '+' : ''}{item.change24h}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
