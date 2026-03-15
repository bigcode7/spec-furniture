import {
  Dog,
  Baby,
  Building,
  AlertTriangle,
  Sparkles,
  Shield,
  Droplets,
  Sun,
  Clock,
  Tag,
} from "lucide-react";

const ICON_MAP = {
  paw: Dog,
  pet: Dog,
  dog: Dog,
  kid: Baby,
  baby: Baby,
  commercial: Building,
  building: Building,
  warning: AlertTriangle,
  premium: Sparkles,
  sparkles: Sparkles,
  durable: Shield,
  shield: Shield,
  water: Droplets,
  "water-resistant": Droplets,
  droplets: Droplets,
  uv: Sun,
  "uv-resistant": Sun,
  sun: Sun,
  "long-lasting": Clock,
  clock: Clock,
};

const COLOR_MAP = {
  green: {
    bg: "bg-green-500/15",
    border: "border-green-500/25",
    text: "text-green-400",
  },
  yellow: {
    bg: "bg-amber-500/15",
    border: "border-amber-500/25",
    text: "text-amber-400",
  },
  red: {
    bg: "bg-red-500/15",
    border: "border-red-500/25",
    text: "text-red-400",
  },
  blue: {
    bg: "bg-gold/10",
    border: "border-gold/25",
    text: "text-gold",
  },
  gray: {
    bg: "bg-white/5",
    border: "border-white/[0.06]",
    text: "text-white/50",
  },
};

export default function MaterialBadges({ badges }) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge, i) => {
        const Icon = ICON_MAP[badge.icon] || Tag;
        const colors = COLOR_MAP[badge.color] || COLOR_MAP.gray;

        return (
          <span
            key={i}
            className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-tight ${colors.bg} ${colors.border} ${colors.text}`}
          >
            <Icon className="h-2.5 w-2.5 flex-shrink-0" />
            <span className="whitespace-nowrap">{badge.label}</span>
          </span>
        );
      })}
    </div>
  );
}
