import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * AnimatedGradientBackground
 *
 * Renders a customizable animated radial gradient background with a breathing effect.
 * Uses framer-motion for entrance animation and raw CSS gradients for the dynamic background.
 *
 * @param {object} props
 * @param {number}   [props.startingGap=125]        - Initial radial gradient size (width %)
 * @param {boolean}  [props.Breathing=false]         - Enable breathing animation
 * @param {string[]} [props.gradientColors]          - Array of CSS colors for the gradient
 * @param {number[]} [props.gradientStops]           - Stop percentages matching gradientColors
 * @param {number}   [props.animationSpeed=0.02]     - Breathing animation speed
 * @param {number}   [props.breathingRange=5]        - Max breathing expansion range (%)
 * @param {object}   [props.containerStyle={}]       - Extra inline styles
 * @param {string}   [props.containerClassName=""]   - Extra class names
 * @param {number}   [props.topOffset=0]             - Top offset for gradient origin
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

  useEffect(() => {
    let animationFrame;
    let width = startingGap;
    let directionWidth = 1;

    const animateGradient = () => {
      if (width >= startingGap + breathingRange) directionWidth = -1;
      if (width <= startingGap - breathingRange) directionWidth = 1;

      if (!Breathing) directionWidth = 0;
      width += directionWidth * animationSpeed;

      const gradientStopsString = gradientStops
        .map((stop, index) => `${gradientColors[index]} ${stop}%`)
        .join(", ");

      const gradient = `radial-gradient(${width}% ${width + topOffset}% at 50% 20%, ${gradientStopsString})`;

      if (containerRef.current) {
        containerRef.current.style.background = gradient;
      }

      animationFrame = requestAnimationFrame(animateGradient);
    };

    animationFrame = requestAnimationFrame(animateGradient);

    return () => cancelAnimationFrame(animationFrame);
  }, [startingGap, Breathing, gradientColors, gradientStops, animationSpeed, breathingRange, topOffset]);

  return (
    <motion.div
      key="animated-gradient-background"
      initial={{ opacity: 0, scale: 1.5 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: {
          duration: 2,
          ease: [0.25, 0.1, 0.25, 1],
        },
      }}
      className={`absolute inset-0 overflow-hidden ${containerClassName}`}
    >
      <div
        ref={containerRef}
        style={containerStyle}
        className="absolute inset-0 transition-transform"
      />
    </motion.div>
  );
};

export default AnimatedGradientBackground;
