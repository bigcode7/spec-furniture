import { normalizeText } from "./normalize.mjs";

const CATEGORY_RULES = [
  { value: "swivel chair", patterns: ["swivel chair", "swivel chairs", "swivel"] },
  { value: "office chair", patterns: ["office chair", "desk chair", "task chair", "executive chair"] },
  { value: "chair", patterns: ["accent chair", "lounge chair", "chair", "chairs"] },
  { value: "dining chair", patterns: ["dining chair", "dining chairs", "side chair", "side chairs", "arm chair", "arm chairs"] },
  { value: "bar stool", patterns: ["bar stool", "bar stools", "counter stool", "counter stools", "stool", "stools"] },
  { value: "bench", patterns: ["bench", "benches", "banquette"] },
  { value: "ottoman", patterns: ["ottoman", "ottomans", "pouf", "poufs"] },
  { value: "sectional sofa", patterns: ["sectional", "sectional sofa", "sectional sofas"] },
  { value: "outdoor sofa", patterns: ["outdoor sofa", "patio sofa", "outdoor sectional", "patio sectional"] },
  { value: "sofa", patterns: ["sofa", "sofas", "couch", "couches"] },
  { value: "console table", patterns: ["console", "console table", "console tables", "entry table", "entry tables"] },
  { value: "coffee table", patterns: ["coffee table", "cocktail table", "coffee tables"] },
  { value: "dining table", patterns: ["dining table", "dining tables"] },
  { value: "side table", patterns: ["side table", "side tables", "end table", "end tables", "drink table", "drink tables"] },
  { value: "nightstand", patterns: ["nightstand", "nightstands", "bedside table", "bedside tables"] },
  { value: "credenza", patterns: ["credenza", "credenzas", "sideboard", "sideboards", "buffet", "buffets"] },
  { value: "desk", patterns: ["desk", "desks", "writing desk", "executive desk"] },
  { value: "media console", patterns: ["media console", "tv stand", "tv console", "entertainment console"] },
  { value: "bed", patterns: ["bed", "beds"] },
  { value: "dresser", patterns: ["dresser", "dressers", "chest", "chests"] },
  { value: "bookcase", patterns: ["bookcase", "bookcases", "etagere", "shelving", "shelving unit"] },
  { value: "mirror", patterns: ["mirror", "mirrors"] },
  { value: "rug", patterns: ["rug", "rugs", "area rug", "area rugs"] },
  { value: "lighting", patterns: ["lamp", "lamps", "pendant", "pendants", "sconce", "sconces", "lighting", "chandelier"] },
];

const STYLE_RULES = [
  "modern",
  "contemporary",
  "transitional",
  "coastal",
  "glam",
  "mid century modern",
  "mid-century modern",
  "luxury",
  "luxury modern",
  "japandi",
  "traditional",
  "minimalist",
];

const MATERIAL_RULES = [
  "performance fabric",
  "boucle",
  "velvet",
  "leather",
  "linen",
  "marble",
  "wood",
  "oak",
  "walnut",
  "travertine",
  "rattan",
];

const COLOR_RULES = [
  "ivory",
  "taupe",
  "cream",
  "stone",
  "oatmeal",
  "moss",
  "sand",
  "mist",
  "emerald",
  "camel",
  "blush",
  "cognac",
  "espresso",
  "bone",
  "charcoal",
  "cloud",
  "slate",
  "sage",
  "graphite",
  "truffle",
  "smoke",
  "blue",
  "green",
  "gray",
  "grey",
  "brown",
  "black",
  "white",
  "neutral",
];

const VENDOR_RULES = [
  "hooker",
  "bernhardt",
  "four hands",
  "universal",
  "theodore alexander",
  "caracole",
  "century",
  "baker",
  "vanguard",
  "lexington",
  "bassett",
  "stickley",
];

export function buildSearchIntent(query) {
  const normalized = normalizeText(query);

  const productType = detectCategory(normalized);
  const style = detectFirst(normalized, STYLE_RULES);
  const material = detectFirst(normalized, MATERIAL_RULES);
  const color = detectFirst(normalized, COLOR_RULES);
  const vendor = detectFirst(normalized, VENDOR_RULES);
  const maxPrice = detectMaxPrice(query);
  const maxLeadTimeWeeks = detectLeadTime(normalized);

  const sustainable = normalized.includes("sustainable") || normalized.includes("eco friendly") || normalized.includes("eco-friendly");
  const ergonomic = normalized.includes("ergonomic") || normalized.includes("bad back") || normalized.includes("supportive");

  return {
    summary: buildSummary({ productType, style, material, color, maxPrice, vendor, sustainable, ergonomic }),
    product_type: productType,
    style,
    material,
    color,
    vendor,
    max_price: maxPrice,
    max_lead_time_weeks: maxLeadTimeWeeks,
    sustainable,
    ergonomic,
  };
}

export function buildQueryVariants(query, intent) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return [];

  const variants = [trimmed];
  const category = intent?.product_type || "furniture";
  const style = intent?.style;
  const material = intent?.material;
  const color = intent?.color;
  const vendor = intent?.vendor;
  const categorySynonyms = getCategorySynonyms(category);

  variants.push(category);

  for (const synonym of categorySynonyms.slice(0, 3)) {
    variants.push([style, material, color, synonym].filter(Boolean).join(" "));
    variants.push([material, synonym].filter(Boolean).join(" "));
  }

  if (vendor) {
    variants.push(`${vendor} ${category}`);
    variants.push(`${vendor} ${material || style || ""} ${category}`.trim());
  }

  if (style || material || color) {
    variants.push([style, color, material, category].filter(Boolean).join(" "));
  }

  if (!intent?.product_type) {
    variants.push(...buildContextualFallbacks(trimmed));
  }

  variants.push(buildBroadCategoryFallback(category));

  return Array.from(new Set(variants.map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean))).slice(0, 6);
}

function detectCategory(normalized) {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(normalizeText(pattern)))) {
      return rule.value;
    }
  }
  return null;
}

function detectFirst(normalized, values) {
  return values.find((value) => normalized.includes(normalizeText(value))) || null;
}

function detectMaxPrice(query) {
  const lower = String(query || "").toLowerCase();
  const underMatch = lower.match(/(?:under|below|less than|max(?:imum)?)[^\d]{0,6}\$?\s?(\d[\d,]*)/i);
  if (underMatch) {
    return Number(underMatch[1].replace(/,/g, ""));
  }

  const shorthand = lower.match(/\$?\s?(\d+(?:\.\d+)?)\s?k\b/i);
  if (shorthand) {
    return Math.round(Number(shorthand[1]) * 1000);
  }

  return null;
}

function detectLeadTime(normalized) {
  const weekMatch = normalized.match(/(\d{1,2})\s*(?:week|weeks|wk)\b/);
  if (weekMatch) {
    return Number(weekMatch[1]);
  }

  if (normalized.includes("fast lead time") || normalized.includes("quick ship")) {
    return 6;
  }

  return null;
}

function buildSummary({ productType, style, material, color, maxPrice, vendor, sustainable, ergonomic }) {
  const parts = [];

  if (style) parts.push(style);
  if (color) parts.push(color);
  if (material) parts.push(material);
  if (productType) {
    parts.push(productType);
  } else {
    parts.push("furniture");
  }

  let summary = `Searching for ${parts.join(" ")}`.replace(/\s+/g, " ").trim();

  if (vendor) {
    summary += ` from ${vendor}`;
  }
  if (maxPrice) {
    summary += ` under $${maxPrice.toLocaleString()}`;
  }
  if (sustainable) {
    summary += " with a sustainability bias";
  }
  if (ergonomic) {
    summary += " with ergonomic comfort in mind";
  }

  return summary;
}

function getCategorySynonyms(category) {
  const key = normalizeText(category);
  const map = {
    "swivel chair": ["accent chair", "lounge chair", "chair"],
    "office chair": ["task chair", "desk chair", "chair"],
    "dining chair": ["side chair", "arm chair", "chair"],
    "bar stool": ["counter stool", "stool", "seat"],
    bench: ["banquette", "seating bench", "seat"],
    ottoman: ["pouf", "footstool", "ottoman bench"],
    "sectional sofa": ["sectional", "sofa", "lounge seating"],
    "outdoor sofa": ["outdoor sectional", "patio seating", "outdoor lounge"],
    sofa: ["couch", "upholstered sofa", "lounge seating"],
    "console table": ["entry table", "sofa table", "console"],
    "coffee table": ["cocktail table", "center table", "coffee table"],
    "dining table": ["table", "extension table", "pedestal table"],
    "side table": ["end table", "drink table", "occasional table"],
    nightstand: ["bedside table", "side table", "nightstand"],
    credenza: ["sideboard", "buffet", "storage cabinet"],
    desk: ["writing desk", "executive desk", "home office desk"],
    "media console": ["tv console", "entertainment console", "console"],
    bed: ["bed", "upholstered bed", "panel bed"],
    dresser: ["chest", "drawer storage", "dresser"],
    bookcase: ["etagere", "shelving", "storage shelf"],
    mirror: ["wall mirror", "floor mirror", "decor mirror"],
    rug: ["area rug", "floor covering", "rug"],
    lighting: ["table lamp", "floor lamp", "pendant lighting"],
    furniture: ["furniture", "home furnishings", "interior product"],
  };
  return map[key] || ["furniture"];
}

function buildBroadCategoryFallback(category) {
  const key = normalizeText(category);
  if (key.includes("chair")) return "chairs";
  if (key.includes("sofa")) return "sofas";
  if (key.includes("table")) return "tables";
  if (key.includes("bed")) return "beds";
  if (key.includes("dresser") || key.includes("credenza") || key.includes("console")) return "storage furniture";
  return "furniture";
}

function buildContextualFallbacks(query) {
  const normalized = normalizeText(query);
  const variants = [];

  if (normalized.includes("seating") || normalized.includes("lounge")) {
    variants.push("accent chair", "lounge chair", "sofa");
  }
  if (normalized.includes("dining")) {
    variants.push("dining chair", "dining table");
  }
  if (normalized.includes("bedroom")) {
    variants.push("bed", "nightstand", "dresser");
  }
  if (normalized.includes("living room")) {
    variants.push("sofa", "coffee table", "accent chair");
  }
  if (normalized.includes("office") || normalized.includes("workspace")) {
    variants.push("desk", "office chair", "bookcase");
  }
  if (normalized.includes("hotel") || normalized.includes("hospitality") || normalized.includes("lobby")) {
    variants.push("lounge chair", "sectional sofa", "accent chair");
  }
  if (normalized.includes("outdoor") || normalized.includes("patio")) {
    variants.push("outdoor sofa", "outdoor lounge chair", "outdoor dining chair");
  }

  return variants;
}
