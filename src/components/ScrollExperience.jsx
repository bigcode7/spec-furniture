/**
 * ScrollExperience.jsx — "The Digital Showroom" scroll journey
 *
 * 4-phase scroll-driven animation with clean sequential transitions:
 *   Phase 1 (0–20%):  Wireframe room with zoom + parallax, headline
 *   Phase 2 (20–40%): Room fades → search bar materializes, query types itself
 *   Phase 3 (40–65%): Results grid staggers in with AI response
 *   Phase 4 (65–90%): Product detail panel slides in, then CTA
 *
 * All animation driven by scroll position (0–1).
 * GPU-accelerated: only transform + opacity, no layout triggers.
 */
import { useRef, useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ArrowRight, Mic, Camera, Heart, FileText, ExternalLink } from "lucide-react";
import { useScroll, useMotionValueEvent } from "framer-motion";
import { createPageUrl } from "@/utils";
import { useAuth } from "@/lib/AuthContext";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

// ── Palette ──
const P = {
  cream:        "#F5F0E8",
  white:        "#FEFCF9",
  green:        "#2C3E2D",
  greenLight:   "#3D5240",
  greenMuted:   "#5A7A5E",
  sage:         "#C2CCBA",
  brass:        "#B8956A",
  brassLight:   "#D4B88A",
  brassDark:    "#96744D",
  brassRgb:     "184,149,106",
  greenRgb:     "44,62,45",
  sageRgb:      "194,204,186",
  textPrimary:  "#2A2622",
  textSecondary:"#7A746B",
  textMuted:    "#9B9590",
};

function proxyUrl(url) {
  return `${SEARCH_URL}/proxy-image?url=${encodeURIComponent(url)}`;
}

// ── Demo products — verified working images through proxy ──
const SCROLL_PRODUCTS = [
  { id: "hooker_revelin", product_name: "Revelin Sofa", manufacturer_name: "Hooker Furniture", material: "Leather", style: "Transitional", image_url: "https://hookerfurnishings.com/media/catalog/product/2/0/203_95_922000_82_silo.jpg" },
  { id: "lexington_chase", product_name: "Chase Leather Sofa", manufacturer_name: "Lexington", material: "Leather", style: "Transitional", image_url: "https://www.lexington.com/feedcache/productFull/7725_33_02.jpg" },
  { id: "crlaine_brandon", product_name: "Brandon Sofa", manufacturer_name: "CR Laine", material: "Leather", style: "Transitional", image_url: "https://www.crlaine.com/assets/images/products/xlarge/L1190-00.jpg" },
  { id: "hancock_flossie", product_name: "Flossie Sofa", manufacturer_name: "Hancock & Moore", material: "Leather", style: "Transitional", image_url: "https://hancockandmoore.com/Documents/prod-images/CJ6815-3_Flossie_TibDoe_MD_1022_HR.jpg" },
  { id: "bernhardt_candace", product_name: "Candace Leather Sofa", manufacturer_name: "Bernhardt", material: "Leather", style: "Transitional", image_url: "https://s3.amazonaws.com/emuncloud-staticassets/productImages/bh074/medium/7277LFO.jpg?1.0.81.20281-bfb05d321d+bernhardt-20230616+bernhardt+umbraco+cms+prod=no-cache&m=undefined&=im2022-10-07T06:37:14.8030000Z" },
  { id: "stickley_woodlands-small-roll-arm-sofa-with-nails", product_name: "Woodlands Roll Arm Sofa", manufacturer_name: "Stickley", material: "Fabric", style: "Transitional", image_url: "https://cdn.shopify.com/s/files/1/0571/7088/6842/products/CL-8187-86-PR_SelvanoBark-DarkMaple_WoodlandsSmallRollArmSofa_Angle.jpg?v=1708087381" },
];

// The featured product for the detail panel (Phase 4)
const FEATURED_PRODUCT = SCROLL_PRODUCTS[0];

const TYPED_QUERY = "transitional leather sofa with nailhead trim";
const AI_RESPONSE = "Found 47 transitional leather sofas with nailhead detailing across 8 vendors. Showing top matches by relevance.";


// ════════════════════════════════════════════════════════
// WIREFRAME ROOM — Canvas-based 3D room scene
// ════════════════════════════════════════════════════════
function WireframeRoom({ scrollYProgress }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const zoomRef = useRef(0);
  const opacityRef = useRef(1);

  useEffect(() => {
    const unsub = scrollYProgress.on("change", (v) => {
      const lerp = (s, e) => Math.max(0, Math.min(1, (v - s) / (e - s)));
      zoomRef.current = lerp(0, 0.22);
      opacityRef.current = v < 0.12 ? 1 : Math.max(0, 1 - lerp(0.12, 0.22));
    });
    return unsub;
  }, [scrollYProgress]);

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

    // Room geometry
    const backWall = [[-1.8,-1.0,-1.5],[1.8,-1.0,-1.5],[1.8,1.2,-1.5],[-1.8,1.2,-1.5]];
    const floor = [[-1.8,-1.0,-1.5],[1.8,-1.0,-1.5],[2.2,-1.0,1.5],[-2.2,-1.0,1.5]];
    const leftWall = [[-1.8,-1.0,-1.5],[-2.2,-1.0,1.5],[-2.2,1.2,1.5],[-1.8,1.2,-1.5]];
    const rightWall = [[1.8,-1.0,-1.5],[2.2,-1.0,1.5],[2.2,1.2,1.5],[1.8,1.2,-1.5]];
    const windowFrame = [[-0.5,0.0,-1.49],[0.5,0.0,-1.49],[0.5,0.9,-1.49],[-0.5,0.9,-1.49]];
    const windowCross = [[0,0.0,-1.49],[0,0.9,-1.49],[-0.5,0.45,-1.49],[0.5,0.45,-1.49]];
    const sofaBase = [[-0.7,-0.65,-0.3],[0.7,-0.65,-0.3],[0.7,-0.65,0.1],[-0.7,-0.65,0.1],[-0.7,-0.35,-0.3],[0.7,-0.35,-0.3],[0.7,-0.35,0.1],[-0.7,-0.35,0.1]];
    const sofaBack = [[-0.7,-0.35,-0.3],[0.7,-0.35,-0.3],[0.7,0.15,-0.35],[-0.7,0.15,-0.35]];
    const sofaArmL = [[-0.7,-0.35,-0.3],[-0.7,-0.35,0.1],[-0.7,-0.05,0.05],[-0.7,-0.05,-0.3]];
    const sofaArmR = [[0.7,-0.35,-0.3],[0.7,-0.35,0.1],[0.7,-0.05,0.05],[0.7,-0.05,-0.3]];
    const coffeeTable = [[-0.4,-0.85,0.3],[0.4,-0.85,0.3],[0.4,-0.85,0.6],[-0.4,-0.85,0.6],[-0.4,-0.65,0.3],[0.4,-0.65,0.3],[0.4,-0.65,0.6],[-0.4,-0.65,0.6]];
    const sideTable = [[-1.2,-0.85,-0.2],[-0.9,-0.85,-0.2],[-0.9,-0.85,0.0],[-1.2,-0.85,0.0],[-1.2,-0.50,-0.2],[-0.9,-0.50,-0.2],[-0.9,-0.50,0.0],[-1.2,-0.50,0.0]];
    const lamp = [[1.1,-1.0,-0.1],[1.1,0.3,-0.1],[0.95,0.3,-0.2],[1.25,0.3,0.0],[1.0,0.5,-0.15],[1.2,0.5,-0.05]];
    const shelf1 = [[-1.75,-0.3,-1.0],[-1.75,-0.3,-0.4]];
    const shelf2 = [[-1.75,0.1,-1.0],[-1.75,0.1,-0.4]];
    const shelf3 = [[-1.75,0.5,-1.0],[-1.75,0.5,-0.4]];
    const shelfSides = [[-1.75,-0.7,-1.0],[-1.75,0.7,-1.0],[-1.75,-0.7,-0.4],[-1.75,0.7,-0.4]];
    const artFrame = [[-1.3,0.1,-1.49],[-0.8,0.1,-1.49],[-0.8,0.7,-1.49],[-1.3,0.7,-1.49]];
    const rug = [[-0.9,-0.99,-0.4],[0.9,-0.99,-0.4],[0.9,-0.99,0.7],[-0.9,-0.99,0.7]];

    const allEdges = [];
    const addRect = (pts, layer) => { for (let i = 0; i < pts.length; i++) allEdges.push({ a: pts[i], b: pts[(i + 1) % pts.length], layer }); };
    const addLine = (a, b, layer) => { allEdges.push({ a, b, layer }); };

    addRect(backWall, "bg"); addRect(floor, "bg"); addRect(leftWall, "bg"); addRect(rightWall, "bg");
    addRect(windowFrame, "bg"); addLine(windowCross[0], windowCross[1], "bg"); addLine(windowCross[2], windowCross[3], "bg");
    addRect(artFrame, "bg"); addRect(rug, "bg");
    addLine(shelf1[0], shelf1[1], "bg"); addLine(shelf2[0], shelf2[1], "bg"); addLine(shelf3[0], shelf3[1], "bg");
    addLine(shelfSides[0], shelfSides[1], "bg"); addLine(shelfSides[2], shelfSides[3], "bg");
    addRect(sofaBase.slice(0, 4), "mid"); addRect(sofaBase.slice(4), "mid");
    for (let i = 0; i < 4; i++) addLine(sofaBase[i], sofaBase[i + 4], "mid");
    addRect(sofaBack, "mid"); addLine(sofaBack[0], sofaBase[4], "mid"); addLine(sofaBack[1], sofaBase[5], "mid");
    addRect(sofaArmL, "mid"); addRect(sofaArmR, "mid");
    addRect(coffeeTable.slice(0, 4), "fg"); addRect(coffeeTable.slice(4), "fg");
    for (let i = 0; i < 4; i++) addLine(coffeeTable[i], coffeeTable[i + 4], "fg");
    addRect(sideTable.slice(0, 4), "mid"); addRect(sideTable.slice(4), "mid");
    for (let i = 0; i < 4; i++) addLine(sideTable[i], sideTable[i + 4], "mid");
    addLine(lamp[0], lamp[1], "fg"); addLine(lamp[2], lamp[3], "fg"); addLine(lamp[4], lamp[5], "fg");
    addLine(lamp[2], lamp[4], "fg"); addLine(lamp[3], lamp[5], "fg");

    const particles = Array.from({ length: 30 }, () => ({
      x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 3,
      size: 1 + Math.random() * 2, speed: 0.001 + Math.random() * 0.002, phase: Math.random() * Math.PI * 2,
    }));

    const project = (v, w, h, camZ) => {
      const z = v[2] - camZ;
      const perspective = 3.0;
      const d = perspective - z;
      if (d <= 0.1) return [w * 0.5, h * 0.5, 0];
      const scale = perspective / d;
      return [w * 0.5 + v[0] * scale * w * 0.22, h * 0.48 - v[1] * scale * h * 0.22, Math.max(0, Math.min(1, scale / 2))];
    };

    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      const currentOpacity = opacityRef.current;
      if (currentOpacity <= 0.01) { frameRef.current = requestAnimationFrame(draw); return; }

      const camZ = -2.0 + zoomRef.current * 3.5;
      const t = Date.now() * 0.001;

      particles.forEach((p) => {
        const px = p.x + Math.sin(t * p.speed * 40 + p.phase) * 0.2;
        const py = p.y + Math.cos(t * p.speed * 30 + p.phase) * 0.15;
        const [sx, sy, sc] = project([px, py, p.z], w, h, camZ);
        if (sc <= 0) return;
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * sc * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${P.brassRgb}, ${0.08 * sc * currentOpacity})`;
        ctx.fill();
      });

      const layerAlpha = { bg: 0.15 + zoomRef.current * 0.05, mid: 0.22 + zoomRef.current * 0.10, fg: 0.18 + zoomRef.current * 0.08 };
      allEdges.forEach(({ a, b, layer }) => {
        const [x1, y1, s1] = project(a, w, h, camZ);
        const [x2, y2, s2] = project(b, w, h, camZ);
        if (s1 <= 0 && s2 <= 0) return;
        const avg = (s1 + s2) / 2;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${P.brassRgb}, ${Math.min(0.5, layerAlpha[layer] * avg * currentOpacity)})`;
        ctx.lineWidth = (layer === "mid" ? 1.4 : 1.0) * avg;
        ctx.stroke();
      });

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => { window.removeEventListener("resize", resize); if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ willChange: "transform" }} aria-hidden="true" />;
}


// ════════════════════════════════════════════════════════
// SCROLL EXPERIENCE — Main Component
// ════════════════════════════════════════════════════════
export default function ScrollExperience() {
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const { user, navigateToLogin } = useAuth();
  const [query, setQuery] = useState("");
  const fileInputRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const voiceSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const [isMobile, setIsMobile] = useState(false);
  const isMobileRef = useRef(false);

  const featuredProduct = SCROLL_PRODUCTS[0];

  // ── Preload all product images via <link rel="preload"> + held Image refs ──
  const preloadedImgsRef = useRef([]);
  useEffect(() => {
    // <link rel="preload"> is the strongest hint — browser fetches immediately
    const links = SCROLL_PRODUCTS.map((p) => {
      const url = proxyUrl(p.image_url);
      const link = document.createElement("link");
      link.rel = "preload";
      link.as = "image";
      link.href = url;
      link.fetchPriority = "high";
      document.head.appendChild(link);
      return link;
    });
    // Also hold Image objects so the browser keeps them in memory cache
    preloadedImgsRef.current = SCROLL_PRODUCTS.map((p) => {
      const img = new Image();
      img.src = proxyUrl(p.image_url);
      return img;
    });
    return () => links.forEach((l) => l.parentNode?.removeChild(l));
  }, []);

  useEffect(() => {
    const check = () => {
      const m = window.innerWidth < 768;
      setIsMobile(m);
      isMobileRef.current = m;
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Scroll tracking ──
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Text state — only these cause re-renders (with ref guards)
  const [typedChars, setTypedChars] = useState(0);
  const [aiResponseChars, setAiResponseChars] = useState(0);
  const [currentPhaseIdx, setCurrentPhaseIdx] = useState(0);
  const lastTypedRef = useRef(-1);
  const lastAiRef = useRef(-1);
  const lastPhaseRef = useRef(-1);

  // DOM refs for direct scroll-driven style updates (zero React re-renders)
  const phase1Ref = useRef(null);
  const heroContentRef = useRef(null);
  const phase2Ref = useRef(null);
  const searchBarRef = useRef(null);
  const searchKickerRef = useRef(null);
  const searchSubmitRef = useRef(null);
  const searchHintRef = useRef(null);
  const phase3Ref = useRef(null);
  const aiBoxRef = useRef(null);
  const cardRefs = useRef(new Array(SCROLL_PRODUCTS.length).fill(null));
  const phase4Ref = useRef(null);
  const phase4CardRef = useRef(null);
  const phase4CtaRef = useRef(null);
  const ctaInnerRef = useRef(null);
  const phase3TriggeredRef = useRef(false);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
    const lerp = (s, e) => clamp01((v - s) / (e - s));
    const mob = isMobileRef.current;

    // ── Phase ranges ──────────────────────────────────────────────
    // Mobile uses tighter, non-overlapping windows (320vh total).
    // Desktop uses generous cross-fade windows (450vh total).
    const R = mob ? {
      // Phase 1
      heroOut:   [0.05, 0.16],
      roomOut:   [0.13, 0.22],
      // Phase 2
      searchIn:  [0.22, 0.32],
      searchOut: [0.46, 0.52],
      kickerIn:  [0.23, 0.32],
      submitIn:  [0.25, 0.33],
      hintIn:    [0.30, 0.38],
      typedRange:[0.30, 0.44],
      // Phase 3
      resIn:     [0.52, 0.60],
      resOut:    [0.70, 0.76],
      aiIn:      [0.54, 0.61],
      aiTyped:   [0.55, 0.64],
      // Phase 4
      detIn:     [0.78, 0.86],
      ctaIn:     [0.88, 0.94],
      // Labels
      p2Start: 0.22, p3Start: 0.52, p4Start: 0.78,
    } : {
      // Phase 1
      heroOut:   [0.06, 0.18],
      roomOut:   [0.12, 0.22],
      // Phase 2
      searchIn:  [0.18, 0.28],
      searchOut: [0.38, 0.44],
      kickerIn:  [0.20, 0.28],
      submitIn:  [0.24, 0.32],
      hintIn:    [0.30, 0.38],
      typedRange:[0.26, 0.40],
      // Phase 3
      resIn:     [0.42, 0.50],
      resOut:    [0.64, 0.72],
      aiIn:      [0.44, 0.52],
      aiTyped:   [0.44, 0.50],
      // Phase 4
      detIn:     [0.68, 0.76],
      ctaIn:     [0.82, 0.90],
      // Labels
      p2Start: 0.20, p3Start: 0.42, p4Start: 0.68,
    };

    // Phase 1
    const roomOp = v < R.roomOut[0] ? 1 : 1 - lerp(...R.roomOut);
    if (phase1Ref.current) phase1Ref.current.style.opacity = roomOp;
    if (heroContentRef.current) {
      heroContentRef.current.style.opacity = 1 - lerp(...R.heroOut);
      heroContentRef.current.style.transform = `translateY(${-lerp(...R.roomOut) * 60}px)`;
    }

    // Phase 2
    const searchIn = lerp(...R.searchIn);
    const searchOut = v > R.searchOut[0] ? lerp(...R.searchOut) : 0;
    const searchOp = Math.min(searchIn, 1 - searchOut);
    if (phase2Ref.current) {
      phase2Ref.current.style.opacity = searchOp;
      phase2Ref.current.style.pointerEvents = searchOp > 0.3 ? "auto" : "none";
    }
    if (searchBarRef.current) {
      const blur = searchIn * 24;
      searchBarRef.current.style.background = `rgba(255,255,255,${0.3 + searchIn * 0.45})`;
      searchBarRef.current.style.backdropFilter = `blur(${blur}px) saturate(${1 + searchIn * 0.3})`;
      searchBarRef.current.style.WebkitBackdropFilter = `blur(${blur}px) saturate(${1 + searchIn * 0.3})`;
      searchBarRef.current.style.borderColor = `rgba(${P.sageRgb},${0.1 + searchIn * 0.3})`;
    }
    if (searchKickerRef.current) searchKickerRef.current.style.opacity = lerp(...R.kickerIn);
    if (searchSubmitRef.current) searchSubmitRef.current.style.opacity = lerp(...R.submitIn);
    if (searchHintRef.current) searchHintRef.current.style.opacity = lerp(...R.hintIn);

    // Phase 3
    const resIn = lerp(...R.resIn);
    const resOut = v > R.resOut[0] ? lerp(...R.resOut) : 0;
    const resOp = Math.min(resIn, 1 - resOut);
    if (phase3Ref.current) {
      phase3Ref.current.style.opacity = resOp;
      phase3Ref.current.style.pointerEvents = resOp > 0.3 ? "auto" : "none";
    }
    if (aiBoxRef.current) {
      const aiOp = lerp(...R.aiIn);
      aiBoxRef.current.style.opacity = aiOp;
      aiBoxRef.current.style.transform = `translateY(${(1 - aiOp) * 20}px)`;
    }
    // Waterfall: fire once when Phase 3 crosses threshold; reset when it exits
    if (resOp > 0.4 && !phase3TriggeredRef.current) {
      phase3TriggeredRef.current = true;
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        card.style.transition = `opacity 0.45s ${i * 0.07}s ease, transform 0.55s ${i * 0.07}s cubic-bezier(0.22,1,0.36,1)`;
        card.style.opacity = 1;
        card.style.transform = "translateY(0)";
      });
    } else if (resOp < 0.08 && phase3TriggeredRef.current) {
      phase3TriggeredRef.current = false;
      cardRefs.current.forEach((card) => {
        if (!card) return;
        card.style.transition = "none";
        card.style.opacity = 0;
        card.style.transform = "translateY(20px)";
      });
    }

    // Phase 4
    const detOp = lerp(...R.detIn);
    if (phase4Ref.current) {
      phase4Ref.current.style.opacity = detOp;
      phase4Ref.current.style.pointerEvents = detOp > 0.5 ? "auto" : "none";
    }
    if (phase4CardRef.current) phase4CardRef.current.style.transform = `translateX(${(1 - detOp) * -40}px)`;
    if (phase4CtaRef.current) phase4CtaRef.current.style.transform = mob
      ? `translateY(${(1 - detOp) * 30}px)`
      : `translateX(${(1 - detOp) * 60}px)`;
    if (ctaInnerRef.current) ctaInnerRef.current.style.opacity = lerp(...R.ctaIn);

    // Text chars — setState only on actual value change
    const newTyped = Math.floor(lerp(...R.typedRange) * TYPED_QUERY.length);
    const newAi = Math.floor(lerp(...R.aiTyped) * AI_RESPONSE.length);
    const newPhase = v < R.p2Start ? 0 : v < R.p3Start ? 1 : v < R.p4Start ? 2 : 3;
    if (newTyped !== lastTypedRef.current) { lastTypedRef.current = newTyped; setTypedChars(newTyped); }
    if (newAi !== lastAiRef.current) { lastAiRef.current = newAi; setAiResponseChars(newAi); }
    if (newPhase !== lastPhaseRef.current) { lastPhaseRef.current = newPhase; setCurrentPhaseIdx(newPhase); }
  });

  // ── Navigation handlers ──
  const goToSearch = useCallback((url) => {
    try { sessionStorage.setItem("spekd_search_entry", JSON.stringify({ from: "landing", ts: Date.now() })); } catch {}
    navigate(url);
  }, [navigate]);

  const handleSearch = (e) => {
    e.preventDefault();
    const q = query.trim() || TYPED_QUERY;
    goToSearch(`${createPageUrl("Search")}?q=${encodeURIComponent(q)}`);
  };

  const handleVoiceSearch = () => {
    if (!voiceSupported) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = false; r.interimResults = true; r.lang = "en-US";
    recognitionRef.current = r;
    r.onstart = () => setIsListening(true);
    r.onresult = (ev) => {
      let t = ""; for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      setQuery(t);
      if (ev.results[ev.results.length - 1].isFinal && t.trim()) {
        setTimeout(() => { setIsListening(false); goToSearch(`${createPageUrl("Search")}?q=${encodeURIComponent(t.trim())}`); }, 300);
      }
    };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    r.start();
  };

  const handleVisualSearch = () => fileInputRef.current?.click();
  const onFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { sessionStorage.setItem("spekd_visual_search", reader.result); goToSearch(`${createPageUrl("Search")}?visual=true`); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scrollHeight = isMobile ? "320vh" : "450vh";

  const phaseLabels = ["Showroom", "Search", "Results", "Details"];

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileSelected} />

      {/* Sign In */}
      {!user && (
        <button
          onClick={() => navigateToLogin("login")}
          className="fixed right-6 z-50 text-sm font-medium px-6 py-2.5 rounded-full transition-all duration-300 cursor-pointer"
          style={{
            color: P.green,
            border: `1px solid rgba(${P.greenRgb},0.12)`,
            background: "rgba(255,255,255,0.70)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            top: "max(20px, env(safe-area-inset-top, 20px))",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = P.green; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.70)"; e.currentTarget.style.color = P.green; }}
        >
          Sign In
        </button>
      )}

      <div ref={containerRef} className="relative" style={{ height: scrollHeight }}>
        {/* ── Sticky viewport — all animation happens here ── */}
        <div className="sticky top-0 left-0 w-full overflow-hidden" style={{ height: "100vh", background: P.cream }}>

          {/* ════════ PHASE 1: THE SHOWROOM ════════ */}
          <div
            ref={phase1Ref}
            className="absolute inset-0 flex items-center justify-center"
            style={{ opacity: 1, willChange: "opacity" }}
          >
            <WireframeRoom scrollYProgress={scrollYProgress} />

            <div
              ref={heroContentRef}
              className="relative z-10 text-center px-4 max-w-4xl mx-auto"
              style={{
                willChange: "transform, opacity",
              }}
            >
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  <img
                    src="/logo.png"
                    alt="SPEKD"
                    className="h-14 w-14 sm:h-16 sm:w-16 object-contain rounded-[22%]"
                    style={{ boxShadow: `0 8px 32px rgba(${P.brassRgb},0.15)` }}
                  />
                  <div className="absolute -inset-2 rounded-[28%] pointer-events-none" style={{
                    border: `1px solid rgba(${P.brassRgb},0.12)`,
                  }} />
                </div>
              </div>

              <h1
                className="text-[2.1rem] sm:text-5xl md:text-6xl lg:text-[4.5rem] font-semibold leading-[1.05] tracking-[-0.02em]"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: P.textPrimary }}
              >
                Source the way<br />
                you{" "}
                <span style={{
                  background: `linear-gradient(135deg, ${P.green}, ${P.greenMuted})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}>design.</span>
              </h1>
              <p
                className="mt-6 text-[15px] sm:text-[17px] leading-relaxed max-w-xl mx-auto"
                style={{ color: P.textSecondary, fontFamily: "'DM Sans', sans-serif" }}
              >
                42,000+ trade products across 20 vendors.<br className="hidden sm:block" />
                AI that understands designer language.
              </p>

              <div className="mt-12 flex flex-col items-center gap-2 animate-pulse" style={{ opacity: 0.5 }}>
                <span className="text-[10px] uppercase tracking-[0.2em] font-medium" style={{ color: P.textMuted, fontFamily: "'DM Sans', sans-serif" }}>Scroll to explore</span>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 4v12M5 11l5 5 5-5" stroke={P.brass} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>


          {/* ════════ PHASE 2: THE SEARCH ════════ */}
          <div
            ref={phase2Ref}
            className="absolute inset-0 flex items-center justify-center px-4"
            style={{
              opacity: 0,
              pointerEvents: "none",
              willChange: "opacity",
            }}
          >
            <div className="w-full max-w-2xl mx-auto text-center">
              <div ref={searchKickerRef} className="mb-8" style={{ opacity: 0 }}>
                <span className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>
                  Watch it work
                </span>
              </div>

              <form onSubmit={handleSearch} className="relative">
                <div
                  className="absolute -inset-8 rounded-[48px] pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse, rgba(${P.brassRgb},0.08) 0%, transparent 70%)`,
                    filter: "blur(24px)",
                    opacity: 0,
                  }}
                />

                <div
                  ref={searchBarRef}
                  className="relative flex items-center gap-2 sm:gap-3 rounded-full"
                  style={{
                    height: "68px",
                    padding: "0 16px 0 28px",
                    background: "rgba(255,255,255,0.30)",
                    backdropFilter: "blur(0px)",
                    WebkitBackdropFilter: "blur(0px)",
                    border: `1px solid rgba(${P.sageRgb},0.1)`,
                    boxShadow: "none",
                  }}
                >
                  <Search className="h-[18px] w-[18px] shrink-0" style={{ color: typedChars > 0 ? P.brass : P.textMuted }} />
                  <div className="flex-1 min-w-0 text-[15px] sm:text-base text-left" style={{ color: P.textPrimary, fontFamily: "'DM Sans', sans-serif" }}>
                    {query ? (
                      query
                    ) : typedChars > 0 ? (
                      <>
                        {TYPED_QUERY.slice(0, typedChars)}
                        {typedChars < TYPED_QUERY.length && (
                          <span className="inline-block w-[2px] h-[18px] align-middle ml-px animate-pulse" style={{ background: P.brass }} />
                        )}
                      </>
                    ) : (
                      <span style={{ color: "#B5AFA8" }}>Describe what you're looking for...</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {voiceSupported && (
                      <button type="button" onClick={handleVoiceSearch}
                        className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
                        style={{ color: isListening ? "#ef4444" : P.textMuted }}>
                        <Mic className="h-4 w-4" />
                      </button>
                    )}
                    <button type="button" onClick={handleVisualSearch}
                      className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
                      style={{ color: P.textMuted }}>
                      <Camera className="h-4 w-4" />
                    </button>
                    <button ref={searchSubmitRef} type="submit" className="cursor-pointer flex items-center gap-[6px] shrink-0 ml-1"
                      style={{
                        height: "48px", padding: "0 28px", borderRadius: "999px",
                        background: `linear-gradient(135deg, ${P.brass}, ${P.brassDark})`,
                        color: "#fff", fontWeight: 700, fontSize: "14px", fontFamily: "'DM Sans', sans-serif",
                        boxShadow: `0 2px 12px rgba(${P.brassRgb},0.25)`,
                        opacity: 0,
                      }}
                    >
                      <span className="hidden sm:inline">Search</span>
                      <Search className="h-4 w-4 sm:hidden" />
                      <ArrowRight className="h-3.5 w-3.5 hidden sm:block" />
                    </button>
                  </div>
                </div>
              </form>

              {/* Subtle hint that this is real */}
              <div ref={searchHintRef} className="mt-6" style={{ opacity: 0 }}>
                <span className="text-[11px]" style={{ color: P.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
                  Type your own search or keep scrolling
                </span>
              </div>
            </div>
          </div>


          {/* ════════ PHASE 3: THE RESULTS ════════ */}
          <div
            ref={phase3Ref}
            className="absolute inset-0 overflow-hidden"
            style={{
              opacity: 0,
              pointerEvents: "none",
              willChange: "opacity",
            }}
          >
            <div className="h-full px-4 sm:px-8 pt-4 sm:pt-6 pb-16 max-w-6xl mx-auto" style={{ overflowY: isMobile ? "hidden" : "auto" }}>
              {/* Mini search bar (context reminder) */}
              <div
                className="flex items-center gap-3 rounded-full px-5 py-2.5 mb-3 max-w-2xl"
                style={{
                  background: "rgba(255,255,255,0.70)",
                  backdropFilter: "blur(20px)",
                  border: `1px solid rgba(${P.sageRgb},0.30)`,
                }}
              >
                <Search className="h-4 w-4 shrink-0" style={{ color: P.brass }} />
                <span className="text-sm truncate" style={{ color: P.textPrimary, fontFamily: "'DM Sans', sans-serif" }}>
                  {TYPED_QUERY}
                </span>
              </div>

              {/* AI Response */}
              <div
                ref={aiBoxRef}
                className="rounded-xl px-5 py-4 mb-6 max-w-3xl"
                style={{
                  background: `rgba(${P.sageRgb},0.12)`,
                  borderLeft: `3px solid ${P.green}`,
                  opacity: 0,
                  transform: "translateY(20px)",
                  willChange: "transform, opacity",
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: P.green }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M5 1v8M1 5h8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: P.green, fontFamily: "'DM Sans', sans-serif" }}>Spekd AI</span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: P.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
                  {AI_RESPONSE.slice(0, aiResponseChars)}
                  {aiResponseChars < AI_RESPONSE.length && aiResponseChars > 0 && (
                    <span className="inline-block w-[2px] h-[14px] align-middle ml-px animate-pulse" style={{ background: P.brass }} />
                  )}
                </p>
              </div>

              {/* Product cards grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 pb-8">
                {(isMobile ? SCROLL_PRODUCTS.slice(0, 4) : SCROLL_PRODUCTS).map((product, i) => {
                  const hasImage = product.image_url && product.image_url.length > 10;
                  return (
                    <div
                      key={product.id + "-" + i}
                      ref={(el) => { cardRefs.current[i] = el; }}
                      className="rounded-xl overflow-hidden cursor-pointer group"
                      style={{
                        background: P.white,
                        border: `1px solid rgba(${P.greenRgb},0.05)`,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                        opacity: 0,
                        transform: "translateY(30px)",
                        willChange: "transform, opacity",
                      }}
                    >
                      <div className="relative overflow-hidden" style={{ aspectRatio: "1/1", backgroundColor: "#ffffff" }}>
                        {hasImage ? (
                          <img
                            src={proxyUrl(product.image_url)}
                            alt={product.product_name}
                            className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.04]"
                            loading="eager"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <div className="text-3xl font-light" style={{ fontFamily: "'Playfair Display', serif", color: `rgba(${P.greenRgb},0.10)` }}>
                              {product.manufacturer_name[0]}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-3 sm:p-4">
                        <div className="text-[11px] font-bold uppercase tracking-[0.12em] mb-1 truncate" style={{ color: P.green, fontFamily: "'DM Sans', sans-serif" }}>
                          {product.manufacturer_name}
                        </div>
                        <div className="text-[13px] sm:text-[15px] font-medium mb-1 line-clamp-1" style={{ color: P.textPrimary, fontFamily: "'Playfair Display', serif" }}>
                          {product.product_name}
                        </div>
                        {product.material && (
                          <div className="text-[11px] truncate" style={{ color: P.textMuted }}>{product.material}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>


          {/* ════════ PHASE 4: PRODUCT DETAIL + CTA ════════ */}
          <div
            ref={phase4Ref}
            className="absolute inset-0 flex items-center justify-center px-6 sm:px-4"
            style={{
              opacity: 0,
              pointerEvents: "none",
              willChange: "opacity",
            }}
          >
            <div className="w-full max-w-5xl mx-auto">
              <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 items-center">

                {/* Left: Product detail card — hidden on mobile (viewport too short) */}
                <div
                  ref={phase4CardRef}
                  className="rounded-2xl overflow-hidden hidden sm:block"
                  style={{
                    background: P.white,
                    border: `1px solid rgba(${P.greenRgb},0.06)`,
                    boxShadow: "0 8px 40px rgba(44,62,45,0.08), 0 2px 8px rgba(0,0,0,0.04)",
                    transform: "translateX(-40px)",
                    willChange: "transform",
                  }}
                >
                  {/* Product image */}
                  <div className="relative" style={{ aspectRatio: "4/3", backgroundColor: "#ffffff" }}>
                    {featuredProduct.image_url && featuredProduct.image_url.length > 10 ? (
                      <img
                        src={proxyUrl(featuredProduct.image_url)}
                        alt={featuredProduct.product_name}
                        className="h-full w-full object-contain p-4"
                        loading="eager"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <div className="text-5xl font-light" style={{ fontFamily: "'Playfair Display', serif", color: `rgba(${P.greenRgb},0.08)` }}>
                          {featuredProduct.manufacturer_name[0]}
                        </div>
                      </div>
                    )}
                    {/* Overlay action buttons */}
                    <div className="absolute top-3 right-3 flex gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" }}>
                        <Heart className="h-3.5 w-3.5" style={{ color: P.textMuted }} />
                      </div>
                      <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" }}>
                        <FileText className="h-3.5 w-3.5" style={{ color: P.textMuted }} />
                      </div>
                    </div>
                  </div>

                  {/* Product info */}
                  <div className="p-5">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] mb-2" style={{ color: P.green }}>
                      {featuredProduct.manufacturer_name}
                    </div>
                    <h3 className="text-xl sm:text-2xl mb-4" style={{ fontFamily: "'Playfair Display', serif", color: P.textPrimary }}>
                      {featuredProduct.product_name}
                    </h3>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {featuredProduct.material && (
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: P.textMuted }}>Material</div>
                          <div className="text-[12px]" style={{ color: P.textSecondary }}>{featuredProduct.material}</div>
                        </div>
                      )}
                      {featuredProduct.style && (
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: P.textMuted }}>Style</div>
                          <div className="text-[12px]" style={{ color: P.textSecondary }}>{featuredProduct.style}</div>
                        </div>
                      )}
                      {featuredProduct.dimensions && (
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: P.textMuted }}>Dimensions</div>
                          <div className="text-[12px]" style={{ color: P.textSecondary }}>{featuredProduct.dimensions}</div>
                        </div>
                      )}
                      {featuredProduct.color && (
                        <div>
                          <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: P.textMuted }}>Color</div>
                          <div className="text-[12px]" style={{ color: P.textSecondary }}>{featuredProduct.color}</div>
                        </div>
                      )}
                    </div>

                    {/* Action buttons preview */}
                    <div className="flex gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold"
                        style={{ background: `rgba(${P.brassRgb},0.10)`, color: P.brass }}>
                        <FileText className="h-3 w-3" /> Add to Quote
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold"
                        style={{ background: `rgba(${P.greenRgb},0.06)`, color: P.green }}>
                        <ExternalLink className="h-3 w-3" /> View at {featuredProduct.manufacturer_name.split(" ")[0]}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: CTA — full-width centered on mobile, left-aligned on desktop */}
                <div
                  ref={phase4CtaRef}
                  className="sm:text-left text-center flex flex-col sm:items-start items-center"
                  style={{
                    transform: "translateX(60px)",
                    willChange: "transform",
                  }}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] block mb-4" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>
                    Click. Explore. Source.
                  </span>
                  <h2
                    className="text-3xl sm:text-4xl md:text-[2.8rem] leading-tight mb-4"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", color: P.textPrimary }}
                  >
                    Every detail,{" "}
                    <span style={{ color: P.green }}>one click</span> away.
                  </h2>
                  <p className="text-base leading-relaxed mb-8 max-w-md" style={{ color: P.textSecondary, fontFamily: "'DM Sans', sans-serif" }}>
                    Dimensions, materials, pricing, vendor links — everything you need to make confident sourcing decisions, instantly.
                  </p>

                  <div ref={ctaInnerRef} style={{ opacity: 0 }}>
                    <Link
                      to={createPageUrl("Search")}
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold cursor-pointer transition-all duration-300"
                      style={{
                        background: `linear-gradient(135deg, ${P.brass}, ${P.brassDark})`,
                        color: "#fff", fontFamily: "'DM Sans', sans-serif",
                        boxShadow: `0 4px 20px rgba(${P.brassRgb},0.30)`,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 32px rgba(${P.brassRgb},0.40)`; e.currentTarget.style.transform = "scale(1.02)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 4px 20px rgba(${P.brassRgb},0.30)`; e.currentTarget.style.transform = "scale(1)"; }}
                    >
                      Start Sourcing
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <p className="mt-4 text-[11px]" style={{ color: P.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
                      No credit card required to start
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>


          {/* ── Scroll progress indicator ── */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3">
            {phaseLabels.map((label, i) => {
              const isActive = currentPhaseIdx === i;
              const isPast = currentPhaseIdx > i;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className="h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: isActive ? "32px" : "8px",
                      background: isActive ? P.brass : isPast ? P.green : `rgba(${P.greenRgb},0.12)`,
                    }}
                  />
                  {isActive && (
                    <span className="text-[9px] uppercase tracking-[0.15em] font-semibold" style={{ color: P.brass, fontFamily: "'DM Sans', sans-serif" }}>
                      {label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </>
  );
}
