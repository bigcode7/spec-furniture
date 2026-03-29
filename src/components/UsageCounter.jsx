import { Sparkles } from "lucide-react";

const GOLD = "#c4a882";

/**
 * UsageCounter — inline pill, NOT fixed positioned.
 * Parent component controls placement.
 */
export default function UsageCounter({ remaining, total = 3, onTrialClick }) {
  if (remaining == null || remaining > total) return null;

  const exhausted = remaining <= 0;

  return (
    <button
      onClick={exhausted ? onTrialClick : undefined}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium transition-all ${exhausted ? "cursor-pointer active:scale-95" : "cursor-default"}`}
      style={{
        background: exhausted
          ? `linear-gradient(135deg, ${GOLD}, #B8944F)`
          : "rgba(255,255,255,0.04)",
        color: exhausted ? "#080c18" : "rgba(255,255,255,0.4)",
        border: exhausted ? "none" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {exhausted ? (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          Start free trial
        </>
      ) : (
        <span>{remaining}/{total} free searches</span>
      )}
    </button>
  );
}
