/**
 * Bernhardt-specific importer
 *
 * Bernhardt uses a JS SPA with hash routing (#/product/ID).
 * Standard HTTP fetching won't work — must use Puppeteer.
 *
 * Strategy:
 *   1. Load each category listing page (MultiView grid)
 *   2. Paginate through all pages
 *   3. Extract product cards (name, image, price, URL)
 *   4. Visit each product page for full details + all images
 *   5. Upsert into catalog DB
 */

let browser = null;

const CATEGORY_URLS = [
  { url: "https://www.bernhardt.com/shop/?$MultiView=Yes&Sub-Category=Beds&orderBy=BedroomPosition,Id&context=shop", category: "bed", room: "bedroom", expected: 102 },
  { url: "https://www.bernhardt.com/shop/?$MultiView=Yes&Sub-Category=Bedroom%20Storage&orderBy=BedroomPosition,Id&context=shop", category: "dresser", room: "bedroom", expected: 191 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Bedroom&$MultiView=Yes&Sub-Category=Benches%20%26%20Ottomans&orderBy=BedroomPosition,Id&context=shop", category: "bench", room: "bedroom", expected: 52 },
  { url: "https://www.bernhardt.com/shop/?$MultiView=Yes&Sub-Category=Mirrors&orderBy=BedroomPosition,Id&context=shop", category: "mirror", room: "bedroom", expected: 24 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Dining&$MultiView=Yes&Sub-Category=Tables&orderBy=DiningPosition,Id&context=shop", category: "dining-table", room: "dining", expected: 86 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Dining&$MultiView=Yes&Sub-Category=Chairs&orderBy=DiningPosition,Id&context=shop", category: "dining-chair", room: "dining", expected: 106 },
  { url: "https://www.bernhardt.com/shop/?$MultiView=Yes&Sub-Category=Dining%20Storage&orderBy=DiningPosition,Id&context=shop", category: "credenza", room: "dining", expected: 70 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Living&$MultiView=Yes&Sub-Category=Seating&orderBy=LivingPosition,Id&context=shop", category: "seating", room: "living", expected: 490 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Living&$MultiView=Yes&Sub-Category=Living%20Tables&orderBy=LivingPosition,Id&context=shop", category: "table", room: "living", expected: 372 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Living&$MultiView=Yes&Sub-Category=Living%20Storage&orderBy=LivingPosition,Id&context=shop", category: "cabinet", room: "living", expected: 81 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Workspace&$MultiView=Yes&Sub-Category=All%20Desks%20%26%20Chairs&orderBy=WorkspacePosition,Id&context=shop", category: "desk", room: "office", expected: 18 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Living&$MultiView=Yes&Sub-Category=Accent%20Pillows&orderBy=LivingPosition,Id&context=shop", category: "accent", room: "living", expected: 66 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Workspace&$MultiView=Yes&Sub-Category=Workspace%20Storage&orderBy=WorkspacePosition,Id&context=shop", category: "cabinet", room: "office", expected: 23 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Outdoor&$MultiView=Yes&Sub-Category=Outdoor%20Seating&orderBy=OutdoorPosition,Id&context=shop", category: "outdoor", room: "outdoor", expected: 117 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Outdoor&$MultiView=Yes&Sub-Category=Outdoor%20Dining&orderBy=OutdoorPosition,Id&context=shop", category: "outdoor", room: "outdoor", expected: 36 },
  { url: "https://www.bernhardt.com/shop/?RoomType=Outdoor&$MultiView=Yes&Sub-Category=Outdoor%20Tables&orderBy=OutdoorPosition,Id&context=shop", category: "outdoor", room: "outdoor", expected: 65 },
];

// Quick ship URLs (tag products as quick_ship)
const QUICK_SHIP_URLS = [
  "https://www.bernhardt.com/shop/?Express%20Ship=Yes&RoomType=Bedroom&$MultiView=Yes&orderBy=BedroomPosition,Id&context=shop",
  "https://www.bernhardt.com/shop/?Express%20Ship=Yes&RoomType=Living&$MultiView=Yes&orderBy=LivingPosition,Id&context=shop",
  "https://www.bernhardt.com/shop/?Express%20Ship=Yes&RoomType=Outdoor&$MultiView=Yes&orderBy=OutdoorPosition,Id&context=shop",
];

let running = false;
let shouldStop = false;
let stats = {
  running: false,
  started_at: null,
  finished_at: null,
  current_category: null,
  categories_completed: 0,
  categories_total: CATEGORY_URLS.length,
  products_found: 0,
  products_enriched: 0,
  products_failed: 0,
  category_results: [],
};

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
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}

/**
 * Load a Bernhardt category listing page and extract all product cards.
 * Handles pagination by incrementing page= param.
 */
async function scrapeCategory(categoryConfig) {
  const { url, category, room, expected } = categoryConfig;
  const products = new Map();
  const b = await launchBrowser();
  const page = await b.newPage();

  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1440, height: 900 });

  let pageNum = 1;
  const maxPages = Math.ceil((expected || 500) / 24) + 2; // ~24 per page

  while (pageNum <= maxPages) {
    if (shouldStop) break;

    const pageUrl = `${url}&page=${pageNum}`;
    try {
      await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 30000 });
      // Wait for product grid to render
      await page.waitForSelector("img", { timeout: 8000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000)); // Extra wait for SPA render

      // Extract product cards from the page
      const cards = await page.evaluate(() => {
        const results = [];

        // Try multiple selectors for product cards
        const cardSelectors = [
          ".product-card", ".product-item", ".product-tile",
          "[data-product]", ".grid-item", ".item-card",
          "a[href*='#/product']", "a[href*='/product/']",
          ".multiview-item", ".shop-item",
        ];

        // Grab all links that point to product pages
        const links = document.querySelectorAll("a[href]");
        for (const link of links) {
          const href = link.getAttribute("href") || "";
          if (!href.includes("product") && !href.includes("Product")) continue;

          // Find the product card container
          const card = link.closest("[class*='product'], [class*='item'], [class*='card'], [class*='tile'], li, div") || link;
          const imgs = card.querySelectorAll("img");
          const img = imgs.length > 0 ? imgs[0] : null;

          const name = card.querySelector("h2, h3, h4, [class*='name'], [class*='title'], [class*='Name']");
          const price = card.querySelector("[class*='price'], [class*='Price']");
          const sku = card.querySelector("[class*='sku'], [class*='Sku'], [class*='id'], [class*='Id']");

          if (name || img) {
            results.push({
              name: name?.textContent?.trim() || null,
              image: img?.src || img?.getAttribute("data-src") || null,
              price: price?.textContent?.trim() || null,
              sku: sku?.textContent?.trim() || null,
              href: href.startsWith("http") ? href : (href.startsWith("/") ? window.location.origin + href : window.location.origin + "/" + href),
            });
          }
        }

        // Also try getting all images that look like product images
        if (results.length === 0) {
          const allImgs = document.querySelectorAll("img[src*='bernhardt'], img[src*='product'], img[src*='media']");
          for (const img of allImgs) {
            const src = img.src || img.getAttribute("data-src");
            if (!src || src.includes("logo") || src.includes("icon")) continue;
            const parent = img.closest("a") || img.parentElement;
            const link = parent?.closest("a")?.href || parent?.querySelector("a")?.href;
            const nameEl = parent?.querySelector("h2, h3, h4, span, p");
            results.push({
              name: nameEl?.textContent?.trim() || img.alt || null,
              image: src,
              price: null,
              sku: null,
              href: link || null,
            });
          }
        }

        return results;
      });

      if (cards.length === 0) {
        // No more products — end pagination
        break;
      }

      for (const card of cards) {
        if (!card.name || card.name.length < 3) continue;
        const id = `bernhardt_${slugify(card.name)}`;
        if (!products.has(id)) {
          products.set(id, {
            id,
            product_name: card.name,
            vendor_id: "bernhardt",
            vendor_name: "Bernhardt",
            vendor_domain: "bernhardt.com",
            vendor_tier: 1,
            category,
            room_types: [room],
            image_url: card.image || null,
            images: card.image ? [card.image] : [],
            product_url: card.href || null,
            retail_price: card.price ? parseFloat(card.price.replace(/[^0-9.]/g, "")) || null : null,
            sku: card.sku || null,
            ingestion_source: "bernhardt-import",
          });
        }
      }

      console.log(`[bernhardt] Page ${pageNum}: ${cards.length} cards, ${products.size} total unique`);
      pageNum++;

      // Small delay between pages
      await new Promise(r => setTimeout(r, 1500));

    } catch (err) {
      console.error(`[bernhardt] Page ${pageNum} error: ${err.message}`);
      break;
    }
  }

  await page.close();
  return [...products.values()];
}

/**
 * Visit a single product page to extract detailed data and all images.
 */
async function enrichProductPage(product) {
  if (!product.product_url) return null;

  const b = await launchBrowser();
  const page = await b.newPage();
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto(product.product_url, { waitUntil: "networkidle2", timeout: 25000 });
    await page.waitForSelector("img", { timeout: 8000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    const data = await page.evaluate(() => {
      const result = {};

      // Get all product images
      const images = [];
      const seenSrcs = new Set();
      const allImgs = document.querySelectorAll("img");
      for (const img of allImgs) {
        const src = img.src || img.getAttribute("data-src") || img.getAttribute("data-zoom-image");
        if (!src) continue;
        if (seenSrcs.has(src)) continue;
        if (src.includes("logo") || src.includes("icon") || src.includes("favicon") || src.includes("social")) continue;
        if (src.includes("sprite") || src.includes("pixel") || src.includes("tracking")) continue;
        if (src.endsWith(".svg") || src.includes("data:image")) continue;
        // Skip tiny images
        if (img.naturalWidth > 0 && img.naturalWidth < 50) continue;
        seenSrcs.add(src);
        images.push(src);
      }
      result.images = images.slice(0, 20);

      // Product name
      const h1 = document.querySelector("h1, [class*='product-name'], [class*='ProductName']");
      if (h1) result.name = h1.textContent.trim();

      // Price
      const priceEl = document.querySelector("[class*='price'], [class*='Price']");
      if (priceEl) result.price = priceEl.textContent.trim();

      // SKU
      const skuEl = document.querySelector("[class*='sku'], [class*='Sku'], [class*='model'], [class*='Model'], [class*='item-id']");
      if (skuEl) result.sku = skuEl.textContent.trim();

      // Description
      const descEl = document.querySelector("[class*='description'], [class*='Description'], [class*='details'], [class*='Details']");
      if (descEl) result.description = descEl.textContent.trim().slice(0, 500);

      // Dimensions - look for specs section
      const allText = document.body.innerText;
      const dimMatch = allText.match(/(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Ww](?:ide|idth)?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Dd](?:eep|epth)?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Hh]/);
      if (dimMatch) {
        result.width = parseFloat(dimMatch[1]);
        result.depth = parseFloat(dimMatch[2]);
        result.height = parseFloat(dimMatch[3]);
        result.dimensions = `${result.width}"W x ${result.depth}"D x ${result.height}"H`;
      }

      // Material
      const matMatch = allText.match(/(?:material|fabric|upholstery|finish)[\s:]+([^\n]{3,80})/i);
      if (matMatch) result.material = matMatch[1].trim().slice(0, 100);

      // Collection
      const collMatch = allText.match(/(?:collection|series)[\s:]+([^\n]{2,40})/i);
      if (collMatch) result.collection = collMatch[1].trim();

      // Features
      result.features = {};
      if (/\bswivel\b/i.test(allText)) result.features.swivel = true;
      if (/\brecliner|reclining\b/i.test(allText)) result.features.reclining = true;
      if (/\bpower\b/i.test(allText)) result.features.power = true;
      if (/\bslipcover/i.test(allText)) result.features.slipcovered = true;
      if (/\bnailhead/i.test(allText)) result.features.nailhead_trim = true;

      return result;
    });

    await page.close();
    return data;

  } catch (err) {
    await page.close().catch(() => {});
    return null;
  }
}

/**
 * Main import function.
 */
export async function importBernhardt(catalogDB, options = {}) {
  if (running) {
    console.log("[bernhardt] Already running");
    return stats;
  }

  const { enrichDetails = true, batchSize = 3, delayMs = 1000 } = options;

  running = true;
  shouldStop = false;
  stats = {
    running: true,
    started_at: new Date().toISOString(),
    finished_at: null,
    current_category: null,
    categories_completed: 0,
    categories_total: CATEGORY_URLS.length,
    products_found: 0,
    products_enriched: 0,
    products_failed: 0,
    category_results: [],
  };

  console.log(`[bernhardt] Starting import across ${CATEGORY_URLS.length} categories`);

  try {
    const allProducts = new Map();

    // Phase 1: Scrape all category listing pages
    for (const catConfig of CATEGORY_URLS) {
      if (shouldStop) break;

      stats.current_category = catConfig.category + " (" + catConfig.room + ")";
      console.log(`[bernhardt] Scraping: ${catConfig.category} (${catConfig.room}), expecting ~${catConfig.expected}`);

      const products = await scrapeCategory(catConfig);

      const catResult = {
        category: catConfig.category,
        room: catConfig.room,
        expected: catConfig.expected,
        found: products.length,
      };

      for (const p of products) {
        if (!allProducts.has(p.id)) {
          allProducts.set(p.id, p);
        }
      }

      stats.category_results.push(catResult);
      stats.categories_completed++;
      stats.products_found = allProducts.size;

      console.log(`[bernhardt] ✓ ${catConfig.category}: ${products.length} found, ${allProducts.size} total unique`);

      await new Promise(r => setTimeout(r, 2000)); // Pause between categories
    }

    console.log(`[bernhardt] Phase 1 complete: ${allProducts.size} unique products from listings`);

    // Phase 2: Enrich each product by visiting its page (optional, slow)
    if (enrichDetails && !shouldStop) {
      console.log(`[bernhardt] Phase 2: Enriching ${allProducts.size} products with detail pages`);
      const productList = [...allProducts.values()];

      for (let i = 0; i < productList.length; i += batchSize) {
        if (shouldStop) break;

        const batch = productList.slice(i, i + batchSize);
        await Promise.all(batch.map(async (product) => {
          try {
            const details = await enrichProductPage(product);
            if (details) {
              if (details.images?.length > 0) product.images = details.images;
              if (details.images?.length > 0) product.image_url = details.images[0];
              if (details.name) product.product_name = details.name;
              if (details.price) {
                const p = parseFloat(details.price.replace(/[^0-9.]/g, ""));
                if (p > 0 && p < 500000) product.retail_price = p;
              }
              if (details.sku) product.sku = details.sku;
              if (details.description) product.description = details.description;
              if (details.dimensions) product.dimensions = details.dimensions;
              if (details.width) product.width = details.width;
              if (details.depth) product.depth = details.depth;
              if (details.height) product.height = details.height;
              if (details.material) product.material = details.material;
              if (details.collection) product.collection = details.collection;
              if (details.features && Object.keys(details.features).length > 0) product.features = details.features;
              stats.products_enriched++;
            } else {
              stats.products_failed++;
            }
          } catch {
            stats.products_failed++;
          }
        }));

        const processed = Math.min(i + batchSize, productList.length);
        if (processed % 30 < batchSize || processed === productList.length) {
          console.log(`[bernhardt] Enrichment: ${processed}/${productList.length} (${stats.products_enriched} enriched, ${stats.products_failed} failed)`);
        }

        if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      }
    }

    // Phase 3: Insert all products into catalog DB
    const productArray = [...allProducts.values()];
    if (productArray.length > 0 && catalogDB) {
      console.log(`[bernhardt] Inserting ${productArray.length} products into catalog`);
      const result = catalogDB.insertProducts(productArray);
      console.log(`[bernhardt] Inserted: ${result.inserted} new, ${result.updated} updated`);
    }

  } catch (err) {
    console.error(`[bernhardt] Fatal error: ${err.message}`);
  } finally {
    await closeBrowser();
    stats.running = false;
    stats.current_category = null;
    stats.finished_at = new Date().toISOString();
    running = false;
  }

  console.log(`[bernhardt] Complete: ${stats.products_found} found, ${stats.products_enriched} enriched`);
  return stats;
}

export function getBernhardtStatus() {
  return { ...stats };
}

export function stopBernhardt() {
  shouldStop = true;
  console.log("[bernhardt] Stop requested");
}
