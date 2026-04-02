import React, { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  X,
  AlertCircle,
  Camera,
  Loader2,
  RefreshCw,
  ArrowRight,
  Layers,
  Send,
  ExternalLink,
  Heart,
  ArrowUpDown,
  Eye,
  ChevronDown,
  ChevronUp,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  ClipboardList,
  Plus,
  Check,
  Shuffle,
  Mic,
  Link2,
  Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedGradientBackground from "@/components/ui/animated-gradient-background";
import { searchProducts, smartSearch, visualSearch, getAutocomplete, findSimilarProducts, listSearch, trackProductClick, crossMatchProducts, prefetchSearch, getProduct } from "@/api/searchClient";
import {
  getRecentSearches,
  pushRecentSearch,
  normalizeSearchResult,
  trackStyleInteraction,
  toggleFavorite,
  getFavorites,
  getRecentlyViewed,
  pushRecentlyViewed,
  addToQuote,
  getQuote,
  addQuoteRoom,
} from "@/lib/growth-store";
import { useTradePricing } from "@/lib/TradePricingContext";
import PaywallModal from "@/components/PaywallModal";
import UsageCounter from "@/components/UsageCounter";
import { ensureGuestToken, checkSubscriptionStatus } from "@/lib/fingerprint";

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

// Build proxy URL for an image
function proxyUrl(url, productId) {
  if (!url) return "";
  // Always proxy through the URL-based endpoint so each gallery image loads correctly.
  // The /images/:id endpoint only returns the hero — not suitable for gallery images.
  return `${SEARCH_SERVICE}/proxy-image?url=${encodeURIComponent(url)}`;
}

// Image component: always uses server-side proxy to bypass vendor hotlink protection
function ProxyImg({ src, productId, alt = "", className = "", style = {}, onLoad, onError: externalOnError, eager, fetchPriority, ...rest }) {
  const [failed, setFailed] = useState(false);
  const finalSrc = src ? proxyUrl(src, productId) : "";

  if (failed || !finalSrc) {
    return (
      <div className={className} style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f5f5f0", color: "#999" }} {...rest}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      </div>
    );
  }

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      style={style}
      referrerPolicy="no-referrer"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchpriority={fetchPriority}
      onError={(e) => {
        setFailed(true);
        externalOnError?.(e);
      }}
      onLoad={onLoad}
      {...rest}
    />
  );
}

const EXAMPLE_SEARCHES = [
  "leather sofa transitional",
  "coastal accent chair",
  "walnut dining table",
  "upholstered sectional",
  "statement accent chair",
];

const REFINEMENT_CHIPS = [
  "Show me more options",
  "Under $3,000",
  "In a lighter color",
  "Different style",
  "From a different vendor",
  "Something similar but smaller",
];

const LOADING_STEPS = [
  { label: "Reading your brief..." },
  { label: "Searching 42,000+ products..." },
  { label: "Matching across 20+ vendors..." },
  { label: "Curating results..." },
];

const SORT_OPTIONS = [
  { key: "relevance", label: "Best Match" },
  { key: "vendor_az", label: "Vendor A-Z" },
  { key: "newest", label: "Newest" },
  { key: "popular", label: "Most Popular" },
];

const VIEW_MODES = [
  { key: "studio", label: "Studio" },
  { key: "gallery", label: "Gallery" },
];

// Smaller initial load on mobile for faster paint
const IS_MOBILE = typeof window !== "undefined" && (window.matchMedia("(max-width: 768px)").matches || navigator.maxTouchPoints > 0);
const INITIAL_PAGE_SIZE = IS_MOBILE ? 20 : 48;
const LOAD_MORE_SIZE = IS_MOBILE ? 20 : 48;
const MAX_RESULTS = 500;

// On mobile: skip framer-motion entrance animations for snappier feel
const noAnim = { initial: false, animate: false, exit: undefined, transition: { duration: 0 } };

// 100 designer-friendly accent colors for bucket headers
const BUCKET_COLORS = [
  "#E57373","#F06292","#BA68C8","#9575CD","#7986CB","#64B5F6","#4FC3F7","#4DD0E1",
  "#4DB6AC","#81C784","#AED581","#DCE775","#FFD54F","#FFB74D","#FF8A65","#A1887F",
  "#E53935","#D81B60","#8E24AA","#5E35B1","#3949AB","#1E88E5","#039BE5","#00ACC1",
  "#00897B","#43A047","#7CB342","#C0CA33","#FDD835","#FFB300","#FB8C00","#F4511E",
  "#6D4C41","#546E7A","#EC407A","#AB47BC","#7E57C2","#5C6BC0","#42A5F5","#26C6DA",
  "#26A69A","#66BB6A","#9CCC65","#D4E157","#FFEE58","#FFA726","#FF7043","#8D6E63",
  "#78909C","#EF5350","#CE93D8","#B39DDB","#9FA8DA","#90CAF9","#80DEEA","#80CBC4",
  "#A5D6A7","#C5E1A5","#E6EE9C","#FFF59D","#FFE082","#FFCC80","#FFAB91","#BCAAA4",
  "#B0BEC5","#C62828","#AD1457","#6A1B9A","#4527A0","#283593","#1565C0","#0277BD",
  "#00838F","#00695C","#2E7D32","#558B2F","#9E9D24","#F9A825","#FF8F00","#EF6C00",
  "#D84315","#4E342E","#37474F","#F44336","#E91E63","#9C27B0","#673AB7","#3F51B5",
  "#2196F3","#00BCD4","#009688","#4CAF50","#8BC34A","#CDDC39","#FFEB3B","#FFC107",
  "#FF9800","#FF5722","#795548","#607D8B",
];

function getInitialQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q") || "";
}

// ─── SESSION STATE CACHE ─────────────────────────────────────
// Preserves search results + UI state across navigation (Search → Quotes → back)
const SEARCH_CACHE_KEY = "spekd_search_cache";

function saveSearchCache(data) {
  try {
    sessionStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

function loadSearchCache() {
  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Cache is only valid for 10 minutes
    if (parsed && Date.now() - (parsed._ts || 0) < 10 * 60 * 1000) return parsed;
    sessionStorage.removeItem(SEARCH_CACHE_KEY);
  } catch {}
  return null;
}

function clearSearchCache() {
  try { sessionStorage.removeItem(SEARCH_CACHE_KEY); } catch {}
}

// ─── CLIENT-SIDE FILTER HELPERS ────────────────────────────────
function extractFacets(products) {
  const vendors = {}, categories = {}, materials = {}, styles = {}, colors = {};

  for (const p of products) {
    const v = p.manufacturer_name || p.vendor_name;
    if (v) vendors[v] = (vendors[v] || 0) + 1;

    const cat = p.product_type || p.category;
    if (cat) {
      const label = cat.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      categories[label] = (categories[label] || 0) + 1;
    }

    if (p.material) {
      const mats = p.material.split(/[,;\/]/).map(m => m.trim()).filter(Boolean);
      for (const m of mats) materials[m] = (materials[m] || 0) + 1;
    }

    // Extract from visual tags
    const tags = (p.ai_visual_tags || "").toLowerCase();
    if (tags) {
      const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
      for (const t of tagList) {
        // Color detection
        const colorTerms = ["white", "cream", "ivory", "beige", "gray", "grey", "charcoal", "black", "brown", "tan", "cognac", "navy", "blue", "green", "red", "pink", "gold", "silver", "brass", "bronze", "natural", "walnut", "espresso"];
        if (colorTerms.includes(t)) colors[t.charAt(0).toUpperCase() + t.slice(1)] = (colors[t.charAt(0).toUpperCase() + t.slice(1)] || 0) + 1;
        // Material from tags
        const matTerms = ["leather", "velvet", "boucle", "linen", "performance fabric", "rattan", "woven", "marble", "brass", "iron", "teak", "oak", "walnut", "mahogany", "chenille", "silk", "wool"];
        if (matTerms.includes(t)) materials[t.charAt(0).toUpperCase() + t.slice(1)] = (materials[t.charAt(0).toUpperCase() + t.slice(1)] || 0) + 1;
      }
    }

    if (p.style) styles[p.style] = (styles[p.style] || 0) + 1;
    if (p.color) colors[p.color] = (colors[p.color] || 0) + 1;
  }

  const toArr = obj => Object.entries(obj)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

  return {
    vendors: toArr(vendors),
    categories: toArr(categories),
    materials: toArr(materials),
    styles: toArr(styles),
    colors: toArr(colors),
  };
}

function sortProducts(products, sortKey) {
  const sorted = [...products];
  switch (sortKey) {
    case "vendor_az":
      return sorted.sort((a, b) => (a.manufacturer_name || "").localeCompare(b.manufacturer_name || ""));
    case "newest":
      return sorted.sort((a, b) => {
        const da = a.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b.created_at ? new Date(b.created_at).getTime() : 0;
        return db - da;
      });
    case "popular":
      return sorted.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
    default: // relevance
      return sorted;
  }
}

function getStudioSpanClass(index) {
  if (index === 0) return "sm:col-span-2 lg:col-span-2";
  if (index > 0 && index % 7 === 0) return "lg:col-span-2";
  return "";
}

// Promote the best-image product from the top results into the hero (index 0) position.
// The hero card is col-span-2 and visually dominant, so it should always have a clean image.
function promoteHeroImage(products) {
  if (products.length < 2) return products;
  const SCAN = Math.min(products.length, 12);
  const qualityRank = { "verified-hq": 3, "verified": 2 };
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < SCAN; i++) {
    const p = products[i];
    if (!p.image_url) continue;
    let score = qualityRank[p.image_quality] || 0;
    // Prefer products with known high-res images
    if (p.image_width >= 800) score += 2;
    else if (p.image_width >= 400) score += 1;
    // Slight relevance bias — prefer items closer to original rank
    score -= i * 0.05;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  if (bestIdx === 0) return products;
  const result = [...products];
  [result[0], result[bestIdx]] = [result[bestIdx], result[0]];
  return result;
}

function getSearchMoodTheme(query = "", products = [], hasVisualSearch = false) {
  const text = `${query} ${(products[0]?.ai_visual_tags || "")} ${(products[0]?.material || "")} ${(products[0]?.style || "")}`.toLowerCase();
  if (hasVisualSearch) {
    return {
      name: "visual",
      accent: "#d8ae79",
      glow: "rgba(216,174,121,0.22)",
      gradient: ["#120f0d", "#1f1815", "#3a2b22", "#d8ae79", "#f0dcc3"],
      chip: "rgba(216,174,121,0.14)",
    };
  }
  if (/(walnut|oak|wood|teak|natural|linen|boucle|organic|warm)/.test(text)) {
    return {
      name: "organic",
      accent: "#d6af7b",
      glow: "rgba(214,175,123,0.2)",
      gradient: ["#120f0d", "#201815", "#3a2c22", "#d6af7b", "#efe0cb"],
      chip: "rgba(214,175,123,0.12)",
    };
  }
  if (/(coastal|cream|ivory|light|air|soft)/.test(text)) {
    return {
      name: "light",
      accent: "#b8c9d6",
      glow: "rgba(184,201,214,0.2)",
      gradient: ["#120f0d", "#1b1817", "#2b3237", "#b8c9d6", "#ecf1f4"],
      chip: "rgba(184,201,214,0.12)",
    };
  }
  if (/(modern|black|charcoal|sculptural|minimal|contemporary)/.test(text)) {
    return {
      name: "modern",
      accent: "#c8b39b",
      glow: "rgba(200,179,155,0.18)",
      gradient: ["#120f0d", "#171515", "#2a2624", "#c8b39b", "#f1e8de"],
      chip: "rgba(200,179,155,0.12)",
    };
  }
  return {
    name: "default",
    accent: "#c6a16a",
    glow: "rgba(198,161,106,0.18)",
    gradient: ["#120f0d", "#1d1714", "#33261f", "#c6a16a", "#eedbc1"],
    chip: "rgba(198,161,106,0.12)",
  };
}

// ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [inputValue, setInputValue] = useState("");
  const [entryTransition, setEntryTransition] = useState(() => {
    try {
      const raw = sessionStorage.getItem("spekd_search_entry");
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.from === "landing" && Date.now() - (parsed?.ts || 0) < 15000;
    } catch {
      return false;
    }
  });
  const [allResults, setAllResults] = useState([]); // full result set from server
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [zeroResultGuidance, setZeroResultGuidance] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [displayQuery, setDisplayQuery] = useState("");

  // Sort, pagination

  const [sortKey, setSortKey] = useState("relevance");
  const [viewMode, setViewMode] = useState("studio");
  const [presentationMode, setPresentationMode] = useState(() => {
    try { return localStorage.getItem("spekd_presentation_mode") === "1"; } catch { return false; }
  });
  const [visibleCount, setVisibleCount] = useState(INITIAL_PAGE_SIZE);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Server pagination
  const shownProductIds = useRef(new Set());
  const lastQueryRef = useRef("");
  const pageRef = useRef(1);

  // Autocomplete
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [visualSearchLoading, setVisualSearchLoading] = useState(false);
  const [visualSearchThumb, setVisualSearchThumb] = useState(null);
  const autocompleteTimer = useRef(null);
  const searchFormRef = useRef(null);

  // Conversation
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());

  // List mode — multi-item sourcing lists
  const [listMode, setListMode] = useState(false);
  const [listResults, setListResults] = useState(null); // { overview_message, items: [...] }

  // Preview panel
  const [previewProduct, setPreviewProduct] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [alternativeProducts, setAlternativeProducts] = useState([]);
  const [alternativeLoading, setAlternativeLoading] = useState(false);
  const [alternativeLabel, setAlternativeLabel] = useState("");

  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [quoteIds, setQuoteIds] = useState(new Set());
  const [quoteToast, setQuoteToast] = useState(null);
  const [favoriteToast, setFavoriteToast] = useState(null);

  // Change 3 — Quote dropdown state
  const [quoteDropdownProduct, setQuoteDropdownProduct] = useState(null);
  const [quoteDropdownPos, setQuoteDropdownPos] = useState({ top: 0, left: 0 });

  // Change 8 — Bucket colors and expand state
  const [bucketColors, setBucketColors] = useState([]);
  const [expandedBuckets, setExpandedBuckets] = useState(new Set());

  // Changes 9-11 — Cross-bucket selections
  const [bucketSelections, setBucketSelections] = useState(new Map());
  const originalBucketProducts = useRef(null); // stores original product order per bucket

  // Trial & subscription
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallMode, setPaywallMode] = useState("trial_required");
  const [searchesRemaining, setSearchesRemaining] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(null);
  const [isFreeFallback, setIsFreeFallback] = useState(false);

  const [totalAvailable, setTotalAvailable] = useState(0);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const scrollSentinelRef = useRef(null);

  // Voice search
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const voiceSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  const isPro = subscriptionStatus === "active" || subscriptionStatus === "trialing" || subscriptionStatus === "activating" || (() => {
    try {
      const status = localStorage.getItem("spec_sub_status");
      return status === "active" || status === "trialing";
    } catch { return false; }
  })();

  const hasConversation = messages.length > 0;

  // Derived: sorted + paginated results, with best-image product promoted to hero position
  const sorted = sortProducts(allResults, sortKey);
  const visibleProducts = promoteHeroImage(sorted.slice(0, visibleCount));
  const hasMoreLocal = visibleCount < sorted.length;
  const hasMoreServer = allResults.length < MAX_RESULTS;
  const facets = allResults.length > 0 ? extractFacets(allResults) : null;
  const moodTheme = getSearchMoodTheme(displayQuery || lastQueryRef.current || inputValue, allResults, Boolean(visualSearchThumb));

  // Close autocomplete on outside click
  useEffect(() => {
    if (!showAutocomplete) return;
    const handler = (e) => {
      // Keep open if clicking inside any search form
      if (e.target.closest("form")) return;
      setShowAutocomplete(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAutocomplete]);

  // Keep a ref to cacheable state so unmount callback can access latest values
  const cacheableState = useRef({});
  useEffect(() => {
    cacheableState.current = { allResults, messages, displayQuery, sortKey, visibleCount, totalAvailable };
  }, [allResults, messages, displayQuery, sortKey, visibleCount, totalAvailable]);

  // Save search state to sessionStorage on unmount so navigating back restores it
  useEffect(() => {
    return () => {
      const query = lastQueryRef.current;
      if (!query || !cacheableState.current.allResults?.length) return;
      const { allResults: results, messages: msgs, displayQuery: dq, sortKey: sk, visibleCount: vc, totalAvailable: ta } = cacheableState.current;
      saveSearchCache({
        _ts: Date.now(),
        query,
        scrollY: window.scrollY || 0,
        allResults: results,
        messages: msgs,
        displayQuery: dq,
        sortKey: sk,
        visibleCount: vc,
        totalAvailable: ta,
      });
    };
  }, []);

  useEffect(() => {
    if (!entryTransition) return;
    const timer = setTimeout(() => {
      setEntryTransition(false);
      try { sessionStorage.removeItem("spekd_search_entry"); } catch {}
    }, 1200);
    return () => clearTimeout(timer);
  }, [entryTransition]);

  useEffect(() => {
    try { localStorage.setItem("spekd_presentation_mode", presentationMode ? "1" : "0"); } catch {}
  }, [presentationMode]);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    setRecentlyViewed(getRecentlyViewed());
    setFavorites(getFavorites());
    // Build set of product IDs currently in quote
    try {
      const q = JSON.parse(localStorage.getItem("spec_growth_quote") || "null");
      if (q?.rooms) {
        const ids = new Set();
        q.rooms.forEach(r => r.items.forEach(i => ids.add(i.id)));
        setQuoteIds(ids);
      }
    } catch {}
    const initialQuery = getInitialQuery();

    // Try restoring cached state first (e.g., returning from Quotes page)
    // Restore if: cache exists with results, AND either no URL query or URL query matches cache
    const cached = loadSearchCache();
    if (cached && cached.allResults?.length > 0 && (!initialQuery || cached.query === initialQuery)) {
      const q = cached.query;
      setInputValue(q);
      setAllResults(cached.allResults);
      setMessages(cached.messages || []);
      setDisplayQuery(cached.displayQuery || q);
      setSortKey(cached.sortKey || "relevance");
      setVisibleCount(cached.visibleCount || INITIAL_PAGE_SIZE);
      setTotalAvailable(cached.totalAvailable || cached.allResults.length);
      lastQueryRef.current = q;
      // Put the query back in the URL so refresh works
      window.history.replaceState({}, "", `/Search?q=${encodeURIComponent(q)}`);
      // Restore scroll position after React renders
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.scrollTo(0, cached.scrollY || 0);
        }, 50);
      });
      clearSearchCache();
      return;
    }

    if (initialQuery) {
      setInputValue(initialQuery);
      runSearch(initialQuery);
    }

    // Handle visual search triggered from Landing page
    const params = new URLSearchParams(window.location.search);
    if (params.get("visual") === "true") {
      const imageData = sessionStorage.getItem("spekd_visual_search");
      if (imageData) {
        sessionStorage.removeItem("spekd_visual_search");
        window.history.replaceState({}, "", "/Search");
        // Trigger visual search with the stored image
        setVisualSearchLoading(true);
        setDisplayQuery("[Visual Search]");
        setVisualSearchThumb(imageData);
        setLoading(true);
        setAllResults([]);
        const mimeType = imageData.startsWith("data:image/png") ? "image/png" : "image/jpeg";
        visualSearch(imageData, mimeType).then((data) => {
          const summaryText = data.assistant_message || data.ai_summary || "Here are matching products.";
          if (data.result_mode === "visual-room" && data.items?.length > 0) {
            const roomItems = data.items.map((item, i) => ({
              original_text: item.label,
              summary: `${item.total || item.products?.length || 0} matches`,
              item_number: i + 1,
              products: item.products || [],
              total: item.total || item.products?.length || 0,
            }));
            setListMode(true);
            setListResults({ overview_message: summaryText, items: roomItems });
            setBucketColors(roomItems.map((_, i) => {
              const COLORS = ["#c4a882", "#82a8c4", "#a8c482", "#c482a8", "#82c4a8", "#c4a882", "#a882c4", "#c48282"];
              return COLORS[i % COLORS.length];
            }));
            setExpandedBuckets(new Set([0]));
            setAllResults([]);
            setTotalAvailable(data.total || 0);
          } else {
            const products = data.products || [];
            setAllResults(products);
            setTotalAvailable(data.total || products.length);
            setMessages([{ role: "assistant", content: summaryText }]);
          }
        }).catch((err) => {
          setError("Visual search failed — " + (err.message || "try again."));
        }).finally(() => {
          setLoading(false);
          setVisualSearchLoading(false);
        });
      }
    }
  }, []);

  // Initialize subscription status & guest token
  useEffect(() => {
    async function initSubscription() {
      const status = await checkSubscriptionStatus();
      setSubscriptionStatus(status.status);
      if (status.searches_remaining != null) {
        setSearchesRemaining(status.searches_remaining);
      }
      if (status.trial_days_remaining != null) {
        setTrialDaysRemaining(status.trial_days_remaining);
      }
      if (status.status === "trial_expired") {
        setIsFreeFallback(true);
      }
      // Check URL for subscription success (returning from Stripe)
      const params = new URLSearchParams(window.location.search);
      if (params.get("subscription") === "success") {
        const sessionId = params.get("session_id");
        window.history.replaceState({}, "", "/Search");
        setSubscriptionStatus("activating");

        // Verify the checkout session directly with Stripe (doesn't depend on webhook)
        if (sessionId) {
          try {
            const token = localStorage.getItem("spec_auth_token");
            const verifyResp = await fetch(`${SEARCH_SERVICE}/subscribe/verify-session`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ session_id: sessionId }),
            });
            const verifyData = await verifyResp.json();
            if (verifyData.activated && (verifyData.status === "active" || verifyData.status === "trialing")) {
              setSubscriptionStatus(verifyData.status);
              if (verifyData.trial_days_remaining != null) setTrialDaysRemaining(verifyData.trial_days_remaining);
              setSearchesRemaining(null);
              setIsFreeFallback(false);
              setShowPaywall(false);
              localStorage.setItem("spec_sub_status", verifyData.status);
              window.dispatchEvent(new CustomEvent("spec:subscription-changed", { detail: { status: verifyData.status, trial_days_remaining: verifyData.trial_days_remaining } }));
              return;
            }
          } catch (e) {
            console.warn("[checkout] verify-session failed:", e);
          }
        }

        // Fallback: poll status endpoint
        let attempts = 0;
        const poll = async () => {
          attempts++;
          const freshStatus = await checkSubscriptionStatus();
          if (freshStatus.status === "active" || freshStatus.status === "trialing") {
            setSubscriptionStatus(freshStatus.status);
            if (freshStatus.trial_days_remaining != null) setTrialDaysRemaining(freshStatus.trial_days_remaining);
            setSearchesRemaining(null);
            setIsFreeFallback(false);
            setShowPaywall(false);
            window.dispatchEvent(new CustomEvent("spec:subscription-changed", { detail: { status: freshStatus.status, trial_days_remaining: freshStatus.trial_days_remaining } }));
            return;
          }
          if (attempts < 5) {
            setTimeout(poll, 2000);
          } else {
            setTimeout(() => window.location.reload(), 3000);
          }
        };
        poll();
      }
    }
    initSubscription();
    ensureGuestToken();
  }, []);

  // React to ?upgrade=true — works even when already on /Search
  useEffect(() => {
    if (searchParams.get("upgrade") === "true") {
      setSearchParams({}, { replace: true });
      setPaywallMode("upgrade");
      setShowPaywall(true);
    }
  }, [searchParams]);

  // React to ?product=<id> — open shareable product link
  useEffect(() => {
    const productId = searchParams.get("product");
    if (productId && !previewProduct) {
      setSearchParams((prev) => { const p = new URLSearchParams(prev); p.delete("product"); return p; }, { replace: true });
      (async () => {
        try {
          const p = await getProduct(productId);
          if (p) openPreview(p);
        } catch (err) {
          console.error("[share-link] Could not load product:", err);
        }
      })();
    }
  }, []);

  // Removed: auto-scroll to chat end was pushing page to bottom on every search

  // Infinite scroll observer
  useEffect(() => {
    if (!scrollSentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !loadingMore && hasConversation) {
          if (hasMoreLocal) {
            setVisibleCount(v => Math.min(v + LOAD_MORE_SIZE, sorted.length));
          } else if (hasMoreServer && allResults.length < MAX_RESULTS) {
            loadMoreFromServer();
          }
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(scrollSentinelRef.current);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMoreLocal, hasMoreServer, sorted.length, hasConversation]);

  // ── LIST DETECTION ──
  const detectList = (text) => {
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return null;
    // Check for numbered items, bullets, or dashes
    const listPatterns = lines.filter(l =>
      /^\d+[\.\)]\s/.test(l) || /^[-•*]\s/.test(l) || /^[a-z]\)\s/i.test(l)
    );
    if (listPatterns.length >= 2) {
      return lines.map(l => l.replace(/^\d+[\.\)]\s*/, "").replace(/^[-•*]\s*/, "").replace(/^[a-z]\)\s*/i, "").trim()).filter(l => l.length > 3);
    }
    // Multiple lines that each look like a product description
    if (lines.length >= 2 && lines.every(l => l.length > 5 && l.length < 200)) {
      return lines;
    }
    return null;
  };

  // ── LIST SEARCH ──
  const runListSearch = async (items) => {
    setInputValue("");
    setLoading(true);
    setError(null);
    setListMode(true);
    setListResults(null);
    setAllResults([]);
    setPreviewProduct(null);

    const userMsg = { role: "user", content: `📋 Sourcing list (${items.length} items):\n${items.map((it, i) => `${i + 1}. ${it}`).join("\n")}`, timestamp: Date.now() };
    setMessages([userMsg]);
    window.history.replaceState({}, "", `/Search?q=list`);

    try {
      const data = await listSearch(items);
      setListResults(data);
      // Save original product order for revert on deselect
      originalBucketProducts.current = (data.items || []).map(item => [...(item.products || [])]);
      // Assign random bucket colors
      const shuffled = [...BUCKET_COLORS].sort(() => Math.random() - 0.5);
      setBucketColors(shuffled.slice(0, (data.items || []).length));
      setExpandedBuckets(new Set());
      setBucketSelections(new Map());
      const assistantMsg = {
        role: "assistant",
        content: data.overview_message || `Processed ${items.length} items.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      if (err.status === 402 || err.message === "subscription_required") {
        setPaywallMode("upgrade");
        setShowPaywall(true);
        setLoading(false);
        return;
      }
      setError("List search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── SEARCH ──
  const runSearch = async (q, searchOptions = {}) => {
    if (!q.trim()) return;
    const trimmed = q.trim();

    // Detect multi-item lists — Pro only
    const listItems = detectList(trimmed);
    if (listItems && listItems.length >= 2) {
      if (!isPro) {
        setShowPaywall(true);
        return;
      }
      return runListSearch(listItems);
    }

    // Detect multi-item patterns in single search mode
    // e.g. "living room with sofa two chairs and coffee table"
    // or "sofa, chairs, and coffee table"
    const furnitureTypes = ["sofa","couch","sectional","chair","armchair","table","desk","bed","dresser","credenza","bookcase","shelf","shelving","ottoman","bench","stool","cabinet","console","nightstand","lamp","rug","mirror","sideboard","buffet","bar cart","loveseat","chaise","daybed","headboard","vanity","wardrobe","accent table","end table","coffee table","dining table","side table"];
    const multiItemPattern = trimmed.toLowerCase();
    const detectedItems = [];
    // Pattern: "X and Y and Z" or "X, Y, and Z"
    const andSplit = multiItemPattern.split(/\s*(?:,\s*(?:and\s+)?|(?:\s+and\s+))\s*/);
    if (andSplit.length >= 2) {
      for (const segment of andSplit) {
        const seg = segment.trim();
        if (seg && furnitureTypes.some(ft => seg.includes(ft))) {
          detectedItems.push(seg);
        }
      }
    }
    // Also detect "with" splits: "living room with sofa and table"
    if (detectedItems.length < 2) {
      const withSplit = multiItemPattern.split(/\s+with\s+/);
      if (withSplit.length === 2) {
        const afterWith = withSplit[1];
        const subItems = afterWith.split(/\s*(?:,\s*(?:and\s+)?|(?:\s+and\s+))\s*/);
        const context = withSplit[0]; // e.g. "living room"
        for (const sub of subItems) {
          const seg = sub.trim();
          if (seg && furnitureTypes.some(ft => seg.includes(ft))) {
            detectedItems.push(context + " " + seg);
          }
        }
      }
    }
    if (detectedItems.length >= 2) {
      if (!isPro) {
        setShowPaywall(true);
        return;
      }
      return runListSearch(detectedItems);
    }

    // Clear list mode when doing single search
    setListMode(false);
    setListResults(null);
    setInputValue("");
    setLoading(true);
    setError(null);
    setLoadingStep(0);

    setSortKey("relevance");
    setVisibleCount(INITIAL_PAGE_SIZE);
    setPreviewProduct(null);
    setShowAutocomplete(false);
    setAutocompleteResults([]);

    shownProductIds.current = new Set();
    pageRef.current = 1;
    lastQueryRef.current = trimmed;
    setDisplayQuery(trimmed);
    setVisualSearchThumb(null);

    const userMsg = { role: "user", content: trimmed, timestamp: Date.now() };
    const updatedMessages = hasConversation ? [...messages, userMsg] : [userMsg];
    setMessages(updatedMessages);

    window.history.replaceState({}, "", `/Search?q=${encodeURIComponent(trimmed)}`);

    // Cycle loading step labels on a fast interval while API call runs
    let stepIdx = 0;
    const stepTimer = setInterval(() => {
      stepIdx = (stepIdx + 1) % LOADING_STEPS.length;
      setLoadingStep(stepIdx);
    }, 800);

    try {
      // Build conversation for the AI brain — includes result summaries
      // so the AI knows what the designer is currently looking at
      const apiConvo = updatedMessages.map(msg => {
        if (msg.role === "user") {
          return { role: "user", content: msg.content };
        }
        // For assistant messages, include what was shown
        return {
          role: "assistant",
          content: msg.content,
          resultSummary: msg.resultSummary || msg.content,
        };
      });

      let data;
      if (isPro) {
        try {
          data = await smartSearch(apiConvo);
        } catch {
          // Fallback to old search if smart search fails
          data = await searchProducts(trimmed, { filters: searchOptions.filters || {} });
        }
      } else {
        // Free tier: same endpoint, backend routes to vector-only
        data = await searchProducts(trimmed, { filters: searchOptions.filters || {} });
      }

      const products = data.products || [];
      setTotalAvailable(data.total_available || data.total || products.length);
      const summaryText = isPro
        ? (data.assistant_message || data.ai_summary || `Found ${products.length} products for "${trimmed}".`)
        : `Found ${products.length} products for "${trimmed}".`;

      // Build detailed result summary for future AI context
      // Include product details so the AI knows exactly what the designer is looking at
      const topDetails = products.slice(0, 8).map((p, i) =>
        `${i + 1}. ${p.product_name} (${p.vendor_id || "?"}, ${p.category || "?"}, ${p.material || "?"}, ${p.style || "?"}${p.retail_price ? ", $" + Number(p.retail_price).toLocaleString() : ""})`
      ).join("\n");
      const vendorBreakdown = {};
      for (const p of products) { vendorBreakdown[p.vendor_id || "?"] = (vendorBreakdown[p.vendor_id || "?"] || 0) + 1; }
      const vendorSummary = Object.entries(vendorBreakdown).map(([v, c]) => `${v}(${c})`).join(", ");
      const resultSummary = `Showed ${products.length} results. Vendors: ${vendorSummary}. Top results:\n${topDetails}`;

      for (const p of products) {
        if (p.id) shownProductIds.current.add(p.id);
      }

      setAllResults(products);
      setZeroResultGuidance(data.zero_result_guidance || null);

      const assistantMsg = {
        role: "assistant",
        content: summaryText,
        resultSummary,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setRecentSearches(pushRecentSearch(trimmed));
      // Update search counter and trial info from response
      if (data.searches_remaining != null) {
        setSearchesRemaining(data.searches_remaining);
      }
      if (data.trial_days_remaining != null) {
        setTrialDaysRemaining(data.trial_days_remaining);
      }
      if (data.is_free_fallback) {
        setIsFreeFallback(true);
      }
    } catch (err) {
      if (err.status === 402 || err.message === "subscription_required") {
        clearInterval(stepTimer);
        const errData = err.data || {};
        if (errData.error === "trial_required") {
          setPaywallMode("trial_required");
        } else {
          setPaywallMode("upgrade");
        }
        setShowPaywall(true);
        setLoading(false);
        return;
      }
      if (err.status === 429 || err.message === "rate_limited") {
        clearInterval(stepTimer);
        const seconds = err.retryAfter || 10;
        setError(`You're searching too fast. Please wait ${seconds} seconds.`);
        setLoading(false);
        return;
      }
      if (err.name === "AbortError" || (err.message && err.message.includes("timeout"))) {
        setError("Search took too long. Please try a simpler query or try again.");
      } else {
        setError("Search failed. Please try again.");
      }
    } finally {
      clearInterval(stepTimer);
      setLoading(false);
      setLoadingStep(0);
      window.scrollTo(0, 0);
    }
  };

  // Load more from server
  const loadMoreFromServer = async () => {
    if (loadingMore || !lastQueryRef.current) return;
    setLoadingMore(true);
    pageRef.current += 1;
    try {
      const data = await searchProducts(lastQueryRef.current, {
        exclude_ids: [...shownProductIds.current],
        page: pageRef.current,
      });
      const products = data.products || [];
      for (const p of products) {
        if (p.id) shownProductIds.current.add(p.id);
      }
      if (products.length > 0) {
        setAllResults(prev => [...prev, ...products]);
        setVisibleCount(v => v + products.length);
      }
    } catch {
      setError("Couldn't load more results. Tap to retry.");
    } finally {
      setLoadingMore(false);
    }
  };

  // ── PREVIEW ──
  const openPreview = (product) => {
    setPreviewProduct(product);
    setSimilarProducts([]);
    setAlternativeProducts([]);
    setAlternativeLabel("");
    // Track view
    trackProductClick(product.id, product.manufacturer_name);
    trackStyleInteraction(product.id, "click");
    pushRecentlyViewed(product);
    setRecentlyViewed(getRecentlyViewed());
  };

  const handlePreviewFindSimilar = async (product) => {
    if (!product?.id) return;
    setSimilarLoading(true);
    try {
      const data = await findSimilarProducts(product.id, 12);
      setSimilarProducts(data.products || []);
    } catch {
      setSimilarProducts([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  const handleFindAlternative = async (product, altType) => {
    if (!product) return;
    setAlternativeLoading(true);
    setAlternativeProducts([]);
    setAlternativeLabel(altType);

    // Build tag summary from product's AI fields
    const tags = [];
    if (product.ai_furniture_type) tags.push(`furniture type: ${product.ai_furniture_type}`);
    if (product.ai_style) tags.push(`style: ${product.ai_style}`);
    if (product.ai_formality) tags.push(`formality: ${product.ai_formality}`);
    if (product.ai_primary_material) tags.push(`primary material: ${product.ai_primary_material}`);
    if (product.ai_primary_color) tags.push(`primary color: ${product.ai_primary_color}`);
    if (product.ai_silhouette) tags.push(`silhouette: ${product.ai_silhouette}`);
    if (product.ai_arm_style) tags.push(`arm style: ${product.ai_arm_style}`);
    if (product.ai_back_style) tags.push(`back style: ${product.ai_back_style}`);
    if (product.ai_leg_style) tags.push(`leg style: ${product.ai_leg_style}`);
    if (product.ai_scale) tags.push(`scale: ${product.ai_scale}`);
    if (product.ai_mood) tags.push(`mood: ${product.ai_mood}`);
    if (product.material) tags.push(`material: ${product.material}`);
    if (product.color) tags.push(`color: ${product.color}`);
    const tagStr = tags.join(", ");
    const name = product.product_name || "this product";
    const vendor = product.manufacturer_name || "unknown vendor";

    const queryMap = {
      "Different Material": `The designer is looking at "${name}" from ${vendor} with these characteristics: ${tagStr}. They want the SAME furniture type, SAME silhouette, SAME style, SAME formality, SAME scale BUT made from a DIFFERENT material. Show alternatives in other materials — if the original is leather show fabric, velvet, performance fabric options; if fabric show leather, linen, boucle options. Exclude ${product.ai_primary_material || product.material || "the same material"}.`,
      "Different Color": `The designer is looking at "${name}" from ${vendor} with these characteristics: ${tagStr}. They want the SAME furniture type, SAME silhouette, SAME style, SAME material, SAME formality BUT in a DIFFERENT color. The current color is ${product.ai_primary_color || product.color || "unknown"}. Show alternatives in contrasting or complementary colors.`,
      "Different Size": `The designer is looking at "${name}" from ${vendor} with these characteristics: ${tagStr}. They want the SAME furniture type, SAME style, SAME material, SAME formality BUT in a DIFFERENT size. ${product.ai_scale === "large" || product.ai_scale === "oversized" ? "Show smaller, apartment-scale, or compact versions." : "Show larger, grander, or more substantial versions."}`,
      "Less Formal": `The designer is looking at "${name}" from ${vendor} with these characteristics: ${tagStr}. They want the SAME furniture type, SAME silhouette, SAME approximate scale BUT more CASUAL and RELAXED. Think slipcovered, lived-in, organic textures, softer lines, coastal or farmhouse influence. Less formal than ${product.ai_formality || "the current piece"}.`,
      "More Formal": `The designer is looking at "${name}" from ${vendor} with these characteristics: ${tagStr}. They want the SAME furniture type, SAME silhouette, SAME approximate scale BUT more ELEVATED and REFINED. Think tighter tailoring, richer materials, nailhead trim, tufting, polished legs, luxurious finishes. More formal than ${product.ai_formality || "the current piece"}.`,
      "Lower Price": `The designer is looking at "${name}" from ${vendor} with these characteristics: ${tagStr}. They want the SAME furniture type, SAME style, SAME silhouette, SAME approximate scale and look BUT from MORE AFFORDABLE vendors. Find similar style from mid-tier or value-oriented brands. Budget-friendly alternatives to ${vendor}.`,
      "Higher End": `The designer is looking at "${name}" from ${vendor} with these characteristics: ${tagStr}. They want the SAME furniture type, SAME style, SAME silhouette BUT from PREMIUM, luxury, or high-end vendors. Think designer brands, artisan makers, top-tier quality. More premium than ${vendor}.`,
    };

    const query = queryMap[altType] || `Find alternatives to "${name}" from ${vendor}`;

    try {
      const data = await searchProducts(query, { exclude_ids: [product.id] });
      setAlternativeProducts((data.products || []).slice(0, 12));
    } catch {
      setAlternativeProducts([]);
    } finally {
      setAlternativeLoading(false);
    }
  };

  // ── HANDLERS ──
  const handleSubmit = (e) => {
    e.preventDefault();
    setShowAutocomplete(false);
    setAutocompleteResults([]);
    // Blur the input so onFocus doesn't re-open autocomplete
    if (document.activeElement) document.activeElement.blur();
    // Block list paste for free users
    if (!isPro && inputValue.includes("\n")) {
      setShowPaywall(true);
      return;
    }
    runSearch(inputValue);
  };

  const handleNewSearch = () => {
    setMessages([]);
    setSessionId(crypto.randomUUID());
    setAllResults([]);
    setZeroResultGuidance(null);
    setListMode(false);
    setListResults(null);
    setError(null);
    setInputValue("");

    setSortKey("relevance");
    setVisibleCount(INITIAL_PAGE_SIZE);
    setPreviewProduct(null);
    shownProductIds.current = new Set();
    pageRef.current = 1;
    lastQueryRef.current = "";
    setDisplayQuery("");
    window.history.replaceState({}, "", "/Search");
    inputRef.current?.focus();
  };

  const handleInputChange = (value) => {
    setInputValue(value);
    clearTimeout(autocompleteTimer.current);
    if (value.trim().length >= 2 && !loading) {
      autocompleteTimer.current = setTimeout(async () => {
        if (loading) return; // double-check — search may have started during debounce
        try {
          const data = await getAutocomplete(value.trim());
          const details = data.details || [];
          const suggestions = details.length > 0 ? details : (data.suggestions || []).map(s => ({ text: s, type: "search", count: null }));
          setAutocompleteResults(suggestions.slice(0, 8));
          setShowAutocomplete(true);
        } catch {
          setAutocompleteResults([]);
        }
      }, 300);
    } else {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
    }
  };

  const handleVisualSearch = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setVisualSearchLoading(true);
    setError(null);
    setZeroResultGuidance(null);

    try {
      // Resize image client-side to max 1024px to save bandwidth
      const resized = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1024;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            const ratio = Math.min(MAX / width, MAX / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL(file.type || "image/jpeg", 0.85));
        };
        img.src = URL.createObjectURL(file);
      });

      // Show thumbnail of uploaded image
      setVisualSearchThumb(resized);
      setDisplayQuery("[Visual Search]");
      setLoading(true);
      setAllResults([]);
      setInputValue("");

      const mimeType = file.type || "image/jpeg";
      const data = await visualSearch(resized, mimeType);

      const summaryText = data.assistant_message || data.ai_summary || "Here are matching products.";

      // Room mode — display as buckets like paste-list
      if (data.result_mode === "visual-room" && data.items?.length > 0) {
        const roomItems = data.items.map((item, i) => ({
          original_text: item.label,
          summary: `${item.total || item.products?.length || 0} matches`,
          item_number: i + 1,
          products: item.products || [],
          total: item.total || item.products?.length || 0,
        }));
        setListMode(true);
        setListResults({ overview_message: summaryText, items: roomItems });
        setBucketColors(roomItems.map((_, i) => {
          const COLORS = ["#c4a882", "#82a8c4", "#a8c482", "#c482a8", "#82c4a8", "#c4a882", "#a882c4", "#c48282"];
          return COLORS[i % COLORS.length];
        }));
        setExpandedBuckets(new Set([0]));
        setAllResults([]);
        setTotalAvailable(data.total || 0);
      } else {
        // Single piece mode
        const products = data.products || [];
        setTotalAvailable(data.total_available || data.total || products.length);
        for (const p of products) {
          if (p.id) shownProductIds.current.add(p.id);
        }
        setAllResults(products);
        setListMode(false);
        setListResults(null);
      }

      setZeroResultGuidance(data.zero_result_guidance || null);

      const assistantMsg = {
        role: "assistant",
        content: summaryText,
        resultSummary: `Visual search: ${data.result_mode === "visual-room" ? `${data.items?.length} pieces identified` : `${data.total || 0} results`}.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError("Visual search failed. Please try again.");
    } finally {
      setVisualSearchLoading(false);
      setLoading(false);
    }
  };

  const handleVoiceSearch = () => {
    if (!voiceSupported) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInputValue(transcript);
      // Auto-submit when final result
      if (event.results[event.results.length - 1].isFinal && transcript.trim()) {
        setTimeout(() => {
          setIsListening(false);
          runSearch(transcript.trim());
        }, 300);
      }
    };
    recognition.onerror = (event) => {
      console.error("[voice-search] Error:", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Check browser permissions.");
      } else if (event.error !== "aborted") {
        setError("Couldn't hear that. Try again.");
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleChipClick = (chip) => {
    if (chip === "Show me more options") {
      if (hasMoreLocal) {
        setVisibleCount(v => Math.min(v + LOAD_MORE_SIZE, sorted.length));
      } else {
        loadMoreFromServer();
      }
    } else {
      runSearch(chip);
    }
  };

  const handleAutocompleteSelect = (item) => {
    setShowAutocomplete(false);
    const text = typeof item === "string" ? item : item.text;
    runSearch(text);
  };

  const handleToggleFavorite = (product) => {
    // Require active subscription for favorites
    const subStatus = localStorage.getItem("spec_sub_status");
    if (subStatus !== "active" && subStatus !== "trialing" && subStatus !== "cancelled") {
      setPaywallMode("feature");
      setShowPaywall(true);
      return;
    }
    const { next, added } = toggleFavorite(normalizeSearchResult(product));
    setFavorites(next);
    setFavoriteToast(added ? "Saved to favorites" : "Removed from favorites");
    setTimeout(() => setFavoriteToast(null), 2000);
  };

  const handleAddToQuote = (product, e) => {
    if (!isPro) {
      setPaywallMode("feature");
      setShowPaywall(true);
      return;
    }
    const rect = e?.currentTarget?.getBoundingClientRect?.();
    if (rect) {
      setQuoteDropdownPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 220) });
    } else {
      setQuoteDropdownPos({ top: window.innerHeight / 2, left: window.innerWidth / 2 - 100 });
    }
    setQuoteDropdownProduct(product);
  };

  const handleQuoteRoomSelect = (product, roomId, roomName) => {
    const { added } = addToQuote(product, roomId);
    if (added) {
      setQuoteIds(prev => new Set([...prev, product.id]));
      setQuoteToast(`Added to ${roomName}`);
      setTimeout(() => setQuoteToast(null), 2200);
      window.dispatchEvent(new CustomEvent("spec-quote-change"));
    }
    setQuoteDropdownProduct(null);
  };

  const handleQuoteNewRoom = (product) => {
    const { room } = addQuoteRoom("New Room");
    handleQuoteRoomSelect(product, room.id, room.name);
  };

  // Changes 9-11 — Cross-bucket selection with auto-match
  const handleBucketSelect = async (bucketIdx, product) => {
    // Determine the new selections map
    const isDeselect = bucketSelections.get(bucketIdx)?.id === product.id;
    const nextSelections = new Map(bucketSelections);
    if (isDeselect) {
      nextSelections.delete(bucketIdx);
    } else {
      nextSelections.set(bucketIdx, product);
    }
    setBucketSelections(nextSelections);

    if (!listResults?.items || !originalBucketProducts.current) return;

    // Get all selected product IDs
    const selectedIds = [...nextSelections.values()].map(p => p.id).filter(Boolean);

    if (selectedIds.length === 0) {
      // No selections left — revert all buckets to original order
      setListResults(prev => {
        if (!prev?.items) return prev;
        return {
          ...prev,
          items: prev.items.map((item, idx) => ({
            ...item,
            products: (originalBucketProducts.current[idx] || item.products).map(p => ({
              ...p,
              _complementScore: undefined,
              _matchedTo: undefined,
            })),
          })),
        };
      });
      return;
    }

    // Cross-match: get cosine similarity scores from backend
    try {
      // Collect candidate IDs from all non-selected buckets
      const candidateIds = [];
      const bucketCandidateRanges = []; // track which candidates belong to which bucket
      for (let i = 0; i < listResults.items.length; i++) {
        if (nextSelections.has(i)) {
          bucketCandidateRanges.push({ idx: i, ids: [] });
          continue;
        }
        const origProducts = originalBucketProducts.current[i] || listResults.items[i].products;
        const ids = origProducts.map(p => p.id).filter(Boolean);
        bucketCandidateRanges.push({ idx: i, ids });
        candidateIds.push(...ids);
      }

      const scores = await crossMatchProducts(selectedIds, candidateIds);
      const selectedName = product.product_name || "your selection";

      setListResults(prev => {
        if (!prev?.items) return prev;
        return {
          ...prev,
          items: prev.items.map((item, idx) => {
            if (nextSelections.has(idx)) return item; // Don't re-rank selected buckets

            // Start from original order, annotate with complement scores
            const origProducts = originalBucketProducts.current[idx] || item.products;
            const products = origProducts.map(p => ({
              ...p,
              _complementScore: scores[p.id] || 0,
              _matchedTo: (scores[p.id] || 0) > 0.3 ? selectedName : undefined,
            }));

            // Re-sort: 50% original relevance + 50% complement score
            // Original order index gives the relevance rank (0 = most relevant)
            const maxIdx = products.length || 1;
            products.sort((a, b) => {
              const aOrigIdx = origProducts.findIndex(o => o.id === a.id);
              const bOrigIdx = origProducts.findIndex(o => o.id === b.id);
              const aOrigScore = 1 - (aOrigIdx >= 0 ? aOrigIdx / maxIdx : 1);
              const bOrigScore = 1 - (bOrigIdx >= 0 ? bOrigIdx / maxIdx : 1);
              const aFinal = aOrigScore * 0.5 + (a._complementScore || 0) * 0.5;
              const bFinal = bOrigScore * 0.5 + (b._complementScore || 0) * 0.5;
              return bFinal - aFinal;
            });

            return { ...item, products };
          }),
        };
      });
    } catch (err) {
      console.warn("[cross-match] Failed:", err.message);
    }
  };

  const isFavorited = (id) => favorites.some(f => f.id === id);

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────

  return (
    <motion.div
      initial={entryTransition ? { opacity: 0, scale: 0.985, y: 18 } : false}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className={`relative min-h-screen ${presentationMode ? "presentation-mode" : ""}`}
    >
      <AnimatedGradientBackground
        Breathing={!loading}
        gradientColors={moodTheme.gradient}
        gradientStops={[0, 25, 50, 80, 100]}
        breathingRange={6}
        animationSpeed={0.012}
      />

      {/* ── LANDING STATE ── */}
      {!hasConversation && !loading && (
        <div className="relative z-10 page-wrap-wide pt-12 pb-16 md:pt-20 md:pb-24">
          <div className="mx-auto max-w-6xl atelier-panel px-5 py-8 sm:px-8 md:px-12 md:py-12">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <div className="workspace-kicker mb-6">Interior search atelier</div>
                <h1 className="workspace-heading max-w-4xl">
                  The sourcing workspace that feels designed for designers.
                </h1>
                <p className="workspace-subhead mt-5">
                  Search by mood, silhouette, material, room intent, or visual reference.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.22em]" style={{ background: moodTheme.chip, color: moodTheme.accent, border: `1px solid ${moodTheme.glow}` }}>
                  Current mood
                  <span className="h-2 w-2 rounded-full" style={{ background: moodTheme.accent, boxShadow: `0 0 20px ${moodTheme.glow}` }} />
                  {moodTheme.name}
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="atelier-panel-soft px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">Catalog</div>
                    <div className="mt-2 text-2xl font-semibold text-white/92">40k+</div>
                    <div className="mt-1 text-xs text-white/40">Trade-ready products</div>
                  </div>
                  <div className="atelier-panel-soft px-4 py-4">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-white/30">Use</div>
                    <div className="mt-2 text-2xl font-semibold text-white/92">Search</div>
                    <div className="mt-1 text-xs text-white/40">Refine, save, and quote</div>
                  </div>
                </div>
              </div>

              <div className="editorial-card p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.22em] text-gold/75">Search brief</span>
                  <span className="text-[11px] text-white/28">Natural language</span>
                </div>
                <div className="mt-4 rounded-[22px] border border-white/[0.06] bg-white/[0.02] px-5 py-5">
                  <p className="text-sm leading-7 text-white/70">
                    “I need a sculptural, warm modern accent chair with a higher back and a refined silhouette for a luxury residential living room.”
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {["Warm modern", "Higher back", "Accent chair"].map((tag) => (
                    <span key={tag} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/46">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Search bar */}
            <form ref={searchFormRef} onSubmit={handleSubmit} className="mx-auto mt-8 max-w-5xl">
              <div className="relative">
                <div className="luxe-input search-bar-glow relative transition-all duration-300" style={{ animation: "glow-pulse 4s ease-in-out infinite" }}>
                  <div className="flex items-start">
                    <div className="ml-4 mt-[18px] flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] sm:ml-5 sm:mt-[18px]">
                      <img src="/logo.png" alt="" className="h-5 w-5 object-contain opacity-70" />
                    </div>
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => {
                        handleInputChange(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && !inputValue.includes("\n")) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      onFocus={() => { if (!loading && autocompleteResults.length > 0) setShowAutocomplete(true); }}
                      onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                      placeholder={isListening ? 'Listening...' : 'Describe the piece, mood, room, or sourcing constraint...'}
                      className="min-h-[64px] sm:min-h-[72px] w-full bg-transparent pl-4 sm:pl-6 pr-4 py-5 sm:py-6 text-base sm:text-[15px] text-white/84 placeholder:text-white/26 outline-none resize-none overflow-hidden"
                      rows={1}
                    />
                    <div className="flex items-center gap-1.5 pr-3 mt-4 shrink-0 sm:pr-4">
                      {inputValue && (
                        <button type="button" onClick={() => { setInputValue(""); setAutocompleteResults([]); inputRef.current?.focus(); if (inputRef.current) { inputRef.current.style.height = "auto"; } }}
                          className="flex h-10 w-10 items-center justify-center rounded-2xl text-white/24 hover:bg-white/5 hover:text-white/56 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => voiceSupported ? handleVoiceSearch() : setError("Voice search requires Chrome or Edge browser.")}
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl transition-colors ${isListening ? "text-red-400 bg-red-400/10 animate-pulse" : "text-white/20 hover:bg-white/5 hover:text-gold/70"}`}
                        title={isListening ? "Stop listening" : "Voice search"}>
                        <Mic className={isListening ? "h-4 w-4" : "h-4 w-4"} />
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="flex h-10 w-10 items-center justify-center rounded-2xl transition-colors text-white/20 hover:bg-white/5 hover:text-gold/70"
                        title="Visual search — upload a photo to find matching furniture">
                        {visualSearchLoading ? <Loader2 className="h-4 w-4 animate-spin text-gold/60" /> : <Camera className="h-4 w-4" />}
                      </button>
                      <button type="submit" disabled={!inputValue.trim() && !isListening} className="flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-semibold transition-all disabled:opacity-20 disabled:cursor-not-allowed hover:brightness-110 active:scale-95" style={{ background: "linear-gradient(135deg, #c6a16a, #e0bb85)", color: "#1c1917", boxShadow: "0 18px 40px rgba(198,161,106,0.28)" }}>
                        Find Pieces <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleVisualSearch} />
                <SmartAutocomplete show={showAutocomplete} results={autocompleteResults} onSelect={handleAutocompleteSelect} />
              </div>
            </form>

            {/* Search suggestions */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {EXAMPLE_SEARCHES.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => runSearch(suggestion)}
                  onMouseEnter={() => { clearTimeout(window._prefetchTimer); window._prefetchTimer = setTimeout(() => prefetchSearch(suggestion), 300); }}
                  onMouseLeave={() => clearTimeout(window._prefetchTimer)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[12px] text-white/38 hover:text-gold/80 hover:border-gold/25 hover:bg-gold/[0.05] transition-all duration-200"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {/* Usage counter — inline below suggestions */}
            {!isPro && searchesRemaining != null && searchesRemaining >= 0 && (
              <div className="mt-6 flex justify-center">
                <UsageCounter
                  remaining={searchesRemaining}
                  total={3}
                  onTrialClick={() => { setPaywallMode("trial_required"); setShowPaywall(true); }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RESULTS VIEW ── */}
      {(hasConversation || loading) && (
        <div className="pb-24">
          {/* Top bar */}
          <div className="sticky top-[72px] z-30 border-b border-white/[0.04] bg-[#120f0d]/92 backdrop-blur-xl">
            <div className="page-wrap-wide py-3 flex items-center gap-3">
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]">
                  <img src="/logo.png" alt="" className={`h-5 w-5 object-contain${loading ? " animate-pulse" : ""}`} />
                </div>
                  <div className="hidden sm:block">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/70">Search Results</div>
                  <div className="text-[12px] text-white/32">{presentationMode ? "Calm, client-ready review mode" : "Refine, review, and save"}</div>
                </div>
              </div>
              {/* Inline compact search input */}
              <form onSubmit={handleSubmit} className="flex-1 max-w-xl">
                <div className="luxe-input relative transition-all">
                  <div className="flex items-center">
                    <Search className="ml-4 h-3.5 w-3.5 text-white/20 shrink-0" />
                    <input
                      value={inputValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder="Search..."
                      className="h-12 w-full bg-transparent pl-3 pr-10 text-[14px] text-white/74 placeholder:text-white/22 outline-none"
                      disabled={loading}
                    />
                    {inputValue.trim() && (
                      <button type="submit" className="absolute right-1 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded text-white/30 hover:text-gold/60 transition-colors">
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </form>
              <button onClick={handleNewSearch}
                className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] text-white/30 hover:bg-white/5 hover:text-gold/60 transition-colors shrink-0">
                <RefreshCw className="h-3 w-3" /> New Search
              </button>
            </div>
            {/* Search progress bar */}
            {loading && (
              <div className="h-[2px] w-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, transparent, var(--gold), transparent)" }}
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                />
              </div>
            )}
          </div>

          <div className="page-wrap-wide">
            {/* Compact thread */}
            {messages.length > 1 && (
              <div className="pt-4 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  {messages.slice(0, -1).map((msg, i) => (
                    msg.role === "user" ? (
                      <motion.span key={msg.timestamp + "-" + i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] border cursor-default"
                        style={{ background: "rgba(200,169,126,0.06)", borderColor: "rgba(200,169,126,0.12)", color: "rgba(255,255,255,0.5)" }}>
                        {msg.content.length > 50 ? msg.content.slice(0, 50) + "…" : msg.content}
                      </motion.span>
                    ) : (
                      <motion.span key={msg.timestamp + "-" + i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1.5 text-[11px] text-white/20">
                        <img src="/logo.png" alt="" className="h-3 w-3 object-contain" />
                        {(msg.content || "").length > 60 ? msg.content.slice(0, 60) + "…" : msg.content}
                        <span className="text-white/10 mx-1">→</span>
                      </motion.span>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Loading — skeleton product cards */}
            {loading && (
              <div className="pt-4">
                <div className="paper-grain mb-5 rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-4 py-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-pulse" />
                      <span className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-pulse" />
                      <span className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-pulse" />
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-gold/58">Curating</span>
                  </div>
                  <div className="mt-2 text-[13px] text-white/46">{LOADING_STEPS[loadingStep]?.label || "Searching..."}</div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                  {Array.from({ length: IS_MOBILE ? 6 : 10 }, (_, i) => (
                    <div key={i} className="product-card overflow-hidden" style={{ contain: "layout style paint" }}>
                      <div className="relative" style={{ aspectRatio: "4/3", backgroundColor: "rgba(196,168,130,0.03)" }}>
                        <div className="absolute inset-0 animate-pulse" style={{ background: "rgba(196,168,130,0.05)" }} />
                      </div>
                      <div className="h-px bg-gradient-to-r from-transparent via-gold/15 to-transparent" />
                      <div className="p-3 sm:p-4 space-y-2">
                        <div className="h-2.5 w-16 rounded animate-pulse" style={{ backgroundColor: "rgba(196,168,130,0.08)" }} />
                        <div className="h-3 w-full rounded animate-pulse" style={{ backgroundColor: "rgba(196,168,130,0.04)" }} />
                        <div className="h-3 w-2/3 rounded animate-pulse" style={{ backgroundColor: "rgba(196,168,130,0.03)" }} />
                        <div className="h-3 w-10 rounded animate-pulse" style={{ backgroundColor: "rgba(196,168,130,0.06)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 py-4">
                <div className="paper-grain flex items-start gap-3 rounded-[24px] border border-red-400/10 bg-red-400/[0.04] px-4 py-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10"><AlertCircle className="h-3.5 w-3.5 text-red-400" /></div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.22em] text-red-300/70">Search Interrupted</div>
                    <p className="pt-1 text-sm text-red-400/80">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── RESULTS SUMMARY + SORT ── */}
            {!loading && allResults.length > 0 && (
              <ResultsSummaryBar
                query={lastQueryRef.current}
                totalCount={allResults.length}
                vendorCount={facets ? facets.vendors.length : 0}
                sortKey={sortKey}
                setSortKey={setSortKey}
                viewMode={viewMode}
                setViewMode={setViewMode}
                presentationMode={presentationMode}
                setPresentationMode={setPresentationMode}
                showSortMenu={showSortMenu}
                setShowSortMenu={setShowSortMenu}
                moodTheme={moodTheme}
              />
            )}

            {/* ── Zero-result guidance ── */}
            {!loading && zeroResultGuidance && allResults.length < 3 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/10 bg-amber-500/[0.03] px-4 py-3">
                  <AlertTriangle className="h-4 w-4 text-amber-400/60 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/60 leading-relaxed">{zeroResultGuidance.suggestion}</p>
                    {zeroResultGuidance.searched_for?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {zeroResultGuidance.searched_for.map((term, i) => (
                          <span key={i} className="rounded-full bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 text-[9px] text-amber-300/60">
                            {term}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Empty search fallback (no results, no server guidance) ── */}
            {!loading && !listMode && messages.length > 0 && allResults.length === 0 && !zeroResultGuidance && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
                <div className="paper-grain flex items-start gap-3 rounded-[24px] border border-white/[0.06] bg-white/[0.02] px-5 py-4">
                  <Search className="h-4 w-4 text-gold/50 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-gold/50">Search direction</div>
                    <p className="mt-2 text-[12px] text-white/56 leading-relaxed">Nothing strong surfaced for that brief. Try broadening the material or style language, or remove vendor-specific terms so the system can widen the sourcing field.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── List search results (grouped by item) — collapsible color buckets ── */}
            {!loading && listMode && listResults?.items?.length > 0 && (
              <motion.div key="list-results" {...(IS_MOBILE ? noAnim : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } })}>
                {listResults.items.map((item, itemIdx) => {
                  const bucketColor = bucketColors[itemIdx] || "#c4a882";
                  const isExpanded = expandedBuckets.has(itemIdx);
                  const selectedProduct = bucketSelections.get(itemIdx);
                  const maxCollapsed = 6;
                  const visibleItems = isExpanded ? item.products : item.products.slice(0, maxCollapsed);
                  const hasMore = item.products.length > maxCollapsed;

                  return (
                    <div key={itemIdx} className="mb-6 rounded-xl overflow-hidden" style={{ borderLeft: `3px solid ${bucketColor}` }}>
                      {/* Bucket header — click to toggle */}
                      <button
                        onClick={() => setExpandedBuckets(prev => {
                          const next = new Set(prev);
                          if (next.has(itemIdx)) next.delete(itemIdx);
                          else next.add(itemIdx);
                          return next;
                        })}
                        className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:brightness-110"
                        style={{ background: `${bucketColor}10` }}
                      >
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold shrink-0"
                          style={{ background: `${bucketColor}25`, color: bucketColor }}>
                          {item.item_number || itemIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <div className="text-sm font-medium text-white/80 truncate">{item.original_text}</div>
                          {item.summary && item.summary !== item.original_text && (
                            <div className="text-[11px] text-white/30 mt-0.5">{item.summary}</div>
                          )}
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {item.dimension_notes && (
                            <span className="text-[10px] text-white/20 border border-white/[0.06] rounded px-1.5 py-0.5">{item.dimension_notes}</span>
                          )}
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${bucketColor}15`, color: bucketColor }}>
                            {item.original_text?.split(/\s+/)?.[0] || "Item"} ({item.total || item.products.length} results)
                          </span>
                          {selectedProduct && (
                            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400/70">
                              <Check className="h-2.5 w-2.5" /> Selected
                            </span>
                          )}
                          {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-white/30" /> : <ChevronDown className="h-3.5 w-3.5 text-white/30" />}
                        </div>
                      </button>

                      {/* Feasibility note */}
                      {item.feasibility === "unlikely" && item.feasibility_note && (
                        <div className="mx-4 mt-2 mb-1 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400/60 mt-0.5 shrink-0" />
                          <span className="text-[11px] text-amber-300/60">{item.feasibility_note}</span>
                        </div>
                      )}

                      {/* Product cards for this bucket */}
                      <div className="px-4 py-3">
                        {visibleItems.length > 0 ? (
                          <div className={`grid gap-3 ${viewMode === "studio" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"}`}>
                            {visibleItems.map((product, pIdx) => (
                              <div key={product.id || pIdx} className="relative">
                                {/* Selection highlight */}
                                {selectedProduct?.id === product.id && (
                                  <div className="absolute inset-0 z-10 rounded-xl pointer-events-none" style={{ border: `2px solid ${bucketColor}`, boxShadow: `0 0 12px ${bucketColor}30` }} />
                                )}
                                {/* Complements badge */}
                                {product._matchedTo && (
                                  <div className="absolute top-1 left-1 right-1 z-10 rounded-lg bg-emerald-500/15 border border-emerald-500/25 px-2 py-1 text-[9px] text-emerald-300/90 leading-tight">
                                    Matched to {product._matchedTo}
                                  </div>
                                )}
                                <ProductCard
                                  item={product}
                                  index={pIdx}
                                  viewMode={viewMode}
                                  presentationMode={presentationMode}
                                  isFavorited={isFavorited(product.id)}
                                  isInQuote={quoteIds.has(product.id)}
                                  onToggleFavorite={() => handleToggleFavorite(product)}
                                  onAddToQuote={(e) => handleAddToQuote(product, e)}
                                  onPreview={() => openPreview(product)}
                                />
                                {/* Select button */}
                                <button
                                  onClick={() => handleBucketSelect(itemIdx, product)}
                                  className={`w-full mt-1 flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all ${
                                    selectedProduct?.id === product.id
                                      ? "text-white"
                                      : "border border-white/[0.08] text-white/40 hover:border-white/20 hover:text-white/60"
                                  }`}
                                  style={selectedProduct?.id === product.id ? { background: bucketColor, borderColor: bucketColor } : {}}
                                >
                                  {selectedProduct?.id === product.id ? <><Check className="h-2.5 w-2.5" /> Selected</> : "Select"}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-4 text-center">
                            <span className="text-[11px] text-white/20">No matching products in our catalog yet</span>
                          </div>
                        )}

                        {/* Expand/collapse toggle */}
                        {hasMore && !isExpanded && (
                          <button
                            onClick={() => setExpandedBuckets(prev => new Set([...prev, itemIdx]))}
                            className="mt-2 w-full flex items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] text-white/30 hover:text-white/50 hover:border-white/10 transition-colors"
                          >
                            Show all {item.products.length} results <ChevronDown className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Bucket selection summary + Add Room buttons (Changes 9-11) */}
                {bucketSelections.size > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 mb-4 rounded-xl border border-gold/15 bg-gold/[0.03] p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gold/50 mb-3">Room Selections</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {listResults.items.map((item, idx) => {
                        const sel = bucketSelections.get(idx);
                        const color = bucketColors[idx] || "#c4a882";
                        return (
                          <div key={idx} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]"
                            style={{ background: sel ? `${color}15` : "rgba(255,255,255,0.02)", border: `1px solid ${sel ? color + "40" : "rgba(255,255,255,0.06)"}` }}>
                            <span style={{ color: sel ? color : "rgba(255,255,255,0.3)" }}>
                              {item.original_text?.split(/\s/).slice(0, 2).join(" ") || `Item ${idx + 1}`}:
                            </span>
                            {sel ? (
                              <span className="text-white/60 truncate max-w-[120px]">
                                {sel.product_name} {sel.retail_price ? `$${Number(sel.retail_price).toLocaleString()}` : ""}
                                <Check className="inline h-2.5 w-2.5 ml-1 text-green-400/70" />
                              </span>
                            ) : (
                              <span className="text-white/20 italic">not yet selected</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Running total */}
                    {(() => {
                      const total = [...bucketSelections.values()].reduce((sum, p) => sum + (Number(p.retail_price) || 0), 0);
                      return total > 0 ? (
                        <div className="text-sm text-gold/70 font-semibold mb-3">
                          Running total: ${total.toLocaleString()}
                        </div>
                      ) : null;
                    })()}

                    <div className="flex gap-2">
                      {/* Partial — at least one selection */}
                      <button
                        onClick={() => {
                          const { room } = addQuoteRoom("Room from Search");
                          for (const [, product] of bucketSelections) {
                            addToQuote(product, room.id);
                            setQuoteIds(prev => new Set([...prev, product.id]));
                          }
                          setQuoteToast(`Added ${bucketSelections.size} item(s) to ${room.name}`);
                          setTimeout(() => setQuoteToast(null), 2200);
                          window.dispatchEvent(new CustomEvent("spec-quote-change"));
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-gold/25 bg-gold/10 px-4 py-2 text-[11px] font-semibold text-gold/80 hover:bg-gold/15 transition-all"
                      >
                        <FileText className="h-3 w-3" />
                        Add Room to Quote ({bucketSelections.size}/{listResults.items.length})
                      </button>

                      {/* Complete — all buckets have selections */}
                      {bucketSelections.size === listResults.items.length && (
                        <button
                          onClick={() => {
                            const { room } = addQuoteRoom("Complete Room");
                            for (const [, product] of bucketSelections) {
                              addToQuote(product, room.id);
                              setQuoteIds(prev => new Set([...prev, product.id]));
                            }
                            setQuoteToast(`Added complete room (${bucketSelections.size} items) to quote`);
                            setTimeout(() => setQuoteToast(null), 2200);
                            window.dispatchEvent(new CustomEvent("spec-quote-change"));
                          }}
                          className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-[11px] font-semibold text-black hover:bg-gold/90 transition-all"
                        >
                          <ClipboardCheck className="h-3 w-3" />
                          Add Complete Room to Quote
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* List summary */}
                <div className="mt-4 mb-8 rounded-xl border border-gold/10 bg-gold/[0.02] p-4">
                  <div className="flex items-center gap-2 text-xs text-gold/50">
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span className="font-semibold">
                      {listResults.total_items} items sourced — {listResults.total_products} total products found
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Product grid (single search mode) ── */}
            {!loading && !listMode && visibleProducts.length > 0 && (
              <motion.div key={messages.length} {...(IS_MOBILE ? noAnim : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3 } })}>
                {/* Search query header */}
                {displayQuery && (
                  <div className="mb-5 flex items-center justify-between gap-3 rounded-[26px] border border-white/[0.06] bg-white/[0.02] px-4 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {visualSearchThumb && (
                        <div className="relative shrink-0">
                          <img src={visualSearchThumb} alt="Visual search" className="h-10 w-10 rounded-lg object-cover border border-white/10" />
                          <button onClick={() => { setVisualSearchThumb(null); setDisplayQuery(""); setAllResults([]); }}
                            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-stone-800 border border-white/20 flex items-center justify-center hover:bg-red-900/60 transition-colors">
                            <X className="h-2.5 w-2.5 text-white/60" />
                          </button>
                        </div>
                      )}
                      <h2 className="text-base sm:text-xl font-medium text-white/88 truncate">
                        {visualSearchThumb ? "Visual Search Results" : displayQuery}
                      </h2>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-xs text-white/34 ml-3 whitespace-nowrap">
                        {totalAvailable > sorted.length ? `${sorted.length} of ${totalAvailable.toLocaleString()}` : sorted.length.toLocaleString()} results
                      </span>
                      {viewMode === "studio" && (
                        <span className="block mt-1 text-[10px] uppercase tracking-[0.18em] text-white/20">
                          Editorial layout
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className={`grid ${viewMode === "studio" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3"}`}>
                  {visibleProducts.map((item, idx) => (
                    <motion.div
                      key={item.id || idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: Math.min(idx * 0.01, 0.08) }}
                      className={viewMode === "studio" ? getStudioSpanClass(idx) : ""}
                    >
                      <ProductCard
                        item={item}
                        index={idx}
                        viewMode={viewMode}
                        presentationMode={presentationMode}
                        isFavorited={isFavorited(item.id)}
                        isInQuote={quoteIds.has(item.id)}
                        onToggleFavorite={() => handleToggleFavorite(item)}
                        onAddToQuote={(e) => handleAddToQuote(item, e)}
                        onPreview={() => openPreview(item)}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Infinite scroll sentinel */}
                <div ref={scrollSentinelRef} className="h-1" />

                {/* Loading more indicator */}
                {loadingMore && (
                  <div className="flex justify-center py-8">
                    <div className="flex items-center gap-3">
                      <div className="h-1 w-1 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="h-1 w-1 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="h-1 w-1 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      <span className="text-[10px] text-white/20 ml-1">Loading more...</span>
                    </div>
                  </div>
                )}

                {/* End of results */}
                {!hasMoreLocal && !hasMoreServer && sorted.length > INITIAL_PAGE_SIZE && (
                  <div className="text-center py-8">
                    <span className="text-[10px] text-white/15">Showing all {sorted.length} results</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Refinement chips */}
            {hasConversation && !loading && allResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex gap-2 pt-6 pb-4 overflow-x-auto sm:flex-wrap scrollbar-hide">
                {REFINEMENT_CHIPS.map((chip) => (
                  <button key={chip} onClick={() => handleChipClick(chip)}
                    className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 text-[11px] text-white/30 transition-all hover:border-gold/20 hover:text-gold/60 hover:bg-gold/5">
                    {chip}
                  </button>
                ))}
              </motion.div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Sticky input bar */}
          <div className="fixed bottom-14 md:bottom-0 inset-x-0 z-40 border-t border-white/[0.04] bg-[#120f0d]/94 backdrop-blur-xl"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={() => { if (!isPro && hasConversation) setShowPaywall(true); }}>
            <div className="page-wrap-wide py-3">
              <form onSubmit={handleSubmit} className="relative">
                <div className="luxe-input relative transition-all">
                  <div className="flex items-center">
                    <div className="ml-3.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03]"><img src="/logo.png" alt="" className="h-4 w-4 object-contain" /></div>
                    <input ref={inputRef} value={inputValue} onChange={(e) => handleInputChange(e.target.value)}
                      onFocus={() => { if (!loading && autocompleteResults.length > 0) setShowAutocomplete(true); }}
                      onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                      placeholder="Refine your search or ask me anything..."
                      className="h-14 w-full bg-transparent pl-3 pr-28 text-base sm:text-sm text-white/82 placeholder:text-white/20 outline-none"
                      disabled={loading || (!isPro && hasConversation)} />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button type="button" onClick={() => voiceSupported ? handleVoiceSearch() : setError("Voice search requires Chrome or Edge browser.")}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${isListening ? "text-red-400 bg-red-400/10 animate-pulse" : "text-white/20 hover:bg-white/5 hover:text-gold/70"}`}
                        title={isListening ? "Stop listening" : "Voice search"}>
                        <Mic className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors text-white/20 hover:bg-white/5 hover:text-gold/70"
                        title="Visual search">
                        {visualSearchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gold/60" /> : <Camera className="h-3.5 w-3.5" />}
                      </button>
                      <button type="submit" disabled={loading || !inputValue.trim()}
                        className="flex h-9 items-center justify-center gap-1 rounded-xl px-3.5 text-xs font-semibold transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                        style={{ background: "linear-gradient(135deg, #c6a16a, #e0bb85)", color: "#1c1917" }}>
                        <Send className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleVisualSearch} />
                <SmartAutocomplete show={showAutocomplete} results={autocompleteResults} onSelect={handleAutocompleteSelect} position="above" />
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── PRODUCT PREVIEW PANEL ── */}
      <AnimatePresence>
        {previewProduct && (
          <ProductPreviewPanel
            product={previewProduct}
            onClose={() => setPreviewProduct(null)}
            onFindSimilar={handlePreviewFindSimilar}
            similarProducts={similarProducts}
            similarLoading={similarLoading}
            onToggleFavorite={handleToggleFavorite}
            onAddToQuote={handleAddToQuote}
            isFavorited={isFavorited(previewProduct.id)}
            onOpenPreview={openPreview}
            onFindAlternative={handleFindAlternative}
            alternativeProducts={alternativeProducts}
            alternativeLoading={alternativeLoading}
            alternativeLabel={alternativeLabel}
            presentationMode={presentationMode}
          />
        )}
      </AnimatePresence>

      {/* Quote Room Dropdown */}
      <AnimatePresence>
        {quoteDropdownProduct && (
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setQuoteDropdownProduct(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-[71] w-52 rounded-xl border border-white/[0.1] bg-[#2a251f] shadow-2xl overflow-hidden"
              style={{ top: quoteDropdownPos.top, left: quoteDropdownPos.left }}
            >
              <div className="px-3 py-2 border-b border-white/[0.06]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Add to room</span>
              </div>
              {getQuote().rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleQuoteRoomSelect(quoteDropdownProduct, room.id, room.name)}
                  className="flex w-full items-center justify-between px-3 py-2 text-[12px] text-white/60 hover:bg-white/[0.05] hover:text-white/80 transition-colors"
                >
                  <span className="truncate">{room.name}</span>
                  <span className="text-[10px] text-white/20 tabular-nums ml-2 shrink-0">{room.items.length} items</span>
                </button>
              ))}
              <button
                onClick={() => handleQuoteNewRoom(quoteDropdownProduct)}
                className="flex w-full items-center gap-1.5 px-3 py-2 text-[12px] text-gold/70 hover:bg-gold/5 border-t border-white/[0.06] transition-colors"
              >
                <Plus className="h-3 w-3" /> New Room
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Quote Toast */}
      <AnimatePresence>
        {quoteToast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl"
            style={{
              background: "rgba(12, 13, 20, 0.95)",
              border: "1px solid rgba(196,168,130,0.25)",
              backdropFilter: "blur(20px)",
            }}
          >
            <ClipboardCheck className="h-4 w-4 text-gold" />
            <span className="text-sm text-white/80 max-w-[300px] truncate">{quoteToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Favorite Toast */}
      <AnimatePresence>
        {favoriteToast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-2xl"
            style={{
              background: "rgba(12, 13, 20, 0.95)",
              border: "1px solid rgba(196,168,130,0.25)",
              backdropFilter: "blur(20px)",
            }}
          >
            <Heart className="h-4 w-4 text-gold" />
            <span className="text-sm text-white/80">{favoriteToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <PaywallModal
        show={showPaywall}
        mode={paywallMode}
        onClose={() => setShowPaywall(false)}
        onAuthSuccess={(user) => {
          setShowPaywall(false);
          setSubscriptionStatus("active");
          setSearchesRemaining(null);
          setIsFreeFallback(false);
          window.location.reload();
        }}
      />


      {/* Activating banner — shown while waiting for Stripe webhook */}
      {subscriptionStatus === "activating" && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-2 text-xs font-medium"
          style={{ background: "rgba(196,168,130,0.15)", color: "#c4a882", borderBottom: "1px solid rgba(196,168,130,0.2)" }}
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Your subscription is activating — refreshing momentarily...
        </div>
      )}

    </motion.div>
  );
}


// ─── CLIENT FILTER BAR ──────────────────────────────────────
function ResultsSummaryBar({ query, totalCount, vendorCount, sortKey, setSortKey, viewMode, setViewMode, presentationMode, setPresentationMode, showSortMenu, setShowSortMenu, moodTheme }) {
  return (
    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="sticky top-[145px] z-20 mb-5">
      <div className="atelier-panel-soft flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[12px]" style={{ color: "#a89880" }}>
            <span style={{ color: moodTheme.accent }}>"{query}"</span>
            {" "}&mdash; {totalCount} curated result{totalCount !== 1 ? "s" : ""}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/24">
            {vendorCount} brands shown
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PricingToggle />
          <button
            onClick={() => setPresentationMode(!presentationMode)}
            className={`control-chip hidden md:flex items-center gap-2 px-3 py-1.5 text-[11px] transition-all ${presentationMode ? "text-[#161413]" : "text-white/44 hover:text-white/72"}`}
            style={presentationMode ? { background: moodTheme.accent } : {}}
            title={presentationMode ? "Turn off presentation mode" : "Turn on presentation mode"}
          >
            <Eye className="h-3 w-3" />
            {presentationMode ? "Presentation" : "Workspace"}
          </button>
          <div className="control-chip hidden sm:flex items-center gap-1 p-1">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.key}
                onClick={() => setViewMode(mode.key)}
                className={`rounded-full px-3 py-1.5 text-[11px] transition-all ${viewMode === mode.key ? "text-black" : "text-white/40 hover:text-white/70"}`}
                style={viewMode === mode.key ? { background: moodTheme.accent } : {}}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button onClick={() => setShowSortMenu(!showSortMenu)}
              className="control-chip flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white/40 hover:text-white/60 transition-all">
              <ArrowUpDown className="h-3 w-3" />
              {SORT_OPTIONS.find(s => s.key === sortKey)?.label}
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1.5 right-0 z-50 w-40 rounded-xl border border-white/[0.08] bg-[#2a251f] shadow-2xl p-1.5">
                  {SORT_OPTIONS.map((opt) => (
                    <button key={opt.key}
                      onClick={() => { setSortKey(opt.key); setShowSortMenu(false); }}
                      className={`w-full text-left rounded-lg px-3 py-1.5 text-[11px] transition-all ${
                        sortKey === opt.key ? "bg-gold/10 text-gold" : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {showSortMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
      )}
    </motion.div>
  );
}


// ─── PRICING TOGGLE ────────────────────────────────────────
function PricingToggle() {
  const { showPricing, toggleShowPricing } = useTradePricing();
  return (
    <button
      onClick={toggleShowPricing}
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] border transition-all ${
        showPricing
          ? "border-gold/25 bg-gold/10 text-gold/80"
          : "border-white/[0.06] bg-white/[0.02] text-white/30 hover:text-white/50"
      }`}
      title={showPricing ? "Hide pricing" : "Show pricing"}
    >
      <span className="text-[11px] font-semibold">$</span>
      <span className="hidden sm:inline">{showPricing ? "Pricing on" : "Pricing off"}</span>
    </button>
  );
}

// ─── PRODUCT CARD ──────────────────────────────────────────
const ProductCard = React.memo(function ProductCard({ item, index, viewMode = "gallery", presentationMode = false, isFavorited, isInQuote, onToggleFavorite, onAddToQuote, onPreview }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { getPrice, fmtPrice } = useTradePricing();

  const priceInfo = getPrice(item);
  const priceStr = priceInfo.price ? fmtPrice(priceInfo.price) : null;
  const materialStyle = [item.material, item.style].filter(Boolean).join(" · ");
  const detailChips = [item.ai_style || item.style, item.ai_primary_material || item.material, item.ai_mood].filter(Boolean).slice(0, viewMode === "studio" ? 3 : 1);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`product-card group cursor-pointer flex flex-col ${viewMode === "studio" ? "min-h-[440px]" : ""} ${presentationMode ? "paper-grain" : ""}`}
      style={{ contain: "layout style paint", height: "100%" }}
      onClick={(e) => {
        // Don't open preview if clicking action buttons
        if (e.target.closest("[data-action]")) return;
        onPreview();
      }}
    >
      {/* Image — landscape for studio shots, tall for lifestyle */}
      <div className="relative overflow-hidden rounded-t-[24px]" style={{ aspectRatio: "4/3", background: "#ffffff" }}>
        {item.image_url && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#ffffff" }}>
                <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 25%, rgba(196,168,130,0.06) 50%, transparent 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.2s ease-in-out infinite" }} />
              </div>
            )}
            <ProxyImg src={item.image_url} productId={item.id} alt={item.product_name}
              className={`h-full w-full transition-all duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"} group-hover:scale-[1.03]`}
              style={{ objectFit: "contain", padding: "18px" }}
              eager={index < 5}
              fetchPriority={index < 5 ? "high" : undefined}
              onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/10">
            <div className="text-3xl font-display">{(item.manufacturer_name || "?")[0]}</div>
            <span className="text-[10px] px-3 text-center line-clamp-2 text-white/15">{item.product_name}</span>
          </div>
        )}

        {/* Overlay buttons — always visible on mobile, hover-reveal on desktop */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <button data-action onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className={`flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-lg transition-all backdrop-blur-sm ${
              isFavorited ? "bg-gold/90 text-black" : "bg-black/50 text-white/60 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-black/60"
            }`}>
            <Heart className={`h-4 w-4 sm:h-3 sm:w-3 ${isFavorited ? "fill-current" : ""}`} />
          </button>
          <button data-action onClick={(ev) => {
              ev.stopPropagation();
              if (!isInQuote && !justAdded) {
                onAddToQuote(ev);
                setJustAdded(true);
                setTimeout(() => setJustAdded(false), 2000);
              }
            }}
            className={`flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-lg transition-all backdrop-blur-sm ${
              isInQuote || justAdded ? "bg-gold/90 text-black" : "bg-black/50 text-white/60 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-black/60"
            }`}
            title={isInQuote ? "In quote" : "Add to quote"}>
            {isInQuote || justAdded ? <ClipboardCheck className="h-4 w-4 sm:h-3 sm:w-3" /> : <FileText className="h-4 w-4 sm:h-3 sm:w-3" />}
          </button>
        </div>
      </div>

      {/* Gold hairline */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" />

      {/* Card meta */}
      <div className={`card-meta ${viewMode === "studio" ? "p-5 sm:p-6 pb-5" : "p-4 sm:p-5 pb-4"} flex-1 flex flex-col`}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold/72 truncate">{item.manufacturer_name}</div>
          {item.result_quality && (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-white/34">
              {item.result_quality === "verified" ? "Verified" : item.result_quality === "ai-discovered" ? "AI" : "Catalog"}
            </span>
          )}
        </div>
        <h3 className={`product-name text-white/94 line-clamp-2 mb-2 ${presentationMode && viewMode === "studio" ? "text-[18px] sm:text-[20px]" : "text-[15px] sm:text-[17px]"} min-h-[2.6em]`}>{item.product_name}</h3>
        <div className="text-[12px] text-white/30 truncate mb-3 min-h-[1.2em]">{materialStyle || "\u00A0"}</div>
        {detailChips.length > 0 && !presentationMode && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {detailChips.map((chip) => (
              <span key={chip} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-white/40">
                {chip}
              </span>
            ))}
          </div>
        )}
        {viewMode === "studio" && (
          <p className="mb-4 line-clamp-3 text-[12px] leading-6 text-white/42">
            {item.reasoning || item.description || item.snippet || "Curated trade result selected for style, silhouette, and sourcing fit."}
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2">
          {priceStr && (
            <span className={`text-[14px] font-semibold ${priceInfo.isTrade ? "text-emerald-400/80" : "text-gold/90"}`}>
              {priceInfo.isTrade && <span className="text-[9px] uppercase tracking-wider mr-1 opacity-70">{priceInfo.label}</span>}
              {priceStr}
            </span>
          )}
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/22">Preview</span>
        </div>
      </div>

      {/* Hover actions */}
      <div className="card-link px-4 pb-4 flex items-center justify-end">
        {item.portal_url && (
          <a href={item.portal_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} data-action
            className="text-[10px] font-medium text-gold/60 flex items-center gap-1 hover:text-gold/80 transition-colors">
            View <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
});


// ─── PRODUCT PREVIEW PANEL ──────────────────────────────────
function ProductPreviewPanel({ product, onClose, onFindSimilar, similarProducts, similarLoading, onToggleFavorite, onAddToQuote, isFavorited, onOpenPreview, onFindAlternative, alternativeProducts, alternativeLoading, alternativeLabel, presentationMode = false }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    const url = `${window.location.origin}/Search?product=${encodeURIComponent(product.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.product_name || product.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const { getPrice, fmtPrice } = useTradePricing();

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Reset img loaded and active index when product changes
  useEffect(() => { setImgLoaded(false); setActiveImageIdx(0); }, [product.id]);

  const productImages = (() => {
    // Normalize: images may be strings or {url, type} objects
    const raw = (product.images && product.images.length > 0) ? product.images : [];
    const urls = raw.map(img => typeof img === "string" ? img : (img && img.url ? img.url : "")).filter(Boolean);
    // Aggressive dedup: normalize URLs to catch dupes that differ by query params,
    // underscores vs hyphens, or size suffixes
    const normUrl = (u) => {
      try {
        const p = new URL(u);
        return (p.hostname + p.pathname).toLowerCase()
          .replace(/[_-]\d{2,4}x\d{2,4}/g, "")
          .replace(/[_-](small|medium|large|thumb|xlarge|xxlarge|original|full|master|grande|compact|pico|icon)/gi, "")
          .replace(/[_-]/g, "");
      } catch { return u.toLowerCase().replace(/[_-]/g, ""); }
    };
    const heroUrl = product.image_url || "";
    const seen = new Set();
    if (heroUrl) seen.add(normUrl(heroUrl));
    const unique = [];
    for (const url of urls) {
      const n = normUrl(url);
      if (!seen.has(n)) {
        seen.add(n);
        unique.push(url);
      }
    }
    // Always lead with hero if we have one
    if (heroUrl) return [heroUrl, ...unique];
    if (unique.length > 0) return unique;
    return product.image_url ? [product.image_url] : [];
  })();

  const priceInfo = getPrice(product);
  const tags = (product.ai_visual_tags || "").split(",").map(t => t.trim()).filter(Boolean);
  const dims = [];
  if (product.width) dims.push(`${product.width}" W`);
  if (product.depth) dims.push(`${product.depth}" D`);
  if (product.height) dims.push(`${product.height}" H`);
  const dimStr = dims.join(" × ") || product.dimensions || null;
  const previewTheme = getSearchMoodTheme(product.product_name || "", [product], false);
  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/70 sm:bg-black/60 sm:backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel — right-sliding */}
      <motion.div
        initial={IS_MOBILE ? { opacity: 0, y: 10 } : { opacity: 0, x: 56, scale: 0.985 }}
        animate={IS_MOBILE ? { opacity: 1, y: 0 } : { opacity: 1, x: 0, scale: 1 }}
        exit={IS_MOBILE ? { opacity: 0, y: 10 } : { opacity: 0, x: 36, scale: 0.99 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 right-0 bottom-0 z-[61] w-full ${presentationMode ? "md:w-[680px]" : "md:w-[600px]"} overflow-y-auto md:rounded-l-[32px] border-l border-white/[0.08] bg-[#14110f] md:bg-[rgba(20,17,15,0.98)] md:backdrop-blur-xl shadow-2xl overscroll-contain`}
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Close X button */}
        <div className="sticky top-0 z-10 flex justify-end pt-3 pr-3 pb-2 bg-[#14110f] md:bg-[rgba(20,17,15,0.98)] md:backdrop-blur-xl"
          style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}>
          <button onClick={onClose} className="flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors">
            <X className="h-5 w-5 sm:h-4 sm:w-4" />
          </button>
        </div>

        <div className="px-4 pb-8">
          <div className="flex flex-col gap-6">
            {/* Image gallery */}
            <div className="flex flex-col gap-2">
              <div className={`relative aspect-[4/3] rounded-[24px] overflow-hidden border border-white/[0.04] ${presentationMode ? "paper-grain" : ""}`} style={{ background: "#ffffff" }}>
                {productImages.length > 0 ? (
                  <>
                    {!imgLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#ffffff" }}><div className="loading-emblem" style={{ width: 16, height: 16 }} /></div>
                    )}
                    <ProxyImg src={productImages[activeImageIdx]} productId={product.id} alt={product.product_name}
                      className={`h-full w-full transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                      style={{ objectFit: "contain", padding: "16px" }}
                      onLoad={() => setImgLoaded(true)} />
                    {productImages.length > 1 && (
                      <>
                        <button
                          onClick={() => { setImgLoaded(false); setActiveImageIdx((activeImageIdx - 1 + productImages.length) % productImages.length); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() => { setImgLoaded(false); setActiveImageIdx((activeImageIdx + 1) % productImages.length); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 transition-all"
                        >
                          ›
                        </button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-2.5 py-1">
                          <span className="text-[10px] text-white/60 font-medium">{activeImageIdx + 1} / {productImages.length}</span>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white/10 font-display text-5xl">
                    {(product.manufacturer_name || "?")[0]}
                  </div>
                )}
              </div>
              {productImages.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {productImages.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => { if (i !== activeImageIdx) { setImgLoaded(false); setActiveImageIdx(i); } }}
                      className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border transition-all ${
                        i === activeImageIdx ? "border-gold/40 ring-1 ring-gold/20" : "border-white/[0.06] hover:border-white/15 opacity-60 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: "#ffffff" }}
                    >
                      <ProxyImg src={src} productId={product.id} style={{ objectFit: "contain", padding: "4px" }} className="h-full w-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-col gap-4">
              {/* Vendor */}
              <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold/70">
                {product.manufacturer_name}
              </div>

              {/* Product name */}
              <h2 className={`font-display ${presentationMode ? "text-[38px]" : "text-[32px]"} text-white/92 leading-tight`}>
                {product.product_name}
              </h2>

              <div className={`rounded-[24px] border px-4 py-4 ${presentationMode ? "paper-grain" : ""}`} style={{ borderColor: previewTheme.glow, background: `linear-gradient(135deg, ${previewTheme.chip}, rgba(255,255,255,0.02))` }}>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: previewTheme.accent }}>
                  Why it stands out
                </div>
                <p className="mt-2 text-[13px] leading-6 text-white/62">
                  {product.reasoning || product.ai_visual_analysis || product.description || "A strong editorial fit with clear sourcing potential, balanced proportions, and a tone that feels intentional in high-end residential work."}
                </p>
              </div>

              {/* Price */}
              {priceInfo.price && (
                <div className={`text-lg font-semibold ${priceInfo.isTrade ? "text-emerald-400/80" : "text-gold/80"}`}>
                  {priceInfo.isTrade && <span className="text-[10px] uppercase tracking-wider mr-1.5 opacity-70">{priceInfo.label}</span>}
                  {fmtPrice(priceInfo.price)}
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                {dimStr && (
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-0.5">Dimensions</div>
                    <div className="text-[12px] text-white/60">{dimStr}</div>
                  </div>
                )}
                {product.material && (
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-0.5">Material</div>
                    <div className="text-[12px] text-white/60">{product.material}</div>
                  </div>
                )}
                {product.style && (
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-0.5">Style</div>
                    <div className="text-[12px] text-white/60">{product.style}</div>
                  </div>
                )}
                {product.collection && (
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-0.5">Collection</div>
                    <div className="text-[12px] text-white/60">{product.collection}</div>
                  </div>
                )}
                {product.color && (
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-0.5">Color</div>
                    <div className="text-[12px] text-white/60">{product.color}</div>
                  </div>
                )}
                {product.sku && (
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-0.5">SKU</div>
                    <div className="text-[12px] text-white/60 font-mono">{product.sku}</div>
                  </div>
                )}
              </div>

              {/* Description */}
              {(product.description || product.snippet) && (
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-1">Description</div>
                  <p className="text-[12px] text-white/50 leading-relaxed">{(product.description || product.snippet).slice(0, 500)}</p>
                </div>
              )}

              {/* AI Intelligence Tags */}
              {(() => {
                const aiTags = [];
                if (product.ai_style) aiTags.push({ label: "Style", value: product.ai_style });
                if (product.ai_formality) aiTags.push({ label: "Formality", value: product.ai_formality });
                if (product.ai_mood) aiTags.push({ label: "Mood", value: product.ai_mood });
                if (product.ai_primary_material) aiTags.push({ label: "Material", value: product.ai_primary_material });
                if (product.ai_furniture_type) aiTags.push({ label: "Type", value: product.ai_furniture_type });
                if (product.ai_silhouette) aiTags.push({ label: "Silhouette", value: product.ai_silhouette });
                return aiTags.length > 0 ? (
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-2">AI Intelligence</div>
                    <div className="flex flex-wrap gap-1.5">
                      {aiTags.map(({ label, value }) => (
                        <span key={label} className="rounded-full bg-gold/[0.04] border border-gold/[0.08] px-2.5 py-0.5 text-[10px] text-gold/50">
                          <span className="text-gold/30 mr-1">{label}:</span>{value}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Visual tags */}
              {tags.length > 0 && (
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-white/25 mb-2">Visual Tags</div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[10px] text-white/40">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-2">
                <button onClick={() => onFindSimilar(product)} disabled={similarLoading}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3 text-[11px] font-semibold text-gold/80 hover:bg-gold/10 transition-all disabled:opacity-40 w-full sm:w-auto">
                  {similarLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
                  Find Similar
                </button>
                <button onClick={(ev) => onAddToQuote(product, ev)}
                  className="flex items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-[11px] font-semibold transition-all border-white/[0.08] text-white/40 hover:text-gold hover:border-gold/30 hover:bg-gold/10 w-full sm:w-auto">
                  <FileText className="h-3 w-3" />
                  Add to Quote
                </button>
                <button onClick={() => onToggleFavorite(product)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-[11px] font-semibold transition-all w-full sm:w-auto ${
                    isFavorited ? "border-gold/30 bg-gold/10 text-gold" : "border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/15"
                  }`}>
                  <Heart className={`h-3 w-3 ${isFavorited ? "fill-current" : ""}`} />
                  {isFavorited ? "Saved" : "Save"}
                </button>
                {product.portal_url && (
                  <a href={product.portal_url} target="_blank" rel="noopener"
                    className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] px-4 py-3 text-[11px] font-semibold text-white/40 hover:text-white/60 hover:border-white/15 transition-all">
                    <ExternalLink className="h-3 w-3" /> View at {(product.manufacturer_name || "vendor").split(" ")[0]}
                  </a>
                )}
                <button onClick={handleShare}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border px-4 py-3 text-[11px] font-semibold transition-all w-full sm:w-auto ${
                    shareCopied ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/15"
                  }`}>
                  {shareCopied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
                  {shareCopied ? "Link Copied" : "Share"}
                </button>
              </div>
              {/* Find Alternatives */}
              <div className="pt-3">
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/25 mb-2.5">Find Alternatives</div>
                <div className="flex flex-wrap gap-1.5">
                  {["Different Material", "Different Color", "Different Size", "Less Formal", "More Formal", "Lower Price", "Higher End"].map((alt) => (
                    <button
                      key={alt}
                      onClick={() => onFindAlternative(product, alt)}
                      disabled={alternativeLoading}
                      className={`flex items-center gap-1 rounded-[999px] border px-3 py-1.5 text-[10px] font-medium transition-all disabled:opacity-30 ${
                        alternativeLabel === alt && alternativeProducts.length > 0
                          ? "border-gold/30 bg-gold/10 text-gold/90"
                          : "border-white/[0.06] text-white/40 hover:text-gold/70 hover:border-gold/20 hover:bg-gold/[0.04]"
                      }`}
                    >
                      {alternativeLoading && alternativeLabel === alt ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      ) : (
                        <Shuffle className="h-2.5 w-2.5" />
                      )}
                      {alt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Alternative products row */}
          {alternativeProducts.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/[0.08]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/50">
                  {alternativeLabel}
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/[0.08]" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {alternativeProducts.map((ap) => (
                  <button key={ap.id} onClick={() => onOpenPreview(ap)} className="text-left group">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden border border-white/[0.04] group-hover:border-gold/15 transition-colors mb-1.5" style={{ backgroundColor: "#ffffff" }}>
                      {ap.image_url ? (
                        <ProxyImg src={ap.image_url} productId={ap.id} className="h-full w-full" style={{ objectFit: "contain", padding: "6px" }} />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-white/10 font-display text-lg">
                          {(ap.manufacturer_name || "?")[0]}
                        </div>
                      )}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-gold/50 truncate">{ap.manufacturer_name}</div>
                    <div className="text-[11px] text-white/50 truncate group-hover:text-white/70 transition-colors">{ap.product_name}</div>
                    {(() => {
                      const apPrice = getPrice(ap);
                      return apPrice.price ? (
                        <div className={`text-[10px] ${apPrice.isTrade ? "text-emerald-400/60" : "text-gold/60"}`}>
                          {apPrice.isTrade ? `${apPrice.label} ` : ""}{fmtPrice(apPrice.price)}
                        </div>
                      ) : null;
                    })()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Similar products row */}
          {similarProducts.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.04]" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold/50">
                  Similar from different vendors
                </span>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.04]" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {similarProducts.map((sp) => (
                  <button key={sp.id} onClick={() => onOpenPreview(sp)} className="text-left group">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden border border-white/[0.04] group-hover:border-gold/15 transition-colors mb-1.5" style={{ backgroundColor: "#ffffff" }}>
                      {sp.image_url ? (
                        <ProxyImg src={sp.image_url} productId={sp.id} className="h-full w-full" style={{ objectFit: "contain", padding: "6px" }} />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-white/10 font-display text-lg">
                          {(sp.manufacturer_name || "?")[0]}
                        </div>
                      )}
                    </div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-gold/50 truncate">{sp.manufacturer_name}</div>
                    <div className="text-[11px] text-white/50 truncate group-hover:text-white/70 transition-colors">{sp.product_name}</div>
                    {(() => {
                      const spPrice = getPrice(sp);
                      return spPrice.price ? (
                        <div className={`text-[10px] ${spPrice.isTrade ? "text-emerald-400/60" : "text-gold/60"}`}>
                          {spPrice.isTrade ? `${spPrice.label} ` : ""}{fmtPrice(spPrice.price)}
                        </div>
                      ) : null;
                    })()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}


// ─── SMART AUTOCOMPLETE ──────────────────────────────────────
function SmartAutocomplete({ show, results, onSelect, position = "below" }) {
  return (
    <AnimatePresence>
      {show && results.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: position === "above" ? 4 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: position === "above" ? 4 : -4 }}
          className={`absolute z-50 w-full rounded-[24px] border border-white/[0.08] bg-[rgba(31,27,24,0.98)] shadow-2xl overflow-hidden ${
            position === "above" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {results.map((item, i) => {
            const text = typeof item === "string" ? item : item.text;
            const count = typeof item === "object" ? item.count : null;
            const type = typeof item === "object" ? item.type : "search";

            return (
              <button key={i} type="button" onMouseDown={() => onSelect(item)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.04]">
                <Search className="h-3 w-3 text-white/15 shrink-0" />
                <span className="flex-1 text-left text-white/50">{text}</span>
                {count != null && (
                  <span className="text-[10px] tabular-nums text-white/20 shrink-0">
                    {count.toLocaleString()}
                  </span>
                )}
                {type === "vendor" && (
                  <span className="text-[9px] uppercase tracking-wider text-gold/30 shrink-0">vendor</span>
                )}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
