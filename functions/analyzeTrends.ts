import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { googleTrends, redditSignals, rssSignals } = body;

  // Combine signals into a unified score per keyword
  const allKeywords = new Set([
    ...(googleTrends?.trends || []).map(t => t.keyword),
    ...(redditSignals?.signals || []).map(s => s.keyword),
    ...(rssSignals?.keywordSignals || []).map(s => s.keyword)
  ]);

  const combined = [];

  for (const keyword of allKeywords) {
    const google = googleTrends?.trends?.find(t => t.keyword === keyword);
    const reddit = redditSignals?.signals?.find(s => s.keyword === keyword);
    const rss = rssSignals?.keywordSignals?.find(s => s.keyword === keyword);

    // Normalize scores to 0-100
    const googleScore = google ? Math.min(google.currentScore, 100) : 0;
    const googleVelocity = google ? Math.max(0, Math.min(google.velocity, 200)) / 2 : 0; // 0-100
    const redditScore = reddit ? Math.min(reddit.mentions * 5, 100) : 0;
    const rssScore = rss ? Math.min(rss.articleCount * 20, 100) : 0;

    // Weighted composite score
    const compositeScore = (
      googleScore * 0.40 +
      googleVelocity * 0.25 +
      redditScore * 0.20 +
      rssScore * 0.15
    );

    // Determine trend stage based on signals
    let stage = 'watching';
    if (compositeScore > 70) stage = 'mainstream';
    else if (compositeScore > 45) stage = 'rising';
    else if (compositeScore > 20) stage = 'emerging';

    // Evidence sources
    const evidence = [];
    if (google) evidence.push({ source: 'Google Trends', signal: `Score: ${google.currentScore}/100, Velocity: ${google.velocity > 0 ? '+' : ''}${google.velocity}%` });
    if (reddit) evidence.push({ source: 'Reddit', signal: `${reddit.mentions} mentions, ${reddit.totalUpvotes} upvotes` });
    if (rss) evidence.push({ source: 'Design Publications', signal: `${rss.articleCount} recent articles` });

    combined.push({
      keyword,
      compositeScore: Math.round(compositeScore),
      googleScore: Math.round(googleScore),
      googleVelocity: google?.velocity || 0,
      redditMentions: reddit?.mentions || 0,
      articleCount: rss?.articleCount || 0,
      stage,
      evidence,
      topRedditPosts: reddit?.topPosts || [],
      topArticles: rss?.articles || [],
      trending: compositeScore > 45 && (google?.velocity || 0) > 10
    });
  }

  // Sort by composite score
  combined.sort((a, b) => b.compositeScore - a.compositeScore);

  // Use AI to generate insight summary
  const topTrends = combined.slice(0, 10);
  const prompt = `You are a furniture industry trend analyst. Based on real signal data collected today (${new Date().toISOString().split('T')[0]}), analyze these emerging furniture trends and provide actionable insights for furniture manufacturers.

Data:
${topTrends.map(t => `- "${t.keyword}": Google Score ${t.googleScore}/100 (${t.googleVelocity > 0 ? '+' : ''}${t.googleVelocity}% velocity), ${t.redditMentions} Reddit mentions, ${t.articleCount} publication articles. Stage: ${t.stage}`).join('\n')}

For each of the top 5 trends, provide:
1. A concise insight (1-2 sentences) about what the signal means for manufacturers
2. An estimated lead time (how many months until mass market adoption)
3. A recommended action for manufacturers

Format as JSON with this structure:
{
  "insights": [
    {
      "keyword": "...",
      "insight": "...",
      "estimatedLeadMonths": 12,
      "action": "...",
      "confidence": 85
    }
  ],
  "overallSummary": "One paragraph summary of the current furniture trend landscape"
}`;

  const aiResult = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        insights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              keyword: { type: "string" },
              insight: { type: "string" },
              estimatedLeadMonths: { type: "number" },
              action: { type: "string" },
              confidence: { type: "number" }
            }
          }
        },
        overallSummary: { type: "string" }
      }
    }
  });

  return Response.json({
    trends: combined,
    aiInsights: aiResult.insights || [],
    overallSummary: aiResult.overallSummary || '',
    analyzedAt: new Date().toISOString()
  });
});