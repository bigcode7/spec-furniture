import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const serpKey = Deno.env.get('SERPAPI_KEY');
  if (!serpKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

  const WATCHLIST = [
    'boucle furniture', 'curved sofa', 'japandi', 'quiet luxury furniture',
    'mushroom color furniture', 'travertine furniture', 'rattan furniture',
    'velvet sofa', 'bouclé chair', 'coastal grandmother decor',
    'biophilic furniture', 'modular sofa', 'fluted furniture', 'arched mirror',
    'emerald green furniture', 'terracotta furniture', 'wabi sabi interior'
  ];

  // Fetch trends for all watchlist items in parallel (batched to avoid rate limits)
  const batchSize = 5;
  const allResults = [];

  for (let i = 0; i < WATCHLIST.length; i += batchSize) {
    const batch = WATCHLIST.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(keyword =>
        fetch(`https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&api_key=${serpKey}`)
          .then(r => r.json())
          .then(data => {
            const timeline = data.interest_over_time?.timeline_data || [];
            if (timeline.length < 2) return null;
            const values = timeline.map(t => t.values?.[0]?.extracted_value || 0);
            const current = values[values.length - 1];
            const prev = values[values.length - 2];
            const weekAgo = values[values.length - 5] || values[0];
            const change24h = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0;
            const change7d = weekAgo > 0 ? Math.round(((current - weekAgo) / weekAgo) * 100) : 0;
            return { keyword, current, change24h, change7d, timeline: values.slice(-12) };
          })
          .catch(() => null)
      )
    );
    allResults.push(...batchResults.filter(Boolean));
    if (i + batchSize < WATCHLIST.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Generate alerts for significant movements
  const alerts = [];
  for (const item of allResults) {
    if (Math.abs(item.change24h) >= 20 || Math.abs(item.change7d) >= 50) {
      let severity, type;
      if (item.change24h >= 50) { severity = 'critical'; type = 'viral_spike'; }
      else if (item.change24h >= 20) { severity = 'high'; type = 'rising_fast'; }
      else if (item.change7d >= 100) { severity = 'high'; type = 'growth_phase'; }
      else if (item.change24h <= -30) { severity = 'medium'; type = 'declining'; }
      else { severity = 'medium'; type = 'notable_movement'; }

      alerts.push({
        keyword: item.keyword,
        severity,
        type,
        current: item.current,
        change24h: item.change24h,
        change7d: item.change7d,
        timeline: item.timeline,
        message: buildAlertMessage(item.keyword, item.change24h, item.change7d, type),
        timestamp: new Date().toISOString()
      });
    }
  }

  // Sort by severity then by absolute change
  alerts.sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2 };
    return (sev[a.severity] - sev[b.severity]) || (Math.abs(b.change24h) - Math.abs(a.change24h));
  });

  // Also return all watchlist scores for the dashboard
  const snapshot = allResults.sort((a, b) => b.current - a.current);

  return Response.json({
    alerts,
    snapshot,
    alertCount: alerts.length,
    scannedAt: new Date().toISOString()
  });
});

function buildAlertMessage(keyword, change24h, change7d, type) {
  const name = keyword.replace(' furniture', '').replace(' decor', '');
  if (type === 'viral_spike') return `${name} is going viral — up ${change24h}% in 24 hours. Act immediately.`;
  if (type === 'rising_fast') return `${name} trending +${change24h}% in 24h. Now entering growth phase.`;
  if (type === 'growth_phase') return `${name} up ${change7d}% this week — sustained growth signal. Expected +${Math.round(change7d * 0.3)}% next 30 days.`;
  if (type === 'declining') return `${name} dropping ${Math.abs(change24h)}% — consider winding down production.`;
  return `${name} showing notable movement: ${change24h > 0 ? '+' : ''}${change24h}% today, ${change7d > 0 ? '+' : ''}${change7d}% this week.`;
}