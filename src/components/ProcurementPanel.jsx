import { useState, useEffect } from "react";
import {
  Building,
  Clock,
  CreditCard,
  Truck,
  RotateCcw,
  Palette,
  Shield,
  Percent,
  ListOrdered,
  Phone,
  Globe,
  Mail,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";

const SEARCH_URL = (
  import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310"
).replace(/\/$/, "");

function SkeletonLine({ width = "w-full" }) {
  return (
    <div
      className={`${width} h-3 animate-pulse rounded bg-white/[0.06]`}
    />
  );
}

function InfoRow({ icon: Icon, label, value, children }) {
  if (!value && !children) return null;
  return (
    <div className="flex items-start gap-2.5 py-2">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-white/30" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">
          {label}
        </p>
        {value && <p className="mt-0.5 text-sm text-white/80">{value}</p>}
        {children}
      </div>
    </div>
  );
}

function OrderMethodBadge({ method }) {
  const config = {
    online: { bg: "bg-gold/10", text: "text-gold/70", icon: Globe },
    phone: { bg: "bg-green-500/15", text: "text-green-400", icon: Phone },
    email: { bg: "bg-purple-500/15", text: "text-purple-400", icon: Mail },
    rep: { bg: "bg-amber-500/15", text: "text-amber-400", icon: Building },
    portal: { bg: "bg-cyan-500/15", text: "text-cyan-400", icon: FileText },
  };
  const c = config[method?.toLowerCase()] || config.online;
  const Icon = c.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}
    >
      <Icon className="h-3 w-3" />
      {method}
    </span>
  );
}

export default function ProcurementPanel({ product }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stepsOpen, setStepsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchProcurement() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${SEARCH_URL}/procurement/product`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product }),
        });
        if (!res.ok) throw new Error("Failed to fetch procurement data");
        const json = await res.json();
        if (!cancelled) setData(json.procurement || json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (product) {
      fetchProcurement();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [product]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="mb-4 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-white/30" />
          <span className="text-sm text-white/40">
            Loading procurement info...
          </span>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <SkeletonLine width="w-20" />
              <SkeletonLine width={i % 2 === 0 ? "w-48" : "w-36"} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
        <div className="flex items-center gap-2 text-white/40">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">
            {error || "Procurement info not available for this vendor"}
          </span>
        </div>
      </div>
    );
  }

  const vendor = data.vendor_info;
  const leadTimes = vendor?.lead_time_weeks;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <h3 className="mb-4 text-sm font-semibold text-white/90">
        Procurement Details
      </h3>

      {/* Vendor header */}
      {vendor?.vendor_name && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <Building className="h-5 w-5 text-white/30" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white/80">
              {vendor.vendor_name}
            </p>
            {vendor.order_method && (
              <div className="mt-1 flex flex-wrap gap-1">
                {vendor.order_method.map((m, i) => (
                  <OrderMethodBadge key={i} method={m} />
                ))}
              </div>
            )}
          </div>
          {vendor.trade_discount && (
            <Badge
              variant="outline"
              className="border-green-500/30 bg-green-500/10 text-green-400"
            >
              <Percent className="mr-1 h-3 w-3" />
              {vendor.trade_discount}
            </Badge>
          )}
        </div>
      )}

      <div className="divide-y divide-white/[0.04]">
        {/* Lead times */}
        <InfoRow icon={Clock} label="Lead Time">
          <div className="mt-1 space-y-1">
            {data.lead_time && (
              <p className="text-sm text-white/80">
                Estimated:{" "}
                <span className="text-white/60">
                  {data.lead_time}
                </span>
              </p>
            )}
            {leadTimes?.com && (
              <p className="text-sm text-white/80">
                COM:{" "}
                <span className="text-white/60">{leadTimes.com} weeks</span>
              </p>
            )}
            {(leadTimes?.quick_ship || leadTimes?.in_stock) && (
              <p className="text-sm text-white/80">
                Quick-Ship:{" "}
                <span className="text-green-400/80">
                  {leadTimes.quick_ship || leadTimes.in_stock} weeks
                </span>
              </p>
            )}
          </div>
        </InfoRow>

        {/* Payment terms */}
        {vendor?.payment_terms && (
          <InfoRow
            icon={CreditCard}
            label="Payment Terms"
            value={Array.isArray(vendor.payment_terms) ? vendor.payment_terms.join(", ") : vendor.payment_terms}
          />
        )}

        {/* Deposit */}
        {data.deposit && (
          <InfoRow icon={CreditCard} label="Deposit" value={data.deposit} />
        )}

        {/* Shipping */}
        <InfoRow icon={Truck} label="Shipping" value={data.shipping} />

        {/* Return policy */}
        {vendor?.return_policy && (
          <InfoRow
            icon={RotateCcw}
            label="Return Policy"
            value={vendor.return_policy}
          />
        )}

        {/* COM */}
        {vendor?.com_minimum && (
          <InfoRow icon={Palette} label="COM (Customer's Own Material)">
            <div className="mt-1 space-y-1">
              <p className="text-sm text-white/80">
                Available:{" "}
                <span className="text-green-400">Yes</span>
              </p>
              <p className="text-sm text-white/60">
                Minimum: {vendor.com_minimum}
              </p>
            </div>
          </InfoRow>
        )}

        {/* Grade options */}
        {vendor?.grade_options && vendor.grade_options.length > 0 && (
          <InfoRow icon={Layers} label="Grade Options">
            <div className="mt-1.5 flex flex-wrap gap-1">
              {vendor.grade_options.map((grade, i) => (
                <span
                  key={i}
                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60"
                >
                  {grade}
                </span>
              ))}
            </div>
          </InfoRow>
        )}

        {/* Warranty */}
        {vendor?.warranty && (
          <InfoRow icon={Shield} label="Warranty" value={vendor.warranty} />
        )}

        {/* Ordering steps */}
        {data.ordering_steps && data.ordering_steps.length > 0 && (
          <div className="py-2">
            <button
              onClick={() => setStepsOpen((o) => !o)}
              className="flex w-full items-center gap-2.5"
            >
              <ListOrdered className="h-4 w-4 flex-shrink-0 text-white/30" />
              <div className="flex-1 text-left">
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/30">
                  Ordering Steps
                </p>
              </div>
              {stepsOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-white/30" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-white/30" />
              )}
            </button>

            <AnimatePresence>
              {stepsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <ol className="mt-2 ml-6 space-y-2">
                    {data.ordering_steps.map((step, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-white/60"
                      >
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-medium text-white/40">
                          {i + 1}
                        </span>
                        <span className="mt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
