import { getVendorAdapter, vendorAdapters } from "../adapters/index.mjs";
import { writeCatalog, appendRun, readCatalog, readVerifiedCatalog, writeVerifiedCatalog } from "./store.mjs";

export function seedSampleCatalog() {
  return ingestVendors({ mode: "seed", vendorIds: vendorAdapters.map((adapter) => adapter.vendorId) });
}

export async function ingestVendors({ vendorIds = [], mode = "seed" } = {}) {
  const startedAt = new Date().toISOString();
  const selectedAdapters = vendorIds.length
    ? vendorIds.map((vendorId) => getVendorAdapter(vendorId)).filter(Boolean)
    : vendorAdapters;

  const results = [];
  const products = [];

  for (const adapter of selectedAdapters) {
    try {
      const result = await adapter.ingest({ mode });
      results.push({
        vendor_id: result.vendor_id,
        vendor_name: result.vendor_name,
        mode: result.mode,
        crawl_targets: result.crawl_targets,
        product_count: result.product_count,
        status: "success",
      });
      products.push(...result.products);
    } catch (error) {
      results.push({
        vendor_id: adapter.vendorId,
        vendor_name: adapter.label,
        mode,
        crawl_targets: adapter.crawlTargets || [],
        product_count: 0,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const dedupedProducts = dedupeProducts(products);
  const catalogPayload = writeCatalog(dedupedProducts);
  const verifiedCatalogPayload = syncVerifiedCatalog(dedupedProducts, mode);
  appendRun({
    id: `run_${Date.now()}`,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    mode,
    vendor_ids: selectedAdapters.map((adapter) => adapter.vendorId),
    product_count: dedupedProducts.length,
    verified_product_count: verifiedCatalogPayload.products.length,
    vendor_results: results,
  });

  return {
    ...catalogPayload,
    verified_products: verifiedCatalogPayload.products,
    verified_updated_at: verifiedCatalogPayload.updated_at,
    vendor_results: results,
  };
}

export function getCatalogSummary() {
  const catalog = readCatalog();
  return {
    updated_at: catalog.updated_at,
    product_count: catalog.products.length,
    verified_product_count: readVerifiedCatalog().products.length,
    vendors: Array.from(new Set(catalog.products.map((product) => product.vendor_name))).sort(),
  };
}

function dedupeProducts(products) {
  const map = new Map();
  for (const product of products) {
    const key = `${product.vendor_id}::${product.product_name}`.toLowerCase();
    if (!map.has(key)) {
      map.set(key, product);
    }
  }
  return Array.from(map.values());
}

function syncVerifiedCatalog(products, mode) {
  const verifiedNow = products.filter(isVerifiedProduct);
  if (mode !== "live") {
    return writeVerifiedCatalog(verifiedNow);
  }

  const existing = readVerifiedCatalog().products || [];
  const merged = dedupeProducts([...existing, ...verifiedNow]).filter(isVerifiedProduct);
  return writeVerifiedCatalog(merged);
}

function isVerifiedProduct(product) {
  return Boolean(product?.image_verified && product?.product_url_verified);
}
