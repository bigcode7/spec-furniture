/**
 * Baker Furniture Full Importer (Puppeteer)
 *
 * Baker uses Umbraco CMS with client-side rendering. Products are loaded
 * via /umbraco/api/productapi/GetProducts and rendered with Handlebars.
 * Images are served from Scene7 CDN (s7d4.scene7.com/is/image/KIG/).
 *
 * Phase 1: Navigate all category listing pages with Puppeteer,
 *          intercept GetProducts API responses for structured data
 * Phase 2: Visit every product detail page for full enrichment
 *          (description, all images, COM/COL, specs)
 * Phase 3: Delete old Baker products, insert new ones
 */

let browser = null;
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

export function getBakerStatus() {
  return { running, ...stats };
}

export function stopBaker() {
  if (running) { shouldStop = true; return { message: "Stop requested" }; }
  return { message: "Not running" };
}

const BASE = "https://www.bakerfurniture.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

// All leaf category pages to crawl
const CATEGORIES = [
  // Living
  { url: "/living/seating/sofas/", category: "sofas" },
  { url: "/living/seating/chairs/", category: "accent-chairs" },
  { url: "/living/seating/sectionals/", category: "sectionals" },
  { url: "/living/seating/chaises/", category: "chaises" },
  { url: "/living/seating/benches/", category: "benches" },
  { url: "/living/seating/ottomans/", category: "ottomans" },
  // Living tables — use hash filters for subcategories
  { url: "/living/tables/tables/#!PRODUCT_SUBCATEGORY=Cocktail+Tables", category: "cocktail-tables" },
  { url: "/living/tables/tables/#!PRODUCT_SUBCATEGORY=Consoles", category: "console-tables" },
  { url: "/living/tables/tables/#!PRODUCT_SUBCATEGORY=Center+Tables", category: "center-tables" },
  { url: "/living/tables/tables/#!PRODUCT_SUBCATEGORY=Side/Spot+Tables", category: "side-tables" },
  { url: "/living/tables/tables/#!PRODUCT_SUBCATEGORY=Nesting+Tables", category: "nesting-tables" },
  // Living storage
  { url: "/living/storage-display/chests/", category: "chests" },
  { url: "/living/storage-display/cabinets/", category: "cabinets" },
  { url: "/living/storage-display/servers/", category: "sideboards" },
  { url: "/living/storage-display/etageres/", category: "bookcases" },
  // Living lighting
  { url: "/living/lighting/", category: "lighting" },
  // Living accessories
  { url: "/living/accessories/accessories/", category: "decorative-objects" },
  // Dining
  { url: "/dining/tables/tables/#!PRODUCT_SUBCATEGORY=Dining+Tables", category: "dining-tables" },
  { url: "/dining/tables/tables/#!PRODUCT_SUBCATEGORY=Consoles", category: "console-tables" },
  { url: "/dining/tables/tables/#!PRODUCT_SUBCATEGORY=Center+Tables", category: "center-tables" },
  { url: "/dining/seating/chairs/", category: "dining-chairs" },
  { url: "/dining/seating/barcounterstools/", category: "bar-stools" },
  { url: "/dining/seating/benches/", category: "benches" },
  { url: "/dining/storage-display/cabinets/", category: "cabinets" },
  { url: "/dining/storage-display/servers/", category: "sideboards" },
  { url: "/dining/storage-display/chests/", category: "chests" },
  { url: "/dining/storage-display/etageres/", category: "bookcases" },
  { url: "/dining/lighting/", category: "lighting" },
  { url: "/dining/accessories/accessories/", category: "decorative-objects" },
  // Bedroom
  { url: "/bedroom/beds/beds/", category: "beds" },
  { url: "/bedroom/tables/nightstands/", category: "nightstands" },
  { url: "/bedroom/tables/tables/", category: "side-tables" },
  { url: "/bedroom/storage-display/cabinets/", category: "cabinets" },
  { url: "/bedroom/storage-display/chests/", category: "dressers" },
  { url: "/bedroom/seating/benches/", category: "benches" },
  { url: "/bedroom/seating/chaises/", category: "chaises" },
  { url: "/bedroom/lighting/", category: "lighting" },
  { url: "/bedroom/accessories/accessories/", category: "decorative-objects" },
  // Workspace
  { url: "/workspace/desks/", category: "desks" },
  { url: "/workspace/storage-display/cabinets/", category: "cabinets" },
  { url: "/workspace/storage-display/etageres/", category: "bookcases" },
  { url: "/workspace/lighting/", category: "lighting" },
  { url: "/workspace/tables/tables/", category: "console-tables" },
  { url: "/workspace/accessories/accessories/", category: "decorative-objects" },
  // Outdoor
  { url: "/outdoor/seating/sofas/", category: "outdoor-sofas" },
  { url: "/outdoor/seating/chairs/", category: "outdoor-chairs" },
  { url: "/outdoor/seating/sectionals/", category: "outdoor-sectionals" },
  { url: "/outdoor/seating/chaises/", category: "outdoor-chaises" },
  { url: "/outdoor/seating/ottomans/", category: "outdoor-ottomans" },
  { url: "/outdoor/seating/benches/", category: "outdoor-benches" },
  { url: "/outdoor/seating/stools/", category: "outdoor-stools" },
  { url: "/outdoor/tables/tables/", category: "outdoor-tables" },
  { url: "/outdoor/accessories/", category: "outdoor-accessories" },
];

function slugify(text) {
  return (text || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function launchBrowser() {
  if (browser) return browser;
  const puppeteer = await import("puppeteer");
  browser = await puppeteer.default.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  return browser;
}

async function closeBrowser() {
  if (browser) { await browser.close().catch(() => {}); browser = null; }
}

async function newPage(blockImages = true) {
  const b = await launchBrowser();
  const page = await b.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", req => {
    const type = req.resourceType();
    // Block images/fonts/media for speed, but keep stylesheets (Baker needs CSS for rendering)
    if (blockImages && ["image", "font", "media"].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });
  return page;
}

// ══════════════════════════════════════════════════════════════
// PHASE 1: Listing pages — extract product links from rendered DOM
// ══════════════════════════════════════════════════════════════

async function scrapeListingPages() {
  const allProducts = new Map(); // keyed by slug
  const page = await newPage();

  for (const cat of CATEGORIES) {
    if (shouldStop) break;
    const url = `${BASE}${cat.url}`;
    stats.progress = `listing ${cat.category}`;
    console.log(`[baker] Scraping ${cat.category}: ${url}`);

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

      // Wait for products to load — Baker renders via API + Handlebars
      await new Promise(r => setTimeout(r, 5000));

      // Scroll to bottom to trigger lazy loading
      await autoScroll(page);
      await new Promise(r => setTimeout(r, 3000));

      // Extract all product links from the rendered page
      const products = await page.evaluate((baseUrl, catDefault) => {
        const items = [];
        // Look for product links — Baker product URLs have 4+ path segments
        // e.g., /living/seating/sofas/parlor-sofa-baa4406s/
        const links = document.querySelectorAll("a[href]");
        const seen = new Set();

        for (const link of links) {
          const href = link.getAttribute("href");
          if (!href) continue;

          // Must be a product detail URL (4+ path segments with a SKU-like slug)
          const fullUrl = href.startsWith("http") ? href : baseUrl + href;
          const path = new URL(fullUrl).pathname;
          const segments = path.split("/").filter(Boolean);
          if (segments.length < 4) continue;

          // Last segment should be a product slug (contains a hyphenated name)
          const slug = segments[segments.length - 1];
          // Skip known non-product segments
          if (["bespoke-custom-seating", "bespoke-in-motion", "essentials-upholstery",
               "essentials-dining", "bespoke-custom-beds", "bespoke-custom-pillows"].includes(slug)) continue;

          // SKU pattern: slug ends with something like -baa4406s or -6729s
          if (!/[a-z0-9]-[a-z]{0,3}\d{3,}[a-z]?(?:-\d+)?$/i.test(slug)) continue;

          if (seen.has(slug)) continue;
          seen.add(slug);

          // Try to get product name and image from context
          const li = link.closest("li") || link.closest("div");
          let name = "";
          let image = "";
          let sku = "";

          // Extract name from link text or nearby elements
          const nameEl = li?.querySelector("a") || link;
          name = nameEl.textContent?.trim() || "";
          if (name.length > 200) name = "";

          // Extract image
          const imgEl = li?.querySelector("img");
          if (imgEl) {
            image = imgEl.getAttribute("data-src") || imgEl.getAttribute("src") || "";
          }

          // Extract SKU from the slug
          const skuMatch = slug.match(/[-]([a-z]{0,4}\d{3,}[a-z]?(?:-\d+)?)$/i);
          if (skuMatch) sku = skuMatch[1].toUpperCase();

          items.push({
            slug,
            url: fullUrl,
            name: name || slug.replace(/-[a-z]{0,4}\d+[a-z]?$/i, "").replace(/-/g, " "),
            image,
            sku,
          });
        }
        return items;
      }, BASE, cat.category);

      if (products.length === 0) {
        // Debug: check how many links exist on the page at all
        const debugCount = await page.evaluate(() => document.querySelectorAll("a[href]").length);
        console.log(`[baker] WARNING: 0 products found on ${cat.category} (${debugCount} total links on page)`);
      }

      for (const p of products) {
        if (!allProducts.has(p.slug)) {
          allProducts.set(p.slug, { ...p, category: cat.category });
        }
      }

      console.log(`[baker] ${cat.category}: found ${products.length} products (${allProducts.size} total unique)`);
    } catch (err) {
      console.error(`[baker] Error on ${cat.category}: ${err.message}`);
      stats.errors.push(`listing ${cat.category}: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  await page.close();
  stats.products_listed = allProducts.size;
  console.log(`[baker] Total unique products from listings: ${allProducts.size}`);
  return allProducts;
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight || totalHeight > 20000) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

// ══════════════════════════════════════════════════════════════
// PHASE 2: Detail pages — extract full product data
// ══════════════════════════════════════════════════════════════

async function scrapeDetailPages(productsMap) {
  const entries = [...productsMap.entries()];
  const fullProducts = [];
  let done = 0;

  const page = await newPage(true); // Block images for speed — we extract Scene7 IDs from HTML

  for (const [slug, listing] of entries) {
    if (shouldStop) break;

    const detailUrl = listing.url;
    stats.progress = `detail ${done + 1}/${entries.length} — ${slug}`;

    try {
      await page.goto(detailUrl, { waitUntil: "networkidle2", timeout: 30000 });

      // Wait for product content to render
      await page.waitForSelector("[itemprop='name']", { timeout: 8000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));

      // Extract product data from the rendered page
      const productData = await page.evaluate(() => {
        const data = {};
        const bodyText = document.body.innerText || "";

        // Product name — itemprop='name' is most reliable
        const nameEl = document.querySelector("[itemprop='name']");
        data.name = nameEl?.textContent?.trim() || "";

        // SKU — itemprop='sku' or "No. BAA4406S" pattern
        const skuEl = document.querySelector("[itemprop='sku']");
        data.sku = skuEl?.textContent?.trim() || "";
        if (!data.sku) {
          const m = bodyText.match(/No\.\s*([A-Z0-9]{3,}[A-Z0-9-]*)/i);
          if (m) data.sku = m[1].toUpperCase();
        }

        // Brand — line right before product name (BAKER, MCGUIRE, MILLING ROAD)
        const brandMatch = bodyText.match(/\n(BAKER|MCGUIRE|MILLING ROAD|Baker|McGuire|Milling Road)\n/);
        data.brand = brandMatch ? brandMatch[1] : "Baker";

        // Collection — line after product name, before "No."
        // Pattern: "BAKER\nParlor Sofa\nBAKER LUXE\nNo. BAA4406S"
        const collMatch = bodyText.match(/No\.\s*[A-Z0-9]+[\s\S]*?$/m);
        // Better: look for collection name between product name and "No."
        const lines = bodyText.split("\n").map(l => l.trim()).filter(Boolean);
        data.collection = "";
        for (let i = 0; i < lines.length - 1; i++) {
          if (lines[i].startsWith("No.") && i >= 2) {
            // The line before "No." is likely the collection
            const candidate = lines[i - 1];
            // Only accept if it looks like a collection name (not too long, not navigation)
            if (candidate.length > 2 && candidate.length < 60 &&
                !["FABRIC", "FINISH", "LIVING", "DINING", "BEDROOM", "SEARCH", "BAKER-MCGUIRE"].includes(candidate) &&
                !/^\d/.test(candidate)) {
              data.collection = candidate;
            }
            break;
          }
        }

        // Dimensions — Baker uses "W 98in", "D 38in", "H 28in" format
        // Also "WI 88in" (interior), "SH 16.5in" (seat height), "SD 26in" (seat depth), "AH 28in" (arm height)
        data.dims = {};
        const dimRe = /\b(W|D|H|WI|DI|SH|SD|AH)\s+([\d.]+)\s*(?:in|")/g;
        let dm;
        const dimLabels = { W: "width", D: "depth", H: "height", WI: "widthInterior", DI: "depthInterior", SH: "seatHeight", SD: "seatDepth", AH: "armHeight" };
        while ((dm = dimRe.exec(bodyText)) !== null) {
          const key = dimLabels[dm[1]];
          if (key && !data.dims[key]) data.dims[key] = dm[2];
        }

        // COM/COL — "COM	11.5yd" or "COL	196sq ft"
        const comMatch2 = bodyText.match(/COM\s+([\d.]+)\s*(?:yd|yards?)/i);
        data.com = comMatch2 ? comMatch2[1] + " yards" : "";
        const colMatch2 = bodyText.match(/COL\s+([\d.]+)\s*(?:sq\s*ft|square)/i);
        data.col = colMatch2 ? colMatch2[1] + " sq ft" : "";

        // As Shown line — contains fabric and finish info
        const asShownMatch = bodyText.match(/As Shown:\s*(.+)/i);
        data.asShown = asShownMatch ? asShownMatch[1].trim() : "";

        // Product Features — bullet points under "Product Features"
        data.features = [];
        const featureMatch = bodyText.match(/Product Features\n([\s\S]*?)(?:\n\n|The\s+\w+\s+Collection|DOWNLOAD|FIND|SAVE)/);
        if (featureMatch) {
          const featureLines = featureMatch[1].split("\n").map(l => l.trim()).filter(l => l.length > 5);
          data.features = featureLines.slice(0, 10);
        }

        // Material from features or As Shown
        data.material = "";
        for (const f of data.features) {
          const fl = f.toLowerCase();
          if (fl.includes("beech") || fl.includes("oak") || fl.includes("mahogany") ||
              fl.includes("walnut") || fl.includes("maple") || fl.includes("cherry") ||
              fl.includes("wood") || fl.includes("metal") || fl.includes("iron") ||
              fl.includes("brass") || fl.includes("steel") || fl.includes("marble") ||
              fl.includes("stone") || fl.includes("glass") || fl.includes("rattan") ||
              fl.includes("cane") || fl.includes("leather") || fl.includes("frame")) {
            data.material = f;
            break;
          }
        }

        // Description from itemprop or build from features
        const descEl = document.querySelector("[itemprop='description']");
        data.description = descEl?.textContent?.trim() || "";

        return data;
      });

      // Get Scene7 product image IDs from HTML source
      // Two CDNs: s7d4/KIG (numeric IDs) and s7d2/bakerinteriorsgroup (SKU IDs)
      const html = await page.content();
      const scene7Images = [];
      const seenIds = new Set();

      // Pattern 1: KIG account (numeric IDs like 69-210)
      const kigRe = /s7d4\.scene7\.com\/is\/image\/KIG\/([A-Z0-9_-]+)/gi;
      let m;
      while ((m = kigRe.exec(html)) !== null) {
        const imageId = m[1];
        if (seenIds.has(imageId)) continue;
        seenIds.add(imageId);
        scene7Images.push(`https://s7d4.scene7.com/is/image/KIG/${imageId}?qlt=85,1&op_sharpen=1&wid=1200&hei=1200&fit=crop`);
      }

      // Pattern 2: bakerinteriorsgroup account (SKU IDs like BAA4657_FRONT)
      // Only include product images (contain FRONT, QUART, Alt, etc), not fabric swatches (25-xxx pattern)
      const bigRe = /s7d2\.scene7\.com\/is\/image\/bakerinteriorsgroup\/([A-Z0-9_-]+)/gi;
      while ((m = bigRe.exec(html)) !== null) {
        const imageId = m[1];
        // Skip fabric swatch thumbnails (pattern: 25-xxx, numbered swatches)
        if (/^\d{2}-\d{3}/.test(imageId)) continue;
        if (seenIds.has(imageId)) continue;
        seenIds.add(imageId);
        scene7Images.push(`https://s7d2.scene7.com/is/image/bakerinteriorsgroup/${imageId}?qlt=85,1&op_sharpen=1&wid=1200&hei=1200&fit=crop`);
      }

      // Fallback: bakerfurniture.com/media/ images
      if (scene7Images.length === 0) {
        const mediaRe = /bakerfurniture\.com\/media\/[a-z0-9]+\/[a-z0-9-]+\.(?:jpg|png|webp)/gi;
        while ((m = mediaRe.exec(html)) !== null) {
          const url = `https://www.${m[0]}`;
          if (!url.includes("logo") && !url.includes("icon") && !scene7Images.includes(url)) {
            scene7Images.push(url);
          }
        }
      }

      // Build dimensions string
      let dimensions = null;
      const d = productData.dims || {};
      if (d.width || d.depth || d.height) {
        const parts = [];
        if (d.width) parts.push(`W: ${d.width}"`);
        if (d.depth) parts.push(`D: ${d.depth}"`);
        if (d.height) parts.push(`H: ${d.height}"`);
        dimensions = parts.join(" x ");
        const extras = [];
        if (d.seatHeight) extras.push(`Seat H: ${d.seatHeight}"`);
        if (d.seatDepth) extras.push(`Seat D: ${d.seatDepth}"`);
        if (d.armHeight) extras.push(`Arm H: ${d.armHeight}"`);
        if (d.widthInterior) extras.push(`Interior W: ${d.widthInterior}"`);
        if (d.depthInterior) extras.push(`Interior D: ${d.depthInterior}"`);
        if (extras.length > 0) dimensions += " | " + extras.join(", ");
      }

      // Build description
      let description = productData.description || "";
      if (!description && productData.asShown) {
        description = `As Shown: ${productData.asShown}`;
      }
      if (productData.features.length > 0) {
        const featureText = productData.features.join(". ");
        description = description ? description + "\n" + featureText : featureText;
      }
      if (productData.com) description += `\nCOM: ${productData.com}`;
      if (productData.col) description += `\nCOL: ${productData.col}`;
      description = description.trim();
      if (description.length > 1000) description = description.slice(0, 997) + "...";

      const name = productData.name || listing.name || slug;
      const sku = productData.sku || listing.sku || "";
      const heroImage = scene7Images[0] || listing.image || null;

      const product = {
        id: `baker_${slugify(name)}-${slugify(sku)}`,
        product_name: name,
        vendor_id: "baker",
        vendor_name: "Baker Furniture",
        vendor_domain: "bakerfurniture.com",
        vendor_tier: 1,
        category: refineCategory(listing.category, name, detailUrl),
        sku: sku || null,
        collection: productData.collection || null,
        material: productData.material || null,
        dimensions,
        description: description || null,
        style: productData.asShown ? `As Shown: ${productData.asShown}` : null,
        retail_price: null, // Baker doesn't show prices publicly
        image_url: heroImage,
        images: scene7Images.slice(0, 20),
        product_url: detailUrl,
        ingestion_source: "baker-importer-v1",
        finish: null,
        com_yardage: productData.com || null,
        col_sqft: productData.col || null,
        brand: productData.brand || "Baker",
        image_contain: true,
      };

      fullProducts.push(product);
      done++;

      if (done % 50 === 0) {
        console.log(`[baker] Detail pages: ${done}/${entries.length} (${stats.detail_errors} errors)`);
      }
      if (done % 200 === 0) {
        let multiImg = 0, withDesc = 0, withDims = 0;
        for (const p of fullProducts) {
          if (p.images && p.images.length > 1) multiImg++;
          if (p.description) withDesc++;
          if (p.dimensions) withDims++;
        }
        console.log(`[baker] ══ ${done} PRODUCTS MILESTONE ══`);
        console.log(`[baker]   Multi-image: ${multiImg} (${Math.round(multiImg/done*100)}%)`);
        console.log(`[baker]   With description: ${withDesc} (${Math.round(withDesc/done*100)}%)`);
        console.log(`[baker]   With dimensions: ${withDims} (${Math.round(withDims/done*100)}%)`);
      }

      await new Promise(r => setTimeout(r, 300));

    } catch (err) {
      // Use listing data only
      fullProducts.push(buildProductFromListing(listing));
      done++;
      stats.detail_errors++;

      if (stats.detail_errors % 20 === 0) {
        console.warn(`[baker] ${stats.detail_errors} detail errors so far (latest: ${err.message})`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    stats.products_detailed = done;
  }

  await page.close();
  console.log(`[baker] Detail pages complete: ${done} products, ${stats.detail_errors} errors`);
  return fullProducts;
}

function buildProductFromListing(listing) {
  return {
    id: `baker_${slugify(listing.name)}-${slugify(listing.sku || "")}`,
    product_name: listing.name || listing.slug,
    vendor_id: "baker",
    vendor_name: "Baker Furniture",
    vendor_domain: "bakerfurniture.com",
    vendor_tier: 1,
    category: listing.category,
    sku: listing.sku || null,
    image_url: listing.image || null,
    images: listing.image ? [listing.image] : [],
    product_url: listing.url,
    ingestion_source: "baker-importer-v1",
    brand: "Baker",
    image_contain: true,
  };
}

function refineCategory(catDefault, name, url) {
  const n = (name || "").toLowerCase();
  const u = (url || "").toLowerCase();

  if (n.includes("sofa") || u.includes("/sofas/")) return "sofas";
  if (n.includes("loveseat")) return "loveseats";
  if (n.includes("sectional") || u.includes("/sectionals/")) return "sectionals";
  if (n.includes("chaise") || u.includes("/chaises/")) return "chaises";
  if (n.includes("ottoman") || u.includes("/ottomans/")) return "ottomans";
  if (n.includes("bench") || u.includes("/benches/")) return "benches";
  if ((n.includes("dining") && n.includes("chair")) || u.includes("/dining/seating/chairs/")) return "dining-chairs";
  if (n.includes("bar stool") || n.includes("counter stool") || u.includes("barcounterstools")) return "bar-stools";
  if (n.includes("accent chair") || n.includes("lounge chair") || n.includes("club chair") || u.includes("/living/seating/chairs/")) return "accent-chairs";
  if (n.includes("chair")) return "accent-chairs";
  if (n.includes("dining table") || u.includes("/dining/tables/")) return "dining-tables";
  if (n.includes("cocktail table") || n.includes("coffee table")) return "cocktail-tables";
  if (n.includes("side table") || n.includes("spot table") || n.includes("end table")) return "side-tables";
  if (n.includes("console") || n.includes("console table")) return "console-tables";
  if (n.includes("center table")) return "center-tables";
  if (n.includes("nesting") || n.includes("nest")) return "nesting-tables";
  if (n.includes("table") || u.includes("/tables/")) return "tables";
  if (n.includes("bed") || u.includes("/beds/")) return "beds";
  if (n.includes("nightstand") || u.includes("/nightstands/")) return "nightstands";
  if (n.includes("dresser") || n.includes("chest") || u.includes("/chests/")) return "dressers";
  if (n.includes("cabinet") || n.includes("china") || u.includes("/cabinets/")) return "cabinets";
  if (n.includes("server") || n.includes("sideboard") || n.includes("buffet") || n.includes("credenza") || u.includes("/servers/")) return "sideboards";
  if (n.includes("etagere") || n.includes("bookcase") || u.includes("/etageres/")) return "bookcases";
  if (n.includes("desk") || u.includes("/desks/")) return "desks";
  if (n.includes("lamp") || n.includes("chandelier") || n.includes("sconce") || n.includes("pendant") || u.includes("/lighting/")) return "lighting";
  if (n.includes("mirror")) return "mirrors";
  if (u.includes("/accessories/")) return "decorative-objects";
  if (u.includes("/outdoor/")) return "outdoor-furniture";
  return catDefault;
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

export async function importBaker(catalogDB, options = {}) {
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
    console.log(`\n[baker] ═══ PHASE 1: Listing Pages ═══`);
    const productsMap = await scrapeListingPages();

    if (shouldStop) {
      await closeBrowser();
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    // Phase 2
    stats.phase = "detail_pages";
    console.log(`\n[baker] ═══ PHASE 2: Detail Pages (${productsMap.size} products) ═══`);
    const fullProducts = await scrapeDetailPages(productsMap);
    await closeBrowser();

    if (shouldStop) {
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    // Phase 3: Insert
    stats.phase = "inserting";
    console.log(`\n[baker] ═══ PHASE 3: Inserting ${fullProducts.length} products ═══`);

    if (fullProducts.length > 0 && catalogDB) {
      // Delete existing Baker products
      let existingCount = 0;
      const toDelete = [];
      for (const p of catalogDB.getAllProducts()) {
        if (p.vendor_id === "baker") {
          toDelete.push(p.id);
          existingCount++;
        }
      }
      for (const id of toDelete) catalogDB.deleteProduct(id);
      console.log(`[baker] Deleted ${existingCount} existing products`);

      const result = catalogDB.insertProducts(fullProducts);
      stats.products_inserted = (result.inserted || 0) + (result.updated || 0);
      console.log(`[baker] Inserted: ${stats.products_inserted}`);
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

    console.log(`\n[baker] ═══ COMPLETE ═══`);
    console.log(`[baker] Products listed:      ${stats.products_listed}`);
    console.log(`[baker] Products detailed:    ${stats.products_detailed}`);
    console.log(`[baker] Products inserted:    ${stats.products_inserted}`);
    console.log(`[baker] Detail page errors:   ${stats.detail_errors}`);
    console.log(`[baker] Multi-image:          ${multiImage} (${Math.round(multiImage/fullProducts.length*100)}%)`);
    console.log(`[baker] With description:     ${withDesc} (${Math.round(withDesc/fullProducts.length*100)}%)`);
    console.log(`[baker] With dimensions:      ${withDims} (${Math.round(withDims/fullProducts.length*100)}%)`);
    console.log(`[baker] With materials:       ${withMaterial} (${Math.round(withMaterial/fullProducts.length*100)}%)`);
    console.log(`[baker] No image:             ${noImage}`);

    // Sample products
    console.log(`\n[baker] ═══ SAMPLE PRODUCTS ═══`);
    const sampleIndices = [0, Math.floor(fullProducts.length * 0.25), Math.floor(fullProducts.length * 0.5), Math.floor(fullProducts.length * 0.75), fullProducts.length - 1];
    for (const idx of sampleIndices) {
      const p = fullProducts[idx];
      if (!p) continue;
      console.log(`\n[baker] --- ${p.product_name} (${p.sku}) ---`);
      console.log(`[baker]   Images: ${p.images?.length || 0} | Hero: ${p.image_url?.slice(0, 80) || "NONE"}`);
      console.log(`[baker]   Description: ${p.description?.slice(0, 100) || "NONE"}...`);
      console.log(`[baker]   Dimensions: ${p.dimensions || "NONE"}`);
      console.log(`[baker]   Material: ${p.material || "NONE"}`);
      console.log(`[baker]   Collection: ${p.collection || "NONE"}`);
    }

    return stats;
  } catch (err) {
    console.error("[baker] Fatal error:", err);
    stats.phase = "error";
    stats.finished_at = new Date().toISOString();
    stats.errors.push(err.message);
    await closeBrowser();
    return stats;
  } finally {
    running = false;
  }
}
