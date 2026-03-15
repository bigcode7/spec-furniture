import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { trend } = await req.json();
  if (!trend) return Response.json({ error: 'trend is required' }, { status: 400 });

  const serpKey = Deno.env.get('SERPAPI_KEY');
  if (!serpKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

  // Fetch signals in parallel for this specific trend
  const [googleRes, redditRes, newsRes, tiktokRes, pinterestRes] = await Promise.all([
    fetch(`https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(trend)}&api_key=${serpKey}`).then(r => r.json()),
    fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(trend + ' furniture')}&site=reddit.com&num=10&api_key=${serpKey}`).then(r => r.json()),
    fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(trend + ' furniture trend 2026')}&num=10&api_key=${serpKey}`).then(r => r.json()),
    fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(trend + ' furniture tiktok viral')}&num=8&api_key=${serpKey}`).then(r => r.json()),
    fetch(`https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(trend + ' furniture interior design')}&num=6&api_key=${serpKey}`).then(r => r.json()),
  ]);

  const googleInterest = googleRes.interest_over_time?.timeline_data?.slice(-4) || [];
  const recentInterest = googleInterest.length > 0
    ? googleInterest[googleInterest.length - 1]?.values?.[0]?.extracted_value || 0
    : 0;
  const prevInterest = googleInterest.length > 1
    ? googleInterest[0]?.values?.[0]?.extracted_value || 0
    : 0;
  const velocity = prevInterest > 0 ? Math.round(((recentInterest - prevInterest) / prevInterest) * 100) : 0;

  const redditPosts = (redditRes.organic_results || []).slice(0, 5).map(r => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet
  }));

  const newsArticles = (newsRes.organic_results || []).slice(0, 5).map(r => ({
    title: r.title,
    url: r.link,
    source: r.displayed_link,
    snippet: r.snippet
  }));

  const tiktokSignals = (tiktokRes.organic_results || []).slice(0, 4).map(r => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet
  }));

  const images = (pinterestRes.images_results || []).slice(0, 4).map(r => ({
    thumbnail: r.thumbnail,
    title: r.title,
    source: r.source,
    link: r.link
  }));

  // Collate context for LLM
  const contextData = {
    trend,
    googleInterestCurrent: recentInterest,
    googleVelocity: velocity,
    redditPosts: redditPosts.map(p => `${p.title}: ${p.snippet}`).join('\n'),
    newsArticles: newsArticles.map(a => `[${a.source}] ${a.title}: ${a.snippet}`).join('\n'),
    tiktokSignals: tiktokSignals.map(t => `${t.title}: ${t.snippet}`).join('\n'),
  };

  const llmPrompt = `You are a senior furniture market analyst. Analyze why "${trend}" is trending based on these real data signals:

GOOGLE TRENDS: Current interest score ${contextData.googleInterestCurrent}/100, velocity ${contextData.googleVelocity}% change

REDDIT DISCUSSIONS:
${contextData.redditPosts}

NEWS & PUBLICATIONS:
${contextData.newsArticles}

TIKTOK/SOCIAL SIGNALS:
${contextData.tiktokSignals}

Provide a comprehensive trend analysis. Be specific, cite the signals, and be actionable for furniture manufacturers and retailers.`;

  const analysisRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: llmPrompt,
    response_json_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '2-3 sentence executive summary of why this trend is happening' },
        drivers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', description: 'e.g. Celebrity Influence, Sustainability, Color Palette' },
              explanation: { type: 'string' }
            }
          },
          description: '4-6 key drivers of this trend'
        },
        timeline: {
          type: 'object',
          properties: {
            expectedDuration: { type: 'string', description: 'e.g. 6-8 months' },
            peakIntensity: { type: 'string', description: 'e.g. Month 4-5' },
            currentPhase: { type: 'string', enum: ['emerging', 'rising', 'mainstream', 'declining'] }
          }
        },
        confidence: { type: 'number', description: 'Confidence score 0-100' },
        similarPastTrends: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              year: { type: 'string' },
              duration: { type: 'string' },
              outcome: { type: 'string' }
            }
          },
          description: '2-3 comparable past furniture trends'
        },
        manufacturerAction: { type: 'string', description: 'Specific action manufacturers should take now' },
        retailerAction: { type: 'string', description: 'Specific action retailers should take now' }
      }
    }
  });

  return Response.json({
    trend,
    analysis: analysisRes,
    signals: {
      googleInterest: recentInterest,
      velocity,
      redditPosts,
      newsArticles,
      tiktokSignals,
      images
    },
    analyzedAt: new Date().toISOString()
  });
});