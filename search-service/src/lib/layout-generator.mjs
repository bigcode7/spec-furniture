/**
 * Layout Generator — Auto-places furniture in a room using constraint satisfaction.
 *
 * Algorithm:
 * 1. Sort pieces by size (largest first — beds, sectionals, dining tables)
 * 2. For each piece, identify candidate positions based on room rules
 * 3. Score each position against constraints
 * 4. Place at best position, mark space as occupied
 * 5. Iterate for remaining pieces
 * 6. Run post-placement checks (traffic flow, conversation distance)
 *
 * Pure JavaScript — zero API cost.
 */

import { getSpatialRules } from "./spatial-engine.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RULES = getSpatialRules();
const IN_PER_FT = 12;
const STEP = 6; // candidate position step in inches
const ROTATIONS = [0, 90, 180, 270];

// Priority categories — placed first (largest impact on layout)
const PLACEMENT_ORDER = [
  "bed",
  "sectional",
  "sofa",
  "dining-table",
  "desk",
  "dresser",
  "bookshelf",
  "media-console",
  "coffee-table",
  "accent-chair",
  "chair",
  "nightstand",
  "end-table",
  "side-table",
  "bench",
  "ottoman",
  "rug",
  "lamp",
];

// Category normalization (compact version — full one lives in spatial-engine)
function normCat(cat) {
  if (!cat) return "other";
  const s = cat.toLowerCase().trim().replace(/\s+/g, "-");
  const map = {
    couch: "sofa", sofas: "sofa", couches: "sofa",
    "sectional-sofa": "sectional", sectionals: "sectional",
    loveseat: "sofa", "love-seat": "sofa",
    beds: "bed", "platform-bed": "bed",
    "dining-tables": "dining-table", "kitchen-table": "dining-table",
    desks: "desk", "writing-desk": "desk", "office-desk": "desk",
    "coffee-tables": "coffee-table", "cocktail-table": "coffee-table",
    "end-tables": "end-table", "side-tables": "end-table", "accent-table": "end-table",
    nightstands: "nightstand", "night-stand": "nightstand", "bedside-table": "nightstand",
    "accent-chairs": "accent-chair", armchair: "accent-chair", armchairs: "accent-chair",
    "dining-chairs": "dining-chair", chairs: "chair",
    bookshelves: "bookshelf", bookcase: "bookshelf", bookcases: "bookshelf",
    "console-table": "media-console", "console-tables": "media-console",
    "media-consoles": "media-console", "tv-stand": "media-console",
    dressers: "dresser", chest: "dresser", "chest-of-drawers": "dresser",
    benches: "bench", ottomans: "ottoman",
    "floor-lamp": "lamp", "table-lamp": "lamp", lamps: "lamp",
    rugs: "rug", "area-rug": "rug", "area-rugs": "rug",
  };
  return map[s] || s;
}

// ---------------------------------------------------------------------------
// Wall helpers
// ---------------------------------------------------------------------------

function wallLength(wall, room) {
  return (wall === "north" || wall === "south") ? room.width_in : room.depth_in;
}

function wallMidpoint(wall, room) {
  return wallLength(wall, room) / 2;
}

/** Get the (x, y) origin for a piece placed against a wall at `pos` along that wall. */
function wallPosition(wall, pos, pieceW, pieceD, room) {
  switch (wall) {
    case "north": return { x: pos, y: 0, rotation: 0 };
    case "south": return { x: pos, y: room.depth_in - pieceD, rotation: 0 };
    case "west":  return { x: 0, y: pos, rotation: 0 };
    case "east":  return { x: room.width_in - pieceD, y: pos, rotation: 0 };
    default:      return { x: pos, y: 0, rotation: 0 };
  }
}

/** Get the facing-inward rotation for a piece against a wall. */
function wallRotation(wall) {
  switch (wall) {
    case "north": return 0;
    case "south": return 180;
    case "east":  return 270;
    case "west":  return 90;
    default:      return 0;
  }
}

// ---------------------------------------------------------------------------
// Preferred wall logic per room type & category
// ---------------------------------------------------------------------------

function preferredWalls(category, room) {
  const rt = room.room_type || "living-room";
  const fp = room.focal_point;

  if (rt === "bedroom") {
    if (category === "bed") {
      // Longest wall without windows, or longest wall
      const walls = ["north", "south", "east", "west"];
      const windowWalls = new Set((room.windows || []).map((w) => w.wall));
      const candidates = walls.filter((w) => !windowWalls.has(w));
      // sort by length descending
      candidates.sort((a, b) => wallLength(b, room) - wallLength(a, room));
      return candidates.length > 0 ? candidates : ["south"];
    }
    if (category === "nightstand") return []; // placed relative to bed
    if (category === "dresser") return ["north", "east", "west"]; // opposite bed or side wall
    if (category === "desk") {
      // near window
      const windowWalls = (room.windows || []).map((w) => w.wall);
      return windowWalls.length > 0 ? windowWalls : ["east", "west"];
    }
    if (category === "bench") return []; // placed at foot of bed
  }

  if (rt === "living-room") {
    if (category === "sofa" || category === "sectional") {
      // Face focal point
      if (fp) {
        const opposite = { north: "south", south: "north", east: "west", west: "east" };
        return [opposite[fp.wall] || "south"];
      }
      return ["south"];
    }
    if (category === "media-console") {
      return fp ? [fp.wall] : ["north"];
    }
    if (category === "accent-chair") {
      // Perpendicular to sofa
      if (fp) {
        const perp = (fp.wall === "north" || fp.wall === "south") ? ["east", "west"] : ["north", "south"];
        return perp;
      }
      return ["east", "west"];
    }
    if (category === "coffee-table") return []; // centered relative to sofa
    if (category === "end-table") return [];     // beside sofa
  }

  if (rt === "dining-room") {
    if (category === "dining-table") return ["center"]; // special: centered
    if (category === "bookshelf" || category === "dresser") return ["north", "east", "west"];
  }

  if (rt === "home-office") {
    if (category === "desk") {
      const windowWalls = (room.windows || []).map((w) => w.wall);
      return windowWalls.length > 0 ? windowWalls : ["north"];
    }
    if (category === "bookshelf") return ["east", "west"];
    if (category === "chair") return []; // at desk
  }

  return ["north", "south", "east", "west"];
}

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

function makeRect(x, y, w, d) {
  return { x, y, w, d, right: x + w, bottom: y + d };
}

function rectsOverlap(a, b) {
  return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

function rectInRoom(r, room) {
  return r.x >= 0 && r.y >= 0 && r.right <= room.width_in && r.bottom <= room.depth_in;
}

function hasCollision(rect, placed) {
  for (const p of placed) {
    if (rectsOverlap(rect, p.rect)) return true;
  }
  return false;
}

function minGapToPlaced(rect, placed) {
  let minG = Infinity;
  for (const p of placed) {
    const dx = Math.max(0, Math.max(rect.x - p.rect.right, p.rect.x - rect.right));
    const dy = Math.max(0, Math.max(rect.y - p.rect.bottom, p.rect.y - rect.bottom));
    const g = Math.sqrt(dx * dx + dy * dy);
    if (g < minG) minG = g;
  }
  return minG === Infinity ? 0 : minG;
}

// ---------------------------------------------------------------------------
// Position scoring
// ---------------------------------------------------------------------------

function scorePosition(piece, x, y, pw, pd, rotation, room, placed) {
  let score = 0;
  const cat = normCat(piece.category);
  const rect = makeRect(x, y, pw, pd);
  const cx = x + pw / 2;
  const cy = y + pd / 2;
  const rw = room.width_in;
  const rd = room.depth_in;

  // ── Preferred wall proximity (up to 50 pts) ───────────────────────────
  const prefWalls = preferredWalls(cat, room);
  if (prefWalls.length > 0 && prefWalls[0] !== "center") {
    let bestWallDist = Infinity;
    for (const wall of prefWalls) {
      let dist;
      if (wall === "north") dist = y;
      else if (wall === "south") dist = rd - (y + pd);
      else if (wall === "west") dist = x;
      else if (wall === "east") dist = rw - (x + pw);
      else dist = Infinity;
      if (dist < bestWallDist) bestWallDist = dist;
    }
    // against wall = 50pts, each inch away loses 2pts
    score += Math.max(0, 50 - bestWallDist * 2);
  } else if (prefWalls.includes("center")) {
    // Prefer centered placement
    const distFromCenter = Math.sqrt((cx - rw / 2) ** 2 + (cy - rd / 2) ** 2);
    score += Math.max(0, 50 - distFromCenter * 0.5);
  }

  // ── Clearance from other pieces (up to 20 pts) ────────────────────────
  if (placed.length > 0) {
    const gap = minGapToPlaced(rect, placed);
    const minWalkway = RULES["walkway-minimum"].tight_in; // 18"
    if (gap >= RULES["walkway-minimum"].ideal_in) {
      score += 20;
    } else if (gap >= minWalkway) {
      score += 15;
    } else if (gap > 0) {
      score += 5;
    }
  } else {
    score += 20; // first piece gets full clearance bonus
  }

  // ── Alignment with other pieces (up to 10 pts) ────────────────────────
  for (const p of placed) {
    // Aligned along x or y edge
    if (Math.abs(rect.x - p.rect.x) < 3) score += 3;
    if (Math.abs(rect.right - p.rect.right) < 3) score += 3;
    if (Math.abs(rect.y - p.rect.y) < 3) score += 2;
    if (Math.abs(rect.bottom - p.rect.bottom) < 3) score += 2;
  }
  score = Math.min(score, score); // alignment already capped by loop

  // ── Door access (up to 15 pts) ────────────────────────────────────────
  let doorPenalty = 0;
  if (room.doors) {
    for (const door of room.doors) {
      const dPos = door.position_in || 0;
      const dW = door.width_in || 36;
      let doorRect;
      switch (door.wall) {
        case "north": doorRect = makeRect(dPos, 0, dW, dW); break;
        case "south": doorRect = makeRect(dPos, rd - dW, dW, dW); break;
        case "west":  doorRect = makeRect(0, dPos, dW, dW); break;
        case "east":  doorRect = makeRect(rw - dW, dPos, dW, dW); break;
        default:      doorRect = makeRect(0, 0, 0, 0);
      }
      if (rectsOverlap(rect, doorRect)) {
        doorPenalty += 30; // heavy penalty for blocking doors
      }
    }
  }
  score += Math.max(0, 15 - doorPenalty);

  // ── Focal point facing (up to 20 pts) ─────────────────────────────────
  if (room.focal_point && (cat === "sofa" || cat === "sectional" || cat === "accent-chair")) {
    const fp = room.focal_point;
    let fpX, fpY;
    switch (fp.wall) {
      case "north": fpX = fp.position_in || rw / 2; fpY = 0; break;
      case "south": fpX = fp.position_in || rw / 2; fpY = rd; break;
      case "east":  fpX = rw; fpY = fp.position_in || rd / 2; break;
      case "west":  fpX = 0; fpY = fp.position_in || rd / 2; break;
      default:      fpX = rw / 2; fpY = 0;
    }
    // Score based on line-of-sight angle
    const dx = fpX - cx;
    const dy = fpY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Closer is slightly better (for viewing distance) but not too close
    if (dist > 60 && dist < RULES["conversation-distance"].max_ft * IN_PER_FT) {
      score += 10;
    }
    // Facing direction bonus
    const facingAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    const pieceAngle = rotation;
    const angleDiff = Math.abs(((facingAngle - pieceAngle + 540) % 360) - 180);
    score += Math.max(0, 20 - angleDiff * 0.2);
  }

  // ── Window proximity for desks (up to 15 pts) ─────────────────────────
  if (cat === "desk" && room.windows && room.windows.length > 0) {
    let bestDist = Infinity;
    for (const win of room.windows) {
      let wx, wy;
      switch (win.wall) {
        case "north": wx = win.position_in || rw / 2; wy = 0; break;
        case "south": wx = win.position_in || rw / 2; wy = rd; break;
        case "east":  wx = rw; wy = win.position_in || rd / 2; break;
        case "west":  wx = 0; wy = win.position_in || rd / 2; break;
        default:      wx = rw / 2; wy = 0;
      }
      const d = Math.sqrt((cx - wx) ** 2 + (cy - wy) ** 2);
      if (d < bestDist) bestDist = d;
    }
    score += Math.max(0, 15 - bestDist * 0.1);
  }

  // ── Centered placement for tables (up to 10 pts) ──────────────────────
  if (cat === "dining-table" || cat === "coffee-table") {
    const distCenter = Math.sqrt((cx - rw / 2) ** 2 + (cy - rd / 2) ** 2);
    score += Math.max(0, 10 - distCenter * 0.1);
  }

  return score;
}

// ---------------------------------------------------------------------------
// Relative placement helpers
// ---------------------------------------------------------------------------

/**
 * Place a piece relative to an already-placed anchor (e.g. nightstand beside bed).
 */
function placeRelativeTo(anchor, piece, relation, room, placed) {
  const pw = piece.width_in;
  const pd = piece.depth_in;
  let candidates = [];

  if (relation === "left") {
    const x = anchor.x - pw - 2;
    const y = anchor.y;
    if (x >= 0) candidates.push({ x, y, rotation: 0 });
  }
  if (relation === "right") {
    const x = anchor.x + anchor.width + 2;
    const y = anchor.y;
    if (x + pw <= room.width_in) candidates.push({ x, y, rotation: 0 });
  }
  if (relation === "front") {
    const gap = 18; // default gap in front
    const x = anchor.x + anchor.width / 2 - pw / 2;
    const y = anchor.y + anchor.depth + gap;
    if (y + pd <= room.depth_in) candidates.push({ x, y, rotation: 0 });
  }
  if (relation === "behind") {
    const x = anchor.x + anchor.width / 2 - pw / 2;
    const y = anchor.y - pd - 6;
    if (y >= 0) candidates.push({ x, y, rotation: 0 });
  }
  if (relation === "centered-front") {
    const gap = RULES["sofa-to-coffee-table"].ideal_gap_in;
    const x = anchor.x + anchor.width / 2 - pw / 2;
    const y = anchor.y + anchor.depth + gap;
    if (y + pd <= room.depth_in && x >= 0 && x + pw <= room.width_in) {
      candidates.push({ x, y, rotation: 0 });
    }
  }
  if (relation === "foot-of-bed") {
    const x = anchor.x + anchor.width / 2 - pw / 2;
    const y = anchor.y + anchor.depth + 6;
    if (y + pd <= room.depth_in) candidates.push({ x, y, rotation: 0 });
  }
  if (relation === "opposite-wall") {
    // Place against the wall opposite the anchor
    const anchorCy = anchor.y + anchor.depth / 2;
    const inTopHalf = anchorCy < room.depth_in / 2;
    const y = inTopHalf ? room.depth_in - pd : 0;
    const x = room.width_in / 2 - pw / 2;
    candidates.push({ x, y, rotation: 0 });
  }

  // Filter collisions
  const valid = candidates.filter((c) => {
    const rect = makeRect(c.x, c.y, pw, pd);
    return rectInRoom(rect, room) && !hasCollision(rect, placed);
  });

  return valid.length > 0 ? valid[0] : null;
}

// ---------------------------------------------------------------------------
// generateLayout
// ---------------------------------------------------------------------------

/**
 * Auto-place furniture pieces in a room.
 *
 * @param {object} room  Room descriptor.
 * @param {Array<object>} pieces  Furniture pieces to place.
 * @returns {object} Layout result with placements, traffic paths, score, issues, unplaced.
 */
export function generateLayout(room, pieces) {
  if (!room || !pieces || pieces.length === 0) {
    return { placements: [], traffic_paths: [], sight_lines: [], score: 0, issues: [], unplaced: [] };
  }

  const rw = room.width_in;
  const rd = room.depth_in;

  // Sort pieces by placement priority, then by area (largest first)
  const sorted = [...pieces].sort((a, b) => {
    const catA = normCat(a.category);
    const catB = normCat(b.category);
    const prioA = PLACEMENT_ORDER.indexOf(catA);
    const prioB = PLACEMENT_ORDER.indexOf(catB);
    const idxA = prioA >= 0 ? prioA : 99;
    const idxB = prioB >= 0 ? prioB : 99;
    if (idxA !== idxB) return idxA - idxB;
    const areaA = (a.width_in || 0) * (a.depth_in || 0);
    const areaB = (b.width_in || 0) * (b.depth_in || 0);
    return areaB - areaA;
  });

  const placed = [];    // { id, name, category, x, y, width, depth, rotation, rect, fit_status }
  const unplaced = [];
  const issues = [];

  // ── Place each piece ──────────────────────────────────────────────────
  for (const piece of sorted) {
    const cat = normCat(piece.category);
    const pw = piece.width_in || 0;
    const pd = piece.depth_in || 0;
    const canRotate = piece.can_rotate !== false;

    // Try relative placement first for companion pieces
    let relPlacement = null;

    if (cat === "nightstand") {
      const bed = placed.find((p) => p.category === "bed");
      if (bed) {
        // Place on both sides of bed
        const existingNightstands = placed.filter((p) => p.category === "nightstand");
        const relation = existingNightstands.length === 0 ? "left" : "right";
        relPlacement = placeRelativeTo(bed, piece, relation, room, placed);
      }
    } else if (cat === "coffee-table") {
      const sofa = placed.find((p) => p.category === "sofa" || p.category === "sectional");
      if (sofa) {
        relPlacement = placeRelativeTo(sofa, piece, "centered-front", room, placed);
      }
    } else if (cat === "end-table") {
      const sofa = placed.find((p) => p.category === "sofa" || p.category === "sectional");
      if (sofa) {
        const existingEnds = placed.filter((p) => p.category === "end-table");
        const relation = existingEnds.length === 0 ? "right" : "left";
        relPlacement = placeRelativeTo(sofa, piece, relation, room, placed);
      }
    } else if (cat === "bench") {
      const bed = placed.find((p) => p.category === "bed");
      if (bed) {
        relPlacement = placeRelativeTo(bed, piece, "foot-of-bed", room, placed);
      }
    } else if (cat === "dresser") {
      const bed = placed.find((p) => p.category === "bed");
      if (bed) {
        relPlacement = placeRelativeTo(bed, piece, "opposite-wall", room, placed);
      }
    }

    if (relPlacement) {
      const rect = makeRect(relPlacement.x, relPlacement.y, pw, pd);
      placed.push({
        id: piece.id, name: piece.name, category: cat,
        x: round2(relPlacement.x), y: round2(relPlacement.y),
        width: pw, depth: pd, rotation: relPlacement.rotation || 0,
        rect, fit_status: "perfect",
      });
      continue;
    }

    // ── General candidate search ────────────────────────────────────────
    let bestCandidate = null;
    let bestScore = -Infinity;

    const rotations = canRotate ? [0, 90] : [0]; // 180/270 are equivalent for rectangles

    for (const rot of rotations) {
      const w = rot === 90 ? pd : pw;
      const d = rot === 90 ? pw : pd;

      // Determine if this category should only go against walls
      const wallOnly = ["sofa", "sectional", "bed", "dresser", "bookshelf", "media-console"].includes(cat);

      if (wallOnly) {
        // Only try positions along walls
        const walls = ["north", "south", "east", "west"];
        for (const wall of walls) {
          const wLen = wallLength(wall, room);
          if (w > wLen) continue; // piece doesn't fit on this wall

          for (let pos = 0; pos <= wLen - w; pos += STEP) {
            const wp = wallPosition(wall, pos, w, d, room);
            const rect = makeRect(wp.x, wp.y, w, d);
            if (!rectInRoom(rect, room)) continue;
            if (hasCollision(rect, placed)) continue;

            const s = scorePosition(piece, wp.x, wp.y, w, d, rot, room, placed);
            if (s > bestScore) {
              bestScore = s;
              bestCandidate = { x: wp.x, y: wp.y, w, d, rotation: rot };
            }
          }
        }
      } else {
        // Try all positions in the room
        for (let x = 0; x <= rw - w; x += STEP) {
          for (let y = 0; y <= rd - d; y += STEP) {
            const rect = makeRect(x, y, w, d);
            if (hasCollision(rect, placed)) continue;

            const s = scorePosition(piece, x, y, w, d, rot, room, placed);
            if (s > bestScore) {
              bestScore = s;
              bestCandidate = { x, y, w, d, rotation: rot };
            }
          }
        }
      }
    }

    if (bestCandidate) {
      const rect = makeRect(bestCandidate.x, bestCandidate.y, bestCandidate.w, bestCandidate.d);
      const gap = placed.length > 0 ? minGapToPlaced(rect, placed) : Infinity;
      const fitStatus = gap >= RULES["walkway-minimum"].min_in ? "perfect"
        : gap >= RULES["walkway-minimum"].tight_in ? "tight" : "forced";

      placed.push({
        id: piece.id, name: piece.name, category: cat,
        x: round2(bestCandidate.x), y: round2(bestCandidate.y),
        width: bestCandidate.w, depth: bestCandidate.d,
        rotation: bestCandidate.rotation,
        rect, fit_status: fitStatus,
      });
    } else {
      unplaced.push(piece.id || piece.name);
      issues.push({ severity: "error", message: `Could not place "${piece.name || piece.id}" — no valid position found.` });
    }
  }

  // ── Post-placement checks ─────────────────────────────────────────────
  // Traffic paths: main path from each door into the room center
  const trafficPaths = [];
  if (room.doors) {
    for (const door of room.doors) {
      const dPos = (door.position_in || 0) + (door.width_in || 36) / 2;
      let startX, startY;
      switch (door.wall) {
        case "north": startX = dPos; startY = 0; break;
        case "south": startX = dPos; startY = rd; break;
        case "east":  startX = rw; startY = dPos; break;
        case "west":  startX = 0; startY = dPos; break;
        default:      startX = 0; startY = 0;
      }
      trafficPaths.push({
        points: [
          { x: round2(startX), y: round2(startY) },
          { x: round2(rw / 2), y: round2(rd / 2) },
        ],
        width: RULES["walkway-minimum"].min_in,
      });
    }
  }

  // Sight lines to focal point
  const sightLines = [];
  if (room.focal_point) {
    const fp = room.focal_point;
    let fpX, fpY;
    switch (fp.wall) {
      case "north": fpX = fp.position_in || rw / 2; fpY = 0; break;
      case "south": fpX = fp.position_in || rw / 2; fpY = rd; break;
      case "east":  fpX = rw; fpY = fp.position_in || rd / 2; break;
      case "west":  fpX = 0; fpY = fp.position_in || rd / 2; break;
      default:      fpX = rw / 2; fpY = 0;
    }
    const seatCats = new Set(["sofa", "sectional", "accent-chair", "chair"]);
    for (const p of placed) {
      if (seatCats.has(p.category)) {
        sightLines.push({
          from: { x: round2(p.x + p.width / 2), y: round2(p.y + p.depth / 2) },
          to: { x: round2(fpX), y: round2(fpY) },
          type: fp.type || "tv",
        });
      }
    }
  }

  // Overall score
  let layoutScore = 100;
  if (unplaced.length > 0) layoutScore -= unplaced.length * 15;

  // Penalize tight fits
  for (const p of placed) {
    if (p.fit_status === "tight") layoutScore -= 5;
    if (p.fit_status === "forced") layoutScore -= 12;
  }

  // Penalize blocked traffic paths
  for (const path of trafficPaths) {
    const pathRect = makeRect(
      Math.min(path.points[0].x, path.points[1].x) - path.width / 2,
      Math.min(path.points[0].y, path.points[1].y) - path.width / 2,
      Math.abs(path.points[1].x - path.points[0].x) + path.width,
      Math.abs(path.points[1].y - path.points[0].y) + path.width
    );
    for (const p of placed) {
      if (rectsOverlap(p.rect, pathRect)) {
        issues.push({ severity: "warning", message: `"${p.name || p.id}" may obstruct traffic path from door.` });
        layoutScore -= 5;
      }
    }
  }

  layoutScore = Math.max(0, Math.min(100, Math.round(layoutScore)));

  // Strip internal rect from output
  const placements = placed.map(({ rect, category, ...rest }) => ({
    ...rest,
    // keep category in output for reference
    category,
  }));

  return {
    placements,
    traffic_paths: trafficPaths,
    sight_lines: sightLines,
    score: layoutScore,
    issues,
    unplaced,
  };
}

// ---------------------------------------------------------------------------
// SVG Generation — Floor Plan
// ---------------------------------------------------------------------------

/**
 * Generate an SVG floor plan from a layout result.
 *
 * @param {ReturnType<typeof generateLayout>} layout
 * @param {object} room
 * @param {object} [options]
 * @returns {string} SVG markup.
 */
export function generateFloorPlanSVG(layout, room, options = {}) {
  const {
    width: svgW = 800,
    height: svgH = 600,
    showDimensions = true,
    showTraffic = true,
    showSightLines = false,
    padding = 60,
    wallThickness = 6,
  } = options;

  const rw = room.width_in;
  const rd = room.depth_in;

  // Scale factor: fit room into SVG with padding
  const drawW = svgW - padding * 2;
  const drawH = svgH - padding * 2;
  const scale = Math.min(drawW / rw, drawH / rd);
  const ox = padding + (drawW - rw * scale) / 2; // origin x
  const oy = padding + (drawH - rd * scale) / 2; // origin y

  const s = (v) => round2(v * scale);
  const tx = (x) => round2(ox + x * scale);
  const ty = (y) => round2(oy + y * scale);

  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" font-family="system-ui, sans-serif">`);

  // Background
  lines.push(`  <rect width="${svgW}" height="${svgH}" fill="#111827" />`);

  // Grid (12" intervals)
  lines.push(`  <g stroke="#1f2937" stroke-width="0.5" stroke-dasharray="2,4">`);
  for (let gx = 0; gx <= rw; gx += 12) {
    lines.push(`    <line x1="${tx(gx)}" y1="${ty(0)}" x2="${tx(gx)}" y2="${ty(rd)}" />`);
  }
  for (let gy = 0; gy <= rd; gy += 12) {
    lines.push(`    <line x1="${tx(0)}" y1="${ty(gy)}" x2="${tx(rw)}" y2="${ty(gy)}" />`);
  }
  lines.push(`  </g>`);

  // Room outline / walls
  const wt = s(wallThickness);
  lines.push(`  <!-- Walls -->`);
  // North wall
  lines.push(`  <rect x="${tx(-wallThickness)}" y="${ty(-wallThickness)}" width="${s(rw + wallThickness * 2)}" height="${wt}" fill="#374151" />`);
  // South wall
  lines.push(`  <rect x="${tx(-wallThickness)}" y="${ty(rd)}" width="${s(rw + wallThickness * 2)}" height="${wt}" fill="#374151" />`);
  // West wall
  lines.push(`  <rect x="${tx(-wallThickness)}" y="${ty(0)}" width="${wt}" height="${s(rd)}" fill="#374151" />`);
  // East wall
  lines.push(`  <rect x="${tx(rw)}" y="${ty(0)}" width="${wt}" height="${s(rd)}" fill="#374151" />`);

  // Room interior
  lines.push(`  <rect x="${tx(0)}" y="${ty(0)}" width="${s(rw)}" height="${s(rd)}" fill="#1a1a2e" stroke="#4b5563" stroke-width="1" />`);

  // Doors
  if (room.doors) {
    lines.push(`  <!-- Doors -->`);
    for (const door of room.doors) {
      const dPos = door.position_in || 0;
      const dW = door.width_in || 36;
      const dS = s(dW);
      let dx, dy, arcPath;

      switch (door.wall) {
        case "north":
          dx = tx(dPos);
          dy = ty(0);
          // Gap in wall
          lines.push(`  <rect x="${dx}" y="${ty(-wallThickness)}" width="${dS}" height="${wt}" fill="#1a1a2e" />`);
          // Swing arc
          arcPath = `M ${dx} ${dy} A ${dS} ${dS} 0 0 1 ${round2(dx + dS)} ${dy}`;
          lines.push(`  <path d="${arcPath}" fill="none" stroke="#6b7280" stroke-width="1" stroke-dasharray="4,3" />`);
          break;
        case "south":
          dx = tx(dPos);
          dy = ty(rd);
          lines.push(`  <rect x="${dx}" y="${dy}" width="${dS}" height="${wt}" fill="#1a1a2e" />`);
          arcPath = `M ${dx} ${dy} A ${dS} ${dS} 0 0 0 ${round2(dx + dS)} ${dy}`;
          lines.push(`  <path d="${arcPath}" fill="none" stroke="#6b7280" stroke-width="1" stroke-dasharray="4,3" />`);
          break;
        case "west":
          dx = tx(0);
          dy = ty(dPos);
          lines.push(`  <rect x="${tx(-wallThickness)}" y="${dy}" width="${wt}" height="${dS}" fill="#1a1a2e" />`);
          arcPath = `M ${dx} ${dy} A ${dS} ${dS} 0 0 0 ${dx} ${round2(dy + dS)}`;
          lines.push(`  <path d="${arcPath}" fill="none" stroke="#6b7280" stroke-width="1" stroke-dasharray="4,3" />`);
          break;
        case "east":
          dx = tx(rw);
          dy = ty(dPos);
          lines.push(`  <rect x="${dx}" y="${dy}" width="${wt}" height="${dS}" fill="#1a1a2e" />`);
          arcPath = `M ${dx} ${dy} A ${dS} ${dS} 0 0 1 ${dx} ${round2(dy + dS)}`;
          lines.push(`  <path d="${arcPath}" fill="none" stroke="#6b7280" stroke-width="1" stroke-dasharray="4,3" />`);
          break;
      }
    }
  }

  // Windows
  if (room.windows) {
    lines.push(`  <!-- Windows -->`);
    for (const win of room.windows) {
      const wPos = win.position_in || 0;
      const wW = win.width_in || 36;
      let x1, y1, x2, y2;
      switch (win.wall) {
        case "north":
          x1 = tx(wPos); y1 = ty(-2); x2 = tx(wPos + wW); y2 = ty(-2);
          break;
        case "south":
          x1 = tx(wPos); y1 = ty(rd + 2); x2 = tx(wPos + wW); y2 = ty(rd + 2);
          break;
        case "west":
          x1 = tx(-2); y1 = ty(wPos); x2 = tx(-2); y2 = ty(wPos + wW);
          break;
        case "east":
          x1 = tx(rw + 2); y1 = ty(wPos); x2 = tx(rw + 2); y2 = ty(wPos + wW);
          break;
        default:
          continue;
      }
      lines.push(`  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#60a5fa" stroke-width="3" />`);
      lines.push(`  <line x1="${round2(x1 + (win.wall === "west" || win.wall === "east" ? 0 : 0))}" y1="${round2(y1 + (win.wall === "north" || win.wall === "south" ? -2 : 0))}" x2="${round2(x2 + (win.wall === "west" || win.wall === "east" ? 0 : 0))}" y2="${round2(y2 + (win.wall === "north" || win.wall === "south" ? -2 : 0))}" stroke="#60a5fa" stroke-width="1" />`);
    }
  }

  // Traffic paths
  if (showTraffic && layout.traffic_paths) {
    lines.push(`  <!-- Traffic Paths -->`);
    lines.push(`  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" /></marker></defs>`);
    for (const path of layout.traffic_paths) {
      if (path.points.length >= 2) {
        const pts = path.points.map((p) => `${tx(p.x)},${ty(p.y)}`).join(" ");
        lines.push(`  <polyline points="${pts}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-dasharray="6,4" marker-end="url(#arrow)" opacity="0.5" />`);
      }
    }
  }

  // Sight lines
  if (showSightLines && layout.sight_lines) {
    lines.push(`  <!-- Sight Lines -->`);
    for (const sl of layout.sight_lines) {
      lines.push(`  <line x1="${tx(sl.from.x)}" y1="${ty(sl.from.y)}" x2="${tx(sl.to.x)}" y2="${ty(sl.to.y)}" stroke="#a78bfa" stroke-width="1" stroke-dasharray="3,3" opacity="0.4" />`);
    }
  }

  // Furniture pieces
  if (layout.placements) {
    lines.push(`  <!-- Furniture -->`);
    for (const p of layout.placements) {
      const fx = tx(p.x);
      const fy = ty(p.y);
      const fw = s(p.width);
      const fd = s(p.depth);

      let fill, stroke;
      if (p.fit_status === "perfect") {
        fill = "#22c55e20";
        stroke = "#22c55e";
      } else if (p.fit_status === "tight") {
        fill = "#eab30820";
        stroke = "#eab308";
      } else {
        fill = "#ef444420";
        stroke = "#ef4444";
      }

      lines.push(`  <g>`);
      lines.push(`    <rect x="${fx}" y="${fy}" width="${fw}" height="${fd}" rx="3" ry="3" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />`);

      // Label
      const labelX = round2(fx + fw / 2);
      const labelY = round2(fy + fd / 2 - 4);
      const name = (p.name || p.id || "").substring(0, 20);
      const fontSize = Math.max(8, Math.min(12, fw / 8));
      lines.push(`    <text x="${labelX}" y="${labelY}" text-anchor="middle" fill="#e5e7eb" font-size="${fontSize}">${escSvg(name)}</text>`);

      // Dimensions below label
      if (showDimensions) {
        const dimText = `${p.width}" × ${p.depth}"`;
        lines.push(`    <text x="${labelX}" y="${round2(labelY + fontSize + 2)}" text-anchor="middle" fill="#9ca3af" font-size="${Math.max(7, fontSize - 2)}">${dimText}</text>`);
      }
      lines.push(`  </g>`);
    }
  }

  // Scale bar
  const barLen = s(IN_PER_FT); // 1 foot
  const barX = padding;
  const barY = svgH - 25;
  lines.push(`  <!-- Scale Bar -->`);
  lines.push(`  <line x1="${barX}" y1="${barY}" x2="${round2(barX + barLen)}" y2="${barY}" stroke="#9ca3af" stroke-width="2" />`);
  lines.push(`  <line x1="${barX}" y1="${round2(barY - 4)}" x2="${barX}" y2="${round2(barY + 4)}" stroke="#9ca3af" stroke-width="1.5" />`);
  lines.push(`  <line x1="${round2(barX + barLen)}" y1="${round2(barY - 4)}" x2="${round2(barX + barLen)}" y2="${round2(barY + 4)}" stroke="#9ca3af" stroke-width="1.5" />`);
  lines.push(`  <text x="${round2(barX + barLen / 2)}" y="${round2(barY - 6)}" text-anchor="middle" fill="#9ca3af" font-size="10">1 foot</text>`);

  // Room dimensions label
  const roomLabel = `${round2(rw / IN_PER_FT)}' × ${round2(rd / IN_PER_FT)}'`;
  lines.push(`  <text x="${round2(svgW / 2)}" y="${round2(padding / 2)}" text-anchor="middle" fill="#e5e7eb" font-size="14" font-weight="600">${roomLabel}</text>`);

  // Dimension annotations along room edges
  if (showDimensions) {
    // Width annotation (top)
    const dimY = ty(-wallThickness) - 12;
    lines.push(`  <line x1="${tx(0)}" y1="${dimY}" x2="${tx(rw)}" y2="${dimY}" stroke="#6b7280" stroke-width="0.8" marker-start="url(#arrow)" marker-end="url(#arrow)" />`);
    lines.push(`  <text x="${tx(rw / 2)}" y="${round2(dimY - 4)}" text-anchor="middle" fill="#9ca3af" font-size="10">${round2(rw / IN_PER_FT)} ft</text>`);
    // Depth annotation (left)
    const dimX = tx(-wallThickness) - 12;
    lines.push(`  <line x1="${dimX}" y1="${ty(0)}" x2="${dimX}" y2="${ty(rd)}" stroke="#6b7280" stroke-width="0.8" />`);
    lines.push(`  <text x="${dimX}" y="${ty(rd / 2)}" text-anchor="middle" fill="#9ca3af" font-size="10" transform="rotate(-90, ${dimX}, ${ty(rd / 2)})">${round2(rd / IN_PER_FT)} ft</text>`);
  }

  lines.push(`</svg>`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// SVG Generation — Scale Comparison
// ---------------------------------------------------------------------------

/**
 * Generate a scale comparison SVG showing products at relative size.
 *
 * @param {Array<{name: string, vendor?: string, width_in: number, depth_in: number, height_in: number, category?: string}>} products
 * @param {object} [options]
 * @returns {string} SVG markup.
 */
export function generateScaleComparisonSVG(products, options = {}) {
  const {
    view = "front",
    includeHuman = true,
    width: svgW = 800,
    height: svgH = 400,
    padding = 50,
  } = options;

  if (!products || products.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}"><rect width="${svgW}" height="${svgH}" fill="#f9fafb"/><text x="${svgW / 2}" y="${svgH / 2}" text-anchor="middle" fill="#6b7280" font-family="system-ui">No products to compare</text></svg>`;
  }

  // In "front" view: show height (y) and width (x)
  // In "top" view: show width (x) and depth (y)
  const isFront = view === "front";

  // Determine max height for scale reference
  const humanH = 66; // 5'6" in inches
  const humanW = 18; // rough shoulder width
  const humanD = 10;

  // Collect items to render
  const items = [];
  if (includeHuman) {
    items.push({
      name: "5'6\" Person",
      vendor: "",
      w: isFront ? humanW : humanW,
      h: isFront ? humanH : humanD,
      original: { width_in: humanW, depth_in: humanD, height_in: humanH },
      isHuman: true,
    });
  }
  for (const p of products) {
    const w = p.width_in || 0;
    const h = isFront ? (p.height_in || 0) : (p.depth_in || 0);
    items.push({
      name: p.name || "Product",
      vendor: p.vendor || "",
      w,
      h,
      original: p,
      isHuman: false,
    });
  }

  // Compute scale: fit everything in the drawing area
  const drawW = svgW - padding * 2;
  const drawH = svgH - padding * 2 - 40; // leave room for labels below

  const maxH = Math.max(...items.map((i) => i.h), 1);
  const totalW = items.reduce((sum, i) => sum + i.w, 0) + (items.length - 1) * 12; // 12" gaps

  const scaleX = drawW / totalW;
  const scaleY = drawH / maxH;
  const scale = Math.min(scaleX, scaleY);

  const baselineY = padding + drawH; // bottom of drawing area

  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="${svgW}" height="${svgH}" font-family="system-ui, sans-serif">`);

  // Background
  lines.push(`  <rect width="${svgW}" height="${svgH}" fill="#f9fafb" />`);

  // Grid
  lines.push(`  <g stroke="#e5e7eb" stroke-width="0.5">`);
  const gridStep = 12; // 12" grid
  for (let gh = 0; gh <= maxH; gh += gridStep) {
    const gy = round2(baselineY - gh * scale);
    lines.push(`    <line x1="${padding}" y1="${gy}" x2="${svgW - padding}" y2="${gy}" />`);
    // Height label
    if (gh > 0) {
      lines.push(`    <text x="${padding - 5}" y="${round2(gy + 3)}" text-anchor="end" fill="#9ca3af" font-size="9">${gh}"</text>`);
    }
  }
  lines.push(`  </g>`);

  // Baseline
  lines.push(`  <line x1="${padding}" y1="${baselineY}" x2="${svgW - padding}" y2="${baselineY}" stroke="#374151" stroke-width="1.5" />`);

  // Title
  const viewLabel = isFront ? "Front View (Width × Height)" : "Top View (Width × Depth)";
  lines.push(`  <text x="${svgW / 2}" y="${round2(padding / 2)}" text-anchor="middle" fill="#374151" font-size="14" font-weight="600">${viewLabel}</text>`);

  // Render each item
  let curX = padding + (drawW - totalW * scale) / 2; // center the group

  for (const item of items) {
    const iw = round2(item.w * scale);
    const ih = round2(item.h * scale);
    const ix = round2(curX);
    const iy = round2(baselineY - ih);

    if (item.isHuman) {
      // Human silhouette — simplified standing figure
      const headR = round2(4 * scale);
      const bodyW = round2(12 * scale);
      const headCx = round2(ix + iw / 2);
      const headCy = round2(iy + headR + 2);
      const shoulderY = round2(headCy + headR + 2);
      const hipY = round2(baselineY - 28 * scale);
      const footY = baselineY;

      lines.push(`  <g opacity="0.6">`);
      // Head
      lines.push(`    <circle cx="${headCx}" cy="${headCy}" r="${headR}" fill="#9ca3af" />`);
      // Body
      lines.push(`    <line x1="${headCx}" y1="${shoulderY}" x2="${headCx}" y2="${hipY}" stroke="#9ca3af" stroke-width="${round2(2 * scale)}" stroke-linecap="round" />`);
      // Arms
      lines.push(`    <line x1="${round2(headCx - bodyW / 2)}" y1="${round2(shoulderY + 6 * scale)}" x2="${round2(headCx + bodyW / 2)}" y2="${round2(shoulderY + 6 * scale)}" stroke="#9ca3af" stroke-width="${round2(1.5 * scale)}" stroke-linecap="round" />`);
      // Legs
      lines.push(`    <line x1="${headCx}" y1="${hipY}" x2="${round2(headCx - 5 * scale)}" y2="${footY}" stroke="#9ca3af" stroke-width="${round2(1.5 * scale)}" stroke-linecap="round" />`);
      lines.push(`    <line x1="${headCx}" y1="${hipY}" x2="${round2(headCx + 5 * scale)}" y2="${footY}" stroke="#9ca3af" stroke-width="${round2(1.5 * scale)}" stroke-linecap="round" />`);
      lines.push(`  </g>`);

      // Label
      lines.push(`  <text x="${round2(ix + iw / 2)}" y="${round2(baselineY + 14)}" text-anchor="middle" fill="#6b7280" font-size="10">${escSvg(item.name)}</text>`);

      // Height line
      lines.push(`  <line x1="${round2(ix + iw + 4)}" y1="${iy}" x2="${round2(ix + iw + 4)}" y2="${baselineY}" stroke="#6b7280" stroke-width="0.8" />`);
      lines.push(`  <text x="${round2(ix + iw + 8)}" y="${round2(iy + ih / 2)}" fill="#6b7280" font-size="8">${item.h}"</text>`);
    } else {
      // Product rectangle
      lines.push(`  <g>`);
      lines.push(`    <rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="2" ry="2" fill="#e5e7eb" stroke="#374151" stroke-width="1.5" />`);

      // Label inside if space, otherwise above
      const labelY = ih > 30 ? round2(iy + ih / 2) : round2(iy - 4);
      const labelFill = ih > 30 ? "#374151" : "#374151";
      const maxNameLen = Math.floor(iw / 6);
      const displayName = item.name.length > maxNameLen ? item.name.substring(0, maxNameLen) + "…" : item.name;

      lines.push(`    <text x="${round2(ix + iw / 2)}" y="${labelY}" text-anchor="middle" fill="${labelFill}" font-size="10" font-weight="500">${escSvg(displayName)}</text>`);

      // Vendor
      if (item.vendor) {
        lines.push(`    <text x="${round2(ix + iw / 2)}" y="${round2(baselineY + 14)}" text-anchor="middle" fill="#9ca3af" font-size="8">${escSvg(item.vendor)}</text>`);
      }

      // Name below baseline
      lines.push(`    <text x="${round2(ix + iw / 2)}" y="${round2(baselineY + 26)}" text-anchor="middle" fill="#6b7280" font-size="9">${escSvg(item.name)}</text>`);

      // Dimensions callout
      const dimLabel = isFront
        ? `${item.original.width_in}"W × ${item.original.height_in}"H`
        : `${item.original.width_in}"W × ${item.original.depth_in}"D`;
      lines.push(`    <text x="${round2(ix + iw / 2)}" y="${round2(baselineY + 38)}" text-anchor="middle" fill="#9ca3af" font-size="8">${dimLabel}</text>`);

      // Height measurement line (right side)
      if (ih > 15) {
        const lineX = round2(ix + iw + 4);
        lines.push(`    <line x1="${lineX}" y1="${iy}" x2="${lineX}" y2="${round2(iy + ih)}" stroke="#6b7280" stroke-width="0.8" />`);
        lines.push(`    <line x1="${round2(lineX - 3)}" y1="${iy}" x2="${round2(lineX + 3)}" y2="${iy}" stroke="#6b7280" stroke-width="0.8" />`);
        lines.push(`    <line x1="${round2(lineX - 3)}" y1="${round2(iy + ih)}" x2="${round2(lineX + 3)}" y2="${round2(iy + ih)}" stroke="#6b7280" stroke-width="0.8" />`);
        lines.push(`    <text x="${round2(lineX + 6)}" y="${round2(iy + ih / 2 + 3)}" fill="#6b7280" font-size="8">${item.h}"</text>`);
      }

      // Width measurement line (bottom)
      if (iw > 15) {
        const lineY = round2(iy + ih + 10);
        lines.push(`    <line x1="${ix}" y1="${lineY}" x2="${round2(ix + iw)}" y2="${lineY}" stroke="#6b7280" stroke-width="0.8" />`);
        lines.push(`    <line x1="${ix}" y1="${round2(lineY - 3)}" x2="${ix}" y2="${round2(lineY + 3)}" stroke="#6b7280" stroke-width="0.8" />`);
        lines.push(`    <line x1="${round2(ix + iw)}" y1="${round2(lineY - 3)}" x2="${round2(ix + iw)}" y2="${round2(lineY + 3)}" stroke="#6b7280" stroke-width="0.8" />`);
        lines.push(`    <text x="${round2(ix + iw / 2)}" y="${round2(lineY - 3)}" text-anchor="middle" fill="#6b7280" font-size="8">${item.w}"</text>`);
      }

      lines.push(`  </g>`);
    }

    curX += iw + 12 * scale; // gap between items
  }

  // Scale bar in bottom-right
  const barLen = round2(IN_PER_FT * scale);
  const barX = svgW - padding - barLen;
  const barY = svgH - 15;
  lines.push(`  <line x1="${barX}" y1="${barY}" x2="${round2(barX + barLen)}" y2="${barY}" stroke="#6b7280" stroke-width="2" />`);
  lines.push(`  <line x1="${barX}" y1="${round2(barY - 3)}" x2="${barX}" y2="${round2(barY + 3)}" stroke="#6b7280" stroke-width="1" />`);
  lines.push(`  <line x1="${round2(barX + barLen)}" y1="${round2(barY - 3)}" x2="${round2(barX + barLen)}" y2="${round2(barY + 3)}" stroke="#6b7280" stroke-width="1" />`);
  lines.push(`  <text x="${round2(barX + barLen / 2)}" y="${round2(barY - 5)}" text-anchor="middle" fill="#6b7280" font-size="9">1 foot</text>`);

  lines.push(`</svg>`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n) {
  return Math.round(n * 100) / 100;
}

function escSvg(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
