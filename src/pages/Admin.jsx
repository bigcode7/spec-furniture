import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/AuthContext";

const API = import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai";

async function adminFetch(path) {
  const token = localStorage.getItem("spec_auth_token");
  const res = await fetch(`${API.replace(/\/$/, "")}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function adminPost(path, body = {}) {
  const token = localStorage.getItem("spec_auth_token");
  const res = await fetch(`${API.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Helpers ──

function fmtDate(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(iso) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function timeAgo(iso) {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const fmt = (n) => (n == null ? "\u2014" : Number(n).toLocaleString());

// ── Admin Login Form ──

function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API.replace(/\/$/, "")}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }
      // Check if admin
      if (data.user?.email?.toLowerCase() !== "tyler@spekd.ai") {
        setError("Not an admin account");
        setLoading(false);
        return;
      }
      localStorage.setItem("spec_auth_token", data.token);
      localStorage.setItem("spec_auth_user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-900">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Spekd" className="h-8 w-auto" />
          <span className="text-gray-500 text-sm ml-2">Admin</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg px-3.5 py-3 text-sm text-white bg-gray-800 border border-gray-700 focus:border-amber-500/50 focus:outline-none"
              placeholder="admin@spekd.ai"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg px-3.5 py-3 text-sm text-white bg-gray-800 border border-gray-700 focus:border-amber-500/50 focus:outline-none"
            />
          </div>
          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Shared Components ──

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-gray-500 text-sm animate-pulse">Loading...</div>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div className="text-red-400 text-sm py-4">Error: {msg}</div>
  );
}

function Badge({ color, children }) {
  const colors = {
    amber: "bg-amber-500/20 text-amber-400",
    gray: "bg-gray-700 text-gray-400",
    green: "bg-emerald-500/20 text-emerald-400",
    red: "bg-red-500/20 text-red-400",
    purple: "bg-purple-500/20 text-purple-400",
    blue: "bg-blue-500/20 text-blue-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

function Toast({ message, onClose }) {
  if (!message) return null;
  const isError = message.toLowerCase().startsWith("error");
  return (
    <div className={`${isError ? "bg-red-900/30 border-red-800/50 text-red-400" : "bg-emerald-900/30 border-emerald-800/50 text-emerald-400"} border px-4 py-2 rounded-lg text-sm flex justify-between items-center mb-4`}>
      {message}
      <button onClick={onClose} className="ml-4 hover:text-white">x</button>
    </div>
  );
}

// ── Search Chart ──

function SearchChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const w = 800, h = 200, barW = w / data.length - 2;
  return (
    <div className="bg-gray-800 rounded-lg p-5 mt-6">
      <h3 className="text-sm font-medium text-gray-400 mb-3">Searches &mdash; Last 30 Days</h3>
      <svg viewBox={`0 0 ${w} ${h + 30}`} className="w-full">
        {data.map((d, i) => {
          const barH = (d.count / max) * h;
          return (
            <g key={i}>
              <rect x={i * (w / data.length) + 1} y={h - barH} width={barW} height={barH}
                fill="#f59e0b" rx="2" className="opacity-80 hover:opacity-100" />
              {i % 5 === 0 && (
                <text x={i * (w / data.length) + barW / 2} y={h + 18} textAnchor="middle"
                  className="fill-gray-500" fontSize="10">{d.date.slice(5)}</text>
              )}
            </g>
          );
        })}
        <text x="0" y="12" className="fill-gray-500" fontSize="10">{fmt(max)}</text>
      </svg>
    </div>
  );
}

// ── Admin Search Bar ──

function AdminSearchBar({ onNavigate }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim()) {
      setResults(null);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      adminFetch(`/admin/search?q=${encodeURIComponent(val.trim())}`)
        .then((data) => {
          setResults(data);
          setOpen(true);
        })
        .catch(() => {
          setResults(null);
          setOpen(false);
        });
    }, 300);
  };

  const handleClick = (tab) => {
    setOpen(false);
    setQuery("");
    setResults(null);
    onNavigate(tab);
  };

  const users = results?.users || [];
  const products = results?.products || [];
  const vendors = results?.vendors || [];
  const hasResults = users.length > 0 || products.length > 0 || vendors.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        placeholder="Search admin..."
        value={query}
        onChange={handleChange}
        className="bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:border-amber-500"
      />
      {open && results && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
          {!hasResults && (
            <div className="px-4 py-3 text-gray-500 text-sm">No results found.</div>
          )}
          {users.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800/50">Users</div>
              {users.map((u, i) => (
                <button key={i} onClick={() => handleClick("Users")}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm">
                  <div className="text-white">{u.name || u.full_name || "Unknown"}</div>
                  <div className="text-gray-500 text-xs">{u.email}</div>
                </button>
              ))}
            </div>
          )}
          {products.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800/50">Products</div>
              {products.map((p, i) => (
                <button key={i} onClick={() => handleClick("Catalog Health")}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm">
                  <div className="text-white">{p.product_name || p.name}</div>
                  <div className="text-gray-500 text-xs">{p.vendor_name || p.vendor || "\u2014"}</div>
                </button>
              ))}
            </div>
          )}
          {vendors.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-800/50">Vendors</div>
              {vendors.map((v, i) => (
                <button key={i} onClick={() => handleClick("Catalog Health")}
                  className="w-full text-left px-4 py-2 hover:bg-gray-700/50 text-sm">
                  <div className="text-white">{v.vendor_name || v.vendor_id || v.name}</div>
                  <div className="text-gray-500 text-xs">{v.count != null ? `${v.count} products` : ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Overview Tab ──

function LiveVisitorsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    adminFetch("/admin/active-visitors?minutes=5")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [refresh]);

  if (loading || !data) return null;

  function timeAgo(iso) {
    if (!iso) return "\u2014";
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-5 ring-1 ring-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">Live Activity</h3>
        <button onClick={refresh} className="text-xs text-gray-500 hover:text-gray-300">Refresh</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={`inline-block w-2 h-2 rounded-full ${data.active_now > 0 ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
            <span className="text-2xl font-bold text-white">{data.active_now}</span>
          </div>
          <div className="text-sm text-gray-400">On Site Now</div>
          <div className="text-[10px] text-gray-600">Last 5 minutes</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{data.last_24h}</div>
          <div className="text-sm text-gray-400">Last 24h</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{data.total_anonymous}</div>
          <div className="text-sm text-gray-400">All-Time Visitors</div>
        </div>
        <div>
          <div className="text-lg font-bold text-white">{data.last_visitor ? timeAgo(data.last_visitor.last_seen) : "\u2014"}</div>
          <div className="text-sm text-gray-400">Last Visit</div>
          {data.last_visitor && (
            <div className="text-[10px] text-gray-600">{data.last_visitor.search_count} searches</div>
          )}
        </div>
      </div>
      {data.active_visitors?.length > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-2">Active Visitors</div>
          <div className="space-y-1">
            {data.active_visitors.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-xs text-gray-400 bg-gray-900/50 rounded px-3 py-1.5">
                <span className="font-mono">{v.fingerprint}</span>
                <span>{v.search_count} searches</span>
                <span>{timeAgo(v.last_seen)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SearchLocationsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    setLoading(true);
    adminFetch(`/admin/search-locations?days=${days}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <div className="bg-gray-800 rounded-lg p-5 animate-pulse h-48" />;
  if (!data || !data.locations?.length) {
    return (
      <div className="bg-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-2">Search Locations</h3>
        <p className="text-xs text-gray-600">No location data yet. Locations are tracked on new searches.</p>
      </div>
    );
  }

  const maxCount = data.locations[0]?.count || 1;

  return (
    <div className="bg-gray-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-400">Where Searches Come From</h3>
        <div className="flex gap-1">
          {[7, 14, 30].map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs px-2 py-1 rounded ${days === d ? "bg-gray-600 text-white" : "text-gray-500 hover:text-gray-300"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {data.locations.map((loc, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className="w-40 text-gray-300 truncate">{loc.city}, {loc.region}</div>
            <div className="flex-1">
              <div className="h-5 bg-gray-900 rounded overflow-hidden">
                <div className="h-full bg-amber-500/30 rounded flex items-center px-2"
                  style={{ width: `${Math.max(8, (loc.count / maxCount) * 100)}%` }}>
                  <span className="text-xs text-amber-400 font-medium">{loc.count}</span>
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-600 w-12 text-right">{loc.country === "United States" ? "US" : loc.country}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] text-gray-600">{data.total_with_location} searches with location data in last {days} days</div>
    </div>
  );
}

function OverviewTab({ data, loading, error }) {
  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const overview = data;
  const recentSignups = overview.recent_signups || [];
  const recentSearches = overview.recent_searches || [];
  const revenue = overview.revenue_summary || {};
  const aiCosts = overview.ai_costs || {};
  const costPerSearch = overview.cost_per_search || 0;
  const mrr = overview.mrr || 0;
  const arr = mrr * 12;
  const proUsers = overview.active_pro || 0;
  const arpu = proUsers > 0 ? Math.round(mrr / proUsers) : 0;
  const totalUsers = overview.total_users || 0;
  const convRate = totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Live Visitors */}
      <LiveVisitorsPanel />

      {/* Search Locations */}
      <SearchLocationsPanel />

      {/* Revenue Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-lg p-5 ring-1 ring-amber-500/20">
          <div className="text-2xl font-bold text-amber-400">${mrr.toLocaleString()}</div>
          <div className="text-sm text-gray-400">MRR</div>
          <div className="text-[10px] text-gray-600 mt-1">Monthly Recurring Revenue</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">${arr.toLocaleString()}</div>
          <div className="text-sm text-gray-400">ARR</div>
          <div className="text-[10px] text-gray-600 mt-1">Annualized run rate</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">${arpu}</div>
          <div className="text-sm text-gray-400">ARPU</div>
          <div className="text-[10px] text-gray-600 mt-1">Avg revenue per Pro user</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">{convRate}%</div>
          <div className="text-sm text-gray-400">Conversion</div>
          <div className="text-[10px] text-gray-600 mt-1">Users → Pro</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">${aiCosts.today ? aiCosts.today.cost.toFixed(4) : overview.api_cost_estimate?.toFixed(2) || "\u2014"}</div>
          <div className="text-sm text-gray-400">AI Cost Today</div>
          <div className="text-[10px] text-gray-600 mt-1">
            {costPerSearch > 0 ? `$${costPerSearch.toFixed(4)}/search` : "Haiku 4.5"} · {aiCosts.today?.calls || 0} calls
          </div>
        </div>
      </div>

      {/* User & Search Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">{fmt(overview.total_users)}</div>
          <div className="text-sm text-gray-400">Total Users</div>
          {overview.new_users_this_week != null && (
            <div className="text-xs text-emerald-400 mt-1">+{overview.new_users_this_week} this week</div>
          )}
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">{fmt(overview.active_pro)}</div>
          <div className="text-sm text-gray-400">Active Pro</div>
          {overview.new_pro_this_week != null && (
            <div className="text-xs text-emerald-400 mt-1">+{overview.new_pro_this_week} this week</div>
          )}
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">{fmt(overview.searches_today)}</div>
          <div className="text-sm text-gray-400">Searches Today</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className={`text-2xl font-bold ${overview.health_alert_count > 0 ? "text-amber-400" : "text-white"}`}>
            {fmt(overview.health_alert_count)}
          </div>
          <div className="text-sm text-gray-400">Health Alerts</div>
        </div>
      </div>

      {/* Search Chart */}
      <SearchChart data={overview.searches_by_day} />

      {/* Recent Signups & Recent Searches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <div className="bg-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Signups</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Company</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2">Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {recentSignups.map((u, i) => (
                  <tr key={i} className="text-gray-300 hover:bg-gray-700/50">
                    <td className="py-2 pr-3">{u.full_name || u.name || "\u2014"}</td>
                    <td className="py-2 pr-3 text-xs font-mono">{u.email}</td>
                    <td className="py-2 pr-3">{u.business_name || u.company || "\u2014"}</td>
                    <td className="py-2 pr-3 text-xs">{fmtDate(u.created_at || u.signup_date)}</td>
                    <td className="py-2">
                      <Badge color={(u.plan || "free") === "pro" ? "amber" : "gray"}>{u.plan || "free"}</Badge>
                    </td>
                  </tr>
                ))}
                {recentSignups.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-500">No recent signups.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Searches */}
        <div className="bg-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Recent Searches</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="py-2 pr-3">Query</th>
                  <th className="py-2 pr-3">Results</th>
                  <th className="py-2 pr-3">Location</th>
                  <th className="py-2 pr-3">Tier</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {recentSearches.map((s, i) => (
                  <tr key={i} className="text-gray-300 hover:bg-gray-700/50">
                    <td className="py-2 pr-3">{s.query || s.term || "\u2014"}</td>
                    <td className="py-2 pr-3">{fmt(s.result_count ?? s.results)}</td>
                    <td className="py-2 pr-3 text-xs text-gray-500">
                      {s.location ? `${s.location.city}, ${s.location.region}` : "\u2014"}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge color={s.tier === 1 ? "amber" : "gray"}>
                        {s.tier === 1 ? "Pro" : "Free"}
                      </Badge>
                    </td>
                    <td className="py-2 text-xs text-gray-500">{fmtTime(s.created_at || s.timestamp)}</td>
                  </tr>
                ))}
                {recentSearches.length === 0 && (
                  <tr><td colSpan={5} className="py-4 text-center text-gray-500">No recent searches.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ──

function UserSearchHistory({ userId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch(`/admin/users/${userId}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div className="px-3 py-4 text-xs text-gray-500">Loading search history...</div>;
  if (!data) return <div className="px-3 py-4 text-xs text-gray-500">Failed to load.</div>;

  const history = data.search_history || [];
  const savedCount = data.saved_products_count || 0;

  return (
    <div className="px-3 py-4 bg-gray-900/50">
      <div className="flex gap-4 mb-3 text-xs text-gray-500">
        <span>{history.length} searches recorded</span>
        <span>{savedCount} saved products</span>
      </div>
      {history.length === 0 ? (
        <div className="text-xs text-gray-600">No search history yet.</div>
      ) : (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {history.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-gray-800/50 rounded px-3 py-1.5">
              <span className="text-gray-300 flex-1 truncate">{s.query}</span>
              <span className="text-gray-600 ml-3">{s.result_count} results</span>
              <span className="text-gray-600 ml-3 whitespace-nowrap">{fmtTime(s.searched_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UsersTab({ data, loading, error, onRefresh }) {
  const [compEmail, setCompEmail] = useState("");
  const [compDays, setCompDays] = useState("30");
  const [compNote, setCompNote] = useState("");
  const [compLoading, setCompLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState({});
  const [expandedUser, setExpandedUser] = useState(null);

  const handleCompSubmit = async (e) => {
    e.preventDefault();
    if (!compEmail.trim()) return;
    setCompLoading(true);
    try {
      const days = parseInt(compDays);
      await adminPost("/admin/comp", { email: compEmail.trim(), days, note: compNote.trim() });
      setToast(`Pro access granted to ${compEmail} ${days >= 36500 ? "forever (lifetime)" : `for ${compDays} days`}.`);
      setCompEmail("");
      setCompNote("");
      onRefresh();
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setCompLoading(false);
    }
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm("This will immediately revoke all access. Are you sure?")) return;
    setActionLoading((p) => ({ ...p, [userId]: "deactivate" }));
    try {
      await adminPost("/admin/deactivate", { user_id: userId });
      setToast(`User ${userId} deactivated.`);
      onRefresh();
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setActionLoading((p) => ({ ...p, [userId]: null }));
    }
  };

  const handleReactivate = async (userId) => {
    setActionLoading((p) => ({ ...p, [userId]: "reactivate" }));
    try {
      await adminPost("/admin/reactivate", { user_id: userId });
      setToast(`User ${userId} reactivated.`);
      onRefresh();
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setActionLoading((p) => ({ ...p, [userId]: null }));
    }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!window.confirm(`PERMANENTLY DELETE ${email}? This cannot be undone.`)) return;
    if (!window.confirm(`Are you absolutely sure? All data for ${email} will be erased.`)) return;
    setActionLoading((p) => ({ ...p, [userId]: "delete" }));
    try {
      await adminPost("/admin/delete-user", { user_id: userId });
      setToast(`User ${email} permanently deleted.`);
      onRefresh();
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setActionLoading((p) => ({ ...p, [userId]: null }));
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const activeComps = data.active_comps || [];
  const allUsers = data.users || [];

  const filteredUsers = allUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    const matchesSearch = !q ||
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q);
    const sub = u.subscription || {};
    const plan = (sub.plan || u.plan || "free").toLowerCase();
    const isDeactivated = u.deactivated === true;
    const isComped = sub.comped === true || plan.includes("comp");
    const isTrialing = sub.status === "trialing";
    const isPro = sub.status === "active" && !isComped;
    let matchesFilter = true;
    if (userFilter === "pro") matchesFilter = isPro;
    else if (userFilter === "trialing") matchesFilter = isTrialing;
    else if (userFilter === "free") matchesFilter = !isPro && !isTrialing && !isComped && !isDeactivated;
    else if (userFilter === "comped") matchesFilter = isComped;
    else if (userFilter === "deactivated") matchesFilter = isDeactivated;
    return matchesSearch && matchesFilter;
  });

  // Count trial signups
  const trialCount = allUsers.filter((u) => (u.subscription || {}).status === "trialing").length;

  return (
    <div className="space-y-8">
      <Toast message={toast} onClose={() => setToast(null)} />

      {/* Comp Pro Form */}
      <div className="bg-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-1">Grant Free Access</h3>
        <p className="text-[11px] text-gray-600 mb-4">Give anyone a free trial or permanent free Pro membership</p>
        <form onSubmit={handleCompSubmit} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="text"
              placeholder="user@example.com"
              value={compEmail}
              onChange={(e) => setCompEmail(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Duration</label>
            <select
              value={compDays}
              onChange={(e) => setCompDays(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            >
              <option value="7">7 days (trial)</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">6 months</option>
              <option value="365">1 year</option>
              <option value="36500">Lifetime (free forever)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Note</label>
            <input
              type="text"
              placeholder="Beta tester, High Point demo, etc."
              value={compNote}
              onChange={(e) => setCompNote(e.target.value)}
              className="bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            disabled={compLoading}
            className="bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg px-4 py-2 text-sm disabled:opacity-50"
          >
            {compLoading ? "Granting..." : "Grant Pro Access"}
          </button>
        </form>
      </div>

      {/* Active Comps Table */}
      {activeComps.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Active Comps</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs">
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Days</th>
                  <th className="py-2 pr-3">Note</th>
                  <th className="py-2 pr-3">Granted</th>
                  <th className="py-2 pr-3">Expires</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {activeComps.map((c, i) => {
                  const isActive = c.expires_at && new Date(c.expires_at) > new Date();
                  return (
                    <tr key={i} className="text-gray-300 hover:bg-gray-700/50">
                      <td className="py-2 pr-3 text-xs font-mono">{c.email}</td>
                      <td className="py-2 pr-3">{c.days >= 36500 ? "Lifetime" : `${c.days}d`}</td>
                      <td className="py-2 pr-3 text-gray-500">{c.note || "\u2014"}</td>
                      <td className="py-2 pr-3 text-xs">{fmtDate(c.granted_at || c.created_at)}</td>
                      <td className="py-2 pr-3 text-xs">{fmtDate(c.expires_at)}</td>
                      <td className="py-2">
                        <Badge color={isActive ? "green" : "gray"}>{isActive ? "Active" : "Expired"}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Users */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">All Users</h3>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search name or email..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:border-amber-500"
          />
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
          >
            <option value="all">All</option>
            <option value="pro">Pro</option>
            <option value="trialing">Trialing ({trialCount})</option>
            <option value="free">Free</option>
            <option value="comped">Comped</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <span className="text-gray-500 text-sm self-center">{filteredUsers.length} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-700">
                <th className="py-2 px-3">Name</th>
                <th className="py-2 px-3">Email</th>
                <th className="py-2 px-3">Company</th>
                <th className="py-2 px-3">Plan</th>
                <th className="py-2 px-3">Signup</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredUsers.map((u, i) => {
                const uid = u.id || u.email;
                const sub = u.subscription || {};
                const isDeactivated = u.deactivated === true;
                const isComped = sub.comped === true || (sub.plan || "").includes("comp");
                const isTrialing = sub.status === "trialing";
                const isPro = sub.status === "active" && !isComped;
                const planLabel = isDeactivated ? "deactivated" : isComped ? "comp" : isTrialing ? "trialing" : isPro ? "pro" : "free";
                let planColor = "gray";
                if (isPro) planColor = "amber";
                else if (isTrialing) planColor = "blue";
                else if (isComped) planColor = "purple";
                else if (isDeactivated) planColor = "red";
                // Calculate trial days remaining
                const trialDaysLeft = isTrialing && sub.trial_end
                  ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                  : null;

                const isExpanded = expandedUser === uid;
                return (
                  <React.Fragment key={uid + "-" + i}>
                    <tr className={`text-gray-300 hover:bg-gray-700/50 cursor-pointer ${isExpanded ? "bg-gray-700/30" : ""}`}
                        onClick={() => setExpandedUser(isExpanded ? null : uid)}>
                      <td className="py-2 px-3">
                        <span className="mr-1.5 text-gray-600 text-xs">{isExpanded ? "\u25BC" : "\u25B6"}</span>
                        {u.full_name || u.name || "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-xs font-mono">{u.email}</td>
                      <td className="py-2 px-3">{u.business_name || u.company || "\u2014"}</td>
                      <td className="py-2 px-3">
                        <Badge color={planColor}>{planLabel}</Badge>
                        {trialDaysLeft != null && (
                          <span className="ml-1.5 text-[10px] text-blue-400">{trialDaysLeft}d left</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-xs">{fmtDate(u.created_at || u.signup_date)}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs ${isDeactivated ? "text-red-400" : "text-emerald-400"}`}>
                          {isDeactivated ? "Deactivated" : "Active"}
                        </span>
                      </td>
                      <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {isDeactivated ? (
                            <button
                              onClick={() => handleReactivate(uid)}
                              disabled={actionLoading[uid] === "reactivate"}
                              className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1 rounded disabled:opacity-50"
                            >
                              {actionLoading[uid] === "reactivate" ? "..." : "Reactivate"}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeactivate(uid)}
                              disabled={actionLoading[uid] === "deactivate"}
                              className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1 rounded disabled:opacity-50"
                            >
                              {actionLoading[uid] === "deactivate" ? "..." : "Deactivate"}
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteUser(uid, u.email)}
                            disabled={!!actionLoading[uid]}
                            className="bg-gray-700 hover:bg-red-800 text-gray-400 hover:text-red-300 text-xs px-2 py-1 rounded disabled:opacity-50 transition-colors"
                            title="Permanently delete"
                          >
                            {actionLoading[uid] === "delete" ? "..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <UserSearchHistory userId={uid} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="text-gray-500 text-center py-8 text-sm">No users found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Catalog Health Tab ──

function CatalogHealthTab({ data, loading, error, onRefresh }) {
  const [toast, setToast] = useState(null);
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);
  const [rebuildVectorsLoading, setRebuildVectorsLoading] = useState(false);
  const [rebuildIndexLoading, setRebuildIndexLoading] = useState(false);
  const [expandedVendor, setExpandedVendor] = useState(null);

  const handleDismissAlert = async (alertId) => {
    try {
      await adminPost("/admin/dismiss-alert", { alert_id: alertId });
      setToast("Alert dismissed.");
      onRefresh();
    } catch (err) {
      setToast(`Error: ${err.message}`);
    }
  };

  const handleHealthCheck = async () => {
    setHealthCheckLoading(true);
    try {
      await adminPost("/admin/run-health-check");
      setToast("Health check started.");
      onRefresh();
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setHealthCheckLoading(false);
    }
  };

  const handleRebuildVectors = async () => {
    if (!window.confirm("Rebuild all vectors? This may take a while.")) return;
    setRebuildVectorsLoading(true);
    try {
      await adminPost("/admin/rebuild-vectors");
      setToast("Vector rebuild started.");
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setRebuildVectorsLoading(false);
    }
  };

  const handleRebuildIndex = async () => {
    if (!window.confirm("Rebuild catalog index? This may take a while.")) return;
    setRebuildIndexLoading(true);
    try {
      await adminPost("/admin/rebuild-catalog-index");
      setToast("Catalog index rebuild started.");
    } catch (err) {
      setToast(`Error: ${err.message}`);
    } finally {
      setRebuildIndexLoading(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const totals = {
    total_products: data.total_products,
    total_vendors: data.total_vendors,
    broken_images: data.total_broken_images,
    missing_descriptions: data.total_missing_descriptions,
    ai_tagged: data.total_ai_tagged,
    last_health_check: data.last_health_run,
  };
  const alerts = data.alerts || [];
  const vendors = (data.vendors || []).map(v => ({
    ...v,
    name: v.vendor_name || v.vendor_id,
    product_count: v.products_total,
    good_images: v.images_good,
    broken_images: v.images_broken,
    broken: v.images_broken,
    missing_desc: v.missing_descriptions,
    untagged: (v.products_total || 0) - (v.ai_tagged || 0),
  }));

  return (
    <div className="space-y-6">
      <Toast message={toast} onClose={() => setToast(null)} />

      {/* Catalog Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">{fmt(totals.total_products)}</div>
          <div className="text-sm text-gray-400">Total Products</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">{fmt(totals.total_vendors)}</div>
          <div className="text-sm text-gray-400">Total Vendors</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className={`text-2xl font-bold ${(totals.broken_images || 0) > 0 ? "text-red-400" : "text-white"}`}>
            {fmt(totals.broken_images)}
          </div>
          <div className="text-sm text-gray-400">Broken Images</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">{fmt(totals.missing_descriptions)}</div>
          <div className="text-sm text-gray-400">Missing Descriptions</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">{fmt(totals.ai_tagged)}</div>
          <div className="text-sm text-gray-400">AI Tagged</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-5">
          <div className="text-2xl font-bold text-white">{timeAgo(totals.last_health_check)}</div>
          <div className="text-sm text-gray-400">Last Health Check</div>
        </div>
      </div>

      {/* Health Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Health Alerts</h3>
          {alerts.map((alert, i) => {
            const borderColor =
              alert.severity === "critical" ? "border-l-red-500" :
              alert.severity === "warning" ? "border-l-amber-500" :
              "border-l-blue-500";
            return (
              <div key={alert.id || i} className={`bg-gray-800 rounded-lg p-4 border-l-4 ${borderColor} flex justify-between items-center`}>
                <div className="text-sm text-gray-300">{alert.message}</div>
                <button
                  onClick={() => handleDismissAlert(alert.id || i)}
                  className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1 rounded-lg ml-4 shrink-0"
                >
                  Dismiss
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Vendor Table */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3">Vendors</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="text-gray-500 text-xs border-b border-gray-700">
                <th className="py-2 px-3">Vendor</th>
                <th className="py-2 px-3">Products</th>
                <th className="py-2 px-3">Good Images</th>
                <th className="py-2 px-3">Broken</th>
                <th className="py-2 px-3">Missing Desc</th>
                <th className="py-2 px-3">AI Tagged</th>
                <th className="py-2 px-3">Health</th>
                <th className="py-2 px-3">Last Checked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {vendors.map((v, i) => {
                const isExpanded = expandedVendor === (v.name || i);
                const healthPct = v.health_pct != null ? v.health_pct : null;
                let healthColor = "green";
                if (healthPct != null) {
                  if (healthPct < 50) healthColor = "red";
                  else if (healthPct < 80) healthColor = "amber";
                }
                return (
                  <React.Fragment key={v.name || i}>
                    <tr
                      className="text-gray-300 hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => setExpandedVendor(isExpanded ? null : (v.name || i))}
                    >
                      <td className="py-2 px-3 font-medium">{v.name || "\u2014"}</td>
                      <td className="py-2 px-3">{fmt(v.product_count || v.products)}</td>
                      <td className="py-2 px-3">{fmt(v.good_images)}</td>
                      <td className="py-2 px-3">{fmt(v.broken_images || v.broken)}</td>
                      <td className="py-2 px-3">{fmt(v.missing_descriptions || v.missing_desc)}</td>
                      <td className="py-2 px-3">{fmt(v.ai_tagged)}</td>
                      <td className="py-2 px-3">
                        {healthPct != null ? (
                          <Badge color={healthColor}>{Math.round(healthPct)}%</Badge>
                        ) : "\u2014"}
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-500">{timeAgo(v.last_checked)}</td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-800/50">
                        <td colSpan={8} className="p-4">
                          <div className="space-y-3">
                            {/* Sample Thumbnails */}
                            {v.sample_products && v.sample_products.length > 0 && (
                              <div>
                                <div className="text-xs text-gray-500 mb-2">Sample Products</div>
                                <div className="flex gap-2 flex-wrap">
                                  {v.sample_products.slice(0, 5).map((p, pi) => (
                                    <img
                                      key={pi}
                                      src={p.image_url || p.thumbnail}
                                      alt={p.name || "product"}
                                      className="w-[60px] h-[60px] object-cover rounded bg-gray-700"
                                      onError={(e) => { e.target.style.display = "none"; }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Broken Image URLs */}
                            {v.broken_image_urls && v.broken_image_urls.length > 0 && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Broken Image URLs</div>
                                <div className="text-xs text-red-400 space-y-1 max-h-32 overflow-y-auto">
                                  {v.broken_image_urls.map((url, ui) => (
                                    <div key={ui} className="truncate font-mono">{url}</div>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-6 text-xs text-gray-500">
                              <span>Missing descriptions: {fmt(v.missing_descriptions || v.missing_desc)}</span>
                              <span>Untagged products: {fmt(v.untagged)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          {vendors.length === 0 && (
            <div className="text-gray-500 text-center py-8 text-sm">No vendor data.</div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleHealthCheck}
          disabled={healthCheckLoading}
          className="bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg px-4 py-2 text-sm disabled:opacity-50 inline-flex items-center gap-2"
        >
          {healthCheckLoading && <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>}
          Run Health Check
        </button>
        <button
          onClick={handleRebuildVectors}
          disabled={rebuildVectorsLoading}
          className="bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg px-4 py-2 text-sm disabled:opacity-50 inline-flex items-center gap-2"
        >
          {rebuildVectorsLoading && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
          Rebuild Vectors
        </button>
        <button
          onClick={handleRebuildIndex}
          disabled={rebuildIndexLoading}
          className="bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg px-4 py-2 text-sm disabled:opacity-50 inline-flex items-center gap-2"
        >
          {rebuildIndexLoading && <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>}
          Rebuild Catalog Index
        </button>
      </div>
    </div>
  );
}

// ── Activity Log Tab ──

function ActivityLogTab({ data, loading, error }) {
  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const logs = data.log || data.logs || (Array.isArray(data) ? data : []);

  const actionColors = {
    comp: "purple",
    deactivate: "red",
    reactivate: "green",
    health_check: "blue",
    rebuild: "amber",
    dismiss: "gray",
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-700">
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-3">Action</th>
              <th className="py-2 px-3">Target</th>
              <th className="py-2 px-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {(Array.isArray(logs) ? logs : []).map((entry, i) => {
              const action = (entry.action || "").toLowerCase();
              let color = "gray";
              for (const [key, val] of Object.entries(actionColors)) {
                if (action.includes(key)) { color = val; break; }
              }
              return (
                <tr key={i} className="text-gray-300 hover:bg-gray-700/50">
                  <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">{fmtTime(entry.created_at || entry.timestamp)}</td>
                  <td className="py-2 px-3">
                    <Badge color={color}>{entry.action || "\u2014"}</Badge>
                  </td>
                  <td className="py-2 px-3">{entry.target || entry.target_email || "\u2014"}</td>
                  <td className="py-2 px-3 text-gray-500">{entry.details || entry.note || "\u2014"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(Array.isArray(logs) ? logs : []).length === 0 && (
          <div className="text-gray-500 text-center py-8 text-sm">No activity logged.</div>
        )}
      </div>
    </div>
  );
}

// ── Metric Card ──
function MetricCard({ label, value, sub, highlight }) {
  return (
    <div className={`bg-gray-800 rounded-xl p-4 ${highlight ? "ring-1 ring-amber-500/30" : ""}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-[10px] text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

// ── Mini Bar Chart (reusable) ──
function MiniBarChart({ data, labelKey, valueKey, maxBars = 10, barColor = "amber" }) {
  if (!data || data.length === 0) return <div className="text-gray-500 text-xs py-4 text-center">No data</div>;
  const items = data.slice(0, maxBars);
  const max = Math.max(...items.map(d => d[valueKey] || 0), 1);
  return (
    <div className="space-y-1.5">
      {items.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-40 text-xs text-gray-400 truncate text-right shrink-0" title={d[labelKey]}>
            {d[labelKey]}
          </div>
          <div className="flex-1 h-5 bg-gray-700/50 rounded relative overflow-hidden">
            <div
              className={`h-full rounded bg-${barColor}-500/40`}
              style={{ width: `${Math.max(2, ((d[valueKey] || 0) / max) * 100)}%` }}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium text-gray-300">
              {(d[valueKey] || 0).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hourly Volume Chart ──
function HourlyChart({ data }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count || 0), 1);
  return (
    <div className="flex items-end gap-[2px] h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.hour || i}:00 — ${d.count} searches`}>
          <div
            className="w-full bg-amber-500/50 rounded-t hover:bg-amber-500/80 transition-colors"
            style={{ height: `${Math.max(2, ((d.count || 0) / max) * 100)}%` }}
          />
          {i % 4 === 0 && <span className="text-[9px] text-gray-600">{d.hour ?? i}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Analytics Tab ──

function AnalyticsTab({ data, loading, error }) {
  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const overview = data.overview || {};
  const topQueries = data.top_queries || [];
  const zeroResults = data.zero_result_queries || [];
  const topClicked = data.top_clicked_products || [];
  const topCompared = data.top_compared_products || [];
  const topQuoted = data.top_quoted_products || [];
  const vendorCtr = data.vendor_ctr || [];
  const hourly = data.hourly_volume || [];

  return (
    <div className="space-y-6">
      {/* Search KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard label="Total Searches" value={fmt(overview.total_searches)} />
        <MetricCard label="Today" value={fmt(overview.searches_today)} />
        <MetricCard label="This Week" value={fmt(overview.searches_week)} />
        <MetricCard label="Unique Queries" value={fmt(overview.unique_queries)} />
        <MetricCard label="Zero-Result Rate" value={
          overview.total_searches > 0
            ? `${((overview.zero_result_count || 0) / overview.total_searches * 100).toFixed(1)}%`
            : "0%"
        } sub={`${fmt(overview.zero_result_count)} queries returned nothing`} highlight={overview.zero_result_count > 10} />
      </div>

      {/* Hourly Volume */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-medium text-gray-400 mb-3">Search Volume by Hour (Today)</h3>
        <HourlyChart data={hourly} />
      </div>

      {/* Top Queries + Zero Results side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Top Queries</h3>
          <MiniBarChart data={topQueries} labelKey="query" valueKey="count" maxBars={15} barColor="amber" />
        </div>
        <div className="bg-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-red-400 mb-4">Zero-Result Queries</h3>
          {zeroResults.length === 0
            ? <div className="text-gray-500 text-xs py-4 text-center">No zero-result queries</div>
            : <MiniBarChart data={zeroResults} labelKey="query" valueKey="count" maxBars={15} barColor="red" />
          }
        </div>
      </div>

      {/* Product Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Most Clicked Products</h3>
          <MiniBarChart data={topClicked} labelKey="product_name" valueKey="clicks" maxBars={10} barColor="blue" />
        </div>
        <div className="bg-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Most Compared</h3>
          <MiniBarChart data={topCompared} labelKey="product_name" valueKey="compares" maxBars={10} barColor="purple" />
        </div>
        <div className="bg-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Most Quoted</h3>
          <MiniBarChart data={topQuoted} labelKey="product_name" valueKey="quotes" maxBars={10} barColor="emerald" />
        </div>
      </div>

      {/* Vendor CTR */}
      {vendorCtr.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Vendor Click-Through Rate</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-700">
                  <th className="py-2 px-3">Vendor</th>
                  <th className="py-2 px-3">Impressions</th>
                  <th className="py-2 px-3">Clicks</th>
                  <th className="py-2 px-3">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {vendorCtr.map((v, i) => (
                  <tr key={i} className="text-gray-300 hover:bg-gray-700/50">
                    <td className="py-2 px-3 font-medium">{v.vendor || v.vendor_id}</td>
                    <td className="py-2 px-3">{fmt(v.impressions)}</td>
                    <td className="py-2 px-3">{fmt(v.clicks)}</td>
                    <td className="py-2 px-3">
                      <Badge color={parseFloat(v.ctr) > 5 ? "green" : parseFloat(v.ctr) > 2 ? "amber" : "red"}>
                        {v.ctr}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Traffic Tab ──

function TrafficTab({ data, loading, error, onDrillDown, drillCity, drillData, drillLoading }) {
  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const cities = data.cities || [];

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-400">Traffic by City (7 days)</h3>
          {drillCity && (
            <button onClick={() => onDrillDown(null)} className="text-xs text-amber-400 hover:text-amber-300">
              &larr; Back to overview
            </button>
          )}
        </div>

        {!drillCity ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-gray-700">
                  <th className="py-2 px-3">City</th>
                  <th className="py-2 px-3">Region</th>
                  <th className="py-2 px-3">Searches</th>
                  <th className="py-2 px-3">Unique IPs</th>
                  <th className="py-2 px-3">Unique Queries</th>
                  <th className="py-2 px-3">Top Query</th>
                  <th className="py-2 px-3">Repeat %</th>
                  <th className="py-2 px-3">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {cities.map((c, i) => (
                  <tr
                    key={i}
                    className="text-gray-300 hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => onDrillDown(c.city)}
                  >
                    <td className="py-2 px-3 font-medium text-amber-400">{c.city}</td>
                    <td className="py-2 px-3 text-gray-500">{c.region}, {c.country}</td>
                    <td className="py-2 px-3">{fmt(c.total_searches)}</td>
                    <td className="py-2 px-3">{c.unique_ips}</td>
                    <td className="py-2 px-3">{c.unique_queries}</td>
                    <td className="py-2 px-3 text-xs truncate max-w-[200px]">{c.top_query} ({c.top_query_count}x)</td>
                    <td className="py-2 px-3">{c.repeat_rate}%</td>
                    <td className="py-2 px-3">
                      <Badge color={c.risk === "high" ? "red" : c.risk === "medium" ? "amber" : "gray"}>
                        {c.risk}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {cities.length === 0 && (
                  <tr><td colSpan={8} className="py-8 text-center text-gray-500 text-xs">No traffic with location data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        ) : drillLoading ? (
          <Loading />
        ) : drillData ? (
          <div className="space-y-5">
            {/* Drill-down header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="City" value={drillData.city} />
              <MetricCard label="Total Searches" value={fmt(drillData.total_searches)} />
              <MetricCard label="Unique IPs" value={String(drillData.unique_ips?.length || 0)} />
              <MetricCard label="IPs" value={drillData.unique_ips?.join(", ") || "—"} />
            </div>

            {/* Query frequency */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <h4 className="text-xs font-medium text-gray-400 mb-3">Query Frequency</h4>
              {(drillData.query_frequency || []).map((q, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-300 truncate max-w-[70%]">{q.query}</span>
                  <Badge color={q.count > 5 ? "red" : q.count > 2 ? "amber" : "gray"}>{q.count}x</Badge>
                </div>
              ))}
            </div>

            {/* Recent searches */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <h4 className="text-xs font-medium text-gray-400 mb-3">Recent Searches</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="py-1.5 px-2">Time</th>
                      <th className="py-1.5 px-2">Query</th>
                      <th className="py-1.5 px-2">IP</th>
                      <th className="py-1.5 px-2">Results</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(drillData.recent_searches || []).map((s, i) => (
                      <tr key={i} className="text-gray-400">
                        <td className="py-1.5 px-2 whitespace-nowrap">{fmtTime(s.time)}</td>
                        <td className="py-1.5 px-2 text-gray-300">{s.query}</td>
                        <td className="py-1.5 px-2 font-mono text-gray-500">{s.ip}</td>
                        <td className="py-1.5 px-2">{s.results}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Funnel Tab ──

function FunnelTab({ data, loading, error }) {
  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const stages = [
    { label: "Anonymous Visitors", value: data.anonymous_visitors, color: "gray" },
    { label: "Used All 7 Free Searches", value: data.used_all_free_searches, color: "blue" },
    { label: "Trial Signups", value: data.trial_signups, color: "purple" },
    { label: "Trial Active", value: data.trial_active, color: "amber" },
    { label: "Converted to Pro", value: data.converted_to_pro, color: "emerald" },
    { label: "Cancelled", value: data.cancelled, color: "red" },
  ];

  const maxVal = Math.max(...stages.map(s => s.value || 0), 1);

  return (
    <div className="space-y-6">
      {/* Funnel visualization */}
      <div className="bg-gray-800 rounded-xl p-6 space-y-3">
        <h3 className="text-sm font-semibold text-white mb-4">Trial Funnel</h3>
        {stages.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-48 text-xs text-gray-400 text-right shrink-0">{s.label}</div>
            <div className="flex-1 h-7 bg-gray-700/50 rounded relative overflow-hidden">
              <div
                className={`h-full rounded bg-${s.color}-500/30 border-r-2 border-${s.color}-400 transition-all`}
                style={{ width: `${Math.max(2, ((s.value || 0) / maxVal) * 100)}%` }}
              />
              <span className={`absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-${s.color}-400`}>
                {(s.value || 0).toLocaleString()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Conversion rates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Signup Rate" value={`${data.signup_rate || 0}%`} sub="Free searches → trial signup" />
        <MetricCard label="Conversion Rate" value={`${data.conversion_rate || 0}%`} sub="Trial → paid Pro" />
        <MetricCard label="Trials Active" value={data.trial_active || 0} sub="Currently trialing" />
        <MetricCard label="Failed Payments" value={(data.failed_payments || []).length} sub="Needs attention" />
      </div>

      {/* Trials expiring soon */}
      {(data.trials_expiring_soon || []).length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-amber-400 mb-3">Trials Expiring in 48 Hours</h4>
          <div className="space-y-2">
            {data.trials_expiring_soon.map((t, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{t.user_id}</span>
                <span className="text-gray-500">{t.plan} — ends {new Date(t.trial_end).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed payments */}
      {(data.failed_payments || []).length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-red-400 mb-3">Failed Payments</h4>
          <div className="space-y-2">
            {data.failed_payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-gray-300">{p.user_id}</span>
                <span className="text-gray-500">{p.plan} — failed {p.payment_failed_at ? new Date(p.payment_failed_at).toLocaleDateString() : "unknown"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Admin Component ──

const TABS = ["Overview", "Analytics", "Traffic", "Funnel", "Users", "Catalog Health", "Activity Log"];

export default function Admin() {
  const { user, isLoadingAuth } = useAuth();
  const [adminUser, setAdminUser] = useState(null); // for direct admin login
  const [tab, setTab] = useState("Overview");

  // Data cache per tab
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState(null);
  const [overviewLoaded, setOverviewLoaded] = useState(false);

  const [usersData, setUsersData] = useState(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [usersLoaded, setUsersLoaded] = useState(false);

  const [catalogData, setCatalogData] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [activityData, setActivityData] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState(null);
  const [activityLoaded, setActivityLoaded] = useState(false);

  const [funnelData, setFunnelData] = useState(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [funnelError, setFunnelError] = useState(null);
  const [funnelLoaded, setFunnelLoaded] = useState(false);

  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const [trafficData, setTrafficData] = useState(null);
  const [trafficLoading, setTrafficLoading] = useState(false);
  const [trafficError, setTrafficError] = useState(null);
  const [trafficLoaded, setTrafficLoaded] = useState(false);
  const [trafficDrillCity, setTrafficDrillCity] = useState(null);
  const [trafficDrillData, setTrafficDrillData] = useState(null);
  const [trafficDrillLoading, setTrafficDrillLoading] = useState(false);

  const fetchOverview = useCallback((force = false) => {
    if (overviewLoaded && !force) return;
    setOverviewLoading(true);
    setOverviewError(null);
    adminFetch("/admin/overview")
      .then((d) => { setOverviewData(d); setOverviewLoaded(true); })
      .catch((e) => setOverviewError(e.message))
      .finally(() => setOverviewLoading(false));
  }, [overviewLoaded]);

  const fetchUsers = useCallback((force = false) => {
    if (usersLoaded && !force) return;
    setUsersLoading(true);
    setUsersError(null);
    Promise.all([adminFetch("/admin/users"), adminFetch("/admin/comps")])
      .then(([usersRes, compsRes]) => {
        setUsersData({ ...usersRes, active_comps: compsRes.active_comps || [], comp_log: compsRes.comps || [] });
        setUsersLoaded(true);
      })
      .catch((e) => setUsersError(e.message))
      .finally(() => setUsersLoading(false));
  }, [usersLoaded]);

  const fetchCatalog = useCallback((force = false) => {
    if (catalogLoaded && !force) return;
    setCatalogLoading(true);
    setCatalogError(null);
    adminFetch("/admin/catalog-health")
      .then((d) => { setCatalogData(d); setCatalogLoaded(true); })
      .catch((e) => setCatalogError(e.message))
      .finally(() => setCatalogLoading(false));
  }, [catalogLoaded]);

  const fetchActivity = useCallback((force = false) => {
    if (activityLoaded && !force) return;
    setActivityLoading(true);
    setActivityError(null);
    adminFetch("/admin/activity-log")
      .then((d) => { setActivityData(d); setActivityLoaded(true); })
      .catch((e) => setActivityError(e.message))
      .finally(() => setActivityLoading(false));
  }, [activityLoaded]);

  const fetchFunnel = useCallback((force = false) => {
    if (funnelLoaded && !force) return;
    setFunnelLoading(true);
    setFunnelError(null);
    adminFetch("/admin/funnel")
      .then((d) => { setFunnelData(d); setFunnelLoaded(true); })
      .catch((e) => setFunnelError(e.message))
      .finally(() => setFunnelLoading(false));
  }, [funnelLoaded]);

  const fetchAnalytics = useCallback((force = false) => {
    if (analyticsLoaded && !force) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    adminFetch("/admin/analytics")
      .then((d) => { setAnalyticsData(d); setAnalyticsLoaded(true); })
      .catch((e) => setAnalyticsError(e.message))
      .finally(() => setAnalyticsLoading(false));
  }, [analyticsLoaded]);

  const fetchTraffic = useCallback((force = false) => {
    if (trafficLoaded && !force) return;
    setTrafficLoading(true);
    setTrafficError(null);
    adminFetch("/admin/suspect-activity?days=7")
      .then((d) => { setTrafficData(d); setTrafficLoaded(true); })
      .catch((e) => setTrafficError(e.message))
      .finally(() => setTrafficLoading(false));
  }, [trafficLoaded]);

  const handleTrafficDrillDown = useCallback((city) => {
    if (!city) { setTrafficDrillCity(null); setTrafficDrillData(null); return; }
    setTrafficDrillCity(city);
    setTrafficDrillLoading(true);
    adminFetch(`/admin/suspect-activity?city=${encodeURIComponent(city)}&days=7`)
      .then((d) => setTrafficDrillData(d))
      .catch(() => {})
      .finally(() => setTrafficDrillLoading(false));
  }, []);

  // Fetch data on tab switch
  useEffect(() => {
    if (tab === "Overview") fetchOverview();
    else if (tab === "Analytics") fetchAnalytics();
    else if (tab === "Traffic") fetchTraffic();
    else if (tab === "Funnel") fetchFunnel();
    else if (tab === "Users") fetchUsers();
    else if (tab === "Catalog Health") fetchCatalog();
    else if (tab === "Activity Log") fetchActivity();
  }, [tab, fetchOverview, fetchAnalytics, fetchTraffic, fetchFunnel, fetchUsers, fetchCatalog, fetchActivity]);

  // Auth gate — allow login via main auth OR direct admin login
  const activeUser = user || adminUser;
  if (isLoadingAuth) return null;
  if (!activeUser || activeUser.email !== "tyler@spekd.ai") {
    return <AdminLogin onLogin={(u) => setAdminUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Spekd" className="h-7 w-auto" />
              <span className="text-gray-500 text-sm">Admin</span>
            </div>
            <AdminSearchBar onNavigate={setTab} />
          </div>
          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm transition-colors ${
                  tab === t
                    ? "bg-amber-500/10 text-amber-400 border-b-2 border-amber-500"
                    : "bg-gray-800 text-gray-400 hover:text-gray-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "Overview" && (
          <OverviewTab data={overviewData} loading={overviewLoading} error={overviewError} />
        )}
        {tab === "Analytics" && (
          <AnalyticsTab data={analyticsData} loading={analyticsLoading} error={analyticsError} />
        )}
        {tab === "Traffic" && (
          <TrafficTab
            data={trafficData}
            loading={trafficLoading}
            error={trafficError}
            onDrillDown={handleTrafficDrillDown}
            drillCity={trafficDrillCity}
            drillData={trafficDrillData}
            drillLoading={trafficDrillLoading}
          />
        )}
        {tab === "Funnel" && (
          <FunnelTab data={funnelData} loading={funnelLoading} error={funnelError} />
        )}
        {tab === "Users" && (
          <UsersTab
            data={usersData}
            loading={usersLoading}
            error={usersError}
            onRefresh={() => fetchUsers(true)}
          />
        )}
        {tab === "Catalog Health" && (
          <CatalogHealthTab
            data={catalogData}
            loading={catalogLoading}
            error={catalogError}
            onRefresh={() => fetchCatalog(true)}
          />
        )}
        {tab === "Activity Log" && (
          <ActivityLogTab data={activityData} loading={activityLoading} error={activityError} />
        )}
      </div>
    </div>
  );
}
