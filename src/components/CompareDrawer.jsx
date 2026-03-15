import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { X, GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CompareDrawer({ items, onRemove, onClear }) {
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#222] shrink-0">
          <GitCompare className="w-4 h-4 text-[#0066CC]" />
          Compare ({items.length}/4)
        </div>

        <div className="flex items-center gap-3 flex-1 overflow-x-auto">
          {items.map((p) => (
            <div key={p.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 shrink-0">
              <img src={p.thumbnail} alt={p.name} className="w-8 h-8 object-cover rounded" />
              <div className="min-w-0">
                <div className="text-xs font-medium text-[#222] truncate max-w-[100px]">{p.name}</div>
                <div className="text-xs text-gray-400 truncate max-w-[100px]">{p.manufacturer_name}</div>
              </div>
              <button onClick={() => onRemove(p.id)} className="text-gray-400 hover:text-gray-600 ml-1">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 2 - items.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="w-32 h-10 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-xs text-gray-300">Add item</span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onClear} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
          <Link to={createPageUrl("Compare")}>
            <Button
              size="sm"
              className="bg-[#0066CC] text-white text-xs gap-1.5"
              disabled={items.length < 2}
            >
              <GitCompare className="w-3.5 h-3.5" />
              Compare Now
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
