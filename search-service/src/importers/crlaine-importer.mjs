/**
 * CR Laine Full Importer (HTTP — no Puppeteer needed)
 *
 * Custom-built website. Server-side HTML with lazy-loading images.
 * Listing pages: /products/CRL/cat/{id}/category/{name} — all products on one page
 * Detail pages: /productDetail/CRL/id/{id}/styleName/{name}/styleNumber/{sku}
 * Images: /assets/images/products/xlarge/{sku}.jpg, {sku}_alt1.jpg, etc.
 *
 * Phase 1: Scrape all category listing pages, extract product links
 * Phase 2: Visit every detail page for full data
 * Phase 3: Delete old CR Laine products, insert new ones
 */

import https from "node:https";

let running = false;
let shouldStop = false;
let stats = {
  running: false,
  started_at: null,
  finished_at: null,
  phase: null,
  progress: null,
  products_listed: 0,
  products_detailed: 0,
  products_inserted: 0,
  detail_errors: 0,
  errors: [],
};

export function getCRLaineStatus() {
  return { running, ...stats };
}

export function stopCRLaine() {
  if (running) { shouldStop = true; return { message: "Stop requested" }; }
  return { message: "Not running" };
}

const BASE = "https://www.crlaine.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CATEGORIES = [
  { url: "/products/CRL/cat/4/category/Sofas", category: "sofas" },
  { url: "/products/CRL/cat/5/category/Loveseats_Settees", category: "loveseats" },
  { url: "/products/CRL/cat/6/category/Sectionals", category: "sectionals" },
  { url: "/products/CRL/cat/7/category/Chairs_Chaises", category: "accent-chairs" },
  { url: "/products/CRL/cat/8/category/Swivels_Swivel Gliders", category: "accent-chairs" },
  { url: "/products/CRL/cat/9/category/Recliners", category: "recliners" },
  { url: "/products/CRL/cat/10/category/Dining_Bar Stools", category: "dining-chairs" },
  { url: "/products/CRL/cat/11/category/Ottomans", category: "ottomans" },
  { url: "/products/CRL/cat/12/category/Beds_Daybeds", category: "beds" },
  { url: "/products/CRL/cat/13/category/Accents_Web Exclusives", category: "accent-chairs" },
  { url: "/products/CRL/cat/53/category/Matching Ottomans", category: "ottomans" },
];

function slugify(text) {
  return (text || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith("http") ? url : `${BASE}${url}`;
    const parsed = new URL(fullUrl);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: { "User-Agent": UA, "Accept": "text/html" },
      timeout: 20000,
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirect = res.headers.location;
        const newUrl = redirect.startsWith("http") ? redirect : `${BASE}${redirect}`;
        fetchPage(newUrl).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

// ══════════════════════════════════════════════════════════════
// PHASE 1: Listing pages
// ══════════════════════════════════════════════════════════════

async function scrapeListingPages() {
  const allProducts = new Map(); // keyed by styleNumber (SKU)

  for (const cat of CATEGORIES) {
    if (shouldStop) break;
    console.log(`[crl] Scraping ${cat.category}: ${cat.url}`);
    stats.progress = `listing ${cat.category}`;

    try {
      const html = await fetchPage(cat.url);

      // Extract product links: /productDetail/CRL/id/{id}/styleName/{name}/styleNumber/{sku}
      const productRe = /\/productDetail\/CRL\/id\/(\d+)\/styleName\/([^\/]+)\/styleNumber\/([^"']+)/gi;
      let match;
      let pageCount = 0;

      while ((match = productRe.exec(html)) !== null) {
        const productId = match[1];
        const styleName = decodeURIComponent(match[2]).replace(/_/g, " ");
        const styleNumber = decodeURIComponent(match[3]).trim();

        if (!allProducts.has(styleNumber)) {
          allProducts.set(styleNumber, {
            productId,
            styleName,
            styleNumber,
            url: `/productDetail/CRL/id/${productId}/styleName/${match[2]}/styleNumber/${match[3]}`,
            category: cat.category,
          });
          pageCount++;
        }
      }

      console.log(`[crl] ${cat.category}: found ${pageCount} new (${allProducts.size} total unique)`);
    } catch (err) {
      console.error(`[crl] Error on ${cat.category}: ${err.message}`);
      stats.errors.push(`listing ${cat.category}: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  stats.products_listed = allProducts.size;
  console.log(`[crl] Total unique products from listings: ${allProducts.size}`);
  return allProducts;
}

// ══════════════════════════════════════════════════════════════
// PHASE 2: Detail pages
// ══════════════════════════════════════════════════════════════

async function scrapeDetailPages(productsMap) {
  const entries = [...productsMap.entries()];
  const fullProducts = [];
  let done = 0;

  for (const [styleNumber, listing] of entries) {
    if (shouldStop) break;

    const detailUrl = `${BASE}${listing.url}`;
    stats.progress = `detail ${done + 1}/${entries.length} — ${styleNumber}`;

    try {
      const html = await fetchPage(listing.url);

      // Product name
      let name = listing.styleName;
      const nameMatch = html.match(/<h2[^>]*class="[^"]*productTitle[^"]*"[^>]*>([^<]+)/i) ||
                        html.match(/<h1[^>]*>([^<]+)/i);
      if (nameMatch) name = nameMatch[1].trim();

      // Dimensions — "87W x 39D x 35H" pattern or individual fields
      const dims = {};
      const outsideMatch = html.match(/(\d+(?:\.\d+)?)W\s*x\s*(\d+(?:\.\d+)?)D\s*x\s*(\d+(?:\.\d+)?)H/);
      if (outsideMatch) {
        dims.width = outsideMatch[1];
        dims.depth = outsideMatch[2];
        dims.height = outsideMatch[3];
      }
      const insideMatch = html.match(/Inside[:\s]*([\d.]+)W\s*x\s*([\d.]+)D/i);
      if (insideMatch) {
        dims.insideWidth = insideMatch[1];
        dims.insideDepth = insideMatch[2];
      }
      const seatHMatch = html.match(/Seat\s*(?:Height)?[:\s]*([\d.]+)H/i);
      if (seatHMatch) dims.seatHeight = seatHMatch[1];
      const armHMatch = html.match(/Arm\s*(?:Height)?[:\s]*([\d.]+)H/i);
      if (armHMatch) dims.armHeight = armHMatch[1];

      let dimensions = null;
      if (dims.width || dims.depth || dims.height) {
        const parts = [];
        if (dims.width) parts.push(`W: ${dims.width}"`);
        if (dims.depth) parts.push(`D: ${dims.depth}"`);
        if (dims.height) parts.push(`H: ${dims.height}"`);
        dimensions = parts.join(" x ");
        const extras = [];
        if (dims.seatHeight) extras.push(`Seat H: ${dims.seatHeight}"`);
        if (dims.armHeight) extras.push(`Arm H: ${dims.armHeight}"`);
        if (dims.insideWidth) extras.push(`Inside: ${dims.insideWidth}" x ${dims.insideDepth || "?"}"`);
        if (extras.length > 0) dimensions += " | " + extras.join(", ");
      }

      // COM yardage
      let com = null;
      const comMatch = html.match(/Plain[:\s]*([\d.]+)\s*(?:yards?|yds?)/i);
      if (comMatch) com = comMatch[1] + " yards";
      else {
        const comAlt = html.match(/COM[:\s]*([\d.]+)\s*(?:yards?|yds?)/i);
        if (comAlt) com = comAlt[1] + " yards";
      }

      // Weight
      const weightMatch = html.match(/Weight[:\s]*([\d.]+)\s*lbs?/i);
      const weight = weightMatch ? `${weightMatch[1]} lbs` : null;

      // Cushion type
      const cushionMatch = html.match(/((?:Comfort|Spring)\s*(?:Down|Foam)\s*(?:Seat|Back))/gi);
      const cushions = cushionMatch ? [...new Set(cushionMatch)].join(", ") : null;

      // Back style
      const backMatch = html.match(/((?:Box Border|Knife Edge|Pillow|Tight|Loose|Channel)\s*Back)/i);
      const backStyle = backMatch ? backMatch[1] : null;

      // Throw pillows
      const pillowMatch = html.match(/(\d+)\s*(?:throw|accent)?\s*(?:\d+"?\s*)?(?:throw\s*)?pillows?/i);
      const throwPillows = pillowMatch ? `${pillowMatch[1]} throw pillows` : null;

      // Fabric shown
      let fabricShown = null;
      const fabricMatch = html.match(/(?:Fabric|Shown\s*in)[:\s]*([^<\n]{5,60})/i);
      if (fabricMatch) fabricShown = fabricMatch[1].trim();

      // Description
      let description = "";
      if (backStyle) description += backStyle + ". ";
      if (cushions) description += cushions + ". ";
      if (throwPillows) description += throwPillows + ". ";
      if (fabricShown) description += `Shown in: ${fabricShown}. `;
      if (com) description += `COM: ${com}. `;
      if (weight) description += `Weight: ${weight}.`;
      description = description.trim();

      // Images — construct from styleNumber
      const images = [];
      const heroUrl = `${BASE}/assets/images/products/xlarge/${styleNumber}.jpg`;
      images.push(heroUrl);
      // Add alternate images
      for (let i = 1; i <= 5; i++) {
        images.push(`${BASE}/assets/images/products/xlarge/${styleNumber}_alt${i}.jpg`);
      }

      // Material
      let material = "Upholstered Fabric"; // CR Laine is primarily fabric upholstery
      if (html.match(/leather/i)) material = "Leather";

      // Determine subcategory from product name/type
      let productType = "";
      const typeMatch = html.match(/(?:Sofa|Loveseat|Sectional|Chair|Chaise|Recliner|Ottoman|Bench|Bed|Daybed|Stool|Swivel|Glider|Settee)/i);
      if (typeMatch) productType = typeMatch[0];

      fullProducts.push({
        id: `cr-laine_${slugify(name)}-${slugify(styleNumber)}`,
        product_name: name,
        vendor_id: "cr-laine",
        vendor_name: "CR Laine",
        vendor_domain: "crlaine.com",
        vendor_tier: 2,
        category: refineCategory(listing.category, name, productType),
        sku: styleNumber,
        collection: null,
        material,
        dimensions,
        description: description || null,
        style: backStyle || null,
        retail_price: null,
        image_url: heroUrl,
        images: images.slice(0, 10),
        product_url: detailUrl,
        ingestion_source: "cr-laine-importer-v1",
        com_yardage: com,
        weight,
        cushion_type: cushions,
        back_style: backStyle,
        image_contain: true,
      });

      done++;
      if (done % 50 === 0) {
        console.log(`[crl] Detail pages: ${done}/${entries.length} (${stats.detail_errors} errors)`);
      }

      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      fullProducts.push({
        id: `cr-laine_${slugify(listing.styleName)}-${slugify(styleNumber)}`,
        product_name: listing.styleName,
        vendor_id: "cr-laine",
        vendor_name: "CR Laine",
        vendor_domain: "crlaine.com",
        vendor_tier: 2,
        category: listing.category,
        sku: styleNumber,
        image_url: `${BASE}/assets/images/products/xlarge/${styleNumber}.jpg`,
        images: [`${BASE}/assets/images/products/xlarge/${styleNumber}.jpg`],
        product_url: `${BASE}${listing.url}`,
        ingestion_source: "cr-laine-importer-v1",
        material: "Upholstered Fabric",
        image_contain: true,
      });
      done++;
      stats.detail_errors++;
      await new Promise(r => setTimeout(r, 500));
    }

    stats.products_detailed = done;
  }

  console.log(`[crl] Detail pages complete: ${done} products, ${stats.detail_errors} errors`);
  return fullProducts;
}

function refineCategory(catDefault, name, productType) {
  const n = ((name || "") + " " + (productType || "")).toLowerCase();
  if (n.includes("sofa") && !n.includes("daybed")) return "sofas";
  if (n.includes("loveseat")) return "loveseats";
  if (n.includes("settee")) return "settees";
  if (n.includes("sectional")) return "sectionals";
  if (n.includes("recliner")) return "recliners";
  if (n.includes("ottoman")) return "ottomans";
  if (n.includes("bench")) return "benches";
  if (n.includes("chaise")) return "chaises";
  if (n.includes("swivel") || n.includes("glider")) return "accent-chairs";
  if (n.includes("dining") || n.includes("bar stool") || n.includes("counter stool")) return "dining-chairs";
  if (n.includes("bed") || n.includes("daybed")) return "beds";
  if (n.includes("chair")) return "accent-chairs";
  return catDefault;
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

export async function importCRLaine(catalogDB, options = {}) {
  if (running) return { error: "Already running" };

  running = true;
  shouldStop = false;
  stats = {
    running: true,
    started_at: new Date().toISOString(),
    finished_at: null,
    phase: "listing_pages",
    progress: null,
    products_listed: 0,
    products_detailed: 0,
    products_inserted: 0,
    detail_errors: 0,
    errors: [],
  };

  try {
    console.log(`\n[crl] ═══ PHASE 1: Listing Pages ═══`);
    const productsMap = await scrapeListingPages();

    if (shouldStop) {
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    stats.phase = "detail_pages";
    console.log(`\n[crl] ═══ PHASE 2: Detail Pages (${productsMap.size} products) ═══`);
    const fullProducts = await scrapeDetailPages(productsMap);

    if (shouldStop) {
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    // Phase 3: Insert
    stats.phase = "inserting";
    console.log(`\n[crl] ═══ PHASE 3: Inserting ${fullProducts.length} products ═══`);

    if (fullProducts.length > 0 && catalogDB) {
      let existingCount = 0;
      const toDelete = [];
      for (const p of catalogDB.getAllProducts()) {
        if (p.vendor_id === "cr-laine") {
          toDelete.push(p.id);
          existingCount++;
        }
      }
      for (const id of toDelete) catalogDB.deleteProduct(id);
      console.log(`[crl] Deleted ${existingCount} existing products`);

      const result = catalogDB.insertProducts(fullProducts);
      stats.products_inserted = (result.inserted || 0) + (result.updated || 0);
      console.log(`[crl] Inserted: ${stats.products_inserted}`);
    }

    // Final stats
    let withDims = 0, withDesc = 0, noImage = 0;
    for (const p of fullProducts) {
      if (p.dimensions) withDims++;
      if (p.description) withDesc++;
      if (!p.image_url) noImage++;
    }

    stats.phase = "complete";
    stats.finished_at = new Date().toISOString();

    console.log(`\n[crl] ═══ COMPLETE ═══`);
    console.log(`[crl] Products listed:    ${stats.products_listed}`);
    console.log(`[crl] Products detailed:  ${stats.products_detailed}`);
    console.log(`[crl] Products inserted:  ${stats.products_inserted}`);
    console.log(`[crl] Detail errors:      ${stats.detail_errors}`);
    console.log(`[crl] With dimensions:    ${withDims} (${Math.round(withDims/fullProducts.length*100)}%)`);
    console.log(`[crl] With description:   ${withDesc} (${Math.round(withDesc/fullProducts.length*100)}%)`);
    console.log(`[crl] No image:           ${noImage}`);

    return stats;
  } catch (err) {
    console.error("[crl] Fatal error:", err);
    stats.phase = "error";
    stats.finished_at = new Date().toISOString();
    stats.errors.push(err.message);
    return stats;
  } finally {
    running = false;
  }
}
