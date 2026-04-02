import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, HeartOff, Plus, Minus, Trash2, FileText, ChevronDown, ChevronRight,
  Edit3, Download, FolderPlus, Package, DollarSign, MessageSquare, Settings,
  ArrowRightLeft, Search, XCircle, ShoppingBag, Star, ImagePlus, X, Link2, Check, ExternalLink,
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
  { accent: "#c6a16a", wash: "rgba(198,161,106,0.12)", label: "Amber" },
  { accent: "#8ea6b9", wash: "rgba(142,166,185,0.12)", label: "Mist" },
  { accent: "#8f9779", wash: "rgba(143,151,121,0.12)", label: "Sage" },
  { accent: "#b5897b", wash: "rgba(181,137,123,0.12)", label: "Clay" },
];

/* ─── main page ───────────────────────────────────────────── */

export default function Quotes() {
  const navigate = useNavigate();
  const { user, navigateToLogin } = useAuth();
  const { mode, getPrice, fmtPrice, hasDiscounts, showPricing, toggleShowPricing } = useTradePricing();

  // Gate: must be logged in to access quotes
  if (!user) {
    return (
      <div className="min-h-screen bg-[#1c1917] text-white">
        <div className="max-w-lg mx-auto px-4 py-32 flex flex-col items-center text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-6"
            style={{ background: "rgba(196,168,130,0.1)", border: "1px solid rgba(196,168,130,0.2)" }}
          >
            <Lock className="h-7 w-7 text-[#c4a882]" />
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
                background: "linear-gradient(135deg, #c4a882, #B8944F)",
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
    (q?.rooms || []).forEach((r) => { expanded[r.id] = true; });
    return expanded;
  });

  const [editingRoomId, setEditingRoomId] = useState(null);
  const [showMarkup, setShowMarkup] = useState(false);
  const [presentationMode, setPresentationMode] = useState(() => {
    try { return localStorage.getItem("spekd_quote_presentation_mode") !== "0"; } catch { return true; }
  });
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
    setJustifyBatchLoading(room.id);
    try {
      const resp = await fetch(`${SEARCH_SERVICE}/why-this-piece-batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          products: room.items,
          room_name: room.name,
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      const data = await resp.json();
      const updated = { ...justifications };
      for (const j of (data.justifications || [])) {
        const product = room.items[j.product_index];
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

  useEffect(() => {
    try { localStorage.setItem("spekd_quote_presentation_mode", presentationMode ? "1" : "0"); } catch {}
  }, [presentationMode]);

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
    // Paywall gate: require active subscription for PDF generation
    const subStatus = localStorage.getItem("spec_sub_status");
    if (subStatus !== "active" && subStatus !== "trialing" && subStatus !== "cancelled") {
      alert("Upgrade to Pro to generate PDFs");
      return;
    }
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
    <div className={`min-h-screen bg-[#120f0d] text-white ${presentationMode ? "presentation-mode" : ""}`}>
      <div className="page-wrap-wide py-10 pb-48 sm:pb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`atelier-panel mb-10 px-6 py-8 sm:px-8 md:px-10 ${presentationMode ? "paper-grain" : ""}`}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="workspace-kicker mb-5">Quote studio</div>
              <h1 className="workspace-heading max-w-4xl">Build polished client-facing presentations without leaving the sourcing flow.</h1>
              <p className="workspace-subhead mt-4">
                Organize saved pieces into rooms, adjust pricing, generate PDFs, and share approval links from a workspace that feels curated instead of purely transactional.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[440px]">
              <div className="atelier-panel-soft px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">Saved</div>
                <div className="mt-2 text-2xl font-semibold text-white/92">{favorites.length}</div>
                <div className="mt-1 text-xs text-white/40">Products ready to spec</div>
              </div>
              <div className="atelier-panel-soft px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">Rooms</div>
                <div className="mt-2 text-2xl font-semibold text-white/92">{quote.rooms.length}</div>
                <div className="mt-1 text-xs text-white/40">Presentation groupings</div>
              </div>
              <div className="atelier-panel-soft px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">Quote total</div>
                <div className="mt-2 text-2xl font-semibold text-white/92">{showPricing && grandTotal > 0 ? formatUsd(grandTotal) : "POR"}</div>
                <div className="mt-1 text-xs text-white/40">Live estimate</div>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPresentationMode(!presentationMode)}
              className={`control-chip flex items-center gap-2 px-3 py-1.5 text-[11px] transition-all ${presentationMode ? "bg-gold text-[#161413]" : "text-white/46 hover:text-white/74"}`}
            >
              <Star className="h-3 w-3" />
              {presentationMode ? "Presentation Mode" : "Workspace Mode"}
            </button>
            <span className="text-[11px] text-white/28">
              {presentationMode ? "Cleaner room boards, calmer chrome, client-ready detail." : "Full editing surfaces and utility controls."}
            </span>
          </div>
          {totalItems > 0 && (
            <div className="mt-6 grid gap-3 lg:grid-cols-[1.35fr_0.65fr]">
              <div className="atelier-panel-soft paper-grain px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-gold/55">Presentation Direction</div>
                <p className="mt-2 text-[13px] leading-6 text-white/62">
                  This quote now reads like a compact design deck: stronger room framing, cleaner executive totals, and more composed export rhythm for client review.
                </p>
              </div>
              <div className="atelier-panel-soft px-4 py-4">
                <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">Export readiness</div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="text-2xl font-semibold text-white/92">{Math.round(((quote.rooms.filter((r) => r.items.length > 0).length > 0 ? 1 : 0) + (quote.name ? 1 : 0) + (settings.designer_name ? 1 : 0) + (settings.business_name ? 1 : 0)) / 4 * 100)}%</div>
                  <div className="text-right text-[11px] leading-5 text-white/34">
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
              className="editorial-card paper-grain py-14 flex flex-col items-center justify-center"
              style={{ background: "rgba(255,255,255,0.01)" }}
            >
              <HeartOff className="h-8 w-8 text-white/10 mb-3" />
              <p className="text-sm text-white/30 mb-1">No saved products yet</p>
              <p className="text-xs text-white/15">Save products while browsing and this board becomes your staging area for room stories, spec review, and client-ready quote export.</p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
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
                    <div className="relative aspect-square border-b border-white/[0.06] overflow-hidden" style={{ background: "linear-gradient(180deg, #f7f1e8, #ece1d3)" }}>
                      {(fav.image_url || fav.thumbnail) ? (
                        <img
                          src={quoteImageUrl(fav)}
                          alt={fav.product_name || fav.name}
                          className="h-full w-full object-contain p-3"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-white/[0.03]">
                          <Package className="h-8 w-8 text-white/10" />
                        </div>
                      )}
                    </div>

                    <div className="px-4 pt-3 pb-4 space-y-2">
                      <p className="text-sm font-medium text-white/86 truncate leading-tight">
                        {fav.product_name || fav.name}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-gold/60 truncate">{fav.manufacturer_name}</p>

                      {/* Price */}
                      {showPricing && (
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
                      )}

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
            className="atelier-panel overflow-hidden mb-4"
          >
            <div className="px-6 py-5 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] text-white/20">
                  {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
                <div className="flex items-center gap-2">
                  {/* Pricing toggle */}
                  <button
                    onClick={toggleShowPricing}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] transition-colors ${
                      showPricing
                        ? "text-gold/60 hover:text-gold/80 bg-gold/[0.06] border border-gold/15"
                        : "text-white/25 hover:text-white/40 hover:bg-white/[0.04] border border-transparent"
                    }`}
                    title={showPricing ? "Hide pricing" : "Show pricing"}
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    {showPricing ? "Pricing on" : "Pricing off"}
                  </button>

                </div>
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

            {/* Designer Info — always visible */}
            <div className="px-6 py-4 border-b border-white/[0.06]" style={{ background: "rgba(196,168,130,0.03)" }}>
              <div className="text-[9px] uppercase tracking-[0.2em] text-gold/40 font-semibold mb-3">
                Your Info (appears on PDF)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={settings.business_name}
                  onChange={(e) => handleSaveSettings({ business_name: e.target.value })}
                  placeholder="Business name"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 transition-colors"
                />
                <input
                  value={settings.designer_name}
                  onChange={(e) => handleSaveSettings({ designer_name: e.target.value })}
                  placeholder="Designer name"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 transition-colors"
                />
                <input
                  value={settings.email}
                  onChange={(e) => handleSaveSettings({ email: e.target.value })}
                  placeholder="Email"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 transition-colors"
                />
                <input
                  value={settings.phone}
                  onChange={(e) => handleSaveSettings({ phone: e.target.value })}
                  placeholder="Phone"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 transition-colors"
                />
              </div>

              {/* Logo upload — always visible */}
              <div className="mt-3 flex items-center gap-3">
                {settings.logo_data_url ? (
                  <>
                    <div className="h-10 w-20 rounded-lg border border-white/[0.08] bg-white/[0.03] flex items-center justify-center overflow-hidden p-1">
                      <img src={settings.logo_data_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                    </div>
                    <button
                      onClick={() => handleSaveSettings({ logo_data_url: "" })}
                      className="flex items-center gap-1 text-[10px] text-white/25 hover:text-red-400/60 transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Remove
                    </button>
                  </>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-dashed border-white/[0.08] hover:border-gold/30 text-[10px] text-white/25 hover:text-white/40 transition-colors">
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
            <p className="sm:hidden text-[10px] text-white/15 mb-2 text-center">
              Tap an item to see swap, notes, and delete options
            </p>
          )}

          {totalItems === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="editorial-card linen-surface py-20 flex flex-col items-center justify-center"
              style={{ background: "rgba(255,255,255,0.01)" }}
            >
              <Package className="h-12 w-12 text-white/10 mb-4" />
              <p className="text-sm text-white/40 mb-1">No quote boards yet</p>
              <p className="text-xs text-white/20">
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
                  className={`atelier-panel overflow-hidden ${presentationMode ? "linen-surface" : ""}`}
                  style={{ background: "rgba(255,255,255,0.015)" }}
                >
                  {/* Room Header */}
                  <div className="border-b border-white/[0.04]">
                    <div className="px-5 pt-5 pb-4" style={{ background: `linear-gradient(135deg, ${roomTheme.wash}, rgba(255,255,255,0.015))` }}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: roomTheme.accent, boxShadow: `0 0 20px ${roomTheme.wash}` }} />
                          <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: roomTheme.accent }}>
                            {roomTheme.label} room story
                          </span>
                        </div>
                        <span className="text-[10px] text-white/24">{room.items.length} curated selections</span>
                      </div>
                      <div className="flex items-center gap-3">
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

                        <div className="flex-1 min-w-0">
                          {editingRoomId === room.id ? (
                            <input
                              autoFocus
                              defaultValue={room.name}
                              className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-gold/30"
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
                              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/72 transition-colors hover:text-white/88">
                                {room.name}
                              </div>
                              <div className="mt-1 text-[12px] text-white/34">
                                A presentation layer for this room with sourcing notes, pricing, and client-ready narrative.
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
                            className="p-1 text-white/15 hover:text-red-400/60 transition-colors"
                            title="Delete room"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {room.items.length > 0 && (
                      <div className="grid gap-2 border-t border-white/[0.04] px-5 py-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/24">Pieces</div>
                          <div className="mt-1 text-xl font-semibold text-white/86">{room.items.length}</div>
                        </div>
                        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/24">Vendors</div>
                          <div className="mt-1 text-xl font-semibold text-white/86">{new Set(room.items.map((i) => i.manufacturer_name).filter(Boolean)).size}</div>
                        </div>
                        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/24">Direction</div>
                          <div className="mt-1 text-xl font-semibold text-white/86">{roomTheme.label}</div>
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
                            presentationMode={presentationMode}
                          />
                        ))}
                        {/* Generate All Justifications */}
                        {room.items.length >= 2 && (
                          <div className="px-5 py-3 border-t border-white/[0.03]">
                            <button
                              onClick={() => handleGenerateAllJustifications(room)}
                              disabled={justifyBatchLoading === room.id}
                              className="flex items-center gap-1.5 text-[10px] font-medium text-gold/40 hover:text-gold/70 transition-colors disabled:opacity-40"
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
                className={`atelier-panel px-6 py-5 mt-4 space-y-4 sm:relative sm:bottom-auto sm:z-auto fixed bottom-0 left-0 right-0 z-40 rounded-b-none sm:rounded-[28px] ${presentationMode ? "paper-grain" : ""}`}
                style={{ backdropFilter: "blur(12px)" }}
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
                {showPricing && (
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
                )}

                {/* Trade mode indicator */}
                {mode === "trade" && hasDiscounts && (
                  <div className="flex items-center gap-2 text-[10px] text-emerald-400/50">
                    <span className="uppercase tracking-wider font-semibold">Trade pricing active</span>
                  </div>
                )}

                <div className="rounded-[22px] border border-white/[0.06] bg-white/[0.02] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-gold/48">Presentation Export</div>
                      <p className="mt-1 text-[12px] leading-5 text-white/40">
                        Client PDFs are designed for review. Trade PDFs preserve internal pricing context for your team.
                      </p>
                    </div>
                    {generating && (
                      <div className="flex items-center gap-2 text-[11px] text-gold/70">
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
                      background: "linear-gradient(135deg, rgba(196,168,130,0.25), rgba(196,168,130,0.15))",
                      border: "1px solid rgba(196,168,130,0.3)",
                      color: "#c4a882",
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
                    onClick={handleShareLink}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium transition-all border sm:w-auto w-full"
                    style={{
                      background: shareCopied ? "rgba(110,180,140,0.15)" : "linear-gradient(135deg, rgba(100,140,220,0.15), rgba(100,140,220,0.08))",
                      border: shareCopied ? "1px solid rgba(110,180,140,0.3)" : "1px solid rgba(100,140,220,0.25)",
                      color: shareCopied ? "rgba(110,180,140,0.8)" : "rgba(100,140,220,0.8)",
                    }}
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
                    className="px-5 py-2.5 rounded-xl text-xs text-white/25 hover:text-red-400/60 hover:bg-red-400/[0.06] border border-white/[0.06] transition-all sm:w-auto w-full"
                  >
                    Clear Quote
                  </button>
                </div>

                {/* Client Feedback Summary */}
                {Object.keys(clientFeedback).length > 0 && (
                  <div className="mt-4 p-4 rounded-xl border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-2 mb-3">
                      <MessageSquare className="h-4 w-4 text-white/30" />
                      <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Client Feedback</span>
                      {shareToken && (
                        <span className="ml-auto text-[10px] text-white/20">v{localStorage.getItem("spec_share_version") || "1"}</span>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm">
                      <span className="text-emerald-400/70">
                        {Object.values(clientFeedback).filter(f => f.status === "approved").length} approved
                      </span>
                      <span className="text-amber-400/70">
                        {Object.values(clientFeedback).filter(f => f.status === "change").length} changes
                      </span>
                      <span className="text-red-400/70">
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
                    className="paper-grain w-full max-w-md rounded-[28px] border border-white/[0.08] p-6"
                    style={{ background: "linear-gradient(180deg, rgba(28,24,21,0.98), rgba(18,15,13,0.98))" }}
                  >
                    <div className="mb-5 rounded-[22px] border border-white/[0.06] bg-white/[0.02] px-4 py-4">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-gold/55">Client Portal</div>
                      <p className="mt-2 text-[12px] leading-6 text-white/46">
                        Share a composed approval link where clients can review rooms, comment on pieces, and respond without creating an account.
                      </p>
                    </div>
                    <h3 className="text-lg font-semibold text-white/85 mb-1">
                      {shareToken ? "Update Client Portal" : "Share with Client"}
                    </h3>
                    <p className="text-xs text-white/35 mb-5">
                      Your client will see an interactive approval experience — no account needed.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1.5 block">Personal Note (optional)</label>
                        <textarea
                          value={shareNote}
                          onChange={(e) => setShareNote(e.target.value)}
                          placeholder="Hi! Here are my initial selections for your living room. Let me know what you think..."
                          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/60 placeholder:text-white/15 focus:outline-none focus:border-gold/20 resize-none"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1.5 block">Client Email (optional — sends notification)</label>
                        <input
                          type="email"
                          value={shareClientEmail}
                          onChange={(e) => setShareClientEmail(e.target.value)}
                          placeholder="client@email.com"
                          className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white/60 placeholder:text-white/15 focus:outline-none focus:border-gold/20"
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => setShowShareModal(false)}
                        className="flex-1 py-2.5 rounded-xl text-sm text-white/40 border border-white/[0.08] hover:border-white/[0.15] transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateShareLink}
                        disabled={shareLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: "linear-gradient(135deg, #C9A96E, #B8944F)",
                          color: "#0A0B10",
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
                  className="fixed bottom-6 left-1/2 z-[85] -translate-x-1/2 rounded-2xl border border-gold/20 bg-[#161310]/95 px-4 py-3 shadow-2xl backdrop-blur-xl"
                >
                  <div className="flex items-center gap-2 text-[12px] text-white/78">
                    <Check className="h-3.5 w-3.5 text-gold" />
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

  return (
    <div className={`px-5 py-4 hover:bg-white/[0.02] transition-colors group border-b border-white/[0.03] last:border-b-0 ${
      clientFeedback?.status === "approved" ? "border-l-2 border-l-emerald-500/40" :
      clientFeedback?.status === "change" ? "border-l-2 border-l-amber-500/40" :
      clientFeedback?.status === "rejected" ? "border-l-2 border-l-red-500/40" : ""
    } ${presentationMode ? "paper-grain" : ""}`}>
      <div className="flex gap-4 sm:flex-row flex-col">
        {/* Thumbnail — clicks through to vendor product page */}
        <a
          href={item.portal_url || item.product_url || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { if (!item.portal_url && !item.product_url) e.preventDefault(); }}
          className={`flex-shrink-0 w-28 h-28 rounded-[20px] overflow-hidden border border-white/[0.06] sm:mx-0 mx-auto block ${(item.portal_url || item.product_url) ? "cursor-pointer hover:border-gold/30 transition-colors" : ""}`}
          style={{ background: "linear-gradient(180deg, #f7f1e8, #ece1d3)" }}
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
            <div className="h-full w-full flex items-center justify-center bg-white/[0.03]">
              <Package className="h-6 w-6 text-white/10" />
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
                className={`truncate hover:text-gold transition-colors ${presentationMode ? "text-[18px] font-semibold text-white/92" : "text-base font-medium text-white/88"}`}
                title="Open vendor product page — check pricing"
              >
                {item.product_name}
              </a>
            ) : (
              <div className="text-sm font-medium text-white/80 truncate">{item.product_name}</div>
            )}
            {(item.portal_url || item.product_url) && (
              <a
                href={item.portal_url || item.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-white/15 hover:text-gold/60 transition-colors"
                title="Open vendor page"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-gold/60 truncate">{item.manufacturer_name}</div>
          {item.sku && <div className="text-[10px] text-white/22 mt-1">SKU: {item.sku}</div>}
          {dims && <div className="text-[11px] text-white/28 mt-0.5">{dims}</div>}

          {/* Client Feedback Badge */}
          {clientFeedback && (
            <div className={`mt-1.5 flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${
              clientFeedback.status === "approved" ? "bg-emerald-500/[0.08] border border-emerald-500/15" :
              clientFeedback.status === "change" ? "bg-amber-500/[0.08] border border-amber-500/15" :
              "bg-red-500/[0.08] border border-red-500/15"
            }`}>
              {clientFeedback.status === "approved" && <Check className="h-3.5 w-3.5 text-emerald-400/70 flex-shrink-0 mt-0.5" />}
              {clientFeedback.status === "change" && <Edit3 className="h-3.5 w-3.5 text-amber-400/70 flex-shrink-0 mt-0.5" />}
              {clientFeedback.status === "rejected" && <XCircle className="h-3.5 w-3.5 text-red-400/70 flex-shrink-0 mt-0.5" />}
              <div>
                <span className={
                  clientFeedback.status === "approved" ? "text-emerald-400/70 font-medium" :
                  clientFeedback.status === "change" ? "text-amber-400/70 font-medium" :
                  "text-red-400/70 font-medium"
                }>
                  {clientFeedback.status === "approved" ? "Client Approved" :
                   clientFeedback.status === "change" ? "Change Requested" :
                   "Client Rejected"}
                </span>
                {clientFeedback.comment && (
                  <p className="text-white/35 mt-0.5 leading-relaxed">"{clientFeedback.comment}"</p>
                )}
              </div>
            </div>
          )}

          {/* Quantity & Price */}
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            <div className="flex items-center gap-0.5 border border-white/[0.08] rounded-xl bg-white/[0.02]">
              <button
                onClick={() => onQuantity(-1)}
                className="px-2.5 py-1.5 text-white/25 hover:text-white/50 transition-colors"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-xs text-white/60 w-7 text-center">{item.quantity || 1}</span>
              <button
                onClick={() => onQuantity(1)}
                className="px-2.5 py-1.5 text-white/25 hover:text-white/50 transition-colors"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {showPricing && (
              <>
                {editingPrice ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/30">$</span>
                    <input
                      autoFocus
                      type="number"
                      min="0"
                      step="1"
                      defaultValue={item.custom_price || price || ""}
                      placeholder="Enter price"
                      className="w-24 bg-white/[0.04] border border-gold/30 rounded px-2 py-1 text-xs text-white focus:outline-none"
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
                        className="text-[9px] text-white/20 hover:text-red-400/60 transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {price ? (
                      <span className={`text-xs ${priceInfo.isCustom ? "text-gold/70" : priceInfo.isTrade ? "text-emerald-400/70" : "text-white/50"}`}>
                        {priceInfo.isCustom && <span className="text-[9px] mr-0.5 opacity-70">Custom </span>}
                        {priceInfo.isTrade && <span className="text-[9px] mr-0.5 opacity-70">Est. Trade </span>}
                        {formatUsd(price)}
                        {(item.quantity || 1) > 1 && (
                          <span className={priceInfo.isCustom ? "text-gold/30" : priceInfo.isTrade ? "text-emerald-400/30" : "text-white/25"}>
                            {" "}x{item.quantity} = {formatUsd(price * (item.quantity || 1))}
                          </span>
                        )}
                      </span>
                    ) : null}
                    <button
                      onClick={() => setEditingPrice(true)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${
                        price
                          ? "border border-white/[0.08] hover:border-gold/25 text-white/30 hover:text-gold/60"
                          : "border border-gold/20 bg-gold/[0.06] text-gold/60 hover:bg-gold/[0.12] hover:text-gold/80"
                      }`}
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
            className="p-1.5 text-white/20 hover:text-gold/60 transition-colors"
            title="Swap — find similar products"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </button>

          {/* Why This Piece */}
          <button
            onClick={onWhyThisPiece}
            disabled={justifyLoading}
            className={`p-1.5 transition-colors ${justification ? "text-gold/40 hover:text-gold/70" : "text-white/20 hover:text-gold/60"}`}
            title={justification ? "Regenerate design justification" : "Why This Piece — AI design justification"}
          >
            {justifyLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
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

      {/* Design justification */}
      {justification && (
        <div className="mt-2 ml-0 sm:ml-28">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-3 w-3 text-gold/40" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-gold/40">Design Justification</span>
            <button onClick={() => setEditingJustification(!editingJustification)}
              className="text-[9px] text-white/20 hover:text-white/40 transition-colors">
              {editingJustification ? "Done" : "Edit"}
            </button>
            <button onClick={onWhyThisPiece} disabled={justifyLoading}
              className="text-[9px] text-white/20 hover:text-white/40 transition-colors">
              {justifyLoading ? "..." : "Regenerate"}
            </button>
          </div>
          {editingJustification ? (
            <textarea
              value={justification}
              onChange={(e) => onUpdateJustification(item.id, e.target.value)}
              className="w-full bg-white/[0.03] border border-gold/10 rounded-lg px-3 py-2 text-[11px] text-white/50 leading-relaxed focus:outline-none focus:border-gold/20 resize-none"
              rows={3}
            />
          ) : (
            <p className="text-[11px] text-white/40 leading-relaxed italic">{justification}</p>
          )}
        </div>
      )}
    </div>
  );
}
