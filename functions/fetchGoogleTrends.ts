import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const FURNITURE_KEYWORDS = [
  "boucle sofa",
  "curved sofa",
  "japandi furniture",
  "bouclé chair",
  "travertine table",
  "fluted furniture",
  "arched mirror",
  "limewash walls",
  "mushroom color furniture",
  "coastal grandmother decor",
  "quiet luxury interior",
  "biophilic design",
  "terracotta decor",
  "velvet furniture",
  "rattan furniture",
  "sustainable furniture",
  "modular sofa",
  "earth tones decor",
  "wabi sabi interior",
  "maximalist decor"
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = Deno.env.get("SERPAPI_KEY");
  if (!apiKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

  const results = [];

  // Fetch trends for each keyword
  for (const keyword of FURNITURE_KEYWORDS) {
    const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&date=today%2012-m&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.interest_over_time?.timeline_data) {
      const timeline = data.interest_over_time.timeline_data;
      const values = timeline.map(p => p.values?.[0]?.extracted_value || 0);
      const recent = values.slice(-4); // last 4 weeks
      const earlier = values.slice(-16, -4); // 3 months before

      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const earlierAvg = earlier.length > 0 ? earlier.reduce((a, b) => a + b, 0) / earlier.length : recentAvg;
      const velocity = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;
      const currentScore = recentAvg;

      results.push({
        keyword,
        currentScore: Math.round(currentScore),
        velocity: Math.round(velocity),
        timeline: timeline.slice(-12).map(p => ({
          date: p.date,
          value: p.values?.[0]?.extracted_value || 0
        })),
        trending: velocity > 20,
        rising: velocity > 5
      });
    }
  }

  // Sort by velocity
  results.sort((a, b) => b.velocity - a.velocity);

  return Response.json({ trends: results, fetchedAt: new Date().toISOString() });
});