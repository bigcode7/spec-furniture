#!/usr/bin/env python3
"""Run 20 search accuracy tests against the smart-search endpoint."""
import json, urllib.request, sys

QUERIES = [
    "leather sofa",
    "modern dining table seats 8",
    "Bernhardt accent chairs",
    "boucle swivel chair",
    "walnut credenza",
    "upholstered king bed traditional",
    "Hooker home office",
    "marble cocktail table",
    "performance fabric sectional",
    "coastal bedroom furniture",
    "Baker Thomas Pheasant collection",
    "narrow console table under 14 inches deep",
    "bar stools counter height",
    "channel back dining chair velvet",
    "outdoor sofa commercial grade",
    "Theodore Alexander accent tables",
    "tight back sofa neutral",
    "round dining table for 6",
    "statement accent chair for foyer",
    "quiet luxury bedroom",
]

URL = "http://localhost:4310/smart-search"
passed = 0
failed = 0
low = 0

for q in QUERIES:
    try:
        body = json.dumps({"conversation": [{"role": "user", "content": q}]}).encode()
        req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            d = json.loads(resp.read())

        ps = d.get("products", [])
        cats = {}
        for p in ps:
            c = p.get("category", "?")
            cats[c] = cats.get(c, 0) + 1
        top_cats = sorted(cats.items(), key=lambda x: -x[1])[:4]
        cat_str = ", ".join(f"{c}({n})" for c, n in top_cats)

        vs = {}
        for p in ps[:20]:
            v = p.get("vendor_id", "?")
            vs[v] = vs.get(v, 0) + 1
        top_vs = sorted(vs.items(), key=lambda x: -x[1])[:4]
        v_str = ", ".join(f"{v}({n})" for v, n in top_vs)

        no_img = sum(1 for p in ps if not p.get("image_url"))
        msg = d.get("assistant_message", "")[:140]

        if len(ps) >= 3 and no_img == 0:
            status = "PASS"
            passed += 1
        elif len(ps) > 0:
            status = "LOW "
            low += 1
        else:
            status = "FAIL"
            failed += 1

        print(f"{status} [{len(ps):>3}] {q}")
        print(f"       cats: {cat_str}")
        print(f"       vendors(top20): {v_str}")
        print(f"       bad_imgs: {no_img}")
        print(f"       AI: {msg}...")
        print()
    except Exception as e:
        print(f"ERROR  {q}: {e}")
        print()
        failed += 1

print("=" * 70)
print(f"PASS: {passed}  LOW: {low}  FAIL: {failed}  TOTAL: {len(QUERIES)}")
