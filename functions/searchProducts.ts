import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Wholesale / trade furniture manufacturers only — no retailers, no marketplaces
const MANUFACTURERS = [
  { domain: "hookerfurniture.com",       name: "Hooker Furniture",        portal: "https://www.hookerfurniture.com" },
  { domain: "bernhardt.com",             name: "Bernhardt",               portal: "https://www.bernhardt.com" },
  { domain: "fourhands.com",             name: "Four Hands",              portal: "https://www.fourhands.com" },
  { domain: "universalfurniture.com",    name: "Universal Furniture",     portal: "https://www.universalfurniture.com" },
  { domain: "theodorealexander.com",     name: "Theodore Alexander",      portal: "https://www.theodorealexander.com" },
  { domain: "vanguardfurniture.com",     name: "Vanguard Furniture",      portal: "https://www.vanguardfurniture.com" },
  { domain: "hickorychair.com",          name: "Hickory Chair",           portal: "https://www.hickorychair.com" },
  { domain: "caracole.com",              name: "Caracole",                portal: "https://www.caracole.com" },
  { domain: "lexington.com",             name: "Lexington Home Brands",   portal: "https://www.lexington.com" },
  { domain: "bassettfurniture.com",      name: "Bassett Furniture",       portal: "https://www.bassettfurniture.com" },
  { domain: "highlandhouse.com",         name: "Highland House",          portal: "https://www.highlandhouse.com" },
  { domain: "craftmaster.com",           name: "Craftmaster Furniture",   portal: "https://www.craftmaster.com" },
  { domain: "stickleyfurniture.com",     name: "Stickley",                portal: "https://www.stickleyfurniture.com" },
  { domain: "bradingtonYoung.com",       name: "Bradington-Young",        portal: "https://www.bradington-young.com" },
  { domain: "broyhill.com",              name: "Broyhill",                portal: "https://www.broyhill.com" },
  { domain: "thomasville.com",           name: "Thomasville",             portal: "https://www.thomasville.com" },
  { domain: "drexelheritage.com",        name: "Drexel Heritage",         portal: "https://www.drexelheritage.com" },
  { domain: "hekman.com",               name: "Hekman Furniture",        portal: "https://www.hekman.com" },
  { domain: "hfdesignhouse.com",         name: "Hooker Upholstery",       portal: "https://www.hfdesignhouse.com" },
  { domain: "rowe-furniture.com",        name: "Rowe Furniture",          portal: "https://www.rowe-furniture.com" },
  { domain: "leejofa.com",               name: "Lee Jofa",                portal: "https://www.leejofa.com" },
  { domain: "arteriorshome.com",         name: "Arteriors",               portal: "https://www.arteriorshome.com" },
  { domain: "curreyandcompany.com",      name: "Currey & Company",        portal: "https://www.curreyandcompany.com" },
  { domain: "visualcomfort.com",         name: "Visual Comfort",          portal: "https://www.visualcomfort.com" },
  { domain: "palecek.com",              name: "Palecek",                  portal: "https://www.palecek.com" },
  { domain: "migaloo.com",              name: "Migaloo",                  portal: "https://www.migaloo.com" },
  { domain: "maisondupworld.com",       name: "Maison du Pworld",         portal: "https://www.maisondupworld.com" },
  { domain: "katemoore.com",            name: "Kate Moore",               portal: "https://www.katemoore.com" },
  { domain: "jeffreylord.com",          name: "Jeffrey Lord",             portal: "https://www.jeffreylord.com" },
  { domain: "johnrichard.com",          name: "John Richard",             portal: "https://www.johnrichard.com" },
  { domain: "schumacher.com",           name: "Schumacher",               portal: "https://www.schumacher.com" },
  { domain: "donghia.com",              name: "Donghia",                  portal: "https://www.donghia.com" },
  { domain: "designmaster.com",         name: "Design Master",            portal: "https://www.designmaster.com" },
  { domain: "nationalbusinessfurniture.com", name: "NBF",               portal: "https://www.nationalbusinessfurniture.com" },
];

// Build the site: search string from manufacturer domains
const SITE_QUERY = MANUFACTURERS.map(m => `site:${m.domain}`).join(" OR ");

// Map domain → manufacturer info
const DOMAIN_MAP = {};
for (const m of MANUFACTURERS) {
  DOMAIN_MAP[m.domain] = m;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query } = await req.json();
    if (!query) {
      return Response.json({ error: 'Query required' }, { status: 400 });
    }

    const serpApiKey = Deno.env.get("SERPAPI_KEY");
    if (!serpApiKey) {
      return Response.json({ error: 'SERPAPI_KEY not configured' }, { status: 500 });
    }

    // Search Google Images restricted to manufacturer domains only
    const imagesUrl = new URL("https://serpapi.com/search");
    imagesUrl.searchParams.set("engine", "google_images");
    imagesUrl.searchParams.set("q", `${query} ${SITE_QUERY}`);
    imagesUrl.searchParams.set("api_key", serpApiKey);
    imagesUrl.searchParams.set("num", "40");
    imagesUrl.searchParams.set("gl", "us");
    imagesUrl.searchParams.set("hl", "en");

    // Search Google Web restricted to manufacturer domains for product page links
    const webUrl = new URL("https://serpapi.com/search");
    webUrl.searchParams.set("engine", "google");
    webUrl.searchParams.set("q", `${query} ${SITE_QUERY}`);
    webUrl.searchParams.set("api_key", serpApiKey);
    webUrl.searchParams.set("num", "30");
    webUrl.searchParams.set("gl", "us");

    const [imagesRes, webRes] = await Promise.all([
      fetch(imagesUrl.toString()),
      fetch(webUrl.toString()),
    ]);

    const [imagesData, webData] = await Promise.all([
      imagesRes.json(),
      webRes.json(),
    ]);

    const imageResults = imagesData.images_results || [];
    const webResults = webData.organic_results || [];

    // Build a link map from web results: domain → list of {url, title, snippet}
    const webLinkMap = {};
    for (const r of webResults) {
      const domain = extractDomain(r.link || "");
      const mfr = findManufacturer(domain);
      if (!mfr) continue;
      if (!webLinkMap[mfr.domain]) webLinkMap[mfr.domain] = [];
      webLinkMap[mfr.domain].push({ url: r.link, title: r.title, snippet: r.snippet || "" });
    }

    // Process image results — only keep results from known manufacturer domains
    const products = imageResults
      .filter(r => r.title && r.original && r.link)
      .map(r => {
        const domain = extractDomain(r.link);
        const mfr = findManufacturer(domain);
        if (!mfr) return null;
        return {
          id: `${mfr.domain}-${r.position || Math.random()}`,
          product_name: cleanProductName(r.title),
          manufacturer_name: mfr.name,
          portal_url: r.link,          // Direct link to product page on manufacturer's site
          image_url: r.original,        // Real product image from manufacturer's server
          thumbnail_url: r.thumbnail || r.original,
          domain: mfr.domain,
          material: extractMaterial(r.title + " " + (r.snippet || "")),
          snippet: r.snippet || "",
        };
      })
      .filter(Boolean);

    // If web results have product pages not already in images, add them (no image but link is valid)
    const seenLinks = new Set(products.map(p => p.portal_url));
    for (const [domain, links] of Object.entries(webLinkMap)) {
      const mfr = DOMAIN_MAP[domain];
      if (!mfr) continue;
      for (const link of links) {
        if (!seenLinks.has(link.url)) {
          seenLinks.add(link.url);
          products.push({
            id: `${domain}-web-${Math.random()}`,
            product_name: cleanProductName(link.title),
            manufacturer_name: mfr.name,
            portal_url: link.url,
            image_url: null,
            thumbnail_url: null,
            domain: mfr.domain,
            material: extractMaterial(link.title + " " + link.snippet),
            snippet: link.snippet,
          });
        }
      }
    }

    // Group by manufacturer
    const byVendor = {};
    for (const p of products) {
      if (!byVendor[p.manufacturer_name]) byVendor[p.manufacturer_name] = [];
      byVendor[p.manufacturer_name].push(p);
    }

    return Response.json({
      query,
      total: products.length,
      products,
      by_vendor: byVendor,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function findManufacturer(domain) {
  // Exact match first
  if (DOMAIN_MAP[domain]) return DOMAIN_MAP[domain];
  // Partial match (e.g. subdomain)
  for (const [key, val] of Object.entries(DOMAIN_MAP)) {
    if (domain.endsWith(key) || domain.includes(key)) return val;
  }
  return null;
}

function cleanProductName(title) {
  return title.replace(/\$[\d,]+\.?\d*/g, "").replace(/\s{2,}/g, " ").trim();
}

function extractMaterial(text) {
  const lower = text.toLowerCase();
  if (lower.includes("velvet")) return "velvet";
  if (lower.includes("leather")) return "leather";
  if (lower.includes("linen")) return "linen";
  if (lower.includes("rattan") || lower.includes("wicker") || lower.includes("cane")) return "rattan";
  if (lower.includes("marble")) return "marble";
  if (lower.includes("performance fabric") || lower.includes("crypton")) return "performance fabric";
  if (lower.includes("boucle") || lower.includes("bouclé")) return "boucle";
  if (lower.includes("wood") || lower.includes("walnut") || lower.includes("oak") || lower.includes("pine")) return "wood";
  if (lower.includes("metal") || lower.includes("iron") || lower.includes("steel") || lower.includes("brass")) return "metal";
  if (lower.includes("glass")) return "glass";
  return null;
}