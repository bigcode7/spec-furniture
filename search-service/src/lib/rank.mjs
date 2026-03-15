import { normalizeText, tokenize } from "./normalize.mjs";

export function searchCatalog(products, queryInput, filters = {}, intent = null) {
  const queries = Array.isArray(queryInput) ? queryInput : [queryInput];
  const variants = queries
    .map((query) => ({
      raw: query,
      normalized: normalizeText(query),
      tokens: tokenize(query),
    }))
    .filter((entry) => entry.normalized);

  return products
    .map((product) => scoreProduct(product, variants, filters, intent))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 60)
    .map((entry, index) => ({
      rank: index + 1,
      relevance_score: entry.score,
      reasoning: entry.reasoning,
      ...entry.product,
    }));
}

function scoreProduct(product, variants, filters, intent) {
  const haystack = normalizeText([
    product.product_name,
    product.vendor_name,
    product.category,
    product.style,
    product.material,
    product.description,
    ...(product.tags || []),
    ...(product.colors || []),
    product.collection,
    product.sku,
  ].join(" "));

  let score = 0;
  let matched = [];

  for (const variant of variants) {
    const candidate = scoreVariant(haystack, variant.normalized, variant.tokens);
    if (candidate.score > score) {
      score = candidate.score;
      matched = candidate.matched;
    }
  }

  if (intent?.product_type) {
    const productCategory = normalizeText(product.category);
    const requestedType = normalizeText(intent.product_type);
    if (productCategory.includes(requestedType)) {
      score += 24;
      matched.push("type match");
    } else if (requestedType.includes("chair") && !productCategory.includes("chair")) {
      score -= 20;
    } else if (requestedType.includes("sofa") && !productCategory.includes("sofa")) {
      score -= 20;
    } else if (requestedType.includes("table") && !productCategory.includes("table")) {
      score -= 20;
    }
  }

  if (intent?.style && normalizeText(product.style).includes(normalizeText(intent.style))) {
    score += 14;
    matched.push("style match");
  }

  if (intent?.material && normalizeText(product.material).includes(normalizeText(intent.material))) {
    score += 14;
    matched.push("material match");
  }

  if (intent?.color && (product.colors || []).some((color) => normalizeText(color).includes(normalizeText(intent.color)))) {
    score += 10;
    matched.push("color match");
  }

  if (intent?.vendor && normalizeText(product.vendor_name).includes(normalizeText(intent.vendor))) {
    score += 12;
    matched.push("vendor match");
  }

  if (typeof intent?.max_price === "number") {
    const comparablePrice = product.price_verified && typeof product.retail_price === "number"
      ? product.retail_price
      : product.price_verified && typeof product.wholesale_price === "number"
        ? product.wholesale_price
        : null;

    if (typeof comparablePrice === "number") {
      if (comparablePrice <= intent.max_price) {
        score += 12;
        matched.push("within budget");
      } else {
        score -= 18;
      }
    }
  }

  if (filters.category && normalizeText(product.category).includes(normalizeText(filters.category))) {
    score += 18;
    matched.push("category filter");
  }

  if (filters.material && normalizeText(product.material).includes(normalizeText(filters.material))) {
    score += 12;
    matched.push("material filter");
  }

  if (filters.style && normalizeText(product.style).includes(normalizeText(filters.style))) {
    score += 12;
    matched.push("style filter");
  }

  if (filters.vendor && normalizeText(product.vendor_name).includes(normalizeText(filters.vendor))) {
    score += 12;
    matched.push("vendor filter");
  }

  if (typeof filters.max_price === "number" && product.price_verified && typeof product.wholesale_price === "number") {
    if (product.wholesale_price <= filters.max_price) {
      score += 8;
      matched.push("within price");
    } else {
      score -= 10;
    }
  }

  if (typeof filters.max_lead_time_weeks === "number" && typeof product.lead_time_weeks === "number") {
    if (product.lead_time_weeks <= filters.max_lead_time_weeks) {
      score += 6;
      matched.push("within lead time");
    } else {
      score -= 6;
    }
  }

  if (product.image_verified && product.image_url) score += 8;
  if (product.product_url_verified && product.product_url) score += 8;
  if (typeof product.retrieval_quality_score === "number" && product.retrieval_quality_score > 0) {
    score += Math.min(12, Math.round(product.retrieval_quality_score / 8));
    matched.push("retrieval confidence");
  }
  if (product.ingestion_source === "live-crawler") score += 8;
  if (product.ingestion_source === "live-discovery") score += 5;

  return {
    product,
    score: Math.max(0, Math.min(99, Math.round(score))),
    reasoning: matched.length ? matched.join(" · ") : "weak match",
  };
}

function scoreVariant(haystack, normalizedQuery, queryTokens) {
  let score = 0;
  const matched = [];

  if (haystack.includes(normalizedQuery)) {
    score += 45;
    matched.push("exact query phrase");
  }

  const overlap = queryTokens.reduce((count, token) => count + (haystack.includes(token) ? 1 : 0), 0);
  score += overlap * 9;
  if (overlap > 0) matched.push(`${overlap} token matches`);

  const tokenCoverage = queryTokens.length > 0 ? overlap / queryTokens.length : 0;
  if (tokenCoverage >= 0.7) {
    score += 10;
    matched.push("strong token coverage");
  } else if (tokenCoverage >= 0.4) {
    score += 4;
  }

  return { score, matched };
}
