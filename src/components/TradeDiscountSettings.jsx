import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Percent, Save, ChevronDown, ChevronRight, Search } from "lucide-react";
import { useTradePricing } from "@/lib/TradePricingContext";

// Vendor list for the settings panel — sorted alphabetically
const COMMON_VENDORS = [
  { id: "arteriors", name: "Arteriors" },
  { id: "baker", name: "Baker Furniture" },
  { id: "bernhardt", name: "Bernhardt" },
  { id: "caracole", name: "Caracole" },
  { id: "century", name: "Century Furniture" },
  { id: "cr-laine", name: "CR Laine" },
  { id: "currey", name: "Currey & Company" },
  { id: "flexsteel", name: "Flexsteel" },
  { id: "fourhands", name: "Four Hands" },
  { id: "gabby", name: "Gabby" },
  { id: "hickory-chair", name: "Hickory Chair" },
  { id: "hooker", name: "Hooker Furniture" },
  { id: "lee-industries", name: "Lee Industries" },
  { id: "lexington", name: "Lexington Home Brands" },
  { id: "loloi", name: "Loloi Rugs" },
  { id: "made-goods", name: "Made Goods" },
  { id: "noir", name: "Noir Furniture" },
  { id: "palecek", name: "Palecek" },
  { id: "sherrill", name: "Sherrill Furniture" },
  { id: "stickley", name: "Stickley" },
  { id: "surya", name: "Surya" },
  { id: "theodore-alexander", name: "Theodore Alexander" },
  { id: "universal", name: "Universal Furniture" },
  { id: "uttermost", name: "Uttermost" },
  { id: "vanguard", name: "Vanguard Furniture" },
  { id: "visual-comfort", name: "Visual Comfort" },
];

export default function TradeDiscountSettings({ open, onClose }) {
  const { discounts, setVendorDiscount, setDefaultDiscount } = useTradePricing();
  const [defaultVal, setDefaultVal] = useState(discounts.default_discount || "");
  const [vendorVals, setVendorVals] = useState({});
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (open) {
      setDefaultVal(discounts.default_discount || "");
      const v = {};
      for (const vendor of COMMON_VENDORS) {
        v[vendor.id] = discounts.vendors?.[vendor.id] ?? "";
      }
      // Also include any custom vendor entries
      if (discounts.vendors) {
        for (const [id, val] of Object.entries(discounts.vendors)) {
          if (!(id in v)) v[id] = val;
        }
      }
      setVendorVals(v);
    }
  }, [open, discounts]);

  const handleDefaultSave = () => {
    const num = parseFloat(defaultVal) || 0;
    setDefaultDiscount(Math.min(99, Math.max(0, num)));
  };

  const handleVendorSave = (vendorId, value) => {
    const num = parseFloat(value) || 0;
    if (num > 0) {
      setVendorDiscount(vendorId, Math.min(99, Math.max(0, num)));
    } else {
      // Remove vendor-specific discount (falls back to default)
      setVendorDiscount(vendorId, 0);
    }
  };

  const filteredVendors = COMMON_VENDORS.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.id.includes(search.toLowerCase())
  );

  const displayVendors = showAll ? filteredVendors : filteredVendors.slice(0, 10);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 30, stiffness: 400 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[81] w-full max-w-lg max-h-[85vh] rounded-2xl border border-white/[0.08] shadow-2xl flex flex-col"
            style={{ background: "rgba(12, 13, 20, 0.98)", backdropFilter: "blur(40px)" }}
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <Percent className="h-5 w-5 text-emerald-400/70" />
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide">TRADE DISCOUNTS</h2>
                  <p className="text-[10px] text-white/30 mt-0.5">Your discounts are private and stored locally</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 scrollbar-thin">
              {/* Default discount */}
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-2">
                  Default Discount (all vendors)
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="99"
                    value={defaultVal}
                    onChange={(e) => setDefaultVal(e.target.value)}
                    onBlur={handleDefaultSave}
                    onKeyDown={(e) => { if (e.key === "Enter") handleDefaultSave(); }}
                    placeholder="e.g. 45"
                    className="w-24 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-emerald-400/30 placeholder:text-white/15"
                  />
                  <span className="text-xs text-white/30">%</span>
                  <span className="text-[10px] text-white/20 flex-1">
                    Applied to vendors without a specific discount below
                  </span>
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-white/[0.06]" />

              {/* Per-vendor discounts */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">
                    Per-Vendor Overrides
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search vendors..."
                      className="w-40 bg-white/[0.04] border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-white placeholder:text-white/15 focus:outline-none focus:border-emerald-400/20"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  {displayVendors.map((vendor) => (
                    <div key={vendor.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                      <span className="flex-1 text-xs text-white/60">{vendor.name}</span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={vendorVals[vendor.id] ?? ""}
                          onChange={(e) => setVendorVals(prev => ({ ...prev, [vendor.id]: e.target.value }))}
                          onBlur={(e) => handleVendorSave(vendor.id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleVendorSave(vendor.id, e.target.value); }}
                          placeholder={String(discounts.default_discount || "—")}
                          className="w-16 bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-emerald-400/30 placeholder:text-white/10"
                        />
                        <span className="text-[10px] text-white/20">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredVendors.length > 10 && !showAll && (
                  <button
                    onClick={() => setShowAll(true)}
                    className="flex items-center gap-1.5 text-[10px] text-white/25 hover:text-white/50 mt-2 transition-colors"
                  >
                    <ChevronDown className="h-3 w-3" />
                    Show all {filteredVendors.length} vendors
                  </button>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-3 border-t border-white/[0.06]">
              <p className="text-[10px] text-white/15 text-center">
                Discounts are estimates only. Confirm actual trade pricing with each vendor.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
