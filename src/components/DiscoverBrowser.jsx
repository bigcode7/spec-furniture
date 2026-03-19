import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Camera, Upload, X, Loader2, Sparkles,
  GitCompare, Check, Layers, Grid3X3, Image as ImageIcon,
  Palette, Brush, Sofa, Utensils, Bed, Monitor, TreePine, DoorOpen,
  Heart, ArrowRight, RefreshCw
} from "lucide-react";
import { toggleCompareItem, normalizeSearchResult, getCompareItems, toggleFavorite, getFavorites, trackStyleInteraction } from "@/lib/growth-store";
import AddToProjectMenu from "@/components/AddToProjectMenu";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

const COLOR_PALETTES = [
  { id: "warm-neutrals", name: "Warm Neutrals", colors: ["#D4C5A9","#E8DCC8","#C2A878","#D2B48C"], desc: "Beige, cream, tan, camel" },
  { id: "cool-neutrals", name: "Cool Neutrals", colors: ["#808080","#36454F","#708090","#C0C0C0"], desc: "Gray, charcoal, slate, silver" },
  { id: "earth-tones", name: "Earth Tones", colors: ["#CC6633","#B7410E","#6B8E23","#9DC183"], desc: "Terracotta, rust, olive, sage" },
  { id: "jewel-tones", name: "Jewel Tones", colors: ["#046307","#000080","#800020","#673147"], desc: "Emerald, navy, burgundy, plum" },
  { id: "pastels", name: "Pastels", colors: ["#DE98AB","#B0C4DE","#B57EDC","#98FB98"], desc: "Blush, powder blue, lavender, mint" },
  { id: "monochromes", name: "Monochromes", colors: ["#1A1A1A","#FAFAFA","#FFFFF0","#3C1414"], desc: "Black, white, ivory, espresso" },
];

const TEXTURES = [
  { id: "smooth-polished", name: "Smooth & Polished", materials: "Leather, marble, lacquer, glass", gradient: "from-slate-400 to-slate-600" },
  { id: "soft-plush", name: "Soft & Plush", materials: "Velvet, boucle, chenille, mohair", gradient: "from-indigo-300 to-purple-400" },
  { id: "natural-organic", name: "Natural & Organic", materials: "Linen, rattan, raw wood, jute", gradient: "from-green-300 to-emerald-500" },
  { id: "woven-tactile", name: "Woven & Tactile", materials: "Cane, wicker, rope, performance fabric", gradient: "from-amber-300 to-orange-500" },
];

const VIBES = [
  { id: "clean-quiet", name: "Clean & Quiet", desc: "Minimal, Scandinavian, Japanese", gradient: "from-gray-100 to-stone-200" },
  { id: "warm-collected", name: "Warm & Collected", desc: "Transitional, layered, lived-in", gradient: "from-amber-100 to-orange-200" },
  { id: "bold-dramatic", name: "Bold & Dramatic", desc: "Glam, jewel tones, high contrast", gradient: "from-purple-200 to-rose-200" },
  { id: "coastal-relaxed", name: "Coastal & Relaxed", desc: "Light, airy, natural materials", gradient: "from-sky-100 to-teal-100" },
  { id: "heritage-classic", name: "Heritage & Classic", desc: "Traditional, English, European", gradient: "from-amber-200 to-yellow-100" },
];

const ROOM_TYPES = [
  { id: "living-room", name: "Living Room", icon: Sofa },
  { id: "dining-room", name: "Dining Room", icon: Utensils },
  { id: "bedroom", name: "Bedroom", icon: Bed },
  { id: "office", name: "Office", icon: Monitor },
  { id: "outdoor", name: "Outdoor", icon: TreePine },
  { id: "entryway", name: "Entryway", icon: DoorOpen },
];

function ProductCard({ product, compareItems, favorites, onToggleCompare, onToggleFavorite, onFindSimilar }) {
  const navigate = useNavigate();
  const isCompared = compareItems.some(c => c.id === product.id);
  const isFavorited = favorites.some(f => f.id === product.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="break-inside-avoid mb-3 group relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] cursor-pointer"
      onClick={() => navigate(createPageUrl("Search") + `?q=${encodeURIComponent(product.product_name || product.name || "")}`)}
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.product_name || product.name || "Product"}
          className="w-full object-cover"
          style={{ minHeight: 160 }}
          loading="lazy"
          onError={(e) => { e.target.style.display = "none"; }}
        />
      ) : (
        <div className="w-full flex items-center justify-center bg-white/[0.04]" style={{ minHeight: 200 }}>
          <ImageIcon className="w-10 h-10 text-white/20" />
        </div>
      )}

      {/* Always-visible product info */}
      <div className="p-2.5">
        <p className="text-xs text-white/70 font-medium line-clamp-1">{product.product_name || product.name}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[10px] text-white/30 truncate">{product.manufacturer_name || ""}</p>
          {(product.retail_price || product.wholesale_price) ? (
            <span className="text-xs font-semibold text-white/60 shrink-0 ml-2">
              ${(product.retail_price || product.wholesale_price || 0).toLocaleString()}
            </span>
          ) : null}
        </div>
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
        <p className="text-sm text-white font-medium line-clamp-2">{product.product_name || product.name}</p>
        {product.manufacturer_name && (
          <p className="text-xs text-white/50 mt-0.5">{product.manufacturer_name}</p>
        )}
        {(product.retail_price || product.wholesale_price) && (
          <p className="text-sm text-white font-semibold mt-1">
            ${(product.retail_price || product.wholesale_price || 0).toLocaleString()}
          </p>
        )}

        <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleCompare(product)}
            className={`p-1.5 rounded-lg transition-colors ${isCompared ? "bg-gold/80 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
            title="Compare"
          >
            {isCompared ? <Check className="w-3.5 h-3.5" /> : <GitCompare className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onToggleFavorite(product)}
            className={`p-1.5 rounded-lg transition-colors ${isFavorited ? "bg-rose-500/80 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
            title="Favorite"
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorited ? "fill-current" : ""}`} />
          </button>
          <AddToProjectMenu product={product} size="sm" />
          <button
            onClick={() => onFindSimilar(product)}
            className="p-1.5 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
            title="Find Similar"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function DiscoverBrowser() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const [mode, setMode] = useState("mood");
  const [selectedColors, setSelectedColors] = useState([]);
  const [selectedTextures, setSelectedTextures] = useState([]);
  const [selectedVibes, setSelectedVibes] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [compareItems, setCompareItems] = useState([]);
  const [favorites, setFavorites] = useState([]);

  // Photo mode
  const [uploadedImage, setUploadedImage] = useState(null);
  const [photoResults, setPhotoResults] = useState([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoAnalysis, setPhotoAnalysis] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setCompareItems(getCompareItems());
    setFavorites(getFavorites());
  }, []);

  const hasSelections = selectedColors.length > 0 || selectedTextures.length > 0 || selectedVibes.length > 0 || selectedRoom;

  const handleDiscover = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`${SEARCH_URL}/discover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          colors: selectedColors,
          textures: selectedTextures,
          vibes: selectedVibes,
          room_type: selectedRoom,
          page: pageNum,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (pageNum === 1) {
          setResults(data.products || []);
        } else {
          setResults(prev => [...prev, ...(data.products || [])]);
        }
        setTotal(data.total || 0);
        setHasMore(data.has_more || false);
        setPage(pageNum);
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, [selectedColors, selectedTextures, selectedVibes, selectedRoom]);

  const handlePhotoUpload = useCallback(async (file) => {
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      setUploadedImage(base64);
      setPhotoLoading(true);
      setPhotoResults([]);
      setPhotoAnalysis(null);

      try {
        const res = await fetch(`${SEARCH_URL}/visual-search`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ image: base64 }),
        });
        if (res.ok) {
          const data = await res.json();
          setPhotoResults(data.products || data.results || []);
          setPhotoAnalysis(data.analysis || null);
        }
      } catch {
        // silently fail
      }
      setPhotoLoading(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDetailedAnalysis = useCallback(async () => {
    if (!uploadedImage) return;
    setPhotoLoading(true);
    try {
      const res = await fetch(`${SEARCH_URL}/visual-search`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: uploadedImage, detailed: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setPhotoResults(data.products || data.results || []);
        setPhotoAnalysis(data.analysis || null);
      }
    } catch {
      // silently fail
    }
    setPhotoLoading(false);
  }, [uploadedImage]);

  const handleToggleCompare = useCallback((product) => {
    const normalized = normalizeSearchResult(product);
    const { next } = toggleCompareItem(normalized);
    setCompareItems(next);
    trackStyleInteraction(product.id, "compare");
  }, []);

  const handleToggleFavorite = useCallback((product) => {
    const normalized = normalizeSearchResult(product);
    const { next } = toggleFavorite(normalized);
    setFavorites(next);
    trackStyleInteraction(product.id, "favorite");
  }, []);

  const handleFindSimilar = useCallback((product) => {
    const name = product.product_name || product.name || "";
    navigate(createPageUrl("Search") + `?q=${encodeURIComponent(name)}`);
  }, [navigate]);

  const toggleColor = (id) => {
    setSelectedColors(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };
  const toggleTexture = (id) => {
    setSelectedTextures(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };
  const toggleVibe = (id) => {
    setSelectedVibes(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  };
  const toggleRoom = (id) => {
    setSelectedRoom(prev => prev === id ? null : id);
  };

  const removeSelection = (type, id) => {
    if (type === "color") setSelectedColors(prev => prev.filter(c => c !== id));
    if (type === "texture") setSelectedTextures(prev => prev.filter(t => t !== id));
    if (type === "vibe") setSelectedVibes(prev => prev.filter(v => v !== id));
    if (type === "room") setSelectedRoom(null);
  };

  const allSelections = [
    ...selectedColors.map(id => ({ type: "color", id, label: COLOR_PALETTES.find(c => c.id === id)?.name })),
    ...selectedTextures.map(id => ({ type: "texture", id, label: TEXTURES.find(t => t.id === id)?.name })),
    ...selectedVibes.map(id => ({ type: "vibe", id, label: VIBES.find(v => v.id === id)?.name })),
    ...(selectedRoom ? [{ type: "room", id: selectedRoom, label: ROOM_TYPES.find(r => r.id === selectedRoom)?.name }] : []),
  ];

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handlePhotoUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const currentResults = mode === "mood" ? results : photoResults;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-6 h-6 text-gold" />
          <h1 className="text-3xl font-display font-bold tracking-tight">Discover</h1>
        </div>
        <p className="text-white/50 text-lg">
          Find furniture the way your brain works -- by color, texture, and vibe
        </p>
      </motion.div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={() => setMode("mood")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            mode === "mood"
              ? "btn-gold text-white"
              : "bg-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.1]"
          }`}
        >
          <span className="flex items-center gap-2">
            <Grid3X3 className="w-4 h-4" />
            Mood Board
          </span>
        </button>
        <button
          onClick={() => setMode("photo")}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
            mode === "photo"
              ? "btn-gold text-white"
              : "bg-white/[0.06] text-white/50 hover:text-white/80 hover:bg-white/[0.1]"
          }`}
        >
          <span className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Photo Search
          </span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {mode === "mood" ? (
          <motion.div
            key="mood"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* ROW 1: COLOR PALETTE */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Color Palette
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {COLOR_PALETTES.map((palette) => {
                  const selected = selectedColors.includes(palette.id);
                  return (
                    <button
                      key={palette.id}
                      onClick={() => toggleColor(palette.id)}
                      className={`rounded-xl p-3 border transition-all duration-200 text-left ${
                        selected
                          ? "border-gold ring-2 ring-gold/40 bg-gold/[0.08] scale-[1.02]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className="flex items-center gap-1 mb-2">
                        {palette.colors.map((color, i) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full border border-white/[0.06]"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <p className="text-xs font-medium text-white/80">{palette.name}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{palette.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ROW 2: TEXTURE */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Brush className="w-4 h-4" />
                Texture
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TEXTURES.map((texture) => {
                  const selected = selectedTextures.includes(texture.id);
                  return (
                    <button
                      key={texture.id}
                      onClick={() => toggleTexture(texture.id)}
                      className={`rounded-xl p-4 border transition-all duration-200 text-left ${
                        selected
                          ? "border-gold ring-2 ring-gold/40 scale-[1.02]"
                          : "border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className={`w-full h-8 rounded-lg bg-gradient-to-r ${texture.gradient} opacity-60 mb-3`} />
                      <p className="text-sm font-medium text-white/80">{texture.name}</p>
                      <p className="text-[11px] text-white/30 mt-1">{texture.materials}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ROW 3: VIBE */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Vibe
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {VIBES.map((vibe) => {
                  const selected = selectedVibes.includes(vibe.id);
                  return (
                    <button
                      key={vibe.id}
                      onClick={() => toggleVibe(vibe.id)}
                      className={`rounded-xl border transition-all duration-200 text-left overflow-hidden ${
                        selected
                          ? "border-gold ring-2 ring-gold/40 scale-[1.02]"
                          : "border-white/[0.06] hover:border-white/[0.12]"
                      }`}
                    >
                      <div className={`h-3 bg-gradient-to-r ${vibe.gradient}`} />
                      <div className="p-3">
                        <p className="text-sm font-medium text-white/80">{vibe.name}</p>
                        <p className="text-[11px] text-white/30 mt-0.5">{vibe.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ROW 4: ROOM TYPE */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Room Type
              </h3>
              <div className="flex flex-wrap gap-2">
                {ROOM_TYPES.map((room) => {
                  const IconComp = room.icon;
                  const selected = selectedRoom === room.id;
                  return (
                    <button
                      key={room.id}
                      onClick={() => toggleRoom(room.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        selected
                          ? "btn-gold text-white ring-2 ring-gold/40"
                          : "bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white/80"
                      }`}
                    >
                      <IconComp className="w-4 h-4" />
                      {room.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Selections & Discover Button */}
            <div className="mb-8">
              {allSelections.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {allSelections.map((sel) => (
                    <span
                      key={`${sel.type}-${sel.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/10 text-gold/70 text-xs border border-gold/20"
                    >
                      {sel.label}
                      <button
                        onClick={() => removeSelection(sel.type, sel.id)}
                        className="hover:text-white transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedColors([]);
                      setSelectedTextures([]);
                      setSelectedVibes([]);
                      setSelectedRoom(null);
                      setResults([]);
                      setTotal(0);
                    }}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Clear all
                  </button>
                </div>
              )}

              <button
                onClick={() => handleDiscover(1)}
                disabled={!hasSelections || loading}
                className={`px-8 py-3 rounded-xl font-medium text-sm transition-all duration-200 flex items-center gap-2 ${
                  hasSelections && !loading
                    ? "btn-gold text-white shadow-lg shadow-gold/20"
                    : "bg-white/[0.06] text-white/20 cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Discovering...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Discover
                  </>
                )}
              </button>

              {total > 0 && !loading && (
                <p className="text-sm text-white/30 mt-3">
                  {total.toLocaleString()} products found
                </p>
              )}
            </div>

            {/* Mood Board Results */}
            {results.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
                  {results.map((product, idx) => (
                    <ProductCard
                      key={product.id || idx}
                      product={product}
                      compareItems={compareItems}
                      favorites={favorites}
                      onToggleCompare={handleToggleCompare}
                      onToggleFavorite={handleToggleFavorite}
                      onFindSimilar={handleFindSimilar}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={() => handleDiscover(page + 1)}
                      disabled={loading}
                      className="px-6 py-2.5 rounded-xl bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/80 text-sm font-medium transition-all flex items-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRight className="w-4 h-4" />
                      )}
                      Load more
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* PHOTO SEARCH MODE */
          <motion.div
            key="photo"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {!uploadedImage ? (
              /* Upload Zone */
              <div
                ref={dropZoneRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? "border-gold bg-gold/[0.06]"
                    : "border-white/[0.12] hover:border-white/[0.24] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <Upload className={`w-12 h-12 mb-4 transition-colors ${dragOver ? "text-gold" : "text-white/20"}`} />
                <p className="text-white/60 text-lg font-medium mb-1">
                  Drop an image or click to browse
                </p>
                <p className="text-white/30 text-sm">
                  Upload a photo of furniture or a room to find similar pieces
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                  }}
                />
              </div>
            ) : (
              /* Image Preview & Results */
              <div>
                <div className="flex flex-col sm:flex-row gap-6 mb-8">
                  {/* Uploaded image preview */}
                  <div className="relative sm:w-72 flex-shrink-0">
                    <img
                      src={uploadedImage}
                      alt="Uploaded"
                      className="w-full rounded-xl border border-white/[0.06] object-cover"
                      style={{ maxHeight: 320 }}
                    />
                    <button
                      onClick={() => {
                        setUploadedImage(null);
                        setPhotoResults([]);
                        setPhotoAnalysis(null);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/70 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1">
                    {photoLoading ? (
                      <div className="flex items-center gap-3 text-white/50">
                        <Loader2 className="w-5 h-5 animate-spin text-gold" />
                        <span>Analyzing your image...</span>
                      </div>
                    ) : photoAnalysis ? (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <h4 className="text-sm font-medium text-white/60 mb-2">Analysis</h4>
                        <p className="text-sm text-white/80">{typeof photoAnalysis === "string" ? photoAnalysis : JSON.stringify(photoAnalysis)}</p>
                      </div>
                    ) : photoResults.length > 0 ? (
                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                        <p className="text-sm text-white/60">
                          Found {photoResults.length} similar products
                        </p>
                      </div>
                    ) : null}

                    {!photoLoading && uploadedImage && (
                      <button
                        onClick={handleDetailedAnalysis}
                        className="mt-4 px-5 py-2 rounded-xl bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/80 text-sm font-medium transition-all flex items-center gap-2"
                      >
                        <Search className="w-4 h-4" />
                        Identify specific pieces
                      </button>
                    )}
                  </div>
                </div>

                {/* Photo search results - same masonry grid */}
                {photoResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
                      {photoResults.map((product, idx) => (
                        <ProductCard
                          key={product.id || idx}
                          product={product}
                          compareItems={compareItems}
                          favorites={favorites}
                          onToggleCompare={handleToggleCompare}
                          onToggleFavorite={handleToggleFavorite}
                          onFindSimilar={handleFindSimilar}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
