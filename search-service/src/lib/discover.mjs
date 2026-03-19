import { priorityVendors } from "../config/vendors.mjs";
import { normalizeText } from "./normalize.mjs";
import { extractVendorProductDocument, extractVendorProductLinks, looksProductLike, normalizeVendorUrl } from "./vendor-product.mjs";
import { aiExtractProduct } from "./ai-search.mjs";

const USER_AGENT = "Mozilla/5.0 (compatible; SpekdSearchBot/1.0; +https://spekd.design)";

export async function discoverLiveVendorProducts(query, { vendorIds = [], maxVendors = 8, perVendor = 2, intent = null } = {}) {
  const vendors = (vendorIds.length
    ? priorityVendors.filter((vendor) => vendorIds.includes(vendor.id))
    : priorityVendors
  ).slice(0, maxVendors);

  const vendorResults = await Promise.allSettled(
    vendors.map((vendor) => discoverVendorProducts(query, vendor, perVendor, intent)),
  );

  const discovered = [];
  for (const result of vendorResults) {
    if (result.status === "fulfilled") {
      discovered.push(...result.value);
    }
  }

  return dedupeProducts(discovered);
}

async function discoverVendorProducts(query, vendor, perVendor, intent) {
  const nativeTargets = getVendorDiscoveryTargets(vendor, query, intent);
  let links = [];

  // Run all discovery targets for a vendor in parallel
  const targetResults = await Promise.allSettled(
    nativeTargets.map((target) => fetchHtml(target)),
  );
  for (const result of targetResults) {
    if (result.status === "fulfilled" && result.value) {
      links.push(...extractNativeLinks(result.value, vendor));
    }
  }

  if (links.length === 0) {
    // Run DuckDuckGo fallback searches in parallel
    const ddgUrls = [
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:${vendor.domain} ${query}`)}`,
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${vendor.domain} ${query} buy`)}`,
    ];
    const ddgResults = await Promise.allSettled(ddgUrls.map((url) => fetchHtml(url)));
    for (const result of ddgResults) {
      if (result.status === "fulfilled" && result.value) {
        links.push(...extractSearchResultLinks(result.value, vendor));
      }
    }
  }

  links = Array.from(new Set(links)).slice(0, perVendor * 4);
  const products = [];

  for (const url of links) {
    if (products.length >= perVendor) break;
    try {
      const pageHtml = await fetchHtml(url);
      if (!pageHtml) continue;
      const product = extractVendorProductDocument({
        html: pageHtml,
        sourceUrl: url,
        vendor,
        titleSuffixes: vendor.profile?.title_suffixes || [],
        ingestionSource: "live-discovery",
      });
      if (product?.image_verified && product?.product_url_verified) {
        products.push(product);
      } else {
        // AI extraction fallback when standard extraction fails
        try {
          const aiProduct = await aiExtractProduct(pageHtml, url);
          if (aiProduct?.product_name) {
            products.push({
              ...aiProduct,
              product_url: url,
              product_url_verified: true,
              vendor_id: vendor.id,
              vendor_name: aiProduct.vendor_name || vendor.name,
              manufacturer_name: aiProduct.vendor_name || vendor.name,
              domain: vendor.domain,
              ingestion_source: "ai-extraction",
              image_verified: false,
            });
          }
        } catch {
          // AI extraction also failed, skip
        }
      }
    } catch {
      // Skip malformed result.
    }
  }

  return products;
}

function getVendorDiscoveryTargets(vendor, query, intent) {
  const targets = [];
  const baseUrl = `https://${vendor.domain}`;
  const profile = vendor.discovery || {};
  const categoryKey = normalizeText(intent?.product_type || "");

  for (const path of profile.search_paths || []) {
    targets.push(buildVendorUrl(baseUrl, path, query));
  }

  if (categoryKey && profile.category_paths?.[categoryKey]) {
    for (const path of profile.category_paths[categoryKey]) {
      targets.push(buildVendorUrl(baseUrl, path, query));
    }
  }

  return Array.from(new Set(targets.filter(Boolean)));
}

function buildVendorUrl(baseUrl, path, query) {
  if (!path) return null;
  const resolvedPath = path.replaceAll("{query}", encodeURIComponent(query));
  try {
    return new URL(resolvedPath, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
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

function extractSearchResultLinks(html, vendor) {
  const links = [];
  const anchorMatches = html.match(/<a[^>]+href="([^"]+)"[^>]*>/gi) || [];

  for (const raw of anchorMatches) {
    const href = raw.match(/href="([^"]+)"/i)?.[1];
    const resolved = resolveSearchHref(href);
    if (!resolved) continue;
    if (!resolved.includes(vendor.domain)) continue;
    if (!looksProductLike(resolved, vendor)) continue;
    links.push(resolved);
  }

  return Array.from(new Set(links));
}

function extractNativeLinks(html, vendor) {
  const links = [
    ...extractVendorProductLinks(html, vendor),
    ...extractAnchorLinks(html, vendor),
  ];
  return Array.from(new Set(links));
}

function resolveSearchHref(href) {
  if (!href) return null;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http://") || href.startsWith("https://")) return href;

  try {
    const wrapped = new URL(href, "https://html.duckduckgo.com");
    const uddg = wrapped.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : null;
  } catch {
    return null;
  }
}

function dedupeProducts(products) {
  const seen = new Map();
  for (const product of products) {
    const key = `${product.vendor_id}::${product.product_url || product.product_name}`.toLowerCase();
    if (!seen.has(key)) seen.set(key, product);
  }
  return Array.from(seen.values());
}

function extractAnchorLinks(html, vendor) {
  const links = [];
  const anchorMatches = html.match(/<a[^>]+href="([^"]+)"[^>]*>/gi) || [];

  for (const raw of anchorMatches) {
    const href = raw.match(/href="([^"]+)"/i)?.[1];
    const resolved = normalizeVendorUrl(href, vendor.domain);
    if (!resolved) continue;
    if (!resolved.includes(vendor.domain)) continue;
    if (!looksProductLike(resolved, vendor)) continue;
    links.push(resolved);
  }

  return links;
}
