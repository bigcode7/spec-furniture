import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FolderKanban, Plus, Check, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SEARCH_URL = (
  import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310"
).replace(/\/$/, "");

/**
 * Dropdown menu to add a product to a project room item.
 * Works from Search results, Compare, or anywhere a product card appears.
 *
 * Usage: <AddToProjectMenu product={item} />
 */
export default function AddToProjectMenu({ product, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(null); // { projectId, roomId, itemName }
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
        setSelectedProject(null);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Load projects when opening
  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      setSelectedProject(null);
      return;
    }
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch(`${SEARCH_URL}/projects`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch {
      setProjects([]);
    }
    setLoading(false);
  };

  // Add product to a specific room item
  const addToItem = async (project, room, item) => {
    setAdding(true);
    try {
      // Build the product option object
      const option = {
        id: product.id,
        name: product.product_name || product.name,
        vendor: product.manufacturer_name || product.vendor_name,
        price: product.retail_price || product.wholesale_price || null,
        image_url: product.image_url || product.thumbnail_url || "",
        portal_url: product.portal_url || "",
        material: product.material || "",
        style: product.style || "",
      };

      // Add as selected product for the item
      const res = await fetch(
        `${SEARCH_URL}/projects/${project.id}/rooms/${room.id}/items/${item.id}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            selected_product: option,
            status: "selected",
          }),
        }
      );

      if (res.ok) {
        setAdded({ projectName: project.name, roomName: room.name, itemName: item.name });
        setTimeout(() => {
          setOpen(false);
          setSelectedProject(null);
          setAdded(null);
        }, 1500);
      }
    } catch {
      // silently fail
    }
    setAdding(false);
  };

  // Add as an option (not selected) for the item
  const addAsOption = async (project, room, item) => {
    setAdding(true);
    try {
      const option = {
        id: product.id,
        name: product.product_name || product.name,
        vendor: product.manufacturer_name || product.vendor_name,
        price: product.retail_price || product.wholesale_price || null,
        image_url: product.image_url || product.thumbnail_url || "",
        portal_url: product.portal_url || "",
      };

      const currentOptions = item.options || [];
      if (currentOptions.some((o) => o.id === option.id)) {
        // Already in options
        setAdded({ projectName: project.name, roomName: room.name, itemName: item.name });
        setTimeout(() => { setOpen(false); setSelectedProject(null); setAdded(null); }, 1200);
        setAdding(false);
        return;
      }

      const res = await fetch(
        `${SEARCH_URL}/projects/${project.id}/rooms/${room.id}/items/${item.id}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            options: [...currentOptions, option],
            status: currentOptions.length === 0 ? "options-ready" : item.status,
          }),
        }
      );

      if (res.ok) {
        setAdded({ projectName: project.name, roomName: room.name, itemName: item.name });
        setTimeout(() => { setOpen(false); setSelectedProject(null); setAdded(null); }, 1500);
      }
    } catch {}
    setAdding(false);
  };

  const btnClass = size === "sm"
    ? "flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] text-white/40 hover:text-gold hover:bg-gold/10 transition-all"
    : "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-gold hover:bg-gold/10 border border-white/[0.06] transition-all";

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={handleOpen} className={btnClass} title="Add to project">
        {added ? (
          <Check className="h-3 w-3 text-green-400" />
        ) : (
          <FolderKanban className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        )}
        {size !== "sm" && <span>{added ? "Added" : "Add to Project"}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-white/[0.06] bg-[rgba(10,10,15,0.9)] backdrop-blur-xl shadow-2xl overflow-hidden"
          >
            {/* Success state */}
            {added && (
              <div className="p-4 text-center">
                <Check className="h-5 w-5 text-green-400 mx-auto mb-2" />
                <p className="text-xs text-white/70">
                  Added to <span className="text-white font-medium">{added.itemName}</span>
                </p>
                <p className="text-[10px] text-white/30 mt-0.5">
                  {added.roomName} &middot; {added.projectName}
                </p>
              </div>
            )}

            {/* Loading */}
            {loading && !added && (
              <div className="p-4 flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-white/30" />
                <span className="text-xs text-white/40">Loading projects...</span>
              </div>
            )}

            {/* No projects */}
            {!loading && !added && projects.length === 0 && (
              <div className="p-4 text-center">
                <FolderKanban className="h-5 w-5 text-white/15 mx-auto mb-2" />
                <p className="text-xs text-white/40 mb-3">No projects yet</p>
                <button
                  onClick={() => {
                    setOpen(false);
                    navigate(createPageUrl("ProjectIntake"));
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold/10 px-3 py-1.5 text-xs text-gold hover:bg-gold/20 transition-colors"
                >
                  <Sparkles className="h-3 w-3" /> Create a project
                </button>
              </div>
            )}

            {/* Project list */}
            {!loading && !added && projects.length > 0 && !selectedProject && (
              <div>
                <div className="px-3 py-2 border-b border-white/[0.06]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">
                    Add to project
                  </p>
                </div>
                <div className="max-h-60 overflow-y-auto py-1">
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => setSelectedProject(proj)}
                      className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-white/70 truncate">{proj.name}</p>
                        <p className="text-[10px] text-white/25">
                          {proj.rooms?.length || 0} rooms &middot; {proj.style || "No style"}
                        </p>
                      </div>
                      <ChevronRight className="h-3 w-3 text-white/20 flex-shrink-0" />
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/[0.06] px-3 py-2">
                  <button
                    onClick={() => {
                      setOpen(false);
                      navigate(createPageUrl("ProjectIntake"));
                    }}
                    className="flex items-center gap-1.5 text-[10px] text-gold/70 hover:text-gold transition-colors"
                  >
                    <Plus className="h-3 w-3" /> New project
                  </button>
                </div>
              </div>
            )}

            {/* Room & item picker */}
            {!loading && !added && selectedProject && (
              <div>
                <div className="px-3 py-2 border-b border-white/[0.06] flex items-center gap-2">
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="text-[10px] text-white/30 hover:text-white/50"
                  >
                    &larr;
                  </button>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25 truncate">
                    {selectedProject.name}
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {(selectedProject.rooms || []).map((room) => (
                    <div key={room.id} className="px-3 py-1.5">
                      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-1">
                        {room.name}
                      </p>
                      {(room.items || []).map((item) => {
                        const hasSelected = !!item.selected_product;
                        return (
                          <button
                            key={item.id}
                            onClick={() => hasSelected ? addAsOption(selectedProject, room, item) : addToItem(selectedProject, room, item)}
                            disabled={adding}
                            className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-left hover:bg-white/[0.04] transition-colors group"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-white/60 truncate">{item.name}</p>
                              {hasSelected && (
                                <p className="text-[10px] text-white/20 truncate">
                                  Has: {item.selected_product.name}
                                </p>
                              )}
                            </div>
                            <span className="text-[10px] text-white/20 group-hover:text-gold flex-shrink-0 ml-2">
                              {adding ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : hasSelected ? (
                                "+ option"
                              ) : (
                                "Select"
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
