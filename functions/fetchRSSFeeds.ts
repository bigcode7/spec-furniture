import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DESIGN_SITES = [
  'architecturaldigest.com',
  'apartmenttherapy.com',
  'design-milk.com',
  'dezeen.com',
  'thespruce.com',
  'curbed.com',
  'furnituretoday.com',
  'elledecor.com',
  'dwell.com'
];

const TREND_KEYWORDS = [
  "boucle furniture", "curved sofa trend", "japandi style", "quiet luxury decor",
  "biophilic interior design", "fluted furniture", "travertine furniture",
  "limewash wall", "rattan furniture trend", "sustainable furniture 2025",
  "modular sofa", "earth tone interior", "arched furniture", "velvet sofa trend"
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = Deno.env.get("SERPAPI_KEY");
  if (!apiKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

  const keywordCounts = {};
  TREND_KEYWORDS.forEach(k => { keywordCounts[k] = { count: 0, articles: [] }; });
  const allArticles = [];

  // Search each keyword across design publications
  for (const keyword of TREND_KEYWORDS.slice(0, 8)) {
    const sitesQuery = DESIGN_SITES.map(s => `site:${s}`).join(' OR ');
    const query = `(${sitesQuery}) "${keyword}"`;
    const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&num=10&tbs=qdr:m&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    const results = data.organic_results || [];

    for (const r of results) {
      const source = DESIGN_SITES.find(s => r.link?.includes(s)) || 'Design Publication';
      const article = {
        title: r.title,
        url: r.link,
        source,
        date: r.date || '',
        keywords: [keyword]
      };

      keywordCounts[keyword].count++;
      if (keywordCounts[keyword].articles.length < 3) {
        keywordCounts[keyword].articles.push(article);
      }
      allArticles.push(article);
    }
  }

  const keywordSignals = TREND_KEYWORDS
    .map(k => ({ keyword: k, articleCount: keywordCounts[k].count, articles: keywordCounts[k].articles }))
    .filter(s => s.articleCount > 0)
    .sort((a, b) => b.articleCount - a.articleCount);

  // Deduplicate articles
  const seen = new Set();
  const recentArticles = allArticles.filter(a => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  }).slice(0, 30);

  return Response.json({
    keywordSignals,
    recentArticles,
    feedsScanned: DESIGN_SITES.length,
    fetchedAt: new Date().toISOString()
  });
});