import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Zap, Search, FileText, Star, Layers, Users, ArrowRight, Loader2, Check, Shield, Headphones, Building2, Crown } from "lucide-react";

const SEARCH_SERVICE = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://spec-furniture-production.up.railway.app").replace(/\/$/, "");

const GOLD = "#C9A96E";
const GOLD_BG = "rgba(201,169,110,0.08)";
const GOLD_BORDER = "rgba(201,169,110,0.3)";
const GOLD_SHADOW = "rgba(201,169,110,0.3)";

const PRO_FEATURES = [
  { icon: Search, text: "Unlimited searches" },
  { icon: FileText, text: "Unlimited quotes & PDF" },
  { icon: Star, text: "Trade discount calculator" },
  { icon: Layers, text: "Favorites & collections" },
  { icon: ArrowRight, text: "Paste sourcing lists" },
  { icon: Zap, text: "Room packages with auto-matching" },
  { icon: Search, text: "Conversational search" },
  { icon: Lock, text: "40,000+ trade products" },
];

const TEAM_EXTRAS = [
  { icon: Users, text: "5 team seats included" },
  { icon: Layers, text: "Shared quotes & favorites" },
  { icon: Shield, text: "Team admin dashboard" },
  { icon: Users, text: "Additional seats at $49/mo each" },
];

const ENTERPRISE_EXTRAS = [
  { icon: Users, text: "Unlimited seats" },
  { icon: Shield, text: "SSO & SAML" },
  { icon: Headphones, text: "Dedicated account manager" },
  { icon: Building2, text: "Custom integrations" },
  { icon: Headphones, text: "Priority support" },
  { icon: Check, text: "SLA guarantee" },
];

export default function PaywallModal({ show, onAuthSuccess }) {
  const [mode, setMode] = useState("paywall"); // paywall | signup | login | forgot
  const [billing, setBilling] = useState("monthly"); // monthly | annual
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  if (!show) return null;

  const planValue = billing; // "monthly" or "annual" — legacy plan names for Stripe

  const priceLabel = () => {
    return billing === "annual" ? "$990/yr" : "$99/mo";
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
      // Always show success regardless of response to avoid leaking account existence
      setForgotSuccess(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const handleTierSelect = (tier) => {
    if (tier === "pro") {
      setMode("signup");
    }
    // Team is "Coming Soon" (disabled), Enterprise is "Contact Us" (mailto link)
    // Neither should reach here, but guard anyway
  };

  /* --- Shared styles --- */
  const inputClass =
    "w-full rounded-lg px-3.5 py-2.5 text-sm text-white bg-white/[0.04] border border-white/[0.08] focus:border-white/20 focus:outline-none transition-colors";

  const goldBtnStyle = {
    background: `linear-gradient(135deg, ${GOLD}, #B8944F)`,
    boxShadow: `0 4px 20px ${GOLD_SHADOW}`,
  };

  /* --- Pricing card renderer --- */
  const PricingCard = ({ tier, title, monthly, annual, annualSavings, annualPerMonth, features, extras, cta, popular, disabled }) => {
    const isEnterprise = tier === "enterprise";
    const isTeam = tier === "team";
    const cardBorder = popular ? GOLD_BORDER : "rgba(255,255,255,0.08)";
    const cardBg = popular ? "rgba(201,169,110,0.04)" : "rgba(255,255,255,0.02)";

    return (
      <div
        className="relative flex flex-col rounded-2xl p-6"
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          flex: "1 1 0",
          minWidth: 0,
        }}
      >
        {popular && (
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap flex items-center gap-1"
            style={{ background: GOLD, color: "#101018" }}
          >
            <Crown className="h-3 w-3" /> Most Popular
          </div>
        )}

        <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>

        {!isEnterprise ? (
          <>
            <div className="mb-4">
              {billing === "monthly" ? (
                <div className="text-3xl font-bold text-white">
                  ${monthly}<span className="text-sm font-normal text-white/40">/mo</span>
                </div>
              ) : (
                <>
                  <div className="text-3xl font-bold text-white">
                    ${annual.toLocaleString()}<span className="text-sm font-normal text-white/40">/yr</span>
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">${annualPerMonth}/mo</div>
                  <div
                    className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1"
                    style={{ background: "rgba(201,169,110,0.2)", color: GOLD }}
                  >
                    Save ${annualSavings}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="mb-4">
            <div className="text-2xl font-bold text-white">Custom pricing</div>
          </div>
        )}

        {/* Feature list */}
        <div className="space-y-2 mb-6 flex-1">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <span className="text-xs text-white/60 leading-tight">{f.text}</span>
            </div>
          ))}
          {extras && extras.length > 0 && (
            <>
              <div className="border-t border-white/[0.06] my-2" />
              {extras.map((f, i) => (
                <div key={`e-${i}`} className="flex items-start gap-2">
                  <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: GOLD }} />
                  <span className="text-xs text-white/60 leading-tight">{f.text}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* CTA button */}
        {isEnterprise ? (
          <a
            href="mailto:sales@spekd.ai"
            className="block w-full py-3 rounded-xl text-sm font-semibold text-center transition-all hover:brightness-110"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "white",
            }}
          >
            {cta}
          </a>
        ) : disabled ? (
          <button
            disabled
            className="w-full py-3 rounded-xl text-sm font-semibold text-white/40 cursor-not-allowed"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {cta}
          </button>
        ) : (
          <button
            onClick={() => handleTierSelect(tier)}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110"
            style={popular ? goldBtnStyle : {
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {cta}
          </button>
        )}

        {/* Session note for Pro */}
        {tier === "pro" && (
          <p className="text-[10px] text-white/25 text-center mt-2">Single user, one active session</p>
        )}
      </div>
    );
  };

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
        className={`relative mx-4 max-h-[90vh] overflow-y-auto rounded-2xl p-8 ${
          mode === "paywall" ? "w-full max-w-5xl" : "w-full max-w-lg"
        }`}
        style={{
          background: "rgba(16,17,24,0.98)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* --- PAYWALL / TIER SELECTION --- */}
        {mode === "paywall" && (
          <div>
            {/* Header */}
            <div className="flex justify-center mb-5">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "rgba(201,169,110,0.1)", border: `1px solid rgba(201,169,110,0.2)` }}
              >
                <Lock className="h-6 w-6" style={{ color: GOLD }} />
              </div>
            </div>

            <h2 className="text-xl font-semibold text-white text-center mb-2">
              You've used all 5 free searches.
            </h2>
            <p className="text-sm text-white/50 text-center mb-6 leading-relaxed max-w-xl mx-auto">
              Designers using SPEKD source an entire room in under 5 minutes — that used to take 3-4 hours across 20 vendor websites.
            </p>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <button
                onClick={() => setBilling("monthly")}
                className="text-sm font-medium px-4 py-1.5 rounded-full transition-all"
                style={{
                  background: billing === "monthly" ? GOLD_BG : "transparent",
                  border: `1px solid ${billing === "monthly" ? GOLD_BORDER : "rgba(255,255,255,0.08)"}`,
                  color: billing === "monthly" ? GOLD : "rgba(255,255,255,0.4)",
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("annual")}
                className="text-sm font-medium px-4 py-1.5 rounded-full transition-all"
                style={{
                  background: billing === "annual" ? GOLD_BG : "transparent",
                  border: `1px solid ${billing === "annual" ? GOLD_BORDER : "rgba(255,255,255,0.08)"}`,
                  color: billing === "annual" ? GOLD : "rgba(255,255,255,0.4)",
                }}
              >
                Annual
              </button>
            </div>

            {/* Pricing cards — 3 columns on desktop, stacked on mobile */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <PricingCard
                tier="pro"
                title="Pro"
                monthly={99}
                annual={990}
                annualSavings={198}
                annualPerMonth="82.50"
                features={PRO_FEATURES}
                cta="Start Pro"
                popular
              />
              <PricingCard
                tier="team"
                title="Team"
                monthly={249}
                annual={2490}
                annualSavings={498}
                annualPerMonth="207.50"
                features={PRO_FEATURES}
                extras={TEAM_EXTRAS}
                cta="Coming Soon"
                disabled
              />
              <PricingCard
                tier="enterprise"
                title="Enterprise"
                features={[...PRO_FEATURES.slice(0, 3), ...TEAM_EXTRAS.slice(0, 2)]}
                extras={ENTERPRISE_EXTRAS}
                cta="Contact Us"
              />
            </div>

            <p className="text-center">
              <button
                onClick={() => setMode("login")}
                className="text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                Already have an account? <span className="underline">Sign in</span>
              </button>
            </p>
          </div>
        )}

        {/* --- SIGNUP FORM --- */}
        {mode === "signup" && (
          <div>
            <button
              onClick={() => setMode("paywall")}
              className="absolute top-4 right-4 text-white/30 hover:text-white/60"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-semibold text-white mb-1">Create your account</h2>
            <p className="text-xs text-white/40 mb-1">
              Pro plan — {priceLabel()}
            </p>
            <p className="text-xs text-white/30 mb-6">Then you'll complete payment with Stripe</p>

            <form onSubmit={handleCheckout} className="space-y-4">
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
                <label className="block text-xs text-white/40 mb-1.5">Company / studio name</label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className={inputClass}
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
                style={goldBtnStyle}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Creating account..." : `Continue to Payment — ${priceLabel()}`}
              </button>
            </form>

            <p className="text-center mt-4">
              <button
                onClick={() => setMode("login")}
                className="text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                Already have an account? <span className="underline">Sign in</span>
              </button>
            </p>
          </div>
        )}

        {/* --- LOGIN FORM --- */}
        {mode === "login" && (
          <div>
            <button
              onClick={() => setMode("paywall")}
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
                onClick={() => { setError(""); setForgotSuccess(false); setMode("forgot"); }}
                className="text-xs text-white/30 hover:text-white/50 transition-colors block mx-auto"
              >
                Forgot password?
              </button>
              <button
                onClick={() => setMode("paywall")}
                className="text-xs text-white/30 hover:text-white/50 transition-colors block mx-auto"
              >
                Don't have an account? <span className="underline">View plans</span>
              </button>
            </div>
          </div>
        )}

        {/* --- FORGOT PASSWORD --- */}
        {mode === "forgot" && (
          <div>
            <button
              onClick={() => setMode("login")}
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
                  onClick={() => { setForgotSuccess(false); setError(""); setMode("login"); }}
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
                    onClick={() => { setError(""); setMode("login"); }}
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
