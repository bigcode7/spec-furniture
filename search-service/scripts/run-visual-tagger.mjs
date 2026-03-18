/**
 * Standalone visual tagger runner.
 * Sets the API key and runs the visual tagger directly.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load .env manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

console.log("API key:", process.env.ANTHROPIC_API_KEY ? `SET (${process.env.ANTHROPIC_API_KEY.length} chars)` : "NOT SET");

import { initCatalogDB, getAllProducts, updateProductDirect, getProductsByVendor, flushToDisk } from "../src/db/catalog-db.mjs";
import { runVisualTagger, getVisualTaggerStatus } from "../src/jobs/visual-tagger.mjs";

await initCatalogDB();

const catalogDBInterface = {
  getAllProducts,
  updateProductDirect,
  getProductsByVendor,
};

console.log("Starting visual tagger...");

const result = await runVisualTagger(catalogDBInterface, {
  batchSize: 10,
  delayMs: 6000,
  skipTagged: true,
});

console.log("\nFinal result:", JSON.stringify(result, null, 2));

// Flush catalog changes to disk
console.log("Flushing to disk...");
flushToDisk();
console.log("Done!");
