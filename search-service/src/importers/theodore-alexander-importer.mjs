/**
 * Theodore Alexander Full Importer (v2 — Puppeteer)
 *
 * Phase 1: Listing pages — extract `listItems` JS array via page.evaluate()
 *          Gets SKU, urlCode, productName, mainImage, collection, category
 *          124 total pages across 6 categories
 *
 * Phase 2: Detail pages — for EVERY product, visit the detail page and extract
 *          `itemDto` via page.evaluate(). This gives:
 *          - ALL images (hero + alternates, typically 3-5 per product)
 *          - Full marketing description
 *          - Dimensions in INCHES
 *          - Materials list
 *          - Fabric name, fabric content, cleaning code
 *          - Retail price
 *          - Collection, finish, bed size options
 *          - isNew / isBestSeller badges
 *          - Additional features / furniture care notes
 *
 * Uses Puppeteer because the JS variables are block-scoped (let) and need
 * browser context to evaluate.
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

export function getTheodoreAlexanderStatus() {
  return { running, ...stats };
}

export function stopTheodoreAlexander() {
  if (running) { shouldStop = true; return { message: "Stop requested" }; }
  return { message: "Not running" };
}

const BASE = "https://theodorealexander.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CATEGORIES = [
  { url: "/item/category/room/value/living-room", pages: 44, category: "seating" },
  { url: "/item/category/room/value/dining-room", pages: 21, category: "dining" },
  { url: "/item/category/room/value/bedroom", pages: 18, category: "bedroom" },
  { url: "/item/category/room/value/office", pages: 5, category: "home-office" },
  { url: "/item/category/room/value/lighting", pages: 5, category: "lighting" },
  { url: "/item/category/room/value/decor", pages: 45, category: "decor" },
  { url: "/item/category/collection/value/art-by-ta", pages: 31, category: "art" },
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

async function newPage() {
  const b = await launchBrowser();
  const page = await b.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1440, height: 900 });
  // Block images/fonts/css to speed up detail page loads
  await page.setRequestInterception(true);
  page.on('request', req => {
    const type = req.resourceType();
    if (['image', 'font', 'stylesheet', 'media'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });
  return page;
}

// ══════════════════════════════════════════════════════════════
// PHASE 1: Listing pages
// ══════════════════════════════════════════════════════════════

async function scrapeListingPages() {
  const allProducts = new Map();
  const page = await newPage();

  for (const cat of CATEGORIES) {
    if (shouldStop) break;
    console.log(`[ta] Scraping ${cat.category}: ${cat.pages} pages`);

    for (let pageNum = 1; pageNum <= cat.pages; pageNum++) {
      if (shouldStop) break;
      const url = `${BASE}${cat.url}?page=${pageNum}`;
      stats.progress = `listing ${cat.category} p${pageNum}/${cat.pages}`;

      try {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });

        // Extract listItems from page source (block-scoped let, must parse from HTML)
        const html = await page.content();
        const match = html.match(/let\s+listItems\s*=\s*(\[[\s\S]*?\]);\s*(?:let|var|const)/);
        if (!match) {
          console.warn(`[ta] No listItems on ${cat.category} p${pageNum}`);
          continue;
        }

        // Parse in browser context (handles any JS-specific syntax)
        const items = await page.evaluate((raw) => {
          try { return eval(raw); } catch { return []; }
        }, match[1]);

        for (const item of items) {
          const key = item.urlCode || item.sku;
          if (!key || allProducts.has(key)) continue;

          allProducts.set(key, {
            sku: item.sku || item.defaultCode || null,
            urlCode: item.urlCode,
            productName: item.productName || "",
            mainImage: item.imageSirv || item.imageUrl || null,
            collection: item.collectionName || null,
            category: mapCategory(item.typeName, cat.category),
            typeName: item.typeName || null,
            isNew: item.isNew || false,
            isBestSelling: item.isBestSelling || false,
            isMultipleOptions: item.isMultipleOptions || false,
          });
        }

        if (pageNum % 5 === 0 || pageNum === cat.pages) {
          console.log(`[ta] ${cat.category} p${pageNum}: ${allProducts.size} total unique`);
        }
      } catch (err) {
        console.error(`[ta] ${cat.category} p${pageNum} error: ${err.message}`);
        stats.errors.push(`listing ${cat.category} p${pageNum}: ${err.message}`);
      }

      await new Promise(r => setTimeout(r, 400));
    }
  }

  await page.close();
  stats.products_listed = allProducts.size;
  console.log(`[ta] Total unique products from listings: ${allProducts.size}`);
  return allProducts;
}

function mapCategory(typeName, fallback) {
  if (!typeName) return fallback;
  const t = typeName.toLowerCase();
  if (t.includes("sofa")) return "sofa";
  if (t.includes("chair") && t.includes("dining")) return "dining-chair";
  if (t.includes("chair") && t.includes("accent")) return "accent-chair";
  if (t.includes("chair") && t.includes("desk")) return "desk-chair";
  if (t.includes("chair")) return "chair";
  if (t.includes("table") && t.includes("dining")) return "dining-table";
  if (t.includes("table") && t.includes("cocktail")) return "cocktail-table";
  if (t.includes("table") && t.includes("side")) return "side-table";
  if (t.includes("table") && t.includes("console")) return "console";
  if (t.includes("table") && (t.includes("pub") || t.includes("bar"))) return "bar-table";
  if (t.includes("table")) return "table";
  if (t.includes("bed")) return "bed";
  if (t.includes("dresser")) return "dresser";
  if (t.includes("nightstand")) return "nightstand";
  if (t.includes("chest")) return "chest";
  if (t.includes("cabinet") || t.includes("china") || t.includes("curio")) return "cabinet";
  if (t.includes("bookcase") || t.includes("etagere")) return "bookcase";
  if (t.includes("desk") || t.includes("bureau")) return "desk";
  if (t.includes("mirror")) return "mirror";
  if (t.includes("lamp") || t.includes("lighting") || t.includes("chandelier") || t.includes("sconce") || t.includes("pendant")) return "lighting";
  if (t.includes("ottoman") || t.includes("stool") && !t.includes("bar")) return "ottoman";
  if (t.includes("bench")) return "bench";
  if (t.includes("bar") && t.includes("stool")) return "bar-stool";
  if (t.includes("counter") && t.includes("stool")) return "bar-stool";
  if (t.includes("settee")) return "settee";
  if (t.includes("sectional")) return "sectional";
  if (t.includes("loveseat")) return "loveseat";
  if (t.includes("credenza") || t.includes("buffet") || t.includes("sideboard") || t.includes("server")) return "sideboard";
  if (t.includes("media")) return "media-cabinet";
  if (t.includes("vanity")) return "vanity";
  if (t.includes("storage")) return "cabinet";
  if (t.includes("art") || t.includes("painting") || t.includes("print") || t.includes("photograph")) return "art";
  if (t.includes("rug") || t.includes("floored")) return "rug";
  if (t.includes("accessory") || t.includes("accessories")) return "decorative-objects";
  return fallback;
}

// ══════════════════════════════════════════════════════════════
// PHASE 2: Detail pages — extract EVERYTHING
// ══════════════════════════════════════════════════════════════

async function scrapeDetailPages(productsMap) {
  const entries = [...productsMap.entries()];
  const fullProducts = [];
  let done = 0;

  // Use a single page and navigate sequentially (avoids memory issues)
  const page = await newPage();

  for (const [urlCode, listing] of entries) {
    if (shouldStop) break;

    const detailUrl = `${BASE}/item/product-detail/${urlCode}`;
    stats.progress = `detail ${done}/${entries.length}`;

    try {
      await page.goto(detailUrl, { waitUntil: "networkidle2", timeout: 30000 });

      // Extract itemDto from page source
      const html = await page.content();
      const dtoMatch = html.match(/(?:var|let|const)\s+itemDto\s*=\s*(\{[\s\S]*?\});\s*(?:var|let|const|function|\/\/|<\/script)/);

      let product;
      if (dtoMatch) {
        // Parse in browser context
        const dto = await page.evaluate((raw) => {
          try { return eval('(' + raw + ')'); } catch(e) { return null; }
        }, dtoMatch[1]);

        if (dto) {
          product = buildProductFromDto(dto, listing, detailUrl);
        }
      }

      // Also extract rendered text for fabric/spec details not in itemDto
      if (product || !dtoMatch) {
        const rendered = await page.evaluate(() => {
          const text = document.body.innerText || "";
          const data = {};

          // Extract fabric info from rendered text
          const fabricMatch = text.match(/Shown in (.+?)(?:\n|Fabric content)/);
          if (fabricMatch) data.fabricShown = fabricMatch[1].trim();

          const fabricContentMatch = text.match(/Fabric content:\s*(.+)/);
          if (fabricContentMatch) data.fabricContent = fabricContentMatch[1].trim();

          const cleaningMatch = text.match(/Cleaning code:\s*(\w+)/);
          if (cleaningMatch) data.cleaningCode = cleaningMatch[1].trim();

          const trimMatch = text.match(/Trim:\s*(.+)/);
          if (trimMatch) data.trimInfo = trimMatch[1].trim();

          // Bed size / mattress info
          const bedMatch = text.match(/(?:For|Fits)\s+(US\s+\w+|Queen|King|Cal(?:ifornia)?\s+King)\s+mattress/i);
          if (bedMatch) data.bedSize = bedMatch[1].trim();

          // Construction notes (bullet points)
          const constructionNotes = [];
          const lines = text.split('\n');
          for (const line of lines) {
            const t = line.trim();
            if (t.startsWith('*') && t.length > 10 && t.length < 300) {
              constructionNotes.push(t.replace(/^\*\s*/, ''));
            }
          }
          if (constructionNotes.length > 0) data.constructionNotes = constructionNotes;

          // Adjustable frame / box spring info
          if (text.includes('adjustable mattress frame')) data.acceptsAdjustable = true;
          const boxSpringMatch = text.match(/(\d+)"\s*box spring/i);
          if (boxSpringMatch) data.boxSpringHeight = boxSpringMatch[1] + '"';

          // Bed size options from the rendered dropdown
          const sizeMatch = text.match(/Bed Size Options?:\s*\n?([\s\S]*?)(?:\n\n|\*|As Shown)/);
          if (sizeMatch) {
            data.sizeOptions = sizeMatch[1].trim().split(/\n/).map(s => s.trim()).filter(Boolean);
          }

          // As Shown Price from rendered text
          const priceMatch = text.match(/Retail Price:\s*USD\s*\$([\d,]+)/);
          if (priceMatch) data.retailPriceRendered = parseInt(priceMatch[1].replace(/,/g, ''));

          return data;
        });

        if (product && rendered) {
          // Merge rendered data into product
          if (rendered.fabricShown && !product.fabric_name) product.fabric_name = rendered.fabricShown;
          if (rendered.fabricContent && !product.fabric_content) product.fabric_content = rendered.fabricContent;
          if (rendered.cleaningCode && !product.cleaning_code) product.cleaning_code = rendered.cleaningCode;
          if (rendered.trimInfo) product.trim = rendered.trimInfo;
          if (rendered.bedSize) product.bed_size = rendered.bedSize;
          if (rendered.acceptsAdjustable) product.accepts_adjustable = true;
          if (rendered.boxSpringHeight) product.box_spring = rendered.boxSpringHeight;
          if (rendered.sizeOptions) product.size_options = rendered.sizeOptions;
          if (rendered.constructionNotes) product.construction_notes = rendered.constructionNotes;
          if (rendered.retailPriceRendered && !product.retail_price) {
            product.retail_price = rendered.retailPriceRendered;
          }
        }
      }

      if (!product) {
        // Fallback: build from listing data only
        product = buildProductFromListing(listing, detailUrl);
        stats.detail_errors++;
      }

      fullProducts.push(product);
      done++;

      if (done % 100 === 0) {
        console.log(`[ta] Detail pages: ${done}/${entries.length} (${stats.detail_errors} errors)`);
      }
      if (done % 500 === 0) {
        // Report progress milestone
        let multiImg = 0, withDesc = 0, withPrice = 0;
        for (const p of fullProducts) {
          if (p.images && p.images.length > 1) multiImg++;
          if (p.description) withDesc++;
          if (p.retail_price) withPrice++;
        }
        console.log(`[ta] ══ ${done} PRODUCTS MILESTONE ══`);
        console.log(`[ta]   Multi-image: ${multiImg} (${Math.round(multiImg/done*100)}%)`);
        console.log(`[ta]   With description: ${withDesc} (${Math.round(withDesc/done*100)}%)`);
        console.log(`[ta]   With price: ${withPrice} (${Math.round(withPrice/done*100)}%)`);
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200));

    } catch (err) {
      // Timeout or navigation error — use listing data
      fullProducts.push(buildProductFromListing(listing, detailUrl));
      done++;
      stats.detail_errors++;

      if (stats.detail_errors % 20 === 0) {
        console.warn(`[ta] ${stats.detail_errors} detail errors so far (latest: ${err.message})`);
      }

      await new Promise(r => setTimeout(r, 500));
    }

    stats.products_detailed = done;
  }

  await page.close();
  console.log(`[ta] Detail pages complete: ${done} products, ${stats.detail_errors} errors`);
  return fullProducts;
}

function buildProductFromDto(dto, listing, detailUrl) {
  const name = dto.productName || listing.productName;
  const sku = dto.sku || dto.defaultCode || listing.sku;

  // ALL IMAGES — main + alternates
  const images = [];
  if (dto.itemImagetDtos && Array.isArray(dto.itemImagetDtos)) {
    const sorted = [...dto.itemImagetDtos].sort((a, b) => {
      if (a.isMain && !b.isMain) return -1;
      if (!a.isMain && b.isMain) return 1;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
    for (const img of sorted) {
      if (img.url) images.push(img.url);
    }
  }
  if (images.length === 0 && listing.mainImage) {
    images.push(listing.mainImage);
  }

  // DESCRIPTION — full marketing text
  const description = dto.extendedDescription || dto.story || dto.description || null;

  // DIMENSIONS IN INCHES — parse fractions like "87¼" "79⅜"
  const widthIn = parseDimInch(dto.widthInch);
  const depthIn = parseDimInch(dto.depthInch);
  const heightIn = parseDimInch(dto.heightInch);
  let dimensions = null;
  if (widthIn || depthIn || heightIn) {
    const parts = [];
    if (widthIn) parts.push(`W: ${widthIn}"`);
    if (depthIn) parts.push(`D: ${depthIn}"`);
    if (heightIn) parts.push(`H: ${heightIn}"`);
    dimensions = parts.join(" x ");
  }

  // Additional dimension fields for seating
  const seatHeight = parseDimInch(dto.chairSeatHeightInch);
  const seatDepth = parseDimInch(dto.chairInsideSeatDepthInch);
  const seatWidth = parseDimInch(dto.chairInsideSeatWidthInch);
  const armHeight = parseDimInch(dto.chairArmHeightInch);
  if (seatHeight || seatDepth || seatWidth || armHeight) {
    const extras = [];
    if (seatHeight) extras.push(`Seat H: ${seatHeight}"`);
    if (seatDepth) extras.push(`Seat D: ${seatDepth}"`);
    if (seatWidth) extras.push(`Seat W: ${seatWidth}"`);
    if (armHeight) extras.push(`Arm H: ${armHeight}"`);
    dimensions = (dimensions || "") + " | " + extras.join(", ");
  }

  // MATERIALS
  let material = null;
  if (dto.materials && Array.isArray(dto.materials) && dto.materials.length > 0) {
    material = dto.materials.map(m => m.name || m).filter(Boolean).join(", ");
  } else if (dto.materialList) {
    material = dto.materialList;
  }

  // COLLECTION
  const collection = dto.collection?.name || dto.collectionName || listing.collection;

  // PRICE — dealerPrice.price is in whole dollars
  let retailPrice = null;
  if (dto.retailPriceList?.dealerPrice?.price > 0) {
    retailPrice = dto.retailPriceList.dealerPrice.price;
  }
  let wholesalePrice = null;
  if (dto.wholesalePriceList?.dealerPrice?.price > 0) {
    wholesalePrice = dto.wholesalePriceList.dealerPrice.price;
  }

  // FINISH
  const finish = dto.finishName || null;

  // FABRIC (from itemDto — may also be supplemented from rendered text)
  const fabricName = dto.uphFabricDto?.name || null;

  // BADGES
  const isNew = dto.isNew || listing.isNew || false;
  const isBestSeller = dto.isBestSeller || listing.isBestSelling || false;

  // BED SIZE OPTIONS
  let bedSizeOptions = null;
  if (dto.listBedSizeOption && Array.isArray(dto.listBedSizeOption) && dto.listBedSizeOption.length > 0) {
    bedSizeOptions = dto.listBedSizeOption.map(o => o.name || o.title || o).filter(Boolean);
  }

  // ADDITIONAL FEATURES
  let additionalFeatures = null;
  if (dto.listAdditionalFeatures && Array.isArray(dto.listAdditionalFeatures) && dto.listAdditionalFeatures.length > 0) {
    additionalFeatures = dto.listAdditionalFeatures.map(f => f.name || f.description || f).filter(Boolean);
  }

  // FURNITURE CARE
  let furnitureCare = null;
  if (dto.furnitureCares && Array.isArray(dto.furnitureCares) && dto.furnitureCares.length > 0) {
    furnitureCare = dto.furnitureCares.map(c => c.description || c.name || c).filter(Boolean);
  }

  // WEIGHT
  const weight = dto.netWeightLbs ? `${dto.netWeightLbs} lbs` : null;

  // SHIPPING
  const shipping = dto.shipping || null;

  // CATEGORY from type
  const category = mapCategory(dto.type?.name || listing.typeName, listing.category);

  // Build style string from finish + fabric
  let style = null;
  const styleParts = [];
  if (finish) styleParts.push(`Finish: ${finish}`);
  if (fabricName) styleParts.push(`Fabric: ${fabricName}`);
  if (styleParts.length > 0) style = styleParts.join(" | ");

  // Build rich description with specs appended
  let richDescription = description || "";
  const specLines = [];
  if (fabricName) specLines.push(`Fabric: ${fabricName}`);
  if (finish) specLines.push(`Finish: ${finish}`);
  if (weight) specLines.push(`Weight: ${weight}`);
  if (shipping) specLines.push(`Shipping: ${shipping}`);
  if (additionalFeatures) specLines.push(...additionalFeatures);

  if (specLines.length > 0 && richDescription) {
    richDescription = richDescription + "\n\n" + specLines.join("\n");
  }
  if (richDescription.length > 1000) richDescription = richDescription.slice(0, 997) + "...";

  const heroImage = images[0] || listing.mainImage || null;

  return {
    id: `theodore-alexander_${slugify(name)}-${slugify(sku || "")}`,
    product_name: name,
    vendor_id: "theodore-alexander",
    vendor_name: "Theodore Alexander",
    vendor_domain: "theodorealexander.com",
    vendor_tier: 1,
    category,
    sku,
    collection,
    material,
    dimensions,
    description: richDescription || null,
    style,
    retail_price: retailPrice,
    wholesale_price: wholesalePrice,
    image_url: heroImage,
    images: images.filter(Boolean).slice(0, 20),
    product_url: detailUrl,
    ingestion_source: "theodore-alexander-v2",
    // Extended fields
    is_new: isNew,
    is_best_seller: isBestSeller,
    finish: finish,
    fabric_name: fabricName,
    fabric_content: null, // filled from rendered text
    cleaning_code: null,  // filled from rendered text
    bed_size: null,       // filled from rendered text
    size_options: bedSizeOptions,
    additional_features: additionalFeatures,
    furniture_care: furnitureCare,
    weight,
    image_contain: true,
  };
}

function buildProductFromListing(listing, detailUrl) {
  return {
    id: `theodore-alexander_${slugify(listing.productName)}-${slugify(listing.sku || "")}`,
    product_name: listing.productName,
    vendor_id: "theodore-alexander",
    vendor_name: "Theodore Alexander",
    vendor_domain: "theodorealexander.com",
    vendor_tier: 1,
    category: listing.category,
    sku: listing.sku,
    collection: listing.collection,
    image_url: listing.mainImage,
    images: listing.mainImage ? [listing.mainImage] : [],
    product_url: detailUrl,
    ingestion_source: "theodore-alexander-v2",
    is_new: listing.isNew || false,
    is_best_seller: listing.isBestSelling || false,
    image_contain: true,
  };
}

function parseDimInch(val) {
  if (!val) return null;
  if (typeof val === "number") return String(val);
  // Handle HTML fraction entities: &frac14; = ¼, &frac12; = ½, &frac34; = ¾
  let s = String(val)
    .replace(/&frac14;/g, "¼").replace(/&frac12;/g, "½").replace(/&frac34;/g, "¾")
    .replace(/&frac38;/g, "⅜").replace(/&frac58;/g, "⅝").replace(/&frac78;/g, "⅞")
    .replace(/&frac13;/g, "⅓").replace(/&frac23;/g, "⅔")
    .trim();
  return s || null;
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

export async function importTheodoreAlexander(catalogDB, options = {}) {
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
    // Phase 1: Get all product URLs from listing pages
    console.log(`\n[ta] ═══ PHASE 1: Listing Pages ═══`);
    const productsMap = await scrapeListingPages();

    if (shouldStop) {
      await closeBrowser();
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    // Phase 2: Hit every detail page for full data
    stats.phase = "detail_pages";
    console.log(`\n[ta] ═══ PHASE 2: Detail Pages (${productsMap.size} products) ═══`);
    const fullProducts = await scrapeDetailPages(productsMap);
    await closeBrowser();

    if (shouldStop) {
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    // Phase 3: Insert into catalog (full replace)
    stats.phase = "inserting";
    console.log(`\n[ta] ═══ PHASE 3: Inserting ${fullProducts.length} products ═══`);

    if (fullProducts.length > 0 && catalogDB) {
      // Delete existing Theodore Alexander products first
      let existingCount = 0;
      const toDelete = [];
      for (const p of catalogDB.getAllProducts()) {
        if (p.vendor_id === "theodore-alexander") {
          toDelete.push(p.id);
          existingCount++;
        }
      }
      for (const id of toDelete) catalogDB.deleteProduct(id);
      console.log(`[ta] Deleted ${existingCount} existing products`);

      const result = catalogDB.insertProducts(fullProducts);
      stats.products_inserted = (result.inserted || 0) + (result.updated || 0);
      console.log(`[ta] Inserted: ${stats.products_inserted}`);
    }

    // Final stats
    let multiImage = 0, withDesc = 0, withPrice = 0, withDims = 0, withMaterial = 0, noImage = 0;
    for (const p of fullProducts) {
      if (p.images && p.images.length > 1) multiImage++;
      if (p.description && p.description.length > 20) withDesc++;
      if (p.retail_price) withPrice++;
      if (p.dimensions) withDims++;
      if (p.material) withMaterial++;
      if (!p.image_url) noImage++;
    }

    stats.phase = "complete";
    stats.finished_at = new Date().toISOString();

    console.log(`\n[ta] ═══ COMPLETE ═══`);
    console.log(`[ta] Products listed:      ${stats.products_listed}`);
    console.log(`[ta] Products detailed:    ${stats.products_detailed}`);
    console.log(`[ta] Products inserted:    ${stats.products_inserted}`);
    console.log(`[ta] Detail page errors:   ${stats.detail_errors}`);
    console.log(`[ta] Multi-image:          ${multiImage} (${Math.round(multiImage/fullProducts.length*100)}%)`);
    console.log(`[ta] With description:     ${withDesc} (${Math.round(withDesc/fullProducts.length*100)}%)`);
    console.log(`[ta] With price:           ${withPrice} (${Math.round(withPrice/fullProducts.length*100)}%)`);
    console.log(`[ta] With dimensions:      ${withDims} (${Math.round(withDims/fullProducts.length*100)}%)`);
    console.log(`[ta] With materials:       ${withMaterial} (${Math.round(withMaterial/fullProducts.length*100)}%)`);
    console.log(`[ta] No image:             ${noImage}`);

    // Print 5 sample products
    console.log(`\n[ta] ═══ SAMPLE PRODUCTS ═══`);
    const sampleIndices = [0, Math.floor(fullProducts.length * 0.25), Math.floor(fullProducts.length * 0.5), Math.floor(fullProducts.length * 0.75), fullProducts.length - 1];
    for (const idx of sampleIndices) {
      const p = fullProducts[idx];
      if (!p) continue;
      console.log(`\n[ta] --- ${p.product_name} (${p.sku}) ---`);
      console.log(`[ta]   Images: ${p.images?.length || 0}`);
      console.log(`[ta]   Description: ${p.description?.slice(0, 100) || 'NONE'}...`);
      console.log(`[ta]   Dimensions: ${p.dimensions || 'NONE'}`);
      console.log(`[ta]   Material: ${p.material || 'NONE'}`);
      console.log(`[ta]   Price: ${p.retail_price ? '$' + p.retail_price.toLocaleString() : 'NONE'}`);
      console.log(`[ta]   Collection: ${p.collection || 'NONE'}`);
      console.log(`[ta]   Finish: ${p.finish || 'NONE'}`);
      console.log(`[ta]   Fabric: ${p.fabric_name || 'NONE'} | Content: ${p.fabric_content || 'NONE'}`);
      console.log(`[ta]   New: ${p.is_new} | Best Seller: ${p.is_best_seller}`);
      console.log(`[ta]   Bed Size: ${p.bed_size || 'N/A'} | Size Options: ${p.size_options?.join(', ') || 'N/A'}`);
    }

    return stats;
  } catch (err) {
    console.error("[ta] Fatal error:", err);
    stats.phase = "error";
    stats.finished_at = new Date().toISOString();
    stats.errors.push(err.message);
    await closeBrowser();
    return stats;
  } finally {
    running = false;
  }
}
