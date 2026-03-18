/**
 * Missing Vendors Importer
 *
 * Crawls category listing pages for: Vanguard, Wesley Hall,
 * Hancock & Moore, Hickory Chair, Highland House.
 *
 * Each vendor has specific HTML structures discovered by inspection.
 * Uses Puppeteer for all (JS rendering / lazy loading).
 */

let browser = null;
let running = false;
let shouldStop = false;
let stats = {
  running: false,
  started_at: null,
  finished_at: null,
  current_vendor: null,
  vendors_completed: 0,
  vendors_total: 5,
  vendor_results: [],
};

export function getMissingVendorsStatus() {
  return { running, ...stats };
}

export function stopMissingVendors() {
  if (running) { shouldStop = true; return { message: "Stop requested" }; }
  return { message: "Not running" };
}

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
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
  await page.setViewport({ width: 1440, height: 900 });
  return page;
}

// ══════════════════════════════════════════════════════════════
// VANGUARD — div.StyleResult, a[href^="/styles/sku/"], single page per room
// ══════════════════════════════════════════════════════════════

const VANGUARD_CATEGORIES = [
  { url: "https://www.vanguardfurniture.com/styles?Room=BR", category: "bedroom", expected: 590 },
  { url: "https://www.vanguardfurniture.com/styles?Room=DR", category: "dining", expected: 506 },
  { url: "https://www.vanguardfurniture.com/styles?Room=LR", category: "seating", expected: 1819 },
  { url: "https://www.vanguardfurniture.com/styles?Room=OF", category: "home-office", expected: 234 },
  { url: "https://www.vanguardfurniture.com/styles?Room=OD", category: "outdoor", expected: 162 },
];

async function crawlVanguard() {
  const allProducts = new Map();

  for (const cat of VANGUARD_CATEGORIES) {
    if (shouldStop) break;
    console.log(`[vanguard] Crawling ${cat.category} (expected ~${cat.expected})`);

    const page = await newPage();
    try {
      await page.goto(cat.url, { waitUntil: "networkidle2", timeout: 60000 });
      // Wait for product grid
      await page.waitForSelector("div.StyleResult", { timeout: 15000 }).catch(() => {});
      // Scroll to load all products
      await autoScroll(page);
      await new Promise(r => setTimeout(r, 2000));

      const cards = await page.evaluate(() => {
        const results = [];
        const items = document.querySelectorAll("div.StyleResult");
        for (const item of items) {
          const link = item.querySelector("a[href]");
          if (!link) continue;
          const href = link.href || link.getAttribute("href") || "";
          const img = item.querySelector("img");

          // Name is in the text of the link, after the <br> tag
          // Format: "SKU\nProduct Name" or "SKU<br>Product Name"
          const textContent = link.textContent || "";
          const parts = textContent.split(/\n/).map(s => s.trim()).filter(Boolean);
          const sku = parts[0] || null;
          const name = parts.length > 1 ? parts.slice(1).join(" ").trim() : parts[0];

          if (!name || name.length < 2) continue;

          results.push({
            name,
            sku,
            image: img?.src || img?.getAttribute("data-src") || null,
            href: href.startsWith("http") ? href : window.location.origin + href,
          });
        }
        return results;
      });

      console.log(`[vanguard] ${cat.category}: ${cards.length} products found`);

      for (const card of cards) {
        const key = card.href;
        if (!allProducts.has(key)) {
          allProducts.set(key, {
            id: `vanguard_${slugify(card.name)}${card.sku ? "-" + slugify(card.sku) : ""}`,
            product_name: card.name,
            vendor_id: "vanguard",
            vendor_name: "Vanguard Furniture",
            vendor_domain: "vanguardfurniture.com",
            vendor_tier: 1,
            category: cat.category,
            sku: card.sku,
            image_url: card.image || null,
            images: card.image ? [card.image] : [],
            product_url: card.href || null,
            ingestion_source: "missing-vendors-import",
          });
        }
      }

      await page.close();
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[vanguard] ${cat.category} error: ${err.message}`);
      await page.close().catch(() => {});
    }
  }

  console.log(`[vanguard] Total unique: ${allProducts.size}`);
  return [...allProducts.values()];
}

// ══════════════════════════════════════════════════════════════
// WESLEY HALL — a[href*="/styledetail/"], lazy-loaded images, single page
// Format: <a href="..."><strong>SKU</strong> PRODUCT NAME</a>
// ══════════════════════════════════════════════════════════════

const WESLEY_HALL_CATEGORIES = [
  { url: "https://www.wesleyhall.com/styles/func/cat/SOF", category: "sofa" },
  { url: "https://www.wesleyhall.com/styles/func/cat/SEC", category: "sectional" },
  { url: "https://www.wesleyhall.com/styles/func/cat/TBC", category: "chair" },
  { url: "https://www.wesleyhall.com/styles/func/cat/CHR", category: "chair" },
  { url: "https://www.wesleyhall.com/styles/func/cat/OTT", category: "ottoman" },
  { url: "https://www.wesleyhall.com/styles/func/cat/BCH", category: "bench" },
  { url: "https://www.wesleyhall.com/styles/func/cat/LSO", category: "sofa" },
  { url: "https://www.wesleyhall.com/styles/func/cat/LSE", category: "sectional" },
  { url: "https://www.wesleyhall.com/styles/func/cat/TBL", category: "table" },
  { url: "https://www.wesleyhall.com/styles/func/cat/LCH", category: "chair" },
  { url: "https://www.wesleyhall.com/styles/func/cat/LOT", category: "ottoman" },
  { url: "https://www.wesleyhall.com/styles/func/cat/LBC", category: "bench" },
  { url: "https://www.wesleyhall.com/styles/func/cat/BAR", category: "bar-stool" },
  { url: "https://www.wesleyhall.com/styles/func/cat/BED", category: "bed" },
  { url: "https://www.wesleyhall.com/search?search=SWIVEL+GLIDER", category: "swivel-chair" },
];

async function crawlWesleyHall() {
  const allProducts = new Map();

  for (const cat of WESLEY_HALL_CATEGORIES) {
    if (shouldStop) break;
    console.log(`[wesley-hall] Crawling ${cat.category}: ${cat.url}`);

    const page = await newPage();
    try {
      await page.goto(cat.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      // Wait for product links — they are server-rendered
      await page.waitForSelector('a[href*="/styledetail/"]', { timeout: 15000 }).catch((e) => {
        console.warn(`[wesley-hall] ${cat.category}: no /styledetail/ links found after 15s`);
      });
      // Extra wait for full render
      await new Promise(r => setTimeout(r, 3000));
      // Scroll to trigger lazy loading of images
      await autoScroll(page);
      await new Promise(r => setTimeout(r, 4000));

      const htmlLen = await page.evaluate(() => document.body.innerHTML.length);
      console.log(`[wesley-hall] ${cat.category}: page HTML length = ${htmlLen}`);

      const cards = await page.evaluate(() => {
        const results = [];
        const links = document.querySelectorAll('a[href*="/styledetail/"]');
        for (const link of links) {
          const href = link.href || "";
          if (!href) continue;
          const img = link.querySelector("img");

          // Wesley Hall: product info is in img alt="SKU PRODUCT NAME"
          // e.g. alt="710-56 GRANTHAM SETTEE"
          const alt = img?.getAttribute("alt") || "";
          const altParts = alt.split(/\s+/);
          const sku = altParts[0] || null; // First token is the SKU
          const name = altParts.length > 1 ? altParts.slice(1).join(" ").trim() : alt.trim();

          // Also try extracting SKU from the URL: /id/{SKU}/
          let urlSku = null;
          const skuMatch = href.match(/\/id\/([^/]+)\//);
          if (skuMatch) urlSku = skuMatch[1];

          const finalSku = sku || urlSku;
          const finalName = name || (urlSku ? urlSku : "");

          if (!finalName || finalName.length < 2) continue;

          results.push({
            name: finalName,
            sku: finalSku,
            image: img?.src || img?.getAttribute("lazyload") || img?.getAttribute("data-src") || null,
            href: href.startsWith("http") ? href : window.location.origin + href,
          });
        }
        return results;
      });

      console.log(`[wesley-hall] ${cat.category}: ${cards.length} products found`);

      for (const card of cards) {
        const key = card.href;
        if (!allProducts.has(key)) {
          allProducts.set(key, {
            id: `wesley-hall_${slugify(card.name)}${card.sku ? "-" + slugify(card.sku) : ""}`,
            product_name: card.name,
            vendor_id: "wesley-hall",
            vendor_name: "Wesley Hall",
            vendor_domain: "wesleyhall.com",
            vendor_tier: 3,
            category: cat.category,
            sku: card.sku,
            image_url: card.image || null,
            images: card.image ? [card.image] : [],
            product_url: card.href || null,
            ingestion_source: "missing-vendors-import",
          });
        }
      }

      await page.close();
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[wesley-hall] ${cat.category} error: ${err.message}`);
      await page.close().catch(() => {});
    }
  }

  console.log(`[wesley-hall] Total unique: ${allProducts.size}`);
  return [...allProducts.values()];
}

// ══════════════════════════════════════════════════════════════
// HANCOCK & MOORE — a[href^="/Products/Detail?SKU="], HAS pagination (&Page=N)
// Format: <a href="/Products/Detail?SKU=XXXX"><img...> SKU\nNAME</a>
// ══════════════════════════════════════════════════════════════

const HANCOCK_MOORE_CATEGORIES = [
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT9%2CCSTOOL", category: "bar-stool" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT23%2CCAT28", category: "bench" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=SOFACHAIR", category: "chair" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT13", category: "recliner" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT27", category: "accent-chair" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT15", category: "swivel-chair" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT4", category: "chair" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT26", category: "chaise" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT19", category: "ottoman" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT18", category: "ottoman" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT14", category: "recliner" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=SETTEES", category: "settee" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT16", category: "loveseat" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=SOFAS", category: "sofa" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT2", category: "sectional" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT30", category: "table" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=CAT5", category: "dining-chair" },
  { url: "https://www.hancockandmoore.com/Products/Search?TypeID=STOCKED", category: "seating" },
  { url: "https://www.hancockandmoore.com/Products/UrbanLogic", category: "seating" },
  { url: "https://www.hancockandmoore.com/Products/Search?CollectionNo=MILO", category: "seating" },
  { url: "https://www.hancockandmoore.com/Products/CDJ", category: "seating" },
];

async function crawlHancockMoore() {
  const allProducts = new Map();

  for (const cat of HANCOCK_MOORE_CATEGORIES) {
    if (shouldStop) break;
    console.log(`[hancock-moore] Crawling ${cat.category}: ${cat.url}`);
    let pageNum = 1;

    while (pageNum <= 30 && !shouldStop) {
      const page = await newPage();
      try {
        const sep = cat.url.includes("?") ? "&" : "?";
        const pageUrl = pageNum === 1 ? cat.url : `${cat.url}${sep}Page=${pageNum}`;
        await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 30000 });
        await page.waitForSelector('a[href*="/Products/Detail"]', { timeout: 8000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 1500));

        const cards = await page.evaluate(() => {
          const results = [];
          const links = document.querySelectorAll('a[href*="/Products/Detail?SKU="]');
          for (const link of links) {
            const href = link.href || "";
            if (!href) continue;
            const img = link.querySelector("img");
            const text = link.textContent || "";
            const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
            const sku = lines[0] || null;
            const name = lines.length > 1 ? lines.slice(1).join(" ").trim() : null;
            if (!name || name.length < 2) continue;
            results.push({
              name,
              sku,
              image: img?.src || null,
              href: href.startsWith("http") ? href : window.location.origin + href,
            });
          }
          return results;
        });

        await page.close();
        if (cards.length === 0) break;

        let newCount = 0;
        for (const card of cards) {
          const key = card.href;
          if (!allProducts.has(key)) {
            allProducts.set(key, {
              id: `hancock-moore_${slugify(card.name)}${card.sku ? "-" + slugify(card.sku) : ""}`,
              product_name: card.name,
              vendor_id: "hancock-moore",
              vendor_name: "Hancock & Moore",
              vendor_domain: "hancockandmoore.com",
              vendor_tier: 3,
              category: cat.category,
              sku: card.sku,
              image_url: card.image || null,
              images: card.image ? [card.image] : [],
              product_url: card.href || null,
              ingestion_source: "missing-vendors-import",
            });
            newCount++;
          }
        }

        console.log(`[hancock-moore] ${cat.category} page ${pageNum}: ${cards.length} cards (${newCount} new), ${allProducts.size} total`);
        if (newCount === 0) break; // All dupes = we've looped
        pageNum++;
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        console.error(`[hancock-moore] ${cat.category} page ${pageNum} error: ${err.message}`);
        await page.close().catch(() => {});
        break;
      }
    }
  }

  console.log(`[hancock-moore] Total unique: ${allProducts.size}`);
  return [...allProducts.values()];
}

// ══════════════════════════════════════════════════════════════
// HICKORY CHAIR — a[href^="/Products/ProductDetails/"], single page per category
// Format: <a href="/Products/ProductDetails/HC5311-00"><img...> SKU\nName</a>
// ══════════════════════════════════════════════════════════════

const HICKORY_CHAIR_CATEGORIES = [
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=79&SearchName=Sofas+%26+Loveseats", category: "sofa" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=48&SearchName=Settees+%26+Banquettes", category: "settee" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=14&SearchName=Sectionals", category: "sectional" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=81&SearchName=Chairs+%26+Chaises", category: "chair" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=76&SearchName=Ottomans+%26+Benches", category: "ottoman" },
  { url: "https://www.hickorychair.com/Products/ShowResults?SubTypeID=42&SearchName=Cocktail+Tables", category: "cocktail-table" },
  { url: "https://www.hickorychair.com/Products/ShowResults?SubTypeID=78&SearchName=Side+Tables", category: "side-table" },
  { url: "https://www.hickorychair.com/Products/ShowResults?SubTypeID=942,79&SearchName=Center+Tables+%26+Game+tables", category: "table" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=34,72&SearchName=Desks+%26+Consoles", category: "desk" },
  { url: "https://www.hickorychair.com/Products/ShowResults?SubTypeID=92,57&SearchName=Bookcases+%26+Display+Cabinets", category: "bookcase" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=70&SearchName=Bar+%26+Bar+Carts", category: "bar-cart" },
  { url: "https://www.hickorychair.com/Products/ShowResults?SubTypeID=17,1507,130&SearchName=Mirrors%2c+Trays+%26+Accents", category: "accent" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=132&SearchName=Lighting", category: "lighting" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=74&SearchName=Dining+Tables", category: "dining-table" },
  { url: "https://www.hickorychair.com/Products/ShowResults?SubTypeID=942&SearchName=Center+Tables", category: "table" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=73&SearchName=Dining+Chairs", category: "dining-chair" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=61&SearchName=Bar+%26+Counter+Stools", category: "bar-stool" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=32&SearchName=Chests", category: "chest" },
  { url: "https://www.hickorychair.com/Products/ShowResults?SubTypeID=61&SearchName=Consoles+%26+Credenzas", category: "console" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=25&SearchName=Beds", category: "bed" },
  { url: "https://www.hickorychair.com/Products/ShowResults?TypeID=29&SearchName=Dressers", category: "dresser" },
  { url: "https://www.hickorychair.com/Products/ShowResults?SubTypeID=82&SearchName=Nightstand+%26+Bedside+Tables", category: "nightstand" },
  { url: "https://www.hickorychair.com/products/showresults?CollectionID=G3&SearchName=Hable+Outdoor+", category: "outdoor" },
];

async function crawlHickoryChair() {
  const allProducts = new Map();

  for (const cat of HICKORY_CHAIR_CATEGORIES) {
    if (shouldStop) break;
    console.log(`[hickory-chair] Crawling ${cat.category}: ${cat.url}`);

    const page = await newPage();
    try {
      await page.goto(cat.url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector('a[href*="/Products/ProductDetails/"]', { timeout: 10000 }).catch(() => {});
      await autoScroll(page);
      await new Promise(r => setTimeout(r, 2000));

      const cards = await page.evaluate(() => {
        const results = [];
        const links = document.querySelectorAll('a[href*="/Products/ProductDetails/"]');
        for (const link of links) {
          const href = link.href || "";
          if (!href) continue;
          const img = link.querySelector("img");
          const text = link.textContent || "";
          const lines = text.split(/\n/).map(s => s.trim()).filter(Boolean);
          const sku = lines[0] || null;
          const name = lines.length > 1 ? lines.slice(1).join(" ").trim() : null;
          if (!name || name.length < 2) continue;
          results.push({
            name,
            sku,
            image: img?.src || null,
            href: href.startsWith("http") ? href : window.location.origin + href,
          });
        }
        return results;
      });

      console.log(`[hickory-chair] ${cat.category}: ${cards.length} products found`);

      for (const card of cards) {
        const key = card.href;
        if (!allProducts.has(key)) {
          allProducts.set(key, {
            id: `hickory-chair_${slugify(card.name)}${card.sku ? "-" + slugify(card.sku) : ""}`,
            product_name: card.name,
            vendor_id: "hickory-chair",
            vendor_name: "Hickory Chair",
            vendor_domain: "hickorychair.com",
            vendor_tier: 1,
            category: cat.category,
            sku: card.sku,
            image_url: card.image || null,
            images: card.image ? [card.image] : [],
            product_url: card.href || null,
            ingestion_source: "missing-vendors-import",
          });
        }
      }

      await page.close();
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[hickory-chair] ${cat.category} error: ${err.message}`);
      await page.close().catch(() => {});
    }
  }

  console.log(`[hickory-chair] Total unique: ${allProducts.size}`);
  return [...allProducts.values()];
}

// ══════════════════════════════════════════════════════════════
// HIGHLAND HOUSE — ASP.NET, div.product-wrapper, span.sku, single page
// a[href*="ShowItemDetail.aspx?SKU="]
// ══════════════════════════════════════════════════════════════

const HIGHLAND_HOUSE_CATEGORIES = [
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=81", category: "chair" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=32", category: "chest" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=72", category: "desk" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=34", category: "console" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=83", category: "etagere" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=76", category: "ottoman" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?Search=sectionals", category: "sectional" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=48", category: "settee" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=55", category: "sleeper" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=79", category: "sofa" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=82", category: "table" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=70", category: "bar" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=61", category: "bar-stool" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=73", category: "dining-chair" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=74", category: "dining-table" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=84", category: "accent" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=25", category: "bed" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=29", category: "dresser" },
  { url: "https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?SubTypeID=82", category: "nightstand" },
];

async function crawlHighlandHouse() {
  const allProducts = new Map();

  for (const cat of HIGHLAND_HOUSE_CATEGORIES) {
    if (shouldStop) break;
    console.log(`[highland-house] Crawling ${cat.category}: ${cat.url}`);

    const page = await newPage();
    try {
      await page.goto(cat.url, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector('a[href*="ShowItemDetail"]', { timeout: 10000 }).catch(() => {});
      await autoScroll(page);
      await new Promise(r => setTimeout(r, 2000));

      const cards = await page.evaluate(() => {
        const results = [];
        const links = document.querySelectorAll('a[href*="ShowItemDetail.aspx?SKU="]');
        for (const link of links) {
          const href = link.href || "";
          if (!href) continue;
          const img = link.querySelector("img");
          const skuEl = link.querySelector("span.sku");
          const sku = skuEl?.textContent?.trim() || null;

          // Name is in a div inside .product-wrapper, or img alt
          const wrapper = link.querySelector("div.product-wrapper") || link;
          const nameDiv = wrapper.querySelector("div");
          let name = nameDiv?.textContent?.trim() || img?.alt || "";
          // Remove SKU from name if present
          if (sku && name.startsWith(sku)) name = name.slice(sku.length).trim();

          if (!name || name.length < 2) continue;

          results.push({
            name,
            sku,
            image: img?.src || null,
            href: href.startsWith("http") ? href : window.location.origin + href,
          });
        }
        return results;
      });

      console.log(`[highland-house] ${cat.category}: ${cards.length} products found`);

      for (const card of cards) {
        const key = card.href;
        if (!allProducts.has(key)) {
          allProducts.set(key, {
            id: `highland-house_${slugify(card.name)}${card.sku ? "-" + slugify(card.sku) : ""}`,
            product_name: card.name,
            vendor_id: "highland-house",
            vendor_name: "Highland House",
            vendor_domain: "highlandhousefurniture.com",
            vendor_tier: 3,
            category: cat.category,
            sku: card.sku,
            image_url: card.image || null,
            images: card.image ? [card.image] : [],
            product_url: card.href || null,
            ingestion_source: "missing-vendors-import",
          });
        }
      }

      await page.close();
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`[highland-house] ${cat.category} error: ${err.message}`);
      await page.close().catch(() => {});
    }
  }

  console.log(`[highland-house] Total unique: ${allProducts.size}`);
  return [...allProducts.values()];
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight || totalHeight > 100000) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 200);
    });
  });
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════

const VENDOR_CRAWLERS = [
  { id: "vanguard", name: "Vanguard Furniture", crawl: crawlVanguard },
  { id: "wesley-hall", name: "Wesley Hall", crawl: crawlWesleyHall },
  { id: "hancock-moore", name: "Hancock & Moore", crawl: crawlHancockMoore },
  { id: "hickory-chair", name: "Hickory Chair", crawl: crawlHickoryChair },
  { id: "highland-house", name: "Highland House", crawl: crawlHighlandHouse },
];

export async function importMissingVendors(catalogDB, options = {}) {
  if (running) return { error: "Already running" };

  running = true;
  shouldStop = false;
  stats = {
    running: true,
    started_at: new Date().toISOString(),
    finished_at: null,
    current_vendor: null,
    vendors_completed: 0,
    vendors_total: VENDOR_CRAWLERS.length,
    vendor_results: [],
  };

  try {
    for (const vendor of VENDOR_CRAWLERS) {
      if (shouldStop) break;
      stats.current_vendor = vendor.id;
      console.log(`\n[missing-vendors] ═══ Starting ${vendor.name} ═══`);

      try {
        const products = await vendor.crawl();
        console.log(`[missing-vendors] ${vendor.name}: found ${products.length} unique products`);

        let inserted = 0;
        if (products.length > 0 && catalogDB) {
          const result = catalogDB.insertProducts(products);
          inserted = (result.inserted || 0) + (result.updated || 0);
          console.log(`[missing-vendors] ${vendor.name}: inserted/updated ${inserted}`);
        }

        stats.vendor_results.push({
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          products_found: products.length,
          products_inserted: inserted,
        });
      } catch (err) {
        console.error(`[missing-vendors] ${vendor.name} error:`, err.message);
        stats.vendor_results.push({
          vendor_id: vendor.id,
          vendor_name: vendor.name,
          products_found: 0,
          products_inserted: 0,
          error: err.message,
        });
      }

      stats.vendors_completed++;
      // Close browser between vendors to free memory
      await closeBrowser();
    }

    stats.finished_at = new Date().toISOString();
    stats.current_vendor = null;

    console.log(`\n[missing-vendors] ═══ COMPLETE ═══`);
    for (const vr of stats.vendor_results) {
      console.log(`[missing-vendors]   ${vr.vendor_name}: ${vr.products_found} found, ${vr.products_inserted} inserted${vr.error ? ' ERROR: ' + vr.error : ''}`);
    }

    return stats;
  } catch (err) {
    console.error("[missing-vendors] Fatal error:", err);
    stats.finished_at = new Date().toISOString();
    await closeBrowser();
    return stats;
  } finally {
    running = false;
  }
}
