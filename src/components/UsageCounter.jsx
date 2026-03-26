import { motion, AnimatePresence } from "framer-motion";
import { Search, Sparkles } from "lucide-react";

const GOLD = "#C9A96E";

export default function UsageCounter({ remaining, total = 3, onTrialClick }) {
  // Don't show for active subscribers (remaining would be null/undefined)
  if (remaining == null || remaining > total) return null;

  const used = total - remaining;
  const urgency = remaining <= 0 ? "#ef4444" : remaining <= 1 ? "#f59e0b" : GOLD;
  const progressPct = Math.min(100, (used / total) * 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-40 rounded-xl overflow-hidden"
        style={{
          background: "rgba(16,17,24,0.95)",
          border: `1px solid ${urgency}33`,
          backdropFilter: "blur(12px)",
          boxShadow: `0 4px 24px ${urgency}20`,
          width: 260,
        }}
      >
        {/* Progress bar */}
        <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.04)" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full"
            style={{ background: urgency }}
          />
        </div>

        <div className="px-3.5 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Search className="h-3.5 w-3.5 shrink-0" style={{ color: urgency }} />
            <span className="text-xs font-medium" style={{ color: urgency }}>
              {remaining > 0
                ? `${remaining} of ${total} free Pro searches left`
                : "You've used all free searches"}
            </span>
          </div>

          {remaining > 0 ? (
            <p className="text-[10px] text-white/30 leading-snug">
              Start a 7-day free trial for unlimited AI search, quotes, and sourcing tools.
            </p>
          ) : (
            <button
              onClick={onTrialClick}
              className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold transition-all hover:brightness-110"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, #B8944F)`,
                color: "#080c18",
              }}
            >
              <Sparkles className="h-3 w-3" />
              Start 7-day free trial
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
