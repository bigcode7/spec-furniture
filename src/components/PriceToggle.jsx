import { useTradePricing } from "@/lib/TradePricingContext";
import { motion } from "framer-motion";

export default function PriceToggle() {
  const { mode, toggleMode, hasDiscounts } = useTradePricing();

  // Don't render if no discounts are set up
  if (!hasDiscounts) return null;

  const isTrade = mode === "trade";

  return (
    <button
      onClick={toggleMode}
      className="relative flex h-7 items-center rounded-full border transition-all text-[10px] font-bold uppercase tracking-[0.12em]"
      style={{
        border: isTrade
          ? "1px solid rgba(110,180,140,0.35)"
          : "1px solid rgba(255,255,255,0.08)",
        background: isTrade
          ? "rgba(110,180,140,0.08)"
          : "rgba(255,255,255,0.03)",
      }}
      title={isTrade ? "Showing estimated trade prices" : "Showing retail/MSRP prices"}
    >
      <span
        className="px-2.5 py-1 z-10 transition-colors"
        style={{ color: !isTrade ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)" }}
      >
        Retail
      </span>
      <span
        className="px-2.5 py-1 z-10 transition-colors"
        style={{ color: isTrade ? "rgba(110,180,140,0.9)" : "rgba(255,255,255,0.2)" }}
      >
        Trade
      </span>
      <motion.div
        layout
        className="absolute top-0.5 bottom-0.5 rounded-full"
        style={{
          width: "calc(50% - 2px)",
          left: isTrade ? "calc(50% + 1px)" : "2px",
          background: isTrade
            ? "rgba(110,180,140,0.12)"
            : "rgba(255,255,255,0.06)",
        }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      />
    </button>
  );
}
