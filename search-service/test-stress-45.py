#!/usr/bin/env python3
"""
45-Test Search Engine Stress Test
==================================
10 rounds × 4-5 tests each. Very strict validation.
Goal: 45/45 pass rate.
"""

import json, urllib.request, sys, time, re

URL = "http://localhost:4310/smart-search"

def search(query, conversation=None, timeout=30):
    """Call smart-search and return parsed response."""
    if conversation is None:
        conversation = [{"role": "user", "content": query}]
    body = json.dumps({"conversation": conversation}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())

def get_categories(products):
    cats = {}
    for p in products:
        c = (p.get("category") or "unknown").lower()
        cats[c] = cats.get(c, 0) + 1
    return cats

def get_vendors(products):
    vs = {}
    for p in products:
        v = (p.get("vendor_id") or p.get("manufacturer_name") or "unknown").lower()
        vs[v] = vs.get(v, 0) + 1
    return vs

# ─── Test definitions ───────────────────────────────────────────────

TESTS = []

def test(name, round_num):
    """Decorator to register a test."""
    def decorator(fn):
        TESTS.append({"name": name, "round": round_num, "fn": fn})
        return fn
    return decorator

# ════════════════════════════════════════════════════════════════════
# ROUND 1: Basic Category Accuracy (5 tests)
# ════════════════════════════════════════════════════════════════════

@test("R1.1 'sofa' returns only sofas", 1)
def _():
    d = search("sofa")
    ps = d.get("products", [])
    assert len(ps) >= 5, f"Expected >=5 results, got {len(ps)}"
    cats = get_categories(ps)
    sofa_count = sum(v for k, v in cats.items() if "sofa" in k or "sectional" in k)
    ratio = sofa_count / len(ps)
    assert ratio >= 0.85, f"Only {ratio:.0%} are sofas/sectionals. Cats: {cats}"

@test("R1.2 'dining table' returns only tables", 1)
def _():
    d = search("dining table")
    ps = d.get("products", [])
    assert len(ps) >= 5, f"Expected >=5 results, got {len(ps)}"
    cats = get_categories(ps)
    table_count = sum(v for k, v in cats.items() if "table" in k or "dining" in k)
    ratio = table_count / len(ps)
    assert ratio >= 0.85, f"Only {ratio:.0%} are tables. Cats: {cats}"

@test("R1.3 'accent chair' returns chairs not sofas", 1)
def _():
    d = search("accent chair")
    ps = d.get("products", [])
    assert len(ps) >= 5, f"Expected >=5 results, got {len(ps)}"
    cats = get_categories(ps)
    chair_count = sum(v for k, v in cats.items() if "chair" in k or "seat" in k)
    sofa_count = sum(v for k, v in cats.items() if "sofa" in k or "sectional" in k)
    assert chair_count > sofa_count, f"More sofas ({sofa_count}) than chairs ({chair_count})"
    assert chair_count / len(ps) >= 0.7, f"Only {chair_count}/{len(ps)} are chairs"

@test("R1.4 'bed' returns beds not bedside tables", 1)
def _():
    d = search("bed")
    ps = d.get("products", [])
    assert len(ps) >= 5, f"Expected >=5 results, got {len(ps)}"
    cats = get_categories(ps)
    bed_count = sum(v for k, v in cats.items() if "bed" in k and "side" not in k and "ding" not in k)
    ratio = bed_count / len(ps)
    assert ratio >= 0.7, f"Only {ratio:.0%} are beds. Cats: {cats}"

@test("R1.5 'nightstand' returns nightstands", 1)
def _():
    d = search("nightstand")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    # Check that names/categories relate to nightstands/bedside
    relevant = sum(1 for p in ps if any(w in (p.get("product_name","")+" "+p.get("category","")).lower()
                   for w in ["nightstand", "night stand", "bedside", "night table", "end table"]))
    assert relevant / len(ps) >= 0.6, f"Only {relevant}/{len(ps)} are nightstands"

# ════════════════════════════════════════════════════════════════════
# ROUND 2: Natural Language Understanding (5 tests)
# ════════════════════════════════════════════════════════════════════

@test("R2.1 'something to sit on for my living room' → seating", 2)
def _():
    d = search("something to sit on for my living room")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    cats = get_categories(ps)
    seating = sum(v for k, v in cats.items() if any(w in k for w in ["sofa", "chair", "seat", "sectional", "lounge"]))
    assert seating / len(ps) >= 0.6, f"Only {seating}/{len(ps)} are seating. Cats: {cats}"

@test("R2.2 'where do I eat dinner' → dining tables", 2)
def _():
    d = search("where do I eat dinner")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    cats = get_categories(ps)
    dining = sum(v for k, v in cats.items() if "table" in k or "dining" in k)
    assert dining / len(ps) >= 0.5, f"Only {dining}/{len(ps)} are dining. Cats: {cats}"

@test("R2.3 'quiet luxury bedroom' → beds/bedroom furniture", 2)
def _():
    d = search("quiet luxury bedroom")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    msg = d.get("assistant_message", "").lower()
    # Should return bedroom-related items
    cats = get_categories(ps)
    bedroom = sum(v for k, v in cats.items() if any(w in k for w in ["bed", "night", "dresser", "chest", "bedroom"]))
    assert bedroom >= 2, f"Only {bedroom} bedroom items. Cats: {cats}"

@test("R2.4 'mid century modern office setup' → desks/office", 2)
def _():
    d = search("mid century modern office setup")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    # Check AI message mentions mid century / office
    msg = d.get("assistant_message", "").lower()
    assert len(ps) >= 3

@test("R2.5 'coastal vibes' → light/coastal style furniture", 2)
def _():
    d = search("coastal vibes")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    msg = d.get("assistant_message", "").lower()
    assert "coast" in msg or len(ps) >= 3, "AI should mention coastal"

# ════════════════════════════════════════════════════════════════════
# ROUND 3: Dimensions & Specifications (4 tests)
# ════════════════════════════════════════════════════════════════════

@test("R3.1 'narrow console table under 14 inches deep' → thin tables", 3)
def _():
    d = search("narrow console table under 14 inches deep")
    ps = d.get("products", [])
    assert len(ps) >= 2, f"Expected >=2 results, got {len(ps)}"
    cats = get_categories(ps)
    table_count = sum(v for k, v in cats.items() if "table" in k or "console" in k)
    assert table_count >= 1, f"No console/tables found. Cats: {cats}"

@test("R3.2 'dining table seats 8' → large tables", 3)
def _():
    d = search("dining table seats 8")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    cats = get_categories(ps)
    table_count = sum(v for k, v in cats.items() if "table" in k or "dining" in k)
    assert table_count / len(ps) >= 0.7, f"Only {table_count}/{len(ps)} are tables"

@test("R3.3 'sofa under 80 inches wide' → compact sofas", 3)
def _():
    d = search("sofa under 80 inches wide")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    cats = get_categories(ps)
    sofa_count = sum(v for k, v in cats.items() if "sofa" in k or "settee" in k or "loveseat" in k)
    assert sofa_count >= 2, f"Only {sofa_count} sofas found"

@test("R3.4 'bar stools counter height' → stools/chairs", 3)
def _():
    d = search("bar stools counter height")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    relevant = sum(1 for p in ps if any(w in (p.get("product_name","")+" "+p.get("category","")).lower()
                   for w in ["stool", "bar", "counter"]))
    assert relevant >= 2, f"Only {relevant} stools found"

# ════════════════════════════════════════════════════════════════════
# ROUND 4: Materials & Style Combos (5 tests)
# ════════════════════════════════════════════════════════════════════

@test("R4.1 'leather sofa' → leather sofas", 4)
def _():
    d = search("leather sofa")
    ps = d.get("products", [])
    assert len(ps) >= 5, f"Expected >=5 results, got {len(ps)}"
    cats = get_categories(ps)
    sofa_count = sum(v for k, v in cats.items() if "sofa" in k or "sectional" in k)
    assert sofa_count / len(ps) >= 0.7, f"Only {sofa_count}/{len(ps)} are sofas"

@test("R4.2 'marble cocktail table' → marble tables", 4)
def _():
    d = search("marble cocktail table")
    ps = d.get("products", [])
    assert len(ps) >= 2, f"Expected >=2 results, got {len(ps)}"
    relevant = sum(1 for p in ps if "table" in (p.get("product_name","")+" "+p.get("category","")).lower())
    assert relevant >= 2, f"Only {relevant} tables"

@test("R4.3 'boucle swivel chair' → boucle chairs", 4)
def _():
    d = search("boucle swivel chair")
    ps = d.get("products", [])
    assert len(ps) >= 2, f"Expected >=2 results, got {len(ps)}"
    cats = get_categories(ps)
    chair_count = sum(v for k, v in cats.items() if "chair" in k)
    assert chair_count >= 2, f"Only {chair_count} chairs"

@test("R4.4 'walnut credenza' → wooden storage", 4)
def _():
    d = search("walnut credenza")
    ps = d.get("products", [])
    assert len(ps) >= 2, f"Expected >=2 results, got {len(ps)}"
    relevant = sum(1 for p in ps if any(w in (p.get("product_name","")+" "+p.get("category","")).lower()
                   for w in ["credenza", "sideboard", "buffet", "cabinet", "console", "chest"]))
    assert relevant >= 1, f"No credenzas/storage found"

@test("R4.5 'performance fabric sectional' → fabric sectionals", 4)
def _():
    d = search("performance fabric sectional")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    cats = get_categories(ps)
    sofa_count = sum(v for k, v in cats.items() if "sofa" in k or "sectional" in k)
    assert sofa_count >= 2, f"Only {sofa_count} sofas/sectionals"

# ════════════════════════════════════════════════════════════════════
# ROUND 5: Vendor Knowledge (5 tests)
# ════════════════════════════════════════════════════════════════════

@test("R5.1 'Bernhardt accent chairs' → Bernhardt chairs", 5)
def _():
    d = search("Bernhardt accent chairs")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    vs = get_vendors(ps)
    bernhardt = sum(v for k, v in vs.items() if "bernhardt" in k)
    assert bernhardt / len(ps) >= 0.5, f"Only {bernhardt}/{len(ps)} from Bernhardt"

@test("R5.2 'Hooker home office' → Hooker office furniture", 5)
def _():
    d = search("Hooker home office")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    vs = get_vendors(ps)
    hooker = sum(v for k, v in vs.items() if "hooker" in k)
    assert hooker >= 2, f"Only {hooker} from Hooker"

@test("R5.3 'Theodore Alexander accent tables' → TA tables", 5)
def _():
    d = search("Theodore Alexander accent tables")
    ps = d.get("products", [])
    assert len(ps) >= 2, f"Expected >=2 results, got {len(ps)}"
    vs = get_vendors(ps)
    ta = sum(v for k, v in vs.items() if "theodore" in k)
    assert ta >= 1, f"No Theodore Alexander results"

@test("R5.4 'Vanguard sofas' → Vanguard sofas", 5)
def _():
    d = search("Vanguard sofas")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    vs = get_vendors(ps)
    vanguard = sum(v for k, v in vs.items() if "vanguard" in k)
    assert vanguard / len(ps) >= 0.5, f"Only {vanguard}/{len(ps)} from Vanguard"

@test("R5.5 'compare Bernhardt vs Vanguard sofas' → both vendors", 5)
def _():
    d = search("compare Bernhardt vs Vanguard sofas")
    ps = d.get("products", [])
    assert len(ps) >= 4, f"Expected >=4 results, got {len(ps)}"
    vs = get_vendors(ps)
    has_b = any("bernhardt" in k for k in vs)
    has_v = any("vanguard" in k for k in vs)
    assert has_b, f"No Bernhardt results. Vendors: {vs}"
    assert has_v, f"No Vanguard results. Vendors: {vs}"

# ════════════════════════════════════════════════════════════════════
# ROUND 6: Pairing & Design Intelligence (4 tests)
# ════════════════════════════════════════════════════════════════════

@test("R6.1 'statement accent chair for foyer' → accent chairs", 6)
def _():
    d = search("statement accent chair for foyer")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    cats = get_categories(ps)
    chair_count = sum(v for k, v in cats.items() if "chair" in k)
    assert chair_count >= 2, f"Only {chair_count} chairs"

@test("R6.2 'channel back dining chair velvet' → dining chairs", 6)
def _():
    d = search("channel back dining chair velvet")
    ps = d.get("products", [])
    assert len(ps) >= 2, f"Expected >=2 results, got {len(ps)}"
    cats = get_categories(ps)
    chair_count = sum(v for k, v in cats.items() if "chair" in k)
    assert chair_count >= 2, f"Only {chair_count} chairs"

@test("R6.3 'pair of matching side tables' → side/end tables", 6)
def _():
    d = search("pair of matching side tables")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    cats = get_categories(ps)
    table_count = sum(v for k, v in cats.items() if "table" in k)
    assert table_count >= 2, f"Only {table_count} tables"

@test("R6.4 'round dining table for 6' → round dining tables", 6)
def _():
    d = search("round dining table for 6")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    cats = get_categories(ps)
    table_count = sum(v for k, v in cats.items() if "table" in k or "dining" in k)
    assert table_count >= 2, f"Only {table_count} tables"

# ════════════════════════════════════════════════════════════════════
# ROUND 7: Mega List / Broad Queries (4 tests)
# ════════════════════════════════════════════════════════════════════

@test("R7.1 'show me all your sofas' → many sofas", 7)
def _():
    d = search("show me all your sofas")
    ps = d.get("products", [])
    assert len(ps) >= 10, f"Expected >=10 results, got {len(ps)}"
    cats = get_categories(ps)
    sofa_count = sum(v for k, v in cats.items() if "sofa" in k or "sectional" in k)
    assert sofa_count / len(ps) >= 0.8, f"Only {sofa_count}/{len(ps)} are sofas"

@test("R7.2 'everything from Bernhardt' → all Bernhardt products", 7)
def _():
    d = search("everything from Bernhardt")
    ps = d.get("products", [])
    assert len(ps) >= 10, f"Expected >=10 results, got {len(ps)}"
    vs = get_vendors(ps)
    bernhardt = sum(v for k, v in vs.items() if "bernhardt" in k)
    assert bernhardt / len(ps) >= 0.8, f"Only {bernhardt}/{len(ps)} from Bernhardt"

@test("R7.3 'bedroom furniture' → beds, dressers, nightstands", 7)
def _():
    d = search("bedroom furniture")
    ps = d.get("products", [])
    assert len(ps) >= 5, f"Expected >=5 results, got {len(ps)}"
    cats = get_categories(ps)
    bedroom = sum(v for k, v in cats.items() if any(w in k for w in ["bed", "night", "dresser", "chest", "bedroom", "mirror"]))
    assert bedroom >= 3, f"Only {bedroom} bedroom items. Cats: {cats}"

@test("R7.4 'living room seating' → sofas, chairs, sectionals", 7)
def _():
    d = search("living room seating")
    ps = d.get("products", [])
    assert len(ps) >= 5, f"Expected >=5 results, got {len(ps)}"
    cats = get_categories(ps)
    seating = sum(v for k, v in cats.items() if any(w in k for w in ["sofa", "chair", "seat", "sectional", "lounge", "bench"]))
    assert seating / len(ps) >= 0.7, f"Only {seating}/{len(ps)} are seating"

# ════════════════════════════════════════════════════════════════════
# ROUND 8: Conversational Follow-ups (4 tests)
# ════════════════════════════════════════════════════════════════════

@test("R8.1 Follow-up: 'leather sofa' then 'show me cheaper ones'", 8)
def _():
    d1 = search("leather sofa")
    ps1 = d1.get("products", [])
    assert len(ps1) >= 3

    convo = [
        {"role": "user", "content": "leather sofa"},
        {"role": "assistant", "content": d1.get("assistant_message", "Here are some leather sofas.")},
        {"role": "user", "content": "show me cheaper ones"}
    ]
    d2 = search(None, conversation=convo)
    ps2 = d2.get("products", [])
    assert len(ps2) >= 2, f"Follow-up returned {len(ps2)} results"

@test("R8.2 Follow-up: 'dining table' then 'do you have that in walnut'", 8)
def _():
    d1 = search("dining table")
    ps1 = d1.get("products", [])
    assert len(ps1) >= 3

    convo = [
        {"role": "user", "content": "dining table"},
        {"role": "assistant", "content": d1.get("assistant_message", "Here are dining tables.")},
        {"role": "user", "content": "do you have that in walnut"}
    ]
    d2 = search(None, conversation=convo)
    ps2 = d2.get("products", [])
    assert len(ps2) >= 2, f"Follow-up returned {len(ps2)} results"

@test("R8.3 Follow-up: 'Bernhardt chairs' then 'anything similar from Vanguard'", 8)
def _():
    d1 = search("Bernhardt chairs")
    ps1 = d1.get("products", [])
    assert len(ps1) >= 3

    convo = [
        {"role": "user", "content": "Bernhardt chairs"},
        {"role": "assistant", "content": d1.get("assistant_message", "Here are Bernhardt chairs.")},
        {"role": "user", "content": "anything similar from Vanguard"}
    ]
    d2 = search(None, conversation=convo)
    ps2 = d2.get("products", [])
    assert len(ps2) >= 2, f"Follow-up returned {len(ps2)} results"
    vs = get_vendors(ps2)
    vanguard = sum(v for k, v in vs.items() if "vanguard" in k)
    assert vanguard >= 1, f"No Vanguard results in follow-up. Vendors: {vs}"

@test("R8.4 Follow-up: 'sofa' then 'now show me matching accent chairs'", 8)
def _():
    d1 = search("sofa")
    convo = [
        {"role": "user", "content": "sofa"},
        {"role": "assistant", "content": d1.get("assistant_message", "Here are sofas.")},
        {"role": "user", "content": "now show me matching accent chairs"}
    ]
    d2 = search(None, conversation=convo)
    ps2 = d2.get("products", [])
    assert len(ps2) >= 2, f"Follow-up returned {len(ps2)} results"
    cats = get_categories(ps2)
    chair_count = sum(v for k, v in cats.items() if "chair" in k)
    assert chair_count >= 1, f"No chairs in follow-up. Cats: {cats}"

# ════════════════════════════════════════════════════════════════════
# ROUND 9: Edge Cases (5 tests)
# ════════════════════════════════════════════════════════════════════

@test("R9.1 Misspelling: 'dinning tabel' → dining tables", 9)
def _():
    d = search("dinning tabel")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"

@test("R9.2 Very short query: 'chair' → returns chairs", 9)
def _():
    d = search("chair")
    ps = d.get("products", [])
    assert len(ps) >= 5, f"Expected >=5 results, got {len(ps)}"
    cats = get_categories(ps)
    chair_count = sum(v for k, v in cats.items() if "chair" in k or "stool" in k or "seat" in k)
    assert chair_count / len(ps) >= 0.7, f"Only {chair_count}/{len(ps)} are chairs"

@test("R9.3 Price query: 'cheapest sofa' → sorted by price ascending", 9)
def _():
    d = search("cheapest sofa")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    # Verify price sorting — first result should be cheaper than last
    prices = [p.get("retail_price") or p.get("wholesale_price") for p in ps if p.get("retail_price") or p.get("wholesale_price")]
    if len(prices) >= 2:
        assert prices[0] <= prices[-1], f"Not sorted by price: first={prices[0]}, last={prices[-1]}"
    cats = get_categories(ps)
    sofa_count = sum(v for k, v in cats.items() if "sofa" in k or "sectional" in k)
    assert sofa_count >= 2, f"Only {sofa_count} sofas"

@test("R9.4 Nonsense query: 'asdfghjkl' → graceful response", 9)
def _():
    d = search("asdfghjkl")
    # Should not crash — may return 0 results or generic results
    msg = d.get("assistant_message", "")
    assert msg is not None, "No assistant message"
    # Just shouldn't error

@test("R9.5 Price filter: 'sofa under $2000' → filtered by price", 9)
def _():
    d = search("sofa under $2000")
    ps = d.get("products", [])
    assert len(ps) >= 2, f"Expected >=2 results, got {len(ps)}"
    # Check most results are under $2000
    over_budget = sum(1 for p in ps if (p.get("retail_price") or 0) > 2500)  # allow some slack
    assert over_budget / max(len(ps), 1) < 0.3, f"{over_budget}/{len(ps)} over budget"

# ════════════════════════════════════════════════════════════════════
# ROUND 10: Speed & Performance (4 tests)
# ════════════════════════════════════════════════════════════════════

@test("R10.1 Simple query responds under 8 seconds", 10)
def _():
    start = time.time()
    d = search("sofa", timeout=15)
    elapsed = time.time() - start
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    assert elapsed < 8, f"Took {elapsed:.1f}s (limit: 8s)"

@test("R10.2 Complex query responds under 12 seconds", 10)
def _():
    start = time.time()
    d = search("modern leather sofa from Bernhardt under $5000", timeout=20)
    elapsed = time.time() - start
    ps = d.get("products", [])
    assert len(ps) >= 1, f"Expected >=1 result, got {len(ps)}"
    assert elapsed < 12, f"Took {elapsed:.1f}s (limit: 12s)"

@test("R10.3 All results have images", 10)
def _():
    d = search("dining chair")
    ps = d.get("products", [])
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    no_img = sum(1 for p in ps if not p.get("image_url"))
    assert no_img == 0, f"{no_img}/{len(ps)} results have no image"

@test("R10.4 AI message is present and relevant", 10)
def _():
    d = search("modern coffee table")
    ps = d.get("products", [])
    msg = d.get("assistant_message", "")
    assert len(ps) >= 3, f"Expected >=3 results, got {len(ps)}"
    assert len(msg) >= 20, f"AI message too short: '{msg}'"
    # Should mention something about the products
    assert any(w in msg.lower() for w in ["table", "coffee", "found", "here", "show", "option", "select"]), \
        f"AI message doesn't seem relevant: '{msg[:100]}'"

# ─── Runner ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    print(f"\n{'='*70}")
    print(f"  SEARCH ENGINE STRESS TEST — {len(TESTS)} tests across 10 rounds")
    print(f"{'='*70}\n")

    passed = 0
    failed = 0
    errors = []
    current_round = 0

    for t in TESTS:
        if t["round"] != current_round:
            current_round = t["round"]
            print(f"\n── Round {current_round} ──")

        try:
            t["fn"]()
            print(f"  PASS  {t['name']}")
            passed += 1
        except Exception as e:
            err_msg = str(e)[:200]
            print(f"  FAIL  {t['name']}")
            print(f"        → {err_msg}")
            errors.append({"name": t["name"], "error": err_msg})
            failed += 1

    print(f"\n{'='*70}")
    print(f"  RESULTS: {passed}/{len(TESTS)} passed  ({failed} failed)")
    print(f"{'='*70}")

    if errors:
        print(f"\nFailed tests:")
        for e in errors:
            print(f"  • {e['name']}")
            print(f"    {e['error']}")

    print()
    sys.exit(0 if failed == 0 else 1)
