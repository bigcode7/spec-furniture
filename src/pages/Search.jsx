import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Search,
  ExternalLink,
  X,
  Sparkles,
  AlertCircle,
  History,
  GitCompare,
  Check,
  Camera,
  Loader2,
  RefreshCw,
  MessageSquare,
  ArrowRight,
  Layers,
  Send,
  Compass,
  Package,
} from "lucide-react";
import DiscoverBrowser from "@/components/DiscoverBrowser";
import CollectionBrowser from "@/components/CollectionBrowser";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { searchProducts, visualSearch, getAutocomplete, conversationalSearch, findSimilarProducts, trackProductClick, trackProductCompare } from "@/api/searchClient";
import FitScoreBadge from "@/components/FitScoreBadge";
import MaterialBadges from "@/components/MaterialBadges";
import SearchFilters from "@/components/SearchFilters";
import AddToProjectMenu from "@/components/AddToProjectMenu";
import {
  getRecentSearches,
  pushRecentSearch,
  getCompareItems,
  toggleCompareItem,
  normalizeSearchResult,
  trackStyleInteraction,
} from "@/lib/growth-store";

const EXAMPLE_SEARCHES = [
  "walnut dining table for 8, mid-century modern",
  "blue velvet sectional, luxury brand",
  "sustainable wooden dining chairs under $800",
  "boucle accent chair, cozy neutral colors",
  "mid-century modern credenza, walnut",
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
  { icon: "brain", label: "Understanding your request...", duration: 0.4 },
  { icon: "layers", label: "Searching 64,000+ products...", duration: 0.6 },
  { icon: "radar", label: "Matching across 33 vendors...", duration: 1.0, detail: "Scanning catalog" },
  { icon: "shield", label: "Ranking results...", duration: 0.5 },
];

function getInitialQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get("q") || "";
}

const MODE_TABS = [
  { key: "search", label: "Search", icon: Search },
  { key: "discover", label: "Discover", icon: Compass },
  { key: "collections", label: "Collections", icon: Package },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMode = searchParams.get("mode") || "search";

  const setActiveMode = (mode) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (mode === "search") {
        next.delete("mode");
      } else {
        next.set("mode", mode);
      }
      return next;
    });
  };

  const [inputValue, setInputValue] = useState("");
  const [results, setResults] = useState([]);
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [compareItems, setCompareItems] = useState([]);

  // Pagination & filters
  const [filters, setFilters] = useState({});
  const [facets, setFacets] = useState(null);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const shownProductIds = useRef(new Set());
  const lastQueryRef = useRef("");
  const pageRef = useRef(1);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [visualSearchLoading, setVisualSearchLoading] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState([]); // { role, content, products?, timestamp }
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [refining, setRefining] = useState(false);

  // Find similar state
  const [similarLoading, setSimilarLoading] = useState(null); // product id being loaded

  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const autocompleteTimer = useRef(null);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const navigate = useNavigate();

  const hasConversation = messages.length > 0;

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    setCompareItems(getCompareItems());
    const initialQuery = getInitialQuery();
    if (initialQuery) {
      setInputValue(initialQuery);
      runSearch(initialQuery);
    }
  }, []);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, refining]);

  // ── SEARCH ──
  const runSearch = async (q, searchOptions = {}) => {
    if (!q.trim()) return;
    const trimmed = q.trim();
    setInputValue("");
    setLoading(true);
    setError(null);
    setLoadingStep(0);

    const isShowMore = searchOptions.showMore === true;

    // Reset pagination tracking on new queries
    if (!isShowMore) {
      shownProductIds.current = new Set();
      pageRef.current = 1;
      lastQueryRef.current = trimmed;
    } else {
      pageRef.current += 1;
    }

    // Add user message (skip for "show more")
    let updatedMessages;
    if (!isShowMore) {
      const userMsg = { role: "user", content: trimmed, timestamp: Date.now() };
      updatedMessages = hasConversation ? [...messages, userMsg] : [userMsg];
      setMessages(updatedMessages);
    } else {
      updatedMessages = messages;
    }

    if (!isShowMore) {
      window.history.replaceState({}, "", `/Search?q=${encodeURIComponent(trimmed)}`);
    }

    try {
      // Animate loading steps
      for (let i = 0; i < LOADING_STEPS.length - 1; i++) {
        await new Promise((r) => setTimeout(r, LOADING_STEPS[i].duration * 1000));
        setLoadingStep(i + 1);
      }

      let data;
      if (!isShowMore && hasConversation && !searchOptions.freshSearch) {
        const apiConvo = updatedMessages.map(({ role, content }) => ({ role, content }));
        data = await conversationalSearch(apiConvo, results, sessionId);
      } else {
        data = await searchProducts(trimmed, {
          exclude_ids: isShowMore ? [...shownProductIds.current] : [],
          page: pageRef.current,
          filters: searchOptions.filters || filters,
        });
      }

      const products = data.products || [];
      const summaryText = data.assistant_message || data.ai_summary || `Found ${products.length} products for "${trimmed}".`;

      // Track shown product IDs for exclude-set pagination
      for (const p of products) {
        if (p.id) shownProductIds.current.add(p.id);
      }

      // Update facets and total
      if (data.facets) setFacets(data.facets);
      if (data.total_available != null) setTotalAvailable(data.total_available);

      if (isShowMore) {
        // Append as new message
        setResults((prev) => [...prev, ...products]);
        const moreMsg = {
          role: "assistant",
          content: `Found ${products.length} more options${data.has_more ? ` (${data.total_available - shownProductIds.current.size}+ still available)` : ""}.`,
          products: products.slice(0, 12),
          allProducts: products,
          isShowMore: true,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, moreMsg]);
      } else {
        setResults(products);
        setIntent(data.intent || null);
        setDiagnostics(data.diagnostics || null);

        const assistantMsg = {
          role: "assistant",
          content: summaryText,
          products: products.slice(0, 12),
          allProducts: products,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }

      setRecentSearches(pushRecentSearch(trimmed));
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
      setLoadingStep(0);
    }
  };

  // ── FIND SIMILAR ──
  const handleFindSimilar = async (product) => {
    const productId = product.id;
    if (!productId) return;
    setSimilarLoading(productId);

    const userMsg = {
      role: "user",
      content: `Find products similar to "${product.product_name}" by ${product.manufacturer_name}`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const data = await findSimilarProducts(productId, 12);
      const products = data.products || [];
      const assistantMsg = {
        role: "assistant",
        content: products.length > 0
          ? `Found ${products.length} similar products from different vendors.`
          : `No similar products found in the catalog.`,
        products: products.slice(0, 12),
        allProducts: products,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      if (products.length > 0) setResults(products);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Couldn't find similar products. Try refining your search.",
        timestamp: Date.now(),
      }]);
    } finally {
      setSimilarLoading(null);
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
    setResults([]);
    setIntent(null);
    setDiagnostics(null);
    setError(null);
    setRefining(false);
    setInputValue("");
    setFilters({});
    setFacets(null);
    setTotalAvailable(0);
    shownProductIds.current = new Set();
    pageRef.current = 1;
    lastQueryRef.current = "";
    window.history.replaceState({}, "", "/Search");
    inputRef.current?.focus();
  };

  const handleToggleCompare = (item) => {
    const { next } = toggleCompareItem(normalizeSearchResult(item));
    setCompareItems(next);
    trackProductCompare(item.id);
    trackStyleInteraction(item.id, "compare");
  };

  const handleInputChange = (value) => {
    setInputValue(value);
    clearTimeout(autocompleteTimer.current);
    if (value.trim().length >= 3) {
      autocompleteTimer.current = setTimeout(async () => {
        try {
          const data = await getAutocomplete(value.trim());
          setAutocompleteResults(data.suggestions || []);
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
    setVisualSearchLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        const data = await visualSearch(base64);
        if (data.description) {
          runSearch(data.description);
        }
        setVisualSearchLoading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setVisualSearchLoading(false);
    }
    e.target.value = "";
  };

  const handleChipClick = (chip) => {
    if (chip === "Show me more options") {
      // Use exclude-set pagination — send all shown IDs to get genuinely new results
      runSearch(lastQueryRef.current || inputValue, { showMore: true });
    } else {
      runSearch(chip);
    }
  };

  // Re-run search when filters change
  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    if (lastQueryRef.current) {
      shownProductIds.current = new Set();
      pageRef.current = 1;
      runSearch(lastQueryRef.current, { filters: newFilters, freshSearch: true });
    }
  };

  const handleAutocompleteSelect = (suggestion) => {
    setShowAutocomplete(false);
    runSearch(suggestion);
  };

  const intentTags = intent
    ? [
        intent.product_type?.replace(/_/g, " "),
        intent.style,
        intent.material,
        intent.color,
        intent.vendor,
        intent.max_price ? `Under $${intent.max_price.toLocaleString()}` : null,
      ].filter(Boolean)
    : [];

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────

  // Mode selector bar (shown for all modes)
  const modeSelector = (
    <div className="flex justify-center pt-5 pb-2 px-4">
      <div className="inline-flex glass-surface rounded-full p-1 gap-0.5">
        {MODE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeMode === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveMode(tab.key)}
              className={`px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] rounded-full transition-all flex items-center gap-2 ${
                isActive
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-white/30 hover:text-white/50 border border-transparent"
              }`}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  // Render Discover or Collections mode
  if (activeMode === "discover") {
    return (
      <div className="relative min-h-screen">
        {modeSelector}
        <DiscoverBrowser />
      </div>
    );
  }

  if (activeMode === "collections") {
    return (
      <div className="relative min-h-screen">
        {modeSelector}
        <CollectionBrowser />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Mode selector */}
      {modeSelector}

      {/* ── LANDING STATE (no conversation yet) ── */}
      {!hasConversation && !loading && (
        <div className="flex flex-col items-center justify-center min-h-[75vh] px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full max-w-2xl"
          >
            {/* Hero */}
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="h-px flex-1 max-w-[60px] bg-gradient-to-r from-transparent to-gold/30" />
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70">
                  AI-Powered Sourcing
                </span>
                <div className="h-px flex-1 max-w-[60px] bg-gradient-to-l from-transparent to-gold/30" />
              </div>
              <h1 className="font-display text-5xl md:text-6xl text-white mb-4" style={{ textShadow: "0 0 40px rgba(201,169,110,0.15)" }}>
                Find the perfect <span className="text-gold">piece</span>
              </h1>
              <p className="text-sm max-w-md mx-auto" style={{ color: "var(--warm-gray)" }}>
                Search like you'd describe it to a colleague. Natural language, trade terms, brand names — it all works.
              </p>
            </div>

            {/* Search input */}
            <form onSubmit={handleSubmit}>
              <div className="relative">
                <div className="search-bar-glow relative rounded-2xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl transition-all duration-300 focus-within:border-gold/20">
                  <div className="flex items-center">
                    <div className="ml-5 shrink-0"><div className="spec-diamond" /></div>
                    <input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onFocus={() => setShowAutocomplete(autocompleteResults.length > 0)}
                      onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                      placeholder='Try "walnut credenza" or "3 over 3 sofa in performance fabric"...'
                      className="h-16 w-full bg-transparent px-4 text-sm text-white/80 placeholder:text-white/20 outline-none"
                      autoFocus
                    />
                    <div className="flex items-center gap-1.5 pr-3">
                      {inputValue && (
                        <button
                          type="button"
                          onClick={() => { setInputValue(""); setAutocompleteResults([]); inputRef.current?.focus(); }}
                          className="flex h-8 w-8 items-center justify-center rounded-xl text-white/20 hover:bg-white/5 hover:text-white/40 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-white/20 hover:bg-white/5 hover:text-gold/50 transition-colors"
                        title="Visual search"
                      >
                        {visualSearchLoading ? <Loader2 className="h-4 w-4 animate-spin text-gold/60" /> : <Camera className="h-4 w-4" />}
                      </button>
                      <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className="btn-gold flex h-10 w-10 items-center justify-center rounded-xl transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleVisualSearch} />

                {/* Autocomplete */}
                <AutocompleteDropdown
                  show={showAutocomplete}
                  results={autocompleteResults}
                  onSelect={handleAutocompleteSelect}
                />
              </div>
            </form>

            {/* Example searches */}
            <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2">
              {EXAMPLE_SEARCHES.slice(0, 4).map((example, i) => (
                <span key={example} className="flex items-center gap-2">
                  {i > 0 && <span className="text-gold/30 text-xs">·</span>}
                  <button
                    onClick={() => runSearch(example)}
                    className="text-sm transition-colors hover:text-gold/70"
                    style={{ color: "var(--warm-gray)" }}
                  >
                    {example}
                  </button>
                </span>
              ))}
            </div>

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="h-px flex-1 max-w-[40px] bg-gradient-to-r from-transparent to-white/[0.06]" />
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/20 flex items-center gap-1.5">
                    <History className="h-3 w-3" /> Recent
                  </span>
                  <div className="h-px flex-1 max-w-[40px] bg-gradient-to-l from-transparent to-white/[0.06]" />
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {recentSearches.slice(0, 5).map((entry) => (
                    <button
                      key={entry}
                      onClick={() => runSearch(entry)}
                      className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 text-[11px] text-white/25 transition-all hover:border-gold/15 hover:text-gold/50"
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* ── CONVERSATION VIEW ── */}
      {(hasConversation || loading) && (
        <div className="flex flex-col h-screen">
          {/* Top bar */}
          <div className="shrink-0 border-b border-white/[0.04] bg-night/80 backdrop-blur-xl">
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="spec-diamond" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-gold/70">Sourcing Assistant</span>
                {diagnostics?.total_catalog_size && (
                  <span className="text-[10px] text-white/15">{diagnostics.total_catalog_size.toLocaleString()} products indexed</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {intentTags.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1.5">
                    {intentTags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-gold/10 border border-gold/15 px-2.5 py-0.5 text-[10px] font-medium text-gold/60 uppercase tracking-wider">{tag}</span>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleNewSearch}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] text-white/25 hover:bg-white/5 hover:text-gold/50 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" /> New search
                </button>
              </div>
            </div>
          </div>

          {/* Filters bar */}
          {facets && (
            <div className="shrink-0 border-b border-white/[0.04] bg-[#0a0a0f]/60">
              <div className="max-w-4xl mx-auto px-4 py-2">
                <SearchFilters
                  facets={facets}
                  filters={filters}
                  onFiltersChange={handleFiltersChange}
                  resultCount={results.length}
                  totalAvailable={totalAvailable}
                />
              </div>
            </div>
          )}

          {/* Chat messages */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <ChatMessage
                    key={msg.timestamp + "-" + i}
                    message={msg}
                    compareItems={compareItems}
                    onToggleCompare={handleToggleCompare}
                    onFindSimilar={handleFindSimilar}
                    similarLoading={similarLoading}
                    onProductSearch={(q) => runSearch(q)}
                  />
                ))}
              </AnimatePresence>

              {/* Loading indicator */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5" style={{ background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.15)" }}>
                    <div className="loading-emblem" style={{ width: 10, height: 10 }} />
                  </div>
                  <div className="pt-1">
                    <div className="flex items-center gap-2.5">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-gold/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span className="text-[11px] text-white/25">
                        {LOADING_STEPS[loadingStep]?.label || "Searching..."}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-3"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                  </div>
                  <p className="text-sm text-red-400/80 pt-1">{error}</p>
                </motion.div>
              )}

              {/* Refinement chips after assistant message */}
              {hasConversation && !loading && !refining && messages[messages.length - 1]?.role === "assistant" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="flex flex-wrap gap-2 pl-10"
                >
                  {REFINEMENT_CHIPS.slice(0, 4).map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleChipClick(chip)}
                      className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3.5 py-1.5 text-[11px] text-white/30 transition-all hover:border-gold/20 hover:text-gold/60 hover:bg-gold/5"
                    >
                      {chip}
                    </button>
                  ))}
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input bar (bottom) */}
          <div className="shrink-0 border-t border-white/[0.04] bg-night/80 backdrop-blur-xl">
            <div className="max-w-4xl mx-auto px-4 py-3">
              <form onSubmit={handleSubmit} className="relative">
                <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.03] transition-all focus-within:border-gold/20 focus-within:shadow-[0_0_20px_rgba(201,169,110,0.05)]">
                  <div className="flex items-center">
                    <input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onFocus={() => setShowAutocomplete(autocompleteResults.length > 0)}
                      onBlur={() => setTimeout(() => setShowAutocomplete(false), 200)}
                      placeholder={hasConversation ? "Refine your search or ask a follow-up..." : "Describe what you're looking for..."}
                      className="h-12 w-full bg-transparent pl-4 pr-28 text-sm text-white/80 placeholder:text-white/20 outline-none"
                      disabled={loading || refining}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white/20 hover:bg-white/5 hover:text-gold/50 transition-colors"
                      >
                        {visualSearchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-gold/60" /> : <Camera className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="submit"
                        disabled={loading || refining || !inputValue.trim()}
                        className="btn-gold flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleVisualSearch} />

                <AutocompleteDropdown
                  show={showAutocomplete}
                  results={autocompleteResults}
                  onSelect={handleAutocompleteSelect}
                  position="above"
                />
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Compare Tray */}
      <AnimatePresence>
        {compareItems.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-16 inset-x-0 z-50 glass-surface border-t border-gold/10"
            style={{ borderRadius: 0 }}
          >
            <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1 overflow-x-auto">
                {compareItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 rounded-lg border border-gold/10 bg-gold/5 px-2.5 py-1.5 shrink-0">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" className="h-7 w-7 rounded object-cover" />
                    ) : (
                      <div className="h-7 w-7 rounded bg-gold/10 flex items-center justify-center text-[10px] text-gold/50 font-display">
                        {(item.manufacturer_name || "?")[0]}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-[11px] text-white/70 truncate max-w-[100px]">{item.product_name}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-white/20">{compareItems.length}/6</span>
                <button
                  onClick={() => navigate(createPageUrl("Compare"))}
                  disabled={compareItems.length < 2}
                  className="btn-gold flex items-center gap-1.5 h-8 px-4 rounded-lg text-[11px] font-semibold disabled:opacity-30"
                >
                  <GitCompare className="h-3 w-3" /> Compare
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CHAT MESSAGE ──────────────────────────────────────────────
function ChatMessage({ message, compareItems, onToggleCompare, onFindSimilar, similarLoading, onProductSearch }) {
  const [showAll, setShowAll] = useState(false);
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end"
      >
        <div className="max-w-[75%] rounded-2xl rounded-br-md px-4 py-2.5" style={{ background: "rgba(201,169,110,0.08)", border: "1px solid rgba(201,169,110,0.12)" }}>
          <p className="text-sm text-white/80">{message.content}</p>
        </div>
      </motion.div>
    );
  }

  const displayProducts = showAll
    ? (message.allProducts || message.products || [])
    : (message.products || []);
  const hiddenCount = (message.allProducts?.length || 0) - (message.products?.length || 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start gap-3"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5" style={{ background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.15)" }}>
        <div className="spec-diamond" />
      </div>
      <div className="flex-1 min-w-0 space-y-4">
        {/* Text response — gold left border accent */}
        <div className="border-l-2 border-gold/20 pl-3">
          <p className="text-sm leading-relaxed" style={{ color: "var(--warm-gray)" }}>{message.content}</p>
        </div>

        {/* Product cards grid */}
        {displayProducts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {displayProducts.map((item, idx) => (
              <ProductCard
                key={item.id || idx}
                item={item}
                index={idx}
                isCompared={compareItems.some((c) => c.id === item.id)}
                onToggleCompare={() => onToggleCompare(item)}
                onFindSimilar={() => onFindSimilar(item)}
                similarLoading={similarLoading === item.id}
              />
            ))}
          </div>
        )}

        {/* Show all / collapse toggle */}
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-[11px] text-gold/50 hover:text-gold/80 transition-colors"
          >
            {showAll ? "Show fewer" : `+ ${hiddenCount} more results`}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── PRODUCT CARD ──────────────────────────────────────────────
function ProductCard({ item, index, isCompared, onToggleCompare, onFindSimilar, similarLoading }) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const price = item.retail_price || item.wholesale_price;
  const priceStr = price ? `$${Number(price).toLocaleString()}` : null;
  const materialStyle = [item.material, item.style].filter(Boolean).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.48), ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="product-card group cursor-pointer"
      onClick={() => {
        if (item.portal_url) {
          trackProductClick(item.id, item.manufacturer_name);
          trackStyleInteraction(item.id, "click");
          window.open(item.portal_url, "_blank");
        }
      }}
    >
      {/* Image — sharp edges, no radius, editorial feel */}
      <div className="relative aspect-[4/3] overflow-hidden bg-white/[0.02]">
        {item.image_url && !imgError ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="loading-emblem" style={{ width: 12, height: 12 }} />
              </div>
            )}
            <img
              src={item.image_url}
              alt={item.product_name}
              className={`h-full w-full object-cover transition-all duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"} ${hovered ? "scale-[1.04]" : "scale-100"}`}
              style={{ transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)" }}
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
            />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/10">
            <div className="text-3xl font-display">{(item.manufacturer_name || "?")[0]}</div>
            <span className="text-[10px] px-3 text-center line-clamp-2 text-white/15">{item.product_name}</span>
          </div>
        )}

        {/* Compare button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCompare(); }}
          className={`absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-lg transition-all backdrop-blur-sm ${
            isCompared
              ? "bg-gold/90 text-black"
              : "bg-black/40 text-white/40 opacity-0 group-hover:opacity-100 hover:bg-black/60"
          }`}
        >
          {isCompared ? <Check className="h-3 w-3" /> : <GitCompare className="h-3 w-3" />}
        </button>
      </div>

      {/* Gold hairline */}
      <div className="h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

      {/* Card meta */}
      <div className="card-meta p-3 pb-2.5">
        {/* Vendor name — gold caps */}
        <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-gold/70 mb-1 truncate">
          {item.manufacturer_name}
        </div>
        {/* Product name — display serif */}
        <h3 className="font-display text-[15px] leading-snug text-white/90 line-clamp-2 mb-1.5">
          {item.product_name}
        </h3>
        {/* Material · Style */}
        {materialStyle && (
          <div className="text-[11px] text-white/25 truncate mb-1.5">{materialStyle}</div>
        )}
        {/* Price + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {priceStr && (
            <span className="text-[12px] font-semibold text-gold/80">{priceStr}</span>
          )}
          {item.fit_score && (
            <FitScoreBadge
              fit={item.fit_score.fit}
              score={item.fit_score.score}
              reason={item.fit_score.reason}
            />
          )}
        </div>
        {item.material_badges && item.material_badges.length > 0 && (
          <div className="mt-1.5">
            <MaterialBadges badges={item.material_badges.slice(0, 3)} />
          </div>
        )}
      </div>

      {/* Hover link — slides in from right */}
      <div className="card-link px-3 pb-2.5 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onFindSimilar(); }}
            disabled={similarLoading}
            className="flex items-center gap-1 rounded-md bg-white/[0.04] px-2 py-1 text-[10px] text-white/30 hover:bg-white/[0.08] hover:text-white/50 transition-colors disabled:opacity-40"
          >
            {similarLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Layers className="h-2.5 w-2.5" />}
            Similar
          </button>
          <AddToProjectMenu product={item} size="sm" />
        </div>
        {item.portal_url && (
          <span className="text-[10px] font-medium text-gold/60 flex items-center gap-1">
            View at {(item.manufacturer_name || "vendor").split(" ")[0]} <ArrowRight className="h-2.5 w-2.5" />
          </span>
        )}
      </div>

      {/* Bottom actions (hover) - HIDDEN, replaced by inline hover */}
      <AnimatePresence>
        {false && (
          <motion.div></motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── AUTOCOMPLETE DROPDOWN ─────────────────────────────────────
function AutocompleteDropdown({ show, results, onSelect, position = "below" }) {
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
          {results.map((suggestion, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => onSelect(suggestion)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/[0.04] hover:text-white/70"
            >
              <Search className="h-3 w-3 text-white/15 shrink-0" />
              {suggestion}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
