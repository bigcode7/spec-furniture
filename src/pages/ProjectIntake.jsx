import { useState } from "react";
import { createPageUrl } from "@/utils";
import {
  FolderKanban,
  ArrowRight,
  Plus,
  Loader2,
  Sparkles,
  Building2,
  Layers,
  CheckCircle,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SEARCH_URL = (import.meta.env.VITE_SEARCH_SERVICE_URL || "http://127.0.0.1:4310").replace(/\/$/, "");

const STYLES = [
  "modern", "mid-century-modern", "coastal", "traditional", "minimalist",
  "bohemian", "industrial", "transitional", "japandi", "art-deco",
  "scandinavian", "farmhouse",
];

const ROOM_TYPES = [
  "living-room", "bedroom", "dining-room", "home-office", "entryway",
  "nursery", "media-room", "outdoor", "kitchen", "bathroom",
];

const PROCESSING_STEPS = [
  "Parsing project details...",
  "Identifying rooms...",
  "Building furniture checklists...",
  "Setting up sourcing board...",
];

function formatRoomType(type) {
  return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatStyle(style) {
  return style.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProjectIntake() {
  const [phase, setPhase] = useState("welcome"); // welcome | processing | review
  const [description, setDescription] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [project, setProject] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Editable fields
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [budget, setBudget] = useState(0);
  const [timeline, setTimeline] = useState("");
  const [rooms, setRooms] = useState([]);

  const handleSubmitDescription = async () => {
    if (!description.trim()) return;
    setPhase("processing");
    setActiveStep(0);
    setCompletedSteps([]);
    setError(null);

    // Animate steps
    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      setActiveStep(i);
      await new Promise((r) => setTimeout(r, 800));
      setCompletedSteps((prev) => [...prev, i]);
    }

    try {
      const res = await fetch(`${SEARCH_URL}/projects/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) throw new Error("Failed to parse project");
      const data = await res.json();
      const proj = data.project || data;

      setProject(proj);
      setProjectName(proj.name || "");
      setClientName(proj.client_name || "");
      setSelectedStyle(proj.style || STYLES[0]);
      setBudget(proj.budget?.total || proj.budget || 0);
      setTimeline(data.parsed_intake?.timeline?.weeks ? `${data.parsed_intake.timeline.weeks} weeks` : "12 weeks");
      setRooms(proj.rooms || []);
      setPhase("review");
    } catch (err) {
      setError(err.message);
      setPhase("welcome");
    }
  };

  const addRoom = () => {
    setRooms((prev) => [
      ...prev,
      {
        id: `room-${Date.now()}`,
        name: "New Room",
        type: "living-room",
        size: "medium",
        items: [],
      },
    ]);
  };

  const removeRoom = (index) => {
    setRooms((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRoom = (index, field, value) => {
    setRooms((prev) =>
      prev.map((room, i) => (i === index ? { ...room, [field]: value } : room))
    );
  };

  const handleStartSourcing = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // If project was already created by intake, just update and navigate
      if (project?.id) {
        await fetch(`${SEARCH_URL}/projects/${project.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName,
            client_name: clientName,
            style: selectedStyle,
            budget: typeof budget === "number" ? { total: budget } : budget,
          }),
        });
        window.location.href = "/Projects?tab=sourcing&project=" + project.id;
        return;
      }

      // Otherwise create a new project, then add rooms
      const res = await fetch(`${SEARCH_URL}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          client_name: clientName,
          style: selectedStyle,
          budget: typeof budget === "number" ? { total: budget } : budget,
        }),
      });
      if (!res.ok) throw new Error("Failed to create project");
      const data = await res.json();
      const newId = data.project?.id || data.id;

      // Add rooms with auto-populated items
      for (const room of rooms) {
        await fetch(`${SEARCH_URL}/projects/${newId}/rooms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: room.name || formatRoomType(room.type), type: room.type, size: room.size || "medium" }),
        });
      }

      window.location.href = "/Projects?tab=sourcing&project=" + newId;
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-8 md:py-10">
      <div className="page-wrap max-w-4xl">
        <AnimatePresence mode="wait">
          {/* ─── Welcome Phase ─── */}
          {phase === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gold/15 bg-gold/10 text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-6"
                >
                  <Sparkles className="w-4 h-4 text-gold" />
                  Spekd Sourcing Brain
                </motion.div>
                <h1 className="text-4xl md:text-5xl font-display font-bold text-white mb-4">
                  Tell us about your project
                </h1>
                <p className="text-white/50 text-lg max-w-2xl mx-auto">
                  Describe your space in natural language. Our AI will parse rooms,
                  styles, budgets, and build your sourcing plan automatically.
                </p>
              </div>

              <div className="glass-surface rounded-2xl p-6 md:p-8">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your project in your own words... e.g., 'We're furnishing a 3-bedroom modern farmhouse in Austin. The living room is about 400 sqft, open concept flowing into a dining area. Budget is around $45k, and we need everything delivered within 3 months. The client loves Restoration Hardware and CB2 aesthetic.'"
                  rows={7}
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-white placeholder:text-white/30 focus:outline-none focus:border-gold/30 focus:ring-2 focus:ring-gold/10 resize-none text-base leading-relaxed"
                />

                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-between mt-6">
                  <button
                    onClick={() => {
                      setProjectName("New Project");
                      setSelectedStyle(STYLES[0]);
                      setPhase("review");
                    }}
                    className="text-sm text-white/30 hover:text-white/60 transition-colors"
                  >
                    or set up manually →
                  </button>
                  <Button
                    onClick={handleSubmitDescription}
                    disabled={!description.trim()}
                    className="btn-gold px-6 py-2.5 text-base font-medium rounded-xl gap-2"
                  >
                    Analyze Project
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── Processing Phase ─── */}
          {phase === "processing" && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="mb-8"
              >
                <Sparkles className="w-12 h-12 text-gold" />
              </motion.div>

              <h2 className="text-2xl font-display font-bold text-white mb-8">
                Analyzing your project...
              </h2>

              <div className="w-full max-w-md space-y-4">
                {PROCESSING_STEPS.map((step, index) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -20 }}
                    animate={
                      index <= activeStep
                        ? { opacity: 1, x: 0 }
                        : { opacity: 0, x: -20 }
                    }
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    {completedSteps.includes(index) ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : index === activeStep ? (
                      <Loader2 className="w-5 h-5 text-gold animate-spin shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-white/[0.06] shrink-0" />
                    )}
                    <span
                      className={
                        completedSteps.includes(index)
                          ? "text-white/70"
                          : index === activeStep
                          ? "text-white"
                          : "text-white/30"
                      }
                    >
                      {step}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── Review Phase ─── */}
          {phase === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
            >
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-sm text-emerald-400 mb-4">
                  <CheckCircle className="w-4 h-4" />
                  Project Parsed
                </div>
                <h1 className="text-3xl font-display font-bold text-white mb-2">
                  Review Your Project
                </h1>
                <p className="text-white/50">
                  Fine-tune the details below, then start sourcing.
                </p>
              </div>

              {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Project Details Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-surface rounded-2xl p-6 mb-6"
              >
                <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70 mb-4">
                  Project Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-caps block mb-1.5">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold/30 focus:ring-2 focus:ring-gold/10"
                    />
                  </div>
                  <div>
                    <label className="label-caps block mb-1.5">
                      Client Name
                    </label>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold/30 focus:ring-2 focus:ring-gold/10"
                    />
                  </div>
                  <div>
                    <label className="label-caps block mb-1.5">
                      Style Detected
                    </label>
                    <select
                      value={selectedStyle}
                      onChange={(e) => setSelectedStyle(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold/30 focus:ring-2 focus:ring-gold/10 appearance-none"
                    >
                      {STYLES.map((s) => (
                        <option key={s} value={s} className="bg-[#08090E]">
                          {formatStyle(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label-caps block mb-1.5">
                      Budget ($)
                    </label>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => setBudget(Number(e.target.value))}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold/30 focus:ring-2 focus:ring-gold/10"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="label-caps block mb-1.5">
                      Timeline
                    </label>
                    <input
                      type="text"
                      value={timeline}
                      onChange={(e) => setTimeline(e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gold/30 focus:ring-2 focus:ring-gold/10"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Rooms */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-surface rounded-2xl p-6 mb-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold/70">
                    Rooms Detected ({rooms.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addRoom}
                    className="border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.05] gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Room
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rooms.map((room, index) => (
                    <motion.div
                      key={room.id || index}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative border border-white/[0.06] bg-white/[0.03] rounded-xl p-4 group"
                    >
                      <button
                        onClick={() => removeRoom(index)}
                        className="absolute top-2 right-2 p-1 rounded-md text-white/20 hover:text-white/60 hover:bg-white/[0.05] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4 text-white/40" />
                        <select
                          value={room.type}
                          onChange={(e) =>
                            updateRoom(index, "type", e.target.value)
                          }
                          className="bg-transparent border-none text-white font-medium focus:outline-none text-sm appearance-none cursor-pointer"
                        >
                          {ROOM_TYPES.map((rt) => (
                            <option
                              key={rt}
                              value={rt}
                              className="bg-[#08090E]"
                            >
                              {formatRoomType(rt)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1.5 text-white/40">
                          <Layers className="w-3.5 h-3.5" />
                          <select
                            value={room.size || "medium"}
                            onChange={(e) => updateRoom(index, "size", e.target.value)}
                            className="bg-transparent border-none text-white/40 focus:outline-none text-xs appearance-none cursor-pointer"
                          >
                            <option value="small" className="bg-[#08090E]">Small</option>
                            <option value="medium" className="bg-[#08090E]">Medium</option>
                            <option value="large" className="bg-[#08090E]">Large</option>
                          </select>
                        </div>
                        <Badge
                          variant="secondary"
                          className="bg-gold/10 text-gold/70 border border-gold/15 text-xs"
                        >
                          {room.items?.length || 0} items
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {rooms.length === 0 && (
                  <div className="text-center py-8 text-white/30">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No rooms detected. Add one to get started.</p>
                  </div>
                )}
              </motion.div>

              {/* Start Sourcing Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex justify-center"
              >
                <Button
                  onClick={handleStartSourcing}
                  disabled={submitting || rooms.length === 0}
                  className="btn-gold px-8 py-3 text-lg font-semibold rounded-xl gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-gold" />
                      Creating Project...
                    </>
                  ) : (
                    <>
                      <FolderKanban className="w-5 h-5" />
                      Start Sourcing
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
