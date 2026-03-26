import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Search, ArrowRight, Layers, FileText, Star, Lock, Users, Shield, Headphones, Building2, Crown, X, Loader2, Check } from "lucide-react";

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

const GOLD = "#C9A96E";
const GOLD_SHADOW = "rgba(201,169,110,0.3)";

const PRO_FEATURES = [
  { icon: Zap, text: "Unlimited AI-powered search across 40,000+ trade products" },
  { icon: Search, text: "Find Similar — cross-vendor sourcing in one click" },
  { icon: ArrowRight, text: "Conversational search refinement" },
  { icon: Layers, text: "Paste sourcing lists with room buckets" },
  { icon: FileText, text: "Unlimited quotes & PDF generation" },
  { icon: Star, text: "Trade pricing with client markup calculator" },
  { icon: Lock, text: "Save favorites & collections" },
];

/**
 * PaywallModal — Trial signup flow.
 *
 * Props:
 *   show       — boolean, whether to render
 *   onAuthSuccess(user) — called after successful signup+checkout redirect
 *   mode       — "trial_required" (3 free searches used) | "upgrade" (expired user) | "feature" (Pro feature gate)
 *   upgradeMessage — optional custom message for upgrade mode
 */
export default function PaywallModal({ show, onAuthSuccess, mode: initialMode = "trial_required", upgradeMessage }) {
  // Detect if user is already logged in
  const existingToken = typeof window !== "undefined" ? localStorage.getItem("spec_auth_token") : null;
  const existingUser = (() => {
    try { return JSON.parse(localStorage.getItem("spec_auth_user") || "null"); } catch { return null; }
  })();
  const isLoggedIn = !!(existingToken && existingToken.length > 10 && !existingToken.startsWith("g."));

  const [step, setStep] = useState("intro"); // intro | signup | login | forgot
  const [billing, setBilling] = useState("monthly");
  const [email, setEmail] = useState(existingUser?.email || "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(existingUser?.full_name || "");
  const [businessName, setBusinessName] = useState(existingUser?.business_name || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  if (!show) return null;

  const isUpgrade = initialMode === "upgrade" || initialMode === "feature";
  const planValue = billing === "annual" ? "annual" : "monthly";
  const priceLabel = billing === "annual" ? "$990/yr" : "$99/mo";

  const inputClass =
    "w-full rounded-lg px-3.5 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none transition-colors";

  const goldBtnStyle = {
    background: `linear-gradient(135deg, ${GOLD}, #B8944F)`,
    boxShadow: `0 4px 20px ${GOLD_SHADOW}`,
  };

  // Direct checkout for logged-in users — skip signup form
  const handleDirectCheckout = async () => {
    setError("");
    setLoading(true);
    try {
      const fingerprint = localStorage.getItem("spekd_device_id");
      const resp = await fetch(`${SEARCH_SERVICE}/subscribe/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${existingToken}`,
        },
        body: JSON.stringify({
          plan: planValue,
          email: existingUser?.email || "",
          password: "existing-user",
          fingerprint,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || "Something went wrong");
        setLoading(false);
        return;
      }
      if (data.admin_bypass) {
        localStorage.setItem("spec_sub_status", "active");
        if (onAuthSuccess) onAuthSuccess(existingUser);
        return;
      }
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError("Could not create checkout session");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

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
          plan: planValue,
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

      if (data.token) {
        localStorage.setItem("spec_auth_token", data.token);
      }

      // Admin bypass — no Stripe needed, just activate
      if (data.admin_bypass) {
        localStorage.setItem("spec_sub_status", "active");
        if (onAuthSuccess) onAuthSuccess({ email: email.trim() });
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setError("Could not create checkout session");
        setLoading(false);
      }
    } catch {
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

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setForgotSuccess(false);
    setLoading(true);

    try {
      await fetch(`${SEARCH_SERVICE}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      setForgotSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      // NOT dismissable by clicking outside
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-4 max-h-[90vh] overflow-y-auto rounded-2xl p-8 w-full max-w-lg"
        style={{
          background: "rgba(16,17,24,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── INTRO: Trial pitch ── */}
        {step === "intro" && (
          <div>
            <div className="flex justify-center mb-5">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "rgba(201,169,110,0.1)", border: "1px solid rgba(201,169,110,0.2)" }}
              >
                <Zap className="h-6 w-6" style={{ color: GOLD }} />
              </div>
            </div>

            {isUpgrade ? (
              <>
                <h2 className="text-xl font-semibold text-white text-center mb-2">
                  {upgradeMessage ? "Upgrade to Pro" : "Welcome back!"}
                </h2>
                <p className="text-sm text-white/50 text-center mb-6 leading-relaxed">
                  {upgradeMessage || "Your saved products and quotes are still here. Reactivate Pro to pick up where you left off."}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-white text-center mb-2">
                  Try SPEKD Pro free for 7 days
                </h2>
                <p className="text-sm text-white/50 text-center mb-6 leading-relaxed">
                  You've used your 3 free searches. Start a trial to get unlimited AI-powered sourcing across 40,000+ trade products — no charge for 7 days.
                </p>
              </>
            )}

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mb-5">
              <button
                onClick={() => setBilling("monthly")}
                className="text-sm font-medium px-4 py-1.5 rounded-full transition-all"
                style={{
                  background: billing === "monthly" ? "rgba(201,169,110,0.08)" : "transparent",
                  border: `1px solid ${billing === "monthly" ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.08)"}`,
                  color: billing === "monthly" ? GOLD : "rgba(255,255,255,0.4)",
                }}
              >
                $99/mo
              </button>
              <button
                onClick={() => setBilling("annual")}
                className="text-sm font-medium px-4 py-1.5 rounded-full transition-all relative"
                style={{
                  background: billing === "annual" ? "rgba(201,169,110,0.08)" : "transparent",
                  border: `1px solid ${billing === "annual" ? "rgba(201,169,110,0.3)" : "rgba(255,255,255,0.08)"}`,
                  color: billing === "annual" ? GOLD : "rgba(255,255,255,0.4)",
                }}
              >
                $990/yr
                <span
                  className="absolute -top-2.5 -right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(201,169,110,0.2)", color: GOLD }}
                >
                  Save $198
                </span>
              </button>
            </div>

            {/* Feature list */}
            <div className="space-y-2 mb-6">
              {PRO_FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
                  <span className="text-xs text-white/60 leading-tight">{f.text}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}

            {isLoggedIn ? (
              <>
                <button
                  onClick={handleDirectCheckout}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={goldBtnStyle}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {loading ? "Redirecting to Stripe..." : isUpgrade ? `Reactivate — ${priceLabel}` : `Start your 7-day free trial`}
                </button>
                <p className="text-[11px] text-white/30 text-center mt-2">
                  Signed in as {existingUser?.email || ""}. You won't be charged for 7 days. Cancel anytime.
                </p>
              </>
            ) : (
              <>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("signup")}
                    className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2"
                    style={goldBtnStyle}
                  >
                    {isUpgrade ? `Reactivate — ${priceLabel}` : "Create Account"}
                  </button>
                  <button
                    onClick={() => { setError(""); setStep("login"); }}
                    className="flex-1 py-3.5 rounded-xl text-sm font-semibold transition-all hover:brightness-110 flex items-center justify-center gap-2"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    Sign In
                  </button>
                </div>
                {!isUpgrade && (
                  <p className="text-[11px] text-white/30 text-center mt-2">
                    You won't be charged for 7 days. Cancel anytime.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* ── SIGNUP: Email, password, name, company → Stripe ── */}
        {step === "signup" && (
          <div>
            <button
              onClick={() => setStep("intro")}
              className="absolute top-4 right-4 text-white/30 hover:text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-1">Create your account</h2>
            <p className="text-xs text-white/40 mb-1">
              {isUpgrade ? `Pro — ${priceLabel}` : `7-day free trial — then ${priceLabel}`}
            </p>
            <p className="text-xs text-white/30 mb-6">You'll add your card with Stripe next</p>

            <form onSubmit={handleCheckout} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
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
                    className={inputClass}
                    placeholder="Min. 8 characters"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Full name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 mb-1.5">Company</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className={inputClass}
                    placeholder="Optional"
                  />
                </div>
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
                style={goldBtnStyle}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Creating account..." : isUpgrade ? `Continue to Payment — ${priceLabel}` : "Continue to Payment"}
              </button>
            </form>

            {!isUpgrade && (
              <p className="text-[11px] text-white/30 text-center mt-2">
                Card required but not charged during your 7-day trial
              </p>
            )}

            <p className="text-center mt-4">
              <button
                onClick={() => { setError(""); setStep("login"); }}
                className="text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                Already have an account? <span className="underline">Sign in</span>
              </button>
            </p>
          </div>
        )}

        {/* ── LOGIN ── */}
        {step === "login" && (
          <div>
            <button
              onClick={() => setStep("intro")}
              className="absolute top-4 right-4 text-white/30 hover:text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-1">Welcome back</h2>
            <p className="text-xs text-white/40 mb-6">Sign in to your SPEKD account</p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
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
                style={goldBtnStyle}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div className="text-center mt-4 space-y-2">
              <button
                onClick={() => { setError(""); setForgotSuccess(false); setStep("forgot"); }}
                className="text-xs text-white/30 hover:text-white/50 transition-colors block mx-auto"
              >
                Forgot password?
              </button>
              <button
                onClick={() => setStep("intro")}
                className="text-xs text-white/30 hover:text-white/50 transition-colors block mx-auto"
              >
                Don't have an account? <span className="underline">Start free trial</span>
              </button>
            </div>
          </div>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {step === "forgot" && (
          <div>
            <button
              onClick={() => setStep("login")}
              className="absolute top-4 right-4 text-white/30 hover:text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-1">Reset your password</h2>
            <p className="text-xs text-white/40 mb-6">Enter your email and we'll send a reset link</p>

            {forgotSuccess ? (
              <div>
                <div className="text-sm text-white/70 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-3 mb-6">
                  If an account exists with that email, a reset link has been sent.
                </div>
                <button
                  onClick={() => { setForgotSuccess(false); setError(""); setStep("login"); }}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors block mx-auto"
                >
                  Back to login
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      placeholder="you@studio.com"
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
                    style={goldBtnStyle}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>

                <p className="text-center mt-4">
                  <button
                    onClick={() => { setError(""); setStep("login"); }}
                    className="text-xs text-white/30 hover:text-white/50 transition-colors"
                  >
                    Back to login
                  </button>
                </p>
              </>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
