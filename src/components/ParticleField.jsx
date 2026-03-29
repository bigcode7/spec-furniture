import { useEffect, useRef, useState } from "react";

const PARTICLE_COUNT = 35;
const PARALLAX_STRENGTH = 10;

function isMobileDevice() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches || navigator.maxTouchPoints > 0;
}

export default function ParticleField({ className = "" }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const particlesRef = useRef([]);
  const animRef = useRef(null);
  const [mobile] = useState(isMobileDevice);

  useEffect(() => {
    if (mobile) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize, { passive: true });

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 0.12 + 0.03;
      return {
        x: Math.random() * w(),
        y: Math.random() * h(),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.04,
        r: Math.random() * 2.0 + 0.5,
        opacity: Math.random() * 0.5 + 0.15,
        phase: Math.random() * Math.PI * 2,
        driftFreq: Math.random() * 0.8 + 0.4,
        driftAmp: Math.random() * 0.3 + 0.1,
        depth: Math.random() * 0.8 + 0.2,
      };
    });

    // Throttled mouse handler — update at most every 32ms (~30fps)
    let lastMouseTime = 0;
    const handleMouse = (e) => {
      const now = performance.now();
      if (now - lastMouseTime < 32) return;
      lastMouseTime = now;
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("pointermove", handleMouse, { passive: true });

    let t = 0;
    let frameCount = 0;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      frameCount++;
      // Throttle to ~30fps
      if (frameCount % 2 !== 0) return;

      t += 0.016;
      const cw = w();
      const ch = h();
      ctx.clearRect(0, 0, cw, ch);

      const mx = (mouseRef.current.x - 0.5) * 2;
      const my = (mouseRef.current.y - 0.5) * 2;

      for (const p of particlesRef.current) {
        const px = mx * PARALLAX_STRENGTH * p.depth;
        const py = my * PARALLAX_STRENGTH * p.depth;

        p.x += p.vx + Math.sin(t * p.driftFreq + p.phase) * p.driftAmp;
        p.y += p.vy + Math.cos(t * p.driftFreq * 0.7 + p.phase) * p.driftAmp * 0.5;

        if (p.x < -20) p.x = cw + 20;
        if (p.x > cw + 20) p.x = -20;
        if (p.y < -20) p.y = ch + 20;
        if (p.y > ch + 20) p.y = -20;

        const breathe = Math.sin(t * 2 + p.phase) * 0.15 + 0.85;
        const alpha = p.opacity * breathe;
        const drawX = p.x + px;
        const drawY = p.y + py;
        const glowR = p.r * 4;

        // Use simple radial fill instead of creating gradient objects every frame
        // Outer glow
        ctx.globalAlpha = alpha * 0.2;
        ctx.fillStyle = "rgb(200, 169, 126)";
        ctx.beginPath();
        ctx.arc(drawX, drawY, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Mid glow
        ctx.globalAlpha = alpha * 0.5;
        ctx.beginPath();
        ctx.arc(drawX, drawY, glowR * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgb(220, 200, 170)";
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handleMouse);
    };
  }, [mobile]);

  if (mobile) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ pointerEvents: "none", contain: "strict" }}
    />
  );
}
