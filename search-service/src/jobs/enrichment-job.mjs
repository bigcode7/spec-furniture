/**
 * Product Data Enrichment Job
 *
 * Re-crawls product pages to fill missing data:
 *   - Description from meta tags, og:description, page content
 *   - Material from specs sections
 *   - Dimensions from specs
 *   - Collection name
 *   - Price from visible pricing
 *   - Additional images
 *
 * Targets the thinnest product records first.
 * Zero API cost — just HTML parsing.
 */

import https from "node:https";
import http from "node:http";

let running = false;
let stats = {
  total_targeted: 0,
  enriched: 0,
  failed: 0,
  fields_filled: { description: 0, material: 0, dimensions: 0, price: 0, collection: 0, images: 0 },
  started_at: null,
  finished_at: null,
  running: false,
};

/**
 * Fetch a page's HTML content.
 */
function fetchPage(url, timeout = 10000) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) return resolve(null);

    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      timeout,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Spekd-Bot/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchPage(res.headers.location, timeout).then(resolve);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 200000) res.destroy(); // 200kb limit
      });
      res.on("end", () => resolve(body));
      res.on("error", () => resolve(null));
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

/**
 * Extract enrichment data from HTML.
 */
function extractFromHtml(html, existingProduct) {
  const enriched = {};

  // ── Description ──
  if (!existingProduct.description || existingProduct.description.length < 30) {
    // Try og:description
    const ogDesc = html.match(/<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']{20,})["']/i)
      || html.match(/content=["']([^"']{20,})["']\s+(?:property|name)=["']og:description["']/i);
    if (ogDesc) {
      enriched.description = cleanText(ogDesc[1]).slice(0, 300);
    }

    // Try meta description
    if (!enriched.description) {
      const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']{20,})["']/i)
        || html.match(/content=["']([^"']{20,})["']\s+name=["']description["']/i);
      if (metaDesc) {
        enriched.description = cleanText(metaDesc[1]).slice(0, 300);
      }
    }

    // Try JSON-LD description
    if (!enriched.description) {
      const jsonLd = extractJsonLd(html);
      if (jsonLd?.description) {
        enriched.description = cleanText(jsonLd.description).slice(0, 300);
      }
    }
  }

  // ── Material ──
  if (!existingProduct.material) {
    // Look for material/fabric in specs
    const materialPatterns = [
      /(?:material|fabric|upholstery|composition)[\s:]+([^<\n]{3,60})/i,
      /(?:made\s+(?:of|from|with))\s+([^<\n.]{3,60})/i,
    ];
    for (const pattern of materialPatterns) {
      const match = html.match(pattern);
      if (match) {
        enriched.material = cleanText(match[1]).slice(0, 100);
        break;
      }
    }
  }

  // ── Dimensions ──
  if (!existingProduct.dimensions) {
    const dimPatterns = [
      /(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Ww]\s*[x×]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Dd]\s*[x×]\s*(\d{1,3}(?:\.\d+)?)\s*[""]?\s*[Hh]/,
      /(?:dimensions?|size)[\s:]+([^<\n]{5,60})/i,
      /(\d{2,3})\s*(?:"|in|inch)\s*(?:w|wide|width)/i,
    ];
    for (const pattern of dimPatterns) {
      const match = html.match(pattern);
      if (match) {
        enriched.dimensions = cleanText(match[0]).slice(0, 100);
        break;
      }
    }
  }

  // ── Collection ──
  if (!existingProduct.collection) {
    const collPatterns = [
      /(?:collection|series)[\s:]+["']?([A-Z][^<"\n]{2,40})["']?/i,
      /class=["'][^"']*collection[^"']*["'][^>]*>([^<]{2,40})</i,
    ];
    for (const pattern of collPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        enriched.collection = cleanText(match[1]).slice(0, 60);
        break;
      }
    }
  }

  // ── Price ──
  if (!existingProduct.retail_price && !existingProduct.wholesale_price) {
    // JSON-LD price
    const jsonLd = extractJsonLd(html);
    if (jsonLd?.offers?.price) {
      const price = parseFloat(jsonLd.offers.price);
      if (price > 0 && price < 100000) {
        enriched.retail_price = price;
        enriched.price_source = "vendor-website";
      }
    }

    // Fallback: price patterns in HTML
    if (!enriched.retail_price) {
      const priceMatch = html.match(/(?:price|msrp|retail)["'\s:]*\$?([\d,]+(?:\.\d{2})?)/i);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(/,/g, ""));
        if (price > 10 && price < 100000) {
          enriched.retail_price = price;
          enriched.price_source = "vendor-website";
        }
      }
    }
  }

  // ── Additional Images ──
  const imageUrls = new Set();
  if (existingProduct.image_url) imageUrls.add(existingProduct.image_url);

  // Find all large product images
  const imgRegex = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    let src = imgMatch[1];
    if (src.startsWith("//")) src = "https:" + src;
    if (src.startsWith("/")) continue; // Skip relative URLs without domain
    // Skip tiny icons, logos, social media
    if (/(?:icon|logo|social|favicon|pixel|tracking|badge|sprite)/i.test(src)) continue;
    imageUrls.add(src);
    if (imageUrls.size >= 6) break;
  }

  if (imageUrls.size > 1) {
    enriched.image_urls = [...imageUrls];
  }

  return enriched;
}

/**
 * Extract JSON-LD product data from HTML.
 */
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
    } catch { /* ignore parse errors */ }
  }
  return null;
}

function cleanText(text) {
  return (text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Compute "thinness" score — lower = thinner record.
 */
function thinnessScore(product) {
  let score = 0;
  if (product.description && product.description.length > 30) score += 3;
  if (product.material) score += 2;
  if (product.style) score += 2;
  if (product.dimensions) score += 2;
  if (product.collection) score += 1;
  if (product.retail_price || product.wholesale_price) score += 1;
  return score;
}

/**
 * Run enrichment job on the thinnest product records.
 *
 * @param {object} catalogDB - { getAllProducts, updateProductDirect }
 * @param {object} options
 * @param {number} [options.maxProducts=20000]
 * @param {number} [options.batchSize=10]
 * @param {number} [options.delayMs=500]
 */
export async function runEnrichment(catalogDB, options = {}) {
  if (running) {
    console.log("[enrichment] Already running, skipping");
    return stats;
  }

  const { maxProducts = 20000, batchSize = 10, delayMs = 500 } = options;

  running = true;
  stats = {
    total_targeted: 0,
    enriched: 0,
    failed: 0,
    fields_filled: { description: 0, material: 0, dimensions: 0, price: 0, collection: 0, images: 0 },
    started_at: new Date().toISOString(),
    finished_at: null,
    running: true,
  };

  console.log("[enrichment] Starting enrichment job...");

  // Find thinnest products with URLs
  const allProducts = [...catalogDB.getAllProducts()];
  const thin = allProducts
    .filter((p) => p.product_url && thinnessScore(p) < 6)
    .sort((a, b) => thinnessScore(a) - thinnessScore(b))
    .slice(0, maxProducts);

  stats.total_targeted = thin.length;
  console.log(`[enrichment] Targeting ${thin.length} thin products`);

  // Process in batches
  for (let i = 0; i < thin.length; i += batchSize) {
    if (!running) break;

    const batch = thin.slice(i, i + batchSize);
    await Promise.all(batch.map(async (product) => {
      try {
        const html = await fetchPage(product.product_url);
        if (!html || html.length < 200) {
          stats.failed++;
          return;
        }

        const enriched = extractFromHtml(html, product);
        const fieldCount = Object.keys(enriched).filter((k) => k !== "price_source" && k !== "image_urls").length;

        if (fieldCount > 0 || enriched.image_urls) {
          catalogDB.updateProductDirect(product.id, enriched);
          stats.enriched++;

          if (enriched.description) stats.fields_filled.description++;
          if (enriched.material) stats.fields_filled.material++;
          if (enriched.dimensions) stats.fields_filled.dimensions++;
          if (enriched.retail_price) stats.fields_filled.price++;
          if (enriched.collection) stats.fields_filled.collection++;
          if (enriched.image_urls) stats.fields_filled.images++;
        } else {
          stats.failed++;
        }
      } catch {
        stats.failed++;
      }
    }));

    // Progress logging
    const checked = Math.min(i + batchSize, thin.length);
    if (checked % 200 < batchSize) {
      console.log(`[enrichment] Progress: ${checked}/${thin.length}, enriched: ${stats.enriched}, failed: ${stats.failed}`);
    }

    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  stats.finished_at = new Date().toISOString();
  stats.running = false;
  running = false;

  console.log(`[enrichment] Complete: ${stats.enriched} enriched, ${stats.failed} failed. Fields: ${JSON.stringify(stats.fields_filled)}`);
  return stats;
}

/**
 * Get current job status.
 */
export function getEnrichmentStatus() {
  return { ...stats };
}

/**
 * Stop the running job.
 */
export function stopEnrichment() {
  running = false;
}
