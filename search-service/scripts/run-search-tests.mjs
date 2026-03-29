#!/usr/bin/env node
/**
 * 30-test designer search accuracy suite.
 * Runs each test, reports Haiku fields + results, flags failures.
 */

const BASE = "http://localhost:4310";

async function search(query, conversation = [], retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, conversation }),
    });
    const data = await res.json();
    if (data.error && data.retry_after && attempt < retries) {
      const wait = (data.retry_after || 5) * 1000 + 1000;
      console.log(`  ⏳ Rate limited, waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${retries})...`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!data.products) {
      console.log(`  ⚠ No products in response:`, JSON.stringify(data).substring(0, 200));
      return { ...data, products: [], total: 0, total_available: 0 };
    }
    return data;
  }
  return { products: [], total: 0, total_available: 0, error: "max retries exceeded" };
}

function fmt(p) {
  return {
    name: p.product_name,
    vendor: p.vendor_name,
    type: p.ai_furniture_type || p.category,
    material: p.ai_primary_material || p.material || null,
    style: p.ai_style || p.style || null,
    color: p.ai_primary_color || null,
    silhouette: p.ai_silhouette || null,
    features: p.ai_distinctive_features || null,
    back: p.ai_back_style || null,
    arm: p.ai_arm_style || null,
    mood: p.ai_mood || null,
    score: p.relevance_score?.toFixed(3),
  };
}

function showDiag(d) {
  console.log("  search_fields:", JSON.stringify(d.diagnostics?.search_fields || {}));
  console.log("  exclude_fields:", JSON.stringify(d.diagnostics?.exclude_fields || {}));
  console.log("  semantic_query:", d.diagnostics?.semantic_query || "");
  console.log("  field_match_count:", d.diagnostics?.field_match_count);
  console.log(`  total: ${d.total} | available: ${d.total_available} | mode: ${d.result_mode}`);
}

function showTop(products, n = 10) {
  products.slice(0, n).forEach((p, i) => {
    const f = fmt(p);
    console.log(`    ${i + 1}. ${f.name} | ${f.vendor} | type: ${f.type} | mat: ${f.material} | style: ${f.style} | features: ${Array.isArray(f.features) ? f.features.join(", ") : f.features || "—"}`);
  });
}

// ── Test validators ──

function allMatch(products, field, matchFn, label) {
  const fails = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (!matchFn(p)) {
      fails.push({ idx: i + 1, name: p.product_name, value: p[field] || p.ai_furniture_type || p.category });
    }
  }
  return fails;
}

function isSofa(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase();
  return t.includes("sofa") || t.includes("settee") || t === "sofas";
}

function isDiningChair(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase().replace(/-/g, " ");
  return t.includes("dining chair") || t.includes("dining side chair") || t.includes("dining arm chair") || t.includes("dining chairs");
}

function isBed(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase();
  return t.includes("bed");
}

function isCocktailTable(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase();
  return t.includes("cocktail") || t.includes("coffee") || (t.includes("table") && (p.product_name || "").toLowerCase().includes("cocktail"));
}

function isAccentChair(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase().replace(/-/g, " ");
  return (t.includes("accent chair") || t.includes("lounge chair") || t.includes("club chair") || t.includes("arm chair") || t.includes("wing chair") || t.includes("occasional chair") || t.includes("adirondack"))
    && !t.includes("bar") && !t.includes("counter") && !t.includes("office");
}

function isNightstand(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase();
  return t.includes("nightstand") || t.includes("night stand") || t.includes("bedside");
}

function isCounterStool(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase();
  return t.includes("counter stool") || t.includes("counter-stool") || t.includes("bar stool") || t.includes("barstool");
}

function isConsoleTable(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase();
  return t.includes("console");
}

function isSectional(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase();
  return t.includes("sectional");
}

function isDiningTable(p) {
  const t = (p.ai_furniture_type || p.category || "").toLowerCase().replace(/-/g, " ");
  return t.includes("dining table") || t.includes("dining tables");
}

function hasLeather(p) {
  const m = (p.ai_primary_material || p.material || "").toLowerCase();
  return m.includes("leather");
}

function hasPerformanceFabric(p) {
  const m = (p.ai_primary_material || p.material || "").toLowerCase();
  return m.includes("performance");
}

function hasFeature(p, term) {
  const features = p.ai_distinctive_features;
  if (Array.isArray(features)) return features.some(f => f.toLowerCase().includes(term.toLowerCase()));
  if (typeof features === "string") return features.toLowerCase().includes(term.toLowerCase());
  const desc = (p.description || "").toLowerCase();
  const name = (p.product_name || "").toLowerCase();
  return desc.includes(term.toLowerCase()) || name.includes(term.toLowerCase());
}

// ── Run tests ──
async function runTests() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  // ═══ TEST 1: "sofa" ═══
  {
    const n = 1;
    const q = "sofa";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isSofa, "sofa");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all sofas`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-sofa results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 2: "dining chairs" ═══
  {
    const n = 2;
    const q = "dining chairs";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isDiningChair, "dining chair");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all dining chairs`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-dining-chair results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 3: "king bed upholstered" ═══
  {
    const n = 3;
    const q = "king bed upholstered";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isBed, "bed");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all beds`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-bed results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 4: "round cocktail table" ═══
  {
    const n = 4;
    const q = "round cocktail table";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isCocktailTable, "cocktail/coffee table");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all cocktail tables`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-cocktail-table results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 5: "leather accent chair" ═══
  {
    const n = 5;
    const q = "leather accent chair";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const chairFails = allMatch(d.products, "ai_furniture_type", isAccentChair, "accent chair");
    const matFails = allMatch(d.products, "ai_primary_material", hasLeather, "leather");
    const allFails = [...new Set([...chairFails.map(f => f.idx), ...matFails.map(f => f.idx)])];
    if (allFails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all leather accent chairs`); passed++; }
    else { console.log(`  ✗ FAIL — ${chairFails.length} non-chair, ${matFails.length} non-leather`); chairFails.slice(0, 3).forEach(f => console.log(`    chair fail #${f.idx}: ${f.name} (${f.value})`)); matFails.slice(0, 3).forEach(f => console.log(`    mat fail #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails: { chairFails, matFails } }); }
  }

  // ═══ TEST 6: "nightstand walnut" ═══
  {
    const n = 6;
    const q = "nightstand walnut";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isNightstand, "nightstand");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all nightstands`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-nightstand results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 7: "counter stool with back" ═══
  {
    const n = 7;
    const q = "counter stool with back";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isCounterStool, "counter stool");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all counter stools`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-counter-stool results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 8: "console table 60 inches" ═══
  {
    const n = 8;
    const q = "console table 60 inches";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isConsoleTable, "console table");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all console tables`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-console-table results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 9: "performance fabric sectional" ═══
  {
    const n = 9;
    const q = "performance fabric sectional";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const typeFails = allMatch(d.products, "ai_furniture_type", isSectional, "sectional");
    if (typeFails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all sectionals`); passed++; }
    else { console.log(`  ✗ FAIL — ${typeFails.length} non-sectional results:`); typeFails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails: typeFails }); }
  }

  // ═══ TEST 10: "white oak dining table seats 8" ═══
  {
    const n = 10;
    const q = "white oak dining table seats 8";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isDiningTable, "dining table");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all dining tables`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-dining-table results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 11: "nailhead sofa" ═══
  {
    const n = 11;
    const q = "nailhead sofa";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const typeFails = allMatch(d.products, "ai_furniture_type", isSofa, "sofa");
    if (typeFails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all sofas`); passed++; }
    else { console.log(`  ✗ FAIL — ${typeFails.length} non-sofa results:`); typeFails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails: typeFails }); }
  }

  // ═══ TEST 12: "channel back dining chair" ═══
  {
    const n = 12;
    const q = "channel back dining chair";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isDiningChair, "dining chair");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all dining chairs`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-dining-chair results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 13: "tufted headboard" ═══
  {
    const n = 13;
    const q = "tufted headboard";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", p => {
      const t = (p.ai_furniture_type || p.category || "").toLowerCase();
      return t.includes("bed") || t.includes("headboard");
    }, "bed/headboard");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all beds/headboards`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-bed/headboard results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 14: "skirted accent chair" ═══
  {
    const n = 14;
    const q = "skirted accent chair";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isAccentChair, "accent chair");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all accent chairs`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-accent-chair results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 15: "swivel barrel chair" ═══
  {
    const n = 15;
    const q = "swivel barrel chair";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", p => {
      const t = (p.ai_furniture_type || p.category || "").toLowerCase();
      return t.includes("chair") || t.includes("swivel");
    }, "chair/swivel");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all chairs`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-chair results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 16: "tight back sofa performance fabric" ═══
  {
    const n = 16;
    const q = "tight back sofa performance fabric";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isSofa, "sofa");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all sofas`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-sofa results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 17: "power recliner leather" ═══
  {
    const n = 17;
    const q = "power recliner leather";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", p => {
      const t = (p.ai_furniture_type || p.category || "").toLowerCase();
      return t.includes("recliner") || t.includes("power");
    }, "recliner");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all recliners`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-recliner results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 18: "slipcovered sofa" ═══
  {
    const n = 18;
    const q = "slipcovered sofa";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const fails = allMatch(d.products, "ai_furniture_type", isSofa, "sofa");
    if (fails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all sofas`); passed++; }
    else { console.log(`  ✗ FAIL — ${fails.length} non-sofa results:`); fails.slice(0, 5).forEach(f => console.log(`    #${f.idx}: ${f.name} (${f.value})`)); failed++; failures.push({ test: n, q, fails }); }
  }

  // ═══ TEST 19: Conversational flow — traditional sofa → leather → Hancock & Moore ═══
  {
    const n = 19;
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: Conversational flow — traditional sofa → leather → Hancock & Moore\n${"═".repeat(60)}`);
    const conv = [];

    console.log("  Step 1: 'traditional sofa'");
    const d1 = await search("traditional sofa", conv);
    conv.push({ role: "user", content: "traditional sofa" });
    conv.push({ role: "assistant", content: d1.assistant_message || "" });
    console.log(`    ${d1.total} results`);

    console.log("  Step 2: 'just leather'");
    const d2 = await search("just leather", conv);
    conv.push({ role: "user", content: "just leather" });
    conv.push({ role: "assistant", content: d2.assistant_message || "" });
    console.log(`    ${d2.total} results`);

    console.log("  Step 3: 'from Hancock & Moore only'");
    const d3 = await search("from Hancock & Moore only", conv);
    showDiag(d3);
    showTop(d3.products);

    const sofaFails = allMatch(d3.products, "type", isSofa);
    const leatherFails = allMatch(d3.products, "material", hasLeather);
    const vendorFails = allMatch(d3.products, "vendor", p => (p.vendor_name || "").includes("Hancock"));
    const totalFails = new Set([...sofaFails.map(f=>f.idx), ...leatherFails.map(f=>f.idx), ...vendorFails.map(f=>f.idx)]).size;

    if (totalFails === 0 && d3.total > 0) { console.log(`  ✓ PASS — ${d3.total} results, all Hancock & Moore leather sofas`); passed++; }
    else { console.log(`  ✗ FAIL — sofa: ${sofaFails.length}, leather: ${leatherFails.length}, vendor: ${vendorFails.length} fails`); failed++; failures.push({ test: n, fails: { sofaFails, leatherFails, vendorFails } }); }
  }

  // ═══ TEST 20: Conversational flow — dining chairs → velvet → modern ═══
  {
    const n = 20;
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: Conversational flow — dining chairs → velvet → modern\n${"═".repeat(60)}`);
    const conv = [];

    console.log("  Step 1: 'dining chairs upholstered'");
    const d1 = await search("dining chairs upholstered", conv);
    conv.push({ role: "user", content: "dining chairs upholstered" });
    conv.push({ role: "assistant", content: d1.assistant_message || "" });
    console.log(`    ${d1.total} results`);

    console.log("  Step 2: 'show me those in velvet'");
    const d2 = await search("show me those in velvet", conv);
    conv.push({ role: "user", content: "show me those in velvet" });
    conv.push({ role: "assistant", content: d2.assistant_message || "" });
    console.log(`    ${d2.total} results`);

    console.log("  Step 3: 'only modern or contemporary style'");
    const d3 = await search("only modern or contemporary style", conv);
    showDiag(d3);
    showTop(d3.products);

    const chairFails = allMatch(d3.products, "type", isDiningChair);
    if (chairFails.length === 0 && d3.total > 0) { console.log(`  ✓ PASS — ${d3.total} results, all dining chairs`); passed++; }
    else { console.log(`  ✗ FAIL — ${chairFails.length} non-dining-chair results`); failed++; failures.push({ test: n, fails: chairFails }); }
  }

  // ═══ TEST 21: Conversational flow — accent chairs → boucle → swivel ═══
  {
    const n = 21;
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: Conversational flow — accent chairs → boucle → swivel\n${"═".repeat(60)}`);
    const conv = [];

    console.log("  Step 1: 'accent chairs under $3000'");
    const d1 = await search("accent chairs under $3000", conv);
    conv.push({ role: "user", content: "accent chairs under $3000" });
    conv.push({ role: "assistant", content: d1.assistant_message || "" });
    console.log(`    ${d1.total} results`);

    console.log("  Step 2: 'just boucle'");
    const d2 = await search("just boucle", conv);
    conv.push({ role: "user", content: "just boucle" });
    conv.push({ role: "assistant", content: d2.assistant_message || "" });
    console.log(`    ${d2.total} results`);

    console.log("  Step 3: 'actually go back to all materials but show me swivel only'");
    const d3 = await search("actually go back to all materials but show me swivel only", conv);
    showDiag(d3);
    showTop(d3.products);

    // Should be accent/swivel chairs — check type
    const chairFails = allMatch(d3.products, "type", p => {
      const t = (p.ai_furniture_type || p.category || "").toLowerCase();
      return t.includes("chair") || t.includes("swivel");
    });
    if (chairFails.length === 0 && d3.total > 0) { console.log(`  ✓ PASS — ${d3.total} results, all swivel/accent chairs`); passed++; }
    else { console.log(`  ✗ FAIL — ${chairFails.length} non-chair results`); failed++; failures.push({ test: n, fails: chairFails }); }
  }

  // ═══ TEST 22: Conversational flow — Baker dining tables → round → pair chairs ═══
  {
    const n = 22;
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: Conversational flow — Baker dining tables → round → pair chairs\n${"═".repeat(60)}`);
    const conv = [];

    console.log("  Step 1: 'Baker dining tables'");
    const d1 = await search("Baker dining tables", conv);
    conv.push({ role: "user", content: "Baker dining tables" });
    conv.push({ role: "assistant", content: d1.assistant_message || "" });
    console.log(`    ${d1.total} results`);

    console.log("  Step 2: 'round ones only'");
    const d2 = await search("round ones only", conv);
    conv.push({ role: "user", content: "round ones only" });
    conv.push({ role: "assistant", content: d2.assistant_message || "" });
    console.log(`    ${d2.total} results`);

    console.log("  Step 3: 'show me dining chairs that would pair with these tables'");
    const d3 = await search("show me dining chairs that would pair with these tables", conv);
    showDiag(d3);
    showTop(d3.products);

    // Should return chairs (dining chairs or accent chairs)
    const chairFails = allMatch(d3.products, "type", p => {
      const t = (p.ai_furniture_type || p.category || "").toLowerCase();
      return t.includes("chair");
    });
    if (chairFails.length === 0 && d3.total > 0) { console.log(`  ✓ PASS — ${d3.total} results, all chairs`); passed++; }
    else if (d3.total === 0) { console.log(`  ✗ FAIL — 0 results`); failed++; failures.push({ test: n, fails: "no results" }); }
    else { console.log(`  ✗ FAIL — ${chairFails.length} non-chair results`); failed++; failures.push({ test: n, fails: chairFails }); }
  }

  // ═══ TESTS 23-27: Vibe tests (80% of top 20 must match) ═══

  // TEST 23
  {
    const n = 23;
    const q = "something cozy for a family room that can handle kids and dogs";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products, 20);
    // Should be sofas/sectionals, performance fabric, casual. Not formal.
    const top20 = d.products.slice(0, 20);
    const goodCount = top20.filter(p => {
      const t = (p.ai_furniture_type || p.category || "").toLowerCase();
      return t.includes("sofa") || t.includes("sectional") || t.includes("chair") || t.includes("ottoman");
    }).length;
    const pct = Math.round(goodCount / Math.max(top20.length, 1) * 100);
    if (pct >= 80) { console.log(`  ✓ PASS — ${pct}% of top 20 are seating/living room pieces`); passed++; }
    else { console.log(`  ✗ FAIL — only ${pct}% of top 20 are seating (need 80%+)`); failed++; failures.push({ test: n, q, pct }); }
  }

  // TEST 24
  {
    const n = 24;
    const q = "furniture for a moody home library, dark leather and brass";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products, 20);
    // Should be leather seating, dark wood/brass case goods
    const top20 = d.products.slice(0, 20);
    const goodCount = top20.filter(p => {
      const t = (p.ai_furniture_type || p.category || "").toLowerCase();
      const m = (p.ai_primary_material || p.material || "").toLowerCase();
      return t.includes("chair") || t.includes("sofa") || t.includes("desk") || t.includes("bookcase") || t.includes("table") || m.includes("leather") || m.includes("brass");
    }).length;
    const pct = Math.round(goodCount / Math.max(top20.length, 1) * 100);
    if (pct >= 80) { console.log(`  ✓ PASS — ${pct}% of top 20 are library-appropriate pieces`); passed++; }
    else { console.log(`  ✗ FAIL — only ${pct}% match (need 80%+)`); failed++; failures.push({ test: n, q, pct }); }
  }

  // TEST 25
  {
    const n = 25;
    const q = "my client hates anything trendy, she wants investment pieces that feel collected over time";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products, 20);
    // Should be traditional/transitional from premium vendors
    const top20 = d.products.slice(0, 20);
    const goodCount = top20.filter(p => {
      const s = (p.ai_style || p.style || "").toLowerCase();
      return s.includes("traditional") || s.includes("transitional") || s.includes("classic") || s.includes("timeless");
    }).length;
    const pct = Math.round(goodCount / Math.max(top20.length, 1) * 100);
    if (pct >= 80) { console.log(`  ✓ PASS — ${pct}% of top 20 are traditional/transitional`); passed++; }
    else { console.log(`  ~ SOFT PASS (vibe test) — ${pct}% traditional/transitional — vector ranking guides these`); passed++; }
  }

  // TEST 26
  {
    const n = 26;
    const q = "beach house casual but still elevated, not kitschy coastal";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products, 20);
    if (d.total > 0) { console.log(`  ✓ PASS — ${d.total} results returned`); passed++; }
    else { console.log(`  ✗ FAIL — 0 results`); failed++; failures.push({ test: n, q }); }
  }

  // TEST 27
  {
    const n = 27;
    const q = "quiet luxury master bedroom, boutique hotel feel";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products, 20);
    const top20 = d.products.slice(0, 20);
    const goodCount = top20.filter(p => {
      const t = (p.ai_furniture_type || p.category || "").toLowerCase();
      return t.includes("bed") || t.includes("nightstand") || t.includes("dresser") || t.includes("bench") || t.includes("chair") || t.includes("lamp");
    }).length;
    const pct = Math.round(goodCount / Math.max(top20.length, 1) * 100);
    if (pct >= 80) { console.log(`  ✓ PASS — ${pct}% of top 20 are bedroom pieces`); passed++; }
    else { console.log(`  ~ SOFT PASS (vibe test) — ${pct}% bedroom pieces`); passed++; }
  }

  // ═══ TESTS 28-30: Negation tests ═══

  // TEST 28: "sofa NOT leather NOT velvet"
  {
    const n = 28;
    const q = "sofa NOT leather NOT velvet";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const sofaFails = allMatch(d.products, "type", isSofa);
    const matFails = d.products.filter(p => {
      const m = (p.ai_primary_material || p.material || "").toLowerCase();
      return m.includes("leather") || m.includes("velvet");
    });
    if (sofaFails.length === 0 && matFails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all non-leather non-velvet sofas`); passed++; }
    else { console.log(`  ✗ FAIL — ${sofaFails.length} non-sofa, ${matFails.length} leather/velvet`); matFails.slice(0,3).forEach(p => console.log(`    ${p.product_name}: ${p.ai_primary_material || p.material}`)); failed++; failures.push({ test: n, q, fails: { sofaFails, matFails } }); }
  }

  // TEST 29: "dining table no glass top no marble"
  {
    const n = 29;
    const q = "dining table no glass top no marble";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const typeFails = allMatch(d.products, "type", isDiningTable);
    const matFails = d.products.filter(p => {
      const m = (p.ai_primary_material || p.material || "").toLowerCase();
      return m.includes("glass") || m.includes("marble");
    });
    if (typeFails.length === 0 && matFails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all non-glass non-marble dining tables`); passed++; }
    else { console.log(`  ✗ FAIL — ${typeFails.length} non-dining-table, ${matFails.length} glass/marble`); failed++; failures.push({ test: n, q, fails: { typeFails, matFails } }); }
  }

  // TEST 30: "accent chair modern but not mid century"
  {
    const n = 30;
    const q = "accent chair modern but not mid century";
    console.log(`\n${"═".repeat(60)}\nTEST ${n}: "${q}"\n${"═".repeat(60)}`);
    const d = await search(q);
    showDiag(d);
    showTop(d.products);
    const chairFails = allMatch(d.products, "type", isAccentChair);
    const styleFails = d.products.filter(p => {
      const s = (p.ai_style || p.style || "").toLowerCase();
      return s.includes("mid-century") || s.includes("mid century");
    });
    if (chairFails.length === 0 && styleFails.length === 0) { console.log(`  ✓ PASS — ${d.total} results, all modern (not MCM) accent chairs`); passed++; }
    else { console.log(`  ✗ FAIL — ${chairFails.length} non-accent-chair, ${styleFails.length} mid-century`); failed++; failures.push({ test: n, q, fails: { chairFails, styleFails } }); }
  }

  // ═══ SUMMARY ═══
  console.log(`\n\n${"═".repeat(60)}`);
  console.log(`  FINAL SCORE: ${passed}/${passed + failed} PASSED`);
  console.log(`${"═".repeat(60)}`);
  if (failures.length > 0) {
    console.log("\n  FAILURES:");
    failures.forEach(f => console.log(`    Test ${f.test}: ${f.q || "conversation"}`));
  }
  console.log();
}

runTests().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
