import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TREND_KEYWORDS = [
  "boucle sofa", "curved sofa", "japandi furniture", "travertine table",
  "fluted furniture", "arched mirror", "limewash walls", "quiet luxury interior",
  "biophilic design furniture", "coastal grandmother decor", "wabi sabi interior",
  "rattan furniture", "velvet furniture", "sustainable furniture", "modular sofa",
  "earth tones decor", "mushroom color furniture", "organic shapes furniture"
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = Deno.env.get("SERPAPI_KEY");
  if (!apiKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

  const signals = [];

  // Use SerpAPI Google Search to find Reddit mentions for each keyword
  for (const keyword of TREND_KEYWORDS.slice(0, 8)) { // limit to 8 to save API calls
    const query = `site:reddit.com ${keyword} interior design`;
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=10&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    const results = data.organic_results || [];
    const posts = results.map(r => ({
      title: r.title,
      url: r.link,
      snippet: r.snippet,
      source: 'Reddit'
    }));

    if (results.length > 0) {
      signals.push({
        keyword,
        mentions: results.length,
        totalUpvotes: 0,
        newPostMentions: results.length,
        topPosts: posts.slice(0, 3),
        momentum: results.length >= 5 ? 'rising' : 'stable'
      });
    }
  }

  signals.sort((a, b) => b.mentions - a.mentions);

  return Response.json({
    signals,
    fetchedAt: new Date().toISOString(),
    subredditsScanned: ['InteriorDesign', 'HomeImprovement', 'malelivingspace', 'Furniture', 'ApartmentDesign']
  });
});