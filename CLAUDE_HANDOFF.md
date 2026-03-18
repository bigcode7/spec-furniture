# SPEC Platform Handoff

## What SPEC Is

AI-native furniture sourcing platform for interior designers. Dark-mode premium UI (Linear meets design magazine). Conversational AI search across 18,500+ real products from 20 trade vendors. Compare up to 6 products side-by-side. Build quotes with room grouping, markup, and professional PDF generation. Deep furniture industry knowledge baked into every AI response.

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

## Catalog Stats

- **18,502 total products** across 20 trade vendors
- Top vendors: Hooker Furniture (3,710), Theodore Alexander (2,191), Caracole (1,525), Baker (1,421), Hickory Chair (1,397), Universal (1,336), Bernhardt (1,313), Stickley (1,173), Hancock & Moore (1,055), Vanguard (921), Highland House (828), Wesley Hall (680), Lexington (662)
- 30+ categories including accent-chairs (2,147), sofas (1,730), dining-tables (1,235), dining-chairs (1,173), side-tables (1,165), beds (1,144)
- Image verification running — checks HEAD status, content-type, dimensions, auto-replaces broken images from og:image fallback

## Architecture Overview

### Frontend (Vite + React 18 + Tailwind 3)

| File | Purpose |
|------|---------|
| `src/pages/Landing.jsx` | Hero page — particle field animation, animated typography, glow search bar, vendor marquee, stat counters, feature cards |
| `src/pages/Search.jsx` | Core search — conversational AI chat, AI summary card, results grid (2-5 cols), compare tray, add-to-quote, product detail panel with multi-image gallery |
| `src/pages/Compare.jsx` | Side-by-side comparison (up to 6 products), specs table, PDF quote generator |
| `src/Layout.jsx` | Dark glass nav header, page transitions (framer-motion), CommandPalette, QuotePanel, quote counter badge |
| `src/api/searchClient.js` | Frontend search client — calls POST /smart-search with conversation array, normalizes results including image object→URL mapping |
| `src/lib/growth-store.js` | localStorage state — compare items (max 6), recent searches, favorites, **quote system** (rooms, items, quantities, notes, markup, designer settings) |
| `src/lib/quote-generator.js` | jsPDF — professional PDF with cover page, room dividers, product pages with markup-adjusted pricing, summary page with signature line |
| `src/components/QuotePanel.jsx` | Slide-out quote builder — room groups, per-item quantity/notes, designer markup, PDF download, designer settings persistence |
| `src/components/ParticleField.jsx` | Canvas constellation animation, mouse interaction, 80 particles, 30fps mobile cap |
| `src/components/AILoadingSequence.jsx` | 4-step animated loading (parse → expand → scan → rank) |
| `src/components/CommandPalette.jsx` | Cmd+K modal — quick nav, recent searches, uses shadcn Command component |
| `src/index.css` | Dark theme CSS variables, grain texture, custom keyframes (glow, shimmer, float, scan) |
| `tailwind.config.js` | Gold/night color palettes, Inter + Playfair Display fonts, animation keyframes |

### Search Service (Node.js HTTP, port 4310)

| File | Purpose |
|------|---------|
| `search-service/src/server.mjs` | HTTP server — routes: /health, /vendors, /catalog, /smart-search, /jobs/*, /admin/*. Smart search with conversational AI, soft filtering, color expansion |
| `search-service/src/lib/search-brain.mjs` | **Claude Haiku AI brain** — conversation-aware query understanding, furniture knowledge system prompt, structured JSON extraction (search params + assistant message) |
| `search-service/src/lib/catalog-intelligence.mjs` | Auto-generated catalog intelligence — vendor profiles, category leaders, collection maps, price tiers from live product data. Cached 30min |
| `search-service/src/lib/furniture-knowledge.mjs` | Static furniture knowledge base — vendor deep expertise (tiers 1-4), room planning rules, material durability, construction, style mixing, spatial planning, trade process, trends |
| `search-service/src/lib/ai-search.mjs` | Legacy Anthropic API integration — 5 AI functions (parse, expand, discover, rank, summarize) with fallback to hardcoded rules |
| `search-service/src/lib/query-intelligence.mjs` | Hardcoded fallback — category/style/material/color/vendor rules, query variant generation |
| `search-service/src/lib/discover.mjs` | Live vendor crawling — native search paths + DuckDuckGo fallback, parallel per vendor |
| `search-service/src/lib/vendor-product.mjs` | HTML product extraction — JSON-LD, __NEXT_DATA__, og:tags, embedded state, verification scoring |
| `search-service/src/lib/rank.mjs` | Token-match ranking — query overlap, intent matching, verification bonuses, 0-99 score |
| `search-service/src/lib/ingest.mjs` | Catalog ingestion — seed + live modes, dedup, verified catalog sync |
| `search-service/src/db/catalog-db.mjs` | JSON-file catalog database — getAllProducts, updateProductDirect, getProductCount, vendor/category queries |
| `search-service/src/jobs/image-verifier.mjs` | Background image audit — HEAD check, dimension extraction, og:image replacement for broken URLs, quality labeling (verified-hq/verified/low-quality/broken/missing) |
| `search-service/src/jobs/image-fixer.mjs` | Image repair — finds replacement images for flagged products |
| `search-service/src/jobs/full-catalog-crawl.mjs` | Full re-crawl of all vendor catalogs |
| `search-service/src/config/vendors.mjs` | 28+ vendor configs with domains, discovery paths, profile metadata |
| `search-service/src/adapters/` | Vendor-specific crawl adapters |

## Smart Search (POST /smart-search)

The primary search endpoint. Conversational, AI-powered.

### Request
```json
{
  "conversation": [
    { "role": "user", "content": "hooker and bernhardt sofas" },
    { "role": "assistant", "content": "...", "resultSummary": "Showed 45 results..." },
    { "role": "user", "content": "just fabric versions" }
  ]
}
```

### Pipeline
1. **AI Brain** (Claude Haiku `claude-haiku-4-5-20251001`) — reads full conversation + catalog intelligence + furniture knowledge → extracts structured search params (keywords, vendors, categories, materials, styles, colors, price range, sort) + generates natural assistant message
2. **Catalog search** — keyword matching against 18,500+ products
3. **Soft filtering** — vendor, category, material, style, color filters boost matching products rather than eliminating non-matching (prevents empty results)
4. **Color expansion** — maps vague terms ("neutral" → cream/beige/ivory/oatmeal/sand, "warm" → cognac/camel/rust/terracotta, etc.)
5. **Price filtering** — hard filter when max_price specified
6. **Sorting** — relevance (default), price_asc, price_desc, newest
7. **Response** — products array + assistant_message + search metadata

### Key Design Decisions
- **Soft filters over hard filters**: Material, style, and color filters boost matching products to the top instead of eliminating non-matching when too few products match (threshold: 5 or 10% of results). This prevents "1 result" situations.
- **Image normalization**: Images stored as mixed format (objects `{url, type, priority}` vs plain URL strings). Normalized to URL strings in 3 places: server sanitizeSearchProduct, client normalizeStandaloneResult, detail panel productImages builder.
- **Conversation context**: The AI brain sees the full conversation history including previous result summaries, enabling follow-ups like "just fabric versions", "anything in blue", "what would pair with the first one".

## Quote Builder

Full quote system with localStorage persistence.

### Data Model (growth-store.js)
```javascript
{
  id: "quote_...",
  name: "Untitled Quote",
  client_name: "",
  designer_name: "",
  rooms: [{ id: "room_...", name: "Living Room", items: [...] }],
  markup_percent: 30,
  notes: "",
  terms: "..."
}
```

### Features
- Add to quote from search results (overlay button on product cards + detail panel)
- Room-based organization with add/rename/delete rooms
- Per-item: quantity, notes, move between rooms
- Designer markup percentage (private, not shown to client)
- Room subtotals and grand total with markup applied
- Designer settings (business name, name, email, phone) persisted separately
- PDF generation: cover page → room dividers → product pages → summary with signature line
- Custom event dispatch (`spec-quote-change`) for cross-component state sync

## Search Accuracy (Verified)

**20/20 test queries pass** (test-search.py):
- leather sofa, modern dining table seats 8, Bernhardt accent chairs, boucle swivel chair, walnut credenza, upholstered king bed traditional, Hooker home office, marble cocktail table, performance fabric sectional, coastal bedroom furniture, Baker Thomas Pheasant collection, narrow console table under 14 inches deep, bar stools counter height, channel back dining chair velvet, outdoor sofa commercial grade, Theodore Alexander accent tables, tight back sofa neutral, round dining table for 6, statement accent chair for foyer, quiet luxury bedroom

**3/3 conversational flows pass** (test-convo.py, 12 total steps):
1. hooker/bernhardt sofas → fabric → blue → cocktail table pairing
2. modern accent chair <$3k → Baker → traditional → matching ottoman
3. dining table seats 10 → round → chairs for walnut → sideboard

## Furniture Knowledge System

The AI brain includes two layers of domain knowledge:

### Auto-Generated (catalog-intelligence.mjs)
- Vendor profiles with product counts, top categories, price ranges
- Category leaders (which vendors dominate which categories)
- Collection pairing maps
- Price tier segmentation
- Refreshes every 30 minutes from live catalog data

### Static Knowledge (furniture-knowledge.mjs)
- Vendor deep expertise: 4 tiers with collections, price ranges, lead times, specialties
- Room planning rules: living room sizing, dining table seating, rug sizing, chandelier sizing, height relationships
- Material durability: fabrics ranked 1-8, wood types, stone types, metals
- Upholstery construction: cushion types, fill types, frame construction, welt/trim, arm styles, COM
- Style mixing: 80/20 rule, color theory 60-30-10
- Spatial planning: room composition formulas, budget allocation, traffic/spacing
- Trade process: lead times by vendor type, freight, pricing/markup
- Trends 2025-2026
- Hospitality/commercial specs: CAL 133, ADA
- Outdoor furniture, sustainability

## UI Theme

- Dark mode: `--background: #0a0a0f`, `--card: #111118`, `--border: white/10`
- Accent colors: blue (#3b82f6) for CTAs, gold (#c9a96e) for premium accents
- Typography: Inter (body), Playfair Display (headings)
- Google Fonts loaded in `index.html`
- Glass panels: `bg-white/5 border-white/10 backdrop-blur-xl`
- Animations: framer-motion for page transitions, scroll reveals, loading sequences

## Nav Structure

**Primary nav**: Home (Dashboard), Search, Projects, Intelligence
**More menu**: Compare, Showcase, Vendor Portal
**Header right**: Search bar, Quote counter badge, Notifications, User menu

## Background Jobs

All triggered via POST and polled via GET /jobs/status:

| Endpoint | Purpose |
|----------|---------|
| `POST /jobs/verify-images` | Image verification — HEAD check, dimension inspection, og:image replacement |
| `POST /jobs/dedup` | Deduplication across vendors |
| `POST /admin/deep-enrichment/start` | Re-crawl product pages for missing fields |
| `POST /admin/catalog-cleanup/start` | Name cleaning, description fixing, image flagging |

## Known Issues / Post-Launch Work

1. **Low-count vendors need re-crawl**: Lee Industries (1), Four Hands (3), CR Laine (13), Sherrill (18) — their crawl adapters may need fixing
2. **Theodore Alexander decor** — import was interrupted, decor category incomplete
3. **Visual tagger** — stopped at 11,310/35,698 products (Caracole). Resume to complete AI visual tagging
4. **Mobile responsiveness** — not fully tested at 375px
5. **Shareable client quote link** — planned but not yet built
6. **Deploy** — currently localhost-only

## Test Commands

```bash
# Health check
curl -s http://127.0.0.1:4310/health

# Smart search (conversational)
curl -s -X POST http://127.0.0.1:4310/smart-search \
  -H 'content-type: application/json' \
  -d '{"conversation":[{"role":"user","content":"leather sofa"}]}'

# Catalog stats
curl -s http://127.0.0.1:4310/catalog/stats

# Job status
curl -s http://127.0.0.1:4310/jobs/status

# Run search accuracy tests (20 queries)
python3 search-service/test-search.py

# Run conversational flow tests (3 flows, 12 steps)
python3 search-service/test-convo.py

# Trigger image verification
curl -s -X POST http://127.0.0.1:4310/jobs/verify-images
```
