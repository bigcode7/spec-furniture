import { sampleCatalog } from "../data/sample-catalog.mjs";
import { extractVendorProductDocument, extractVendorProductLinks, normalizeVendorUrl } from "../lib/vendor-product.mjs";

const USER_AGENT = "Mozilla/5.0 (compatible; SPECSearchBot/1.0; +https://spec.local)";

export function buildSeedAdapter(vendorId, options = {}) {
  return {
    vendorId,
    label: options.label || vendorId,
    seedOnly: true,
    crawlTargets: options.crawlTargets || [],
    async ingest() {
      return buildSeedResult(vendorId, options, "seed");
    },
  };
}

export function buildCrawlerAdapter(vendorId, options = {}) {
  return {
    vendorId,
    label: options.label || vendorId,
    seedOnly: false,
    crawlTargets: options.crawlTargets || [],
    async ingest({ mode = "live" } = {}) {
      if (mode === "seed") {
        return buildSeedResult(vendorId, options, "seed");
      }

      try {
        const crawledProducts = await crawlVendorCatalog({
          vendor: options.vendor,
          crawlTargets: options.crawlTargets || [],
          maxProducts: options.maxProducts || 8,
        });

        if (crawledProducts.length > 0) {
          return {
            vendor_id: vendorId,
            vendor_name: options.vendorName,
            mode: "live",
            crawl_targets: this.crawlTargets,
            product_count: crawledProducts.length,
            products: crawledProducts,
          };
        }
      } catch {
        // Fall through to empty live result.
      }

      return {
        vendor_id: vendorId,
        vendor_name: options.vendorName,
        mode: "live",
        crawl_targets: this.crawlTargets,
        product_count: 0,
        products: [],
      };
    },
  };
}

function buildSeedResult(vendorId, options, mode) {
  const products = sampleCatalog
    .filter((product) => product.vendor_id === vendorId)
    .map((product) => ({
      ...product,
      ingestion_source: "seed-adapter",
      ingested_at: new Date().toISOString(),
    }));

  return {
    vendor_id: vendorId,
    vendor_name: options.vendorName,
    mode,
    crawl_targets: options.crawlTargets || [],
    product_count: products.length,
    products,
  };
}

async function crawlVendorCatalog({ vendor, crawlTargets, maxProducts }) {
  const listingPages = await Promise.all(crawlTargets.slice(0, 4).map((url) => fetchHtml(url)));
  const productLinks = new Set();

  for (const html of listingPages.filter(Boolean)) {
    for (const link of extractProductLinks(html, vendor)) {
      productLinks.add(link);
      if (productLinks.size >= maxProducts * 2) break;
    }
  }

  const results = [];
  for (const url of Array.from(productLinks).slice(0, maxProducts * 2)) {
    if (results.length >= maxProducts) break;
    try {
      const html = await fetchHtml(url);
      if (!html) continue;
      const parsed = extractVendorProductDocument({
        html,
        sourceUrl: url,
        vendor,
        titleSuffixes: vendor.profile?.title_suffixes || [],
        ingestionSource: "live-crawler",
      });
      if (parsed?.image_verified && parsed?.product_url_verified) {
        results.push(parsed);
      }
    } catch {
      // Skip malformed pages.
    }
  }

  return results;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.text()).slice(0, 500_000);
  } finally {
    clearTimeout(timeout);
  }
}

function extractProductLinks(html, vendor) {
  const links = [
    ...extractVendorProductLinks(html, vendor),
    ...extractFallbackHrefLinks(html, vendor),
  ];
  return Array.from(new Set(links));
}

function looksLikeVendorProductLink(url, vendor) {
  const path = safePath(url);
  const productTokens = vendor.profile?.product_path_tokens || ["product", "products", "item"];
  const rejectTokens = vendor.profile?.reject_path_tokens || ["search", "collections", "showrooms"];

  if (rejectTokens.some((token) => path.includes(`/${token}`))) return false;
  return productTokens.some((token) => path.includes(`/${token}`) || path.includes(`-${token}`));
}

function extractFallbackHrefLinks(html, vendor) {
  const matches = html.match(/href=["']([^"']+)["']/gi) || [];
  const links = [];

  for (const rawMatch of matches) {
    const href = rawMatch.replace(/^href=["']/, "").replace(/["']$/, "");
    const normalized = normalizeVendorUrl(href, vendor.domain);
    if (!normalized) continue;
    if (!normalized.includes(vendor.domain)) continue;
    if (!looksLikeVendorProductLink(normalized, vendor)) continue;
    links.push(normalized);
  }

  return links;
}

function safePath(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return String(url || "").toLowerCase();
  }
}
