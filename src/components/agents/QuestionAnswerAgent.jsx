import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Loader2, ExternalLink, Lightbulb } from "lucide-react";

const EXAMPLE_QUESTIONS = [
  "What's trending in Austin right now?",
  "Which materials are most popular this quarter?",
  "What's the ROI of following furniture trends early?",
  "Who are the biggest competitors in emerald sectionals?",
  "What price point sells best for boucle sofas?",
  "Is japandi still trending or past peak?",
];

export default function QuestionAnswerAgent() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hi! I'm PulseAI's trend assistant. Ask me anything about furniture trends, markets, competitors, pricing, or ROI. I pull live data to answer.",
      sources: null
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const ask = async (question) => {
    const q = question || input.trim();
    if (!q || loading) return;
    setInput("");
    setMessages(m => [...m, { role: 'user', content: q }]);
    setLoading(true);

    const res = await base44.functions.invoke('questionAnswerAgent', { question: q });
    const data = res.data;

    setMessages(m => [...m, {
      role: 'assistant',
      content: data.answer,
      sources: data.sources,
      products: data.products
    }]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[650px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-[#00E5A0]/10 border border-[#00E5A0]/20 rounded-2xl rounded-tr-sm' : 'bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm'} p-4`}>
              {msg.role === 'assistant' && typeof msg.content === 'object' && msg.content?.directAnswer ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-200 font-medium">{msg.content.directAnswer}</p>
                  {msg.content.details && <p className="text-sm text-gray-400 leading-relaxed">{msg.content.details}</p>}
                  {msg.content.keyFacts?.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      {msg.content.keyFacts.map((f, j) => (
                        <div key={j} className="flex gap-2 text-xs text-gray-300">
                          <span className="text-[#00E5A0] shrink-0">•</span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.content.actionableInsight && (
                    <div className="bg-[#00E5A0]/10 border border-[#00E5A0]/20 rounded-xl p-3 mt-2">
                      <div className="flex gap-2 items-start">
                        <Lightbulb className="w-4 h-4 text-[#00E5A0] shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-300">{msg.content.actionableInsight}</p>
                      </div>
                    </div>
                  )}
                  {msg.content.confidence && (
                    <div className="text-xs text-gray-600">Confidence: {msg.content.confidence}%</div>
                  )}
                  {/* Follow-ups */}
                  {msg.content.suggestedFollowUps?.length > 0 && i === messages.length - 1 && (
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-xs text-gray-500 mb-2">You might also ask:</div>
                      <div className="flex flex-col gap-1.5">
                        {msg.content.suggestedFollowUps.map((q, j) => (
                          <button key={j} onClick={() => ask(q)} className="text-left text-xs text-[#00E5A0] hover:text-white transition-colors">
                            → {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-200">{typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}</p>
              )}

              {/* Sources */}
              {msg.sources?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-xs text-gray-500 mb-1.5">Sources</div>
                  <div className="space-y-1">
                    {msg.sources.slice(0, 3).map((s, j) => (
                      <a key={j} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors">
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{s.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Products */}
              {msg.products?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {msg.products.map((p, j) => p.thumbnail && (
                      <a key={j} href={p.link} target="_blank" rel="noreferrer" className="shrink-0 group flex items-center gap-2 bg-white/5 rounded-lg p-1.5 hover:bg-white/10 transition-all">
                        <img src={p.thumbnail} alt={p.title} className="w-8 h-8 object-cover rounded" />
                        <div>
                          <div className="text-xs text-gray-400 group-hover:text-white transition-colors line-clamp-1 max-w-[80px]">{p.title}</div>
                          <div className="text-xs text-[#00E5A0] font-bold">{p.price}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-4">
              <Loader2 className="w-4 h-4 animate-spin text-[#00E5A0]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Example questions (only at start) */}
      {messages.length === 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {EXAMPLE_QUESTIONS.map(q => (
            <button key={q} onClick={() => ask(q)} className="text-xs bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-gray-400 hover:text-white hover:border-white/30 transition-all">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3 pt-3 border-t border-white/10">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && ask()}
          placeholder="Ask anything about furniture trends…"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00E5A0]/50"
        />
        <button
          onClick={() => ask()}
          disabled={!input.trim() || loading}
          className="bg-[#00E5A0] text-black font-bold px-4 py-3 rounded-xl hover:bg-[#00cc8e] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}