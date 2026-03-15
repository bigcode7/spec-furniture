import { motion, AnimatePresence } from "framer-motion";
import { Brain, Layers, Radar, ShieldCheck, Check } from "lucide-react";

const STEP_ICONS = {
  brain: Brain,
  layers: Layers,
  radar: Radar,
  shield: ShieldCheck,
};

export default function AILoadingSequence({ steps, currentStep }) {
  return (
    <div className="w-full max-w-2xl mx-auto py-12 px-6">
      <div className="space-y-4">
        <AnimatePresence mode="sync">
          {steps.map((step, index) => {
            const Icon = STEP_ICONS[step.icon] || Brain;
            const state =
              index < currentStep ? "done" : index === currentStep ? "active" : "pending";

            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15, duration: 0.4 }}
                className={`flex items-center gap-4 rounded-2xl border px-5 py-4 transition-colors duration-300 ${
                  state === "active"
                    ? "border-gold/30 bg-gold/5"
                    : state === "done"
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-white/5 bg-white/[0.02]"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                    state === "active"
                      ? "bg-gold/20 text-gold"
                      : state === "done"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-white/5 text-white/20"
                  }`}
                >
                  {state === "done" ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    >
                      <Check className="h-5 w-5" />
                    </motion.div>
                  ) : (
                    <Icon
                      className={`h-5 w-5 ${state === "active" ? "animate-pulse" : ""}`}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium transition-colors duration-300 ${
                      state === "active"
                        ? "text-white"
                        : state === "done"
                        ? "text-white/60"
                        : "text-white/25"
                    }`}
                  >
                    {step.label}
                  </div>

                  {state === "active" && step.detail && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-1 text-xs text-white/40"
                    >
                      {step.detail}
                    </motion.div>
                  )}

                  {state === "active" && (
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        className="h-full rounded-full bg-gold"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: step.duration || 1.5, ease: "easeInOut" }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
