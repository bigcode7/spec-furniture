import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { question } = await req.json();
  if (!question) return Response.json({ error: 'question is required' }, { status: 400 });

  const serpKey = Deno.env.get('SERPAPI_KEY');
  if (!serpKey) return Response.json({ error: 'SERPAPI_KEY not set' }, { status: 500 });

  // Smart search query generation and web lookup
  const searchQuery = `${question} furniture interior design 2026`;
  const [webRes, shoppingRes] = await Promise.all([
    fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&num=8&api_key=${serpKey}`).then(r => r.json()),
    question.toLowerCase().includes('price') || question.toLowerCase().includes('cost') || question.toLowerCase().includes('competitor')
      ? fetch(`https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(question + ' furniture')}&num=6&api_key=${serpKey}`).then(r => r.json())
      : Promise.resolve(null)
  ]);

  const webResults = (webRes.organic_results || []).slice(0, 6).map(r => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet,
    source: r.displayed_link
  }));

  const shoppingResults = shoppingRes ? (shoppingRes.shopping_results || []).slice(0, 4).map(p => ({
    title: p.title,
    price: p.price,
    source: p.source,
    thumbnail: p.thumbnail,
    link: p.link
  })) : [];

  const prompt = `You are PulseAI's expert furniture trend analyst. A customer asked: "${question}"

Here is real-time web data to help answer:

WEB RESULTS:
${webResults.map(r => `[${r.source}] ${r.title}: ${r.snippet}`).join('\n\n')}

${shoppingResults.length > 0 ? `LIVE PRICING DATA:\n${shoppingResults.map(p => `${p.title}: ${p.price} at ${p.source}`).join('\n')}` : ''}

Answer the question directly, accurately, and helpfully. Be specific. Use the real data above. Format your response clearly.`;

  const answerRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: 'object',
      properties: {
        directAnswer: { type: 'string', description: 'A clear, direct 1-3 sentence answer to the question' },
        details: { type: 'string', description: 'Detailed explanation with supporting evidence from the data' },
        keyFacts: {
          type: 'array',
          items: { type: 'string' },
          description: '3-5 specific, cited facts from the research'
        },
        actionableInsight: { type: 'string', description: 'One specific thing they can do with this information' },
        confidence: { type: 'number', description: 'How confident are you in this answer, 0-100' },
        suggestedFollowUps: {
          type: 'array',
          items: { type: 'string' },
          description: '2-3 follow-up questions the user might want to ask next'
        }
      }
    }
  });

  return Response.json({
    question,
    answer: answerRes,
    sources: webResults,
    products: shoppingResults,
    answeredAt: new Date().toISOString()
  });
});