import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Package, Clock, ArrowRight, Building2 } from "lucide-react";
import { motion } from "framer-motion";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

const STAGGER = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function VendorCard({ vendor, index }) {
  const [heroImg, setHeroImg] = useState(null);
  const [hoverImg, setHoverImg] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    fetch(`${SEARCH_URL}/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: vendor.name, max_vendors: 1, per_vendor: 4 }),
    })
      .then((r) => r.json())
      .then((data) => {
        const withImages = (data.products || []).filter((p) => p.image_url);
        if (withImages.length > 0) setHeroImg(withImages[0].image_url);
        if (withImages.length > 1) setHoverImg(withImages[1].image_url);
      })
      .catch(() => {});
  }, [vendor.name]);

  return (
    <motion.div variants={FADE_UP}>
      <Link
        to={`${createPageUrl("Search")}?q=${encodeURIComponent(vendor.name)}`}
        className="block group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Large hero image — museum style */}
        <div className="relative aspect-[16/10] rounded-2xl overflow-hidden bg-white/[0.02] border border-white/[0.06] mb-4 transition-all duration-300 group-hover:border-gold/15 group-hover:shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_20px_rgba(79,107,255,0.04)]">
          {heroImg ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 skeleton" />
              )}
              <img
                src={heroImg}
                alt={vendor.name}
                className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                  hovered && hoverImg ? "opacity-0 scale-[1.03]" : "opacity-100 scale-100"
                } ${imgLoaded ? "" : "opacity-0"}`}
                onLoad={() => setImgLoaded(true)}
              />
              {hoverImg && (
                <img
                  src={hoverImg}
                  alt={vendor.name}
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                    hovered ? "opacity-100 scale-100" : "opacity-0 scale-95"
                  }`}
                />
              )}
              {/* Bottom gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090E]/80 via-transparent to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span
                className="font-display text-7xl text-white/[0.04]"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                {vendor.name[0]}
              </span>
            </div>
          )}

          {/* SKU count badge */}
          <div className="absolute top-3 right-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-black/50 backdrop-blur-sm px-2.5 py-1 text-[10px] text-white/50">
              <Package className="w-3 h-3" />
              {(vendor.active_skus || vendor.product_count || 0).toLocaleString()} products
            </div>
          </div>

          {/* Browse prompt on hover */}
          <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="flex items-center gap-1.5 rounded-lg bg-gold/90 px-3 py-1.5 text-[11px] font-semibold text-white">
              Browse <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* Card text — clean, editorial */}
        <div className="px-1">
          <h3
            className="text-xl text-white/90 mb-1 group-hover:text-gold transition-colors"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            {vendor.name}
          </h3>

          <div className="flex items-center gap-3 text-[11px] text-white/30 mb-2">
            {vendor.headquarters && (
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {vendor.headquarters}
              </span>
            )}
            {vendor.lead_time_min_weeks && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" /> {vendor.lead_time_min_weeks}–{vendor.lead_time_max_weeks} wks
              </span>
            )}
          </div>

          {vendor.description && (
            <p className="text-xs text-white/30 leading-relaxed line-clamp-2 mb-3">
              {vendor.description}
            </p>
          )}

          {vendor.categories?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {vendor.categories.slice(0, 4).map((c, i) => (
                <span
                  key={i}
                  className="filter-chip text-[10px] capitalize"
                  style={{ padding: "3px 10px" }}
                >
                  {c.replace(/_/g, " ")}
                </span>
              ))}
              {vendor.categories.length > 4 && (
                <span className="text-[10px] text-white/15 self-center ml-1">
                  +{vendor.categories.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export default function Manufacturers() {
  const [manufacturers, setManufacturers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${SEARCH_URL}/vendors`)
      .then((r) => r.json())
      .then((data) => {
        if (data.vendors?.length > 0) {
          setManufacturers(data.vendors);
        }
        setLoading(false);
      })
      .catch(() => {
        import("@/api/base44Client").then(({ base44 }) => {
          base44.entities.Manufacturer.filter({ status: "active" })
            .then((m) => { setManufacturers(m); setLoading(false); })
            .catch(() => setLoading(false));
        });
      });
  }, []);

  const filtered = manufacturers.filter(
    (m) =>
      (m.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.headquarters || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalSKUs = manufacturers.reduce((s, m) => s + (m.active_skus || m.product_count || 0), 0);

  return (
    <div className="min-h-screen py-10 md:py-14">
      <div className="page-wrap max-w-6xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="section-label text-gold">Trade Partners</span>
          </div>
          <h1
            className="text-4xl md:text-5xl text-white/90 tracking-tight mb-3"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Manufacturers
          </h1>
          <p className="text-sm text-white/30">
            {manufacturers.length} vendors · {totalSKUs.toLocaleString()} products indexed
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="mb-8 max-w-md"
        >
          <div className="search-bar-glow flex items-center h-11 rounded-xl bg-white/[0.03] px-4 gap-3">
            <Search className="h-4 w-4 text-white/20 shrink-0" />
            <input
              placeholder="Filter vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 outline-none"
            />
            {search && (
              <span className="text-[10px] text-white/20">{filtered.length} found</span>
            )}
          </div>
        </motion.div>

        {/* Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[16/10] rounded-2xl skeleton mb-4" />
                <div className="skeleton h-5 w-40 mb-2 mx-1" />
                <div className="skeleton h-3 w-24 mx-1" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-white/30 text-sm">
              {search ? `No vendors matching "${search}"` : "No vendors found"}
            </p>
          </div>
        ) : (
          <motion.div
            variants={STAGGER}
            initial="hidden"
            animate="visible"
            className="grid md:grid-cols-2 xl:grid-cols-3 gap-8"
          >
            {filtered.map((m) => (
              <VendorCard key={m.id || m.name} vendor={m} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
