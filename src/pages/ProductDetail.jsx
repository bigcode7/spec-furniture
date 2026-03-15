import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Star, ShoppingCart, Heart, ArrowLeft, Check, Package, Clock, Truck, Shield, Share2, GitCompare, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { getCompareItems, getFavorites, normalizeProduct, toggleCompareItem, toggleFavorite } from "@/lib/growth-store";
import FitScoreBadge from "@/components/FitScoreBadge";
import MaterialBadges from "@/components/MaterialBadges";
import DeliveryBadge from "@/components/DeliveryBadge";
import ProcurementPanel from "@/components/ProcurementPanel";

const SEARCH_URL = (
  import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310"
).replace(/\/$/, "");

export default function ProductDetail() {
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [addedToCart, setAddedToCart] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [compareItems, setCompareItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [addingToProject, setAddingToProject] = useState(false);
  const [spatialData, setSpatialData] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    setFavorites(getFavorites());
    setCompareItems(getCompareItems());
    base44.auth.me().then((currentUser) => {
      setUser(currentUser);
      if (currentUser?.role === "designer") {
        return base44.entities.Project.filter({ designer_id: currentUser.id }, "-updated_date");
      }
      return [];
    }).then(setProjects).catch(() => {});
    if (id) {
      base44.entities.Product.filter({ id }).then(results => {
        if (results[0]) {
          setProduct(results[0]);
          setSelectedColor(results[0].colors_available?.[0] || "");
        }
      }).catch(() => {});
      base44.entities.Review.filter({ product_id: id }).then(setReviews).catch(() => {});
    }
  }, []);

  // Fetch spatial intelligence data when product loads
  useEffect(() => {
    if (!product) return;
    const searchProduct = {
      product_name: product.name,
      manufacturer_name: product.manufacturer_name,
      dimensions: product.dimensions_length
        ? `W ${product.dimensions_width}" x D ${product.dimensions_length}" x H ${product.dimensions_height}"`
        : null,
      material: product.material || product.features?.join(", ") || "",
      category: product.category,
    };
    fetch(`${SEARCH_URL}/materials/badges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: searchProduct }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setSpatialData((prev) => ({ ...prev, material_badges: data.badges }));
      })
      .catch(() => {});

    if (product.dimensions_length && product.dimensions_width) {
      fetch(`${SEARCH_URL}/spatial/delivery-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: {
            width_in: product.dimensions_width,
            depth_in: product.dimensions_length,
            height_in: product.dimensions_height,
          },
          constraints: { doorway_width_in: 32, doorway_height_in: 80 },
        }),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.delivery) setSpatialData((prev) => ({ ...prev, delivery: data.delivery }));
        })
        .catch(() => {});
    }
  }, [product]);

  if (!product) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-gold border-t-transparent rounded-full" /></div>;

  const isFavorite = favorites.some((entry) => entry.id === product.id);
  const isCompared = compareItems.some((entry) => entry.id === product.id);

  const handleAddToCart = async () => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    const existing = await base44.entities.CartItem.filter({ user_id: user.id, product_id: product.id });
    if (existing.length > 0) {
      await base44.entities.CartItem.update(existing[0].id, { quantity: existing[0].quantity + quantity });
    } else {
      await base44.entities.CartItem.create({
        user_id: user.id,
        product_id: product.id,
        product_name: product.name,
        manufacturer_name: product.manufacturer_name,
        quantity,
        unit_price: (user?.role === "retailer" || user?.role === "designer") ? product.price_wholesale_tier1 : product.price_retail,
        thumbnail: product.thumbnail,
        lead_time_weeks: product.lead_time_weeks,
      });
    }
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const handleToggleFavorite = () => {
    const { next, added } = toggleFavorite(normalizeProduct(product));
    setFavorites(next);
    toast({
      title: added ? "Saved to favorites" : "Removed from favorites",
      description: product.name,
    });
  };

  const handleToggleCompare = () => {
    const { next, added, limitReached } = toggleCompareItem(normalizeProduct(product));
    setCompareItems(next);
    toast({
      title: limitReached ? "Compare limit reached" : added ? "Added to compare" : "Removed from compare",
      description: limitReached ? "Remove an item before adding another." : product.name,
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Product link copied to your clipboard.",
    });
  };

  const handleAddToProject = async () => {
    if (!selectedProjectId) return;
    const project = projects.find((entry) => entry.id === selectedProjectId);
    if (!project) return;

    setAddingToProject(true);
    const price = user?.role === "retailer" || user?.role === "designer" ? product.price_wholesale_tier1 : product.price_retail;
    const nextItems = [
      ...(project.items || []),
      {
        product_id: product.id,
        product_name: product.name,
        manufacturer_name: product.manufacturer_name,
        quantity,
        price,
        thumbnail: product.thumbnail,
        lead_time_weeks: product.lead_time_weeks,
        color: selectedColor,
      },
    ];
    const totalCost = nextItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);

    await base44.entities.Project.update(project.id, {
      items: nextItems,
      total_cost: totalCost,
    });

    setProjects(projects.map((entry) => entry.id === project.id ? { ...entry, items: nextItems, total_cost: totalCost } : entry));
    setAddingToProject(false);
    setShowProjectDialog(false);
    setSelectedProjectId("");
    toast({
      title: "Added to project",
      description: `${product.name} added to ${project.title}.`,
    });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Link to={createPageUrl("Search")} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gold mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Search
        </Link>

        <div className="grid lg:grid-cols-2 gap-10 mb-12">
          {/* Images */}
          <div>
            <div className="bg-white rounded-2xl overflow-hidden mb-3 border border-gray-100">
              <img src={product.images[selectedImage]} alt={product.name} className="w-full h-96 object-cover" />
            </div>
            <div className="flex gap-2">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setSelectedImage(i)} className={`rounded-xl overflow-hidden border-2 transition-all ${selectedImage === i ? "border-gold" : "border-gray-200"}`}>
                  <img src={img} alt="" className="w-16 h-12 object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div>
            <div className="text-sm text-gray-400 mb-1">{product.manufacturer_name} · SKU: {product.sku}</div>
            <h1 className="text-3xl font-bold font-display text-[#222222] mb-3">{product.name}</h1>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                ))}
              </div>
              <span className="text-sm text-gray-600">{product.rating} · {product.review_count} reviews</span>
            </div>

            {/* Pricing */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              {user?.role === "retailer" || user?.role === "designer" ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tier 1 Wholesale</span>
                    <span className="font-bold text-gold text-lg">${product.price_wholesale_tier1?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Tier 2 Wholesale</span>
                    <span className="font-medium">${product.price_wholesale_tier2?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">MSRP / Retail</span>
                    <span className="text-gray-400 line-through">${product.price_retail?.toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div className="text-3xl font-bold text-gold">${product.price_retail?.toLocaleString()}</div>
              )}
            </div>

            {/* Color selection */}
            <div className="mb-5">
              <div className="text-sm font-semibold text-gray-700 mb-2">Color</div>
              <div className="flex flex-wrap gap-2">
                {product.colors_available.map(c => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`px-3 py-1.5 rounded-lg text-sm capitalize border-2 transition-all ${selectedColor === c ? "border-gold bg-gold/10 text-gold font-medium" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Stock & lead time */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <Package className="w-4 h-4 text-green-600 mx-auto mb-1" />
                <div className="text-sm font-bold text-green-600">{product.inventory_in_stock}</div>
                <div className="text-xs text-green-500">In stock</div>
              </div>
              <div className="bg-gold/5 rounded-lg p-3 text-center">
                <Clock className="w-4 h-4 text-gold mx-auto mb-1" />
                <div className="text-sm font-bold text-gold">{product.lead_time_weeks}wk</div>
                <div className="text-xs text-gold/70">Lead time</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <Truck className="w-4 h-4 text-gray-500 mx-auto mb-1" />
                <div className="text-sm font-bold text-gray-600">${product.shipping_cost}</div>
                <div className="text-xs text-gray-400">Shipping</div>
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center gap-3 mb-5">
              <div className="text-sm font-semibold text-gray-700">Qty:</div>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-gray-500 hover:bg-gray-50">−</button>
                <span className="px-4 py-2 font-medium">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="px-3 py-2 text-gray-500 hover:bg-gray-50">+</button>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex gap-3 mb-4">
              <Button
                onClick={handleAddToCart}
                className={`flex-1 h-12 text-base ${addedToCart ? "bg-green-500 hover:bg-green-600" : "btn-gold"} text-white transition-all`}
              >
                {addedToCart ? <><Check className="w-4 h-4 mr-2" /> Added!</> : <><ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart</>}
              </Button>
              <Button variant="outline" size="icon" className="h-12 w-12" onClick={handleToggleFavorite}>
                <Heart className={`w-5 h-5 ${isFavorite ? "fill-red-500 text-red-500" : "text-gray-400"}`} />
              </Button>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <Button variant="outline" className="justify-start gap-2" onClick={handleShare}>
                <Share2 className="w-4 h-4" /> Share product
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={handleToggleCompare}>
                <GitCompare className="w-4 h-4" /> {isCompared ? "In compare" : "Add to compare"}
              </Button>
              {user?.role === "designer" && (
                <Button variant="outline" className="justify-start gap-2" onClick={() => setShowProjectDialog(true)}>
                  <FolderPlus className="w-4 h-4" /> Add to project
                </Button>
              )}
            </div>

            {/* Material & Delivery Intelligence */}
            {spatialData?.material_badges?.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Material Intelligence</div>
                <div className="rounded-lg bg-gray-900 p-3">
                  <MaterialBadges badges={spatialData.material_badges} />
                </div>
              </div>
            )}

            {spatialData?.delivery && (
              <div className="mb-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">Delivery Feasibility</div>
                <div className="rounded-lg bg-gray-900">
                  <DeliveryBadge
                    status={spatialData.delivery.status}
                    issues={spatialData.delivery.issues}
                    tips={spatialData.delivery.tips}
                    diagonal_in={spatialData.delivery.diagonal_in}
                  />
                </div>
              </div>
            )}

            {/* Warranty */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Shield className="w-4 h-4 text-gold" />
              {product.warranty_years}-year warranty included
            </div>
          </div>
        </div>

        {/* Tabs: Specs / Reviews */}
        <Tabs defaultValue="specs" className="bg-white rounded-xl border border-gray-100 p-6">
          <TabsList className="mb-6">
            <TabsTrigger value="specs">Specifications</TabsTrigger>
            <TabsTrigger value="reviews">Reviews ({reviews.length || product.review_count || 0})</TabsTrigger>
            <TabsTrigger value="shipping">Shipping & Returns</TabsTrigger>
            <TabsTrigger value="procurement">Procurement</TabsTrigger>
          </TabsList>

          <TabsContent value="specs">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="font-bold text-[#222222] mb-3">Dimensions</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Length</span><span className="font-medium">{product.dimensions_length}"</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Width</span><span className="font-medium">{product.dimensions_width}"</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Height</span><span className="font-medium">{product.dimensions_height}"</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Seat Height</span><span className="font-medium">{product.dimensions_seat_height}"</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">Weight</span><span className="font-medium">{product.weight_lbs} lbs</span>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-[#222222] mb-3">Features</h3>
                <ul className="space-y-2 mb-5">
                  {product.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-gold" /> {f}
                    </li>
                  ))}
                </ul>
                <h3 className="font-bold text-[#222222] mb-3">Certifications</h3>
                <div className="flex flex-wrap gap-2">
                  {product.certifications.map((c, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reviews">
            <div className="space-y-5">
              {reviews.map((r, i) => (
                <div key={i} className="border-b border-gray-100 pb-5 last:border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-semibold text-[#222222]">{r.reviewer_name}</div>
                      <div className="text-xs text-gray-400 capitalize">{r.reviewer_type} · {r.created_date}</div>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className={`w-4 h-4 ${j < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="font-medium text-sm mb-1">{r.title}</p>
                  <p className="text-sm text-gray-600">{r.body}</p>
                  {r.verified_purchase && <span className="text-xs text-green-600 flex items-center gap-1 mt-1"><Check className="w-3 h-3" /> Verified purchase</span>}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="shipping">
            <div className="grid md:grid-cols-2 gap-6 text-sm text-gray-600">
              <div>
                <h3 className="font-bold text-[#222222] mb-3">Shipping</h3>
                <ul className="space-y-2">
                  <li>• White glove delivery available for ${product.shipping_cost}</li>
                  <li>• Ships from nearest warehouse in {product.lead_time_weeks} week(s)</li>
                  <li>• Real-time tracking provided</li>
                  <li>• Delivered to room of choice</li>
                </ul>
              </div>
              <div>
                <h3 className="font-bold text-[#222222] mb-3">Returns</h3>
                <ul className="space-y-2">
                  <li>• 30-day return window</li>
                  <li>• Must be in original condition</li>
                  <li>• Return shipping fee applies</li>
                  <li>• Contact manufacturer for defects</li>
                </ul>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="procurement">
            <div className="bg-gray-900 rounded-xl p-1">
              <ProcurementPanel product={{
                product_name: product.name,
                manufacturer_name: product.manufacturer_name,
                category: product.category,
                dimensions: product.dimensions_length
                  ? `W ${product.dimensions_width}" x D ${product.dimensions_length}" x H ${product.dimensions_height}"`
                  : null,
              }} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showProjectDialog} onOpenChange={setShowProjectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add to Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              Add <span className="font-medium text-gold">{product.name}</span> to an existing designer project.
            </div>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder={projects.length ? "Select project" : "No projects found"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full btn-gold text-white"
              disabled={!selectedProjectId || addingToProject}
              onClick={handleAddToProject}
            >
              {addingToProject ? "Adding..." : "Add to project"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
