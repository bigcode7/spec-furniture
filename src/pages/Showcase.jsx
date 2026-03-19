import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";
import {
  Sparkles, Eye, Heart, ArrowLeft,
  FolderKanban, Loader2, ImageOff, Check, Package, Users, Clock, ChevronRight, Palette
} from "lucide-react";
import AddToProjectMenu from "@/components/AddToProjectMenu";
import { toggleFavorite, getFavorites } from "@/lib/growth-store";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount || 0);
}

function formatRoomType(type) {
  return (type || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStyle(style) {
  return (style || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function anonymizeClient(name) {
  if (!name) return null;
  const first = name.trim().split(/\s+/)[0];
  return `${first} Project`;
}

function collectProductImages(project) {
  const images = [];
  for (const room of project.rooms || []) {
    for (const item of room.items || []) {
      if (item.selected_product?.image_url) {
        images.push(item.selected_product.image_url);
      }
    }
  }
  return images.slice(0, 8);
}

function countItems(project) {
  let total = 0;
  let sourced = 0;
  const vendors = new Set();
  const styles = new Set();
  for (const room of project.rooms || []) {
    for (const item of room.items || []) {
      total++;
      if (item.selected_product) {
        sourced++;
        if (item.selected_product.vendor) vendors.add(item.selected_product.vendor);
        if (item.selected_product.style) styles.add(item.selected_product.style);
      }
    }
  }
  return { total, sourced, vendors: vendors.size, styles: styles.size };
}

function computeBudgetUsed(project) {
  let used = 0;
  for (const room of project.rooms || []) {
    for (const item of room.items || []) {
      if (item.selected_product?.price) {
        used += item.selected_product.price * (item.quantity || 1);
      }
    }
  }
  return used;
}

const STATUS_CONFIG = {
  sourcing: { color: "bg-gold/10 text-gold/70 border-gold/20", label: "Needs Sourcing" },
  "options-ready": { color: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Options Ready" },
  selected: { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Selected" },
  ordered: { color: "bg-purple-500/20 text-purple-400 border-purple-500/30", label: "Ordered" },
  delivered: { color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Delivered" },
};

/* ========================================================================== */
/*  PROJECT CARD (Gallery)                                                     */
/* ========================================================================== */

function ProjectCard({ project, onClick }) {
  const images = collectProductImages(project);
  const stats = countItems(project);
  const budgetUsed = computeBudgetUsed(project);
  const budgetTotal = project.budget || 0;
  const budgetPct = budgetTotal > 0 ? Math.min((budgetUsed / budgetTotal) * 100, 100) : 0;
  const roomCount = (project.rooms || []).length;
  const coherence = stats.styles > 0 ? Math.round((1 / stats.styles) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.25 }}
      onClick={onClick}
      className="glass-surface rounded-2xl overflow-hidden cursor-pointer hover:border-white/[0.12] transition-colors"
    >
      {/* Image strip */}
      {images.length > 0 ? (
        <div className="flex overflow-x-auto gap-0 scrollbar-hide">
          {images.map((src, i) => (
            <ImageThumb key={i} src={src} />
          ))}
          {images.length === 0 && (
            <div className="w-full h-40 bg-white/[0.03] flex items-center justify-center">
              <ImageOff className="w-8 h-8 text-white/10" />
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-40 bg-white/[0.03] flex items-center justify-center">
          <ImageOff className="w-8 h-8 text-white/10" />
        </div>
      )}

      <div className="p-5">
        {/* Title row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3 className="text-lg font-display font-semibold text-white truncate">{project.name || project.title || "Untitled Project"}</h3>
            {project.client_name && (
              <p className="text-xs text-white/40 mt-0.5">{anonymizeClient(project.client_name)}</p>
            )}
          </div>
          {project.style && (
            <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold/70 border border-gold/20">
              {formatStyle(project.style)}
            </span>
          )}
        </div>

        {/* Room / item counts */}
        <div className="flex items-center gap-3 text-xs text-white/40 mb-4">
          <span className="flex items-center gap-1"><FolderKanban className="w-3.5 h-3.5" />{roomCount} room{roomCount !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" />{stats.total} item{stats.total !== 1 ? "s" : ""}</span>
        </div>

        {/* Budget bar */}
        {budgetTotal > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/60">{formatCurrency(budgetUsed)} used</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/60">{formatCurrency(budgetTotal)} budget</span>
            </div>
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all"
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="flex items-center gap-4 text-[11px] text-white/30 mb-4">
          <span className="flex items-center gap-1"><Check className="w-3 h-3" />{stats.sourced} sourced</span>
          <span className="flex items-center gap-1"><Palette className="w-3 h-3" />{coherence}% style coherence</span>
          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{stats.vendors} vendor{stats.vendors !== 1 ? "s" : ""}</span>
        </div>

        {/* CTA */}
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-1.5 text-sm text-gold hover:text-gold/70 transition-colors font-medium">
            View Project <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ImageThumb({ src }) {
  const [err, setErr] = useState(false);
  return (
    <div className="shrink-0 w-28 h-40 bg-white/[0.03]">
      {!err ? (
        <img src={src} alt="" className="w-full h-full object-cover" onError={() => setErr(true)} />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageOff className="w-5 h-5 text-white/10" />
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  PROJECT DETAIL VIEW                                                        */
/* ========================================================================== */

function ProjectDetailView({ projectId }) {
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${SEARCH_URL}/projects/${projectId}`)
      .then((r) => { if (!r.ok) throw new Error("Not found"); return r.json(); })
      .then((data) => { setProject(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [projectId]);

  const handleToggleFavorite = (product) => {
    const item = {
      id: product.id || product.name,
      name: product.name,
      image_url: product.image_url,
      vendor: product.vendor,
      price: product.price,
    };
    const { next } = toggleFavorite(item);
    setFavorites(next);
  };

  const isFav = (product) => {
    const pid = product.id || product.name;
    return favorites.some((f) => f.id === pid);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await fetch(`${SEARCH_URL}/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: true }),
      });
      setProject((prev) => ({ ...prev, published: true }));
    } catch {
      // silently fail
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setPublishing(true);
    try {
      await fetch(`${SEARCH_URL}/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: false }),
      });
      setProject((prev) => ({ ...prev, published: false }));
    } catch {
      // silently fail
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center gap-4">
        <p className="text-white/40">Project not found</p>
        <Link to={createPageUrl("Showcase")} className="text-gold hover:text-gold/70 flex items-center gap-1.5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Showcase
        </Link>
      </div>
    );
  }

  const budgetUsed = computeBudgetUsed(project);
  const budgetTotal = project.budget || 0;
  const stats = countItems(project);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Back */}
        <Link
          to={createPageUrl("Showcase")}
          className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Showcase
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-1">{project.name || project.title || "Untitled Project"}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/40">
              {project.client_name && <span>{anonymizeClient(project.client_name)}</span>}
              {project.style && (
                <span className="px-2 py-0.5 rounded-full bg-gold/10 text-gold/70 border border-gold/20 text-xs">
                  {formatStyle(project.style)}
                </span>
              )}
              {budgetTotal > 0 && <span>{formatCurrency(budgetUsed)} / {formatCurrency(budgetTotal)}</span>}
              {project.created_date && (
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(project.created_date).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          {/* Publish toggle */}
          <button
            onClick={project.published ? handleUnpublish : handlePublish}
            disabled={publishing}
            className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              project.published
                ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
                : "bg-white/[0.03] text-white/50 border border-white/[0.06] hover:bg-white/[0.06]"
            }`}
          >
            {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : project.published ? <Check className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {project.published ? "Published" : "Publish to Showcase"}
          </button>
        </div>

        {/* Stats bar */}
        <div className="glass-surface flex items-center gap-6 text-sm text-white/30 rounded-xl px-5 py-3 mb-8">
          <span className="flex items-center gap-1.5"><Package className="w-4 h-4" />{stats.sourced} / {stats.total} items sourced</span>
          <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{stats.vendors} vendor{stats.vendors !== 1 ? "s" : ""}</span>
          <span className="flex items-center gap-1.5"><FolderKanban className="w-4 h-4" />{(project.rooms || []).length} room{(project.rooms || []).length !== 1 ? "s" : ""}</span>
        </div>

        {/* Rooms */}
        {(project.rooms || []).map((room, ri) => {
          const materials = new Set();
          const colors = new Set();
          (room.items || []).forEach((item) => {
            if (item.selected_product?.material) materials.add(item.selected_product.material);
            if (item.selected_product?.color) colors.add(item.selected_product.color);
          });

          return (
            <motion.section
              key={room.id || ri}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ri * 0.05 }}
              className="mb-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-display font-semibold text-white">{formatRoomType(room.room_type || room.name || `Room ${ri + 1}`)}</h2>
                {(materials.size > 0 || colors.size > 0) && (
                  <div className="flex items-center gap-2">
                    {materials.size > 0 && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/60">Materials: {[...materials].join(", ")}</span>}
                    {colors.size > 0 && <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/60">Colors: {[...colors].join(", ")}</span>}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {(room.items || []).map((item, ii) => (
                  <ShowcaseItemCard
                    key={item.id || ii}
                    item={item}
                    onToggleFavorite={handleToggleFavorite}
                    isFav={isFav}
                  />
                ))}
              </div>

              {(room.items || []).length === 0 && (
                <p className="text-white/20 text-sm py-4">No items in this room yet.</p>
              )}
            </motion.section>
          );
        })}

        {(project.rooms || []).length === 0 && (
          <p className="text-white/20 text-center py-12">This project has no rooms yet.</p>
        )}

        {/* Bottom CTA */}
        <div className="mt-12 border-t border-white/[0.06] pt-8 text-center">
          <p className="text-white/40 mb-4">Inspired? Start your own project</p>
          <Link
            to={createPageUrl("ProjectIntake")}
            className="btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Start a New Project
          </Link>
        </div>
      </div>
    </div>
  );
}

function ShowcaseItemCard({ item, onToggleFavorite, isFav }) {
  const [imgErr, setImgErr] = useState(false);
  const product = item.selected_product;
  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.sourcing;

  return (
    <div className="glass-surface rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <h4 className="text-sm font-display font-medium text-white">{item.name}</h4>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {product ? (
        <div className="flex gap-3">
          <div className="w-20 h-20 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0 overflow-hidden">
            {product.image_url && !imgErr ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
            ) : (
              <ImageOff className="w-5 h-5 text-white/20" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-medium text-white truncate">{product.name}</p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/60 truncate">{product.vendor}</p>
            <p className="text-sm font-semibold text-white mt-1">{formatCurrency(product.price)}</p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => onToggleFavorite(product)}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                  isFav(product)
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-white/[0.03] text-white/40 border-white/[0.06] hover:text-white/60"
                }`}
              >
                <Heart className={`w-3 h-3 ${isFav(product) ? "fill-red-400" : ""}`} />
                {isFav(product) ? "Saved" : "Save"}
              </button>
              <AddToProjectMenu product={product} size="sm" />
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/20">No product selected yet</p>
      )}
    </div>
  );
}

/* ========================================================================== */
/*  MAIN SHOWCASE COMPONENT                                                    */
/* ========================================================================== */

export default function Showcase() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectParam = searchParams.get("project");

  if (projectParam) {
    return <ProjectDetailView projectId={projectParam} />;
  }

  return <ShowcaseGallery onSelectProject={(id) => setSearchParams({ project: id })} />;
}

function ShowcaseGallery({ onSelectProject }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${SEARCH_URL}/projects`)
      .then((r) => { if (!r.ok) throw new Error("Failed to load"); return r.json(); })
      .then((data) => {
        // Sort by most items sourced first (most "finished" projects on top)
        const sorted = (Array.isArray(data) ? data : data.projects || []).sort((a, b) => {
          const aStats = countItems(a);
          const bStats = countItems(b);
          return bStats.sourced - aStats.sourced;
        });
        setProjects(sorted);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const totalItems = projects.reduce((sum, p) => sum + countItems(p).sourced, 0);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2.5 mb-2">
            <Sparkles className="w-6 h-6 text-gold" />
            <h1 className="text-3xl font-display font-bold text-white">Showcase</h1>
          </div>
          <p className="section-copy text-sm max-w-xl">
            See how designers source with Spekd -- get inspired, save products, start your own project
          </p>
        </div>

        {/* Stats banner */}
        {!loading && projects.length > 0 && (
          <div className="glass-surface flex items-center gap-6 text-sm text-white/30 rounded-xl px-5 py-3 mb-8">
            <span className="flex items-center gap-1.5"><FolderKanban className="w-4 h-4" />{projects.length} published project{projects.length !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1.5"><Package className="w-4 h-4" />{totalItems} piece{totalItems !== 1 ? "s" : ""} sourced</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-24">
            <p className="text-white/30 text-sm">Could not load projects. Make sure the Spekd service is running.</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-24">
            <FolderKanban className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm mb-4">No published projects yet.</p>
            <Link
              to={createPageUrl("ProjectIntake")}
              className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Sparkles className="w-4 h-4" /> Start a Project
            </Link>
          </div>
        )}

        {/* Project grid */}
        {!loading && !error && projects.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onSelectProject(project.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
