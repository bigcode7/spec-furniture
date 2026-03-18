/**
 * Image Verification Job — Enhanced
 *
 * Background job that verifies every product image in the catalog:
 *   1. HEAD request to check 200 status + content-type + size
 *   2. Full GET of first 64KB to extract actual image dimensions
 *   3. Quality labels: verified-hq (800+), verified (400+), low-quality, broken, missing
 *   4. If broken, try to find replacement from product page og:image
 *   5. Download and cache verified images locally
 *   6. Mark products with image_quality, image_width, image_height
 *
 * Processes ~100 products/minute with full inspection.
 */

import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IMAGE_CACHE_DIR = path.resolve(__dirname, "../../data/images");

// Quality thresholds
const MIN_WIDTH = 400;
const MIN_HEIGHT = 400;
const HQ_WIDTH = 800;
const HQ_HEIGHT = 800;
const MIN_FILE_SIZE = 10000; // 10KB

let running = false;
let stats = {
  total: 0,
  checked: 0,
  verified_hq: 0,
  verified: 0,
  low_quality: 0,
  broken: 0,
  replaced: 0,
  no_image: 0,
  cached: 0,
  started_at: null,
  finished_at: null,
  running: false,
};

/**
 * Send a HEAD request to check if a URL returns a valid image.
 */
function checkImageUrl(url, timeout = 5000) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) {
      return resolve({ ok: false, contentType: null, contentLength: 0 });
    }

    const client = url.startsWith("https") ? https : http;
    const req = client.request(url, { method: "HEAD", timeout, headers: { "User-Agent": "Mozilla/5.0 SPEC-Bot/1.0" } }, (res) => {
      const contentType = res.headers["content-type"] || "";
      const contentLength = parseInt(res.headers["content-length"] || "0", 10);

      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return checkImageUrl(res.headers.location, timeout).then(resolve);
      }

      resolve({
        ok: res.statusCode === 200,
        contentType,
        contentLength,
      });
    });

    req.on("error", () => resolve({ ok: false, contentType: null, contentLength: 0 }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, contentType: null, contentLength: 0 }); });
    req.end();
  });
}

/**
 * Fetch the first ~64KB of an image to determine dimensions.
 * Uses simple dimension detection from binary headers.
 *
 * @returns {Promise<{ width: number, height: number, contentLength: number } | null>}
 */
function fetchImageDimensions(url, timeout = 8000) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) return resolve(null);

    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout, headers: { "User-Agent": "Mozilla/5.0 SPEC-Bot/1.0", Range: "bytes=0-65535" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImageDimensions(res.headers.location, timeout).then(resolve);
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        res.resume();
        return resolve(null);
      }

      const contentLength = parseInt(res.headers["content-length"] || "0", 10);
      const chunks = [];
      let totalBytes = 0;

      res.on("data", (chunk) => {
        chunks.push(chunk);
        totalBytes += chunk.length;
        if (totalBytes >= 65536) res.destroy();
      });

      const finish = () => {
        const buf = Buffer.concat(chunks);
        const dims = parseDimensionsFromBuffer(buf);
        resolve(dims ? { ...dims, contentLength } : { width: 0, height: 0, contentLength });
      };

      res.on("end", finish);
      res.on("close", finish);
      res.on("error", () => resolve(null));
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

/**
 * Parse image dimensions from raw bytes (PNG, JPEG, GIF, WebP).
 */
function parseDimensionsFromBuffer(buf) {
  if (!buf || buf.length < 24) return null;

  // PNG: bytes 16-23 contain width (4 bytes) and height (4 bytes)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // GIF: bytes 6-9 contain width (2 LE) and height (2 LE)
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }

  // WebP: RIFF header + VP8 chunk
  if (buf.length >= 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    // VP8 lossy
    if (buf.toString("ascii", 12, 16) === "VP8 " && buf.length >= 30) {
      return { width: buf.readUInt16LE(26) & 0x3FFF, height: buf.readUInt16LE(28) & 0x3FFF };
    }
    // VP8L lossless
    if (buf.toString("ascii", 12, 16) === "VP8L" && buf.length >= 25) {
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3FFF) + 1, height: ((bits >> 14) & 0x3FFF) + 1 };
    }
  }

  // JPEG: scan for SOF markers
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let offset = 2;
    while (offset < buf.length - 9) {
      if (buf[offset] !== 0xFF) { offset++; continue; }
      const marker = buf[offset + 1];
      // SOF0-SOF2 markers
      if (marker >= 0xC0 && marker <= 0xC2) {
        return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
      }
      if (marker === 0xD9 || marker === 0xDA) break; // EOI or SOS
      const segLen = buf.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  }

  return null;
}

/**
 * Download and cache an image locally.
 *
 * @returns {Promise<string|null>} Local file path or null
 */
function cacheImage(productId, imageUrl, timeout = 10000) {
  return new Promise((resolve) => {
    if (!imageUrl || !imageUrl.startsWith("http")) return resolve(null);

    // Ensure cache directory exists
    if (!fs.existsSync(IMAGE_CACHE_DIR)) {
      fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
    }

    const safeId = productId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const client = imageUrl.startsWith("https") ? https : http;

    const req = client.get(imageUrl, { timeout, headers: { "User-Agent": "Mozilla/5.0 SPEC-Bot/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return cacheImage(productId, res.headers.location, timeout).then(resolve);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }

      const ct = res.headers["content-type"] || "";
      const ext = ct.includes("png") ? ".png" : ct.includes("webp") ? ".webp" : ".jpg";
      const filePath = path.join(IMAGE_CACHE_DIR, safeId + ext);
      const ws = fs.createWriteStream(filePath);
      let bytes = 0;

      res.on("data", (chunk) => {
        bytes += chunk.length;
        // Cap at 5MB
        if (bytes > 5 * 1024 * 1024) { res.destroy(); ws.destroy(); }
      });

      res.pipe(ws);
      ws.on("finish", () => resolve(filePath));
      ws.on("error", () => resolve(null));
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

/**
 * Compute quality label from dimensions and file size.
 */
function computeQualityLabel(width, height, contentLength) {
  if (width >= HQ_WIDTH && height >= HQ_HEIGHT) return "verified-hq";
  if (width >= MIN_WIDTH && height >= MIN_HEIGHT) return "verified";
  if (width > 0 && height > 0) return "low-quality";
  // If we couldn't get dimensions but file is large enough, call it verified
  if (contentLength > MIN_FILE_SIZE) return "verified";
  return "low-quality";
}

/**
 * Try to extract og:image from a product page URL.
 */
function extractOgImage(url, timeout = 10000) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) return resolve(null);

    const client = url.startsWith("https") ? https : http;
    let resolved = false;
    const finish = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    const req = client.get(url, { timeout, headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SPEC-Bot/1.0" } }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return finish(null);
      }

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 300000) res.destroy(); // larger limit for Vanguard pages (~293KB)
      });

      const processBody = () => {
        // 1. og:image meta tag
        const ogMatch = body.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
          || body.match(/content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
        if (ogMatch && ogMatch[1]) return finish(ogMatch[1]);

        // 2. Find all <img> with absolute URLs to jpg/png/webp
        const allImgs = [...body.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/gi)];
        const productImgs = allImgs
          .map(m => m[1])
          .filter(s => !s.includes("logo") && !s.includes("icon") && !s.includes("svg") && !s.includes("spacer") && !s.includes("404"));

        // Score images: prefer hi-res, product paths, larger dimensions
        const scored = productImgs.map(src => {
          let score = 0;
          const widthParam = src.match(/width=(\d+)/i);
          if (widthParam) score = parseInt(widthParam[1], 10);
          const sizeInPath = src.match(/\/(\d{3,4})x(\d{3,4})\//i);
          if (sizeInPath) score = Math.max(score, parseInt(sizeInPath[1], 10));
          const sizeInName = src.match(/__(\d{2,4})x(\d{2,4})\./i);
          if (sizeInName) score = Math.max(score, parseInt(sizeInName[1], 10));
          if (/hires|large|hero|main|detail/i.test(src)) score += 800;
          if (/product/i.test(src)) score += 300;
          if (/thumbnail|thumb/i.test(src)) score += 100;
          if (/80x80|50x50|tiny/i.test(src)) score -= 500;
          return { src, score };
        });

        scored.sort((a, b) => b.score - a.score);

        if (scored.length > 0) {
          let best = scored[0].src;
          // Upscale Vanguard 80x80 thumbnails to 600x600
          if (best.includes("80x80")) {
            best = best.replace(/\/80x80\//g, "/600x600/").replace(/__80x80\./g, "__600x600.");
          }
          if (scored[0].score > 0 || productImgs.length === 1) {
            return finish(best);
          }
        }

        finish(null);
      };

      res.on("end", processBody);
      res.on("close", processBody);
    });

    req.on("error", () => finish(null));
    req.on("timeout", () => { req.destroy(); finish(null); });
  });
}

/**
 * Run the enhanced image verification job.
 *
 * @param {object} catalogDB - { getAllProducts, updateProductDirect, getProductCount }
 * @param {object} options
 * @param {number} [options.batchSize=15] - Concurrent checks per batch
 * @param {number} [options.delayMs=300] - Delay between batches
 * @param {boolean} [options.recheckVerified=false] - Recheck already-verified images
 * @param {boolean} [options.cacheImages=true] - Download and cache HQ images locally
 */
export async function runImageVerification(catalogDB, options = {}) {
  if (running) {
    console.log("[image-verifier] Already running, skipping");
    return stats;
  }

  const { batchSize = 15, delayMs = 300, recheckVerified = false, cacheImages = true, vendorFilter = null } = options;

  running = true;
  stats = {
    total: 0,
    checked: 0,
    verified_hq: 0,
    verified: 0,
    low_quality: 0,
    broken: 0,
    replaced: 0,
    no_image: 0,
    cached: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
    running: true,
  };

  console.log("[image-verifier] Starting enhanced image verification job...");

  const allProducts = catalogDB.getAllProducts();
  const toCheck = [];

  const vendorFilterLower = vendorFilter ? vendorFilter.map(v => v.toLowerCase()) : null;
  for (const product of allProducts) {
    if (vendorFilterLower && !vendorFilterLower.some(v => (product.vendor_name || "").toLowerCase().includes(v))) {
      continue;
    }
    if (!recheckVerified && product.image_quality && product.image_checked_at) {
      if (product.image_quality === "verified-hq") stats.verified_hq++;
      else if (product.image_quality === "verified") stats.verified++;
      continue;
    }
    toCheck.push(product);
  }

  stats.total = toCheck.length + stats.verified_hq + stats.verified;
  console.log(`[image-verifier] ${toCheck.length} products to check (${stats.verified_hq + stats.verified} already verified)`);

  for (let i = 0; i < toCheck.length; i += batchSize) {
    if (!running) break;

    const batch = toCheck.slice(i, i + batchSize);
    await Promise.all(batch.map(async (product) => {
      try {
        if (!product.image_url) {
          // Try to find an image from the product page before giving up
          let found = null;
          if (product.product_url) {
            found = await extractOgImage(product.product_url);
            if (found) {
              const repCheck = await checkImageUrl(found);
              if (!repCheck.ok || !(repCheck.contentType || "").startsWith("image/")) found = null;
            }
          }
          if (found) {
            const dims = await fetchImageDimensions(found);
            const quality = dims ? computeQualityLabel(dims.width, dims.height, dims.contentLength) : "verified";
            catalogDB.updateProductDirect(product.id, {
              image_url: found,
              image_verified: true,
              image_quality: quality,
              image_width: dims?.width || null,
              image_height: dims?.height || null,
              image_checked_at: new Date().toISOString(),
            });
            stats.replaced++;
            if (quality === "verified-hq") stats.verified_hq++;
            else stats.verified++;
          } else {
            catalogDB.updateProductDirect(product.id, {
              image_verified: false,
              image_quality: "missing",
              image_checked_at: new Date().toISOString(),
            });
            stats.no_image++;
          }
          stats.checked++;
          return;
        }

        // Step 1: HEAD check
        const headCheck = await checkImageUrl(product.image_url);
        const isImage = headCheck.contentType ? headCheck.contentType.startsWith("image/") : false;
        const isBigEnough = headCheck.contentLength > MIN_FILE_SIZE || headCheck.contentLength === 0;

        if (!headCheck.ok || !isImage || !isBigEnough) {
          // Image broken — try replacement
          let replacement = null;
          if (product.product_url) {
            replacement = await extractOgImage(product.product_url);
            if (replacement) {
              const repCheck = await checkImageUrl(replacement);
              if (!repCheck.ok) replacement = null;
            }
          }

          if (replacement) {
            // Re-inspect the replacement
            const dims = await fetchImageDimensions(replacement);
            const quality = dims ? computeQualityLabel(dims.width, dims.height, dims.contentLength) : "verified";
            catalogDB.updateProductDirect(product.id, {
              image_url: replacement,
              image_verified: true,
              image_quality: quality,
              image_width: dims?.width || null,
              image_height: dims?.height || null,
              image_checked_at: new Date().toISOString(),
            });
            stats.replaced++;
            if (quality === "verified-hq") stats.verified_hq++;
            else stats.verified++;
          } else {
            catalogDB.updateProductDirect(product.id, {
              image_verified: false,
              image_quality: "broken",
              image_checked_at: new Date().toISOString(),
            });
            stats.broken++;
          }
          stats.checked++;
          return;
        }

        // Step 2: Fetch dimensions
        const dims = await fetchImageDimensions(product.image_url);
        const quality = dims ? computeQualityLabel(dims.width, dims.height, headCheck.contentLength) : "verified";

        const updateFields = {
          image_verified: true,
          image_quality: quality,
          image_width: dims?.width || null,
          image_height: dims?.height || null,
          image_checked_at: new Date().toISOString(),
        };

        // Step 3: Cache HQ images locally
        if (cacheImages && (quality === "verified-hq" || quality === "verified")) {
          const cachedPath = await cacheImage(product.id, product.image_url);
          if (cachedPath) {
            updateFields.cached_image_path = cachedPath;
            stats.cached++;
          }
        }

        catalogDB.updateProductDirect(product.id, updateFields);
        if (quality === "verified-hq") stats.verified_hq++;
        else if (quality === "verified") stats.verified++;
        else stats.low_quality++;
        stats.checked++;
      } catch {
        stats.checked++;
        stats.broken++;
      }
    }));

    if (stats.checked % 200 < batchSize) {
      console.log(`[image-verifier] Progress: ${stats.checked}/${toCheck.length} | HQ:${stats.verified_hq} OK:${stats.verified} Low:${stats.low_quality} Broken:${stats.broken} Cached:${stats.cached}`);
    }

    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  stats.finished_at = new Date().toISOString();
  stats.running = false;
  running = false;

  console.log(`[image-verifier] Complete: HQ:${stats.verified_hq} OK:${stats.verified} Low:${stats.low_quality} Broken:${stats.broken} Replaced:${stats.replaced} Cached:${stats.cached}`);

  return stats;
}

/**
 * Get current job status.
 */
export function getImageVerificationStatus() {
  return { ...stats };
}

/**
 * Stop the running job.
 */
export function stopImageVerification() {
  running = false;
}
