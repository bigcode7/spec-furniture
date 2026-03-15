import fs from "node:fs";
import path from "node:path";

const outputPath = path.resolve("furniture-home-hub-app-summary.pdf");

const sections = [
  {
    title: "What It Is",
    lines: [
      "SPEC is a React/Vite furniture sourcing app built on Base44.",
      "It combines manufacturer search, comparison, cart/order routing, and catalog workflows in one interface.",
    ],
  },
  {
    title: "Who It's For",
    lines: [
      "Primary persona: interior designers and retailers sourcing wholesale furniture.",
      "Repo evidence also includes admin, manufacturer, buyer/consumer roles.",
    ],
  },
  {
    title: "What It Does",
    lines: [
      "Natural-language AI search calls aiSearchProducts and returns ranked manufacturer results.",
      "Dashboard highlights listing volume, styles, manufacturers, commissions, and lead times.",
      "Compare up to 4 listings side by side across price, commission, lead time, material, and dimensions.",
      "Browse manufacturer profiles with active SKU counts, categories, and lead-time ranges.",
      "View product detail with role-based pricing, specs, reviews, inventory, and add-to-cart.",
      "Create cart orders; checkout writes Order records and clears CartItem records.",
      "Manufacturer/admin pages support catalog management, CSV import, and order visibility.",
    ],
  },
  {
    title: "How It Works",
    lines: [
      "Frontend: React 18 + Vite SPA with auto-registered routes from src/pages.config.js and shared layout/auth wrappers.",
      "Client data layer: Base44 SDK client reads appId/token/appBaseUrl from URL or env and accesses auth, entities, functions, and integrations.",
      "Data used in pages: ManufacturerListing, FurnitureStyle, Manufacturer, Product, CartItem, Order, Review, Project.",
      "AI flow: Search page invokes Base44 function aiSearchProducts; the Deno function authenticates the user, parses intent with an LLM, queries SerpAPI against manufacturer domains, scores results with an LLM, and returns ranked products.",
      "Seed utilities exist for Product and routing data. Persistent schema definitions: Not found in repo.",
    ],
  },
  {
    title: "How To Run",
    lines: [
      "1. npm install",
      "2. Create .env.local with VITE_BASE44_APP_ID and VITE_BASE44_APP_BASE_URL.",
      "3. Optional env referenced in code: VITE_BASE44_FUNCTIONS_VERSION.",
      "4. Run npm run dev.",
      "5. Search functions require SERPAPI_KEY, but local setup instructions for that key are Not found in repo.",
    ],
  },
];

const page = {
  width: 612,
  height: 792,
  marginX: 42,
  top: 760,
  bottom: 40,
};

const fonts = {
  title: { size: 20, leading: 24 },
  section: { size: 12, leading: 15 },
  body: { size: 9, leading: 11 },
};

function wrapText(text, maxWidth, fontSize) {
  const avgCharWidth = fontSize * 0.5;
  const maxChars = Math.max(20, Math.floor(maxWidth / avgCharWidth));
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function escapePdfText(value) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

const content = [];
let y = page.top;
const usableWidth = page.width - page.marginX * 2;

function pushText(text, x, currentY, fontSize) {
  content.push(`BT /F1 ${fontSize} Tf 1 0 0 1 ${x} ${currentY} Tm (${escapePdfText(text)}) Tj ET`);
}

pushText("Furniture Home Hub / SPEC App Summary", page.marginX, y, fonts.title.size);
y -= fonts.title.leading;
pushText("Repo-based one-page summary generated on 2026-03-09", page.marginX, y, 8);
y -= 18;

for (const section of sections) {
  pushText(section.title, page.marginX, y, fonts.section.size);
  y -= fonts.section.leading;

  for (const line of section.lines) {
    const isBullet = !/^\d+\./.test(line);
    const prefix = isBullet ? "- " : "";
    const indent = isBullet ? 10 : 0;
    const wrapped = wrapText(`${prefix}${line}`, usableWidth - indent, fonts.body.size);

    for (let i = 0; i < wrapped.length; i += 1) {
      const x = page.marginX + (i === 0 ? 0 : indent);
      pushText(wrapped[i], x, y, fonts.body.size);
      y -= fonts.body.leading;
      if (y < page.bottom) {
        throw new Error("Content overflowed the single-page layout.");
      }
    }
  }

  y -= 6;
}

const stream = content.join("\n");

const objects = [];
objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
objects.push("2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj");
objects.push(
  `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
);
objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
objects.push(`5 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`);

let pdf = "%PDF-1.4\n";
const offsets = [0];

for (const object of objects) {
  offsets.push(Buffer.byteLength(pdf, "utf8"));
  pdf += `${object}\n`;
}

const xrefOffset = Buffer.byteLength(pdf, "utf8");
pdf += `xref\n0 ${objects.length + 1}\n`;
pdf += "0000000000 65535 f \n";

for (let i = 1; i < offsets.length; i += 1) {
  pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}

pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, pdf, "binary");

console.log(outputPath);
