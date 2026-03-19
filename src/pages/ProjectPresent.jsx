import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  DollarSign, Building2, CheckCircle, ImageOff, Loader2, Share2,
  FileText, ExternalLink, ArrowLeft, Copy, Send, Package,
  AlertTriangle, FolderKanban,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount || 0);
}

function formatRoomType(type) {
  return (type || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Room Budget Bar ──

function RoomBudgetBar({ room, totalBudget, roomCount }) {
  const items = room.items || [];
  const roomSpent = items.reduce((s, i) => {
    if (i.selected_product?.price) return s + i.selected_product.price * (i.quantity || 1);
    return s;
  }, 0);
  const roomBudget = totalBudget > 0 ? totalBudget / roomCount : 0;
  const pct = roomBudget > 0 ? (roomSpent / roomBudget) * 100 : 0;
  const overBudget = pct > 100;
  const sourcedCount = items.filter(i => i.selected_product).length;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-sm mb-1">
        <div className="flex items-center gap-2">
          <Building2 className="w-3.5 h-3.5 text-white/30" />
          <span className="text-white/70">{room.name || formatRoomType(room.type)}</span>
          <span className="text-white/30 text-xs">{sourcedCount}/{items.length} items</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={overBudget ? "text-red-400 font-medium" : "text-white/50"}>
            {formatCurrency(roomSpent)}
          </span>
          {roomBudget > 0 && (
            <span className="text-white/25 text-xs">/ {formatCurrency(roomBudget)}</span>
          )}
        </div>
      </div>
      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${overBudget ? "bg-red-400" : pct > 80 ? "bg-yellow-400" : "bg-gold"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

// ── Product Presentation Card ──

function PresentationProductCard({ item }) {
  const [imgError, setImgError] = useState(false);
  const product = item.selected_product;
  if (!product) return null;

  return (
    <div className="glass-surface rounded-xl overflow-hidden border border-white/[0.06] hover:border-gold/20 transition-all">
      <div className="aspect-[4/3] bg-white/[0.03] relative overflow-hidden">
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="w-8 h-8 text-white/15" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/70 font-medium">
            {item.name || item.category}
          </span>
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">{product.name}</p>
        <p className="text-xs text-white/40 mt-0.5">{product.vendor}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm font-semibold text-gold">{formatCurrency(product.price)}</span>
          {item.quantity > 1 && (
            <span className="text-xs text-white/30">x{item.quantity}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Project Selector (when no project param) ──

function ProjectSelector() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${SEARCH_URL}/projects`)
      .then(r => r.json())
      .then(data => { setProjects(data.projects || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10">
      <div className="max-w-3xl mx-auto px-6">
        <h1 className="text-2xl font-display font-bold text-white mb-2">Present a Project</h1>
        <p className="text-white/40 mb-8">Select a project to view its presentation and budget overview.</p>

        {projects.length === 0 ? (
          <div className="text-center py-16 glass-surface rounded-xl">
            <FolderKanban className="w-10 h-10 text-white/15 mx-auto mb-3" />
            <p className="text-white/40 mb-4">No projects yet.</p>
            <Link to="/Projects?tab=intake">
              <Button className="btn-gold">Create a Project</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(p => (
              <a
                key={p.id}
                href={`/Projects?tab=present&project=${p.id}`}
                className="block glass-surface rounded-xl p-5 border border-white/[0.06] hover:border-gold/20 transition-colors"
              >
                <h3 className="text-white font-medium">{p.name}</h3>
                <p className="text-sm text-white/30 mt-1">
                  {p.client_name && `${p.client_name} · `}
                  {p.room_count || 0} rooms
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Present View ──

export default function ProjectPresent() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setProject(data.project || data);
    } catch { /* */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchProject(); }, [fetchProject]);

  if (!projectId) return <ProjectSelector />;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/50">
        Project not found.
      </div>
    );
  }

  const rooms = project.rooms || [];
  const budgetTotal = typeof project.budget === "object" ? project.budget?.total : project.budget;
  const totalSpent = rooms.reduce((total, room) => {
    return total + (room.items || []).reduce((s, i) => {
      if (i.selected_product?.price) return s + i.selected_product.price * (i.quantity || 1);
      return s;
    }, 0);
  }, 0);
  const totalItems = rooms.reduce((s, r) => s + (r.items?.length || 0), 0);
  const sourcedItems = rooms.reduce((s, r) => s + (r.items || []).filter(i => i.selected_product).length, 0);
  const remaining = (budgetTotal || 0) - totalSpent;

  const handleShare = async () => {
    setShareLoading(true);
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      const token = data.share_token || data.token;
      const link = `${window.location.origin}${createPageUrl("ClientPortal")}?token=${token}`;
      setShareLink(link);
      navigator.clipboard?.writeText(link);
    } catch { /* */ }
    setShareLoading(false);
  };

  const handleCopySpec = async () => {
    const lines = [
      `PROJECT: ${project.name}`,
      project.client_name ? `CLIENT: ${project.client_name}` : "",
      project.style ? `STYLE: ${project.style.replace(/-/g, " ")}` : "",
      budgetTotal ? `BUDGET: ${formatCurrency(budgetTotal)}` : "",
      `TOTAL SPENT: ${formatCurrency(totalSpent)}`,
      "",
    ];

    for (const room of rooms) {
      lines.push(`── ${(room.name || formatRoomType(room.type)).toUpperCase()} ──`);
      for (const item of (room.items || [])) {
        if (item.selected_product) {
          const p = item.selected_product;
          lines.push(`  ${item.name}: ${p.name} by ${p.vendor} — ${formatCurrency(p.price)}${item.quantity > 1 ? ` x${item.quantity}` : ""}`);
        } else {
          lines.push(`  ${item.name}: [not yet sourced]`);
        }
      }
      lines.push("");
    }

    await navigator.clipboard.writeText(lines.filter(l => l !== undefined).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-6 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to={`/Projects?tab=sourcing&project=${projectId}`} className="flex items-center gap-1.5 text-sm text-white/30 hover:text-gold mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sourcing Board
            </Link>
            <h1 className="text-2xl font-display font-bold text-white">{project.name}</h1>
            <p className="text-white/40 text-sm mt-1">
              {project.client_name && `${project.client_name} · `}
              {sourcedItems}/{totalItems} items sourced
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySpec}
              className="border-white/[0.06] text-white/50 hover:text-white gap-1.5 text-xs"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy Spec Sheet"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              disabled={shareLoading}
              className="border-white/[0.06] text-white/50 hover:text-white gap-1.5 text-xs"
            >
              {shareLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
              Share with Client
            </Button>
          </div>
        </div>

        {/* Share link */}
        {shareLink && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-sm text-emerald-400 truncate flex-1">Client link copied: {shareLink}</span>
            <button onClick={() => setShareLink(null)} className="text-white/30 hover:text-white/60">
              <span className="text-xs">Dismiss</span>
            </button>
          </motion.div>
        )}

        {/* ── Budget Overview ── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-surface rounded-xl p-5"
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-1">Total Budget</div>
            <div className="text-2xl font-display font-bold text-white">{formatCurrency(budgetTotal)}</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-surface rounded-xl p-5"
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-1">Spent So Far</div>
            <div className="text-2xl font-display font-bold text-gold">{formatCurrency(totalSpent)}</div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`glass-surface rounded-xl p-5 ${remaining < 0 ? "border-red-500/20" : "border-emerald-500/10"}`}
          >
            <div className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-1">Remaining</div>
            <div className={`text-2xl font-display font-bold ${remaining >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {remaining >= 0 ? formatCurrency(remaining) : `-${formatCurrency(Math.abs(remaining))}`}
            </div>
            {remaining < 0 && (
              <div className="flex items-center gap-1 mt-1 text-xs text-red-400">
                <AlertTriangle className="w-3 h-3" /> Over budget
              </div>
            )}
          </motion.div>
        </div>

        {/* Per-room budget breakdown */}
        {rooms.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-surface rounded-xl p-5 mb-8"
          >
            <h2 className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-4">Budget by Room</h2>
            {rooms.map((room, i) => (
              <RoomBudgetBar key={room.id || i} room={room} totalBudget={budgetTotal || 0} roomCount={rooms.length} />
            ))}
          </motion.div>
        )}

        {/* ── Visual Presentation by Room ── */}
        {rooms.map((room, ri) => {
          const sourcedInRoom = (room.items || []).filter(i => i.selected_product);
          if (sourcedInRoom.length === 0) return null;

          return (
            <motion.div
              key={room.id || ri}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + ri * 0.1 }}
              className="mb-8"
            >
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-4 h-4 text-gold" />
                <h2 className="text-lg font-display font-semibold text-white">
                  {room.name || formatRoomType(room.type)}
                </h2>
                <span className="text-sm text-white/30">
                  {sourcedInRoom.length} of {(room.items || []).length} items
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {sourcedInRoom.map((item) => (
                  <PresentationProductCard key={item.id} item={item} />
                ))}
              </div>
            </motion.div>
          );
        })}

        {/* Unsourced items warning */}
        {sourcedItems < totalItems && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 glass-surface rounded-xl border border-amber-500/10 mb-8"
          >
            <Package className="w-8 h-8 text-amber-400/50 mx-auto mb-2" />
            <p className="text-white/40 text-sm">
              {totalItems - sourcedItems} items still need to be sourced before presenting.
            </p>
            <Link to={`/Projects?tab=sourcing&project=${projectId}`}>
              <Button variant="outline" size="sm" className="mt-3 border-white/[0.06] text-white/50 hover:text-gold gap-1.5 text-xs">
                <ArrowLeft className="w-3 h-3" /> Back to Sourcing Board
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
