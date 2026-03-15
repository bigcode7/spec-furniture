import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const FURNITURE_CATEGORIES = [
  "sectional sofas", "accent chairs", "coffee tables", "dining tables",
  "bedroom furniture", "outdoor furniture", "rugs", "lighting"
];

const TREND_KEYWORDS = [
  "boucle sofa", "curved sofa", "fluted dresser", "japandi", "travertine",
  "rattan chair", "velvet sectional", "modular sofa", "arched mirror", "limewash"
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = Deno.env.get("SERPAPI_KEY");
  if (!apiKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

  const retailSignals = [];
  const newArrivals = [];

  // Fetch Google Shopping results for trending furniture keywords on Wayfair
  const fetchPromises = TREND_KEYWORDS.slice(0, 6).map(async (keyword) => {
    const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(keyword + ' furniture')}&tbs=merchagg:m134870767&num=10&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    const results = data.shopping_results || [];

    if (results.length > 0) {
      const prices = results.map(r => parseFloat(r.price?.replace(/[^0-9.]/g, '') || '0')).filter(p => p > 0);
      const avgPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;

      retailSignals.push({
        keyword,
        resultCount: results.length,
        avgPrice,
        topProducts: results.slice(0, 3).map(r => ({
          title: r.title,
          price: r.price,
          source: r.source || 'Wayfair',
          thumbnail: r.thumbnail,
          link: r.link
        })),
        demandIndicator: results.length >= 8 ? 'high' : results.length >= 4 ? 'medium' : 'low'
      });

      results.slice(0, 2).forEach(r => {
        newArrivals.push({
          title: r.title,
          price: r.price,
          source: r.source || 'Wayfair',
          thumbnail: r.thumbnail,
          link: r.link,
          keyword
        });
      });
    }
  });

  await Promise.all(fetchPromises);
  retailSignals.sort((a, b) => b.resultCount - a.resultCount);

  return Response.json({
    retailSignals,
    newArrivals: newArrivals.slice(0, 20),
    fetchedAt: new Date().toISOString(),
    source: 'Google Shopping / Wayfair'
  });
});