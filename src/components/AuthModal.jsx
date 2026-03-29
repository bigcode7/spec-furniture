import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, ArrowRight, AlertCircle, Check, Mail, Lock, User, Building2 } from "lucide-react";
import { register, login, getSubscriptionStatus } from "@/api/authClient";
import { useAuth } from "@/lib/AuthContext";

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, authModalMode, setAuthModalMode, onAuthSuccess } = useAuth();
  const [mode, setMode] = useState(authModalMode); // "signup" | "login"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Sync mode when modal opens
  const handleClose = () => {
    setShowAuthModal(false);
    setError("");
    setSuccess(false);
    setForgotMode(false);
    setForgotSent(false);
  };

  const switchMode = (m) => {
    setMode(m);
    setAuthModalMode(m);
    setError("");
    setSuccess(false);
    setForgotMode(false);
    setForgotSent(false);
  };

  // Update local mode when parent changes
  if (showAuthModal && authModalMode !== mode && !loading) {
    setMode(authModalMode);
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!fullName.trim()) {
          setError("Full name is required");
          setLoading(false);
          return;
        }
        const result = await register({
          email,
          password,
          full_name: fullName,
          business_name: businessName,
        });
        if (result.ok) {
          // Fetch and cache subscription status
          try {
            const sub = await getSubscriptionStatus();
            localStorage.setItem("spec_sub_status", sub.status || "guest");
          } catch {}
          setSuccess(true);
          setTimeout(() => {
            onAuthSuccess(result.user, true);
          }, 800);
        } else {
          setError(result.error || "Registration failed");
        }
      } else {
        const result = await login({ email, password });
        if (result.ok) {
          // Fetch and cache subscription status
          try {
            const sub = await getSubscriptionStatus();
            localStorage.setItem("spec_sub_status", sub.status || "guest");
          } catch {}
          setSuccess(true);
          setTimeout(() => {
            onAuthSuccess(result.user);
          }, 800);
        } else {
          setError(result.error || "Login failed");
        }
      }
    } catch (err) {
      setError("Connection failed. Is the server running?");
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const baseUrl = (import.meta.env.VITE_SEARCH_SERVICE_URL || "https://api.spekd.ai").replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error("Request failed");
      setForgotSent(true);
    } catch (err) {
      // Always show success message to avoid leaking account existence
      setForgotSent(true);
    }
    setLoading(false);
  };

  const passwordStrength = (() => {
    if (!password) return null;
    if (password.length < 8) return { label: "Too short", color: "text-red-400", bg: "bg-red-400" };
    let score = 0;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    if (password.length >= 12) score++;
    if (score <= 2) return { label: "Weak", color: "text-amber-400", bg: "bg-amber-400" };
    if (score <= 3) return { label: "Good", color: "text-emerald-400", bg: "bg-emerald-400" };
    return { label: "Strong", color: "text-emerald-400", bg: "bg-emerald-400" };
  })();

  return (
    <AnimatePresence>
      {showAuthModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "rgba(12, 13, 20, 0.98)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative px-8 pt-8 pb-2">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.04] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="flex items-center gap-2 mb-1">
                <img src="/logo.png" alt="SPEKD" className="h-7 w-7 object-contain" />
                <span className="font-brand text-base tracking-[0.2em] text-white/80 font-medium">SPEKD</span>
              </div>

              <h2 className="text-xl font-semibold text-white mt-4">
                {forgotMode ? "Reset your password" : mode === "signup" ? "Create your free account" : "Welcome back"}
              </h2>
              <p className="text-xs text-white/40 mt-1">
                {forgotMode
                  ? "Enter your email and we'll send you a reset link."
                  : mode === "signup"
                  ? "Join thousands of designers sourcing smarter."
                  : "Sign in to access your quotes, projects, and saved collections."}
              </p>
            </div>

            {/* Forgot Password View */}
            {forgotMode ? (
              <div className="px-8 py-6 space-y-4">
                {forgotSent ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-3">
                      <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs text-emerald-400">
                        If an account exists with that email, a reset link has been sent.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setForgotMode(false); setForgotSent(false); setError(""); }}
                      className="text-xs font-medium transition-colors hover:opacity-80"
                      style={{ color: "#c4a882" }}
                    >
                      Back to Sign In
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        autoComplete="email"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 transition-colors"
                        required
                      />
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                            <span className="text-xs text-red-400">{error}</span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all disabled:opacity-60"
                      style={{
                        background: "linear-gradient(135deg, #c4a882, #B8944F)",
                        color: "#0A0B10",
                      }}
                    >
                      {loading ? (
                        <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          Send Reset Link
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setForgotMode(false); setError(""); }}
                      className="text-xs font-medium transition-colors hover:opacity-80"
                      style={{ color: "#c4a882" }}
                    >
                      Back to Sign In
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <>
              {/* Form */}
              <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
                {mode === "signup" && (
                  <>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Full name"
                        autoComplete="name"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 transition-colors"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Business name (optional)"
                        autoComplete="organization"
                        className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 transition-colors"
                      />
                    </div>
                  </>
                )}

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    autoComplete="email"
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 transition-colors"
                    required
                  />
                </div>

                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "signup" ? "Create a password (8+ characters)" : "Password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-gold/30 transition-colors"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {mode === "signup" && passwordStrength && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${passwordStrength.bg}`}
                          style={{
                            width: passwordStrength.label === "Too short" ? "20%" :
                                   passwordStrength.label === "Weak" ? "50%" :
                                   passwordStrength.label === "Good" ? "75%" : "100%"
                          }}
                        />
                      </div>
                      <span className={`text-[10px] ${passwordStrength.color}`}>{passwordStrength.label}</span>
                    </div>
                  )}
                  {mode === "login" && (
                    <div className="mt-1.5 text-right">
                      <button
                        type="button"
                        onClick={() => { setForgotMode(true); setError(""); }}
                        className="text-[11px] transition-colors hover:opacity-80"
                        style={{ color: "#c4a882" }}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                        <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                        <span className="text-xs text-red-400">{error}</span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || success}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all disabled:opacity-60"
                  style={{
                    background: success
                      ? "linear-gradient(135deg, rgba(110,180,140,0.3), rgba(110,180,140,0.2))"
                      : "linear-gradient(135deg, #c4a882, #B8944F)",
                    color: success ? "rgba(110,180,140,0.9)" : "#0A0B10",
                  }}
                >
                  {success ? (
                    <>
                      <Check className="h-4 w-4" />
                      {mode === "signup" ? "Account created!" : "Signed in!"}
                    </>
                  ) : loading ? (
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === "signup" ? "Create Account" : "Sign In"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
                {success && mode === "signup" && (
                  <p className="text-[11px] text-white/40 text-center">
                    Check your email to verify your account
                  </p>
                )}
              </form>

              {/* Footer */}
              <div className="px-8 pb-6">
                {mode === "signup" && (
                  <p className="text-[10px] text-white/20 text-center mb-4">
                    By creating an account, you agree to Spekd's terms of service and privacy policy.
                  </p>
                )}

                <div className="pt-3 border-t border-white/[0.06]">
                  {mode === "signup" ? (
                    <p className="text-xs text-white/30 text-center">
                      Already have an account?{" "}
                      <button onClick={() => switchMode("login")} className="text-gold/70 hover:text-gold transition-colors font-medium" style={{ color: "#c4a882" }}>
                        Sign in
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-white/30 text-center">
                      Don't have an account?{" "}
                      <button onClick={() => switchMode("signup")} className="text-gold/70 hover:text-gold transition-colors font-medium" style={{ color: "#c4a882" }}>
                        Create one free
                      </button>
                    </p>
                  )}
                </div>
              </div>
              </>
            )}

            {/* Features list (signup only) */}
            {!forgotMode && mode === "signup" && (
              <div className="px-8 pb-6">
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
                  <div className="text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-3">Free account includes</div>
                  <div className="space-y-2">
                    {[
                      "5 free AI-powered searches across 42,000+ products",
                      "7-day free Pro trial — no credit card required",
                      "Save favorites & compare products",
                      "Access to 20 premium trade vendors",
                    ].map((feature) => (
                      <div key={feature} className="flex items-start gap-2">
                        <Check className="h-3 w-3 text-emerald-400/60 mt-0.5 flex-shrink-0" />
                        <span className="text-[11px] text-white/40">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
