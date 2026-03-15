import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";

function FilterGroup({ label, items, selected, onToggle, maxVisible = 6 }) {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  const visible = expanded ? items : items.slice(0, maxVisible);
  const hasMore = items.length > maxVisible;

  return (
    <div className="py-3 border-b border-white/[0.04] last:border-b-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">
        {label}
      </p>
      <div className="space-y-1">
        {visible.map((item) => {
          const isActive = selected.includes(item.value);
          return (
            <button
              key={item.value}
              onClick={() => onToggle(item.value)}
              className={`flex items-center justify-between w-full rounded px-2 py-1 text-xs transition-all ${
                isActive
                  ? "bg-gold/10 text-gold border border-gold/20"
                  : "text-white/50 hover:text-white/70 hover:bg-white/[0.03] border border-transparent"
              }`}
            >
              <span className="truncate">{item.value}</span>
              <span className={`text-[10px] ml-2 flex-shrink-0 ${isActive ? "text-gold/70" : "text-white/20"}`}>
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 mt-1.5 text-[10px] text-white/30 hover:text-white/50 transition-colors"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Show less" : `+${items.length - maxVisible} more`}
        </button>
      )}
    </div>
  );
}

function PriceRangeFilter({ items, selected, onToggle }) {
  if (!items || items.length === 0) return null;
  // Sort price ranges in order
  const order = ["Under $500", "$500 – $1,000", "$1,000 – $2,000", "$2,000 – $5,000", "Over $5,000"];
  const sorted = [...items].sort((a, b) => order.indexOf(a.value) - order.indexOf(b.value));
  return <FilterGroup label="Price Range" items={sorted} selected={selected} onToggle={onToggle} maxVisible={5} />;
}

export default function SearchFilters({ facets, filters, onFiltersChange, resultCount, totalAvailable }) {
  const [open, setOpen] = useState(false);

  if (!facets) return null;

  const activeFilters = [];
  for (const [key, values] of Object.entries(filters)) {
    if (Array.isArray(values)) {
      for (const v of values) activeFilters.push({ key, value: v });
    }
  }

  const toggleFilter = (dimension, value) => {
    const current = filters[dimension] || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onFiltersChange({ ...filters, [dimension]: updated });
  };

  const clearAll = () => {
    onFiltersChange({});
  };

  const hasActiveFilters = activeFilters.length > 0;

  return (
    <div>
      {/* Toggle button + active filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all border ${
            open || hasActiveFilters
              ? "border-gold/30 bg-gold/10 text-gold"
              : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60"
          }`}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 rounded-full bg-gold/20 px-1.5 text-[10px] text-gold/70">
              {activeFilters.length}
            </span>
          )}
        </button>

        {/* Active filter chips */}
        <AnimatePresence>
          {activeFilters.map(({ key, value }) => (
            <motion.button
              key={`${key}:${value}`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => toggleFilter(key, value)}
              className="flex items-center gap-1 rounded-full border border-gold/20 bg-gold/5 px-2 py-1 text-[10px] text-gold hover:bg-gold/10 transition-all"
            >
              <span className="truncate max-w-[120px]">{value}</span>
              <X className="h-2.5 w-2.5 flex-shrink-0" />
            </motion.button>
          ))}
        </AnimatePresence>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
          >
            Clear all
          </button>
        )}

        {/* Result counter */}
        {totalAvailable > 0 && (
          <span className="text-[10px] text-white/20 ml-auto">
            {resultCount} of {totalAvailable} results
          </span>
        )}
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-xl border border-white/[0.06] glass-surface p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <FilterGroup
                  label="Category"
                  items={facets.category}
                  selected={filters.categories || []}
                  onToggle={(v) => toggleFilter("categories", v)}
                />
                <FilterGroup
                  label="Material"
                  items={facets.material}
                  selected={filters.materials || []}
                  onToggle={(v) => toggleFilter("materials", v)}
                />
                <FilterGroup
                  label="Vendor"
                  items={facets.vendor}
                  selected={filters.vendors || []}
                  onToggle={(v) => toggleFilter("vendors", v)}
                />
                <FilterGroup
                  label="Style"
                  items={facets.style}
                  selected={filters.styles || []}
                  onToggle={(v) => toggleFilter("styles", v)}
                />
                <PriceRangeFilter
                  items={facets.price_range}
                  selected={filters.price_ranges || []}
                  onToggle={(v) => toggleFilter("price_ranges", v)}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
