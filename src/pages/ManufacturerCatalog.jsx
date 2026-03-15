import { useState, useEffect, useRef } from "react";
import { Upload, Plus, Search, Edit2, Package, Eye, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";

export default function ManufacturerCatalog() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [user, setUser] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      // Show this manufacturer's products (filter by manufacturer_id or all for admin)
      if (u.role === "admin") return base44.entities.Product.list("-created_date", 100);
      return base44.entities.Product.filter({ manufacturer_id: u.id });
    }).then(setProducts).catch(() => {});
  }, []);

  const filtered = products.filter(p =>
    (p.name?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === "all" || p.status === statusFilter)
  );

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    await base44.entities.Product.update(id, { status: newStatus });
    setProducts(products.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  const totalRevenue = products.filter(p => p.status === "active").reduce((sum, p) => sum + (p.orders_week * p.price_wholesale_tier1), 0);

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: "object",
          properties: {
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  sku: { type: "string" },
                  manufacturer_name: { type: "string" },
                  category: { type: "string" },
                  style: { type: "string" },
                  material: { type: "string" },
                  price_retail: { type: "number" },
                  price_wholesale_tier1: { type: "number" },
                  inventory_in_stock: { type: "number" },
                  lead_time_weeks: { type: "number" },
                  description: { type: "string" },
                  thumbnail: { type: "string" },
                  colors_available: { type: "array", items: { type: "string" } }
                }
              }
            }
          }
        }
      });

      if (result.status === "success" && result.output?.products?.length > 0) {
        const created = await base44.entities.Product.bulkCreate(
          result.output.products.map(p => ({
            ...p,
            manufacturer_id: user?.id,
            status: "active",
            rating: 0,
            review_count: 0,
          }))
        );
        setProducts(prev => [...created, ...prev]);
        setUploadResult({ success: true, count: created.length });
      } else {
        setUploadResult({ success: false, message: "Could not parse CSV. Check format." });
      }
    } catch (err) {
      setUploadResult({ success: false, message: err.message });
    }
    setUploading(false);
  };

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Product Catalog</h1>
            <p className="text-white/40 mt-1">{products.filter(p => p.status === "active").length} active products</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 border-white/[0.06] text-white/70 hover:text-white" onClick={() => setShowUpload(true)}>
              <Upload className="w-4 h-4" /> Import CSV
            </Button>
            <Button className="btn-gold gap-2">
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Products", val: products.length },
            { label: "Active", val: products.filter(p => p.status === "active").length },
            { label: "Total In Stock", val: products.reduce((s, p) => s + p.inventory_in_stock, 0).toLocaleString() },
            { label: "Weekly Revenue (est.)", val: `$${totalRevenue.toLocaleString()}` },
          ].map((s, i) => (
            <div key={i} className="glass-surface rounded-xl p-4 border border-white/[0.06]">
              <div className="text-xl font-bold text-gold">{s.val}</div>
              <div className="text-sm text-white/40">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input placeholder="Search products, SKUs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/20 focus:border-gold/30" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-white/[0.03] border-white/[0.06] text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="discontinued">Discontinued</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="glass-surface rounded-xl border border-white/[0.06] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                <th className="text-left text-xs font-semibold text-white/40 px-5 py-3 label-caps">Product</th>
                <th className="text-left text-xs font-semibold text-white/40 px-4 py-3 label-caps">Retail / Wholesale</th>
                <th className="text-left text-xs font-semibold text-white/40 px-4 py-3 label-caps">Inventory</th>
                <th className="text-left text-xs font-semibold text-white/40 px-4 py-3 label-caps">This Week</th>
                <th className="text-left text-xs font-semibold text-white/40 px-4 py-3 label-caps">Status</th>
                <th className="text-left text-xs font-semibold text-white/40 px-4 py-3 label-caps">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <img src={p.thumbnail} alt={p.name} className="w-12 h-10 object-cover rounded-lg" />
                      <div>
                        <div className="font-medium text-sm text-white">{p.name}</div>
                        <div className="text-xs text-white/30">{p.sku} · {p.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-white">${(p.price_retail || 0).toLocaleString()}</div>
                    <div className="text-xs text-gold/70">${(p.price_wholesale_tier1 || 0).toLocaleString()} wholesale</div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium">
                      {p.inventory_in_stock > 0 ? (
                        <span className={p.inventory_in_stock < 20 ? "text-orange-400" : "text-green-400"}>
                          {p.inventory_in_stock} in stock
                        </span>
                      ) : (
                        <span className="text-red-400">Out of stock</span>
                      )}
                    </div>
                    {p.inventory_in_production > 0 && (
                      <div className="text-xs text-white/30">{p.inventory_in_production} in production</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-0.5 text-xs text-white/40">
                      <div><Eye className="w-3 h-3 inline mr-1" />{(p.search_impressions_week || 0).toLocaleString()} views</div>
                      <div className="text-gold font-medium">{p.orders_week || 0} orders</div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      p.status === "active" ? "bg-green-500/20 text-green-400" :
                      p.status === "inactive" ? "bg-white/[0.06] text-white/40" :
                      "bg-red-500/20 text-red-400"
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Edit2 className="w-3.5 h-3.5 text-white/30" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleStatus(p.id, p.status)}>
                        <Package className="w-3.5 h-3.5 text-white/30" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-white/30">No products found.</div>
          )}
        </div>
      </div>

      {/* CSV Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-md bg-[#141420] border-white/[0.06]">
          <DialogHeader>
            <DialogTitle className="font-display text-white">Import Products from CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-white/[0.03] rounded-lg p-4 text-sm text-white/50 space-y-1">
              <p className="font-semibold text-white/60">Expected CSV columns:</p>
              <p className="font-mono text-xs">name, sku, manufacturer_name, category, style, material, price_retail, price_wholesale_tier1, inventory_in_stock, lead_time_weeks, description</p>
            </div>

            <div
              className="border-2 border-dashed border-white/[0.06] rounded-xl p-8 text-center cursor-pointer hover:border-gold/30 hover:bg-gold/[0.03] transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-8 h-8 text-white/20 mx-auto mb-2" />
              <p className="text-sm font-medium text-white/50">Click to upload CSV file</p>
              <p className="text-xs text-white/30 mt-1">CSV, Excel supported</p>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleCSVUpload} />
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-sm text-gold">
                <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                Processing your file...
              </div>
            )}

            {uploadResult && (
              <div className={`flex items-center gap-2 text-sm rounded-lg p-3 ${uploadResult.success ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {uploadResult.success
                  ? <><CheckCircle className="w-4 h-4 shrink-0" /> {uploadResult.count} products imported successfully!</>
                  : <><AlertCircle className="w-4 h-4 shrink-0" /> {uploadResult.message}</>
                }
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
