import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  Loader2,
  AlertTriangle,
  ImageOff,
  Search,
  Package,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

function formatRoomType(type) {
  return (type || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount || 0);
}

function BudgetBar({ label, spent, total, color = "bg-gold" }) {
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const isOver = spent > total;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-white/70">{label}</span>
        <span className={isOver ? "text-red-400 font-medium" : "text-white/50"}>
          {formatCurrency(spent)} / {formatCurrency(total)}
        </span>
      </div>
      <div className="w-full h-2.5 bg-white/[0.05] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className={`h-full rounded-full ${isOver ? "bg-red-500" : color}`}
        />
      </div>
      {isOver && (
        <p className="text-xs text-red-400 mt-1">
          Over budget by {formatCurrency(spent - total)}
        </p>
      )}
    </div>
  );
}

function ProductRow({ item, index, onSwap }) {
  const [imgError, setImgError] = useState(false);
  const lineTotal = (item.selected_product?.price || 0) * (item.quantity || 1);

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex items-center gap-3 p-3 border border-white/[0.06] bg-white/[0.01] rounded-xl group"
    >
      <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0 overflow-hidden">
        {item.selected_product?.image_url && !imgError ? (
          <img
            src={item.selected_product.image_url}
            alt={item.selected_product.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageOff className="w-4 h-4 text-white/20" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-white truncate">
            {item.selected_product?.name}
          </p>
          {item.quantity > 1 && (
            <Badge variant="outline" className="border-white/[0.08] text-white/40 text-[10px] shrink-0">
              x{item.quantity}
            </Badge>
          )}
        </div>
        <p className="text-xs text-white/30">
          {formatRoomType(item.roomType)} &middot; {item.selected_product?.vendor}
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-white">
          {formatCurrency(lineTotal)}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSwap(item)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gold hover:text-gold/70 hover:bg-gold/10 px-2 h-7"
        >
          <Search className="w-3 h-3 mr-1" />
          Swap to Save
        </Button>
      </div>
    </motion.div>
  );
}

function SwapPanel({ item, alternatives, onSelect, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-white/[0.06] bg-[#08090E] rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-semibold text-white">Swap to Save</h3>
            <p className="text-sm text-white/40">
              Cheaper alternatives for {item.name}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 border border-white/[0.06] bg-white/[0.02] rounded-xl mb-4">
          <p className="text-xs text-white/40 mb-1">Current Selection</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-white">{item.selected_product?.name}</span>
            <span className="text-sm font-semibold text-white">{formatCurrency(item.selected_product?.price)}</span>
          </div>
        </div>

        {alternatives && alternatives.length > 0 ? (
          <div className="space-y-3">
            {alternatives.map((alt, i) => {
              const savings = (item.selected_product?.price || 0) - (alt.price || 0);
              return (
                <div key={alt.id || i} className="flex items-center gap-3 p-3 border border-white/[0.06] bg-white/[0.02] rounded-xl">
                  <div className="w-14 h-14 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0 overflow-hidden">
                    {alt.image_url ? (
                      <img src={alt.image_url} alt={alt.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageOff className="w-5 h-5 text-white/20" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{alt.name}</p>
                    <p className="text-xs text-white/40">{alt.vendor}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold text-white">{formatCurrency(alt.price)}</span>
                      {savings > 0 && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                          Save {formatCurrency(savings)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onSelect(alt)}
                    className="bg-white/10 hover:bg-white/20 text-white text-xs shrink-0"
                  >
                    Swap
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-white/30">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No cheaper alternatives found.</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function CostTracker() {
  const [project, setProject] = useState(null);
  const [costSummary, setCostSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [swapItem, setSwapItem] = useState(null);
  const [swapAlternatives, setSwapAlternatives] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);

  const projectId = new URLSearchParams(window.location.search).get("project");

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setError("No project ID provided");
      setLoading(false);
      return;
    }
    try {
      const [projRes, costRes] = await Promise.all([
        fetch(`${SEARCH_URL}/projects/${projectId}`),
        fetch(`${SEARCH_URL}/projects/${projectId}/cost-summary`),
      ]);
      if (!projRes.ok) throw new Error("Failed to load project");
      const projData = await projRes.json();
      setProject(projData.project || projData);

      if (costRes.ok) {
        const costData = await costRes.json();
        setCostSummary(costData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSwapToSave = async (item, roomId) => {
    setSwapItem({ ...item, roomId });
    setSwapLoading(true);
    setSwapAlternatives([]);
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/rooms/${roomId}/items/${item.id}/alternatives`);
      if (!res.ok) throw new Error("Failed to find alternatives");
      const data = await res.json();
      setSwapAlternatives(data.alternatives || data || []);
    } catch {
      setSwapAlternatives([]);
    } finally {
      setSwapLoading(false);
    }
  };

  const handleSwapSelect = async (alternative) => {
    if (!swapItem) return;
    try {
      await fetch(`${SEARCH_URL}/projects/${projectId}/rooms/${swapItem.roomId}/items/${swapItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_product: alternative, status: "selected" }),
      });
      setSwapItem(null);
      fetchData();
    } catch {
      // silently fail
    }
  };

  // Compute totals from project data
  const computedBudget = project?.budget || costSummary?.total_budget || 0;
  const computedSpent = costSummary?.total_spent ?? (project?.rooms || []).reduce((total, room) => {
    return total + (room.items || []).reduce((roomTotal, item) => {
      if (item.selected_product?.price) return roomTotal + item.selected_product.price * (item.quantity || 1);
      return roomTotal;
    }, 0);
  }, 0);

  const allSelectedItems = (project?.rooms || []).flatMap((room) =>
    (room.items || [])
      .filter((item) => item.selected_product)
      .map((item) => ({ ...item, roomType: room.type, roomId: room.id }))
  );

  // Sort by price descending
  const sortedItems = [...allSelectedItems].sort(
    (a, b) => (b.selected_product?.price || 0) * (b.quantity || 1) - (a.selected_product?.price || 0) * (a.quantity || 1)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <p className="text-white/60">{error || "Project not found"}</p>
        </div>
      </div>
    );
  }

  const roomColors = ["bg-gold", "bg-amber-500", "bg-emerald-500", "bg-purple-500", "bg-pink-500", "bg-cyan-500", "bg-orange-500", "bg-rose-500"];

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-1">
            <DollarSign className="w-6 h-6 text-gold" />
            <h1 className="font-display text-2xl font-bold text-white">Cost Tracker</h1>
          </div>
          <p className="text-white/40 ml-9">{project.name}</p>
        </motion.div>

        {/* Total Budget Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-white/[0.06] glass-surface rounded-2xl p-6 mb-6"
        >
          <h3 className="label-caps text-sm font-medium text-white/40 mb-4">
            Overall Budget
          </h3>
          <BudgetBar
            label="Total"
            spent={computedSpent}
            total={computedBudget}
            color="bg-gold"
          />

          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/[0.06]">
            <div className="text-center">
              <p className="text-xl font-bold text-white">{formatCurrency(computedSpent)}</p>
              <p className="text-xs text-white/40">Spent</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">{formatCurrency(Math.max(computedBudget - computedSpent, 0))}</p>
              <p className="text-xs text-white/40">Remaining</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-white">{allSelectedItems.length}</p>
              <p className="text-xs text-white/40">Items Selected</p>
            </div>
          </div>
        </motion.div>

        {/* Per-Room Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-white/[0.06] glass-surface rounded-2xl p-6 mb-6"
        >
          <h3 className="label-caps text-sm font-medium text-white/40 mb-4">
            Room Breakdown
          </h3>

          {(project.rooms || []).map((room, i) => {
            const roomSpent = (room.items || []).reduce((sum, item) => {
              return sum + (item.selected_product?.price || 0) * (item.quantity || 1);
            }, 0);
            const roomBudget = costSummary?.rooms?.find((r) => r.id === room.id)?.budget || (computedBudget / (project.rooms?.length || 1));

            return (
              <BudgetBar
                key={room.id || i}
                label={formatRoomType(room.type)}
                spent={roomSpent}
                total={roomBudget}
                color={roomColors[i % roomColors.length]}
              />
            );
          })}
        </motion.div>

        {/* Selected Products List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="border border-white/[0.06] glass-surface rounded-2xl p-6"
        >
          <h3 className="label-caps text-sm font-medium text-white/40 mb-4">
            Selected Products
          </h3>

          {sortedItems.length > 0 ? (
            <div className="space-y-2">
              {sortedItems.map((item, i) => (
                <ProductRow
                  key={item.id || i}
                  item={item}
                  index={i}
                  onSwap={(it) => handleSwapToSave(it, it.roomId)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Package className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-white/40 text-sm">No products selected yet.</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Swap Panel */}
      <AnimatePresence>
        {swapItem && (
          <SwapPanel
            item={swapItem}
            alternatives={swapLoading ? [] : swapAlternatives}
            onSelect={handleSwapSelect}
            onClose={() => setSwapItem(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
