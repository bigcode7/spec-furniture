import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, ArrowRight, ChevronDown } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import ParticleField from "@/components/ParticleField";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

const EXAMPLE_SEARCHES = [
  "modern swivel chair under $2k",
  "blue velvet sectional",
  "walnut mid-century credenza",
  "boucle accent chair",
  "marble dining table contemporary",
];

const VENDOR_NAMES = [
  "Bernhardt", "Hooker Furniture", "Century Furniture", "Vanguard",
  "Lexington Home", "Universal Furniture", "Hickory Chair", "Theodore Alexander",
  "Four Hands", "Caracole", "Baker Furniture", "Lee Industries",
  "Stanley Furniture", "Kincaid", "Gabby Home", "Loloi Rugs",
  "Noir Furniture", "Worlds Away", "Global Views", "Arteriors",
];

const FEATURES = [
  {
    title: "Natural Language Search",
    desc: "Describe what you need in plain English. Our AI expands your brief into multi-vendor search variants across 49 manufacturer domains simultaneously.",
  },
  {
    title: "Verified at Source",
    desc: "Every product links to the actual vendor page. Images, pricing, and availability verified directly — not scraped marketplace listings.",
  },
  {
    title: "Intelligent Curation",
    desc: "Results ranked by vendor authority, product relevance, and image quality. The best options surface first, every time.",
  },
];

// ── Animated counter ──
function AnimatedCounter({ target, suffix = "", duration = 2 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration * 60);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 1000 / 60);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ── Scroll-reveal section ──
function RevealSection({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`${createPageUrl("Search")}?q=${encodeURIComponent(query.trim())}`);
    } else {
      navigate(createPageUrl("Search"));
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ═══════════ HERO ═══════════ */}
      <section className="relative min-h-screen flex items-center justify-center">
        <ParticleField className="z-0" />
        <div className="hero-noise absolute inset-0 z-0" />

        <div className="relative z-10 page-wrap w-full py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            {/* Kicker */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center justify-center gap-4 mb-10"
            >
              <div className="h-px flex-1 max-w-[80px] bg-gradient-to-r from-transparent to-gold/30" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold gold-glow-text">
                AI-Native Furniture Intelligence
              </span>
              <div className="h-px flex-1 max-w-[80px] bg-gradient-to-l from-transparent to-gold/30" />
            </motion.div>

            {/* Headline */}
            <motion.h1
              className="font-display text-6xl sm:text-7xl md:text-8xl lg:text-[88px] font-normal leading-[1.05] text-white"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              The future of
              <br />
              <span className="text-gold" style={{ textShadow: "0 0 40px rgba(201,169,110,0.3), 0 0 80px rgba(201,169,110,0.1)" }}>
                furniture
              </span>{" "}
              intelligence
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="mt-8 mx-auto max-w-2xl text-lg md:text-xl leading-relaxed"
              style={{ color: "var(--warm-gray)" }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              Search 127,000 products across 49 trade vendors.
              <br className="hidden md:block" />
              AI-powered sourcing in seconds.
            </motion.p>

            {/* Search Bar */}
            <motion.form
              onSubmit={handleSearch}
              className="mt-12 mx-auto max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="search-bar-glow relative flex h-16 md:h-[68px] items-center rounded-full bg-white/[0.04] backdrop-blur-xl px-6 group">
                <div className="relative mr-4">
                  <div className="spec-diamond" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Describe what you need — "modern sustainable swivel chair under $2k"'
                  className="flex-1 bg-transparent text-white/80 text-sm md:text-base placeholder:text-white/25 focus:outline-none"
                />
                <button
                  type="submit"
                  className="btn-gold ml-4 h-11 px-7 rounded-full text-sm font-bold shrink-0"
                >
                  Search
                </button>
              </div>
            </motion.form>

            {/* Suggested searches */}
            <motion.div
              className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.1 }}
            >
              {EXAMPLE_SEARCHES.map((s, i) => (
                <span key={s} className="flex items-center gap-2">
                  {i > 0 && <span className="text-gold/30 text-xs">·</span>}
                  <Link
                    to={`${createPageUrl("Search")}?q=${encodeURIComponent(s)}`}
                    className="text-sm transition-colors hover:text-gold/70"
                    style={{ color: "var(--warm-gray)" }}
                  >
                    {s}
                  </Link>
                </span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <ChevronDown className="w-5 h-5 text-gold/40 animate-chevron-pulse" />
        </motion.div>
      </section>

      {/* ═══════════ STATS ═══════════ */}
      <RevealSection className="py-24 relative">
        <div className="page-wrap">
          {/* Gold divider */}
          <div className="gold-divider mb-16" />

          <div className="grid grid-cols-3 gap-8 max-w-3xl mx-auto text-center">
            {[
              { value: 127000, label: "PRODUCTS INDEXED" },
              { value: 49, label: "TRADE VENDORS" },
              { value: 8, label: "AI AGENTS" },
            ].map((stat) => (
              <RevealSection key={stat.label}>
                <div className="font-display text-5xl md:text-6xl lg:text-7xl text-white" style={{ textShadow: "0 0 30px rgba(201,169,110,0.15)" }}>
                  <AnimatedCounter target={stat.value} />
                </div>
                <div className="mt-3 label-caps">{stat.label}</div>
              </RevealSection>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ═══════════ VENDOR MARQUEE ═══════════ */}
      <RevealSection className="py-12">
        <div className="page-wrap text-center mb-6">
          <span className="label-caps text-gold/60">Powering the Trade</span>
        </div>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-r from-[#0a0a0f] to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-32 z-10 bg-gradient-to-l from-[#0a0a0f] to-transparent" />
          <div className="flex animate-marquee whitespace-nowrap" style={{ "--marquee-speed": "40s" }}>
            {[...VENDOR_NAMES, ...VENDOR_NAMES].map((name, i) => (
              <span key={`${name}-${i}`} className="mx-6 text-sm font-medium text-white/15 shrink-0">
                {name}
              </span>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ═══════════ FEATURES ═══════════ */}
      <RevealSection className="py-24">
        <div className="page-wrap">
          <div className="text-center mb-16">
            <h2 className="section-heading">
              Built for how you <span className="text-gold">source</span>
            </h2>
            <p className="section-copy mt-5 max-w-xl mx-auto">
              Every feature designed to collapse the distance between a design brief and the perfect product.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 stagger-children">
            {FEATURES.map((feature, i) => (
              <div key={feature.title} className="glass-surface rounded-2xl p-8 group">
                <div className="flex items-center gap-3 mb-5">
                  <div className="spec-diamond" />
                  <span className="label-caps text-gold/70">{`0${i + 1}`}</span>
                </div>
                <h3 className="font-display text-2xl text-white mb-4">{feature.title}</h3>
                <p className="text-sm leading-7" style={{ color: "var(--warm-gray)" }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* ═══════════ FINAL CTA ═══════════ */}
      <RevealSection className="py-28">
        <div className="page-wrap text-center">
          <div className="gold-divider mb-16" />
          <h2 className="font-display text-4xl md:text-6xl text-white mb-6">
            Start sourcing smarter.
          </h2>
          <p className="section-copy max-w-lg mx-auto mb-10">
            Join the designers already using SPEC to find the perfect piece, faster.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              to={createPageUrl("Search")}
              className="pill-button btn-gold gap-2"
            >
              <Search className="h-4 w-4" /> Launch AI Search
            </Link>
            <Link
              to={createPageUrl("Dashboard")}
              className="pill-button border border-gold/15 text-white/60 hover:text-gold hover:border-gold/30 transition-all"
            >
              Explore Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </RevealSection>

      {/* Footer spacer */}
      <div className="h-16" />
    </div>
  );
}
