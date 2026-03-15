import { useEffect, useRef } from "react";

const PARTICLE_COUNT = 28;
const PARALLAX_STRENGTH = 8;

export default function ParticleField({ className = "" }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const particlesRef = useRef([]);
  const animRef = useRef(null);

  useEffect(() => {
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
    window.addEventListener("resize", resize);

    const w = () => canvas.offsetWidth;
    const h = () => canvas.offsetHeight;

    // Gold dust particles
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * w(),
      y: Math.random() * h(),
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.1 - 0.05, // slight upward drift
      r: Math.random() * 1.8 + 0.6,
      opacity: Math.random() * 0.5 + 0.2,
      phase: Math.random() * Math.PI * 2,
      depth: Math.random() * 0.7 + 0.3, // parallax depth
    }));

    const handleMouse = (e) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
    };
    window.addEventListener("mousemove", handleMouse);

    let t = 0;
    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      t += 0.008;

      const cw = w();
      const ch = h();
      ctx.clearRect(0, 0, cw, ch);

      const mx = (mouseRef.current.x - 0.5) * 2;
      const my = (mouseRef.current.y - 0.5) * 2;

      for (const p of particlesRef.current) {
        // Parallax offset from mouse
        const px = mx * PARALLAX_STRENGTH * p.depth;
        const py = my * PARALLAX_STRENGTH * p.depth;

        // Drift
        p.x += p.vx;
        p.y += p.vy;

        // Wrap
        if (p.x < -20) p.x = cw + 20;
        if (p.x > cw + 20) p.x = -20;
        if (p.y < -20) p.y = ch + 20;
        if (p.y > ch + 20) p.y = -20;

        // Breathing opacity
        const breathe = Math.sin(t * 2 + p.phase) * 0.15 + 0.85;
        const alpha = p.opacity * breathe;

        const drawX = p.x + px;
        const drawY = p.y + py;

        // Gold glow
        const grad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, p.r * 4);
        grad.addColorStop(0, `rgba(201, 169, 110, ${alpha * 0.8})`);
        grad.addColorStop(0.4, `rgba(201, 169, 110, ${alpha * 0.2})`);
        grad.addColorStop(1, `rgba(201, 169, 110, 0)`);

        ctx.beginPath();
        ctx.arc(drawX, drawY, p.r * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core bright dot
        ctx.beginPath();
        ctx.arc(drawX, drawY, p.r * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(228, 206, 156, ${alpha})`;
        ctx.fill();
      }
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full ${className}`}
      style={{ pointerEvents: "none" }}
    />
  );
}
