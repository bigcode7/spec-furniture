import { motion, AnimatePresence } from "framer-motion";
import { Search } from "lucide-react";

export default function UsageCounter({ remaining, total = 5 }) {
  // Don't show for active subscribers (remaining would be null/undefined)
  if (remaining == null || remaining > total) return null;

  const urgency = remaining <= 1 ? "#ef4444" : remaining <= 2 ? "#f59e0b" : "#C9A96E";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full px-3.5 py-2"
        style={{
          background: "rgba(16,17,24,0.9)",
          border: `1px solid ${urgency}33`,
          backdropFilter: "blur(12px)",
          boxShadow: `0 4px 20px ${urgency}15`,
        }}
      >
        <Search className="h-3.5 w-3.5" style={{ color: urgency }} />
        <span className="text-xs font-medium" style={{ color: urgency }}>
          {remaining} of {total} free searches remaining
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
