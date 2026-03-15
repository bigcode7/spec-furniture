import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { trend, profile } = await req.json();
  if (!trend || !profile) return Response.json({ error: 'trend and profile are required' }, { status: 400 });

  const serpKey = Deno.env.get('SERPAPI_KEY');
  if (!serpKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

  // Fetch market data sequentially to stay within CPU limits
  const trendDataRes = await fetch(`https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(trend)}&api_key=${serpKey}`).then(r => r.json());
  const competitorRes = await fetch(`https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(trend + ' furniture')}&num=6&api_key=${serpKey}`).then(r => r.json());

  const timelineData = trendDataRes.interest_over_time?.timeline_data || [];
  const recentInterest = timelineData.slice(-1)[0]?.values?.[0]?.extracted_value || 50;

  const shoppingProducts = (competitorRes.shopping_results || []).slice(0, 6);
  const prices = shoppingProducts.map(p => {
    const match = p.price?.replace(/[^0-9.]/g, '');
    return match ? parseFloat(match) : null;
  }).filter(Boolean);
  const avgMarketPrice = prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null;
  const minPrice = prices.length > 0 ? Math.round(Math.min(...prices)) : null;
  const maxPrice = prices.length > 0 ? Math.round(Math.max(...prices)) : null;

  const prompt = `You are a senior business advisor for furniture manufacturers. A manufacturer wants to know if they should produce "${trend}" furniture.

MANUFACTURER PROFILE:
- Production Capacity: ${profile.capacity}
- Manufacturing Lead Time: ${profile.leadTime}
- Price Point: ${profile.pricePoint}
- Target Market: ${profile.targetMarket}
- Monthly Unit Capacity: ${profile.monthlyUnits || 'not specified'}

LIVE MARKET DATA FOR "${trend}":
- Current Google Trends Interest: ${recentInterest}/100
- Market Price Range: ${minPrice ? `$${minPrice.toLocaleString()} - $${maxPrice?.toLocaleString()}` : 'data unavailable'}
- Average Market Price: ${avgMarketPrice ? `$${avgMarketPrice.toLocaleString()}` : 'data unavailable'}
- Active Competing Products: ${shoppingProducts.length} found on Google Shopping

Based on this manufacturer's specific profile and live market data, provide a detailed go/no-go recommendation.`;

  const adviceRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        recommendation: { type: 'string', enum: ['YES', 'NO', 'CONDITIONAL'] },
        headline: { type: 'string', description: 'One punchy sentence summarizing the recommendation' },
        reasons: {
          type: 'array',
          items: { type: 'string' },
          description: '3-5 specific reasons FOR the recommendation'
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
          description: '2-3 critical timing or risk warnings'
        },
        timing: {
          type: 'object',
          properties: {
            startProduction: { type: 'string', description: 'When to start, e.g. Immediately (Day 1)' },
            shipToRetail: { type: 'string', description: 'Target ship date based on lead time' },
            discontinue: { type: 'string', description: 'Recommended end date' }
          }
        },
        financials: {
          type: 'object',
          properties: {
            recommendedUnits: { type: 'number' },
            expectedSellThrough: { type: 'string', description: 'e.g. 90-95%' },
            estimatedRevenue: { type: 'string', description: 'e.g. $2.5M - $4M' },
            estimatedProfit: { type: 'string', description: 'rough estimate' },
            roi: { type: 'string', description: 'e.g. 1,200%' }
          }
        },
        pricePositioning: { type: 'string', description: 'Where they should price vs market, and why' }
      }
    }
  });

  return Response.json({
    trend,
    profile,
    advice: adviceRes,
    marketData: {
      googleInterest: recentInterest,
      priceRange: minPrice && maxPrice ? { min: minPrice, max: maxPrice, avg: avgMarketPrice } : null,
      competingProducts: shoppingProducts.slice(0, 3).map(p => ({
        title: p.title,
        price: p.price,
        source: p.source,
        thumbnail: p.thumbnail,
        link: p.link
      }))
    },
    analyzedAt: new Date().toISOString()
  });
});