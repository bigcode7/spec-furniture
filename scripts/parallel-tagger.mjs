/**
 * Parallel Visual Tagger — runs N workers concurrently, each processing a slice of vendors.
 *
 * Usage: ANTHROPIC_API_KEY=... node scripts/parallel-tagger.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../search-service/data/catalog.db.json");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) { console.error("ANTHROPIC_API_KEY not set"); process.exit(1); }

const CONCURRENCY = 15;       // simultaneous API calls
const COST_PER_IMAGE = 0.0015;

const NOT_PRODUCT_MARKERS = [
  "logo", "placeholder", "room scene", "not furniture",
  "multiple items", "website", "screenshot",
];

const INVALID_IMAGE = [
  url => url.toLowerCase().includes("logo"),
  url => url.toLowerCase().endsWith(".svg"),
  url => url.length < 15,
];

// ── Load DB ──
const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
const productMap = new Map(db.products.map(p => [p.id, p]));

// Filter to untagged products with valid images
const toProcess = db.products.filter(p => {
  if (p.ai_visual_tags) return false;
  if (!p.image_url) return false;
  if (INVALID_IMAGE.some(fn => fn(p.image_url))) return false;
  return true;
});

console.log(`Products to tag: ${toProcess.length} (${db.products.length} total, ${db.products.length - toProcess.length} already tagged/skipped)`);

// ── Stats ──
let tagged = 0, skipped = 0, errors = 0, inFlight = 0;
let cost = 0;
const startTime = Date.now();

function logProgress() {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const rate = tagged > 0 ? (tagged / (elapsed / 60)).toFixed(1) : "0";
  const remaining = toProcess.length - tagged - skipped - errors;
  const eta = rate > 0 ? (remaining / parseFloat(rate)).toFixed(0) : "?";
  console.log(`[${elapsed}s] Tagged: ${tagged} | Skipped: ${skipped} | Errors: ${errors} | Rate: ${rate}/min | ETA: ${eta}min | Cost: $${cost.toFixed(2)} | InFlight: ${inFlight}`);
}

// ── Tag one image ──
async function tagOne(product) {
  const prompt = `You are a visual product tagger for a furniture catalog. Describe this furniture product in a flat comma-separated list of tags. Include: furniture type, silhouette shape, arm style, back style, cushion type, leg style, primary material, color/finish, style period, scale. If this is NOT a single piece of furniture (logo, room scene, placeholder, multiple items, website screenshot), say so. Output ONLY comma-separated tags, nothing else.`;

  try {
    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: product.image_url } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        // Rate limited — wait and retry
        await sleep(5000);
        return tagOne(product);
      }
      return { error: "api_error", status: resp.status };
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";

    if (!text) return { error: "empty_response" };

    // Check for broken image
    if (data.stop_reason === "end_turn" && text.includes("cannot") && text.includes("image")) {
      return { error: "broken_image" };
    }

    // Check for non-product
    const lower = text.toLowerCase();
    if (NOT_PRODUCT_MARKERS.some(m => lower.includes(m))) {
      return { tags: null, notProduct: true };
    }

    return { tags: text.trim() };
  } catch (err) {
    return { error: err.message };
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Process with concurrency pool ──
let idx = 0;
const SAVE_INTERVAL = 200;  // save to disk every N products
let sinceLastSave = 0;

async function worker() {
  while (idx < toProcess.length) {
    const i = idx++;
    const product = toProcess[i];
    inFlight++;

    const result = await tagOne(product);
    inFlight--;

    if (result.error) {
      if (result.error === "broken_image") {
        product.image_quality = "broken";
        skipped++;
      } else {
        errors++;
      }
    } else if (result.notProduct) {
      product.image_quality = "not-product";
      skipped++;
    } else if (result.tags) {
      product.ai_visual_tags = result.tags;
      tagged++;
      cost += COST_PER_IMAGE;
    }

    sinceLastSave++;
    if (sinceLastSave >= SAVE_INTERVAL) {
      saveToDisk();
      sinceLastSave = 0;
    }

    if ((tagged + skipped + errors) % 50 === 0) {
      logProgress();
    }
  }
}

function saveToDisk() {
  // Apply changes back to db
  for (const p of toProcess) {
    const orig = productMap.get(p.id);
    if (p.ai_visual_tags) orig.ai_visual_tags = p.ai_visual_tags;
    if (p.image_quality) orig.image_quality = p.image_quality;
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  console.log(`  [saved to disk — ${tagged} tagged so far]`);
}

// Launch workers
console.log(`Starting ${CONCURRENCY} concurrent workers...\n`);

const workers = Array.from({ length: CONCURRENCY }, () => worker());
await Promise.all(workers);

// Final save
saveToDisk();
logProgress();
console.log("\nDone!");
