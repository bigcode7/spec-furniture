import { useState } from "react";
import { Ruler, Check, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const FIT_CONFIG = {
  perfect: {
    bg: "bg-green-500/15",
    border: "border-green-500/30",
    text: "text-green-400",
    icon: Check,
    label: "Perfect Fit",
  },
  tight: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/30",
    text: "text-amber-400",
    icon: AlertTriangle,
    label: "Tight Fit",
  },
  "wont-fit": {
    bg: "bg-red-500/15",
    border: "border-red-500/30",
    text: "text-red-400",
    icon: XCircle,
    label: "Won't Fit",
  },
  unknown: {
    bg: "bg-white/5",
    border: "border-white/[0.06]",
    text: "text-white/40",
    icon: HelpCircle,
    label: "Unknown",
  },
};

export default function FitScoreBadge({ fit = "unknown", score, reason }) {
  const [hovered, setHovered] = useState(false);
  const config = FIT_CONFIG[fit] || FIT_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight ${config.bg} ${config.border} ${config.text} transition-all duration-200`}
      >
        <Ruler className="h-3 w-3 flex-shrink-0" />
        <span className="whitespace-nowrap">{config.label}</span>
        {score != null && (
          <span className="ml-0.5 opacity-70">{score}</span>
        )}
      </div>

      <AnimatePresence>
        {hovered && reason && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-[11px] shadow-xl ${config.bg} ${config.border} ${config.text}`}
          >
            {reason}
            <div
              className={`absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent ${
                fit === "perfect"
                  ? "border-t-green-500/30"
                  : fit === "tight"
                    ? "border-t-amber-500/30"
                    : fit === "wont-fit"
                      ? "border-t-red-500/30"
                      : "border-t-white/[0.06]"
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
