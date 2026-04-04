import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Search, ArrowRight, Brain, Shield,
  FileText, Send,
} from "lucide-react";
import {
  motion, useInView,
} from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";
import ScrollExperience from "@/components/ScrollExperience";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");
const EASE = [0.22, 1, 0.36, 1];

// ── THE DIGITAL SHOWROOM — Palette ──
const P = {
  cream:        "#F5F0E8",
  creamDark:    "#EBE4D8",
  white:        "#FEFCF9",
  green:        "#2C3E2D",
  greenLight:   "#3D5240",
  greenMuted:   "#5A7A5E",
  sage:         "#C2CCBA",
  sageDark:     "#8A9A8A",
  brass:        "#B8956A",
  brassLight:   "#D4B88A",
  brassDark:    "#96744D",
  brassRgb:     "184,149,106",
  greenRgb:     "44,62,45",
  sageRgb:      "194,204,186",
  textPrimary:  "#E9E1DD",
  textSecondary:"#B0A898",
  textMuted:    "#7A736B",
  obsidian:     "#161311",
  surface:      "#1E1B19",
  surfaceHigh:  "#2D2927",
  surfaceHigher:"#383432",
  onSurface:    "#E9E1DD",
  onSurfaceDim: "#B0A898",
};

const EXAMPLE_SEARCHES = [
  "curved bouclé sofa",
  "mid-century teak credenza",
  "marble coffee table",
  "statement accent chair",
  "woven rattan pendant",
];

// ════════════════════════════════════════════════════════
// 3D WIREFRAME CANVAS — Architectural Chair
// Lightweight canvas-based renderer, no Three.js needed
// ════════════════════════════════════════════════════════
function WireframeCanvas() {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const angleRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Subtle mouse parallax
    const handleMouse = (e) => {
      mouseRef.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 0.15,
        y: (e.clientY / window.innerHeight - 0.5) * 0.10,
      };
    };
    window.addEventListener("mousemove", handleMouse, { passive: true });

    // Chair wireframe vertices (normalized -1 to 1)
    const verts = [
      // Seat
      [-0.5,0,-0.4],[0.5,0,-0.4],[0.5,0,0.4],[-0.5,0,0.4],
      [-0.5,0.05,-0.4],[0.5,0.05,-0.4],[0.5,0.05,0.4],[-0.5,0.05,0.4],
      // Legs
      [-0.45,-0.7,0.35],[0.45,-0.7,0.35],[-0.45,-0.7,-0.35],[0.45,-0.7,-0.35],
      // Backrest
      [-0.48,0.85,-0.38],[0.48,0.85,-0.38],[-0.48,0.55,-0.38],[0.48,0.55,-0.38],
      // Backrest inner
      [-0.38,0.78,-0.36],[0.38,0.78,-0.36],[-0.38,0.15,-0.36],[0.38,0.15,-0.36],
      // Armrests
      [-0.52,0.35,0.15],[0.52,0.35,0.15],[-0.52,0.45,-0.35],[0.52,0.45,-0.35],
    ];

    const edges = [
      [4,5],[5,6],[6,7],[7,4],[0,1],[1,2],[2,3],[3,0],
      [0,4],[1,5],[2,6],[3,7],[2,9],[3,8],[0,10],[1,11],
      [0,14],[14,12],[1,15],[15,13],[12,13],[14,15],
      [16,17],[17,19],[19,18],[18,16],
      [20,22],[22,14],[21,23],[23,15],[7,20],[6,21],
    ];

    // Floating architectural particles
    const particles = Array.from({ length: 22 }, () => ({
      x: (Math.random() - 0.5) * 3.5,
      y: (Math.random() - 0.5) * 3,
      z: (Math.random() - 0.5) * 2,
      size: 1 + Math.random() * 2.5,
      speed: 0.001 + Math.random() * 0.003,
      phase: Math.random() * Math.PI * 2,
    }));

    const project = (v, w, h, angle) => {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const cosM = Math.cos(mx), sinM = Math.sin(mx);
      // Y-axis rotation (main) + subtle mouse tilt
      let x = v[0] * cosA - v[2] * sinA;
      let z = v[0] * sinA + v[2] * cosA;
      let y = v[1] + my * 0.3;
      // Apply slight X-rotation from mouse
      const x2 = x * cosM - z * sinM;
      const z2 = x * sinM + z * cosM;
      x = x2; z = z2;
      const perspective = 3.5;
      const scale = perspective / (perspective + z + 1.5);
      return [w * 0.5 + x * scale * w * 0.28, h * 0.52 - y * scale * h * 0.32, scale];
    };

    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      if (!prefersReduced) angleRef.current += 0.002;
      const angle = angleRef.current;

      // Particles
      const t = Date.now() * 0.001;
      particles.forEach((p) => {
        const px = p.x + Math.sin(t * p.speed * 60 + p.phase) * 0.3;
        const py = p.y + Math.cos(t * p.speed * 42 + p.phase) * 0.2;
        const [sx, sy, sc] = project([px, py, p.z], w, h, angle * 0.3);
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * sc, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${P.brassRgb}, ${0.10 * sc})`;
        ctx.fill();
      });

      // Edges
      edges.forEach(([a, b]) => {
        const [x1, y1, s1] = project(verts[a], w, h, angle);
        const [x2, y2, s2] = project(verts[b], w, h, angle);
        const avg = (s1 + s2) / 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${P.brassRgb}, ${0.18 + avg * 0.14})`;
        ctx.lineWidth = 1.1 * avg;
        ctx.stroke();
      });

      // Vertices — small brass dots
      verts.forEach((v) => {
        const [sx, sy, sc] = project(v, w, h, angle);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8 * sc, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${P.brassRgb}, ${0.30 * sc})`;
        ctx.fill();
      });

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.80 }}
      aria-hidden="true"
    />
  );
}

// ── Scroll-triggered reveal ──
function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Animated counter ──
function AnimatedCounter({ target, suffix = "", prefix = "" }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !target) return;
    let start = 0;
    const step = target / 120;
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, target]);
  return <span ref={ref}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ── Glass Card — tonal layering, ghost borders per Stitch design system ──
function GlassCard({ children, className = "", hover = true }) {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: "rgba(30,27,25,0.85)",
        backdropFilter: "blur(20px) saturate(1.2)",
        WebkitBackdropFilter: "blur(20px) saturate(1.2)",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 24px rgba(44,62,45,0.05), 0 1px 3px rgba(0,0,0,0.03)",
      }}
      whileHover={hover ? {
        y: -3,
        boxShadow: "0 12px 40px rgba(44,62,45,0.09), 0 4px 12px rgba(0,0,0,0.05)",
        borderColor: `rgba(${P.brassRgb}, 0.15)`,
      } : {}}
      transition={{ duration: 0.3, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// ── Design Intent Decoder ──
function IntentDecoder() {
  const inputPhrase = "modern high back swivel chair";
  const [typedLength, setTypedLength] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i > inputPhrase.length) { clearInterval(timer); return; }
      setTypedLength(i);
    }, 60);
    return () => clearInterval(timer);
  }, [inView]);

  const decoded = [
    { label: "Category", value: "Accent Chair", color: P.green },
    { label: "Back Style", value: "High Back", color: P.brass },
    { label: "Feature", value: "Swivel Base", color: P.greenMuted },
    { label: "Style", value: "Modern / Contemporary", color: P.green },
    { label: "Silhouette", value: "Upright, Structured", color: P.brass },
    { label: "Intent", value: "Statement seating with support", color: P.greenMuted },
  ];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: P.white, border: `1px solid rgba(${P.greenRgb},0.06)` }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: `rgba(${P.sageRgb},0.15)`, borderBottom: `1px solid rgba(${P.greenRgb},0.05)` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: P.sage }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: P.sage }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: P.sage }} />
        <span className="ml-auto text-[9px] font-mono" style={{ color: P.textMuted }}>spekd.ai</span>
      </div>
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl" style={{ background: `rgba(${P.sageRgb},0.12)` }}>
          <img src="/logo.png" alt="" className="h-5 w-5 object-contain" />
          <span ref={ref} className="text-sm italic" style={{ color: P.textSecondary }}>
            "{inputPhrase.slice(0, typedLength)}{typedLength < inputPhrase.length ? <span className="animate-pulse" style={{ color: P.brass }}>|</span> : ""}"
          </span>
        </div>
        <div className="flex items-center gap-2 mb-5 px-1">
          <div className="h-px flex-1" style={{ background: `linear-gradient(to right, ${P.brass}33, transparent)` }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: P.brass }}>Spekd understands</span>
          <div className="h-px flex-1" style={{ background: `linear-gradient(to left, ${P.brass}33, transparent)` }} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {decoded.map((attr, i) => (
            <div key={attr.label}
              className="rounded-lg px-3 py-2.5 transition-all duration-500"
              style={{
                background: `rgba(${P.sageRgb},0.10)`,
                opacity: typedLength >= inputPhrase.length ? 1 : 0,
                transform: typedLength >= inputPhrase.length ? "translateY(0)" : "translateY(8px)",
                transitionDelay: `${i * 100}ms`,
              }}>
              <div className="text-[9px] font-semibold uppercase tracking-[0.15em] mb-1" style={{ color: P.textMuted }}>{attr.label}</div>
              <div className="text-[13px] font-medium" style={{ color: attr.color }}>{attr.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 px-3 py-2.5 rounded-lg" style={{ background: `rgba(${P.brassRgb},0.06)` }}>
          <div className="text-[10px] leading-relaxed" style={{ color: P.textSecondary }}>
            <span style={{ color: P.brass }} className="font-semibold">&rarr;</span> Matches back style, base type, and silhouette as hard filters across 20 vendors
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hardcoded featured vendors (fallback while API loads — no fake counts) ──
const FEATURED_VENDORS = [
  { name: "Hooker Furniture" },
  { name: "Caracole" },
  { name: "Century Furniture" },
];

// ── Mock Vendor UI ──
function MockVendorUI({ vendors }) {
  const topVendors = vendors.length >= 3 ? vendors.slice(0, 3) : FEATURED_VENDORS;
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: P.white, border: `1px solid rgba(${P.greenRgb},0.06)` }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: `rgba(${P.sageRgb},0.15)`, borderBottom: `1px solid rgba(${P.greenRgb},0.05)` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: P.sage }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: P.sage }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: P.sage }} />
        <span className="ml-auto text-[9px] font-mono" style={{ color: P.textMuted }}>spekd.ai/vendors</span>
      </div>
      <div className="p-5 space-y-3">
        {topVendors.map((v) => (
          <div key={v.name} className="flex items-center gap-3 p-3 rounded-xl transition-colors" style={{ background: `rgba(${P.sageRgb},0.08)` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display text-sm" style={{ background: `rgba(${P.brassRgb},0.12)`, color: P.brass }}>
              {v.name[0]}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: P.textPrimary }}>{v.name}</div>
              <div className="text-[10px]" style={{ color: P.textMuted }}>
                {(v.product_count || v.active_skus) > 0
                  ? `${(v.product_count || v.active_skus).toLocaleString()} products`
                  : "Trade-only catalog"}
              </div>
            </div>
            <ArrowRight className="w-3 h-3" style={{ color: P.textMuted }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hardcoded demo products ──
const DEMO_PRODUCTS = [
  { id: "caracole_lean-on-me", product_name: "Lean On Me", manufacturer_name: "Caracole", image_url: "https://cdn.shopify.com/s/files/1/0710/9299/4095/files/f39ucdyxymdpjaqwzcnr.jpg?v=1773686507" },
  { id: "hooker_caleigh-recliner", product_name: "Caleigh Recliner", manufacturer_name: "Hooker Furniture", image_url: "https://hookerfurnishings.com/media/catalog/product/R/C/RC143_094_silo.jpg" },
  { id: "gabby_nantucket-recliner-sch-r1492", product_name: "Nantucket Recliner", manufacturer_name: "Gabby", image_url: "https://cdn.shopify.com/s/files/1/0625/1007/1895/files/image_e9v65lq92l5a9fk9oshjlr0f09.jpg?v=1772795521" },
];

// ── Mock Search UI ──
function MockSearchUI() {
  const demoQuery = "recliner that doesn't look like a recliner";
  const products = DEMO_PRODUCTS;
  const [typedLength, setTypedLength] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  // Preload product images immediately on mount so they're cached before typing ends
  useEffect(() => {
    DEMO_PRODUCTS.forEach((p) => {
      if (p.image_url) {
        const img = new Image();
        img.src = `${SEARCH_URL}/proxy-image?url=${encodeURIComponent(p.image_url)}`;
      }
    });
  }, []);

  useEffect(() => {
    if (!inView) return;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      if (i > demoQuery.length) {
        clearInterval(timer);
        setTimeout(() => setShowResults(true), 400);
        return;
      }
      setTypedLength(i);
    }, 50);
    return () => clearInterval(timer);
  }, [inView]);

  const typingDone = typedLength >= demoQuery.length;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: P.white, border: `1px solid rgba(${P.greenRgb},0.06)` }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: `rgba(${P.sageRgb},0.15)`, borderBottom: `1px solid rgba(${P.greenRgb},0.05)` }}>
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: P.sage }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: P.sage }} />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: P.sage }} />
        <span className="ml-auto text-[9px] font-mono" style={{ color: P.textMuted }}>spekd.ai</span>
      </div>
      <div className="p-4">
        <div ref={ref} className="flex items-center gap-3 rounded-full px-4 py-2.5 mb-4" style={{ background: `rgba(${P.sageRgb},0.10)` }}>
          <img src="/logo.png" alt="" className="h-4 w-4 object-contain shrink-0" />
          <span className="text-[12px] truncate flex-1" style={{ color: P.textMuted }}>
            {demoQuery.slice(0, typedLength)}
            {!typingDone && <span className="animate-pulse" style={{ color: P.brass }}>|</span>}
          </span>
          <div className="h-7 px-3 rounded-full text-[10px] font-semibold flex items-center shrink-0 transition-all duration-300"
            style={{ background: typingDone ? P.green : `rgba(${P.greenRgb},0.08)`, color: typingDone ? "#fff" : P.textMuted }}>
            Search
          </div>
        </div>
        {typingDone && !showResults && (
          <div className="flex items-center justify-center gap-2 py-6">
            <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: P.brass, animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: P.brass, animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 rounded-full animate-bounce" style={{ background: P.brass, animationDelay: "300ms" }} />
          </div>
        )}
        {showResults && (
          <div className="grid grid-cols-3 gap-2.5">
            {products.map((item, i) => (
              <div key={i} className="rounded-xl overflow-hidden transition-all duration-500"
                style={{ background: P.white, border: `1px solid rgba(${P.greenRgb},0.05)`, opacity: showResults ? 1 : 0, transform: showResults ? "translateY(0)" : "translateY(12px)", transitionDelay: `${i * 120}ms` }}>
                <div className="relative overflow-hidden" style={{ aspectRatio: "4/3", backgroundColor: "#faf8f5" }}>
                  {item.image_url ? (
                    <img src={`${SEARCH_URL}/proxy-image?url=${encodeURIComponent(item.image_url)}`} alt={item.product_name} className="h-full w-full" style={{ objectFit: "contain", padding: "8px" }} referrerPolicy="no-referrer" loading="eager" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" style={{ color: P.textMuted }}>
                      <div className="text-xl font-display">{(item.manufacturer_name || "?")[0]}</div>
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-[8px] font-bold uppercase tracking-[0.18em] mb-0.5 truncate" style={{ color: P.brass }}>{item.manufacturer_name}</div>
                  <div className="text-[11px] line-clamp-2 mb-1 leading-tight" style={{ color: P.textPrimary }}>{item.product_name}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Feature section ──
function FeatureSection({ kicker, title, description, mockUI, reverse = false, icon: Icon }) {
  return (
    <div className="py-24 md:py-32">
      <div className="page-wrap">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <Reveal className={reverse ? "lg:order-2" : ""}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `rgba(${P.sageRgb},0.20)`, border: `1px solid rgba(${P.sageRgb},0.30)` }}>
                <Icon className="w-5 h-5" style={{ color: P.green }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: P.brass }}>{kicker}</span>
            </div>
            <h3 className="font-display text-3xl md:text-4xl lg:text-[42px] leading-[1.08] mb-5" style={{ color: P.textPrimary }}>{title}</h3>
            <p className="text-base leading-7 max-w-lg" style={{ color: P.textSecondary }}>{description}</p>
          </Reveal>
          <Reveal delay={0.15} className={reverse ? "lg:order-1" : ""}>
            <motion.div
              whileHover={{ y: -4, boxShadow: "0 16px 48px rgba(44,62,45,0.10), 0 4px 16px rgba(0,0,0,0.05)" }}
              transition={{ duration: 0.4, ease: EASE }}
              className="rounded-2xl overflow-hidden"
              style={{ boxShadow: "0 4px 24px rgba(44,62,45,0.06), 0 1px 3px rgba(0,0,0,0.04)" }}
            >
              {mockUI}
            </motion.div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}


// ── 3D Carousel Showcase ──
const CAROUSEL_ITEMS = [
  { name: "Revelin Sofa", vendor: "Hooker Furniture", style: "Transitional", color: "#8B6F47", image: "https://hookerfurnishings.com/media/catalog/product/2/0/203_95_922000_82_silo.jpg" },
  { name: "Chase Leather Sofa", vendor: "Lexington", style: "Contemporary", color: "#4A3728", image: "https://www.lexington.com/feedcache/productFull/7725_33_02.jpg" },
  { name: "Brandon Sofa", vendor: "CR Laine", style: "Modern", color: "#6B5B45", image: "https://www.crlaine.com/assets/images/products/xlarge/L1190-00.jpg" },
  { name: "Flossie Sofa", vendor: "Hancock & Moore", style: "Traditional", color: "#5C4A3A", image: "https://hancockandmoore.com/Documents/prod-images/CJ6815-3_Flossie_TibDoe_MD_1022_HR.jpg" },
  { name: "Candace Sofa", vendor: "Bernhardt", style: "Transitional", color: "#7A6050", image: "https://s3.amazonaws.com/emuncloud-staticassets/productImages/bh074/medium/7277LFO.jpg" },
];

const SEARCH_URL_CAROUSEL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

function CarouselShowcase() {
  const [activeIdx, setActiveIdx] = useState(2);
  const [dragStart, setDragStart] = useState(null);
  const n = CAROUSEL_ITEMS.length;

  const prev = () => setActiveIdx((i) => (i - 1 + n) % n);
  const next = () => setActiveIdx((i) => (i + 1) % n);

  const onDragStart = (e) => setDragStart(e.clientX ?? e.touches?.[0]?.clientX);
  const onDragEnd = (e) => {
    if (dragStart === null) return;
    const end = e.clientX ?? e.changedTouches?.[0]?.clientX ?? dragStart;
    if (dragStart - end > 50) next();
    else if (end - dragStart > 50) prev();
    setDragStart(null);
  };

  return (
    <div
      className="relative w-full cursor-grab active:cursor-grabbing select-none"
      style={{ perspective: "1200px", height: "380px" }}
      onMouseDown={onDragStart} onMouseUp={onDragEnd}
      onTouchStart={onDragStart} onTouchEnd={onDragEnd}
    >
      {CAROUSEL_ITEMS.map((item, i) => {
        const offset = ((i - activeIdx + n) % n);
        const normalized = offset > n/2 ? offset - n : offset; // -2 to 2
        const angle = normalized * 38; // degrees
        const z = Math.abs(normalized) === 0 ? 0 : Math.abs(normalized) === 1 ? -180 : -380;
        const scale = normalized === 0 ? 1 : Math.abs(normalized) === 1 ? 0.78 : 0.58;
        const opacity = normalized === 0 ? 1 : Math.abs(normalized) === 1 ? 0.65 : 0.3;
        const zIndex = normalized === 0 ? 10 : Math.abs(normalized) === 1 ? 5 : 1;
        const translateX = normalized * 52;

        return (
          <div
            key={item.name}
            onClick={() => normalized !== 0 && setActiveIdx(i)}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: "280px",
              transform: `translate(-50%, -50%) translateX(${translateX}%) translateZ(${z}px) rotateY(${angle}deg) scale(${scale})`,
              opacity,
              zIndex,
              transition: "all 0.6s cubic-bezier(0.22,1,0.36,1)",
              cursor: normalized !== 0 ? "pointer" : "default",
            }}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "#1E1B19",
                border: "1px solid rgba(255,255,255,0.06)",
                boxShadow: normalized === 0
                  ? `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(184,149,106,0.15), 0 0 60px rgba(184,149,106,0.08)`
                  : "0 16px 40px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ aspectRatio: "4/3", background: "#fff", overflow: "hidden" }}>
                <img
                  src={`${SEARCH_URL_CAROUSEL}/proxy-image?url=${encodeURIComponent(item.image)}`}
                  alt={item.name}
                  className="h-full w-full object-contain p-4"
                  loading="lazy"
                  style={{ transition: "transform 0.4s ease" }}
                />
              </div>
              <div className="p-4">
                <div className="text-[9px] uppercase tracking-[0.2em] mb-1" style={{ color: "#B8956A" }}>{item.vendor}</div>
                <div className="text-base font-medium" style={{ color: "#E9E1DD", fontFamily: "'Playfair Display', serif" }}>{item.name}</div>
                <div className="text-[11px] mt-0.5" style={{ color: "rgba(233,225,221,0.45)" }}>{item.style}</div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Nav arrows */}
      <button
        onClick={prev}
        className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-all"
        style={{ background: "rgba(184,149,106,0.12)", border: "1px solid rgba(184,149,106,0.25)", color: "#B8956A" }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(184,149,106,0.25)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(184,149,106,0.12)"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <button
        onClick={next}
        className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-10 h-10 rounded-full cursor-pointer transition-all"
        style={{ background: "rgba(184,149,106,0.12)", border: "1px solid rgba(184,149,106,0.25)", color: "#B8956A" }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(184,149,106,0.25)"}
        onMouseLeave={e => e.currentTarget.style.background = "rgba(184,149,106,0.12)"}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2">
        {CAROUSEL_ITEMS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className="cursor-pointer transition-all rounded-full"
            style={{
              width: i === activeIdx ? "20px" : "6px",
              height: "6px",
              background: i === activeIdx ? "#B8956A" : "rgba(184,149,106,0.3)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// THE DIGITAL SHOWROOM — LANDING PAGE
// ════════════════════════════════════════════════════════
export default function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const goToSearch = useCallback((url) => {
    try { sessionStorage.setItem("spekd_search_entry", JSON.stringify({ from: "landing", ts: Date.now() })); } catch {}
    navigate(url);
  }, [navigate]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) goToSearch(`${createPageUrl("Search")}?q=${encodeURIComponent(query.trim())}`);
    else goToSearch(createPageUrl("Search"));
  };

  // ── Live data ──
  const [catalogStats, setCatalogStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorNames, setVendorNames] = useState([]);

  useEffect(() => {
    fetch(`${SEARCH_URL}/catalog/stats`).then((r) => r.json()).then((data) => setCatalogStats(data.catalog || data)).catch(() => {});
    fetch(`${SEARCH_URL}/vendors`).then((r) => r.json()).then((data) => {
      const v = (data.vendors || []).sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
      setVendors(v);
      setVendorNames(v.map((x) => x.name));
    }).catch(() => {});
    sessionStorage.removeItem("spekd_demo_products");
    sessionStorage.removeItem("spekd_demo_v2");
  }, []);

  const totalProducts = Math.max(catalogStats?.total_products || 0, 42000);
  const totalVendors = Math.max(vendors.length || 0, 20);
  const marqueeNames = vendorNames.length > 0 ? vendorNames : [
    "Bernhardt", "Hooker Furniture", "Century Furniture", "Vanguard",
    "Caracole", "Baker Furniture", "Theodore Alexander", "Stickley",
  ];

  return (
    <div className="relative min-h-screen" style={{ background: "#161311" }}>

      {/* ═══════════════════════════════════════════
          SCROLL EXPERIENCE — The Digital Showroom
          ═══════════════════════════════════════════ */}
      <ScrollExperience />

      {/* ═══════════════════════════════════════════
          VENDOR MARQUEE — "Trusted by the Trade"
          ═══════════════════════════════════════════ */}
      <section className="relative py-14 sm:py-18 z-10" style={{ background: "rgba(255,255,255,0.03)" }}>
        <Reveal className="text-center mb-8">
          <span className="text-[10px] font-semibold uppercase tracking-[0.3em]" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>Trusted by the Trade</span>
        </Reveal>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-40 z-10" style={{ background: `linear-gradient(to right, rgba(255,255,255,0.03) 0%, #161311, transparent)` }} />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-40 z-10" style={{ background: `linear-gradient(to left, rgba(255,255,255,0.03) 0%, #161311, transparent)` }} />
          <div className="brand-marquee whitespace-nowrap">
            {[...marqueeNames, ...marqueeNames].map((name, i) => (
              <span key={`${name}-${i}`} className="inline-flex items-center mx-6 sm:mx-10">
                <span className="text-sm sm:text-base tracking-[0.08em] uppercase whitespace-nowrap" style={{ fontWeight: 600, color: `rgba(${P.greenRgb},0.20)`, fontFamily: "'DM Sans', sans-serif" }}>{name}</span>
                <span className="ml-6 sm:ml-10" style={{ color: `rgba(${P.brassRgb},0.25)` }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          STATS RIBBON
          ═══════════════════════════════════════════ */}
      <section className="relative py-16 sm:py-20 md:py-28 z-10">
        <div className="page-wrap-wide">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-4xl mx-auto">
            {[
              { value: totalProducts, suffix: "+", label: "Products", sublabel: "Trade-only pieces indexed" },
              { value: totalVendors, suffix: "", label: "Trade Vendors", sublabel: "Manufacturer-direct sources" },
              { value: 100, suffix: "%", label: "Verified", sublabel: "Every source authenticated" },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.08}>
                <GlassCard className="p-6 sm:p-8 text-center cursor-default">
                  <div className="text-4xl sm:text-5xl font-semibold tracking-tight" style={{ color: P.textPrimary, fontFamily: "'Playfair Display', serif" }}>
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.25em] mt-3" style={{ color: P.brass }}>{stat.label}</div>
                  <div className="text-[11px] mt-1.5" style={{ color: P.textSecondary }}>{stat.sublabel}</div>
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          HOW IT WORKS — Three cards with green left accent
          ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-24 md:py-32 z-10">
        <div className="page-wrap-wide">
          <Reveal className="text-center mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>How It Works</span>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-14 sm:mb-20">
            <h2 className="text-3xl md:text-5xl lg:text-6xl" style={{ color: P.textPrimary, fontFamily: "'Playfair Display', serif" }}>
              Three steps to the <span style={{ color: P.green }}>right piece</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            {/* Step 01 — Wide card (col-span-2) */}
            <Reveal delay={0}>
              <GlassCard className="md:col-span-2 p-8 sm:p-10 cursor-default overflow-visible min-h-[220px]">
                {/* Green left accent bar */}
                <div className="absolute left-0 top-6 bottom-6 w-[3px] rounded-full" style={{ background: `linear-gradient(to bottom, ${P.green}, ${P.greenMuted})` }} />
                {/* Oversized step number watermark */}
                <div className="absolute top-2 right-4 text-[100px] font-bold leading-none pointer-events-none select-none" style={{ color: `rgba(${P.sageRgb},0.12)`, fontFamily: "'Playfair Display', serif" }}>01</div>
                <div className="text-[11px] font-bold tracking-[0.2em] mb-5" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>01</div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: `rgba(${P.sageRgb},0.20)`, border: `1px solid rgba(${P.sageRgb},0.30)` }}>
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
                    <Search className="w-5 h-5" style={{ color: P.green }} />
                  </motion.div>
                </div>
                <h3 className="text-3xl mb-3" style={{ color: P.textPrimary, fontFamily: "'Playfair Display', serif" }}>Describe</h3>
                <p className="text-sm leading-relaxed max-w-md" style={{ color: P.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>Type the way you'd brief a colleague. Style, material, mood, room — Spekd understands designer language.</p>
              </GlassCard>
            </Reveal>

            {/* Step 02 — Tall accent card (col-span-1) */}
            <Reveal delay={0.12}>
              <GlassCard className="p-7 sm:p-8 cursor-default overflow-visible min-h-[220px] flex flex-col justify-between">
                <div className="absolute left-0 top-6 bottom-6 w-[3px] rounded-full" style={{ background: `linear-gradient(to bottom, ${P.brass}, ${P.brassLight})` }} />
                <div className="absolute top-2 right-4 text-[80px] font-bold leading-none pointer-events-none select-none" style={{ color: `rgba(${P.sageRgb},0.12)`, fontFamily: "'Playfair Display', serif" }}>02</div>
                <div>
                  <div className="text-[11px] font-bold tracking-[0.2em] mb-5" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>02</div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: `rgba(${P.sageRgb},0.20)`, border: `1px solid rgba(${P.sageRgb},0.30)` }}>
                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}>
                      <FileText className="w-5 h-5" style={{ color: P.green }} />
                    </motion.div>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl mb-3" style={{ color: P.textPrimary, fontFamily: "'Playfair Display', serif" }}>Curate</h3>
                  <p className="text-sm leading-relaxed" style={{ color: P.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>Save your finds, organize by room, apply trade pricing.</p>
                </div>
              </GlassCard>
            </Reveal>

            {/* Step 03 — Full-width horizontal card (col-span-3) */}
            <Reveal delay={0.24}>
              <GlassCard className="md:col-span-3 p-7 sm:p-8 cursor-default overflow-visible">
                <div className="absolute left-0 top-6 bottom-6 w-[3px] rounded-full" style={{ background: `linear-gradient(to bottom, ${P.greenMuted}, ${P.sage})` }} />
                <div className="absolute top-2 right-4 text-[100px] font-bold leading-none pointer-events-none select-none" style={{ color: `rgba(${P.sageRgb},0.12)`, fontFamily: "'Playfair Display', serif" }}>03</div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-12">
                  <div className="flex-shrink-0">
                    <div className="text-[11px] font-bold tracking-[0.2em] mb-5" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>03</div>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ background: `rgba(${P.sageRgb},0.20)`, border: `1px solid rgba(${P.sageRgb},0.30)` }}>
                      <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                        <Send className="w-5 h-5" style={{ color: P.green }} />
                      </motion.div>
                    </div>
                    <h3 className="text-2xl" style={{ color: P.textPrimary, fontFamily: "'Playfair Display', serif" }}>Present</h3>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm leading-relaxed" style={{ color: P.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>Generate polished PDFs and shareable client links. Professional presentations in seconds — no manual formatting, no extra tools.</p>
                    <div className="mt-4 flex gap-3">
                      {["PDF Export", "Client Portal", "Room Breakdown", "Trade Pricing"].map((tag) => (
                        <span key={tag} className="rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em]" style={{ background: `rgba(${P.sageRgb},0.20)`, color: P.textSecondary }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Subtle divider — tonal shift, not a line */}
      <div className="relative z-10 overflow-hidden" style={{ height: "48px", marginTop: "-1px" }}>
        <svg viewBox="0 0 1440 48" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" fill="none">
          <path d="M0,24 C240,48 480,0 720,24 C960,48 1200,0 1440,24" stroke={`rgba(${P.sageRgb},0.30)`} strokeWidth="1" fill="none"/>
        </svg>
      </div>

      {/* ═══════════════════════════════════════════
          FEATURE SECTIONS
          ═══════════════════════════════════════════ */}
      <div className="relative z-10">
        <FeatureSection
          kicker="Natural Language"
          title={<>Search the way you <span style={{ color: P.green }}>actually think</span></>}
          description="Type the way you'd brief a colleague. Describe the vision — material, style, mood, budget — and Spekd finds every match across your favorite vendors."
          mockUI={<IntentDecoder />}
          icon={Brain}
        />

        <div className="relative z-10 overflow-hidden" style={{ height: "48px", marginTop: "-1px" }}>
          <svg viewBox="0 0 1440 48" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" fill="none">
            <path d="M0,24 C240,48 480,0 720,24 C960,48 1200,0 1440,24" stroke={`rgba(${P.sageRgb},0.30)`} strokeWidth="1" fill="none"/>
          </svg>
        </div>

        <FeatureSection
          kicker="Verified Sources"
          title={<>Every vendor, <span style={{ color: P.green }}>verified at source</span></>}
          description={`${totalVendors} trade-only manufacturer catalogs, curated and kept current. Every product links directly to the vendor.`}
          mockUI={<MockVendorUI vendors={vendors} />}
          icon={Shield}
          reverse
        />

        <div className="relative z-10 overflow-hidden" style={{ height: "48px", marginTop: "-1px" }}>
          <svg viewBox="0 0 1440 48" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" fill="none">
            <path d="M0,24 C240,48 480,0 720,24 C960,48 1200,0 1440,24" stroke={`rgba(${P.sageRgb},0.30)`} strokeWidth="1" fill="none"/>
          </svg>
        </div>

        <FeatureSection
          kicker="Intelligent Search"
          title={<>Describe the vision, <span style={{ color: P.green }}>we find the pieces</span></>}
          description="Spekd understands design intent — materials, styles, budgets — then surfaces exactly the right pieces from every vendor at once."
          mockUI={<MockSearchUI />}
          icon={Search}
        />
      </div>

      {/* ════════════════════════════════════════
          3D PRODUCT CAROUSEL — The Showroom Wall
          ════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 z-10 overflow-hidden">
        <div className="page-wrap-wide">
          <Reveal className="text-center mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>The Collection</span>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl" style={{ color: P.onSurface || "#E9E1DD", fontFamily: "'Playfair Display', serif" }}>
              42,000 pieces.<br />
              <span style={{ color: P.brass }}>One search.</span>
            </h2>
          </Reveal>
        </div>
        <CarouselShowcase />
      </section>

      {/* ═══════════════════════════════════════════
          CTA — Forest green background section
          ═══════════════════════════════════════════ */}
      <section className="relative py-28 md:py-40 z-10" style={{ background: `linear-gradient(135deg, ${P.green}, #1E2E1F)` }}>
        {/* Subtle texture overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: `radial-gradient(circle at 30% 50%, rgba(${P.brassRgb},0.06) 0%, transparent 50%), radial-gradient(circle at 70% 50%, rgba(255,255,255,0.03) 0%, transparent 40%)`,
        }} />
        <div className="page-wrap-wide text-center relative z-10">
          <Reveal>
            <div className="h-px max-w-md mx-auto mb-16" style={{ background: `linear-gradient(90deg, transparent, rgba(${P.brassRgb},0.30), transparent)` }} />
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-4xl sm:text-5xl md:text-7xl mb-6" style={{ color: "#fff", fontFamily: "'Playfair Display', serif" }}>
              Start sourcing{" "}<br className="hidden sm:block" />
              <span style={{ color: P.brassLight }}>smarter</span>
            </h2>
            <p className="text-base md:text-lg max-w-md mx-auto mb-10" style={{ color: "rgba(255,255,255,0.65)", fontFamily: "'DM Sans', sans-serif" }}>
              Join the designers already using Spekd to find the perfect piece, faster.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <form onSubmit={handleSearch} className="mx-auto max-w-xl relative mb-10">
              <div
                className="relative flex items-center gap-2 sm:gap-3 rounded-full group"
                style={{
                  height: "58px",
                  padding: "0 12px 0 22px",
                  background: "rgba(255,255,255,0.08)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                  border: `1px solid rgba(${P.brassRgb},0.20)`,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}
              >
                <Search className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Describe what you're looking for..."
                  className="flex-1 min-w-0 bg-transparent text-sm sm:text-base focus:outline-none placeholder:text-white/30"
                  style={{ color: "#fff", fontFamily: "'DM Sans', sans-serif" }}
                />
                <motion.button
                  type="submit"
                  className="cursor-pointer flex items-center gap-1.5 shrink-0"
                  style={{
                    height: "42px",
                    padding: "0 24px",
                    borderRadius: "999px",
                    background: `linear-gradient(135deg, ${P.brass}, ${P.brassLight})`,
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: "13px",
                    fontFamily: "'DM Sans', sans-serif",
                    boxShadow: `0 4px 16px rgba(${P.brassRgb},0.30)`,
                  }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span>Search</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </form>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          FOOTER — Clean, minimal, warm
          ═══════════════════════════════════════════ */}
      <footer className="relative py-16 sm:py-20 z-10" style={{ background: "#161311" }}>
        <div className="page-wrap-wide">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="SPEKD" className="h-8 w-8 object-contain rounded-lg" />
              <span className="text-sm font-semibold tracking-[0.05em]" style={{ color: P.textPrimary, fontFamily: "'DM Sans', sans-serif" }}>SPEKD</span>
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: "About", path: "About" },
                { label: "Privacy", path: "Privacy" },
                { label: "Terms", path: "Terms" },
              ].map((link) => (
                <Link
                  key={link.label}
                  to={createPageUrl(link.path)}
                  className="text-xs transition-colors duration-200 cursor-pointer"
                  style={{ color: P.textMuted, fontFamily: "'DM Sans', sans-serif" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = P.green; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = P.textMuted; }}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="text-[11px]" style={{ color: P.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
              &copy; {new Date().getFullYear()} SPEKD. All rights reserved.
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
