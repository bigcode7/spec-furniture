import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Trash2, Plus, Minus, FileText, ChevronDown, ChevronRight,
  GripVertical, Edit3, Check, Download, FolderPlus, Package,
  DollarSign, MessageSquare, Settings,
} from "lucide-react";
import {
  getQuote, saveQuote, removeFromQuote, updateQuoteItem,
  addQuoteRoom, removeQuoteRoom, renameQuoteRoom, moveItemToRoom,
  clearQuote, getQuoteSettings, saveQuoteSettings, getQuoteItemCount,
} from "@/lib/growth-store";
import { generateQuotePdf } from "@/lib/quote-generator";
import { useTradePricing } from "@/lib/TradePricingContext";

export default function QuotePanel({ open, onClose, onCountChange }) {
  const { mode, getPrice, fmtPrice, hasDiscounts } = useTradePricing();
  const [quote, setQuote] = useState(getQuote());
  const [settings, setSettings] = useState(getQuoteSettings());
  const [expandedRooms, setExpandedRooms] = useState({});
  const [editingName, setEditingName] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showMarkup, setShowMarkup] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [showAddRoom, setShowAddRoom] = useState(false);
  const nameRef = useRef(null);
  const clientRef = useRef(null);
  const roomNameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuote(getQuote());
      // Expand all rooms by default
      const q = getQuote();
      const expanded = {};
      q.rooms.forEach(r => { expanded[r.id] = true; });
      setExpandedRooms(expanded);
    }
  }, [open]);

  const refresh = () => {
    const q = getQuote();
    setQuote(q);
    onCountChange?.(q.rooms.reduce((s, r) => s + r.items.length, 0));
  };

  const totalItems = quote.rooms.reduce((s, r) => s + r.items.length, 0);

  const getItemPrice = (item) => {
    const priceInfo = getPrice(item);
    const base = priceInfo.price;
    if (!base) return null;
    const markup = quote.markup_percent || 0;
    return markup > 0 ? base * (1 + markup / 100) : base;
  };

  const getItemPriceInfo = (item) => {
    return getPrice(item);
  };

  const getRoomTotal = (room) => {
    return room.items.reduce((sum, item) => {
      const price = getItemPrice(item);
      return sum + (price ? price * (item.quantity || 1) : 0);
    }, 0);
  };

  const grandTotal = quote.rooms.reduce((sum, r) => sum + getRoomTotal(r), 0);
  const itemsWithPrice = quote.rooms.flatMap(r => r.items).filter(i => getItemPrice(i));
  const itemsWithoutPrice = quote.rooms.flatMap(r => r.items).filter(i => !getItemPrice(i));

  const handleRemove = (productId) => {
    removeFromQuote(productId);
    refresh();
  };

  const handleQuantity = (productId, delta) => {
    const allItems = quote.rooms.flatMap(r => r.items);
    const item = allItems.find(i => i.id === productId);
    if (!item) return;
    const newQty = Math.max(1, (item.quantity || 1) + delta);
    updateQuoteItem(productId, { quantity: newQty });
    refresh();
  };

  const handleNotes = (productId, notes) => {
    updateQuoteItem(productId, { notes });
    refresh();
  };

  const handleMoveToRoom = (productId, roomId) => {
    moveItemToRoom(productId, roomId);
    refresh();
  };

  const handleAddRoom = () => {
    if (!newRoomName.trim()) return;
    addQuoteRoom(newRoomName.trim());
    setNewRoomName("");
    setShowAddRoom(false);
    refresh();
    // Expand new room
    const q = getQuote();
    setExpandedRooms(prev => ({ ...prev, [q.rooms[q.rooms.length - 1].id]: true }));
  };

  const handleRenameRoom = (roomId, name) => {
    renameQuoteRoom(roomId, name);
    setEditingRoomId(null);
    refresh();
  };

  const handleDeleteRoom = (roomId) => {
    removeQuoteRoom(roomId);
    refresh();
  };

  const handleSaveName = (field, value) => {
    const q = getQuote();
    q[field] = value;
    saveQuote(q);
    refresh();
    if (field === "name") setEditingName(false);
    if (field === "client_name") setEditingClient(false);
  };

  const handleMarkup = (val) => {
    const q = getQuote();
    q.markup_percent = Math.max(0, Number(val) || 0);
    saveQuote(q);
    refresh();
  };

  const handleGeneratePdf = async (pdfMode) => {
    setGenerating(true);
    try {
      const allItems = quote.rooms.flatMap(r =>
        r.items.map(item => {
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
    refresh();
  };

  const handleSaveSettings = (updates) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    saveQuoteSettings(next);
  };

  const dimStr = (item) => {
    const parts = [];
    if (item.width) parts.push(`${item.width}"W`);
    if (item.depth) parts.push(`${item.depth}"D`);
    if (item.height) parts.push(`${item.height}"H`);
    return parts.join(" x ") || item.dimensions || null;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-[71] w-full max-w-lg flex flex-col"
            style={{
              background: "rgba(12, 13, 20, 0.97)",
              backdropFilter: "blur(40px)",
              borderLeft: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gold" />
                  <span className="text-sm font-semibold text-white tracking-wide">QUOTE BUILDER</span>
                  {totalItems > 0 && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gold/15 text-gold">
                      {totalItems} {totalItems === 1 ? "item" : "items"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
                    title="Quote settings"
                  >
                    <Settings className="h-4 w-4" />
                  </button>
                  <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Quote Name */}
              <div className="space-y-1.5">
                {editingName ? (
                  <input
                    ref={nameRef}
                    autoFocus
                    defaultValue={quote.name}
                    placeholder="Quote name — e.g., Thompson Residence"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30"
                    onBlur={(e) => handleSaveName("name", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName("name", e.target.value); }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors group"
                  >
                    <span>{quote.name || "Untitled Quote"}</span>
                    <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                  </button>
                )}

                {editingClient ? (
                  <input
                    ref={clientRef}
                    autoFocus
                    defaultValue={quote.client_name}
                    placeholder="Client name"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30"
                    onBlur={(e) => handleSaveName("client_name", e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveName("client_name", e.target.value); }}
                  />
                ) : (
                  <button
                    onClick={() => setEditingClient(true)}
                    className="flex items-center gap-2 text-xs text-white/30 hover:text-white/50 transition-colors group"
                  >
                    <span>{quote.client_name || "Add client name"}</span>
                    <Edit3 className="h-3 w-3 opacity-0 group-hover:opacity-50" />
                  </button>
                )}

                <div className="text-[10px] text-white/20">
                  {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-white/[0.06]"
                >
                  <div className="px-5 py-4 space-y-3">
                    <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Designer Info (saved for all quotes)</div>
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
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Room List + Items */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {totalItems === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-8">
                  <Package className="h-12 w-12 text-white/10 mb-4" />
                  <p className="text-sm text-white/40 mb-1">No items in quote</p>
                  <p className="text-xs text-white/20">Add products from search results to start building a quote for your client.</p>
                </div>
              ) : (
                <div className="py-2">
                  {quote.rooms.map((room) => (
                    <div key={room.id} className="mb-1">
                      {/* Room Header */}
                      <div className="flex items-center gap-2 px-5 py-2 hover:bg-white/[0.02] transition-colors">
                        <button
                          onClick={() => setExpandedRooms(prev => ({ ...prev, [room.id]: !prev[room.id] }))}
                          className="text-white/30 hover:text-white/60"
                        >
                          {expandedRooms[room.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>

                        {editingRoomId === room.id ? (
                          <input
                            ref={roomNameRef}
                            autoFocus
                            defaultValue={room.name}
                            className="flex-1 bg-white/[0.04] border border-white/10 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-gold/30"
                            onBlur={(e) => handleRenameRoom(room.id, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleRenameRoom(room.id, e.target.value); }}
                          />
                        ) : (
                          <button
                            onClick={() => setEditingRoomId(room.id)}
                            className="flex-1 text-left text-xs font-semibold text-white/60 uppercase tracking-wider hover:text-white/80 transition-colors"
                          >
                            {room.name}
                          </button>
                        )}

                        <span className="text-[10px] text-white/20">{room.items.length}</span>

                        {getRoomTotal(room) > 0 && (
                          <span className="text-[10px] text-gold/60 font-medium">${Math.round(getRoomTotal(room)).toLocaleString()}</span>
                        )}

                        {quote.rooms.length > 1 && room.items.length === 0 && (
                          <button
                            onClick={() => handleDeleteRoom(room.id)}
                            className="p-1 text-white/15 hover:text-red-400/60 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
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
                              <QuoteItem
                                key={item.id}
                                item={item}
                                rooms={quote.rooms}
                                currentRoomId={room.id}
                                onRemove={() => handleRemove(item.id)}
                                onQuantity={(d) => handleQuantity(item.id, d)}
                                onNotes={(n) => handleNotes(item.id, n)}
                                onMoveToRoom={(rid) => handleMoveToRoom(item.id, rid)}
                                getItemPrice={() => getItemPrice(item)}
                                getItemPriceInfo={() => getItemPriceInfo(item)}
                                dimStr={() => dimStr(item)}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}

                  {/* Add Room */}
                  <div className="px-5 py-2">
                    {showAddRoom ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={newRoomName}
                          onChange={(e) => setNewRoomName(e.target.value)}
                          placeholder="Room name"
                          className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30"
                          onKeyDown={(e) => { if (e.key === "Enter") handleAddRoom(); if (e.key === "Escape") setShowAddRoom(false); }}
                        />
                        <button onClick={handleAddRoom} className="px-3 py-1.5 rounded-lg bg-gold/15 text-gold text-xs font-medium hover:bg-gold/25 transition-colors">
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddRoom(true)}
                        className="flex items-center gap-2 text-xs text-white/20 hover:text-white/40 transition-colors"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        Add room
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer — Pricing & Actions */}
            {totalItems > 0 && (
              <div className="flex-shrink-0 border-t border-white/[0.06] px-5 py-4 space-y-3">
                {/* Markup toggle */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setShowMarkup(!showMarkup)}
                    className="flex items-center gap-2 text-[10px] text-white/25 hover:text-white/40 uppercase tracking-wider transition-colors"
                  >
                    <DollarSign className="h-3 w-3" />
                    Designer markup
                    <ChevronDown className={`h-3 w-3 transition-transform ${showMarkup ? "rotate-180" : ""}`} />
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
                        <span className="text-[10px] text-white/20">Client sees marked-up price. Trade price stays hidden.</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Totals */}
                <div className="space-y-1.5">
                  {quote.rooms.filter(r => r.items.length > 0).map(room => (
                    <div key={room.id} className="flex justify-between text-xs">
                      <span className="text-white/30">{room.name}</span>
                      <span className="text-white/50">
                        {getRoomTotal(room) > 0 ? `$${Math.round(getRoomTotal(room)).toLocaleString()}` : "Price on request"}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-white/[0.06]">
                    <span className="text-white/60">Total</span>
                    <span className="text-white">
                      {grandTotal > 0 ? `$${Math.round(grandTotal).toLocaleString()}` : "Prices on request"}
                    </span>
                  </div>
                  {itemsWithoutPrice.length > 0 && (
                    <div className="text-[10px] text-white/20">
                      {itemsWithoutPrice.length} {itemsWithoutPrice.length === 1 ? "item" : "items"} pending pricing
                    </div>
                  )}
                </div>

                {/* Mode indicator */}
                {mode === "trade" && hasDiscounts && (
                  <div className="flex items-center gap-2 text-[10px] text-emerald-400/50">
                    <span className="uppercase tracking-wider font-semibold">Trade pricing active</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleGeneratePdf("client")}
                    disabled={generating}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
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
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
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
                    className="px-4 py-2.5 rounded-xl text-xs text-white/25 hover:text-red-400/60 hover:bg-red-400/[0.06] border border-white/[0.06] transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function QuoteItem({ item, rooms, currentRoomId, onRemove, onQuantity, onNotes, onMoveToRoom, getItemPrice, getItemPriceInfo, dimStr }) {
  const [showNotes, setShowNotes] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const price = getItemPrice();
  const priceInfo = getItemPriceInfo?.() || { isTrade: false };
  const dims = dimStr();

  return (
    <div className="px-5 py-2.5 hover:bg-white/[0.015] transition-colors group">
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div
          className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/[0.06]"
          style={{ backgroundColor: item.image_contain ? "#ffffff" : "rgba(255,255,255,0.03)" }}
        >
          {item.image_url ? (
            <img
              src={item.image_url}
              alt={item.product_name}
              className="h-full w-full"
              style={{ objectFit: item.image_contain ? "contain" : "cover", padding: item.image_contain ? "4px" : "0" }}
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-white/10">
              <Package className="h-6 w-6" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-white/80 truncate">{item.product_name}</div>
          <div className="text-[10px] text-gold/60 truncate">{item.manufacturer_name}</div>
          {item.sku && <div className="text-[10px] text-white/20">SKU: {item.sku}</div>}
          {dims && <div className="text-[10px] text-white/20">{dims}</div>}

          {/* Price & Quantity row */}
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-0.5 border border-white/[0.08] rounded-md">
              <button onClick={() => onQuantity(-1)} className="px-1.5 py-0.5 text-white/25 hover:text-white/50 transition-colors">
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-xs text-white/60 w-5 text-center">{item.quantity || 1}</span>
              <button onClick={() => onQuantity(1)} className="px-1.5 py-0.5 text-white/25 hover:text-white/50 transition-colors">
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {price ? (
              <span className={`text-xs ${priceInfo.isTrade ? "text-emerald-400/50" : "text-white/50"}`}>
                {priceInfo.isTrade && <span className="text-[9px] mr-0.5 opacity-70">Est. Trade </span>}
                ${Math.round(price).toLocaleString()}
                {(item.quantity || 1) > 1 && (
                  <span className={priceInfo.isTrade ? "text-emerald-400/25" : "text-white/25"}> x{item.quantity} = ${Math.round(price * (item.quantity || 1)).toLocaleString()}</span>
                )}
              </span>
            ) : (
              <span className="text-[10px] text-white/20">Price on request</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setShowNotes(!showNotes)} className="p-1 text-white/20 hover:text-white/50 transition-colors" title="Add notes">
            <MessageSquare className="h-3 w-3" />
          </button>
          {rooms.length > 1 && (
            <div className="relative">
              <button onClick={() => setShowMoveMenu(!showMoveMenu)} className="p-1 text-white/20 hover:text-white/50 transition-colors" title="Move to room">
                <FolderPlus className="h-3 w-3" />
              </button>
              {showMoveMenu && (
                <div
                  className="absolute right-0 top-full z-10 w-36 py-1 rounded-lg shadow-xl"
                  style={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {rooms.filter(r => r.id !== currentRoomId).map(r => (
                    <button
                      key={r.id}
                      onClick={() => { onMoveToRoom(r.id); setShowMoveMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button onClick={onRemove} className="p-1 text-white/20 hover:text-red-400/60 transition-colors" title="Remove">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Notes */}
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
              className="w-full mt-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white/60 placeholder:text-white/15 focus:outline-none focus:border-gold/20 resize-none"
              rows={2}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
