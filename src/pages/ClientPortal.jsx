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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F0E8" }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#B8956A" }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#F5F0E8" }}>
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">&#128268;</div>
          <h1 className="text-xl font-semibold mb-2" style={{ color: "#1A1A18", fontFamily: "'Playfair Display', serif" }}>Link Not Found</h1>
          <p className="text-sm" style={{ color: "#9B9590" }}>{error || "This quote link may have expired or been removed."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F0E8" }}>
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-30 backdrop-blur-lg"
        style={{
          borderBottom: "1px solid rgba(44,62,45,0.08)",
          background: "rgba(245,240,232,0.80)",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <span
                className="text-[10px] font-bold tracking-[0.2em] uppercase"
                style={{ color: "rgba(44,62,45,0.55)" }}
              >SPEKD</span>
              {data.version > 1 && (
                <span
                  className="ml-2 text-[9px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(184,149,106,0.10)",
                    color: "rgba(184,149,106,0.70)",
                    border: "1px solid rgba(184,149,106,0.20)",
                  }}
                >
                  Revision {data.version}
                </span>
              )}
            </div>
            {reviewedCount > 0 && (
              <div className="flex items-center gap-3 text-[10px]">
                {approvedCount > 0 && <span className="text-emerald-600/70">{approvedCount} approved</span>}
                {changeCount > 0 && <span className="text-amber-600/70">{changeCount} changes</span>}
                {rejectedCount > 0 && <span className="text-red-600/70">{rejectedCount} rejected</span>}
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
          <h1
            className="text-2xl sm:text-3xl font-bold mb-2"
            style={{ color: "#1A1A18", fontFamily: "'Playfair Display', serif" }}
          >
            {data.projectName || "Your Selections"}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: "#9B9590" }}>
            {data.designerName && <span>Prepared by <span style={{ color: "#B8956A" }}>{data.designerName}</span></span>}
            {data.designerCompany && <span style={{ color: "rgba(44,62,45,0.20)" }}>|</span>}
            {data.designerCompany && <span>{data.designerCompany}</span>}
            <span style={{ color: "rgba(44,62,45,0.20)" }}>|</span>
            <span>{new Date(data.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
          </div>

          {data.clientNote && (
            <div
              className="mt-4 p-4 rounded-xl"
              style={{
                border: "1px solid rgba(184,149,106,0.18)",
                background: "rgba(184,149,106,0.06)",
              }}
            >
              <p className="text-sm italic leading-relaxed" style={{ color: "#6B6560" }}>"{data.clientNote}"</p>
              {data.designerName && <p className="text-xs mt-2" style={{ color: "rgba(184,149,106,0.65)" }}>— {data.designerName}</p>}
            </div>
          )}

          {!submitted && (
            <p className="mt-6 text-sm" style={{ color: "#9B9590" }}>
              Review each piece below. Tap <span className="text-emerald-600">Approve</span>, <span className="text-amber-600">Request Change</span>, or <span className="text-red-600">Reject</span> on each item, then submit your feedback.
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
                className="rounded-2xl overflow-hidden"
                style={{
                  border: "1px solid rgba(44,62,45,0.08)",
                  background: "rgba(255,255,255,0.80)",
                }}
              >
                {/* Room header */}
                <button
                  onClick={() => setExpandedRooms(prev => ({ ...prev, [roomKey]: !isExpanded }))}
                  className="flex items-center gap-3 w-full px-5 py-4 text-left"
                  style={{ borderBottom: "1px solid rgba(44,62,45,0.06)" }}
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4" style={{ color: "#9B9590" }} />
                    : <ChevronRight className="h-4 w-4" style={{ color: "#9B9590" }} />
                  }
                  <span
                    className="text-sm font-semibold uppercase tracking-wider flex-1"
                    style={{ color: "#2C3E2D" }}
                  >{room.name}</span>
                  <span className="text-[10px]" style={{ color: "#9B9590" }}>
                    {room.items?.length || 0} {(room.items?.length || 0) === 1 ? "piece" : "pieces"}
                  </span>
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
        <div
          className="fixed bottom-0 inset-x-0 z-40 backdrop-blur-lg"
          style={{
            borderTop: "1px solid rgba(44,62,45,0.08)",
            background: "rgba(245,240,232,0.92)",
          }}
        >
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <div className="text-sm" style={{ color: "#9B9590" }}>
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
                background: "linear-gradient(135deg, #2C3E2D, #3A5240)",
                color: "#F5F0E8",
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
            <Check className="h-5 w-5 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700/80">
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
    "";

  const bgHighlight =
    status === "approved" ? "bg-emerald-500/[0.04]" :
    status === "change" ? "bg-amber-500/[0.04]" :
    status === "rejected" ? "bg-red-500/[0.04]" :
    "";

  return (
    <div
      className={`last:border-b-0 ${bgHighlight} transition-colors`}
      style={{ borderBottom: "1px solid rgba(44,62,45,0.05)" }}
    >
      <div className="p-5">
        <div className="flex flex-col sm:flex-row gap-5">
          {/* Image with swipe */}
          <div
            className="relative flex-shrink-0 w-full sm:w-56 h-56 sm:h-48 rounded-xl overflow-hidden bg-white"
            style={{ border: "1px solid rgba(44,62,45,0.08)" }}
          >
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
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors"
                      style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(44,62,45,0.12)", color: "#2C3E2D" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,1)"; e.currentTarget.style.color = "#1A1A18"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.85)"; e.currentTarget.style.color = "#2C3E2D"; }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setImgIdx((imgIdx + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors"
                      style={{ background: "rgba(255,255,255,0.85)", border: "1px solid rgba(44,62,45,0.12)", color: "#2C3E2D" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,1)"; e.currentTarget.style.color = "#1A1A18"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.85)"; e.currentTarget.style.color = "#2C3E2D"; }}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                      {images.slice(0, 8).map((_, i) => (
                        <div key={i} className={`h-1.5 w-1.5 rounded-full transition-colors`} style={{ background: i === imgIdx ? "#B8956A" : "rgba(44,62,45,0.20)" }} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="h-full w-full flex items-center justify-center" style={{ background: "rgba(44,62,45,0.03)" }}>
                <Package className="h-10 w-10" style={{ color: "rgba(44,62,45,0.12)" }} />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3
              className="text-base font-semibold mb-1"
              style={{ color: "#1A1A18", fontFamily: "'Playfair Display', serif" }}
            >{item.product_name}</h3>
            <p className="text-sm mb-2" style={{ color: "#B8956A" }}>{item.manufacturer_name}</p>

            <div className="space-y-1 text-sm" style={{ color: "#9B9590" }}>
              {dims && <p>{dims}</p>}
              {item.material && <p>{item.material}</p>}
            </div>

            {justification && (
              <div
                className="mt-3 p-3 rounded-lg"
                style={{
                  background: "rgba(184,149,106,0.06)",
                  border: "1px solid rgba(184,149,106,0.12)",
                }}
              >
                <p className="text-[11px] italic leading-relaxed" style={{ color: "#6B6560" }}>{justification}</p>
              </div>
            )}

            {/* ── Action Buttons ── */}
            <div className="flex flex-wrap gap-2 mt-4">
              <button
                onClick={onApprove}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  status === "approved"
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700"
                    : "text-emerald-700/50 hover:border-emerald-500/25 hover:text-emerald-700/80 hover:bg-emerald-500/[0.06]"
                }`}
                style={status !== "approved" ? { borderColor: "rgba(44,62,45,0.12)" } : {}}
              >
                <Check className="h-3.5 w-3.5" />
                {status === "approved" ? "Approved" : "Approve"}
              </button>

              <button
                onClick={() => { setShowChangeInput(true); onChange(comment); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  status === "change"
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-700"
                    : "text-amber-700/50 hover:border-amber-500/25 hover:text-amber-700/80 hover:bg-amber-500/[0.06]"
                }`}
                style={status !== "change" ? { borderColor: "rgba(44,62,45,0.12)" } : {}}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {status === "change" ? "Change Requested" : "Request Change"}
              </button>

              <button
                onClick={onReject}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all border ${
                  status === "rejected"
                    ? "bg-red-500/15 border-red-500/30 text-red-700"
                    : "text-red-700/50 hover:border-red-500/25 hover:text-red-700/80 hover:bg-red-500/[0.06]"
                }`}
                style={status !== "rejected" ? { borderColor: "rgba(44,62,45,0.12)" } : {}}
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
                    className="w-full mt-3 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(217,163,80,0.25)",
                      color: "#1A1A18",
                      "::placeholder": { color: "#9B9590" },
                    }}
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
                    className="w-full mt-3 rounded-xl px-4 py-3 text-sm focus:outline-none resize-none"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid rgba(239,68,68,0.20)",
                      color: "#1A1A18",
                    }}
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
