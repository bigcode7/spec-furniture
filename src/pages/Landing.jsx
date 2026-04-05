import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Layers, Sparkles, Heart, ArrowUpRight, ChevronRight, Play } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

// ── Fade-up variant ──────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1], delay } }),
};

// ── Navbar ───────────────────────────────────────────────────────────────────
function Navbar({ onCta }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <div style={{ position: "fixed", top: "0.75rem", left: "50%", transform: "translateX(-50%)", width: "calc(100% - 1.5rem)", maxWidth: "56rem", zIndex: 50 }}>
      <motion.div
        initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="landing-lg"
        style={{
          borderRadius: 9999, paddingLeft: 18, paddingRight: 18, height: 52,
          display: "flex", alignItems: "center",
          boxShadow: scrolled ? "0 8px 32px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.12)" : "inset 0 1px 1px rgba(255,255,255,0.10)",
          transition: "box-shadow 400ms ease",
        }}
      >
        <div style={{ flex: 1 }}>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", color: "white", fontSize: "1.2rem", letterSpacing: "-0.01em" }}>SPEKD</span>
        </div>
        {/* Desktop nav */}
        <div className="hidden md:flex" style={{ gap: 24, flexShrink: 0 }}>
          {["Search", "Vendors", "Pricing", "About"].map((l) => (
            <a key={l} href="#" style={{ fontFamily: "'Barlow', sans-serif", fontSize: "0.875rem", fontWeight: 400, color: "rgba(255,255,255,0.75)", textDecoration: "none", transition: "color 200ms" }}
              onMouseEnter={e => (e.currentTarget.style.color = "white")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.75)")}
            >{l}</a>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
          <button onClick={onCta} style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "white", color: "black", borderRadius: 9999,
            paddingLeft: 16, paddingRight: 16, paddingTop: 7, paddingBottom: 7,
            fontFamily: "'Barlow', sans-serif", fontSize: "0.8rem", fontWeight: 500,
            border: "none", cursor: "pointer", transition: "opacity 200ms", whiteSpace: "nowrap",
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <span className="hidden md:inline">Start Free Trial</span>
            <span className="md:hidden">Get Started</span>
            <ArrowUpRight size={13} />
          </button>
          {/* Mobile hamburger — hidden on md+ (desktop) */}
          <button className="md:hidden" onClick={() => setMenuOpen(o => !o)} style={{ width: 36, height: 36, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
            <span style={{ display: "block", width: 18, height: 1.5, background: "white", transition: "transform 250ms, opacity 250ms", transform: menuOpen ? "rotate(45deg) translate(0, 6.5px)" : "none" }} />
            <span style={{ display: "block", width: 18, height: 1.5, background: "white", opacity: menuOpen ? 0 : 1, transition: "opacity 200ms" }} />
            <span style={{ display: "block", width: 18, height: 1.5, background: "white", transition: "transform 250ms", transform: menuOpen ? "rotate(-45deg) translate(0, -6.5px)" : "none" }} />
          </button>
        </div>
      </motion.div>
      {/* Mobile dropdown menu */}
      {menuOpen && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          className="landing-lg md:hidden"
          style={{ marginTop: 8, borderRadius: 20, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 0 }}
        >
          {["Search", "Vendors", "Pricing", "About"].map((l) => (
            <a key={l} href="#" onClick={() => setMenuOpen(false)} style={{ fontFamily: "'Barlow', sans-serif", fontSize: "1rem", fontWeight: 400, color: "rgba(255,255,255,0.80)", textDecoration: "none", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {l}
            </a>
          ))}
        </motion.div>
      )}
    </div>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ onCta }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 0.6], [0, 45]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  return (
    <section ref={ref} style={{ position: "relative", height: "100vh", minHeight: 600, overflow: "hidden", backgroundImage: "url(/hero-poster.png)", backgroundSize: "cover", backgroundPosition: "center" }}>
      <video autoPlay loop muted playsInline preload="auto" poster="/hero-poster.png"
        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", zIndex: 0 }}>
        <source src="/hero.mp4" type="video/mp4" />
      </video>
      <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "rgba(0,0,0,0.05)" }} />
      <motion.div style={{ y, opacity, position: "relative", zIndex: 10, paddingTop: "clamp(80px, 15vw, 110px)", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", paddingLeft: 16, paddingRight: 16 }}>
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0.1} style={{ marginBottom: 32 }}>
          <div className="landing-lg" style={{ borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 8, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8 }}>
            <span style={{ background: "white", color: "black", fontSize: "0.75rem", fontWeight: 600, padding: "1px 7px", borderRadius: 9999 }}>NEW</span>
            <span style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 400, fontSize: "0.82rem", color: "rgba(255,255,255,0.75)" }}>
              Founding pricing — $49/month for the first 200 designers.
            </span>
          </div>
        </motion.div>
        <motion.h1 variants={fadeUp} initial="hidden" animate="visible" custom={0.25}
          style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "clamp(30px, 8vw, 100px)", fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 0.92, color: "white", margin: "0 0 24px", maxWidth: 960 }}>
          Source the way<br />you design.
        </motion.h1>
        <motion.p variants={fadeUp} initial="hidden" animate="visible" custom={0.8}
          style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "1rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.75, maxWidth: 520, marginTop: 0, marginBottom: 36 }}>
          42,000+ trade products across Hickory Chair, Baker, Bernhardt, Theodore Alexander and more. Search in plain English. Find it instantly.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1.1} style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={onCta} className="landing-lg-strong" style={{
            borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 6,
            paddingLeft: 28, paddingRight: 28, paddingTop: 12, paddingBottom: 12,
            fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", fontWeight: 500, color: "white",
            border: "none", cursor: "pointer", transition: "opacity 200ms",
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Start Free Trial <ArrowUpRight size={15} />
          </button>
          <a href="#how-it-works" style={{
            borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 6,
            paddingLeft: 20, paddingRight: 20, paddingTop: 12, paddingBottom: 12,
            fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", fontWeight: 300, color: "rgba(255,255,255,0.60)",
            textDecoration: "none", cursor: "pointer", transition: "color 200ms",
          }}
            onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.90)")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.60)")}
          >
            Watch Demo <Play size={13} />
          </a>
        </motion.div>
      </motion.div>
      <div style={{ position: "absolute", zIndex: 5, top: "calc(56.25vw - 280px)", left: 0, right: 0, height: 280, background: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 45%, rgba(0,0,0,0.9) 80%, black 100%)" }} />
    </section>
  );
}

// ── Intro Section ─────────────────────────────────────────────────────────────
function IntroSection() {
  const vendors = ["Hickory Chair", "Baker Furniture", "Bernhardt", "Theodore Alexander", "Hooker", "CR Laine"];
  return (
    <section style={{ background: "black", paddingTop: "clamp(48px,10vw,144px)", paddingBottom: "clamp(48px,10vw,144px)", paddingLeft: 16, paddingRight: 16, textAlign: "center", overflow: "hidden", position: "relative" }}>
      <img src="/showroom.png" alt="" style={{
        position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", zIndex: 0, pointerEvents: "none",
        maskImage: "radial-gradient(ellipse 90% 85% at 50% 50%, black 30%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 90% 85% at 50% 50%, black 30%, transparent 80%)",
      }} />
      <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />
      <div style={{ position: "relative", zIndex: 3, maxWidth: 768, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0}>
          <span className="landing-badge">Built for trade designers</span>
        </motion.div>
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0.1}
          style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "clamp(28px, 6.5vw, 80px)", fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 0.95, color: "white", margin: "0 0 20px" }}>
          Stop tabbing between<br />vendor sites.
        </motion.h2>
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0.2}
          style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "1.05rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.75, maxWidth: 560, margin: "0 0 48px" }}>
          Describe exactly what you need — "transitional leather sofa with nailhead trim" — and SPEKD searches 42,000+ trade products instantly.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0.3}
          style={{ display: "flex", gap: "clamp(12px, 2.5vw, 48px)", flexWrap: "nowrap", justifyContent: "center" }}>
          {vendors.map((v) => (
            <span key={v} style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "0.875rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.42)" }}>{v}</span>
          ))}
        </motion.div>
      </div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 3, height: 300, background: "linear-gradient(to bottom, transparent, black)", pointerEvents: "none" }} />
    </section>
  );
}

// ── How It Works — animated demo ─────────────────────────────────────────────
const DEMO_QUERIES = [
  {
    query: "recliners that don't look like recliners",
    results: [
      { vendor: "Hooker Furniture", name: "Drake Recliner", tags: ["Leather", "Power"], image: "https://hookerfurnishings.com/media/catalog/product/R/C/RC140_085_silo.jpg" },
      { vendor: "Hooker Furniture", name: "Caleigh Recliner", tags: ["Leather", "Contemporary"], image: "https://hookerfurnishings.com/media/catalog/product/R/C/RC143_094_silo.jpg" },
      { vendor: "Hooker Furniture", name: "Shasta Recliner", tags: ["Leather", "Transitional"], image: "https://hookerfurnishings.com/media/catalog/product/R/C/RC127_085_silo.jpg" },
    ],
  },
  {
    query: "skirted sofa with tight back transitional",
    results: [
      { vendor: "Hickory Chair", name: "Crowley Skirted Sofa", tags: ["Skirted", "Transitional"], image: "https://www.hickorychair.com/prod-images/3425-90_fv_hc298-10_f21_medium.jpg" },
      { vendor: "Hickory Chair", name: "Questa Skirted Sofa", tags: ["Skirted", "Fabric"], image: "https://www.hickorychair.com/prod-images/hc7225_08s_hc320-10_f22_medium.jpg" },
      { vendor: "Hooker Furniture", name: "Emme Skirted Sofa", tags: ["Skirted", "Tight Back"], image: "https://hookerfurnishings.com/media/catalog/product/S/K/SK31_002_silo.jpg" },
    ],
  },
  {
    query: "3 over 3 cushion sofa low profile",
    results: [
      { vendor: "Hooker Furniture", name: "Austin 3 over 3 Sofa", tags: ["3/3 Cushion", "Low Profile"], image: "https://hookerfurnishings.com/media/catalog/product/7/0/7001_002_silo.jpg" },
      { vendor: "Hooker Furniture", name: "Danae 3 over 3 Sofa", tags: ["3/3 Cushion", "Fabric"], image: "https://hookerfurnishings.com/media/catalog/product/L/L/LL21_002_silo.jpg" },
      { vendor: "Hickory Chair", name: "Wilmington Sofa 3/3", tags: ["3/3 Cushion", "Low Profile"], image: "https://www.hickorychair.com/prod-images/HC6416-85_517284_medium.jpg" },
    ],
  },
];

function HowItWorksSection() {
  const [qIdx, setQIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState("typing");
  const [cardsVisible, setCardsVisible] = useState(false);
  const timers = useRef([]);
  const intervalRef = useRef(null);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };
  const addT = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };

  useEffect(() => {
    clear();
    const query = DEMO_QUERIES[qIdx].query;
    let i = 0;
    setTyped(""); setCardsVisible(false); setPhase("typing");
    intervalRef.current = setInterval(() => {
      i++;
      setTyped(query.slice(0, i));
      if (i >= query.length) {
        clearInterval(intervalRef.current); intervalRef.current = null;
        addT(() => {
          setCardsVisible(true); setPhase("showing");
          addT(() => {
            setPhase("fading"); setCardsVisible(false);
            addT(() => {
              setPhase("clearing");
              let j = query.length;
              intervalRef.current = setInterval(() => {
                j--; setTyped(query.slice(0, j));
                if (j <= 0) {
                  clearInterval(intervalRef.current); intervalRef.current = null;
                  addT(() => setQIdx((x) => (x + 1) % DEMO_QUERIES.length), 200);
                }
              }, 18);
            }, 500);
          }, 2400);
        }, 300);
      }
    }, 48);
    return clear;
  }, [qIdx]);

  const current = DEMO_QUERIES[qIdx];
  return (
    <section id="how-it-works" style={{ background: "black", padding: "clamp(56px,10vw,140px) 16px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0}>
          <span className="landing-badge">How It Works</span>
        </motion.div>
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0.1}
          style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "clamp(26px, 5.5vw, 70px)", fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 0.95, color: "white", margin: "0 0 16px", textAlign: "center" }}>
          Describe it.<br />We find it.
        </motion.h2>
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0.2}
          style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "1rem", color: "rgba(255,255,255,0.55)", lineHeight: 1.75, maxWidth: 420, textAlign: "center", margin: "0 0 56px" }}>
          Type what you need the way you'd say it to a colleague — SPEKD does the rest.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} custom={0.3} style={{ width: "100%", maxWidth: 720, overflowX: "hidden" }}>
          {/* Search bar */}
          <div className="landing-lg" style={{ borderRadius: 9999, padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, marginBottom: 28, border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 0 40px rgba(255,255,255,0.03), 0 2px 0 rgba(255,255,255,0.08) inset" }}>
            <Search size={16} color="rgba(255,255,255,0.35)" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
              <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "clamp(14px, 3.5vw, 19px)", color: "white", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden" }}>
                {typed}
              </span>
              {(phase === "typing" || phase === "clearing") && (
                <span style={{ display: "inline-block", width: 1.5, height: 18, background: "rgba(255,255,255,0.75)", marginLeft: 2, animation: "landing-blink 0.75s step-end infinite", flexShrink: 0 }} />
              )}
            </div>
            <div style={{ flexShrink: 0, background: phase === "showing" ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 9999, padding: "5px 16px", fontFamily: "'Barlow', sans-serif", fontSize: "0.78rem", fontWeight: 500, color: "rgba(255,255,255,0.70)", letterSpacing: "0.06em", transition: "background 400ms" }}>
              Search
            </div>
          </div>
          {/* Results grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(240px, 1fr))", gap: 10, overflowX: "auto", paddingBottom: 4, opacity: cardsVisible ? 1 : 0, transform: cardsVisible ? "translateY(0)" : "translateY(10px)", transition: "opacity 500ms cubic-bezier(0.22,1,0.36,1), transform 500ms cubic-bezier(0.22,1,0.36,1)" }}>
            {current.results.map((r, i) => (
              <div key={`${qIdx}-${i}`} style={{ borderRadius: 16, background: "linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.02))", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 1px 0 rgba(255,255,255,0.07) inset, 0 12px 40px rgba(0,0,0,0.4)", overflow: "hidden", opacity: cardsVisible ? 1 : 0, transform: cardsVisible ? "translateY(0)" : "translateY(8px)", transition: `opacity 450ms ease ${i * 80}ms, transform 450ms ease ${i * 80}ms` }}>
                <div style={{ height: 150, background: "#ffffff", position: "relative", overflow: "hidden" }}>
                  <img src={r.image} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", display: "block", padding: "8px" }} />
                  <div style={{ position: "absolute", top: 0, left: 12, right: 12, height: 1, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.12), transparent)" }} />
                </div>
                <div style={{ padding: "12px 14px 14px" }}>
                  <div style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 500, fontSize: "0.60rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 5 }}>{r.vendor}</div>
                  <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "0.92rem", color: "white", lineHeight: 1.2, marginBottom: 8 }}>{r.name}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {r.tags.map((tag, j) => (
                      <span key={j} style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "0.65rem", color: "rgba(255,255,255,0.38)", padding: "1px 8px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.03)" }}>{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Dots */}
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 28 }}>
            {DEMO_QUERIES.map((_, i) => (
              <div key={i} style={{ width: i === qIdx ? 16 : 4, height: 4, borderRadius: 9999, background: i === qIdx ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.18)", transition: "width 300ms ease, background 300ms ease" }} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Sofa Reveal Section ───────────────────────────────────────────────────────
const SOFA_QUERY = "tufted leather sofa with nailhead trim";
function SofaRevealSection() {
  const sectionRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [typed, setTyped] = useState("");
  const [resultVisible, setResultVisible] = useState(false);
  const hasPlayed = useRef(false);
  const timers = useRef([]);
  const runAnimation = useCallback(() => {
    if (hasPlayed.current) return;
    hasPlayed.current = true;
    const addT = (fn, ms) => { const t = setTimeout(fn, ms); timers.current.push(t); };
    addT(() => {
      let i = 0;
      const interval = setInterval(() => {
        i++; setTyped(SOFA_QUERY.slice(0, i));
        if (i >= SOFA_QUERY.length) { clearInterval(interval); addT(() => setResultVisible(true), 500); }
      }, 40);
    }, 2000);
  }, []);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInView(true); runAnimation(); } }, { threshold: 0.25 });
    observer.observe(el);
    return () => { observer.disconnect(); timers.current.forEach(clearTimeout); };
  }, [runAnimation]);
  const typingDone = typed.length >= SOFA_QUERY.length;
  return (
    <section ref={sectionRef} style={{ position: "relative", width: "100%", height: "100vh", minHeight: 600, background: "black", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <video autoPlay loop muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}>
        <source src="/sofa-reveal.mov" type="video/mp4" />
        <source src="/sofa-reveal.mov" type="video/quicktime" />
      </video>
      <div style={{ position: "absolute", inset: 0, zIndex: 1, background: "rgba(0,0,0,0.52)" }} />
      <div style={{ position: "relative", zIndex: 3, textAlign: "center", padding: "0 16px", maxWidth: "100%" }}>
        <div style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 400, fontSize: "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginBottom: 20, opacity: inView ? 1 : 0, transition: "opacity 800ms ease 1.8s" }}>
          Searching SPEKD
        </div>
        <div style={{ marginBottom: resultVisible ? 28 : 0, transition: "margin-bottom 500ms ease" }}>
          <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "clamp(18px, 5vw, 52px)", fontWeight: 400, color: "white", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {typed}
          </span>
          {!typingDone && typed.length > 0 && (
            <span style={{ display: "inline-block", width: 2, height: "clamp(26px, 4vw, 52px)", background: "white", marginLeft: 3, verticalAlign: "middle", animation: "landing-blink 0.8s step-end infinite" }} />
          )}
        </div>
        <div style={{ opacity: resultVisible ? 1 : 0, transform: resultVisible ? "translateY(0)" : "translateY(8px)", transition: "opacity 700ms ease, transform 700ms ease", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 500, fontSize: "0.70rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.40)" }}>
            Hooker Furniture
          </div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "clamp(16px, 2vw, 22px)", fontWeight: 400, color: "rgba(255,255,255,0.70)", letterSpacing: "-0.01em" }}>
            Savion Power Recliner Sofa
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Features Section ──────────────────────────────────────────────────────────
const FEATURES = [
  { Icon: Search, num: "01", title: "Natural Language Search", desc: "Describe what you need in plain English. SPEKD understands designer language that generic search never could." },
  { Icon: Layers, num: "02", title: "42,000+ Trade Products", desc: "Hickory Chair, Baker, Bernhardt, Theodore Alexander and 16 more trade-only vendors. All in one place." },
  { Icon: Sparkles, num: "03", title: "AI Intelligence Tags", desc: "Every product tagged with silhouette, formality, mood, material, and 25 more fields. Find Similar. Find Alternatives. Instantly." },
  { Icon: Heart, num: "04", title: "Built by the Industry", desc: "Created by a furniture industry insider who saw the sourcing problem every day. SPEKD speaks designer." },
];

function FeaturesSection() {
  return (
    <section style={{ background: "black", paddingTop: "clamp(48px,10vw,144px)", paddingBottom: "clamp(48px,10vw,144px)", paddingLeft: 16, paddingRight: 16 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0}>
            <span className="landing-badge">What SPEKD Does</span>
          </motion.div>
          <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0.1}
            style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "clamp(26px, 5.5vw, 72px)", fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 0.95, color: "white", margin: 0 }}>
            Built for the way<br />designers actually think.
          </motion.h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5" style={{ maxWidth: 768, margin: "0 auto" }}>
          {FEATURES.map(({ Icon, num, title, desc }, i) => (
            <motion.div key={i} variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} custom={i * 0.1}
              whileHover={{ y: -6 }}
              style={{ borderRadius: 20, padding: "20px 20px", position: "relative", overflow: "hidden", background: "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 1px 0 rgba(255,255,255,0.08) inset, 0 20px 60px rgba(0,0,0,0.5)", cursor: "default" }}>
              <div style={{ position: "absolute", top: 0, left: 24, right: 24, height: 1, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)" }} />
              <div style={{ position: "absolute", top: 24, right: 28, fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "0.75rem", color: "rgba(255,255,255,0.20)", letterSpacing: "0.05em" }}>{num}</div>
              <div style={{ width: 44, height: 44, borderRadius: 16, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03))", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.75)" }}>
                <Icon size={18} />
              </div>
              <div style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 500, fontSize: "0.95rem", color: "white", marginBottom: 10, letterSpacing: "-0.01em" }}>{title}</div>
              <div style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "0.85rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA Section ───────────────────────────────────────────────────────────────
function CtaSection({ onCta }) {
  return (
    <section style={{ background: "black", paddingTop: "clamp(48px,10vw,160px)", paddingBottom: "clamp(48px,10vw,160px)", paddingLeft: 16, paddingRight: 16 }}>
      <div style={{ maxWidth: 768, margin: "0 auto", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0}>
          <span className="landing-badge">Founding Access</span>
        </motion.div>
        <motion.h2 variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0.1}
          style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "clamp(28px, 6.5vw, 80px)", fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 0.95, color: "white", margin: "0 0 20px" }}>
          The sourcing tool<br />designers have waited for.
        </motion.h2>
        <motion.p variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0.2}
          style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "1.05rem", color: "rgba(255,255,255,0.70)", lineHeight: 1.75, maxWidth: 448, margin: "0 0 40px" }}>
          Join the first 200 designers at $49/month — locked in for life at half the standard price. Cancel anytime.
        </motion.p>
        <motion.div variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} custom={0.3} style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={onCta} className="landing-lg-strong" style={{ borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 6, paddingLeft: 32, paddingRight: 32, paddingTop: 14, paddingBottom: 14, fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", fontWeight: 500, color: "white", border: "none", cursor: "pointer", transition: "opacity 200ms" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.82")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            Start Free Trial — $49/mo <ArrowUpRight size={15} />
          </button>
          <button onClick={onCta} className="landing-lg" style={{ borderRadius: 9999, display: "inline-flex", alignItems: "center", gap: 6, paddingLeft: 32, paddingRight: 32, paddingTop: 14, paddingBottom: 14, fontFamily: "'Barlow', sans-serif", fontSize: "0.9rem", fontWeight: 300, color: "rgba(255,255,255,0.80)", border: "none", cursor: "pointer", transition: "opacity 200ms" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.75")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            See All Vendors <ChevronRight size={15} />
          </button>
        </motion.div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: "black", paddingLeft: 24, paddingRight: 24, paddingBottom: 40 }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ height: 1, width: "100%", marginBottom: 32, background: "rgba(255,255,255,0.12)" }} />
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "0.75rem", color: "rgba(255,255,255,0.38)" }}>
            © {new Date().getFullYear()} SPEKD. Trade sourcing, reimagined.
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {[{ label: "Privacy", path: "Privacy" }, { label: "Terms", path: "Terms" }, { label: "About", path: "About" }].map((l) => (
              <Link key={l.label} to={createPageUrl(l.path)} style={{ fontFamily: "'Barlow', sans-serif", fontWeight: 300, fontSize: "0.75rem", color: "rgba(255,255,255,0.38)", textDecoration: "none", transition: "color 200ms" }}
                onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.70)")}
                onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.38)")}
              >{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Main Landing ──────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();
  const goToSearch = useCallback(() => {
    try { sessionStorage.setItem("spekd_search_entry", JSON.stringify({ from: "landing", ts: Date.now() })); } catch {}
    navigate(createPageUrl("Search"));
  }, [navigate]);

  return (
    <div style={{ background: "black", minHeight: "100vh" }}>
      <Navbar onCta={goToSearch} />
      <main>
        <Hero onCta={goToSearch} />
        <IntroSection />
        <HowItWorksSection />
        <SofaRevealSection />
        <FeaturesSection />
        <CtaSection onCta={goToSearch} />
      </main>
      <Footer />
    </div>
  );
}
