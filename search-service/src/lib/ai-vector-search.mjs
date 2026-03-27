/**
 * AI Vector Search — Haiku field matching + MiniLM ranking.
 *
 * Architecture:
 *   1. User query → Haiku (with full catalog field index + conversation history)
 *   2. Haiku returns search_fields + exclude_fields + semantic_query
 *   3. Direct field matching against database (exact contains matching)
 *   4. MiniLM ranks candidates by semantic_query similarity
 *   5. Top 80 ranked candidates returned
 *
 * MiniLM never decides what's in or out — only the ORDER of confirmed matches.
 */

import { embed, vectorSearch, getVectorStoreStats, vectorFindSimilar } from "./vector-store.mjs";
import { getAllProducts, getProduct, getProductCount } from "../db/catalog-db.mjs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-haiku-4-5-20251001";

// ── Catalog Field Index ──
let catalogFieldIndex = {};
let catalogIndexPromptText = "";

// Fallback accessors for untagged products (no ai_visual_analysis).
// When the primary AI field is null/undefined, try basic metadata instead.
const FIELD_FALLBACKS = {
  ai_furniture_type: p => {
    const parts = [];
    if (p.category) parts.push(p.category.replace(/-/g, " "));
    if (p.product_name) parts.push(p.product_name.toLowerCase());
    return parts.length > 0 ? parts.join(" ") : null;
  },
  ai_primary_material: p => {
    // Only use raw material field, NOT description — description is too noisy
    // and often lists multiple options the vendor offers, not the actual material
    if (p.material) return p.material.toLowerCase();
    return null;
  },
  ai_style: p => p.style || null,
  ai_primary_color: p => p.color || null,
};

// Field accessors — maps search_fields keys to how to read them from a product
const FIELD_ACCESSORS = {
  // Include product_name in furniture type matching so qualifiers like "outdoor"
  // can match against names like "Santa Monica Outdoor Swivel Chair"
  ai_furniture_type: p => {
    const parts = [p.ai_furniture_type];
    if (p.product_name) parts.push(p.product_name.toLowerCase());
    return parts.filter(Boolean).join(" | ") || null;
  },
  ai_primary_material: p => p.ai_primary_material,
  ai_distinctive_features: p => p.ai_distinctive_features, // array
  ai_style: p => p.ai_style,
  ai_primary_color: p => p.ai_primary_color,
  ai_silhouette: p => p.ai_silhouette,
  ai_arm_style: p => p.ai_arm_style,
  ai_back_style: p => p.ai_back_style,
  ai_leg_style: p => p.ai_leg_style,
  ai_formality: p => p.ai_formality,
  ai_scale: p => p.ai_scale,
  ai_mood: p => p.ai_mood,
  ai_cushions: p => p.ai_visual_analysis?.cushions,
  ai_finish: p => p.ai_visual_analysis?.finish,
  ai_era_influence: p => p.ai_visual_analysis?.era_influence,
  ai_texture_description: p => p.ai_visual_analysis?.texture_description,
  ai_construction_details: p => {
    const v = p.ai_visual_analysis?.construction_details;
    return typeof v === "string" ? v : null;
  },
  ai_durability_assessment: p => p.ai_visual_analysis?.durability_assessment,
  ai_visual_weight: p => p.ai_visual_analysis?.visual_weight,
  ai_ideal_client: p => p.ai_visual_analysis?.ideal_client,
  vendor_name: p => p.vendor_name,
};

// How many top values to include in Haiku prompt per field
const FIELD_LIMITS = {
  ai_furniture_type: 120,
  ai_primary_material: 100,
  ai_distinctive_features: 200,
  ai_style: 80,
  ai_primary_color: 80,
  ai_silhouette: 80,
  ai_arm_style: 60,
  ai_back_style: 60,
  ai_leg_style: 60,
  ai_formality: 30,
  ai_scale: 30,
  ai_mood: 80,
  ai_cushions: 60,
  ai_finish: 40,
  ai_era_influence: 60,
  ai_texture_description: 40,
  ai_construction_details: 40,
  ai_durability_assessment: 30,
  ai_visual_weight: 20,
  ai_ideal_client: 40,
  vendor_name: 50,
};

// Values to filter out of catalog index
const SKIP_VALUES = new Set([
  "not applicable", "unable to determine", "n/a", "none", "none visible",
  "unable to determine from line drawing", "unable to determine from image",
]);

// Product names containing these terms are samples/swatches/catalogs — exclude from search results
const SAMPLE_KEYWORDS = /\b(sample|swatch|catalog|colour\s*card|color\s*card|fabric\s*card|finish\s*sample|material\s*sample|memo\s*sample)\b/i;

// Fabric swatch detection — products that are just fabric/finish names, not real furniture
function isFabricSwatch(product) {
  const cat = (product.category || "").toLowerCase();
  if (cat === "decorative-objects" && !product.description) return true;
  // "Endure Velvet Midnight" pattern — fabric brand + color with no furniture term
  if (/^endure\s+velvet\s+\w+$/i.test(product.product_name || "")) return true;
  return false;
}

/**
 * Build catalog field index from all products.
 * Collects unique values with counts for every searchable AI field.
 */
export function buildCatalogIndex(products) {
  // Convert to array if iterator
  const productArray = Array.isArray(products) ? products : [...products];

  catalogFieldIndex = {};
  let totalTagged = 0;
  let totalUntagged = 0;
  const priceByType = {};

  // Collect all field values in a single pass through products
  const fieldTermMaps = {};
  for (const fieldName of Object.keys(FIELD_ACCESSORS)) {
    if (fieldName === "ai_distinctive_features") continue;
    fieldTermMaps[fieldName] = {};
  }
  const featureTerms = {};

  for (const p of productArray) {
    // Skip samples/swatches from catalog index
    if (SAMPLE_KEYWORDS.test(p.product_name || "") || isFabricSwatch(p)) continue;

    if (p.ai_visual_analysis) totalTagged++;
    else totalUntagged++;

    // Collect string field values
    for (const [fieldName, accessor] of Object.entries(FIELD_ACCESSORS)) {
      if (fieldName === "ai_distinctive_features") continue;
      const val = accessor(p);
      if (!val || typeof val !== "string") continue;

      const terms = fieldTermMaps[fieldName];
      if (fieldName === "vendor_name") {
        terms[val] = (terms[val] || 0) + 1;
      } else {
        // Split compound values (e.g., "velvet or linen-blend performance fabric")
        // into individual indexable terms, plus keep the full value
        const normalized = val.toLowerCase().trim();
        if (SKIP_VALUES.has(normalized)) continue;

        // Index the full value
        terms[normalized] = (terms[normalized] || 0) + 1;

        // Also index individual comma-separated parts
        if (normalized.includes(",")) {
          for (const part of normalized.split(",")) {
            const trimmed = part.trim();
            if (trimmed && !SKIP_VALUES.has(trimmed) && trimmed !== normalized) {
              terms[trimmed] = (terms[trimmed] || 0) + 1;
            }
          }
        }

        // Also index key material/style terms (split by "or", "and", "with")
        if (fieldName === "ai_primary_material" || fieldName === "ai_style") {
          for (const part of normalized.split(/\s+(?:or|and|with)\s+/)) {
            const trimmed = part.trim();
            if (trimmed && trimmed.length > 2 && !SKIP_VALUES.has(trimmed) && trimmed !== normalized) {
              terms[trimmed] = (terms[trimmed] || 0) + 1;
            }
          }
        }
      }
    }

    // Collect feature array values
    const features = p.ai_distinctive_features;
    if (Array.isArray(features)) {
      for (const f of features) {
        const fl = f.toLowerCase().trim();
        if (fl && !SKIP_VALUES.has(fl)) {
          featureTerms[fl] = (featureTerms[fl] || 0) + 1;
        }
      }
    }

    // Price stats by furniture type
    if (p.retail_price && p.retail_price > 0 && p.ai_furniture_type) {
      const type = p.ai_furniture_type.toLowerCase().trim();
      if (!priceByType[type]) priceByType[type] = { min: Infinity, max: 0, sum: 0, count: 0 };
      priceByType[type].min = Math.min(priceByType[type].min, p.retail_price);
      priceByType[type].max = Math.max(priceByType[type].max, p.retail_price);
      priceByType[type].sum += p.retail_price;
      priceByType[type].count++;
    }
  }

  // Build sorted indexes per field
  for (const [fieldName, terms] of Object.entries(fieldTermMaps)) {
    const limit = FIELD_LIMITS[fieldName] || 50;
    catalogFieldIndex[fieldName] = Object.entries(terms)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }
  catalogFieldIndex.ai_distinctive_features = Object.entries(featureTerms)
    .sort((a, b) => b[1] - a[1])
    .slice(0, FIELD_LIMITS.ai_distinctive_features);

  // Build the prompt text
  const formatField = (fieldName) => {
    const entries = catalogFieldIndex[fieldName] || [];
    return entries.map(([val, count]) => `${val} (${count})`).join(", ");
  };

  // Price ranges by type (top 20 types)
  const priceRanges = Object.entries(priceByType)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([type, stats]) => `${type}: $${stats.min}-$${stats.max} (avg $${Math.round(stats.sum / stats.count)})`)
    .join("\n");

  catalogIndexPromptText = `Catalog: ${totalTagged + totalUntagged} products (${totalTagged} AI-tagged, ${totalUntagged} untagged).

ai_furniture_type values: ${formatField("ai_furniture_type")}

ai_primary_material values: ${formatField("ai_primary_material")}

ai_distinctive_features values: ${formatField("ai_distinctive_features")}

ai_style values: ${formatField("ai_style")}

ai_primary_color values: ${formatField("ai_primary_color")}

ai_silhouette values: ${formatField("ai_silhouette")}

ai_arm_style values: ${formatField("ai_arm_style")}

ai_back_style values: ${formatField("ai_back_style")}

ai_leg_style values: ${formatField("ai_leg_style")}

ai_formality values: ${formatField("ai_formality")}

ai_scale values: ${formatField("ai_scale")}

ai_mood values: ${formatField("ai_mood")}

ai_cushions values: ${formatField("ai_cushions")}

ai_finish values: ${formatField("ai_finish")}

ai_era_influence values: ${formatField("ai_era_influence")}

ai_texture_description values: ${formatField("ai_texture_description")}

ai_construction_details values: ${formatField("ai_construction_details")}

ai_durability_assessment values: ${formatField("ai_durability_assessment")}

ai_visual_weight values: ${formatField("ai_visual_weight")}

ai_ideal_client values: ${formatField("ai_ideal_client")}

vendor_name values: ${formatField("vendor_name")}

Price ranges by furniture type:
${priceRanges}`;

  console.log(`[ai-vector-search] Catalog index built: ${totalTagged} tagged, ${totalUntagged} untagged products`);
  console.log(`[ai-vector-search] Index prompt size: ${catalogIndexPromptText.length} chars`);
  return catalogIndexPromptText;
}

// ── Haiku System Prompt ──

function getSystemPrompt() {
  return `You are the search brain for SPEKD, an AI-powered trade furniture sourcing platform. You receive a designer's search query and return the exact field values from our catalog that match what they want.

Our product database has these searchable fields with these values:

${catalogIndexPromptText}

Your job: Read the designer's query and pick values from the lists above that match what they want. Use CONTAINS matching — your values will be checked with case-insensitive substring matching against product fields. So "leather" will match "distressed leather, top grain leather". Only populate fields the designer actually mentioned or implied. Leave everything else null — null means don't filter on that field.

For conversational follow-ups, full history is provided. Combine context from all previous messages naturally. If they said 'leather sofa' first then 'just from Baker' next, your response should include furniture_type, material, AND vendor.

You understand furniture deeply. You know:
- 'couch' means sofa
- 'coffee table' means cocktail table
- 'nailhead' means look in ai_distinctive_features for nailhead trim, brass nailheads
- 'mid century' is a style — use ai_style
- 'outdoor' is a QUALIFIER — include it in ai_furniture_type alongside the base type: ai_furniture_type: ['outdoor swivel', 'outdoor chair']. Use MULTIPLE short terms that will substring-match product names containing 'outdoor'. NEVER put 'outdoor' only in semantic_query — it is a hard physical distinction, not a vibe.
- WOOD SPECIES are materials, NOT colors: 'walnut', 'oak', 'mahogany', 'teak', 'maple', 'cherry', 'birch', 'ash', 'pine', 'cedar', 'ebony', 'rosewood', 'elm' → use ai_primary_material or ai_finish, NEVER ai_primary_color. Example: 'walnut dining table' → ai_primary_material: ['walnut'] NOT ai_primary_color
- 'art deco' is BOTH a style AND an era influence — use ai_style: ['art deco'] AND/OR ai_era_influence: ['art deco']
- Dimension requests like 'seats 8' means width 96+ inches. 'apartment size' means the designer wants a compact sofa — use ai_scale with ["small", "compact", "apartment"] but do NOT set width constraints (most products lack dimension data)
- Price requests like 'under $3000' or 'budget friendly' should set price_max
- Negations like 'not rustic' or 'hates brown' mean EXCLUDE those values via exclude_fields

═══════════════════════════════════════════════════════════════
RULE 0 — PHYSICAL ATTRIBUTE RULE (OVERRIDES ALL OTHER RULES)
═══════════════════════════════════════════════════════════════

Every physical construction attribute the designer mentions MUST become a hard field filter in search_fields. Physical attributes are NEVER semantic — they describe measurable, observable construction features that a product either has or does not have. They MUST go in search_fields, NEVER only in semantic_query.

PHYSICAL ATTRIBUTE → FIELD MAPPINGS:

BACK STYLES → ai_back_style:
  tight back, loose back, pillow back, tufted back, button back, channel back,
  camelback, wingback, ladder back, spindle back, cane back, open back
  USER SAYS → YOU SET: 'tight back sofa' → ai_back_style: ['tight back']

ARM STYLES → ai_arm_style:
  track arm, rolled arm, slope arm, flared arm, english arm, pad arm,
  tuxedo arm, shelter arm, set-back arm, curved arm, scooped arm,
  recessed arm, armless
  USER SAYS → YOU SET: 'track arm sofa' → ai_arm_style: ['track']

LEG STYLES → ai_leg_style:
  tapered leg, turned leg, cabriole leg, saber leg, straight leg,
  block leg, hairpin leg, metal leg, pedestal, trestle, sled base,
  splayed leg, bun foot
  USER SAYS → YOU SET: 'tapered leg chair' → ai_leg_style: ['tapered']

CUSHION TYPES → ai_cushions:
  spring down, down blend, foam, high-resilience foam, down wrapped,
  sinuous spring, eight-way hand-tied, bench cushion
  USER SAYS → YOU SET: 'spring down sofa' → ai_cushions: ['spring down']

SILHOUETTE → ai_silhouette:
  barrel, boxy, camelback, chesterfield, lawson, bridgewater,
  tuxedo, shelter, mid-century, slipper, parsons, waterfall
  USER SAYS → YOU SET: 'barrel chair' → ai_silhouette: ['barrel']

CONSTRUCTION DETAILS → ai_construction_details or ai_distinctive_features:
  eight-way hand-tied, sinuous spring, kiln-dried hardwood, mortise and tenon,
  dovetail, hand-carved, bench-made, channel tufting, button tufting,
  nailhead trim, welt detail
  USER SAYS → YOU SET: 'eight way hand tied sofa' → ai_construction_details: ['eight-way hand-tied']
  USER SAYS → YOU SET: 'nailhead dining chair' → ai_distinctive_features: ['nailhead']

SCALE → ai_scale:
  small, compact, apartment, oversized, large, petite
  USER SAYS → YOU SET: 'apartment size sofa' → ai_scale: ['small', 'compact', 'apartment']

FORMALITY → ai_formality:
  formal, casual, transitional
  USER SAYS → YOU SET: 'formal dining chair' → ai_formality: ['formal']

FINISH → ai_finish:
  Use ONLY when the designer explicitly names a finish: 'distressed', 'lacquered', 'cerused', 'wire-brushed', 'hand-rubbed'
  USER SAYS → YOU SET: 'cerused oak table' → ai_finish: ['cerused'], ai_primary_material: ['oak']

RULE 0 ENFORCEMENT: If a query contains ANY of the terms above, the corresponding field MUST appear in search_fields. Putting a physical attribute only in semantic_query is a CRITICAL ERROR. Physical attributes are hard AND filters — the product must literally have that construction feature.

═══════════════════════════════════════════════════════════════

CRITICAL RULES FOR FIELD SELECTION:

1. ONLY populate fields the user EXPLICITLY mentioned or directly implied. If the user says 'leather sofa' you populate ai_furniture_type and ai_primary_material. You do NOT add ai_formality, ai_back_style, ai_cushions, or any other field the user didn't mention.

2. Abstract concepts like 'comfortable', 'luxury', 'kid friendly', 'cozy', 'quiet luxury', 'mountain house', 'inviting', 'glamorous', 'dramatic', 'fresh', 'airy', 'statement', 'bold', 'sophisticated' should go into the semantic_query string for vector ranking — NOT into search_fields. These are vibe words that should influence ranking, not hard filtering.

3. When in doubt between abstract vibes vs physical attributes, Rule 0 wins. 'Track arm' is physical → search_fields. 'Comfortable' is abstract → semantic_query. NEVER confuse the two.

4. The 3-field limit applies ONLY to non-physical fields (style, color, mood, material). Physical construction attributes (arm style, back style, leg style, cushions, silhouette, construction details, formality, scale) do NOT count toward this limit. A query like 'tight back track arm tapered leg sofa' should use ALL of: ai_furniture_type + ai_back_style + ai_arm_style + ai_leg_style — that's 4 fields and it's correct.

5. Negations and exclusions go in exclude_fields. 'Not modern' → exclude_fields.ai_style: ['modern']. 'No tufting' → exclude_fields.ai_distinctive_features: ['tufted', 'tufting']. 'Without nailheads' → exclude_fields.ai_distinctive_features: ['nailhead']. 'Armless' is NOT a negation — it IS an arm style, use ai_arm_style: ['armless']. IMPORTANT: Use SHORT exclude terms — 'mid-century' not 'mid-century modern', 'glass' not 'glass top'. Short terms catch more via substring matching.

6. Use values that EXIST in the lists above. Use substring terms that would match via contains.

7. For ai_distinctive_features, use short terms like "nailhead", "channel", "tufted" — they match via contains against feature strings.

8. You can provide MULTIPLE values per field — any match counts (OR logic within a field). ALL non-null fields must match (AND logic between fields).

9. COMBINATION QUERIES: When a designer specifies multiple physical attributes, ALL become hard filters. 'Track arm tight back sofa' → ai_furniture_type: ['sofa'] + ai_arm_style: ['track'] + ai_back_style: ['tight back']. Every physical attribute is an AND filter. Products must match ALL of them.

10. For ai_scale, use short individual terms like ["small"], ["compact"] — NOT compound phrases. "Statement" is a vibe word for semantic_query.

11. IMPORTANT: Most products lack price and dimension data. Use price_min/price_max and width/height/depth constraints sparingly.

12. NEVER combine ai_style + ai_primary_material + ai_primary_color + ai_finish all in the same query. Pick the 1-2 most important and put the rest in semantic_query. But physical attribute fields are EXEMPT from this rule.

13. BRAND + TYPE QUERIES: 'Hooker sofas' → ai_furniture_type: ['sofa'] + vendor_name: ['Hooker Furniture']. Return ONLY the exact furniture type, do NOT expand to other types. NEVER interpret a brand+type query as a room or collection query.

14. PLURAL FORMS: 'sofas' → sofa, 'chairs' → chair, 'tables' → table. Use singular in ai_furniture_type.

15. YOU MUST ALWAYS USE search_fields for concrete attributes. NEVER return empty search_fields when the user mentions a furniture type, material, style, vendor, or physical attribute. These are the backbone of search accuracy.

SEMANTIC_QUERY ONLY — these concepts NEVER go in search_fields:
comfortable, luxury, cozy, inviting, statement, bold, dramatic, glamorous,
airy, fresh, sophisticated, quiet luxury, kid friendly, family friendly,
mountain house, coastal, beachy, resort, boutique hotel, magazine-worthy

EXAMPLES:

── Physical Attribute Examples (Rule 0) ──

User: 'track arm sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_arm_style: ['track'] }
exclude_fields: {}
semantic_query: 'track arm sofa clean lines modern upholstered seating'
(track arm is PHYSICAL → ai_arm_style hard filter)

User: 'tight back leather sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_back_style: ['tight back'], ai_primary_material: ['leather'] }
exclude_fields: {}
semantic_query: 'tight back leather sofa tailored structured upholstery'
(tight back is PHYSICAL → ai_back_style, leather → ai_primary_material)

User: 'pillow back sectional'
search_fields: { ai_furniture_type: ['sectional'], ai_back_style: ['pillow back'] }
exclude_fields: {}
semantic_query: 'pillow back sectional comfortable plush generous cushioning'
(pillow back is PHYSICAL → ai_back_style)

User: 'barrel accent chair'
search_fields: { ai_furniture_type: ['accent chair'], ai_silhouette: ['barrel'] }
exclude_fields: {}
semantic_query: 'barrel silhouette accent chair curved enveloping form'
(barrel is PHYSICAL silhouette → ai_silhouette)

User: 'chesterfield sofa leather'
search_fields: { ai_furniture_type: ['sofa'], ai_silhouette: ['chesterfield'], ai_primary_material: ['leather'] }
exclude_fields: {}
semantic_query: 'chesterfield sofa leather tufted classic traditional'
(chesterfield is PHYSICAL silhouette → ai_silhouette)

User: 'tapered leg dining chair'
search_fields: { ai_furniture_type: ['dining chair'], ai_leg_style: ['tapered'] }
exclude_fields: {}
semantic_query: 'dining chair with tapered legs refined elegant'
(tapered leg is PHYSICAL → ai_leg_style)

User: 'cabriole leg accent chair'
search_fields: { ai_furniture_type: ['accent chair'], ai_leg_style: ['cabriole'] }
exclude_fields: {}
semantic_query: 'accent chair with cabriole legs traditional carved graceful'
(cabriole is PHYSICAL → ai_leg_style)

User: 'spring down cushion sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_cushions: ['spring down'] }
exclude_fields: {}
semantic_query: 'sofa with spring down cushions comfortable supportive premium'
(spring down is PHYSICAL → ai_cushions)

User: 'down blend sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_cushions: ['down blend', 'down'] }
exclude_fields: {}
semantic_query: 'sofa with down blend cushions soft plush sink-in comfort'
(down blend is PHYSICAL → ai_cushions)

User: 'eight way hand tied sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_construction_details: ['eight-way hand-tied'] }
exclude_fields: {}
semantic_query: 'eight way hand tied sofa premium construction heirloom quality'
(eight way hand tied is PHYSICAL construction → ai_construction_details)

User: 'nailhead dining chair'
search_fields: { ai_furniture_type: ['dining chair'], ai_distinctive_features: ['nailhead'] }
exclude_fields: {}
semantic_query: 'dining chair with nailhead trim detail traditional craftsmanship'
(nailhead is PHYSICAL feature → ai_distinctive_features)

User: 'channel tufted accent chair'
search_fields: { ai_furniture_type: ['accent chair'], ai_distinctive_features: ['channel'] }
exclude_fields: {}
semantic_query: 'channel tufted accent chair glamorous vertical stitching'
(channel tufting is PHYSICAL feature → ai_distinctive_features)

User: 'button tufted sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_distinctive_features: ['button tufted', 'tufted'] }
exclude_fields: {}
semantic_query: 'button tufted sofa classic traditional deep tufting'
(button tufting is PHYSICAL feature → ai_distinctive_features)

User: 'formal dining chair'
search_fields: { ai_furniture_type: ['dining chair'], ai_formality: ['formal'] }
exclude_fields: {}
semantic_query: 'formal dining chair elegant refined traditional dining room'
(formal is PHYSICAL attribute → ai_formality)

User: 'casual sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_formality: ['casual'] }
exclude_fields: {}
semantic_query: 'casual relaxed sofa comfortable laid-back living room'
(casual is PHYSICAL attribute → ai_formality)

User: 'apartment size sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_scale: ['small', 'compact', 'apartment'] }
exclude_fields: {}
semantic_query: 'apartment size compact sofa small space living room'
(apartment size is PHYSICAL scale → ai_scale)

User: 'oversized sectional'
search_fields: { ai_furniture_type: ['sectional'], ai_scale: ['oversized', 'large'] }
exclude_fields: {}
semantic_query: 'oversized large sectional generous deep seating family room'
(oversized is PHYSICAL scale → ai_scale)

User: 'slipper chair velvet'
search_fields: { ai_furniture_type: ['accent chair', 'slipper chair'], ai_silhouette: ['slipper'], ai_primary_material: ['velvet'] }
exclude_fields: {}
semantic_query: 'slipper chair velvet armless low profile elegant'
(slipper is PHYSICAL silhouette → ai_silhouette)

User: 'parsons dining chair'
search_fields: { ai_furniture_type: ['dining chair'], ai_silhouette: ['parsons'] }
exclude_fields: {}
semantic_query: 'parsons dining chair fully upholstered clean simple lines'
(parsons is PHYSICAL silhouette → ai_silhouette)

User: 'lawson sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_silhouette: ['lawson'] }
exclude_fields: {}
semantic_query: 'lawson sofa classic comfortable loose back set-back arm'
(lawson is PHYSICAL silhouette → ai_silhouette)

User: 'cerused oak dining table'
search_fields: { ai_furniture_type: ['dining table'], ai_finish: ['cerused'], ai_primary_material: ['oak'] }
exclude_fields: {}
semantic_query: 'cerused oak dining table textured whitewashed grain visible'
(cerused is PHYSICAL finish → ai_finish)

── Combination Physical Attribute Examples ──

User: 'track arm tight back sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_arm_style: ['track'], ai_back_style: ['tight back'] }
exclude_fields: {}
semantic_query: 'track arm tight back sofa clean modern tailored structured'
(BOTH physical attributes are hard AND filters)

User: 'rolled arm pillow back sofa performance fabric'
search_fields: { ai_furniture_type: ['sofa'], ai_arm_style: ['rolled'], ai_back_style: ['pillow back'], ai_primary_material: ['performance fabric'] }
exclude_fields: {}
semantic_query: 'rolled arm pillow back sofa performance fabric comfortable traditional'
(4 fields — all explicitly mentioned, physical attributes exempt from 3-field limit)

User: 'tight back tapered leg accent chair leather'
search_fields: { ai_furniture_type: ['accent chair'], ai_back_style: ['tight back'], ai_leg_style: ['tapered'], ai_primary_material: ['leather'] }
exclude_fields: {}
semantic_query: 'tight back leather accent chair tapered legs refined modern'
(4 fields all explicitly named — correct)

User: 'barrel chair with hairpin legs velvet'
search_fields: { ai_furniture_type: ['accent chair'], ai_silhouette: ['barrel'], ai_leg_style: ['hairpin'], ai_primary_material: ['velvet'] }
exclude_fields: {}
semantic_query: 'barrel chair hairpin legs velvet mid-century modern retro'
(4 fields — barrel=silhouette, hairpin=leg, velvet=material)

User: 'mid century track arm leather sofa tapered legs'
search_fields: { ai_furniture_type: ['sofa'], ai_style: ['mid-century'], ai_arm_style: ['track'], ai_primary_material: ['leather'], ai_leg_style: ['tapered'] }
exclude_fields: {}
semantic_query: 'mid century modern track arm leather sofa tapered legs retro'
(5 fields — all explicitly named by the designer)

User: 'formal tufted wingback chair with cabriole legs'
search_fields: { ai_furniture_type: ['accent chair', 'wing chair'], ai_formality: ['formal'], ai_distinctive_features: ['tufted'], ai_back_style: ['wingback'], ai_leg_style: ['cabriole'] }
exclude_fields: {}
semantic_query: 'formal tufted wingback chair cabriole legs traditional elegant'
(5 fields — every physical attribute the designer specified)

── Negation Examples ──

User: 'sofa not modern no tufting'
search_fields: { ai_furniture_type: ['sofa'] }
exclude_fields: { ai_style: ['modern', 'contemporary'], ai_distinctive_features: ['tufted', 'tufting'] }
semantic_query: 'sofa classic traditional clean untufted'
(not modern → exclude style, no tufting → exclude features)

User: 'accent chair without nailheads not traditional'
search_fields: { ai_furniture_type: ['accent chair'] }
exclude_fields: { ai_distinctive_features: ['nailhead'], ai_style: ['traditional'] }
semantic_query: 'accent chair modern clean lines no nailhead trim'
(without nailheads → exclude, not traditional → exclude)

User: 'leather sofa no rolled arms'
search_fields: { ai_furniture_type: ['sofa'], ai_primary_material: ['leather'] }
exclude_fields: { ai_arm_style: ['rolled'] }
semantic_query: 'leather sofa modern arms clean structured'
(no rolled arms → exclude ai_arm_style)

User: 'dining table avoid glass not modern'
search_fields: { ai_furniture_type: ['dining table'] }
exclude_fields: { ai_primary_material: ['glass'], ai_style: ['modern', 'contemporary'] }
semantic_query: 'dining table solid wood or stone traditional transitional'
(avoid glass → exclude material, not modern → exclude style)

User: 'sectional no loose back cushions'
search_fields: { ai_furniture_type: ['sectional'] }
exclude_fields: { ai_back_style: ['loose back', 'pillow back'] }
semantic_query: 'sectional with structured tight back clean tailored'
(no loose back → exclude ai_back_style)

── Outdoor/Indoor Qualifier Examples ──

User: 'outdoor swivel chairs'
search_fields: { ai_furniture_type: ['outdoor swivel', 'outdoor chair'] }
exclude_fields: {}
semantic_query: 'outdoor swivel chair patio weather resistant UV rated'
(outdoor MUST be in ai_furniture_type as multiple short terms for max coverage — matches "Outdoor Swivel Chair", "Outdoor Swivel Chaise", etc.)

User: 'outdoor dining table teak'
search_fields: { ai_furniture_type: ['outdoor dining', 'outdoor table'], ai_primary_material: ['teak'] }
exclude_fields: {}
semantic_query: 'outdoor teak dining table weather resistant patio garden'
(multiple short outdoor terms for broad matching)

User: 'outdoor sofa'
search_fields: { ai_furniture_type: ['outdoor sofa', 'outdoor loveseat', 'outdoor sectional'] }
exclude_fields: {}
semantic_query: 'outdoor sofa patio weather resistant seating'
(include related outdoor seating types for coverage)

── Standard Examples ──

User: 'hooker sofas'
search_fields: { ai_furniture_type: ['sofa'], vendor_name: ['Hooker Furniture'] }
exclude_fields: {}
semantic_query: 'Hooker Furniture sofa high quality upholstered seating'
(ONLY sofa — do NOT expand to other types)

User: 'baker dining chairs'
search_fields: { ai_furniture_type: ['dining chair'], vendor_name: ['Baker Furniture'] }
exclude_fields: {}
semantic_query: 'Baker Furniture dining chair formal elegant craftsmanship'
(ONLY dining chair from Baker)

User: 'comfortable leather sofa'
search_fields: { ai_furniture_type: ['sofa'], ai_primary_material: ['leather'] }
exclude_fields: {}
semantic_query: 'comfortable inviting leather sofa with generous proportions and soft cushions'
(comfortable is ABSTRACT → semantic_query only)

User: 'quiet luxury accent chair'
search_fields: { ai_furniture_type: ['accent chair'] }
exclude_fields: {}
semantic_query: 'quiet luxury refined sophisticated accent chair premium quality understated elegance'
(quiet luxury is ABSTRACT → semantic_query only)

User: 'kid friendly sectional performance fabric not modern'
search_fields: { ai_furniture_type: ['sectional'], ai_primary_material: ['performance fabric'] }
exclude_fields: { ai_style: ['modern', 'contemporary'] }
semantic_query: 'durable family friendly sectional in performance fabric'
(kid friendly is ABSTRACT → semantic_query)

User: 'traditional walnut dining table seats 8'
search_fields: { ai_furniture_type: ['dining table'], ai_style: ['traditional'], ai_primary_material: ['walnut'] }
exclude_fields: {}
semantic_query: 'traditional walnut dining table large seats eight formal dining room'
(walnut is wood material → ai_primary_material, NOT color)

User: 'something like the RH cloud sofa but not RH'
search_fields: { ai_furniture_type: ['sofa'] }
exclude_fields: { vendor_name: ['Restoration Hardware'] }
semantic_query: 'deep plush oversized sofa with loose pillow back and down cushions cloud-like comfort'

User: 'glamorous Hollywood Regency living room'
search_fields: { ai_furniture_type: ['sofa', 'accent chair', 'cocktail table', 'side table'], ai_style: ['hollywood regency'] }
exclude_fields: {}
semantic_query: 'glamorous hollywood regency velvet gold dramatic luxe jewel tones brass accents opulent'
(ONLY expand to multiple types when user asks for a ROOM)

User: 'accent chair that makes a statement'
search_fields: { ai_furniture_type: ['accent chair'] }
exclude_fields: {}
semantic_query: 'statement accent chair with visual impact architectural form bold but refined'
(statement is ABSTRACT → semantic_query only, NOT ai_scale or ai_visual_weight)

Return ONLY this JSON (no markdown, no backticks):
{
  "search_fields": {
    "ai_furniture_type": ["value1", "value2"] or null,
    "ai_primary_material": ["value1"] or null,
    "ai_distinctive_features": ["value1", "value2"] or null,
    "ai_style": ["value1"] or null,
    "ai_primary_color": ["value1", "value2"] or null,
    "ai_silhouette": ["value1"] or null,
    "ai_arm_style": ["value1"] or null,
    "ai_back_style": ["value1"] or null,
    "ai_leg_style": ["value1"] or null,
    "ai_formality": ["value1"] or null,
    "ai_scale": ["value1"] or null,
    "ai_mood": ["value1"] or null,
    "ai_cushions": ["value1"] or null,
    "ai_finish": ["value1"] or null,
    "ai_era_influence": ["value1"] or null,
    "ai_texture_description": ["value1"] or null,
    "ai_construction_details": ["value1"] or null,
    "ai_durability_assessment": ["value1"] or null,
    "ai_visual_weight": ["value1"] or null,
    "ai_ideal_client": ["value1"] or null,
    "vendor_name": ["Exact Vendor Name"] or null,
    "price_min": number or null,
    "price_max": number or null,
    "width_min": number or null,
    "width_max": number or null,
    "height_min": number or null,
    "height_max": number or null,
    "depth_min": number or null,
    "depth_max": number or null
  },
  "exclude_fields": {
    "ai_style": ["rustic"] or null,
    "ai_primary_color": ["brown", "espresso"] or null,
    "ai_primary_material": ["velvet"] or null,
    "ai_arm_style": ["rolled"] or null,
    "ai_back_style": ["loose back"] or null,
    "ai_leg_style": ["turned"] or null,
    "ai_distinctive_features": ["tufted", "nailhead"] or null,
    "ai_cushions": ["down"] or null,
    "ai_formality": ["formal"] or null,
    "vendor_name": ["Restoration Hardware"] or null
  },
  "semantic_query": "natural language description of the ideal product for ranking",
  "response": "Your expert commentary (see EXPERT RESPONSE RULES below)"
}

EXPERT RESPONSE RULES:
Your response should sound like a veteran interior design trade rep who knows every vendor deeply. Be specific, be useful, be concise. Maximum 3 sentences. Always add at least one piece of proactive expert knowledge the designer might not have thought to ask.

Proactive knowledge triggers — mention these when relevant:
- White or light upholstery → mention performance fabric options for client satisfaction
- Leather query → mention top-grain vs full-grain durability differences
- Family with kids mentioned → surface durability info, mention fabric rub counts
- Dining chairs → mention 18 inch seat height to 30 inch table standard, flag chairs that run tall or short
- Outdoor → mention UV resistance and truly outdoor-rated vs outdoor-inspired
- Custom order vendors (Hickory Chair, CR Laine, Vanguard, Norwalk) → mention 12-16 week lead times for project planning
- Small space → mention how pieces read in person vs photography, scale matters
- High gloss or lacquer → mention fingerprint and maintenance considerations
- Boucle or textured fabric → mention wear patterns, consider client lifestyle
- Sectional → mention most can be configured multiple ways, check with vendor
- Baker, Hickory Chair, Theodore Alexander, Hancock & Moore → heritage brands, briefly mention craftsmanship when relevant
- Wesley Hall → mention they are the nailhead specialists in the trade
- Bernhardt → mention strong value proposition in the premium tier

NEVER in the response field:
- Say "Great choice!" or any hollow affirmation
- Repeat back what the designer searched for
- Give generic advice that applies to any category
- Use more than 3 sentences
- Sound like a chatbot or search engine confirmation`;
}

function getListSystemPrompt() {
  return `You are the search brain for SPEKD, an AI-powered trade furniture sourcing platform. A designer has pasted a list of items they need to source.

Our catalog fields: ai_furniture_type, ai_primary_material, ai_distinctive_features, ai_style, ai_primary_color, ai_silhouette, ai_arm_style, ai_back_style, ai_formality, ai_mood, vendor_name.

${catalogIndexPromptText}

For each item, return search_fields using values from our catalog. Use contains-matching terms.

Return ONLY this JSON (no markdown, no backticks):
{
  "items": [
    {
      "search_fields": { "ai_furniture_type": ["sectional"], "ai_primary_material": ["performance fabric"] },
      "exclude_fields": {},
      "semantic_query": "large performance fabric sectional neutral tones",
      "label": "Sectional - performance fabric neutral"
    }
  ],
  "response": "Expert trade rep commentary — max 3 sentences, specific and useful, no hollow affirmations"
}`;
}

// ── Result Cache ──
const queryCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000;

function getCached(key) {
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    queryCache.delete(key);
    return null;
  }
  return entry.value;
}

function setQueryCache(key, value) {
  queryCache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
  if (queryCache.size > 300) {
    const now = Date.now();
    for (const [k, v] of queryCache) {
      if (now > v.expires) queryCache.delete(k);
    }
  }
}

// ── Haiku API Call ──

/**
 * Call Haiku to translate query into search_fields + semantic_query.
 */
export async function translateQueryWithHaiku(query, conversationHistory = []) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[ai-vector-search] No API key — using raw query fallback");
    return {
      search_fields: {},
      exclude_fields: {},
      semantic_query: query,
      response: "Searching catalog...",
    };
  }

  const messages = [];
  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }
  messages.push({ role: "user", content: query });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const callStart = Date.now();

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1200,
        system: getSystemPrompt(),
        messages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ai-vector-search] Haiku API error ${resp.status}: ${errText.slice(0, 200)}`);
      return { search_fields: {}, exclude_fields: {}, semantic_query: query, response: "Searching catalog..." };
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[ai-vector-search] Haiku returned non-JSON:", text.slice(0, 200));
      return { search_fields: {}, exclude_fields: {}, semantic_query: query, response: "Searching catalog..." };
    }

    console.log(`[ai-vector-search] Haiku responded in ${Date.now() - callStart}ms`);
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      search_fields: parsed.search_fields || {},
      exclude_fields: parsed.exclude_fields || {},
      semantic_query: parsed.semantic_query || query,
      response: parsed.response || "Here are your results.",
    };
  } catch (err) {
    console.error(`[ai-vector-search] Haiku call failed: ${err.message}`);
    // Safety net: fall back to raw vector search
    return { search_fields: {}, exclude_fields: {}, semantic_query: query, response: "Showing best matches for your search." };
  }
}

/**
 * Call Haiku for paste list search.
 */
export async function translateListWithHaiku(items) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      items: items.map(item => ({
        search_fields: {},
        exclude_fields: {},
        semantic_query: item,
        label: item,
      })),
      response: "Searching catalog for each item...",
    };
  }

  const listText = items.map((item, i) => `${i + 1}. ${item}`).join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const resp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 3000,
        system: getListSystemPrompt(),
        messages: [{ role: "user", content: listText }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        items: items.map(item => ({ search_fields: {}, exclude_fields: {}, semantic_query: item, label: item })),
        response: "Searching catalog for each item...",
      };
    }

    const data = await resp.json();
    const text = data.content?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        items: items.map(item => ({ search_fields: {}, exclude_fields: {}, semantic_query: item, label: item })),
        response: "Searching catalog for each item...",
      };
    }

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`[ai-vector-search] List parse failed: ${err.message}`);
    return {
      items: items.map(item => ({ search_fields: {}, exclude_fields: {}, semantic_query: item, label: item })),
      response: "Searching catalog for each item...",
    };
  }
}

// ── Field Matching Engine ──

/**
 * Check if a product field value contains any of the search terms.
 * For string fields: case-insensitive substring match.
 * For array fields (ai_distinctive_features): any element contains any term.
 */
function fieldContains(productValue, searchTerms) {
  if (!searchTerms || searchTerms.length === 0) return true;

  // Product MUST have the field to match — missing field = no match
  if (!productValue) return false;

  if (Array.isArray(productValue)) {
    if (productValue.length === 0) return false;
    const joined = productValue.join(" ").toLowerCase();
    return searchTerms.some(term => joined.includes(term.toLowerCase()));
  }

  if (typeof productValue === "string") {
    if (productValue.trim() === "") return false;
    const valLower = productValue.toLowerCase();
    return searchTerms.some(term => valLower.includes(term.toLowerCase()));
  }

  return false;
}

/**
 * Check if a product field value does NOT contain any of the excluded terms.
 */
function fieldExcludes(productValue, excludeTerms) {
  if (!productValue || !excludeTerms || excludeTerms.length === 0) return true;

  if (Array.isArray(productValue)) {
    const joined = productValue.join(" ").toLowerCase();
    return excludeTerms.every(term => !joined.includes(term.toLowerCase()));
  }

  if (typeof productValue === "string") {
    const valLower = productValue.toLowerCase();
    return excludeTerms.every(term => !valLower.includes(term.toLowerCase()));
  }

  return true;
}

/**
 * Direct field matching — find all products matching the search_fields.
 * Product must match ALL non-null fields (AND between fields).
 * Within each field, any value matching counts (OR within field).
 */
function fieldMatch(searchFields, excludeFields, excludeIds) {
  const candidates = [];
  const allProducts = getAllProducts();

  // Extract dimension/price filters
  const priceMin = searchFields.price_min || null;
  const priceMax = searchFields.price_max || null;
  const widthMin = searchFields.width_min || null;
  const widthMax = searchFields.width_max || null;
  const heightMin = searchFields.height_min || null;
  const heightMax = searchFields.height_max || null;
  const depthMin = searchFields.depth_min || null;
  const depthMax = searchFields.depth_max || null;

  // Build list of field filters (only non-null fields)
  const fieldFilters = [];
  for (const [fieldName, accessor] of Object.entries(FIELD_ACCESSORS)) {
    const searchVals = searchFields[fieldName];
    if (searchVals && Array.isArray(searchVals) && searchVals.length > 0) {
      fieldFilters.push({ fieldName, accessor, searchVals });
    }
  }

  // Build list of exclude filters
  const excludeFilters = [];
  if (excludeFields) {
    for (const [fieldName, accessor] of Object.entries(FIELD_ACCESSORS)) {
      const excludeVals = excludeFields[fieldName];
      if (excludeVals && Array.isArray(excludeVals) && excludeVals.length > 0) {
        excludeFilters.push({ fieldName, accessor, excludeVals });
      }
    }
  }

  let scanned = 0;
  for (const product of allProducts) {
    scanned++;

    // Exclude by ID
    if (excludeIds && excludeIds.size > 0 && excludeIds.has(product.id)) continue;

    // Exclude samples, swatches, catalogs by product name
    const pName = product.product_name || "";
    if (SAMPLE_KEYWORDS.test(pName) || isFabricSwatch(product)) continue;

    // Price filters
    if (priceMin && product.retail_price && product.retail_price < priceMin) continue;
    if (priceMax && product.retail_price && product.retail_price > priceMax) continue;

    // Dimension filters
    if (widthMin && product.width && product.width < widthMin) continue;
    if (widthMax && product.width && product.width > widthMax) continue;
    if (heightMin && product.height && product.height < heightMin) continue;
    if (heightMax && product.height && product.height > heightMax) continue;
    if (depthMin && product.depth && product.depth < depthMin) continue;
    if (depthMax && product.depth && product.depth > depthMax) continue;

    // All search fields must match (AND logic)
    let matchesAll = true;
    for (const { fieldName, accessor, searchVals } of fieldFilters) {
      const val = accessor(product);
      if (val != null) {
        // Primary AI field has a value — use it directly
        if (!fieldContains(val, searchVals)) {
          matchesAll = false;
          break;
        }
      } else {
        // Primary AI field is null/undefined — try fallback ONLY for category-level fields.
        // Feature-specific fields (distinctive_features, arm_style, back_style, etc.)
        // must NOT use fallbacks — we can't verify an untagged product has those features.
        const FALLBACK_ALLOWED_FIELDS = new Set(["ai_furniture_type", "ai_style", "ai_primary_color"]);
        if (FALLBACK_ALLOWED_FIELDS.has(fieldName)) {
          const fallback = FIELD_FALLBACKS[fieldName];
          if (fallback) {
            const fbVal = fallback(product);
            if (!fieldContains(fbVal, searchVals)) {
              matchesAll = false;
              break;
            }
          } else {
            matchesAll = false;
            break;
          }
        } else {
          // No fallback for feature-specific fields — untagged product can't match
          matchesAll = false;
          break;
        }
      }
    }
    if (!matchesAll) continue;

    // No excluded fields should match (check primary AI field + fallback)
    let excluded = false;
    for (const { fieldName, accessor, excludeVals } of excludeFilters) {
      const val = accessor(product);
      if (val != null) {
        if (!fieldExcludes(val, excludeVals)) {
          excluded = true;
          break;
        }
      } else {
        // Primary field is null — also check fallback for exclude
        const fallback = FIELD_FALLBACKS[fieldName];
        if (fallback) {
          const fbVal = fallback(product);
          if (fbVal && !fieldExcludes(fbVal, excludeVals)) {
            excluded = true;
            break;
          }
        }
      }
    }
    if (excluded) continue;

    candidates.push(product);
  }

  console.log(`[ai-vector-search] Field match: ${candidates.length} candidates from ${scanned} products (${fieldFilters.length} field filters, ${excludeFilters.length} exclude filters)`);
  return candidates;
}

// ── Search Pipeline ──

/**
 * Complete search pipeline: Query → Haiku → Field Match → MiniLM Rank → Results.
 */
export async function searchPipeline(query, options = {}) {
  const { conversation = [], excludeIds = new Set(), page = 1, filters = {} } = options;

  // ── Check cache ──
  const cacheKey = `fsearch:${query.toLowerCase()}:${JSON.stringify(filters)}:p${page}`;
  if (excludeIds.size === 0 && conversation.length === 0) {
    const cached = getCached(cacheKey);
    if (cached) return { ...cached, cache_hit: true };
  }

  // ── Step 1: Haiku translates query → search_fields + semantic_query ──
  const haiku = await translateQueryWithHaiku(query, conversation);
  const hasFieldFilters = Object.values(haiku.search_fields).some(v =>
    v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0) && typeof v !== "number"
  );

  console.log("\n=== SEARCH DIAGNOSTIC ===");
  console.log("Query:", query);
  console.log("Haiku search_fields:", JSON.stringify(haiku.search_fields, null, 2));
  console.log("Haiku exclude_fields:", JSON.stringify(haiku.exclude_fields, null, 2));
  console.log("Haiku semantic_query:", haiku.semantic_query);
  console.log("Has field filters:", hasFieldFilters);

  let results = [];
  const vectorStats = getVectorStoreStats();

  if (hasFieldFilters) {
    // ── Step 2: Direct field matching ──
    let candidates = fieldMatch(haiku.search_fields, haiku.exclude_fields, excludeIds);
    console.log("Field match candidates:", candidates.length);

    // ── Auto-relax: if too few results and multiple filters, drop restrictive filters ──
    if (candidates.length < 10) {
      // Physical construction fields (arm_style, back_style, leg_style, cushions, silhouette,
      // construction_details, formality) are PROTECTED from auto-relax — they are hard filters.
      // Only drop non-physical fields first. Physical fields are dropped LAST as a final resort.
      const relaxOrder = ["ai_finish", "ai_primary_color", "ai_texture_description",
        "ai_visual_weight", "ai_ideal_client", "ai_durability_assessment",
        "ai_mood", "ai_era_influence", "ai_primary_material",
        "ai_style", "ai_distinctive_features",
        // Physical construction fields — protected, only dropped as last resort
        "ai_scale", "ai_formality", "ai_cushions", "ai_silhouette",
        "ai_arm_style", "ai_back_style", "ai_leg_style", "ai_construction_details"];
      const activeFields = Object.keys(haiku.search_fields).filter(k =>
        haiku.search_fields[k] && Array.isArray(haiku.search_fields[k]) && haiku.search_fields[k].length > 0
      );
      if (activeFields.length >= 2) {
        const relaxed = { ...haiku.search_fields };
        for (const dropField of relaxOrder) {
          if (relaxed[dropField] && Array.isArray(relaxed[dropField]) && relaxed[dropField].length > 0) {
            console.log(`[auto-relax] Dropping ${dropField} (had ${candidates.length} results)`);
            relaxed[dropField] = null;
            candidates = fieldMatch(relaxed, haiku.exclude_fields, excludeIds);
            console.log(`[auto-relax] After dropping ${dropField}: ${candidates.length} candidates`);
            if (candidates.length >= 10) break;
            const remaining = Object.keys(relaxed).filter(k =>
              relaxed[k] && Array.isArray(relaxed[k]) && relaxed[k].length > 0
            );
            if (remaining.length <= 1) break;
          }
        }
      }

      // ── Final broadening: if still < 10 and only ai_furniture_type remains, split into word-level OR matching ──
      if (candidates.length < 10) {
        const ftVals = haiku.search_fields.ai_furniture_type;
        if (ftVals && Array.isArray(ftVals) && ftVals.length > 0) {
          const words = new Set();
          for (const v of ftVals) {
            for (const w of v.toLowerCase().split(/\s+/)) {
              if (w.length > 2) words.add(w);
            }
          }
          if (words.size > 0) {
            console.log(`[auto-relax] Broadening furniture_type to word-level OR: ${[...words].join(", ")}`);
            const broadened = [];
            const allProducts = getAllProducts();
            for (const product of allProducts) {
              if (excludeIds && excludeIds.size > 0 && excludeIds.has(product.id)) continue;
              const pName = product.product_name || "";
              if (SAMPLE_KEYWORDS.test(pName) || isFabricSwatch(product)) continue;
              const ft = (product.ai_furniture_type || "").toLowerCase();
              const cat = (product.category || "").toLowerCase().replace(/-/g, " ");
              const name = pName.toLowerCase();
              const combined = `${ft} ${cat} ${name}`;
              let matchesAny = false;
              for (const w of words) {
                if (combined.includes(w)) { matchesAny = true; break; }
              }
              if (matchesAny) broadened.push(product);
            }
            if (broadened.length > candidates.length) {
              console.log(`[auto-relax] Broadened from ${candidates.length} to ${broadened.length} candidates`);
              candidates = broadened;
            }
          }
        }
      }
    }

    // ── Step 3: MiniLM ranking within candidates ──
    if (candidates.length > 0 && vectorStats.ready && vectorStats.total_vectors > 0 && haiku.semantic_query) {
      const candidateIds = new Set(candidates.map(p => p.id));
      const ranked = await vectorSearch(haiku.semantic_query, {
        limit: candidates.length,
        candidateIds,
      });

      // Build ranked results, preserving vector score
      const rankedMap = new Map(ranked.map(r => [r.id, r.score]));
      for (const product of candidates) {
        product.relevance_score = rankedMap.get(product.id) || 0;
        product._vector_score = product.relevance_score;
      }
      candidates.sort((a, b) => b.relevance_score - a.relevance_score);
      console.log("Vector ranked results:", ranked.length);
      console.log("Top 5 results:", candidates.slice(0, 5).map(p => `${p.product_name} (${p.vendor_name}, score: ${p.relevance_score?.toFixed(3)})`));
    } else {
      console.log("Vector ranking skipped — candidates:", candidates.length, "vectors ready:", vectorStats.ready);
    }

    // ── Vendor diversity: re-sort to avoid one vendor dominating results ──
    results = applyVendorDiversity(candidates);
    console.log("After vendor diversity:", results.length);
  } else {
    // ── Safety net: no field filters (Haiku failed or vibe search) ──
    // Fall back to pure vector search
    console.log("NO FIELD FILTERS — falling back to pure vector search");
    if (vectorStats.ready && vectorStats.total_vectors > 0) {
      const searchText = haiku.semantic_query || query;
      const rawResults = await vectorSearch(searchText, { limit: 200 });
      for (const { id, score } of rawResults) {
        const product = getProduct(id);
        if (product && !(excludeIds.size > 0 && excludeIds.has(id))) {
          // Skip samples/swatches/catalogs
          if (SAMPLE_KEYWORDS.test(product.product_name || "") || isFabricSwatch(product)) continue;
          product.relevance_score = score;
          product._vector_score = score;
          results.push(product);
        }
      }
      console.log("Fallback vector search:", results.length, "results");
    }
    results = applyVendorDiversity(results);
  }
  console.log("Final result count:", results.length);
  console.log("Haiku response:", (haiku.response || "").slice(0, 200));
  console.log("========================\n");

  // ── Step 4: Apply UI facet filters ──
  results = applyFacetFilters(results, filters);

  // ── Step 5: Build response ──
  const totalAvailable = results.length;
  const MAX_PAGE = 500;
  const pageResults = results.slice(0, MAX_PAGE);

  const response = {
    query,
    intent: { summary: haiku.response, product_type: null },
    ai_filter: null,
    ai_summary: haiku.response,
    assistant_message: haiku.response,
    total: pageResults.length,
    total_available: totalAvailable,
    has_more: totalAvailable > MAX_PAGE,
    page,
    result_mode: "ai-field-match",
    tier_used: 1,
    ai_called: true,
    cache_hit: false,
    facets: computeSimpleFacets(results),
    diagnostics: {
      ai_filter_used: true,
      total_catalog_size: getProductCount(),
      vector_indexed: vectorStats.total_vectors,
      tier_used: 1,
      search_fields: haiku.search_fields,
      exclude_fields: haiku.exclude_fields,
      semantic_query: haiku.semantic_query,
      field_match_count: totalAvailable,
      haiku_response: haiku.response,
    },
    products: pageResults,
  };

  // Cache (skip conversational searches)
  if (excludeIds.size === 0 && conversation.length === 0) {
    setQueryCache(cacheKey, response);
  }

  return response;
}

/**
 * Find similar products — pure vector similarity, cross-vendor diversity.
 */
export function findSimilar(productId, limit = 20) {
  const src = getProduct(productId);
  if (!src) return [];

  const srcVendor = src.vendor_id;
  const srcType = (src.ai_furniture_type || "").toLowerCase().trim();
  const srcStyle = (src.ai_style || "").toLowerCase().trim();
  const srcMaterial = (src.ai_primary_material || "").toLowerCase().trim();
  const srcColor = (src.ai_primary_color || "").toLowerCase().trim();
  const srcSilhouette = (src.ai_silhouette || "").toLowerCase().trim();
  const srcFormality = (src.ai_formality || "").toLowerCase().trim();
  const srcScale = (src.ai_scale || "").toLowerCase().trim();

  // Step 1: Find candidates that share the same furniture type (must match)
  // This ensures a sofa returns sofas, a dining table returns dining tables
  if (!srcType) {
    // No AI tags — fall back to pure vector similarity
    const filter = (id) => { const p = getProduct(id); return p && p.vendor_id !== srcVendor; };
    const results = vectorFindSimilar(productId, limit, filter);
    return results.map(({ id, score }) => {
      const product = getProduct(id);
      if (!product) return null;
      product.relevance_score = score;
      product._similarity = score;
      return product;
    }).filter(Boolean);
  }

  // Score every product by how many AI tag attributes match the source
  const allProducts = getAllProducts();
  const scored = [];

  for (const p of allProducts) {
    if (p.id === productId) continue;
    if (p.vendor_id === srcVendor) continue; // Different vendor only
    if (SAMPLE_KEYWORDS.test(p.product_name || "") || isFabricSwatch(p)) continue; // Skip samples

    const pType = (p.ai_furniture_type || "").toLowerCase().trim();
    // Must be same furniture type
    if (!pType || !typeMatches(pType, srcType)) continue;

    let score = 0;

    // Style match (strong signal)
    if (srcStyle && p.ai_style) {
      const pStyle = p.ai_style.toLowerCase();
      if (pStyle === srcStyle) score += 3;
      else if (pStyle.includes(srcStyle) || srcStyle.includes(pStyle)) score += 2;
    }

    // Material match (strong signal)
    if (srcMaterial && p.ai_primary_material) {
      const pMat = p.ai_primary_material.toLowerCase();
      const srcMatWords = srcMaterial.split(/[,\s]+/).filter(w => w.length > 2);
      const pMatWords = pMat.split(/[,\s]+/).filter(w => w.length > 2);
      const overlap = srcMatWords.filter(w => pMatWords.some(pw => pw.includes(w) || w.includes(pw)));
      if (overlap.length > 0) score += 2 + Math.min(overlap.length, 2);
    }

    // Color match (medium signal)
    if (srcColor && p.ai_primary_color) {
      const pColor = p.ai_primary_color.toLowerCase();
      if (pColor === srcColor) score += 2;
      else if (pColor.includes(srcColor) || srcColor.includes(pColor)) score += 1;
    }

    // Silhouette match (strong signal — looks alike)
    if (srcSilhouette && p.ai_silhouette) {
      const pSil = p.ai_silhouette.toLowerCase();
      const srcWords = srcSilhouette.split(/\s+/).filter(w => w.length > 3);
      const pWords = pSil.split(/\s+/).filter(w => w.length > 3);
      const overlap = srcWords.filter(w => pWords.includes(w));
      score += Math.min(overlap.length, 3);
    }

    // Formality match
    if (srcFormality && p.ai_formality) {
      if (p.ai_formality.toLowerCase() === srcFormality) score += 1;
    }

    // Scale match
    if (srcScale && p.ai_scale) {
      if (p.ai_scale.toLowerCase() === srcScale) score += 1;
    }

    // Price proximity (bonus for similar price range)
    if (src.retail_price && p.retail_price && src.retail_price > 0 && p.retail_price > 0) {
      const ratio = p.retail_price / src.retail_price;
      if (ratio >= 0.7 && ratio <= 1.4) score += 1;
    }

    if (score > 0) {
      scored.push({ product: p, tagScore: score });
    }
  }

  // Sort by tag score descending, take top candidates
  scored.sort((a, b) => b.tagScore - a.tagScore);
  const topCandidates = scored.slice(0, Math.max(limit * 4, 80));

  // Step 2: Re-rank top candidates by vector similarity for final ordering
  const candidateIds = new Set(topCandidates.map(c => c.product.id));
  const vectorResults = vectorFindSimilar(productId, limit * 4, (id) => candidateIds.has(id));
  const vectorScoreMap = new Map(vectorResults.map(r => [r.id, r.score]));
  const hasVectors = vectorScoreMap.size > 0;

  // Combine: 60% tag + 40% vector when vectors available, 100% tag otherwise
  const maxTagScore = topCandidates.length > 0 ? topCandidates[0].tagScore : 1;
  const combined = topCandidates.map(c => {
    const tagNorm = c.tagScore / maxTagScore;
    const vecScore = vectorScoreMap.get(c.product.id) || 0;
    const finalScore = hasVectors ? (tagNorm * 0.6 + vecScore * 0.4) : tagNorm;
    return { product: c.product, finalScore, tagScore: c.tagScore, vecScore };
  });

  combined.sort((a, b) => b.finalScore - a.finalScore);

  return combined.slice(0, limit).map(c => {
    c.product.relevance_score = c.finalScore;
    c.product._similarity = c.finalScore;
    c.product._tag_score = c.tagScore;
    return c.product;
  });
}

/** Check if two furniture types are equivalent (handles plurals, hyphens) */
function typeMatches(a, b) {
  const norm = (s) => s.replace(/s$/, "").replace(/-/g, " ").trim();
  return norm(a) === norm(b);
}

/**
 * List search pipeline — paste list → Haiku → field match + rank per item.
 */
export async function listSearchPipeline(items) {
  const haiku = await translateListWithHaiku(items);

  const results = [];
  for (const item of haiku.items) {
    const candidates = fieldMatch(item.search_fields || {}, item.exclude_fields || {});

    // Rank within candidates
    if (candidates.length > 0 && item.semantic_query) {
      const candidateIds = new Set(candidates.map(p => p.id));
      const ranked = await vectorSearch(item.semantic_query, {
        limit: Math.min(candidates.length, 20),
        candidateIds,
      });
      const rankedMap = new Map(ranked.map(r => [r.id, r.score]));
      for (const p of candidates) {
        p.relevance_score = rankedMap.get(p.id) || 0;
      }
      candidates.sort((a, b) => b.relevance_score - a.relevance_score);
    }

    const topProducts = candidates.slice(0, 20);
    results.push({
      item_number: results.length + 1,
      original_text: item.original_text || item.label,
      summary: item.label,
      products: topProducts,
      total: topProducts.length,
      feasibility: topProducts.length >= 5 ? "strong" : topProducts.length >= 1 ? "possible" : "unlikely",
    });
  }

  return {
    overview_message: haiku.response,
    items: results,
    total_items: results.length,
    total_products: results.reduce((sum, r) => sum + r.products.length, 0),
  };
}

// ── Internal helpers ──

/**
 * Re-sort results for vendor diversity. Greedy selection: at each step, pick
 * the highest-scoring remaining product after applying a penalty based on how
 * many products from that vendor have already been selected.
 *
 * Penalty: each prior selection from the same vendor reduces the effective
 * score by 3%. This interleaves vendors naturally while still respecting
 * relevance — a highly relevant product still beats a mediocre one from
 * a different vendor.
 */
function applyVendorDiversity(results) {
  if (results.length <= 1) return results;

  const uniqueVendors = new Set(results.map(p => p.vendor_name));
  if (uniqueVendors.size <= 2) return results;

  // Check if all scores are effectively equal (all 0 or all same)
  const scores = results.map(p => p.relevance_score || 0);
  const allEqual = scores.every(s => Math.abs(s - scores[0]) < 0.0001);

  // If scores are all equal, shuffle to prevent alphabetical vendor bias
  if (allEqual) {
    for (let i = results.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [results[i], results[j]] = [results[j], results[i]];
    }
  }

  const selected = [];
  const remaining = results.map((p, i) => ({ product: p, idx: i }));
  const vendorCounts = {};

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const p = remaining[i].product;
      const vendor = p.vendor_name || "Unknown";
      const seen = vendorCounts[vendor] || 0;
      const score = (p.relevance_score || 0) - (seen * 0.03);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    const picked = remaining.splice(bestIdx, 1)[0];
    const vendor = picked.product.vendor_name || "Unknown";
    vendorCounts[vendor] = (vendorCounts[vendor] || 0) + 1;
    selected.push(picked.product);
  }

  return selected;
}

function applyFacetFilters(results, filters) {
  if (!filters || Object.keys(filters).length === 0) return results;
  let filtered = results;

  if (filters.materials?.length > 0) {
    filtered = filtered.filter(p => {
      const mat = `${p.material || ""} ${p.ai_primary_material || ""}`.toLowerCase();
      return filters.materials.some(m => mat.includes(m.toLowerCase()));
    });
  }
  if (filters.categories?.length > 0) {
    filtered = filtered.filter(p => {
      const cat = (p.category || "").toLowerCase();
      return filters.categories.some(c => cat.includes(c.toLowerCase().replace(/ /g, "-")));
    });
  }
  if (filters.styles?.length > 0) {
    filtered = filtered.filter(p => {
      const style = (p.style || "").toLowerCase();
      return filters.styles.some(s => style === s.toLowerCase());
    });
  }
  if (filters.price_min != null) {
    filtered = filtered.filter(p => !p.retail_price || p.retail_price >= filters.price_min);
  }
  if (filters.price_max != null) {
    filtered = filtered.filter(p => !p.retail_price || p.retail_price <= filters.price_max);
  }
  if (filters.vendors?.length > 0) {
    filtered = filtered.filter(p =>
      filters.vendors.some(v =>
        (p.vendor_name || "").toLowerCase() === v.toLowerCase() ||
        (p.vendor_id || "").toLowerCase() === v.toLowerCase()
      )
    );
  }

  return filtered;
}

function computeSimpleFacets(results) {
  const vendorCounts = {};
  const categoryCounts = {};
  const materialCounts = {};
  const styleCounts = {};
  const colorCounts = {};

  for (const p of results) {
    const v = p.vendor_name || "Unknown";
    vendorCounts[v] = (vendorCounts[v] || 0) + 1;
    const cat = p.category || "other";
    const catDisplay = cat.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    categoryCounts[catDisplay] = (categoryCounts[catDisplay] || 0) + 1;
    if (p.material) {
      const mat = p.material.split(",")[0].trim();
      if (mat) materialCounts[mat] = (materialCounts[mat] || 0) + 1;
    }
    if (p.style) styleCounts[p.style] = (styleCounts[p.style] || 0) + 1;
    const color = p.ai_primary_color || p.color;
    if (color) colorCounts[color] = (colorCounts[color] || 0) + 1;
  }

  const toFacet = (obj, limit = 15) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, count]) => ({ value, count }));

  return {
    vendor: toFacet(vendorCounts),
    category: toFacet(categoryCounts),
    material: toFacet(materialCounts),
    style: toFacet(styleCounts),
    color: toFacet(colorCounts),
  };
}

export function clearVectorSearchCache() {
  queryCache.clear();
}
