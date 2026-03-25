import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

/*
 * AnimatedGradientBackground — breathing radial gradient for SPEKD
 *
 * Props:
 *  breathing  – enable slow scale animation (default true)
 *  className  – extra classes on the wrapper
 *  style      – extra inline styles on the wrapper
 */

const GRADIENT_STOPS = [
  { color: "#080c18", pos: "0%" },
  { color: "#0f1e3d", pos: "30%" },
  { color: "#1a2f5e", pos: "55%" },
  { color: "#8b6914", pos: "80%" },
  { color: "#b8860b", pos: "100%" },
];

const radialGradient = `radial-gradient(ellipse at center, ${GRADIENT_STOPS.map(
  (s) => `${s.color} ${s.pos}`
).join(", ")})`;

export default function AnimatedGradientBackground({
  breathing = true,
  className = "",
  style = {},
}) {
  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ zIndex: 0, ...style }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: radialGradient }}
        animate={
          breathing
            ? { scale: [1, 1.05, 1], opacity: [0.9, 1, 0.9] }
            : undefined
        }
        transition={
          breathing
            ? { duration: 8, repeat: Infinity, ease: "easeInOut" }
            : undefined
        }
      />
      {/* Subtle noise overlay for texture */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
          opacity: 0.3,
        }}
      />
    </div>
  );
}
