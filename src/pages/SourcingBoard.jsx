import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  FolderKanban, Package, CheckCircle, Search, ImageOff, X, Sparkles, Building2,
  Plus, Loader2, Users, Palette, DollarSign, ArrowRight, ExternalLink,
  RefreshCw, Trash2, ChevronDown, ChevronUp, Send, MessageSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount || 0);
}

function formatRoomType(type) {
  return (type || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Product Slot: Empty State ──

function EmptyProductSlot({ item, projectId, roomId, projectStyle, onUpdate }) {
  const [loading, setLoading] = useState(false);

  const searchQuery = encodeURIComponent(
    `${projectStyle || ""} ${item.name || item.category || ""}`.trim()
  );

  const handleAutoSource = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SEARCH_URL}/projects/${projectId}/rooms/${roomId}/auto-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id }),
      });
      if (res.ok) onUpdate();
    } catch { /* */ }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative rounded-xl border-2 border-dashed border-white/[0.06] hover:border-gold/30 bg-white/[0.02] hover:bg-gold/[0.03] transition-all overflow-hidden"
    >
      <div className="aspect-square flex flex-col items-center justify-center p-4 text-center">
        <div className="w-10 h-10 rounded-xl bg-white/[0.04] group-hover:bg-gold/10 flex items-center justify-center mb-3 transition-colors">
          <Plus className="w-5 h-5 text-white/20 group-hover:text-gold transition-colors" />
        </div>
        <p className="text-sm font-medium text-white/40 group-hover:text-white/70 transition-colors mb-0.5">
          {item.name || item.category || "Item"}
        </p>
        {item.quantity > 1 && (
          <p className="text-[10px] text-white/25">Qty: {item.quantity}</p>
        )}
      </div>

      {/* Action buttons on hover */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-[#08090E]/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1.5">
          <Link
            to={`${createPageUrl("Search")}?q=${searchQuery}`}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gold/20 hover:bg-gold/30 text-gold text-xs font-medium transition-colors"
          >
            <Search className="w-3 h-3" />
            Find pieces
          </Link>
          <button
            onClick={handleAutoSource}
            disabled={loading}
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/50 text-xs transition-colors"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Product Slot: Filled State ──

function FilledProductSlot({ item, projectId, roomId, onUpdate }) {
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const product = item.selected_product;

  const handleRemove = async () => {
    try {
      await fetch(`${SEARCH_URL}/projects/${projectId}/rooms/${roomId}/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_product: null, status: "sourcing" }),
      });
      onUpdate();
    } catch { /* */ }
  };

  const handleFindSimilar = () => {
    const q = encodeURIComponent(product.name || item.name);
    window.location.href = `${createPageUrl("Search")}?q=${q}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative rounded-xl border border-gold/20 bg-gold/[0.03] overflow-hidden transition-all hover:border-gold/40"
    >
      {/* Product image */}
      <div className="aspect-square bg-white/[0.03] relative overflow-hidden">
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

        {/* Gold selected indicator */}
        <div className="absolute top-2 right-2">
          <div className="w-6 h-6 rounded-full bg-gold/90 flex items-center justify-center shadow-lg">
            <CheckCircle className="w-3.5 h-3.5 text-black" />
          </div>
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={handleFindSimilar}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3 h-3 inline mr-1" />
            Swap
          </button>
          <button
            onClick={handleRemove}
            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/30 text-white text-xs font-medium transition-colors"
          >
            <Trash2 className="w-3 h-3 inline mr-1" />
            Remove
          </button>
          {product.portal_url && (
            <a
              href={product.portal_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Product info */}
      <div className="p-3">
        <p className="text-sm font-medium text-white truncate">{product.name}</p>
        <p className="text-xs text-white/40 truncate">{product.vendor}</p>
        <p className="text-sm font-semibold text-gold mt-1">{product.price > 0 ? formatCurrency(product.price) : "Price on request"}</p>
      </div>

      {/* Category label */}
      <div className="absolute top-2 left-2">
        <span className="px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm text-[10px] text-white/60 font-medium">
          {item.name || item.category}
        </span>
      </div>
    </motion.div>
  );
}

// ── Room Section ──

function RoomSection({ room, projectId, projectStyle, onUpdate, defaultExpanded }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const items = room.items || [];
  const sourcedCount = items.filter(i => i.selected_product).length;
  const totalItems = items.length;
  const progress = totalItems > 0 ? (sourcedCount / totalItems) * 100 : 0;
  const [autoSourcing, setAutoSourcing] = useState(false);

  const handleAutoSourceAll = async () => {
    setAutoSourcing(true);
    try {
      await fetch(`${SEARCH_URL}/projects/${projectId}/rooms/${room.id}/auto-source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      onUpdate();
    } catch { /* */ }
    setAutoSourcing(false);
  };

  return (
    <div className="mb-6">
      {/* Room header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 rounded-xl glass-surface hover:bg-white/[0.04] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center">
            <Building2 className="w-4.5 h-4.5 text-gold" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-display font-semibold text-white">
              {room.name || formatRoomType(room.type)}
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              {sourcedCount} of {totalItems} items sourced
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-32 hidden sm:block">
            <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${progress === 100 ? "bg-emerald-400" : "bg-gold"}`}
              />
            </div>
          </div>

          <Badge variant="outline" className={`text-xs px-2 py-0.5 ${
            progress === 100 ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
            progress > 50 ? "bg-gold/10 text-gold border-gold/20" :
            "bg-white/[0.05] text-white/40 border-white/[0.06]"
          }`}>
            {Math.round(progress)}%
          </Badge>

          {expanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>

      {/* Room content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-4 px-1">
              {/* Auto-source button for unsourced rooms */}
              {sourcedCount < totalItems && (
                <div className="mb-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAutoSourceAll}
                    disabled={autoSourcing}
                    className="border-white/[0.06] text-white/50 hover:text-gold hover:border-gold/30 gap-1.5 text-xs"
                  >
                    {autoSourcing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Auto-Source Remaining
                  </Button>
                </div>
              )}

              {/* Product slot grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {items.map((item) => (
                  item.selected_product ? (
                    <FilledProductSlot
                      key={item.id}
                      item={item}
                      projectId={projectId}
                      roomId={room.id}
                      onUpdate={onUpdate}
                    />
                  ) : (
                    <EmptyProductSlot
                      key={item.id}
                      item={item}
                      projectId={projectId}
                      roomId={room.id}
                      projectStyle={projectStyle}
                      onUpdate={onUpdate}
                    />
                  )
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── AI Chat Sidebar ──

function AIChatSidebar({ project, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const suggestions = [
    "What coffee tables would pair with my sofa?",
    "I'm over budget — suggest cheaper swaps",
    `Show me ${project?.style?.replace(/-/g, " ") || "modern"} accent chairs`,
    "What am I still missing?",
  ];

  const handleSend = async (text) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const res = await fetch(`${SEARCH_URL}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: {
            project_id: project?.id,
            project_name: project?.name,
            style: project?.style,
            budget: project?.budget,
            rooms: project?.rooms?.map(r => ({
              type: r.type,
              items: r.items?.map(i => ({
                name: i.name,
                selected: i.selected_product?.name,
                vendor: i.selected_product?.vendor,
              })),
            })),
          },
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "ai", text: data.response || data.message || "I can help you with that." }]);
    } catch {
      setMessages(prev => [...prev, { role: "ai", text: "Sorry, I couldn't process that request." }]);
    }
    setLoading(false);
  };

  return (
    <div className="w-80 border-l border-white/[0.06] bg-white/[0.02] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-gold" />
          <span className="text-sm font-medium text-white">AI Assistant</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/[0.05] text-white/30 hover:text-white/60">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <p className="text-xs text-white/30 mb-3">Try asking:</p>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="w-full text-left text-xs p-2.5 rounded-lg border border-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.04] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`text-sm ${msg.role === "user" ? "text-right" : ""}`}>
            <div className={`inline-block max-w-[90%] px-3 py-2 rounded-xl ${
              msg.role === "user"
                ? "bg-gold/20 text-gold/90"
                : "bg-white/[0.04] text-white/70 border border-white/[0.06]"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-white/30 text-sm">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask about your project..."
            className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-gold/30"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="px-3 py-2 rounded-lg bg-gold/20 hover:bg-gold/30 text-gold disabled:opacity-30 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Project List View (when no project selected) ──

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
          <Link to="/Projects?tab=intake">
            <Button className="btn-gold gap-2">
              <Sparkles className="w-4 h-4" />
              New Project
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <FolderKanban className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h2 className="text-lg font-display font-medium text-white/50 mb-2">No projects yet</h2>
            <p className="text-sm text-white/25 mb-6">Start by describing your project. AI builds the sourcing plan.</p>
            <Link to="/Projects?tab=intake">
              <Button className="btn-gold gap-2">
                <Sparkles className="w-4 h-4" />
                Create First Project
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((proj) => {
              const totalItems = proj.item_count || 0;
              const sourcedItems = proj.rooms?.reduce((s, r) => s + (r.items || []).filter(i => i.selected_product).length, 0) || 0;
              const progress = totalItems > 0 ? Math.round((sourcedItems / totalItems) * 100) : 0;

              return (
                <a
                  key={proj.id}
                  href={`/Projects?tab=sourcing&project=${proj.id}`}
                  className="block border border-white/[0.06] glass-surface rounded-xl p-5 hover:bg-white/[0.04] hover:border-gold/20 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-medium">{proj.name}</h3>
                      <p className="text-sm text-white/30 mt-1">
                        {proj.client_name && `${proj.client_name} · `}
                        {proj.room_count || 0} rooms · {totalItems} items
                        {proj.style && ` · ${proj.style.replace(/-/g, " ")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-medium text-gold">{progress}%</span>
                        <div className="w-20 h-1.5 bg-white/[0.06] rounded-full mt-1">
                          <div className={`h-full rounded-full ${progress === 100 ? "bg-emerald-400" : "bg-gold"}`} style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-white/20" />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Sourcing Board ──

export default function SourcingBoard() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showChat, setShowChat] = useState(false);

  const fetchProject = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
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

  useEffect(() => { fetchProject(); }, [fetchProject]);

  if (!projectId) return <ProjectListView />;

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
          <Package className="w-10 h-10 text-red-400/50 mx-auto mb-4" />
          <p className="text-white/60 mb-4">{error || "Project not found"}</p>
          <Link to="/Projects?tab=intake">
            <Button className="btn-gold">New Project</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Compute stats
  const rooms = project.rooms || [];
  const totalItems = rooms.reduce((s, r) => s + (r.items?.length || 0), 0);
  const sourcedItems = rooms.reduce((s, r) => s + (r.items || []).filter(i => i.selected_product).length, 0);
  const overallProgress = totalItems > 0 ? Math.round((sourcedItems / totalItems) * 100) : 0;
  const budgetTotal = typeof project.budget === "object" ? project.budget?.total : project.budget;
  const budgetUsed = rooms.reduce((total, room) => {
    return total + (room.items || []).reduce((roomTotal, item) => {
      if (item.selected_product?.price) return roomTotal + item.selected_product.price * (item.quantity || 1);
      return roomTotal;
    }, 0);
  }, 0);

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">

          {/* ── Project Summary Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-gold/20 bg-gold/[0.03] p-5 mb-6"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-xl font-display font-bold text-white">{project.name}</h1>
                  <Badge variant="outline" className="bg-gold/10 text-gold border-gold/20 text-xs">
                    {overallProgress}% sourced
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/40">
                  {project.client_name && (
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> {project.client_name}
                    </span>
                  )}
                  {project.style && (
                    <span className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5" /> {project.style.replace(/-/g, " ")}
                    </span>
                  )}
                  {budgetTotal > 0 && (
                    <span className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" />
                      {formatCurrency(budgetUsed)} / {formatCurrency(budgetTotal)}
                      {budgetUsed > budgetTotal && (
                        <span className="text-red-400 text-xs font-medium ml-1">Over budget</span>
                      )}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> {rooms.length} rooms · {totalItems} items
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                  className={`border-white/[0.06] text-xs gap-1.5 ${showChat ? "text-gold border-gold/20 bg-gold/10" : "text-white/50 hover:text-white"}`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  AI Assist
                </Button>
                <Link to={`/Projects?tab=present&project=${projectId}`}>
                  <Button size="sm" className="btn-gold text-xs gap-1.5">
                    <Send className="w-3.5 h-3.5" />
                    Present
                  </Button>
                </Link>
              </div>
            </div>

            {/* Overall progress bar */}
            {totalItems > 0 && (
              <div className="mt-4">
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${overallProgress === 100 ? "bg-emerald-400" : "bg-gold"}`}
                  />
                </div>
              </div>
            )}
          </motion.div>

          {/* ── Room-by-Room Product Board ── */}
          {rooms.length > 0 ? (
            rooms.map((room, i) => (
              <RoomSection
                key={room.id || i}
                room={room}
                projectId={projectId}
                projectStyle={project.style}
                onUpdate={fetchProject}
                defaultExpanded={i === 0}
              />
            ))
          ) : (
            <div className="text-center py-20">
              <Building2 className="w-10 h-10 text-white/15 mx-auto mb-3" />
              <p className="text-white/40 mb-4">No rooms in this project yet.</p>
              <Link to="/Projects?tab=intake">
                <Button variant="outline" className="border-white/[0.06] text-white/50 hover:text-gold">
                  Go back to Intake
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── AI Chat Sidebar ── */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <AIChatSidebar project={project} onClose={() => setShowChat(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
