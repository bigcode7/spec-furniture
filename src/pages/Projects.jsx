import { useState, useEffect, lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, FolderOpen, ArrowRight, CheckCircle, Clock, Send, Sparkles, FolderKanban, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

// Lazy-load sub-pages
const ProjectIntake = lazy(() => import("./ProjectIntake"));
const SourcingBoard = lazy(() => import("./SourcingBoard"));
const ProjectPresent = lazy(() => import("./ProjectPresent"));

const STATUS_CONFIG = {
  in_progress: { label: "In Progress", color: "bg-amber-500/10 text-amber-400 border border-amber-500/20", icon: Clock },
  sent_to_client: { label: "Sent to Client", color: "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20", icon: Send },
  approved: { label: "Approved", color: "bg-green-500/10 text-green-400 border border-green-500/20", icon: CheckCircle },
  ordered: { label: "Ordered", color: "bg-purple-500/10 text-purple-400 border border-purple-500/20", icon: CheckCircle },
  completed: { label: "Completed", color: "bg-white/[0.06] text-white/50 border border-white/[0.06]", icon: CheckCircle },
};

const TABS = [
  { id: "projects", label: "Projects", icon: FolderOpen },
  { id: "intake", label: "New Intake", icon: Sparkles },
  { id: "sourcing", label: "Sourcing Board", icon: FolderKanban },
  { id: "present", label: "Present", icon: FileText },
];

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="loading-emblem" style={{ width: 20, height: 20 }} />
    </div>
  );
}

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "projects";

  const setTab = (tab) => {
    setSearchParams(tab === "projects" ? {} : { tab });
  };

  // Map old tab names to new ones for backwards compatibility
  const resolvedTab = (() => {
    if (activeTab === "brief" || activeTab === "room-plan" || activeTab === "room-design") return "sourcing";
    if (activeTab === "workflow" || activeTab === "budget") return "present";
    return activeTab;
  })();

  return (
    <div className="min-h-screen">
      {/* Step bar */}
      <div className="border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {TABS.map((tab, i) => {
              const Icon = tab.icon;
              const isActive = resolvedTab === tab.id;
              const stepNum = i > 0 ? i : null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "text-gold bg-gold/10 border border-gold/20"
                      : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                  }`}
                >
                  {stepNum && (
                    <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                      isActive ? "bg-gold/20 text-gold" : "bg-white/[0.06] text-white/30"
                    }`}>
                      {stepNum}
                    </span>
                  )}
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <Suspense fallback={<TabSpinner />}>
        {resolvedTab === "projects" && <ProjectsList />}
        {resolvedTab === "intake" && <ProjectIntake />}
        {resolvedTab === "sourcing" && <SourcingBoard />}
        {resolvedTab === "present" && <ProjectPresent />}
      </Suspense>
    </div>
  );
}

// ── Projects List ──

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

function ProjectsList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetch(`${SEARCH_URL}/projects`)
      .then((r) => r.json())
      .then((data) => { setProjects(data.projects || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const formatCurrency = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="label-caps text-gold/70 mb-2">Portfolio</p>
            <h1 className="text-3xl font-display font-bold text-white">My Projects</h1>
            <p className="text-white/40 mt-1">{projects.length} active projects</p>
          </div>
          <Button className="btn-gold gap-2" onClick={() => setSearchParams({ tab: "intake" })}>
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="loading-emblem" style={{ width: 20, height: 20 }} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
            {projects.map((p) => {
              const budgetTotal = typeof p.budget === "object" ? p.budget?.total : p.budget;
              const itemCount = p.item_count || p.rooms?.reduce((s, r) => s + (r.items?.length || 0), 0) || 0;
              const sourcedCount = p.rooms?.reduce((s, r) => s + (r.items || []).filter(i => i.selected_product).length, 0) || 0;
              const progress = itemCount > 0 ? (sourcedCount / itemCount) * 100 : 0;

              return (
                <a
                  key={p.id}
                  href={`/Projects?tab=sourcing&project=${p.id}`}
                  className="glass-surface rounded-xl p-6 hover:border-gold/20 transition-all cursor-pointer block"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                      <FolderOpen className="w-5 h-5 text-gold" />
                    </div>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {Math.round(progress)}% sourced
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-white mb-1">{p.name || p.title}</h3>
                  <div className="text-sm text-white/40 mb-4">
                    {p.client_name && `${p.client_name} · `}
                    {p.room_count || p.rooms?.length || 0} rooms
                    {p.style && ` · ${p.style.replace(/-/g, " ")}`}
                  </div>

                  {budgetTotal > 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-white/40 mb-1">
                        <span>{sourcedCount} of {itemCount} items sourced</span>
                        <span>{formatCurrency(budgetTotal)} budget</span>
                      </div>
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${progress > 90 ? "bg-emerald-400" : progress > 50 ? "bg-gold" : "bg-gold/60"}`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center text-gold text-sm font-medium">
                    Open sourcing board <ArrowRight className="w-3 h-3 ml-1" />
                  </div>
                </a>
              );
            })}

            <button
              onClick={() => setSearchParams({ tab: "intake" })}
              className="glass-surface rounded-xl border-2 border-dashed border-white/[0.06] p-6 hover:border-gold/30 hover:bg-gold/[0.04] transition-all text-center group"
            >
              <div className="w-10 h-10 bg-white/[0.06] group-hover:bg-gold/10 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors">
                <Plus className="w-5 h-5 text-white/30 group-hover:text-gold transition-colors" />
              </div>
              <div className="font-medium text-white/40 group-hover:text-gold">New Project</div>
              <div className="text-xs text-white/25 mt-1">Describe it, AI builds the plan</div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
