function asNumber(value) {
  return typeof value === "number" ? value : Number(value || 0);
}

function formatMoney(value) {
  return `$${Math.round(asNumber(value)).toLocaleString()}`;
}

function computeCommission(item) {
  return Math.round(asNumber(item.wholesale_price) * asNumber(item.commission_rate || 0.1));
}

function getLeadTime(item) {
  return asNumber(item.lead_time_min_weeks || item.lead_time_weeks || item.lead_time_max_weeks || 0);
}

export function buildCompareInsights(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  const pricedItems = items.filter((item) => asNumber(item.wholesale_price) > 0);
  const leadTimedItems = items.filter((item) => getLeadTime(item) > 0);
  const lowestPrice = pricedItems.length
    ? [...pricedItems].sort((a, b) => asNumber(a.wholesale_price) - asNumber(b.wholesale_price))[0]
    : null;
  const fastestLead = leadTimedItems.length
    ? [...leadTimedItems].sort((a, b) => getLeadTime(a) - getLeadTime(b))[0]
    : null;
  const highestCommission = items.length
    ? [...items].sort((a, b) => computeCommission(b) - computeCommission(a))[0]
    : null;

  const bestOverall = [...items].sort((a, b) => scoreCompareItem(b) - scoreCompareItem(a))[0] || null;

  const materials = countValues(items.map((item) => item.material).filter(Boolean));
  const manufacturers = countValues(items.map((item) => item.manufacturer_name).filter(Boolean));

  return {
    headline: bestOverall
      ? `${bestOverall.product_name} leads the shortlist on overall sourcing balance.`
      : "Compare shortlist ready.",
    recommendation: buildCompareRecommendation({ bestOverall, lowestPrice, fastestLead, highestCommission }),
    highlights: [
      lowestPrice
        ? { label: "Best cost position", value: `${lowestPrice.product_name} at ${formatMoney(lowestPrice.wholesale_price)}` }
        : null,
      fastestLead
        ? { label: "Fastest ship window", value: `${fastestLead.product_name} in about ${getLeadTime(fastestLead)} weeks` }
        : null,
      highestCommission
        ? { label: "Strongest commission", value: `${highestCommission.product_name} at about ${formatMoney(computeCommission(highestCommission))}` }
        : null,
    ].filter(Boolean),
    signals: [
      materials[0] ? `Material signal: ${materials[0].value} appears most often across the shortlist.` : null,
      manufacturers[0] ? `Vendor spread: ${manufacturers.length} manufacturers represented, led by ${manufacturers[0].value}.` : null,
      bestOverall && lowestPrice && bestOverall.id !== lowestPrice.id
        ? `${bestOverall.product_name} is not the cheapest option, but it balances speed, price, and margin better than the rest.`
        : null,
    ].filter(Boolean),
  };
}

export function buildProjectInsights(project, items) {
  const safeItems = Array.isArray(items) ? items : [];
  const budget = asNumber(project?.budget);
  const total = safeItems.reduce((sum, item) => sum + asNumber(item.price) * asNumber(item.quantity || 1), 0);
  const remaining = budget - total;
  const leadTimes = safeItems.map((item) => asNumber(item.lead_time_weeks)).filter(Boolean);
  const slowestLead = leadTimes.length ? Math.max(...leadTimes) : null;
  const manufacturers = countValues(safeItems.map((item) => item.manufacturer_name).filter(Boolean));

  return {
    summary: `${project?.title || "Project"} currently carries ${safeItems.length} specified items with ${remaining >= 0 ? `${formatMoney(remaining)} remaining` : `${formatMoney(Math.abs(remaining))} over budget`}.`,
    nextActions: [
      safeItems.length === 0 ? "Build an initial shortlist from search so the client can react to a real direction." : null,
      remaining < 0 ? "Trim or swap the highest-cost pieces before client handoff to protect budget credibility." : null,
      slowestLead && slowestLead > 10 ? `Flag the slowest lead-time pieces early. Current longest window is about ${slowestLead} weeks.` : null,
      manufacturers.length >= 3 ? `Consolidate vendors where possible. The current spec spans ${manufacturers.length} manufacturers.` : null,
      remaining >= 0 && safeItems.length > 0 ? "Generate a client-ready brief and push the strongest options into presentation format." : null,
    ].filter(Boolean),
    riskFlags: [
      remaining < 0 ? "Budget risk detected." : null,
      slowestLead && slowestLead > 10 ? "Lead-time risk detected." : null,
      safeItems.length === 0 ? "No spec depth yet." : null,
    ].filter(Boolean),
  };
}

export function buildSearchInsights(intent, results, diagnostics) {
  const safeResults = Array.isArray(results) ? results : [];
  if (!intent || safeResults.length === 0) {
    return null;
  }

  const top = safeResults[0] || null;
  const liveCount = asNumber(diagnostics?.live_result_count);
  const verifiedCount = asNumber(diagnostics?.verified_result_count || diagnostics?.verified_link_count);
  const fallbackMode = Boolean(diagnostics?.fallback_to_catalog);
  const resultMode = diagnostics?.result_mode || "";
  const vendorCount = asNumber(diagnostics?.manufacturer_count || diagnostics?.vendor_count);
  const underBudget = typeof intent.max_price === "number"
    ? safeResults.filter((item) => {
        const price = item.price_verified ? asNumber(item.retail_price || item.wholesale_price) : 0;
        return price > 0 && price <= intent.max_price;
      }).length
    : null;

  return {
    headline: top
      ? `${top.product_name} is the current lead recommendation.`
      : "Search brief ready.",
    summary: buildSearchSummary({ intent, safeResults, vendorCount, fallbackMode, verifiedCount }),
    recommendation: buildSearchRecommendation({ intent, top, underBudget, fallbackMode, liveCount, verifiedCount }),
    coverageNote: buildCoverageNote({ liveCount, fallbackMode, vendorCount, verifiedCount, resultMode }),
    signalPills: [
      vendorCount ? `${vendorCount} vendors in the shortlist` : null,
      verifiedCount > 0 ? `${verifiedCount} verified vendor results` : null,
      typeof underBudget === "number" && underBudget > 0 ? `${underBudget} with verified budget data` : null,
      liveCount > 0 ? `${liveCount} live vendor results` : "Catalog-backed shortlist",
    ].filter(Boolean),
    nextActions: [
      top ? `Open ${top.product_name} first, then compare the top 3 results side by side.` : null,
      fallbackMode ? "Use this shortlist to frame direction, then validate final picks against live vendor portals." : null,
      verifiedCount === 0 ? "No verified vendor links are available yet for this brief, so treat these as directional until live retrieval improves." : null,
      intent.max_price && typeof underBudget === "number" && underBudget < Math.min(3, safeResults.length)
        ? "Budget is constraining the field. Consider relaxing price or exploring adjacent materials."
        : null,
      intent.material && safeResults.every((item) => item.material !== intent.material)
        ? `Material fit is thin. Expand the search to adjacent upholstery or finish families.`
        : null,
    ].filter(Boolean),
    refinementPrompts: buildRefinementPrompts(intent, safeResults, underBudget),
  };
}

function scoreCompareItem(item) {
  const price = asNumber(item.wholesale_price);
  const leadTime = getLeadTime(item);
  const commission = computeCommission(item);

  let score = 0;
  if (price > 0) score += Math.max(0, 40 - price / 150);
  if (leadTime > 0) score += Math.max(0, 25 - leadTime * 1.5);
  score += Math.min(20, commission / 120);
  if (item.material) score += 6;
  if (item.image_url) score += 4;
  return score;
}

function buildCompareRecommendation({ bestOverall, lowestPrice, fastestLead, highestCommission }) {
  if (!bestOverall) return "Add more listings to generate a stronger recommendation.";
  if (bestOverall.id === lowestPrice?.id) {
    return `${bestOverall.product_name} is the strongest value play right now. It combines the best overall score with the lowest cost position.`;
  }
  if (bestOverall.id === fastestLead?.id) {
    return `${bestOverall.product_name} is the best execution pick. It gives you the strongest overall profile and the quickest path to fulfillment.`;
  }
  if (bestOverall.id === highestCommission?.id) {
    return `${bestOverall.product_name} leads commercially. It is the strongest overall option and the most attractive for margin.`;
  }
  return `${bestOverall.product_name} is the best balanced recommendation for presentation. It is not winning on a single metric, but it holds up best across the full sourcing picture.`;
}

function countValues(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

function buildSearchSummary({ intent, safeResults, vendorCount, fallbackMode, verifiedCount }) {
  const parts = [];
  if (intent.product_type) parts.push(intent.product_type.replace(/_/g, " "));
  if (intent.material) parts.push(intent.material);
  if (intent.style) parts.push(intent.style);

  const basis = parts.length ? parts.join(" ") : "search brief";
  const source = verifiedCount > 0 ? "verified vendor-backed" : fallbackMode ? "catalog-backed" : "live vendor-backed";

  return `Spekd translated this request into a ${source} ${basis} shortlist across ${vendorCount || safeResults.length} vendor options.`;
}

function buildSearchRecommendation({ intent, top, underBudget, fallbackMode, liveCount, verifiedCount }) {
  if (!top) return "Refine the brief and re-run search to generate a stronger recommendation.";

  const parts = [`${top.product_name} leads because it is the strongest overall fit for the current brief.`];
  if (typeof intent.max_price === "number" && typeof underBudget === "number" && underBudget > 0) {
    parts.push(underBudget > 0 ? `${underBudget} of the shortlisted items appear to fit the budget cap.` : "Budget fit is currently thin.");
  }
  if (verifiedCount > 0) {
    parts.push("Verified vendor pages are contributing trusted photos and click-through links to this shortlist.");
  } else if (liveCount > 0) {
    parts.push("Live vendor retrieval is contributing to this shortlist.");
  } else if (fallbackMode) {
    parts.push("This is still a guided shortlist, but final vendor validation is still needed.");
  }
  return parts.join(" ");
}

function buildCoverageNote({ liveCount, fallbackMode, vendorCount, verifiedCount, resultMode }) {
  if (verifiedCount > 0) {
    return `Spekd is prioritizing verified vendor assets across ${vendorCount || verifiedCount} manufacturers for this shortlist.`;
  }
  if (liveCount > 0) {
    return `Spekd found live product candidates, but they still need stronger verification before they can be treated as trusted vendor results.`;
  }
  if (fallbackMode) {
    return resultMode === "directional-catalog-fallback"
      ? "Live vendor retrieval is still thin, so Spekd is using the normalized catalog to preserve sourcing flow."
      : "No verified vendor assets were found for this brief yet.";
  }
  return null;
}

function buildRefinementPrompts(intent, results, underBudget) {
  const prompts = [];
  const type = intent?.product_type?.replace(/_/g, " ");

  if (type && !intent.style) {
    prompts.push(`luxury ${type}`);
    prompts.push(`modern ${type}`);
  }

  if (type && !intent.material) {
    prompts.push(`boucle ${type}`);
    prompts.push(`performance fabric ${type}`);
  }

  if (typeof intent?.max_price === "number" && typeof underBudget === "number" && underBudget <= 2) {
    prompts.push(`${type || "furniture"} under $${Math.round(intent.max_price * 1.2).toLocaleString()}`);
  }

  if (intent?.material && !intent?.color) {
    prompts.push(`${intent.material} ${type || "furniture"} in light neutrals`);
  }

  if (results.length > 0) {
    const topVendor = results[0]?.manufacturer_name;
    if (topVendor) {
      prompts.push(`${type || "furniture"} like ${topVendor}`);
    }
  }

  return Array.from(new Set(prompts.filter(Boolean))).slice(0, 4);
}
