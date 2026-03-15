import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  FolderKanban,
  Plus,
  Trash2,
  ArrowLeft,
  Search,
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  ImageOff,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  addProductToProject,
  removeProductFromProject,
  getCompareItems,
} from "@/lib/growth-store";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

async function fetchProjectAnalysis(project) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(`${searchServiceUrl.replace(/\/$/, "")}/project-analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ project }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.analysis;
  } catch {
    return null;
  }
}

const HEALTH_COLORS = {
  "on-track": { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-400", icon: CheckCircle },
  "needs-attention": { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-400", icon: AlertTriangle },
  "at-risk": { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", icon: AlertTriangle },
};

export default function ProjectManager() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", room_type: "", budget: "", notes: "" });

  useEffect(() => {
    setProjects(getProjects());
  }, []);

  const handleCreate = () => {
    const project = createProject(form);
    setProjects(getProjects());
    setForm({ name: "", room_type: "", budget: "", notes: "" });
    setShowCreate(false);
    setActiveProject(project);
  };

  const handleDelete = (id) => {
    deleteProject(id);
    setProjects(getProjects());
    if (activeProject?.id === id) setActiveProject(null);
  };

  if (activeProject) {
    return (
      <ProjectDetail
        project={activeProject}
        onBack={() => { setActiveProject(null); setProjects(getProjects()); }}
        onUpdate={(updated) => setActiveProject(updated)}
      />
    );
  }

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-6 w-6 text-gold" />
            <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">Projects</h1>
            <span className="text-sm text-white/30">{projects.length}</span>
          </div>
          <Button onClick={() => setShowCreate(true)} className="btn-gold">
            <Plus className="h-4 w-4 mr-2" /> New Project
          </Button>
        </div>

        {/* Empty state */}
        {projects.length === 0 && !showCreate && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <FolderKanban className="h-14 w-14 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-lg mb-2">No projects yet</p>
            <p className="text-white/25 text-sm mb-8">
              Create a project to organize products, track budget, and get AI gap analysis.
            </p>
            <Button onClick={() => setShowCreate(true)}>Create Your First Project</Button>
          </motion.div>
        )}

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-2xl border border-gold/20 bg-gold/5 p-6 mb-6 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-semibold text-gold">New Project</div>
                <button onClick={() => setShowCreate(false)} className="text-white/30 hover:text-white/60">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 mb-4">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Project name *"
                  className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-gold/30"
                />
                <input
                  value={form.room_type}
                  onChange={(e) => setForm({ ...form, room_type: e.target.value })}
                  placeholder="Room type (e.g. Living Room)"
                  className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-gold/30"
                />
                <input
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  placeholder="Budget ($)"
                  type="number"
                  className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-gold/30"
                />
                <input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Notes / client preferences"
                  className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-gold/30"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!form.name.trim()}
                className="btn-gold"
              >
                Create Project
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Project cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const totalSpent = project.products.reduce(
              (sum, p) => sum + (Number(p.retail_price) || Number(p.wholesale_price) || 0),
              0,
            );
            const budgetPct = project.budget > 0 ? (totalSpent / project.budget) * 100 : 0;
            return (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 cursor-pointer hover:border-white/20 transition-colors"
                onClick={() => setActiveProject(project)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">{project.name}</h3>
                    <div className="text-xs text-white/30 mt-0.5">
                      {project.room_type || "No room type"} · {project.products.length} items
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                    className="text-white/20 hover:text-red-400 transition-colors p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {project.budget > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-[10px] text-white/30 mb-1">
                      <span>${totalSpent.toLocaleString()} spent</span>
                      <span>${project.budget.toLocaleString()} budget</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${budgetPct > 90 ? "bg-red-500" : budgetPct > 70 ? "bg-yellow-500" : "bg-gold"}`}
                        style={{ width: `${Math.min(budgetPct, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-white/20">
                  Updated {new Date(project.updated_at).toLocaleDateString()}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({ project, onBack, onUpdate }) {
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAddFromCompare, setShowAddFromCompare] = useState(false);

  const totalSpent = project.products.reduce(
    (sum, p) => sum + (Number(p.retail_price) || Number(p.wholesale_price) || 0),
    0,
  );
  const remaining = project.budget - totalSpent;

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    const result = await fetchProjectAnalysis(project);
    setAnalysis(result);
    setAnalyzing(false);
  };

  const handleAddFromCompare = () => {
    const compareItems = getCompareItems();
    let updated = project;
    for (const item of compareItems) {
      updated = addProductToProject(project.id, item);
    }
    if (updated) onUpdate(updated);
    setShowAddFromCompare(false);
  };

  const handleRemoveProduct = (productId) => {
    const updated = removeProductFromProject(project.id, productId);
    if (updated) onUpdate(updated);
  };

  const healthCfg = analysis ? (HEALTH_COLORS[analysis.project_health] || HEALTH_COLORS["needs-attention"]) : null;
  const HealthIcon = healthCfg?.icon || Clock;

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-5xl">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-white/30 hover:text-white/60 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Projects
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">{project.name}</h1>
            <div className="text-sm text-white/30 mt-1">
              {project.room_type || "No room type"} · {project.products.length} products
              {project.budget > 0 && ` · $${project.budget.toLocaleString()} budget`}
            </div>
            {project.notes && <p className="text-sm text-white/20 mt-2">{project.notes}</p>}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddFromCompare(true)} variant="outline" size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add from Compare
            </Button>
            <Link to={createPageUrl("Search")}>
              <Button variant="outline" size="sm">
                <Search className="h-3.5 w-3.5 mr-1" /> Find Products
              </Button>
            </Link>
          </div>
        </div>

        {/* Budget stats */}
        {project.budget > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="text-xs text-white/30 mb-1">Budget</div>
              <div className="text-xl font-bold text-white">${project.budget.toLocaleString()}</div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="text-xs text-white/30 mb-1">Spent</div>
              <div className="text-xl font-bold text-gold">${totalSpent.toLocaleString()}</div>
            </div>
            <div className={`rounded-xl border p-4 ${remaining >= 0 ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="text-xs text-white/30 mb-1">Remaining</div>
              <div className={`text-xl font-bold ${remaining >= 0 ? "text-green-400" : "text-red-400"}`}>
                {remaining >= 0 ? `$${remaining.toLocaleString()}` : `-$${Math.abs(remaining).toLocaleString()}`}
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis */}
        <div className="rounded-2xl border border-gold/20 bg-gold/5 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              <Brain className="h-4 w-4" /> AI Project Analysis
              {analyzing && <div className="h-3.5 w-3.5 rounded-full border-2 border-gold/30 border-t-gold animate-spin ml-2" />}
            </div>
            <Button
              onClick={runAnalysis}
              disabled={analyzing || project.products.length === 0}
              variant="outline"
              size="sm"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {analyzing ? "Analyzing..." : analysis ? "Re-analyze" : "Analyze Project"}
            </Button>
          </div>

          {project.products.length === 0 && !analysis && (
            <p className="text-white/30 text-sm">Add products to get AI analysis of coverage, style, and gaps.</p>
          )}

          {analyzing && !analysis && (
            <div className="flex items-center gap-3 text-white/40 text-sm">
              <Sparkles className="h-4 w-4 animate-pulse" />
              Analyzing your project like a senior designer would...
            </div>
          )}

          {analysis && (
            <div className="space-y-4">
              {/* Health Score */}
              <div className={`flex items-center gap-3 rounded-xl ${healthCfg.bg} border ${healthCfg.border} p-4`}>
                <HealthIcon className={`h-5 w-5 ${healthCfg.text}`} />
                <div>
                  <div className={`text-sm font-semibold ${healthCfg.text} uppercase`}>{analysis.project_health}</div>
                  <div className="text-xs text-white/40">Score: {analysis.health_score}/100</div>
                </div>
              </div>

              {/* Summary */}
              <p className="text-white/70 text-sm leading-relaxed">{analysis.summary}</p>

              {/* Categories */}
              <div className="grid gap-3 sm:grid-cols-2">
                {analysis.specified_categories?.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase text-green-400/70 mb-1.5">Covered</div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.specified_categories.map((c) => (
                        <span key={c} className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-[10px] text-green-400">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {analysis.missing_categories?.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase text-red-400/70 mb-1.5">Missing</div>
                    <div className="flex flex-wrap gap-1">
                      {analysis.missing_categories.map((c) => (
                        <span key={c} className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] text-red-400">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Style + Timeline */}
              {analysis.style_coherence && (
                <p className="text-xs text-white/40"><span className="text-white/50 font-medium">Style:</span> {analysis.style_coherence}</p>
              )}
              {analysis.timeline_risk && (
                <p className="text-xs text-white/40"><span className="text-white/50 font-medium">Timeline:</span> {analysis.timeline_risk}</p>
              )}

              {/* Action Items */}
              {analysis.action_items?.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase text-white/30 mb-2">Action Items</div>
                  <div className="space-y-2">
                    {analysis.action_items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          item.priority === "high" ? "bg-red-500/10 text-red-400"
                            : item.priority === "medium" ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-white/5 text-white/30"
                        }`}>
                          {item.priority}
                        </span>
                        <span className="text-sm text-white/60">{item.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Searches */}
              {analysis.search_suggestions?.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase text-white/30 mb-2">Fill the Gaps</div>
                  <div className="flex flex-wrap gap-2">
                    {analysis.search_suggestions.map((s) => (
                      <Link
                        key={s}
                        to={`${createPageUrl("Search")}?q=${encodeURIComponent(s)}`}
                        className="flex items-center gap-1 rounded-full bg-gold/10 px-3 py-1 text-xs text-gold/70 hover:bg-gold/20 transition-colors"
                      >
                        <Search className="h-3 w-3" /> {s}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add from Compare modal */}
        <AnimatePresence>
          {showAddFromCompare && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAddFromCompare(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="rounded-2xl border border-white/10 bg-[#111118] p-6 max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-white font-semibold mb-2">Add from Compare Tray</h3>
                <p className="text-white/40 text-sm mb-4">
                  This will add all {getCompareItems().length} products currently in your Compare tray to this project.
                </p>
                <div className="flex gap-3">
                  <Button onClick={handleAddFromCompare} className="btn-gold flex-1">
                    Add {getCompareItems().length} Products
                  </Button>
                  <Button onClick={() => setShowAddFromCompare(false)} variant="outline">Cancel</Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Product list */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
          <h2 className="text-white font-semibold mb-4">Products ({project.products.length})</h2>

          {project.products.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-10 w-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm mb-4">No products yet. Search and compare, then add them here.</p>
              <Link to={createPageUrl("Search")}>
                <Button variant="outline" size="sm">Browse Furniture</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {project.products.map((product) => (
                <div key={product.id} className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                  <div className="w-16 h-12 rounded-lg overflow-hidden bg-white/[0.02] shrink-0">
                    {(product.thumbnail || product.image_url) ? (
                      <img src={product.thumbnail || product.image_url} alt={product.product_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <ImageOff className="h-4 w-4 text-white/10" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{product.product_name}</div>
                    <div className="text-xs text-gold/70">{product.manufacturer_name}</div>
                  </div>
                  {(product.retail_price || product.wholesale_price) && (
                    <div className="text-sm font-semibold text-white/70">
                      ${Number(product.retail_price || product.wholesale_price).toLocaleString()}
                    </div>
                  )}
                  <button
                    onClick={() => handleRemoveProduct(product.id)}
                    className="text-white/20 hover:text-red-400 transition-colors p-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
