# Search Service

This is a standalone in-repo product search foundation separate from Base44 and SerpAPI.

## What it does

- maintains a normalized product catalog
- exposes a local HTTP search API
- ranks products across priority vendors
- can be wired into the frontend with `VITE_SEARCH_SERVICE_URL`
- tracks ingest runs and vendor-level results
- supports adapter-driven ingestion as the foundation for real crawlers

## Current scope

- local JSON-backed catalog store
- sample normalized catalog covering major vendors
- deterministic ranking engine
- intent-aware query parsing for designer briefs
- adapter-driven ingestion pipeline
- vendor-native discovery profiles before generic web discovery
- local API for `/health`, `/vendors`, `/catalog`, `/runs`, `/seed`, `/ingest`, `/search`
- real crawler adapters currently enabled for `hooker`, `bernhardt`, and `fourhands`
- seed adapters remain in place for the rest of the priority vendor list

## Run it

1. Seed the local catalog:

```bash
npm run search:seed
```

2. Start the service:

```bash
npm run search:service
```

3. Point the frontend at it with:

```bash
VITE_SEARCH_SERVICE_URL=http://127.0.0.1:4310
```

Then start the app normally.

## Endpoints

- `GET /health`
- `GET /vendors`
- `POST /seed`
- `POST /search`

Example search request:

```json
{
  "query": "swivel chairs"
}
```

Example ingest request:

```json
{
  "mode": "seed",
  "vendor_ids": ["hooker", "bernhardt", "fourhands"]
}
```

## Next real upgrades

- replace remaining seed adapters with real vendor crawlers/adapters
- store data in Postgres instead of JSON
- add embeddings + hybrid retrieval
- add scheduled ingestion jobs
- add vendor-specific extraction pipelines per manufacturer
