import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, HeartOff, Plus, Minus, Trash2, FileText, ChevronDown, ChevronRight,
  Edit3, Download, FolderPlus, Package, DollarSign, MessageSquare, Settings,
  ArrowRightLeft, Search, XCircle, ShoppingBag, ImagePlus, X, Link2, Check, ExternalLink,
  Sparkles, Loader2, RefreshCw,
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

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

function quoteImageUrl(item) {
  // Use server proxy for higher quality + bypass hotlink protection
  if (item.id) return `${SEARCH_SERVICE}/images/${encodeURIComponent(item.id)}`;
  if (item.image_url) return `${SEARCH_SERVICE}/proxy-image?url=${encodeURIComponent(item.image_url)}`;
  return "";
}

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

const ROOM_ACCENTS = [
  { accent: "#C4A265", wash: "rgba(196,162,101,0.12)" },
  { accent: "#8ea6b9", wash: "rgba(142,166,185,0.12)" },
  { accent: "#8f9779", wash: "rgba(143,151,121,0.12)" },
  { accent: "#b5897b", wash: "rgba(181,137,123,0.12)" },
];

/* ─── main page ───────────────────────────────────────────── */

export default function Quotes() {
  const navigate = useNavigate();
  const { user, navigateToLogin } = useAuth();
  const { mode, getPrice, fmtPrice, hasDiscounts, showPricing, toggleShowPricing } = useTradePricing();

  // Gate: must be logged in to access quotes
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#000000" }}>
        <div className="max-w-lg mx-auto px-4 py-32 flex flex-col items-center text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-6"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            <Lock className="h-7 w-7" style={{ color: "rgba(255,255,255,0.65)" }} />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "#ffffff" }}>Sign in to build quotes</h2>
          <p className="text-sm mb-6 max-w-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
            Create a free account to save products, build quotes, and generate professional PDFs for your clients.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigateToLogin("signup")}
              className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all hover:brightness-110"
              style={{
                background: "white",
                color: "black",
              }}
            >
              <UserPlusIcon className="h-4 w-4" />
              Create Free Account
            </button>
            <button
              onClick={() => navigateToLogin("login")}
              className="rounded-xl px-6 py-3 text-sm font-medium transition-all"
              style={{ color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.10)" }}
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
    (q?.rooms || []).forEach((r) => { expanded[r.id] = true; });
    return expanded;
  });

  const [editingRoomId, setEditingRoomId] = useState(null);
  const [showMarkup, setShowMarkup] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState("");
  const [actionToast, setActionToast] = useState(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [showAddRoom, setShowAddRoom] = useState(false);

  const nameRef = useRef(null);
  const clientRef = useRef(null);

  // Why This Piece — AI justifications
  const [justifications, setJustifications] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spec_justifications") || "{}"); } catch { return {}; }
  });
  const [justifyLoading, setJustifyLoading] = useState({});
  const [justifyBatchLoading, setJustifyBatchLoading] = useState(null); // roomId if loading

  /* refresh helpers */
  const refreshQuote = () => {
    const q = getQuote();
    setQuote(q);
  };

  const refreshFavorites = () => {
    setFavorites(getFavorites());
  };

  /* justification helpers */
  const saveJustifications = (updated) => {
    setJustifications(updated);
    localStorage.setItem("spec_justifications", JSON.stringify(updated));
  };

  const handleWhyThisPiece = async (product, room) => {
    // Skip if already cached
    if (justifications[product.id]) return;
    setJustifyLoading(prev => ({ ...prev, [product.id]: true }));
    try {
      const resp = await fetch(`${SEARCH_SERVICE}/why-this-piece`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product,
          room_products: room.items,
          room_name: room.name,
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      const updated = { ...justifications, [product.id]: data.justification };
      saveJustifications(updated);
    } catch { /* silent fail */ }
    setJustifyLoading(prev => ({ ...prev, [product.id]: false }));
  };

  const handleGenerateAllJustifications = async (room) => {
    if (room.items.length === 0) return;
    // Only send products that don't already have cached justifications
    const missing = room.items.filter(item => !justifications[item.id]);
    if (missing.length === 0) return;
    setJustifyBatchLoading(room.id);
    try {
      const resp = await fetch(`${SEARCH_SERVICE}/why-this-piece-batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          products: missing,
          room_name: room.name,
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      const updated = { ...justifications };
      for (const j of (data.justifications || [])) {
        const product = missing[j.product_index];
        if (product) updated[product.id] = j.justification;
      }
      saveJustifications(updated);
    } catch { /* silent fail */ }
    setJustifyBatchLoading(null);
  };

  const handleUpdateJustification = (productId, text) => {
    const updated = { ...justifications, [productId]: text };
    saveJustifications(updated);
  };

  /* price helpers */
  const getItemPrice = (item) => {
    // Custom price overrides everything
    if (item.custom_price && item.custom_price > 0) return item.custom_price;
    const priceInfo = getPrice(item);
    const base = priceInfo.price;
    if (!base) return null;
    const markup = quote.markup_percent || 0;
    return markup > 0 ? base * (1 + markup / 100) : base;
  };

  const getItemPriceInfo = (item) => {
    if (item.custom_price && item.custom_price > 0) {
      return { price: item.custom_price, label: "Custom", isTrade: false, isCustom: true };
    }
    return getPrice(item);
  };

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

  const handleCustomPrice = (productId, price) => {
    updateQuoteItem(productId, { custom_price: price });
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
    // NOTE: No free tier exists; all users are Pro — subscription check removed per project rules.
    // Previously gated PDF generation behind subscription status check.
    setGenerating(true);
    setGeneratingLabel(pdfMode === "trade" ? "Building trade presentation..." : "Building client presentation...");
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
      await generateQuotePdf(allItems, quote.name || "Untitled Quote", { pdfMode, justifications });
      setActionToast(pdfMode === "trade" ? "Trade presentation downloaded" : "Client presentation downloaded");
      setTimeout(() => setActionToast(null), 2600);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setActionToast("Could not generate the PDF");
      setTimeout(() => setActionToast(null), 2600);
    }
    setGenerating(false);
    setGeneratingLabel("");
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
      portal_url: fav.portal_url || fav.product_url,
      product_url: fav.product_url || fav.portal_url,
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
    const query = item.category || item.product_type || item.style || item.product_name || "";
    navigate(`/Search?q=${encodeURIComponent(query)}&swap=${encodeURIComponent(item.id)}`);
  };

  // ── Client Portal Share ──
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareToken, setShareToken] = useState(() => {
    try { return localStorage.getItem("spec_share_token") || null; } catch { return null; }
  });
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareNote, setShareNote] = useState("");
  const [shareClientEmail, setShareClientEmail] = useState("");
  const [clientFeedback, setClientFeedback] = useState(() => {
    try { return JSON.parse(localStorage.getItem("spec_client_feedback") || "{}"); } catch { return {}; }
  });

  // Load feedback for existing share tokens
  useEffect(() => {
    if (!shareToken) return;
    (async () => {
      try {
        const token = localStorage.getItem("spec_auth_token");
        if (!token) return;
        const resp = await fetch(`${SEARCH_SERVICE}/quotes/shared/${shareToken}`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.feedback && Object.keys(data.feedback).length > 0) {
          setClientFeedback(data.feedback);
          localStorage.setItem("spec_client_feedback", JSON.stringify(data.feedback));
        }
      } catch { /* silent */ }
    })();
  }, [shareToken]);

  const handleShareLink = async () => {
    setShowShareModal(true);
  };

  const handleCreateShareLink = async () => {
    setShareLoading(true);
    try {
      const authToken = localStorage.getItem("spec_auth_token");
      if (!authToken) { alert("Sign in to share quotes"); return; }
      const sanitized = {
        name: quote.name || "Shared Quote",
        rooms: quote.rooms.map((r) => ({
          ...r,
          items: r.items.map(({ wholesale_price, ...rest }) => ({
            ...rest,
            quantity: rest.quantity || 1,
            justification: justifications[rest.id] || null,
          })),
        })),
        justifications,
      };
      const payload = {
        quoteData: sanitized,
        designerName: settings.designer_name || user.full_name || "",
        designerCompany: settings.business_name || "",
        projectName: quote.name || "Untitled Project",
        clientNote: shareNote,
        clientEmail: shareClientEmail,
      };
      // Create or update
      let resp;
      if (shareToken) {
        resp = await fetch(`${SEARCH_SERVICE}/quotes/shared/${shareToken}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ ...payload, quoteData: sanitized }),
        });
      } else {
        resp = await fetch(`${SEARCH_SERVICE}/quotes/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify(payload),
        });
      }
      if (!resp.ok) throw new Error("Failed to create share link");
      const data = await resp.json();
      const token = data.token || shareToken;
      if (data.token) {
        setShareToken(token);
        localStorage.setItem("spec_share_token", token);
      }
      const url = `${window.location.origin}/Approve?token=${token}`;
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setActionToast(shareToken ? "Client portal refreshed and copied" : "Client portal copied");
      setTimeout(() => setActionToast(null), 2600);
      setShowShareModal(false);
      setShareNote("");
      // Clear old feedback on new version
      if (shareToken) {
        setClientFeedback({});
        localStorage.setItem("spec_client_feedback", "{}");
      }
      setTimeout(() => setShareCopied(false), 3000);
    } catch (err) {
      console.error("Share link error:", err);
      setActionToast("Could not create the client portal");
      setTimeout(() => setActionToast(null), 2600);
    } finally {
      setShareLoading(false);
    }
  };

  const getItemFeedback = (itemId) => clientFeedback[itemId] || null;

  /* ─── render ────────────────────────────────────────────── */
  return (
    <div className="presentation-mode" style={{ minHeight: "100vh", background: "#000000", color: "#ffffff" }}>
      <div className="page-wrap-wide py-10 pb-48 sm:pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="atelier-panel paper-grain mb-10 px-6 py-8 sm:px-8 md:px-10"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="workspace-kicker mb-4 sm:mb-5">Quote studio</div>
              <h1 className="workspace-heading max-w-4xl">Build polished client-facing quotes without leaving the sourcing flow.</h1>
              <p className="workspace-subhead mt-3 sm:mt-4">
                Organize saved pieces into rooms, generate PDFs, and share approval links from a workspace that stays calm under detail.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
              <div className="atelier-panel-soft px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.45)" }}>Rooms</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: "#ffffff" }}>{quote.rooms.length}</div>
                <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Organized quote sections</div>
              </div>
              <div className="atelier-panel-soft px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.45)" }}>Quote total</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: "#ffffff" }}>{showPricing && grandTotal > 0 ? formatUsd(grandTotal) : "Price on request"}</div>
                <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.65)" }}>Live estimate</div>
              </div>
            </div>
          </div>
          {totalItems > 0 && (
            <div className="mt-5 sm:mt-6 grid gap-3 lg:grid-cols-[1fr_0.65fr]">
              <div className="atelier-panel-soft paper-grain px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.65)" }}>Quote Overview</div>
                <p className="mt-2 text-[13px] leading-6" style={{ color: "rgba(255,255,255,0.65)" }}>
                  Rooms, totals, notes, and exports are grouped here so the quote stays easy to scan and easy to share.
                </p>
              </div>
              <div className="atelier-panel-soft px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.45)" }}>Export readiness</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold" style={{ color: "#ffffff" }}>{Math.round(((quote.rooms.filter((r) => r.items.length > 0).length > 0 ? 1 : 0) + (quote.name ? 1 : 0) + (settings.designer_name ? 1 : 0) + (settings.business_name ? 1 : 0)) / 4 * 100)}%</div>
                  <div className="text-right text-[11px] leading-5" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Add project, designer, and room detail
                    <br />
                    for the strongest export.
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ═══════════════════════════════════════════════════
            SECTION 1 — SAVED PRODUCTS
           ═══════════════════════════════════════════════════ */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5">
            <Heart className="h-4 w-4" style={{ color: "rgba(255,255,255,0.65)" }} />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.65)" }}>
              Saved Products
            </h2>
            {favorites.length > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.10)" }}>
                {favorites.length}
              </span>
            )}
          </div>

          {favorites.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="editorial-card paper-grain py-14 flex flex-col items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <HeartOff className="h-8 w-8 mb-3" style={{ color: "rgba(255,255,255,0.45)" }} />
              <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.65)" }}>No saved products yet</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Save products while browsing and this board becomes your staging area for room-by-room review, spec notes, and quote export.</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4"
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
                    className="group editorial-card transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-square overflow-hidden" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "linear-gradient(180deg, #f7f1e8, #ece1d3)" }}>
                      {(fav.image_url || fav.thumbnail) ? (
                        <img
                          src={quoteImageUrl(fav)}
                          alt={fav.product_name || fav.name}
                          className="h-full w-full object-contain p-3"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
                          <Package className="h-8 w-8" style={{ color: "rgba(255,255,255,0.45)" }} />
                        </div>
                      )}
                    </div>

                    <div className="px-4 pt-3 pb-4 space-y-2">
                      <p className="text-sm font-medium truncate leading-tight" style={{ color: "#ffffff" }}>
                        {fav.product_name || fav.name}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.18em] truncate" style={{ color: "rgba(255,255,255,0.65)" }}>{fav.manufacturer_name}</p>

                      {/* Price */}
                      {showPricing && priceInfo.isTrade && priceInfo.price && (
                        <div className="text-xs">
                          <span style={{ color: "white" }}>
                            <span className="text-[9px] mr-0.5 opacity-60">Trade </span>
                            {formatUsd(priceInfo.price)}
                          </span>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() => handleAddToQuote(fav)}
                          disabled={alreadyInQuote}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={
                            alreadyInQuote
                              ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", cursor: "default" }
                              : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.10)" }
                          }
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
                          className="p-1.5 rounded-lg transition-colors hover:text-red-400"
                          style={{ color: "rgba(255,255,255,0.45)" }}
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
            <FileText className="h-4 w-4" style={{ color: "rgba(255,255,255,0.65)" }} />
            <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.65)" }}>
              Quote Builder
            </h2>
            {totalItems > 0 && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.10)" }}>
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
            )}
          </div>

          {/* Quote header card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="atelier-panel overflow-hidden mb-4"
          >
            <div className="px-4 py-4 sm:px-6 sm:py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
                <div className="flex items-center gap-2">
                  {/* Pricing toggle */}
                  <button
                    onClick={toggleShowPricing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors"
                    style={
                      showPricing
                        ? { color: "rgba(255,255,255,0.65)", background: "rgba(184,149,106,0.06)", border: "1px solid rgba(184,149,106,0.15)" }
                        : { color: "rgba(255,255,255,0.45)", border: "1px solid transparent" }
                    }
                    title={showPricing ? "Hide pricing" : "Show pricing"}
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    {showPricing ? "Pricing on" : "Pricing off"}
                  </button>

                </div>
              </div>

              {/* Project name — always visible input */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>Project Name</label>
                <input
                  ref={nameRef}
                  value={quote.name || ""}
                  onChange={(e) => handleSaveName("name", e.target.value)}
                  placeholder="e.g., Thompson Residence — Living Room Refresh"
                  className="w-full rounded-lg px-4 py-3 text-base font-medium focus:outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                />

                {/* Client name */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <label className="text-[9px] uppercase tracking-[0.2em] font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>Client</label>
                    <input
                      ref={clientRef}
                      value={quote.client_name || ""}
                      onChange={(e) => handleSaveName("client_name", e.target.value)}
                      placeholder="Client name"
                      className="w-full mt-1 rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Designer Info — always visible */}
            <div className="px-4 py-4 sm:px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(184,149,106,0.03)" }}>
              <div className="text-[9px] uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: "rgba(255,255,255,0.65)" }}>
                Your Info (appears on PDF)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={settings.business_name}
                  onChange={(e) => handleSaveSettings({ business_name: e.target.value })}
                  placeholder="Business name"
                  className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                />
                <input
                  value={settings.designer_name}
                  onChange={(e) => handleSaveSettings({ designer_name: e.target.value })}
                  placeholder="Designer name"
                  className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                />
                <input
                  value={settings.email}
                  onChange={(e) => handleSaveSettings({ email: e.target.value })}
                  placeholder="Email"
                  className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                />
                <input
                  value={settings.phone}
                  onChange={(e) => handleSaveSettings({ phone: e.target.value })}
                  placeholder="Phone"
                  className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                />
              </div>

              {/* Logo upload — always visible */}
              <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                {settings.logo_data_url ? (
                  <>
                    <div className="h-10 w-20 rounded-lg flex items-center justify-center overflow-hidden p-1" style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)" }}>
                      <img src={settings.logo_data_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                    <button
                      onClick={() => handleSaveSettings({ logo_data_url: "" })}
                      className="flex items-center gap-1 text-[10px] transition-colors hover:text-red-500"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      <X className="h-3 w-3" />
                      Remove
                    </button>
                  </>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border-dashed text-[10px] transition-colors" style={{ border: "1px dashed rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.45)" }}>
                    <ImagePlus className="h-3.5 w-3.5" />
                    Upload your logo (appears on PDF cover)
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        // Resize logo client-side to fit cleanly on quotes
                        const MAX_W = 400, MAX_H = 200;
                        const img = new Image();
                        img.onload = () => {
                          const scale = Math.min(MAX_W / img.width, MAX_H / img.height, 1);
                          const w = Math.round(img.width * scale);
                          const h = Math.round(img.height * scale);
                          const canvas = document.createElement("canvas");
                          canvas.width = w;
                          canvas.height = h;
                          const ctx = canvas.getContext("2d");
                          ctx.drawImage(img, 0, 0, w, h);
                          const dataUrl = canvas.toDataURL("image/png", 0.9);
                          handleSaveSettings({ logo_data_url: dataUrl });
                          URL.revokeObjectURL(img.src);
                        };
                        img.onerror = () => {
                          alert("Could not load image. Try a different file.");
                          URL.revokeObjectURL(img.src);
                        };
                        img.src = URL.createObjectURL(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          </motion.div>

          {/* Rooms + Items */}
          {/* Mobile hint for actions */}
          {totalItems > 0 && (
            <p className="sm:hidden text-[10px] mb-2 text-center" style={{ color: "rgba(255,255,255,0.45)" }}>
              Tap an item to see swap, notes, and delete options
            </p>
          )}

          {totalItems === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="editorial-card linen-surface py-20 flex flex-col items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Package className="h-12 w-12 mb-4" style={{ color: "rgba(255,255,255,0.45)" }} />
              <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.65)" }}>No quote boards yet</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                Save standout pieces from search, arrange them into rooms, and this space becomes your client-ready presentation deck.
              </p>
            </motion.div>
          ) : (
            <>
            <div className="space-y-2">
              {quote.rooms.map((room, roomIndex) => {
                const roomTheme = ROOM_ACCENTS[roomIndex % ROOM_ACCENTS.length];
                return (
                <motion.div
                  key={room.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="atelier-panel overflow-hidden linen-surface"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {/* Room Header */}
                  <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="px-4 pt-4 pb-4 sm:px-5 sm:pt-5" style={{ background: `linear-gradient(135deg, ${roomTheme.wash}, rgba(255,255,255,0.5))` }}>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: roomTheme.accent, boxShadow: `0 0 20px ${roomTheme.wash}` }} />
                          <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: roomTheme.accent }}>
                            Room
                          </span>
                        </div>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>{room.items.length} curated selections</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => setExpandedRooms((prev) => ({ ...prev, [room.id]: !prev[room.id] }))}
                          className="transition-colors"
                          style={{ color: "rgba(255,255,255,0.65)" }}
                        >
                          {expandedRooms[room.id] ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          {editingRoomId === room.id ? (
                            <input
                              autoFocus
                              defaultValue={room.name}
                              className="w-full rounded px-2 py-1 text-xs focus:outline-none"
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                              onBlur={(e) => handleRenameRoom(room.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleRenameRoom(room.id, e.target.value);
                              }}
                            />
                          ) : (
                            <button
                              onClick={() => setEditingRoomId(room.id)}
                            className="text-left"
                          >
                              <div className="text-xs sm:text-sm font-semibold uppercase tracking-[0.18em] transition-colors" style={{ color: "#ffffff" }}>
                                {room.name}
                              </div>
                              <div className="mt-1 text-[11px] sm:text-[12px] leading-5" style={{ color: "rgba(255,255,255,0.45)" }}>
                                Saved items, pricing, notes, and export-ready details for this room.
                              </div>
                            </button>
                          )}
                        </div>

                        {showPricing && getRoomTotal(room) > 0 && (
                          <span className="rounded-full px-3 py-1.5 text-[10px] font-medium" style={{ background: roomTheme.wash, color: roomTheme.accent, border: `1px solid ${roomTheme.wash}` }}>
                            {formatUsd(getRoomTotal(room))}
                          </span>
                        )}

                        {quote.rooms.length > 1 && room.items.length === 0 && (
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="p-1 transition-colors hover:text-red-500"
                            style={{ color: "rgba(255,255,255,0.45)" }}
                            title="Delete room"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {room.items.length > 0 && (
                      <div className="grid gap-2 px-4 py-3 sm:px-5 sm:grid-cols-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="rounded-2xl px-4 py-3" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.5)" }}>
                          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>Pieces</div>
                          <div className="mt-1 text-xl font-semibold" style={{ color: "#ffffff" }}>{room.items.length}</div>
                        </div>
                        <div className="rounded-2xl px-4 py-3" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.5)" }}>
                          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>Vendors</div>
                          <div className="mt-1 text-xl font-semibold" style={{ color: "#ffffff" }}>{new Set(room.items.map((i) => i.manufacturer_name).filter(Boolean)).size}</div>
                        </div>
                        <div className="rounded-2xl px-4 py-3" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.5)" }}>
                          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.45)" }}>Direction</div>
                          <div className="mt-1 text-xl font-semibold" style={{ color: "#ffffff" }}>Ready</div>
                        </div>
                      </div>
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
                            onCustomPrice={(p) => handleCustomPrice(item.id, p)}
                            onMoveToRoom={(rid) => handleMoveToRoom(item.id, rid)}
                            onSwap={() => handleSwap(item)}
                            getItemPrice={() => getItemPrice(item)}
                            getItemPriceInfo={() => getItemPriceInfo(item)}
                            showPricing={showPricing}
                            justification={justifications[item.id] || null}
                            justifyLoading={!!justifyLoading[item.id]}
                            onWhyThisPiece={() => handleWhyThisPiece(item, room)}
                            onUpdateJustification={handleUpdateJustification}
                            clientFeedback={getItemFeedback(item.id)}
                            presentationMode
                          />
                        ))}
                        {/* Generate All Justifications */}
                        {room.items.length >= 2 && (
                          <div className="px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <button
                              onClick={() => handleGenerateAllJustifications(room)}
                              disabled={justifyBatchLoading === room.id}
                              className="flex items-center gap-1.5 text-[10px] font-medium transition-colors disabled:opacity-40"
                              style={{ color: "rgba(255,255,255,0.65)" }}
                            >
                              {justifyBatchLoading === room.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Sparkles className="h-3 w-3" />
                              )}
                              {justifyBatchLoading === room.id ? "Generating justifications..." : "Generate All — Why These Pieces"}
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )})}

              {/* Add Room */}
              <div className="pt-1">
                {showAddRoom ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex max-w-sm flex-col gap-2 sm:flex-row"
                  >
                    <input
                      autoFocus
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      placeholder="Room name"
                      className="flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddRoom();
                        if (e.key === "Escape") setShowAddRoom(false);
                      }}
                    />
                    <button
                      onClick={handleAddRoom}
                      className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                      style={{ background: "rgba(184,149,106,0.15)", color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.10)" }}
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddRoom(false)}
                      className="px-3 py-2 rounded-lg text-xs transition-colors"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      Cancel
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setShowAddRoom(true)}
                    className="flex items-center gap-2 text-xs transition-colors py-2"
                    style={{ color: "rgba(255,255,255,0.45)" }}
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
                className="atelier-panel paper-grain mt-4 space-y-4 px-4 py-4 sm:px-6 sm:py-5"
                style={{ backdropFilter: "blur(12px)" }}
              >
                {/* Markup toggle */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setShowMarkup(!showMarkup)}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-wider transition-colors"
                    style={{ color: "rgba(255,255,255,0.45)" }}
                  >
                    <DollarSign className="h-3 w-3" />
                    Designer markup
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${showMarkup ? "rotate-180" : ""}`}
                    />
                  </button>
                  {quote.markup_percent > 0 && (
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.65)" }}>+{quote.markup_percent}%</span>
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
                      <div className="flex flex-col items-start gap-2 py-1 sm:flex-row sm:items-center sm:gap-3">
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>Markup %</span>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={quote.markup_percent || ""}
                          onChange={(e) => handleMarkup(e.target.value)}
                          placeholder="0"
                          className="w-20 rounded px-2 py-1 text-xs text-center focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                        />
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                          Client sees marked-up price. Trade price stays hidden.
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Room subtotals + grand total */}
                {showPricing && (
                  <div className="space-y-1.5">
                    {quote.rooms
                      .filter((r) => r.items.length > 0)
                      .map((room) => (
                        <div key={room.id} className="flex justify-between text-xs">
                          <span style={{ color: "rgba(255,255,255,0.45)" }}>{room.name}</span>
                          <span style={{ color: "rgba(255,255,255,0.65)" }}>
                            {getRoomTotal(room) > 0
                              ? formatUsd(getRoomTotal(room))
                              : "Price on request"}
                          </span>
                        </div>
                      ))}

                    <div className="flex justify-between text-sm font-semibold pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <span style={{ color: "rgba(255,255,255,0.65)" }}>Total</span>
                      <span style={{ color: "#ffffff" }}>
                        {grandTotal > 0 ? formatUsd(grandTotal) : "Prices on request"}
                      </span>
                    </div>
                    {itemsWithoutPrice.length > 0 && (
                      <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                        {itemsWithoutPrice.length}{" "}
                        {itemsWithoutPrice.length === 1 ? "item" : "items"} pending pricing
                      </div>
                    )}
                  </div>
                )}

                {/* Trade mode indicator */}
                {mode === "trade" && hasDiscounts && (
                  <div className="flex items-center gap-2 text-[10px]" style={{ color: "white" }}>
                    <span className="uppercase tracking-wider font-semibold">Trade pricing active</span>
                  </div>
                )}

                <div className="rounded-[22px] px-4 py-4" style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.5)" }}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.65)" }}>Presentation Export</div>
                      <p className="mt-1 text-[12px] leading-5" style={{ color: "rgba(255,255,255,0.65)" }}>
                        Client PDFs are designed for review. Trade PDFs preserve internal pricing context for your team.
                      </p>
                    </div>
                    {generating && (
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {generatingLabel || "Preparing export..."}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-1 sm:flex-row flex-col">
                  <button
                    onClick={() => handleGeneratePdf("client")}
                    disabled={generating}
                    className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 sm:w-auto w-full"
                    style={{
                      background: "white",
                      color: "black",
                    }}
                    title="Client-facing PDF with retail/marked-up prices"
                  >
                    <Download className="h-4 w-4" />
                    {generating && generatingLabel ? "Preparing..." : "Client PDF"}
                  </button>

                  {mode === "trade" && hasDiscounts && (
                    <button
                      onClick={() => handleGeneratePdf("trade")}
                      disabled={generating}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                      style={{
                        background: "rgba(255,255,255,0.12)",
                        border: "1px solid rgba(255,255,255,0.20)",
                        color: "white",
                      }}
                      title="Internal PDF with trade prices"
                    >
                      <Download className="h-4 w-4" />
                      Trade PDF
                    </button>
                  )}

                  <button
                    onClick={handleShareLink}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium transition-all sm:w-auto w-full"
                    style={
                      shareCopied
                        ? { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.20)", color: "white" }
                        : { background: "rgba(184,149,106,0.10)", border: "1px solid rgba(184,149,106,0.20)", color: "rgba(255,255,255,0.65)" }
                    }
                    title="Share interactive client approval portal"
                  >
                    {shareCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Link Copied!
                      </>
                    ) : (
                      <>
                        <Link2 className="h-3.5 w-3.5" />
                        {shareToken ? "Update & Copy Link" : "Client Approval Portal"}
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleClear}
                    className="px-5 py-2.5 rounded-xl text-xs transition-all sm:w-auto w-full hover:text-red-500"
                    style={{ color: "rgba(255,255,255,0.45)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    Clear Quote
                  </button>
                </div>

                {/* Client Feedback Summary */}
                {Object.keys(clientFeedback).length > 0 && (
                  <div className="mt-4 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-4 w-4" style={{ color: "rgba(255,255,255,0.65)" }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.65)" }}>Client Feedback</span>
                      {shareToken && (
                        <span className="ml-auto text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>v{localStorage.getItem("spec_share_version") || "1"}</span>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span style={{ color: "rgba(44,162,80,0.85)" }}>
                        {Object.values(clientFeedback).filter(f => f.status === "approved").length} approved
                      </span>
                      <span style={{ color: "rgba(180,120,40,0.85)" }}>
                        {Object.values(clientFeedback).filter(f => f.status === "change").length} changes
                      </span>
                      <span style={{ color: "rgba(220,50,50,0.85)" }}>
                        {Object.values(clientFeedback).filter(f => f.status === "rejected").length} rejected
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── Share Modal ── */}
            <AnimatePresence>
              {showShareModal && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
                  onClick={(e) => { if (e.target === e.currentTarget) setShowShareModal(false); }}
                >
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="paper-grain w-full max-w-md rounded-[28px] p-6"
                    style={{ background: "#000000", border: "1px solid rgba(255,255,255,0.10)" }}
                  >
                    <div className="mb-5 rounded-[22px] px-4 py-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.65)" }}>Client Portal</div>
                      <p className="mt-2 text-[12px] leading-6" style={{ color: "rgba(255,255,255,0.65)" }}>
                        Share a composed approval link where clients can review rooms, comment on pieces, and respond without creating an account.
                      </p>
                    </div>
                    <h3 className="text-lg font-semibold mb-1" style={{ color: "#ffffff" }}>
                      {shareToken ? "Update Client Portal" : "Share with Client"}
                    </h3>
                    <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.45)" }}>
                      Your client will see an interactive approval experience — no account needed.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(255,255,255,0.45)" }}>Personal Note (optional)</label>
                        <textarea
                          value={shareNote}
                          onChange={(e) => setShareNote(e.target.value)}
                          placeholder="Hi! Here are my initial selections for your living room. Let me know what you think..."
                          className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "rgba(255,255,255,0.45)" }}>Client Email (optional — sends notification)</label>
                        <input
                          type="email"
                          value={shareClientEmail}
                          onChange={(e) => setShareClientEmail(e.target.value)}
                          placeholder="client@email.com"
                          className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", color: "#ffffff" }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => setShowShareModal(false)}
                        className="flex-1 py-2.5 rounded-xl text-sm transition-all"
                        style={{ color: "rgba(255,255,255,0.65)", border: "1px solid rgba(255,255,255,0.10)" }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateShareLink}
                        disabled={shareLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: "white",
                          color: "black",
                        }}
                      >
                        {shareLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                        {shareToken ? "Update & Copy Link" : "Create & Copy Link"}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {actionToast && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  className="fixed bottom-6 left-1/2 z-[85] -translate-x-1/2 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-xl"
                  style={{ background: "white", border: "1px solid rgba(255,255,255,0.15)" }}
                >
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: "black" }}>
                    <Check className="h-3.5 w-3.5" style={{ color: "#C2CCBA" }} />
                    {actionToast}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            </>
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
  onCustomPrice,
  onMoveToRoom,
  onSwap,
  getItemPrice,
  getItemPriceInfo,
  showPricing,
  justification,
  justifyLoading,
  onWhyThisPiece,
  onUpdateJustification,
  clientFeedback,
  presentationMode = false,
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [editingJustification, setEditingJustification] = useState(false);

  const price = getItemPrice();
  const priceInfo = getItemPriceInfo?.() || { isTrade: false };
  const dims = dimStr(item);

  const feedbackBorderClass = clientFeedback?.status === "approved" ? "border-l-2 border-l-emerald-500/40" :
    clientFeedback?.status === "change" ? "border-l-2 border-l-amber-500/40" :
    clientFeedback?.status === "rejected" ? "border-l-2 border-l-red-500/40" : "";

  return (
    <div
      className={`px-5 py-4 transition-colors group last:border-b-0 ${feedbackBorderClass} ${presentationMode ? "paper-grain" : ""}`}
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
    >
      <div className="flex gap-4 sm:flex-row flex-col">
        {/* Thumbnail — clicks through to vendor product page */}
        <a
          href={item.portal_url || item.product_url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { if (!item.portal_url && !item.product_url) e.preventDefault(); }}
          className={`flex-shrink-0 w-28 h-28 rounded-[20px] overflow-hidden sm:mx-0 mx-auto block transition-colors ${(item.portal_url || item.product_url) ? "cursor-pointer" : ""}`}
          style={{ background: "linear-gradient(180deg, #f7f1e8, #ece1d3)", border: "1px solid rgba(255,255,255,0.08)" }}
          title={item.portal_url || item.product_url ? "Open vendor product page" : ""}
        >
          {item.image_url ? (
            <img
              src={quoteImageUrl(item)}
              alt={item.product_name}
              className="h-full w-full object-contain p-2"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)" }}>
              <Package className="h-6 w-6" style={{ color: "rgba(255,255,255,0.45)" }} />
            </div>
          )}
        </a>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {item.portal_url || item.product_url ? (
              <a
                href={item.portal_url || item.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate transition-colors"
                style={{ color: "#ffffff", fontSize: presentationMode ? "18px" : "16px", fontWeight: presentationMode ? 600 : 500 }}
                title="Open vendor product page — check pricing"
              >
                {item.product_name}
              </a>
            ) : (
              <div className="text-sm font-medium truncate" style={{ color: "#ffffff" }}>{item.product_name}</div>
            )}
            {(item.portal_url || item.product_url) && (
              <a
                href={item.portal_url || item.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 transition-colors"
                style={{ color: "rgba(255,255,255,0.45)" }}
                title="Open vendor page"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] truncate" style={{ color: "rgba(255,255,255,0.65)" }}>{item.manufacturer_name}</div>
          {item.sku && <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>SKU: {item.sku}</div>}
          {dims && <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{dims}</div>}

          {/* Client Feedback Badge */}
          {clientFeedback && (
            <div
              className="mt-1.5 flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[11px]"
              style={
                clientFeedback.status === "approved"
                  ? { background: "rgba(44,162,80,0.08)", border: "1px solid rgba(44,162,80,0.15)" }
                  : clientFeedback.status === "change"
                  ? { background: "rgba(180,120,40,0.08)", border: "1px solid rgba(180,120,40,0.15)" }
                  : { background: "rgba(220,50,50,0.08)", border: "1px solid rgba(220,50,50,0.15)" }
              }
            >
              {clientFeedback.status === "approved" && <Check className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "rgba(44,162,80,0.8)" }} />}
              {clientFeedback.status === "change" && <Edit3 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "rgba(180,120,40,0.8)" }} />}
              {clientFeedback.status === "rejected" && <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "rgba(220,50,50,0.8)" }} />}
              <div>
                <span
                  className="font-medium"
                  style={{
                    color: clientFeedback.status === "approved" ? "rgba(44,162,80,0.85)" :
                           clientFeedback.status === "change" ? "rgba(180,120,40,0.85)" :
                           "rgba(220,50,50,0.85)"
                  }}
                >
                  {clientFeedback.status === "approved" ? "Client Approved" :
                   clientFeedback.status === "change" ? "Change Requested" :
                   "Client Rejected"}
                </span>
                {clientFeedback.comment && (
                  <p className="mt-0.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.65)" }}>"{clientFeedback.comment}"</p>
                )}
              </div>
            </div>
          )}

          {/* Quantity & Price */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-0.5 rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.5)" }}>
              <button
                onClick={() => onQuantity(-1)}
                className="px-2.5 py-1.5 transition-colors"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-xs w-7 text-center" style={{ color: "rgba(255,255,255,0.65)" }}>{item.quantity || 1}</span>
              <button
                onClick={() => onQuantity(1)}
                className="px-2.5 py-1.5 transition-colors"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {showPricing && (
              <>
                {editingPrice ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>$</span>
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={item.custom_price || price || ""}
                      placeholder="Enter price"
                      className="w-24 rounded px-2 py-1 text-xs focus:outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(184,149,106,0.30)", color: "#ffffff" }}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onCustomPrice(val);
                        setEditingPrice(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = parseFloat(e.target.value) || 0;
                          onCustomPrice(val);
                          setEditingPrice(false);
                        }
                        if (e.key === "Escape") setEditingPrice(false);
                      }}
                    />
                    {item.custom_price > 0 && (
                      <button
                        onClick={() => { onCustomPrice(0); setEditingPrice(false); }}
                        className="text-[9px] transition-colors hover:text-red-500"
                        style={{ color: "rgba(255,255,255,0.45)" }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {price ? (
                      <span className="text-xs" style={{ color: priceInfo.isCustom ? "#B8956A" : priceInfo.isTrade ? "#2C3E2D" : "#6B6560" }}>
                        {priceInfo.isCustom && <span className="text-[9px] mr-0.5 opacity-70">Custom </span>}
                        {priceInfo.isTrade && <span className="text-[9px] mr-0.5 opacity-70">Est. Trade </span>}
                        {formatUsd(price)}
                        {(item.quantity || 1) > 1 && (
                          <span style={{ color: priceInfo.isCustom ? "rgba(184,149,106,0.5)" : priceInfo.isTrade ? "rgba(44,62,45,0.5)" : "#9B9590" }}>
                            {" "}x{item.quantity} = {formatUsd(price * (item.quantity || 1))}
                          </span>
                        )}
                      </span>
                    ) : null}
                    <button
                      onClick={() => setEditingPrice(true)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors"
                      style={
                        price
                          ? { border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.45)" }
                          : { border: "1px solid rgba(184,149,106,0.20)", background: "rgba(184,149,106,0.06)", color: "rgba(255,255,255,0.65)" }
                      }
                      title={price ? "Edit price" : "Enter price from vendor page"}
                    >
                      <Edit3 className="h-2.5 w-2.5" />
                      {price ? "Edit" : "Enter price"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions column */}
        <div className="flex sm:flex-col flex-row items-center sm:items-end gap-1 sm:opacity-0 opacity-100 group-hover:opacity-100 transition-opacity sm:justify-start justify-center">
          {/* Swap */}
          <button
            onClick={onSwap}
            className="p-1.5 transition-colors"
            style={{ color: "rgba(255,255,255,0.45)" }}
            title="Swap — find similar products"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>

          {/* Why This Piece */}
          <button
            onClick={onWhyThisPiece}
            disabled={justifyLoading}
            className="p-1.5 transition-colors"
            style={{ color: justification ? "#B8956A" : "#9B9590" }}
            title={justification ? "Regenerate design justification" : "Why This Piece — AI design justification"}
          >
            {justifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          </button>

          {/* Notes */}
          <button
            onClick={() => setShowNotes(!showNotes)}
            className="p-1.5 transition-colors"
            style={{ color: "rgba(255,255,255,0.45)" }}
            title="Add notes"
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </button>

          {/* Move to room */}
          {rooms.length > 1 && (
            <div className="relative">
              <button
                onClick={() => setShowMoveMenu(!showMoveMenu)}
                className="p-1.5 transition-colors"
                style={{ color: "rgba(255,255,255,0.45)" }}
                title="Move to room"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
              {showMoveMenu && (
                <div
                  className="absolute right-0 top-full z-10 w-40 py-1 rounded-lg shadow-xl"
                  style={{
                    background: "#000000",
                    border: "1px solid rgba(255,255,255,0.10)",
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
                        className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                        style={{ color: "rgba(255,255,255,0.65)" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#1A1A18"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ""; e.currentTarget.style.color = "#6B6560"; }}
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
            className="p-1.5 transition-colors hover:text-red-500"
            style={{ color: "rgba(255,255,255,0.45)" }}
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
              className="w-full mt-2.5 rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.65)" }}
              rows={2}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Design justification */}
      {justification && (
        <div className="mt-2 ml-0 sm:ml-28">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3 w-3" style={{ color: "rgba(255,255,255,0.65)" }} />
            <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.65)" }}>Design Justification</span>
            <button onClick={() => setEditingJustification(!editingJustification)}
              className="text-[9px] transition-colors"
              style={{ color: "rgba(255,255,255,0.45)" }}>
              {editingJustification ? "Done" : "Edit"}
            </button>
            <button onClick={onWhyThisPiece} disabled={justifyLoading}
              className="text-[9px] transition-colors"
              style={{ color: "rgba(255,255,255,0.45)" }}>
              {justifyLoading ? "..." : "Regenerate"}
            </button>
          </div>
          {editingJustification ? (
            <textarea
              value={justification}
              onChange={(e) => onUpdateJustification(item.id, e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-[11px] leading-relaxed focus:outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(184,149,106,0.15)", color: "rgba(255,255,255,0.65)" }}
              rows={3}
            />
          ) : (
            <p className="text-[11px] leading-relaxed italic" style={{ color: "rgba(255,255,255,0.65)" }}>{justification}</p>
          )}
        </div>
      )}
    </div>
  );
}
