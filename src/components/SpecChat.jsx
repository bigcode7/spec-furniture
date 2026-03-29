import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, ExternalLink, Search } from "lucide-react";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

const STORAGE_KEY = "spec_chat_history";
const WELCOME_MESSAGE = {
  role: "assistant",
  content:
    "I'm Spekd AI, your furniture sourcing assistant. Ask me anything about products, vendors, materials, or design.",
  products: null,
  suggested_searches: null,
};

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // corrupted – start fresh
  }
  return [WELCOME_MESSAGE];
}

function saveHistory(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // storage full – silently ignore
  }
}

function ProductCard({ product }) {
  const price =
    product.price != null
      ? typeof product.price === "number"
        ? `$${product.price.toLocaleString()}`
        : product.price
      : null;

  return (
    <a
      href={product.link || product.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 transition-colors hover:bg-white/[0.06]"
    >
      {product.image && (
        <img
          src={product.image}
          alt={product.name}
          className="h-12 w-12 shrink-0 rounded-md object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {product.name}
        </p>
        {product.vendor && (
          <p className="truncate text-xs text-white/50">{product.vendor}</p>
        )}
        {price && (
          <p className="mt-0.5 text-xs font-semibold text-gold">{price}</p>
        )}
      </div>
      <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
    </a>
  );
}

function SuggestedChip({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
    >
      <Search className="h-3 w-3" />
      {label}
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block h-2 w-2 rounded-full bg-gold/60"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
      <span className="ml-2 text-xs text-white/40">Spekd AI is thinking...</span>
    </div>
  );
}

function MessageBubble({ message, onSuggestedClick }) {
  const isUser = message.role === "user";

  return (
    <div className={`px-4 py-2 ${isUser ? "flex justify-end" : ""}`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
          isUser
            ? "bg-gold/[0.08] border border-gold/[0.12] text-white"
            : "border-l-2 border-gold/20 bg-white/[0.03] text-white/80"
        }`}
      >
        {!isUser && (
          <div className="mb-1 flex items-center gap-1.5">
            <img src="/logo.png" alt="" className="h-4 w-4 object-contain" />
            <span className="font-brand text-[10px] font-semibold uppercase tracking-widest text-gold/70">
              Spekd AI
            </span>
          </div>
        )}

        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {message.content}
        </div>

        {message.products && message.products.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {message.products.map((product, i) => (
              <ProductCard key={i} product={product} />
            ))}
          </div>
        )}

        {message.suggested_searches && message.suggested_searches.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.suggested_searches.map((s, i) => (
              <SuggestedChip
                key={i}
                label={s}
                onClick={() => onSuggestedClick(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SpecChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Persist to localStorage whenever messages change
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Scroll to bottom on new messages or when loading changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage = { role: "user", content: trimmed };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);

      // Build the API payload – only role + content
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const res = await fetch(`${searchServiceUrl}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages }),
        });

        if (!res.ok) {
          throw new Error(`Server responded with ${res.status}`);
        }

        const data = await res.json();
        const reply = data.reply || {};

        const assistantMessage = {
          role: "assistant",
          content: reply.message || "Sorry, I didn't get a response. Please try again.",
          products: reply.products || null,
          suggested_searches: reply.suggested_searches || null,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorMessage = {
          role: "assistant",
          content: `Something went wrong: ${err.message}. Please try again.`,
          products: null,
          suggested_searches: null,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleSuggestedClick = (text) => {
    sendMessage(text);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full transition-all"
            style={{
              background: "rgba(15, 17, 25, 0.85)",
              backdropFilter: "blur(24px)",
              border: "1px solid rgba(200,169,126,0.15)",
              boxShadow: "0 0 20px rgba(200,169,126,0.12), 0 0 40px rgba(200,169,126,0.04), 0 4px 20px rgba(0,0,0,0.4)",
            }}
            aria-label="Open chat"
          >
            <img src="/logo.png" alt="" className="h-5 w-5 object-contain" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 flex w-[400px] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[rgba(10,10,15,0.85)] backdrop-blur-xl shadow-2xl"
            style={{ height: "500px" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gold/10 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold/10">
                  <img src="/logo.png" alt="" className="h-5 w-5 object-contain" />
                </div>
                <div>
                  <h3 className="font-brand text-sm font-semibold uppercase tracking-widest text-gold">Spekd AI</h3>
                  <p className="text-[11px] text-white/40">
                    Furniture sourcing assistant
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto py-3"
              style={{ scrollBehavior: "smooth" }}
            >
              {messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  message={msg}
                  onSuggestedClick={handleSuggestedClick}
                />
              ))}
              {isLoading && <TypingIndicator />}
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-gold/10 p-3"
            >
              <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 transition-colors focus-within:border-gold/30 focus-within:shadow-[0_0_12px_rgba(200,169,126,0.1)]">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about products, materials, vendors..."
                  rows={1}
                  className="max-h-24 flex-1 resize-none bg-transparent text-sm text-white placeholder-white/30 outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="btn-gold flex h-8 w-8 shrink-0 items-center justify-center rounded-lg disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
