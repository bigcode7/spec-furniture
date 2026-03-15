import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("search-service/data");
const catalogPath = path.join(dataDir, "catalog.json");
const verifiedCatalogPath = path.join(dataDir, "verified-catalog.json");
const runsPath = path.join(dataDir, "runs.json");

export function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(catalogPath)) {
    fs.writeFileSync(catalogPath, JSON.stringify({ products: [], updated_at: null }, null, 2));
  }
  if (!fs.existsSync(verifiedCatalogPath)) {
    fs.writeFileSync(verifiedCatalogPath, JSON.stringify({ products: [], updated_at: null }, null, 2));
  }
  if (!fs.existsSync(runsPath)) {
    fs.writeFileSync(runsPath, JSON.stringify({ runs: [] }, null, 2));
  }
}

export function readCatalog() {
  ensureStore();
  return JSON.parse(fs.readFileSync(catalogPath, "utf8"));
}

export function writeCatalog(products) {
  ensureStore();
  const payload = buildCatalogPayload(products);
  fs.writeFileSync(catalogPath, JSON.stringify(payload, null, 2));
  return payload;
}

export function readVerifiedCatalog() {
  ensureStore();
  return JSON.parse(fs.readFileSync(verifiedCatalogPath, "utf8"));
}

export function writeVerifiedCatalog(products) {
  ensureStore();
  const payload = buildCatalogPayload(products);
  fs.writeFileSync(verifiedCatalogPath, JSON.stringify(payload, null, 2));
  return payload;
}

export function catalogFilePath() {
  ensureStore();
  return catalogPath;
}

export function verifiedCatalogFilePath() {
  ensureStore();
  return verifiedCatalogPath;
}

export function readRuns() {
  ensureStore();
  return JSON.parse(fs.readFileSync(runsPath, "utf8"));
}

export function appendRun(run) {
  ensureStore();
  const payload = readRuns();
  payload.runs = [run, ...(payload.runs || [])].slice(0, 100);
  fs.writeFileSync(runsPath, JSON.stringify(payload, null, 2));
  return payload;
}

function buildCatalogPayload(products) {
  return {
    products,
    updated_at: new Date().toISOString(),
  };
}
