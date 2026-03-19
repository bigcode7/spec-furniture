import fs from "node:fs";
const data = JSON.parse(fs.readFileSync("search-service/data/catalog.db.json", "utf8"));
const products = data.products || Object.values(data);
const vendors = {};
for (const p of products) {
  const v = p.vendor_name || p.manufacturer_name || p.vendor_id || "Unknown";
  if (!vendors[v]) vendors[v] = 0;
  vendors[v]++;
}
const sorted = Object.entries(vendors).sort((a, b) => b[1] - a[1]);
for (const [name, count] of sorted) {
  console.log(name.padEnd(30) + count);
}
console.log("\nTOTAL: " + products.length + " products across " + sorted.length + " vendors");
