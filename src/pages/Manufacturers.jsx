import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Search, Package, Clock, ArrowRight, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Manufacturers() {
  const [manufacturers, setManufacturers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    base44.entities.Manufacturer.filter({ status: "active" }).then(setManufacturers).catch(() => {});
  }, []);

  const filtered = manufacturers.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.headquarters || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#222222]">Manufacturers</h1>
          <p className="text-gray-500 mt-1">{manufacturers.length} manufacturers on the platform</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Manufacturers", val: manufacturers.length },
            { label: "Total Active SKUs", val: manufacturers.reduce((s, m) => s + (m.active_skus || 0), 0).toLocaleString() },
            { label: "Avg Lead Time", val: `${Math.round(manufacturers.reduce((s, m) => s + ((m.lead_time_min_weeks + m.lead_time_max_weeks) / 2 || 0), 0) / (manufacturers.length || 1))} wks` },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100">
              <div className="text-2xl font-bold text-[#0066CC]">{s.val}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search manufacturers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-white" />
        </div>

        {/* Grid */}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((m) => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-6 hover:shadow-md hover:border-[#0066CC]/30 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-[#F0F7FF] rounded-xl flex items-center justify-center text-lg font-black text-[#0066CC]">
                  {m.name[0]}
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
              </div>

              <h3 className="font-bold text-[#222] text-lg mb-1">{m.name}</h3>
              {m.headquarters && (
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                  <Building2 className="w-3 h-3" /> {m.headquarters}
                </div>
              )}
              {m.description && (
                <p className="text-sm text-gray-500 mb-4 leading-relaxed line-clamp-2">{m.description}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" /> {(m.active_skus || 0).toLocaleString()} SKUs
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {m.lead_time_min_weeks}–{m.lead_time_max_weeks} wks
                </span>
              </div>

              {m.categories?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {m.categories.slice(0, 4).map((c, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{c.replace(/_/g, " ")}</span>
                  ))}
                  {m.categories.length > 4 && (
                    <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">+{m.categories.length - 4}</span>
                  )}
                </div>
              )}

              <Link
                to={createPageUrl(`Search?q=${encodeURIComponent(m.name)}`)}
                className="flex items-center gap-1 text-sm text-[#0066CC] font-medium hover:gap-2 transition-all"
              >
                Browse products <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}