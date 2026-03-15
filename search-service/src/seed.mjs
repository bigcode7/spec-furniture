import { seedSampleCatalog } from "./lib/ingest.mjs";

const payload = await seedSampleCatalog();
console.log(`seeded ${payload.products.length} products into ${payload.updated_at}`);
