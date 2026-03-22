import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";

const API = import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app";

async function adminFetch(path) {
  const token = localStorage.getItem("spec_auth_token");
  const res = await fetch(`${API.replace(/\/$/, "")}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function adminPost(path, body) {
  const token = localStorage.getItem("spec_auth_token");
  const res = await fetch(`${API.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Fake 404 (mirrors the real PageNotFound) ──

function Fake404() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-7xl font-light text-slate-300">404</h1>
            <div className="h-0.5 w-16 bg-slate-200 mx-auto"></div>
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-medium text-slate-800">Page Not Found</h2>
            <p className="text-slate-600 leading-relaxed">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
          <div className="pt-6">
            <button
              onClick={() => (window.location.href = "/")}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Go Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString());
const fmtUSD = (n) => (n == null ? "—" : "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const fmtDate = (d) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
};
const fmtPct = (n) => (n == null ? "—" : (Number(n) * 100).toFixed(1) + "%");

const TABS = ["Overview", "Users", "Analytics", "Revenue", "Catalog"];

// ── Metric Card ──

function MetricCard({ label, value, prefix, isCurrency, isPct }) {
  const display = isPct ? fmtPct(value) : isCurrency ? fmtUSD(value) : fmt(value);
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700/50">
      <div className="text-2xl font-bold text-amber-500">{prefix}{display}</div>
      <div className="text-gray-400 text-sm mt-1">{label}</div>
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminFetch("/admin/overview")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <MetricCard label="Total Users" value={data.total_users} />
      <MetricCard label="Active Pro" value={data.active_pro} />
      <MetricCard label="MRR" value={data.mrr} isCurrency />
      <MetricCard label="Free Users" value={data.free_users} />
      <MetricCard label="Searches Today" value={data.searches_today} />
      <MetricCard label="Searches This Week" value={data.searches_this_week} />
      <MetricCard label="API Cost Est." value={data.api_cost_estimate} isCurrency />
    </div>
  );
}

// ── Users Tab ──

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [compDays, setCompDays] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [actionMsg, setActionMsg] = useState(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    adminFetch("/admin/users")
      .then((d) => setUsers(d.users || d || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
    const plan = (u.plan || u.subscription_plan || "free").toLowerCase();
    const status = (u.status || "active").toLowerCase();
    let matchesFilter = true;
    if (filter === "pro") matchesFilter = plan === "pro" || plan === "premium";
    else if (filter === "free") matchesFilter = plan === "free" || !plan;
    else if (filter === "cancelled") matchesFilter = status === "cancelled" || status === "canceled";
    return matchesSearch && matchesFilter;
  });

  const handleComp = async (userId) => {
    const days = parseInt(compDays[userId]);
    if (!days || days < 1) return;
    setActionLoading((p) => ({ ...p, [userId]: "comp" }));
    try {
      await adminPost("/admin/comp-pro", { user_id: userId, days });
      setActionMsg(`Comped ${days} days for ${userId}`);
      fetchUsers();
    } catch (e) {
      setActionMsg(`Error: ${e.message}`);
    } finally {
      setActionLoading((p) => ({ ...p, [userId]: null }));
    }
  };

  const handleDeactivate = async (userId) => {
    if (!window.confirm("Deactivate this user?")) return;
    setActionLoading((p) => ({ ...p, [userId]: "deactivate" }));
    try {
      await adminPost("/admin/deactivate-user", { user_id: userId });
      setActionMsg(`Deactivated ${userId}`);
      fetchUsers();
    } catch (e) {
      setActionMsg(`Error: ${e.message}`);
    } finally {
      setActionLoading((p) => ({ ...p, [userId]: null }));
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;

  return (
    <div className="space-y-4">
      {actionMsg && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-lg text-sm flex justify-between items-center">
          {actionMsg}
          <button onClick={() => setActionMsg(null)} className="text-amber-400 hover:text-white ml-4">x</button>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 w-64"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
        >
          <option value="all">All</option>
          <option value="pro">Pro</option>
          <option value="free">Free</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-gray-500 text-sm self-center">{filtered.length} users</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Email</th>
              <th className="py-2 px-3">Company</th>
              <th className="py-2 px-3">Plan</th>
              <th className="py-2 px-3">Signup</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const uid = u.id || u._id || u.email;
              const isOpen = expanded === uid;
              return (
                <UserRow
                  key={uid}
                  u={u}
                  uid={uid}
                  isOpen={isOpen}
                  onToggle={() => setExpanded(isOpen ? null : uid)}
                  compDays={compDays[uid] || ""}
                  onCompDaysChange={(v) => setCompDays((p) => ({ ...p, [uid]: v }))}
                  onComp={() => handleComp(uid)}
                  onDeactivate={() => handleDeactivate(uid)}
                  actionLoading={actionLoading[uid]}
                />
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-gray-500 text-center py-8">No users found.</div>}
      </div>
    </div>
  );
}

function UserRow({ u, uid, isOpen, onToggle, compDays, onCompDaysChange, onComp, onDeactivate, actionLoading }) {
  const plan = u.plan || u.subscription_plan || "free";
  const status = u.status || "active";
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer text-gray-300"
      >
        <td className="py-2 px-3">{u.full_name || "—"}</td>
        <td className="py-2 px-3 font-mono text-xs">{u.email}</td>
        <td className="py-2 px-3">{u.business_name || u.company || "—"}</td>
        <td className="py-2 px-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${plan === "pro" || plan === "premium" ? "bg-amber-500/20 text-amber-400" : "bg-gray-700 text-gray-400"}`}>
            {plan}
          </span>
        </td>
        <td className="py-2 px-3 text-xs">{fmtDate(u.created_at || u.signup_date)}</td>
        <td className="py-2 px-3">
          <span className={`text-xs ${status === "active" ? "text-green-400" : "text-red-400"}`}>{status}</span>
        </td>
      </tr>
      {isOpen && (
        <tr className="bg-gray-800/30">
          <td colSpan={6} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400 mb-3">
              <div><span className="text-gray-500">ID:</span> {uid}</div>
              <div><span className="text-gray-500">Phone:</span> {u.phone || "—"}</div>
              <div><span className="text-gray-500">Location:</span> {u.location || u.city || "—"}</div>
              <div><span className="text-gray-500">Searches:</span> {fmt(u.search_count || u.total_searches)}</div>
              <div><span className="text-gray-500">Last Active:</span> {fmtDate(u.last_active || u.last_login)}</div>
              <div><span className="text-gray-500">Subscription ID:</span> {u.stripe_subscription_id || u.subscription_id || "—"}</div>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="number"
                min="1"
                placeholder="Days"
                value={compDays}
                onChange={(e) => onCompDaysChange(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white w-20 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={(e) => { e.stopPropagation(); onComp(); }}
                disabled={actionLoading === "comp"}
                className="bg-amber-600 hover:bg-amber-500 text-white text-xs px-3 py-1 rounded disabled:opacity-50"
              >
                {actionLoading === "comp" ? "..." : "Comp Pro"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeactivate(); }}
                disabled={actionLoading === "deactivate"}
                className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1 rounded disabled:opacity-50"
              >
                {actionLoading === "deactivate" ? "..." : "Deactivate"}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Analytics Tab ──

function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminFetch("/admin/analytics")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const topQueries = data.top_queries || [];
  const zeroResults = data.zero_result_queries || [];
  const searchesByHour = data.searches_by_hour || [];
  const topClicked = data.most_clicked_products || [];

  const maxHourCount = Math.max(1, ...searchesByHour.map((h) => h.count || 0));

  return (
    <div className="space-y-8">
      {/* Top Queries */}
      <Section title="Top Queries">
        <SimpleTable
          headers={["Query", "Count"]}
          rows={topQueries.map((q) => [q.query || q.term, fmt(q.count)])}
          emptyMsg="No data."
        />
      </Section>

      {/* Zero Result Queries */}
      <Section title="Zero Result Queries">
        <SimpleTable
          headers={["Query", "Count"]}
          rows={zeroResults.map((q) => [q.query || q.term, fmt(q.count)])}
          emptyMsg="No data."
        />
      </Section>

      {/* Searches by Hour */}
      <Section title="Searches by Hour">
        {searchesByHour.length === 0 ? (
          <div className="text-gray-500 text-sm">No data.</div>
        ) : (
          <div className="space-y-1">
            {searchesByHour.map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 w-12 text-right">{h.hour != null ? `${String(h.hour).padStart(2, "0")}:00` : i}</span>
                <div className="flex-1 h-4 bg-gray-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-amber-500/70 rounded"
                    style={{ width: `${((h.count || 0) / maxHourCount) * 100}%` }}
                  />
                </div>
                <span className="text-gray-400 w-10">{fmt(h.count)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Most Clicked Products */}
      <Section title="Most Clicked Products">
        <SimpleTable
          headers={["Product", "Vendor", "Clicks"]}
          rows={topClicked.map((p) => [p.name || p.product_name || p.id, p.vendor || "—", fmt(p.clicks || p.count)])}
          emptyMsg="No data."
        />
      </Section>
    </div>
  );
}

// ── Revenue Tab ──

function RevenueTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminFetch("/admin/revenue")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const failedPayments = data.failed_payments || [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="New Subs" value={data.new_subscriptions} />
        <MetricCard label="Cancellations" value={data.cancellations} />
        <MetricCard label="Churn Rate" value={data.churn_rate} isPct />
        <MetricCard label="Revenue This Month" value={data.revenue_this_month} isCurrency />
      </div>

      <Section title="Annual vs Monthly Split">
        <div className="grid grid-cols-2 gap-4">
          <MetricCard label="Annual" value={data.annual_count || data.annual} />
          <MetricCard label="Monthly" value={data.monthly_count || data.monthly} />
        </div>
      </Section>

      <Section title="Failed Payments">
        <SimpleTable
          headers={["User", "Amount", "Date", "Reason"]}
          rows={failedPayments.map((p) => [
            p.email || p.user || "—",
            fmtUSD(p.amount),
            fmtDate(p.date || p.created_at),
            p.reason || p.failure_message || "—",
          ])}
          emptyMsg="No failed payments."
        />
      </Section>
    </div>
  );
}

// ── Catalog Tab ──

function CatalogTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rebuildingVectors, setRebuildingVectors] = useState(false);
  const [rebuildingIndex, setRebuildingIndex] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  useEffect(() => {
    adminFetch("/admin/catalog")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleRebuildVectors = async () => {
    if (!window.confirm("Rebuild all vectors? This may take a while.")) return;
    setRebuildingVectors(true);
    try {
      await adminPost("/admin/rebuild-vectors", {});
      setActionMsg("Vector rebuild started.");
    } catch (e) {
      setActionMsg(`Error: ${e.message}`);
    } finally {
      setRebuildingVectors(false);
    }
  };

  const handleRebuildIndex = async () => {
    if (!window.confirm("Rebuild catalog index?")) return;
    setRebuildingIndex(true);
    try {
      await adminPost("/admin/rebuild-index", {});
      setActionMsg("Index rebuild started.");
    } catch (e) {
      setActionMsg(`Error: ${e.message}`);
    } finally {
      setRebuildingIndex(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox msg={error} />;
  if (!data) return null;

  const vendors = data.products_by_vendor || [];
  const health = data.catalog_health || {};

  return (
    <div className="space-y-8">
      {actionMsg && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 px-4 py-2 rounded-lg text-sm flex justify-between items-center">
          {actionMsg}
          <button onClick={() => setActionMsg(null)} className="text-amber-400 hover:text-white ml-4">x</button>
        </div>
      )}

      <Section title="Catalog Health">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="Total Products" value={health.total_products || data.total_products} />
          <MetricCard label="Broken Images" value={health.broken_images} />
          <MetricCard label="Missing Tags" value={health.missing_tags} />
          <MetricCard label="Missing Prices" value={health.missing_prices} />
        </div>
      </Section>

      <Section title="Products by Vendor">
        <SimpleTable
          headers={["Vendor", "Product Count"]}
          rows={vendors.map((v) => [v.vendor || v.name, fmt(v.count || v.product_count)])}
          emptyMsg="No vendor data."
        />
      </Section>

      <Section title="Actions">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleRebuildVectors}
            disabled={rebuildingVectors}
            className="bg-amber-600 hover:bg-amber-500 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {rebuildingVectors ? "Rebuilding Vectors..." : "Rebuild Vectors"}
          </button>
          <button
            onClick={handleRebuildIndex}
            disabled={rebuildingIndex}
            className="bg-amber-600 hover:bg-amber-500 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-50 transition-colors"
          >
            {rebuildingIndex ? "Rebuilding Index..." : "Rebuild Catalog Index"}
          </button>
        </div>
      </Section>
    </div>
  );
}

// ── Shared small components ──

function Loading() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-gray-500 text-sm">Loading...</div>
    </div>
  );
}

function ErrorBox({ msg }) {
  return (
    <div className="bg-red-900/20 border border-red-800/50 text-red-400 rounded-lg p-4 text-sm">
      Error: {msg}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h3 className="text-gray-300 font-medium mb-3">{title}</h3>
      {children}
    </div>
  );
}

function SimpleTable({ headers, rows, emptyMsg }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-700 text-gray-400">
            {headers.map((h, i) => (
              <th key={i} className="py-2 px-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-800 text-gray-300">
              {row.map((cell, ci) => (
                <td key={ci} className="py-2 px-3">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <div className="text-gray-500 text-sm text-center py-6">{emptyMsg}</div>}
    </div>
  );
}

// ── Main Admin Component ──

export default function Admin() {
  const { user, isLoadingAuth } = useAuth();
  const [tab, setTab] = useState("Overview");

  // Auth gate: only tyler@spekd.ai
  if (isLoadingAuth) return null;
  if (!user || user.email !== "tyler@spekd.ai") return <Fake404 />;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="text-amber-500 font-bold text-lg">SPEKD</span>
              <span className="text-gray-600 text-sm">Admin</span>
            </div>
            <div className="text-gray-500 text-xs">{user.email}</div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  tab === t
                    ? "border-amber-500 text-amber-500"
                    : "border-transparent text-gray-500 hover:text-gray-300"
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
        {tab === "Overview" && <OverviewTab />}
        {tab === "Users" && <UsersTab />}
        {tab === "Analytics" && <AnalyticsTab />}
        {tab === "Revenue" && <RevenueTab />}
        {tab === "Catalog" && <CatalogTab />}
      </div>
    </div>
  );
}
