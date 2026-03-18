import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, ArrowRight, ChevronDown, Sparkles, Brain, FolderOpen, Shield } from "lucide-react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import ParticleField from "@/components/ParticleField";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");
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
        <div className="ml-auto text-[9px] text-white/15 font-mono">spec.ai/understand</div>
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
        <div className="ml-auto text-[9px] text-white/15 font-mono">spec.ai/vendors</div>
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
        <div className="ml-auto text-[9px] text-white/15 font-mono">spec.ai/chat</div>
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
        <div className="ml-auto text-[9px] text-white/15 font-mono">spec.ai/projects</div>
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

    // 3. Chat mockup — search for accent chairs to find a real product
    searchProducts("boucle accent chair", 10, 3).then((data) => {
      const products = (data.products || []).filter((p) => p.image_url);
      const vendorSet = new Set(products.map((p) => p.vendor_name));
      if (products.length > 0) {
        setChatMockup({
          query: "Find me a boucle accent chair, modern style, under $1,500",
          total: data.total || data.total_available || products.length,
          vendorCount: vendorSet.size,
          product: products[0],
          topImages: products.slice(0, 3).map((p) => p.image_url),
        });
      }
    }).catch(() => {});
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
    "Four Hands", "Caracole", "Baker Furniture", "Lee Industries",
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <Atmosphere />
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
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold gold-glow-text">
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

            {/* Headline */}
            <motion.h1
              className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-[92px] leading-[1.02] text-white"
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
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
              className="mt-8 mx-auto max-w-2xl text-lg md:text-xl leading-relaxed"
              style={{ color: "var(--warm-gray)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9, ease: EASE }}
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
              transition={{ duration: 0.5, delay: 1.1, ease: EASE }}
            >
              <div className="absolute -inset-10 pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(79,107,255,0.08) 0%, transparent 70%)", filter: "blur(40px)" }}
              />
              <div className="search-bar-glow relative flex h-16 md:h-[68px] items-center rounded-full bg-white/[0.04] backdrop-blur-xl px-6 group">
                <div className="relative mr-4">
                  <div className="spec-diamond" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Describe what you need — "modern swivel chair under $2k"'
                  className="flex-1 bg-transparent text-white/80 text-sm md:text-base placeholder:text-white/25 focus:outline-none"
                />
                <button type="submit" className="btn-gold ml-4 h-11 px-7 rounded-full text-sm shrink-0">
                  Search
                </button>
              </div>
            </motion.form>

            {/* Suggested searches */}
            <motion.div
              className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.3, ease: EASE }}
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

      {/* ═══════════ FEATURE SECTIONS ═══════════ */}
      <FeatureSection
        kicker="Design Intelligence"
        title={<>It understands what<br /><span className="text-gold">you actually mean</span></>}
        description="Type the way you'd talk to a colleague. SPEC's AI decodes your intent — material, style, budget, function — then expands it into dozens of search variants across every vendor simultaneously."
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
        description="Go beyond keywords. SPEC's AI understands materials, styles, dimensions, and design intent. Ask follow-up questions, refine results, and get curated recommendations in real time."
        mockUI={<MockAIChatUI chatData={chatMockup} />}
        icon={Brain}
      />

      <div className="page-wrap">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
      </div>

      <FeatureSection
        kicker="Project Management"
        title={<>From brief to<br /><span className="text-gold">purchase order</span></>}
        description="Organize sourcing by project and room. Track budgets, compare options side-by-side, and present curated selections to clients — all in one workspace."
        mockUI={<MockProjectUI />}
        icon={FolderOpen}
        reverse
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
            <h2 className="font-display text-4xl md:text-6xl lg:text-7xl text-white">
              Start sourcing <span className="text-gold">smarter</span>
            </h2>
          </Reveal>
          <Reveal delay={0.15} className="mt-5">
            <p className="text-base md:text-lg max-w-lg mx-auto" style={{ color: "var(--warm-gray)" }}>
              Join the designers already using SPEC to find the perfect piece, faster than ever.
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
              <Link to={createPageUrl("Dashboard")} className="pill-button btn-outline gap-2 text-sm">
                View Dashboard <ArrowRight className="h-4 w-4" />
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
                <span className="font-display text-lg tracking-[0.15em] text-white/80">SPEC</span>
              </div>
              <p className="text-xs text-white/25 leading-relaxed max-w-[200px]">
                AI-native furniture intelligence for the trade.
              </p>
            </div>
            <div>
              <h4 className="label-caps text-white/40 mb-4 text-[10px]">Product</h4>
              <div className="space-y-2.5">
                <Link to={createPageUrl("Search")} className="block text-sm">AI Search</Link>
                <Link to={createPageUrl("Projects")} className="block text-sm">Projects</Link>
                <Link to={createPageUrl("Manufacturers")} className="block text-sm">Vendors</Link>
                <Link to={createPageUrl("Intelligence")} className="block text-sm">Intelligence</Link>
              </div>
            </div>
            <div>
              <h4 className="label-caps text-white/40 mb-4 text-[10px]">Company</h4>
              <div className="space-y-2.5">
                <Link to={createPageUrl("Dashboard")} className="block text-sm">Dashboard</Link>
                <Link to={createPageUrl("Compare")} className="block text-sm">Compare</Link>
                <Link to={createPageUrl("Showcase")} className="block text-sm">Showcase</Link>
              </div>
            </div>
            <div>
              <h4 className="label-caps text-white/40 mb-4 text-[10px]">Legal</h4>
              <div className="space-y-2.5">
                <span className="block text-sm text-white/25">Privacy Policy</span>
                <span className="block text-sm text-white/25">Terms of Service</span>
              </div>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-gold/10 to-transparent mb-6" />
          <div className="flex items-center justify-between text-[11px] text-white/20">
            <span>&copy; {new Date().getFullYear()} SPEC. All rights reserved.</span>
            <span className="hidden sm:inline">Built with AI for the furniture trade.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
