/**
 * Rowe Furniture Full Importer
 *
 * Phase 1: Listing pages — scrape category pages via server-rendered HTML
 *          Gets product name, SKU, hero image, angle image, detail page URL
 *          Categories: Living Room (1423), Dining Room (1424), Bedroom (1425), Office (1426)
 *
 * Phase 2: Detail pages — for EVERY product, visit the detail page and extract:
 *          - ALL images (hero + angle + side + back + room + detail + alternates)
 *          - Full dimensions (L x D x H, seat height, seat depth, arm height, etc.)
 *          - Materials, cushion type, collection, allowed patterns
 *          - Weight, manufacturer/assortment (Rowe vs Robin Bruce)
 *          - Category breadcrumb path
 *          - Related products
 *          - COM availability, quick ship status
 *
 * Uses native HTTPS — Rowe's site is server-rendered HTML, no JS rendering needed.
 * Image URLs use Azure Blob Storage: rffblob.blob.core.windows.net/rffblobcontainer/
 */

import https from "node:https";

const BASE = "https://rowefurniture.com";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const IMAGE_BASE = "https://rffblob.blob.core.windows.net/rffblobcontainer/";

const CATEGORIES = [
  { path: "/living-room", categoryId: 1423, pages: 48, room: "living-room" },
  { path: "/dining-room", categoryId: 1424, pages: 7, room: "dining-room" },
  { path: "/bedroom", categoryId: 1425, pages: 6, room: "bedroom" },
  { path: "/office", categoryId: 1426, pages: 3, room: "office" },
];

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

export function getRoweStatus() {
  return { running, ...stats };
}

export function stopRowe() {
  if (running) { shouldStop = true; return { message: "Stop requested" }; }
  return { message: "Not running" };
}

// ── HTTP helper ──────────────────────────────────────────────

function fetchPage(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout,
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redir = res.headers.location.startsWith("http")
          ? res.headers.location
          : `${BASE}${res.headers.location}`;
        res.resume();
        return fetchPage(redir, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve(body));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function slugify(text) {
  return (text || "product").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ══════════════════════════════════════════════════════════════
// PHASE 1: Listing pages — extract product cards from HTML
// ══════════════════════════════════════════════════════════════

async function scrapeListingPages() {
  const allProducts = new Map(); // key = detail URL path, value = listing data

  for (const cat of CATEGORIES) {
    if (shouldStop) break;
    console.log(`[rowe] Scraping ${cat.room}: ~${cat.pages} pages`);

    for (let pageNum = 1; pageNum <= cat.pages + 5; pageNum++) {
      if (shouldStop) break;
      stats.progress = `listing ${cat.room} p${pageNum}`;

      const url = `${BASE}${cat.path}?pagenumber=${pageNum}&pageSize=9&orderBy=5&viewMode=grid`;

      try {
        const html = await fetchPage(url);

        // Extract product cards from NopCommerce HTML structure:
        // <div class="product-item" data-productid="...">
        //   <div class="picture">
        //     <a href="/detail-url"><img class="picture-img" src="hero.jpg"/><img class="hover-box-img" src="angle.jpg"/></a>
        //   </div>
        //   <div class="details">
        //     <h2 class="product-title"><a href="/detail-url">Product Name</a></h2>
        //     <div class="sku">SKU-HERE</div>
        //   </div>
        // </div>

        const productCardRegex = /<div\s+class="product-item"\s+data-productid="(\d+)">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
        let match;
        let pageProducts = 0;

        while ((match = productCardRegex.exec(html)) !== null) {
          const productId = match[1];
          const cardHtml = match[2];

          // Extract detail URL from picture link
          const hrefMatch = cardHtml.match(/<a\s+href="(\/[a-z0-9][a-z0-9-]*(?:-\d+)?)"/i);
          if (!hrefMatch) continue;
          const detailPath = hrefMatch[1];

          // Skip if already seen (dedup by URL)
          if (allProducts.has(detailPath)) continue;

          // Extract hero image (picture-img class)
          const heroMatch = cardHtml.match(/<img\s+class="picture-img"[^>]+src="([^"]+)"/i);
          const heroImage = heroMatch ? decodeURIComponent(heroMatch[1]) : null;

          // Extract hover/angle image
          const angleMatch = cardHtml.match(/<img\s+class="hover-box-img"[^>]+src="([^"]+)"/i);
          const angleImage = angleMatch ? decodeURIComponent(angleMatch[1]) : null;

          // Extract product name
          const nameMatch = cardHtml.match(/class="product-title">\s*<a[^>]*>([^<]+)<\/a>/i);
          const productName = nameMatch ? nameMatch[1].trim() : null;

          // Extract SKU
          const skuMatch = cardHtml.match(/<div\s+class="sku">\s*([A-Z0-9][-A-Z0-9/]+(?:-RC)?)\s*<\/div>/i);
          const sku = skuMatch ? skuMatch[1].trim() : null;

          // Extract description if present
          const descMatch = cardHtml.match(/data-short-description=["']?([^"'<]+)/i);
          const shortDesc = descMatch && descMatch[1] !== "none" ? descMatch[1].trim() : null;

          const listingImages = [heroImage, angleImage].filter(Boolean);

          allProducts.set(detailPath, {
            detailUrl: detailPath,
            productId,
            heroImage,
            angleImage,
            listingImages,
            productName,
            sku,
            shortDesc,
            room: cat.room,
          });
          pageProducts++;
        }

        // If no products found on this page, we've hit the end
        if (pageProducts === 0) {
          console.log(`[rowe] ${cat.room}: no products on page ${pageNum}, stopping`);
          break;
        }

        if (pageNum % 10 === 0 || pageNum === 1) {
          console.log(`[rowe] ${cat.room} p${pageNum}: found ${pageProducts} items, ${allProducts.size} total unique`);
        }
      } catch (err) {
        console.error(`[rowe] ${cat.room} p${pageNum} error: ${err.message}`);
        stats.errors.push(`listing ${cat.room} p${pageNum}: ${err.message}`);
        // If 404 or similar, we've likely gone past last page
        if (err.message.includes("404") || err.message.includes("302")) break;
      }

      await sleep(300);
    }
  }

  stats.products_listed = allProducts.size;
  console.log(`[rowe] Total unique products from listings: ${allProducts.size}`);
  return allProducts;
}

// ══════════════════════════════════════════════════════════════
// PHASE 2: Detail pages — extract EVERYTHING
// ══════════════════════════════════════════════════════════════

async function scrapeDetailPages(productsMap) {
  const entries = [...productsMap.entries()];
  const fullProducts = [];
  let done = 0;

  for (const [detailPath, listing] of entries) {
    if (shouldStop) break;

    const detailUrl = `${BASE}${detailPath}`;
    stats.progress = `detail ${done}/${entries.length}`;

    try {
      const html = await fetchPage(detailUrl, 20000);
      const product = parseDetailPage(html, listing, detailUrl);
      fullProducts.push(product);
      done++;

      if (done % 50 === 0) {
        console.log(`[rowe] Detail pages: ${done}/${entries.length} (${stats.detail_errors} errors)`);
      }
      if (done % 200 === 0) {
        printMilestone(fullProducts, done);
      }

      await sleep(250);
    } catch (err) {
      // Fallback to listing data
      fullProducts.push(buildFromListing(listing, detailUrl));
      done++;
      stats.detail_errors++;

      if (stats.detail_errors % 10 === 0) {
        console.warn(`[rowe] ${stats.detail_errors} detail errors so far (latest: ${err.message})`);
      }

      await sleep(500);
    }

    stats.products_detailed = done;
  }

  console.log(`[rowe] Detail pages complete: ${done} products, ${stats.detail_errors} errors`);
  return fullProducts;
}

function parseDetailPage(html, listing, detailUrl) {
  // The entire product data is embedded in a JavaScript object on the page.
  // Extract the PictureModels array for all images, and ProductSpecificationModel for specs.
  // The JS object format uses unquoted keys and !0/!1 for booleans.

  // ── PRODUCT NAME ──
  const nameMatch = html.match(/,Name:"([^"]+)",/);
  const productName = nameMatch ? nameMatch[1].trim() : listing.productName || "Unknown Product";

  // ── SKU ──
  const skuMatch = html.match(/,Sku:"([^"]+)"/);
  const sku = skuMatch ? skuMatch[1].trim() : listing.sku;

  // ── MPN ──
  const mpnMatch = html.match(/ManufacturerPartNumber:"([^"]+)"/);
  const mpn = mpnMatch ? mpnMatch[1].trim() : null;

  // ── ALL IMAGES from PictureModels ──
  const images = [];
  const seen = new Set();
  // Extract FullSizeImageUrl (highest quality) from each PictureModels entry
  const imgRegex = /FullSizeImageUrl:"([^"]+)"/g;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    if (!seen.has(url)) {
      seen.add(url);
      images.push(url);
    }
  }
  // If no FullSize found, try ImageUrl (1170px)
  if (images.length === 0) {
    const img1170Regex = /ImageUrl:"(https:\/\/rffblob[^"]+_1170\.jpeg)"/g;
    while ((match = img1170Regex.exec(html)) !== null) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        images.push(match[1]);
      }
    }
  }
  // Fallback to listing images
  if (images.length === 0 && listing.heroImage) {
    images.push(upgradeImageSize(listing.heroImage));
  }

  // Sort images: Main first, then Angle, Side, Back, Room, Detail, Alternate
  images.sort((a, b) => {
    const priority = { "main": 0, "angle": 1, "side": 2, "back": 3, "room": 4, "detail": 5, "alternate": 6 };
    const typeA = getImageType(a);
    const typeB = getImageType(b);
    return (priority[typeA] ?? 99) - (priority[typeB] ?? 99);
  });

  // ── BREADCRUMB from JS object ──
  const breadcrumbNames = [];
  const bcRegex = /CategoryBreadcrumb:\[([^\]]*)\]/;
  const bcMatch = html.match(bcRegex);
  if (bcMatch) {
    const nameInBc = /Name:"([^"]+)"/g;
    let m;
    while ((m = nameInBc.exec(bcMatch[1])) !== null) {
      breadcrumbNames.push(m[1]);
    }
  }
  const breadcrumb = breadcrumbNames.join(" > ");
  const category = mapCategory(productName, breadcrumb, listing.room);

  // ── SPECIFICATIONS from ProductSpecificationModel ──
  const specs = extractSpecsFromJS(html);

  // ── DESCRIPTION ──
  // FullDescription may contain HTML tags. The JS value ends at ",JsonLd:" or similar next key.
  const fullDescMatch = html.match(/FullDescription:(?:"((?:[^"\\]|\\.)*)"|null)/);
  const shortDescMatch = html.match(/ShortDescription:(?:"((?:[^"\\]|\\.)*)"|null)/);
  let description = null;
  const rawDesc = (fullDescMatch && fullDescMatch[1]) || (shortDescMatch && shortDescMatch[1]) || null;
  if (rawDesc) {
    description = rawDesc
      .replace(/\\u[\dA-Fa-f]{4}/g, "")
      .replace(/\\n/g, " ")
      .replace(/<[^>]+>/g, " ")       // strip HTML tags
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#?\w+;/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (description.length < 5) description = null;
  }

  // ── COLLECTION ──
  const collection = specs.collection || null;

  // ── DIMENSIONS ──
  let dimensions = null;
  if (specs.dimensionsFormatted) {
    dimensions = specs.dimensionsFormatted.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  } else if (specs.length || specs.depth || specs.height) {
    const parts = [];
    if (specs.length) parts.push(`L: ${specs.length}"`);
    if (specs.depth) parts.push(`D: ${specs.depth}"`);
    if (specs.height) parts.push(`H: ${specs.height}"`);
    dimensions = parts.join(" x ");
  }
  // Add seat dimensions
  const seatParts = [];
  if (specs.seatHeight) seatParts.push(`Seat H: ${specs.seatHeight}"`);
  if (specs.seatDepth) seatParts.push(`Seat D: ${specs.seatDepth}"`);
  if (specs.armHeight) seatParts.push(`Arm H: ${specs.armHeight}"`);
  if (specs.distanceBetweenArms) seatParts.push(`Between Arms: ${specs.distanceBetweenArms}"`);
  if (seatParts.length > 0 && dimensions) {
    dimensions += " | " + seatParts.join(", ");
  } else if (seatParts.length > 0) {
    dimensions = seatParts.join(", ");
  }

  // ── MATERIAL ──
  let material = specs.material || null;
  if (!material) {
    const nameLower = productName.toLowerCase();
    if (nameLower.includes("leather")) material = "Leather";
    else if (nameLower.includes("slip")) material = "Slipcovered Fabric";
    else material = "Upholstered Fabric";
  }

  // ── CUSHION TYPE ──
  const cushionType = specs.standardCushion || null;

  // ── WEIGHT ──
  const weight = specs.weight ? `${specs.weight} lbs` : null;

  // ── ALLOWED PATTERNS (COM indicator) ──
  const allowedPatterns = specs.allowedPattern || null;

  // ── ASSORTMENT / BRAND ──
  const assortmentMatch = html.match(/Assortment\s*(?:<[^>]*>)*\s*:?\s*(?:<[^>]*>)*\s*(Rowe|Robin Bruce)/i)
    || html.match(/"manufacturer[^"]*"[^}]*"name"\s*:\s*"(Rowe|Robin Bruce)"/i);
  const assortment = assortmentMatch ? assortmentMatch[1].trim() : "Rowe";

  // ── PILLOWS ──
  const numPillows = specs.numBackPillows || null;
  const numCushions = specs.numCushions || null;

  // ── PRODUCT TAGS (size variants) ──
  const tagNames = [];
  const tagSection = html.match(/ProductTags:\[([^\]]*)\]/);
  if (tagSection) {
    const tagNameRegex = /Name:"([^"]+)"/g;
    let tm;
    while ((tm = tagNameRegex.exec(tagSection[1])) !== null) {
      tagNames.push(tm[1]);
    }
  }

  // ── QUICK SHIP ──
  const isQuickShip = /quick\s*ship/i.test(html);

  // Build rich description
  let richDescription = description || "";
  const specLines = [];
  if (cushionType) specLines.push(`Cushion: ${cushionType}`);
  if (allowedPatterns) specLines.push(`Allowed Patterns: ${allowedPatterns}`);
  if (numPillows) specLines.push(`Back Pillows: ${numPillows}`);
  if (numCushions) specLines.push(`Cushions: ${numCushions}`);
  if (weight) specLines.push(`Weight: ${weight}`);
  if (assortment !== "Rowe") specLines.push(`Brand: ${assortment}`);
  if (isQuickShip) specLines.push("Quick Ship Available");
  if (tagNames.length > 0) specLines.push(`Size Variants: ${tagNames.join(", ")}`);

  if (specLines.length > 0) {
    richDescription = richDescription
      ? richDescription + "\n\n" + specLines.join("\n")
      : specLines.join("\n");
  }
  if (richDescription.length > 1000) richDescription = richDescription.slice(0, 997) + "...";

  const heroImage = images[0] || listing.heroImage || null;

  return {
    id: `rowe_${slugify(productName)}-${slugify(sku || "")}`,
    product_name: productName,
    vendor_id: "rowe",
    vendor_name: "Rowe Furniture",
    vendor_domain: "rowefurniture.com",
    vendor_tier: 2,
    category,
    sku: sku || null,
    collection: collection || null,
    material,
    dimensions,
    description: richDescription || null,
    style: cushionType ? `Cushion: ${cushionType}` : null,
    retail_price: null, // Rowe hides prices on portal
    image_url: heroImage,
    images: images.filter(Boolean).slice(0, 20),
    product_url: detailUrl,
    ingestion_source: "rowe-importer",
    // Extended fields
    cushion_type: cushionType,
    allowed_patterns: allowedPatterns,
    com_available: allowedPatterns ? true : false,
    quick_ship: isQuickShip,
    assortment,
    weight,
    num_back_pillows: numPillows,
    num_cushions: numCushions,
    size_variants: tagNames.length > 0 ? tagNames : null,
    image_contain: true,
  };
}

function getImageType(url) {
  const lower = url.toLowerCase();
  if (lower.includes("main")) return "main";
  if (lower.includes("angle")) return "angle";
  if (lower.includes("side")) return "side";
  if (lower.includes("back")) return "back";
  if (lower.includes("room")) return "room";
  if (lower.includes("detail")) return "detail";
  if (lower.includes("alternate")) return "alternate";
  return "other";
}

function upgradeImageSize(url) {
  return url.replace(/_350\./, "_1170.").replace(/_520\./, "_1170.");
}

/**
 * Extract specs from the embedded JS ProductSpecificationModel.
 * The JS has structures like:
 *   {Name:"Seat Height (IN)",Values:[{AttributeTypeId:0,ValueRaw:"20|20|20|20|20",...}],...}
 * Multiple values separated by | represent size variants (take first).
 */
function extractSpecsFromJS(html) {
  const specs = {};

  // Extract the spec groups section
  const specSection = html.match(/ProductSpecificationModel:\{Groups:\[([\s\S]*?)\]\s*,\s*CustomProperties/);
  if (!specSection) return specs;

  const content = specSection[1];

  // Extract each attribute Name + ValueRaw pair
  // Must match within Attributes arrays, not group Names
  // Pattern: {Name:"AttrName",Values:[{...ValueRaw:"value"...}]}
  const attrRegex = /\{Name:"([^"]+)",Values:\[\{[^}]*ValueRaw:"([^"]*)"/g;
  let match;
  while ((match = attrRegex.exec(content)) !== null) {
    const name = match[1];
    // Take first value if pipe-separated (size variants)
    const rawVal = match[2].split("|")[0].trim();
    if (!rawVal) continue;

    const key = name.toLowerCase();
    if (key.includes("length") && key.includes("in")) specs.length = rawVal;
    else if (key.includes("depth") && key.includes("seat")) specs.seatDepth = rawVal;
    else if (key.includes("depth") && key.includes("in")) specs.depth = rawVal;
    else if (key.includes("height") && key.includes("seat")) specs.seatHeight = rawVal;
    else if (key.includes("height") && key.includes("arm")) specs.armHeight = rawVal;
    else if (key.includes("height") && key.includes("in")) specs.height = rawVal;
    else if (key.includes("distance between arms")) specs.distanceBetweenArms = rawVal;
    else if (key.includes("weight")) specs.weight = rawVal;
    else if (key.includes("back pillows")) specs.numBackPillows = rawVal;
    else if (key.includes("cushions")) specs.numCushions = rawVal;
    else if (key.includes("standard cushion")) specs.standardCushion = rawVal;
    else if (key.includes("collection")) specs.collection = rawVal;
    else if (key.includes("allowed pattern")) specs.allowedPattern = rawVal;
    else if (key.includes("dimensions")) specs.dimensionsFormatted = rawVal;
    else if (key === "sku") specs.skuVariants = rawVal;
    else if (key.includes("general features") || key.includes("material")) specs.material = rawVal;
    else if (key.includes("drawer information") || key.includes("drawer features")) {
      specs.drawerInfo = (specs.drawerInfo ? specs.drawerInfo + ". " : "") + rawVal;
    }
    else if (key.includes("country of origin")) specs.countryOfOrigin = rawVal;
    else if (key.includes("leg features")) specs.legFeatures = rawVal;
  }

  return specs;
}

function mapCategory(productName, breadcrumb, room) {
  const text = `${productName} ${breadcrumb}`.toLowerCase();

  // Specific product type matches
  if (text.includes("sectional")) return "sectionals";
  if (text.includes("sofa") && text.includes("sleeper")) return "sleeper-sofas";
  if (text.includes("sofa")) return "sofas";
  if (text.includes("loveseat")) return "loveseats";
  if (text.includes("settee")) return "settees";
  if (text.includes("swivel") && text.includes("chair")) return "swivel-chairs";
  if (text.includes("accent chair") || text.includes("club chair") || text.includes("wing chair")) return "accent-chairs";
  if (text.includes("dining") && text.includes("chair")) return "dining-chairs";
  if (text.includes("desk") && text.includes("chair")) return "desk-chairs";
  if (text.includes("counter") && text.includes("stool")) return "bar-stools";
  if (text.includes("bar") && text.includes("stool")) return "bar-stools";
  if (text.includes("chair")) return "accent-chairs";
  if (text.includes("ottoman")) return "ottomans";
  if (text.includes("bench")) return "benches";
  if (text.includes("chaise")) return "chaises";
  if (text.includes("bed") && !text.includes("daybed")) return "beds";
  if (text.includes("daybed")) return "daybeds";
  if (text.includes("headboard")) return "headboards";
  if (text.includes("nightstand")) return "nightstands";
  if (text.includes("dresser")) return "dressers";
  if (text.includes("chest")) return "chests";
  if (text.includes("dining") && text.includes("table")) return "dining-tables";
  if (text.includes("cocktail") || text.includes("coffee")) return "coffee-tables";
  if (text.includes("end table") || text.includes("side table")) return "side-tables";
  if (text.includes("console")) return "console-tables";
  if (text.includes("table")) return "side-tables";
  if (text.includes("desk")) return "desks";
  if (text.includes("bookcase") || text.includes("etagere") || text.includes("shelf")) return "bookcases";
  if (text.includes("cabinet") || text.includes("credenza") || text.includes("buffet") || text.includes("sideboard")) return "sideboards";
  if (text.includes("media")) return "media-cabinets";
  if (text.includes("vanity")) return "vanities";
  if (text.includes("mirror")) return "mirrors";
  if (text.includes("pillow") || text.includes("throw")) return "decorative-objects";

  // Fall back to room-based category
  if (room === "living-room") return "accent-chairs";
  if (room === "dining-room") return "dining-chairs";
  if (room === "bedroom") return "beds";
  if (room === "office") return "desks";
  return "accent-chairs";
}

function buildFromListing(listing, detailUrl) {
  const name = listing.productName || "Rowe Product";
  const heroImage = listing.heroImage ? upgradeImageSize(listing.heroImage) : null;

  return {
    id: `rowe_${slugify(name)}-${slugify(listing.sku || "")}`,
    product_name: name,
    vendor_id: "rowe",
    vendor_name: "Rowe Furniture",
    vendor_domain: "rowefurniture.com",
    vendor_tier: 2,
    category: mapCategory(name, "", listing.room),
    sku: listing.sku,
    image_url: heroImage,
    images: heroImage ? [heroImage] : [],
    product_url: detailUrl,
    ingestion_source: "rowe-importer",
    material: "Upholstered Fabric",
    image_contain: true,
  };
}

function printMilestone(products, done) {
  let multiImg = 0, withDesc = 0, withDims = 0, withCollection = 0, noImage = 0;
  for (const p of products) {
    if (p.images && p.images.length > 1) multiImg++;
    if (p.description && p.description.length > 20) withDesc++;
    if (p.dimensions) withDims++;
    if (p.collection) withCollection++;
    if (!p.image_url) noImage++;
  }
  console.log(`[rowe] ══ ${done} PRODUCTS MILESTONE ══`);
  console.log(`[rowe]   Multi-image: ${multiImg} (${Math.round(multiImg / done * 100)}%)`);
  console.log(`[rowe]   With description: ${withDesc} (${Math.round(withDesc / done * 100)}%)`);
  console.log(`[rowe]   With dimensions: ${withDims} (${Math.round(withDims / done * 100)}%)`);
  console.log(`[rowe]   With collection: ${withCollection} (${Math.round(withCollection / done * 100)}%)`);
  console.log(`[rowe]   No image: ${noImage}`);
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

export async function importRowe(catalogDB, options = {}) {
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
    console.log(`\n[rowe] ═══ PHASE 1: Listing Pages ═══`);
    const productsMap = await scrapeListingPages();

    if (shouldStop) {
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    // Phase 2: Hit every detail page for full data
    stats.phase = "detail_pages";
    console.log(`\n[rowe] ═══ PHASE 2: Detail Pages (${productsMap.size} products) ═══`);
    const fullProducts = await scrapeDetailPages(productsMap);

    if (shouldStop) {
      stats.finished_at = new Date().toISOString();
      stats.phase = "stopped";
      running = false;
      return stats;
    }

    // Phase 3: Insert into catalog
    stats.phase = "inserting";
    console.log(`\n[rowe] ═══ PHASE 3: Inserting ${fullProducts.length} products ═══`);

    if (fullProducts.length > 0 && catalogDB) {
      // Delete existing Rowe products first
      let existingCount = 0;
      const toDelete = [];
      for (const p of catalogDB.getAllProducts()) {
        if (p.vendor_id === "rowe") {
          toDelete.push(p.id);
          existingCount++;
        }
      }
      for (const id of toDelete) catalogDB.deleteProduct(id);
      console.log(`[rowe] Deleted ${existingCount} existing products`);

      const result = catalogDB.insertProducts(fullProducts);
      stats.products_inserted = (result.inserted || 0) + (result.updated || 0);
      console.log(`[rowe] Inserted: ${stats.products_inserted}`);
    }

    // Final stats
    let multiImage = 0, withDesc = 0, withDims = 0, withCollection = 0, noImage = 0, withCushion = 0;
    for (const p of fullProducts) {
      if (p.images && p.images.length > 1) multiImage++;
      if (p.description && p.description.length > 20) withDesc++;
      if (p.dimensions) withDims++;
      if (p.collection) withCollection++;
      if (!p.image_url) noImage++;
      if (p.cushion_type) withCushion++;
    }

    stats.phase = "complete";
    stats.finished_at = new Date().toISOString();

    console.log(`\n[rowe] ═══ COMPLETE ═══`);
    console.log(`[rowe] Products listed:      ${stats.products_listed}`);
    console.log(`[rowe] Products detailed:    ${stats.products_detailed}`);
    console.log(`[rowe] Products inserted:    ${stats.products_inserted}`);
    console.log(`[rowe] Detail page errors:   ${stats.detail_errors}`);
    console.log(`[rowe] Multi-image:          ${multiImage} (${Math.round(multiImage / fullProducts.length * 100)}%)`);
    console.log(`[rowe] With description:     ${withDesc} (${Math.round(withDesc / fullProducts.length * 100)}%)`);
    console.log(`[rowe] With dimensions:      ${withDims} (${Math.round(withDims / fullProducts.length * 100)}%)`);
    console.log(`[rowe] With collection:      ${withCollection} (${Math.round(withCollection / fullProducts.length * 100)}%)`);
    console.log(`[rowe] With cushion type:    ${withCushion} (${Math.round(withCushion / fullProducts.length * 100)}%)`);
    console.log(`[rowe] No image:             ${noImage}`);

    // Print 5 sample products
    console.log(`\n[rowe] ═══ SAMPLE PRODUCTS ═══`);
    const sampleIndices = [0, Math.floor(fullProducts.length * 0.25), Math.floor(fullProducts.length * 0.5), Math.floor(fullProducts.length * 0.75), fullProducts.length - 1];
    for (const idx of sampleIndices) {
      const p = fullProducts[idx];
      if (!p) continue;
      console.log(`\n[rowe] --- ${p.product_name} (${p.sku || 'no SKU'}) ---`);
      console.log(`[rowe]   Category: ${p.category}`);
      console.log(`[rowe]   Images: ${p.images?.length || 0}`);
      console.log(`[rowe]   Description: ${p.description?.slice(0, 100) || 'NONE'}...`);
      console.log(`[rowe]   Dimensions: ${p.dimensions || 'NONE'}`);
      console.log(`[rowe]   Material: ${p.material || 'NONE'}`);
      console.log(`[rowe]   Collection: ${p.collection || 'NONE'}`);
      console.log(`[rowe]   Cushion: ${p.cushion_type || 'NONE'}`);
      console.log(`[rowe]   Quick Ship: ${p.quick_ship || false}`);
      console.log(`[rowe]   Assortment: ${p.assortment || 'Rowe'}`);
    }

    return stats;
  } catch (err) {
    console.error("[rowe] Fatal error:", err);
    stats.phase = "error";
    stats.finished_at = new Date().toISOString();
    stats.errors.push(err.message);
    return stats;
  } finally {
    running = false;
  }
}
