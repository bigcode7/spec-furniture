#!/usr/bin/env node
/**
 * Universal Furniture Image Cleanup
 *
 * For every Universal product:
 * 1. Remove junk URLs (tracking pixels, site nav, login/signup images)
 * 2. Remove room scene / lifestyle images (_RS suffix, Roomscene*, Curated_*, _teaser)
 * 3. Remove different-product images (SKU mismatch via filename)
 * 4. Remove duplicate resolutions (keep orig > full > thumb)
 * 5. Pick best white-background hero: front > angle > side > back > VM > any studio
 * 6. Keep remaining studio shots as secondaries (max 4 total)
 * 7. If zero studio shots, keep best room scene as hero with lifestyle_image flag
 *
 * Uses the product SKU to match images — much more reliable than hero URL parsing.
 *
 * Usage:
 *   node fix-universal-images.mjs           # dry run
 *   node fix-universal-images.mjs --apply   # apply changes
 */

import { loadCatalog, safeSave } from "./lib/safe-catalog-write.mjs";

const apply = process.argv.includes("--apply");
const DB_PATH = "./search-service/data/catalog.db.json";

// ── SKU-based image matching ────────────────────────────────

/**
 * Generate match patterns from a product SKU.
 * Universal SKUs look like: U352C175, U035510LCR, U477510CC-1783-1, 833656B
 * Filenames might use shortened or slightly different forms.
 */
function getSkuPatterns(sku) {
  if (!sku) return [];
  const patterns = new Set();
  const norm = sku.replace(/[-\s]/g, "").toUpperCase();
  const firstSeg = sku.toUpperCase().split("-")[0];

  patterns.add(norm);
  patterns.add(firstSeg);

  // Strip trailing letters: U035510LCR → U035510
  const baseMatch = firstSeg.match(/^(.*\d)/);
  if (baseMatch) patterns.add(baseMatch[1]);

  // Without trailing single letter: U352C175B → U352C175
  if (/[A-Z]$/.test(firstSeg)) patterns.add(firstSeg.slice(0, -1));

  // Strip trailing letters from full normalized SKU
  const baseNoLetter = norm.match(/^(.*\d)/);
  if (baseNoLetter) patterns.add(baseNoLetter[1]);

  return [...patterns].filter(p => p.length >= 5);
}

/**
 * Check if a filename matches a product's SKU.
 */
function fileMatchesSku(filename, sku) {
  const fn = filename.toUpperCase().replace(/[-\s]/g, "");
  return getSkuPatterns(sku).some(p => fn.includes(p));
}

// ── Image classification ─────────────────────────────────────

function classifyImage(url) {
  if (!url) return "junk";

  // Non-product URLs — site navigation, tracking, etc.
  if (!url.includes("viewmastercms.com")) {
    if (url.includes("universalfurniture.com")) return "junk_site";
    if (url.includes("insight.adsrvr.org")) return "tracking";
    if (url.includes("facebook.com")) return "tracking";
    if (url.includes("google.com") || url.includes("doubleclick.net")) return "tracking";
    if (url.includes("pinterest.com")) return "tracking";
    return "junk_external";
  }

  const filename = url.split("/").pop().replace(/\.\w+(\?.*)?$/, "");

  // Room scenes / lifestyle
  if (/_RS\b/i.test(filename)) return "room_scene";
  if (/_RS_/i.test(filename)) return "room_scene";
  if (/_RS\d/i.test(filename)) return "room_scene";
  if (/Roomscene/i.test(filename)) return "room_scene";
  if (/Curated_\d/i.test(filename)) return "room_scene";
  if (/_teaser\b/i.test(filename)) return "room_scene";
  if (/_RM\b/i.test(filename)) return "room_scene";
  if (/MODERN_\d{3}$/i.test(filename)) return "room_scene";
  if (/UNIVERSAL_\d{3}_\d{4}/i.test(filename)) return "room_scene";

  // Studio / white background shots
  if (/_VM\b/i.test(filename) || /VVM\b/i.test(filename)) return "studio_vm";
  if (/_vm\b/.test(filename)) return "studio_vm";
  if (/VM\d+$/i.test(filename)) return "studio_vm";
  if (/_front/i.test(filename)) return "studio_front";
  if (/_angle/i.test(filename)) return "studio_angle";
  if (/_back/i.test(filename)) return "studio_back";
  if (/_side/i.test(filename)) return "studio_side";
  if (/_detail/i.test(filename)) return "studio_detail";
  if (/_SILO/i.test(filename)) return "studio_silo";
  if (/_siloCC/i.test(filename)) return "studio_silo";
  if (/_DIM/i.test(filename)) return "studio_dim";
  if (/_ALT/i.test(filename)) return "studio_alt";
  if (/_CC\b/i.test(filename)) return "studio_cc";
  if (/_crop/i.test(filename)) return "studio_crop";
  if (/_PS\b/i.test(filename)) return "studio_ps";
  if (/_edit\b/i.test(filename)) return "studio_edit";

  // Configuration variants (still white background studio shots)
  if (/_Wings|_paddedTrack|_tapered|_onyx|_espresso|_tusk|_block|_hidden|_reverseKey|_Sandbar|_Cotton|_frontCP|_angleCP|_backCP/i.test(filename)) {
    return "studio_variant";
  }

  if (/head_S_M/i.test(filename)) return "studio_head";
  if (/^rrd[_ ]/i.test(filename)) return "studio_rrd";
  if (/_V\d$/i.test(filename)) return "studio_variant";

  // Bare product code (just numbers/alphanumeric) — assume studio
  const bare = filename.replace(/^rrd[_ ]/i, "");
  if (/^[A-Z]?\d{3,9}[A-Z]?\d*$/i.test(bare)) return "studio_bare";

  // Anything else on viewmastercms — keep as unknown studio
  return "studio_unknown";
}

// ── Resolution preference ────────────────────────────────────

function getResolution(url) {
  if (url.includes("/orig/")) return 3;
  if (url.includes("/full/")) return 2;
  if (url.includes("/thumb/")) return 1;
  return 2;
}

// ── Hero priority (higher = better for hero) ─────────────────

function getHeroPriority(classification) {
  switch (classification) {
    case "studio_front": return 10;
    case "studio_angle": return 9;
    case "studio_vm": return 8;
    case "studio_silo": return 7;
    case "studio_side": return 6;
    case "studio_cc": return 5;
    case "studio_alt": return 5;
    case "studio_bare": return 5;
    case "studio_rrd": return 5;
    case "studio_unknown": return 4;
    case "studio_back": return 3;
    case "studio_head": return 3;
    case "studio_crop": return 2;
    case "studio_ps": return 2;
    case "studio_edit": return 2;
    case "studio_variant": return 1;
    case "studio_detail": return 1;
    case "studio_dim": return 0;
    case "room_scene": return -1;
    default: return -10;
  }
}

function isStudio(cls) {
  return cls.startsWith("studio_");
}

function isJunk(cls) {
  return ["junk", "junk_site", "junk_external", "tracking"].includes(cls);
}

// ── Dedup by normalized filename ─────────────────────────────

function normalizeForDedup(url) {
  return url.replace(/\/(orig|full|thumb)\//, "/NORM/");
}

// ── Main ─────────────────────────────────────────────────────

const catalog = loadCatalog(DB_PATH);
const data = catalog.data;
const products = catalog.products;
const vendorCounts = catalog.vendorCounts;

const universal = products.filter(p => p.vendor_id === "universal");

console.log("═══════════════════════════════════════════════════════");
console.log("  Universal Furniture — Image Cleanup (SKU-based)");
console.log("═══════════════════════════════════════════════════════\n");
console.log(`  Total Universal products: ${universal.length}`);

let totalImagesBefore = 0;
let totalImagesAfter = 0;
let totalRemoved = 0;
let heroSwapped = 0;
let lifestyleOnly = 0;
let productsChanged = 0;

const removalReasons = {};
const heroSwapSamples = [];
const lifestyleSamples = [];

const MAX_IMAGES = 4; // hero + 3 secondaries

for (const product of universal) {
  if (!product.images || product.images.length === 0) continue;

  const sku = product.sku || "";
  const originalCount = product.images.length;
  totalImagesBefore += originalCount;

  // Step 1: Classify and check SKU match for every image
  const classified = [];
  for (const img of product.images) {
    const url = typeof img === "string" ? img : img.url;
    if (!url) continue;
    const cls = classifyImage(url);
    const res = getResolution(url);
    const filename = url.split("/").pop().replace(/\.\w+(\?.*)?$/, "").replace(/^rrd[_ ]/i, "");
    const matchesSku = sku ? fileMatchesSku(filename, sku) : true; // if no SKU, don't filter by code
    classified.push({ url, cls, res, matchesSku, original: img });
  }

  // Step 2: Determine if we have any SKU-matching images
  const hasSkuMatches = classified.some(item => item.matchesSku && !isJunk(item.cls) && item.cls !== "room_scene");

  // Step 3: Filter images
  const studioImages = [];
  const roomScenes = [];
  const removed = [];

  // Dedup: for same normalized URL, keep highest resolution
  const dedupMap = new Map();
  for (const item of classified) {
    // Always remove junk/tracking
    if (isJunk(item.cls)) {
      removed.push(item);
      removalReasons[item.cls] = (removalReasons[item.cls] || 0) + 1;
      continue;
    }

    // If we have SKU-matching images, remove non-matching ones
    if (hasSkuMatches && !item.matchesSku) {
      removed.push(item);
      removalReasons["different_product"] = (removalReasons["different_product"] || 0) + 1;
      continue;
    }

    const normKey = normalizeForDedup(item.url);
    const existing = dedupMap.get(normKey);
    if (existing) {
      if (item.res > existing.res) {
        removed.push(existing);
        removalReasons["duplicate_resolution"] = (removalReasons["duplicate_resolution"] || 0) + 1;
        dedupMap.set(normKey, item);
      } else {
        removed.push(item);
        removalReasons["duplicate_resolution"] = (removalReasons["duplicate_resolution"] || 0) + 1;
      }
    } else {
      dedupMap.set(normKey, item);
    }
  }

  // Separate deduped images into studio and room scenes
  for (const item of dedupMap.values()) {
    if (item.cls === "room_scene") {
      roomScenes.push(item);
    } else {
      studioImages.push(item);
    }
  }

  // Remove room scenes (they go to fallback pool)
  for (const rs of roomScenes) {
    removed.push(rs);
    removalReasons["room_scene"] = (removalReasons["room_scene"] || 0) + 1;
  }

  totalRemoved += removed.length;

  // Step 4: Pick hero and build final images (max 4)
  let newHero = null;
  let newImages = [];

  if (studioImages.length > 0) {
    // Sort by hero priority (desc), then resolution (desc)
    studioImages.sort((a, b) => {
      const pDiff = getHeroPriority(b.cls) - getHeroPriority(a.cls);
      if (pDiff !== 0) return pDiff;
      return b.res - a.res;
    });

    newHero = studioImages[0];
    newImages = studioImages.slice(0, MAX_IMAGES);
  } else if (roomScenes.length > 0) {
    // No studio images — use best room scene
    roomScenes.sort((a, b) => b.res - a.res);
    newHero = roomScenes[0];
    newImages = [roomScenes[0]];
    lifestyleOnly++;
    if (lifestyleSamples.length < 10) {
      lifestyleSamples.push({ name: product.product_name, url: newHero.url });
    }
  }

  // Step 5: Build final images array
  const finalImages = newImages.map((item, i) => ({
    url: item.url,
    type: i === 0 ? "hero" : (item.cls === "studio_detail" ? "detail" : item.cls === "studio_dim" ? "dimensions" : "alternate_angle"),
    priority: i === 0 ? 1 : 2,
  }));

  // Track hero changes
  const oldHeroUrl = product.image_url;
  const newHeroUrl = newHero ? newHero.url : null;
  const heroChanged = oldHeroUrl !== newHeroUrl && newHeroUrl;

  if (heroChanged) {
    const oldHeroCls = oldHeroUrl ? classifyImage(oldHeroUrl) : "none";
    if (oldHeroCls === "room_scene" && newHero && isStudio(newHero.cls)) {
      heroSwapped++;
      if (heroSwapSamples.length < 15) {
        heroSwapSamples.push({
          name: product.product_name,
          oldHero: oldHeroUrl.split("/").pop(),
          newHero: newHeroUrl.split("/").pop(),
          oldCls: oldHeroCls,
          newCls: newHero.cls,
        });
      }
    }
  }

  const changed = originalCount !== finalImages.length || heroChanged;
  if (changed) productsChanged++;

  totalImagesAfter += finalImages.length;

  // Apply changes
  if (apply && changed) {
    product.images = finalImages;
    product.image_url = newHeroUrl;
    if (studioImages.length === 0 && roomScenes.length > 0) {
      product.lifestyle_image = true;
    } else {
      delete product.lifestyle_image;
    }
    product.updated_at = new Date().toISOString();
  }
}

// ── Report ───────────────────────────────────────────────────

console.log(`\n─── RESULTS ────────────────────────────────────────\n`);
console.log(`  Images before:          ${totalImagesBefore}`);
console.log(`  Images after:           ${totalImagesAfter}`);
console.log(`  Images removed:         ${totalRemoved}`);
console.log(`  Products changed:       ${productsChanged}`);
console.log(`  Heroes swapped:         ${heroSwapped} (room scene → white background)`);
console.log(`  Lifestyle-only:         ${lifestyleOnly} (no white bg available)`);

console.log(`\n─── REMOVAL BREAKDOWN ──────────────────────────────\n`);
for (const [reason, count] of Object.entries(removalReasons).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${reason.padEnd(25)} ${count}`);
}

if (heroSwapSamples.length > 0) {
  console.log(`\n─── HERO SWAP SAMPLES ──────────────────────────────\n`);
  for (const s of heroSwapSamples) {
    console.log(`  ${s.name}`);
    console.log(`    OLD: ${s.oldHero} (${s.oldCls})`);
    console.log(`    NEW: ${s.newHero} (${s.newCls})\n`);
  }
}

if (lifestyleSamples.length > 0) {
  console.log(`\n─── LIFESTYLE-ONLY PRODUCTS ────────────────────────\n`);
  for (const s of lifestyleSamples) {
    console.log(`  ${s.name} → ${s.url.split("/").pop()}`);
  }
}

// Image count distribution (proposed)
console.log(`\n─── IMAGE COUNT DISTRIBUTION (proposed) ────────────\n`);
console.log(`  Avg images/product: ${(totalImagesAfter / universal.length).toFixed(1)}`);

if (apply) {
  console.log(`\n─── SAVING ─────────────────────────────────────────\n`);
  safeSave(data, products, vendorCounts, { dbPath: DB_PATH });
  console.log("  Done.");
} else {
  console.log(`\n  [DRY RUN] Use --apply to write changes`);
}

console.log("\n═══════════════════════════════════════════════════════\n");
