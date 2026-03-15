import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Palette,
  Sparkles,
  ImageOff,
  Layers,
  Quote,
  MapPin,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { getCompareItems } from "@/lib/growth-store";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

async function fetchPresentation(products, projectContext) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(`${searchServiceUrl.replace(/\/$/, "")}/presentation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ products, project_context: projectContext }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.presentation;
  } catch {
    return null;
  }
}

export default function Presentation() {
  const [products] = useState(() => getCompareItems());
  const [projectName, setProjectName] = useState("");
  const [roomType, setRoomType] = useState("");
  const [notes, setNotes] = useState("");
  const [presentation, setPresentation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setPresentation(null);
    const result = await fetchPresentation(products, {
      name: projectName || "Design Project",
      room_type: roomType,
      notes,
    });
    setPresentation(result);
    setLoading(false);
  };

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Palette className="h-6 w-6 text-gold" />
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-white">
            Client Presentation
          </h1>
        </div>

        {products.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <Palette className="h-14 w-14 text-white/10 mx-auto mb-4" />
            <p className="text-white/40 text-lg mb-2">No products selected</p>
            <p className="text-white/25 text-sm mb-8">
              Add products to Compare first, then generate a presentation.
            </p>
            <Link to={createPageUrl("Search")}>
              <Button>Go to Search</Button>
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Setup */}
            <div className="rounded-2xl border border-gold/20 bg-gold/5 p-6">
              <div className="flex items-center gap-2 text-gold text-sm font-semibold mb-4">
                <Sparkles className="h-4 w-4" /> Generate AI Presentation
              </div>
              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-gold/30"
                />
                <input
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  placeholder="Room type (e.g. Living Room)"
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-gold/30"
                />
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Client notes / preferences"
                  className="h-10 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-gold/30"
                />
              </div>
              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="bg-gold hover:bg-gold/80 text-black font-semibold"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-black/20 border-t-black animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" /> Generate for {products.length} Products
                  </>
                )}
              </Button>
            </div>

            {/* Loading state */}
            {loading && !presentation && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
                <Sparkles className="h-8 w-8 text-gold animate-pulse mx-auto mb-4" />
                <p className="text-white/40">Creating your presentation like a designer would...</p>
              </div>
            )}

            {/* Presentation Results */}
            {presentation && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Narrative */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-4">
                    <Quote className="h-4 w-4" /> Design Vision
                  </div>
                  <p className="text-white/80 text-lg leading-relaxed font-display italic">
                    {presentation.project_narrative}
                  </p>
                </div>

                {/* Color Palette */}
                {presentation.color_palette?.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-4">
                      <Palette className="h-4 w-4" /> Color Palette
                    </div>
                    <div className="flex gap-4 flex-wrap">
                      {presentation.color_palette.map((color) => (
                        <div key={color.hex} className="text-center">
                          <div
                            className="w-16 h-16 rounded-xl border border-white/10 mb-2"
                            style={{ backgroundColor: color.hex }}
                          />
                          <div className="text-xs text-white/70 font-medium">{color.name}</div>
                          <div className="text-[10px] text-white/30">{color.role}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Style Direction + Room Context */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {presentation.style_direction && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-3">
                        <Layers className="h-4 w-4" /> Style Direction
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed">{presentation.style_direction}</p>
                    </div>
                  )}
                  {presentation.room_context && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold mb-3">
                        <MapPin className="h-4 w-4" /> Room Context
                      </div>
                      <p className="text-white/70 text-sm leading-relaxed">{presentation.room_context}</p>
                    </div>
                  )}
                </div>

                {/* Mood Keywords */}
                {presentation.mood_keywords?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {presentation.mood_keywords.map((word) => (
                      <span
                        key={word}
                        className="rounded-full border border-gold/20 bg-gold/5 px-4 py-1.5 text-sm text-gold"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                )}

                {/* Product Presentations */}
                {presentation.products?.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40 mb-4">
                      Product Descriptions
                    </div>
                    <div className="space-y-4">
                      {presentation.products.map((pres) => {
                        const product = products.find((p) => p.id === pres.id);
                        return (
                          <div key={pres.id} className="flex gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <div className="w-20 h-16 rounded-lg overflow-hidden bg-white/[0.02] shrink-0">
                              {(product?.thumbnail || product?.image_url) ? (
                                <img
                                  src={product.thumbnail || product.image_url}
                                  alt={product?.product_name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <ImageOff className="h-5 w-5 text-white/10" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-white">{product?.product_name}</div>
                              <div className="text-xs text-gold/70 mb-1">{product?.manufacturer_name}</div>
                              <p className="text-sm text-white/60 leading-relaxed">{pres.presentation_text}</p>
                              {pres.placement_suggestion && (
                                <div className="mt-2 text-xs text-gold/70">
                                  <MapPin className="h-3 w-3 inline mr-1" />
                                  {pres.placement_suggestion}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pairings */}
                {presentation.pairings?.length > 0 && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40 mb-4">
                      Product Pairings
                    </div>
                    <div className="space-y-3">
                      {presentation.pairings.map((pair, i) => {
                        const paired = (pair.product_ids || [])
                          .map((id) => products.find((p) => p.id === id))
                          .filter(Boolean);
                        return (
                          <div key={i} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                            <div className="flex gap-2 mb-2">
                              {paired.map((p) => (
                                <span key={p.id} className="rounded-full bg-gold/10 px-3 py-0.5 text-xs text-gold/70">
                                  {p.product_name}
                                </span>
                              ))}
                            </div>
                            <p className="text-sm text-white/50">{pair.reasoning}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
