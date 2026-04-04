/**
 * SearchDemoHero — Live AI search demo as hero section
 * Shows the actual product working: type a query → results appear
 * Loops through 3 real designer queries with real product results
 */

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");
const px = url => `${SEARCH_URL}/proxy-image?url=${encodeURIComponent(url)}`;

// ── Real product data ──────────────────────────────────────────────────────────
const ALL_PRODUCTS = [
  { name: "Revelin Sofa",          vendor: "Hooker Furniture", style: "Transitional",  img: px("https://hookerfurnishings.com/media/catalog/product/2/0/203_95_922000_82_silo.jpg") },
  { name: "Chase Leather Sofa",    vendor: "Lexington",        style: "Contemporary",  img: px("https://www.lexington.com/feedcache/productFull/7725_33_02.jpg") },
  { name: "Brandon Sofa",          vendor: "CR Laine",         style: "Classic",       img: px("https://www.crlaine.com/assets/images/products/xlarge/L1190-00.jpg") },
  { name: "Flossie Sofa",          vendor: "Hancock & Moore",  style: "Heritage",      img: px("https://hancockandmoore.com/Documents/prod-images/CJ6815-3_Flossie_TibDoe_MD_1022_HR.jpg") },
  { name: "Candace Leather Sofa",  vendor: "Bernhardt",        style: "Modern",        img: px("https://s3.amazonaws.com/emuncloud-staticassets/productImages/bh074/medium/7277LFO.jpg") },
  { name: "Woodlands Roll Arm Sofa", vendor: "Stickley",       style: "Craftsman",     img: px("https://cdn.shopify.com/s/files/1/0571/7088/6842/products/CL-8187-86-PR_SelvanoBark-DarkMaple_WoodlandsSmallRollArmSofa_Angle.jpg?v=1708087381") },
];

// ── Demo queries that loop ──────────────────────────────────────────────────────
const DEMO_SETS = [
  {
    query:   "curved transitional sofa, leather, neutral tones",
    count:   "Found 38 matches",
    results: [ALL_PRODUCTS[0], ALL_PRODUCTS[1], ALL_PRODUCTS[4]],
  },
  {
    query:   "upholstered accent sofa, fabric, classic silhouette",
    count:   "Found 54 matches",
    results: [ALL_PRODUCTS[2], ALL_PRODUCTS[3], ALL_PRODUCTS[5]],
  },
  {
    query:   "roll arm sofa, heritage style, high-back",
    count:   "Found 27 matches",
    results: [ALL_PRODUCTS[5], ALL_PRODUCTS[3], ALL_PRODUCTS[0]],
  },
];

const TYPE_SPEED      = 38;   // ms per char
const PAUSE_TYPED     = 500;  // pause after typing completes
const SEARCH_DURATION = 900;  // "searching" state
const RESULTS_HOLD    = 3800; // how long results stay
const CLEAR_DURATION  = 400;  // ms to fade before next query

// ── Typewriter hook ──────────────────────────────────────────────────────────
function useSearchDemo() {
  const [setIdx,    setSetIdx]    = useState(0);
  const [typed,     setTyped]     = useState("");
  const [phase,     setPhase]     = useState("typing"); // typing | searching | results | clearing
  const [resultSet, setResultSet] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const current = DEMO_SETS[setIdx];
    let charIdx = 0;

    const clear = () => { if (timer.current) clearTimeout(timer.current); };

    const typeNext = () => {
      if (charIdx <= current.query.length) {
        setTyped(current.query.slice(0, charIdx));
        charIdx++;
        timer.current = setTimeout(typeNext, TYPE_SPEED + (Math.random() * 18 - 9));
      } else {
        // Done typing → searching
        timer.current = setTimeout(() => {
          setPhase("searching");
          timer.current = setTimeout(() => {
            setResultSet(current);
            setPhase("results");
            timer.current = setTimeout(() => {
              setPhase("clearing");
              timer.current = setTimeout(() => {
                setTyped("");
                setResultSet(null);
                setSetIdx(i => (i + 1) % DEMO_SETS.length);
                setPhase("typing");
              }, CLEAR_DURATION);
            }, RESULTS_HOLD);
          }, SEARCH_DURATION);
        }, PAUSE_TYPED);
      }
    };

    typeNext();
    return clear;
  }, [setIdx]);

  return { typed, phase, resultSet };
}

// ── Product result card ───────────────────────────────────────────────────────
function ResultCard({ product, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "2px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s, transform 0.2s",
        cursor: "pointer",
      }}
      whileHover={{ borderColor: "rgba(196,150,60,0.45)", y: -3 }}
    >
      {/* Product image */}
      <div style={{
        aspectRatio: "4/3",
        background: "#1A1714",
        overflow: "hidden",
        position: "relative",
      }}>
        <img
          src={product.img}
          alt={product.name}
          crossOrigin="anonymous"
          style={{
            width: "100%", height: "100%",
            objectFit: "contain",
            padding: "12px",
            boxSizing: "border-box",
          }}
        />
        {/* Trade badge */}
        <div style={{
          position: "absolute", top: "10px", right: "10px",
          background: "rgba(196,150,60,0.15)",
          border: "1px solid rgba(196,150,60,0.35)",
          borderRadius: "2px",
          padding: "3px 8px",
          fontFamily: "'Space Mono', monospace",
          fontSize: "8px",
          letterSpacing: "0.25em",
          color: "rgba(196,150,60,0.9)",
          textTransform: "uppercase",
        }}>
          Trade Price
        </div>
      </div>

      {/* Product info */}
      <div style={{ padding: "14px 16px 16px", flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.3em",
          color: "rgba(196,150,60,0.75)",
          textTransform: "uppercase",
        }}>
          {product.vendor}
        </span>
        <span style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(13px, 1.1vw, 15px)",
          fontWeight: 400,
          color: "#F0E8DC",
          lineHeight: 1.3,
        }}>
          {product.name}
        </span>
        <span style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "11px",
          color: "rgba(240,232,220,0.35)",
          marginTop: "auto",
          paddingTop: "8px",
        }}>
          {product.style}
        </span>
      </div>
    </motion.div>
  );
}

// ── Search bar ────────────────────────────────────────────────────────────────
function SearchBar({ typed, phase, resultSet }) {
  const isActive = phase === "typing" || phase === "searching" || phase === "results";

  return (
    <div style={{
      position: "relative",
      width: "100%",
      maxWidth: "780px",
      margin: "0 auto",
    }}>
      {/* Glow behind bar */}
      <div style={{
        position: "absolute",
        inset: "-1px",
        background: isActive
          ? "linear-gradient(135deg, rgba(196,150,60,0.3), rgba(196,150,60,0.1), rgba(196,150,60,0.25))"
          : "transparent",
        borderRadius: "3px",
        filter: "blur(8px)",
        transition: "opacity 0.6s",
        opacity: isActive ? 1 : 0,
        zIndex: 0,
      }}/>

      <div style={{
        position: "relative",
        zIndex: 1,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${isActive ? "rgba(196,150,60,0.5)" : "rgba(255,255,255,0.12)"}`,
        borderRadius: "2px",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        height: "clamp(54px, 5.5vw, 68px)",
        transition: "border-color 0.4s",
        backdropFilter: "blur(12px)",
      }}>
        {/* AI icon */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
          {phase === "searching" ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              style={{ width: 18, height: 18 }}
            >
              <svg viewBox="0 0 18 18" fill="none" width="18" height="18">
                <circle cx="9" cy="9" r="7" stroke="rgba(196,150,60,0.4)" strokeWidth="1.5"/>
                <path d="M9 2 A7 7 0 0 1 16 9" stroke="rgba(196,150,60,0.9)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </motion.div>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="7.5" cy="7.5" r="5.5" stroke="rgba(196,150,60,0.6)" strokeWidth="1.25"/>
              <path d="M11.5 11.5L15.5 15.5" stroke="rgba(196,150,60,0.6)" strokeWidth="1.25" strokeLinecap="round"/>
              <path d="M5 7.5h5M7.5 5v5" stroke="rgba(196,150,60,0.4)" strokeWidth="1" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        {/* Typed text + cursor */}
        <div style={{
          flex: 1,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "clamp(14px, 1.3vw, 17px)",
          color: typed ? "#F0E8DC" : "rgba(240,232,220,0.3)",
          letterSpacing: "0.01em",
          display: "flex",
          alignItems: "center",
          gap: "1px",
          minWidth: 0,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}>
          <span>{typed || "Describe what you need…"}</span>
          {phase === "typing" && (
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
              style={{
                display: "inline-block",
                width: "2px",
                height: "1.1em",
                background: "rgba(196,150,60,0.8)",
                marginLeft: "1px",
                borderRadius: "1px",
                flexShrink: 0,
              }}
            />
          )}
        </div>

        {/* Result count badge */}
        <AnimatePresence>
          {phase === "results" && resultSet && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              style={{
                flexShrink: 0,
                fontFamily: "'Space Mono', monospace",
                fontSize: "9px",
                letterSpacing: "0.25em",
                color: "rgba(196,150,60,0.8)",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              {resultSet.count}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search button */}
        <div style={{
          flexShrink: 0,
          background: "rgba(196,150,60,0.12)",
          border: "1px solid rgba(196,150,60,0.3)",
          borderRadius: "2px",
          padding: "8px 18px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "11px",
          letterSpacing: "0.2em",
          color: "rgba(196,150,60,0.8)",
          textTransform: "uppercase",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}>
          Search
        </div>
      </div>

      {/* "AI is searching" label */}
      <AnimatePresence>
        {phase === "searching" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "absolute",
              bottom: "-28px",
              left: "20px",
              fontFamily: "'Space Mono', monospace",
              fontSize: "9px",
              letterSpacing: "0.3em",
              color: "rgba(196,150,60,0.55)",
              textTransform: "uppercase",
            }}
          >
            Searching 42,000+ products…
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatsRow() {
  const stats = [
    { value: "42,000+", label: "Trade Products" },
    { value: "20+",     label: "Premium Vendors" },
    { value: "AI",      label: "Powered Search" },
    { value: "100%",    label: "Verified Pricing" },
  ];

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "clamp(16px, 3vw, 40px)",
      flexWrap: "wrap",
    }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "clamp(16px, 3vw, 40px)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(18px, 1.8vw, 24px)",
              fontWeight: 400,
              color: "#C4963C",
              lineHeight: 1,
              marginBottom: "4px",
            }}>{s.value}</div>
            <div style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "clamp(7px, 0.7vw, 9px)",
              letterSpacing: "0.3em",
              color: "rgba(240,232,220,0.35)",
              textTransform: "uppercase",
            }}>{s.label}</div>
          </div>
          {i < stats.length - 1 && (
            <div style={{
              width: "1px", height: "28px",
              background: "rgba(255,255,255,0.08)",
            }}/>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function SearchDemoHero({ onSearch }) {
  const { typed, phase, resultSet } = useSearchDemo();

  return (
    <section style={{
      position: "relative",
      minHeight: "100svh",
      background: "#0E0C0A",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "clamp(80px, 10vh, 120px) clamp(20px, 5vw, 80px) clamp(60px, 8vh, 100px)",
      overflow: "hidden",
      gap: "clamp(24px, 3.5vh, 40px)",
    }}>
      {/* Subtle ambient glow */}
      <div style={{
        position: "absolute",
        top: "20%", left: "50%",
        transform: "translateX(-50%)",
        width: "60vw", height: "50vh",
        background: "radial-gradient(ellipse, rgba(196,150,60,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 0,
      }}/>

      {/* Noise grain */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "200px 200px",
        mixBlendMode: "overlay",
        opacity: 0.6,
      }}/>

      {/* ── Kicker ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        style={{
          display: "flex", alignItems: "center", gap: "14px",
          zIndex: 1,
        }}
      >
        <div style={{ width: "28px", height: "1px", background: "rgba(196,150,60,0.4)" }}/>
        <span style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: "clamp(8px, 0.8vw, 10px)",
          letterSpacing: "0.4em",
          color: "rgba(196,150,60,0.65)",
          textTransform: "uppercase",
        }}>For Interior Designers & Trade Professionals</span>
        <div style={{ width: "28px", height: "1px", background: "rgba(196,150,60,0.4)" }}/>
      </motion.div>

      {/* ── Headline ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{
          textAlign: "center", zIndex: 1,
          maxWidth: "820px",
        }}
      >
        <h1 style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: "clamp(2.4rem, 5.5vw, 5rem)",
          fontWeight: 300,
          letterSpacing: "-0.03em",
          lineHeight: 1.08,
          color: "#F0E8DC",
          margin: 0,
        }}>
          The trade catalogue,<br/>
          <em style={{ fontStyle: "italic", color: "#D4B88A" }}>finally searchable.</em>
        </h1>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "clamp(13px, 1.2vw, 16px)",
          color: "rgba(240,232,220,0.45)",
          marginTop: "clamp(12px, 1.5vh, 18px)",
          lineHeight: 1.7,
          maxWidth: "560px",
          margin: "clamp(12px,1.5vh,18px) auto 0",
        }}>
          Describe any piece in plain language. Our AI searches 42,000+ trade products from 20+ premium vendors and returns exactly what you need — instantly.
        </p>
      </motion.div>

      {/* ── Animated search bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.5 }}
        style={{ width: "100%", maxWidth: "780px", zIndex: 1 }}
      >
        <SearchBar typed={typed} phase={phase} resultSet={resultSet} />
      </motion.div>

      {/* ── Live results ── */}
      <div style={{
        width: "100%", maxWidth: "780px",
        minHeight: "clamp(180px, 22vh, 260px)",
        zIndex: 1,
        marginTop: phase === "searching" ? "16px" : "0",
      }}>
        <AnimatePresence mode="wait">
          {phase === "results" && resultSet && (
            <motion.div
              key={resultSet.query}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.3 } }}
              style={{
                display: "flex",
                gap: "clamp(10px, 1.5vw, 16px)",
                alignItems: "stretch",
              }}
            >
              {resultSet.results.map((p, i) => (
                <ResultCard key={p.name} product={p} delay={i * 0.1} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Stats ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.9 }}
        style={{ zIndex: 1, width: "100%", maxWidth: "780px" }}
      >
        {/* Divider */}
        <div style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
          marginBottom: "clamp(20px, 3vh, 30px)",
        }}/>
        <StatsRow />
      </motion.div>

      {/* ── CTA ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 1.1 }}
        style={{ display: "flex", gap: "16px", alignItems: "center", zIndex: 1 }}
      >
        <a
          href="/Search"
          style={{
            display: "inline-flex", alignItems: "center", gap: "14px",
            padding: "14px 36px",
            background: "#C4963C",
            color: "#0E0C0A",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "10px", letterSpacing: "0.38em",
            textTransform: "uppercase",
            textDecoration: "none",
            fontWeight: 600,
            transition: "background 0.25s, transform 0.2s",
            borderRadius: "1px",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#D4B88A"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#C4963C"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          Start Sourcing
          <svg width="16" height="6" viewBox="0 0 16 6" fill="none">
            <line x1="0" y1="3" x2="11" y2="3" stroke="currentColor" strokeWidth="0.9"/>
            <path d="M9 1L12 3L9 5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
        <button
          onClick={onSearch}
          style={{
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(240,232,220,0.5)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "10px", letterSpacing: "0.3em",
            textTransform: "uppercase",
            padding: "14px 28px",
            cursor: "pointer",
            transition: "border-color 0.2s, color 0.2s",
            borderRadius: "1px",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; e.currentTarget.style.color = "rgba(240,232,220,0.8)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(240,232,220,0.5)"; }}
        >
          See How It Works
        </button>
      </motion.div>

      {/* Scroll indicator */}
      <div style={{
        position: "absolute", bottom: "clamp(18px, 3vh, 30px)", left: "50%",
        transform: "translateX(-50%)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
        zIndex: 1, pointerEvents: "none",
      }}>
        <div style={{
          width: "1px", height: "32px",
          background: "linear-gradient(to bottom, rgba(196,150,60,0.4), transparent)",
          animation: "heroPulse 2s ease-in-out infinite",
        }}/>
      </div>

      <style>{`@keyframes heroPulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
    </section>
  );
}
