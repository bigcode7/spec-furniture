#!/bin/bash
# Full Tagging Chain — runs all 3 tagging steps sequentially
# Step 1: Advanced retagger (17 structural fields) on ~27,700 already-tagged products
# Step 2: Creative retagger (12 trade-intel fields) on all tagged products
# Step 3: Tag untagged (full visual + advanced + creative) on ~4,600 non-rug products
#
# Each step auto-commits and pushes on completion.
# Each step has resume capability — safe to interrupt and restart.

set -e
cd "$(dirname "$0")/.."

echo "============================================================"
echo "FULL TAGGING CHAIN — 3 steps"
echo "============================================================"
echo ""
echo "Step 1: Advanced retagger (17 structural fields) ~27,700 products"
echo "Step 2: Creative retagger (12 trade-intel fields) ~28,000 products"
echo "Step 3: Tag untagged (54 fields with image analysis) ~4,600 products"
echo ""
echo "Estimated total cost: ~$120"
echo "Estimated total time: ~4 hours"
echo ""
echo "Starting in 5 seconds... (Ctrl+C to cancel)"
sleep 5

echo ""
echo "════════════════════════════════════════════════════════════"
echo "STEP 1/3 — Advanced Retagger (17 structural fields)"
echo "════════════════════════════════════════════════════════════"
echo ""
node scripts/advanced-retagger.mjs
echo ""
echo "✓ Step 1 complete"
echo ""

# Clear progress file so creative retagger processes all products
rm -f data/creative-retagger-progress.json

echo "════════════════════════════════════════════════════════════"
echo "STEP 2/3 — Creative Trade-Intelligence Retagger (12 fields)"
echo "════════════════════════════════════════════════════════════"
echo ""
node scripts/creative-retagger.mjs
echo ""
echo "✓ Step 2 complete"
echo ""

echo "════════════════════════════════════════════════════════════"
echo "STEP 3/3 — Tag Untagged Products (54 fields with images)"
echo "════════════════════════════════════════════════════════════"
echo ""
node scripts/tag-untagged.mjs
echo ""
echo "✓ Step 3 complete"
echo ""

echo "============================================================"
echo "ALL 3 STEPS COMPLETE"
echo "============================================================"
echo ""
echo "All products have been tagged with the most advanced fields."
echo "Commits have been pushed automatically at each step."
