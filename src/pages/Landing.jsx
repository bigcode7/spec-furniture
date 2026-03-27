import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, ArrowRight, ChevronDown, Sparkles, Brain, FolderOpen, Shield, FileText, Send } from "lucide-react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import ParticleField from "@/components/ParticleField";
import AnimatedGradientBackground from "@/components/ui/animated-gradient-background";
import { useAuth } from "@/lib/AuthContext";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");
const EASE = [0.22, 1, 0.36, 1];

const EXAMPLE_SEARCHES = [
  "modern swivel chair under $2k",
  "blue velvet sectional",
  "walnut mid-century credenza",
  "boucle accent chair",
  "marble dining table contemporary",
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
function Reveal({ children, className = "", delay = 0, y = 30 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
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
  const inputPhrase = "comfortable boucle swivel chair, modern, under $2k";
  const decoded = [
    { label: "Category", value: "Accent Chair", color: "text-gold" },
    { label: "Material", value: "Bouclé", color: "text-emerald-400" },
    { label: "Feature", value: "Swivel Base", color: "text-purple-400" },
    { label: "Style", value: "Modern / Contemporary", color: "text-gold" },
    { label: "Budget", value: "Under $2,000", color: "text-emerald-400" },
    { label: "Intent", value: "Comfort-first seating", color: "text-purple-400" },
  ];

  return (
    <div className="mock-ui">
      <div className="mock-titlebar">
        <div className="mock-dot" /><div className="mock-dot" /><div className="mock-dot" />
        <div className="ml-auto text-[9px] text-white/15 font-mono">spekd.design/understand</div>
      </div>
      <div className="p-6">
        {/* Input */}
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="spec-diamond" />
          <span className="text-sm text-white/50 italic">"{inputPhrase}"</span>
        </div>

        {/* Decoded arrow */}
        <div className="flex items-center gap-2 mb-5 px-1">
          <div className="h-px flex-1 bg-gradient-to-r from-gold/20 to-transparent" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/40">AI understands</span>
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
            <span className="text-gold/60 font-semibold">→</span> Expands to 14 search variants across 20 vendors, weighted by material match and style relevance
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
        <div className="ml-auto text-[9px] text-white/15 font-mono">spekd.design/vendors</div>
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

// ── Mock AI Chat UI — REAL PRODUCT ──
function MockAIChatUI({ chatData }) {
  const p = chatData?.product;
  return (
    <div className="mock-ui">
      <div className="mock-titlebar">
        <div className="mock-dot" /><div className="mock-dot" /><div className="mock-dot" />
        <div className="ml-auto text-[9px] text-white/15 font-mono">spekd.design/chat</div>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex justify-end">
          <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-br-md bg-gold/10 border border-gold/20 text-xs text-white/60">
            {chatData?.query || "Find me a boucle accent chair, modern style, under $1,500"}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
            <div className="spec-diamond" style={{ width: 4, height: 4 }} />
          </div>
          <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 leading-relaxed">
            {p ? (
              <>
                I found {chatData.total} results matching your criteria across {chatData.vendorCount} vendors.
                The top pick is the <span className="text-gold/70">{p.product_name}</span> by {p.vendor_name}
                {p.retail_price ? ` at $${p.retail_price.toLocaleString()}` : ""}
                {p.style ? ` — ${p.style} style` : ""}.
              </>
            ) : (
              "Searching across all vendors..."
            )}
          </div>
        </div>
        <div className="flex gap-2 overflow-hidden">
          {(chatData?.topImages || []).slice(0, 3).map((url, i) => (
            <div key={i} className="w-16 h-16 rounded-xl bg-white/[0.03] border border-white/[0.04] shrink-0 overflow-hidden">
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ))}
          {(!chatData?.topImages || chatData.topImages.length === 0) && [1, 2, 3].map((i) => (
            <div key={i} className="w-16 h-16 rounded-xl bg-white/[0.03] border border-white/[0.04] shrink-0" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Mock Project UI ──
function MockProjectUI() {
  const items = [
    { name: "Living Room Sofa", status: "Sourced", color: "text-emerald-400 bg-emerald-500/10" },
    { name: "Dining Table", status: "In Review", color: "text-amber-400 bg-amber-500/10" },
    { name: "Accent Chair ×2", status: "Searching", color: "text-blue-400 bg-blue-500/10" },
  ];
  return (
    <div className="mock-ui">
      <div className="mock-titlebar">
        <div className="mock-dot" /><div className="mock-dot" /><div className="mock-dot" />
        <div className="ml-auto text-[9px] text-white/15 font-mono">spekd.design/projects</div>
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

// ── Feature section ──
function FeatureSection({ kicker, title, description, mockUI, reverse = false, icon: Icon }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <div ref={ref} className="py-24 md:py-32">
      <div className="page-wrap">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
          <motion.div
            className={reverse ? "lg:order-2" : ""}
            initial={{ opacity: 0, x: reverse ? 30 : -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: EASE }}
          >
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
          </motion.div>
          <motion.div
            className={reverse ? "lg:order-1" : ""}
            initial={{ opacity: 0, x: reverse ? -30 : 30, scale: 0.96 }}
            animate={inView ? { opacity: 1, x: 0, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.15, ease: EASE }}
          >
            {mockUI}
          </motion.div>
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
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  // ── Live data state ──
  const [catalogStats, setCatalogStats] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [vendorNames, setVendorNames] = useState([]);
  const [chatMockup, setChatMockup] = useState(null);

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

    // 3. Chat mockup — search for accent chairs to find a real product (cached in sessionStorage)
    const cachedChat = sessionStorage.getItem("spekd_chat_mockup");
    if (cachedChat) {
      try { setChatMockup(JSON.parse(cachedChat)); } catch {}
    } else {
      searchProducts("boucle accent chair", 10, 3).then((data) => {
        const products = (data.products || []).filter((p) => p.image_url);
        const vendorSet = new Set(products.map((p) => p.vendor_name));
        if (products.length > 0) {
          const mockup = {
            query: "Find me a boucle accent chair, modern style, under $1,500",
            total: data.total || data.total_available || products.length,
            vendorCount: vendorSet.size,
            product: products[0],
            topImages: products.slice(0, 3).map((p) => p.image_url),
          };
          setChatMockup(mockup);
          sessionStorage.setItem("spekd_chat_mockup", JSON.stringify(mockup));
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
          className="fixed top-5 right-6 z-50 text-sm text-white/40 hover:text-white/70 transition-colors"
        >
          Sign In
        </button>
      )}
      <AnimatedGradientBackground
        Breathing
        gradientColors={["#080c18", "#0f1e3d", "#1a2f5e", "#8b6914", "#b8860b"]}
        gradientStops={[0, 30, 55, 80, 100]}
      />
      <ParticleField className="z-0 fixed" />

      {/* ═══════════ HERO ═══════════ */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-screen flex items-center justify-center"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] pointer-events-none z-0"
          style={{ background: "radial-gradient(ellipse, rgba(79,107,255,0.07) 0%, transparent 65%)", filter: "blur(80px)" }}
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
                AI-Native Furniture Intelligence
              </span>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.5, delay: 0.4, ease: EASE }}
                className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-gold/30"
                style={{ transformOrigin: "left" }}
              />
            </motion.div>

            {/* Brand name */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
              className="mb-6"
            >
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
              The future of
              <br />
              <span style={{ background: "linear-gradient(135deg, #4F6BFF, #5BB8B0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 40px rgba(79,107,255,0.3))" }}>
                furniture
              </span>{" "}
              sourcing
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
              <br className="hidden md:block" />
              AI-powered sourcing that thinks the way you do.
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
                style={{ background: "radial-gradient(ellipse, rgba(79,107,255,0.08) 0%, transparent 70%)", filter: "blur(40px)" }}
              />
              <div className="search-bar-glow relative flex h-14 sm:h-16 md:h-[68px] items-center rounded-full bg-white/[0.04] backdrop-blur-xl px-4 sm:px-6 group">
                <div className="relative mr-3 sm:mr-4 hidden sm:block">
                  <div className="spec-diamond" />
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
              className="mt-6 flex flex-wrap justify-center gap-x-3 sm:gap-x-4 gap-y-2 px-4 sm:px-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.4, ease: EASE }}
            >
              {EXAMPLE_SEARCHES.map((s, i) => (
                <span key={s} className="flex items-center gap-2">
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
      <section className="relative py-14 border-y border-white/[0.04]" style={{ background: "rgba(10,10,14,0.5)" }}>
        <Reveal className="text-center mb-8">
          <span className="label-caps text-gold/50 tracking-[0.25em]">Trusted by the Trade</span>
        </Reveal>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-40 z-10 bg-gradient-to-r from-[#08090E] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-40 z-10 bg-gradient-to-l from-[#08090E] to-transparent" />
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
              Three steps to <span className="text-gold">smarter sourcing</span>
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: "01",
                icon: Search,
                title: "Search",
                desc: "Describe what you need in plain language. Our AI searches across every vendor catalog simultaneously — materials, styles, budgets, and dimensions.",
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
        kicker="Design Intelligence"
        title={<>It understands what<br /><span className="text-gold">you actually mean</span></>}
        description="Type the way you'd talk to a colleague. Spekd's AI decodes your intent — material, style, budget, function — then expands it into dozens of search variants across every vendor simultaneously."
        mockUI={<IntentDecoder />}
        icon={Brain}
      />

      <div className="page-wrap">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      <FeatureSection
        kicker="Vendor Intelligence"
        title={<>Every vendor,<br /><span className="text-gold">verified at source</span></>}
        description={`${totalVendors || "20+"} trade-only manufacturer catalogs, continuously crawled and indexed. Every product links directly to the vendor page — real images, real pricing, real availability.`}
        mockUI={<MockVendorUI vendors={vendors} />}
        icon={Shield}
        reverse
      />

      <div className="page-wrap">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      <FeatureSection
        kicker="Conversational Search"
        title={<>Source with<br /><span className="text-gold">AI that understands</span></>}
        description="Go beyond keywords. Spekd's AI understands materials, styles, dimensions, and design intent. Ask follow-up questions, refine results, and get curated recommendations in real time."
        mockUI={<MockAIChatUI chatData={chatMockup} />}
        icon={Brain}
      />

      {/* ═══════════ STATS — LIVE FROM CATALOG ═══════════ */}
      <section className="relative py-28 md:py-36">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(79,107,255,0.04) 0%, transparent 60%)", filter: "blur(80px)" }}
        />
        <div className="page-wrap">
          <Reveal className="text-center mb-6">
            <span className="label-caps text-gold/50 tracking-[0.25em]">By the Numbers</span>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-5xl text-white">
              Scale that <span className="text-gold">matters</span>
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
                    style={{ textShadow: "0 0 40px rgba(79,107,255,0.2)" }}
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
              "AI that understands design language. Say 'warm transitional accent chair' and get exactly what you mean.",
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
          style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(79,107,255,0.06) 0%, transparent 55%)", filter: "blur(100px)" }}
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
                style={{ background: "radial-gradient(ellipse, rgba(79,107,255,0.06) 0%, transparent 70%)", filter: "blur(30px)" }}
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
                <Sparkles className="h-4 w-4" /> Explore AI Search
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
                <span className="spec-diamond mr-1" />
                <span className="font-brand text-lg tracking-[0.2em] text-white/80 font-medium">SPEKD</span>
              </div>
              <p className="text-xs text-white/25 leading-relaxed max-w-[200px]">
                AI-native furniture intelligence for the trade.
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
                <Link to={createPageUrl("Search")} className="block text-sm text-white/40 hover:text-white/70 transition-colors">AI Search</Link>
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
