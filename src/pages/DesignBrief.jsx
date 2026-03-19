import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ClipboardList,
  Calendar,
  DollarSign,
  AlertTriangle,
  Search,
  Sparkles,
  ArrowRight,
  Plus,
  Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { createProject } from "@/lib/growth-store";

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

const PRIORITY_COLORS = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-gold/20 text-gold border-gold/30",
  low: "bg-green-500/20 text-green-400 border-green-500/30",
};

async function submitDesignBrief(payload) {
  if (!searchServiceUrl) return null;
  const response = await fetch(
    `${searchServiceUrl.replace(/\/$/, "")}/design-brief`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) throw new Error("Failed to generate design brief");
  const data = await response.json();
  return data.brief;
}

export default function DesignBrief() {
  const [form, setForm] = useState({
    project_name: "",
    room_types: [],
    style: "",
    budget_min: "",
    budget_max: "",
    timeline: "1 month",
    vendor_preferences: "",
    avoid: "",
    notes: "",
  });

  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [createdProject, setCreatedProject] = useState(null);

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
    if (!form.project_name.trim() || form.room_types.length === 0) return;

    setLoading(true);
    setError(null);
    setBrief(null);

    try {
      const result = await submitDesignBrief({
        project_name: form.project_name.trim(),
        room_types: form.room_types,
        style: form.style.trim(),
        budget: `${form.budget_min || 0}-${form.budget_max || 0}`,
        timeline: form.timeline,
        vendor_preferences: form.vendor_preferences.trim(),
        avoid: form.avoid.trim(),
        notes: form.notes.trim(),
      });
      setBrief(result);
    } catch {
      setError("Failed to generate design brief. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    const project = createProject({
      name: form.project_name,
      room_type: form.room_types.join(", "),
      budget: Number(form.budget_max) || 0,
      notes: brief?.brief_summary || form.notes,
    });
    setCreatedProject(project);
  };

  const totalBudget = brief?.budget_summary?.total || 0;

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList className="h-6 w-6 text-gold" />
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">
            AI Design Brief
          </h1>
        </div>
        <p className="text-white/30 text-sm mb-8">
          Describe your project and Spekd generates a comprehensive sourcing plan
        </p>

        {/* Intake Form */}
        <AnimatePresence mode="wait">
          {!brief && (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              onSubmit={handleSubmit}
              className="space-y-6"
            >
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={form.project_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, project_name: e.target.value }))
                  }
                  placeholder="e.g. Smith Residence Living Refresh"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30"
                  required
                />
              </div>

              {/* Room Types */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-3">
                  Room Types *
                </label>
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
                            ? "bg-gold/10 border-gold/40 text-gold/70"
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
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Style Direction
                </label>
                <input
                  type="text"
                  value={form.style}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, style: e.target.value }))
                  }
                  placeholder="e.g. Modern coastal with warm wood tones"
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30"
                />
              </div>

              {/* Budget Range */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Budget Range
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                    <input
                      type="number"
                      value={form.budget_min}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, budget_min: e.target.value }))
                      }
                      placeholder="Min"
                      min="0"
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-9 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30"
                    />
                  </div>
                  <span className="text-white/20">to</span>
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                    <input
                      type="number"
                      value={form.budget_max}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, budget_max: e.target.value }))
                      }
                      placeholder="Max"
                      min="0"
                      className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-9 pr-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30"
                    />
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Timeline
                </label>
                <select
                  value={form.timeline}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, timeline: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 appearance-none"
                >
                  {TIMELINES.map((t) => (
                    <option key={t} value={t} className="bg-zinc-900">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vendor Preferences */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Vendor Preferences
                </label>
                <textarea
                  value={form.vendor_preferences}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      vendor_preferences: e.target.value,
                    }))
                  }
                  placeholder="e.g. Love Bernhardt and Four Hands, open to others"
                  rows={2}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 resize-none"
                />
              </div>

              {/* Products to Avoid */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Products to Avoid
                </label>
                <textarea
                  value={form.avoid}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, avoid: e.target.value }))
                  }
                  placeholder="e.g. No glass tables, avoid bright primary colors"
                  rows={2}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 resize-none"
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-white/60 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  placeholder="Any other details about the project..."
                  rows={3}
                  className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 resize-none"
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
                disabled={
                  loading ||
                  !form.project_name.trim() ||
                  form.room_types.length === 0
                }
                className="w-full h-12 rounded-xl btn-gold text-white font-medium text-base disabled:opacity-40 disabled:cursor-not-allowed"
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

          {/* Results */}
          {brief && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Back Button */}
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
                      {form.project_name}
                    </h2>
                    <p className="text-white/50 text-sm leading-relaxed">
                      {brief.brief_summary}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Timeline Card */}
              {brief.timeline && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-2xl border border-white/[0.06] glass-surface p-6"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-5 w-5 text-gold" />
                    <h3 className="font-medium text-white">Timeline</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-white/[0.04] border border-white/5 p-4">
                      <p className="text-white/30 text-xs uppercase tracking-wider mb-1">
                        Sourcing Window
                      </p>
                      <p className="text-white font-medium">
                        {brief.timeline.sourcing_weeks} weeks
                      </p>
                    </div>
                    <div className="rounded-xl bg-white/[0.04] border border-white/5 p-4">
                      <p className="text-white/30 text-xs uppercase tracking-wider mb-1">
                        Ordering Deadline
                      </p>
                      <p className="text-white font-medium">
                        {brief.timeline.ordering_deadline}
                      </p>
                    </div>
                  </div>
                  {brief.timeline.notes && (
                    <p className="text-white/40 text-sm mt-3">
                      {brief.timeline.notes}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Budget Breakdown */}
              {brief.budget_summary && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="rounded-2xl border border-white/[0.06] glass-surface p-6"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-400" />
                      <h3 className="font-medium text-white">
                        Budget Breakdown
                      </h3>
                    </div>
                    <span className="text-white/50 text-sm">
                      Total: $
                      {totalBudget.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {brief.budget_summary.by_room &&
                      Object.entries(brief.budget_summary.by_room).map(
                        ([room, amount]) => {
                          const pct =
                            totalBudget > 0
                              ? Math.round((amount / totalBudget) * 100)
                              : 0;
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
                                  transition={{
                                    delay: 0.3,
                                    duration: 0.6,
                                    ease: "easeOut",
                                  }}
                                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold/70"
                                />
                              </div>
                            </div>
                          );
                        }
                      )}
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
                        className="rounded-2xl border border-white/[0.06] glass-surface p-5"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-white">
                            {room.room}
                          </h4>
                          {room.priority && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${
                                PRIORITY_COLORS[room.priority] ||
                                PRIORITY_COLORS.medium
                              }`}
                            >
                              {room.priority}
                            </span>
                          )}
                        </div>

                        {room.budget_allocation && (
                          <p className="text-white/30 text-xs mb-3">
                            Budget: $
                            {Number(room.budget_allocation).toLocaleString()}
                          </p>
                        )}

                        {/* Categories Needed */}
                        {room.categories_needed?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-white/40 text-xs uppercase tracking-wider mb-1.5">
                              Categories
                            </p>
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

                        {/* Recommended Vendors */}
                        {room.recommended_vendors?.length > 0 && (
                          <div className="mb-3">
                            <p className="text-white/40 text-xs uppercase tracking-wider mb-1.5">
                              Recommended Vendors
                            </p>
                            <div className="space-y-1.5">
                              {room.recommended_vendors.map((v) => (
                                <div
                                  key={v.name}
                                  className="text-sm flex items-start gap-1.5"
                                >
                                  <span className="text-gold font-medium shrink-0">
                                    {v.name}
                                  </span>
                                  {v.reason && (
                                    <span className="text-white/30">
                                      &mdash; {v.reason}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Style Notes */}
                        {room.style_notes && (
                          <p className="text-white/40 text-sm leading-relaxed">
                            {room.style_notes}
                          </p>
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
                  className="rounded-2xl border border-white/[0.06] glass-surface p-6"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 className="h-5 w-5 text-gold" />
                    <h3 className="font-medium text-white">Vendor Strategy</h3>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed">
                    {brief.vendor_strategy}
                  </p>
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

              {/* Start Sourcing */}
              {brief.first_searches?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="rounded-2xl border border-white/[0.06] glass-surface p-6"
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
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gold/20 bg-gold/[0.08] px-3 py-1.5 text-sm text-gold/70 hover:bg-gold/[0.15] hover:border-gold/30 transition-all"
                      >
                        <Search className="h-3.5 w-3.5" />
                        {query}
                        <ArrowRight className="h-3 w-3 ml-0.5" />
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Create Project */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="rounded-2xl border border-white/[0.06] glass-surface p-6 text-center"
              >
                {createdProject ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-green-500/15 border border-green-500/25 px-4 py-1.5 text-green-400 text-sm">
                      <Plus className="h-4 w-4" />
                      Project created
                    </div>
                    <p className="text-white/40 text-sm">
                      "{createdProject.name}" is ready in your Projects.
                    </p>
                    <Link to={createPageUrl("Projects")}>
                      <Button
                        variant="outline"
                        className="mt-2 rounded-xl border-white/[0.06] text-white/60 hover:text-white hover:border-white/20"
                      >
                        View Projects
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-white/40 text-sm">
                      Save this brief as a trackable project
                    </p>
                    <Button
                      onClick={handleCreateProject}
                      className="rounded-xl btn-gold text-white"
                    >
                      <Plus className="h-4 w-4 mr-1.5" />
                      Create Project
                    </Button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
