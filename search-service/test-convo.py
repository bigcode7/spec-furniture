#!/usr/bin/env python3
"""Test conversational follow-up flows."""
import json, urllib.request

URL = "http://localhost:4310/smart-search"

def search(conversation):
    body = json.dumps({"conversation": conversation}).encode()
    req = urllib.request.Request(URL, data=body, headers={"Content-Type": "application/json"})
    d = json.loads(urllib.request.urlopen(req, timeout=30).read())
    return d

def show(d, label):
    ps = d.get("products", [])
    cats = {}
    for p in ps:
        c = p.get("category", "?")
        cats[c] = cats.get(c, 0) + 1
    vs = {}
    for p in ps[:20]:
        v = p.get("vendor_id", "?")
        vs[v] = vs.get(v, 0) + 1
    top_cats = sorted(cats.items(), key=lambda x: -x[1])[:3]
    top_vs = sorted(vs.items(), key=lambda x: -x[1])[:4]
    msg = d.get("assistant_message", "")[:120]
    status = "PASS" if len(ps) >= 1 else "FAIL"
    print(f"  {status} [{len(ps):>3}] {label}")
    print(f"        cats: {dict(top_cats)}  vendors: {dict(top_vs)}")
    print(f"        AI: {msg}...")
    return ps

def build_summary(ps):
    """Build result summary like the frontend does."""
    top = ps[:8]
    details = []
    for i, p in enumerate(top):
        details.append(f"{i+1}. {p.get('product_name','')} ({p.get('vendor_id','?')}, {p.get('category','?')}, {p.get('material','?')})")
    vs = {}
    for p in ps:
        v = p.get("vendor_id", "?")
        vs[v] = vs.get(v, 0) + 1
    v_summary = ", ".join(f"{v}({c})" for v, c in sorted(vs.items(), key=lambda x: -x[1])[:5])
    return f"Showed {len(ps)} results. Vendors: {v_summary}. Top results:\n" + "\n".join(details)

print("=" * 70)
print("FLOW 1: hooker/bernhardt sofas -> fabric -> blue -> pairing")
print("=" * 70)
convo = []

convo.append({"role": "user", "content": "hooker and bernhardt sofas"})
d = search(convo)
ps = show(d, "hooker and bernhardt sofas")
convo.append({"role": "assistant", "content": d.get("assistant_message", ""), "resultSummary": build_summary(ps)})

convo.append({"role": "user", "content": "just fabric versions"})
d = search(convo)
ps = show(d, "just fabric versions")
convo.append({"role": "assistant", "content": d.get("assistant_message", ""), "resultSummary": build_summary(ps)})

convo.append({"role": "user", "content": "anything in blue"})
d = search(convo)
ps = show(d, "anything in blue")
convo.append({"role": "assistant", "content": d.get("assistant_message", ""), "resultSummary": build_summary(ps)})

convo.append({"role": "user", "content": "what cocktail table would pair with the first one"})
d = search(convo)
ps = show(d, "cocktail table pairing")
print()

print("=" * 70)
print("FLOW 2: modern accent chair <$3k -> Baker -> traditional -> matching ottoman")
print("=" * 70)
convo = []

convo.append({"role": "user", "content": "modern accent chair under $3000"})
d = search(convo)
ps = show(d, "modern accent chair under $3000")
convo.append({"role": "assistant", "content": d.get("assistant_message", ""), "resultSummary": build_summary(ps)})

convo.append({"role": "user", "content": "show me from Baker"})
d = search(convo)
ps = show(d, "show me from Baker")
convo.append({"role": "assistant", "content": d.get("assistant_message", ""), "resultSummary": build_summary(ps)})

convo.append({"role": "user", "content": "what about something more traditional"})
d = search(convo)
ps = show(d, "something more traditional")
convo.append({"role": "assistant", "content": d.get("assistant_message", ""), "resultSummary": build_summary(ps)})

convo.append({"role": "user", "content": "I like that one, find me a matching ottoman"})
d = search(convo)
ps = show(d, "matching ottoman")
print()

print("=" * 70)
print("FLOW 3: dining table seats 10 -> round -> chairs for walnut -> sideboard")
print("=" * 70)
convo = []

convo.append({"role": "user", "content": "dining table that seats 10"})
d = search(convo)
ps = show(d, "dining table seats 10")
convo.append({"role": "assistant", "content": d.get("assistant_message", ""), "resultSummary": build_summary(ps)})

convo.append({"role": "user", "content": "just show me round options"})
d = search(convo)
ps = show(d, "just round options")
convo.append({"role": "assistant", "content": d.get("assistant_message", ""), "resultSummary": build_summary(ps)})

convo.append({"role": "user", "content": "what chairs would go with a walnut round table"})
d = search(convo)
ps = show(d, "chairs for walnut round table")
convo.append({"role": "assistant", "content": d.get("assistant_message", ""), "resultSummary": build_summary(ps)})

convo.append({"role": "user", "content": "now show me a sideboard for the same room"})
d = search(convo)
ps = show(d, "sideboard for same room")

print()
print("=" * 70)
print("ALL FLOWS COMPLETE")
