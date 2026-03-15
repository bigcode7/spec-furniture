import { useState, useEffect, lazy, Suspense } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Plus, FolderOpen, ArrowRight, CheckCircle, Clock, Send, Copy, Sparkles, ClipboardList, Wand2, LayoutGrid, DollarSign, FolderKanban, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { buildProjectInsights } from "@/lib/ai-assist";

// Lazy-load heavy sub-pages
const ProjectIntake = lazy(() => import("./ProjectIntake"));
const DesignBrief = lazy(() => import("./DesignBrief"));
const SourcingBoard = lazy(() => import("./SourcingBoard"));
const ProjectWorkflow = lazy(() => import("./ProjectWorkflow"));
const RoomPlanner = lazy(() => import("./RoomPlanner"));
const RoomDesigner = lazy(() => import("./RoomDesigner"));
const CostTracker = lazy(() => import("./CostTracker"));

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
  { id: "brief", label: "Design Brief", icon: ClipboardList },
  { id: "sourcing", label: "Sourcing", icon: FolderKanban },
  { id: "workflow", label: "Workflow", icon: LayoutGrid },
  { id: "room-plan", label: "Room Plan", icon: Wand2 },
  { id: "room-design", label: "Room Layout", icon: LayoutGrid },
  { id: "budget", label: "Budget", icon: DollarSign },
];

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-gold/40" />
    </div>
  );
}

export default function Projects() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "projects";

  const setTab = (tab) => {
    setSearchParams(tab === "projects" ? {} : { tab });
  };

  return (
    <div className="min-h-screen">
      {/* Tab bar */}
      <div className="border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
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
        {activeTab === "projects" && <ProjectsList />}
        {activeTab === "intake" && <ProjectIntake />}
        {activeTab === "brief" && <DesignBrief />}
        {activeTab === "sourcing" && <SourcingBoard />}
        {activeTab === "workflow" && <ProjectWorkflow />}
        {activeTab === "room-plan" && <RoomPlanner />}
        {activeTab === "room-design" && <RoomDesigner />}
        {activeTab === "budget" && <CostTracker />}
      </Suspense>
    </div>
  );
}

// The original Projects list view, extracted as a sub-component
function ProjectsList() {
  const [projects, setProjects] = useState([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [form, setForm] = useState({ title: "", client_name: "", client_email: "", room_type: "", budget: "", notes: "" });
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      return base44.entities.Project.filter({ designer_id: u.id }, "-updated_date");
    }).then(setProjects).catch(() => {});
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    const created = await base44.entities.Project.create({
      ...form,
      budget: parseFloat(form.budget) || 0,
      total_cost: 0,
      status: "in_progress",
      designer_id: user?.id,
      designer_name: user?.full_name || user?.email,
      items: [],
    });
    setProjects([created, ...projects]);
    setShowNewProject(false);
    setForm({ title: "", client_name: "", client_email: "", room_type: "", budget: "", notes: "" });
    setSelectedProject(created);
    setSaving(false);
  };

  if (selectedProject) {
    return <ProjectDetail project={selectedProject} onBack={() => setSelectedProject(null)} toast={toast} />;
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-2">Portfolio</p>
            <h1 className="text-3xl font-display font-bold text-white">My Projects</h1>
            <p className="text-white/40 mt-1">{projects.length} active projects</p>
          </div>
          <Button className="btn-gold gap-2" onClick={() => setShowNewProject(true)}>
            <Plus className="w-4 h-4" /> New Project
          </Button>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {projects.map((p) => {
            const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.in_progress;
            const progress = p.budget > 0 ? (p.total_cost / p.budget) * 100 : 0;
            return (
              <div key={p.id} className="glass-surface rounded-xl p-6 hover:border-gold/20 transition-all cursor-pointer" onClick={() => setSelectedProject(p)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-gold" />
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
                </div>
                <h3 className="font-display font-bold text-white mb-1">{p.title}</h3>
                <div className="text-sm text-white/40 mb-4">{p.client_name} · {p.room_type.replace(/_/g, " ")}</div>

                <div className="mb-4">
                  <div className="flex justify-between text-xs text-white/40 mb-1">
                    <span>Budget used</span>
                    <span>${p.total_cost.toLocaleString()} / ${p.budget.toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${progress > 90 ? "bg-red-400" : progress > 70 ? "bg-yellow-400" : "bg-gold"}`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-white/30">
                  <span>{p.items?.length || 0} items</span>
                  <span>Updated {p.updated_date}</span>
                </div>

                <div className="mt-4 flex items-center text-gold text-sm font-medium">
                  Open project <ArrowRight className="w-3 h-3 ml-1" />
                </div>
              </div>
            );
          })}

          <button
            onClick={() => setShowNewProject(true)}
            className="glass-surface rounded-xl border-2 border-dashed border-white/[0.06] p-6 hover:border-gold/30 hover:bg-gold/[0.04] transition-all text-center group"
          >
            <div className="w-10 h-10 bg-white/[0.06] group-hover:bg-gold/10 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors">
              <Plus className="w-5 h-5 text-white/30 group-hover:text-gold transition-colors" />
            </div>
            <div className="font-medium text-white/40 group-hover:text-gold">Create New Project</div>
          </button>
        </div>
      </div>

      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="max-w-lg glass-surface border-white/[0.06]">
          <DialogHeader>
            <DialogTitle className="font-display text-white">Create New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-white/60">Project Title</Label>
              <Input placeholder="e.g. Sarah Johnson - Living Room" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white focus:border-gold/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60">Client Name</Label>
                <Input placeholder="Client name" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white focus:border-gold/30" />
              </div>
              <div>
                <Label className="text-white/60">Client Email</Label>
                <Input placeholder="client@email.com" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white focus:border-gold/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-white/60">Room Type</Label>
                <Select value={form.room_type} onValueChange={(v) => setForm({ ...form, room_type: v })}>
                  <SelectTrigger className="mt-1 bg-white/[0.03] border-white/[0.06] text-white"><SelectValue placeholder="Select room" /></SelectTrigger>
                  <SelectContent className="glass-surface border-white/[0.06]">
                    {["living_room", "bedroom", "dining_room", "office", "outdoor", "other"].map(r => (
                      <SelectItem key={r} value={r}>{r.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/60">Budget ($)</Label>
                <Input type="number" placeholder="15000" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white focus:border-gold/30" />
              </div>
            </div>
            <div>
              <Label className="text-white/60">Notes</Label>
              <Textarea placeholder="Client preferences, style notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 bg-white/[0.03] border-white/[0.06] text-white focus:border-gold/30" />
            </div>
            <Button onClick={handleCreate} disabled={saving} className="w-full btn-gold">
              {saving ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectDetail({ project, onBack, toast }) {
  const [items, setItems] = useState(project.items || []);
  const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const remaining = project.budget - total;
  const aiInsights = buildProjectInsights(project, items);
  const copyClientBrief = async () => {
    const lines = [
      `Project: ${project.title}`,
      `Client: ${project.client_name}`,
      `Room: ${project.room_type.replace(/_/g, " ")}`,
      `Budget: $${project.budget.toLocaleString()}`,
      `Specified total: $${total.toLocaleString()}`,
      "",
      "Items:",
      ...(items.length
        ? items.map((item) => `- ${item.product_name} by ${item.manufacturer_name} x${item.quantity} ($${((item.price || 0) * item.quantity).toLocaleString()})`)
        : ["- No items added yet"]),
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    toast({
      title: "Client brief copied",
      description: "Use it in email, Slack, or your proposal doc.",
    });
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-white/40 hover:text-gold mb-6">
          ← Back to Projects
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-2">Project Detail</p>
            <h1 className="text-2xl font-display font-bold text-white">{project.title}</h1>
            <p className="text-white/40">{project.client_name} · {project.room_type.replace(/_/g, " ")}</p>
          </div>
          <div className="flex gap-3">
            <Link to={createPageUrl("Search")}>
              <Button variant="outline" className="gap-2 border-white/[0.06] text-white/60 hover:border-gold/30 hover:text-gold">
                <Plus className="w-4 h-4" /> Add Furniture
              </Button>
            </Link>
            <Button variant="outline" className="gap-2 border-white/[0.06] text-white/60 hover:border-gold/30 hover:text-gold" onClick={copyClientBrief}>
              <Copy className="w-4 h-4" /> Copy Client Brief
            </Button>
            <Button className="btn-gold gap-2">
              <Send className="w-4 h-4" /> Send to Client
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-surface rounded-xl p-5">
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-1">Total Budget</div>
            <div className="text-2xl font-display font-bold text-white">${project.budget.toLocaleString()}</div>
          </div>
          <div className="glass-surface rounded-xl p-5">
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-1">Spec'd So Far</div>
            <div className="text-2xl font-display font-bold text-gold">${total.toLocaleString()}</div>
          </div>
          <div className={`glass-surface rounded-xl p-5 ${remaining >= 0 ? "border-green-500/20" : "border-red-500/20"}`}>
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-1">Remaining</div>
            <div className={`text-2xl font-display font-bold ${remaining >= 0 ? "text-green-400" : "text-red-400"}`}>
              {remaining >= 0 ? `$${remaining.toLocaleString()}` : `-$${Math.abs(remaining).toLocaleString()}`}
            </div>
          </div>
        </div>

        <div className="mb-6 glass-surface rounded-xl p-6 border-gold/10">
          <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70">AI project guidance</div>
          <h2 className="mt-2 text-xl font-display font-bold text-white">Keep the project commercially sharp.</h2>
          <p className="mt-2 text-sm leading-7 text-white/50">{aiInsights.summary}</p>

          {aiInsights.nextActions.length > 0 && (
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {aiInsights.nextActions.map((action) => (
                <div key={action} className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 text-sm text-white/70">
                  {action}
                </div>
              ))}
            </div>
          )}

          {aiInsights.riskFlags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {aiInsights.riskFlags.map((risk) => (
                <span key={risk} className="rounded-full bg-gold/10 text-gold/70 border border-gold/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]">
                  {risk}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="glass-surface rounded-xl p-6">
          <h2 className="font-display font-bold text-white mb-4">Spec'd Items ({items.length})</h2>
          {items.length === 0 ? (
            <div className="text-center py-12 text-white/30">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No items yet. Add furniture from the search page.</p>
              <Link to={createPageUrl("Search")}>
                <Button className="mt-4 btn-gold">Browse Furniture</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                  <img src={item.thumbnail} alt={item.product_name} className="w-16 h-12 object-cover rounded-lg" />
                  <div className="flex-1">
                    <div className="font-medium text-sm text-white">{item.product_name}</div>
                    <div className="text-xs text-white/30">{item.manufacturer_name} · Ships in {item.lead_time_weeks}wk</div>
                  </div>
                  <div className="text-sm text-white/40">Qty: {item.quantity}</div>
                  <div className="font-bold text-gold">${(item.price * item.quantity).toLocaleString()}</div>
                </div>
              ))}
              <div className="flex justify-end pt-3 border-t border-white/[0.06]">
                <div className="text-right">
                  <div className="text-sm text-white/40">Project Total</div>
                  <div className="text-2xl font-display font-bold text-gold">${total.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
