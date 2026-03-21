import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Zap, Search, FileText, Star, Layers, Users, ArrowRight, Loader2, Check } from "lucide-react";

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

export default function PaywallModal({ show, onAuthSuccess }) {
  const [mode, setMode] = useState("paywall"); // paywall | signup | login
  const [plan, setPlan] = useState("monthly");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!show) return null;

  const handleCheckout = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const fingerprint = localStorage.getItem("spekd_device_id");
      const resp = await fetch(`${SEARCH_SERVICE}/subscribe/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          business_name: businessName.trim(),
          fingerprint,
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }

      // Store auth token
      if (data.token) {
        localStorage.setItem("spec_auth_token", data.token);
      }

      // Redirect to Stripe checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError("Could not create checkout session");
        setLoading(false);
      }
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const resp = await fetch(`${SEARCH_SERVICE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await resp.json();

      if (!data.ok) {
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      localStorage.setItem("spec_auth_token", data.token);
      localStorage.setItem("spec_auth_user", JSON.stringify(data.user));
      if (onAuthSuccess) onAuthSuccess(data.user);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const features = [
    { icon: Search, text: "Unlimited AI-powered searches" },
    { icon: FileText, text: "Unlimited quotes and PDF generation" },
    { icon: Star, text: "Trade discount calculator" },
    { icon: Layers, text: "Save and organize favorites" },
    { icon: Users, text: "Paste sourcing lists" },
    { icon: Zap, text: "Room packages with auto-matching" },
    { icon: ArrowRight, text: "Conversational search refinement" },
    { icon: Lock, text: "Access to 40,000+ trade-only products across 25 vendors" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto rounded-2xl p-8"
        style={{
          background: "rgba(16,17,24,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        {mode === "paywall" && (
          <div>
            {/* Lock icon */}
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.2)" }}>
                <Lock className="h-7 w-7" style={{ color: "#C9A96E" }} />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white text-center mb-3">
              You've used all 5 free searches.
            </h2>
            <p className="text-sm text-white/50 text-center mb-8 leading-relaxed">
              Designers using SPEKD source an entire room in under 5 minutes — that used to take 3-4 hours across 20 vendor websites.
            </p>

            <h3 className="text-lg font-semibold text-white text-center mb-6">
              Start your SPEKD Pro subscription
            </h3>

            {/* Pricing toggle */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={() => setPlan("monthly")}
                className={`flex-1 rounded-xl p-4 text-left transition-all ${plan === "monthly" ? "ring-2" : "opacity-60 hover:opacity-80"}`}
                style={{
                  background: plan === "monthly" ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${plan === "monthly" ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.06)"}`,
                  ringColor: "rgba(201,169,110,0.4)",
                }}
              >
                <div className="text-xs text-white/40 mb-1">Monthly</div>
                <div className="text-2xl font-bold text-white">$79<span className="text-sm font-normal text-white/40">/mo</span></div>
              </button>
              <button
                onClick={() => setPlan("annual")}
                className={`flex-1 rounded-xl p-4 text-left transition-all relative ${plan === "annual" ? "ring-2" : "opacity-60 hover:opacity-80"}`}
                style={{
                  background: plan === "annual" ? "rgba(201,169,110,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${plan === "annual" ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.06)"}`,
                  ringColor: "rgba(201,169,110,0.4)",
                }}
              >
                <div className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(201,169,110,0.2)", color: "#C9A96E" }}>
                  Save $158
                </div>
                <div className="text-xs text-white/40 mb-1">Annual</div>
                <div className="text-2xl font-bold text-white">$790<span className="text-sm font-normal text-white/40">/yr</span></div>
                <div className="text-[11px] text-white/30 mt-0.5">$65.83/mo</div>
              </button>
            </div>

            {/* Features list */}
            <div className="space-y-2.5 mb-8">
              {features.map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Check className="h-4 w-4 shrink-0" style={{ color: "#C9A96E" }} />
                  <span className="text-sm text-white/60">{text}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setMode("signup")}
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #C9A96E, #B8944F)",
                boxShadow: "0 4px 20px rgba(201,169,110,0.3)",
              }}
            >
              Start Pro — {plan === "annual" ? "$790/year" : "$79/month"}
            </button>

            <p className="text-center mt-4">
              <button onClick={() => setMode("login")} className="text-xs text-white/30 hover:text-white/50 transition-colors">
                Already have an account? <span className="underline">Sign in</span>
              </button>
            </p>
          </div>
        )}

        {mode === "signup" && (
          <div>
            <button onClick={() => setMode("paywall")} className="absolute top-4 right-4 text-white/30 hover:text-white/60">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-white mb-1">Create your account</h2>
            <p className="text-xs text-white/40 mb-6">Then you'll complete payment with Stripe</p>

            <form onSubmit={handleCheckout} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none transition-colors"
                  placeholder="you@studio.com"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none transition-colors"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Full name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none transition-colors"
                  placeholder="Jane Smith"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Company / studio name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none transition-colors"
                  placeholder="Optional"
                />
              </div>

              {error && (
                <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #C9A96E, #B8944F)",
                  boxShadow: "0 4px 20px rgba(201,169,110,0.3)",
                }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Creating account..." : `Continue to Payment — ${plan === "annual" ? "$790/yr" : "$79/mo"}`}
              </button>
            </form>

            <p className="text-center mt-4">
              <button onClick={() => setMode("login")} className="text-xs text-white/30 hover:text-white/50 transition-colors">
                Already have an account? <span className="underline">Sign in</span>
              </button>
            </p>
          </div>
        )}

        {mode === "login" && (
          <div>
            <button onClick={() => setMode("paywall")} className="absolute top-4 right-4 text-white/30 hover:text-white/60">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold text-white mb-1">Welcome back</h2>
            <p className="text-xs text-white/40 mb-6">Sign in to your SPEKD Pro account</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none transition-colors"
                />
              </div>

              {error && (
                <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #C9A96E, #B8944F)",
                  boxShadow: "0 4px 20px rgba(201,169,110,0.3)",
                }}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="text-center mt-4">
              <button onClick={() => setMode("signup")} className="text-xs text-white/30 hover:text-white/50 transition-colors">
                Don't have an account? <span className="underline">Start Pro</span>
              </button>
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
