import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, HeartOff, Plus, Minus, Trash2, FileText, ChevronDown, ChevronRight,
  Edit3, Download, FolderPlus, Package, DollarSign, MessageSquare, Settings,
  ArrowRightLeft, Search, XCircle, ShoppingBag, Star, ImagePlus, X,
} from "lucide-react";
import {
  getFavorites, toggleFavorite,
  getQuote, saveQuote, removeFromQuote, updateQuoteItem,
  addQuoteRoom, removeQuoteRoom, renameQuoteRoom, moveItemToRoom,
  clearQuote, getQuoteSettings, saveQuoteSettings, getQuoteItemCount,
  addToQuote, normalizeSearchResult,
} from "@/lib/growth-store";
import { generateQuotePdf } from "@/lib/quote-generator";
import { useTradePricing } from "@/lib/TradePricingContext";
import { useAuth } from "@/lib/AuthContext";
import { Lock, UserPlus as UserPlusIcon } from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────── */

function dimStr(item) {
  const parts = [];
  if (item.width) parts.push(`${item.width}"W`);
  if (item.depth) parts.push(`${item.depth}"D`);
  if (item.height) parts.push(`${item.height}"H`);
  return parts.join(" x ") || item.dimensions || null;
}

function formatUsd(n) {
  return `$${Math.round(n).toLocaleString()}`;
}

/* ─── main page ───────────────────────────────────────────── */

export default function Quotes() {
  const navigate = useNavigate();
  const { user, navigateToLogin } = useAuth();
  const { mode, getPrice, fmtPrice, hasDiscounts } = useTradePricing();

  // Gate: must be logged in to access quotes
  if (!user) {
    return (
      <div className="min-h-screen bg-[#08090E] text-white">
        <div className="max-w-lg mx-auto px-4 py-32 flex flex-col items-center text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-6"
            style={{ background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.2)" }}
          >
            <Lock className="h-7 w-7 text-[#C9A96E]" />
          </div>
          <h2 className="text-xl font-semibold text-white/90 mb-2">Sign in to build quotes</h2>
          <p className="text-sm text-white/40 mb-6 max-w-sm">
            Create a free account to save products, build quotes, and generate professional PDFs for your clients.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigateToLogin("signup")}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #C9A96E, #B8944F)",
                color: "#0A0B10",
              }}
            >
              <UserPlusIcon className="h-4 w-4" />
              Create Free Account
            </button>
            <button
              onClick={() => navigateToLogin("login")}
              className="rounded-xl px-6 py-3 text-sm font-medium text-white/50 hover:text-white/80 border border-white/[0.08] hover:border-white/[0.15] transition-all"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* state */
  const [favorites, setFavorites] = useState(getFavorites());
  const [quote, setQuote] = useState(getQuote());
  const [settings, setSettings] = useState(getQuoteSettings());

  const [expandedRooms, setExpandedRooms] = useState(() => {
    const q = getQuote();
    const expanded = {};
    q.rooms.forEach((r) => { expanded[r.id] = true; });
    return expanded;
  });

  const [editingRoomId, setEditingRoomId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMarkup, setShowMarkup] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [showAddRoom, setShowAddRoom] = useState(false);

  const nameRef = useRef(null);
  const clientRef = useRef(null);

  /* refresh helpers */
  const refreshQuote = () => {
    const q = getQuote();
    setQuote(q);
  };

  const refreshFavorites = () => {
    setFavorites(getFavorites());
  };

  /* price helpers */
  const getItemPrice = (item) => {
    const priceInfo = getPrice(item);
    const base = priceInfo.price;
    if (!base) return null;
    const markup = quote.markup_percent || 0;
    return markup > 0 ? base * (1 + markup / 100) : base;
  };

  const getItemPriceInfo = (item) => getPrice(item);

  const getRoomTotal = (room) =>
    room.items.reduce((sum, item) => {
      const price = getItemPrice(item);
      return sum + (price ? price * (item.quantity || 1) : 0);
    }, 0);

  const totalItems = quote.rooms.reduce((s, r) => s + r.items.length, 0);
  const grandTotal = quote.rooms.reduce((s, r) => s + getRoomTotal(r), 0);
  const itemsWithoutPrice = quote.rooms.flatMap((r) => r.items).filter((i) => !getItemPrice(i));

  /* ── quote actions ────────────────────────────────────────── */

  const handleRemove = (productId) => {
    removeFromQuote(productId);
    refreshQuote();
  };

  const handleQuantity = (productId, delta) => {
    const allItems = quote.rooms.flatMap((r) => r.items);
    const item = allItems.find((i) => i.id === productId);
    if (!item) return;
    const newQty = Math.max(1, (item.quantity || 1) + delta);
    updateQuoteItem(productId, { quantity: newQty });
    refreshQuote();
  };

  const handleNotes = (productId, notes) => {
    updateQuoteItem(productId, { notes });
    refreshQuote();
  };

  const handleMoveToRoom = (productId, roomId) => {
    moveItemToRoom(productId, roomId);
    refreshQuote();
  };

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return;
    addQuoteRoom(newRoomName.trim());
    setNewRoomName("");
    setShowAddRoom(false);
    refreshQuote();
    const q = getQuote();
    setExpandedRooms((prev) => ({ ...prev, [q.rooms[q.rooms.length - 1].id]: true }));
  };

  const handleRenameRoom = (roomId, name) => {
    renameQuoteRoom(roomId, name);
    setEditingRoomId(null);
    refreshQuote();
  };

  const handleDeleteRoom = (roomId) => {
    removeQuoteRoom(roomId);
    refreshQuote();
  };

  const handleSaveName = (field, value) => {
    const q = getQuote();
    q[field] = value;
    saveQuote(q);
    refreshQuote();
  };

  const handleMarkup = (val) => {
    const q = getQuote();
    q.markup_percent = Math.max(0, Number(val) || 0);
    saveQuote(q);
    refreshQuote();
  };

  const handleGeneratePdf = async (pdfMode) => {
    setGenerating(true);
    try {
      const allItems = quote.rooms.flatMap((r) =>
        r.items.map((item) => {
          const priceInfo = getPrice(item);
          const base = priceInfo.price || 0;
          const markup = quote.markup_percent || 0;
          const clientPrice = markup > 0 ? base * (1 + markup / 100) : base;
          return {
            ...item,
            retail_price: pdfMode === "trade" ? (priceInfo.isTrade ? priceInfo.price : base) : clientPrice,
            _trade_price: priceInfo.isTrade ? priceInfo.price : null,
            _is_trade: priceInfo.isTrade,
            _price_label: priceInfo.label,
            _room: r.name,
            _quantity: item.quantity || 1,
          };
        })
      );
      await generateQuotePdf(allItems, quote.name || "Untitled Quote", { pdfMode });
    } catch (err) {
      console.error("PDF generation failed:", err);
    }
    setGenerating(false);
  };

  const handleClear = () => {
    if (totalItems > 0 && !window.confirm(`Remove all ${totalItems} items from this quote?`)) return;
    clearQuote();
    refreshQuote();
  };

  const handleSaveSettings = (updates) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    saveQuoteSettings(next);
  };

  /* ── favorites actions ────────────────────────────────────── */

  const handleAddToQuote = (fav) => {
    const normalized = {
      id: fav.id,
      product_name: fav.product_name || fav.name,
      manufacturer_name: fav.manufacturer_name,
      image_url: fav.image_url || fav.thumbnail,
      portal_url: fav.portal_url,
      retail_price: fav.retail_price,
      wholesale_price: fav.wholesale_price,
      material: fav.material,
      style: fav.style,
      sku: fav.sku,
      collection: fav.collection,
      dimensions: fav.dimensions,
      width: fav.width,
      depth: fav.depth,
      height: fav.height,
      description: fav.description || fav.snippet,
      category: fav.category || fav.product_type,
      vendor_id: fav.vendor_id,
      image_contain: fav.image_contain,
    };
    addToQuote(normalized);
    refreshQuote();
  };

  const handleRemoveFavorite = (fav) => {
    toggleFavorite(fav);
    refreshFavorites();
  };

  const handleSwap = (item) => {
    const cat = item.category || item.product_type || item.style || "";
    navigate(`/Search?q=${encodeURIComponent(cat)}`);
  };

  /* ─── render ────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#08090E] text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Page Title */}
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg font-semibold uppercase tracking-widest text-white/80 mb-10"
        >
          Quotes
        </motion.h1>

        {/* ═══════════════════════════════════════════════════
            SECTION 1 — SAVED PRODUCTS
           ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5">
            <Heart className="h-4 w-4 text-gold" />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Saved Products
            </h2>
            {favorites.length > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gold/10 text-gold/70 border border-gold/20">
                {favorites.length}
              </span>
            )}
          </div>

          {favorites.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-white/[0.06] py-14 flex flex-col items-center justify-center"
              style={{ background: "rgba(255,255,255,0.01)" }}
            >
              <HeartOff className="h-8 w-8 text-white/10 mb-3" />
              <p className="text-sm text-white/30 mb-1">No saved products yet</p>
              <p className="text-xs text-white/15">Save products by clicking the heart icon while browsing search results.</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            >
              {favorites.map((fav) => {
                const priceInfo = getPrice(fav);
                const alreadyInQuote = quote.rooms.some((r) => r.items.some((i) => i.id === fav.id));
                return (
                  <motion.div
                    key={fav.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group rounded-xl border border-white/[0.06] overflow-hidden transition-colors hover:border-white/[0.12]"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-square bg-white border-b border-white/[0.06] overflow-hidden">
                      {(fav.image_url || fav.thumbnail) ? (
                        <img
                          src={fav.image_url || fav.thumbnail}
                          alt={fav.product_name || fav.name}
                          className="h-full w-full object-contain p-3"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-white/[0.03]">
                          <Package className="h-8 w-8 text-white/10" />
                        </div>
                      )}
                    </div>

                    <div className="px-3 pt-2.5 pb-3 space-y-1.5">
                      <p className="text-xs font-medium text-white/80 truncate leading-tight">
                        {fav.product_name || fav.name}
                      </p>
                      <p className="text-[10px] text-gold/60 truncate">{fav.manufacturer_name}</p>

                      {/* Price — always visible */}
                      <div className="text-xs">
                        {priceInfo.price ? (
                          <span className={priceInfo.isTrade ? "text-emerald-400" : "text-white/60"}>
                            {priceInfo.isTrade && <span className="text-[9px] mr-0.5 opacity-60">Trade </span>}
                            {formatUsd(priceInfo.price)}
                          </span>
                        ) : (
                          <span className="text-white/20 text-[10px]">Price on request</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => handleAddToQuote(fav)}
                          disabled={alreadyInQuote}
                          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                            alreadyInQuote
                              ? "bg-white/[0.04] text-white/20 cursor-default"
                              : "bg-gold/10 text-gold border border-gold/20 hover:bg-gold/20"
                          }`}
                        >
                          {alreadyInQuote ? (
                            <>
                              <ShoppingBag className="h-3 w-3" />
                              In Quote
                            </>
                          ) : (
                            <>
                              <Plus className="h-3 w-3" />
                              Add to Quote
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveFavorite(fav)}
                          className="p-1.5 rounded-lg text-white/15 hover:text-red-400/60 hover:bg-red-400/[0.06] transition-colors"
                          title="Remove from saved"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════
            SECTION 2 — QUOTE BUILDER
           ═══════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <FileText className="h-4 w-4 text-gold" />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              Quote Builder
            </h2>
            {totalItems > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gold/10 text-gold/70 border border-gold/20">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
            )}
          </div>

          {/* Quote header card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/[0.06] overflow-hidden mb-4"
            style={{ background: "rgba(255,255,255,0.015)" }}
          >
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] text-white/20">
                  {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
                {/* Settings toggle */}
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] text-white/25 hover:text-white/50 hover:bg-white/[0.04] transition-colors"
                  title="Designer info & logo"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </button>
              </div>

              {/* Project name — always visible input */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-[0.2em] text-white/25 font-semibold">Project Name</label>
                <input
                  ref={nameRef}
                  value={quote.name || ""}
                  onChange={(e) => handleSaveName("name", e.target.value)}
                  placeholder="e.g., Thompson Residence — Living Room Refresh"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 text-base font-medium text-white placeholder:text-white/15 focus:outline-none focus:border-gold/30 transition-colors"
                />

                {/* Client name */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[9px] uppercase tracking-[0.2em] text-white/25 font-semibold">Client</label>
                    <input
                      ref={clientRef}
                      value={quote.client_name || ""}
                      onChange={(e) => handleSaveName("client_name", e.target.value)}
                      placeholder="Client name"
                      className="w-full mt-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/15 focus:outline-none focus:border-gold/30 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Settings panel (collapsible) */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-white/[0.06]"
                >
                  <div className="px-6 py-5 space-y-3">
                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
                      Designer Info (saved for all quotes)
                    </div>
                    <input
                      value={settings.business_name}
                      onChange={(e) => handleSaveSettings({ business_name: e.target.value })}
                      placeholder="Business name"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30"
                    />
                    <input
                      value={settings.designer_name}
                      onChange={(e) => handleSaveSettings({ designer_name: e.target.value })}
                      placeholder="Designer name"
                      className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30"
                    />
                    <div className="flex gap-2">
                      <input
                        value={settings.email}
                        onChange={(e) => handleSaveSettings({ email: e.target.value })}
                        placeholder="Email"
                        className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30"
                      />
                      <input
                        value={settings.phone}
                        onChange={(e) => handleSaveSettings({ phone: e.target.value })}
                        placeholder="Phone"
                        className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30"
                      />
                    </div>

                    {/* Logo upload */}
                    <div className="pt-2 border-t border-white/[0.06]">
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">
                        Your Logo (appears on PDF cover)
                      </div>
                      {settings.logo_data_url ? (
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-24 rounded-lg border border-white/[0.08] bg-white/[0.03] flex items-center justify-center overflow-hidden p-1">
                            <img src={settings.logo_data_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                          </div>
                          <button
                            onClick={() => handleSaveSettings({ logo_data_url: "" })}
                            className="flex items-center gap-1 text-[10px] text-white/25 hover:text-red-400/60 transition-colors"
                          >
                            <X className="h-3 w-3" />
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-white/[0.1] hover:border-gold/30 text-[11px] text-white/30 hover:text-white/50 transition-colors">
                          <ImagePlus className="h-4 w-4" />
                          Upload logo (PNG, JPG)
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/svg+xml"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 500_000) {
                                alert("Logo must be under 500KB");
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => {
                                handleSaveSettings({ logo_data_url: reader.result });
                              };
                              reader.readAsDataURL(file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Rooms + Items */}
          {totalItems === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-white/[0.06] py-20 flex flex-col items-center justify-center"
              style={{ background: "rgba(255,255,255,0.01)" }}
            >
              <Package className="h-12 w-12 text-white/10 mb-4" />
              <p className="text-sm text-white/40 mb-1">No quotes yet</p>
              <p className="text-xs text-white/20">
                Search for products, save your favorites, and add them here to start your first quote.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {quote.rooms.map((room) => (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-white/[0.06] overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.015)" }}
                >
                  {/* Room Header */}
                  <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04]">
                    <button
                      onClick={() => setExpandedRooms((prev) => ({ ...prev, [room.id]: !prev[room.id] }))}
                      className="text-white/30 hover:text-white/60 transition-colors"
                    >
                      {expandedRooms[room.id] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    {editingRoomId === room.id ? (
                      <input
                        autoFocus
                        defaultValue={room.name}
                        className="flex-1 bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-gold/30"
                        onBlur={(e) => handleRenameRoom(room.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameRoom(room.id, e.target.value);
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setEditingRoomId(room.id)}
                        className="flex-1 text-left text-xs font-semibold text-white/60 uppercase tracking-wider hover:text-white/80 transition-colors"
                      >
                        {room.name}
                      </button>
                    )}

                    <span className="text-[10px] text-white/20">
                      {room.items.length} {room.items.length === 1 ? "item" : "items"}
                    </span>

                    {getRoomTotal(room) > 0 && (
                      <span className="text-[10px] text-gold/60 font-medium">
                        {formatUsd(getRoomTotal(room))}
                      </span>
                    )}

                    {quote.rooms.length > 1 && room.items.length === 0 && (
                      <button
                        onClick={() => handleDeleteRoom(room.id)}
                        className="p-1 text-white/15 hover:text-red-400/60 transition-colors"
                        title="Delete room"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Room Items */}
                  <AnimatePresence>
                    {expandedRooms[room.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {room.items.map((item) => (
                          <QuoteItemRow
                            key={item.id}
                            item={item}
                            rooms={quote.rooms}
                            currentRoomId={room.id}
                            onRemove={() => handleRemove(item.id)}
                            onQuantity={(d) => handleQuantity(item.id, d)}
                            onNotes={(n) => handleNotes(item.id, n)}
                            onMoveToRoom={(rid) => handleMoveToRoom(item.id, rid)}
                            onSwap={() => handleSwap(item)}
                            getItemPrice={() => getItemPrice(item)}
                            getItemPriceInfo={() => getItemPriceInfo(item)}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {/* Add Room */}
              <div className="pt-1">
                {showAddRoom ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2 max-w-sm"
                  >
                    <input
                      autoFocus
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="Room name"
                      className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddRoom();
                        if (e.key === "Escape") setShowAddRoom(false);
                      }}
                    />
                    <button
                      onClick={handleAddRoom}
                      className="px-4 py-2 rounded-lg bg-gold/15 text-gold text-xs font-medium hover:bg-gold/25 transition-colors border border-gold/20"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddRoom(false)}
                      className="px-3 py-2 rounded-lg text-white/20 hover:text-white/40 text-xs transition-colors"
                    >
                      Cancel
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setShowAddRoom(true)}
                    className="flex items-center gap-2 text-xs text-white/20 hover:text-white/40 transition-colors py-2"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    Add room
                  </button>
                )}
              </div>

              {/* ── Footer: Markup, Totals, Actions ─────────── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl border border-white/[0.06] px-6 py-5 mt-4 space-y-4"
                style={{ background: "rgba(255,255,255,0.015)" }}
              >
                {/* Markup toggle */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowMarkup(!showMarkup)}
                    className="flex items-center gap-2 text-[10px] text-white/25 hover:text-white/40 uppercase tracking-wider transition-colors"
                  >
                    <DollarSign className="h-3 w-3" />
                    Designer markup
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${showMarkup ? "rotate-180" : ""}`}
                    />
                  </button>
                  {quote.markup_percent > 0 && (
                    <span className="text-[10px] text-gold/50">+{quote.markup_percent}%</span>
                  )}
                </div>

                <AnimatePresence>
                  {showMarkup && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-3 py-1">
                        <span className="text-[10px] text-white/30">Markup %</span>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={quote.markup_percent || ""}
                          onChange={(e) => handleMarkup(e.target.value)}
                          placeholder="0"
                          className="w-20 bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-gold/30"
                        />
                        <span className="text-[10px] text-white/20">
                          Client sees marked-up price. Trade price stays hidden.
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Room subtotals + grand total */}
                <div className="space-y-1.5">
                  {quote.rooms
                    .filter((r) => r.items.length > 0)
                    .map((room) => (
                      <div key={room.id} className="flex justify-between text-xs">
                        <span className="text-white/30">{room.name}</span>
                        <span className="text-white/50">
                          {getRoomTotal(room) > 0
                            ? formatUsd(getRoomTotal(room))
                            : "Price on request"}
                        </span>
                      </div>
                    ))}

                  <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/[0.06]">
                    <span className="text-white/60">Total</span>
                    <span className="text-white">
                      {grandTotal > 0 ? formatUsd(grandTotal) : "Prices on request"}
                    </span>
                  </div>
                  {itemsWithoutPrice.length > 0 && (
                    <div className="text-[10px] text-white/20">
                      {itemsWithoutPrice.length}{" "}
                      {itemsWithoutPrice.length === 1 ? "item" : "items"} pending pricing
                    </div>
                  )}
                </div>

                {/* Trade mode indicator */}
                {mode === "trade" && hasDiscounts && (
                  <div className="flex items-center gap-2 text-[10px] text-emerald-400/50">
                    <span className="uppercase tracking-wider font-semibold">Trade pricing active</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => handleGeneratePdf("client")}
                    disabled={generating}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, rgba(201,169,110,0.25), rgba(201,169,110,0.15))",
                      border: "1px solid rgba(201,169,110,0.3)",
                      color: "#C9A96E",
                    }}
                    title="Client-facing PDF with retail/marked-up prices"
                  >
                    <Download className="h-4 w-4" />
                    {generating ? "Generating..." : "Client PDF"}
                  </button>

                  {mode === "trade" && hasDiscounts && (
                    <button
                      onClick={() => handleGeneratePdf("trade")}
                      disabled={generating}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{
                        background: "linear-gradient(135deg, rgba(110,180,140,0.2), rgba(110,180,140,0.1))",
                        border: "1px solid rgba(110,180,140,0.25)",
                        color: "rgba(110,180,140,0.8)",
                      }}
                      title="Internal PDF with trade prices"
                    >
                      <Download className="h-4 w-4" />
                      Trade PDF
                    </button>
                  )}

                  <button
                    onClick={handleClear}
                    className="px-5 py-2.5 rounded-xl text-xs text-white/25 hover:text-red-400/60 hover:bg-red-400/[0.06] border border-white/[0.06] transition-all"
                  >
                    Clear Quote
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   QuoteItemRow — individual product row inside a room
   ═══════════════════════════════════════════════════════════ */

function QuoteItemRow({
  item,
  rooms,
  currentRoomId,
  onRemove,
  onQuantity,
  onNotes,
  onMoveToRoom,
  onSwap,
  getItemPrice,
  getItemPriceInfo,
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const price = getItemPrice();
  const priceInfo = getItemPriceInfo?.() || { isTrade: false };
  const dims = dimStr(item);

  return (
    <div className="px-5 py-3.5 hover:bg-white/[0.015] transition-colors group border-b border-white/[0.03] last:border-b-0">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-white/[0.06] bg-white">
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.product_name}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-white/[0.03]">
              <Package className="h-6 w-6 text-white/10" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/80 truncate">{item.product_name}</div>
          <div className="text-[11px] text-gold/60 truncate">{item.manufacturer_name}</div>
          {item.sku && <div className="text-[10px] text-white/20 mt-0.5">SKU: {item.sku}</div>}
          {dims && <div className="text-[10px] text-white/20">{dims}</div>}

          {/* Price & Quantity */}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-0.5 border border-white/[0.08] rounded-md">
              <button
                onClick={() => onQuantity(-1)}
                className="px-2 py-1 text-white/25 hover:text-white/50 transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-xs text-white/60 w-6 text-center">{item.quantity || 1}</span>
              <button
                onClick={() => onQuantity(1)}
                className="px-2 py-1 text-white/25 hover:text-white/50 transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {price ? (
              <span className={`text-xs ${priceInfo.isTrade ? "text-emerald-400/70" : "text-white/50"}`}>
                {priceInfo.isTrade && (
                  <span className="text-[9px] mr-0.5 opacity-70">Est. Trade </span>
                )}
                {formatUsd(price)}
                {(item.quantity || 1) > 1 && (
                  <span className={priceInfo.isTrade ? "text-emerald-400/30" : "text-white/25"}>
                    {" "}
                    x{item.quantity} = {formatUsd(price * (item.quantity || 1))}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-[10px] text-white/20">Price on request</span>
            )}
          </div>
        </div>

        {/* Actions column */}
        <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Swap */}
          <button
            onClick={onSwap}
            className="p-1.5 text-white/20 hover:text-gold/60 transition-colors"
            title="Swap — find similar products"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>

          {/* Notes */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="p-1.5 text-white/20 hover:text-white/50 transition-colors"
            title="Add notes"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>

          {/* Move to room */}
          {rooms.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                className="p-1.5 text-white/20 hover:text-white/50 transition-colors"
                title="Move to room"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              {showMoveMenu && (
                <div
                  className="absolute right-0 top-full z-10 w-40 py-1 rounded-lg shadow-xl"
                  style={{
                    background: "rgba(20,20,30,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {rooms
                    .filter((r) => r.id !== currentRoomId)
                    .map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          onMoveToRoom(r.id);
                          setShowMoveMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
                      >
                        {r.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Remove */}
          <button
            onClick={onRemove}
            className="p-1.5 text-white/20 hover:text-red-400/60 transition-colors"
            title="Remove from quote"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Notes area */}
      <AnimatePresence>
        {(showNotes || item.notes) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <textarea
              value={item.notes || ""}
              onChange={(e) => onNotes(e.target.value)}
              placeholder="Notes — e.g., COM in Crypton Ivory, check arm height..."
              className="w-full mt-2.5 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/60 placeholder:text-white/15 focus:outline-none focus:border-gold/20 resize-none"
              rows={2}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
