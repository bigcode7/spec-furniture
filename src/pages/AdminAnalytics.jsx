import { useEffect, useState } from "react";
import { getAnalytics, getJobStatus, getCatalogStats } from "@/api/searchClient";
import {
  BarChart3,
  Search,
  MousePointerClick,
  AlertTriangle,
  Activity,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Image,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

export default function AdminAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [jobs, setJobs] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jobLoading, setJobLoading] = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    const [a, j, c] = await Promise.all([
      getAnalytics(),
      getJobStatus(),
      getCatalogStats(),
    ]);
    setAnalytics(a);
    setJobs(j);
    setCatalog(c);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const startJob = async (jobName) => {
    setJobLoading(jobName);
    try {
      await fetch(`${SEARCH_URL}/jobs/${jobName}`, { method: "POST" });
      setTimeout(fetchAll, 2000);
    } catch { /* ignore */ }
    setJobLoading(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/20" />
      </div>
    );
  }

  const overview = analytics?.overview || {};
  const imgStats = catalog?.catalog?.images || {};

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-white">Search Analytics</h1>
            <p className="text-sm text-white/30 mt-1">
              {catalog?.catalog?.total_products?.toLocaleString() || "?"} products indexed
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAll}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Search} label="Total Searches" value={overview.total_searches || 0} />
          <StatCard icon={Activity} label="Today" value={overview.searches_today || 0} />
          <StatCard icon={BarChart3} label="Unique Queries" value={overview.unique_queries || 0} />
          <StatCard icon={AlertTriangle} label="Zero Results" value={overview.zero_result_count || 0} sub="queries with no matches" />
        </div>

        {/* Image & Quality Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard icon={Image} label="Verified Images" value={imgStats.verified || 0} color="green" />
          <StatCard icon={XCircle} label="Broken Images" value={imgStats.broken || 0} color="red" />
          <StatCard icon={Image} label="No Image" value={imgStats.no_image || 0} color="yellow" />
          <StatCard icon={Layers} label="Unchecked" value={imgStats.unchecked || 0} />
          <StatCard icon={CheckCircle} label="Avg Quality" value={catalog?.catalog?.avg_quality_score || 0} sub="/100" />
        </div>

        {/* Background Jobs */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-semibold text-white/70 mb-4">Background Jobs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <JobCard
              name="Image Verification"
              status={jobs?.image_verification}
              onStart={() => startJob("verify-images")}
              loading={jobLoading === "verify-images"}
            />
            <JobCard
              name="Deduplication"
              status={jobs?.deduplication}
              onStart={() => startJob("dedup")}
              loading={jobLoading === "dedup"}
            />
            <JobCard
              name="Enrichment"
              status={jobs?.enrichment}
              onStart={() => startJob("enrich")}
              loading={jobLoading === "enrich"}
            />
          </div>
        </div>

        {/* Two columns: Top Queries + Zero Result Queries */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Queries */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <Search className="h-4 w-4" /> Top Searches This Week
            </h2>
            {(analytics?.top_queries || []).length === 0 ? (
              <p className="text-xs text-white/20">No searches tracked yet.</p>
            ) : (
              <div className="space-y-1.5">
                {(analytics?.top_queries || []).map((q, i) => (
                  <div key={q.query} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/15 w-4">{i + 1}</span>
                      <span className="text-xs text-white/60">{q.query}</span>
                    </div>
                    <span className="text-[10px] text-white/25">{q.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Zero Result Queries */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400/60" /> Missing Products
            </h2>
            <p className="text-[10px] text-white/20 mb-3">Searches that returned zero results — products we should add.</p>
            {(analytics?.zero_result_queries || []).length === 0 ? (
              <p className="text-xs text-white/20">All searches returned results.</p>
            ) : (
              <div className="space-y-1.5">
                {(analytics?.zero_result_queries || []).map((q) => (
                  <div key={q.query} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
                    <span className="text-xs text-white/50">{q.query}</span>
                    <span className="text-[10px] text-white/20">{q.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Most Clicked + Vendor CTR */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <MousePointerClick className="h-4 w-4" /> Most Clicked Products
            </h2>
            {(analytics?.top_clicked_products || []).length === 0 ? (
              <p className="text-xs text-white/20">No clicks tracked yet.</p>
            ) : (
              <div className="space-y-1.5">
                {(analytics?.top_clicked_products || []).slice(0, 10).map((p) => (
                  <div key={p.product_id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
                    <span className="text-xs text-white/50 truncate max-w-[200px]">{p.product_id}</span>
                    <span className="text-[10px] text-white/25">{p.clicks} clicks</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Vendor Click-Through Rates
            </h2>
            {(analytics?.vendor_ctr || []).length === 0 ? (
              <p className="text-xs text-white/20">No vendor data yet.</p>
            ) : (
              <div className="space-y-1.5">
                {(analytics?.vendor_ctr || []).slice(0, 10).map((v) => (
                  <div key={v.vendor_id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03]">
                    <span className="text-xs text-white/50">{v.vendor_id}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-white/20">{v.impressions} imp</span>
                      <span className="text-[10px] text-white/20">{v.clicks} clicks</span>
                      <span className="text-[10px] font-medium text-gold/70">{v.ctr}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        {catalog?.catalog?.by_category_group && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-white/70 mb-4">Category Distribution</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(catalog.catalog.by_category_group)
                .sort((a, b) => b[1] - a[1])
                .map(([group, count]) => (
                  <div key={group} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                    <div className="text-xs text-white/40 capitalize">{group}</div>
                    <div className="text-lg font-semibold text-white/70 mt-1">{count.toLocaleString()}</div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colorClasses = {
    green: "text-green-400/70",
    red: "text-red-400/70",
    yellow: "text-amber-400/70",
    default: "text-white/60",
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-3.5 w-3.5 text-white/20" />
        <span className="text-[10px] text-white/30 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl font-semibold ${colorClasses[color] || colorClasses.default}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
        {sub && <span className="text-xs text-white/20 ml-1">{sub}</span>}
      </div>
    </div>
  );
}

function JobCard({ name, status, onStart, loading }) {
  const isRunning = status?.running;
  const progress = status?.checked && status?.total
    ? Math.round((status.checked / (status.total || 1)) * 100)
    : null;

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-white/60">{name}</span>
        {isRunning ? (
          <span className="text-[10px] text-gold/70 flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" /> Running
          </span>
        ) : status?.finished_at ? (
          <span className="text-[10px] text-green-400/60 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Done
          </span>
        ) : (
          <span className="text-[10px] text-white/20">Not run</span>
        )}
      </div>

      {isRunning && progress != null && (
        <div className="mb-2">
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="h-full bg-gold/50 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-white/20 mt-1">
            {status.checked?.toLocaleString()} / {status.total?.toLocaleString()}
          </span>
        </div>
      )}

      {status?.verified != null && (
        <div className="text-[10px] text-white/20 mb-2">
          {status.verified} verified, {status.broken} broken
          {status.replaced > 0 && `, ${status.replaced} replaced`}
        </div>
      )}

      {status?.duplicates_found != null && status.duplicates_found > 0 && (
        <div className="text-[10px] text-white/20 mb-2">
          {status.duplicates_found} duplicates, {status.products_removed} removed
        </div>
      )}

      {status?.enriched != null && status.enriched > 0 && (
        <div className="text-[10px] text-white/20 mb-2">
          {status.enriched} enriched, {status.failed} failed
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        className="w-full text-xs h-7 mt-1"
        onClick={onStart}
        disabled={isRunning || loading}
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
        {isRunning ? "Running..." : "Start"}
      </Button>
    </div>
  );
}
