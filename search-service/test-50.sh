#!/bin/bash
# 50-query launch validation test

BASE="http://localhost:4310"
passed=0
failed=0
fail_list=""

run_test() {
  local num="$1"
  local query="$2"
  local escaped_query=$(echo "$query" | sed 's/"/\\"/g')
  local count=$(curl -s -X POST "$BASE/search" \
    -H "content-type: application/json" \
    -d "{\"query\": \"$escaped_query\", \"search_mode\": \"balanced\", \"max_vendors\": 12, \"per_vendor\": 3}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('products',[])))" 2>/dev/null)

  if [ -z "$count" ] || [ "$count" = "0" ]; then
    echo "FAIL #$num: \"$query\" -> $count results"
    failed=$((failed+1))
    fail_list="$fail_list|#$num: $query"
  else
    echo "PASS #$num: \"$query\" -> $count results"
    passed=$((passed+1))
  fi
}

run_test 1 "leather sofa"
run_test 2 "modern dining table seats 8"
run_test 3 "mid century modern lounge chair"
run_test 4 "outdoor dining set teak"
run_test 5 "velvet accent chair blue"
run_test 6 "bench seat sofa with metal legs modern"
run_test 7 "king upholstered bed frame"
run_test 8 "marble top coffee table"
run_test 9 "rattan bar stool"
run_test 10 "sectional with chaise"
run_test 11 "round pedestal dining table"
run_test 12 "brass floor lamp"
run_test 13 "linen slipcovered sofa"
run_test 14 "console table for entryway"
run_test 15 "performance fabric sofa with kids"
run_test 16 "boucle dining chair"
run_test 17 "walnut nightstand"
run_test 18 "swivel barrel chair"
run_test 19 "outdoor lounge chair"
run_test 20 "ceramic table lamp"
run_test 21 "modular sectional"
run_test 22 "leather dining chair"
run_test 23 "wood bookcase"
run_test 24 "upholstered ottoman"
run_test 25 "metal side table"
run_test 26 "tufted headboard king"
run_test 27 "counter height bar stool"
run_test 28 "mohair accent chair"
run_test 29 "white oak dining table"
run_test 30 "wingback chair"
run_test 31 "travertine coffee table"
run_test 32 "chaise lounge"
run_test 33 "pendant light for kitchen island"
run_test 34 "modern sofa under 3000, light colored, small scale"
run_test 35 "cane back dining chair"
run_test 36 "waterfall edge console"
run_test 37 "home office chair, sophisticated, boutique hotel style"
run_test 38 "nesting side tables"
run_test 39 "sectionals with nailhead"
run_test 40 "Hollywood Regency accent chair, velvet, gold legs"
run_test 41 "slipper chair"
run_test 42 "credenza mid century"
run_test 43 "rope wrapped dining chair"
run_test 44 "live edge dining table"
run_test 45 "channel tufted sofa"
run_test 46 "writing desk with drawers"
run_test 47 "club chair leather"
run_test 48 "concrete dining table outdoor"
run_test 49 "parsons dining chair"
run_test 50 "canopy bed frame queen"

echo ""
echo "================================"
echo "LAUNCH VALIDATION: $passed/50 PASSED, $failed/50 FAILED"
if [ $failed -gt 0 ]; then
  echo "Failures:"
  IFS='|' read -ra FAILS <<< "$fail_list"
  for f in "${FAILS[@]}"; do
    [ -n "$f" ] && echo "  $f"
  done
fi
echo "================================"
