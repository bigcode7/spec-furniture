/**
 * Physical Attribute Accuracy Tests
 * Tests that Haiku correctly maps physical attributes to hard field filters.
 */

const BASE = "http://localhost:4310";

const tests = [
  // ── 15 Construction/Physical Tests ──
  {
    name: "1. track arm sofa",
    query: "track arm sofa",
    expectFields: { ai_furniture_type: "sofa", ai_arm_style: "track" },
    expectNoFields: [],
  },
  {
    name: "2. tight back leather sofa",
    query: "tight back leather sofa",
    expectFields: { ai_furniture_type: "sofa", ai_back_style: "tight back", ai_primary_material: "leather" },
    expectNoFields: [],
  },
  {
    name: "3. pillow back sectional",
    query: "pillow back sectional",
    expectFields: { ai_furniture_type: "sectional", ai_back_style: "pillow" },
    expectNoFields: [],
  },
  {
    name: "4. barrel accent chair",
    query: "barrel accent chair",
    expectFields: { ai_furniture_type: "accent chair", ai_silhouette: "barrel" },
    expectNoFields: [],
  },
  {
    name: "5. tapered leg dining chair",
    query: "tapered leg dining chair",
    expectFields: { ai_furniture_type: "dining chair", ai_leg_style: "tapered" },
    expectNoFields: [],
  },
  {
    name: "6. spring down cushion sofa",
    query: "spring down cushion sofa",
    expectFields: { ai_furniture_type: "sofa", ai_cushions: "spring down" },
    expectNoFields: [],
  },
  {
    name: "7. eight way hand tied sofa",
    query: "eight way hand tied sofa",
    expectFields: { ai_furniture_type: "sofa", ai_construction_details: "eight-way hand" },
    expectNoFields: [],
  },
  {
    name: "8. nailhead dining chair",
    query: "nailhead dining chair",
    expectFields: { ai_furniture_type: "dining chair", ai_distinctive_features: "nailhead" },
    expectNoFields: [],
  },
  {
    name: "9. channel tufted accent chair",
    query: "channel tufted accent chair",
    expectFields: { ai_furniture_type: "accent chair", ai_distinctive_features: "channel" },
    expectNoFields: [],
  },
  {
    name: "10. chesterfield sofa leather",
    query: "chesterfield sofa leather",
    expectFields: { ai_furniture_type: "sofa", ai_silhouette: "chesterfield", ai_primary_material: "leather" },
    expectNoFields: [],
  },
  {
    name: "11. formal dining chair",
    query: "formal dining chair",
    expectFields: { ai_furniture_type: "dining chair", ai_formality: "formal" },
    expectNoFields: [],
  },
  {
    name: "12. apartment size sofa",
    query: "apartment size sofa",
    expectFields: { ai_furniture_type: "sofa", ai_scale: "small" },
    expectNoFields: [],
  },
  {
    name: "13. slipper chair velvet",
    query: "slipper chair velvet",
    expectFields: { ai_silhouette: "slipper", ai_primary_material: "velvet" },
    expectNoFields: [],
  },
  {
    name: "14. parsons dining chair",
    query: "parsons dining chair",
    expectFields: { ai_furniture_type: "dining chair", ai_silhouette: "parsons" },
    expectNoFields: [],
  },
  {
    name: "15. cabriole leg accent chair",
    query: "cabriole leg accent chair",
    expectFields: { ai_furniture_type: "accent chair", ai_leg_style: "cabriole" },
    expectNoFields: [],
  },

  // ── 5 Combination Tests ──
  {
    name: "16. track arm tight back sofa",
    query: "track arm tight back sofa",
    expectFields: { ai_furniture_type: "sofa", ai_arm_style: "track", ai_back_style: "tight back" },
    expectNoFields: [],
  },
  {
    name: "17. rolled arm pillow back sofa performance fabric",
    query: "rolled arm pillow back sofa performance fabric",
    expectFields: { ai_furniture_type: "sofa", ai_arm_style: "rolled", ai_back_style: "pillow", ai_primary_material: "performance" },
    expectNoFields: [],
  },
  {
    name: "18. tight back tapered leg accent chair leather",
    query: "tight back tapered leg accent chair leather",
    expectFields: { ai_furniture_type: "accent chair", ai_back_style: "tight back", ai_leg_style: "tapered", ai_primary_material: "leather" },
    expectNoFields: [],
  },
  {
    name: "19. mid century track arm leather sofa tapered legs",
    query: "mid century track arm leather sofa tapered legs",
    expectFields: { ai_furniture_type: "sofa", ai_style: "mid-century", ai_arm_style: "track", ai_primary_material: "leather", ai_leg_style: "tapered" },
    expectNoFields: [],
  },
  {
    name: "20. formal tufted wingback chair cabriole legs",
    query: "formal tufted wingback chair with cabriole legs",
    expectFields: { ai_formality: "formal", ai_distinctive_features: "tufted", ai_back_style: "wingback", ai_leg_style: "cabriole" },
    expectNoFields: [],
  },

  // ── 5 Negation Tests ──
  {
    name: "21. sofa not modern no tufting",
    query: "sofa not modern no tufting",
    expectFields: { ai_furniture_type: "sofa" },
    expectExclude: { ai_style: "modern", ai_distinctive_features: "tufted" },
    expectNoFields: [],
  },
  {
    name: "22. accent chair without nailheads not traditional",
    query: "accent chair without nailheads not traditional",
    expectFields: { ai_furniture_type: "accent chair" },
    expectExclude: { ai_distinctive_features: "nailhead", ai_style: "traditional" },
    expectNoFields: [],
  },
  {
    name: "23. leather sofa no rolled arms",
    query: "leather sofa no rolled arms",
    expectFields: { ai_furniture_type: "sofa", ai_primary_material: "leather" },
    expectExclude: { ai_arm_style: "rolled" },
    expectNoFields: [],
  },
  {
    name: "24. dining table avoid glass not modern",
    query: "dining table avoid glass not modern",
    expectFields: { ai_furniture_type: "dining table" },
    expectExclude: { ai_primary_material: "glass", ai_style: "modern" },
    expectNoFields: [],
  },
  {
    name: "25. sectional no loose back",
    query: "sectional no loose back cushions",
    expectFields: { ai_furniture_type: "sectional" },
    expectExclude: { ai_back_style: "loose" },
    expectNoFields: [],
  },
];

function fieldContains(fieldValue, expected) {
  if (!fieldValue || !Array.isArray(fieldValue)) return false;
  const joined = fieldValue.join(" ").toLowerCase();
  return joined.includes(expected.toLowerCase());
}

async function runTest(test) {
  try {
    const resp = await fetch(`${BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: test.query }),
    });
    const data = await resp.json();
    const sf = data.diagnostics?.search_fields || {};
    const ef = data.diagnostics?.exclude_fields || {};
    const errors = [];

    // Check expected search_fields
    for (const [field, expected] of Object.entries(test.expectFields)) {
      if (!fieldContains(sf[field], expected)) {
        errors.push(`MISSING search_fields.${field} should contain "${expected}", got: ${JSON.stringify(sf[field])}`);
      }
    }

    // Check expected exclude_fields
    if (test.expectExclude) {
      for (const [field, expected] of Object.entries(test.expectExclude)) {
        if (!fieldContains(ef[field], expected)) {
          errors.push(`MISSING exclude_fields.${field} should contain "${expected}", got: ${JSON.stringify(ef[field])}`);
        }
      }
    }

    // Check fields that should NOT be populated
    for (const field of test.expectNoFields) {
      if (sf[field] && Array.isArray(sf[field]) && sf[field].length > 0) {
        errors.push(`UNWANTED search_fields.${field} should be null, got: ${JSON.stringify(sf[field])}`);
      }
    }

    const passed = errors.length === 0;
    const productCount = data.products?.length || 0;
    return { ...test, passed, errors, productCount, sf, ef };
  } catch (err) {
    return { ...test, passed: false, errors: [`FETCH ERROR: ${err.message}`], productCount: 0, sf: {}, ef: {} };
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SPEKD Physical Attribute Accuracy Tests (25 tests)");
  console.log("═══════════════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const test of tests) {
    const result = await runTest(test);
    if (result.passed) {
      passed++;
      console.log(`  ✅ ${result.name} (${result.productCount} results)`);
    } else {
      failed++;
      failures.push(result);
      console.log(`  ❌ ${result.name} (${result.productCount} results)`);
      for (const err of result.errors) {
        console.log(`     → ${err}`);
      }
    }
  }

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  RESULTS: ${passed}/25 passed, ${failed}/25 failed`);
  console.log(`═══════════════════════════════════════════════════════════`);

  if (failures.length > 0) {
    console.log("\nFailed test details:");
    for (const f of failures) {
      console.log(`\n  ${f.name}:`);
      console.log(`    search_fields: ${JSON.stringify(f.sf, null, 2)}`);
      console.log(`    exclude_fields: ${JSON.stringify(f.ef, null, 2)}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
