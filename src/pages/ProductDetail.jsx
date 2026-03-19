import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Heart, Share2, GitCompare, ExternalLink, Package, Ruler, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { getCompareItems, getFavorites, normalizeProduct, toggleCompareItem, toggleFavorite } from "@/lib/growth-store";
import MaterialBadges from "@/components/MaterialBadges";
import DeliveryBadge from "@/components/DeliveryBadge";
import ProcurementPanel from "@/components/ProcurementPanel";

const SEARCH_URL = (
  import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app"
).replace(/\/$/, "");

export default function ProductDetail() {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [compareItems, setCompareItems] = useState([]);
  const [spatialData, setSpatialData] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    setFavorites(getFavorites());
    setCompareItems(getCompareItems());

    if (!id) {
      setError("No product ID provided");
      return;
    }

    fetch(`${SEARCH_URL}/product/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Product not found (${r.status})`);
        return r.json();
      })
      .then((data) => {
        setProduct(data.product);
        setSpatialData({
          material_badges: data.material_badges || [],
          delivery: data.delivery_feasibility || null,
          parsed_dimensions: data.parsed_dimensions || null,
          procurement: data.procurement || null,
        });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 mb-4">{error}</p>
          <Link to={createPageUrl("Search")} className="text-gold hover:underline">Back to Search</Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0A0B10] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-gold border-t-transparent rounded-full" />
      </div>
    );
  }

  const images = (product.images || []).filter(Boolean);
  const primaryImage = images[selectedImage] || product.image_url || null;
  const name = product.product_name || "Untitled Product";
  const vendor = product.manufacturer_name || product.vendor_name || "";
  const price = product.retail_price || product.wholesale_price || 0;
  const description = product.description || product.snippet || "";
  const material = product.material || "";
  const style = product.style || "";
  const color = product.color || "";
  const dimensions = product.dimensions || "";
  const sku = product.sku || "";
  const category = (product.category || "").replace(/-/g, " ");
  const collection = product.collection || "";
  const productUrl = product.portal_url || product.product_url || "";
  const tags = product.ai_visual_tags || "";

  const isFavorite = favorites.some((entry) => entry.id === product.id);
  const isCompared = compareItems.some((entry) => entry.id === product.id);

  const handleToggleFavorite = () => {
    const { next, added } = toggleFavorite(normalizeProduct(product));
    setFavorites(next);
    toast({ title: added ? "Saved to favorites" : "Removed from favorites", description: name });
  };

  const handleToggleCompare = () => {
    const { next, added, limitReached } = toggleCompareItem(normalizeProduct(product));
    setCompareItems(next);
    toast({
      title: limitReached ? "Compare limit reached" : added ? "Added to compare" : "Removed from compare",
      description: limitReached ? "Remove an item before adding another." : name,
    });
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast({ title: "Link copied", description: "Product link copied to clipboard." });
  };

  return (
    <div className="min-h-screen bg-[#0A0B10]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <Link to={createPageUrl("Search")} className="flex items-center gap-2 text-sm text-white/40 hover:text-gold mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </Link>

        <div className="grid lg:grid-cols-2 gap-10 mb-12">
          {/* Images */}
          <div>
            <div className="bg-white/5 rounded-2xl overflow-hidden mb-3 border border-white/10 aspect-square flex items-center justify-center">
              {primaryImage ? (
                <img
                  src={primaryImage}
                  alt={name}
                  className="w-full h-full object-contain p-4"
                  onError={(e) => { e.target.style.display = "none"; }}
                />
              ) : (
                <div className="text-white/20 text-6xl font-brand">{vendor.charAt(0) || "?"}</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${selectedImage === i ? "border-gold" : "border-white/10"}`}
                  >
                    <img src={img} alt="" className="w-16 h-16 object-cover" onError={(e) => { e.target.parentElement.style.display = "none"; }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div>
            <div className="text-sm text-white/40 mb-1">{vendor}{sku ? ` · SKU: ${sku}` : ""}</div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white mb-2">{name}</h1>
            {collection && <div className="text-sm text-gold/70 mb-3">{collection} Collection</div>}
            {category && <div className="text-xs text-white/30 uppercase tracking-wider mb-4">{category}</div>}

            {/* Pricing */}
            <div className="rounded-xl p-4 mb-5" style={{ background: "rgba(201,169,110,0.08)", border: "1px solid rgba(201,169,110,0.15)" }}>
              {price > 0 ? (
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-semibold text-gold">${price.toLocaleString()}</span>
                  {product.wholesale_price && product.retail_price && product.wholesale_price !== product.retail_price && (
                    <span className="text-sm text-white/30">Wholesale: ${product.wholesale_price.toLocaleString()}</span>
                  )}
                </div>
              ) : (
                <span className="text-lg text-white/50">Price on request</span>
              )}
            </div>

            {/* Description */}
            {description && (
              <p className="text-sm text-white/60 leading-relaxed mb-5">{description}</p>
            )}

            {/* Specs grid */}
            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              {material && (
                <div className="rounded-lg bg-white/5 p-3">
                  <div className="text-white/30 text-xs mb-1">Material</div>
                  <div className="text-white/80">{material}</div>
                </div>
              )}
              {style && (
                <div className="rounded-lg bg-white/5 p-3">
                  <div className="text-white/30 text-xs mb-1">Style</div>
                  <div className="text-white/80 capitalize">{style}</div>
                </div>
              )}
              {color && (
                <div className="rounded-lg bg-white/5 p-3">
                  <div className="text-white/30 text-xs mb-1">Color</div>
                  <div className="text-white/80 capitalize">{color}</div>
                </div>
              )}
              {dimensions && (
                <div className="rounded-lg bg-white/5 p-3">
                  <div className="text-white/30 text-xs mb-1">Dimensions</div>
                  <div className="text-white/80">{dimensions}</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mb-4">
              {productUrl && (
                <a href={productUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button className="w-full h-11 btn-gold text-white gap-2">
                    <ExternalLink className="w-4 h-4" /> View on {vendor || "Vendor Site"}
                  </Button>
                </a>
              )}
              <Button variant="outline" size="icon" className="h-11 w-11 border-white/10 text-white/50 hover:text-white hover:border-white/30" onClick={handleToggleFavorite}>
                <Heart className={`w-5 h-5 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
              </Button>
            </div>

            <div className="flex gap-3 mb-5">
              <Button variant="outline" className="flex-1 justify-center gap-2 border-white/10 text-white/50 hover:text-white hover:border-white/30" onClick={handleShare}>
                <Share2 className="w-4 h-4" /> Share
              </Button>
              <Button variant="outline" className="flex-1 justify-center gap-2 border-white/10 text-white/50 hover:text-white hover:border-white/30" onClick={handleToggleCompare}>
                <GitCompare className="w-4 h-4" /> {isCompared ? "In compare" : "Compare"}
              </Button>
            </div>

            {/* Material badges */}
            {spatialData?.material_badges?.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-white/70 mb-2">Material Intelligence</div>
                <div className="rounded-lg bg-white/5 p-3">
                  <MaterialBadges badges={spatialData.material_badges} />
                </div>
              </div>
            )}

            {/* Delivery feasibility */}
            {spatialData?.delivery && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-white/70 mb-2">Delivery Feasibility</div>
                <div className="rounded-lg bg-white/5">
                  <DeliveryBadge
                    status={spatialData.delivery.status}
                    issues={spatialData.delivery.issues}
                    tips={spatialData.delivery.tips}
                    diagonal_in={spatialData.delivery.diagonal_in}
                  />
                </div>
              </div>
            )}

            {/* Visual tags */}
            {tags && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-white/70 mb-2">Visual Tags</div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.split(",").map((t, i) => t.trim()).filter(Boolean).map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-white/50">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Procurement panel */}
        {spatialData?.procurement && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white/80 mb-3">Procurement Details</h2>
            <div className="rounded-xl bg-white/5 p-1">
              <ProcurementPanel product={{
                product_name: name,
                manufacturer_name: vendor,
                category: product.category,
                dimensions: dimensions || null,
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
