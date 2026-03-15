import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const AI_QUERIES = [
  "interior design AI Midjourney trending furniture 2026",
  "ChatGPT home design prompts furniture styles",
  "Midjourney interior design prompts trending",
  "DALL-E furniture design AI generated trends",
  "AI home decor design tools trending 2026",
  "r/malelivingspace r/femalelivingspace trending styles 2026",
  "r/ChatGPT interior design home decor",
  "sustainable home design AI automation 2026",
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const serpApiKey = Deno.env.get("SERPAPI_KEY");
    if (!serpApiKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

    const selected = AI_QUERIES.slice(0, 3);

    const results = [];
    for (const query of selected) {
      const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=5&api_key=${serpApiKey}`;
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

    // Group into categories
    const aiToolSignals = results.filter(r =>
      r.query.toLowerCase().includes('midjourney') ||
      r.query.toLowerCase().includes('dall-e') ||
      r.query.toLowerCase().includes('ai home') ||
      r.query.toLowerCase().includes('chatgpt')
    ).map(r => ({
      platform: r.query.includes('Midjourney') ? 'Midjourney' : r.query.includes('DALL-E') ? 'DALL-E' : r.query.includes('ChatGPT') ? 'ChatGPT' : 'AI Tools',
      query: r.query,
      signalStrength: r.resultCount >= 5 ? 'strong' : r.resultCount >= 3 ? 'moderate' : 'emerging',
      topResults: r.results,
      resultCount: r.resultCount,
    }));

    const communitySignals = results.filter(r =>
      r.query.toLowerCase().includes('reddit') ||
      r.query.toLowerCase().includes('r/')
    ).map(r => ({
      community: r.query.includes('malelivingspace') ? 'r/malelivingspace' : r.query.includes('femalelivingspace') ? 'r/femalelivingspace' : 'r/ChatGPT',
      query: r.query,
      signalStrength: r.resultCount >= 5 ? 'strong' : r.resultCount >= 3 ? 'moderate' : 'emerging',
      topResults: r.results,
      resultCount: r.resultCount,
    }));

    // Aggregate all articles
    const allArticles = results.flatMap(r => r.results).slice(0, 20);

    return Response.json({
      aiToolSignals,
      communitySignals,
      allArticles,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});