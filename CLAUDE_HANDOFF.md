# SPEC Platform Handoff

## What SPEC Is

AI-native furniture sourcing platform for interior designers. Dark-mode premium UI (Linear meets design magazine). Search any furniture query, get real products from real vendors with images, prices, and direct links. Compare up to 6 products side-by-side. Generate professional PDF quotes.

## Running the App

Frontend: `http://127.0.0.1:4174`
Search service: `http://127.0.0.1:4310`

```bash
# Frontend
VITE_SEARCH_SERVICE_URL=http://127.0.0.1:4310 npx vite --host 127.0.0.1 --port 4174

# Search service (needs API key for AI features)
ANTHROPIC_API_KEY="sk-ant-..." node search-service/src/server.mjs

# Lint / build
npm run lint
npm run build
```

## Architecture Overview

### Frontend (Vite + React 18 + Tailwind 3)

| File | Purpose |
|------|---------|
| `src/pages/Landing.jsx` | Hero page — particle field animation, animated typography, glow search bar, vendor marquee, stat counters, feature cards |
| `src/pages/Search.jsx` | Core search — AI loading sequence, AI summary card, results grid (2-5 cols), compare tray, product cards with hover effects |
| `src/pages/Compare.jsx` | Side-by-side comparison (up to 6 products), specs table, PDF quote generator |
| `src/Layout.jsx` | Dark glass nav header, page transitions (framer-motion), CommandPalette integration |
| `src/api/searchClient.js` | Frontend search client — calls search service POST /search, normalizes results for UI |
| `src/lib/growth-store.js` | localStorage state — compare items (max 6), recent searches, favorites |
| `src/lib/quote-generator.js` | jsPDF — professional PDF with SPEC branding, cover page, product pages with images, clickable vendor links |
| `src/components/ParticleField.jsx` | Canvas constellation animation, mouse interaction, 80 particles, 30fps mobile cap |
| `src/components/AILoadingSequence.jsx` | 4-step animated loading (parse → expand → scan → rank) |
| `src/components/CommandPalette.jsx` | Cmd+K modal — quick nav, recent searches, uses shadcn Command component |
| `src/index.css` | Dark theme CSS variables, grain texture, custom keyframes (glow, shimmer, float, scan) |
| `tailwind.config.js` | Gold/night color palettes, Inter + Playfair Display fonts, animation keyframes |

### Search Service (Node.js HTTP, port 4310)

| File | Purpose |
|------|---------|
| `search-service/src/server.mjs` | HTTP server — routes: /health, /vendors, /catalog, /runs, /seed, /ingest, /search |
| `search-service/src/lib/ai-search.mjs` | **Anthropic API integration** — 5 AI functions (see below) |
| `search-service/src/lib/query-intelligence.mjs` | Hardcoded fallback — category/style/material/color/vendor rules, query variant generation |
| `search-service/src/lib/discover.mjs` | Live vendor crawling — native search paths + DuckDuckGo fallback, parallel per vendor |
| `search-service/src/lib/vendor-product.mjs` | HTML product extraction — JSON-LD, __NEXT_DATA__, og:tags, embedded state, verification scoring |
| `search-service/src/lib/rank.mjs` | Token-match ranking — query overlap, intent matching, verification bonuses, 0-99 score |
| `search-service/src/lib/ingest.mjs` | Catalog ingestion — seed + live modes, dedup, verified catalog sync |
| `search-service/src/lib/store.mjs` | JSON file storage — catalog.json, verified-catalog.json, runs.json |
| `search-service/src/lib/normalize.mjs` | Text normalization, tokenization, slugification |
| `search-service/src/config/vendors.mjs` | 28+ vendor configs with domains, discovery paths, profile metadata |
| `search-service/src/data/sample-catalog.mjs` | 60+ seed products across 15+ categories, 27 vendors |
| `search-service/src/adapters/` | Vendor-specific crawl adapters |

## AI Search Layer (ai-search.mjs)

Uses Anthropic API (claude-sonnet-4-20250514) with graceful fallback to hardcoded rules when API is unavailable.

### 5 AI Functions

1. **`aiParseAndExpand(query)`** — Combined parse + expand in one API call
   - Takes ANY natural language query and extracts: product_type, style, material, color, vendor, max_price, room_type, size, attributes
   - Understands jargon: MCM → mid-century modern, "under 2k" → $2000, "performance fabric" → material
   - Generates 8-12 search variants using furniture industry knowledge (synonym chains, vendor phrasings, category adjacents)
   - Fallback: `buildSearchIntent()` + `buildQueryVariants()` from query-intelligence.mjs

2. **`aiDiscoverProducts(query, intent)`** — Web search discovery
   - Uses Anthropic API with `web_search_20250305` tool to find real products on vendor websites
   - Returns structured product objects (name, vendor, image URL, product URL, price, category, material, style)
   - Products tagged with `ingestion_source: "ai-discovery"`

3. **`aiRankResults(query, intent, products)`** — Semantic relevance ranking
   - Re-ranks top 30 candidates by TRUE relevance (not just keyword overlap)
   - Each product gets a reasoning string explaining match quality
   - Fallback: keeps existing rank order

4. **`aiGenerateSummary(query, intent, products)`** — Natural language summary
   - Generates 1-2 sentence design consultant summary specific to actual results
   - Mentions vendors, price ranges, style trends, actionable suggestions
   - Example: "Found 17 tufted options from 13 vendors... Consider filtering by leather material."

5. **Individual `aiParseIntent()` and `aiExpandQuery()`** — Available but the combined call is used by default

### Rate Limit Handling

- Tier 1 API limits: 30k input tokens/min
- Rate limit tracker (`rateLimitedUntil`) skips subsequent calls when limited
- Retry with backoff (up to 2 retries, waits for retry-after header)
- Server warmup is disabled to preserve rate budget for searches
- All AI calls have generous timeouts (20-45s) to accommodate retries

### API Key

Set `ANTHROPIC_API_KEY` env var. Without it, all AI functions silently fall back to hardcoded logic. The app works either way.

## Search Pipeline (POST /search)

1. **AI Parse + Expand** (20s timeout) → structured intent + 8-12 query variants
2. **Catalog lookup** → existing products from catalog.json + verified-catalog.json
3. **Parallel Discovery**:
   - Crawler-based: `discoverAcrossVariants()` hits vendor search pages + DuckDuckGo
   - AI web search: `aiDiscoverProducts()` uses Anthropic web_search tool
4. **Merge & Dedupe** all sources
5. **Token-match ranking** via `searchCatalog()` (rank.mjs)
6. **Result selection**: verified first, then directional catalog fallback, up to 50 results
7. **Parallel AI post-processing**:
   - `aiRankResults()` re-ranks by semantic relevance
   - `aiGenerateSummary()` generates natural language summary
8. **Response** includes: `query`, `intent`, `ai_summary`, `total`, `result_mode`, `diagnostics`, `products`

## Response Fields

```json
{
  "query": "tufted leather chesterfield sofa",
  "intent": { "product_type": "sofa", "style": "chesterfield", "material": "leather", "ai_parsed": true, ... },
  "ai_summary": "Found 17 tufted options from 13 vendors...",
  "total": 17,
  "result_mode": "directional-catalog-fallback | verified-vendor-results | ai-discovery-results",
  "diagnostics": { "ai_parsed": true, "ai_ranked": true, "ai_discovered_count": 0, "query_variants": [...], ... },
  "products": [{ "product_name": "...", "vendor_name": "...", "image_url": "...", "product_url": "...", "relevance_score": 95, "reasoning": "...", ... }]
}
```

## Frontend Search Client (searchClient.js)

`normalizeStandaloneResult()` maps backend fields to UI fields. Key logic:
- `isAiDiscovery` / `isLiveResult` flags determine trust level
- AI-discovered products pass through image_url and product_url
- Seed/catalog products pass through assets if present
- Live-crawled products only show verified assets
- `match_label`: "Verified vendor result" | "AI discovered" | "Live result pending verification" | "Catalog match"

## Vendor Coverage

28+ vendors configured in `vendors.mjs`:
- **High-end**: Hooker, Bernhardt, Four Hands, Universal, Theodore Alexander, Caracole, Century, Baker, Vanguard, Lexington, Bassett, Stickley
- **Retail**: RH, West Elm, IKEA, Wayfair, CB2, Pottery Barn, Crate & Barrel
- **Modern/DTC**: Article, Arhaus, Ethan Allen, Joybird, Castlery, Room & Board, Blu Dot, DWR
- **Office**: Herman Miller, Knoll

Each vendor has: domain, asset hosts, title suffixes, product path tokens, rejection tokens, image path hints, discovery search_paths, category_paths.

## Seed Catalog (sample-catalog.mjs)

60+ products across: swivel chair (12), sofa/sectional (10), dining table (7), coffee table (4), dining chair (4), bed (3), credenza (3), desk (2), office chair (3), accent chair (4), nightstand (2), bookcase (2), console table (2), dresser (2), lighting (2), rug (2), bar stool (2), ottoman (1), mirror (1).

## UI Theme

- Dark mode: `--background: #0a0a0f`, `--card: #111118`, `--border: white/10`
- Accent colors: blue (#3b82f6) for CTAs, gold (#c9a96e) for premium accents
- Typography: Inter (body), Playfair Display (headings)
- Google Fonts loaded in `index.html`
- Glass panels: `bg-white/5 border-white/10 backdrop-blur-xl`
- Animations: framer-motion for page transitions, scroll reveals, loading sequences

## Important Rules

- Do not show price unless verified
- Do not show image unless vendor-hosted and verified (or from seed/AI discovery)
- Do not show product link unless canonical vendor URL is verified (or from seed/AI discovery)
- Prefer honest directional fallback over fake certainty
- AI functions must always have graceful fallbacks to hardcoded logic

## Known Limitations

1. **API rate limits** — Tier 1 (30k tokens/min) means AI features can be slow with retries. Upgrades automatically as usage grows.
2. **AI web search discovery** — Often returns 0 products because the web_search call is token-heavy and gets rate-limited. Works better with higher tier.
3. **Live crawling** — Many vendor sites block bots or use JS rendering. DuckDuckGo fallback helps but coverage varies.
4. **Seed catalog** — 60+ products provide baseline results but don't cover every niche query.

## Best Next Work

### Backend
- Build vendor-specific listing page extractors for top vendors (Hooker, Bernhardt, Four Hands) to improve verified product yield
- Increase seed catalog coverage for underrepresented categories (outdoor, kids, lighting, accessories, rugs)
- Add response caching to reduce redundant API calls for repeated queries
- Consider using claude-haiku for cheaper AI calls (parse/expand/summary don't need Sonnet)

### Frontend
- Add loading skeletons for product cards
- Add filter pills (product type, material, style, vendor, price range) that actually filter results
- Add favorites/saved products to localStorage
- Build Dashboard page with catalog stats, recent searches, vendor coverage
- Improve mobile responsiveness at 375px width
- Add price display on product cards when available

### Infrastructure
- Deploy to a server (the app is currently localhost-only)
- Set up proper env var management for API keys
- Consider a real database instead of JSON files for catalog storage

## Test Commands

```bash
# Health check
curl -s http://127.0.0.1:4310/health

# Search (AI-powered)
curl -s -X POST http://127.0.0.1:4310/search \
  -H 'content-type: application/json' \
  -d '{"query":"MCM accent chair under 2k","allow_seed_results":true}'

# Diverse test queries
# "72 inch walnut credenza"
# "tufted leather chesterfield sofa"
# "marble top console table under $2000"
# "king size upholstered bed frame in cream"
# "rattan outdoor lounge"
# "ergonomic office chair"
# "blue velvet sofa"
