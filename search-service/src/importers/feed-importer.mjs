/**
 * METHOD 3 — Google Shopping / Product Feed importer
 *
 * Many vendors publish product feeds for Google Shopping in XML format.
 * These feeds contain every product with name, image, URL, price,
 * description, and category in a standardized schema.
 *
 * Standard feed locations probed:
 *   /feed/google-shopping.xml
 *   /feeds/products.xml
 *   /google-merchant-feed.xml
 *   /product-feed.xml
 *   /feed.xml
 *   /products.xml
 *   /google-shopping.xml
 */

const USER_AGENT = "Spekd-Catalog/1.0 (furniture-catalog; contact@spekd.design)";
const FETCH_TIMEOUT_MS = 30_000; // Feeds can be large
const MAX_FEED_SIZE = 50_000_000; // 50MB cap

// ── Progress tracking ────────────────────────────────────────

const vendorProgress = new Map();

export function getFeedProgress() {
  const out = {};
  for (const [id, v] of vendorProgress) out[id] = { ...v };
  return out;
}

export function clearFeedProgress() {
  vendorProgress.clear();
}

// ── HTTP ─────────────────────────────────────────────────────

async function fetchFeed(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/xml, text/xml, */*" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    // Must look like XML or RSS
    if (!ct.includes("xml") && !ct.includes("rss") && !ct.includes("text/plain") && !ct.includes("octet")) {
      // Peek at body to see if it's XML anyway
      const text = await res.text();
      if (text.trimStart().startsWith("<?xml") || text.trimStart().startsWith("<rss") || text.trimStart().startsWith("<feed")) {
        return text.slice(0, MAX_FEED_SIZE);
      }
      return null;
    }
    const text = await res.text();
    return text.slice(0, MAX_FEED_SIZE);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Feed detection ───────────────────────────────────────────

const FEED_PATHS = [
  "/feed/google-shopping.xml",
  "/feeds/products.xml",
  "/feeds/google-shopping.xml",
  "/google-merchant-feed.xml",
  "/product-feed.xml",
  "/feed.xml",
  "/products.xml",
  "/google-shopping.xml",
  "/feeds/google_shopping.xml",
  "/feeds/all.xml",
  "/collections/all.atom",
  "/sitemap_products_1.xml", // Shopify product sitemap with extra data
];

/**
 * Discover product feed URL for a domain.
 */
async function discoverFeed(domain) {
  const bases = [`https://${domain}`, `https://www.${domain}`];

  for (const base of bases) {
    for (const path of FEED_PATHS) {
      const url = `${base}${path}`;
      const xml = await fetchFeed(url);
      if (xml && (xml.includes("<item") || xml.includes("<entry") || xml.includes("<product"))) {
        return { url, xml };
      }
    }
  }
  return null;
}

// ── XML feed parsing ─────────────────────────────────────────

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function extractTag(xml, tagName) {
  // Handle namespaced tags like g:title, g:price, g:image_link
  const patterns = [
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"),
    new RegExp(`<g:${tagName}[^>]*>([\\s\\S]*?)</g:${tagName}>`, "i"),
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) return decodeEntities(m[1].trim());
  }
  return null;
}

function slugify(text) {
  return (text || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parsePrice(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Parse Google Shopping / RSS / Atom feed XML into products.
 */
function parseFeedXml(xml, vendor) {
  const products = [];

  // Split into <item> or <entry> blocks
  const itemPattern = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let m;
  while ((m = itemPattern.exec(xml)) !== null) {
    const block = m[1];

    const name = extractTag(block, "title") || extractTag(block, "name");
    if (!name || name.length < 3) continue;

    const product = {
      id: `${vendor.id}_${slugify(name)}`,
      product_name: name,
      vendor_id: vendor.id,
      vendor_name: vendor.name,
      vendor_domain: vendor.domain,
      vendor_tier: vendor.tier,
      product_url: extractTag(block, "link") || extractTag(block, "url") || null,
      image_url: extractTag(block, "image_link") || extractTag(block, "image") || extractTag(block, "media:content") || null,
      description: (extractTag(block, "description") || "").slice(0, 500) || null,
      retail_price: parsePrice(extractTag(block, "price") || extractTag(block, "sale_price")),
      sku: extractTag(block, "id") || extractTag(block, "mpn") || extractTag(block, "sku") || null,
      category: extractTag(block, "product_type") || extractTag(block, "category") || null,
      material: extractTag(block, "material") || null,
      color: extractTag(block, "color") || null,
      style: null,
      collection: extractTag(block, "brand") || null,
      ingestion_source: "feed-import",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Handle <link href="..."/> (Atom style)
    if (!product.product_url) {
      const linkHref = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (linkHref) product.product_url = linkHref[1];
    }

    // Handle media:content or enclosure for images
    if (!product.image_url) {
      const mediaUrl = block.match(/<(?:media:content|enclosure)[^>]+url=["']([^"']+)["']/i);
      if (mediaUrl) product.image_url = mediaUrl[1];
    }

    products.push(product);
  }

  return products;
}

// ── Main export ──────────────────────────────────────────────

/**
 * Import products from a vendor's product feed.
 */
export async function importFromFeed(vendor, catalogDB) {
  const progress = {
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    status: "Probing for product feed",
    feed_url: null,
    products_found: 0,
    products_imported: 0,
    started_at: new Date().toISOString(),
    completed_at: null,
    error: null,
  };
  vendorProgress.set(vendor.id, progress);

  try {
    // 1. Discover feed
    const feedResult = await discoverFeed(vendor.domain);
    if (!feedResult) {
      progress.status = "No product feed found";
      progress.completed_at = new Date().toISOString();
      return { vendor_id: vendor.id, products_found: 0, products_imported: 0, feed_found: false };
    }

    progress.feed_url = feedResult.url;
    progress.status = `Found feed: ${feedResult.url}`;

    // 2. Parse feed
    const products = parseFeedXml(feedResult.xml, vendor);
    progress.products_found = products.length;

    // 3. Insert into catalog DB
    if (products.length > 0) {
      const result = catalogDB.insertProducts(products);
      progress.products_imported = result.inserted + result.updated;
    }

    progress.status = `Complete: ${products.length} products from feed`;
    progress.completed_at = new Date().toISOString();

    return {
      vendor_id: vendor.id,
      products_found: products.length,
      products_imported: progress.products_imported,
      feed_found: true,
      feed_url: feedResult.url,
    };
  } catch (err) {
    progress.status = `Error: ${err.message}`;
    progress.error = err.message;
    progress.completed_at = new Date().toISOString();
    return { vendor_id: vendor.id, products_found: 0, products_imported: 0, feed_found: false, error: err.message };
  }
}

/**
 * Scan all vendors for product feeds and import from each.
 */
export async function importAllFeeds(vendors, catalogDB) {
  const results = [];
  for (const vendor of vendors) {
    const result = await importFromFeed(vendor, catalogDB);
    results.push(result);
    if (result.feed_found) {
      console.log(`[feed-import] ${vendor.name}: ${result.products_found} products from ${result.feed_url}`);
    }
  }
  return results;
}
