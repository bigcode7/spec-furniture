import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, MessageSquare, Send, ChevronDown, ChevronRight, Loader2, Package, ArrowLeft, ArrowRight } from "lucide-react";

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

function proxyImg(item) {
  if (item.id) return `${SEARCH_SERVICE}/images/${encodeURIComponent(item.id)}`;
  if (item.image_url) return `${SEARCH_SERVICE}/proxy-image?url=${encodeURIComponent(item.image_url)}`;
  return "";
}

function dimStr(item) {
  const parts = [];
  if (item.width) parts.push(`${item.width}"W`);
  if (item.depth) parts.push(`${item.depth}"D`);
  if (item.height) parts.push(`${item.height}"H`);
  return parts.join(" x ") || item.dimensions || null;
}

function formatUsd(n) {
  if (!n) return null;
  return `$${Math.round(n).toLocaleString()}`;
}

/* ─── Main Portal ─── */

export default function ClientPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [feedback, setFeedback] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expandedRooms, setExpandedRooms] = useState({});

  useEffect(() => {
    if (!token) { setLoading(false); setError("No quote link provided."); return; }
    (async () => {
      try {
        const resp = await fetch(`${SEARCH_SERVICE}/quotes/shared/${token}`);
        if (!resp.ok) throw new Error(resp.status === 404 ? "This quote link is no longer valid." : "Failed to load quote.");
        const d = await resp.json();
        setData(d);
        // Initialize feedback from existing (if client revisiting)
        if (d.feedback && Object.keys(d.feedback).length > 0) {
          setFeedback(d.feedback);
          if (d.feedbackSubmittedAt) setSubmitted(true);
        }
        // Expand all rooms by default
        const expanded = {};
        (d.quote?.rooms || []).forEach(r => { expanded[r.id || r.name] = true; });
        setExpandedRooms(expanded);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const setItemFeedback = (itemId, status, comment) => {
    setFeedback(prev => ({
      ...prev,
      [itemId]: { status, comment: comment || prev[itemId]?.comment || "" },
    }));
    if (submitted) setSubmitted(false);
  };

  const setItemComment = (itemId, comment) => {
    setFeedback(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], comment },
    }));
  };

  const totalItems = data?.quote?.rooms?.reduce((sum, r) => sum + (r.items?.length || 0), 0) || 0;
  const reviewedCount = Object.keys(feedback).filter(k => feedback[k]?.status).length;
  const approvedCount = Object.values(feedback).filter(f => f.status === "approved").length;
  const changeCount = Object.values(feedback).filter(f => f.status === "change").length;
  const rejectedCount = Object.values(feedback).filter(f => f.status === "rejected").length;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const resp = await fetch(`${SEARCH_SERVICE}/quotes/shared/${token}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      if (!resp.ok) throw new Error("Failed to submit");
      setSubmitted(true);
    } catch (err) {
      console.error("Submit failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e14] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-[#C9A96E] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0e0e14] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#128268;</div>
          <h1 className="text-xl font-semibold text-white/80 mb-2">Link Not Found</h1>
          <p className="text-sm text-white/40">{error || "This quote link may have expired or been removed."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e14]">
      {/* ── Header ── */}
      <header className="border-b border-white/[0.06] bg-[#0e0e14]/80 backdrop-blur-lg sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold tracking-[0.2em] text-[#C9A96E]/60 uppercase">SPEKD</span>
              {data.version > 1 && (
                <span className="ml-2 text-[9px] font-medium px-2 py-0.5 rounded-full bg-[#C9A96E]/10 text-[#C9A96E]/60 border border-[#C9A96E]/20">
                  Revision {data.version}
                </span>
              )}
            </div>
            {reviewedCount > 0 && (
              <div className="flex items-center gap-3 text-[10px]">
                {approvedCount > 0 && <span className="text-emerald-400/70">{approvedCount} approved</span>}
                {changeCount > 0 && <span className="text-amber-400/70">{changeCount} changes</span>}
                {rejectedCount > 0 && <span className="text-red-400/70">{rejectedCount} rejected</span>}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 pb-32">
        {/* ── Project Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-2xl sm:text-3xl font-bold text-white/90 mb-2">
            {data.projectName || "Your Selections"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/40">
            {data.designerName && <span>Prepared by <span className="text-[#C9A96E]/70">{data.designerName}</span></span>}
            {data.designerCompany && <span className="text-white/20">|</span>}
            {data.designerCompany && <span>{data.designerCompany}</span>}
            <span className="text-white/20">|</span>
            <span>{new Date(data.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>

          {data.clientNote && (
            <div className="mt-4 p-4 rounded-xl border border-[#C9A96E]/15 bg-[#C9A96E]/[0.04]">
              <p className="text-sm text-white/50 italic leading-relaxed">"{data.clientNote}"</p>
              {data.designerName && <p className="text-xs text-[#C9A96E]/50 mt-2">— {data.designerName}</p>}
            </div>
          )}

          {!submitted && (
            <p className="mt-6 text-sm text-white/30">
              Review each piece below. Tap <span className="text-emerald-400/70">Approve</span>, <span className="text-amber-400/70">Request Change</span>, or <span className="text-red-400/70">Reject</span> on each item, then submit your feedback.
            </p>
          )}
        </motion.div>

        {/* ── Rooms ── */}
        <div className="space-y-6">
          {(data.quote?.rooms || []).map((room, roomIdx) => {
            const roomKey = room.id || room.name;
            const isExpanded = expandedRooms[roomKey] !== false;
            return (
              <motion.div
                key={roomKey}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: roomIdx * 0.05 }}
                className="rounded-2xl border border-white/[0.06] overflow-hidden"
                style={{ background: "rgba(255,255,255,0.015)" }}
              >
                {/* Room header */}
                <button
                  onClick={() => setExpandedRooms(prev => ({ ...prev, [roomKey]: !isExpanded }))}
                  className="flex items-center gap-3 w-full px-5 py-4 border-b border-white/[0.04] text-left"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-white/30" /> : <ChevronRight className="h-4 w-4 text-white/30" />}
                  <span className="text-sm font-semibold text-white/70 uppercase tracking-wider flex-1">{room.name}</span>
                  <span className="text-[10px] text-white/20">{room.items?.length || 0} {(room.items?.length || 0) === 1 ? "piece" : "pieces"}</span>
                </button>

                {/* Room items */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                    >
                      {(room.items || []).map((item, itemIdx) => (
                        <ClientProductCard
                          key={item.id}
                          item={item}
                          feedback={feedback[item.id]}
                          onApprove={() => setItemFeedback(item.id, "approved")}
                          onChange={(comment) => setItemFeedback(item.id, "change", comment)}
                          onReject={() => setItemFeedback(item.id, "rejected")}
                          onComment={(comment) => setItemComment(item.id, comment)}
                          submitted={submitted}
                          justification={item.justification || data.quote?.justifications?.[item.id]}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Fixed Submit Bar ── */}
      {!submitted ? (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.06] bg-[#0e0e14]/95 backdrop-blur-lg">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="text-sm text-white/40">
              {reviewedCount === 0
                ? `${totalItems} pieces to review`
                : `${reviewedCount} of ${totalItems} reviewed`
              }
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || reviewedCount === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
              style={{
                background: "linear-gradient(135deg, #C9A96E, #B8944F)",
                color: "#0A0B10",
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Feedback
            </button>
          </div>
        </div>
      ) : (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-emerald-500/20 bg-emerald-500/[0.06] backdrop-blur-lg">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-center gap-3">
            <Check className="h-5 w-5 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-400/80">
              Feedback submitted — your designer has been notified
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Product Card ─── */

function ClientProductCard({ item, feedback, onApprove, onChange, onReject, onComment, submitted, justification }) {
  const [showChangeInput, setShowChangeInput] = useState(feedback?.status === "change");
  const [imgIdx, setImgIdx] = useState(0);
  const dims = dimStr(item);
  const status = feedback?.status;
  const comment = feedback?.comment || "";

  const images = (() => {
    const raw = (item.images && item.images.length > 0) ? item.images : [];
    const urls = raw.map(img => typeof img === "string" ? img : img?.url || "").filter(Boolean);
    if (urls.length === 0 && item.image_url) urls.push(item.image_url);
    return [...new Set(urls)];
  })();

  const borderColor =
    status === "approved" ? "border-emerald-500/30" :
    status === "change" ? "border-amber-500/30" :
    status === "rejected" ? "border-red-500/30" :
    "border-white/[0.06]";

  const bgHighlight =
    status === "approved" ? "bg-emerald-500/[0.03]" :
    status === "change" ? "bg-amber-500/[0.03]" :
    status === "rejected" ? "bg-red-500/[0.03]" :
    "";

  return (
    <div className={`border-b border-white/[0.03] last:border-b-0 ${bgHighlight} transition-colors`}>
      <div className="p-5">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Image with swipe */}
          <div className="relative flex-shrink-0 w-full sm:w-56 h-56 sm:h-48 rounded-xl overflow-hidden bg-white border border-white/[0.06]">
            {images.length > 0 ? (
              <>
                <img
                  src={proxyImg({ ...item, image_url: images[imgIdx] || item.image_url })}
                  alt={item.product_name}
                  className="h-full w-full object-contain p-3"
                />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImgIdx((imgIdx - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white/70 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setImgIdx((imgIdx + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white/70 hover:text-white transition-colors"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                      {images.slice(0, 8).map((_, i) => (
                        <div key={i} className={`h-1.5 w-1.5 rounded-full transition-colors ${i === imgIdx ? "bg-[#C9A96E]" : "bg-white/30"}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-white/[0.03]">
                <Package className="h-10 w-10 text-white/10" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white/85 mb-1">{item.product_name}</h3>
            <p className="text-sm text-[#C9A96E]/60 mb-2">{item.manufacturer_name}</p>

            <div className="space-y-1 text-sm text-white/40">
              {dims && <p>{dims}</p>}
              {item.material && <p>{item.material}</p>}
              {item.retail_price && <p className="text-white/60 font-medium">{formatUsd(item.retail_price)}</p>}
            </div>

            {justification && (
              <div className="mt-3 p-3 rounded-lg bg-[#C9A96E]/[0.05] border border-[#C9A96E]/10">
                <p className="text-[11px] text-white/40 italic leading-relaxed">{justification}</p>
              </div>
            )}

            {/* ── Action Buttons ── */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={onApprove}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  status === "approved"
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                    : "border-white/[0.08] text-white/40 hover:border-emerald-500/25 hover:text-emerald-400/80 hover:bg-emerald-500/[0.06]"
                }`}
              >
                <Check className="h-3.5 w-3.5" />
                {status === "approved" ? "Approved" : "Approve"}
              </button>

              <button
                onClick={() => { setShowChangeInput(true); onChange(comment); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  status === "change"
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                    : "border-white/[0.08] text-white/40 hover:border-amber-500/25 hover:text-amber-400/80 hover:bg-amber-500/[0.06]"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {status === "change" ? "Change Requested" : "Request Change"}
              </button>

              <button
                onClick={onReject}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  status === "rejected"
                    ? "bg-red-500/15 border-red-500/30 text-red-400"
                    : "border-white/[0.08] text-white/40 hover:border-red-500/25 hover:text-red-400/80 hover:bg-red-500/[0.06]"
                }`}
              >
                <X className="h-3.5 w-3.5" />
                {status === "rejected" ? "Rejected" : "Reject"}
              </button>
            </div>

            {/* Change request comment */}
            <AnimatePresence>
              {(showChangeInput || status === "change") && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <textarea
                    value={comment}
                    onChange={(e) => {
                      onComment(e.target.value);
                      if (!status || status !== "change") onChange(e.target.value);
                    }}
                    placeholder='What would you change? e.g. "Different fabric", "Too large for the space", "Can we see something less expensive?"'
                    className="w-full mt-3 bg-white/[0.03] border border-amber-500/15 rounded-xl px-4 py-3 text-sm text-white/60 placeholder:text-white/20 focus:outline-none focus:border-amber-500/30 resize-none"
                    rows={2}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Rejection reason (optional) */}
            <AnimatePresence>
              {status === "rejected" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <textarea
                    value={comment}
                    onChange={(e) => onComment(e.target.value)}
                    placeholder="Optional: why doesn't this work?"
                    className="w-full mt-3 bg-white/[0.03] border border-red-500/15 rounded-xl px-4 py-3 text-sm text-white/60 placeholder:text-white/20 focus:outline-none focus:border-red-500/30 resize-none"
                    rows={2}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
