import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * AnimatedGradientBackground
 *
 * Renders a customizable animated radial gradient background with a breathing effect.
 * On mobile devices, the breathing animation is disabled and a static gradient is used
 * to prevent GPU drain and improve performance.
 */
const AnimatedGradientBackground = ({
  startingGap = 125,
  Breathing = false,
  gradientColors = [
    "#0A0A0A",
    "#2979FF",
    "#FF80AB",
    "#FF6D00",
    "#FFD600",
    "#00E676",
    "#3D5AFE",
  ],
  gradientStops = [35, 50, 60, 70, 80, 90, 100],
  animationSpeed = 0.02,
  breathingRange = 5,
  containerStyle = {},
  topOffset = 0,
  containerClassName = "",
}) => {
  if (gradientColors.length !== gradientStops.length) {
    throw new Error(
      `GradientColors and GradientStops must have the same length. Received gradientColors length: ${gradientColors.length}, gradientStops length: ${gradientStops.length}`
    );
  }

  const containerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile once on mount
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches || navigator.maxTouchPoints > 0);
    const handler = (e) => setIsMobile(e.matches || navigator.maxTouchPoints > 0);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Set static gradient on mobile, animate on desktop
  useEffect(() => {
    if (!containerRef.current) return;

    const gradientStopsString = gradientStops
      .map((stop, index) => `${gradientColors[index]} ${stop}%`)
      .join(", ");

    // Mobile: static gradient, no animation loop
    if (isMobile) {
      containerRef.current.style.background =
        `radial-gradient(${startingGap}% ${startingGap + topOffset}% at 50% 20%, ${gradientStopsString})`;
      containerRef.current.style.willChange = "auto";
      return;
    }

    // Desktop: breathing animation via rAF
    let animationFrame;
    let width = startingGap;
    let directionWidth = 1;

    const animateGradient = () => {
      if (width >= startingGap + breathingRange) directionWidth = -1;
      if (width <= startingGap - breathingRange) directionWidth = 1;

      if (!Breathing) directionWidth = 0;
      width += directionWidth * animationSpeed;

      const gradient = `radial-gradient(${width}% ${width + topOffset}% at 50% 20%, ${gradientStopsString})`;
      containerRef.current.style.background = gradient;

      animationFrame = requestAnimationFrame(animateGradient);
    };

    animationFrame = requestAnimationFrame(animateGradient);
    return () => cancelAnimationFrame(animationFrame);
  }, [startingGap, Breathing, gradientColors, gradientStops, animationSpeed, breathingRange, topOffset, isMobile]);

  return (
    <motion.div
      key="animated-gradient-background"
      initial={isMobile ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 1.5 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: isMobile
          ? { duration: 0 }
          : { duration: 2, ease: [0.25, 0.1, 0.25, 1] },
      }}
      className={`absolute inset-0 overflow-hidden ${containerClassName}`}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className="absolute inset-0"
      />
    </motion.div>
  );
};

export default AnimatedGradientBackground;
