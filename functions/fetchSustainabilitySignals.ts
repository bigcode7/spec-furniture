import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const SUSTAINABILITY_QUERIES = [
  "B Corp certified furniture companies 2025 2026",
  "sustainable furniture materials bio-based 2026",
  "lab grown leather furniture upholstery 2026",
  "recycled materials furniture circular economy",
  "secondhand furniture resale market growth 2026",
  "Facebook Marketplace furniture resale trending",
  "carbon neutral furniture manufacturer certified",
  "sustainable interior design materials trending 2026",
  "furniture rental circular economy business model",
  "regenerative materials furniture home decor 2026",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const serpApiKey = Deno.env.get("SERPAPI_KEY");
    if (!serpApiKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

    const selected = SUSTAINABILITY_QUERIES.slice(0, 3);

    const results = [];
    for (const query of selected) {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=5&tbm=&api_key=${serpApiKey}`;
      const res = await fetch(url);
      const json = await res.json();
      const organic = json.organic_results || [];
      results.push({
        query,
        results: organic.slice(0, 4).map(r => ({
          title: r.title,
          url: r.link,
          snippet: r.snippet,
          source: r.displayed_link,
        })),
        resultCount: organic.length,
      });
    }

    // Categorize signals
    const certificationSignals = results.filter(r =>
      r.query.includes('B Corp') || r.query.includes('carbon neutral') || r.query.includes('certified')
    ).map(r => ({
      category: 'Certifications & ESG',
      query: r.query,
      signalStrength: r.resultCount >= 5 ? 'strong' : r.resultCount >= 3 ? 'moderate' : 'emerging',
      topResults: r.results,
    }));

    const materialSignals = results.filter(r =>
      r.query.includes('material') || r.query.includes('leather') || r.query.includes('recycled') || r.query.includes('bio')
    ).map(r => ({
      category: 'Material Innovation',
      query: r.query,
      signalStrength: r.resultCount >= 5 ? 'strong' : r.resultCount >= 3 ? 'moderate' : 'emerging',
      topResults: r.results,
    }));

    const circularSignals = results.filter(r =>
      r.query.includes('resale') || r.query.includes('circular') || r.query.includes('rental') || r.query.includes('secondhand')
    ).map(r => ({
      category: 'Circular Economy',
      query: r.query,
      signalStrength: r.resultCount >= 5 ? 'strong' : r.resultCount >= 3 ? 'moderate' : 'emerging',
      topResults: r.results,
    }));

    const allArticles = results.flatMap(r => r.results).slice(0, 25);

    // Score overall sustainability momentum
    const totalResults = results.reduce((sum, r) => sum + r.resultCount, 0);
    const sustainabilityMomentum = totalResults > 25 ? 'accelerating' : totalResults > 15 ? 'growing' : 'emerging';

    return Response.json({
      certificationSignals,
      materialSignals,
      circularSignals,
      allArticles,
      sustainabilityMomentum,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});