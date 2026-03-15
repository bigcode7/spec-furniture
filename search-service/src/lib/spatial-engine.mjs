/**
 * Spatial Intelligence Engine — Dimensional reasoning for furniture placement.
 *
 * Pure JavaScript math engine with zero API cost.  Parses free-text product
 * dimensions, checks spatial fit in rooms, validates delivery feasibility,
 * and suggests proportionally correct companion pieces.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IN_PER_CM = 1 / 2.54;
const IN_PER_FT = 12;

const SPATIAL_RULES = {
  "sofa-to-coffee-table": {
    min_gap_in: 14,
    ideal_gap_in: 18,
    max_gap_in: 24,
    description: "Distance from sofa front edge to coffee table edge",
  },
  "coffee-table-to-sofa-ratio": {
    min_ratio: 0.5,
    ideal_ratio: 0.67,
    max_ratio: 0.75,
    description: "Coffee table length should be 50-75% of sofa length",
  },
  "dining-chair-clearance": {
    min_in: 32,
    ideal_in: 36,
    description: "Space behind dining chairs for pushing back",
  },
  "walkway-minimum": {
    min_in: 24,
    ideal_in: 30,
    tight_in: 18,
    description: "Minimum walkway between furniture pieces",
  },
  "rug-dining-extension": {
    min_in: 24,
    description: "Rug should extend beyond table on all sides",
  },
  "bed-room-minimums": {
    king:  { min_width_ft: 12, min_depth_ft: 14 },
    queen: { min_width_ft: 11, min_depth_ft: 12 },
    full:  { min_width_ft: 10, min_depth_ft: 11 },
    twin:  { min_width_ft: 8,  min_depth_ft: 10 },
  },
  "accent-chair-gap": {
    min_in: 18,
    ideal_in: 24,
    description: "Space between accent chairs for side table",
  },
  "console-table-max-depth": {
    hallway_max_in: 18,
    standard_max_in: 24,
    description: "Console table depth limits by location",
  },
  "tv-viewing-distance": {
    multiplier: 1.5,
    description: "Optimal viewing distance = 1.5x screen diagonal",
  },
  "chandelier-dining": {
    above_table_in: 30,
    above_table_max_in: 36,
    narrower_than_table_in: 12,
    description: "Chandelier placement above dining table",
  },
  "conversation-distance": {
    max_ft: 10,
    ideal_ft: 8,
    description: "Maximum distance between seating for conversation",
  },
  "nightstand-width": {
    min_in: 18,
    max_in: 30,
    description:
      "Nightstand should be between bed height minus 2 inches and bed height",
  },
};

// ---------------------------------------------------------------------------
// Dimension Parser
// ---------------------------------------------------------------------------

/**
 * Parse a free-text dimension string into structured inches.
 *
 * Supported formats:
 *   - 'W 96" x D 38" x H 32"'
 *   - '96 x 38 x 32'
 *   - '96"W x 38"D'
 *   - '96W x 38D x 32H'
 *   - '96 inches wide, 38 inches deep, 32 inches tall'
 *   - '244 cm x 97 cm x 81 cm'
 *   - 'Seat height: 18"'
 *   - 'Arm height 25"'
 *
 * @param {string} dimString  Raw dimension text from a catalog listing.
 * @returns {{ width_in: number, depth_in: number, height_in: number,
 *             seat_height_in: number|null, arm_height_in: number|null,
 *             diagonal_in: number } | null}
 */
export function parseDimensions(dimString) {
  if (!dimString || typeof dimString !== "string") return null;

  const s = dimString.trim();
  if (s.length === 0) return null;

  // Detect unit — default to inches
  const isCm =
    /\bcm\b/i.test(s) || /\bcentimeter/i.test(s) || /\bcenti\b/i.test(s);
  const conversionFactor = isCm ? IN_PER_CM : 1;

  let width = null;
  let depth = null;
  let height = null;
  let seatHeight = null;
  let armHeight = null;

  // ── Helper: extract a number next to a label ──────────────────────────
  const extractLabeled = (text, patterns) => {
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const val = parseFloat(m[1] || m[2]);
        if (!Number.isNaN(val) && val > 0) return val;
      }
    }
    return null;
  };

  // ── Seat height ───────────────────────────────────────────────────────
  seatHeight = extractLabeled(s, [
    /seat\s*(?:height|ht\.?)[:\s]*(\d+(?:\.\d+)?)\s*(?:"|in|inch|cm)?/i,
    /(\d+(?:\.\d+)?)\s*(?:"|in|inch|cm)?\s*seat\s*(?:height|ht)/i,
    /SH[:\s]*(\d+(?:\.\d+)?)/i,
  ]);

  // ── Arm height ────────────────────────────────────────────────────────
  armHeight = extractLabeled(s, [
    /arm\s*(?:height|ht\.?)[:\s]*(\d+(?:\.\d+)?)\s*(?:"|in|inch|cm)?/i,
    /(\d+(?:\.\d+)?)\s*(?:"|in|inch|cm)?\s*arm\s*(?:height|ht)/i,
    /AH[:\s]*(\d+(?:\.\d+)?)/i,
  ]);

  // ── Strategy 1: explicit W/D/H labels ─────────────────────────────────
  const wPatterns = [
    /W[:\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?|cm)?\s*W\b/i,
    /(?:width|wide)[:\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?|cm)?\s*(?:wide|width)/i,
  ];
  const dPatterns = [
    /D[:\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?|cm)?\s*D\b/i,
    /(?:depth|deep)[:\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?|cm)?\s*(?:deep|depth)/i,
  ];
  const hPatterns = [
    /H[:\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?|cm)?\s*H\b/i,
    /(?:height|tall|high)[:\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:"|in|inch(?:es)?|cm)?\s*(?:tall|height|high)/i,
  ];

  // First try finding explicit labels in the original string.
  // We strip seat/arm height mentions first so they don't collide with "H".
  const stripped = s
    .replace(/seat\s*(?:height|ht\.?)[:\s]*\d+(?:\.\d+)?\s*(?:"|in|inch(?:es)?|cm)?/gi, "")
    .replace(/arm\s*(?:height|ht\.?)[:\s]*\d+(?:\.\d+)?\s*(?:"|in|inch(?:es)?|cm)?/gi, "")
    .replace(/\d+(?:\.\d+)?\s*(?:"|in|inch(?:es)?|cm)?\s*seat\s*(?:height|ht)/gi, "")
    .replace(/\d+(?:\.\d+)?\s*(?:"|in|inch(?:es)?|cm)?\s*arm\s*(?:height|ht)/gi, "")
    .replace(/SH[:\s]*\d+(?:\.\d+)?/gi, "")
    .replace(/AH[:\s]*\d+(?:\.\d+)?/gi, "");

  width = extractLabeled(stripped, wPatterns);
  depth = extractLabeled(stripped, dPatterns);
  height = extractLabeled(stripped, hPatterns);

  // ── Strategy 2: plain "N x N x N" (no labels) ────────────────────────
  if (width === null && depth === null && height === null) {
    // Match sequences of numbers separated by 'x', ',', 'by', or '×'
    const nums = [];
    const numRe = /(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?|cm)?\s*(?:[x×,]|by|\|)/gi;
    let m;
    while ((m = numRe.exec(stripped))) {
      nums.push(parseFloat(m[1]));
    }
    // Grab trailing number
    const trailingRe = /(?:[x×,]|by|\|)\s*(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?|cm)?/gi;
    let lastVal = null;
    while ((m = trailingRe.exec(stripped))) {
      lastVal = parseFloat(m[1]);
    }
    if (lastVal !== null && (nums.length === 0 || nums[nums.length - 1] !== lastVal)) {
      nums.push(lastVal);
    }

    // Also try a simpler all-at-once regex for "N x N x N"
    if (nums.length < 2) {
      const simple = stripped.match(
        /(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?|cm)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?|cm)?(?:\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?|cm)?)?/i
      );
      if (simple) {
        nums.length = 0;
        nums.push(parseFloat(simple[1]));
        nums.push(parseFloat(simple[2]));
        if (simple[3]) nums.push(parseFloat(simple[3]));
      }
    }

    if (nums.length >= 3) {
      // Convention: width (largest horizontal), depth, height (smallest if < 60)
      const sorted = [...nums.slice(0, 3)].sort((a, b) => b - a);
      width = sorted[0];
      depth = sorted[1];
      height = sorted[2];
    } else if (nums.length === 2) {
      // Assume width x depth
      width = Math.max(nums[0], nums[1]);
      depth = Math.min(nums[0], nums[1]);
    }
  }

  // ── Strategy 3: natural-language dimensions ───────────────────────────
  if (width === null && depth === null && height === null) {
    const nlWidth = stripped.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?|cm)?\s*(?:wide|width|w\b)/i);
    const nlDepth = stripped.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?|cm)?\s*(?:deep|depth|d\b)/i);
    const nlHeight = stripped.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?|cm)?\s*(?:tall|height|high|h\b)/i);

    if (nlWidth) width = parseFloat(nlWidth[1]);
    if (nlDepth) depth = parseFloat(nlDepth[1]);
    if (nlHeight) height = parseFloat(nlHeight[1]);
  }

  // Nothing found
  if (width === null && depth === null && height === null) return null;

  // Apply unit conversion
  width = width !== null ? width * conversionFactor : null;
  depth = depth !== null ? depth * conversionFactor : null;
  height = height !== null ? height * conversionFactor : null;
  seatHeight = seatHeight !== null ? seatHeight * conversionFactor : null;
  armHeight = armHeight !== null ? armHeight * conversionFactor : null;

  // Default missing dimensions to 0 so downstream math doesn't break
  const w = width ?? 0;
  const d = depth ?? 0;
  const h = height ?? 0;

  const diagonal = Math.sqrt(w * w + d * d);

  return {
    width_in: round2(w),
    depth_in: round2(d),
    height_in: round2(h),
    seat_height_in: seatHeight !== null ? round2(seatHeight) : null,
    arm_height_in: armHeight !== null ? round2(armHeight) : null,
    diagonal_in: round2(diagonal),
  };
}

// ---------------------------------------------------------------------------
// Batch parser
// ---------------------------------------------------------------------------

/**
 * Parse dimensions for an array of product objects.
 *
 * @param {Array<{id: string, dimensions?: string}>} products
 * @returns {Map<string, ReturnType<typeof parseDimensions>>}
 */
export function batchParseDimensions(products) {
  const map = new Map();
  if (!Array.isArray(products)) return map;

  for (const p of products) {
    if (!p || !p.id) continue;
    if (!p.dimensions || typeof p.dimensions !== "string") continue;
    const parsed = parseDimensions(p.dimensions);
    if (parsed) map.set(p.id, parsed);
  }
  return map;
}

// ---------------------------------------------------------------------------
// checkProductFit
// ---------------------------------------------------------------------------

/**
 * Check whether a single product fits in a room.
 *
 * @param {object} product  Must include width_in, depth_in, height_in, category.
 * @param {object} room     Room description (width_in, depth_in, height_in,
 *                           doors, windows, existing_pieces).
 * @returns {{ fit: string, score: number,
 *             issues: Array<{rule:string,severity:string,message:string}>,
 *             suggestions: Array<{type:string,message:string,search_query:string}> }}
 */
export function checkProductFit(product, room) {
  if (!product || !room) {
    return {
      fit: "unknown",
      score: 0,
      issues: [{ rule: "input", severity: "error", message: "Missing product or room data." }],
      suggestions: [],
    };
  }

  const issues = [];
  const suggestions = [];
  let score = 100; // start perfect, deduct

  const pw = product.width_in || 0;
  const pd = product.depth_in || 0;
  const ph = product.height_in || 0;
  const rw = room.width_in || 0;
  const rd = room.depth_in || 0;
  const rh = room.height_in || (8 * IN_PER_FT); // default 8 ft ceiling
  const cat = normalizeCategory(product.category);

  // ── Universal checks ──────────────────────────────────────────────────

  // Height vs ceiling
  if (ph > 0 && ph > rh) {
    issues.push({ rule: "ceiling-height", severity: "error", message: `Product height (${ph}") exceeds ceiling (${rh}").` });
    score -= 50;
  }

  // Basic footprint
  const fitsOrientation1 = pw <= rw && pd <= rd;
  const fitsOrientation2 = pw <= rd && pd <= rw;
  if (!fitsOrientation1 && !fitsOrientation2) {
    issues.push({ rule: "footprint", severity: "error", message: `Product footprint (${pw}" x ${pd}") won't fit in room (${rw}" x ${rd}").` });
    score -= 60;
    suggestions.push({ type: "smaller-size", message: "This piece is too large for the room.", search_query: `${cat} under ${Math.min(rw, rd)} inches` });
  }

  // ── Category-specific checks ──────────────────────────────────────────

  if (cat === "sofa" || cat === "sectional" || cat === "loveseat" || cat === "couch") {
    score = checkSofaFit(product, room, pw, pd, rw, rd, issues, suggestions, score);
  } else if (cat === "dining-table" || cat === "table") {
    score = checkDiningTableFit(product, room, pw, pd, rw, rd, issues, suggestions, score);
  } else if (cat === "bed") {
    score = checkBedFit(product, room, pw, pd, rw, rd, issues, suggestions, score);
  } else if (cat === "desk") {
    score = checkDeskFit(product, room, pw, pd, rw, rd, issues, suggestions, score);
  } else if (cat === "coffee-table") {
    score = checkCoffeeTableFit(product, room, pw, pd, rw, rd, issues, suggestions, score);
  } else if (cat === "rug") {
    score = checkRugFit(product, room, pw, pd, rw, rd, issues, suggestions, score);
  }

  // ── Door / window obstructions ────────────────────────────────────────
  if (room.doors && room.doors.length > 0) {
    for (const door of room.doors) {
      const doorEnd = (door.position_in || 0) + (door.width_in || 36);
      // Warn if product is so wide it might block a door on that wall
      if (cat === "sofa" || cat === "sectional") {
        const wallLen = (door.wall === "north" || door.wall === "south") ? rw : rd;
        const remaining = wallLen - pw;
        if (remaining < doorEnd && remaining >= 0) {
          issues.push({ rule: "door-clearance", severity: "warning", message: `Sofa may block the ${door.wall} door. Remaining wall space: ${round2(remaining)}".` });
          score -= 10;
        }
      }
    }
  }

  // Clamp score
  score = Math.max(0, Math.min(100, Math.round(score)));

  let fit;
  if (score >= 80) fit = "perfect";
  else if (score >= 50) fit = "tight";
  else if (score > 0) fit = "tight";
  else fit = "wont-fit";

  if (issues.some((i) => i.severity === "error")) {
    fit = "wont-fit";
    score = Math.min(score, 25);
  }

  return { fit, score, issues, suggestions };
}

// ── Sofa fit ──────────────────────────────────────────────────────────────

function checkSofaFit(product, room, pw, pd, rw, rd, issues, suggestions, score) {
  const wallClearance = 6; // 6" each side
  const neededWall = pw + wallClearance * 2;

  // Find longest wall the sofa could go against
  const longestWall = Math.max(rw, rd);
  const perpWall = Math.min(rw, rd);

  if (neededWall > longestWall) {
    issues.push({
      rule: "sofa-wall-fit",
      severity: "error",
      message: `Sofa (${pw}") plus 6" clearance on each side needs ${neededWall}", but longest wall is ${longestWall}".`,
    });
    score -= 30;
    suggestions.push({
      type: "smaller-size",
      message: `Look for sofas under ${longestWall - wallClearance * 2}" wide.`,
      search_query: `sofa under ${longestWall - wallClearance * 2} inches`,
    });
  } else if (neededWall > longestWall - 6) {
    issues.push({
      rule: "sofa-wall-fit",
      severity: "warning",
      message: `Sofa fits along wall but leaves less than 12" total side clearance.`,
    });
    score -= 10;
  }

  // Check room depth: sofa depth + coffee table gap + table depth + walkway
  const coffeeTableGap = SPATIAL_RULES["sofa-to-coffee-table"].ideal_gap_in; // 18
  const coffeeTableDepth = 24; // assume standard
  const walkwayBehind = SPATIAL_RULES["walkway-minimum"].min_in; // 24
  const neededDepth = pd + coffeeTableGap + coffeeTableDepth + walkwayBehind;

  if (neededDepth > perpWall) {
    issues.push({
      rule: "sofa-depth-clearance",
      severity: "warning",
      message: `Sofa depth (${pd}") + coffee table zone needs ${neededDepth}" but perpendicular wall is ${perpWall}". Coffee table may need to be smaller or omitted.`,
    });
    score -= 15;
  }

  // End tables check
  const endTableWidth = 24; // typical
  if (pw + endTableWidth * 2 + wallClearance * 2 > longestWall) {
    issues.push({
      rule: "sofa-end-tables",
      severity: "info",
      message: "End tables on both sides may not fit alongside this sofa on the wall.",
    });
    score -= 5;
    suggestions.push({
      type: "rearrange",
      message: "Consider one end table or a floor lamp instead of two end tables.",
      search_query: `end table under ${Math.floor((longestWall - pw - wallClearance * 2) / 2)} inches`,
    });
  }

  // Sectional corner check
  if (normalizeCategory(product.category) === "sectional") {
    // Sectionals need two walls
    const sectionalLeg2 = product.depth_in || pd;
    if (sectionalLeg2 > perpWall) {
      issues.push({
        rule: "sectional-second-leg",
        severity: "error",
        message: `Sectional's return section (${sectionalLeg2}") is longer than the adjacent wall (${perpWall}").`,
      });
      score -= 25;
    }
  }

  return score;
}

// ── Dining table fit ──────────────────────────────────────────────────────

function checkDiningTableFit(product, room, pw, pd, rw, rd, issues, suggestions, score) {
  const chairClearance = SPATIAL_RULES["dining-chair-clearance"].ideal_in; // 36"

  // Total footprint with chairs
  const totalW = pw + chairClearance * 2;
  const totalD = pd + chairClearance * 2;

  // Try both orientations
  const fits1 = totalW <= rw && totalD <= rd;
  const fits2 = totalW <= rd && totalD <= rw;

  if (!fits1 && !fits2) {
    issues.push({
      rule: "dining-table-clearance",
      severity: "error",
      message: `Table (${pw}" x ${pd}") plus 36" chair clearance on each side needs ${totalW}" x ${totalD}", room is ${rw}" x ${rd}".`,
    });
    score -= 35;

    // Suggest smaller
    const maxTableW = Math.max(rw, rd) - chairClearance * 2;
    const maxTableD = Math.min(rw, rd) - chairClearance * 2;
    if (maxTableW > 30 && maxTableD > 30) {
      suggestions.push({
        type: "smaller-size",
        message: `Try a table no larger than ${round2(maxTableW)}" x ${round2(maxTableD)}".`,
        search_query: `dining table under ${Math.floor(maxTableW)} inches`,
      });
    }
    // Suggest round
    suggestions.push({
      type: "different-shape",
      message: "A round table may use space more efficiently.",
      search_query: `round dining table under ${Math.floor(Math.max(rw, rd) - chairClearance * 2)} inches`,
    });
  } else if (fits1 || fits2) {
    // Check tight vs perfect
    const bestW = fits1 ? rw - totalW : rd - totalW;
    const bestD = fits1 ? rd - totalD : rw - totalD;
    const margin = Math.min(bestW, bestD);
    if (margin < 12) {
      issues.push({
        rule: "dining-table-tight",
        severity: "warning",
        message: `Table fits but leaves only ${round2(margin)}" margin. Seating will feel cramped.`,
      });
      score -= 10;
    }
  }

  return score;
}

// ── Bed fit ──────────────────────────────────────────────────────────────

function checkBedFit(product, room, pw, pd, rw, rd, issues, suggestions, score) {
  // Determine bed size
  let bedSize = "queen";
  if (pw >= 72) bedSize = "king";
  else if (pw >= 60) bedSize = "queen";
  else if (pw >= 54) bedSize = "full";
  else if (pw >= 38) bedSize = "twin";

  const mins = SPATIAL_RULES["bed-room-minimums"][bedSize];
  const minRoomW = mins.min_width_ft * IN_PER_FT;
  const minRoomD = mins.min_depth_ft * IN_PER_FT;

  const roomFitsStd = rw >= minRoomW && rd >= minRoomD;
  const roomFitsRot = rd >= minRoomW && rw >= minRoomD;

  if (!roomFitsStd && !roomFitsRot) {
    issues.push({
      rule: "bed-room-minimum",
      severity: "error",
      message: `A ${bedSize} bed needs at least ${mins.min_width_ft}' x ${mins.min_depth_ft}' room. Room is ${round2(rw / IN_PER_FT)}' x ${round2(rd / IN_PER_FT)}'.`,
    });
    score -= 40;
    // Suggest smaller bed
    const sizes = ["king", "queen", "full", "twin"];
    const idx = sizes.indexOf(bedSize);
    if (idx < sizes.length - 1) {
      const smaller = sizes[idx + 1];
      suggestions.push({
        type: "smaller-size",
        message: `Consider a ${smaller} bed for this room.`,
        search_query: `${smaller} bed`,
      });
    }
  }

  // Nightstand clearance: 18-24" on each side of bed
  const nightstandMin = SPATIAL_RULES["nightstand-width"].min_in;
  const bestRoomW = roomFitsStd ? rw : rd;
  const sideSpace = (bestRoomW - pw) / 2;

  if (sideSpace < nightstandMin) {
    issues.push({
      rule: "nightstand-clearance",
      severity: "warning",
      message: `Only ${round2(sideSpace)}" on each side of the bed. Standard nightstands (18"+) won't fit on both sides.`,
    });
    score -= 10;
    if (sideSpace >= 12) {
      suggestions.push({
        type: "smaller-size",
        message: `Look for narrow nightstands under ${Math.floor(sideSpace)}" wide.`,
        search_query: `nightstand under ${Math.floor(sideSpace)} inches wide`,
      });
    }
  }

  // Foot of bed clearance (36")
  const bestRoomD = roomFitsStd ? rd : rw;
  const footClearance = bestRoomD - pd;
  if (footClearance < 36) {
    issues.push({
      rule: "bed-foot-clearance",
      severity: footClearance < 24 ? "error" : "warning",
      message: `Only ${round2(footClearance)}" at the foot of the bed. Need at least 36" for a dresser or walkway.`,
    });
    score -= footClearance < 24 ? 20 : 10;
  }

  // Dresser space
  if (footClearance < 54) {
    issues.push({
      rule: "bed-dresser",
      severity: "info",
      message: 'A standard dresser (18-20" deep) at the foot may not fit comfortably. Consider a wall-mounted option or closet storage.',
    });
    score -= 5;
  }

  return score;
}

// ── Desk fit ──────────────────────────────────────────────────────────────

function checkDeskFit(product, room, pw, pd, rw, rd, issues, suggestions, score) {
  const chairSpace = 30; // behind desk
  const walkway = SPATIAL_RULES["walkway-minimum"].min_in; // 24

  const totalDepth = pd + chairSpace + walkway;
  const fitsAlongWidth = pw <= rw && totalDepth <= rd;
  const fitsAlongDepth = pw <= rd && totalDepth <= rw;

  if (!fitsAlongWidth && !fitsAlongDepth) {
    issues.push({
      rule: "desk-clearance",
      severity: "error",
      message: `Desk (${pw}" wide, ${pd}" deep) plus 30" chair + 24" walkway needs ${totalDepth}" depth. Room doesn't accommodate.`,
    });
    score -= 30;
    suggestions.push({
      type: "smaller-size",
      message: `Look for a desk under ${Math.floor(Math.max(rw, rd) - chairSpace - walkway)}" deep.`,
      search_query: `desk under ${Math.floor(Math.min(rw, rd))} inches wide`,
    });
  }

  // Window proximity bonus (info only)
  if (room.windows && room.windows.length > 0) {
    issues.push({
      rule: "desk-window",
      severity: "info",
      message: "Place the desk perpendicular to the window to avoid screen glare while getting natural light.",
    });
  }

  return score;
}

// ── Coffee table fit ─────────────────────────────────────────────────────

function checkCoffeeTableFit(product, room, pw, pd, rw, rd, issues, suggestions, score) {
  // Check proportional to sofa if sofa exists in the room
  const existingSofa = (room.existing_pieces || []).find(
    (p) => normalizeCategory(p.category) === "sofa" || normalizeCategory(p.category) === "sectional"
  );

  if (existingSofa) {
    const sofaW = existingSofa.width_in || 0;
    const ratioRule = SPATIAL_RULES["coffee-table-to-sofa-ratio"];
    const ratio = pw / sofaW;

    if (ratio < ratioRule.min_ratio) {
      issues.push({
        rule: "coffee-table-proportion",
        severity: "warning",
        message: `Coffee table (${pw}") is only ${Math.round(ratio * 100)}% of sofa width (${sofaW}"). Ideally 50-75%.`,
      });
      score -= 10;
      const idealW = Math.round(sofaW * ratioRule.ideal_ratio);
      suggestions.push({
        type: "different-shape",
        message: `Look for a coffee table around ${idealW}" wide.`,
        search_query: `coffee table ${idealW} inches`,
      });
    } else if (ratio > ratioRule.max_ratio) {
      issues.push({
        rule: "coffee-table-proportion",
        severity: "warning",
        message: `Coffee table (${pw}") is ${Math.round(ratio * 100)}% of sofa width (${sofaW}"). May look oversized. Ideal is 50-75%.`,
      });
      score -= 10;
    }
  }

  // General room fit — coffee table shouldn't block walkways
  const gapRule = SPATIAL_RULES["sofa-to-coffee-table"];
  const minPerp = Math.min(rw, rd);
  const tableZone = pd + gapRule.ideal_gap_in * 2; // gap on both sofa and opposite side
  if (tableZone > minPerp * 0.6) {
    issues.push({
      rule: "coffee-table-walkway",
      severity: "info",
      message: "Coffee table may restrict walkways in the room.",
    });
    score -= 5;
  }

  return score;
}

// ── Rug fit ──────────────────────────────────────────────────────────────

function checkRugFit(product, room, pw, pd, rw, rd, issues, suggestions, score) {
  const roomArea = rw * rd;
  const rugArea = pw * pd;
  const coverage = rugArea / roomArea;

  if (coverage < 0.4) {
    issues.push({
      rule: "rug-coverage",
      severity: "warning",
      message: `Rug covers only ${Math.round(coverage * 100)}% of floor area. For a living room, aim for at least 50-60%.`,
    });
    score -= 15;
    suggestions.push({
      type: "smaller-size",
      message: `Consider a larger rug, at least ${Math.ceil(rw * 0.7)}" x ${Math.ceil(rd * 0.6)}".`,
      search_query: `area rug ${Math.ceil(rw * 0.7 / IN_PER_FT)}x${Math.ceil(rd * 0.6 / IN_PER_FT)} feet`,
    });
  }

  // Check rug under dining table extends 24" beyond
  const existingTable = (room.existing_pieces || []).find(
    (p) => normalizeCategory(p.category) === "dining-table" || normalizeCategory(p.category) === "table"
  );
  if (existingTable) {
    const tw = existingTable.width_in || 0;
    const td = existingTable.depth_in || 0;
    const ext = SPATIAL_RULES["rug-dining-extension"].min_in;
    const neededW = tw + ext * 2;
    const neededD = td + ext * 2;

    if (pw < neededW || pd < neededD) {
      issues.push({
        rule: "rug-dining-extension",
        severity: "warning",
        message: `Rug should extend 24" beyond table on all sides. Need ${neededW}" x ${neededD}", rug is ${pw}" x ${pd}".`,
      });
      score -= 10;
    }
  }

  return score;
}

// ---------------------------------------------------------------------------
// checkArrangement
// ---------------------------------------------------------------------------

/**
 * Validate a complete furniture arrangement.
 *
 * @param {Array<{product: object, position: {x: number, y: number, rotation: number}}>} pieces
 * @param {object} room
 * @returns {{ score: number, issues: Array<{severity:string,rule:string,message:string}> }}
 */
export function checkArrangement(pieces, room) {
  const issues = [];
  let score = 100;

  if (!pieces || pieces.length === 0) {
    return { score: 100, issues: [] };
  }

  const rw = room.width_in || 0;
  const rd = room.depth_in || 0;

  // Build placed rectangles
  const rects = pieces.map((p) => {
    const w = p.product.width_in || 0;
    const d = p.product.depth_in || 0;
    const rot = (p.position.rotation || 0) % 360;
    const isRotated = rot === 90 || rot === 270;
    const pw = isRotated ? d : w;
    const pd = isRotated ? w : d;
    return {
      id: p.product.id || p.product.name,
      category: normalizeCategory(p.product.category),
      x: p.position.x,
      y: p.position.y,
      w: pw,
      d: pd,
      right: p.position.x + pw,
      bottom: p.position.y + pd,
    };
  });

  // Check each piece is within room bounds
  for (const r of rects) {
    if (r.right > rw || r.bottom > rd || r.x < 0 || r.y < 0) {
      issues.push({
        rule: "out-of-bounds",
        severity: "error",
        message: `"${r.id}" extends outside the room.`,
      });
      score -= 20;
    }
  }

  // Check overlaps
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      if (rectsOverlap(rects[i], rects[j])) {
        issues.push({
          rule: "overlap",
          severity: "error",
          message: `"${rects[i].id}" overlaps with "${rects[j].id}".`,
        });
        score -= 25;
      }
    }
  }

  // Check walkway gaps between pieces and walls
  const walkwayMin = SPATIAL_RULES["walkway-minimum"].tight_in;
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const gap = minGap(rects[i], rects[j]);
      if (gap > 0 && gap < walkwayMin) {
        issues.push({
          rule: "walkway",
          severity: "warning",
          message: `Gap between "${rects[i].id}" and "${rects[j].id}" is ${round2(gap)}" — below ${walkwayMin}" minimum walkway.`,
        });
        score -= 8;
      }
    }
  }

  // Check conversation distance between seating
  const seatingCats = new Set(["sofa", "sectional", "loveseat", "couch", "chair", "accent-chair", "armchair"]);
  const seats = rects.filter((r) => seatingCats.has(r.category));
  const convMax = SPATIAL_RULES["conversation-distance"].max_ft * IN_PER_FT;
  for (let i = 0; i < seats.length; i++) {
    for (let j = i + 1; j < seats.length; j++) {
      const dist = centerDistance(seats[i], seats[j]);
      if (dist > convMax) {
        issues.push({
          rule: "conversation-distance",
          severity: "warning",
          message: `"${seats[i].id}" and "${seats[j].id}" are ${round2(dist / IN_PER_FT)}' apart — beyond ${SPATIAL_RULES["conversation-distance"].max_ft}' conversation range.`,
        });
        score -= 5;
      }
    }
  }

  // Check door clearance
  if (room.doors) {
    for (const door of room.doors) {
      const doorRect = doorSwingRect(door, rw, rd);
      for (const r of rects) {
        if (rectsOverlap(r, doorRect)) {
          issues.push({
            rule: "door-swing",
            severity: "error",
            message: `"${r.id}" blocks the ${door.wall} door swing area.`,
          });
          score -= 15;
        }
      }
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, issues };
}

// ---------------------------------------------------------------------------
// calculateFitScore  (fast, per-product in search results)
// ---------------------------------------------------------------------------

/**
 * Quick fit score for a product given room dimensions.
 *
 * @param {{ width_in: number, depth_in: number, height_in: number }} productDims
 * @param {{ width_in: number, depth_in: number, height_in?: number }} roomDims
 * @param {string} category
 * @returns {{ score: number, fit: string, reason: string }}
 */
export function calculateFitScore(productDims, roomDims, category) {
  if (!productDims || !roomDims) {
    return { score: 0, fit: "unknown", reason: "Missing dimensions." };
  }

  const pw = productDims.width_in || 0;
  const pd = productDims.depth_in || 0;
  const rw = roomDims.width_in || 0;
  const rd = roomDims.depth_in || 0;
  const cat = normalizeCategory(category);

  // Basic footprint check
  const fitsO1 = pw <= rw && pd <= rd;
  const fitsO2 = pw <= rd && pd <= rw;
  if (!fitsO1 && !fitsO2) {
    return { score: 0, fit: "wont-fit", reason: `Too large for the room (${pw}" x ${pd}" vs ${rw}" x ${rd}").` };
  }

  let score = 70; // baseline: it fits
  let reason = "Fits in the room.";

  // Category-specific bonuses / penalties
  if (cat === "sofa" || cat === "sectional" || cat === "loveseat" || cat === "couch") {
    const wallClearance = 6;
    const longestWall = Math.max(rw, rd);
    if (pw + wallClearance * 2 <= longestWall) {
      score += 15;
      reason = "Fits along the wall with clearance.";
    } else {
      score -= 10;
      reason = "Tight fit along the wall.";
    }
    const perpWall = Math.min(rw, rd);
    const depthNeeded = pd + 18 + 24 + 24; // sofa depth + gap + coffee table + walkway
    if (depthNeeded <= perpWall) {
      score += 15;
    } else {
      score -= 10;
      reason += " Room depth may be tight with a coffee table.";
    }
  } else if (cat === "dining-table" || cat === "table") {
    const clearance = 36;
    const totalW = pw + clearance * 2;
    const totalD = pd + clearance * 2;
    if ((totalW <= rw && totalD <= rd) || (totalW <= rd && totalD <= rw)) {
      score += 20;
      reason = "Fits with full chair clearance.";
    } else {
      score -= 15;
      reason = "Chair clearance will be tight.";
    }
  } else if (cat === "bed") {
    let bedSize = "queen";
    if (pw >= 72) bedSize = "king";
    else if (pw >= 60) bedSize = "queen";
    else if (pw >= 54) bedSize = "full";
    else bedSize = "twin";

    const mins = SPATIAL_RULES["bed-room-minimums"][bedSize];
    const minW = mins.min_width_ft * IN_PER_FT;
    const minD = mins.min_depth_ft * IN_PER_FT;
    const fits = (rw >= minW && rd >= minD) || (rd >= minW && rw >= minD);
    if (fits) {
      score += 20;
      reason = `Room meets minimum size for a ${bedSize} bed.`;
    } else {
      score -= 20;
      reason = `Room is below the recommended minimum for a ${bedSize} bed.`;
    }
  } else if (cat === "coffee-table") {
    const longerRoom = Math.max(rw, rd);
    if (pw < longerRoom * 0.5) {
      score += 15;
      reason = "Good proportional size for the room.";
    }
  } else if (cat === "rug") {
    const rugArea = pw * pd;
    const roomArea = rw * rd;
    const coverage = rugArea / roomArea;
    if (coverage >= 0.5 && coverage <= 0.85) {
      score += 20;
      reason = `Good coverage (${Math.round(coverage * 100)}%).`;
    } else if (coverage < 0.4) {
      score -= 10;
      reason = `Rug may be too small (${Math.round(coverage * 100)}% coverage).`;
    }
  } else if (cat === "desk") {
    const depthNeeded = pd + 30 + 24; // desk + chair + walkway
    const shorter = Math.min(rw, rd);
    if (depthNeeded <= shorter) {
      score += 20;
      reason = "Fits with chair space and walkway.";
    } else {
      score -= 10;
      reason = "Tight with chair and walkway.";
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  let fit;
  if (score >= 80) fit = "perfect";
  else if (score >= 50) fit = "tight";
  else fit = "wont-fit";

  return { score, fit, reason };
}

// ---------------------------------------------------------------------------
// checkDeliveryFeasibility
// ---------------------------------------------------------------------------

/**
 * Check whether a product can be delivered through standard entry points.
 *
 * @param {{ width_in: number, depth_in: number, height_in: number, diagonal_in?: number }} productDims
 * @param {object} deliveryConstraints
 * @returns {{ status: string, icon_color: string, diagonal_in: number, issues: string[], tips: string[] }}
 */
export function checkDeliveryFeasibility(productDims, deliveryConstraints = {}) {
  const defaults = {
    doorway_width_in: 34,
    doorway_height_in: 80,
    elevator_width_in: 54,
    elevator_depth_in: 80,
    stairway_turn_in: 38,
    has_elevator: false,
  };
  const c = { ...defaults, ...deliveryConstraints };

  const pw = productDims.width_in || 0;
  const pd = productDims.depth_in || 0;
  const ph = productDims.height_in || 0;
  const diagonal = productDims.diagonal_in || Math.sqrt(pw * pw + pd * pd);

  const issues = [];
  const tips = [];
  let status = "standard";

  const dims = [pw, pd, ph].sort((a, b) => a - b);
  const smallest = dims[0];
  const mid = dims[1];
  const largest = dims[2];

  // Doorway check: product must fit through on its side/end
  const fitsFlat = smallest <= c.doorway_width_in && mid <= c.doorway_height_in;
  const fitsTilted = smallest <= c.doorway_width_in;
  const diagonalFit = Math.sqrt(smallest * smallest + mid * mid) <= Math.sqrt(c.doorway_width_in * c.doorway_width_in + c.doorway_height_in * c.doorway_height_in);

  if (!fitsFlat) {
    if (fitsTilted || diagonalFit) {
      issues.push(`Tight doorway fit: may need to tilt or angle through ${c.doorway_width_in}" doorway.`);
      tips.push("Measure your doorway. Delivery team may need to tilt the piece at an angle.");
      status = "verify";
    } else {
      issues.push(`Product dimensions (${smallest}" x ${mid}") may not fit through ${c.doorway_width_in}" x ${c.doorway_height_in}" doorway.`);
      tips.push("Check if the product has removable legs or detachable components.");
      tips.push("Consider window delivery or disassembly/reassembly service.");
      status = "special-planning";
    }
  }

  // Height clearance
  if (largest > c.doorway_height_in && mid > c.doorway_width_in) {
    issues.push(`Longest dimension (${largest}") exceeds doorway height. Must be carried horizontally.`);
    if (mid > c.doorway_width_in) {
      status = "special-planning";
    }
  }

  // Elevator check (if applicable and no elevator)
  if (!c.has_elevator) {
    // Stairway turn check
    if (largest > c.stairway_turn_in * 2.5) {
      issues.push(`At ${largest}" long, stairway turns (${c.stairway_turn_in}" wide) may be difficult.`);
      tips.push("Confirm stairway width and landing dimensions with your building.");
      if (status === "standard") status = "verify";
    }
  } else {
    // Elevator size check
    const fitsElevator =
      (smallest <= c.elevator_width_in && mid <= c.elevator_depth_in) ||
      (smallest <= c.elevator_depth_in && mid <= c.elevator_width_in);
    if (!fitsElevator) {
      issues.push(`Product may not fit in elevator (${c.elevator_width_in}" x ${c.elevator_depth_in}").`);
      tips.push("Check if a freight elevator is available.");
      if (status === "standard") status = "verify";
    }
  }

  // General tips based on product type
  if (ph > 36) {
    tips.push("Order with removable legs if available to reduce height for delivery.");
  }
  if (pw > 80 || pd > 80) {
    tips.push("Order with removable legs and back cushions to reduce overall dimensions.");
  }
  if (diagonal > 60) {
    tips.push(`Diagonal measurement is ${round2(diagonal)}". Confirm hallway clearance.`);
  }

  const icon_color = status === "standard" ? "green" : status === "verify" ? "yellow" : "red";

  return {
    status,
    icon_color,
    diagonal_in: round2(diagonal),
    issues,
    tips,
  };
}

// ---------------------------------------------------------------------------
// suggestProportions
// ---------------------------------------------------------------------------

/**
 * Suggest proportionally correct companion piece dimensions.
 *
 * @param {{ width_in: number, depth_in: number, height_in: number, category?: string }} mainPiece
 * @param {string} companionCategory  e.g. "coffee-table", "end-table", "rug"
 * @param {object} [room]             Optional room for additional constraints.
 * @returns {{ ideal_width_range: [number, number], ideal_depth_range: [number, number],
 *             ideal_height_range?: [number, number], search_query: string }}
 */
export function suggestProportions(mainPiece, companionCategory, room) {
  const mw = mainPiece.width_in || 0;
  const md = mainPiece.depth_in || 0;
  const mh = mainPiece.height_in || 0;
  const comp = normalizeCategory(companionCategory);

  let wRange = [0, 0];
  let dRange = [0, 0];
  let hRange = undefined;
  let query = "";

  if (comp === "coffee-table") {
    const rule = SPATIAL_RULES["coffee-table-to-sofa-ratio"];
    wRange = [Math.round(mw * rule.min_ratio), Math.round(mw * rule.max_ratio)];
    dRange = [Math.round(wRange[0] * 0.4), Math.round(wRange[1] * 0.5)];
    // Coffee table height should be within 1-2" of sofa seat height, or 16-18" standard
    const seatH = mainPiece.seat_height_in || 18;
    hRange = [seatH - 2, seatH + 1];
    query = `coffee table ${wRange[0]} to ${wRange[1]} inches`;
  } else if (comp === "end-table" || comp === "side-table") {
    wRange = [18, 28];
    dRange = [18, 28];
    // End table height should be within 2" of sofa arm height
    const armH = mainPiece.arm_height_in || 25;
    hRange = [armH - 2, armH + 2];
    query = `end table ${hRange[0]} to ${hRange[1]} inches tall`;
  } else if (comp === "rug") {
    // Rug should extend 18-24" beyond furniture on each side
    const ext = 24;
    wRange = [mw + ext * 2, mw + ext * 2 + 24];
    dRange = [md + 36, md + 60]; // extend in front for coffee table area
    if (room) {
      // Constrain to room size minus 12" border
      wRange[1] = Math.min(wRange[1], (room.width_in || 9999) - 12);
      dRange[1] = Math.min(dRange[1], (room.depth_in || 9999) - 12);
    }
    const wFt = Math.ceil(wRange[0] / IN_PER_FT);
    const dFt = Math.ceil(dRange[0] / IN_PER_FT);
    query = `area rug ${wFt}x${dFt} feet`;
  } else if (comp === "nightstand") {
    wRange = [SPATIAL_RULES["nightstand-width"].min_in, SPATIAL_RULES["nightstand-width"].max_in];
    dRange = [16, 22];
    // Height should match bed / mattress top
    const bedH = mh || 25;
    hRange = [bedH - 2, bedH + 2];
    query = `nightstand ${wRange[0]} to ${wRange[1]} inches`;
  } else if (comp === "dining-chair") {
    // Chair seat should be 10-12" below table top
    const tableH = mh || 30;
    const seatH = tableH - 12;
    hRange = [seatH - 1, seatH + 1];
    wRange = [17, 22]; // standard dining chair width
    dRange = [18, 22];
    query = `dining chair ${hRange[0]} inch seat height`;
  } else if (comp === "bench") {
    // Bench at foot of bed: narrower than bed, about 18" deep
    wRange = [Math.round(mw * 0.6), Math.round(mw * 0.85)];
    dRange = [14, 20];
    hRange = [17, 22];
    query = `bench ${wRange[0]} to ${wRange[1]} inches wide`;
  } else if (comp === "bookshelf" || comp === "bookcase") {
    wRange = [24, 48];
    dRange = [10, 16];
    if (room) {
      hRange = [60, Math.min(84, (room.height_in || 96) - 6)];
    } else {
      hRange = [60, 84];
    }
    query = `bookshelf ${wRange[0]} to ${wRange[1]} inches wide`;
  } else if (comp === "console-table" || comp === "media-console") {
    // Console/media table proportional to sofa or TV
    wRange = [Math.round(mw * 0.5), Math.round(mw * 0.75)];
    dRange = [14, SPATIAL_RULES["console-table-max-depth"].standard_max_in];
    hRange = [24, 34];
    query = `console table ${wRange[0]} to ${wRange[1]} inches`;
  } else {
    // Generic companion
    wRange = [Math.round(mw * 0.3), Math.round(mw * 0.7)];
    dRange = [Math.round(md * 0.3), Math.round(md * 0.7)];
    query = `${companionCategory} ${wRange[0]} to ${wRange[1]} inches`;
  }

  const result = {
    ideal_width_range: wRange,
    ideal_depth_range: dRange,
    search_query: query,
  };
  if (hRange) result.ideal_height_range = hRange;
  return result;
}

// ---------------------------------------------------------------------------
// recommendRoomSize
// ---------------------------------------------------------------------------

/**
 * Given a set of furniture pieces, compute the minimum room size needed.
 *
 * @param {Array<{ width_in: number, depth_in: number, height_in?: number, category?: string }>} pieces
 * @returns {{ min_width_ft: number, min_depth_ft: number,
 *             recommended_width_ft: number, recommended_depth_ft: number,
 *             total_sqft: number }}
 */
export function recommendRoomSize(pieces) {
  if (!pieces || pieces.length === 0) {
    return { min_width_ft: 0, min_depth_ft: 0, recommended_width_ft: 0, recommended_depth_ft: 0, total_sqft: 0 };
  }

  // Compute total furniture footprint
  let totalArea = 0;
  let maxW = 0;
  let maxD = 0;

  for (const p of pieces) {
    const pw = p.width_in || 0;
    const pd = p.depth_in || 0;
    totalArea += pw * pd;
    maxW = Math.max(maxW, pw);
    maxD = Math.max(maxD, pd);
  }

  // Walkway and clearance multiplier
  const walkway = SPATIAL_RULES["walkway-minimum"].ideal_in; // 30"
  const chairClearance = SPATIAL_RULES["dining-chair-clearance"].ideal_in; // 36"

  // Determine if there's a dining table
  const hasDining = pieces.some((p) => {
    const c = normalizeCategory(p.category);
    return c === "dining-table" || c === "table";
  });

  // Determine if there's a bed
  const bed = pieces.find((p) => normalizeCategory(p.category) === "bed");

  let minWidthIn, minDepthIn;

  if (bed) {
    // Bedroom sizing
    const bedW = bed.width_in || 60;
    const bedD = bed.depth_in || 80;
    // Nightstands + walkway on each side
    minWidthIn = bedW + 24 * 2 + walkway; // bed + 2 nightstands + walkway
    minDepthIn = bedD + 36 + 20; // bed + foot clearance + dresser depth
  } else if (hasDining) {
    const table = pieces.find((p) => {
      const c = normalizeCategory(p.category);
      return c === "dining-table" || c === "table";
    });
    const tw = table.width_in || 60;
    const td = table.depth_in || 36;
    minWidthIn = tw + chairClearance * 2 + walkway;
    minDepthIn = td + chairClearance * 2 + walkway;
  } else {
    // Living room / general: largest piece against wall + depth clearance
    const sofa = pieces.find((p) => {
      const c = normalizeCategory(p.category);
      return c === "sofa" || c === "sectional";
    });
    if (sofa) {
      minWidthIn = (sofa.width_in || 0) + 12; // 6" each side
      minDepthIn = (sofa.depth_in || 0) + 18 + 24 + walkway; // sofa + gap + coffee table + walkway
    } else {
      minWidthIn = maxW + walkway * 2;
      minDepthIn = maxD + walkway * 2;
    }
  }

  // Ensure minimum room is large enough that total furniture area is < 35% of floor area
  const minAreaNeeded = totalArea / 0.35;
  const currentArea = minWidthIn * minDepthIn;
  if (currentArea < minAreaNeeded) {
    const scale = Math.sqrt(minAreaNeeded / currentArea);
    minWidthIn *= scale;
    minDepthIn *= scale;
  }

  // Recommended adds 20% buffer
  const recWidthIn = minWidthIn * 1.2;
  const recDepthIn = minDepthIn * 1.2;

  return {
    min_width_ft: round2(minWidthIn / IN_PER_FT),
    min_depth_ft: round2(minDepthIn / IN_PER_FT),
    recommended_width_ft: round2(recWidthIn / IN_PER_FT),
    recommended_depth_ft: round2(recDepthIn / IN_PER_FT),
    total_sqft: round2((recWidthIn * recDepthIn) / (IN_PER_FT * IN_PER_FT)),
  };
}

// ---------------------------------------------------------------------------
// getSpatialRules
// ---------------------------------------------------------------------------

/**
 * Return the full spatial rules knowledge base.
 * @returns {typeof SPATIAL_RULES}
 */
export function getSpatialRules() {
  return SPATIAL_RULES;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Normalize a free-text category string to a canonical slug.
 */
function normalizeCategory(cat) {
  if (!cat) return "unknown";
  const s = cat.toLowerCase().trim().replace(/\s+/g, "-");

  const aliases = {
    couch: "sofa",
    sofas: "sofa",
    couches: "sofa",
    "sectional-sofa": "sectional",
    "sectional-sofas": "sectional",
    sectionals: "sectional",
    loveseat: "loveseat",
    loveseats: "loveseat",
    "love-seat": "loveseat",
    bed: "bed",
    beds: "bed",
    "platform-bed": "bed",
    "dining-table": "dining-table",
    "dining-tables": "dining-table",
    "kitchen-table": "dining-table",
    table: "table",
    tables: "table",
    desk: "desk",
    desks: "desk",
    "writing-desk": "desk",
    "office-desk": "desk",
    "coffee-table": "coffee-table",
    "coffee-tables": "coffee-table",
    "cocktail-table": "coffee-table",
    "end-table": "end-table",
    "end-tables": "end-table",
    "side-table": "end-table",
    "side-tables": "end-table",
    "accent-table": "end-table",
    nightstand: "nightstand",
    nightstands: "nightstand",
    "night-stand": "nightstand",
    "bedside-table": "nightstand",
    rug: "rug",
    rugs: "rug",
    "area-rug": "rug",
    "area-rugs": "rug",
    chair: "chair",
    chairs: "chair",
    "accent-chair": "accent-chair",
    "accent-chairs": "accent-chair",
    armchair: "accent-chair",
    armchairs: "accent-chair",
    "dining-chair": "dining-chair",
    "dining-chairs": "dining-chair",
    bookshelf: "bookshelf",
    bookshelves: "bookshelf",
    bookcase: "bookshelf",
    bookcases: "bookshelf",
    "console-table": "console-table",
    "console-tables": "console-table",
    "media-console": "console-table",
    "tv-stand": "console-table",
    dresser: "dresser",
    dressers: "dresser",
    chest: "dresser",
    "chest-of-drawers": "dresser",
    bench: "bench",
    benches: "bench",
    ottoman: "ottoman",
    ottomans: "ottoman",
    lamp: "lamp",
    "floor-lamp": "lamp",
    "table-lamp": "lamp",
  };

  return aliases[s] || s;
}

/**
 * Check whether two axis-aligned rectangles overlap.
 */
function rectsOverlap(a, b) {
  return a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
}

/**
 * Compute the minimum gap between two non-overlapping rectangles.
 * Returns 0 if they overlap.
 */
function minGap(a, b) {
  const dx = Math.max(0, Math.max(a.x - b.right, b.x - a.right));
  const dy = Math.max(0, Math.max(a.y - b.bottom, b.y - a.bottom));
  if (dx === 0 && dy === 0) return 0; // overlapping or touching
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Distance between centers of two rectangles.
 */
function centerDistance(a, b) {
  const acx = a.x + a.w / 2;
  const acy = a.y + a.d / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.d / 2;
  return Math.sqrt((acx - bcx) ** 2 + (acy - bcy) ** 2);
}

/**
 * Build a rectangle representing the door swing area.
 */
function doorSwingRect(door, roomW, roomD) {
  const dw = door.width_in || 36;
  const pos = door.position_in || 0;
  const swing = dw; // door swings its own width

  switch (door.wall) {
    case "north":
      return { x: pos, y: 0, w: dw, d: swing, right: pos + dw, bottom: swing };
    case "south":
      return { x: pos, y: roomD - swing, w: dw, d: swing, right: pos + dw, bottom: roomD };
    case "east":
      return { x: roomW - swing, y: pos, w: swing, d: dw, right: roomW, bottom: pos + dw };
    case "west":
      return { x: 0, y: pos, w: swing, d: dw, right: swing, bottom: pos + dw };
    default:
      return { x: 0, y: 0, w: 0, d: 0, right: 0, bottom: 0 };
  }
}
