import { useState, useCallback } from "react";
import {
  Layout,
  Grid3X3,
  FileText,
  Building2,
  Plus,
  X,
  Download,
  Sparkles,
  ImageOff,
  ExternalLink,
  Palette,
  Type,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { generateQuotePdf } from "@/lib/quote-generator";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

const TEMPLATES = [
  { id: "mood-board", label: "Mood Board", icon: Layout },
  { id: "spec-sheet", label: "Product Spec Sheet", icon: FileText },
  { id: "room-concept", label: "Room Concept", icon: Grid3X3 },
  { id: "vendor-comparison", label: "Vendor Comparison", icon: Building2 },
];

async function fetchPresentationData(products) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(
      `${searchServiceUrl.replace(/\/$/, "")}/presentation`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ products }),
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data.presentation;
  } catch {
    return null;
  }
}

/* --- Template Renderers --- */

function MoodBoardLayout({ selectedProducts, presentation }) {
  const moodKeywords = presentation?.mood_keywords || [];
  const sizes = ["tall", "wide", "normal", "tall", "normal", "wide"];
  return (
    <div className="space-y-4">
      {moodKeywords.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {moodKeywords.map((kw, i) => (
            <span
              key={i}
              className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs uppercase tracking-wider"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
      <div className="columns-2 md:columns-3 gap-4 space-y-4">
        {selectedProducts.map((product, i) => {
          const sizeClass = sizes[i % sizes.length];
          const presProduct = presentation?.products?.find(
            (p) => p.id === product.id
          );
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`break-inside-avoid rounded-xl overflow-hidden border border-white/10 bg-[#141420] relative group ${
                sizeClass === "tall" ? "min-h-[320px]" : sizeClass === "wide" ? "min-h-[200px]" : "min-h-[240px]"
              }`}
            >
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-white/5 flex items-center justify-center">
                  <ImageOff className="h-8 w-8 text-white/15" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <div>
                  <p className="text-white font-medium text-sm">{product.name}</p>
                  {presProduct?.presentation_text && (
                    <p className="text-white/60 text-xs mt-1 line-clamp-3">
                      {presProduct.presentation_text}
                    </p>
                  )}
                </div>
              </div>
              <div className="p-3">
                <p className="text-white text-sm font-medium truncate">{product.name}</p>
                <p className="text-white/40 text-xs">{product.vendor || product.manufacturer}</p>
                {product.price != null && (
                  <p className="text-gold text-sm font-semibold mt-1">${Number(product.price).toLocaleString()}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function SpecSheetLayout({ selectedProducts, presentation }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-3 px-4 text-white/50 font-medium">Image</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium">Product</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium">Vendor</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium">Price</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium">Category</th>
            <th className="text-left py-3 px-4 text-white/50 font-medium min-w-[250px]">AI Narrative</th>
          </tr>
        </thead>
        <tbody>
          {selectedProducts.map((product, i) => {
            const presProduct = presentation?.products?.find(
              (p) => p.id === product.id
            );
            return (
              <motion.tr
                key={product.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="border-b border-white/5 hover:bg-white/[0.02]"
              >
                <td className="py-3 px-4">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-14 h-14 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center">
                      <ImageOff className="h-4 w-4 text-white/15" />
                    </div>
                  )}
                </td>
                <td className="py-3 px-4">
                  <p className="text-white font-medium">{product.name}</p>
                  {product.sku && <p className="text-white/30 text-xs">SKU: {product.sku}</p>}
                </td>
                <td className="py-3 px-4 text-white/60">{product.vendor || product.manufacturer || "\u2014"}</td>
                <td className="py-3 px-4 text-gold font-semibold">
                  {product.price != null ? `$${Number(product.price).toLocaleString()}` : "\u2014"}
                </td>
                <td className="py-3 px-4 text-white/60">{product.category || "\u2014"}</td>
                <td className="py-3 px-4 text-white/50 text-xs leading-relaxed">
                  {presProduct?.presentation_text || (
                    <span className="text-white/20 italic">Generate AI copy to fill</span>
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RoomConceptLayout({ selectedProducts, presentation }) {
  return (
    <div className="space-y-6">
      {presentation?.project_narrative ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Layers className="h-4 w-4 text-gold" />
            <span className="text-gold text-xs font-semibold uppercase tracking-wider">Room Narrative</span>
          </div>
          <p className="text-white/80 leading-relaxed">{presentation.project_narrative}</p>
          {presentation.room_context && (
            <p className="text-white/50 text-sm mt-3">{presentation.room_context}</p>
          )}
          {presentation.style_direction && (
            <div className="mt-3 flex items-center gap-2">
              <Type className="h-3.5 w-3.5 text-white/30" />
              <span className="text-white/40 text-xs">Style: {presentation.style_direction}</span>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
          <Sparkles className="h-6 w-6 text-white/15 mx-auto mb-2" />
          <p className="text-white/30 text-sm">Generate AI copy to create a room narrative</p>
        </div>
      )}

      {presentation?.color_palette && presentation.color_palette.length > 0 && (
        <div className="flex items-center gap-3">
          <Palette className="h-4 w-4 text-white/30" />
          <span className="text-white/40 text-xs mr-2">Palette:</span>
          {presentation.color_palette.map((color, i) => (
            <span key={i} className="px-2 py-0.5 rounded bg-white/5 text-white/60 text-xs">
              {color}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {selectedProducts.map((product, i) => {
          const presProduct = presentation?.products?.find(
            (p) => p.id === product.id
          );
          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="rounded-xl border border-white/10 bg-[#141420] overflow-hidden"
            >
              <div className="flex gap-4 p-4">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    <ImageOff className="h-6 w-6 text-white/15" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{product.name}</p>
                  <p className="text-white/40 text-xs">{product.vendor || product.manufacturer}</p>
                  {product.price != null && (
                    <p className="text-gold text-sm font-semibold mt-1">
                      ${Number(product.price).toLocaleString()}
                    </p>
                  )}
                  {presProduct?.placement_suggestion && (
                    <div className="mt-2 px-2 py-1 bg-white/5 rounded text-white/50 text-xs">
                      <span className="text-white/30 mr-1">Placement:</span>
                      {presProduct.placement_suggestion}
                    </div>
                  )}
                </div>
              </div>
              {presProduct?.presentation_text && (
                <div className="px-4 pb-4 pt-0">
                  <p className="text-white/50 text-xs leading-relaxed border-t border-white/5 pt-3">
                    {presProduct.presentation_text}
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function VendorComparisonLayout({ selectedProducts, presentation }) {
  const grouped = {};
  selectedProducts.forEach((product) => {
    const vendor = product.vendor || product.manufacturer || "Unknown";
    if (!grouped[vendor]) grouped[vendor] = [];
    grouped[vendor].push(product);
  });
  const vendors = Object.keys(grouped);

  return (
    <div className="space-y-6">
      {presentation?.pairings && presentation.pairings.length > 0 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-gold" />
            <span className="text-gold text-xs font-semibold uppercase tracking-wider">Comparison Notes</span>
          </div>
          <ul className="space-y-1">
            {presentation.pairings.map((p, i) => (
              <li key={i} className="text-white/50 text-sm">{"\u2022"} {typeof p === "string" ? p : p.note || JSON.stringify(p)}</li>
            ))}
          </ul>
        </div>
      )}

      {vendors.map((vendor, vi) => (
        <motion.div
          key={vendor}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: vi * 0.08 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-white/30" />
            <h3 className="text-white font-semibold text-lg">{vendor}</h3>
            <span className="text-white/30 text-xs ml-auto">
              {grouped[vendor].length} product{grouped[vendor].length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {grouped[vendor].map((product, i) => {
              const presProduct = presentation?.products?.find(
                (p) => p.id === product.id
              );
              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: vi * 0.08 + i * 0.03 }}
                  className="rounded-xl border border-white/10 bg-[#141420] p-4"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                  ) : (
                    <div className="w-full h-32 rounded-lg bg-white/5 flex items-center justify-center mb-3">
                      <ImageOff className="h-6 w-6 text-white/15" />
                    </div>
                  )}
                  <p className="text-white font-medium text-sm truncate">{product.name}</p>
                  {product.price != null && (
                    <p className="text-gold text-sm font-semibold mt-1">
                      ${Number(product.price).toLocaleString()}
                    </p>
                  )}
                  {presProduct?.presentation_text && (
                    <p className="text-white/50 text-xs mt-2 leading-relaxed line-clamp-4">
                      {presProduct.presentation_text}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/* --- Main Component --- */

export default function PresentationTemplates({ products }) {
  const [selectedIds, setSelectedIds] = useState(() =>
    new Set(products.map((p) => p.id))
  );
  const [activeTemplate, setActiveTemplate] = useState("mood-board");
  const [presentation, setPresentation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const selectedProducts = products.filter((p) => selectedIds.has(p.id));

  const toggleProduct = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleGenerateAI = async () => {
    if (selectedProducts.length === 0) return;
    setLoading(true);
    const result = await fetchPresentationData(selectedProducts);
    setPresentation(result);
    setLoading(false);
  };

  const handleExportPdf = async () => {
    if (selectedProducts.length === 0) return;
    setExporting(true);
    try {
      await generateQuotePdf(selectedProducts, "Client Presentation");
    } catch {
      // PDF generation failed silently
    }
    setExporting(false);
  };

  const renderCanvas = () => {
    if (selectedProducts.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <Layout className="h-12 w-12 text-white/10 mb-4" />
          <p className="text-white/30 text-lg mb-1">Canvas is empty</p>
          <p className="text-white/20 text-sm">Click products in the sidebar to add them</p>
        </div>
      );
    }

    const props = { selectedProducts, presentation };
    switch (activeTemplate) {
      case "mood-board":
        return <MoodBoardLayout {...props} />;
      case "spec-sheet":
        return <SpecSheetLayout {...props} />;
      case "room-concept":
        return <RoomConceptLayout {...props} />;
      case "vendor-comparison":
        return <VendorComparisonLayout {...props} />;
      default:
        return <MoodBoardLayout {...props} />;
    }
  };

  return (
    <div className="bg-[#0a0a10] rounded-2xl border border-white/10 overflow-hidden">
      {/* Template Selector */}
      <div className="border-b border-white/10 bg-[#0e0e18]">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-gold" />
              <h2 className="font-serif text-xl font-semibold text-white">
                Presentation Builder
              </h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const isActive = activeTemplate === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setActiveTemplate(tmpl.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-gold/20 text-gold border border-gold/30"
                        : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tmpl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-[600px]">
        {/* Sidebar - Product List */}
        <div className="w-[250px] flex-shrink-0 border-r border-white/10 bg-[#0c0c16] overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                Products ({products.length})
              </h2>
              <span className="text-white/30 text-xs">
                {selectedIds.size} selected
              </span>
            </div>

            {products.length === 0 ? (
              <div className="text-center py-12">
                <Layers className="h-8 w-8 text-white/10 mx-auto mb-2" />
                <p className="text-white/30 text-xs">
                  No products in compare tray
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {products.map((product) => {
                  const isSelected = selectedIds.has(product.id);
                  return (
                    <motion.button
                      key={product.id}
                      onClick={() => toggleProduct(product.id)}
                      whileTap={{ scale: 0.97 }}
                      className={`w-full rounded-lg p-2 text-left transition-all flex items-start gap-2 group ${
                        isSelected
                          ? "bg-gold/10 border border-gold/20"
                          : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06] hover:border-white/10"
                      }`}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-white/5 flex items-center justify-center flex-shrink-0">
                          <ImageOff className="h-4 w-4 text-white/15" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate leading-tight">
                          {product.name}
                        </p>
                        <p className="text-white/30 text-[10px] truncate">
                          {product.vendor || product.manufacturer}
                        </p>
                        {product.price != null && (
                          <p className="text-gold/80 text-[10px] font-semibold mt-0.5">
                            ${Number(product.price).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 mt-1">
                        {isSelected ? (
                          <X className="h-3.5 w-3.5 text-gold/60" />
                        ) : (
                          <Plus className="h-3.5 w-3.5 text-white/20 group-hover:text-white/40" />
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Canvas Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#0a0a10]">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm">
                {selectedProducts.length} product{selectedProducts.length !== 1 ? "s" : ""} on canvas
              </span>
              {presentation && (
                <span className="ml-2 px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-xs">
                  AI copy generated
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleGenerateAI}
                disabled={loading || selectedProducts.length === 0}
                className="gap-2 bg-gold/20 text-gold hover:bg-gold/30 border border-gold/30 disabled:opacity-40"
                size="sm"
              >
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </motion.div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate AI Copy
                  </>
                )}
              </Button>
              <Button
                onClick={handleExportPdf}
                disabled={exporting || selectedProducts.length === 0}
                variant="outline"
                size="sm"
                className="gap-2 border-white/10 text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                {exporting ? "Exporting..." : "Download PDF"}
              </Button>
            </div>
          </div>

          {/* Canvas Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Global presentation info */}
            <AnimatePresence>
              {presentation?.style_direction && activeTemplate !== "room-concept" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 flex items-center gap-4 text-xs text-white/40"
                >
                  {presentation.style_direction && (
                    <span className="flex items-center gap-1.5">
                      <Type className="h-3.5 w-3.5" />
                      {presentation.style_direction}
                    </span>
                  )}
                  {presentation.color_palette && presentation.color_palette.length > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Palette className="h-3.5 w-3.5" />
                      {presentation.color_palette.join(", ")}
                    </span>
                  )}
                  {presentation.project_narrative && activeTemplate !== "room-concept" && (
                    <span className="flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[400px]">{presentation.project_narrative}</span>
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTemplate}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {renderCanvas()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
