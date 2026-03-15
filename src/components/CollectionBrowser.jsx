import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Search, ArrowLeft,
  Loader2, ImageOff, Sparkles, Filter, X, GitCompare
} from "lucide-react";
import { toggleCompareItem, normalizeSearchResult, getCompareItems } from "@/lib/growth-store";
import AddToProjectMenu from "@/components/AddToProjectMenu";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

function CollectionCard({ collection, onClick }) {
  const sampleImages = collection.sample_images || [];
  const categories = (collection.categories || []).slice(0, 3);
  const materials = (collection.materials || []).slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      onClick={onClick}
      className="rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 cursor-pointer overflow-hidden p-4"
    >
      {/* Sample images row */}
      {sampleImages.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {sampleImages.slice(0, 4).map((img, i) => (
            <div key={i} className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.04]">
              <img
                src={img}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Collection name */}
      <h3 className="text-sm font-bold text-white line-clamp-1">{collection.name}</h3>

      {/* Vendor name */}
      {collection.vendor_name && (
        <p className="text-xs text-white/40 mt-0.5">{collection.vendor_name}</p>
      )}

      {/* Product count badge */}
      <div className="flex items-center gap-2 mt-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/[0.06] text-[11px] text-white/60">
          {collection.product_count || 0} pieces
        </span>
      </div>

      {/* Category pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {categories.map((cat, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full bg-gold/10 text-gold/70 text-[10px] border border-gold/20"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Price range */}
      {(collection.min_price != null || collection.max_price != null) && (
        <p className="text-xs text-white/50 mt-2">
          ${(collection.min_price || 0).toLocaleString()} &mdash; ${(collection.max_price || 0).toLocaleString()}
        </p>
      )}

      {/* Materials */}
      {materials.length > 0 && (
        <p className="text-[10px] text-white/30 mt-1.5 line-clamp-1">
          {materials.join(" / ")}
        </p>
      )}
    </motion.div>
  );
}

function ProductCard({ product, compareItems, onToggleCompare }) {
  const navigate = useNavigate();
  const isCompared = compareItems.some(c => c.id === product.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="break-inside-avoid mb-3 group relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02] cursor-pointer"
      onClick={() => navigate(createPageUrl("Search") + `?q=${encodeURIComponent(product.product_name || product.name || "")}`)}
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.product_name || product.name || "Product"}
          className="w-full object-cover"
          style={{ minHeight: 160 }}
          loading="lazy"
          onError={(e) => { e.target.style.display = "none"; }}
        />
      ) : (
        <div className="w-full flex items-center justify-center bg-white/[0.04]" style={{ minHeight: 200 }}>
          <ImageOff className="w-10 h-10 text-white/20" />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
        <p className="text-sm text-white font-medium line-clamp-2">{product.product_name || product.name}</p>
        {product.manufacturer_name && (
          <p className="text-xs text-white/50 mt-0.5">{product.manufacturer_name}</p>
        )}
        {(product.wholesale_price || product.retail_price) && (
          <p className="text-sm text-white mt-1">
            ${(product.wholesale_price || product.retail_price || 0).toLocaleString()}
          </p>
        )}

        <div className="flex items-center gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onToggleCompare(product)}
            className={`p-1.5 rounded-lg transition-colors ${isCompared ? "bg-gold/80 text-white" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
            title="Compare"
          >
            <GitCompare className="w-3.5 h-3.5" />
          </button>
          <AddToProjectMenu product={product} size="sm" />
        </div>
      </div>
    </motion.div>
  );
}

function ColorPaletteBar({ products }) {
  const colorCounts = {};
  (products || []).forEach(p => {
    const color = (p.color || p.primary_color || "").trim().toLowerCase();
    if (color) {
      colorCounts[color] = (colorCounts[color] || 0) + 1;
    }
  });

  const sorted = Object.entries(colorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (sorted.length === 0) return null;

  const colorMap = {
    black: "#1a1a1a", white: "#f5f5f5", brown: "#8B4513", beige: "#D4C5A9",
    gray: "#808080", grey: "#808080", blue: "#4169E1", navy: "#000080",
    green: "#2E8B57", red: "#B22222", gold: "#DAA520", silver: "#C0C0C0",
    cream: "#FFFDD0", tan: "#D2B48C", natural: "#C2A878", walnut: "#5C4033",
    oak: "#B8860B", espresso: "#3C1414", ivory: "#FFFFF0", charcoal: "#36454F",
    pink: "#DE98AB", orange: "#CC6633", yellow: "#DAA520", purple: "#673147",
    brass: "#B5A642", chrome: "#C0C0C0", copper: "#B87333", bronze: "#CD7F32",
  };

  const resolveColor = (name) => {
    const lower = name.toLowerCase();
    for (const [key, val] of Object.entries(colorMap)) {
      if (lower.includes(key)) return val;
    }
    return "#6B7280";
  };

  return (
    <div className="mb-6">
      <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2">Dominant Colors</h4>
      <div className="flex items-center gap-1 h-6 rounded-lg overflow-hidden">
        {sorted.map(([color, count], i) => (
          <div
            key={i}
            className="h-full flex-1 group relative"
            style={{ backgroundColor: resolveColor(color), flex: count }}
            title={`${color} (${count})`}
          >
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium text-white/0 group-hover:text-white/90 transition-colors drop-shadow-sm">
              {color}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CollectionBrowser() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const collectionParam = searchParams.get("collection");
  const vendorParam = searchParams.get("vendor");
  const isDetail = collectionParam && vendorParam;

  // List view state
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorFilter, setVendorFilter] = useState("");
  const [searchFilter, setSearchFilter] = useState("");

  // Detail view state
  const [detailProducts, setDetailProducts] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailInfo, setDetailInfo] = useState(null);

  // Compare
  const [compareItems, setCompareItems] = useState([]);

  useEffect(() => {
    setCompareItems(getCompareItems());
  }, []);

  // Fetch collections list
  useEffect(() => {
    if (isDetail) return;
    setLoading(true);
    fetch(`${SEARCH_URL}/collections`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setCollections(data.collections || []);
      })
      .catch(() => {
        setCollections([]);
      })
      .finally(() => setLoading(false));
  }, [isDetail]);

  // Fetch collection detail
  useEffect(() => {
    if (!isDetail) return;
    setDetailLoading(true);
    setDetailProducts([]);
    setDetailInfo(null);

    const encoded = encodeURIComponent(collectionParam);
    fetch(`${SEARCH_URL}/collections/${encoded}?vendor=${encodeURIComponent(vendorParam)}`)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const products = data.products || data || [];
        setDetailProducts(Array.isArray(products) ? products : []);
        setDetailInfo(data.collection || data.info || null);
      })
      .catch(() => {
        setDetailProducts([]);
      })
      .finally(() => setDetailLoading(false));
  }, [isDetail, collectionParam, vendorParam]);

  const handleToggleCompare = (product) => {
    const normalized = normalizeSearchResult(product);
    const { next } = toggleCompareItem(normalized);
    setCompareItems(next);
  };

  // Unique vendors for filter dropdown
  const uniqueVendors = [];
  const seenVendors = new Set();
  collections.forEach(c => {
    const vid = c.vendor_id || c.vendor_name;
    if (vid && !seenVendors.has(vid)) {
      seenVendors.add(vid);
      uniqueVendors.push({ id: c.vendor_id, name: c.vendor_name || c.vendor_id });
    }
  });

  // Filtered collections
  const filtered = collections.filter(c => {
    const matchSearch = !searchFilter || (c.name || "").toLowerCase().includes(searchFilter.toLowerCase());
    const matchVendor = !vendorFilter || c.vendor_id === vendorFilter || c.vendor_name === vendorFilter;
    return matchSearch && matchVendor;
  });

  // Detail stats
  const detailCategories = [...new Set(detailProducts.flatMap(p => [p.category, p.product_type].filter(Boolean)))];
  const detailMaterials = [...new Set(detailProducts.flatMap(p => (p.materials || [p.material]).filter(Boolean)))];
  const detailPrices = detailProducts
    .map(p => p.wholesale_price || p.retail_price || 0)
    .filter(p => p > 0);
  const detailMinPrice = detailPrices.length ? Math.min(...detailPrices) : 0;
  const detailMaxPrice = detailPrices.length ? Math.max(...detailPrices) : 0;

  // Find the matching collection info from our list
  const matchedCollection = collections.find(
    c => c.name === collectionParam && (c.vendor_id === vendorParam || c.vendor_name === vendorParam)
  );

  const handleFindSimilar = () => {
    const topMaterials = detailMaterials.slice(0, 3).join(" ");
    const topCategories = detailCategories.slice(0, 2).join(" ");
    const query = [topMaterials, topCategories].filter(Boolean).join(" ");
    if (query) {
      navigate(createPageUrl("Search") + `?q=${encodeURIComponent(query)}`);
    }
  };

  // --- DETAIL VIEW ---
  if (isDetail) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => {
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete("collection");
              next.delete("vendor");
              return next;
            });
          }}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/80 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          All Collections
        </motion.button>

        {/* Collection heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-display font-bold tracking-tight mb-1">{collectionParam}</h1>
          {(detailInfo?.vendor_name || matchedCollection?.vendor_name) && (
            <p className="text-white/40 text-sm">
              {detailInfo?.vendor_name || matchedCollection?.vendor_name}
            </p>
          )}
        </motion.div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
            <span className="ml-3 text-white/50">Loading collection...</span>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
            >
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Products</p>
                <p className="text-lg font-semibold text-white mt-0.5">{detailProducts.length}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Categories</p>
                <p className="text-sm font-medium text-white mt-1 line-clamp-1">{detailCategories.slice(0, 3).join(", ") || "--"}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Price Range</p>
                <p className="text-sm font-medium text-white mt-1">
                  {detailPrices.length > 0
                    ? `$${detailMinPrice.toLocaleString()} - $${detailMaxPrice.toLocaleString()}`
                    : "--"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider">Materials</p>
                <p className="text-sm font-medium text-white mt-1 line-clamp-1">{detailMaterials.slice(0, 3).join(", ") || "--"}</p>
              </div>
            </motion.div>

            {/* Color palette bar */}
            <ColorPaletteBar products={detailProducts} />

            {/* Products masonry grid */}
            {detailProducts.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
                  {detailProducts.map((product, idx) => (
                    <ProductCard
                      key={product.id || idx}
                      product={product}
                      compareItems={compareItems}
                      onToggleCompare={handleToggleCompare}
                    />
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-white/30">
                <ImageOff className="w-10 h-10 mb-3" />
                <p className="text-sm">No products found in this collection</p>
              </div>
            )}

            {/* Find similar collections */}
            {detailProducts.length > 0 && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={handleFindSimilar}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white/80 text-sm font-medium transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  Find similar collections
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // --- COLLECTION LIST VIEW ---
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Package className="w-6 h-6 text-gold" />
          <h1 className="text-3xl font-display font-bold tracking-tight">Collections</h1>
        </div>
        <p className="text-white/50 text-lg">Browse curated vendor collections</p>
      </motion.div>

      {/* Filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8"
      >
        {/* Search input */}
        <div className="relative flex-1 w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search collections..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white placeholder-white/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Vendor filter dropdown */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="appearance-none pl-10 pr-8 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-all cursor-pointer"
          >
            <option value="">All Vendors</option>
            {uniqueVendors.map((v) => (
              <option key={v.id || v.name} value={v.id || v.name}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        {/* Active filter indicator */}
        {(searchFilter || vendorFilter) && (
          <button
            onClick={() => { setSearchFilter(""); setVendorFilter(""); }}
            className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear filters
          </button>
        )}
      </motion.div>

      {/* Loading state */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
          <span className="ml-3 text-white/50">Loading collections...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-white/30">
          <Package className="w-10 h-10 mb-3" />
          <p className="text-sm">
            {collections.length === 0
              ? "No collections available"
              : "No collections match your filters"}
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs text-white/30 mb-4">
            {filtered.length} collection{filtered.length !== 1 ? "s" : ""}
          </p>

          {/* Collections grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((collection, idx) => (
                <CollectionCard
                  key={`${collection.vendor_id}-${collection.name}-${idx}`}
                  collection={collection}
                  onClick={() => {
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set("collection", collection.name);
                      next.set("vendor", collection.vendor_id || collection.vendor_name || "");
                      return next;
                    });
                  }}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
