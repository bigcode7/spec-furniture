import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const COMMERCE_QUERIES = [
  "TikTok shop furniture trending 2026",
  "TikTok viral furniture home decor bestselling",
  "Amazon influencer furniture home decor recommendations",
  "Amazon best seller furniture trending styles 2026",
  "influencer home decor furniture recommendations 2026",
  "viral furniture TikTok living room 2026",
  "Amazon home decor trending products 2026",
  "micro influencer home furniture authentic recommendations",
];

// Google Shopping queries for real commerce data
const SHOPPING_QUERIES = [
  "trending sofa 2026",
  "viral home decor TikTok",
  "bestselling accent chair 2026",
  "popular coffee table 2026",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const serpApiKey = Deno.env.get("SERPAPI_KEY");
    if (!serpApiKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

    // Fetch organic + shopping signals in parallel
    const [organicResults, shoppingResults] = await Promise.all([
      Promise.all(COMMERCE_QUERIES.slice(0, 5).map(async (query) => {
        const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=5&api_key=${serpApiKey}`;
        const res = await fetch(url);
        const json = await res.json();
        const organic = json.organic_results || [];
        return {
          query,
          results: organic.slice(0, 4).map(r => ({
            title: r.title,
            url: r.link,
            snippet: r.snippet,
            source: r.displayed_link,
          })),
          resultCount: organic.length,
        };
      })),
      Promise.all(SHOPPING_QUERIES.slice(0, 3).map(async (query) => {
        const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&num=6&api_key=${serpApiKey}`;
        const res = await fetch(url);
        const json = await res.json();
        const products = json.shopping_results || [];
        return {
          keyword: query,
          products: products.slice(0, 5).map(p => ({
            title: p.title,
            price: p.price,
            source: p.source,
            link: p.link,
            thumbnail: p.thumbnail,
            rating: p.rating,
            reviews: p.reviews,
          })),
          avgPrice: products.length > 0
            ? Math.round(products.slice(0, 5).reduce((sum, p) => {
                const price = parseFloat((p.price || '0').replace(/[$,]/g, ''));
                return sum + (isNaN(price) ? 0 : price);
              }, 0) / Math.min(products.length, 5))
            : 0,
        };
      }))
    ]);

    // Categorize organic signals
    const tiktokSignals = organicResults.filter(r =>
      r.query.toLowerCase().includes('tiktok')
    ).map(r => ({
      platform: 'TikTok Shop',
      query: r.query,
      signalStrength: r.resultCount >= 4 ? 'viral' : r.resultCount >= 2 ? 'trending' : 'emerging',
      topResults: r.results,
    }));

    const amazonSignals = organicResults.filter(r =>
      r.query.toLowerCase().includes('amazon') || r.query.toLowerCase().includes('influencer')
    ).map(r => ({
      platform: r.query.includes('Amazon') ? 'Amazon' : 'Influencer',
      query: r.query,
      signalStrength: r.resultCount >= 4 ? 'viral' : r.resultCount >= 2 ? 'trending' : 'emerging',
      topResults: r.results,
    }));

    const allArticles = organicResults.flatMap(r => r.results).slice(0, 20);

    return Response.json({
      tiktokSignals,
      amazonSignals,
      shoppingTrends: shoppingResults,
      allArticles,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});