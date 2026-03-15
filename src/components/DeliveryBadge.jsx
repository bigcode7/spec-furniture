import { useState } from "react";
import {
  Truck,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Ruler,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STATUS_CONFIG = {
  standard: {
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    text: "text-green-400",
    icon: Truck,
    label: "Standard Delivery",
    description: "No delivery concerns detected.",
  },
  verify: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    icon: AlertTriangle,
    label: "Verify Delivery",
    description: "Some delivery considerations to review.",
  },
  "special-planning": {
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
    icon: XCircle,
    label: "Special Planning Required",
    description: "This item needs special delivery arrangements.",
  },
};

export default function DeliveryBadge({ status = "standard", issues, tips, diagonal_in }) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.standard;
  const Icon = config.icon;

  const hasDetails =
    (issues && issues.length > 0) || (tips && tips.length > 0) || diagonal_in;

  return (
    <div
      className={`rounded-lg border ${config.border} ${config.bg} transition-all duration-200`}
    >
      <button
        onClick={() => hasDetails && setExpanded((e) => !e)}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left ${
          hasDetails ? "cursor-pointer" : "cursor-default"
        }`}
      >
        <Icon className={`h-4 w-4 flex-shrink-0 ${config.text}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${config.text}`}>
            {config.label}
          </p>
          <p className="text-[11px] text-white/40">{config.description}</p>
        </div>
        {hasDetails && (
          <span className={`${config.text}`}>
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </span>
        )}
      </button>

      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t border-white/[0.06] px-3 py-2.5">
              {diagonal_in && (
                <div className="flex items-center gap-1.5 text-[11px] text-white/50">
                  <Ruler className="h-3 w-3" />
                  <span>Diagonal: {diagonal_in}&quot;</span>
                </div>
              )}

              {issues && issues.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                    Issues
                  </p>
                  {issues.map((issue, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 text-[11px] text-white/60"
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-400/70" />
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              )}

              {tips && tips.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/30">
                    Tips
                  </p>
                  {tips.map((tip, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-1.5 text-[11px] text-white/60"
                    >
                      <Lightbulb className="mt-0.5 h-3 w-3 flex-shrink-0 text-gold/70" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
