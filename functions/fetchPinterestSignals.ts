import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TREND_QUERIES = [
  "furniture trends 2026 interior design",
  "japandi interior living room",
  "quiet luxury home decor",
  "boucle furniture living room",
  "curved sofa living room ideas",
  "biophilic design home interior",
  "fluted furniture bedroom",
  "earth tone interior design 2026"
];

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const apiKey = Deno.env.get("SERPAPI_KEY");
  if (!apiKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

  const visualSignals = [];
  const allImages = [];

  // Use Google Image Search targeting Pinterest & design sites for visual trend data
  const fetchPromises = TREND_QUERIES.slice(0, 6).map(async (query) => {
    const siteFilter = 'site:pinterest.com OR site:instagram.com OR site:houzz.com';
    const url = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query + ' ' + siteFilter)}&num=10&api_key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    const images = data.images_results || [];

    if (images.length > 0) {
      // Extract keyword from query
      const keyword = query.replace(' interior design', '').replace(' interior', '').replace(' living room ideas', '').replace(' home decor', '').replace(' 2026', '').replace(' home', '').trim();

      visualSignals.push({
        keyword,
        imageCount: images.length,
        topImages: images.slice(0, 3).map(img => ({
          title: img.title,
          thumbnail: img.thumbnail,
          source: img.source,
          link: img.link
        })),
        trendStrength: images.length >= 8 ? 'strong' : images.length >= 4 ? 'moderate' : 'emerging'
      });

      images.slice(0, 2).forEach(img => {
        allImages.push({
          title: img.title,
          thumbnail: img.thumbnail,
          source: img.source,
          link: img.link,
          keyword
        });
      });
    }
  });

  await Promise.all(fetchPromises);
  visualSignals.sort((a, b) => b.imageCount - a.imageCount);

  return Response.json({
    visualSignals,
    topImages: allImages.slice(0, 20),
    fetchedAt: new Date().toISOString(),
    source: 'Pinterest / Instagram / Houzz visual signals'
  });
});