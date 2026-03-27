import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, GitCompare, History, FolderKanban, Brain, BarChart3, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { getRecentSearches } from "@/lib/growth-store";

const PAGES = [
  { label: "Search", path: "Search", icon: Search, shortcut: "S" },
  { label: "Dashboard", path: "Dashboard", icon: Home, shortcut: "D" },
  { label: "Compare", path: "Compare", icon: GitCompare, shortcut: "C" },
  { label: "Projects", path: "ProjectWorkflow", icon: FolderKanban, shortcut: "P" },
  { label: "Intelligence", path: "Intelligence", icon: Brain, shortcut: "I" },
  { label: "Vendor Portal", path: "VendorDashboard", icon: BarChart3, shortcut: "V" },
];

export default function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches().slice(0, 5));
    }
  }, [open]);

  const handleSelect = (path) => {
    onOpenChange(false);
    navigate(path);
  };

  const handleSearchSelect = (query) => {
    onOpenChange(false);
    navigate(`${createPageUrl("Search")}?q=${encodeURIComponent(query)}`);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop — deep glass morphism */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[rgba(10,10,15,0.9)] backdrop-blur-2xl"
            onClick={() => onOpenChange(false)}
          />

          {/* Panel */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-lg rounded-2xl border border-white/[0.06] bg-[rgba(10,10,15,0.95)] shadow-[0_0_80px_rgba(0,0,0,0.6),0_0_2px_rgba(194,165,105,0.15)] backdrop-blur-2xl overflow-hidden"
            >
              <Command className="bg-transparent">
                {/* Search input with gold diamond icon */}
                <div className="flex items-center border-b border-white/[0.06] px-4 py-1">
                  <img src="/logo.png" alt="" className="h-4 w-4 object-contain mr-3" />
                  <CommandInput
                    placeholder="Search pages, actions, or recent queries..."
                    className="text-white placeholder:text-white/25 border-0 border-none focus:ring-1 focus:ring-gold/30"
                  />
                  <kbd className="ml-2 hidden sm:inline-flex h-5 items-center rounded bg-gold/[0.08] px-1.5 text-[10px] font-medium text-gold/40 border border-gold/[0.1]">
                    ESC
                  </kbd>
                </div>

                <CommandList className="max-h-[320px] text-white/70 p-2">
                  <CommandEmpty className="text-white/30 py-8">No results found.</CommandEmpty>

                  {/* Pages group */}
                  <CommandGroup
                    heading="Pages"
                    className="[&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:text-gold/40"
                  >
                    {PAGES.map((page) => (
                      <CommandItem
                        key={page.path}
                        onSelect={() => handleSelect(createPageUrl(page.path))}
                        className="text-white/60 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150
                          hover:bg-gold/[0.05] hover:text-white/80
                          data-[selected=true]:bg-gold/10 data-[selected=true]:text-gold data-[selected=true]:border-l-2 data-[selected=true]:border-gold/40
                          data-[selected=true]:shadow-[inset_0_0_20px_rgba(194,165,105,0.04)]"
                      >
                        <page.icon className="h-4 w-4 mr-2 text-white/20 data-[selected=true]:text-gold/60 group-data-[selected=true]:text-gold/60" />
                        <span className="flex-1">{page.label}</span>
                        <kbd className="ml-auto hidden sm:inline-flex h-5 items-center rounded bg-gold/[0.06] px-1.5 text-[10px] font-medium text-gold/30 border border-gold/[0.08]">
                          {page.shortcut}
                        </kbd>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  {recentSearches.length > 0 && (
                    <CommandGroup
                      heading="Recent Searches"
                      className="[&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.2em] [&_[cmdk-group-heading]]:text-gold/40 mt-2"
                    >
                      {recentSearches.map((query) => (
                        <CommandItem
                          key={query}
                          onSelect={() => handleSearchSelect(query)}
                          className="text-white/60 rounded-lg px-3 py-2.5 cursor-pointer transition-all duration-150
                            hover:bg-gold/[0.05] hover:text-white/80
                            data-[selected=true]:bg-gold/10 data-[selected=true]:text-gold data-[selected=true]:border-l-2 data-[selected=true]:border-gold/40
                            data-[selected=true]:shadow-[inset_0_0_20px_rgba(194,165,105,0.04)]"
                        >
                          <History className="h-4 w-4 mr-2 text-white/20" />
                          <span className="flex-1">{query}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>

                {/* Footer hint */}
                <div className="border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-between text-[10px] text-white/20">
                  <span>Navigate with <kbd className="inline-flex items-center rounded bg-gold/[0.06] px-1 text-gold/30 border border-gold/[0.08] mx-0.5">↑</kbd> <kbd className="inline-flex items-center rounded bg-gold/[0.06] px-1 text-gold/30 border border-gold/[0.08] mx-0.5">↓</kbd></span>
                  <span>Select with <kbd className="inline-flex items-center rounded bg-gold/[0.06] px-1 text-gold/30 border border-gold/[0.08] mx-0.5">↵</kbd></span>
                </div>
              </Command>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
