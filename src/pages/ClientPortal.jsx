import { useState, useEffect } from "react";
import {
  Package,
  CheckCircle,
  ImageOff,
  Loader2,
  AlertTriangle,
  Building2,
  DollarSign,
  Clock,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

function formatRoomType(type) {
  return (type || "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount || 0);
}

function ProductCard({ item, roomId, onApprove, onRequestChange }) {
  const [imgError, setImgError] = useState(false);
  const product = item.selected_product;
  if (!product) return null;

  const storageKey = `client-feedback-${roomId}-${item.id}`;
  const [feedback, setFeedback] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || null;
    } catch {
      return null;
    }
  });

  const handleApprove = () => {
    localStorage.setItem(storageKey, "approved");
    setFeedback("approved");
    onApprove?.(item);
  };

  const handleRequestChange = () => {
    localStorage.setItem(storageKey, "change-requested");
    setFeedback("change-requested");
    onRequestChange?.(item);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl p-4 transition-colors ${
        feedback === "approved"
          ? "border-emerald-500/20 bg-emerald-500/[0.03]"
          : feedback === "change-requested"
          ? "border-amber-500/20 bg-amber-500/[0.03]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <div className="flex gap-4">
        <div className="w-24 h-24 rounded-lg bg-white/[0.03] flex items-center justify-center shrink-0 overflow-hidden">
          {product.image_url && !imgError ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <ImageOff className="w-6 h-6 text-white/20" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium text-white">{product.name}</h4>
              <p className="text-xs text-white/40 mt-0.5">{product.vendor}</p>
            </div>
            <span className="text-sm font-semibold text-white shrink-0">{formatCurrency(product.price)}</span>
          </div>

          <p className="text-xs text-white/30 mt-1">{item.name} {item.quantity > 1 ? `(Qty: ${item.quantity})` : ""}</p>

          {/* Feedback state */}
          {feedback === "approved" && (
            <div className="flex items-center gap-1.5 mt-3">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-medium">Approved</span>
            </div>
          )}

          {feedback === "change-requested" && (
            <div className="flex items-center gap-1.5 mt-3">
              <Clock className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">Change Requested</span>
            </div>
          )}

          {!feedback && (
            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleApprove}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs h-7 px-3"
                variant="ghost"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                onClick={handleRequestChange}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs h-7 px-3"
                variant="ghost"
              >
                <Clock className="w-3.5 h-3.5 mr-1" />
                Request Change
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function ClientPortal() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = new URLSearchParams(window.location.search).get("token");

  useEffect(() => {
    if (!token) {
      setError("No access token provided. Please use the link shared by your designer.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${SEARCH_URL}/share/${token}`);
        if (!res.ok) throw new Error("This link may have expired or is invalid.");
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-3" />
          <p className="text-sm text-white/40">Loading your project...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-white mb-2">Unable to Load</h2>
          <p className="text-sm text-white/50">{error || "Something went wrong."}</p>
        </div>
      </div>
    );
  }

  const project = data.project || data;
  const rooms = project.rooms || [];

  const totalSelected = rooms.reduce((sum, room) => {
    return sum + (room.items || []).filter((i) => i.selected_product).length;
  }, 0);

  const totalCost = rooms.reduce((sum, room) => {
    return sum + (room.items || []).reduce((roomSum, item) => {
      return roomSum + (item.selected_product?.price || 0) * (item.quantity || 1);
    }, 0);
  }, 0);

  return (
    <div className="min-h-screen py-8 md:py-12">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-sm text-white/50 mb-4">
            <Users className="w-4 h-4" />
            Client Review
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {project.name || "Your Project"}
          </h1>
          {project.client_name && (
            <p className="text-white/40">Prepared for {project.client_name}</p>
          )}
        </motion.div>

        {/* Summary Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="border border-white/[0.06] bg-white/[0.02] rounded-xl p-4 mb-8 flex items-center justify-around text-center"
        >
          <div>
            <p className="text-2xl font-bold text-white">{rooms.length}</p>
            <p className="text-xs text-white/40">Rooms</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div>
            <p className="text-2xl font-bold text-white">{totalSelected}</p>
            <p className="text-xs text-white/40">Items Selected</p>
          </div>
          <div className="w-px h-8 bg-white/[0.06]" />
          <div>
            <p className="text-2xl font-bold text-white">{formatCurrency(totalCost)}</p>
            <p className="text-xs text-white/40">Total</p>
          </div>
        </motion.div>

        {/* Rooms */}
        <div className="space-y-8">
          {rooms.map((room, roomIndex) => {
            const itemsWithProduct = (room.items || []).filter((i) => i.selected_product);
            if (itemsWithProduct.length === 0) return null;

            return (
              <motion.div
                key={room.id || roomIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + roomIndex * 0.05 }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-5 h-5 text-white/40" />
                  <h2 className="text-lg font-semibold text-white">
                    {formatRoomType(room.type)}
                  </h2>
                  <Badge variant="outline" className="border-white/[0.08] text-white/40 text-xs ml-auto">
                    {itemsWithProduct.length} items
                  </Badge>
                </div>

                <div className="space-y-3">
                  {itemsWithProduct.map((item) => (
                    <ProductCard
                      key={item.id}
                      item={item}
                      roomId={room.id}
                      onApprove={() => {}}
                      onRequestChange={() => {}}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {rooms.every((r) => !(r.items || []).some((i) => i.selected_product)) && (
          <div className="text-center py-16">
            <Package className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No products have been selected yet.</p>
            <p className="text-white/30 text-sm mt-1">Your designer is still working on selections.</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 pt-8 border-t border-white/[0.06]">
          <p className="text-xs text-white/20">
            Powered by SPEC Sourcing Brain
          </p>
        </div>
      </div>
    </div>
  );
}
