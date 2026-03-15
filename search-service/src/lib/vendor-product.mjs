import { normalizeText, slugify } from "./normalize.mjs";

const DEFAULT_IMAGE_PATH_HINTS = ["/products/", "/product/", "/items/", "/media/", "/images/", "/catalog/"];

export function extractVendorProductDocument({ html, sourceUrl, vendor, titleSuffixes = [], ingestionSource }) {
  const profile = vendor.profile || {};
  const jsonLd = extractProductJsonLd(html);
  const nextData = extractNextDataProduct(html);
  const embeddedState = extractEmbeddedStateProduct(html);
  const pageImages = extractImageCandidates(html, vendor.domain);
  const metaTitle = extractMeta(html, "property", "og:title") || extractTagTitle(html);
  const metaDescription = extractMeta(html, "property", "og:description") || extractMeta(html, "name", "description");
  const metaImage = extractMeta(html, "property", "og:image") || extractMeta(html, "name", "twitter:image");
  const canonicalUrl = normalizeVendorUrl(firstNonEmpty([extractCanonical(html), extractMeta(html, "property", "og:url")]), vendor.domain);

  const productName = cleanTitle(
    firstNonEmpty([jsonLd?.name, nextData?.name, embeddedState?.name, metaTitle]),
    [...(profile.title_suffixes || []), ...titleSuffixes],
  );
  if (!productName) return null;

  const productUrl = normalizeVendorUrl(
    firstNonEmpty([canonicalUrl, jsonLd?.url, nextData?.url, embeddedState?.url, extractInlineProductUrl(html), sourceUrl]),
    vendor.domain,
  );
  const imageUrl = normalizeVendorUrl(
    firstNonEmpty([jsonLd?.image, nextData?.image, embeddedState?.image, metaImage, ...pageImages]),
    vendor.domain,
  );
  const description = decodeEntities(firstNonEmpty([jsonLd?.description, nextData?.description, embeddedState?.description, metaDescription]));
  const sku = firstNonEmpty([jsonLd?.sku, nextData?.sku, embeddedState?.sku, extractSku(html)]);
  const collection = firstNonEmpty([jsonLd?.collection, nextData?.collection, embeddedState?.collection, inferCollection(productName, description)]);
  const combined = normalizeText([
    productName,
    description,
    jsonLd?.category,
    nextData?.category,
    embeddedState?.category,
    collection,
    sku,
  ].filter(Boolean).join(" "));
  const category = firstNonEmpty([
    jsonLd?.category,
    nextData?.category,
    embeddedState?.category,
    inferCategory(combined),
  ]) || "furniture";
  const material = firstNonEmpty([
    jsonLd?.material,
    nextData?.material,
    embeddedState?.material,
    inferMaterial(combined),
  ]) || null;
  const style = firstNonEmpty([
    nextData?.style,
    embeddedState?.style,
    inferStyle(combined),
  ]) || null;
  const colors = Array.from(new Set([
    ...(jsonLd?.colors || []),
    ...(nextData?.colors || []),
    ...(embeddedState?.colors || []),
    ...inferColors(combined),
  ].filter(Boolean)));
  const tags = Array.from(new Set([
    category,
    style,
    material,
    collection,
    ...(jsonLd?.tags || []),
    ...(nextData?.tags || []),
    ...(embeddedState?.tags || []),
  ].filter(Boolean)));
  const verification = buildVerificationMeta({
    imageUrl,
    productUrl,
    vendor,
    hasJsonLd: Boolean(jsonLd?.name || jsonLd?.sku),
    hasEmbeddedState: Boolean(nextData?.name || embeddedState?.name),
    hasDescription: Boolean(description),
    hasSku: Boolean(sku),
    hasCollection: Boolean(collection),
  });

  return {
    id: `${vendor.id}-${slugify(productName)}${sku ? `-${slugify(sku)}` : ""}`,
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    vendor_domain: vendor.domain,
    product_name: productName,
    category: normalizeCategory(category),
    style,
    material,
    colors,
    tags,
    description,
    image_url: imageUrl,
    product_url: productUrl,
    retail_price: null,
    wholesale_price: null,
    price_verified: false,
    lead_time_weeks: null,
    sku: sku || null,
    collection: collection || null,
    image_verified: verification.image_verified,
    product_url_verified: verification.product_url_verified,
    title_verified: verification.title_verified,
    retrieval_quality_score: verification.retrieval_quality_score,
    retrieval_signals: verification.retrieval_signals,
    ingestion_source: ingestionSource,
    ingested_at: new Date().toISOString(),
  };
}

export function buildVerificationMeta({ imageUrl, productUrl, vendor, hasJsonLd, hasEmbeddedState, hasDescription, hasSku, hasCollection }) {
  const imageVerified = isVendorImageUrl(imageUrl, vendor);
  const urlVerified = isVendorProductUrl(productUrl, vendor);
  const titleVerified = Boolean(productUrl);
  const canonicalPathVerified = urlVerified && looksProductLike(productUrl, vendor);
  let score = 0;

  if (urlVerified) score += 30;
  if (imageVerified) score += 28;
  if (titleVerified) score += 14;
  if (canonicalPathVerified) score += 10;
  if (hasJsonLd) score += 7;
  if (hasEmbeddedState) score += 6;
  if (hasDescription) score += 4;
  if (hasSku) score += 4;
  if (hasCollection) score += 2;

  return {
    image_verified: imageVerified,
    product_url_verified: urlVerified,
    title_verified: titleVerified,
    retrieval_quality_score: Math.min(99, score),
    retrieval_signals: [
      urlVerified ? "vendor url verified" : null,
      imageVerified ? "vendor image verified" : null,
      canonicalPathVerified ? "product path verified" : null,
      hasJsonLd ? "product schema" : null,
      hasEmbeddedState ? "embedded product state" : null,
      hasSku ? "sku found" : null,
      hasCollection ? "collection found" : null,
      hasDescription ? "description found" : null,
    ].filter(Boolean),
  };
}

export function looksProductLike(url, vendor) {
  const path = safePath(url);
  const productTokens = vendor.profile?.product_path_tokens || ["product", "products", "item", "sku", "detail"];
  const rejectTokens = vendor.profile?.reject_path_tokens || ["search", "showrooms", "designers", "trade-program", "collections"];
  const listingTokens = vendor.profile?.listing_path_tokens || [];

  if (rejectTokens.some((token) => path.includes(`/${token}`) || path.endsWith(token))) return false;
  if (listingTokens.some((token) => path === `/${token}` || path.endsWith(`/${token}`))) return false;
  return productTokens.some((token) => path.includes(`/${token}`) || path.includes(`${token}-`) || path.includes(`-${token}`));
}

export function normalizeVendorUrl(value, vendorDomain) {
  const input = sanitize(value);
  if (!input) return null;
  try {
    if (input.startsWith("http://") || input.startsWith("https://")) return new URL(input).toString();
    if (input.startsWith("//")) return new URL(`https:${input}`).toString();
    return new URL(input, `https://${vendorDomain}`).toString();
  } catch {
    return null;
  }
}

export function isVendorProductUrl(url, vendor) {
  return isVendorHostedUrl(url, [vendor.domain, ...(vendor.profile?.asset_hosts || [])]) && looksProductLike(url, vendor);
}

export function isVendorImageUrl(url, vendor) {
  if (!isVendorHostedUrl(url, [vendor.domain, ...(vendor.profile?.asset_hosts || [])])) return false;
  const pathname = safePath(url);
  const hints = vendor.profile?.image_path_hints || DEFAULT_IMAGE_PATH_HINTS;
  return hints.some((hint) => pathname.includes(hint)) || /\.(png|jpe?g|webp|avif)(\?|$)/i.test(pathname);
}

export function extractVendorProductLinks(html, vendor) {
  const candidates = [
    ...extractAttributeUrls(html, ["href", "data-product-url", "data-url", "data-href", "data-link"]),
    ...extractInlineUrls(html),
  ];

  const normalized = candidates
    .map((value) => normalizeVendorUrl(value, vendor.domain))
    .filter(Boolean)
    .filter((url) => url.includes(vendor.domain))
    .filter((url) => looksProductLike(url, vendor));

  return Array.from(new Set(normalized));
}

function extractProductJsonLd(html) {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const script of scripts) {
    const raw = script.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "").trim();
    const parsed = safeJson(raw);
    const product = findProductNode(parsed);
    if (product) {
      return normalizeCandidate(product);
    }
  }
  return null;
}

function extractNextDataProduct(html) {
  const match = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  const parsed = safeJson(match?.[1] || "");
  return normalizeCandidate(findProductNode(parsed));
}

function extractEmbeddedStateProduct(html) {
  const scriptBodies = [];
  const patterns = [
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/i,
    /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});/i,
    /window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});/i,
    /window\.__NUXT__\s*=\s*({[\s\S]*?});/i,
    /ShopifyAnalytics\.meta\s*=\s*({[\s\S]*?});/i,
    /"product"\s*:\s*({[\s\S]*?"(?:seo|variants|media|images)"[\s\S]*?})/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      scriptBodies.push(match[1]);
    }
  }

  for (const raw of scriptBodies) {
    const parsed = safeJson(raw);
    const product = findProductNode(parsed);
    const normalized = normalizeCandidate(product);
    if (normalized?.name || normalized?.image) return normalized;
  }

  return null;
}

function normalizeCandidate(candidate) {
  if (!candidate || typeof candidate !== "object") return null;
  const attributes = Array.isArray(candidate.attributes) ? candidate.attributes : [];
  const attributeValue = (keys) => {
    const keySet = new Set(keys.map((key) => normalizeText(key)));
    const match = attributes.find((item) => keySet.has(normalizeText(item?.name || item?.key || item?.attribute_code || "")));
    return sanitize(match?.value || match?.label || match?.option || "");
  };

  return {
    name: sanitize(candidate.name || candidate.title || candidate.productName || candidate.fullName),
    image: normalizeImageCandidate(candidate.image || candidate.image_url || candidate.featuredImage || candidate.primaryImage || candidate.thumbnail || candidate.media),
    description: sanitize(candidate.description || candidate.shortDescription || candidate.meta_description || candidate.summary),
    url: sanitize(candidate.url || candidate.canonical || candidate.productUrl || candidate.pdpUrl || candidate.link),
    sku: sanitize(candidate.sku || candidate.productNumber || candidate.mpn || candidate.model || candidate.id),
    category: sanitize(candidate.category || candidate.productType || candidate.type || candidate.department),
    material: sanitize(candidate.material || attributeValue(["material", "fabric", "finish", "upholstery"])),
    style: sanitize(candidate.style || attributeValue(["style", "collection style"])),
    collection: sanitize(candidate.collection || candidate.collectionName || attributeValue(["collection", "series"])),
    colors: extractArray(candidate.color || candidate.colors || candidate.colour || attributeValue(["color", "colour"])),
    tags: extractArray(candidate.tags || candidate.keywords),
  };
}

function findProductNode(value, depth = 0) {
  if (!value || depth > 7) return null;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 40)) {
      const found = findProductNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;

  const type = normalizeText(value["@type"] || value.type || value.__typename || "");
  if (type.includes("product")) return value;
  if (looksLikeProductObject(value)) return value;

  if (Array.isArray(value["@graph"])) {
    const found = findProductNode(value["@graph"], depth + 1);
    if (found) return found;
  }

  for (const child of Object.values(value).slice(0, 60)) {
    const found = findProductNode(child, depth + 1);
    if (found) return found;
  }
  return null;
}

function looksLikeProductObject(value) {
  const text = normalizeText([
    value?.name,
    value?.title,
    value?.productName,
    value?.description,
    value?.sku,
    value?.url,
  ].filter(Boolean).join(" "));
  const media = normalizeImageCandidate(value?.image || value?.featuredImage || value?.primaryImage || value?.thumbnail || value?.media);
  return Boolean((value?.name || value?.title || value?.productName) && (value?.sku || media || text.includes("chair") || text.includes("table") || text.includes("sofa")));
}

function extractMeta(html, attrName, attrValue) {
  const escaped = escapeRegExp(attrValue);
  const pattern = new RegExp(
    `<meta[^>]+${attrName}=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${escaped}["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return decodeEntities(match?.[1] || match?.[2] || "");
}

function extractInlineProductUrl(html) {
  const patterns = [
    /"canonical"\s*:\s*"([^"]+)"/i,
    /"productUrl"\s*:\s*"([^"]+)"/i,
    /"pdpUrl"\s*:\s*"([^"]+)"/i,
    /data-product-url=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function extractCanonical(html) {
  const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  return match?.[1] || null;
}

function extractTagTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return decodeEntities(match?.[1] || "");
}

function extractSku(html) {
  const patterns = [
    /"sku"\s*:\s*"([^"]+)"/i,
    /data-sku=["']([^"']+)["']/i,
    /SKU[:\s<]+([A-Z0-9-]{4,})/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function inferCategory(text) {
  return detectFirst(text, [
    "swivel chair",
    "accent chair",
    "dining chair",
    "chair",
    "sectional sofa",
    "sofa",
    "coffee table",
    "cocktail table",
    "dining table",
    "console table",
    "bed",
    "dresser",
  ]);
}

function normalizeCategory(category) {
  const normalized = normalizeText(category);
  if (normalized === "accent chair") return "chair";
  if (normalized === "cocktail table") return "coffee table";
  return normalized || "furniture";
}

function inferMaterial(text) {
  return detectFirst(text, [
    "performance fabric",
    "boucle",
    "velvet",
    "leather",
    "linen",
    "oak",
    "walnut",
    "marble",
    "travertine",
    "wood",
    "metal",
    "rattan",
  ]);
}

function inferStyle(text) {
  return detectFirst(text, [
    "mid century modern",
    "luxury modern",
    "contemporary",
    "transitional",
    "coastal",
    "glam",
    "modern",
    "traditional",
    "organic modern",
  ]);
}

function inferColors(text) {
  const colors = [
    "ivory", "taupe", "cream", "stone", "oatmeal", "moss", "sand", "mist",
    "emerald", "camel", "blush", "cognac", "espresso", "bone", "charcoal",
    "cloud", "slate", "sage", "graphite", "truffle", "smoke", "brown",
    "navy", "blue", "green", "gray", "grey", "black", "white", "beige",
  ];
  return colors.filter((color) => text.includes(color));
}

function inferCollection(productName, description) {
  const combined = `${productName} ${description}`;
  const match = combined.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s+(Collection|Series)\b/);
  return match ? `${match[1]} ${match[2]}` : "";
}

function detectFirst(text, options) {
  const haystack = normalizeText(text);
  return options.find((option) => haystack.includes(normalizeText(option))) || null;
}

function normalizeImageCandidate(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const next = normalizeImageCandidate(item);
      if (next) return next;
    }
    return "";
  }
  if (typeof value === "object") {
    return normalizeImageCandidate(
      value.url || value.src || value.originalSrc || value.secure_url || value.imageUrl || value.large || value.medium,
    );
  }
  return "";
}

function extractImageCandidates(html, vendorDomain) {
  const values = [
    ...extractAttributeUrls(html, ["src", "data-src", "data-zoom-image", "data-image", "data-srcset"]),
    ...extractSrcsetUrls(html),
    ...extractInlineImageUrls(html),
  ];

  const normalized = values
    .map((value) => normalizeVendorUrl(value, vendorDomain))
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function extractAttributeUrls(html, attributes) {
  const values = [];
  for (const attribute of attributes) {
    const pattern = new RegExp(`${attribute}=["']([^"']+)["']`, "gi");
    for (const match of html.matchAll(pattern)) {
      if (match[1]) values.push(match[1]);
    }
  }
  return values;
}

function extractSrcsetUrls(html) {
  const values = [];
  const pattern = /srcset=["']([^"']+)["']/gi;
  for (const match of html.matchAll(pattern)) {
    const parts = String(match[1] || "").split(",").map((item) => item.trim().split(/\s+/)[0]).filter(Boolean);
    values.push(...parts);
  }
  return values;
}

function extractInlineUrls(html) {
  const values = [];
  const patterns = [
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
    /["'](\/[^"' ]*(?:product|products|item|detail)[^"']*)["']/gi,
    /"url"\s*:\s*"([^"]*(?:product|products|item|detail)[^"]*)"/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (match[1]) values.push(match[1]);
    }
  }
  return values;
}

function extractInlineImageUrls(html) {
  const values = [];
  const patterns = [
    /"image"\s*:\s*"([^"]+)"/gi,
    /"image_url"\s*:\s*"([^"]+)"/gi,
    /"featuredImage"\s*:\s*{"url"\s*:\s*"([^"]+)"/gi,
  ];
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      if (match[1]) values.push(match[1]);
    }
  }
  return values;
}

function extractArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => sanitize(item)).filter(Boolean);
  if (typeof value === "string") {
    return value.split(/[|,/]/).map((item) => sanitize(item)).filter(Boolean);
  }
  return [];
}

function firstNonEmpty(values) {
  return values.find((value) => sanitize(value)) || "";
}

function cleanTitle(value, suffixes) {
  let next = decodeEntities(value || "").trim();
  for (const suffix of suffixes) {
    if (next.toLowerCase().endsWith(String(suffix).toLowerCase())) {
      next = next.slice(0, -String(suffix).length).trim();
    }
  }
  return next.replace(/\s*[\|\-–:]+$/g, "").trim();
}

function safeJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safePath(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return String(url || "").toLowerCase();
  }
}

function sanitize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isVendorHostedUrl(value, hosts) {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "");
    return hosts.some((host) => hostname.includes(String(host).replace(/^www\./, "")));
  } catch {
    return false;
  }
}
