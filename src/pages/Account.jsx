import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Tag, Settings, Shield, Database, Save, Check, AlertCircle,
  Eye, EyeOff, Lock, Trash2, Download, ChevronRight, Bell, Monitor,
  X, Phone, MapPin, Award, CreditCard, Calendar, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { updateMe, changePassword, deleteAccount, exportData, getSubscriptionStatus, cancelSubscription, reactivateSubscription, openBillingPortal } from "@/api/authClient";
import { useTradePricing } from "@/lib/TradePricingContext";

// ── Vendors for trade discounts (alphabetical, matching catalog) ──

const CATALOG_VENDORS = [
  { id: "baker", name: "Baker Furniture" },
  { id: "bernhardt", name: "Bernhardt" },
  { id: "caracole", name: "Caracole" },
  { id: "century", name: "Century Furniture" },
  { id: "cr-laine", name: "CR Laine" },
  { id: "gabby", name: "Gabby" },
  { id: "hancock-moore", name: "Hancock & Moore" },
  { id: "hickory-chair", name: "Hickory Chair" },
  { id: "highland-house", name: "Highland House" },
  { id: "hooker", name: "Hooker Furniture" },
  { id: "lexington", name: "Lexington Home Brands" },
  { id: "norwalk", name: "Norwalk Furniture" },
  { id: "rowe", name: "Rowe Furniture" },
  { id: "sherrill", name: "Sherrill Furniture" },
  { id: "stickley", name: "Stickley" },
  { id: "surya", name: "Surya" },
  { id: "theodore-alexander", name: "Theodore Alexander" },
  { id: "universal", name: "Universal Furniture" },
  { id: "vanguard", name: "Vanguard Furniture" },
  { id: "wesley-hall", name: "Wesley Hall" },
];

// ── Toast notification ──

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-20 right-6 z-[200] flex items-center gap-2 rounded-xl px-4 py-3 shadow-2xl"
      style={{
        background: type === "success" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
        border: `1px solid ${type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
        backdropFilter: "blur(20px)",
      }}
    >
      {type === "success" ? (
        <Check className="h-4 w-4 text-emerald-400" />
      ) : (
        <AlertCircle className="h-4 w-4 text-red-400" />
      )}
      <span className={`text-sm ${type === "success" ? "text-emerald-400" : "text-red-400"}`}>{message}</span>
    </motion.div>
  );
}

// ── Sidebar ──

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "discounts", label: "Trade Discounts", icon: Tag },
  { id: "subscription", label: "Subscription", icon: CreditCard },
  { id: "preferences", label: "Preferences", icon: Monitor },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security", icon: Shield },
  { id: "data", label: "Data & Privacy", icon: Database },
];

function Sidebar({ active, onSelect }) {
  return (
    <nav className="w-56 shrink-0 pr-6 border-r border-white/[0.06] hidden lg:block">
      <div className="sticky top-24 space-y-0.5">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                isActive
                  ? "bg-white/[0.06] text-white font-medium"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? "text-[var(--gold)]" : "text-white/25"}`} />
              {s.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Mobile section picker ──

function MobileSectionPicker({ active, onSelect }) {
  return (
    <div className="lg:hidden flex gap-1 overflow-x-auto pb-4 mb-6 scrollbar-none -mx-1 px-1">
      {SECTIONS.map((s) => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`flex items-center gap-2 shrink-0 rounded-lg px-3 py-2 text-xs transition-all ${
              isActive
                ? "bg-white/[0.08] text-white font-medium"
                : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Section wrapper ──

function Section({ title, description, children }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description && <p className="text-sm text-white/35 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Form field ──

function Field({ label, icon: Icon, children, hint }) {
  return (
    <div>
      <label className="flex items-center gap-2 text-xs text-white/50 font-medium mb-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-white/25" />}
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-white/20 mt-1">{hint}</p>}
    </div>
  );
}

const INPUT_CLS = "w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[var(--gold)]/30 transition-colors";

// ── Profile Section ──

function ProfileSection({ user, onSave, saving, toast }) {
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    business_name: user?.business_name || "",
    phone: user?.phone || "",
    location: user?.location || "",
    membership_id: user?.membership_id || "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        full_name: user.full_name || "",
        business_name: user.business_name || "",
        phone: user.phone || "",
        location: user.location || "",
        membership_id: user.membership_id || "",
      });
    }
  }, [user]);

  const initial = (user?.full_name || user?.email || "U")[0].toUpperCase();

  return (
    <Section title="Profile" description="Your personal and business information.">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white/80 shrink-0"
          style={{
            background: "rgba(200,169,126,0.15)",
            border: "1px solid rgba(200,169,126,0.25)",
            boxShadow: "0 0 24px rgba(200,169,126,0.1)",
          }}
        >
          {initial}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{user?.full_name || "Your Name"}</p>
          <p className="text-xs text-white/35">{user?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Full Name" icon={User}>
          <input
            type="text"
            value={form.full_name}
            onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
            className={INPUT_CLS}
            placeholder="Jane Smith"
          />
        </Field>

        <Field label="Company / Firm Name">
          <input
            type="text"
            value={form.business_name}
            onChange={(e) => setForm(f => ({ ...f, business_name: e.target.value }))}
            className={INPUT_CLS}
            placeholder="Smith Interiors"
          />
        </Field>

        <Field label="Phone" icon={Phone} hint="Optional">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
            className={INPUT_CLS}
            placeholder="(555) 123-4567"
          />
        </Field>

        <Field label="Location" icon={MapPin} hint="Helps with local vendor recommendations">
          <input
            type="text"
            value={form.location}
            onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
            className={INPUT_CLS}
            placeholder="High Point, NC"
          />
        </Field>

        <Field label="ASID / IIDA Membership" icon={Award} hint="Optional — validates trade credentials">
          <input
            type="text"
            value={form.membership_id}
            onChange={(e) => setForm(f => ({ ...f, membership_id: e.target.value }))}
            className={INPUT_CLS}
            placeholder="e.g. ASID-12345"
          />
        </Field>
      </div>

      <button
        onClick={() => onSave(form)}
        disabled={saving}
        className="btn-gold flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all disabled:opacity-50"
      >
        {saving ? (
          <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        Save Profile
      </button>
    </Section>
  );
}

// ── Trade Discounts Section ──

function TradeDiscountsSection({ toast }) {
  const { discounts, setVendorDiscount, setDefaultDiscount } = useTradePricing();
  const [defaultVal, setDefaultVal] = useState(discounts.default_discount || "");
  const [vendorVals, setVendorVals] = useState({});
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    setDefaultVal(discounts.default_discount || "");
    const v = {};
    for (const vendor of CATALOG_VENDORS) {
      v[vendor.id] = discounts.vendors?.[vendor.id] ?? "";
    }
    setVendorVals(v);
  }, [discounts]);

  const handleDefaultSave = () => {
    const num = parseFloat(defaultVal) || 0;
    setDefaultDiscount(Math.min(70, Math.max(0, num)));
    flash("default");
  };

  const handleVendorSave = (vendorId, value) => {
    const num = parseFloat(value) || 0;
    setVendorDiscount(vendorId, Math.min(70, Math.max(0, num)));
    flash(vendorId);
  };

  const flash = (id) => {
    setSaved(id);
    setTimeout(() => setSaved(null), 1200);
  };

  return (
    <Section
      title="Trade Discounts"
      description="Enter your trade discount for each vendor to see estimated trade pricing while you browse. Your discounts are private and never shared."
    >
      {/* Default discount */}
      <div
        className="rounded-xl p-5"
        style={{
          background: "rgba(200,169,126,0.06)",
          border: "1px solid rgba(200,169,126,0.12)",
        }}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">Default Discount</p>
            <p className="text-xs text-white/30 mt-0.5">Applies to any vendor without a specific discount below</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="70"
              value={defaultVal}
              onChange={(e) => setDefaultVal(e.target.value)}
              onBlur={handleDefaultSave}
              onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); handleDefaultSave(); } }}
              placeholder="45"
              className="w-20 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white text-center font-medium focus:outline-none focus:border-[var(--gold)]/30 placeholder:text-white/15"
            />
            <span className="text-sm text-white/30 font-medium">%</span>
            <AnimatePresence>
              {saved === "default" && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                  <Check className="h-4 w-4 text-emerald-400" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-white/25">
        Typical trade discounts range from 40-50% off retail. Enter 0 to use the default for that vendor.
      </p>

      {/* Per-vendor grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CATALOG_VENDORS.map((vendor) => (
          <div
            key={vendor.id}
            className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-white/[0.02]"
            style={{ border: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/70 truncate">{vendor.name}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <input
                type="number"
                min="0"
                max="70"
                value={vendorVals[vendor.id] ?? ""}
                onChange={(e) => setVendorVals(prev => ({ ...prev, [vendor.id]: e.target.value }))}
                onBlur={(e) => handleVendorSave(vendor.id, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.target.blur(); handleVendorSave(vendor.id, e.target.value); } }}
                placeholder={String(discounts.default_discount || "—")}
                className="w-16 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-xs text-white text-center font-medium focus:outline-none focus:border-[var(--gold)]/30 placeholder:text-white/10"
              />
              <span className="text-[10px] text-white/20">%</span>
              <div className="w-4">
                <AnimatePresence>
                  {saved === vendor.id && (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-white/15 text-center pt-2">
        Discounts are estimates only. Confirm actual trade pricing with each vendor.
      </p>
    </Section>
  );
}

// ── Preferences Section ──

function PreferencesSection({ user, onSave, saving }) {
  const prefs = user?.preferences || {};
  const [form, setForm] = useState({
    results_per_page: prefs.results_per_page || 20,
    default_sort: prefs.default_sort || "best_match",
    image_preference: prefs.image_preference || "no_preference",
    my_vendors: prefs.my_vendors || [],
    my_vendors_only: prefs.my_vendors_only ?? false,
  });

  const toggleVendor = (vendorId) => {
    setForm(f => {
      const current = f.my_vendors || [];
      const next = current.includes(vendorId)
        ? current.filter(v => v !== vendorId)
        : [...current, vendorId];
      return { ...f, my_vendors: next };
    });
  };

  const sortOptions = [
    { value: "best_match", label: "Best Match" },
    { value: "price_asc", label: "Price Low-High" },
    { value: "price_desc", label: "Price High-Low" },
    { value: "vendor_az", label: "Vendor A-Z" },
    { value: "newest", label: "Newest" },
  ];

  return (
    <Section title="Display Preferences" description="Customize how you browse the catalog.">
      <div className="space-y-5">
        <Field label="Results Per Page">
          <div className="flex gap-2">
            {[20, 40, 60, 80].map(n => (
              <button
                key={n}
                onClick={() => setForm(f => ({ ...f, results_per_page: n }))}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  form.results_per_page === n
                    ? "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25"
                    : "bg-white/[0.04] text-white/40 border border-white/10 hover:text-white/60"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Default Sort Order">
          <div className="flex flex-wrap gap-2">
            {sortOptions.map(o => (
              <button
                key={o.value}
                onClick={() => setForm(f => ({ ...f, default_sort: o.value }))}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  form.default_sort === o.value
                    ? "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25"
                    : "bg-white/[0.04] text-white/40 border border-white/10 hover:text-white/60"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Image Preference">
          <div className="flex gap-2">
            {[
              { value: "white_bg", label: "Prefer White Background" },
              { value: "no_preference", label: "No Preference" },
            ].map(o => (
              <button
                key={o.value}
                onClick={() => setForm(f => ({ ...f, image_preference: o.value }))}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  form.image_preference === o.value
                    ? "bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/25"
                    : "bg-white/[0.04] text-white/40 border border-white/10 hover:text-white/60"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <Field label="My Vendors">
          <p className="text-xs text-white/30 mb-3 -mt-1">
            Select the vendors you have trade accounts with. When enabled, search results will only show products from these vendors.
          </p>
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setForm(f => ({ ...f, my_vendors_only: !f.my_vendors_only }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.my_vendors_only && form.my_vendors.length > 0 ? "bg-[var(--gold)]" : "bg-white/10"
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                form.my_vendors_only && form.my_vendors.length > 0 ? "translate-x-6" : "translate-x-1"
              }`} />
            </button>
            <span className="text-xs text-white/50">
              {form.my_vendors_only && form.my_vendors.length > 0
                ? `Showing only my vendors (${form.my_vendors.length} selected)`
                : "Showing all vendors"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {CATALOG_VENDORS.map(v => {
              const selected = (form.my_vendors || []).includes(v.id);
              return (
                <button
                  key={v.id}
                  onClick={() => toggleVendor(v.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                    selected
                      ? "bg-[var(--gold)]/10 border border-[var(--gold)]/25"
                      : "bg-white/[0.02] border border-white/[0.04] hover:border-white/10"
                  }`}
                >
                  <div className={`flex h-4 w-4 items-center justify-center rounded border transition-all shrink-0 ${
                    selected
                      ? "bg-[var(--gold)] border-[var(--gold)]"
                      : "border-white/20"
                  }`}>
                    {selected && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <span className={`text-sm truncate ${selected ? "text-[var(--gold)]" : "text-white/50"}`}>
                    {v.name}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

      <button
        onClick={() => onSave({ preferences: form })}
        disabled={saving}
        className="btn-gold flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        Save Preferences
      </button>
    </Section>
  );
}

// ── Notifications Section ──

function NotificationsSection({ user, onSave, saving }) {
  const notifs = user?.notifications || {};
  const [form, setForm] = useState({
    new_vendors: notifs.new_vendors ?? true,
    new_features: notifs.new_features ?? true,
    weekly_trends: notifs.weekly_trends ?? false,
  });

  function Toggle({ checked, onChange, label, description }) {
    return (
      <div className="flex items-start justify-between gap-4 py-3">
        <div>
          <p className="text-sm text-white/70">{label}</p>
          <p className="text-xs text-white/25 mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => onChange(!checked)}
          className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
            checked ? "bg-[var(--gold)]/30" : "bg-white/10"
          }`}
        >
          <div
            className={`absolute top-1 h-4 w-4 rounded-full transition-all ${
              checked ? "left-6 bg-[var(--gold)]" : "left-1 bg-white/40"
            }`}
          />
        </button>
      </div>
    );
  }

  return (
    <Section title="Notifications" description="Control what emails you receive.">
      <div className="divide-y divide-white/[0.04]">
        <Toggle
          checked={form.new_vendors}
          onChange={(v) => setForm(f => ({ ...f, new_vendors: v }))}
          label="New vendor additions"
          description="Get notified when we add a new vendor to the platform"
        />
        <Toggle
          checked={form.new_features}
          onChange={(v) => setForm(f => ({ ...f, new_features: v }))}
          label="New features"
          description="Product updates and new capabilities"
        />
        <Toggle
          checked={form.weekly_trends}
          onChange={(v) => setForm(f => ({ ...f, weekly_trends: v }))}
          label="Weekly trend reports"
          description="Curated weekly digest of trending products and styles"
        />
      </div>

      <button
        onClick={() => onSave({ notifications: form })}
        disabled={saving}
        className="btn-gold flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        Save Notifications
      </button>
    </Section>
  );
}

// ── Security Section ──

function SecuritySection({ toast }) {
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", new_pw: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const handleChangePassword = async () => {
    if (pwForm.new_pw !== pwForm.confirm) {
      toast("Passwords do not match", "error");
      return;
    }
    if (pwForm.new_pw.length < 8) {
      toast("Password must be at least 8 characters", "error");
      return;
    }
    setSaving(true);
    try {
      const result = await changePassword({
        current_password: pwForm.current,
        new_password: pwForm.new_pw,
      });
      if (result.ok) {
        toast("Password changed successfully", "success");
        setPwForm({ current: "", new_pw: "", confirm: "" });
        setShowPw(false);
      } else {
        toast(result.error || "Failed to change password", "error");
      }
    } catch {
      toast("Connection error", "error");
    }
    setSaving(false);
  };

  return (
    <Section title="Security" description="Manage your password and account security.">
      {/* Change password */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => setShowPw(!showPw)}
          className="flex w-full items-center justify-between px-5 py-4 text-sm text-white/70 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-white/25" />
            Change Password
          </div>
          <ChevronRight className={`h-4 w-4 text-white/20 transition-transform ${showPw ? "rotate-90" : ""}`} />
        </button>

        <AnimatePresence>
          {showPw && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-3">
                <div className="relative">
                  <input
                    type="password"
                    value={pwForm.current}
                    onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))}
                    placeholder="Current password"
                    className={INPUT_CLS}
                  />
                </div>
                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={pwForm.new_pw}
                    onChange={(e) => setPwForm(f => ({ ...f, new_pw: e.target.value }))}
                    placeholder="New password (8+ characters)"
                    className={INPUT_CLS + " pr-10"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50"
                  >
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Confirm new password"
                  className={INPUT_CLS}
                />
                <button
                  onClick={handleChangePassword}
                  disabled={saving || !pwForm.current || !pwForm.new_pw || !pwForm.confirm}
                  className="btn-gold flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40"
                >
                  {saving ? (
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Update Password
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2FA placeholder */}
      <div
        className="flex items-center justify-between rounded-xl px-5 py-4"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-white/25" />
          <div>
            <p className="text-sm text-white/70">Two-Factor Authentication</p>
            <p className="text-[10px] text-white/25 mt-0.5">Add an extra layer of security to your account</p>
          </div>
        </div>
        <span className="text-[10px] text-white/15 bg-white/[0.04] rounded-full px-3 py-1">Coming soon</span>
      </div>
    </Section>
  );
}

// ── Data & Privacy Section ──

function DataPrivacySection({ toast }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const handleExport = async () => {
    try {
      const result = await exportData();
      if (result.ok) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `spekd-data-export-${new Date().toISOString().split("T")[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast("Data exported successfully", "success");
      } else {
        toast(result.error || "Export failed", "error");
      }
    } catch {
      toast("Connection error", "error");
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== "DELETE") return;
    setDeleting(true);
    try {
      const result = await deleteAccount();
      if (result.ok) {
        navigate("/");
        window.location.reload();
      } else {
        toast(result.error || "Failed to delete account", "error");
      }
    } catch {
      toast("Connection error", "error");
    }
    setDeleting(false);
  };

  return (
    <Section title="Data & Privacy" description="Your data belongs to you.">
      {/* Export */}
      <div
        className="flex items-center justify-between rounded-xl px-5 py-4"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3">
          <Download className="h-4 w-4 text-white/25" />
          <div>
            <p className="text-sm text-white/70">Export My Data</p>
            <p className="text-[10px] text-white/25 mt-0.5">Download all your saved data as JSON</p>
          </div>
        </div>
        <button
          onClick={handleExport}
          className="text-xs text-[var(--gold)] hover:text-[var(--gold-bright)] font-medium transition-colors"
        >
          Download
        </button>
      </div>

      {/* Privacy note */}
      <div className="rounded-xl bg-white/[0.02] px-5 py-4" style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
        <p className="text-xs text-white/30 leading-relaxed">
          Your trade discounts, saved products, and search history are private to your account.
          We never share your data with vendors or other designers. Your discount percentages
          are stored locally in your browser and on our servers with encryption.
        </p>
      </div>

      {/* Delete account */}
      <div className="pt-6 border-t border-white/[0.06]">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete my account
        </button>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(false)}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl p-6 space-y-4"
              style={{
                background: "rgba(12, 13, 20, 0.98)",
                border: "1px solid rgba(239,68,68,0.2)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                  <Trash2 className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Delete Account</h3>
                  <p className="text-xs text-white/35">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-sm text-white/50 leading-relaxed">
                This will permanently delete your account, saved products, quotes, and all preferences.
                This cannot be undone.
              </p>

              <div>
                <p className="text-xs text-white/30 mb-2">Type <span className="text-red-400/70 font-mono">DELETE</span> to confirm:</p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="w-full bg-white/[0.04] border border-red-500/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/40 placeholder:text-white/15"
                  placeholder="DELETE"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteConfirm(""); }}
                  className="flex-1 rounded-xl px-4 py-3 text-sm text-white/50 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteConfirm !== "DELETE" || deleting}
                  className="flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  );
}

// ── Subscription Section ──

function SubscriptionSection({ toast }) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showAnnualOffer, setShowAnnualOffer] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    getSubscriptionStatus().then(data => {
      setSub(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleCancel = async () => {
    setCancelling(true);
    const result = await cancelSubscription(cancelReason);
    if (result.ok) {
      toast("Subscription cancelled. Access continues until " + new Date(result.access_until).toLocaleDateString());
      setSub(prev => ({ ...prev, status: "cancelled", current_period_end: result.access_until }));
      setShowCancel(false);
    } else {
      toast(result.error || "Failed to cancel", "error");
    }
    setCancelling(false);
  };

  const handleReactivate = async () => {
    const result = await reactivateSubscription();
    if (result.ok) {
      toast("Subscription reactivated!");
      setSub(prev => ({ ...prev, status: "active" }));
    } else if (result.error === "need_checkout") {
      toast("Please start a new subscription", "error");
    } else {
      toast(result.error || "Failed to reactivate", "error");
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    await openBillingPortal();
    setPortalLoading(false);
  };

  if (loading) {
    return (
      <Section title="Subscription" description="Manage your plan and billing.">
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 border-2 border-white/20 border-t-[var(--gold)] rounded-full animate-spin" />
        </div>
      </Section>
    );
  }

  const isActive = sub?.status === "active";
  const isTrialing = sub?.status === "trialing";
  const isCancelled = sub?.status === "cancelled";
  const isPastDue = sub?.status === "past_due";
  const isExpired = sub?.status === "trial_expired" || sub?.status === "guest";
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const trialEnd = sub?.trial_end ? new Date(sub.trial_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const trialDays = sub?.trial_days_remaining;

  return (
    <Section title="Subscription" description="Manage your plan and billing.">
      {/* Current plan card */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]/70 mb-1">
              {sub?.plan === "early_bird" ? "SPEKD Pro — Early Bird" : isActive ? "SPEKD Pro" : isTrialing ? "SPEKD Pro — Trial" : isCancelled ? "Cancelled" : isPastDue ? "Past Due" : "No Active Plan"}
            </div>
            <div className="text-xl font-semibold text-white">
              {isTrialing ? "Free Trial" : sub?.plan === "early_bird" ? <><span className="line-through text-white/30 text-base mr-2">$99</span>$49/month</> : sub?.plan === "annual" ? "$990/year" : sub?.plan === "monthly" ? "$99/month" : "Free"}
            </div>
            {sub?.plan === "early_bird" && (isActive || isTrialing) && (
              <div className="text-xs text-emerald-400/70 mt-0.5 font-medium">Locked in for life</div>
            )}
            {isTrialing && trialEnd && (
              <div className="text-xs text-white/40 mt-0.5">
                Trial ends {trialEnd}{trialDays != null && ` (${trialDays} day${trialDays !== 1 ? "s" : ""} remaining)`}
              </div>
            )}
          </div>
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${
            isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
            isTrialing ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
            isCancelled ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
            isPastDue ? "bg-red-500/10 text-red-400 border border-red-500/20" :
            "bg-white/5 text-white/40 border border-white/10"
          }`}>
            <div className={`h-1.5 w-1.5 rounded-full ${
              isActive ? "bg-emerald-400" : isTrialing ? "bg-blue-400" : isCancelled ? "bg-amber-400" : isPastDue ? "bg-red-400" : "bg-white/30"
            }`} />
            {isActive ? "Active" : isTrialing ? "Trial" : isCancelled ? "Cancels soon" : isPastDue ? "Payment failed" : "Inactive"}
          </div>
        </div>

        {periodEnd && (
          <div className="flex items-center gap-2 text-xs text-white/35 mb-4">
            <Calendar className="h-3.5 w-3.5" />
            {isCancelled ? `Access until ${periodEnd}` : `Next billing: ${periodEnd}`}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          {(isActive || isTrialing || isCancelled || isPastDue) && (
            <button onClick={handlePortal} disabled={portalLoading}
              className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white/50 hover:text-white/80 hover:border-white/15 transition-all disabled:opacity-40">
              {portalLoading ? <div className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              {isPastDue ? "Update Payment Method" : "Manage Billing"}
            </button>
          )}
          {(isCancelled || isExpired) && (
            <button onClick={handleReactivate}
              className="flex items-center gap-2 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/20 px-4 py-2.5 text-xs font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/15 transition-all">
              <ArrowRight className="h-3.5 w-3.5" />
              {isExpired ? (sub?.plan === "early_bird" ? "Reactivate Pro — $49/mo" : "Reactivate Pro — $99/mo") : "Reactivate Subscription"}
            </button>
          )}
        </div>
      </div>

      {/* Cancel section */}
      {(isActive || isTrialing) && !showCancel && (
        <button onClick={() => setShowCancel(true)}
          className="text-xs text-white/25 hover:text-red-400/60 transition-colors mt-2">
          Cancel subscription
        </button>
      )}

      {showCancel && !showAnnualOffer && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="rounded-xl border border-red-500/10 bg-red-500/[0.03] p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Cancel your subscription?</h3>
          <p className="text-xs text-white/40">Your access continues until the end of your current billing period{periodEnd ? ` (${periodEnd})` : ""}.</p>

          {sub?.plan === "monthly" && (
            <button onClick={() => setShowAnnualOffer(true)}
              className="w-full rounded-lg border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-4 text-left hover:bg-[var(--gold)]/10 transition-all">
              <div className="text-xs font-semibold text-[var(--gold)] mb-1">Switch to annual and save $198/year</div>
              <div className="text-[11px] text-white/30">$990/year ($82.50/mo) instead of $99/mo</div>
            </button>
          )}

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Why are you cancelling? (optional)</label>
            <select value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 focus:outline-none focus:border-red-400/30">
              <option value="">Select a reason...</option>
              <option value="too_expensive">Too expensive</option>
              <option value="not_enough_products">Not enough products</option>
              <option value="switched_tool">Switched to another tool</option>
              <option value="project_ended">Project ended</option>
              <option value="missing_features">Missing features I need</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setShowCancel(false)}
              className="flex-1 rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white/50 hover:text-white/80 transition-all">
              Keep Subscription
            </button>
            <button onClick={handleCancel} disabled={cancelling}
              className="flex-1 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/15 transition-all disabled:opacity-40">
              {cancelling ? "Cancelling..." : "Confirm Cancel"}
            </button>
          </div>
        </motion.div>
      )}

      {showAnnualOffer && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-[var(--gold)]/20 bg-[var(--gold)]/[0.03] p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--gold)]">Save $198/year with an annual plan</h3>
          <p className="text-xs text-white/40">You're currently paying $99/month ($1,188/year). Switch to annual for just $990/year — that's $82.50/month.</p>
          <div className="flex gap-3">
            <button onClick={() => { setShowAnnualOffer(false); }}
              className="flex-1 rounded-lg border border-white/[0.08] px-4 py-2.5 text-xs font-medium text-white/50 hover:text-white/80 transition-all">
              No, cancel anyway
            </button>
            <button onClick={async () => { await openBillingPortal(); }}
              className="flex-1 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/20 px-4 py-2.5 text-xs font-semibold text-[var(--gold)] hover:bg-[var(--gold)]/15 transition-all">
              Switch to Annual
            </button>
          </div>
        </motion.div>
      )}
    </Section>
  );
}

// ── Main Account Page ──

export default function Account() {
  const { user, isAuthenticated, isLoadingAuth, navigateToLogin, onAuthSuccess } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const [activeSection, setActiveSection] = useState(sectionParam || "profile");

  useEffect(() => {
    if (sectionParam && SECTIONS.some(s => s.id === sectionParam)) {
      setActiveSection(sectionParam);
    }
  }, [sectionParam]);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigateToLogin("login");
      navigate("/Search");
    }
  }, [isLoadingAuth, isAuthenticated]);

  const toast = useCallback((message, type = "success") => {
    setToastMsg({ message, type });
  }, []);

  const handleProfileSave = async (form) => {
    setSaving(true);
    try {
      const result = await updateMe(form);
      if (result.ok) {
        onAuthSuccess(result.user);
        toast("Profile saved");
      } else {
        toast(result.error || "Failed to save", "error");
      }
    } catch {
      toast("Connection error", "error");
    }
    setSaving(false);
  };

  const handlePrefSave = async (data) => {
    setSaving(true);
    try {
      const result = await updateMe(data);
      if (result.ok) {
        onAuthSuccess(result.user);
        toast("Saved");
      } else {
        toast(result.error || "Failed to save", "error");
      }
    } catch {
      toast("Connection error", "error");
    }
    setSaving(false);
  };

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-6 w-6 border-2 border-white/20 border-t-[var(--gold)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="page-wrap py-8">
      <AnimatePresence>
        {toastMsg && (
          <Toast
            message={toastMsg.message}
            type={toastMsg.type}
            onClose={() => setToastMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Account</h1>
        <p className="text-sm text-white/30 mt-1">Manage your profile, trade discounts, and preferences</p>
      </div>

      <div className="flex gap-8">
        <Sidebar active={activeSection} onSelect={setActiveSection} />
        <MobileSectionPicker active={activeSection} onSelect={setActiveSection} />

        <div className="flex-1 min-w-0">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {activeSection === "profile" && (
              <ProfileSection user={user} onSave={handleProfileSave} saving={saving} toast={toast} />
            )}
            {activeSection === "discounts" && (
              <TradeDiscountsSection toast={toast} />
            )}
            {activeSection === "subscription" && (
              <SubscriptionSection toast={toast} />
            )}
            {activeSection === "preferences" && (
              <PreferencesSection user={user} onSave={handlePrefSave} saving={saving} />
            )}
            {activeSection === "notifications" && (
              <NotificationsSection user={user} onSave={handlePrefSave} saving={saving} />
            )}
            {activeSection === "security" && (
              <SecuritySection toast={toast} />
            )}
            {activeSection === "data" && (
              <DataPrivacySection toast={toast} />
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
