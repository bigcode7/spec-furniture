#!/bin/bash
# Accuracy test — show top 10 results for each query so we can verify relevance

BASE="http://localhost:4310"

run_test() {
  local num="$1"
  local query="$2"
  local escaped_query=$(echo "$query" | sed 's/"/\\"/g')

  echo ""
  echo "========================================"
  echo "#$num: \"$query\""
  echo "========================================"

  curl -s -X POST "$BASE/search" \
    -H "content-type: application/json" \
    -d "{\"query\": \"$escaped_query\", \"search_mode\": \"balanced\", \"max_vendors\": 12, \"per_vendor\": 3}" \
    | python3 -c "
import sys, json
d = json.load(sys.stdin)
products = d.get('products', [])
print(f'Total results: {len(products)}')
print(f'Top 10:')
for i, p in enumerate(products[:10]):
    name = p.get('product_name', '?')
    vendor = p.get('manufacturer_name', p.get('vendor_name', '?'))
    cat = p.get('category', p.get('product_type', '?'))
    mat = p.get('material', '?')
    style = p.get('style', '?')
    score = p.get('relevance_score', 0)
    print(f'  {i+1}. {name} | {vendor} | cat:{cat} | mat:{mat} | style:{style} | score:{score:.3f}')
" 2>/dev/null
}

# Critical accuracy queries — ones where wrong results would be obvious
run_test 1 "leather sofa"
run_test 2 "velvet accent chair blue"
run_test 3 "marble top coffee table"
run_test 4 "outdoor dining set teak"
run_test 5 "sectional with chaise"
run_test 6 "rattan bar stool"
run_test 7 "boucle dining chair"
run_test 8 "walnut nightstand"
run_test 9 "linen slipcovered sofa"
run_test 10 "brass floor lamp"
run_test 11 "sectionals with nailhead"
run_test 12 "leather dining chair"
run_test 13 "round pedestal dining table"
run_test 14 "cane back dining chair"
run_test 15 "channel tufted sofa"
run_test 16 "swivel barrel chair"
run_test 17 "wingback chair"
run_test 18 "club chair leather"
run_test 19 "live edge dining table"
run_test 20 "travertine coffee table"

echo ""
echo "========================================"
echo "ACCURACY TEST COMPLETE — Review above results"
echo "========================================"
