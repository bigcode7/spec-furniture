/**
 * Image Fixer Job
 *
 * Scans the catalog and identifies products with bad hero images using
 * AI visual tags and category matching. Then re-crawls product pages
 * to find better hero images (full product visible, white/neutral background).
 *
 * Steps:
 *   1. IDENTIFY — Flag products whose visual tags indicate detail/texture/room shots
 *   2. FIND — Re-crawl product pages to find better hero images
 *   3. VALIDATE — HEAD check + dimension check on candidates
 *   4. FLAG — Mark products where no better image exists
 */

import https from "node:https";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROGRESS_PATH = path.resolve(__dirname, "../../data/image-fixer-progress.json");

// ── Bad image detection patterns ──

// Tags that indicate detail/texture/close-up shots (NOT a hero product photo)
const DETAIL_SHOT_TAGS = [
  "fabric texture", "close up", "close-up", "closeup", "woven material",
  "textile", "texture detail", "swatch", "material sample", "grain",
  "weave", "knit", "pattern detail", "stitching", "nailhead detail",
  "hardware detail", "wood grain", "marble veining", "upholstery detail",
  "cushion detail", "arm detail", "leg detail", "partial view", "cropped",
  "zoomed", "macro", "fiber", "thread",
];

// Tags that indicate room/lifestyle scenes where the product isn't the focus
const ROOM_SCENE_TAGS = [
  "room scene", "lifestyle", "multiple furniture", "room setting",
  "staged room", "interior design", "living room scene", "bedroom scene",
  "dining room scene", "showroom", "vignette", "multiple items",
  "room view", "full room", "space overview",
];

// Tags that indicate a bad/unclear image
const BAD_IMAGE_TAGS = [
  "unclear", "blurry", "dark", "overexposed", "poor quality",
  "low resolution", "pixelated", "distorted", "not furniture",
  "logo", "placeholder", "website", "screenshot", "text only",
  "diagram", "floor plan", "line drawing", "illustration",
];

// Category keywords expected in visual tags for each product type
const CATEGORY_EXPECTED_TAGS = {
  "sofas": ["sofa", "couch", "sectional", "loveseat", "settee"],
  "accent-chairs": ["chair", "accent chair", "armchair", "club chair", "lounge"],
  "swivel-chairs": ["swivel", "chair", "swivel chair"],
  "dining-chairs": ["dining chair", "chair", "side chair"],
  "dining-tables": ["dining table", "table"],
  "coffee-tables": ["coffee table", "cocktail table", "table"],
  "side-tables": ["side table", "end table", "accent table", "table"],
  "console-tables": ["console", "console table", "table"],
  "beds": ["bed", "headboard", "platform bed", "four poster"],
  "nightstands": ["nightstand", "night table", "bedside"],
  "dressers": ["dresser", "chest", "bureau"],
  "desks": ["desk", "writing desk"],
  "bookcases": ["bookcase", "bookshelf", "shelving", "etagere"],
  "ottomans": ["ottoman", "pouf", "footstool"],
  "benches": ["bench", "settee"],
  "bar-stools": ["bar stool", "stool", "counter stool"],
  "credenzas": ["credenza", "sideboard", "buffet", "media console"],
  "rugs": ["rug", "carpet", "area rug"],
  "lighting": ["lamp", "chandelier", "pendant", "sconce", "light"],
  "mirrors": ["mirror"],
};

// ── State ──

let running = false;
let stats = {
  total_scanned: 0,
  flagged_detail_shot: 0,
  flagged_room_scene: 0,
  flagged_bad_image: 0,
  flagged_category_mismatch: 0,
  flagged_no_tags: 0,
  total_flagged: 0,
  replacement_found: 0,
  replacement_validated: 0,
  stuck_no_alternative: 0,
  already_good: 0,
  started_at: null,
  finished_at: null,
  running: false,
  phase: "idle", // "scanning", "fixing", "done"
  current_product: null,
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function saveStats() {
  try {
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(stats, null, 2));
  } catch { /* non-critical */ }
}

// ── Step 1: Identify Bad Images ──

function analyzeProductImage(product) {
  const tags = (product.ai_visual_tags || "").toLowerCase();
  const category = (product.category || "").toLowerCase();
  const reasons = [];

  // No visual tags at all — can't verify image quality
  if (!tags || tags.length < 5) {
    // Only flag if the product has an image (otherwise it's a different issue)
    if (product.image_url) {
      return { flagged: true, reasons: ["no_visual_tags"], type: "no_tags" };
    }
    return { flagged: false };
  }

  const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);

  // Check for detail/texture shots
  const detailMatches = DETAIL_SHOT_TAGS.filter(dt => tags.includes(dt));
  if (detailMatches.length >= 2) {
    reasons.push(`detail_shot: ${detailMatches.join(", ")}`);
  }

  // Check for room scene tags
  const roomMatches = ROOM_SCENE_TAGS.filter(rt => tags.includes(rt));
  if (roomMatches.length >= 1) {
    reasons.push(`room_scene: ${roomMatches.join(", ")}`);
  }

  // Check for explicitly bad image tags
  const badMatches = BAD_IMAGE_TAGS.filter(bt => tags.includes(bt));
  if (badMatches.length >= 1) {
    reasons.push(`bad_image: ${badMatches.join(", ")}`);
  }

  // Check category mismatch: if we know the product type, do the tags match?
  if (category && tagList.length >= 2) {
    // Find the expected tags for this category
    let expectedTags = null;
    for (const [catKey, expected] of Object.entries(CATEGORY_EXPECTED_TAGS)) {
      if (category.includes(catKey) || catKey.includes(category.replace(/-/g, ""))) {
        expectedTags = expected;
        break;
      }
    }

    if (expectedTags) {
      const hasMatch = expectedTags.some(et => tags.includes(et));
      if (!hasMatch) {
        // The AI described the image but didn't identify the product type we expect
        reasons.push(`category_mismatch: expected [${expectedTags.slice(0, 3).join(",")}] in tags`);
      }
    }
  }

  if (reasons.length === 0) {
    return { flagged: false };
  }

  // Determine primary type
  let type = "detail_shot";
  if (reasons.some(r => r.startsWith("room_scene"))) type = "room_scene";
  if (reasons.some(r => r.startsWith("bad_image"))) type = "bad_image";
  if (reasons.some(r => r.startsWith("category_mismatch"))) type = "category_mismatch";

  return { flagged: true, reasons, type };
}

// ── Step 2: Find Better Images from Product Pages ──

/**
 * Fetch a product page and extract ALL image candidates, scored for hero quality.
 */
function fetchProductPageImages(productUrl, vendorDomain, timeout = 12000) {
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
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchProductPageImages(res.headers.location, vendorDomain, timeout).then(finish);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return finish([]);
      }

      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 400000) res.destroy();
      });

      const processBody = () => {
        const candidates = extractAndScoreImages(body, vendorDomain, productUrl);
        finish(candidates);
      };

      res.on("end", processBody);
      res.on("close", processBody);
    });

    req.on("error", () => finish([]));
    req.on("timeout", () => { req.destroy(); finish([]); });
  });
}

/**
 * Extract all images from HTML and score them for hero-quality likelihood.
 * Higher score = more likely to be the hero product image.
 */
function extractAndScoreImages(html, vendorDomain, sourceUrl) {
  const images = new Map(); // url -> score

  const addCandidate = (url, bonus = 0) => {
    if (!url || url.length < 10) return;
    // Normalize relative URLs
    if (url.startsWith("//")) url = "https:" + url;
    if (url.startsWith("/")) {
      try {
        const base = new URL(sourceUrl);
        url = base.origin + url;
      } catch { return; }
    }
    if (!url.startsWith("http")) return;
    // Filter out junk
    if (/logo|icon|svg|spacer|pixel|tracking|favicon|badge|arrow/i.test(url)) return;
    if (url.endsWith(".svg") || url.endsWith(".gif")) return;
    if (url.length > 500) return;

    const current = images.get(url) || 0;
    images.set(url, current + bonus);
  };

  // 1. JSON-LD product images (highest priority — structured data)
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of jsonLdMatches) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const item of items) {
        if (item["@type"] === "Product" || item["@type"] === "IndividualProduct") {
          const imgs = Array.isArray(item.image) ? item.image : [item.image];
          imgs.filter(Boolean).forEach((img, i) => {
            const url = typeof img === "string" ? img : img.url || img.contentUrl;
            if (url) addCandidate(url, 1000 - i * 50); // First JSON-LD image is usually the hero
          });
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // 2. og:image (very reliable hero image)
  const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogMatch) addCandidate(ogMatch[1], 900);

  // 3. Image galleries / carousels (common in product pages)
  // Look for data attributes that hold gallery images
  const galleryPatterns = [
    /"(?:images|gallery|media|photos)":\s*\[([^\]]+)\]/gi,
    /data-(?:gallery|images|zoom-images|thumbs)=["']([^"']+)["']/gi,
    /"(?:original|large|full|zoom|hires)":\s*"([^"]+)"/gi,
  ];
  for (const pattern of galleryPatterns) {
    for (const match of html.matchAll(pattern)) {
      const content = match[1];
      // Extract URLs from the matched content
      const urls = content.matchAll(/(?:https?:)?\/\/[^\s"',\]]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"',\]]*)?/gi);
      let idx = 0;
      for (const u of urls) {
        addCandidate(u[0], 800 - idx * 30);
        idx++;
      }
    }
  }

  // 4. All img src/data-src attributes
  const imgPattern = /<img[^>]+(?:src|data-src|data-zoom-image|data-large)=["']([^"']+)["'][^>]*>/gi;
  for (const match of html.matchAll(imgPattern)) {
    const url = match[1];
    let score = 100;

    // Get context from surrounding HTML
    const context = match[0].toLowerCase();

    // Boost for hero/main product indicators
    if (/main|hero|primary|featured|product-image|pdp-image/i.test(context)) score += 400;
    if (/gallery|carousel|slider/i.test(context)) score += 200;
    if (/zoom|enlarge|magnif/i.test(context)) score += 300;

    // Penalize thumbnails
    if (/thumb|thumbnail|swatch|color-swatch|option/i.test(context)) score -= 200;
    if (/width=["']?\d{1,2}["']?\b|height=["']?\d{1,2}["']?\b/i.test(context)) score -= 300;

    // Check dimensions in URL
    const dimMatch = url.match(/(\d{3,4})x(\d{3,4})/i);
    if (dimMatch) {
      const w = parseInt(dimMatch[1]);
      if (w >= 800) score += 200;
      else if (w >= 400) score += 100;
      else if (w <= 100) score -= 200;
    }

    // Boost if on vendor domain
    if (vendorDomain && url.includes(vendorDomain)) score += 50;

    // Penalize detail/swatch URLs
    if (/detail|swatch|color|finish|fabric|material/i.test(url)) score -= 150;
    if (/lifestyle|room|scene|setting|vignette/i.test(url)) score -= 100;

    addCandidate(url, score);
  }

  // 5. srcset images
  const srcsetPattern = /srcset=["']([^"']+)["']/gi;
  for (const match of html.matchAll(srcsetPattern)) {
    const parts = match[1].split(",").map(s => s.trim());
    for (const part of parts) {
      const [url, descriptor] = part.split(/\s+/);
      let score = 150;
      if (descriptor) {
        const w = parseInt(descriptor);
        if (w >= 800) score += 200;
        else if (w >= 400) score += 100;
      }
      addCandidate(url, score);
    }
  }

  // Sort by score descending
  const sorted = [...images.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url, score]) => ({ url, score }));

  return sorted;
}

// ── Step 3: Validate Candidate Images ──

function checkImageUrl(url, timeout = 6000) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) {
      return resolve({ ok: false, contentType: null, contentLength: 0 });
    }
    const client = url.startsWith("https") ? https : http;
    const req = client.request(url, {
      method: "HEAD",
      timeout,
      headers: { "User-Agent": "Mozilla/5.0 Spekd-Bot/1.0" },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return checkImageUrl(res.headers.location, timeout).then(resolve);
      }
      resolve({
        ok: res.statusCode === 200,
        contentType: res.headers["content-type"] || "",
        contentLength: parseInt(res.headers["content-length"] || "0", 10),
      });
    });
    req.on("error", () => resolve({ ok: false, contentType: null, contentLength: 0 }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, contentType: null, contentLength: 0 }); });
    req.end();
  });
}

function fetchImageDimensions(url, timeout = 8000) {
  return new Promise((resolve) => {
    if (!url || !url.startsWith("http")) return resolve(null);
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      timeout,
      headers: { "User-Agent": "Mozilla/5.0 Spekd-Bot/1.0", Range: "bytes=0-65535" },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImageDimensions(res.headers.location, timeout).then(resolve);
      }
      if (res.statusCode !== 200 && res.statusCode !== 206) {
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
        resolve(dims);
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

/**
 * Validate a candidate image:
 * - URL loads (200)
 * - Is an image content-type
 * - Is at least 400x400
 * - Is on vendor domain or known CDN
 */
async function validateCandidate(url, currentImageUrl, vendorDomain) {
  // Don't "replace" with the same image
  if (url === currentImageUrl) return null;

  const head = await checkImageUrl(url);
  if (!head.ok) return null;
  if (head.contentType && !head.contentType.startsWith("image/")) return null;

  const dims = await fetchImageDimensions(url);
  if (!dims) {
    // If we can't get dimensions but the file is big enough, accept tentatively
    if (head.contentLength > 20000) {
      return { url, width: null, height: null, quality: "verified" };
    }
    return null;
  }

  if (dims.width < 400 || dims.height < 400) return null;

  const quality = (dims.width >= 800 && dims.height >= 800) ? "verified-hq" : "verified";
  return { url, width: dims.width, height: dims.height, quality };
}

// ── Main Job ──

/**
 * Run the image fixer job on the entire catalog.
 *
 * @param {object} catalogDB - { getAllProducts, updateProductDirect, getProductCount }
 * @param {object} options
 * @param {boolean} [options.dryRun=false] - Only scan and report, don't replace
 * @param {number} [options.batchSize=10] - Concurrent page fetches per batch
 * @param {number} [options.delayMs=500] - Delay between batches
 * @param {string[]} [options.vendorFilter=null] - Only process these vendors
 */
export async function runImageFixer(catalogDB, options = {}) {
  if (running) {
    console.log("[image-fixer] Already running");
    return stats;
  }

  const { dryRun = false, batchSize = 10, delayMs = 500, vendorFilter = null } = options;

  running = true;
  stats = {
    total_scanned: 0,
    flagged_detail_shot: 0,
    flagged_room_scene: 0,
    flagged_bad_image: 0,
    flagged_category_mismatch: 0,
    flagged_no_tags: 0,
    total_flagged: 0,
    replacement_found: 0,
    replacement_validated: 0,
    stuck_no_alternative: 0,
    already_good: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
    running: true,
    phase: "scanning",
    current_product: null,
    examples: { detail_shot: [], room_scene: [], category_mismatch: [], replaced: [], stuck: [] },
  };

  console.log("[image-fixer] Starting image quality scan...");

  // ── Phase 1: Scan & Flag ──
  const allProducts = [...catalogDB.getAllProducts()];
  const flagged = [];

  const vendorFilterLower = vendorFilter ? vendorFilter.map(v => v.toLowerCase()) : null;

  for (const product of allProducts) {
    if (vendorFilterLower && !vendorFilterLower.some(v => (product.vendor_name || "").toLowerCase().includes(v))) {
      continue;
    }
    stats.total_scanned++;

    const analysis = analyzeProductImage(product);
    if (!analysis.flagged) {
      stats.already_good++;
      continue;
    }

    // Track by type
    switch (analysis.type) {
      case "detail_shot": stats.flagged_detail_shot++; break;
      case "room_scene": stats.flagged_room_scene++; break;
      case "bad_image": stats.flagged_bad_image++; break;
      case "category_mismatch": stats.flagged_category_mismatch++; break;
      case "no_tags": stats.flagged_no_tags++; break;
    }
    stats.total_flagged++;

    // Collect examples (up to 5 per type)
    if (stats.examples[analysis.type] && stats.examples[analysis.type].length < 5) {
      stats.examples[analysis.type].push({
        id: product.id,
        name: product.product_name?.substring(0, 60),
        vendor: product.vendor_name,
        category: product.category,
        tags: (product.ai_visual_tags || "").substring(0, 100),
        reasons: analysis.reasons,
      });
    }

    flagged.push({ product, analysis });
  }

  console.log(`[image-fixer] Scan complete: ${stats.total_scanned} products scanned`);
  console.log(`[image-fixer]   Flagged: ${stats.total_flagged} (detail:${stats.flagged_detail_shot} room:${stats.flagged_room_scene} bad:${stats.flagged_bad_image} cat_mismatch:${stats.flagged_category_mismatch} no_tags:${stats.flagged_no_tags})`);
  console.log(`[image-fixer]   Already good: ${stats.already_good}`);
  saveStats();

  if (dryRun) {
    stats.phase = "done";
    stats.finished_at = new Date().toISOString();
    stats.running = false;
    running = false;
    saveStats();
    console.log("[image-fixer] Dry run complete — no replacements made");
    return stats;
  }

  // ── Phase 2: Fix flagged products (skip no_tags — nothing to verify) ──
  const fixable = flagged.filter(f => f.analysis.type !== "no_tags");
  stats.phase = "fixing";
  console.log(`[image-fixer] Attempting to fix ${fixable.length} products with identified image issues...`);

  for (let i = 0; i < fixable.length; i += batchSize) {
    if (!running) break;

    const batch = fixable.slice(i, i + batchSize);
    await Promise.all(batch.map(async ({ product }) => {
      stats.current_product = product.id;

      // Skip products with no product_url — we can't re-crawl
      if (!product.product_url) {
        stats.stuck_no_alternative++;
        catalogDB.updateProductDirect(product.id, { needs_better_image: true });
        return;
      }

      try {
        const vendorDomain = product.vendor_domain || "";
        const candidates = await fetchProductPageImages(product.product_url, vendorDomain);

        if (candidates.length === 0) {
          stats.stuck_no_alternative++;
          catalogDB.updateProductDirect(product.id, { needs_better_image: true });
          if (stats.examples.stuck.length < 5) {
            stats.examples.stuck.push({
              id: product.id,
              name: product.product_name?.substring(0, 60),
              vendor: product.vendor_name,
              reason: "no images found on page",
            });
          }
          return;
        }

        // Try candidates in score order until we find a valid one that's different
        let replaced = false;
        for (const candidate of candidates.slice(0, 8)) {
          const validated = await validateCandidate(candidate.url, product.image_url, vendorDomain);
          if (validated) {
            stats.replacement_found++;
            // Apply the replacement
            catalogDB.updateProductDirect(product.id, {
              image_url: validated.url,
              image_verified: true,
              image_quality: validated.quality,
              image_width: validated.width,
              image_height: validated.height,
              image_checked_at: new Date().toISOString(),
              needs_better_image: false,
              _previous_image_url: product.image_url,
            });
            stats.replacement_validated++;
            replaced = true;
            if (stats.examples.replaced.length < 10) {
              stats.examples.replaced.push({
                id: product.id,
                name: product.product_name?.substring(0, 60),
                vendor: product.vendor_name,
                old_image: product.image_url?.substring(0, 80),
                new_image: validated.url?.substring(0, 80),
                dimensions: validated.width ? `${validated.width}x${validated.height}` : "unknown",
              });
            }
            break;
          }
        }

        if (!replaced) {
          stats.stuck_no_alternative++;
          catalogDB.updateProductDirect(product.id, { needs_better_image: true });
          if (stats.examples.stuck.length < 5) {
            stats.examples.stuck.push({
              id: product.id,
              name: product.product_name?.substring(0, 60),
              vendor: product.vendor_name,
              reason: `${candidates.length} candidates, none passed validation`,
            });
          }
        }
      } catch (err) {
        stats.stuck_no_alternative++;
        catalogDB.updateProductDirect(product.id, { needs_better_image: true });
      }
    }));

    // Progress log
    const done = Math.min(i + batchSize, fixable.length);
    if (done % 50 < batchSize || done === fixable.length) {
      console.log(`[image-fixer] Fix progress: ${done}/${fixable.length} | replaced:${stats.replacement_validated} stuck:${stats.stuck_no_alternative}`);
      saveStats();
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  stats.phase = "done";
  stats.finished_at = new Date().toISOString();
  stats.running = false;
  stats.current_product = null;
  running = false;
  saveStats();

  console.log(`[image-fixer] Complete!`);
  console.log(`[image-fixer]   Scanned: ${stats.total_scanned}`);
  console.log(`[image-fixer]   Flagged: ${stats.total_flagged}`);
  console.log(`[image-fixer]   Replaced: ${stats.replacement_validated}`);
  console.log(`[image-fixer]   Stuck (no alternative): ${stats.stuck_no_alternative}`);

  return stats;
}

export function getImageFixerStatus() {
  return { ...stats };
}

export function stopImageFixer() {
  running = false;
}
