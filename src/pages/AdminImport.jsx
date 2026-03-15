import { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload, Play, RefreshCw, Database, CheckCircle2,
  Loader2, ArrowRight, Package, Globe, FileText, Code, FileSpreadsheet
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

function api(path, options = {}) {
  return fetch(`${SEARCH_URL}${path}`, {
    headers: { "content-type": "application/json" },
    ...options,
  }).then((r) => r.json());
}

export default function AdminImport() {
  const [stats, setStats] = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState(new Set());
  const [selectedMethods, setSelectedMethods] = useState(new Set(["shopify", "feed", "api", "sitemap"]));
  const [maxTier, setMaxTier] = useState(2);
  const [csvText, setCsvText] = useState("");
  const [csvVendor, setCsvVendor] = useState("");
  const [csvResult, setCsvResult] = useState(null);
  const [vendorImportResults, setVendorImportResults] = useState(new Map());
  const [activeTab, setActiveTab] = useState("bulk");
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  // -- Data fetching --
  const refreshStats = useCallback(() => {
    api("/catalog/stats").then(setStats).catch(console.error);
  }, []);

  const refreshImportStatus = useCallback(() => {
    api("/catalog/import-status").then((s) => {
      setImportStatus(s);
      if (s.running) {
        setImporting(true);
      } else if (importing) {
        setImporting(false);
        refreshStats();
      }
    }).catch(console.error);
  }, [importing, refreshStats]);

  useEffect(() => {
    api("/trade-vendors").then((d) => setVendors(d.vendors || [])).catch(console.error);
    refreshStats();
    refreshImportStatus();
  }, []);

  // Poll during import
  useEffect(() => {
    if (importing) {
      pollRef.current = setInterval(refreshImportStatus, 3000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [importing, refreshImportStatus]);

  // -- Actions --
  const startBulkImport = async () => {
    const body = {
      max_tier: maxTier,
      methods: [...selectedMethods],
      concurrent_vendors: 3,
    };
    if (selectedVendors.size > 0) {
      body.vendor_ids = [...selectedVendors];
    }
    setImporting(true);
    await api("/catalog/bulk-import", { method: "POST", body: JSON.stringify(body) });
    setTimeout(refreshImportStatus, 1000);
  };

  const importSingleVendor = async (vendorId) => {
    setVendorImportResults((prev) => new Map(prev).set(vendorId, { status: "running" }));
    try {
      const result = await api("/catalog/import-vendor", {
        method: "POST",
        body: JSON.stringify({ vendor_id: vendorId, methods: [...selectedMethods] }),
      });
      setVendorImportResults((prev) => new Map(prev).set(vendorId, result));
      refreshStats();
    } catch (err) {
      setVendorImportResults((prev) => new Map(prev).set(vendorId, { status: "error", error: err.message }));
    }
  };

  const handleCsvUpload = async () => {
    if (!csvText.trim()) return;
    const body = { csv_text: csvText };
    if (csvVendor) {
      body.vendor_id = csvVendor.toLowerCase().replace(/\s+/g, "-");
      body.vendor_name = csvVendor;
    }
    try {
      const result = await api("/catalog/import-csv", { method: "POST", body: JSON.stringify(body) });
      setCsvResult(result);
      refreshStats();
    } catch (err) {
      setCsvResult({ errors: [err.message] });
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result);
    reader.readAsText(file);
  };

  const toggleMethod = (m) => {
    const s = new Set(selectedMethods);
    s.has(m) ? s.delete(m) : s.add(m);
    setSelectedMethods(s);
  };

  const toggleVendor = (id) => {
    const s = new Set(selectedVendors);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedVendors(s);
  };

  // -- Progress summary --
  const progress = importStatus?.progress;
  const totalImported = progress?.products_after - (progress?.products_before || 0);

  return (
    <div className="min-h-screen text-white py-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <Database className="w-8 h-8 text-gold" />
              Catalog Import
            </h1>
            <p className="text-white/40 mt-1">Bulk import products from vendor websites, feeds, and APIs</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={refreshStats} className="text-white/40 hover:text-white">
              <RefreshCw className="w-5 h-5" />
            </button>
            {stats && (
              <div className="glass-surface rounded-xl px-5 py-3 border border-white/[0.06]">
                <div className="text-2xl font-bold text-gold">{stats.catalog?.total_products?.toLocaleString()}</div>
                <div className="text-xs text-white/40">Total Products</div>
              </div>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            {Object.entries(stats.catalog?.by_source || {}).map(([source, count]) => (
              <div key={source} className="glass-surface rounded-lg p-4 border border-white/[0.06]">
                <div className="text-lg font-semibold text-white">{count.toLocaleString()}</div>
                <div className="text-xs text-white/40">{source}</div>
              </div>
            ))}
            <div className="glass-surface rounded-lg p-4 border border-white/[0.06]">
              <div className="text-lg font-semibold text-white">{Object.keys(stats.catalog?.by_vendor || {}).length}</div>
              <div className="text-xs text-white/40">Vendors</div>
            </div>
            <div className="glass-surface rounded-lg p-4 border border-white/[0.06]">
              <div className="text-lg font-semibold text-white">{stats.catalog?.index_tokens?.toLocaleString()}</div>
              <div className="text-xs text-white/40">Index Tokens</div>
            </div>
          </div>
        )}

        {/* Import Progress Banner */}
        {importing && progress && (
          <div className="bg-gold/[0.06] border border-gold/20 rounded-xl p-5 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <Loader2 className="w-5 h-5 text-gold animate-spin" />
              <span className="font-semibold text-gold">Import in Progress</span>
              <span className="text-white/40 ml-auto">
                {progress.vendors_completed}/{progress.vendors_total} vendors
              </span>
            </div>
            <div className="w-full bg-white/[0.06] rounded-full h-2 mb-3">
              <div
                className="bg-gold h-2 rounded-full transition-all"
                style={{ width: `${(progress.vendors_completed / Math.max(progress.vendors_total, 1)) * 100}%` }}
              />
            </div>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <span>Products before: {progress.products_before?.toLocaleString()}</span>
              <ArrowRight className="w-4 h-4" />
              <span className="text-green-400 font-semibold">
                Now: {(importStatus.catalog_total || progress.products_after)?.toLocaleString()}
                {totalImported > 0 && ` (+${totalImported.toLocaleString()})`}
              </span>
            </div>
            {/* Vendor results */}
            {progress.vendor_results?.length > 0 && (
              <div className="mt-4 max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 border-b border-white/[0.06]">
                      <th className="text-left py-1 pr-2">Vendor</th>
                      <th className="text-left py-1 pr-2">Tier</th>
                      <th className="text-left py-1 pr-2">Methods</th>
                      <th className="text-right py-1">Products</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progress.vendor_results.map((vr, i) => (
                      <tr key={i} className="border-b border-white/[0.06]">
                        <td className="py-1 pr-2 text-white/60">{vr.vendor_name}</td>
                        <td className="py-1 pr-2 text-white/40">T{vr.tier}</td>
                        <td className="py-1 pr-2 text-white/40">
                          {vr.methods_succeeded?.map((m) => m.method).join(", ") || "none"}
                        </td>
                        <td className="py-1 text-right font-mono">
                          {vr.total_products > 0 ? (
                            <span className="text-green-400">{vr.total_products}</span>
                          ) : (
                            <span className="text-white/20">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 glass-surface rounded-lg p-1 border border-white/[0.06] w-fit">
          {[
            { id: "bulk", label: "Bulk Import", icon: Play },
            { id: "vendors", label: "Per Vendor", icon: Globe },
            { id: "csv", label: "CSV Upload", icon: FileSpreadsheet },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${
                activeTab === id ? "bg-gold/20 text-gold" : "text-white/40 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* BULK IMPORT TAB */}
        {activeTab === "bulk" && (
          <div className="space-y-6">
            {/* Methods Selection */}
            <div className="glass-surface rounded-xl p-6 border border-white/[0.06]">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2 text-white">
                <Code className="w-5 h-5 text-purple-400" />
                Import Methods
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: "shopify", label: "Shopify API", desc: "Full catalog via /products.json", icon: Package },
                  { id: "feed", label: "Product Feeds", desc: "Google Shopping XML feeds", icon: FileText },
                  { id: "api", label: "Vendor APIs", desc: "WooCommerce, Magento, custom", icon: Code },
                  { id: "sitemap", label: "Sitemap Crawl", desc: "Parse sitemap.xml + fetch pages", icon: Globe },
                ].map(({ id, label, desc, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => toggleMethod(id)}
                    className={`text-left p-4 rounded-lg border transition-colors ${
                      selectedMethods.has(id)
                        ? "bg-gold/[0.06] border-gold/30 text-white"
                        : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:border-white/20"
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-2" />
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs mt-1 text-white/40">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Tier Selection */}
            <div className="glass-surface rounded-xl p-6 border border-white/[0.06]">
              <h3 className="font-display font-semibold mb-4 text-white">Vendor Tier</h3>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((t) => (
                  <button
                    key={t}
                    onClick={() => setMaxTier(t)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      maxTier >= t
                        ? "bg-gold/20 text-gold"
                        : "bg-white/[0.03] border border-white/[0.06] text-white/40"
                    }`}
                  >
                    Tier {t}
                    <span className="text-xs ml-1 opacity-70">
                      ({vendors.filter((v) => v.tier === t).length})
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/40 mt-2">
                Import vendors up to Tier {maxTier} ({vendors.filter((v) => v.tier <= maxTier).length} vendors)
              </p>
            </div>

            {/* Launch Button */}
            <Button
              onClick={startBulkImport}
              disabled={importing || selectedMethods.size === 0}
              className="w-full h-14 text-lg btn-gold disabled:opacity-50"
            >
              {importing ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Import Running...</>
              ) : (
                <><Play className="w-5 h-5 mr-2" /> Start Bulk Import ({vendors.filter((v) => v.tier <= maxTier).length} vendors)</>
              )}
            </Button>
          </div>
        )}

        {/* PER VENDOR TAB */}
        {activeTab === "vendors" && (
          <div className="space-y-4">
            <div className="glass-surface rounded-xl border border-white/[0.06] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] text-white/40 text-xs uppercase">
                    <th className="text-left p-3">Vendor</th>
                    <th className="text-center p-3">Tier</th>
                    <th className="text-left p-3">Domain</th>
                    <th className="text-left p-3">Categories</th>
                    <th className="text-right p-3">Products</th>
                    <th className="text-right p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => {
                    const vResult = vendorImportResults.get(v.id);
                    const productCount = stats?.catalog?.by_vendor?.[v.name] || 0;
                    return (
                      <tr key={v.id} className="border-t border-white/[0.06] hover:bg-white/[0.03]">
                        <td className="p-3 font-medium text-white/80">{v.name}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            v.tier === 1 ? "bg-green-500/20 text-green-400" :
                            v.tier === 2 ? "bg-gold/10 text-gold/70" :
                            v.tier === 3 ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-white/[0.06] text-white/40"
                          }`}>T{v.tier}</span>
                        </td>
                        <td className="p-3 text-white/40 text-xs">{v.domain}</td>
                        <td className="p-3 text-white/40 text-xs">{v.categories?.slice(0, 3).join(", ")}</td>
                        <td className="p-3 text-right font-mono">
                          {productCount > 0 ? <span className="text-green-400">{productCount}</span> : <span className="text-white/20">0</span>}
                        </td>
                        <td className="p-3 text-right">
                          {vResult?.status === "running" ? (
                            <Loader2 className="w-4 h-4 animate-spin text-gold inline" />
                          ) : vResult?.total_products > 0 ? (
                            <span className="text-green-400 text-xs flex items-center gap-1 justify-end">
                              <CheckCircle2 className="w-3 h-3" /> +{vResult.total_products}
                            </span>
                          ) : vResult?.total_products === 0 && vResult?.completed_at ? (
                            <span className="text-white/40 text-xs">no data</span>
                          ) : (
                            <button
                              onClick={() => importSingleVendor(v.id)}
                              className="text-gold hover:text-gold/70 text-xs flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" /> Import
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CSV UPLOAD TAB */}
        {activeTab === "csv" && (
          <div className="space-y-6">
            <div className="glass-surface rounded-xl p-6 border border-white/[0.06]">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2 text-white">
                <Upload className="w-5 h-5 text-green-400" />
                CSV / TSV Upload
              </h3>
              <p className="text-sm text-white/40 mb-4">
                Upload a CSV or TSV file with product data. Columns: product_name (required), vendor, image_url, product_url, category, material, style, collection, sku, description, retail_price, wholesale_price, color, dimensions.
              </p>

              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Vendor Name (optional)"
                  value={csvVendor}
                  onChange={(e) => setCsvVendor(e.target.value)}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2 text-sm text-white flex-1 focus:border-gold/30 focus:outline-none"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-white/[0.06] text-white/60"
                >
                  <Upload className="w-4 h-4 mr-2" /> Choose File
                </Button>
              </div>

              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={'product_name,vendor,category,retail_price,image_url,product_url\n"Aria Sofa","Bernhardt","sofa",3200,"https://...",""'}
                className="w-full h-48 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-white font-mono resize-y focus:border-gold/30 focus:outline-none"
              />

              <Button
                onClick={handleCsvUpload}
                disabled={!csvText.trim()}
                className="mt-4 btn-gold"
              >
                <Upload className="w-4 h-4 mr-2" /> Import CSV
              </Button>

              {csvResult && (
                <div className={`mt-4 p-4 rounded-lg border ${
                  csvResult.errors?.length > 0 ? "bg-red-500/10 border-red-500/20" : "bg-green-500/10 border-green-500/20"
                }`}>
                  {csvResult.errors?.length > 0 ? (
                    <div className="text-red-400 text-sm">
                      {csvResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  ) : (
                    <div className="text-green-400 text-sm">
                      <CheckCircle2 className="w-4 h-4 inline mr-1" />
                      Imported {csvResult.products_imported} products ({csvResult.rows_total} rows, {csvResult.rows_skipped} skipped)
                      {csvResult.column_mapping && (
                        <div className="text-xs text-white/40 mt-2">
                          Columns mapped: {Object.entries(csvResult.column_mapping).map(([from, to]) => `${from} -> ${to}`).join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Method-specific progress details */}
        {importStatus && Object.keys(importStatus.methods || {}).some((k) => Object.keys(importStatus.methods[k]).length > 0) && (
          <div className="mt-8 glass-surface rounded-xl p-6 border border-white/[0.06]">
            <h3 className="font-display font-semibold mb-4 text-white">Method Progress Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(importStatus.methods || {}).map(([method, vendorMap]) => {
                const entries = Object.entries(vendorMap);
                if (entries.length === 0) return null;
                return (
                  <div key={method} className="bg-white/[0.03] rounded-lg p-4 border border-white/[0.06]">
                    <h4 className="text-sm font-medium text-white/60 mb-2 capitalize">{method}</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {entries.map(([vid, p]) => (
                        <div key={vid} className="flex items-center justify-between text-xs">
                          <span className="text-white/40 truncate">{p.vendor_name || vid}</span>
                          <span className={p.products_found > 0 ? "text-green-400" : "text-white/20"}>
                            {p.products_found || 0} products
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
