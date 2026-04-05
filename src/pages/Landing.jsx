import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Search, ArrowRight,
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
  textPrimary:  "#2A2622",
  textSecondary:"#7A746B",
  textMuted:    "#9B9590",
  obsidian:     "#161311",
  surface:      "#1E1B19",
  surfaceHigh:  "#2D2927",
  surfaceHigher:"#383432",
  onSurface:    "#2A2622",
  onSurfaceDim: "#7A746B",
};

const EXAMPLE_SEARCHES = [
  "curved bouclé sofa",
  "mid-century teak credenza",
  "marble coffee table",
  "statement accent chair",
  "woven rattan pendant",
];

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
        background: "rgba(255,255,255,0.75)",
        backdropFilter: "blur(20px) saturate(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.1)",
        border: "1px solid rgba(44,62,45,0.08)",
        boxShadow: "0 4px 24px rgba(44,62,45,0.06), 0 1px 3px rgba(0,0,0,0.04)",
      }}
      whileHover={hover ? {
        y: -3,
        boxShadow: "0 12px 40px rgba(44,62,45,0.12), 0 4px 12px rgba(0,0,0,0.06)",
        borderColor: `rgba(${P.brassRgb}, 0.20)`,
      } : {}}
      transition={{ duration: 0.3, ease: EASE }}
    >
      {children}
    </motion.div>
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

  useEffect(() => {
    fetch(`${SEARCH_URL}/catalog/stats`).then((r) => r.json()).then((data) => setCatalogStats(data.catalog || data)).catch(() => {});
    fetch(`${SEARCH_URL}/vendors`).then((r) => r.json()).then((data) => {
      const v = (data.vendors || []).sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
      setVendors(v);
    }).catch(() => {});
    sessionStorage.removeItem("spekd_demo_products");
    sessionStorage.removeItem("spekd_demo_v2");
  }, []);

  const totalProducts = Math.max(catalogStats?.total_products || 0, 42000);
  const totalVendors = Math.max(vendors.length || 0, 20);

  return (
    <div className="relative min-h-screen" style={{ background: P.cream }}>

      {/* ═══════════════════════════════════════════
          HERO — Above the fold
          ═══════════════════════════════════════════ */}
      <section className="relative z-10 pt-28 pb-16 sm:pt-36 sm:pb-20 text-center px-6">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-8 text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ background: `rgba(${P.brassRgb},0.10)`, border: `1px solid rgba(${P.brassRgb},0.20)`, color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>
            Trade sourcing, reimagined
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.0] tracking-tight mb-6 mx-auto"
            style={{ color: P.textPrimary, fontFamily: "'Playfair Display', serif", maxWidth: "900px" }}>
            The trade catalogue,<br />
            <span style={{ color: P.brass }}>finally searchable.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="text-base sm:text-lg leading-relaxed mb-10 mx-auto"
            style={{ color: P.textSecondary, fontFamily: "'DM Sans', sans-serif", maxWidth: "520px" }}>
            42,000+ pieces from 20+ trade vendors. Search in plain English — Spekd finds exactly what you're envisioning.
          </p>
        </Reveal>
        <Reveal delay={0.22}>
          <form onSubmit={handleSearch} className="mx-auto max-w-lg relative">
            <div
              className="relative flex items-center gap-2 sm:gap-3 rounded-full"
              style={{
                height: "56px",
                padding: "0 10px 0 20px",
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `1px solid rgba(${P.greenRgb},0.12)`,
                boxShadow: "0 4px 24px rgba(44,62,45,0.10)",
              }}
            >
              <Search className="h-4 w-4 shrink-0" style={{ color: P.textMuted }} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="modular leather sectional..."
                className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
                style={{ color: P.textPrimary, fontFamily: "'DM Sans', sans-serif" }}
              />
              <motion.button
                type="submit"
                className="cursor-pointer flex items-center gap-1.5 shrink-0"
                style={{
                  height: "40px",
                  padding: "0 20px",
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
      </section>

      {/* ═══════════════════════════════════════════
          SCROLL EXPERIENCE — The Digital Showroom
          ═══════════════════════════════════════════ */}
      <ScrollExperience />

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
            {[
              {
                num: "01", icon: Search, title: "Describe", delay: 0,
                accent: `linear-gradient(to bottom, ${P.green}, ${P.greenMuted})`,
                body: "Type the way you'd brief a colleague. Style, material, mood, room — Spekd understands designer language.",
                tags: [],
              },
              {
                num: "02", icon: FileText, title: "Curate", delay: 0.12,
                accent: `linear-gradient(to bottom, ${P.brass}, ${P.brassLight})`,
                body: "Save your finds, organize by room, and apply trade pricing. Everything in one place.",
                tags: [],
              },
              {
                num: "03", icon: Send, title: "Present", delay: 0.24,
                accent: `linear-gradient(to bottom, ${P.greenMuted}, ${P.sage})`,
                body: "Generate polished PDFs and shareable client links in seconds — no manual formatting, no extra tools.",
                tags: ["PDF Export", "Client Portal", "Trade Pricing"],
              },
            ].map(({ num, icon: Icon, title, delay, accent, body, tags }) => (
              <Reveal key={num} delay={delay}>
                <GlassCard className="p-7 sm:p-8 cursor-default h-full flex flex-col">
                  <div className="absolute left-0 top-6 bottom-6 w-[3px] rounded-full" style={{ background: accent }} />
                  <div className="text-[11px] font-bold tracking-[0.2em] mb-5" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>{num}</div>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 shrink-0" style={{ background: `rgba(${P.brassRgb},0.12)`, border: `1px solid rgba(${P.brassRgb},0.22)` }}>
                    <Icon className="w-5 h-5" style={{ color: P.brassLight }} />
                  </div>
                  <h3 className="text-2xl mb-3" style={{ color: P.textPrimary, fontFamily: "'Playfair Display', serif" }}>{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: P.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>{body}</p>
                  {tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span key={tag} className="rounded-full px-3 py-1 text-[10px] font-medium uppercase tracking-[0.12em]" style={{ background: `rgba(${P.sageRgb},0.20)`, color: P.textSecondary }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          3D PRODUCT CAROUSEL — The Showroom Wall
          ════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 z-10 overflow-hidden">
        <div className="page-wrap-wide">
          <Reveal className="text-center mb-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>The Collection</span>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl" style={{ color: P.textPrimary, fontFamily: "'Playfair Display', serif" }}>
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
      <footer className="relative py-16 sm:py-20 z-10" style={{ background: P.creamDark }}>
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
