import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { generateQuotePdf } from "@/lib/quote-generator";
import {
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  addProductToProject,
  removeProductFromProject,
  getCompareItems,
} from "@/lib/growth-store";
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
  ClipboardList,
  Calendar,
  DollarSign,
  Building2,
  ArrowRight,
  Wand2,
  ExternalLink,
  ShoppingBag,
  Layout,
  Grid3X3,
  FileText,
  Download,
  Palette,
  Type,
  Layers,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

const ROOM_TYPES = [
  "Living Room",
  "Bedroom",
  "Dining Room",
  "Kitchen",
  "Home Office",
  "Bathroom",
  "Outdoor",
  "Nursery",
  "Media Room",
  "Entryway",
];

const TIMELINES = [
  "2 weeks",
  "1 month",
  "2 months",
  "3 months",
  "6 months",
  "Flexible",
];

const STYLES = [
  "Modern",
  "Mid-Century Modern",
  "Coastal",
  "Traditional",
  "Minimalist",
  "Bohemian",
  "Industrial",
  "Transitional",
  "Japandi",
  "Art Deco",
];

const PRIORITY_COLORS = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
};

const HEALTH_COLORS = {
  "on-track": { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-400", icon: CheckCircle },
  "needs-attention": { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-400", icon: AlertTriangle },
  "at-risk": { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", icon: AlertTriangle },
};

const PRESENTATION_TEMPLATES = [
  { id: "mood-board", label: "Mood Board", icon: Layout },
  { id: "spec-sheet", label: "Product Spec Sheet", icon: FileText },
  { id: "room-concept", label: "Room Concept", icon: Grid3X3 },
  { id: "vendor-comparison", label: "Vendor Comparison", icon: Building2 },
];

const DETAIL_TABS = [
  { id: "brief", label: "Brief", icon: ClipboardList },
  { id: "plan", label: "Plan", icon: Wand2 },
  { id: "source", label: "Source", icon: FolderKanban },
  { id: "present", label: "Present", icon: Palette },
];

/* ═══════════════════════════════════════════════════════════════
   API Helpers
   ═══════════════════════════════════════════════════════════════ */

const apiBase = () => (searchServiceUrl || "").replace(/\/$/, "");

async function submitDesignBrief(payload) {
  if (!searchServiceUrl) return null;
  const response = await fetch(`${apiBase()}/design-brief`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to generate design brief");
  const data = await response.json();
  return data.brief;
}

async function fetchRoomPlan(body) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(`${apiBase()}/room-plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.plan;
  } catch {
    return null;
  }
}

async function fetchProjectAnalysis(project) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(`${apiBase()}/project-analyze`, {
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

async function fetchPresentationData(products) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(`${apiBase()}/presentation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ products }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.presentation;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   Utility Helpers
   ═══════════════════════════════════════════════════════════════ */

function formatCurrency(value) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

const inputClass =
  "w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 focus:ring-1 focus:ring-gold/20 transition";

const selectClass =
  "w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white focus:outline-none focus:border-gold/30 focus:ring-1 focus:ring-gold/20 transition appearance-none";

/* ═══════════════════════════════════════════════════════════════
   Shared Sub-components
   ═══════════════════════════════════════════════════════════════ */

function RoomPlanProductCard({ product, large }) {
  const [imgError, setImgError] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden ${large ? "" : "flex gap-4"}`}
    >
      <div
        className={`relative bg-white/[0.03] flex items-center justify-center ${
          large ? "h-56 w-full" : "h-28 w-28 shrink-0"
        }`}
      >
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageOff className="h-8 w-8 text-white/20" />
        )}
      </div>
      <div className={`flex flex-col gap-1.5 p-4 ${large ? "" : "py-3"}`}>
        <h4 className={`font-semibold text-white leading-snug ${large ? "text-lg" : "text-sm"}`}>
          {product.product_name}
        </h4>
        <p className="text-xs text-white/40">{product.vendor_name}</p>
        {product.material && <p className="text-xs text-white/30">{product.material}</p>}
        <p className="text-gold font-medium text-sm mt-auto">
          {formatCurrency(product.retail_price)}
        </p>
        {large && product.why && (
          <p className="text-xs text-white/50 mt-1 leading-relaxed">{product.why}</p>
        )}
        {product.product_url && (
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-gold/70 hover:text-gold mt-1 transition"
          >
            View at vendor <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </motion.div>
  );
}

function BudgetAllocationBar({ categories, estimatedTotal, totalBudget }) {
  const colors = [
    "bg-gold",
    "bg-amber-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-red-400",
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white/60 flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Budget Allocation
        </h3>
        <span className="text-sm text-white/40">
          Est. Total:{" "}
          <span className="text-gold font-semibold">{formatCurrency(estimatedTotal)}</span>
          {totalBudget ? (
            <span className="ml-1 text-white/25">/ {formatCurrency(totalBudget)}</span>
          ) : null}
        </span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.03] mb-4">
        {categories.map((cat, i) => {
          const pct =
            totalBudget > 0
              ? (cat.allocated_budget / totalBudget) * 100
              : 100 / categories.length;
          return (
            <div
              key={cat.category}
              className={`${colors[i % colors.length]} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${cat.category}: ${formatCurrency(cat.allocated_budget)}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {categories.map((cat, i) => (
          <span key={cat.category} className="flex items-center gap-1.5 text-xs text-white/50">
            <span className={`inline-block h-2 w-2 rounded-full ${colors[i % colors.length]}`} />
            {cat.category}{" "}
            <span className="text-white/30">{formatCurrency(cat.allocated_budget)}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BRIEF TAB
   ═══════════════════════════════════════════════════════════════ */

function BriefTab({ project, onProjectUpdate }) {
  const [form, setForm] = useState({
    room_types: project.room_type ? project.room_type.split(", ").filter(Boolean) : [],
    style: "",
    budget_min: "",
    budget_max: project.budget ? String(project.budget) : "",
    timeline: "1 month",
    vendor_preferences: "",
    avoid: "",
    notes: project.notes || "",
  });

  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggleRoom = (room) => {
    setForm((prev) => ({
      ...prev,
      room_types: prev.room_types.includes(room)
        ? prev.room_types.filter((r) => r !== room)
        : [...prev.room_types, room],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.room_types.length === 0) return;
    setLoading(true);
    setError(null);
    setBrief(null);
    try {
      const result = await submitDesignBrief({
        project_name: project.name,
        room_types: form.room_types,
        style: form.style.trim(),
        budget: `${form.budget_min || 0}-${form.budget_max || 0}`,
        timeline: form.timeline,
        vendor_preferences: form.vendor_preferences.trim(),
        avoid: form.avoid.trim(),
        notes: form.notes.trim(),
      });
      setBrief(result);
      // Update project room_type and budget from the brief form
      const updated = updateProject(project.id, {
        room_type: form.room_types.join(", "),
        budget: Number(form.budget_max) || project.budget,
        notes: result?.brief_summary || form.notes || project.notes,
      });
      if (updated && onProjectUpdate) onProjectUpdate(updated);
    } catch {
      setError("Failed to generate design brief. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalBudget = brief?.budget_summary?.total || 0;

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {!brief && (
          <motion.form
            key="brief-form"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Room Types */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-3">Room Types *</label>
              <div className="flex flex-wrap gap-2">
                {ROOM_TYPES.map((room) => {
                  const selected = form.room_types.includes(room);
                  return (
                    <button
                      key={room}
                      type="button"
                      onClick={() => toggleRoom(room)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                        selected
                          ? "bg-gold/20 border-gold/40 text-gold"
                          : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/60 hover:border-white/20"
                      }`}
                    >
                      {room}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Style Direction */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Style Direction</label>
              <input
                type="text"
                value={form.style}
                onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))}
                placeholder="e.g. Modern coastal with warm wood tones"
                className={inputClass}
              />
            </div>

            {/* Budget Range */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Budget Range</label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                  <input
                    type="number"
                    value={form.budget_min}
                    onChange={(e) => setForm((f) => ({ ...f, budget_min: e.target.value }))}
                    placeholder="Min"
                    min="0"
                    className={inputClass + " pl-9"}
                  />
                </div>
                <span className="text-white/20">to</span>
                <div className="relative flex-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                  <input
                    type="number"
                    value={form.budget_max}
                    onChange={(e) => setForm((f) => ({ ...f, budget_max: e.target.value }))}
                    placeholder="Max"
                    min="0"
                    className={inputClass + " pl-9"}
                  />
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Timeline</label>
              <select
                value={form.timeline}
                onChange={(e) => setForm((f) => ({ ...f, timeline: e.target.value }))}
                className={selectClass}
              >
                {TIMELINES.map((t) => (
                  <option key={t} value={t} className="bg-zinc-900">{t}</option>
                ))}
              </select>
            </div>

            {/* Vendor Preferences */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Vendor Preferences</label>
              <textarea
                value={form.vendor_preferences}
                onChange={(e) => setForm((f) => ({ ...f, vendor_preferences: e.target.value }))}
                placeholder="e.g. Love Bernhardt and Four Hands, open to others"
                rows={2}
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Avoid List */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Products to Avoid</label>
              <textarea
                value={form.avoid}
                onChange={(e) => setForm((f) => ({ ...f, avoid: e.target.value }))}
                placeholder="e.g. No glass tables, avoid bright primary colors"
                rows={2}
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Additional Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Any other details about the project..."
                rows={3}
                className={inputClass + " resize-none"}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading || form.room_types.length === 0}
              className="w-full h-12 rounded-xl btn-gold font-medium text-base disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  Generating Brief...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate Sourcing Plan
                </span>
              )}
            </Button>
          </motion.form>
        )}

        {/* ── Brief Results ── */}
        {brief && (
          <motion.div
            key="brief-results"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <button
              onClick={() => setBrief(null)}
              className="text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              &larr; New Brief
            </button>

            {/* Brief Summary */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-2xl border border-gold/20 bg-gold/[0.06] p-6"
            >
              <div className="flex items-start gap-3 mb-3">
                <Sparkles className="h-5 w-5 text-gold mt-0.5 shrink-0" />
                <div>
                  <h2 className="font-display text-lg font-semibold text-white mb-1">
                    {project.name}
                  </h2>
                  <p className="text-white/50 text-sm leading-relaxed">
                    {brief.brief_summary}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Timeline */}
            {brief.timeline && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-5 w-5 text-gold" />
                  <h3 className="font-medium text-white">Timeline</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl bg-white/[0.04] border border-white/5 p-4">
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-1">Sourcing Window</p>
                    <p className="text-white font-medium">{brief.timeline.sourcing_weeks} weeks</p>
                  </div>
                  <div className="rounded-xl bg-white/[0.04] border border-white/5 p-4">
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-1">Ordering Deadline</p>
                    <p className="text-white font-medium">{brief.timeline.ordering_deadline}</p>
                  </div>
                </div>
                {brief.timeline.notes && (
                  <p className="text-white/40 text-sm mt-3">{brief.timeline.notes}</p>
                )}
              </motion.div>
            )}

            {/* Budget Breakdown */}
            {brief.budget_summary && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    <h3 className="font-medium text-white">Budget Breakdown</h3>
                  </div>
                  <span className="text-white/50 text-sm">
                    Total: ${totalBudget.toLocaleString()}
                  </span>
                </div>
                <div className="space-y-3">
                  {brief.budget_summary.by_room &&
                    Object.entries(brief.budget_summary.by_room).map(([room, amount]) => {
                      const pct = totalBudget > 0 ? Math.round((amount / totalBudget) * 100) : 0;
                      return (
                        <div key={room}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-white/60">{room}</span>
                            <span className="text-white/40">
                              ${Number(amount).toLocaleString()} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
                              className="h-full rounded-full bg-gradient-to-r from-gold to-gold/70"
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </motion.div>
            )}

            {/* Room Cards */}
            {brief.rooms?.length > 0 && (
              <div>
                <h3 className="font-medium text-white mb-4 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-white/40" />
                  Room Plans
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {brief.rooms.map((room, i) => (
                    <motion.div
                      key={room.room}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-white">{room.room}</h4>
                        {room.priority && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              PRIORITY_COLORS[room.priority] || PRIORITY_COLORS.medium
                            }`}
                          >
                            {room.priority}
                          </span>
                        )}
                      </div>
                      {room.budget_allocation && (
                        <p className="text-white/30 text-xs mb-3">
                          Budget: ${Number(room.budget_allocation).toLocaleString()}
                        </p>
                      )}
                      {room.categories_needed?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-white/40 text-xs uppercase tracking-wider mb-1.5">Categories</p>
                          <div className="flex flex-wrap gap-1.5">
                            {room.categories_needed.map((cat) => (
                              <span
                                key={cat}
                                className="text-xs bg-white/[0.06] border border-white/[0.06] rounded-md px-2 py-0.5 text-white/50"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {room.recommended_vendors?.length > 0 && (
                        <div className="mb-3">
                          <p className="text-white/40 text-xs uppercase tracking-wider mb-1.5">Recommended Vendors</p>
                          <div className="space-y-1.5">
                            {room.recommended_vendors.map((v) => (
                              <div key={v.name} className="text-sm flex items-start gap-1.5">
                                <span className="text-gold font-medium shrink-0">{v.name}</span>
                                {v.reason && <span className="text-white/30">&mdash; {v.reason}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {room.style_notes && (
                        <p className="text-white/40 text-sm leading-relaxed">{room.style_notes}</p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Vendor Strategy */}
            {brief.vendor_strategy && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-5 w-5 text-gold" />
                  <h3 className="font-medium text-white">Vendor Strategy</h3>
                </div>
                <p className="text-white/50 text-sm leading-relaxed">{brief.vendor_strategy}</p>
              </motion.div>
            )}

            {/* Risk Factors */}
            {brief.risk_factors?.length > 0 && (
              <div>
                <h3 className="font-medium text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  Risk Factors
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {brief.risk_factors.map((risk, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                      className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 flex items-start gap-2.5"
                    >
                      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                      <p className="text-white/60 text-sm">{risk}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* First Searches */}
            {brief.first_searches?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Search className="h-5 w-5 text-gold" />
                  <h3 className="font-medium text-white">Start Sourcing</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {brief.first_searches.map((query, i) => (
                    <Link
                      key={i}
                      to={`${createPageUrl("Search")}?q=${encodeURIComponent(query)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gold/20 bg-gold/[0.08] px-3 py-1.5 text-sm text-gold hover:bg-gold/[0.15] hover:border-gold/30 transition-all"
                    >
                      <Search className="h-3.5 w-3.5" />
                      {query}
                      <ArrowRight className="h-3 w-3 ml-0.5" />
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PLAN TAB
   ═══════════════════════════════════════════════════════════════ */

function PlanTab({ project, onProjectUpdate }) {
  const [form, setForm] = useState({
    room_type: project.room_type?.split(", ")[0] || "Living Room",
    dimensions: "",
    style: "Modern",
    palette: "",
    budget: project.budget ? String(project.budget) : "",
    items: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const [addedMsg, setAddedMsg] = useState(null);

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPlan(null);
    const result = await fetchRoomPlan({
      room_type: form.room_type,
      dimensions: form.dimensions,
      style: form.style,
      palette: form.palette,
      budget: Number(form.budget) || 0,
      items: form.items,
      notes: form.notes,
    });
    if (!result) {
      setError("Failed to generate room plan. Please try again.");
    } else {
      setPlan(result);
    }
    setLoading(false);
  };

  const handleAddAllToProject = () => {
    if (!plan?.categories) return;
    let updated = null;
    plan.categories.forEach((cat) => {
      if (cat.primary) {
        updated = addProductToProject(project.id, {
          id: `rp_${cat.category}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: cat.primary.product_name,
          product_name: cat.primary.product_name,
          manufacturer_name: cat.primary.vendor_name,
          thumbnail: cat.primary.image_url || "",
          image_url: cat.primary.image_url || "",
          portal_url: cat.primary.product_url || "",
          retail_price: cat.primary.retail_price,
          material: cat.primary.material || "",
        });
      }
    });
    if (updated && onProjectUpdate) onProjectUpdate(updated);
    setAddedMsg("Added primary picks to project!");
    setTimeout(() => setAddedMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Form */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Room Type</label>
            <select className={selectClass} value={form.room_type} onChange={update("room_type")}>
              {ROOM_TYPES.map((rt) => (
                <option key={rt} value={rt} className="bg-neutral-900">{rt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Dimensions</label>
            <input className={inputClass} placeholder="e.g. 20x15 feet" value={form.dimensions} onChange={update("dimensions")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Style</label>
            <select className={selectClass} value={form.style} onChange={update("style")}>
              {STYLES.map((s) => (
                <option key={s} value={s} className="bg-neutral-900">{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Budget ($)</label>
            <input type="number" className={inputClass} placeholder="e.g. 15000" value={form.budget} onChange={update("budget")} min={0} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">Color Palette</label>
          <input className={inputClass} placeholder="e.g. neutral warm tones, cream and walnut" value={form.palette} onChange={update("palette")} />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">Items Needed</label>
          <textarea
            className={inputClass + " min-h-[72px] resize-y"}
            placeholder="e.g. sofa, two accent chairs, coffee table, console, rug, two table lamps"
            value={form.items}
            onChange={update("items")}
            rows={2}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">Additional Notes</label>
          <textarea
            className={inputClass + " min-h-[60px] resize-y"}
            placeholder="Any specific constraints, preferences, or details..."
            value={form.notes}
            onChange={update("notes")}
            rows={2}
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="bg-gold hover:bg-gold/90 text-black font-semibold px-6 py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 animate-spin" /> Generating Plan...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" /> Generate Room Plan
            </span>
          )}
        </Button>
      </motion.form>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 animate-pulse">
              <div className="h-4 w-48 bg-white/10 rounded mb-3" />
              <div className="h-3 w-full bg-white/[0.03] rounded mb-2" />
              <div className="h-3 w-3/4 bg-white/[0.03] rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {plan && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Concept card */}
          {plan.room_plan && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-gold/20 bg-gold/[0.04] p-6"
            >
              <h2 className="text-lg font-semibold text-gold flex items-center gap-2 mb-2">
                <Sparkles className="h-5 w-5" /> Design Concept
              </h2>
              <p className="text-white/70 text-sm leading-relaxed">{plan.room_plan.concept}</p>
              {plan.room_plan.budget_allocation && (
                <p className="text-xs text-white/40 mt-3">{plan.room_plan.budget_allocation}</p>
              )}
            </motion.div>
          )}

          {/* Budget bar */}
          {plan.categories?.length > 0 && (
            <BudgetAllocationBar
              categories={plan.categories}
              estimatedTotal={plan.room_plan?.estimated_total}
              totalBudget={Number(form.budget) || plan.room_plan?.estimated_total || 0}
            />
          )}

          {/* Categories */}
          {plan.categories?.map((cat, idx) => (
            <motion.div
              key={cat.category}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * idx }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">{cat.category}</h3>
                <span className="text-xs text-white/30">Budget: {formatCurrency(cat.allocated_budget)}</span>
              </div>
              {cat.primary && <RoomPlanProductCard product={cat.primary} large />}
              {cat.alternatives?.length > 0 && (
                <div>
                  <p className="text-xs text-white/30 mb-2 uppercase tracking-wider">Alternatives</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cat.alternatives.map((alt, ai) => (
                      <RoomPlanProductCard key={`${cat.category}-alt-${ai}`} product={alt} large={false} />
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}

          {/* Estimated total */}
          {plan.room_plan?.estimated_total && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 flex items-center justify-between">
              <span className="text-sm text-white/50">Estimated Total</span>
              <span className="text-xl font-bold text-gold">{formatCurrency(plan.room_plan.estimated_total)}</span>
            </div>
          )}

          {/* Styling notes */}
          {plan.styling_notes && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
              <h3 className="text-sm font-medium text-white/60 mb-2">Styling Notes</h3>
              <p className="text-sm text-white/50 leading-relaxed">{plan.styling_notes}</p>
            </div>
          )}

          {/* Vendor summary */}
          {plan.vendor_summary && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5">
              <h3 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" /> Vendor Summary
              </h3>
              <p className="text-sm text-white/50 leading-relaxed">{plan.vendor_summary}</p>
            </div>
          )}

          {/* Add All to Project */}
          <div className="relative">
            <Button
              onClick={handleAddAllToProject}
              className="bg-white/10 hover:bg-white/15 text-white font-medium px-5 py-2.5 rounded-lg transition w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" /> Add All to Project
            </Button>
            {addedMsg && (
              <motion.span
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute left-0 -bottom-7 text-xs text-green-400"
              >
                {addedMsg}
              </motion.span>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOURCE TAB
   ═══════════════════════════════════════════════════════════════ */

function SourceTab({ project, onProjectUpdate }) {
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
    if (updated) onProjectUpdate(updated);
    setShowAddFromCompare(false);
  };

  const handleRemoveProduct = (productId) => {
    const updated = removeProductFromProject(project.id, productId);
    if (updated) onProjectUpdate(updated);
  };

  const healthCfg = analysis
    ? HEALTH_COLORS[analysis.project_health] || HEALTH_COLORS["needs-attention"]
    : null;
  const HealthIcon = healthCfg?.icon || Clock;

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-end gap-2">
        <Button onClick={() => setShowAddFromCompare(true)} variant="outline" size="sm">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add from Compare
        </Button>
        <Link to={createPageUrl("Search")}>
          <Button variant="outline" size="sm">
            <Search className="h-3.5 w-3.5 mr-1" /> Find Products
          </Button>
        </Link>
      </div>

      {/* Budget stats */}
      {project.budget > 0 && (
        <div className="grid grid-cols-3 gap-4">
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
      <div className="rounded-2xl border border-gold/20 bg-gold/[0.05] p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            <Brain className="h-4 w-4" /> AI Project Analysis
            {analyzing && (
              <div className="h-3.5 w-3.5 rounded-full border-2 border-gold/30 border-t-gold animate-spin ml-2" />
            )}
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
              <p className="text-xs text-white/40">
                <span className="text-white/50 font-medium">Style:</span> {analysis.style_coherence}
              </p>
            )}
            {analysis.timeline_risk && (
              <p className="text-xs text-white/40">
                <span className="text-white/50 font-medium">Timeline:</span> {analysis.timeline_risk}
              </p>
            )}

            {/* Action Items */}
            {analysis.action_items?.length > 0 && (
              <div>
                <div className="text-[10px] uppercase text-white/30 mb-2">Action Items</div>
                <div className="space-y-2">
                  {analysis.action_items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          item.priority === "high"
                            ? "bg-red-500/10 text-red-400"
                            : item.priority === "medium"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-white/[0.03] text-white/30"
                        }`}
                      >
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
                      className="flex items-center gap-1 rounded-full bg-gold/10 px-3 py-1 text-xs text-gold hover:bg-gold/20 transition-colors"
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
              className="rounded-2xl border border-white/[0.06] glass-surface p-6 max-w-md w-full mx-4"
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
                  <div className="text-sm font-medium text-white truncate">{product.product_name || product.name}</div>
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
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRESENT TAB — Template Renderers
   ═══════════════════════════════════════════════════════════════ */

function MoodBoardLayout({ selectedProducts, presentation }) {
  const moodKeywords = presentation?.mood_keywords || [];
  const sizes = ["tall", "wide", "normal", "tall", "normal", "wide"];
  return (
    <div className="space-y-4">
      {moodKeywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {moodKeywords.map((kw, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-white/60 text-xs uppercase tracking-wider"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
      <div className="columns-2 md:columns-3 gap-4 space-y-4">
        {selectedProducts.map((product, i) => {
          const sizeClass = sizes[i % sizes.length];
          const presProduct = presentation?.products?.find((p) => p.id === product.id);
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`break-inside-avoid rounded-xl overflow-hidden border border-white/[0.06] glass-surface relative group ${
                sizeClass === "tall" ? "min-h-[320px]" : sizeClass === "wide" ? "min-h-[200px]" : "min-h-[240px]"
              }`}
            >
              {(product.image_url || product.thumbnail) ? (
                <img src={product.image_url || product.thumbnail} alt={product.product_name || product.name} className="w-full h-48 object-cover" />
              ) : (
                <div className="w-full h-48 bg-white/[0.03] flex items-center justify-center">
                  <ImageOff className="h-8 w-8 text-white/15" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <div>
                  <p className="text-white font-medium text-sm">{product.product_name || product.name}</p>
                  {presProduct?.presentation_text && (
                    <p className="text-white/60 text-xs mt-1 line-clamp-3">{presProduct.presentation_text}</p>
                  )}
                </div>
              </div>
              <div className="p-3">
                <p className="text-white text-sm font-medium truncate">{product.product_name || product.name}</p>
                <p className="text-white/40 text-xs">{product.manufacturer_name}</p>
                {(product.retail_price || product.wholesale_price) && (
                  <p className="text-gold text-sm font-semibold mt-1">
                    ${Number(product.retail_price || product.wholesale_price).toLocaleString()}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function SpecSheetLayout({ selectedProducts, presentation }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="text-left py-3 px-4 text-white/50 font-medium">Image</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium">Product</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium">Vendor</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium">Price</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium">Category</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium min-w-[250px]">AI Narrative</th>
          </tr>
        </thead>
        <tbody>
          {selectedProducts.map((product, i) => {
            const presProduct = presentation?.products?.find((p) => p.id === product.id);
            const imgSrc = product.image_url || product.thumbnail;
            return (
              <motion.tr
                key={product.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-white/5 hover:bg-white/[0.02]"
              >
                <td className="py-3 px-4">
                  {imgSrc ? (
                    <img src={imgSrc} alt={product.product_name || product.name} className="w-14 h-14 object-cover rounded-lg" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-white/[0.03] flex items-center justify-center">
                      <ImageOff className="h-4 w-4 text-white/15" />
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{product.product_name || product.name}</p>
                  {product.sku && <p className="text-white/30 text-xs">SKU: {product.sku}</p>}
                </td>
                <td className="py-3 px-4 text-white/60">{product.manufacturer_name || "---"}</td>
                <td className="py-3 px-4 text-gold font-semibold">
                  {(product.retail_price || product.wholesale_price) ? `$${Number(product.retail_price || product.wholesale_price).toLocaleString()}` : "---"}
                </td>
                <td className="py-3 px-4 text-white/60">{product.style || product.category || "---"}</td>
                <td className="py-3 px-4 text-white/50 text-xs leading-relaxed">
                  {presProduct?.presentation_text || (
                    <span className="text-white/20 italic">Generate AI copy to fill</span>
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RoomConceptLayout({ selectedProducts, presentation }) {
  return (
    <div className="space-y-6">
      {presentation?.project_narrative ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/[0.06] p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-gold" />
            <span className="text-gold text-xs font-semibold uppercase tracking-wider">Room Narrative</span>
          </div>
          <p className="text-white/80 leading-relaxed">{presentation.project_narrative}</p>
          {presentation.room_context && (
            <p className="text-white/50 text-sm mt-3">{presentation.room_context}</p>
          )}
          {presentation.style_direction && (
            <div className="mt-3 flex items-center gap-2">
              <Type className="h-3.5 w-3.5 text-white/30" />
              <span className="text-white/40 text-xs">Style: {presentation.style_direction}</span>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/[0.06] p-6 text-center">
          <Sparkles className="h-6 w-6 text-white/15 mx-auto mb-2" />
          <p className="text-white/30 text-sm">Generate AI copy to create a room narrative</p>
        </div>
      )}

      {presentation?.color_palette?.length > 0 && (
        <div className="flex items-center gap-3">
          <Palette className="h-4 w-4 text-white/30" />
          <span className="text-white/40 text-xs mr-2">Palette:</span>
          {presentation.color_palette.map((color, i) => (
            <span key={i} className="px-2 py-0.5 rounded bg-white/[0.03] text-white/60 text-xs">{color}</span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {selectedProducts.map((product, i) => {
          const presProduct = presentation?.products?.find((p) => p.id === product.id);
          const imgSrc = product.image_url || product.thumbnail;
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-white/[0.06] glass-surface overflow-hidden"
            >
              <div className="flex gap-4 p-4">
                {imgSrc ? (
                  <img src={imgSrc} alt={product.product_name || product.name} className="w-24 h-24 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-white/[0.03] flex items-center justify-center flex-shrink-0">
                    <ImageOff className="h-6 w-6 text-white/15" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{product.product_name || product.name}</p>
                  <p className="text-white/40 text-xs">{product.manufacturer_name}</p>
                  {(product.retail_price || product.wholesale_price) && (
                    <p className="text-gold text-sm font-semibold mt-1">
                      ${Number(product.retail_price || product.wholesale_price).toLocaleString()}
                    </p>
                  )}
                  {presProduct?.placement_suggestion && (
                    <div className="mt-2 px-2 py-1 bg-white/[0.03] rounded text-white/50 text-xs">
                      <span className="text-white/30 mr-1">Placement:</span>
                      {presProduct.placement_suggestion}
                    </div>
                  )}
                </div>
              </div>
              {presProduct?.presentation_text && (
                <div className="px-4 pb-4 pt-0">
                  <p className="text-white/50 text-xs leading-relaxed border-t border-white/5 pt-3">
                    {presProduct.presentation_text}
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function VendorComparisonLayout({ selectedProducts, presentation }) {
  const grouped = {};
  selectedProducts.forEach((product) => {
    const vendor = product.manufacturer_name || "Unknown";
    if (!grouped[vendor]) grouped[vendor] = [];
    grouped[vendor].push(product);
  });
  const vendors = Object.keys(grouped);

  return (
    <div className="space-y-6">
      {presentation?.pairings?.length > 0 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-gold" />
            <span className="text-gold text-xs font-semibold uppercase tracking-wider">Comparison Notes</span>
          </div>
          <ul className="space-y-1">
            {presentation.pairings.map((p, i) => (
              <li key={i} className="text-white/50 text-sm">
                {typeof p === "string" ? `\u2022 ${p}` : `\u2022 ${p.note || JSON.stringify(p)}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {vendors.map((vendor, vi) => (
        <motion.div
          key={vendor}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: vi * 0.08 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-white/30" />
            <h3 className="text-white font-semibold text-lg">{vendor}</h3>
            <span className="text-white/30 text-xs ml-auto">
              {grouped[vendor].length} product{grouped[vendor].length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped[vendor].map((product, i) => {
              const presProduct = presentation?.products?.find((p) => p.id === product.id);
              const imgSrc = product.image_url || product.thumbnail;
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: vi * 0.08 + i * 0.03 }}
                  className="rounded-xl border border-white/[0.06] glass-surface p-4"
                >
                  {imgSrc ? (
                    <img src={imgSrc} alt={product.product_name || product.name} className="w-full h-32 object-cover rounded-lg mb-3" />
                  ) : (
                    <div className="w-full h-32 rounded-lg bg-white/[0.03] flex items-center justify-center mb-3">
                      <ImageOff className="h-6 w-6 text-white/15" />
                    </div>
                  )}
                  <p className="text-white font-medium text-sm truncate">{product.product_name || product.name}</p>
                  {(product.retail_price || product.wholesale_price) && (
                    <p className="text-gold text-sm font-semibold mt-1">
                      ${Number(product.retail_price || product.wholesale_price).toLocaleString()}
                    </p>
                  )}
                  {presProduct?.presentation_text && (
                    <p className="text-white/50 text-xs mt-2 leading-relaxed line-clamp-4">
                      {presProduct.presentation_text}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRESENT TAB
   ═══════════════════════════════════════════════════════════════ */

function PresentTab({ project }) {
  const allProducts = project.products || [];
  const [selectedIds, setSelectedIds] = useState(() => new Set(allProducts.map((p) => p.id)));
  const [activeTemplate, setActiveTemplate] = useState("mood-board");
  const [presentation, setPresentation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Re-sync selectedIds when products change
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(allProducts.map((p) => p.id));
      const next = new Set();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      // Also add any new products
      for (const id of validIds) {
        if (!prev.has(id)) next.add(id);
      }
      return next;
    });
  }, [allProducts]);

  const selectedProducts = allProducts.filter((p) => selectedIds.has(p.id));

  const toggleProduct = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleGenerateAI = async () => {
    if (selectedProducts.length === 0) return;
    setLoading(true);
    const result = await fetchPresentationData(selectedProducts);
    setPresentation(result);
    setLoading(false);
  };

  const handleExportPdf = async () => {
    if (selectedProducts.length === 0) return;
    setExporting(true);
    try {
      await generateQuotePdf(selectedProducts, project.name || "Client Presentation");
    } catch {
      // PDF generation failed silently
    }
    setExporting(false);
  };

  const renderCanvas = () => {
    if (selectedProducts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Layout className="h-12 w-12 text-white/10 mb-4" />
          <p className="text-white/30 text-lg mb-1">Canvas is empty</p>
          <p className="text-white/20 text-sm">Toggle products in the sidebar to add them</p>
        </div>
      );
    }
    const props = { selectedProducts, presentation };
    switch (activeTemplate) {
      case "mood-board": return <MoodBoardLayout {...props} />;
      case "spec-sheet": return <SpecSheetLayout {...props} />;
      case "room-concept": return <RoomConceptLayout {...props} />;
      case "vendor-comparison": return <VendorComparisonLayout {...props} />;
      default: return <MoodBoardLayout {...props} />;
    }
  };

  return (
    <div className="space-y-0 -mx-6 -mb-6">
      {/* Template Selector */}
      <div className="border-b border-white/[0.06] bg-white/[0.02] px-6 py-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {PRESENTATION_TEMPLATES.map((tmpl) => {
              const Icon = tmpl.icon;
              const isActive = activeTemplate === tmpl.id;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => setActiveTemplate(tmpl.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? "bg-gold/20 text-gold border border-gold/30"
                      : "bg-white/[0.03] text-white/50 border border-white/[0.06] hover:bg-white/10 hover:text-white/70"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tmpl.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerateAI}
              disabled={loading || selectedProducts.length === 0}
              className="gap-2 bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 disabled:opacity-40"
              size="sm"
            >
              {loading ? (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Sparkles className="h-4 w-4" />
                  </motion.div>
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate AI Copy
                </>
              )}
            </Button>
            <Button
              onClick={handleExportPdf}
              disabled={exporting || selectedProducts.length === 0}
              variant="outline"
              size="sm"
              className="gap-2 border-white/[0.06] text-white/60 hover:text-white hover:bg-white/[0.03] disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting..." : "Download PDF"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex min-h-[500px]">
        {/* Product Sidebar */}
        <div className="w-[240px] flex-shrink-0 border-r border-white/[0.06] bg-white/[0.01] overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                Products ({allProducts.length})
              </h2>
              <span className="text-white/30 text-xs">{selectedIds.size} selected</span>
            </div>

            {allProducts.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-xs">No products in project yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {allProducts.map((product) => {
                  const isSelected = selectedIds.has(product.id);
                  const imgSrc = product.image_url || product.thumbnail;
                  return (
                    <motion.button
                      key={product.id}
                      onClick={() => toggleProduct(product.id)}
                      whileTap={{ scale: 0.97 }}
                      className={`w-full rounded-lg p-2 text-left transition-all flex items-start gap-2 group ${
                        isSelected
                          ? "bg-gold/10 border border-gold/20"
                          : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06] hover:border-white/[0.06]"
                      }`}
                    >
                      {imgSrc ? (
                        <img src={imgSrc} alt={product.product_name || product.name} className="w-12 h-12 object-cover rounded flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded bg-white/[0.03] flex items-center justify-center flex-shrink-0">
                          <ImageOff className="h-4 w-4 text-white/15" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate leading-tight">
                          {product.product_name || product.name}
                        </p>
                        <p className="text-white/30 text-[10px] truncate">{product.manufacturer_name}</p>
                        {(product.retail_price || product.wholesale_price) && (
                          <p className="text-gold/80 text-[10px] font-semibold mt-0.5">
                            ${Number(product.retail_price || product.wholesale_price).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        {isSelected ? (
                          <X className="h-3.5 w-3.5 text-gold/60" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 text-white/20 group-hover:text-white/40" />
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <AnimatePresence>
            {presentation?.style_direction && activeTemplate !== "room-concept" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 flex items-center gap-4 text-xs text-white/40"
              >
                {presentation.style_direction && (
                  <span className="flex items-center gap-1.5">
                    <Type className="h-3.5 w-3.5" />
                    {presentation.style_direction}
                  </span>
                )}
                {presentation.color_palette?.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5" />
                    {presentation.color_palette.join(", ")}
                  </span>
                )}
                {presentation.project_narrative && (
                  <span className="flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[400px]">{presentation.project_narrative}</span>
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTemplate}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderCanvas()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROJECT DETAIL VIEW (tabbed)
   ═══════════════════════════════════════════════════════════════ */

function ProjectDetailView({ project, onBack, onUpdate, initialTab }) {
  const [activeTab, setActiveTab] = useState(initialTab || "source");

  const handleProjectUpdate = (updated) => {
    onUpdate(updated);
  };

  return (
    <div className="space-y-0">
      {/* Back + Header */}
      <div className="mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-white/30 hover:text-white/60 mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> All Projects
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">{project.name}</h1>
            <div className="text-sm text-white/30 mt-1">
              {project.room_type || "No room type"} · {project.products.length} products
              {project.budget > 0 && ` · $${project.budget.toLocaleString()} budget`}
            </div>
            {project.notes && <p className="text-sm text-white/20 mt-2 max-w-2xl">{project.notes}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06] -mx-6 px-6">
        {DETAIL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                isActive
                  ? "border-gold text-gold"
                  : "border-transparent text-white/40 hover:text-white/60 hover:border-white/[0.06]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "brief" && (
            <BriefTab project={project} onProjectUpdate={handleProjectUpdate} />
          )}
          {activeTab === "plan" && (
            <PlanTab project={project} onProjectUpdate={handleProjectUpdate} />
          )}
          {activeTab === "source" && (
            <SourceTab project={project} onProjectUpdate={handleProjectUpdate} />
          )}
          {activeTab === "present" && (
            <PresentTab project={project} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PROJECT LIST VIEW
   ═══════════════════════════════════════════════════════════════ */

function ProjectListView({ projects, onSelectProject, onCreateProject, onDeleteProject }) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", room_type: "", budget: "", notes: "" });

  const handleCreate = () => {
    const project = onCreateProject(form);
    setForm({ name: "", room_type: "", budget: "", notes: "" });
    setShowCreate(false);
    return project;
  };

  return (
    <>
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
            className="rounded-2xl border border-gold/20 bg-gold/[0.05] p-6 mb-6 overflow-hidden"
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
              onClick={() => onSelectProject(project)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-white font-semibold">{project.name}</h3>
                  <div className="text-xs text-white/30 mt-0.5">
                    {project.room_type || "No room type"} · {project.products.length} items
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
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
                  <div className="h-1.5 bg-white/[0.03] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        budgetPct > 90 ? "bg-red-500" : budgetPct > 70 ? "bg-yellow-500" : "bg-gold"
                      }`}
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
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT — ProjectWorkflow
   ═══════════════════════════════════════════════════════════════ */

export default function ProjectWorkflow() {
  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [initialTab, setInitialTab] = useState("source");

  useEffect(() => {
    setProjects(getProjects());
  }, []);

  const refreshProjects = () => setProjects(getProjects());

  const handleCreateProject = (form) => {
    const project = createProject(form);
    refreshProjects();
    setInitialTab("brief");
    setActiveProject(project);
    return project;
  };

  const handleDeleteProject = (id) => {
    deleteProject(id);
    refreshProjects();
    if (activeProject?.id === id) setActiveProject(null);
  };

  const handleSelectProject = (project) => {
    setInitialTab("source");
    setActiveProject(project);
  };

  const handleProjectUpdate = (updated) => {
    setActiveProject(updated);
    refreshProjects();
  };

  const handleBack = () => {
    setActiveProject(null);
    refreshProjects();
  };

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-5xl">
        {activeProject ? (
          <ProjectDetailView
            project={activeProject}
            onBack={handleBack}
            onUpdate={handleProjectUpdate}
            initialTab={initialTab}
          />
        ) : (
          <ProjectListView
            projects={projects}
            onSelectProject={handleSelectProject}
            onCreateProject={handleCreateProject}
            onDeleteProject={handleDeleteProject}
          />
        )}
      </div>
    </div>
  );
}
