import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

const GOLD = "#C9A96E";

export default function UsageCounter({ remaining, total = 3, onTrialClick }) {
  // Don't show for active subscribers (remaining would be null/undefined)
  if (remaining == null || remaining > total) return null;

  const exhausted = remaining <= 0;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={exhausted ? onTrialClick : undefined}
        className={`fixed bottom-[4.5rem] md:bottom-[3.75rem] right-4 z-40 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${exhausted ? "cursor-pointer hover:brightness-110" : "cursor-default"}`}
        style={{
          background: exhausted
            ? `linear-gradient(135deg, ${GOLD}, #B8944F)`
            : "rgba(16,17,24,0.9)",
          color: exhausted ? "#080c18" : "rgba(255,255,255,0.5)",
          border: exhausted ? "none" : "1px solid rgba(255,255,255,0.08)",
          backdropFilter: "blur(8px)",
        }}
      >
        {exhausted ? (
          <>
            <Sparkles className="h-3 w-3" />
            Start free trial
          </>
        ) : (
          <span>{remaining}/{total} searches</span>
        )}
      </motion.button>
    </AnimatePresence>
  );
}
