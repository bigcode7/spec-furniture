#!/usr/bin/env node
/**
 * Universal Furniture Image Cleanup
 *
 * For every Universal product:
 * 1. Remove junk URLs (tracking pixels, site nav, login/signup images)
 * 2. Remove room scene / lifestyle images (_RS suffix, Roomscene*, Curated_*, _teaser)
 * 3. Remove different-product images (product code mismatch)
 * 4. Remove duplicate resolutions (keep orig > full > thumb)
 * 5. Pick best white-background hero: front > angle > side > back > VM > any studio
 * 6. Keep remaining studio shots as secondaries
 * 7. If zero studio shots, keep best room scene as hero with lifestyle_image flag
 *
 * Usage:
 *   node fix-universal-images.mjs           # dry run
 *   node fix-universal-images.mjs --apply   # apply changes
 */

import { loadCatalog, safeSave } from "./lib/safe-catalog-write.mjs";

const apply = process.argv.includes("--apply");
const DB_PATH = "./search-service/data/catalog.db.json";

// ── Product code extraction ──────────────────────────────────

function getProductCode(url) {
  if (!url) return null;
  const filename = url.split("/").pop().replace(/\.\w+(\?.*)?$/, "");
  // Strip "rrd " or "rrd_" prefix
  const clean = filename.replace(/^rrd[_ ]/i, "");
  // Extract product code: alphanumeric like U330040, 833656, 656B04M, 889535617
  const m = clean.match(/^([A-Z]?\d{3,9}[A-Z]?)/i);
  return m ? m[1] : null;
}

// ── Image classification ─────────────────────────────────────

function classifyImage(url, heroCode) {
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
  if (/roomscene/i.test(filename)) return "room_scene";
  if (/Curated_\d/i.test(filename)) return "room_scene";
  if (/_teaser\b/i.test(filename)) return "room_scene";
  if (/_RM\b/i.test(filename)) return "room_scene"; // "Room" suffix
  if (/MODERN_\d{3}$/i.test(filename)) return "room_scene"; // MODERN_017 etc
  if (/UNIVERSAL_\d{3}_\d{4}/i.test(filename)) return "room_scene"; // UNIVERSAL_006_0267

  // Check product code match — different product = remove
  const imgCode = getProductCode(url);
  if (heroCode && imgCode && imgCode !== heroCode) {
    return "different_product";
  }

  // Studio / white background shots
  if (/_VM\b/i.test(filename) || /VVM\b/i.test(filename)) return "studio_vm";
  if (/_vm\b/.test(filename)) return "studio_vm";
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

  // Head-on shots (table/chair top view)
  if (/head_S_M/i.test(filename)) return "studio_head";

  // Bare product code or rrd prefix only — usually studio
  if (/^rrd[_ ]/i.test(filename)) return "studio_rrd";

  // Plain product code with VM number suffix (U330040_VM2, U330040_VM3)
  if (/VM\d+$/i.test(filename)) return "studio_vm";

  // Product code with _V2, _V3 etc — could be studio variant
  if (/_V\d$/i.test(filename)) return "studio_variant";

  // Bare product code (just numbers) — assume studio
  const bare = filename.replace(/^rrd[_ ]/i, "");
  if (/^[A-Z]?\d{3,9}[A-Z]?\d*$/i.test(bare)) return "studio_bare";

  // Anything else on viewmastercms — keep as unknown studio
  return "studio_unknown";
}

// ── Resolution preference ────────────────────────────────────

function getResolution(url) {
  if (url.includes("/orig/")) return 3; // highest
  if (url.includes("/full/")) return 2;
  if (url.includes("/thumb/")) return 1; // lowest
  return 2; // default
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

function isRemovable(cls) {
  return ["junk", "junk_site", "junk_external", "tracking", "different_product"].includes(cls);
}

// ── Dedup by normalized filename ─────────────────────────────

function normalizeForDedup(url) {
  // Same image at different resolutions: /orig/X.jpg vs /thumb/X.jpg vs /full/X.jpg
  return url.replace(/\/(orig|full|thumb)\//, "/NORM/");
}

// ── Main ─────────────────────────────────────────────────────

const catalog = loadCatalog(DB_PATH);
const data = catalog.data;
const products = catalog.products;
const vendorCounts = catalog.vendorCounts;

const universal = products.filter(p => p.vendor_id === "universal");

console.log("═══════════════════════════════════════════════════════");
console.log("  Universal Furniture — Image Cleanup");
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

for (const product of universal) {
  if (!product.images || product.images.length === 0) continue;

  const heroUrl = product.image_url || "";
  const heroCode = getProductCode(heroUrl);
  const originalCount = product.images.length;
  totalImagesBefore += originalCount;

  // Step 1: Classify every image
  const classified = [];
  for (const img of product.images) {
    const url = typeof img === "string" ? img : img.url;
    if (!url) continue;
    const cls = classifyImage(url, heroCode);
    const res = getResolution(url);
    classified.push({ url, cls, res, original: img });
  }

  // Step 2: Separate into keep/remove
  const studioImages = [];
  const roomScenes = [];
  const removed = [];

  // Dedup: for same normalized URL, keep highest resolution
  const dedupMap = new Map();
  for (const item of classified) {
    if (isRemovable(item.cls)) {
      removed.push(item);
      const reason = item.cls;
      removalReasons[reason] = (removalReasons[reason] || 0) + 1;
      continue;
    }

    const normKey = normalizeForDedup(item.url);
    const existing = dedupMap.get(normKey);
    if (existing) {
      // Keep higher resolution
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

  // Separate deduped images
  for (const item of dedupMap.values()) {
    if (item.cls === "room_scene") {
      roomScenes.push(item);
    } else if (isStudio(item.cls)) {
      studioImages.push(item);
    } else {
      // Should not happen but keep as studio
      studioImages.push(item);
    }
  }

  // Remove room scenes
  for (const rs of roomScenes) {
    removed.push(rs);
    removalReasons["room_scene"] = (removalReasons["room_scene"] || 0) + 1;
  }

  totalRemoved += removed.length;

  // Step 3: Pick hero from studio images
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
    newImages = studioImages;
  } else if (roomScenes.length > 0) {
    // No studio images — use best room scene
    roomScenes.sort((a, b) => b.res - a.res);
    newHero = roomScenes[0];
    newImages = [roomScenes[0]]; // Keep only the best room scene
    lifestyleOnly++;
    if (lifestyleSamples.length < 10) {
      lifestyleSamples.push({ name: product.product_name, url: newHero.url });
    }
  }

  // Step 4: Build new images array
  const finalImages = newImages.map((item, i) => ({
    url: item.url,
    type: i === 0 ? "hero" : (item.cls === "studio_detail" ? "detail" : item.cls === "studio_dim" ? "dimensions" : "alternate_angle"),
    priority: i === 0 ? 1 : 2,
  }));

  // Check if hero changed
  const oldHeroUrl = product.image_url;
  const newHeroUrl = newHero ? newHero.url : null;
  const heroChanged = oldHeroUrl !== newHeroUrl && newHeroUrl;

  // Check if old hero was a room scene
  const oldHeroCls = oldHeroUrl ? classifyImage(oldHeroUrl, heroCode) : "none";
  const oldHeroWasRoomScene = oldHeroCls === "room_scene";

  if (heroChanged && oldHeroWasRoomScene && newHero && isStudio(newHero.cls)) {
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

  const changed = originalCount !== finalImages.length || heroChanged;
  if (changed) productsChanged++;

  totalImagesAfter += finalImages.length;

  // Apply changes
  if (apply && changed) {
    product.images = finalImages;
    product.image_url = newHeroUrl;
    if (lifestyleOnly > 0 && roomScenes.length > 0 && studioImages.length === 0) {
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
for (const [reason, count] of Object.entries(removalReasons).sort((a, b) => b - a)) {
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

// Per-product image count distribution
const distrib = {};
for (const p of universal) {
  if (!p.images) continue;
  const count = apply ? p.images.length : "n/a";
}

if (apply) {
  console.log(`\n─── SAVING ─────────────────────────────────────────\n`);
  safeSave(data, products, vendorCounts, { dbPath: DB_PATH });
  console.log("  Done.");
} else {
  console.log(`\n  [DRY RUN] Use --apply to write changes`);
}

console.log("\n═══════════════════════════════════════════════════════\n");
