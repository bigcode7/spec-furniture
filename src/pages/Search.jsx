import { useEffect, useRef, useState } from "react";
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
  FileText,
  ClipboardCheck,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { searchProducts, smartSearch, visualSearch, getAutocomplete, findSimilarProducts, listSearch, trackProductClick } from "@/api/searchClient";
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
} from "@/lib/growth-store";
import { useGuestGate } from "@/lib/GuestGate";
import { useTradePricing } from "@/lib/TradePricingContext";

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

// Route images through our backend proxy to bypass vendor hotlink protection
function proxyImg(url, productId) {
  if (!url) return "";
  // Use /images/:id endpoint which proxies server-side
  if (productId) return `${SEARCH_SERVICE}/images/${encodeURIComponent(productId)}`;
  // Fallback: use generic proxy
  return `${SEARCH_SERVICE}/proxy-image?url=${encodeURIComponent(url)}`;
}

const EXAMPLE_SEARCHES = [
  "walnut dining table for 8, mid-century modern",
  "blue velvet sectional, luxury brand",
  "boucle accent chair, cozy neutral colors",
  "track arm sofa, performance fabric",
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
  { label: "Understanding your request...", duration: 0.4 },
  { label: "Searching 40,000+ products...", duration: 0.6 },
  { label: "Matching across 18 vendors...", duration: 1.0 },
  { label: "Ranking results...", duration: 0.5 },
];

const SORT_OPTIONS = [
  { key: "relevance", label: "Best Match" },
  { key: "vendor_az", label: "Vendor A-Z" },
  { key: "newest", label: "Newest" },
  { key: "popular", label: "Most Popular" },
];

const INITIAL_PAGE_SIZE = 24;
const LOAD_MORE_SIZE = 12;
const MAX_RESULTS = 200;

function getInitialQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q") || "";
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

function applyClientFilters(products, clientFilters) {
  if (!clientFilters || Object.keys(clientFilters).length === 0) return products;
  return products.filter(p => {
    if (clientFilters.vendors?.length) {
      const v = p.manufacturer_name || p.vendor_name || "";
      if (!clientFilters.vendors.includes(v)) return false;
    }
    if (clientFilters.categories?.length) {
      const cat = (p.product_type || p.category || "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      if (!clientFilters.categories.includes(cat)) return false;
    }
    if (clientFilters.materials?.length) {
      const mat = (p.material || "").toLowerCase();
      const tags = (p.ai_visual_tags || "").toLowerCase();
      if (!clientFilters.materials.some(m => mat.includes(m.toLowerCase()) || tags.includes(m.toLowerCase()))) return false;
    }
    if (clientFilters.styles?.length) {
      if (!clientFilters.styles.includes(p.style)) return false;
    }
    if (clientFilters.colors?.length) {
      const colText = `${p.color || ""} ${p.ai_visual_tags || ""}`.toLowerCase();
      if (!clientFilters.colors.some(c => colText.includes(c.toLowerCase()))) return false;
    }
    return true;
  });
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

// ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [inputValue, setInputValue] = useState("");
  const [allResults, setAllResults] = useState([]); // full result set from server
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [zeroResultGuidance, setZeroResultGuidance] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);

  // Client-side filters, sort, pagination
  const [clientFilters, setClientFilters] = useState({});
  const [sortKey, setSortKey] = useState("relevance");
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
  const autocompleteTimer = useRef(null);

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

  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [quoteIds, setQuoteIds] = useState(new Set());
  const [quoteToast, setQuoteToast] = useState(null);
  const [favoriteToast, setFavoriteToast] = useState(null);

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const scrollSentinelRef = useRef(null);
  // Guest gate — track searches, gate features
  const { trackSearch, requireAccount, isGuest } = useGuestGate();

  const hasConversation = messages.length > 0;

  // Derived: filtered + sorted + paginated results
  const filtered = applyClientFilters(allResults, clientFilters);
  const sorted = sortProducts(filtered, sortKey);
  const visibleProducts = sorted.slice(0, visibleCount);
  const hasMoreLocal = visibleCount < sorted.length;
  const hasMoreServer = allResults.length < MAX_RESULTS;
  const facets = allResults.length > 0 ? extractFacets(allResults) : null;
  const activeFilterCount = Object.values(clientFilters).reduce((n, arr) => n + (arr?.length || 0), 0);

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
    if (initialQuery) {
      setInputValue(initialQuery);
      runSearch(initialQuery);
    }
  }, []);

  useEffect(() => {
    if (chatEndRef.current && loading) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

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
      const assistantMsg = {
        role: "assistant",
        content: data.overview_message || `Processed ${items.length} items.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setError("List search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── SEARCH ──
  const runSearch = async (q, searchOptions = {}) => {
    if (!q.trim()) return;
    const trimmed = q.trim();

    // Detect multi-item lists
    const listItems = detectList(trimmed);
    if (listItems && listItems.length >= 2) {
      return runListSearch(listItems);
    }

    // Clear list mode when doing single search
    setListMode(false);
    setListResults(null);
    setInputValue("");
    setLoading(true);
    setError(null);
    setLoadingStep(0);
    setClientFilters({});
    setSortKey("relevance");
    setVisibleCount(INITIAL_PAGE_SIZE);
    setPreviewProduct(null);

    shownProductIds.current = new Set();
    pageRef.current = 1;
    lastQueryRef.current = trimmed;

    const userMsg = { role: "user", content: trimmed, timestamp: Date.now() };
    const updatedMessages = hasConversation ? [...messages, userMsg] : [userMsg];
    setMessages(updatedMessages);

    window.history.replaceState({}, "", `/Search?q=${encodeURIComponent(trimmed)}`);

    try {
      for (let i = 0; i < LOADING_STEPS.length - 1; i++) {
        await new Promise((r) => setTimeout(r, LOADING_STEPS[i].duration * 1000));
        setLoadingStep(i + 1);
      }

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
      try {
        data = await smartSearch(apiConvo);
      } catch {
        // Fallback to old search if smart search fails
        data = await searchProducts(trimmed, { filters: searchOptions.filters || {} });
      }

      const products = data.products || [];
      const summaryText = data.assistant_message || data.ai_summary || `Found ${products.length} products for "${trimmed}".`;

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
      trackSearch(); // Track for guest signup prompt
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
      setLoadingStep(0);
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
    } catch { /* silent */ } finally {
      setLoadingMore(false);
    }
  };

  // ── PREVIEW ──
  const openPreview = (product) => {
    setPreviewProduct(product);
    setSimilarProducts([]);
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
      const data = await findSimilarProducts(product.id, 8);
      setSimilarProducts(data.products || []);
    } catch {
      setSimilarProducts([]);
    } finally {
      setSimilarLoading(false);
    }
  };

  // ── HANDLERS ──
  const handleSubmit = (e) => {
    e.preventDefault();
    setShowAutocomplete(false);
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
    setClientFilters({});
    setSortKey("relevance");
    setVisibleCount(INITIAL_PAGE_SIZE);
    setPreviewProduct(null);
    shownProductIds.current = new Set();
    pageRef.current = 1;
    lastQueryRef.current = "";
    window.history.replaceState({}, "", "/Search");
    inputRef.current?.focus();
  };

  const handleInputChange = (value) => {
    setInputValue(value);
    clearTimeout(autocompleteTimer.current);
    if (value.trim().length >= 2) {
      autocompleteTimer.current = setTimeout(async () => {
        try {
          const data = await getAutocomplete(value.trim());
          const details = data.details || [];
          const suggestions = details.length > 0 ? details : (data.suggestions || []).map(s => ({ text: s, type: "search", count: null }));
          setAutocompleteResults(suggestions.slice(0, 8));
          setShowAutocomplete(true);
        } catch {
          setAutocompleteResults([]);
        }
      }, 150);
    } else {
      setAutocompleteResults([]);
      setShowAutocomplete(false);
    }
  };

  const handleVisualSearch = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVisualSearchLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        const data = await visualSearch(base64);
        if (data.description) runSearch(data.description);
        setVisualSearchLoading(false);
      };
      reader.readAsDataURL(file);
    } catch { setVisualSearchLoading(false); }
    e.target.value = "";
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

  const toggleClientFilter = (dimension, value) => {
    const current = clientFilters[dimension] || [];
    const updated = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    const next = { ...clientFilters, [dimension]: updated.length > 0 ? updated : undefined };
    // Remove empty arrays
    for (const k of Object.keys(next)) {
      if (!next[k]?.length) delete next[k];
    }
    setClientFilters(next);
    setVisibleCount(INITIAL_PAGE_SIZE);
  };

  const clearClientFilters = () => {
    setClientFilters({});
    setVisibleCount(INITIAL_PAGE_SIZE);
  };

  const handleToggleFavorite = (product) => {
    requireAccount("favorite", product, () => {
      const { next, added } = toggleFavorite(normalizeSearchResult(product));
      setFavorites(next);
      setFavoriteToast(added ? "Saved to favorites" : "Removed from favorites");
      setTimeout(() => setFavoriteToast(null), 2000);
    });
  };

  const handleAddToQuote = (product) => {
    requireAccount("quote", product, () => {
      const { added, alreadyExists } = addToQuote(product);
      if (added) {
        setQuoteIds(prev => new Set([...prev, product.id]));
        setQuoteToast(product.product_name);
        setTimeout(() => setQuoteToast(null), 2200);
        window.dispatchEvent(new CustomEvent("spec-quote-change"));
      }
    });
  };

  const isFavorited = (id) => favorites.some(f => f.id === id);

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────

  return (
    <div className="relative min-h-screen">

      {/* ── LANDING STATE ── */}
      {!hasConversation && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[75vh] px-4">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="w-full max-w-2xl">
            {/* Hero */}
            <div className="text-center mb-10">
              <h1 className="font-display text-5xl md:text-6xl text-white mb-4" style={{ textShadow: "0 0 40px rgba(79,107,255,0.15)" }}>
                Find the perfect <span className="text-gold">piece</span>
              </h1>
              <p className="text-sm max-w-md mx-auto" style={{ color: "var(--warm-gray)" }}>
                Search like you'd describe it to a colleague. Paste a sourcing list and we'll find every item.
              </p>
            </div>

            {/* Search input — textarea that auto-grows for multi-line lists */}
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <div className="search-bar-glow relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl transition-all duration-300 focus-within:border-gold/20">
                  <div className="flex items-start">
                    <div className="ml-5 mt-5 shrink-0"><div className="spec-diamond" /></div>
                    <textarea
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => {
                        handleInputChange(e.target.value);
                        // Auto-resize
                        e.target.style.height = "auto";
                        e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                      }}
                      onKeyDown={(e) => {
                        // Submit on Enter (without Shift) only if single-line
                        if (e.key === "Enter" && !e.shiftKey && !inputValue.includes("\n")) {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      onFocus={() => setShowAutocomplete(autocompleteResults.length > 0)}
                      onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                      placeholder={'Try "walnut credenza" or paste a sourcing list...'}
                      className="min-h-[64px] w-full bg-transparent px-4 py-5 text-sm text-white/80 placeholder:text-white/20 outline-none resize-none overflow-hidden"
                      rows={1}
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5 pr-3 mt-4 shrink-0">
                      {inputValue && (
                        <button type="button" onClick={() => { setInputValue(""); setAutocompleteResults([]); inputRef.current?.focus(); if (inputRef.current) { inputRef.current.style.height = "auto"; } }}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/20 hover:bg-white/5 hover:text-white/40 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-white/20 hover:bg-white/5 hover:text-gold/50 transition-colors" title="Visual search">
                        {visualSearchLoading ? <Loader2 className="h-4 w-4 animate-spin text-gold/60" /> : <Camera className="h-4 w-4" />}
                      </button>
                      <button type="submit" disabled={!inputValue.trim()} className="btn-gold flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleVisualSearch} />
                <SmartAutocomplete show={showAutocomplete} results={autocompleteResults} onSelect={handleAutocompleteSelect} />
              </div>
            </form>

            {/* Suggested searches */}
            <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2">
              {EXAMPLE_SEARCHES.map((example, i) => (
                <span key={example} className="flex items-center gap-2">
                  {i > 0 && <span className="text-gold/30 text-xs">·</span>}
                  <button onClick={() => runSearch(example)} className="text-sm transition-colors hover:text-gold/70" style={{ color: "var(--warm-gray)" }}>
                    {example}
                  </button>
                </span>
              ))}
            </div>

            {/* Recently viewed products only — no search history */}
            {recentlyViewed.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="h-px flex-1 max-w-[40px] bg-gradient-to-r from-transparent to-white/[0.06]" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20 flex items-center gap-1.5">
                    <Eye className="h-3 w-3" /> Recently Viewed
                  </span>
                  <div className="h-px flex-1 max-w-[40px] bg-gradient-to-l from-transparent to-white/[0.06]" />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 justify-center">
                  {recentlyViewed.slice(0, 10).map((p) => (
                    <button key={p.id} onClick={() => openPreview(p)}
                      className="shrink-0 w-[100px] group">
                      <div className="aspect-square rounded-lg overflow-hidden border border-white/[0.04] group-hover:border-gold/20 transition-colors mb-1.5" style={{ backgroundColor: "#ffffff" }}>
                        {p.image_url ? (
                          <img src={proxyImg(p.image_url, p.id)} alt="" className="h-full w-full" style={{ objectFit: "contain", padding: "4px" }} />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-white/10 font-display text-lg">
                            {(p.manufacturer_name || "?")[0]}
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-white/30 truncate group-hover:text-white/50 transition-colors">{p.product_name}</div>
                      <div className="text-[9px] text-white/15 truncate">{p.manufacturer_name}</div>
                      {p.retail_price > 0 && (
                        <div className="text-[10px] text-white/40 font-medium">${p.retail_price.toLocaleString()}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── RESULTS VIEW ── */}
      {(hasConversation || loading) && (
        <div className="pb-24">
          {/* Top bar */}
          <div className="sticky top-14 z-30 border-b border-white/[0.04] bg-[#08090E]/90 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`spec-diamond${loading ? " animate-pulse" : ""}`} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold/70">Results</span>
              </div>
              <button onClick={handleNewSearch}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] text-white/25 hover:bg-white/5 hover:text-gold/50 transition-colors">
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

          <div className="max-w-7xl mx-auto px-4">
            {/* Compact thread */}
            {messages.length > 1 && (
              <div className="pt-4 pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  {messages.slice(0, -1).map((msg, i) => (
                    msg.role === "user" ? (
                      <motion.span key={msg.timestamp + "-" + i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center rounded-full px-3 py-1 text-[11px] border cursor-default"
                        style={{ background: "rgba(79,107,255,0.06)", borderColor: "rgba(79,107,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
                        {msg.content.length > 50 ? msg.content.slice(0, 50) + "…" : msg.content}
                      </motion.span>
                    ) : (
                      <motion.span key={msg.timestamp + "-" + i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1.5 text-[11px] text-white/20">
                        <span className="spec-diamond" style={{ width: 4, height: 4 }} />
                        {(msg.content || "").length > 60 ? msg.content.slice(0, 60) + "…" : msg.content}
                        <span className="text-white/10 mx-1">→</span>
                      </motion.span>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Latest AI response */}
            {!loading && messages.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5" style={{ background: "rgba(79,107,255,0.1)", border: "1px solid rgba(79,107,255,0.15)" }}>
                    <div className="spec-diamond" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed" style={{ color: "var(--warm-white)" }}>
                      {messages[messages.length - 1].content}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Loading */}
            {loading && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3 py-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5" style={{ background: "rgba(79,107,255,0.1)", border: "1px solid rgba(79,107,255,0.15)" }}>
                  <div className="loading-emblem" style={{ width: 10, height: 10 }} />
                </div>
                <div className="pt-1">
                  <div className="flex items-center gap-2.5">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[11px] text-white/25">{LOADING_STEPS[loadingStep]?.label || "Searching..."}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-3 py-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10"><AlertCircle className="h-3.5 w-3.5 text-red-400" /></div>
                <p className="text-sm text-red-400/80 pt-1">{error}</p>
              </motion.div>
            )}

            {/* ── FILTER BAR + SORT ── */}
            {!loading && allResults.length > 0 && (
              <ClientFilterBar
                facets={facets}
                filters={clientFilters}
                onToggle={toggleClientFilter}
                onClear={clearClientFilters}
                activeCount={activeFilterCount}
                resultCount={sorted.length}
                totalCount={allResults.length}
                sortKey={sortKey}
                setSortKey={setSortKey}
                showSortMenu={showSortMenu}
                setShowSortMenu={setShowSortMenu}
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

            {/* ── List search results (grouped by item) ── */}
            {!loading && listMode && listResults?.items?.length > 0 && (
              <motion.div key="list-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                {listResults.items.map((item, itemIdx) => (
                  <div key={itemIdx} className="mb-8">
                    {/* Section header */}
                    <div className="flex items-center gap-3 mb-3 mt-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gold/10 text-gold/70 text-xs font-bold shrink-0">
                        {item.item_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white/80 truncate">{item.original_text}</div>
                        {item.summary && item.summary !== item.original_text && (
                          <div className="text-[11px] text-white/30 mt-0.5">{item.summary}</div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {item.dimension_notes && (
                          <span className="text-[10px] text-white/20 border border-white/[0.06] rounded px-1.5 py-0.5">{item.dimension_notes}</span>
                        )}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          item.total >= 3 ? "bg-green-500/10 text-green-400/70" :
                          item.total > 0 ? "bg-yellow-500/10 text-yellow-400/70" :
                          "bg-white/[0.03] text-white/20"
                        }`}>
                          {item.total > 0 ? `${item.total} found` : "no matches"}
                        </span>
                      </div>
                    </div>

                    {/* Feasibility note */}
                    {item.feasibility === "unlikely" && item.feasibility_note && (
                      <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400/60 mt-0.5 shrink-0" />
                        <span className="text-[11px] text-amber-300/60">{item.feasibility_note}</span>
                      </div>
                    )}

                    {/* Product cards for this item */}
                    {item.products.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5">
                        {item.products.slice(0, 8).map((product, pIdx) => (
                          <ProductCard
                            key={product.id || pIdx}
                            item={product}
                            index={pIdx}
                            isFavorited={isFavorited(product.id)}
                            isInQuote={quoteIds.has(product.id)}
                            onToggleFavorite={() => handleToggleFavorite(product)}
                            onAddToQuote={() => handleAddToQuote(product)}
                            onPreview={() => openPreview(product)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-4 text-center">
                        <span className="text-[11px] text-white/20">No matching products in our catalog yet</span>
                      </div>
                    )}

                    {/* Separator */}
                    {itemIdx < listResults.items.length - 1 && (
                      <div className="mt-6 border-t border-white/[0.04]" />
                    )}
                  </div>
                ))}

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
              <motion.div key={messages.length} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {visibleProducts.map((item, idx) => (
                    <ProductCard
                      key={item.id || idx}
                      item={item}
                      index={idx}
                      isFavorited={isFavorited(item.id)}
                      isInQuote={quoteIds.has(item.id)}
                      onToggleFavorite={() => handleToggleFavorite(item)}
                      onAddToQuote={() => handleAddToQuote(item)}
                      onPreview={() => openPreview(item)}
                    />
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
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-2 pt-6 pb-4">
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
          <div className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.04] bg-[#08090E]/90 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <form onSubmit={handleSubmit} className="relative">
                <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.03] transition-all focus-within:border-gold/20 focus-within:shadow-[0_0_20px_rgba(79,107,255,0.08)]">
                  <div className="flex items-center">
                    <div className="ml-3.5 shrink-0"><div className="spec-diamond" /></div>
                    <input ref={inputRef} value={inputValue} onChange={(e) => handleInputChange(e.target.value)}
                      onFocus={() => setShowAutocomplete(autocompleteResults.length > 0)}
                      onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                      placeholder="Refine your search or ask me anything..."
                      className="h-12 w-full bg-transparent pl-3 pr-28 text-sm text-white/80 placeholder:text-white/20 outline-none"
                      disabled={loading} />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button type="button" onClick={() => fileInputRef.current?.click()}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:bg-white/5 hover:text-gold/50 transition-colors">
                        {visualSearchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gold/60" /> : <Camera className="h-3.5 w-3.5" />}
                      </button>
                      <button type="submit" disabled={loading || !inputValue.trim()}
                        className="btn-gold flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleVisualSearch} />
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
          />
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
              border: "1px solid rgba(201,169,110,0.25)",
              backdropFilter: "blur(20px)",
            }}
          >
            <ClipboardCheck className="h-4 w-4 text-gold" />
            <span className="text-sm text-white/80">Added to quote</span>
            <span className="text-xs text-white/30 max-w-[200px] truncate">{quoteToast}</span>
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
              border: "1px solid rgba(201,169,110,0.25)",
              backdropFilter: "blur(20px)",
            }}
          >
            <Heart className="h-4 w-4 text-gold" />
            <span className="text-sm text-white/80">{favoriteToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


// ─── CLIENT FILTER BAR ──────────────────────────────────────
function ClientFilterBar({ facets, filters, onToggle, onClear, activeCount, resultCount, totalCount, sortKey, setSortKey, showSortMenu, setShowSortMenu }) {
  const [expanded, setExpanded] = useState(null); // which filter group is open

  if (!facets) return null;

  const filterGroups = [
    { key: "vendors", label: "Vendor", items: facets.vendors },
    { key: "categories", label: "Category", items: facets.categories },
    { key: "materials", label: "Material", items: facets.materials },
    { key: "styles", label: "Style", items: facets.styles },
    { key: "colors", label: "Color", items: facets.colors },
  ].filter(g => g.items.length > 1);

  return (
    <div className="pb-3 border-b border-white/[0.04] mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter chips for each dimension */}
        {filterGroups.map((group) => (
          <div key={group.key} className="relative">
            <button
              onClick={() => setExpanded(expanded === group.key ? null : group.key)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] transition-all border ${
                (filters[group.key]?.length > 0)
                  ? "border-gold/30 bg-gold/10 text-gold"
                  : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60 hover:border-white/10"
              }`}
            >
              {group.label}
              {filters[group.key]?.length > 0 && (
                <span className="rounded-full bg-gold/20 px-1.5 text-[10px] text-gold/80">{filters[group.key].length}</span>
              )}
              <ChevronDown className={`h-2.5 w-2.5 transition-transform ${expanded === group.key ? "rotate-180" : ""}`} />
            </button>

            {/* Dropdown */}
            <AnimatePresence>
              {expanded === group.key && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1.5 left-0 z-50 w-56 max-h-64 overflow-y-auto rounded-xl border border-white/[0.08] bg-[#111118] shadow-2xl p-2"
                >
                  {group.items.slice(0, 20).map((item) => {
                    const isActive = (filters[group.key] || []).includes(item.value);
                    return (
                      <button key={item.value}
                        onClick={() => onToggle(group.key, item.value)}
                        className={`flex items-center justify-between w-full rounded-lg px-2.5 py-1.5 text-[11px] transition-all ${
                          isActive ? "bg-gold/10 text-gold" : "text-white/50 hover:text-white/70 hover:bg-white/[0.03]"
                        }`}>
                        <span className="truncate">{item.value}</span>
                        <span className={`text-[10px] ml-2 flex-shrink-0 tabular-nums ${isActive ? "text-gold/70" : "text-white/20"}`}>
                          {item.count}
                        </span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Active filter pills */}
        <AnimatePresence>
          {Object.entries(filters).map(([key, values]) =>
            (values || []).map(value => (
              <motion.button key={`${key}:${value}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => onToggle(key, value)}
                className="flex items-center gap-1 rounded-full border border-gold/20 bg-gold/5 px-2 py-1 text-[10px] text-gold hover:bg-gold/10 transition-all">
                <span className="truncate max-w-[100px]">{value}</span>
                <X className="h-2.5 w-2.5 flex-shrink-0" />
              </motion.button>
            ))
          )}
        </AnimatePresence>

        {activeCount > 0 && (
          <button onClick={onClear} className="text-[10px] text-white/30 hover:text-white/50 transition-colors">Clear all</button>
        )}

        {/* Right side: sort + count */}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] text-white/20 tabular-nums">
            {resultCount === totalCount ? `${totalCount} results` : `${resultCount} of ${totalCount}`}
          </span>

          {/* Sort dropdown */}
          <div className="relative">
            <button onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60 transition-all">
              <ArrowUpDown className="h-3 w-3" />
              {SORT_OPTIONS.find(s => s.key === sortKey)?.label}
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1.5 right-0 z-50 w-40 rounded-xl border border-white/[0.08] bg-[#111118] shadow-2xl p-1.5">
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

      {/* Click outside to close dropdowns */}
      {(expanded || showSortMenu) && (
        <div className="fixed inset-0 z-40" onClick={() => { setExpanded(null); setShowSortMenu(false); }} />
      )}
    </div>
  );
}


// ─── PRODUCT CARD ──────────────────────────────────────────
function ProductCard({ item, index, isFavorited, isInQuote, onToggleFavorite, onAddToQuote, onPreview }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const { getPrice, fmtPrice } = useTradePricing();

  const priceInfo = getPrice(item);
  const priceStr = priceInfo.price ? fmtPrice(priceInfo.price) : null;
  const materialStyle = [item.material, item.style].filter(Boolean).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: Math.min(index * 0.04, 0.48), ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="product-card group cursor-pointer"
      onClick={(e) => {
        // Don't open preview if clicking action buttons
        if (e.target.closest("[data-action]")) return;
        onPreview();
      }}
    >
      {/* Image — landscape for studio shots, tall for lifestyle */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "4/3", backgroundColor: "#ffffff" }}>
        {item.image_url && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#ffffff" }}>
                <div className="loading-emblem" style={{ width: 12, height: 12 }} />
              </div>
            )}
            <img src={proxyImg(item.image_url, item.id)} alt={item.product_name}
              className={`h-full w-full transition-all duration-700 ${imgLoaded ? "opacity-100" : "opacity-0"} ${hovered ? "scale-[1.03]" : "scale-100"}`}
              style={{ objectFit: "contain", padding: "12px", transitionTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)" }}
              onLoad={() => setImgLoaded(true)} onError={() => setImgError(true)} />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/10">
            <div className="text-3xl font-display">{(item.manufacturer_name || "?")[0]}</div>
            <span className="text-[10px] px-3 text-center line-clamp-2 text-white/15">{item.product_name}</span>
          </div>
        )}

        {/* Overlay buttons */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <button data-action onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all backdrop-blur-sm ${
              isFavorited ? "bg-gold/90 text-black" : "bg-black/40 text-white/40 opacity-0 group-hover:opacity-100 hover:bg-black/60"
            }`}>
            <Heart className={`h-3 w-3 ${isFavorited ? "fill-current" : ""}`} />
          </button>
          <button data-action onClick={(e) => {
              e.stopPropagation();
              if (!isInQuote && !justAdded) {
                onAddToQuote();
                setJustAdded(true);
                setTimeout(() => setJustAdded(false), 2000);
              }
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all backdrop-blur-sm ${
              isInQuote || justAdded ? "bg-gold/90 text-black" : "bg-black/40 text-white/40 opacity-0 group-hover:opacity-100 hover:bg-black/60"
            }`}
            title={isInQuote ? "In quote" : "Add to quote"}>
            {isInQuote || justAdded ? <ClipboardCheck className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
          </button>
        </div>

        {/* Quick view indicator */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-sm px-2 py-1 text-[9px] text-white/60">
            <Eye className="h-2.5 w-2.5" /> Quick view
          </div>
        </div>
      </div>

      {/* Gold hairline */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

      {/* Card meta */}
      <div className="card-meta p-4 pb-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold/70 mb-1.5 truncate">{item.manufacturer_name}</div>
        <h3 className="product-name text-white/90 line-clamp-2 mb-2">{item.product_name}</h3>
        {materialStyle && <div className="text-[12px] text-white/25 truncate mb-2">{materialStyle}</div>}
        <div className="flex items-center gap-2 flex-wrap">
          {priceStr && (
            <span className={`text-[13px] font-semibold ${priceInfo.isTrade ? "text-emerald-400/80" : "text-gold/80"}`}>
              {priceInfo.isTrade && <span className="text-[9px] uppercase tracking-wider mr-1 opacity-70">{priceInfo.label}</span>}
              {priceStr}
            </span>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="card-link px-3 pb-2.5 flex items-center justify-end">
        {item.portal_url && (
          <a href={item.portal_url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} data-action
            className="text-[10px] font-medium text-gold/60 flex items-center gap-1 hover:text-gold/80 transition-colors">
            View <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
}


// ─── PRODUCT PREVIEW PANEL ──────────────────────────────────
function ProductPreviewPanel({ product, onClose, onFindSimilar, similarProducts, similarLoading, onToggleFavorite, onAddToQuote, isFavorited, onOpenPreview }) {
  const [imgLoaded, setImgLoaded] = useState(false);
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
    // Route all through proxy to bypass hotlink protection
    if (urls.length > 0) return urls.map(u => proxyImg(u));
    return product.image_url ? [proxyImg(product.image_url, product.id)] : [];
  })();

  const priceInfo = getPrice(product);
  const tags = (product.ai_visual_tags || "").split(",").map(t => t.trim()).filter(Boolean);
  const dims = [];
  if (product.width) dims.push(`${product.width}" W`);
  if (product.depth) dims.push(`${product.depth}" D`);
  if (product.height) dims.push(`${product.height}" H`);
  const dimStr = dims.join(" × ") || product.dimensions || null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: "spring", damping: 30, stiffness: 400 }}
        className="fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-white/[0.08] bg-[#0e0e14]/95 backdrop-blur-xl shadow-2xl"
      >
        {/* Close handle */}
        <div className="sticky top-0 z-10 flex justify-center pt-3 pb-2 bg-[#0e0e14]/95 backdrop-blur-xl">
          <button onClick={onClose} className="h-1 w-10 rounded-full bg-white/15 hover:bg-white/25 transition-colors" />
        </div>

        <div className="max-w-5xl mx-auto px-4 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image gallery */}
            <div className="flex flex-col gap-2">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-white/[0.04]" style={{ backgroundColor: "#ffffff" }}>
                {productImages.length > 0 ? (
                  <>
                    {!imgLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "#ffffff" }}><div className="loading-emblem" style={{ width: 16, height: 16 }} /></div>
                    )}
                    <img src={productImages[activeImageIdx]} alt={product.product_name}
                      className={`h-full w-full transition-opacity ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                      style={{ objectFit: "contain", padding: "16px" }}
                      onLoad={() => setImgLoaded(true)} />
                    {productImages.length > 1 && (
                      <>
                        <button
                          onClick={() => { setImgLoaded(false); setActiveImageIdx((activeImageIdx - 1 + productImages.length) % productImages.length); }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-all"
                        >
                          ‹
                        </button>
                        <button
                          onClick={() => { setImgLoaded(false); setActiveImageIdx((activeImageIdx + 1) % productImages.length); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/70 transition-all"
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
                      <img src={src} alt="" style={{ objectFit: "contain", padding: "4px" }} className="h-full w-full" />
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
              <h2 className="font-display text-2xl text-white/90 leading-tight">
                {product.product_name}
              </h2>

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
              <div className="flex flex-wrap gap-2 pt-2">
                <button onClick={() => onFindSimilar(product)} disabled={similarLoading}
                  className="flex items-center gap-1.5 rounded-lg border border-gold/20 bg-gold/5 px-4 py-2 text-[11px] font-semibold text-gold/80 hover:bg-gold/10 transition-all disabled:opacity-40">
                  {similarLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Layers className="h-3 w-3" />}
                  Find Similar
                </button>
                <button onClick={() => onAddToQuote(product)}
                  className="flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[11px] font-semibold transition-all border-white/[0.08] text-white/40 hover:text-gold hover:border-gold/30 hover:bg-gold/10">
                  <FileText className="h-3 w-3" />
                  Add to Quote
                </button>
                <button onClick={() => onToggleFavorite(product)}
                  className={`flex items-center gap-1.5 rounded-lg border px-4 py-2 text-[11px] font-semibold transition-all ${
                    isFavorited ? "border-gold/30 bg-gold/10 text-gold" : "border-white/[0.08] text-white/40 hover:text-white/60 hover:border-white/15"
                  }`}>
                  <Heart className={`h-3 w-3 ${isFavorited ? "fill-current" : ""}`} />
                  {isFavorited ? "Saved" : "Save"}
                </button>
                {product.portal_url && (
                  <a href={product.portal_url} target="_blank" rel="noopener"
                    className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-4 py-2 text-[11px] font-semibold text-white/40 hover:text-white/60 hover:border-white/15 transition-all">
                    <ExternalLink className="h-3 w-3" /> View at {(product.manufacturer_name || "vendor").split(" ")[0]}
                  </a>
                )}
              </div>
            </div>
          </div>

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
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {similarProducts.map((sp) => (
                  <button key={sp.id} onClick={() => onOpenPreview(sp)} className="text-left group">
                    <div className="aspect-[4/3] rounded-lg overflow-hidden border border-white/[0.04] group-hover:border-gold/15 transition-colors mb-1.5" style={{ backgroundColor: "#ffffff" }}>
                      {sp.image_url ? (
                        <img src={proxyImg(sp.image_url, sp.id)} alt="" className="h-full w-full" style={{ objectFit: "contain", padding: "6px" }} />
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
          className={`absolute z-50 w-full rounded-xl border border-white/[0.08] bg-[#111118] shadow-2xl overflow-hidden ${
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
