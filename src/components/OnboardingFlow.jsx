import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles, Search, Layers, FileText, Heart, Zap } from "lucide-react";

const GOLD = "#c4a882";

const PROJECT_TYPES = [
  { id: "residential", label: "Residential", emoji: "🏠" },
  { id: "commercial", label: "Commercial", emoji: "🏢" },
  { id: "hospitality", label: "Hospitality", emoji: "🏨" },
  { id: "healthcare", label: "Healthcare", emoji: "🏥" },
  { id: "multifamily", label: "Multi-Family", emoji: "🏘️" },
  { id: "other", label: "Other", emoji: "✨" },
];

const FEATURES = [
  { icon: Search, title: "AI-Powered Search", desc: "Describe what you need in plain language — SPEKD finds it across 40,000+ products" },
  { icon: Layers, title: "Find Similar", desc: "See a product you like? One click finds alternatives across every vendor" },
  { icon: FileText, title: "Quote Builder", desc: "Build and export polished quotes with product specs and pricing" },
  { icon: Heart, title: "Collections", desc: "Save favorites and organize them into project collections" },
];

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

export default function OnboardingFlow({ show, onComplete }) {
  const [step, setStep] = useState(1);
  const [projectTypes, setProjectTypes] = useState([]);

  if (!show) return null;

  const toggleProjectType = (id) => {
    setProjectTypes(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const handleComplete = async () => {
    try {
      const token = localStorage.getItem("spec_auth_token");
      if (token && !token.startsWith("g.")) {
        await fetch(`${SEARCH_SERVICE}/subscribe/onboarding`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ project_types: projectTypes }),
        });
      }
    } catch {}
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.9)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative w-full h-[100dvh] sm:h-auto sm:max-w-lg sm:mx-4 sm:max-h-[90vh] overflow-y-auto sm:rounded-2xl rounded-t-2xl p-6 sm:p-8"
        style={{
          background: "rgba(42,37,31,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Progress bar */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2].map(s => (
            <div
              key={s}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: s === step ? 24 : 8,
                background: s <= step ? GOLD : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Welcome + Feature Highlights ── */}
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex justify-center mb-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "rgba(196,168,130,0.1)", border: "1px solid rgba(196,168,130,0.2)" }}
                >
                  <Sparkles className="h-7 w-7" style={{ color: GOLD }} />
                </div>
              </div>
              <h2 className="text-xl font-semibold text-white text-center mb-1">Welcome to SPEKD</h2>
              <p className="text-sm text-white/40 text-center mb-6">
                AI-powered sourcing across 40,000+ trade furniture products. Here's what you can do:
              </p>

              <div className="space-y-3 mb-8">
                {FEATURES.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <f.icon className="h-4.5 w-4.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
                    <div>
                      <div className="text-sm font-medium text-white/80">{f.title}</div>
                      <div className="text-xs text-white/35 leading-relaxed mt-0.5">{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setStep(2)}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, #B8944F)`,
                  boxShadow: "0 4px 20px rgba(196,168,130,0.3)",
                }}
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* ── Step 2: Project Types (optional) ── */}
          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-lg font-semibold text-white text-center mb-1">What do you design?</h2>
              <p className="text-sm text-white/40 text-center mb-6">Select all that apply — helps us tailor your results.</p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {PROJECT_TYPES.map(({ id, label, emoji }) => {
                  const selected = projectTypes.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleProjectType(id)}
                      className="py-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                      style={{
                        background: selected ? "rgba(196,168,130,0.1)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${selected ? "rgba(196,168,130,0.3)" : "rgba(255,255,255,0.06)"}`,
                        color: selected ? GOLD : "rgba(255,255,255,0.5)",
                      }}
                    >
                      <span>{emoji}</span> {label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handleComplete}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${GOLD}, #B8944F)`,
                  boxShadow: "0 4px 20px rgba(196,168,130,0.3)",
                }}
              >
                <Zap className="h-4 w-4" />
                Start Sourcing
              </button>

              <button
                onClick={handleComplete}
                className="w-full mt-2 py-2 text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                Skip for now
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
