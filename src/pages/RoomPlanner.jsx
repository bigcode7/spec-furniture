import { useState, useEffect } from "react";
import {
  Wand2,
  DollarSign,
  ExternalLink,
  Plus,
  ShoppingBag,
  Sparkles,
  ImageOff,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  getProjects,
  addProductToProject,
  createProject,
} from "@/lib/growth-store";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

const ROOM_TYPES = [
  "Living Room",
  "Bedroom",
  "Dining Room",
  "Home Office",
  "Outdoor",
  "Nursery",
  "Media Room",
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

async function fetchRoomPlan(body) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(
      `${searchServiceUrl.replace(/\/$/, "")}/room-plan`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.plan;
  } catch {
    return null;
  }
}

function formatCurrency(value) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

const inputClass =
  "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20 transition";

const selectClass =
  "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm text-white focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20 transition appearance-none";

// ---------- Sub-components ----------

function ProductCard({ product, large }) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-xl border border-white/[0.06] bg-white/[0.03] overflow-hidden ${
        large ? "" : "flex gap-4"
      }`}
    >
      {/* Image */}
      <div
        className={`relative bg-white/5 flex items-center justify-center ${
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

      {/* Info */}
      <div className={`flex flex-col gap-1.5 p-4 ${large ? "" : "py-3"}`}>
        <h4
          className={`font-semibold text-white leading-snug ${
            large ? "text-lg" : "text-sm"
          }`}
        >
          {product.product_name}
        </h4>
        <p className="text-xs text-white/40">{product.vendor_name}</p>

        {product.material && (
          <p className="text-xs text-white/30">{product.material}</p>
        )}

        <p className="text-gold font-medium text-sm mt-auto">
          {formatCurrency(product.retail_price)}
        </p>

        {large && product.why && (
          <p className="text-xs text-white/50 mt-1 leading-relaxed">
            {product.why}
          </p>
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

function BudgetBar({ categories, estimatedTotal, totalBudget }) {
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
          <span className="text-gold font-semibold">
            {formatCurrency(estimatedTotal)}
          </span>
          {totalBudget ? (
            <span className="ml-1 text-white/25">
              / {formatCurrency(totalBudget)}
            </span>
          ) : null}
        </span>
      </div>

      {/* Bar */}
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5 mb-4">
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

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {categories.map((cat, i) => (
          <span
            key={cat.category}
            className="flex items-center gap-1.5 text-xs text-white/50"
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${colors[i % colors.length]}`}
            />
            {cat.category}{" "}
            <span className="text-white/30">
              {formatCurrency(cat.allocated_budget)}
            </span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ---------- Main component ----------

export default function RoomPlanner() {
  const [form, setForm] = useState({
    room_type: "Living Room",
    dimensions: "",
    style: "Modern",
    palette: "",
    budget: "",
    items: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);

  // project picker state
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projects, setProjects] = useState([]);
  const [addedToProject, setAddedToProject] = useState(null);

  const update = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPlan(null);

    const body = {
      room_type: form.room_type,
      dimensions: form.dimensions,
      style: form.style,
      palette: form.palette,
      budget: Number(form.budget) || 0,
      items: form.items,
      notes: form.notes,
    };

    const result = await fetchRoomPlan(body);
    if (!result) {
      setError("Failed to generate room plan. Please try again.");
    } else {
      setPlan(result);
    }
    setLoading(false);
  };

  const handleAddAllToProject = () => {
    setProjects(getProjects());
    setShowProjectPicker(true);
  };

  const addToExistingProject = (projectId) => {
    if (!plan?.categories) return;
    plan.categories.forEach((cat) => {
      if (cat.primary) {
        addProductToProject(projectId, {
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
    setAddedToProject(projectId);
    setShowProjectPicker(false);
    setTimeout(() => setAddedToProject(null), 3000);
  };

  const addToNewProject = () => {
    const project = createProject({
      name: `${form.style} ${form.room_type}`,
      room_type: form.room_type,
      budget: Number(form.budget) || 0,
      notes: `Generated by AI Room Planner`,
    });
    addToExistingProject(project.id);
  };

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold font-display text-white flex items-center gap-3">
            <Wand2 className="h-8 w-8 text-gold" />
            AI Room Planner
          </h1>
          <p className="text-white/40 mt-2 text-sm max-w-2xl">
            Describe the room you're designing and get a complete, curated
            product recommendation list with budget allocation, primary picks,
            and alternatives.
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl glass-surface p-6 mb-8 space-y-5"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Room type */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Room Type
              </label>
              <select
                className={selectClass}
                value={form.room_type}
                onChange={update("room_type")}
              >
                {ROOM_TYPES.map((rt) => (
                  <option key={rt} value={rt} className="bg-neutral-900">
                    {rt}
                  </option>
                ))}
              </select>
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Dimensions
              </label>
              <input
                className={inputClass}
                placeholder="e.g. 20x15 feet"
                value={form.dimensions}
                onChange={update("dimensions")}
              />
            </div>

            {/* Style */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Style
              </label>
              <select
                className={selectClass}
                value={form.style}
                onChange={update("style")}
              >
                {STYLES.map((s) => (
                  <option key={s} value={s} className="bg-neutral-900">
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Budget ($)
              </label>
              <input
                type="number"
                className={inputClass}
                placeholder="e.g. 15000"
                value={form.budget}
                onChange={update("budget")}
                min={0}
              />
            </div>
          </div>

          {/* Color palette */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Color Palette
            </label>
            <input
              className={inputClass}
              placeholder="e.g. neutral warm tones, cream and walnut"
              value={form.palette}
              onChange={update("palette")}
            />
          </div>

          {/* Items needed */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Items Needed
            </label>
            <textarea
              className={inputClass + " min-h-[72px] resize-y"}
              placeholder="e.g. sofa, two accent chairs, coffee table, console, rug, two table lamps"
              value={form.items}
              onChange={update("items")}
              rows={2}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">
              Additional Notes
            </label>
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
                <Sparkles className="h-4 w-4 animate-spin" />
                Generating Plan...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Wand2 className="h-4 w-4" />
                Generate Room Plan
              </span>
            )}
          </Button>
        </motion.form>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-8 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 animate-pulse"
              >
                <div className="h-4 w-48 bg-white/10 rounded mb-3" />
                <div className="h-3 w-full bg-white/5 rounded mb-2" />
                <div className="h-3 w-3/4 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {plan && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
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
                <p className="text-white/70 text-sm leading-relaxed">
                  {plan.room_plan.concept}
                </p>
                {plan.room_plan.budget_allocation && (
                  <p className="text-xs text-white/40 mt-3">
                    {plan.room_plan.budget_allocation}
                  </p>
                )}
              </motion.div>
            )}

            {/* Budget bar */}
            {plan.categories && plan.categories.length > 0 && (
              <BudgetBar
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
                  <h3 className="text-base font-semibold text-white">
                    {cat.category}
                  </h3>
                  <span className="text-xs text-white/30">
                    Budget: {formatCurrency(cat.allocated_budget)}
                  </span>
                </div>

                {/* Primary pick */}
                {cat.primary && <ProductCard product={cat.primary} large />}

                {/* Alternatives */}
                {cat.alternatives && cat.alternatives.length > 0 && (
                  <div>
                    <p className="text-xs text-white/30 mb-2 uppercase tracking-wider">
                      Alternatives
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {cat.alternatives.map((alt, ai) => (
                        <ProductCard
                          key={`${cat.category}-alt-${ai}`}
                          product={alt}
                          large={false}
                        />
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
                <span className="text-xl font-bold text-gold">
                  {formatCurrency(plan.room_plan.estimated_total)}
                </span>
              </div>
            )}

            {/* Styling notes */}
            {plan.styling_notes && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5"
              >
                <h3 className="text-sm font-medium text-white/60 mb-2">
                  Styling Notes
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {plan.styling_notes}
                </p>
              </motion.div>
            )}

            {/* Vendor summary */}
            {plan.vendor_summary && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5"
              >
                <h3 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" /> Vendor Summary
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {plan.vendor_summary}
                </p>
              </motion.div>
            )}

            {/* Add All to Project */}
            <div className="relative">
              <Button
                onClick={handleAddAllToProject}
                className="bg-white/10 hover:bg-white/15 text-white font-medium px-5 py-2.5 rounded-lg transition w-full sm:w-auto"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add All to Project
              </Button>

              {addedToProject && (
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute left-0 -bottom-7 text-xs text-green-400"
                >
                  Added to project!
                </motion.span>
              )}

              {/* Project picker dropdown */}
              {showProjectPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-white/[0.06] bg-neutral-900 shadow-2xl p-3 space-y-1"
                >
                  <p className="text-xs text-white/40 mb-2 px-1">
                    Select a project
                  </p>

                  {projects.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addToExistingProject(p.id)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-sm text-white/70 hover:text-white transition"
                    >
                      {p.name}
                    </button>
                  ))}

                  <button
                    onClick={addToNewProject}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-gold/10 text-sm text-gold/70 hover:text-gold transition flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" /> Create new project
                  </button>

                  <button
                    onClick={() => setShowProjectPicker(false)}
                    className="w-full text-center px-3 py-1.5 text-xs text-white/30 hover:text-white/50 transition mt-1"
                  >
                    Cancel
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
