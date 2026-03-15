import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronUp,
  Ruler,
  DoorOpen,
  Maximize2,
  Eye,
  Truck,
  Scale,
  RefreshCw,
  Sofa,
  X,
  Move,
  Flame,
  Tv,
  Mountain,
  ArrowUpDown,
  ArrowLeftRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const SEARCH_URL = (
  import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310"
).replace(/\/$/, "");

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

const WALLS = ["North", "South", "East", "West"];

const FURNITURE_CATEGORIES = [
  "Sofa",
  "Sectional",
  "Chair",
  "Accent Chair",
  "Coffee Table",
  "Side Table",
  "Console Table",
  "Dining Table",
  "Dining Chair",
  "Bed",
  "Nightstand",
  "Dresser",
  "Bookcase",
  "Desk",
  "Media Console",
  "Ottoman",
  "Bench",
  "Rug",
  "Floor Lamp",
  "Table Lamp",
];

const FOCAL_TYPES = [
  { value: "tv", label: "TV", icon: Tv },
  { value: "fireplace", label: "Fireplace", icon: Flame },
  { value: "view", label: "View/Window", icon: Mountain },
];

const inputClass =
  "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20 transition";

const selectClass =
  "w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20 transition appearance-none";

const labelClass = "block text-[11px] font-medium uppercase tracking-wider text-white/40 mb-1";

function feetToInches(ft) {
  return Math.round(parseFloat(ft || 0) * 12);
}

function scoreColor(score) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function scoreRingColor(score) {
  if (score >= 80) return "stroke-green-500";
  if (score >= 60) return "stroke-amber-500";
  return "stroke-red-500";
}

function severityIcon(severity) {
  switch (severity) {
    case "error":
      return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
    case "warning":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
    default:
      return <Info className="h-3.5 w-3.5 text-gold/70" />;
  }
}

// ---------------------------------------------------------------------------
// Score Ring SVG
// ---------------------------------------------------------------------------

function ScoreRing({ score, size = 80 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={4}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={scoreRingColor(score)}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span
        className={`absolute text-lg font-bold ${scoreColor(score)}`}
      >
        {score}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Furniture Modal
// ---------------------------------------------------------------------------

function AddFurnitureModal({ open, onClose, onAdd }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(FURNITURE_CATEGORIES[0]);
  const [width, setWidth] = useState("");
  const [depth, setDepth] = useState("");
  const [height, setHeight] = useState("");

  function handleAdd() {
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      category,
      dimensions: {
        width_in: parseFloat(width) || 0,
        depth_in: parseFloat(depth) || 0,
        height_in: parseFloat(height) || 0,
      },
    });
    setName("");
    setWidth("");
    setDepth("");
    setHeight("");
    onClose();
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#12121a] p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">
                Add Furniture Piece
              </h3>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-white/40 hover:bg-white/5 hover:text-white/60"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelClass}>Name</label>
                <input
                  className={inputClass}
                  placeholder="e.g. West Elm Harmony Sofa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>Category</label>
                <select
                  className={selectClass}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {FURNITURE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={labelClass}>Width (in)</label>
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="84"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Depth (in)</label>
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="36"
                    value={depth}
                    onChange={(e) => setDepth(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Height (in)</label>
                  <input
                    className={inputClass}
                    type="number"
                    placeholder="34"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white/50 hover:text-white/70"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!name.trim()}
                className="btn-gold"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Door / Window / Focal config row
// ---------------------------------------------------------------------------

function DoorRow({ door, onChange, onRemove }) {
  return (
    <div className="flex items-end gap-1.5">
      <div className="flex-1">
        <select
          className={selectClass}
          value={door.wall}
          onChange={(e) => onChange({ ...door, wall: e.target.value })}
        >
          {WALLS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>
      <div className="w-16">
        <input
          className={inputClass}
          type="number"
          placeholder="Pos"
          title="Position along wall (inches)"
          value={door.position}
          onChange={(e) => onChange({ ...door, position: e.target.value })}
        />
      </div>
      <div className="w-14">
        <input
          className={inputClass}
          type="number"
          placeholder="36"
          title="Width (inches)"
          value={door.width}
          onChange={(e) => onChange({ ...door, width: e.target.value })}
        />
      </div>
      <button
        onClick={onRemove}
        className="mb-0.5 rounded p-1.5 text-white/30 hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function WindowRow({ win, onChange, onRemove }) {
  return (
    <div className="flex items-end gap-1.5">
      <div className="flex-1">
        <select
          className={selectClass}
          value={win.wall}
          onChange={(e) => onChange({ ...win, wall: e.target.value })}
        >
          {WALLS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>
      <div className="w-16">
        <input
          className={inputClass}
          type="number"
          placeholder="Pos"
          title="Position along wall (inches)"
          value={win.position}
          onChange={(e) => onChange({ ...win, position: e.target.value })}
        />
      </div>
      <div className="w-14">
        <input
          className={inputClass}
          type="number"
          placeholder="36"
          title="Width (inches)"
          value={win.width}
          onChange={(e) => onChange({ ...win, width: e.target.value })}
        />
      </div>
      <button
        onClick={onRemove}
        className="mb-0.5 rounded p-1.5 text-white/30 hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Furniture list item
// ---------------------------------------------------------------------------

function FurnitureItem({ piece, onRemove }) {
  const dims = piece.dimensions;
  const dimStr = dims
    ? `${dims.width_in || "?"} x ${dims.depth_in || "?"} x ${dims.height_in || "?"} in`
    : "No dimensions";

  return (
    <div className="group flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <Sofa className="h-4 w-4 flex-shrink-0 text-white/20" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white/70">
          {piece.name}
        </p>
        <p className="text-[10px] text-white/30">
          {piece.category} &middot; {dimStr}
        </p>
      </div>
      <button
        onClick={onRemove}
        className="rounded p-1 text-white/20 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delivery Check Panel
// ---------------------------------------------------------------------------

function DeliveryCheckPanel({ pieces, open, onClose }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || pieces.length === 0) return;
    let cancelled = false;

    async function checkAll() {
      setLoading(true);
      const out = [];
      for (const piece of pieces) {
        try {
          const res = await fetch(`${SEARCH_URL}/spatial/delivery-check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product: {
                name: piece.name,
                dimensions: piece.dimensions
                  ? `${piece.dimensions.width_in}x${piece.dimensions.depth_in}x${piece.dimensions.height_in}`
                  : undefined,
              },
            }),
          });
          if (res.ok) {
            const json = await res.json();
            out.push({ ...piece, delivery: json });
          } else {
            out.push({ ...piece, delivery: null });
          }
        } catch {
          out.push({ ...piece, delivery: null });
        }
      }
      if (!cancelled) {
        setResults(out);
        setLoading(false);
      }
    }

    checkAll();
    return () => { cancelled = true; };
  }, [open, pieces]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-white/80">
          <Truck className="h-4 w-4" />
          Delivery Feasibility
        </h4>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-white/30 hover:bg-white/5 hover:text-white/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking delivery for {pieces.length} items...
        </div>
      ) : results.length === 0 ? (
        <p className="py-2 text-xs text-white/30">No items to check.</p>
      ) : (
        <div className="space-y-2">
          {results.map((item, i) => {
            const d = item.delivery;
            const status = d?.status || "unknown";
            const statusColor =
              status === "standard"
                ? "text-green-400"
                : status === "verify"
                  ? "text-amber-400"
                  : status === "special-planning"
                    ? "text-red-400"
                    : "text-white/40";

            return (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2"
              >
                <Truck className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${statusColor}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-white/70">
                    {item.name}
                  </p>
                  <p className={`text-[11px] ${statusColor}`}>
                    {d ? (d.label || status) : "Could not check"}
                  </p>
                  {d?.issues?.map((iss, j) => (
                    <p key={j} className="text-[10px] text-white/30">
                      &bull; {iss}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Scale Compare Panel
// ---------------------------------------------------------------------------

function ScaleComparePanel({ pieces, open, onClose }) {
  const [view, setView] = useState("front");
  const [selected, setSelected] = useState([]);
  const [svg, setSvg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && pieces.length > 0 && selected.length === 0) {
      setSelected(pieces.slice(0, Math.min(6, pieces.length)).map((_, i) => i));
    }
  }, [open, pieces]);

  const fetchScale = useCallback(async () => {
    if (selected.length < 1) return;
    setLoading(true);
    setError(null);
    try {
      const products = selected.map((idx) => {
        const p = pieces[idx];
        return {
          name: p.name,
          category: p.category,
          dimensions: p.dimensions
            ? `${p.dimensions.width_in}W x ${p.dimensions.depth_in}D x ${p.dimensions.height_in}H`
            : undefined,
        };
      });

      const res = await fetch(`${SEARCH_URL}/spatial/scale-compare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products,
          options: {
            view,
            includeHuman: true,
            width: 800,
            height: 300,
          },
        }),
      });

      if (!res.ok) throw new Error("Scale comparison failed");
      const json = await res.json();
      setSvg(json.svg || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selected, view, pieces]);

  useEffect(() => {
    if (open && selected.length > 0) {
      fetchScale();
    }
  }, [open, view]);

  if (!open) return null;

  function toggleItem(idx) {
    setSelected((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx].slice(0, 6)
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-white/80">
          <Scale className="h-4 w-4" />
          Scale Comparison
        </h4>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-white/30 hover:bg-white/5 hover:text-white/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* View toggle */}
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={() => setView("front")}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
            view === "front"
              ? "bg-gold/20 text-gold"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          <ArrowLeftRight className="mr-1 inline h-3 w-3" />
          Front View
        </button>
        <button
          onClick={() => setView("top")}
          className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
            view === "top"
              ? "bg-gold/20 text-gold"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          <ArrowUpDown className="mr-1 inline h-3 w-3" />
          Top View
        </button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchScale}
          disabled={loading || selected.length === 0}
          className="h-7 text-xs text-white/40"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Item selector */}
      <div className="mb-3 flex flex-wrap gap-1">
        {pieces.map((p, i) => (
          <button
            key={i}
            onClick={() => toggleItem(i)}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
              selected.includes(i)
                ? "border-gold/30 bg-gold/15 text-gold"
                : "border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/50"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* SVG output */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-white/30">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Generating comparison...
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 py-4 text-xs text-red-400/70">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : svg ? (
        <div
          className="flex items-center justify-center overflow-auto rounded-lg border border-white/[0.04] bg-black/20 p-2"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="py-6 text-center text-xs text-white/20">
          Select items and click Refresh to compare at scale.
        </div>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function RoomDesigner() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");

  // Room config
  const [roomType, setRoomType] = useState("Living Room");
  const [style, setStyle] = useState("Modern");
  const [widthFt, setWidthFt] = useState("14");
  const [depthFt, setDepthFt] = useState("12");
  const [doors, setDoors] = useState([
    { wall: "South", position: "60", width: "36" },
  ]);
  const [windows, setWindows] = useState([
    { wall: "East", position: "48", width: "48" },
  ]);
  const [focalWall, setFocalWall] = useState("North");
  const [focalType, setFocalType] = useState("tv");

  // Furniture
  const [pieces, setPieces] = useState([]);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Layout result
  const [floorPlanSvg, setFloorPlanSvg] = useState(null);
  const [layoutScore, setLayoutScore] = useState(null);
  const [layoutIssues, setLayoutIssues] = useState([]);
  const [trafficNotes, setTrafficNotes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  // Bottom panels
  const [showScale, setShowScale] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);

  // Right panel collapse
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // ---------------------------------------------------------------------------
  // Load furniture from project (placeholder -- integrates with project system)
  // ---------------------------------------------------------------------------
  const loadFromProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const { getProjects } = await import("@/lib/growth-store");
      const projects = getProjects();
      const proj = projects.find(
        (p) => p.id === projectId || p.name === projectId
      );
      if (!proj || !proj.products) return;

      const loaded = proj.products
        .filter((p) => p.dimensions || p.width_in)
        .map((p) => ({
          name: p.name || p.title || "Unknown",
          category: p.category || "Sofa",
          dimensions: p.dimensions || {
            width_in: p.width_in || 0,
            depth_in: p.depth_in || 0,
            height_in: p.height_in || 0,
          },
        }));

      if (loaded.length > 0) setPieces(loaded);
    } catch {
      // project store may not exist yet
    }
  }, [projectId]);

  useEffect(() => {
    loadFromProject();
  }, [loadFromProject]);

  // ---------------------------------------------------------------------------
  // Generate floor plan
  // ---------------------------------------------------------------------------
  const generateLayout = useCallback(async () => {
    setGenerating(true);
    setGenError(null);
    setFloorPlanSvg(null);
    setLayoutScore(null);
    setLayoutIssues([]);
    setTrafficNotes([]);

    const room = {
      type: roomType,
      style,
      width_in: feetToInches(widthFt),
      depth_in: feetToInches(depthFt),
      doors: doors.map((d) => ({
        wall: d.wall.toLowerCase(),
        position_in: parseFloat(d.position) || 0,
        width_in: parseFloat(d.width) || 36,
      })),
      windows: windows.map((w) => ({
        wall: w.wall.toLowerCase(),
        position_in: parseFloat(w.position) || 0,
        width_in: parseFloat(w.width) || 36,
      })),
      focal_point: {
        wall: focalWall.toLowerCase(),
        type: focalType,
      },
    };

    const apiPieces = pieces.map((p) => ({
      name: p.name,
      category: p.category,
      width_in: p.dimensions?.width_in || 0,
      depth_in: p.dimensions?.depth_in || 0,
      height_in: p.dimensions?.height_in || 0,
    }));

    try {
      const res = await fetch(`${SEARCH_URL}/spatial/floor-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room,
          pieces: apiPieces,
          options: {
            width: 700,
            height: 500,
            showDimensions: true,
            showTraffic: true,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Server returned ${res.status}`);
      }

      const json = await res.json();
      setFloorPlanSvg(json.svg || null);
      setLayoutScore(json.score ?? json.layout_score ?? null);
      setLayoutIssues(json.issues || []);
      setTrafficNotes(json.traffic_notes || json.trafficNotes || []);
    } catch (err) {
      setGenError(err.message || "Failed to generate layout");
    } finally {
      setGenerating(false);
    }
  }, [roomType, style, widthFt, depthFt, doors, windows, focalWall, focalType, pieces]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function addDoor() {
    setDoors((prev) => [...prev, { wall: "North", position: "", width: "36" }]);
  }

  function addWindow() {
    setWindows((prev) => [...prev, { wall: "North", position: "", width: "36" }]);
  }

  function updateDoor(idx, val) {
    setDoors((prev) => prev.map((d, i) => (i === idx ? val : d)));
  }

  function removeDoor(idx) {
    setDoors((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateWindow(idx, val) {
    setWindows((prev) => prev.map((w, i) => (i === idx ? val : w)));
  }

  function removeWindow(idx) {
    setWindows((prev) => prev.filter((_, i) => i !== idx));
  }

  function addFurniturePiece(piece) {
    setPieces((prev) => [...prev, piece]);
  }

  function removePiece(idx) {
    setPieces((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full min-h-screen flex-col bg-[#0a0a0f] text-white">
      {/* ---- Top Bar ---- */}
      <header className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3">
        <LayoutGrid className="h-5 w-5 text-gold" />
        <h1 className="text-base font-semibold font-display text-white/90">
          Room Designer
        </h1>
        <div className="mx-2 hidden h-5 w-px bg-white/[0.06] sm:block" />

        <select
          className={`${selectClass} w-auto`}
          value={roomType}
          onChange={(e) => setRoomType(e.target.value)}
        >
          {ROOM_TYPES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <ArrowLeftRight className="h-3.5 w-3.5 text-white/30" />
          <input
            className={`${inputClass} w-16 text-center`}
            type="number"
            min={1}
            step={0.5}
            value={widthFt}
            onChange={(e) => setWidthFt(e.target.value)}
            title="Width (feet)"
          />
          <X className="h-3 w-3 text-white/20" />
          <input
            className={`${inputClass} w-16 text-center`}
            type="number"
            min={1}
            step={0.5}
            value={depthFt}
            onChange={(e) => setDepthFt(e.target.value)}
            title="Depth (feet)"
          />
          <span className="text-[11px] text-white/30">ft</span>
        </div>

        <select
          className={`${selectClass} w-auto`}
          value={style}
          onChange={(e) => setStyle(e.target.value)}
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="flex-1" />

        {projectId && (
          <Link
            to={createPageUrl("ProjectWorkflow") + `?id=${projectId}`}
            className="text-xs text-gold hover:underline"
          >
            Back to Project
          </Link>
        )}
      </header>

      {/* ---- Body: left / center / right ---- */}
      <div className="flex flex-1 overflow-hidden">
        {/* ======= LEFT PANEL ======= */}
        <aside className="flex w-80 flex-shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-white/[0.01]">
          <div className="space-y-5 p-4">
            {/* Room Dimensions */}
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                <Ruler className="h-3.5 w-3.5" />
                Room Dimensions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Width (ft)</label>
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    step={0.5}
                    value={widthFt}
                    onChange={(e) => setWidthFt(e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Depth (ft)</label>
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    step={0.5}
                    value={depthFt}
                    onChange={(e) => setDepthFt(e.target.value)}
                  />
                </div>
              </div>
              <p className="mt-1 text-[10px] text-white/20">
                {feetToInches(widthFt)}&quot; &times; {feetToInches(depthFt)}&quot;
              </p>
            </section>

            {/* Doors */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <DoorOpen className="h-3.5 w-3.5" />
                  Doors
                </h3>
                <button
                  onClick={addDoor}
                  className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white/50"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {doors.length === 0 && (
                <p className="text-[11px] text-white/20">No doors added.</p>
              )}
              <div className="space-y-1.5">
                {doors.length > 0 && (
                  <div className="flex gap-1.5 text-[9px] uppercase tracking-wider text-white/20">
                    <span className="flex-1">Wall</span>
                    <span className="w-16">Pos (in)</span>
                    <span className="w-14">Width</span>
                    <span className="w-7" />
                  </div>
                )}
                {doors.map((d, i) => (
                  <DoorRow
                    key={i}
                    door={d}
                    onChange={(v) => updateDoor(i, v)}
                    onRemove={() => removeDoor(i)}
                  />
                ))}
              </div>
            </section>

            {/* Windows */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <Maximize2 className="h-3.5 w-3.5" />
                  Windows
                </h3>
                <button
                  onClick={addWindow}
                  className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white/50"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {windows.length === 0 && (
                <p className="text-[11px] text-white/20">No windows added.</p>
              )}
              <div className="space-y-1.5">
                {windows.length > 0 && (
                  <div className="flex gap-1.5 text-[9px] uppercase tracking-wider text-white/20">
                    <span className="flex-1">Wall</span>
                    <span className="w-16">Pos (in)</span>
                    <span className="w-14">Width</span>
                    <span className="w-7" />
                  </div>
                )}
                {windows.map((w, i) => (
                  <WindowRow
                    key={i}
                    win={w}
                    onChange={(v) => updateWindow(i, v)}
                    onRemove={() => removeWindow(i)}
                  />
                ))}
              </div>
            </section>

            {/* Focal Point */}
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                <Eye className="h-3.5 w-3.5" />
                Focal Point
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>Wall</label>
                  <select
                    className={selectClass}
                    value={focalWall}
                    onChange={(e) => setFocalWall(e.target.value)}
                  >
                    {WALLS.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Type</label>
                  <select
                    className={selectClass}
                    value={focalType}
                    onChange={(e) => setFocalType(e.target.value)}
                  >
                    {FOCAL_TYPES.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Divider */}
            <div className="border-t border-white/[0.06]" />

            {/* Furniture */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <Sofa className="h-3.5 w-3.5" />
                  Furniture ({pieces.length})
                </h3>
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="rounded p-1 text-white/30 hover:bg-white/5 hover:text-white/50"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {projectId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadFromProject}
                  className="mb-2 w-full justify-start text-xs text-gold/70 hover:text-gold"
                >
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Auto-detect from Project
                </Button>
              )}

              {pieces.length === 0 ? (
                <div className="rounded-lg border border-dashed border-white/[0.06] px-3 py-4 text-center">
                  <Sofa className="mx-auto mb-1 h-5 w-5 text-white/10" />
                  <p className="text-[11px] text-white/20">
                    No furniture added yet.
                  </p>
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="mt-1.5 text-xs text-gold/70 hover:text-gold"
                  >
                    + Add furniture
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {pieces.map((p, i) => (
                    <FurnitureItem
                      key={i}
                      piece={p}
                      onRemove={() => removePiece(i)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Generate button */}
          <div className="mt-auto border-t border-white/[0.06] p-4">
            <Button
              onClick={generateLayout}
              disabled={generating}
              className="w-full btn-gold text-black disabled:opacity-40"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  Generate Layout
                </>
              )}
            </Button>
          </div>
        </aside>

        {/* ======= CENTER AREA ======= */}
        <main className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 p-5">
            {/* Floor plan SVG */}
            {generating ? (
              <div className="flex h-[500px] flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.01]">
                <Loader2 className="mb-3 h-8 w-8 animate-spin text-gold/60" />
                <p className="text-sm text-white/40">
                  Generating optimal layout...
                </p>
                <p className="mt-1 text-xs text-white/20">
                  Analyzing room constraints and furniture placement
                </p>
              </div>
            ) : genError ? (
              <div className="flex h-[500px] flex-col items-center justify-center rounded-xl border border-red-500/10 bg-red-500/[0.02]">
                <AlertCircle className="mb-3 h-8 w-8 text-red-400/60" />
                <p className="text-sm text-red-400/70">
                  Failed to generate layout
                </p>
                <p className="mt-1 max-w-md text-center text-xs text-white/30">
                  {genError}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateLayout}
                  className="mt-3 text-xs text-gold"
                >
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Retry
                </Button>
              </div>
            ) : floorPlanSvg ? (
              <div className="space-y-4">
                <div
                  className="flex items-center justify-center overflow-auto rounded-xl border border-white/[0.06] bg-white/[0.01] p-4"
                  dangerouslySetInnerHTML={{ __html: floorPlanSvg }}
                />

                {/* Dimension annotations */}
                <div className="flex items-center gap-4 rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-2 text-xs text-white/40">
                  <span className="flex items-center gap-1">
                    <ArrowLeftRight className="h-3 w-3" />
                    {widthFt} ft ({feetToInches(widthFt)}&quot;)
                  </span>
                  <span className="flex items-center gap-1">
                    <ArrowUpDown className="h-3 w-3" />
                    {depthFt} ft ({feetToInches(depthFt)}&quot;)
                  </span>
                  <span className="flex items-center gap-1">
                    <Sofa className="h-3 w-3" />
                    {pieces.length} piece{pieces.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Issues below floor plan */}
                {layoutIssues.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-medium text-white/40">
                      Layout Notes
                    </h4>
                    {layoutIssues.map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2"
                      >
                        {severityIcon(issue.severity || "info")}
                        <p className="text-xs text-white/60">
                          {typeof issue === "string" ? issue : issue.message || issue.text || JSON.stringify(issue)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-[500px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.06] bg-white/[0.01]">
                <LayoutGrid className="mb-3 h-10 w-10 text-white/[0.06]" />
                <p className="text-sm text-white/30">
                  Configure your room and click Generate Layout
                </p>
                <p className="mt-1 text-xs text-white/15">
                  Add furniture pieces, set dimensions, doors, and windows
                </p>
              </div>
            )}
          </div>

          {/* ---- Bottom panels ---- */}
          <div className="space-y-3 border-t border-white/[0.06] p-5">
            {/* Toggle buttons */}
            <div className="flex gap-2">
              <Button
                variant={showScale ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setShowScale((v) => !v);
                  if (!showScale) setShowDelivery(false);
                }}
                className={
                  showScale
                    ? "bg-gold/20 text-gold"
                    : "text-white/40"
                }
                disabled={pieces.length === 0}
              >
                <Scale className="mr-1.5 h-3.5 w-3.5" />
                Scale Compare
              </Button>
              <Button
                variant={showDelivery ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setShowDelivery((v) => !v);
                  if (!showDelivery) setShowScale(false);
                }}
                className={
                  showDelivery
                    ? "bg-gold/20 text-gold"
                    : "text-white/40"
                }
                disabled={pieces.length === 0}
              >
                <Truck className="mr-1.5 h-3.5 w-3.5" />
                Delivery Check
              </Button>
            </div>

            <AnimatePresence mode="wait">
              {showScale && (
                <ScaleComparePanel
                  key="scale"
                  pieces={pieces}
                  open={showScale}
                  onClose={() => setShowScale(false)}
                />
              )}
              {showDelivery && (
                <DeliveryCheckPanel
                  key="delivery"
                  pieces={pieces}
                  open={showDelivery}
                  onClose={() => setShowDelivery(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* ======= RIGHT PANEL ======= */}
        <aside
          className={`flex flex-shrink-0 flex-col overflow-y-auto border-l border-white/[0.06] bg-white/[0.01] transition-all duration-300 ${
            rightCollapsed ? "w-10" : "w-72"
          }`}
        >
          {/* Collapse toggle */}
          <button
            onClick={() => setRightCollapsed((c) => !c)}
            className="flex items-center justify-center border-b border-white/[0.06] py-2 text-white/30 hover:text-white/50"
          >
            {rightCollapsed ? (
              <ChevronDown className="h-4 w-4 rotate-90" />
            ) : (
              <ChevronUp className="h-4 w-4 -rotate-90" />
            )}
          </button>

          {!rightCollapsed && (
            <div className="space-y-5 p-4">
              {/* Layout Score */}
              <section className="flex flex-col items-center">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/50">
                  Layout Score
                </h3>
                {layoutScore != null ? (
                  <>
                    <ScoreRing score={layoutScore} size={90} />
                    <p className="mt-1 text-[11px] text-white/30">
                      out of 100
                    </p>
                  </>
                ) : (
                  <div className="flex h-[90px] w-[90px] items-center justify-center rounded-full border border-white/[0.06]">
                    <span className="text-lg text-white/10">&mdash;</span>
                  </div>
                )}
              </section>

              {/* Issues */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Issues
                </h3>
                {layoutIssues.length === 0 ? (
                  <p className="text-[11px] text-white/20">
                    {floorPlanSvg
                      ? "No issues detected."
                      : "Generate a layout to see issues."}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {layoutIssues.map((issue, i) => {
                      const msg =
                        typeof issue === "string"
                          ? issue
                          : issue.message || issue.text || "";
                      const sev = issue.severity || "info";

                      return (
                        <div
                          key={i}
                          className="flex items-start gap-1.5 text-[11px]"
                        >
                          {severityIcon(sev)}
                          <span className="text-white/50">{msg}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Traffic Flow */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
                  <Move className="h-3.5 w-3.5" />
                  Traffic Flow
                </h3>
                {trafficNotes.length === 0 ? (
                  <p className="text-[11px] text-white/20">
                    {floorPlanSvg
                      ? "No traffic notes."
                      : "Generate a layout to see traffic flow."}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {trafficNotes.map((note, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1.5 text-[11px]"
                      >
                        <CheckCircle2 className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-400/50" />
                        <span className="text-white/50">
                          {typeof note === "string" ? note : note.message || note.text || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Divider */}
              <div className="border-t border-white/[0.06]" />

              {/* Quick Add */}
              <section>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddModalOpen(true)}
                  className="w-full justify-start text-xs text-white/40 hover:text-white/60"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Furniture
                </Button>
              </section>
            </div>
          )}
        </aside>
      </div>

      {/* ---- Add Furniture Modal ---- */}
      <AddFurnitureModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onAdd={addFurniturePiece}
      />
    </div>
  );
}
