/**
 * Hancock & Moore Full Importer (HTTP — no Puppeteer needed)
 *
 * Server-side rendered HTML. Products listed at /Products/Search?TypeID=...
 * Detail pages at /Products/Detail?SKU=...
 * Images at /Products/ResizeImage?imageName=...
 * High-res at /Documents/prod-images/...
 *
 * Phase 1: Scrape all category listing pages, extract product SKUs/names
 * Phase 2: Visit every detail page for full data (dims, images, COM/COL, description)
 * Phase 3: Delete old H&M products, insert new ones
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

export function getHancockMooreStatus() {
  return { running, ...stats };
}

export function stopHancockMoore() {
  if (running) { shouldStop = true; return { message: "Stop requested" }; }
  return { message: "Not running" };
}

const BASE = "https://hancockandmoore.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// All category listing pages to crawl
const CATEGORIES = [
  { url: "/Products/Search?TypeID=SOFAS", category: "sofas" },
  { url: "/Products/Search?TypeID=CAT2", category: "accent-chairs" },   // Stationary Lounge Chairs
  { url: "/Products/Search?TypeID=CAT4", category: "accent-chairs" },   // Occasional Chairs
  { url: "/Products/Search?TypeID=CAT5", category: "accent-chairs" },   // Wing Chairs
  { url: "/Products/Search?TypeID=CAT9%2CCSTOOL", category: "bar-stools" },
  { url: "/Products/Search?TypeID=CAT13", category: "desk-chairs" },    // Executive Chairs
  { url: "/Products/Search?TypeID=CAT14", category: "sectionals" },
  { url: "/Products/Search?TypeID=CAT15", category: "recliners" },
  { url: "/Products/Search?TypeID=CAT18", category: "recliners" },      // Power Recliners
  { url: "/Products/Search?TypeID=CAT19", category: "recliners" },      // Power Lift Chairs
  { url: "/Products/Search?TypeID=CAT23%2CCAT28", category: "ottomans" }, // Benches/Ottomans
  { url: "/Products/Search?TypeID=CAT26", category: "dining-chairs" },
  { url: "/Products/Search?TypeID=CAT27", category: "accent-chairs" },  // Game Chairs
  { url: "/Products/Search?TypeID=CAT30", category: "accent-chairs" },  // Swivel/Gliders
  { url: "/Products/Search?TypeID=SETTEES", category: "settees" },
  { url: "/Products/Search?TypeID=CAT16", category: "sleeper-sofas" },  // Sleepers
  { url: "/Products/Search?TypeID=STOCKED", category: "accent-chairs" }, // Stocked Styles
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
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 20000,
    };

    const req = https.request(options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchPage(res.headers.location).then(resolve).catch(reject);
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
// PHASE 1: Listing pages — extract product links
// ══════════════════════════════════════════════════════════════

async function scrapeListingPages() {
  const allProducts = new Map(); // keyed by SKU

  for (const cat of CATEGORIES) {
    if (shouldStop) break;
    console.log(`[hm] Scraping ${cat.category}: ${cat.url}`);

    let pageNum = 1;
    let hasMore = true;

    while (hasMore && !shouldStop) {
      const url = pageNum === 1 ? cat.url : `${cat.url}&Page=${pageNum}`;
      stats.progress = `listing ${cat.category} p${pageNum}`;

      try {
        const html = await fetchPage(url);

        // Extract product cards: <a href="/Products/Detail?SKU=...">
        //   <img src="/ImgSearch/ResizeImage?imageName=..." alt="...">
        //   <div>SKU</div>
        //   <div>Product Name</div>
        // </a>
        const productRe = /href="\/Products\/Detail\?SKU=([^"]+)"[^>]*>\s*<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>[^<]*(?:<div[^>]*>\s*([^<]+)\s*<\/div>\s*){1,2}/gi;
        let match;
        let pageCount = 0;

        while ((match = productRe.exec(html)) !== null) {
          const sku = decodeURIComponent(match[1]).trim();
          const imgSrc = match[2];
          const altText = match[3].trim();
          const nameText = match[4]?.trim() || altText;

          if (!allProducts.has(sku)) {
            // Build image URL — use high-res version
            const imgNameMatch = imgSrc.match(/imageName=([^&]+)/);
            const imageName = imgNameMatch ? imgNameMatch[1] : "";
            const imageUrl = imageName
              ? `${BASE}/Documents/prod-images/${imageName}`
              : imgSrc.startsWith("/") ? `${BASE}${imgSrc}` : imgSrc;

            allProducts.set(sku, {
              sku,
              name: nameText || altText,
              image: imageUrl,
              imageName,
              category: cat.category,
            });
            pageCount++;
          }
        }

        // Also try simpler pattern for product links
        if (pageCount === 0) {
          const simpleRe = /href="\/Products\/Detail\?SKU=([^"]+)"/gi;
          let sm;
          while ((sm = simpleRe.exec(html)) !== null) {
            const sku = decodeURIComponent(sm[1]).trim();
            if (!allProducts.has(sku)) {
              allProducts.set(sku, {
                sku,
                name: sku,
                image: "",
                imageName: "",
                category: cat.category,
              });
              pageCount++;
            }
          }
        }

        // Check for next page
        const nextPageRe = new RegExp(`Page=${pageNum + 1}`, "i");
        hasMore = nextPageRe.test(html) && pageCount > 0;
        pageNum++;

      } catch (err) {
        console.error(`[hm] Error on ${cat.category} p${pageNum}: ${err.message}`);
        stats.errors.push(`listing ${cat.category} p${pageNum}: ${err.message}`);
        hasMore = false;
      }

      await new Promise(r => setTimeout(r, 300));
    }

    console.log(`[hm] ${cat.category}: ${allProducts.size} total unique products`);
  }

  stats.products_listed = allProducts.size;
  console.log(`[hm] Total unique products from listings: ${allProducts.size}`);
  return allProducts;
}

// ══════════════════════════════════════════════════════════════
// PHASE 2: Detail pages — extract full product data
// ══════════════════════════════════════════════════════════════

async function scrapeDetailPages(productsMap) {
  const entries = [...productsMap.entries()];
  const fullProducts = [];
  let done = 0;

  for (const [sku, listing] of entries) {
    if (shouldStop) break;

    const detailUrl = `${BASE}/Products/Detail?SKU=${encodeURIComponent(sku)}`;
    stats.progress = `detail ${done + 1}/${entries.length} — ${sku}`;

    try {
      const html = await fetchPage(detailUrl);

      // Extract product name — from <h1> or title
      let name = "";
      const h2Match = html.match(/<h2[^>]*>\s*([\s\S]*?)\s*<\/h2>/i);
      if (h2Match) name = h2Match[1].replace(/<[^>]+>/g, "").trim();
      if (!name) {
        const titleMatch = html.match(/<title>([^<]+)/i);
        if (titleMatch) name = titleMatch[1].replace(/\s*-\s*Hancock.*$/i, "").trim();
      }
      if (!name) name = listing.name;

      // Extract ALL images
      const images = [];
      const imgRe = /(?:src|data-src)="(\/(?:Products\/ResizeImage|Documents\/prod-images|ImgSearch\/ResizeImage)[^"]+)"/gi;
      let imgMatch;
      const seenImgNames = new Set();
      while ((imgMatch = imgRe.exec(html)) !== null) {
        let src = imgMatch[1];
        // Extract image filename
        const nameMatch = src.match(/imageName=([^&"]+)/i);
        const imgName = nameMatch ? nameMatch[1] : src.split("/").pop();

        if (seenImgNames.has(imgName)) continue;
        seenImgNames.add(imgName);

        // Build high-res URL
        if (nameMatch) {
          src = `/Documents/prod-images/${nameMatch[1]}`;
        }
        images.push(`${BASE}${src}`);
      }

      // Also look for direct image paths
      const directImgRe = /src="(\/Documents\/prod-images\/[^"]+)"/gi;
      while ((imgMatch = directImgRe.exec(html)) !== null) {
        const url = `${BASE}${imgMatch[1]}`;
        if (!images.includes(url)) images.push(url);
      }

      // Extract dimensions from text
      const dims = {};
      const dimPatterns = [
        { key: "height", re: /Height[:\s]*([\d.]+)["'″]?/i },
        { key: "width", re: /Width[:\s]*([\d.]+)["'″]?/i },
        { key: "depth", re: /Depth[:\s]*([\d.]+)["'″]?/i },
        { key: "insideWidth", re: /Inside\s*Width[:\s]*([\d.]+)["'″]?/i },
        { key: "insideDepth", re: /Inside\s*Depth[:\s]*([\d.]+)["'″]?/i },
        { key: "seatHeight", re: /Seat\s*Height[:\s]*([\d.]+)["'″]?/i },
        { key: "armHeight", re: /Arm\s*Height[:\s]*([\d.]+)["'″]?/i },
      ];
      for (const { key, re } of dimPatterns) {
        const m = html.match(re);
        if (m) dims[key] = m[1];
      }

      let dimensions = null;
      if (dims.width || dims.depth || dims.height) {
        const parts = [];
        if (dims.width) parts.push(`W: ${dims.width}"`);
        if (dims.depth) parts.push(`D: ${dims.depth}"`);
        if (dims.height) parts.push(`H: ${dims.height}"`);
        dimensions = parts.join(" x ");
        const extras = [];
        if (dims.seatHeight) extras.push(`Seat H: ${dims.seatHeight}"`);
        if (dims.insideWidth) extras.push(`Inside W: ${dims.insideWidth}"`);
        if (dims.insideDepth) extras.push(`Inside D: ${dims.insideDepth}"`);
        if (dims.armHeight) extras.push(`Arm H: ${dims.armHeight}"`);
        if (extras.length > 0) dimensions += " | " + extras.join(", ");
      }

      // COM/COL
      const comMatch = html.match(/COM[^:]*?:\s*([\d.]+)\s*(?:yards?|yds?)/i);
      const com = comMatch ? comMatch[1] + " yards" : null;
      const colMatch = html.match(/COL[^:]*?:\s*([\d.]+)\s*(?:sq\.?\s*ft|square)/i);
      const col = colMatch ? colMatch[1] + " sq ft" : null;

      // Description — "Photographed in..." or other descriptive text
      let description = "";
      const descMatch = html.match(/Photographed\s+in\s+([^<]+)/i);
      if (descMatch) description = `Photographed in ${descMatch[1].trim()}`;

      // Also look for features/notes
      const featureRe = /<li[^>]*>([^<]{10,200})<\/li>/gi;
      const features = [];
      let fm;
      while ((fm = featureRe.exec(html)) !== null) {
        const text = fm[1].trim();
        if (text.length > 10 && !text.includes("{") && !text.includes("function")) {
          features.push(text);
        }
      }

      // Material — leather/fabric from description or features
      let material = "Leather";  // H&M is primarily leather
      if (description.toLowerCase().includes("fabric")) material = "Fabric";
      if (html.match(/leather/i) && html.match(/fabric/i)) material = "Leather/Fabric";

      // Build full description
      if (com) description += `\nCOM: ${com}`;
      if (col) description += `\nCOL: ${col}`;
      if (features.length > 0) {
        description += "\n" + features.slice(0, 5).join(". ");
      }
      description = description.trim();
      if (description.length > 1000) description = description.slice(0, 997) + "...";

      // Clean name — remove leading SKU if present
      let cleanName = name.replace(/^\d+[-\w]*\s+/, "").trim() || name;
      // But keep original if cleaning made it too short
      if (cleanName.length < 3) cleanName = name;

      const heroImage = images[0] || (listing.image || null);

      fullProducts.push({
        id: `hancock-moore_${slugify(cleanName)}-${slugify(sku)}`,
        product_name: cleanName,
        vendor_id: "hancock-moore",
        vendor_name: "Hancock & Moore",
        vendor_domain: "hancockandmoore.com",
        vendor_tier: 1,
        category: refineCategory(listing.category, cleanName),
        sku,
        collection: null,
        material,
        dimensions,
        description: description || null,
        style: null,
        retail_price: null,
        image_url: heroImage,
        images: images.slice(0, 20),
        product_url: detailUrl,
        ingestion_source: "hancock-moore-importer-v1",
        com_yardage: com,
        col_sqft: col,
        image_contain: true,
      });

      done++;
      if (done % 50 === 0) {
        console.log(`[hm] Detail pages: ${done}/${entries.length} (${stats.detail_errors} errors)`);
      }
      if (done % 200 === 0) {
        let multiImg = 0, withDesc = 0, withDims = 0;
        for (const p of fullProducts) {
          if (p.images && p.images.length > 1) multiImg++;
          if (p.description) withDesc++;
          if (p.dimensions) withDims++;
        }
        console.log(`[hm] ══ ${done} PRODUCTS MILESTONE ══`);
        console.log(`[hm]   Multi-image: ${multiImg} (${Math.round(multiImg/done*100)}%)`);
        console.log(`[hm]   With description: ${withDesc} (${Math.round(withDesc/done*100)}%)`);
        console.log(`[hm]   With dimensions: ${withDims} (${Math.round(withDims/done*100)}%)`);
      }

      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      // Use listing data only
      fullProducts.push({
        id: `hancock-moore_${slugify(listing.name)}-${slugify(sku)}`,
        product_name: listing.name || sku,
        vendor_id: "hancock-moore",
        vendor_name: "Hancock & Moore",
        vendor_domain: "hancockandmoore.com",
        vendor_tier: 1,
        category: listing.category,
        sku,
        image_url: listing.image || null,
        images: listing.image ? [listing.image] : [],
        product_url: `${BASE}/Products/Detail?SKU=${encodeURIComponent(sku)}`,
        ingestion_source: "hancock-moore-importer-v1",
        material: "Leather",
        image_contain: true,
      });
      done++;
      stats.detail_errors++;

      if (stats.detail_errors % 20 === 0) {
        console.warn(`[hm] ${stats.detail_errors} detail errors so far`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    stats.products_detailed = done;
  }

  console.log(`[hm] Detail pages complete: ${done} products, ${stats.detail_errors} errors`);
  return fullProducts;
}

function refineCategory(catDefault, name) {
  const n = (name || "").toLowerCase();
  if (n.includes("sofa")) return "sofas";
  if (n.includes("loveseat")) return "loveseats";
  if (n.includes("sectional")) return "sectionals";
  if (n.includes("recliner") || n.includes("reclining")) return "recliners";
  if (n.includes("ottoman")) return "ottomans";
  if (n.includes("bench")) return "benches";
  if (n.includes("bar stool") || n.includes("barstool")) return "bar-stools";
  if (n.includes("counter stool")) return "bar-stools";
  if (n.includes("dining chair")) return "dining-chairs";
  if (n.includes("wing chair")) return "accent-chairs";
  if (n.includes("desk chair") || n.includes("executive")) return "desk-chairs";
  if (n.includes("swivel")) return "accent-chairs";
  if (n.includes("glider")) return "accent-chairs";
  if (n.includes("settee")) return "settees";
  if (n.includes("sleeper")) return "sleeper-sofas";
  if (n.includes("chaise")) return "chaises";
  if (n.includes("chair")) return "accent-chairs";
  return catDefault;
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

export async function importHancockMoore(catalogDB, options = {}) {
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
    // Phase 1
    console.log(`\n[hm] ═══ PHASE 1: Listing Pages ═══`);
    const productsMap = await scrapeListingPages();

    if (shouldStop) {
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    // Phase 2
    stats.phase = "detail_pages";
    console.log(`\n[hm] ═══ PHASE 2: Detail Pages (${productsMap.size} products) ═══`);
    const fullProducts = await scrapeDetailPages(productsMap);

    if (shouldStop) {
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    // Phase 3: Insert
    stats.phase = "inserting";
    console.log(`\n[hm] ═══ PHASE 3: Inserting ${fullProducts.length} products ═══`);

    if (fullProducts.length > 0 && catalogDB) {
      // Delete existing Hancock & Moore products
      let existingCount = 0;
      const toDelete = [];
      for (const p of catalogDB.getAllProducts()) {
        if (p.vendor_id === "hancock-moore") {
          toDelete.push(p.id);
          existingCount++;
        }
      }
      for (const id of toDelete) catalogDB.deleteProduct(id);
      console.log(`[hm] Deleted ${existingCount} existing products`);

      const result = catalogDB.insertProducts(fullProducts);
      stats.products_inserted = (result.inserted || 0) + (result.updated || 0);
      console.log(`[hm] Inserted: ${stats.products_inserted}`);
    }

    // Final stats
    let multiImage = 0, withDesc = 0, withDims = 0, withMaterial = 0, noImage = 0;
    for (const p of fullProducts) {
      if (p.images && p.images.length > 1) multiImage++;
      if (p.description && p.description.length > 20) withDesc++;
      if (p.dimensions) withDims++;
      if (p.material) withMaterial++;
      if (!p.image_url) noImage++;
    }

    stats.phase = "complete";
    stats.finished_at = new Date().toISOString();

    console.log(`\n[hm] ═══ COMPLETE ═══`);
    console.log(`[hm] Products listed:      ${stats.products_listed}`);
    console.log(`[hm] Products detailed:    ${stats.products_detailed}`);
    console.log(`[hm] Products inserted:    ${stats.products_inserted}`);
    console.log(`[hm] Detail page errors:   ${stats.detail_errors}`);
    console.log(`[hm] Multi-image:          ${multiImage} (${Math.round(multiImage/fullProducts.length*100)}%)`);
    console.log(`[hm] With description:     ${withDesc} (${Math.round(withDesc/fullProducts.length*100)}%)`);
    console.log(`[hm] With dimensions:      ${withDims} (${Math.round(withDims/fullProducts.length*100)}%)`);
    console.log(`[hm] With materials:       ${withMaterial} (${Math.round(withMaterial/fullProducts.length*100)}%)`);
    console.log(`[hm] No image:             ${noImage}`);

    // Sample products
    console.log(`\n[hm] ═══ SAMPLE PRODUCTS ═══`);
    const sampleIndices = [0, Math.floor(fullProducts.length * 0.25), Math.floor(fullProducts.length * 0.5), Math.floor(fullProducts.length * 0.75), fullProducts.length - 1];
    for (const idx of sampleIndices) {
      const p = fullProducts[idx];
      if (!p) continue;
      console.log(`\n[hm] --- ${p.product_name} (${p.sku}) ---`);
      console.log(`[hm]   Images: ${p.images?.length || 0} | Hero: ${p.image_url?.slice(0, 80) || "NONE"}`);
      console.log(`[hm]   Dims: ${p.dimensions || "NONE"}`);
      console.log(`[hm]   Material: ${p.material || "NONE"}`);
      console.log(`[hm]   Description: ${p.description?.slice(0, 100) || "NONE"}`);
    }

    return stats;
  } catch (err) {
    console.error("[hm] Fatal error:", err);
    stats.phase = "error";
    stats.finished_at = new Date().toISOString();
    stats.errors.push(err.message);
    return stats;
  } finally {
    running = false;
  }
}
