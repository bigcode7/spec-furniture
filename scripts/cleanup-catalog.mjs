/**
 * Catalog Cleanup Script — Remove non-product entries from the catalog database.
 *
 * Removes:
 * 1. Catalog/collection/brochure pages that got crawled by accident
 * 2. Generic category-page entries (e.g., "Swivel Chairs", "Dining Tables")
 * 3. Products with junk URLs (catalog, brochure, lookbook, download paths)
 * 4. Products with no image URL AND no description (likely navigation pages)
 * 5. Names that are just "collection" or "the collection"
 * 6. Page references (e.g., "Page 3")
 * 7. Names containing "/" path separators (breadcrumb/navigation entries)
 * 8. Names starting with "Page:" or "Page <number>" patterns
 *
 * Usage: node scripts/cleanup-catalog.mjs [--dry-run]
 */

import { initCatalogDB, getAllProducts, deleteProduct, getProductCount, clearSearchCache } from "../search-service/src/db/catalog-db.mjs";

const dryRun = process.argv.includes("--dry-run");

await initCatalogDB();

const beforeCount = getProductCount();
console.log(`\nCatalog size before cleanup: ${beforeCount.toLocaleString()} products`);
console.log(`Mode: ${dryRun ? "DRY RUN (no changes)" : "LIVE — will delete junk entries"}\n`);

// ── Junk Detection Rules ──

const JUNK_NAME_PATTERNS = [
  /\bcatalog\b/i,
  /\bbrochure\b/i,
  /\blookbook\b/i,
  /\bdownload\b/i,
  /\bpdf\b/i,
];

// Names that are EXACTLY a generic category (not part of a real product name)
const GENERIC_CATEGORY_NAMES = new Set([
  "sofas", "sofa", "chairs", "chair", "tables", "table",
  "beds", "bed", "desks", "desk", "rugs", "rug",
  "lamps", "lamp", "mirrors", "mirror", "ottomans", "ottoman",
  "benches", "bench", "stools", "stool",
  "swivel chairs", "accent chairs", "dining chairs", "bar stools",
  "dining tables", "coffee tables", "side tables", "console tables",
  "end tables", "cocktail tables",
  "nightstands", "nightstand", "dressers", "dresser",
  "bookcases", "bookcase", "cabinets", "cabinet",
  "credenzas", "credenza", "sideboards", "sideboard",
  "sectionals", "sectional", "loveseats", "loveseat",
  "chaises", "chaise", "recliners", "recliner",
  "headboards", "headboard", "daybeds", "daybed",
  "chandeliers", "chandelier", "pendants", "pendant",
  "sconces", "sconce", "floor lamps", "table lamps",
  "area rugs", "throws", "throw", "pillows", "pillow",
  "vases", "vase",
  "living room", "dining room", "bedroom", "office",
  "outdoor", "outdoor furniture", "indoor furniture",
  "seating", "storage", "lighting", "decor", "accessories",
  "bedroom and dining catalog", "bedroom and dining",
  "living room furniture", "dining room furniture",
  "bedroom furniture", "office furniture",
]);

const JUNK_URL_PATTERNS = [
  /\/catalog\//i,
  /\/brochure\//i,
  /\/lookbook\//i,
  /\/downloads?\//i,
  /\/pdf\//i,
];

function isJunkEntry(product) {
  const name = (product.product_name || "").trim();
  const url = product.product_url || "";
  const imageUrl = product.image_url || "";
  const description = product.description || "";

  // Rule 1: Name contains catalog/brochure/lookbook/download/PDF
  for (const pattern of JUNK_NAME_PATTERNS) {
    if (pattern.test(name)) {
      return { reason: `name matches "${pattern.source}"`, rule: 1 };
    }
  }

  // Rule 2: Name is exactly a generic category
  const nameLower = name.toLowerCase().trim();
  if (GENERIC_CATEGORY_NAMES.has(nameLower)) {
    return { reason: `generic category name: "${name}"`, rule: 2 };
  }

  // Check with room prefix removed (e.g., "Living Room Swivel Chairs" → "Swivel Chairs")
  const roomPrefixes = [
    "living room", "dining room", "bedroom", "office", "outdoor",
    "entryway", "foyer", "bathroom", "nursery", "study",
    "master bedroom", "guest room", "family room", "great room",
  ];
  for (const prefix of roomPrefixes) {
    if (nameLower.startsWith(prefix + " ")) {
      const remainder = nameLower.slice(prefix.length + 1).trim();
      if (GENERIC_CATEGORY_NAMES.has(remainder)) {
        return { reason: `room + generic category: "${name}"`, rule: 2 };
      }
    }
  }

  // Also check with vendor prefix removed (e.g., "Hooker Furniture Sofas" → "Sofas")
  const vendorPrefixes = [
    "hooker furniture", "bernhardt", "four hands", "century furniture",
    "vanguard furniture", "lee industries", "theodore alexander",
    "hickory chair", "baker furniture", "cr laine", "caracole",
    "lexington home brands", "universal furniture", "stickley",
    "sherrill furniture", "wesley hall", "hancock and moore",
    "hancock & moore", "highland house",
  ];
  for (const prefix of vendorPrefixes) {
    if (nameLower.startsWith(prefix + " ")) {
      const remainder = nameLower.slice(prefix.length + 1).trim();
      if (GENERIC_CATEGORY_NAMES.has(remainder)) {
        return { reason: `vendor + generic category: "${name}"`, rule: 2 };
      }
    }
  }

  // Rule 3: URL contains junk paths
  // Exception: Sherrill uses /catalog/ as their product path — that's legit
  const isSherrillCatalogUrl = url.includes("sherrillfurniture.com/catalog/");
  for (const pattern of JUNK_URL_PATTERNS) {
    if (pattern.test(url)) {
      if (pattern.source.includes("catalog") && isSherrillCatalogUrl) continue;
      return { reason: `URL matches "${pattern.source}": ${url.slice(0, 80)}`, rule: 3 };
    }
  }

  // Rule 4: No image AND no description — likely a navigation/index page
  if (!imageUrl && !description) {
    return { reason: "no image_url and no description", rule: 4 };
  }

  // Rule 5: "collection" as the full name (not as part of a longer name)
  // Match: "Collection", "The Collection" but NOT "Albion Collection Sofa"
  if (/^(?:the\s+)?collection$/i.test(nameLower)) {
    return { reason: `name is just "collection"`, rule: 5 };
  }

  // Rule 6: Name is just "page" or contains "page \d+"
  if (/^page\s*\d*$/i.test(nameLower) || /\bpage\s+\d+/i.test(nameLower)) {
    return { reason: `page reference: "${name}"`, rule: 6 };
  }

  // Rule 7: Name contains "/" path separators indicating breadcrumb/navigation entries
  // Match names that start with "/" (e.g., "/All Products/Products By Room/Living Room/")
  // which are clearly navigation breadcrumbs, not product names.
  // Single or double "/" in the middle of names are common for sizes (5/0-6/6),
  // color combos (TEAL / WHITE), or abbreviations (Qn/Kg), so we only flag leading "/".
  if (name.startsWith("/")) {
    return { reason: `breadcrumb/path in name: "${name}"`, rule: 7 };
  }

  // Rule 8: Name starts with "Page" followed by whitespace+number, or "Page:" patterns
  if (/^page[\s:]+\d/i.test(name)) {
    return { reason: `page pattern in name: "${name}"`, rule: 8 };
  }

  return null;
}

// ── Run Cleanup ──

const junkEntries = [];
const ruleCounters = {};

for (const product of getAllProducts()) {
  const result = isJunkEntry(product);
  if (result) {
    junkEntries.push({ id: product.id, name: product.product_name, vendor: product.vendor_name, ...result });
    ruleCounters[result.rule] = (ruleCounters[result.rule] || 0) + 1;
  }
}

console.log(`Found ${junkEntries.length} junk entries:\n`);
console.log("By rule:");
console.log(`  Rule 1 (name has catalog/brochure/etc): ${ruleCounters[1] || 0}`);
console.log(`  Rule 2 (generic category name): ${ruleCounters[2] || 0}`);
console.log(`  Rule 3 (junk URL path): ${ruleCounters[3] || 0}`);
console.log(`  Rule 4 (no image + no description): ${ruleCounters[4] || 0}`);
console.log(`  Rule 5 (name is just "collection"): ${ruleCounters[5] || 0}`);
console.log(`  Rule 6 (page reference): ${ruleCounters[6] || 0}`);
console.log(`  Rule 7 (breadcrumb/path in name): ${ruleCounters[7] || 0}`);
console.log(`  Rule 8 (page: pattern in name): ${ruleCounters[8] || 0}`);

console.log("\nSample junk entries:");
for (const entry of junkEntries.slice(0, 20)) {
  console.log(`  [${entry.vendor}] "${entry.name}" — ${entry.reason}`);
}

if (!dryRun && junkEntries.length > 0) {
  console.log(`\nDeleting ${junkEntries.length} junk entries...`);
  let deleted = 0;
  for (const entry of junkEntries) {
    if (deleteProduct(entry.id)) deleted++;
  }
  clearSearchCache();
  console.log(`Deleted ${deleted} entries.`);
  console.log(`Catalog size after cleanup: ${getProductCount().toLocaleString()} products`);
} else if (dryRun) {
  console.log(`\nDry run — no changes made. Run without --dry-run to delete.`);
}
