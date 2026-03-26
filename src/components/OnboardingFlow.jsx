import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, X, Sparkles } from "lucide-react";

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

const VENDOR_LIST = [
  "Baker Furniture", "Bernhardt", "Caracole", "Century Furniture", "CR Laine",
  "Gabby", "Hancock & Moore", "Hickory Chair", "Lexington Home Brands",
  "Rowe Furniture", "Stickley", "Surya", "Theodore Alexander",
  "Universal Furniture", "Vanguard Furniture", "Wesley Hall",
];

const PROJECT_TYPES = [
  { id: "residential", label: "Residential" },
  { id: "commercial", label: "Commercial" },
  { id: "hospitality", label: "Hospitality" },
  { id: "healthcare", label: "Healthcare" },
];

export default function OnboardingFlow({ show, onComplete }) {
  const [step, setStep] = useState(1);
  const [discounts, setDiscounts] = useState({});
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
      await fetch(`${SEARCH_SERVICE}/subscribe/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ project_types: projectTypes, trade_discounts: discounts }),
      });
    } catch {}
    onComplete();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-2xl p-8"
        style={{
          background: "rgba(16,17,24,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: s === step ? 24 : 8,
                background: s <= step ? "#C9A96E" : "rgba(255,255,255,0.1)",
              }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex justify-center mb-4">
                <Sparkles className="h-8 w-8" style={{ color: "#C9A96E" }} />
              </div>
              <h2 className="text-lg font-semibold text-white text-center mb-2">Welcome to SPEKD Pro!</h2>
              <p className="text-sm text-white/40 text-center mb-6">Enter your trade discounts to see estimated trade pricing.</p>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {VENDOR_LIST.map(vendor => (
                  <div key={vendor} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-sm text-white/60">{vendor}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="80"
                        placeholder="—"
                        value={discounts[vendor] || ""}
                        onChange={(e) => setDiscounts(d => ({ ...d, [vendor]: e.target.value ? Number(e.target.value) : undefined }))}
                        className="w-16 rounded-lg px-2 py-1.5 text-sm text-white text-right bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none"
                      />
                      <span className="text-xs text-white/20">%</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #C9A96E, #B8944F)" }}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-lg font-semibold text-white text-center mb-2">What kind of projects do you work on?</h2>
              <p className="text-sm text-white/40 text-center mb-6">This helps us personalize your experience.</p>

              <div className="grid grid-cols-2 gap-3 mb-8">
                {PROJECT_TYPES.map(({ id, label }) => {
                  const selected = projectTypes.includes(id);
                  return (
                    <button
                      key={id}
                      onClick={() => toggleProjectType(id)}
                      className="py-4 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: selected ? "rgba(201,169,110,0.1)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${selected ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.06)"}`,
                        color: selected ? "#C9A96E" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {selected && <Check className="h-3.5 w-3.5 inline mr-1.5" />}
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl text-sm text-white/40 hover:text-white/60 transition-colors">
                  Skip
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #C9A96E, #B8944F)" }}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.2)" }}>
                  <Check className="h-8 w-8" style={{ color: "#C9A96E" }} />
                </div>
              </div>
              <h2 className="text-lg font-semibold text-white text-center mb-2">You're all set!</h2>
              <p className="text-sm text-white/40 text-center mb-8">Start sourcing with unlimited AI-powered search.</p>

              <button
                onClick={handleComplete}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
                style={{
                  background: "linear-gradient(135deg, #C9A96E, #B8944F)",
                  boxShadow: "0 4px 20px rgba(201,169,110,0.3)",
                }}
              >
                Start Sourcing
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
