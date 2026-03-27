import { useEffect, useRef, useState } from "react";

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
      `GradientColors and GradientStops must have the same length.`
    );
  }

  const containerRef = useRef(null);
  const outerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const rmq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsMobile(mq.matches || navigator.maxTouchPoints > 0);
    setPrefersReducedMotion(rmq.matches);
    const handler = (e) => setIsMobile(e.matches || navigator.maxTouchPoints > 0);
    const rHandler = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    rmq.addEventListener("change", rHandler);
    return () => {
      mq.removeEventListener("change", handler);
      rmq.removeEventListener("change", rHandler);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const gradientStopsString = gradientStops
      .map((stop, index) => `${gradientColors[index]} ${stop}%`)
      .join(", ");

    // Static gradient for mobile, reduced motion, or non-breathing
    if (isMobile || prefersReducedMotion || !Breathing) {
      containerRef.current.style.background =
        `radial-gradient(${startingGap}% ${startingGap + topOffset}% at 50% 20%, ${gradientStopsString})`;
      containerRef.current.style.willChange = "auto";
      return;
    }

    // Desktop breathing: throttled to ~30fps (every other frame)
    let animationFrame;
    let width = startingGap;
    let directionWidth = 1;
    let frameCount = 0;

    containerRef.current.style.willChange = "background";
    containerRef.current.style.transform = "translateZ(0)";

    const animateGradient = () => {
      frameCount++;
      if (frameCount % 2 === 0) {
        if (width >= startingGap + breathingRange) directionWidth = -1;
        if (width <= startingGap - breathingRange) directionWidth = 1;
        width += directionWidth * animationSpeed * 2;
        containerRef.current.style.background =
          `radial-gradient(${width}% ${width + topOffset}% at 50% 20%, ${gradientStopsString})`;
      }
      animationFrame = requestAnimationFrame(animateGradient);
    };

    animationFrame = requestAnimationFrame(animateGradient);
    return () => {
      cancelAnimationFrame(animationFrame);
      if (containerRef.current) {
        containerRef.current.style.willChange = "auto";
      }
    };
  }, [startingGap, Breathing, gradientColors, gradientStops, animationSpeed, breathingRange, topOffset, isMobile, prefersReducedMotion]);

  return (
    <div
      ref={outerRef}
      className={`absolute inset-0 overflow-hidden ${containerClassName}`}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className="absolute inset-0"
      />
    </div>
  );
};

export default AnimatedGradientBackground;
