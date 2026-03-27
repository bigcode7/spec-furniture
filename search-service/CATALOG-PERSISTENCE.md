# Catalog Persistence

## How data is stored

The search service uses an in-memory catalog backed by JSON files on disk:

- `data/catalog.json` — Full product catalog (~42K products)
- `data/admin-store.json` — Health checks, activity logs, alerts
- `data/subscriptions.json` — Subscription state
- `data/guests.json` — Guest usage tracking

## Railway deployment

On Railway, the `data/` directory must be on a **persistent volume** mounted at `/app/data`. Without a persistent volume, catalog data is lost on every redeploy.

### Setup

1. In Railway dashboard, add a volume to the search-service
2. Mount path: `/app/data`
3. Size: 1 GB is sufficient for current catalog size

## Startup behavior

On startup, the server:
1. Loads `catalog.json` from disk into memory
2. Builds the inverted search index
3. Purges any blocked vendor products
4. Loads admin store, subscription, and guest data

If no catalog file exists, the server starts with an empty catalog and waits for ingestion.

## Backup

The catalog is the source of truth. Back up `data/catalog.json` periodically. All other files can be regenerated.
