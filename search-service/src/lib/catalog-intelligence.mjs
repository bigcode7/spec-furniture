/**
 * Catalog Intelligence — Auto-generated knowledge from our own product data.
 *
 * Mines the catalog to build vendor profiles, category leaders, collection maps,
 * and price tier intelligence. Regenerated on server start and after re-crawls
 * so the AI brain always has current data.
 */

import { getAllProducts, getProductCount } from "../db/catalog-db.mjs";
import { tradeVendors } from "../config/trade-vendors.mjs";

let cachedIntelligence = null;
let lastGenerated = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Build comprehensive catalog intelligence from live product data.
 * Returns a formatted string for inclusion in the AI system prompt.
 */
export function buildCatalogIntelligence() {
  const now = Date.now();
  if (cachedIntelligence && (now - lastGenerated) < CACHE_TTL_MS) {
    return cachedIntelligence;
  }

  const vendorProfiles = {};
  const categoryLeaders = {};
  const collectionMap = {};
  const priceByCategory = {};

  // Single pass through all products
  for (const p of getAllProducts()) {
    const vid = p.vendor_id || "unknown";
    const cat = p.category || "uncategorized";
    const col = p.collection || null;

    // ── Vendor profile accumulation ──
    if (!vendorProfiles[vid]) {
      vendorProfiles[vid] = {
        name: p.vendor_name || vid,
        count: 0,
        categories: {},
        materials: {},
        styles: {},
        prices: [],
        collections: new Set(),
        qualitySum: 0,
      };
    }
    const vp = vendorProfiles[vid];
    vp.count++;
    vp.categories[cat] = (vp.categories[cat] || 0) + 1;
    if (p.material) vp.materials[p.material] = (vp.materials[p.material] || 0) + 1;
    if (p.style) vp.styles[p.style] = (vp.styles[p.style] || 0) + 1;
    if (p.retail_price && p.retail_price > 0) vp.prices.push(p.retail_price);
    if (col) vp.collections.add(col);
    vp.qualitySum += (p.quality_score || 0);

    // ── Category leader accumulation ──
    if (!categoryLeaders[cat]) {
      categoryLeaders[cat] = {};
    }
    if (!categoryLeaders[cat][vid]) {
      categoryLeaders[cat][vid] = { count: 0, qualitySum: 0, prices: [] };
    }
    categoryLeaders[cat][vid].count++;
    categoryLeaders[cat][vid].qualitySum += (p.quality_score || 0);
    if (p.retail_price && p.retail_price > 0) categoryLeaders[cat][vid].prices.push(p.retail_price);

    // ── Collection map ──
    if (col && col.length > 1) {
      const colKey = `${vid}::${col}`;
      if (!collectionMap[colKey]) {
        collectionMap[colKey] = { vendor: p.vendor_name || vid, vendorId: vid, name: col, products: [] };
      }
      if (collectionMap[colKey].products.length < 12) {
        collectionMap[colKey].products.push({
          name: p.product_name,
          category: cat,
          price: p.retail_price || null,
        });
      }
    }

    // ── Price by category ──
    if (p.retail_price && p.retail_price > 0) {
      if (!priceByCategory[cat]) priceByCategory[cat] = [];
      priceByCategory[cat].push(p.retail_price);
    }
  }

  // ── Format vendor profiles ──
  const vendorLines = [];
  const sortedVendors = Object.entries(vendorProfiles)
    .sort((a, b) => b[1].count - a[1].count);

  for (const [vid, vp] of sortedVendors) {
    const topCats = Object.entries(vp.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c, n]) => `${c}(${n})`)
      .join(", ");

    const topMats = Object.entries(vp.materials)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([m]) => m)
      .join(", ");

    const topStyles = Object.entries(vp.styles)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s)
      .join(", ");

    let priceRange = "";
    if (vp.prices.length > 2) {
      const sorted = vp.prices.sort((a, b) => a - b);
      const p10 = sorted[Math.floor(sorted.length * 0.1)];
      const p90 = sorted[Math.floor(sorted.length * 0.9)];
      priceRange = `$${Math.round(p10).toLocaleString()}-$${Math.round(p90).toLocaleString()}`;
    }

    const avgQuality = Math.round(vp.qualitySum / vp.count);
    const numCollections = vp.collections.size;

    vendorLines.push(
      `- ${vp.name} (${vid}): ${vp.count} products. Top categories: ${topCats}. ` +
      `Materials: ${topMats || "varied"}. Style: ${topStyles || "mixed"}. ` +
      (priceRange ? `Price range: ${priceRange}. ` : "") +
      (numCollections > 1 ? `${numCollections} collections. ` : "") +
      `Avg quality: ${avgQuality}/100.`
    );
  }

  // ── Format category leaders ──
  const categoryLines = [];
  const sortedCategories = Object.entries(categoryLeaders)
    .sort((a, b) => {
      const totalA = Object.values(a[1]).reduce((s, v) => s + v.count, 0);
      const totalB = Object.values(b[1]).reduce((s, v) => s + v.count, 0);
      return totalB - totalA;
    });

  for (const [cat, vendors] of sortedCategories) {
    const leaders = Object.entries(vendors)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([vid, data]) => {
        const avgQ = Math.round(data.qualitySum / data.count);
        const avgPrice = data.prices.length > 0
          ? "$" + Math.round(data.prices.reduce((a, b) => a + b, 0) / data.prices.length).toLocaleString()
          : "";
        return `${vid}(${data.count}${avgPrice ? ", avg " + avgPrice : ""}, q${avgQ})`;
      })
      .join(", ");

    const total = Object.values(vendors).reduce((s, v) => s + v.count, 0);
    categoryLines.push(`- ${cat} (${total} total): ${leaders}`);
  }

  // ── Format collection pairing intelligence ──
  const collectionLines = [];
  const significantCollections = Object.values(collectionMap)
    .filter(c => c.products.length >= 3) // only collections with 3+ pieces
    .sort((a, b) => b.products.length - a.products.length)
    .slice(0, 60); // top 60 collections

  for (const col of significantCollections) {
    const pieces = col.products
      .map(p => `${p.name} [${p.category}]`)
      .join(", ");
    collectionLines.push(`- ${col.vendor} "${col.name}": ${pieces}`);
  }

  // ── Format price tiers by category ──
  const priceTierLines = [];
  for (const [cat, prices] of Object.entries(priceByCategory)) {
    if (prices.length < 5) continue;
    const sorted = prices.sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const p25 = sorted[Math.floor(sorted.length * 0.25)];
    const p75 = sorted[Math.floor(sorted.length * 0.75)];
    priceTierLines.push(
      `- ${cat}: budget <$${Math.round(p25).toLocaleString()}, mid $${Math.round(p25).toLocaleString()}-$${Math.round(p75).toLocaleString()}, premium >$${Math.round(p75).toLocaleString()} (median $${Math.round(median).toLocaleString()})`
    );
  }

  const totalProducts = getProductCount();

  cachedIntelligence = `
═══ LIVE CATALOG INTELLIGENCE (auto-generated from ${totalProducts} products) ═══

VENDOR PROFILES (what each vendor actually has in our catalog):
${vendorLines.join("\n")}

CATEGORY LEADERS (best vendors per category — count, avg price, quality score):
${categoryLines.join("\n")}

COLLECTION PAIRING MAP (products designed to go together — suggest collection mates):
${collectionLines.join("\n")}

PRICE TIERS BY CATEGORY (use for budget-appropriate recommendations):
${priceTierLines.join("\n")}`;

  lastGenerated = now;
  console.log(`[catalog-intelligence] Generated intelligence: ${vendorLines.length} vendors, ${categoryLines.length} categories, ${collectionLines.length} collections, ${priceTierLines.length} price tiers`);
  return cachedIntelligence;
}

/**
 * Force refresh of cached intelligence (call after re-crawl).
 */
export function refreshCatalogIntelligence() {
  cachedIntelligence = null;
  lastGenerated = 0;
}
