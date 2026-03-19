// ── Project Store ──
// JSON file-based project storage for sourcing projects

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const STORE_PATH = path.join(DATA_DIR, "projects.json");

let projects = [];

export function initProjectStore() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      projects = JSON.parse(raw);
      console.log(`[project-store] Loaded ${projects.length} projects`);
    } catch (err) {
      console.error(`[project-store] Failed to load projects: ${err.message}`);
      projects = [];
    }
  } else {
    projects = [];
    persist();
  }
}

function persist() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(projects, null, 2), "utf-8");
  } catch (err) {
    console.error(`[project-store] Failed to persist: ${err.message}`);
  }
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

export function createProject(data) {
  const now = new Date().toISOString();
  const project = {
    id: generateId("proj"),
    name: data.name || "Untitled Project",
    client_name: data.client_name || "",
    style: data.style || "",
    budget: {
      total: data.budget?.total || 0,
      spent: 0,
      remaining: data.budget?.total || 0,
      currency: data.budget?.currency || "USD",
    },
    timeline: {
      start: data.timeline?.start || now.split("T")[0],
      target_completion: data.timeline?.target_completion || "",
      status: data.timeline?.status || "planning",
      weeks: data.timeline?.weeks || 12,
      urgency: data.timeline?.urgency || "normal",
    },
    rooms: [],
    share_token: null,
    vendor_preferences: data.vendor_preferences || [],
    notes: data.notes || "",
    created_at: now,
    updated_at: now,
  };

  projects.push(project);
  persist();
  return project;
}

export function getProject(id) {
  return projects.find((p) => p.id === id) || null;
}

export function updateProject(id, updates) {
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;

  const project = projects[idx];
  const now = new Date().toISOString();

  // Merge top-level fields (don't allow overwriting id, created_at)
  const safe = { ...updates };
  delete safe.id;
  delete safe.created_at;

  // Deep merge budget and timeline
  if (safe.budget) {
    project.budget = { ...project.budget, ...safe.budget };
    delete safe.budget;
  }
  if (safe.timeline) {
    project.timeline = { ...project.timeline, ...safe.timeline };
    delete safe.timeline;
  }

  Object.assign(project, safe, { updated_at: now });
  projects[idx] = project;
  persist();
  return project;
}

export function deleteProject(id) {
  const idx = projects.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  projects.splice(idx, 1);
  persist();
  return true;
}

export function listProjects() {
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    client_name: p.client_name,
    style: p.style,
    budget: p.budget,
    timeline: p.timeline,
    room_count: p.rooms.length,
    item_count: p.rooms.reduce((sum, r) => sum + r.items.length, 0),
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
}

export function addRoomToProject(projectId, room) {
  const project = getProject(projectId);
  if (!project) return null;

  const newRoom = {
    id: generateId("room"),
    name: room.name || "Untitled Room",
    type: room.type || "living-room",
    size: room.size || "medium",
    budget: room.budget || 0,
    items: Array.isArray(room.items) ? room.items.map((item) => ({
      id: generateId("item"),
      name: item.name || item.item || "Unnamed Item",
      priority: item.priority || "medium",
      status: item.status || "sourcing",
      search_query: item.search_query || item.search || "",
      options: [],
      selected_product: null,
      notes: item.notes || "",
      qty: item.qty || 1,
    })) : [],
  };

  project.rooms.push(newRoom);
  project.updated_at = new Date().toISOString();
  persist();
  return newRoom;
}

export function updateRoomItem(projectId, roomId, itemId, updates) {
  const project = getProject(projectId);
  if (!project) return null;

  const room = project.rooms.find((r) => r.id === roomId);
  if (!room) return null;

  const item = room.items.find((i) => i.id === itemId);
  if (!item) return null;

  // Apply updates
  const allowedFields = ["name", "priority", "status", "search_query", "options", "selected_product", "notes", "qty"];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      item[field] = updates[field];
    }
  }

  // Recalculate project budget spent
  recalcBudget(project);

  project.updated_at = new Date().toISOString();
  persist();
  return item;
}

export function getProjectShareToken(projectId) {
  const project = getProject(projectId);
  if (!project) return null;

  if (!project.share_token) {
    project.share_token = crypto.randomBytes(16).toString("hex");
    project.updated_at = new Date().toISOString();
    persist();
  }

  return project.share_token;
}

export function getProjectByShareToken(token) {
  if (!token) return null;
  const project = projects.find((p) => p.share_token === token);
  if (!project) return null;

  // Return a read-only view (strip internal data)
  return {
    id: project.id,
    name: project.name,
    client_name: project.client_name,
    style: project.style,
    budget: project.budget,
    timeline: project.timeline,
    rooms: project.rooms,
    notes: project.notes,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
}

// ── Internal helpers ──

function recalcBudget(project) {
  let spent = 0;
  for (const room of project.rooms) {
    for (const item of room.items) {
      if (item.selected_product) {
        const price = item.selected_product.retail_price || item.selected_product.price || 0;
        spent += price * (item.qty || 1);
      }
    }
  }
  project.budget.spent = Math.round(spent * 100) / 100;
  project.budget.remaining = Math.round((project.budget.total - spent) * 100) / 100;
}
