/**
 * Deep Product Enrichment Job
 *
 * Re-visits every product page for target vendors and extracts comprehensive data:
 *   - ALL product images (ranked by quality)
 *   - Pricing (MSRP, sale, COM)
 *   - Dimensions (overall + seating-specific)
 *   - Materials & construction details
 *   - Upholstery options
 *   - Availability & lead times
 *   - Features (swivel, recliner, modular, etc.)
 *   - Categories & tags
 *
 * Uses Puppeteer for JS-rendered vendor sites.
 * Updates existing product records via updateProductDirect.
 */

import https from "node:https";
import http from "node:http";

// ── State ────────────────────────────────────────────────────

let running = false;
let shouldStop = false;
let stats = {
  running: false,
  started_at: null,
  finished_at: null,
  current_vendor: null,
  vendors_completed: 0,
  vendors_total: 0,
  total_products: 0,
  total_enriched: 0,
  total_better_images: 0,
  total_failed: 0,
  total_404: 0,
  total_discontinued: [],
  vendor_results: [],
};

// Vendors that need Puppeteer (JS-rendered pages)
const PUPPETEER_VENDORS = new Set([
  "bernhardt",
  "century",
  "hickory-chair",
  "highland-house",
  "baker",
  "hancock-moore",
]);

// ── Fetch helpers ────────────────────────────────────────────

function fetchPage(url, timeout = 15000) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) return resolve({ html: null, status: 0 });

    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      timeout,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        let loc = res.headers.location;
        if (loc.startsWith("/")) {
          try { loc = new URL(loc, url).href; } catch { /* skip */ }
        }
        return fetchPage(loc, timeout).then(resolve);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ html: null, status: res.statusCode });
      }

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 500000) res.destroy();
      });
      res.on("end", () => resolve({ html: body, status: 200 }));
      res.on("error", () => resolve({ html: null, status: 0 }));
    });

    req.on("error", () => resolve({ html: null, status: 0 }));
    req.on("timeout", () => { req.destroy(); resolve({ html: null, status: 0 }); });
  });
}

let puppeteerBrowser = null;

async function fetchWithPuppeteer(url, timeout = 20000) {
  try {
    if (!puppeteerBrowser) {
      const puppeteer = await import("puppeteer");
      puppeteerBrowser = await puppeteer.default.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      });
    }

    const page = await puppeteerBrowser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
    await page.setViewport({ width: 1440, height: 900 });

    try {
      const response = await page.goto(url, { waitUntil: "networkidle2", timeout });
      const status = response?.status() || 0;
      if (status !== 200) {
        await page.close();
        return { html: null, status };
      }
      // Wait for images to load
      await page.waitForSelector("img", { timeout: 5000 }).catch(() => {});
      const html = await page.content();
      await page.close();
      return { html, status: 200 };
    } catch (err) {
      await page.close().catch(() => {});
      return { html: null, status: 0 };
    }
  } catch (err) {
    console.error("[deep-enrichment] Puppeteer error:", err.message);
    return { html: null, status: 0 };
  }
}

async function closePuppeteer() {
  if (puppeteerBrowser) {
    await puppeteerBrowser.close().catch(() => {});
    puppeteerBrowser = null;
  }
}

// ── HTML parsing helpers ─────────────────────────────────────

function cleanText(text) {
  return (text || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractJsonLd(html) {
  const matches = html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of matches) {
    try {
      const data = JSON.parse(match[1]);
      if (data["@type"] === "Product") return data;
      if (Array.isArray(data["@graph"])) {
        const product = data["@graph"].find((item) => item["@type"] === "Product");
        if (product) return product;
      }
    } catch { /* skip */ }
  }
  return null;
}

function resolveUrl(src, baseUrl) {
  if (!src) return null;
  src = src.trim();
  if (src.startsWith("data:")) return null;
  if (src.startsWith("//")) return "https:" + src;
  if (src.startsWith("http")) return src;
  if (src.startsWith("/")) {
    try {
      const u = new URL(baseUrl);
      return `${u.protocol}//${u.host}${src}`;
    } catch { return null; }
  }
  return null;
}

function parsePrice(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 || num > 500000 ? null : num;
}

// ── Image extraction & ranking ───────────────────────────────

const IMAGE_REJECT_PATTERNS = /(?:icon|logo|social|favicon|pixel|tracking|badge|sprite|swatch|thumbnail-nav|arrow|close|zoom|cart|search-icon|play-btn|loading|spinner|placeholder|1x1|blank\.gif|spacer)/i;
const IMAGE_PRODUCT_PATTERNS = /(?:product|furniture|catalog|collection|item|image|photo|media|uploads|cdn|assets|files|gallery)/i;
const IMAGE_LIFESTYLE_PATTERNS = /(?:lifestyle|room|scene|setting|styled|editorial|lookbook|inspiration|vignette|roomscene)/i;

function scoreImage(src) {
  if (!src) return -1;
  const lower = src.toLowerCase();

  // Reject patterns
  if (IMAGE_REJECT_PATTERNS.test(lower)) return -1;
  if (/\.svg$/i.test(lower)) return -1;
  if (/[?&]w=\d{1,2}[&$]|[?&]width=\d{1,2}[&$]/i.test(lower)) return -1; // tiny thumbnails

  let score = 50;

  // Boost: product/silo shots
  if (/(?:silo|white|studio|packshot|cutout|front|main|hero|primary|featured)/i.test(lower)) score += 30;
  if (/_(?:01|1|main|primary|hero)\./i.test(lower)) score += 20;
  if (IMAGE_PRODUCT_PATTERNS.test(lower)) score += 10;

  // Moderate: alternate angles
  if (/(?:alt|angle|side|back|detail|close|_0[2-9]|_[2-9]\.)/i.test(lower)) score += 5;

  // Lower: lifestyle/room scenes
  if (IMAGE_LIFESTYLE_PATTERNS.test(lower)) score -= 10;

  // Boost larger image URLs (Shopify CDN patterns)
  if (/\d{3,4}x\d{3,4}/i.test(lower)) score += 5;
  if (/(?:grande|large|1024|2048|master)/i.test(lower)) score += 5;

  return score;
}

function extractAllImages(html, baseUrl) {
  const images = new Map(); // src -> score

  // 1. JSON-LD images
  const ld = extractJsonLd(html);
  if (ld?.image) {
    const ldImages = Array.isArray(ld.image) ? ld.image : [ld.image];
    for (const img of ldImages) {
      const src = resolveUrl(typeof img === "object" ? img.url || img.contentUrl : img, baseUrl);
      if (src && scoreImage(src) >= 0) {
        images.set(src, (images.get(src) || 0) + scoreImage(src) + 20); // LD bonus
      }
    }
  }

  // 2. og:image tags
  const ogPattern = /<meta[^>]+(?:property|name)=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/gi;
  let ogMatch;
  while ((ogMatch = ogPattern.exec(html)) !== null) {
    const src = resolveUrl(ogMatch[1], baseUrl);
    if (src && scoreImage(src) >= 0) {
      images.set(src, (images.get(src) || 0) + scoreImage(src) + 15);
    }
  }
  // Reverse order og:image
  const ogPattern2 = /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::url)?["']/gi;
  while ((ogMatch = ogPattern2.exec(html)) !== null) {
    const src = resolveUrl(ogMatch[1], baseUrl);
    if (src && scoreImage(src) >= 0) {
      images.set(src, (images.get(src) || 0) + scoreImage(src) + 15);
    }
  }

  // 3. All img tags
  const imgPattern = /<img[^>]+(?:src|data-src|data-zoom-image|data-large|data-original)=["']([^"']+)["'][^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    const src = resolveUrl(imgMatch[1], baseUrl);
    if (src && scoreImage(src) >= 0) {
      images.set(src, Math.max(images.get(src) || 0, scoreImage(src)));
    }
  }

  // 4. srcset images (grab the largest)
  const srcsetPattern = /srcset=["']([^"']+)["']/gi;
  while ((imgMatch = srcsetPattern.exec(html)) !== null) {
    const parts = imgMatch[1].split(",").map(s => s.trim());
    for (const part of parts) {
      const [url] = part.split(/\s+/);
      const src = resolveUrl(url, baseUrl);
      if (src && scoreImage(src) >= 0) {
        images.set(src, Math.max(images.get(src) || 0, scoreImage(src)));
      }
    }
  }

  // 5. Background images in style attributes
  const bgPattern = /style=["'][^"']*background(?:-image)?:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((imgMatch = bgPattern.exec(html)) !== null) {
    const src = resolveUrl(imgMatch[1], baseUrl);
    if (src && scoreImage(src) >= 0) {
      images.set(src, Math.max(images.get(src) || 0, scoreImage(src) - 5));
    }
  }

  // Sort by score descending
  const sorted = [...images.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([src]) => src)
    .slice(0, 20);

  return sorted;
}

// ── Strip script/style tags for text extraction ─────────────

function stripScriptsAndStyles(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

// ── Deep data extraction ─────────────────────────────────────

function extractDeepData(html, baseUrl, existingProduct) {
  const data = {};
  const ld = extractJsonLd(html);
  // Clean HTML for text-based regex extraction (strip JS/CSS)
  const cleanHtml = stripScriptsAndStyles(html);

  // ═══════ IMAGES ═══════
  const allImages = extractAllImages(html, baseUrl);
  if (allImages.length > 0) {
    data.images = allImages;
    data.image_url = allImages[0];

    // Check if primary is a lifestyle shot
    if (allImages.length === 1 && IMAGE_LIFESTYLE_PATTERNS.test(allImages[0].toLowerCase())) {
      data.lifestyle_image = true;
    }
  } else {
    data.no_image = true;
  }

  // ═══════ BASIC INFO ═══════
  // Product name
  if (ld?.name) data.product_name = cleanText(ld.name);
  if (!data.product_name) {
    const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    if (ogTitle) data.product_name = cleanText(ogTitle[1]);
  }

  // SKU
  if (ld?.sku) data.sku = ld.sku;
  if (ld?.mpn) data.sku = data.sku || ld.mpn;
  if (!data.sku) {
    const skuMatch = html.match(/(?:sku|model|item\s*(?:#|number|no)|style\s*(?:#|number))[\s:]*["']?([A-Z0-9][-A-Z0-9_.]{2,30})/i);
    if (skuMatch) data.sku = skuMatch[1].trim();
  }

  // Collection
  if (ld?.brand) {
    data.collection = typeof ld.brand === "object" ? ld.brand.name : ld.brand;
  }
  if (!data.collection) {
    const collMatch = cleanHtml.match(/(?:collection|series)[\s:]+["']?([A-Z][a-zA-Z ]{2,40})["']?/);
    if (collMatch) {
      const val = cleanText(collMatch[1]).slice(0, 60);
      if (!/(?:filter|sort|view|page|click|select)/i.test(val)) {
        data.collection = val;
      }
    }
  }

  // Description
  if (ld?.description) {
    data.description = cleanText(ld.description).slice(0, 500);
  }
  if (!data.description) {
    const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
    if (ogDesc) data.description = cleanText(ogDesc[1]).slice(0, 500);
  }
  if (!data.description) {
    const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    if (metaDesc) data.description = cleanText(metaDesc[1]).slice(0, 500);
  }

  // ═══════ PRICING ═══════
  if (ld?.offers) {
    const offers = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
    const price = parsePrice(offers.price || offers.highPrice || offers.lowPrice);
    if (price) {
      data.retail_price = price;
      data.price_source = "vendor-website";
    }
    if (offers.salePrice) data.sale_price = parsePrice(offers.salePrice);
    if (offers.lowPrice && offers.highPrice) {
      data.price_range_low = parsePrice(offers.lowPrice);
      data.price_range_high = parsePrice(offers.highPrice);
    }
  }
  if (!data.retail_price) {
    const pricePatterns = [
      /(?:msrp|list\s*price|retail|price)[\s:]*\$?([\d,]+(?:\.\d{2})?)/i,
      /class=["'][^"']*price[^"']*["'][^>]*>\s*\$?([\d,]+(?:\.\d{2})?)/i,
      /itemprop=["']price["'][^>]*content=["']([\d,.]+)["']/i,
      /data-price=["']([\d,.]+)["']/i,
    ];
    for (const pp of pricePatterns) {
      const pm = cleanHtml.match(pp);
      if (pm) {
        const p = parsePrice(pm[1]);
        if (p) { data.retail_price = p; data.price_source = "vendor-website"; break; }
      }
    }
  }

  // Starting price / COM price
  const startingMatch = cleanHtml.match(/(?:starting\s+(?:at|from|price)|from)\s*\$?([\d,]+(?:\.\d{2})?)/i);
  if (startingMatch) data.starting_price = parsePrice(startingMatch[1]);

  const comMatch = cleanHtml.match(/(?:com\s+(?:price|pricing|retail)|customer'?s?\s+own\s+material)[\s:]*\$?([\d,]+(?:\.\d{2})?)/i);
  if (comMatch) data.com_price = parsePrice(comMatch[1]);

  // Price tier inference
  if (data.retail_price) {
    if (data.retail_price < 500) data.price_tier = "budget";
    else if (data.retail_price < 2000) data.price_tier = "mid";
    else if (data.retail_price < 6000) data.price_tier = "premium";
    else data.price_tier = "luxury";
  }

  // ═══════ DIMENSIONS ═══════
  // Overall WxDxH
  const dimWDH = cleanHtml.match(/(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Ww](?:ide|idth)?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Dd](?:eep|epth)?\s*[x×X]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Hh]/);
  if (dimWDH) {
    data.width = parseFloat(dimWDH[1]);
    data.depth = parseFloat(dimWDH[2]);
    data.height = parseFloat(dimWDH[3]);
    data.dimensions = `${data.width}"W x ${data.depth}"D x ${data.height}"H`;
  }

  if (!data.dimensions) {
    const dimPatterns = [
      // Strict: labeled dimensions with numbers
      /(?:overall\s+)?dimensions?[\s:]+(\d{1,3}(?:\.\d+)?[^<\n]{3,60})/i,
      /(?:width|w)[\s:]+(\d{1,3}(?:\.\d+)?)[""]?\s*[,;]?\s*(?:depth|d)[\s:]+(\d{1,3}(?:\.\d+)?)[""]?\s*[,;]?\s*(?:height|h)[\s:]+(\d{1,3}(?:\.\d+)?)/i,
    ];
    for (const p of dimPatterns) {
      const m = cleanHtml.match(p);
      if (m) {
        if (m[3]) {
          data.width = parseFloat(m[1]);
          data.depth = parseFloat(m[2]);
          data.height = parseFloat(m[3]);
          data.dimensions = `${data.width}"W x ${data.depth}"D x ${data.height}"H`;
        } else if (m[1] && /\d/.test(m[1])) {
          const val = cleanText(m[1]).slice(0, 100);
          // Only set if it contains actual measurement numbers
          if (/\d{2,}/.test(val) && !/(?:description|filter|fold|sleeper|choice|smart)/i.test(val)) {
            data.dimensions = val;
          }
        }
        break;
      }
    }
  }

  // Seating-specific dimensions
  const seatH = cleanHtml.match(/seat\s+height[\s:]+(\d{1,2}(?:\.\d+)?)/i);
  if (seatH) data.seat_height = parseFloat(seatH[1]);

  const seatD = cleanHtml.match(/seat\s+depth[\s:]+(\d{1,2}(?:\.\d+)?)/i);
  if (seatD) data.seat_depth = parseFloat(seatD[1]);

  const armH = cleanHtml.match(/arm\s+height[\s:]+(\d{1,2}(?:\.\d+)?)/i);
  if (armH) data.arm_height = parseFloat(armH[1]);

  // Table dimensions
  const diameter = cleanHtml.match(/(?:diameter|dia)[\s:.]+(\d{1,3}(?:\.\d+)?)/i);
  if (diameter) data.table_diameter = parseFloat(diameter[1]);

  // Bed size
  const bedSize = cleanHtml.match(/(?:king|queen|cal(?:ifornia)?\s*king|full|twin|eastern\s*king)/i);
  if (bedSize) data.bed_size = bedSize[0].toLowerCase();

  // Weight
  const weight = cleanHtml.match(/(?:weight|wt)[\s:.]+(\d{1,4}(?:\.\d+)?)\s*(?:lbs?|pounds?)/i);
  if (weight) data.weight_lbs = parseFloat(weight[1]);

  // ═══════ MATERIALS & CONSTRUCTION ═══════
  // Frame
  const frameMatch = cleanHtml.match(/(?:frame(?:\s+material)?|construction)[\s:]+([^<\n]{3,80})/i);
  if (frameMatch) data.frame_material = cleanText(frameMatch[1]).slice(0, 100);

  // Fill
  const fillMatch = cleanHtml.match(/(?:fill|cushion\s+(?:fill|type)|seat\s+cushion)[\s:]+([^<\n]{3,80})/i);
  if (fillMatch) data.fill_type = cleanText(fillMatch[1]).slice(0, 100);

  // Spring system
  const springMatch = cleanHtml.match(/(?:eight[- ]way\s+hand[- ]tied|sinuous\s+(?:spring|wire)|coil\s+spring|no[- ]sag\s+spring|webbed|marshall\s+coil)/i);
  if (springMatch) data.spring_system = cleanText(springMatch[0]);

  // Leg material/finish
  const legMatch = cleanHtml.match(/(?:leg|base|foot)(?:\s+(?:material|finish))?[\s:]+([^<\n]{3,60})/i);
  if (legMatch) data.leg_finish = cleanText(legMatch[1]).slice(0, 80);

  // Top material (tables)
  const topMatch = cleanHtml.match(/(?:top\s+material|tabletop|surface)[\s:]+([^<\n]{3,60})/i);
  if (topMatch) data.top_material = cleanText(topMatch[1]).slice(0, 80);

  // Wood species
  const woodMatch = cleanHtml.match(/(?:wood|species)[\s:]+([^<\n]{3,60})/i);
  if (woodMatch) data.wood_species = cleanText(woodMatch[1]).slice(0, 80);

  // Metal type/finish
  const metalMatch = cleanHtml.match(/(?:metal|iron|brass|steel|bronze)\s+(?:finish|type)?[\s:]*([^<\n]{3,60})/i);
  if (metalMatch) data.metal_finish = cleanText(metalMatch[0]).slice(0, 80);

  // General material (if not already set)
  if (ld?.material) {
    data.material = typeof ld.material === "string" ? ld.material : null;
  }
  if (!data.material) {
    // Only match material in structured contexts (label: value pattern near product content)
    const matPatterns = [
      /(?:material|primary\s+fabric|upholstery\s+material)[\s:]+["']?([A-Z][^<\n"']{2,60})/i,
      /(?:made\s+(?:of|from|with))\s+([a-z][^<\n.]{3,50})/i,
    ];
    for (const p of matPatterns) {
      const m = cleanHtml.match(p);
      if (m) {
        const val = cleanText(m[1]).slice(0, 100);
        // Reject if it looks like navigation/filter text
        if (!/(?:description|filter|sort|category|page|click|select|view)/i.test(val)) {
          data.material = val;
          break;
        }
      }
    }
  }

  // ═══════ UPHOLSTERY ═══════
  const comAvail = /(?:com|customer'?s?\s+own\s+material)/i.test(cleanHtml);
  const colAvail = /(?:col|customer'?s?\s+own\s+leather)/i.test(cleanHtml);
  data.com_available = comAvail || null;
  data.col_available = colAvail || null;

  const perfFabric = /(?:performance\s+fabric|stain[- ]resistant|crypton|sunbrella|indoor.outdoor\s+fabric)/i.test(cleanHtml);
  data.performance_fabric_available = perfFabric || null;

  // Count fabric/leather options
  const fabricCount = cleanHtml.match(/(\d+)\s*(?:fabric|leather|upholstery)\s*(?:option|choice|grade)/i);
  if (fabricCount) data.fabric_options_count = parseInt(fabricCount[1]);

  // Standard finish options
  const finishCount = cleanHtml.match(/(\d+)\s*(?:finish|stain)\s*(?:option|choice)/i);
  if (finishCount) data.finish_options_count = parseInt(finishCount[1]);

  // ═══════ AVAILABILITY ═══════
  if (ld?.offers) {
    const offers = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
    if (offers.availability) {
      const avail = offers.availability.toLowerCase();
      data.in_stock = avail.includes("instock") || avail.includes("in_stock");
      data.discontinued = avail.includes("discontinued");
    }
  }

  const quickShip = /(?:quick\s*ship|express\s*ship|fast\s*ship|ready\s+to\s+ship|ships?\s+(?:in\s+)?(?:\d+\s*[-–]\s*\d+\s*(?:day|business)))/i.test(cleanHtml);
  data.quick_ship = quickShip || null;

  const leadMatch = cleanHtml.match(/(?:lead\s+time|ships?\s+in|delivery\s+(?:in|within)|estimated\s+delivery)[\s:]+(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(week|day)/i);
  if (leadMatch) {
    data.lead_time = `${leadMatch[1]}-${leadMatch[2]} ${leadMatch[3]}s`;
  }

  const mto = /(?:made\s+to\s+order|custom\s+(?:made|built|order)|build\s+to\s+order)/i.test(cleanHtml);
  data.made_to_order = mto || null;

  const disc = /(?:discontinued|no\s+longer\s+available|retired|archived)/i.test(cleanHtml);
  if (disc) data.discontinued = true;

  // ═══════ FEATURES ═══════
  // Only detect features from the product description/details area, not from navigation
  // Use the product name + description as the feature detection source
  const featureText = [
    existingProduct.product_name || "",
    data.description || existingProduct.description || "",
    data.fill_type || "",
    data.frame_material || "",
  ].join(" ");
  data.features = {};
  if (/\bswivel\b/i.test(featureText)) data.features.swivel = true;
  if (/\brecliner|reclining\b/i.test(featureText)) data.features.reclining = true;
  if (/\bmotion\b/i.test(featureText)) data.features.motion = true;
  if (/\bpower\s+(?:reclin|motion|headrest)/i.test(featureText)) data.features.power = true;
  if (/\bslipcover/i.test(featureText)) data.features.slipcovered = true;
  if (/\bmodular|configurable\b/i.test(featureText)) data.features.modular = true;
  if (/\b(?:indoor.outdoor|outdoor\s+rated|all[- ]weather)\b/i.test(featureText)) data.features.outdoor_rated = true;
  if (/\bnailhead/i.test(featureText)) data.features.nailhead_trim = true;
  if (/\bskirt(?:ed)?\b/i.test(featureText)) data.features.skirt_option = true;
  if (Object.keys(data.features).length === 0) delete data.features;

  // ═══════ CATEGORIES & TAGS ═══════
  // Style
  const styleKeywords = ["modern", "contemporary", "transitional", "coastal", "traditional", "mid-century", "minimalist", "industrial", "rustic", "farmhouse", "glam", "art deco", "bohemian", "scandinavian"];
  const foundStyles = styleKeywords.filter(s => new RegExp(`\\b${s}\\b`, "i").test(cleanHtml));
  if (foundStyles.length > 0) data.style = foundStyles[0];
  if (foundStyles.length > 1) data.style_tags = foundStyles;

  // Room type
  const roomTypes = [];
  if (/\bliving\s+room\b/i.test(cleanHtml)) roomTypes.push("living");
  if (/\bdining\s+room\b/i.test(cleanHtml)) roomTypes.push("dining");
  if (/\bbedroom\b/i.test(cleanHtml)) roomTypes.push("bedroom");
  if (/\boffice|home\s+office\b/i.test(cleanHtml)) roomTypes.push("office");
  if (/\boutdoor|patio|garden\b/i.test(cleanHtml)) roomTypes.push("outdoor");
  if (/\bentry|foyer|hallway\b/i.test(cleanHtml)) roomTypes.push("entry");
  if (roomTypes.length > 0) data.room_types = roomTypes;

  // Color
  if (ld?.color) data.color = typeof ld.color === "string" ? ld.color : null;

  return data;
}

// ── Main job ─────────────────────────────────────────────────

const TARGET_VENDORS = [
  // bernhardt handled by dedicated importer
  "hooker", "century", "universal", "vanguard",
  "cr-laine", "lee-industries", "sherrill", "wesley-hall",
  "hancock-moore", "hickory-chair", "highland-house",
  "lexington", "theodore-alexander", "baker", "caracole", "stickley",
  "rowe",
];

export async function runDeepEnrichment(catalogDB, options = {}) {
  if (running) {
    console.log("[deep-enrichment] Already running");
    return stats;
  }

  const {
    batchSize = 5,
    delayMs = 800,
    vendorFilter = null,
  } = options;

  running = true;
  shouldStop = false;

  const vendors = vendorFilter ? [vendorFilter] : TARGET_VENDORS;

  stats = {
    running: true,
    started_at: new Date().toISOString(),
    finished_at: null,
    current_vendor: null,
    vendors_completed: 0,
    vendors_total: vendors.length,
    total_products: 0,
    total_enriched: 0,
    total_better_images: 0,
    total_failed: 0,
    total_404: 0,
    total_discontinued: [],
    vendor_results: [],
  };

  console.log(`[deep-enrichment] Starting deep enrichment for ${vendors.length} vendors`);

  for (const vendorId of vendors) {
    if (shouldStop) break;

    stats.current_vendor = vendorId;
    const usePuppeteer = PUPPETEER_VENDORS.has(vendorId);

    // Get ALL products for this vendor (no limit)
    const products = catalogDB.getProductsByVendor(vendorId, 50000);
    const withUrls = products.filter(p => p.product_url);

    const vendorResult = {
      vendor_id: vendorId,
      total_products: products.length,
      with_urls: withUrls.length,
      enriched: 0,
      better_images: 0,
      failed: 0,
      not_found_404: 0,
      discontinued: 0,
      method: usePuppeteer ? "puppeteer" : "http",
      started_at: new Date().toISOString(),
    };

    console.log(`[deep-enrichment] ${vendorId}: ${withUrls.length} products with URLs (${usePuppeteer ? "Puppeteer" : "HTTP"})`);

    // Process in batches
    for (let i = 0; i < withUrls.length; i += batchSize) {
      if (shouldStop) break;

      const batch = withUrls.slice(i, i + batchSize);
      await Promise.all(batch.map(async (product) => {
        try {
          const { html, status } = usePuppeteer
            ? await fetchWithPuppeteer(product.product_url)
            : await fetchPage(product.product_url);

          if (status === 404 || status === 410) {
            vendorResult.not_found_404++;
            stats.total_404++;
            catalogDB.updateProductDirect(product.id, { page_status: status, last_crawled_at: new Date().toISOString() });
            return;
          }

          if (!html) {
            vendorResult.failed++;
            stats.total_failed++;
            return;
          }

          const enriched = extractDeepData(html, product.product_url, product);

          // Count improvements
          const hadImages = (product.images?.length || 0);
          const newImages = (enriched.images?.length || 0);
          if (newImages > hadImages) vendorResult.better_images++;

          if (enriched.discontinued) {
            vendorResult.discontinued++;
            stats.total_discontinued.push({ id: product.id, name: product.product_name, vendor: vendorId });
          }

          // Build update — only set fields that have values
          const update = { last_crawled_at: new Date().toISOString(), page_status: 200 };
          for (const [key, val] of Object.entries(enriched)) {
            if (val !== null && val !== undefined && val !== "") {
              update[key] = val;
            }
          }

          catalogDB.updateProductDirect(product.id, update);
          vendorResult.enriched++;
          stats.total_enriched++;

        } catch (err) {
          vendorResult.failed++;
          stats.total_failed++;
        }
      }));

      stats.total_products = withUrls.length;

      // Progress log every 50 products
      const processed = Math.min(i + batchSize, withUrls.length);
      if (processed % 50 < batchSize || processed === withUrls.length) {
        console.log(`[deep-enrichment] ${vendorId}: ${processed}/${withUrls.length} (enriched=${vendorResult.enriched}, better_images=${vendorResult.better_images}, 404s=${vendorResult.not_found_404})`);
      }

      // Rate limit delay
      if (delayMs > 0 && i + batchSize < withUrls.length) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    vendorResult.finished_at = new Date().toISOString();
    stats.vendor_results.push(vendorResult);
    stats.vendors_completed++;
    stats.total_better_images += vendorResult.better_images;

    console.log(`[deep-enrichment] ✓ ${vendorId}: ${vendorResult.enriched} enriched, ${vendorResult.better_images} got better images, ${vendorResult.not_found_404} 404s, ${vendorResult.discontinued} discontinued`);

    // Close Puppeteer between vendors to free memory
    if (usePuppeteer) await closePuppeteer();
  }

  await closePuppeteer();

  stats.running = false;
  stats.current_vendor = null;
  stats.finished_at = new Date().toISOString();
  running = false;

  console.log(`[deep-enrichment] Complete: ${stats.total_enriched} enriched, ${stats.total_better_images} better images, ${stats.total_404} 404s across ${stats.vendors_completed} vendors`);
  return stats;
}

export function getDeepEnrichmentStatus() {
  return { ...stats };
}

export function stopDeepEnrichment() {
  shouldStop = true;
  console.log("[deep-enrichment] Stop requested");
}
