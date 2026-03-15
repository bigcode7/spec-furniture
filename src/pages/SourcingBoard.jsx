import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  FolderKanban,
  Package,
  CheckCircle,
  Clock,
  DollarSign,
  Users,
  Share2,
  Palette,
  ArrowRight,
  Loader2,
  Search,
  ImageOff,
  ChevronRight,
  ChevronLeft,
  X,
  AlertTriangle,
  Sparkles,
  Building2,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

const STATUS_CONFIG = {
  sourcing: { color: "bg-gold/10 text-gold/70 border-gold/20", label: "Needs Sourcing", icon: Search },
  "options-ready": { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Options Ready", icon: Package },
  selected: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Selected", icon: CheckCircle },
  ordered: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Ordered", icon: Clock },
  delivered: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Delivered", icon: CheckCircle },
};

const PRIORITY_CONFIG = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-white/[0.05] text-white/50 border-white/[0.06]",
};

function formatRoomType(type) {
  return (type || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStyle(style) {
  return (style || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount || 0);
}

function ProductOptionCard({ product, onSelect }) {
  const [imgError, setImgError] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="shrink-0 w-52 border border-white/[0.06] glass-surface rounded-xl overflow-hidden"
    >
      <div className="w-full h-32 bg-white/[0.03] flex items-center justify-center">
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <ImageOff className="w-8 h-8 text-white/20" />
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">{product.name}</p>
        <p className="text-xs text-white/40 truncate">{product.vendor}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-semibold text-white">{formatCurrency(product.price)}</span>
          <Button
            size="sm"
            onClick={() => onSelect(product)}
            className="bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1 h-auto rounded-lg"
          >
            Select
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function SelectedProductCard({ product, onChangeClick }) {
  const [imgError, setImgError] = useState(false);
  return (
    <div className="flex items-center gap-3 p-3 border border-gold/20 bg-gold/[0.05] rounded-xl">
      <div className="w-16 h-16 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0 overflow-hidden">
        {product.image_url && !imgError ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" onError={() => setImgError(true)} />
        ) : (
          <ImageOff className="w-5 h-5 text-white/20" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{product.name}</p>
        <p className="text-xs text-white/40">{product.vendor} &middot; {formatCurrency(product.price)}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onChangeClick}
        className="border-white/[0.06] text-white/60 hover:text-white text-xs shrink-0"
      >
        Change
      </Button>
    </div>
  );
}

function OrderedProductCard({ product, item }) {
  return (
    <div className="flex items-center gap-3 p-3 border border-purple-500/20 bg-purple-500/[0.05] rounded-xl">
      <Clock className="w-5 h-5 text-purple-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{product.name}</p>
        <p className="text-xs text-white/40">
          Ordered {item.order_date || "recently"} &middot; Lead time: {item.lead_time || "TBD"}
        </p>
      </div>
      <span className="text-sm font-medium text-white/60">{formatCurrency(product.price)}</span>
    </div>
  );
}

function DeliveredProductCard({ product }) {
  return (
    <div className="flex items-center gap-3 p-3 border border-emerald-500/20 bg-emerald-500/[0.05] rounded-xl">
      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{product.name}</p>
        <p className="text-xs text-white/40">{product.vendor}</p>
      </div>
      <span className="text-sm font-medium text-white/60">{formatCurrency(product.price)}</span>
    </div>
  );
}

function FurnitureItemCard({ item, projectId, roomId, onUpdate }) {
  const [sourcingLoading, setSourcingLoading] = useState(false);
  const [selectingProduct, setSelectingProduct] = useState(null);
  // scrollRef unused but available for horizontal scroll

  const StatusIcon = STATUS_CONFIG[item.status]?.icon || Package;

  const handleAutoSource = async () => {
    setSourcingLoading(true);
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/rooms/${roomId}/auto-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id }),
      });
      if (!res.ok) throw new Error("Failed to auto-source");
      const data = await res.json();
      onUpdate(data);
    } catch {
      // silently fail
    } finally {
      setSourcingLoading(false);
    }
  };

  const handleSelect = async (product) => {
    setSelectingProduct(product.id || product.name);
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/rooms/${roomId}/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_product: product, status: "selected" }),
      });
      if (!res.ok) throw new Error("Failed to select product");
      const data = await res.json();
      onUpdate(data);
    } catch {
      // silently fail
    } finally {
      setSelectingProduct(null);
    }
  };

  const handleChange = async () => {
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/rooms/${roomId}/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_product: null, status: "sourcing" }),
      });
      if (!res.ok) throw new Error("Failed to reset");
      const data = await res.json();
      onUpdate(data);
    } catch {
      // silently fail
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-white/[0.06] glass-surface rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon className="w-4 h-4 text-white/40" />
          <div>
            <h4 className="text-sm font-medium text-white">{item.name}</h4>
            {item.quantity > 1 && (
              <span className="text-xs text-white/40">Qty: {item.quantity}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {item.priority && (
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_CONFIG[item.priority] || PRIORITY_CONFIG.low}`}>
              {item.priority}
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_CONFIG[item.status]?.color || ""}`}>
            {STATUS_CONFIG[item.status]?.label || item.status}
          </Badge>
        </div>
      </div>

      {/* Content based on status */}
      {item.status === "sourcing" && (
        <div className="flex gap-2">
          <Button
            onClick={handleAutoSource}
            disabled={sourcingLoading}
            className="flex-1 btn-gold rounded-lg gap-2"
            variant="ghost"
          >
            {sourcingLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sourcing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Auto-Source
              </>
            )}
          </Button>
          <Link
            to={`${createPageUrl("Search")}?q=${encodeURIComponent(item.search_query || item.name)}`}
            className="flex items-center gap-1.5 px-3 rounded-lg border border-white/[0.06] text-xs text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            Search
          </Link>
        </div>
      )}

      {item.status === "options-ready" && item.options && (
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-white/10">
          {item.options.map((product, i) => (
            <ProductOptionCard key={product.id || i} product={product} onSelect={handleSelect} />
          ))}
        </div>
      )}

      {item.status === "selected" && item.selected_product && (
        <SelectedProductCard product={item.selected_product} onChangeClick={handleChange} />
      )}

      {item.status === "ordered" && item.selected_product && (
        <OrderedProductCard product={item.selected_product} item={item} />
      )}

      {item.status === "delivered" && item.selected_product && (
        <DeliveredProductCard product={item.selected_product} />
      )}
    </motion.div>
  );
}

function StyleCheckPanel({ data, onClose }) {
  const scoreColor = data.score >= 80 ? "text-emerald-400" : data.score >= 60 ? "text-amber-400" : "text-red-400";
  const scoreBg = data.score >= 80 ? "bg-emerald-500" : data.score >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 h-full w-full max-w-md z-50 border-l border-white/[0.06] glass-surface bg-[#0a0a0f]/95 backdrop-blur-xl overflow-y-auto"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-display font-semibold text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-gold" />
            Style Coherence
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score */}
        <div className="text-center mb-8">
          <div className={`text-5xl font-bold ${scoreColor} mb-1`}>{data.score}</div>
          <p className="text-sm text-white/40">out of 100</p>
          <div className="w-full h-2 bg-white/[0.05] rounded-full mt-4 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.score}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${scoreBg}`}
            />
          </div>
        </div>

        {/* Material Conflicts */}
        {data.material_conflicts?.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Material Conflicts
            </h3>
            <div className="space-y-2">
              {data.material_conflicts.map((conflict, i) => (
                <div key={i} className="p-3 border border-amber-500/10 bg-amber-500/[0.03] rounded-lg text-sm text-white/70">
                  {conflict}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Color Conflicts */}
        {data.color_conflicts?.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4 text-red-400" />
              Color Conflicts
            </h3>
            <div className="space-y-2">
              {data.color_conflicts.map((conflict, i) => (
                <div key={i} className="p-3 border border-red-500/10 bg-red-500/[0.03] rounded-lg text-sm text-white/70">
                  {conflict}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {data.suggestions?.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Suggestions
            </h3>
            <div className="space-y-2">
              {data.suggestions.map((suggestion, i) => (
                <div key={i} className="p-3 border border-emerald-500/10 bg-emerald-500/[0.03] rounded-lg text-sm text-white/70">
                  {suggestion}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ProjectListView() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${SEARCH_URL}/projects`)
      .then((r) => r.json())
      .then((data) => { setProjects(data.projects || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display font-semibold text-white">Sourcing Projects</h1>
            <p className="text-sm text-white/30 mt-1">{projects.length} projects</p>
          </div>
          <Button
            onClick={() => (window.location.href = createPageUrl("ProjectIntake"))}
            className="btn-gold gap-2"
          >
            <Sparkles className="w-4 h-4" />
            New Project
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <FolderKanban className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h2 className="text-lg font-display font-medium text-white/50 mb-2">No projects yet</h2>
            <p className="text-sm text-white/25 mb-6 max-w-md mx-auto">
              Create a new project to start sourcing furniture room by room with AI-powered recommendations.
            </p>
            <Button
              onClick={() => (window.location.href = createPageUrl("ProjectIntake"))}
              className="btn-gold gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Create First Project
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((proj) => (
              <motion.a
                key={proj.id}
                href={createPageUrl("SourcingBoard") + "?project=" + proj.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                className="block border border-white/[0.06] glass-surface rounded-xl p-5 hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-white font-medium">{proj.name}</h3>
                    <p className="text-sm text-white/30 mt-1">
                      {proj.client_name && `${proj.client_name} · `}
                      {proj.room_count || 0} rooms · {proj.item_count || 0} items
                      {proj.style && ` · ${proj.style.replace(/-/g, " ")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {proj.budget?.total > 0 && (
                      <Badge variant="secondary" className="bg-white/[0.05] text-white/50 border-0">
                        ${(proj.budget.total / 1000).toFixed(0)}k budget
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-white/20" />
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SourcingBoard() {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRoomIndex, setSelectedRoomIndex] = useState(0);
  const [autoSourcingAll, setAutoSourcingAll] = useState(false);
  const [styleCheckData, setStyleCheckData] = useState(null);
  const [showStyleCheck, setShowStyleCheck] = useState(false);
  const [styleCheckLoading, setStyleCheckLoading] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [costSummary, setCostSummary] = useState(null);
  const [showCostSummary, setShowCostSummary] = useState(false);
  const [costLoading, setCostLoading] = useState(false);

  const projectId = new URLSearchParams(window.location.search).get("project");

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load project");
      const data = await res.json();
      setProject(data.project || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const selectedRoom = project?.rooms?.[selectedRoomIndex];

  // If no project ID, show project list (after all hooks)
  if (!projectId) return <ProjectListView />;

  const budgetUsed = project?.rooms?.reduce((total, room) => {
    return total + (room.items || []).reduce((roomTotal, item) => {
      if (item.selected_product?.price) return roomTotal + item.selected_product.price * (item.quantity || 1);
      return roomTotal;
    }, 0);
  }, 0) || 0;

  const handleAutoSourceAll = async () => {
    if (!selectedRoom) return;
    setAutoSourcingAll(true);
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/rooms/${selectedRoom.id}/auto-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to auto-source room");
      await fetchProject();
    } catch {
      // silently fail
    } finally {
      setAutoSourcingAll(false);
    }
  };

  const handleStyleCheck = async () => {
    setStyleCheckLoading(true);
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/style-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Style check failed");
      const data = await res.json();
      setStyleCheckData(data);
      setShowStyleCheck(true);
    } catch {
      // silently fail
    } finally {
      setStyleCheckLoading(false);
    }
  };

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Share failed");
      const data = await res.json();
      const token = data.share_token || data.token;
      const link = `${window.location.origin}${createPageUrl("ClientPortal")}?token=${token}`;
      setShareLink(link);
      navigator.clipboard?.writeText(link);
    } catch {
      // silently fail
    } finally {
      setShareLoading(false);
    }
  };

  const handleCostSummary = async () => {
    setCostLoading(true);
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/cost-summary`);
      if (!res.ok) throw new Error("Failed to load cost summary");
      const data = await res.json();
      setCostSummary(data);
      setShowCostSummary(true);
    } catch {
      // silently fail
    } finally {
      setCostLoading(false);
    }
  };

  const handleItemUpdate = () => {
    fetchProject();
  };

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
          <Button
            onClick={() => (window.location.href = createPageUrl("ProjectIntake"))}
            className="mt-4 bg-white/10 hover:bg-white/20 text-white"
          >
            New Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* ─── Left Sidebar ─── */}
      <aside className="w-72 shrink-0 border-r border-white/[0.06] bg-white/[0.03] p-4 overflow-y-auto">
        {/* Project Info Card */}
        <div className="border border-white/[0.06] glass-surface rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <FolderKanban className="w-5 h-5 text-gold" />
            <h2 className="text-sm font-display font-semibold text-white truncate">{project.name}</h2>
          </div>
          <div className="space-y-2 text-xs text-white/50">
            {project.client_name && (
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                <span>{project.client_name}</span>
              </div>
            )}
            {project.style && (
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" />
                <span>{formatStyle(project.style)}</span>
              </div>
            )}
            {project.budget > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Budget</span>
                  </div>
                  <span className="text-white/70">
                    {formatCurrency(budgetUsed)} / {formatCurrency(project.budget)}
                  </span>
                </div>
                <Progress
                  value={Math.min((budgetUsed / project.budget) * 100, 100)}
                  className="h-1.5 bg-white/[0.05]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Room List */}
        <div className="space-y-1">
          <p className="label-caps text-white/30 px-2 mb-2">
            Rooms
          </p>
          {project.rooms?.map((room, index) => {
            const totalItems = room.items?.length || 0;
            const completedItems = (room.items || []).filter(
              (i) => i.status === "selected" || i.status === "ordered" || i.status === "delivered"
            ).length;
            return (
              <button
                key={room.id || index}
                onClick={() => setSelectedRoomIndex(index)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  selectedRoomIndex === index
                    ? "bg-gold/10 text-gold border border-gold/20"
                    : "text-white/50 hover:bg-white/[0.03] hover:text-white/70 border border-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span className="text-sm font-medium">{formatRoomType(room.type)}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${selectedRoomIndex === index ? "rotate-90" : ""}`} />
                </div>
                <div className="flex items-center gap-2 mt-1 ml-6">
                  <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold rounded-full transition-all"
                      style={{ width: totalItems > 0 ? `${(completedItems / totalItems) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="text-[10px] text-white/30">
                    {completedItems}/{totalItems}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ─── Main Area ─── */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0a0a0f]/80 backdrop-blur-xl px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-display font-semibold text-white">
                {selectedRoom ? formatRoomType(selectedRoom.type) : "Select a room"}
              </h1>
              {selectedRoom?.size_sqft && (
                <Badge variant="outline" className="border-white/[0.06] text-white/40 text-xs">
                  {selectedRoom.size_sqft} sqft
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAutoSourceAll}
                disabled={autoSourcingAll}
                className="border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.05] gap-1.5 text-xs"
              >
                {autoSourcingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Auto-Source All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStyleCheck}
                disabled={styleCheckLoading}
                className="border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.05] gap-1.5 text-xs"
              >
                {styleCheckLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palette className="w-3.5 h-3.5" />}
                Style Check
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                disabled={shareLoading}
                className="border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.05] gap-1.5 text-xs"
              >
                {shareLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                Share with Client
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCostSummary}
                disabled={costLoading}
                className="border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.05] gap-1.5 text-xs"
              >
                {costLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                Cost Summary
              </Button>
            </div>
          </div>

          {/* Share link notification */}
          <AnimatePresence>
            {shareLink && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-400 truncate flex-1">{shareLink}</span>
                <button onClick={() => setShareLink(null)} className="text-white/40 hover:text-white">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Items Grid */}
        <div className="p-6">
          {selectedRoom && selectedRoom.items?.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {selectedRoom.items.map((item) => (
                <FurnitureItemCard
                  key={item.id}
                  item={item}
                  projectId={projectId}
                  roomId={selectedRoom.id}
                  onUpdate={handleItemUpdate}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Package className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">No items in this room yet.</p>
            </div>
          )}
        </div>

        {/* Cost Summary Overlay */}
        <AnimatePresence>
          {showCostSummary && costSummary && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setShowCostSummary(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg border border-white/[0.06] glass-surface rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-display font-semibold text-white flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-gold" />
                    Cost Summary
                  </h2>
                  <button onClick={() => setShowCostSummary(false)} className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Total */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-white/50 mb-1">
                    <span>Total Spent</span>
                    <span>{formatCurrency(costSummary.total_spent)} / {formatCurrency(costSummary.total_budget)}</span>
                  </div>
                  <Progress
                    value={costSummary.total_budget > 0 ? Math.min((costSummary.total_spent / costSummary.total_budget) * 100, 100) : 0}
                    className="h-2 bg-white/[0.05]"
                  />
                  <p className="text-xs text-white/30 mt-1">
                    {formatCurrency((costSummary.total_budget || 0) - (costSummary.total_spent || 0))} remaining
                  </p>
                </div>

                {/* Per-room breakdown */}
                {costSummary.rooms?.map((room, i) => (
                  <div key={i} className="mb-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/70">{formatRoomType(room.type)}</span>
                      <span className="text-white/50">{formatCurrency(room.spent)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold rounded-full"
                        style={{ width: costSummary.total_spent > 0 ? `${(room.spent / costSummary.total_spent) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ─── Style Check Panel ─── */}
      <AnimatePresence>
        {showStyleCheck && styleCheckData && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setShowStyleCheck(false)}
            />
            <StyleCheckPanel data={styleCheckData} onClose={() => setShowStyleCheck(false)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
