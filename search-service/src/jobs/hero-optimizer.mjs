/**
 * Hero Image Optimizer Job
 *
 * Goes through every product in the catalog and ensures the hero image
 * is the best available option — crisp, high-res, ideally a studio shot
 * on a white/neutral background.
 *
 * Three phases:
 *   1. GALLERY SWAP — For products with alternate images, check if any
 *      alternate is higher quality than the current hero. Swap if so.
 *   2. BAD HERO FIX — For products with bad/blurry/detail-shot heroes,
 *      re-crawl product pages to find studio shots.
 *   3. VERIFY UNCHECKED — For products whose hero has never been verified,
 *      check dimensions/quality and flag issues.
 *
 * Triggered via POST /admin/hero-optimizer/start
 * Monitor via GET /admin/hero-optimizer/status
 */

import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_PATH = path.resolve(__dirname, "../../data/hero-optimizer-progress.json");

// Quality thresholds
const MIN_WIDTH = 400;
const MIN_HEIGHT = 400;
const HQ_WIDTH = 800;
const HQ_HEIGHT = 800;

// Quality rank for comparison
const QUALITY_RANK = {
  "verified-hq": 4,
  "verified": 3,
  "low-quality": 1,
  "broken": 0,
  "missing": 0,
  "not-product": 0,
};

// URL patterns that indicate swatch/detail/non-product images
const BAD_URL_PATTERNS = /swatch|fabric[_-]?sample|finish[_-]?sample|_swatch|_finish\.|_color\.|_quartz\.|material[_-]sample|detail[_-]shot|logo|placeholder|spacer|pixel|tracking|favicon|badge/i;

// URL patterns that indicate studio/hero/product images (preferred)
const GOOD_URL_PATTERNS = /hero|silo|_vm_|product[_-]?image|main|primary|pdp|full[_-]size|large|original|_01\.|_001\.|front|catalog/i;

let running = false;
let stats = {
  total: 0,
  phase: "idle",
  // Phase 1
  phase1_checked: 0,
  phase1_swapped: 0,
  phase1_already_best: 0,
  phase1_no_alternates: 0,
  // Phase 2
  phase2_flagged: 0,
  phase2_crawled: 0,
  phase2_replaced: 0,
  phase2_stuck: 0,
  // Phase 3
  phase3_checked: 0,
  phase3_verified_hq: 0,
  phase3_verified: 0,
  phase3_low_quality: 0,
  phase3_broken: 0,
  // Overall
  started_at: null,
  finished_at: null,
  running: false,
  current_product: null,
  examples: { swapped: [], crawl_replaced: [], stuck: [], broken: [] },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function saveStats() {
  try {
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(stats, null, 2));
  } catch { /* non-critical */ }
}

// ── Image dimension fetching ──

function fetchImageInfo(url, timeout = 8000) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) return resolve(null);
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      timeout,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Spekd-Bot/1.0",
        Range: "bytes=0-65535",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImageInfo(res.headers.location, timeout).then(resolve);
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        return resolve(null);
      }
      const contentType = res.headers["content-type"] || "";
      const contentLength = parseInt(res.headers["content-length"] || "0", 10);

      if (contentType && !contentType.startsWith("image/")) {
        res.resume();
        return resolve(null);
      }

      const chunks = [];
      let totalBytes = 0;
      res.on("data", (chunk) => {
        chunks.push(chunk);
        totalBytes += chunk.length;
        if (totalBytes >= 65536) res.destroy();
      });
      const finish = () => {
        const buf = Buffer.concat(chunks);
        const dims = parseDimensions(buf);
        resolve({
          ok: true,
          width: dims?.width || null,
          height: dims?.height || null,
          contentLength,
          contentType,
        });
      };
      res.on("end", finish);
      res.on("close", finish);
      res.on("error", () => resolve(null));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

function parseDimensions(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  // WebP
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    if (buf.toString("ascii", 12, 16) === "VP8 " && buf.length >= 30) {
      return { width: buf.readUInt16LE(26) & 0x3FFF, height: buf.readUInt16LE(28) & 0x3FFF };
    }
    if (buf.toString("ascii", 12, 16) === "VP8L" && buf.length >= 25) {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 };
    }
  }
  // JPEG
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let offset = 2;
    while (offset < buf.length - 9) {
      if (buf[offset] !== 0xFF) { offset++; continue; }
      const marker = buf[offset + 1];
      if (marker >= 0xC0 && marker <= 0xC2) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      if (marker === 0xD9 || marker === 0xDA) break;
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }
  return null;
}

// ── Score an image URL for "studio hero" quality ──

function scoreImageUrl(url) {
  if (!url) return -100;
  let score = 0;
  if (BAD_URL_PATTERNS.test(url)) score -= 50;
  if (GOOD_URL_PATTERNS.test(url)) score += 20;
  // Penalize tiny size indicators in URL
  if (/[_-](50x50|75x75|100x100|thumb|small|tiny|icon)/i.test(url)) score -= 30;
  // Boost large size indicators
  if (/[_-](800|1000|1200|large|xlarge|full|original|master)/i.test(url)) score += 15;
  return score;
}

function getQualityLabel(width, height) {
  if (width >= HQ_WIDTH && height >= HQ_HEIGHT) return "verified-hq";
  if (width >= MIN_WIDTH && height >= MIN_HEIGHT) return "verified";
  return "low-quality";
}

// ── Product page crawling for replacements ──

function fetchProductPageImages(productUrl, timeout = 12000) {
  return new Promise((resolve) => {
    if (!productUrl || !productUrl.startsWith("http")) return resolve([]);
    const client = productUrl.startsWith("https") ? https : http;
    let resolved = false;
    const finish = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    const req = client.get(productUrl, {
      timeout,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Spekd-Bot/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchProductPageImages(res.headers.location, timeout).then(finish);
      }
      if (res.statusCode !== 200) { res.resume(); return finish([]); }

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; if (body.length > 400000) res.destroy(); });
      const processBody = () => finish(extractAndScoreImages(body, productUrl));
      res.on("end", processBody);
      res.on("close", processBody);
    });
    req.on("error", () => finish([]));
    req.on("timeout", () => { req.destroy(); finish([]); });
  });
}

function extractAndScoreImages(html, sourceUrl) {
  const images = new Map();
  const addCandidate = (url, bonus = 0) => {
    if (!url || url.length < 10) return;
    if (url.startsWith("//")) url = "https:" + url;
    if (url.startsWith("/")) {
      try { url = new URL(url, sourceUrl).href; } catch { return; }
    }
    if (!url.startsWith("http")) return;
    if (/logo|icon|svg|spacer|pixel|tracking|favicon|badge|arrow/i.test(url)) return;
    if (url.endsWith(".svg") || url.endsWith(".gif")) return;
    if (url.length > 500) return;
    images.set(url, (images.get(url) || 0) + bonus);
  };

  // JSON-LD
  for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const item of items) {
        if (item["@type"] === "Product" || item["@type"] === "IndividualProduct") {
          const imgs = Array.isArray(item.image) ? item.image : [item.image];
          imgs.filter(Boolean).forEach((img, i) => {
            const u = typeof img === "string" ? img : img.url || img.contentUrl;
            if (u) addCandidate(u, 1000 - i * 50);
          });
        }
      }
    } catch {}
  }

  // og:image
  const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogMatch) addCandidate(ogMatch[1], 900);

  // Gallery patterns
  for (const pattern of [
    /"(?:images|gallery|media|photos)":\s*\[([^\]]+)\]/gi,
    /data-(?:gallery|images|zoom-images)=["']([^"']+)["']/gi,
    /"(?:original|large|full|zoom|hires)":\s*"([^"]+)"/gi,
  ]) {
    for (const match of html.matchAll(pattern)) {
      let idx = 0;
      for (const u of match[1].matchAll(/(?:https?:)?\/\/[^\s"',\]]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"',\]]*)?/gi)) {
        addCandidate(u[0], 800 - idx * 30);
        idx++;
      }
    }
  }

  // img tags
  for (const match of html.matchAll(/<img[^>]+(?:src|data-src|data-zoom-image|data-large)=["']([^"']+)["'][^>]*>/gi)) {
    const ctx = match[0].toLowerCase();
    let score = 100;
    if (/main|hero|primary|featured|product-image|pdp-image/i.test(ctx)) score += 400;
    if (/gallery|carousel|slider/i.test(ctx)) score += 200;
    if (/zoom|enlarge|magnif/i.test(ctx)) score += 300;
    if (/thumb|swatch|color-swatch|option/i.test(ctx)) score -= 200;
    if (/detail|swatch|color|finish|fabric|material/i.test(match[1])) score -= 150;
    addCandidate(match[1], score);
  }

  return [...images.entries()].sort((a, b) => b[1] - a[1]).map(([url, score]) => ({ url, score }));
}

// ── Main Job ──

export async function runHeroOptimizer(catalogDB, options = {}) {
  if (running) {
    console.log("[hero-optimizer] Already running");
    return stats;
  }

  const {
    batchSize = 15,
    delayMs = 300,
    vendorFilter = null,
    skipPhase1 = false,
    skipPhase2 = false,
    skipPhase3 = false,
  } = options;

  running = true;
  stats = {
    total: 0,
    phase: "starting",
    phase1_checked: 0, phase1_swapped: 0, phase1_already_best: 0, phase1_no_alternates: 0,
    phase2_flagged: 0, phase2_crawled: 0, phase2_replaced: 0, phase2_stuck: 0,
    phase3_checked: 0, phase3_verified_hq: 0, phase3_verified: 0, phase3_low_quality: 0, phase3_broken: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
    running: true,
    current_product: null,
    examples: { swapped: [], crawl_replaced: [], stuck: [], broken: [] },
  };

  console.log("[hero-optimizer] Starting full catalog hero image optimization...");

  const allProducts = [...catalogDB.getAllProducts()];
  const vendorFilterLower = vendorFilter ? vendorFilter.map(v => v.toLowerCase()) : null;
  const products = vendorFilterLower
    ? allProducts.filter(p => vendorFilterLower.some(v => (p.vendor_name || "").toLowerCase().includes(v)))
    : allProducts;

  stats.total = products.length;
  console.log(`[hero-optimizer] Processing ${products.length} products`);
  saveStats();

  // ════════════════════════════════════════════════════════════
  // PHASE 1: Gallery Swap — check if any alternate image is better than hero
  // ════════════════════════════════════════════════════════════
  if (!skipPhase1) {
    stats.phase = "phase1_gallery_swap";
    console.log("[hero-optimizer] Phase 1: Checking gallery images for better heroes...");

    // First, collect products that have alternates and whose hero isn't already verified-hq
    const candidatesForSwap = products.filter(p => {
      if (!p.image_url) return false;
      // Already verified-hq — likely fine unless URL looks like a swatch
      if (p.image_quality === "verified-hq" && !BAD_URL_PATTERNS.test(p.image_url)) return false;
      // Need alternates to swap from
      const imgs = Array.isArray(p.images) ? p.images : [];
      const altUrls = imgs.map(img => typeof img === "string" ? img : (img?.url || "")).filter(Boolean);
      return altUrls.length > 0;
    });

    console.log(`[hero-optimizer] Phase 1: ${candidatesForSwap.length} products have alternates to check`);

    for (let i = 0; i < candidatesForSwap.length; i += batchSize) {
      if (!running) break;
      const batch = candidatesForSwap.slice(i, i + batchSize);

      await Promise.all(batch.map(async (product) => {
        stats.phase1_checked++;
        stats.current_product = product.id;

        const heroUrl = product.image_url;
        const imgs = Array.isArray(product.images) ? product.images : [];
        const altUrls = imgs.map(img => typeof img === "string" ? img : (img?.url || "")).filter(Boolean);

        // Get hero info (use stored data if available, otherwise fetch)
        let heroWidth = product.image_width || 0;
        let heroHeight = product.image_height || 0;
        let heroQuality = QUALITY_RANK[product.image_quality] || 0;

        // If we don't have stored dimensions, fetch them
        if (!heroWidth && heroUrl) {
          const info = await fetchImageInfo(heroUrl);
          if (info && info.width) {
            heroWidth = info.width;
            heroHeight = info.height;
            heroQuality = QUALITY_RANK[getQualityLabel(heroWidth, heroHeight)] || 0;
          } else if (!info) {
            // Hero is broken — any alternate is better
            heroQuality = 0;
            heroWidth = 0;
          }
        }

        // Add URL quality score
        let heroScore = heroQuality * 100 + scoreImageUrl(heroUrl);
        if (heroWidth >= HQ_WIDTH) heroScore += 50;

        // Check each alternate
        let bestUrl = heroUrl;
        let bestScore = heroScore;
        let bestWidth = heroWidth;
        let bestHeight = heroHeight;
        let bestQualityLabel = product.image_quality;

        for (const altUrl of altUrls) {
          if (altUrl === heroUrl) continue;
          if (BAD_URL_PATTERNS.test(altUrl)) continue;

          const info = await fetchImageInfo(altUrl);
          if (!info || !info.ok) continue;

          const w = info.width || 0;
          const h = info.height || 0;
          if (w < MIN_WIDTH || h < MIN_HEIGHT) continue;

          const qualLabel = getQualityLabel(w, h);
          const qualRank = QUALITY_RANK[qualLabel] || 0;
          let altScore = qualRank * 100 + scoreImageUrl(altUrl);
          if (w >= HQ_WIDTH) altScore += 50;

          if (altScore > bestScore) {
            bestUrl = altUrl;
            bestScore = altScore;
            bestWidth = w;
            bestHeight = h;
            bestQualityLabel = qualLabel;
          }
        }

        if (bestUrl !== heroUrl) {
          // Swap hero
          catalogDB.updateProductDirect(product.id, {
            image_url: bestUrl,
            image_verified: true,
            image_quality: bestQualityLabel,
            image_width: bestWidth,
            image_height: bestHeight,
            image_checked_at: new Date().toISOString(),
            _previous_image_url: heroUrl,
            needs_better_image: false,
          });
          stats.phase1_swapped++;
          if (stats.examples.swapped.length < 15) {
            stats.examples.swapped.push({
              id: product.id,
              name: (product.product_name || "").substring(0, 60),
              vendor: product.vendor_name,
              old: heroUrl?.substring(0, 80),
              new: bestUrl.substring(0, 80),
              old_dims: `${heroWidth}x${heroHeight}`,
              new_dims: `${bestWidth}x${bestHeight}`,
            });
          }
        } else {
          stats.phase1_already_best++;
          // While we're here, store the verified dimensions if we fetched them
          if (heroWidth && !product.image_width) {
            catalogDB.updateProductDirect(product.id, {
              image_verified: true,
              image_quality: getQualityLabel(heroWidth, heroHeight),
              image_width: heroWidth,
              image_height: heroHeight,
              image_checked_at: new Date().toISOString(),
            });
          }
        }
      }));

      const done = Math.min(i + batchSize, candidatesForSwap.length);
      if (done % 100 < batchSize || done === candidatesForSwap.length) {
        console.log(`[hero-optimizer] Phase 1: ${done}/${candidatesForSwap.length} | swapped:${stats.phase1_swapped} best:${stats.phase1_already_best}`);
        saveStats();
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    stats.phase1_no_alternates = products.length - candidatesForSwap.length;
    console.log(`[hero-optimizer] Phase 1 complete: ${stats.phase1_swapped} heroes swapped, ${stats.phase1_already_best} already best`);
  }

  // ════════════════════════════════════════════════════════════
  // PHASE 2: Bad Hero Fix — crawl product pages for replacements
  // ════════════════════════════════════════════════════════════
  if (!skipPhase2) {
    stats.phase = "phase2_crawl_fix";
    console.log("[hero-optimizer] Phase 2: Finding replacements for bad/missing/low-quality heroes...");

    const needsFix = products.filter(p => {
      // No hero image at all
      if (!p.image_url) return true;
      // Known bad
      if (p.image_quality === "broken" || p.image_quality === "missing" || p.image_quality === "not-product") return true;
      if (p.image_quality === "low-quality") return true;
      // Swatch/detail URLs that weren't fixed in Phase 1
      if (BAD_URL_PATTERNS.test(p.image_url)) return true;
      // Flagged by image-fixer previously
      if (p.needs_better_image || p.bad_image) return true;
      return false;
    });

    stats.phase2_flagged = needsFix.length;
    console.log(`[hero-optimizer] Phase 2: ${needsFix.length} products need better heroes`);

    for (let i = 0; i < needsFix.length; i += batchSize) {
      if (!running) break;
      const batch = needsFix.slice(i, i + batchSize);

      await Promise.all(batch.map(async (product) => {
        stats.current_product = product.id;

        if (!product.product_url) {
          stats.phase2_stuck++;
          catalogDB.updateProductDirect(product.id, { needs_better_image: true });
          return;
        }

        try {
          stats.phase2_crawled++;
          const candidates = await fetchProductPageImages(product.product_url);

          if (candidates.length === 0) {
            stats.phase2_stuck++;
            catalogDB.updateProductDirect(product.id, { needs_better_image: true });
            if (stats.examples.stuck.length < 10) {
              stats.examples.stuck.push({
                id: product.id,
                name: (product.product_name || "").substring(0, 60),
                vendor: product.vendor_name,
                reason: "no images found on product page",
              });
            }
            return;
          }

          // Try top candidates
          let replaced = false;
          for (const candidate of candidates.slice(0, 8)) {
            if (candidate.url === product.image_url) continue;
            if (BAD_URL_PATTERNS.test(candidate.url)) continue;

            const info = await fetchImageInfo(candidate.url);
            if (!info || !info.ok) continue;

            const w = info.width || 0;
            const h = info.height || 0;
            // Accept if at least 400x400 or if file is big enough
            if (w < MIN_WIDTH && h < MIN_HEIGHT && (!info.contentLength || info.contentLength < 20000)) continue;

            const quality = w >= HQ_WIDTH && h >= HQ_HEIGHT ? "verified-hq" : w >= MIN_WIDTH ? "verified" : "verified";
            catalogDB.updateProductDirect(product.id, {
              image_url: candidate.url,
              image_verified: true,
              image_quality: quality,
              image_width: w || null,
              image_height: h || null,
              image_checked_at: new Date().toISOString(),
              needs_better_image: false,
              _previous_image_url: product.image_url,
            });
            stats.phase2_replaced++;
            replaced = true;
            if (stats.examples.crawl_replaced.length < 15) {
              stats.examples.crawl_replaced.push({
                id: product.id,
                name: (product.product_name || "").substring(0, 60),
                vendor: product.vendor_name,
                old: product.image_url?.substring(0, 80),
                new: candidate.url.substring(0, 80),
                dims: w ? `${w}x${h}` : "unknown",
              });
            }
            break;
          }

          if (!replaced) {
            stats.phase2_stuck++;
            catalogDB.updateProductDirect(product.id, { needs_better_image: true });
            if (stats.examples.stuck.length < 10) {
              stats.examples.stuck.push({
                id: product.id,
                name: (product.product_name || "").substring(0, 60),
                vendor: product.vendor_name,
                reason: `${candidates.length} candidates, none passed validation`,
              });
            }
          }
        } catch (err) {
          stats.phase2_stuck++;
          catalogDB.updateProductDirect(product.id, { needs_better_image: true });
        }
      }));

      const done = Math.min(i + batchSize, needsFix.length);
      if (done % 50 < batchSize || done === needsFix.length) {
        console.log(`[hero-optimizer] Phase 2: ${done}/${needsFix.length} | replaced:${stats.phase2_replaced} stuck:${stats.phase2_stuck}`);
        saveStats();
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    console.log(`[hero-optimizer] Phase 2 complete: ${stats.phase2_replaced} replaced, ${stats.phase2_stuck} stuck`);
  }

  // ════════════════════════════════════════════════════════════
  // PHASE 3: Verify Unchecked — ensure every product has quality metadata
  // ════════════════════════════════════════════════════════════
  if (!skipPhase3) {
    stats.phase = "phase3_verify";
    console.log("[hero-optimizer] Phase 3: Verifying unchecked hero images...");

    const unchecked = products.filter(p =>
      p.image_url && !p.image_quality && !p.image_checked_at
    );

    console.log(`[hero-optimizer] Phase 3: ${unchecked.length} products with unchecked heroes`);

    for (let i = 0; i < unchecked.length; i += batchSize) {
      if (!running) break;
      const batch = unchecked.slice(i, i + batchSize);

      await Promise.all(batch.map(async (product) => {
        stats.phase3_checked++;
        stats.current_product = product.id;

        const info = await fetchImageInfo(product.image_url);
        if (!info || !info.ok) {
          stats.phase3_broken++;
          catalogDB.updateProductDirect(product.id, {
            image_quality: "broken",
            image_verified: false,
            image_checked_at: new Date().toISOString(),
          });
          if (stats.examples.broken.length < 10) {
            stats.examples.broken.push({
              id: product.id,
              name: (product.product_name || "").substring(0, 60),
              vendor: product.vendor_name,
              url: product.image_url?.substring(0, 80),
            });
          }
          return;
        }

        const w = info.width || 0;
        const h = info.height || 0;
        let quality;
        if (w >= HQ_WIDTH && h >= HQ_HEIGHT) {
          quality = "verified-hq";
          stats.phase3_verified_hq++;
        } else if (w >= MIN_WIDTH && h >= MIN_HEIGHT) {
          quality = "verified";
          stats.phase3_verified++;
        } else if (w > 0) {
          quality = "low-quality";
          stats.phase3_low_quality++;
        } else {
          // Got response but couldn't parse dimensions — assume OK if big file
          quality = info.contentLength > 20000 ? "verified" : "low-quality";
          if (quality === "verified") stats.phase3_verified++;
          else stats.phase3_low_quality++;
        }

        catalogDB.updateProductDirect(product.id, {
          image_quality: quality,
          image_verified: true,
          image_width: w || null,
          image_height: h || null,
          image_checked_at: new Date().toISOString(),
        });
      }));

      const done = Math.min(i + batchSize, unchecked.length);
      if (done % 200 < batchSize || done === unchecked.length) {
        console.log(`[hero-optimizer] Phase 3: ${done}/${unchecked.length} | hq:${stats.phase3_verified_hq} ok:${stats.phase3_verified} low:${stats.phase3_low_quality} broken:${stats.phase3_broken}`);
        saveStats();
      }
      if (delayMs > 0) await sleep(delayMs);
    }

    console.log(`[hero-optimizer] Phase 3 complete: ${stats.phase3_verified_hq} HQ, ${stats.phase3_verified} verified, ${stats.phase3_low_quality} low, ${stats.phase3_broken} broken`);
  }

  // ── Done ──
  stats.phase = "done";
  stats.finished_at = new Date().toISOString();
  stats.running = false;
  stats.current_product = null;
  running = false;
  saveStats();

  console.log(`[hero-optimizer] ═══ COMPLETE ═══`);
  console.log(`[hero-optimizer]   Total products: ${stats.total}`);
  console.log(`[hero-optimizer]   Phase 1 — Gallery swaps: ${stats.phase1_swapped}`);
  console.log(`[hero-optimizer]   Phase 2 — Crawl replacements: ${stats.phase2_replaced}`);
  console.log(`[hero-optimizer]   Phase 3 — Verified: ${stats.phase3_checked}`);

  return stats;
}

export function getHeroOptimizerStatus() {
  return { ...stats };
}

export function stopHeroOptimizer() {
  running = false;
  console.log("[hero-optimizer] Stop requested");
}
