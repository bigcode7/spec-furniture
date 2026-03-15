import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Building2, ShoppingBag, Pencil, User, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const roles = [
  {
    key: "manufacturer",
    label: "Manufacturer",
    icon: Building2,
    desc: "List your products, see demand signals, manage orders from retailers and consumers.",
    iconBg: "bg-purple-100 text-purple-600",
    activeBorder: "border-purple-500 bg-purple-50",
  },
  {
    key: "retailer",
    label: "Retailer",
    icon: ShoppingBag,
    desc: "Search all manufacturers at once. Place orders from one unified cart.",
    iconBg: "bg-blue-100 text-[#0066CC]",
    activeBorder: "border-[#0066CC] bg-[#F0F7FF]",
  },
  {
    key: "designer",
    label: "Interior Designer",
    icon: Pencil,
    desc: "Build client project boards, generate quotes, and order — all in one flow.",
    iconBg: "bg-emerald-100 text-emerald-600",
    activeBorder: "border-emerald-500 bg-emerald-50",
  },
  {
    key: "consumer",
    label: "Consumer",
    icon: User,
    desc: "Browse and buy furniture directly from top manufacturers.",
    iconBg: "bg-orange-100 text-orange-600",
    activeBorder: "border-orange-500 bg-orange-50",
  },
];

export default function RoleSelector({ onRoleSet }) {
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    await base44.auth.updateMe({ role: selected });
    onRoleSet(selected);
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F0F7FF] via-white to-[#F5F5F5] flex flex-col items-center justify-center px-4 py-16 font-['Inter',sans-serif]">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <span className="text-3xl font-bold text-[#0066CC]">Spec</span>
          <h1 className="text-2xl font-bold text-[#222222] mt-4 mb-2">How will you use Spec?</h1>
          <p className="text-gray-500">Choose your role so we can tailor your experience.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {roles.map((role) => {
            const isActive = selected === role.key;
            return (
              <button
                key={role.key}
                onClick={() => setSelected(role.key)}
                className={`text-left p-5 rounded-2xl border-2 transition-all hover:shadow-md relative ${
                  isActive ? role.activeBorder + " border-2" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {isActive && (
                  <div className="absolute top-3 right-3 w-6 h-6 bg-[#0066CC] rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${role.iconBg}`}>
                  <role.icon className="w-5 h-5" />
                </div>
                <div className="font-bold text-[#222222] mb-1">{role.label}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{role.desc}</div>
              </button>
            );
          })}
        </div>

        <Button
          size="lg"
          className="w-full bg-[#0066CC] hover:bg-[#0055AA] text-white h-12 text-base"
          disabled={!selected || saving}
          onClick={handleContinue}
        >
          {saving ? "Setting up your account..." : "Continue"}
          {!saving && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}