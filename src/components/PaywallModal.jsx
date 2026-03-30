import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Search, ArrowRight, Layers, FileText, Star, Lock, X, Loader2, Check, Sparkles } from "lucide-react";

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");

const GOLD = "#c4a882";
const GOLD_SHADOW = "rgba(196,168,130,0.3)";

const PRO_FEATURES = [
  { icon: Zap, text: "Unlimited AI-powered search across 40,000+ trade products" },
  { icon: Search, text: "Find Similar — cross-vendor sourcing in one click" },
  { icon: ArrowRight, text: "Conversational search refinement" },
  { icon: Layers, text: "Paste sourcing lists with room buckets" },
  { icon: FileText, text: "Unlimited quotes & PDF generation" },
  { icon: Star, text: "Save & organize favorites into collections" },
  { icon: Lock, text: "Priority access to new features" },
];

/**
 * PaywallModal — Trial signup flow.
 *
 * Props:
 *   show       — boolean
 *   onClose    — called when user dismisses the modal
 *   onAuthSuccess(user) — called after successful signup+checkout redirect
 *   mode       — "trial_required" | "upgrade" | "feature"
 *   upgradeMessage — optional custom message
 */
export default function PaywallModal({ show, onClose, onAuthSuccess, mode: initialMode = "trial_required", upgradeMessage }) {
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

  // Check if this user has ever had a subscription (cancelled, past_due, trial_expired = prior subscriber)
  const priorSubStatus = (() => {
    try { return localStorage.getItem("spec_sub_status") || "guest"; } catch { return "guest"; }
  })();
  const hadPriorSubscription = ["cancelled", "past_due", "trial_expired"].includes(priorSubStatus);
  const isUpgrade = (initialMode === "upgrade" || initialMode === "feature") && hadPriorSubscription;
  const planValue = billing === "annual" ? "annual" : "monthly";
  const priceLabel = billing === "annual" ? "$990/yr" : "$99/mo";

  const inputClass =
    "w-full rounded-lg px-3.5 py-3 text-base sm:text-sm text-white bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none transition-colors";

  const goldBtnStyle = {
    background: `linear-gradient(135deg, ${GOLD}, #B8944F)`,
    boxShadow: `0 4px 20px ${GOLD_SHADOW}`,
  };

  const handleDismiss = () => {
    if (onClose) onClose();
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
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.9)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleDismiss(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full h-[100dvh] sm:h-auto sm:mx-4 sm:max-h-[90vh] overflow-y-auto sm:rounded-2xl rounded-t-2xl p-6 sm:p-8 sm:max-w-lg"
        style={{
          background: "rgba(42,37,31,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Close button — always visible */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-white/20 hover:text-white/50 transition-colors z-10"
        >
          <X className="h-5 w-5" />
        </button>

        <AnimatePresence mode="wait">
          {/* ── INTRO: Trial pitch ── */}
          {step === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="flex justify-center mb-5">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full"
                  style={{ background: "rgba(196,168,130,0.1)", border: "1px solid rgba(196,168,130,0.2)" }}
                >
                  <Sparkles className="h-6 w-6" style={{ color: GOLD }} />
                </div>
              </div>

              {isLoggedIn ? (
                isUpgrade ? (
                  <>
                    <h2 className="text-xl font-semibold text-white text-center mb-2">
                      Reactivate Pro
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
                      Start your free trial — no charge for 7 days. Cancel anytime before the trial ends and you won't pay a thing.
                    </p>
                  </>
                )
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-white text-center mb-2">
                    Try SPEKD Pro free for 7 days
                  </h2>
                  <p className="text-sm text-white/50 text-center mb-6 leading-relaxed">
                    You've used your 7 free searches. Create an account and start a trial to get unlimited AI-powered sourcing — no charge for 7 days.
                  </p>
                </>
              )}

              {/* Billing toggle */}
              <div className="flex items-center justify-center gap-3 mb-5">
                <button
                  onClick={() => setBilling("monthly")}
                  className="text-sm font-medium px-4 py-1.5 rounded-full transition-all"
                  style={{
                    background: billing === "monthly" ? "rgba(196,168,130,0.08)" : "transparent",
                    border: `1px solid ${billing === "monthly" ? "rgba(196,168,130,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: billing === "monthly" ? GOLD : "rgba(255,255,255,0.4)",
                  }}
                >
                  $99/mo
                </button>
                <button
                  onClick={() => setBilling("annual")}
                  className="text-sm font-medium px-4 py-1.5 rounded-full transition-all relative"
                  style={{
                    background: billing === "annual" ? "rgba(196,168,130,0.08)" : "transparent",
                    border: `1px solid ${billing === "annual" ? "rgba(196,168,130,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: billing === "annual" ? GOLD : "rgba(255,255,255,0.4)",
                  }}
                >
                  $990/yr
                  <span
                    className="absolute -top-2.5 -right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(196,168,130,0.2)", color: GOLD }}
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
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {loading ? "Redirecting to Stripe..." : isUpgrade ? `Reactivate Pro — ${priceLabel}` : "Start your 7-day free trial"}
                  </button>
                  <p className="text-[11px] text-white/30 text-center mt-2">
                    {isUpgrade
                      ? `Signed in as ${existingUser?.email || ""}.`
                      : `Signed in as ${existingUser?.email || ""}. You won't be charged for 7 days.`}
                  </p>
                </>
              ) : (
                <>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setError(""); setStep("signup"); }}
                      className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 flex items-center justify-center gap-2"
                      style={goldBtnStyle}
                    >
                      Create Account
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
                  <p className="text-[11px] text-white/30 text-center mt-2">
                    You won't be charged for 7 days. Cancel anytime.
                  </p>
                </>
              )}

              {/* Dismiss link */}
              <button
                onClick={handleDismiss}
                className="block mx-auto mt-4 text-[11px] text-white/20 hover:text-white/40 transition-colors"
              >
                Maybe later
              </button>
            </motion.div>
          )}

          {/* ── SIGNUP ── */}
          {step === "signup" && (
            <motion.div key="signup" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="text-lg font-semibold text-white mb-1">Create your account</h2>
              <p className="text-xs text-white/40 mb-1">
                {isUpgrade ? `Reactivate Pro — ${priceLabel}` : `7-day free trial — then ${priceLabel}`}
              </p>
              <p className="text-xs text-white/30 mb-6">You'll add your card with Stripe next</p>

              <form onSubmit={handleCheckout} className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/40 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      placeholder="you@studio.com"
                      autoFocus
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <label className="block text-xs text-white/40 mb-1.5">Company <span className="text-white/20">(optional)</span></label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className={inputClass}
                      placeholder="Studio name"
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
                  {loading ? "Creating account..." : "Continue to Payment"}
                </button>
              </form>

              <p className="text-[11px] text-white/30 text-center mt-2">
                Card required but not charged during your 7-day trial
              </p>

              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={() => { setError(""); setStep("login"); }}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  Already have an account? <span className="underline">Sign in</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ── LOGIN ── */}
          {step === "login" && (
            <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
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
                    autoFocus
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

              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => { setError(""); setForgotSuccess(false); setStep("forgot"); }}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  Forgot password?
                </button>
                <span className="text-white/10">|</span>
                <button
                  onClick={() => { setError(""); setStep("signup"); }}
                  className="text-xs text-white/30 hover:text-white/50 transition-colors"
                >
                  Create account
                </button>
              </div>
            </motion.div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {step === "forgot" && (
            <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
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
                        autoFocus
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

                  <button
                    onClick={() => { setError(""); setStep("login"); }}
                    className="text-xs text-white/30 hover:text-white/50 transition-colors block mx-auto mt-4"
                  >
                    Back to login
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
