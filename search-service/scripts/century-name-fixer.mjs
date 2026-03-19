#!/usr/bin/env node
/**
 * Fetches Century product detail pages to get proper product names.
 * Updates the catalog database via API.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const IMPORT_FILE = path.join(DATA_DIR, "century-import.json");
const PROGRESS_FILE = path.join(DATA_DIR, "century-names-progress.json");
const BASE = "https://www.centuryfurniture.com";
const API = "http://127.0.0.1:4310";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchProductName(sku) {
  const url = `${BASE}/product-detail.aspx?sku=${encodeURIComponent(sku)}`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();

    // Extract product name from <title> or <h1>
    let name = null;

    // Try <title>
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      name = titleMatch[1]
        .replace(/\s*[-|]\s*Century\s*Furniture.*$/i, "")
        .replace(/\s*[-|]\s*Product\s*Detail.*$/i, "")
        .trim();
    }

    // Try <h1>
    if (!name || name.length < 3) {
      const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
      if (h1Match) {
        name = h1Match[1].trim();
      }
    }

    // Try og:title
    if (!name || name.length < 3) {
      const ogMatch = html.match(/property="og:title"\s+content="([^"]+)"/i);
      if (ogMatch) {
        name = ogMatch[1].replace(/\s*[-|]\s*Century.*$/i, "").trim();
      }
    }

    // Extract description
    let description = "";
    const descMatch = html.match(/meta\s+name="description"\s+content="([^"]+)"/i);
    if (descMatch) {
      description = descMatch[1].trim().substring(0, 500);
    }

    // Extract dimensions
    let width = null, depth = null, height = null;
    const dimMatch = html.match(/(\d+(?:\.\d+)?)\s*"?\s*[Ww]\s*x\s*(\d+(?:\.\d+)?)\s*"?\s*[Dd]\s*x\s*(\d+(?:\.\d+)?)\s*"?\s*[Hh]/);
    if (dimMatch) {
      width = parseFloat(dimMatch[1]);
      depth = parseFloat(dimMatch[2]);
      height = parseFloat(dimMatch[3]);
    }

    // Extract collection
    let collection = "";
    const collMatch = html.match(/collection[^>]*>([^<]{2,60})</i);
    if (collMatch) {
      collection = collMatch[1].trim();
    }

    // Extract materials
    let material = "";
    const matMatch = html.match(/material[^>]*>([^<]{2,80})</i);
    if (matMatch) {
      material = matMatch[1].trim();
    }

    return { name, description, width, depth, height, collection, material };
  } catch {
    return null;
  }
}

async function main() {
  const products = JSON.parse(fs.readFileSync(IMPORT_FILE, "utf8"));

  // Load progress
  let progress = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
  }

  // Filter products that need names
  const needsName = products.filter(p =>
    p.product_name === p.sku || p.product_name.length < 4
  ).filter(p => !progress[p.sku]);

  console.log(`Total products: ${products.length}`);
  console.log(`Need names: ${needsName.length}`);
  console.log(`Already done: ${Object.keys(progress).length}`);
  console.log();

  const BATCH_SIZE = 5;  // concurrent requests
  const DELAY = 200;     // ms between batches
  let fixed = 0;
  let failed = 0;
  const updates = [];

  for (let i = 0; i < needsName.length; i += BATCH_SIZE) {
    const batch = needsName.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(async (p) => {
      const detail = await fetchProductName(p.sku);
      return { product: p, detail };
    }));

    for (const { product, detail } of results) {
      if (detail && detail.name && detail.name.length >= 3) {
        progress[product.sku] = detail;
        updates.push({
          id: product.id,
          product_name: detail.name,
          description: detail.description || "",
          width: detail.width,
          depth: detail.depth,
          height: detail.height,
          collection: detail.collection || "",
          material: detail.material || "",
        });
        fixed++;
      } else {
        progress[product.sku] = { name: null };
        failed++;
      }
    }

    // Save progress every 50 products
    if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= needsName.length) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
      process.stdout.write(`\r  Progress: ${i + batch.length}/${needsName.length} (fixed: ${fixed}, failed: ${failed})`);
    }

    // Push updates in batches of 100
    if (updates.length >= 100) {
      await pushUpdates(updates.splice(0, 100));
    }

    await sleep(DELAY);
  }

  // Push remaining updates
  if (updates.length > 0) {
    await pushUpdates(updates);
  }

  console.log(`\n\nDone! Fixed: ${fixed}, Failed: ${failed}`);
}

async function pushUpdates(updates) {
  for (const u of updates) {
    try {
      const resp = await fetch(`${API}/catalog/insert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: [u] }),
      });
    } catch {}
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
