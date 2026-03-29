import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, ArrowRight, ChevronDown, Sparkles, Brain, FolderOpen, Shield, FileText, Send } from "lucide-react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
// Subtle texture background — replaces particle field
import { useAuth } from "@/lib/AuthContext";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");
const EASE = [0.22, 1, 0.36, 1];

const EXAMPLE_SEARCHES = [
  "leather sofa transitional",
  "coastal accent chair",
  "walnut dining table",
  "upholstered sectional",
  "statement accent chair",
];

// ── Helper: fetch search results ──
function searchProducts(query, maxVendors = 20, perVendor = 5) {
  return fetch(`${SEARCH_URL}/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, max_vendors: maxVendors, per_vendor: perVendor }),
  }).then((r) => r.json());
}

// ── Reusable scroll reveal ──
function Reveal({ children, className = "" }) {
  return (
    <div className={className}>
      {children}
    </div>
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

// ── Gradient atmosphere ──
function Atmosphere() {
  return (
    <div className="landing-atmosphere">
      <div className="glow glow-violet" />
      <div className="glow glow-rose" />
      <div className="glow glow-teal" />
    </div>
  );
}

// ── Design Intent Decoder — shows how AI parses natural language ──
function IntentDecoder() {
  const inputPhrase = "modern high back swivel chair";
  const decoded = [
    { label: "Category", value: "Accent Chair", color: "text-gold" },
    { label: "Back Style", value: "High Back", color: "text-emerald-400" },
    { label: "Feature", value: "Swivel Base", color: "text-purple-400" },
    { label: "Style", value: "Modern / Contemporary", color: "text-gold" },
    { label: "Silhouette", value: "Upright, Structured", color: "text-emerald-400" },
    { label: "Intent", value: "Statement seating with support", color: "text-purple-400" },
  ];

  return (
    <div className="mock-ui">
      <div className="mock-titlebar">
        <div className="mock-dot" /><div className="mock-dot" /><div className="mock-dot" />
        <div className="ml-auto text-[9px] text-white/15 font-mono">spekd.ai</div>
      </div>
      <div className="p-6">
        {/* Input */}
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <img src="/logo.png" alt="" className="h-5 w-5 object-contain" />
          <span className="text-sm text-white/50 italic">"{inputPhrase}"</span>
        </div>

        {/* Decoded arrow */}
        <div className="flex items-center gap-2 mb-5 px-1">
          <div className="h-px flex-1 bg-gradient-to-r from-gold/20 to-transparent" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/40">Spekd understands</span>
          <div className="h-px flex-1 bg-gradient-to-l from-gold/20 to-transparent" />
        </div>

        {/* Structured output */}
        <div className="grid grid-cols-2 gap-2.5">
          {decoded.map((attr) => (
            <div
              key={attr.label}
              className="rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2.5"
            >
              <div className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/20 mb-1">
                {attr.label}
              </div>
              <div className={`text-[13px] font-medium ${attr.color}`}>
                {attr.value}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom insight */}
        <div className="mt-4 px-3 py-2.5 rounded-lg bg-gold/[0.04] border border-gold/[0.08]">
          <div className="text-[10px] text-white/30 leading-relaxed">
            <span className="text-gold/60 font-semibold">→</span> Matches back style, base type, and silhouette as hard filters across 20 vendors — returns only chairs that are high back + swivel + modern
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mock Vendor UI — REAL DATA ──
function MockVendorUI({ vendors }) {
  const topVendors = vendors.slice(0, 3);
  return (
    <div className="mock-ui">
      <div className="mock-titlebar">
        <div className="mock-dot" /><div className="mock-dot" /><div className="mock-dot" />
        <div className="ml-auto text-[9px] text-white/15 font-mono">spekd.ai/vendors</div>
      </div>
      <div className="p-5 space-y-3">
        {topVendors.map((v) => (
          <div key={v.name} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04]">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold font-display text-sm">
              {v.name[0]}
            </div>
            <div className="flex-1">
              <div className="text-sm text-white/70 font-medium">{v.name}</div>
              <div className="text-[10px] text-white/30">
                {(v.product_count || v.active_skus || 0).toLocaleString()} products
                {v.lead_time_min_weeks ? ` · ${v.lead_time_min_weeks}–${v.lead_time_max_weeks} wks` : ""}
              </div>
            </div>
            <ArrowRight className="w-3 h-3 text-white/15" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mock Search UI — REAL PRODUCTS from catalog ──
function MockSearchUI({ demoProducts }) {
  const demoQuery = "my client is furnishing a beach house, show me coastal pieces";
  const products = demoProducts || [];

  return (
    <div className="mock-ui">
      <div className="mock-titlebar">
        <div className="mock-dot" /><div className="mock-dot" /><div className="mock-dot" />
        <div className="ml-auto text-[9px] text-white/15 font-mono">spekd.ai</div>
      </div>
      <div className="p-4">
        {/* Search bar */}
        <div className="flex items-center gap-3 rounded-full bg-white/[0.04] border border-white/[0.08] px-4 py-2.5 mb-4">
          <img src="/logo.png" alt="" className="h-4 w-4 object-contain shrink-0" />
          <span className="text-[12px] text-white/50 truncate flex-1">{demoQuery}</span>
          <div className="h-7 px-3 rounded-full bg-gold/20 text-gold text-[10px] font-semibold flex items-center shrink-0">Search</div>
        </div>

        {/* Product cards grid — mirrors real Search.jsx ProductCard */}
        <div className="grid grid-cols-3 gap-2.5">
          {products.length > 0 ? products.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ background: "#2a251f" }}>
              {/* Image */}
              <div className="relative overflow-hidden" style={{ aspectRatio: "4/3", backgroundColor: "#ffffff" }}>
                {item.image_url ? (
                  <img
                    src={`${SEARCH_URL}/images/${encodeURIComponent(item.id)}`}
                    alt={item.product_name}
                    className="h-full w-full"
                    style={{ objectFit: "contain", padding: "8px" }}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/10">
                    <div className="text-xl font-display">{(item.manufacturer_name || "?")[0]}</div>
                  </div>
                )}
              </div>
              {/* Gold hairline */}
              <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
              {/* Meta */}
              <div className="p-2.5">
                <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-gold/70 mb-0.5 truncate">{item.manufacturer_name}</div>
                <div className="text-[11px] text-white/90 line-clamp-2 mb-1 leading-tight">{item.product_name}</div>
                {item.retail_price && (
                  <div className="text-[11px] font-semibold text-gold/80">${Number(item.retail_price).toLocaleString()}</div>
                )}
              </div>
            </div>
          )) : (
            /* Loading skeleton */
            [0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ background: "#2a251f" }}>
                <div style={{ aspectRatio: "4/3", backgroundColor: "rgba(255,255,255,0.03)" }} />
                <div className="h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
                <div className="p-2.5 space-y-1.5">
                  <div className="h-2 w-12 rounded bg-white/[0.06]" />
                  <div className="h-3 w-full rounded bg-white/[0.04]" />
                  <div className="h-3 w-8 rounded bg-white/[0.06]" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mock Project UI ──
function MockProjectUI() {
  const items = [
    { name: "Living Room Sofa", status: "Sourced", color: "text-[#8b9e6e] bg-[#8b9e6e]/10" },
    { name: "Dining Table", status: "In Review", color: "text-amber-400 bg-amber-500/10" },
    { name: "Accent Chair ×2", status: "Searching", color: "text-[#c4a882] bg-[#c4a882]/10" },
  ];
  return (
    <div className="mock-ui">
      <div className="mock-titlebar">
        <div className="mock-dot" /><div className="mock-dot" /><div className="mock-dot" />
        <div className="ml-auto text-[9px] text-white/15 font-mono">spekd.ai/projects</div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="w-4 h-4 text-gold/50" />
          <span className="text-sm text-white/60 font-medium">Park Ave Residence</span>
          <span className="text-[9px] text-white/20 ml-auto">$45,000 budget</span>
        </div>
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.name} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.04]">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04]" />
              <div className="flex-1">
                <div className="text-xs text-white/60">{item.name}</div>
              </div>
              <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${item.color}`}>
                {item.status}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 h-2 bg-white/[0.04] rounded-full overflow-hidden">
          <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-gold/60 to-gold" />
        </div>
        <div className="text-[10px] text-white/20 mt-1.5">65% sourced</div>
      </div>
    </div>
  );
}

// ── Feature section — no scroll-triggered opacity, always visible once rendered ──
function FeatureSection({ kicker, title, description, mockUI, reverse = false, icon: Icon }) {
  return (
    <div className="py-24 md:py-32">
      <div className="page-wrap">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <div className={reverse ? "lg:order-2" : ""}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/15 flex items-center justify-center">
                <Icon className="w-5 h-5 text-gold/70" />
              </div>
              <span className="label-caps text-gold/60">{kicker}</span>
            </div>
            <h3 className="font-display text-3xl md:text-4xl lg:text-[42px] text-white leading-[1.1] mb-5">
              {title}
            </h3>
            <p className="text-base leading-7 max-w-lg" style={{ color: "var(--warm-gray)" }}>
              {description}
            </p>
          </div>
          <div className={reverse ? "lg:order-1" : ""}>
            {mockUI}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// LANDING PAGE
// ════════════════════════════════════════════════════════

export default function Landing() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { user, navigateToLogin } = useAuth();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0.97]);

  // ── Live data state ──
  const [catalogStats, setCatalogStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorNames, setVendorNames] = useState([]);
  const [demoProducts, setDemoProducts] = useState(null);

  // ── Fetch all real data on mount ──
  useEffect(() => {
    // 1. Catalog stats
    fetch(`${SEARCH_URL}/catalog/stats`)
      .then((r) => r.json())
      .then((data) => setCatalogStats(data.catalog || data))
      .catch(() => {});

    // 2. Vendor list with real product counts
    fetch(`${SEARCH_URL}/vendors`)
      .then((r) => r.json())
      .then((data) => {
        const v = (data.vendors || []).sort((a, b) => (b.product_count || 0) - (a.product_count || 0));
        setVendors(v);
        setVendorNames(v.map((x) => x.name));
      })
      .catch(() => {});

    // 3. Demo search — real coastal products for landing page demo widget
    const cachedDemo = sessionStorage.getItem("spekd_demo_products");
    if (cachedDemo) {
      try { setDemoProducts(JSON.parse(cachedDemo)); } catch {}
    } else {
      searchProducts("my client is furnishing a beach house, show me coastal pieces", 20, 3).then((data) => {
        const products = (data.products || []).filter((p) => p.image_url);
        const top3 = products.slice(0, 3);
        if (top3.length > 0) {
          setDemoProducts(top3);
          sessionStorage.setItem("spekd_demo_products", JSON.stringify(top3));
        }
      }).catch(() => {});
    }
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`${createPageUrl("Search")}?q=${encodeURIComponent(query.trim())}`);
    } else {
      navigate(createPageUrl("Search"));
    }
  };

  // Live stats from catalog
  const totalProducts = catalogStats?.total_products || 0;
  const totalVendors = vendors.length || 0;
  const marqueeNames = vendorNames.length > 0 ? vendorNames : [
    "Bernhardt", "Hooker Furniture", "Century Furniture", "Vanguard",
    "Caracole", "Baker Furniture", "Theodore Alexander", "Stickley",
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {!user && (
        <button
          onClick={() => navigateToLogin("login")}
          className="fixed top-5 right-6 z-50 text-sm font-medium px-5 py-2 rounded-full transition-all hover:bg-[#c4a882]/10"
          style={{ color: "#c4a882", border: "1px solid rgba(196,168,130,0.4)" }}
        >
          Sign In
        </button>
      )}
      <Atmosphere />

      {/* ═══════════ HERO ═══════════ */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex items-center justify-center"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] pointer-events-none z-0"
          style={{ background: "radial-gradient(ellipse, rgba(200,169,126,0.05) 0%, transparent 65%)", filter: "blur(80px)" }}
        />

        <div className="relative z-10 page-wrap w-full py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            {/* Kicker */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
              className="flex items-center justify-center gap-4 mb-10"
            >
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
                className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-gold/30"
                style={{ transformOrigin: "right" }}
              />
              <span className="font-brand text-[11px] font-semibold uppercase tracking-[0.22em] text-gold gold-glow-text">
                Trade Furniture Sourcing
              </span>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
                className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-gold/30"
                style={{ transformOrigin: "left" }}
              />
            </motion.div>

            {/* Logo mark + brand name */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
              className="mb-8 flex flex-col items-center gap-4"
            >
              <div className="relative">
                <div className="absolute -inset-6 rounded-full pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(196,168,130,0.12) 0%, transparent 70%)", filter: "blur(20px)" }} />
                <img src="/logo.png" alt="SPEKD" className="relative h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 object-contain rounded-[20%]" style={{ boxShadow: "0 0 40px rgba(196,168,130,0.15), 0 8px 32px rgba(0,0,0,0.4)" }} />
              </div>
              <span className="font-brand text-2xl sm:text-3xl md:text-5xl tracking-[0.3em] text-gold gold-glow-text font-semibold">
                SPEKD
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="font-display text-[28px] sm:text-5xl md:text-7xl lg:text-[80px] leading-[1.05] text-white"
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: 0.8, delay: 0.6, ease: EASE }}
            >
              Source
              <br />
              <span className="text-gold">
                smarter
              </span>{" "}
              instantly
            </motion.h1>

            {/* Subtitle — live numbers */}
            <motion.p
              className="mt-6 sm:mt-8 mx-auto max-w-2xl text-[15px] sm:text-lg md:text-xl leading-relaxed"
              style={{ color: "var(--warm-gray)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0, ease: EASE }}
            >
              {totalProducts > 0
                ? `Search ${totalProducts.toLocaleString()}+ products across ${totalVendors} trade vendors.`
                : "Search thousands of products across trade vendors."
              }
              <br />
              Sourcing that understands the way you design.
            </motion.p>

            {/* Search Bar */}
            <motion.form
              onSubmit={handleSearch}
              className="mt-14 mx-auto max-w-2xl relative"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.2, ease: EASE }}
            >
              <div className="absolute -inset-10 pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(200,169,126,0.08) 0%, transparent 70%)", filter: "blur(40px)" }}
              />
              <div className="search-bar-glow relative flex h-14 sm:h-16 md:h-[68px] items-center rounded-full bg-white/[0.04] backdrop-blur-xl px-4 sm:px-6 group">
                <div className="relative mr-3 sm:mr-4 hidden sm:block">
                  <img src="/logo.png" alt="" className="h-6 w-6 object-contain" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Describe what you need...'
                  className="flex-1 bg-transparent text-white/80 text-base placeholder:text-white/25 focus:outline-none"
                />
                <button type="submit" className="btn-gold ml-3 sm:ml-4 h-10 sm:h-11 px-5 sm:px-7 rounded-full text-sm shrink-0">
                  Search
                </button>
              </div>
            </motion.form>

            {/* Suggested searches */}
            <motion.div
              className="mt-6 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.4, ease: EASE }}
            >
              <div className="flex items-center justify-start sm:justify-center gap-x-3 sm:gap-x-4 whitespace-nowrap">
                {EXAMPLE_SEARCHES.map((s, i) => (
                  <span key={s} className="flex items-center gap-2 shrink-0">
                    {i > 0 && <span className="text-gold/30 text-xs">·</span>}
                    <Link
                      to={`${createPageUrl("Search")}?q=${encodeURIComponent(s)}`}
                      className="text-sm transition-colors hover:text-gold/70 gold-hover-underline"
                      style={{ color: "var(--warm-gray)" }}
                    >
                      {s}
                    </Link>
                  </span>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8, ease: EASE }}
        >
          <ChevronDown className="w-5 h-5 text-gold/40 animate-chevron-pulse" />
        </motion.div>
      </motion.section>

      {/* ═══════════ BRAND MARQUEE ═══════════ */}
      <section className="relative py-14 border-y border-white/[0.04]" style={{ background: "rgba(16,14,12,0.5)" }}>
        <Reveal className="text-center mb-8">
          <span className="label-caps text-gold/50 tracking-[0.25em]">Trusted by the Trade</span>
        </Reveal>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-40 z-10 bg-gradient-to-r from-[#1c1917] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-40 z-10 bg-gradient-to-l from-[#1c1917] to-transparent" />
          <div className="brand-marquee whitespace-nowrap">
            {[...marqueeNames, ...marqueeNames].map((name, i) => (
              <span key={`${name}-${i}`} className="inline-flex items-center mx-8 text-base font-display text-white/[0.12] tracking-wide">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="relative py-24 md:py-32">
        <div className="page-wrap">
          <Reveal className="text-center mb-6">
            <span className="label-caps text-gold/50 tracking-[0.25em]">How It Works</span>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-5xl text-white">
              Three steps to <span className="text-gold">finding the right piece</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                icon: Search,
                title: "Search",
                desc: "Describe what you need in your own words. Spekd searches across every vendor catalog simultaneously — materials, styles, budgets, and dimensions.",
              },
              {
                step: "02",
                icon: FileText,
                title: "Quote",
                desc: "Save your favorites, build quotes organized by room, apply your designer markup, and generate polished client-ready PDFs in seconds.",
              },
              {
                step: "03",
                icon: Send,
                title: "Present",
                desc: "Share professional proposals with your clients. Every product links back to the vendor for seamless ordering through your trade accounts.",
              },
            ].map((item, i) => (
              <Reveal key={item.step} delay={i * 0.1}>
                <div className="relative text-center p-8 rounded-2xl border border-white/[0.04] hover:border-white/[0.08] transition-colors" style={{ background: "rgba(255,255,255,0.015)" }}>
                  <div className="text-[64px] font-display font-bold text-white/[0.03] absolute top-4 right-6 leading-none">{item.step}</div>
                  <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gold/10 border border-gold/15 flex items-center justify-center">
                    <item.icon className="w-6 h-6 text-gold/70" />
                  </div>
                  <h3 className="font-display text-xl text-white mb-3">{item.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--warm-gray)" }}>{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="page-wrap">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      {/* ═══════════ FEATURE SECTIONS ═══════════ */}
      <FeatureSection
        kicker="Design Language"
        title={<>Search the way<br /><span className="text-gold">you actually think</span></>}
        description="Type the way you'd brief a colleague. Describe the vision — material, style, mood, budget — and Spekd finds every match across your favorite vendors."
        mockUI={<IntentDecoder />}
        icon={Brain}
      />

      <div className="page-wrap">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      <FeatureSection
        kicker="Vendor Network"
        title={<>Every vendor,<br /><span className="text-gold">verified at source</span></>}
        description={`${totalVendors || "20+"} trade-only manufacturer catalogs, curated and kept current. Every product links directly to the vendor — real images, real pricing, verified at source.`}
        mockUI={<MockVendorUI vendors={vendors} />}
        icon={Shield}
        reverse
      />

      <div className="page-wrap">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      <FeatureSection
        kicker="Search Your Way"
        title={<>Describe the vision,<br /><span className="text-gold">we find the pieces</span></>}
        description="Search the way you'd describe a project to a colleague. Spekd understands design intent — materials, styles, and budgets — then surfaces exactly the right pieces from every vendor at once."
        mockUI={<MockSearchUI demoProducts={demoProducts} />}
        icon={Search}
      />

      {/* ═══════════ STATS — LIVE FROM CATALOG ═══════════ */}
      <section className="relative py-28 md:py-36">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(200,169,126,0.04) 0%, transparent 60%)", filter: "blur(80px)" }}
        />
        <div className="page-wrap">
          <Reveal className="text-center mb-6">
            <span className="label-caps text-gold/50 tracking-[0.25em]">By the Numbers</span>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-5xl text-white">
              The catalog at your <span className="text-gold">fingertips</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { value: totalProducts, suffix: "+", label: "Products Indexed", sublabel: "Across all vendor catalogs" },
              { value: totalVendors, suffix: "", label: "Trade Vendors", sublabel: "Manufacturer-direct sources" },
              { value: 100, suffix: "%", label: "Source Verified", sublabel: "Every link goes to the vendor" },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 0.1} className="text-center">
                <div className="stat-glow py-8">
                  <div className="font-display text-5xl md:text-6xl lg:text-7xl text-white mb-3"
                    style={{ textShadow: "0 0 40px rgba(200,169,126,0.2)" }}
                  >
                    <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="label-caps text-gold/70 mb-1">{stat.label}</div>
                  <div className="text-xs text-white/25">{stat.sublabel}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ BUILT FOR THE TRADE ═══════════ */}
      <section className="relative py-24 md:py-32">
        <div className="page-wrap">
          <Reveal className="text-center mb-6">
            <span className="label-caps text-gold/50 tracking-[0.25em]">Why SPEKD</span>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-5xl text-white">
              Built for designers, <span className="text-gold">by designers</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              "Search across 40,000+ products from 20 trade vendors in seconds — no more browsing vendor sites one by one.",
              "Understands design language. Say 'warm transitional accent chair' and get exactly what you mean.",
              "Quote builder with polished PDF export — organize specs and pricing, ready for client review.",
            ].map((text, i) => (
              <Reveal key={i} delay={i * 0.1}>
                <div className="p-6 rounded-2xl border border-white/[0.04] h-full flex flex-col" style={{ background: "rgba(255,255,255,0.015)" }}>
                  <p className="text-sm text-white/50 leading-relaxed flex-1">{text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="page-wrap">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      {/* ═══════════ BOTTOM CTA ═══════════ */}
      <section className="relative py-28 md:py-36">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(200,169,126,0.06) 0%, transparent 55%)", filter: "blur(100px)" }}
        />
        <div className="page-wrap text-center relative z-10">
          <Reveal>
            <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent mb-20 max-w-xl mx-auto" />
          </Reveal>
          <Reveal delay={0.05}>
            <span className="label-caps text-gold/50 tracking-[0.25em]">Get Started</span>
          </Reveal>
          <Reveal delay={0.1} className="mt-5">
            <h2 className="font-display text-3xl sm:text-4xl md:text-6xl lg:text-7xl text-white">
              Start sourcing <span className="text-gold">smarter</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15} className="mt-5">
            <p className="text-base md:text-lg max-w-lg mx-auto" style={{ color: "var(--warm-gray)" }}>
              Join the designers already using Spekd to find the perfect piece, faster than ever.
            </p>
          </Reveal>

          <Reveal delay={0.2} className="mt-12">
            <form onSubmit={handleSearch} className="mx-auto max-w-xl relative">
              <div className="absolute -inset-8 pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(200,169,126,0.06) 0%, transparent 70%)", filter: "blur(30px)" }}
              />
              <div className="search-bar-glow relative flex h-14 items-center rounded-full bg-white/[0.04] backdrop-blur-xl px-5 group">
                <Search className="w-4 h-4 text-white/20 mr-3 shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What are you looking for?"
                  className="flex-1 bg-transparent text-white/80 text-sm placeholder:text-white/25 focus:outline-none"
                />
                <button type="submit" className="btn-gold ml-3 h-9 px-6 rounded-full text-xs shrink-0">
                  Search
                </button>
              </div>
            </form>
          </Reveal>

          <Reveal delay={0.25} className="mt-8">
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link to={createPageUrl("Search")} className="pill-button btn-gold gap-2 text-sm">
                <Sparkles className="h-4 w-4" /> Start Searching
              </Link>
              <Link to={createPageUrl("Quotes")} className="pill-button btn-outline gap-2 text-sm">
                Quote Builder <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="landing-footer">
        <div className="page-wrap py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-14">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="SPEKD" className="h-8 w-8 object-contain" />
                <span className="font-brand text-lg tracking-[0.2em] text-white/80 font-medium">SPEKD</span>
              </div>
              <p className="text-xs text-white/25 leading-relaxed max-w-[200px]">
                Curated trade furniture sourcing for designers.
              </p>
              <div className="flex items-center gap-3 mt-4">
                <a href="https://linkedin.com/company/spekd" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-colors" title="LinkedIn">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href="https://instagram.com/spekd.ai" target="_blank" rel="noopener noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full text-white/20 hover:text-white/50 hover:bg-white/[0.04] transition-colors" title="Instagram">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="label-caps text-white/40 mb-4 text-[10px]">Product</h4>
              <div className="space-y-2.5">
                <Link to={createPageUrl("Search")} className="block text-sm text-white/40 hover:text-white/70 transition-colors">Search</Link>
                <Link to={createPageUrl("Quotes")} className="block text-sm text-white/40 hover:text-white/70 transition-colors">Quote Builder</Link>
              </div>
            </div>
            <div>
              <h4 className="label-caps text-white/40 mb-4 text-[10px]">Company</h4>
              <div className="space-y-2.5">
                <Link to={createPageUrl("About")} className="block text-sm text-white/40 hover:text-white/70 transition-colors">About</Link>
                <a href="mailto:support@spekd.ai" className="block text-sm text-white/40 hover:text-white/70 transition-colors">Contact</a>
              </div>
            </div>
            <div>
              <h4 className="label-caps text-white/40 mb-4 text-[10px]">Legal</h4>
              <div className="space-y-2.5">
                <Link to={createPageUrl("Privacy")} className="block text-sm text-white/40 hover:text-white/70 transition-colors">Privacy Policy</Link>
                <Link to={createPageUrl("Terms")} className="block text-sm text-white/40 hover:text-white/70 transition-colors">Terms of Service</Link>
              </div>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent mb-6" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] text-white/20">
            <span>&copy; {new Date().getFullYear()} SPEKD. All rights reserved.</span>
            <nav className="flex items-center gap-4">
              <Link to={createPageUrl("About")} className="hover:text-white/40 transition-colors">About</Link>
              <span className="text-white/10">·</span>
              <a href="mailto:support@spekd.ai" className="hover:text-white/40 transition-colors">Contact</a>
              <span className="text-white/10">·</span>
              <Link to={createPageUrl("Privacy")} className="hover:text-white/40 transition-colors">Privacy Policy</Link>
              <span className="text-white/10">·</span>
              <Link to={createPageUrl("Terms")} className="hover:text-white/40 transition-colors">Terms of Service</Link>
            </nav>
          </div>
          <p className="text-[10px] text-white/10 text-center mt-4 max-w-xl mx-auto leading-relaxed">
            All product images and content are property of their respective vendors. Spekd.ai is a discovery platform and does not claim ownership of any vendor assets.
          </p>
        </div>
      </footer>
    </div>
  );
}
