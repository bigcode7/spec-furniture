// procurement-intel.mjs
// Procurement intelligence for furniture trade vendors.
// Reflects real trade furniture industry practices and knowledge.

const VENDOR_PROCUREMENT = {
  "century-furniture": {
    vendor_name: "Century Furniture",
    vendor_id: "century-furniture",
    order_method: ["through-rep", "dealer-portal"],
    dealer_portal_url: "https://www.centuryfurniture.com/dealer",
    minimum_order: null,
    com_minimum: "1 yard minimum, 2+ yards recommended",
    typical_deposit: 50,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 8, com: 12, quick_ship: 2 },
    shipping_method: ["white-glove", "freight"],
    freight_cost_estimate: "$200-800 depending on size and region",
    return_policy: "Non-returnable once production begins. Quick-ship items returnable within 30 days.",
    com_col: true,
    com_process: "Ship fabric to vendor. Vendor inspects and confirms yardage before production. Allow extra 2-4 weeks for COM.",
    grade_out: true,
    grade_count: 6,
    grade_pricing: "Grade A to Grade F. Approximately $200-800 price difference between lowest and highest grade.",
    warranty: "Lifetime warranty on frame, 5 years on cushions, 1 year on fabric",
    notes: "Heritage brand. Made in Hickory, NC. Custom sizing available on many pieces for additional charge.",
    trade_discount: "40-50% off retail",
    stocking_program: true,
    stocking_note: "Quick-ship program with 100+ items available in 2-3 weeks",
  },

  "four-hands": {
    vendor_name: "Four Hands",
    vendor_id: "four-hands",
    order_method: ["dealer-portal", "through-rep"],
    dealer_portal_url: "https://www.fourhands.com",
    minimum_order: "$500 opening order",
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["net-30", "credit-card", "pro-forma"],
    lead_time_weeks: { standard: 1, import: 12, preorder: 16 },
    shipping_method: ["freight", "small-parcel"],
    freight_cost_estimate: "$100-500, free freight on orders over $2,500",
    return_policy: "Returnable within 30 days in original packaging. 25% restocking fee.",
    com_col: false,
    com_process: null,
    grade_out: false,
    grade_count: 0,
    grade_pricing: null,
    warranty: "1 year limited warranty on manufacturing defects",
    notes: "Based in Austin, TX. Large warehouse stock program—most items ship within 1-2 weeks. Strong in industrial, reclaimed, and modern styles. Very designer-friendly brand.",
    trade_discount: "50% off retail",
    stocking_program: true,
    stocking_note: "Extensive in-stock program. Most catalog items ship within 1-2 weeks from Texas warehouse.",
  },

  "restoration-hardware": {
    vendor_name: "RH (Restoration Hardware)",
    vendor_id: "restoration-hardware",
    order_method: ["trade-portal", "gallery-visit", "phone"],
    dealer_portal_url: "https://rh.com/trade",
    minimum_order: null,
    com_minimum: null,
    typical_deposit: 50,
    payment_terms: ["credit-card", "rh-trade-account"],
    lead_time_weeks: { standard: 4, custom: 12, in_stock: 1 },
    shipping_method: ["white-glove", "unlimited-furniture-delivery"],
    freight_cost_estimate: "$100-350 flat rate white glove depending on item count",
    return_policy: "Returnable within 30 days. Final sale on custom orders. $200 return pickup fee on furniture.",
    com_col: false,
    com_process: null,
    grade_out: true,
    grade_count: 4,
    grade_pricing: "Perennials, Belgian Linen, Italian Leather, Performance grades. Up to $2,000+ price spread on sofas.",
    warranty: "1 year limited warranty",
    notes: "RH Trade program offers 25% off for designers. Membership program ($175/year) gives 25% off to consumers. Gallery locations for viewing. Long lead times on many custom items.",
    trade_discount: "25% off retail with RH Trade",
    stocking_program: true,
    stocking_note: "In-stock items ship within 1-3 weeks. Custom upholstery is 10-14 weeks.",
  },

  bernhardt: {
    vendor_name: "Bernhardt",
    vendor_id: "bernhardt",
    order_method: ["through-rep", "dealer-portal"],
    dealer_portal_url: "https://www.bernhardt.com/trade",
    minimum_order: null,
    com_minimum: "2 yards minimum",
    typical_deposit: 50,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 8, com: 12, quick_ship: 2 },
    shipping_method: ["white-glove", "freight"],
    freight_cost_estimate: "$200-700 depending on size and distance",
    return_policy: "Non-returnable once production begins. Quick-ship items returnable within 14 days.",
    com_col: true,
    com_process: "Ship fabric to Lenoir, NC facility. Vendor inspects and cut-tests before production. Allow 2-4 extra weeks.",
    grade_out: true,
    grade_count: 5,
    grade_pricing: "Grade 1 through Grade 5 plus leather grades. Approximately $300-1,000 spread depending on piece.",
    warranty: "Lifetime on frame, 5 years on springs and cushions, 1 year on fabric and leather",
    notes: "Family-owned since 1889. Made in Lenoir, NC. Excellent quality-to-price ratio in mid-to-upper market. Strong modern and transitional lines.",
    trade_discount: "40-50% off retail",
    stocking_program: true,
    stocking_note: "Quick-ship program with select items in stock fabrics shipping in 2-3 weeks.",
  },

  "hooker-furniture": {
    vendor_name: "Hooker Furniture",
    vendor_id: "hooker-furniture",
    order_method: ["through-rep", "dealer-portal"],
    dealer_portal_url: "https://www.hookerfurniture.com/trade",
    minimum_order: null,
    com_minimum: "2 yards minimum",
    typical_deposit: 50,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 6, com: 10, import: 14 },
    shipping_method: ["freight", "white-glove"],
    freight_cost_estimate: "$150-600 depending on size and destination",
    return_policy: "Non-returnable on custom orders. Stock items returnable within 30 days with 20% restocking fee.",
    com_col: true,
    com_process: "Ship fabric to Martinsville, VA. Vendor confirms yardage and begins production. Extra 2-4 weeks for COM.",
    grade_out: true,
    grade_count: 5,
    grade_pricing: "Grade A through Grade E. $200-600 spread on most upholstered pieces.",
    warranty: "Limited lifetime warranty on frames, 3 years on mechanisms, 1 year on fabric",
    notes: "Parent company of Hooker, Bradington-Young, and Sam Moore. Bradington-Young specializes in leather recliners. Sam Moore is custom accent chairs. Martinsville, VA based.",
    trade_discount: "40-50% off retail",
    stocking_program: true,
    stocking_note: "Large domestic warehouse with many items available for quick shipment in 1-3 weeks.",
  },

  "universal-furniture": {
    vendor_name: "Universal Furniture",
    vendor_id: "universal-furniture",
    order_method: ["through-rep", "dealer-portal"],
    dealer_portal_url: "https://www.Universalfurniture.com/trade",
    minimum_order: null,
    com_minimum: null,
    typical_deposit: 50,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 4, import: 14, in_stock: 1 },
    shipping_method: ["freight"],
    freight_cost_estimate: "$150-500 depending on size and region",
    return_policy: "Stock items returnable within 30 days with 25% restocking fee. Custom non-returnable.",
    com_col: false,
    com_process: null,
    grade_out: false,
    grade_count: 0,
    grade_pricing: null,
    warranty: "1 year limited warranty",
    notes: "High Point, NC based. Good value in case goods and dining. Many collections designed with prominent designers. Primarily import product with domestic warehousing.",
    trade_discount: "45-50% off retail",
    stocking_program: true,
    stocking_note: "Extensive domestic inventory. Many items ship within 1-2 weeks from NC warehouse.",
  },

  "lee-industries": {
    vendor_name: "Lee Industries",
    vendor_id: "lee-industries",
    order_method: ["through-rep", "dealer-portal"],
    dealer_portal_url: "https://www.leeindustries.com/trade",
    minimum_order: null,
    com_minimum: "1 yard minimum, must pass fire-retardant testing",
    typical_deposit: 50,
    payment_terms: ["net-30"],
    lead_time_weeks: { standard: 8, com: 10, quick_ship: 3 },
    shipping_method: ["freight", "white-glove"],
    freight_cost_estimate: "$200-600 depending on size and region",
    return_policy: "Non-returnable. All upholstery is made to order.",
    com_col: true,
    com_process: "Ship fabric to Newton, NC. Must meet Lee's fire-retardant standards. Railroading must be specified. Allow extra 1-2 weeks for COM.",
    grade_out: true,
    grade_count: 8,
    grade_pricing: "Grade A through Grade H. Wide range—approximately $400-1,500 price difference on sofas between lowest and highest grade.",
    warranty: "Lifetime on frames, 5 years on cushion cores, 2 years on fabric",
    notes: "Made in Newton, NC. Known for quality slipcovered upholstery. Excellent fabric library with 800+ options. Very popular with interior designers. Can customize dimensions.",
    trade_discount: "40-50% off retail",
    stocking_program: true,
    stocking_note: "Quick-ship program with 50+ frames available in select fabrics within 3-4 weeks.",
  },

  "cr-laine": {
    vendor_name: "CR Laine",
    vendor_id: "cr-laine",
    order_method: ["through-rep", "dealer-portal"],
    dealer_portal_url: "https://www.crlaine.com/trade",
    minimum_order: null,
    com_minimum: "1 yard minimum",
    typical_deposit: 50,
    payment_terms: ["net-30"],
    lead_time_weeks: { standard: 6, com: 8, quick_ship: 2 },
    shipping_method: ["freight", "white-glove"],
    freight_cost_estimate: "$150-500 depending on size and region",
    return_policy: "Non-returnable. All upholstery made to order.",
    com_col: true,
    com_process: "Ship fabric to Hickory, NC. Quick turnaround on COM approval. Allow 1-2 extra weeks.",
    grade_out: true,
    grade_count: 6,
    grade_pricing: "Grade A through Grade F. Approximately $200-700 spread on most frames.",
    warranty: "Lifetime on frame, 5 years on cushions, 1 year on fabric",
    notes: "Hickory, NC. Known for colorful, pattern-forward upholstery. Excellent for accent chairs and statement pieces. Fast lead times for custom upholstery. Very designer-friendly.",
    trade_discount: "45-50% off retail",
    stocking_program: true,
    stocking_note: "Quick-ship program with popular frames in curated fabrics available in 2-3 weeks.",
  },

  "hickory-chair": {
    vendor_name: "Hickory Chair",
    vendor_id: "hickory-chair",
    order_method: ["through-rep", "designer-showroom"],
    dealer_portal_url: "https://www.hickorychair.com/trade",
    minimum_order: null,
    com_minimum: "2 yards minimum",
    typical_deposit: 50,
    payment_terms: ["net-30"],
    lead_time_weeks: { standard: 10, com: 14, quick_ship: null },
    shipping_method: ["white-glove", "freight"],
    freight_cost_estimate: "$250-800 depending on size and region",
    return_policy: "Non-returnable. All items made to order.",
    com_col: true,
    com_process: "Ship fabric to Hickory, NC. All COM must pass flammability testing. Vendor provides cutting requirements. Allow 3-4 extra weeks.",
    grade_out: true,
    grade_count: 7,
    grade_pricing: "Grade 1 through Grade 7 plus COM. Significant price range—$500-2,000+ difference on sofas.",
    warranty: "Lifetime on frame, 5 years on cushions, 1 year on fabric",
    notes: "Premium American-made upholstery. Part of Heritage Home Group. Extremely high quality construction. Fully customizable—nail head patterns, finishes, dimensions. Trade-only brand.",
    trade_discount: "40-50% off retail",
    stocking_program: false,
    stocking_note: null,
  },

  arteriors: {
    vendor_name: "Arteriors",
    vendor_id: "arteriors",
    order_method: ["through-rep", "dealer-portal"],
    dealer_portal_url: "https://www.arteriorshome.com/trade",
    minimum_order: "$500 opening order",
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 1, import: 12, custom: 16 },
    shipping_method: ["freight", "small-parcel"],
    freight_cost_estimate: "$75-400 depending on size; free freight on orders $2,500+",
    return_policy: "Returnable within 30 days in original packaging. 25% restocking fee.",
    com_col: false,
    com_process: null,
    grade_out: false,
    grade_count: 0,
    grade_pricing: null,
    warranty: "1 year limited warranty",
    notes: "Dallas, TX based. Specializes in lighting, accessories, mirrors, and accent furniture. Strong in brass, iron, and mixed-material pieces. Very design-forward. Excellent in-stock program.",
    trade_discount: "50% off retail",
    stocking_program: true,
    stocking_note: "Large Dallas warehouse. Most catalog items in stock and ship within 1-2 weeks.",
  },

  noir: {
    vendor_name: "Noir",
    vendor_id: "noir",
    order_method: ["dealer-portal", "through-rep"],
    dealer_portal_url: "https://www.noirfurniturela.com",
    minimum_order: "$1,000 opening order",
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["net-30", "credit-card", "pro-forma"],
    lead_time_weeks: { standard: 1, import: 14, container: 16 },
    shipping_method: ["freight", "small-parcel"],
    freight_cost_estimate: "$100-400; free freight on orders over $3,000",
    return_policy: "Returnable within 14 days. 25% restocking fee. Must be in original packaging.",
    com_col: false,
    com_process: null,
    grade_out: false,
    grade_count: 0,
    grade_pricing: null,
    warranty: "1 year limited warranty on manufacturing defects",
    notes: "Los Angeles based. Known for hand-finished furniture with character. Strong in reclaimed and industrial styles. Each piece has unique variations. Primarily import from Asia.",
    trade_discount: "50% off retail",
    stocking_program: true,
    stocking_note: "LA warehouse with many items in stock. Ships within 1-2 weeks for stocked items.",
  },

  gabby: {
    vendor_name: "Gabby",
    vendor_id: "gabby",
    order_method: ["dealer-portal", "through-rep"],
    dealer_portal_url: "https://www.gabbyhome.com",
    minimum_order: "$500 opening order",
    com_minimum: "2 yards minimum on select frames",
    typical_deposit: 0,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 1, com: 8, custom: 10 },
    shipping_method: ["freight", "small-parcel"],
    freight_cost_estimate: "$100-400; free freight on orders over $2,000",
    return_policy: "Returnable within 30 days. 25% restocking fee. Custom/COM non-returnable.",
    com_col: true,
    com_process: "Ship fabric to SC warehouse. Select frames only accept COM. Allow 6-8 extra weeks for COM production.",
    grade_out: true,
    grade_count: 3,
    grade_pricing: "3 fabric grades with moderate price variation ($100-300 spread).",
    warranty: "1 year limited warranty",
    notes: "Part of Summer Classics family. Strong transitional to modern aesthetic. Good mix of upholstery, case goods, and lighting. Fast shipping on in-stock. Very Instagram-friendly brand.",
    trade_discount: "50% off retail",
    stocking_program: true,
    stocking_note: "Extensive in-stock program in SC warehouse. Most items ship within 1 week.",
  },

  "worlds-away": {
    vendor_name: "Worlds Away",
    vendor_id: "worlds-away",
    order_method: ["dealer-portal", "through-rep"],
    dealer_portal_url: "https://www.worldsaway.com/trade",
    minimum_order: "$500 opening order",
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 1, import: 12 },
    shipping_method: ["freight", "small-parcel"],
    freight_cost_estimate: "$75-300; free freight on orders over $2,000",
    return_policy: "Returnable within 30 days. 25% restocking fee.",
    com_col: false,
    com_process: null,
    grade_out: false,
    grade_count: 0,
    grade_pricing: null,
    warranty: "1 year limited warranty",
    notes: "Known for mirrored furniture, lacquered pieces, and decorative accent furniture. Strong glam/transitional aesthetic. Good price points for designer accessories.",
    trade_discount: "50% off retail",
    stocking_program: true,
    stocking_note: "Good in-stock availability. Most items ship within 1-2 weeks.",
  },

  "currey-and-company": {
    vendor_name: "Currey & Company",
    vendor_id: "currey-and-company",
    order_method: ["through-rep", "dealer-portal"],
    dealer_portal_url: "https://www.curreyandcompany.com/trade",
    minimum_order: "$500 opening order",
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 1, import: 14 },
    shipping_method: ["freight", "small-parcel"],
    freight_cost_estimate: "$50-300 depending on item size",
    return_policy: "Returnable within 30 days in original packaging. 25% restocking fee.",
    com_col: false,
    com_process: null,
    grade_out: false,
    grade_count: 0,
    grade_pricing: null,
    warranty: "1 year limited warranty",
    notes: "Based in Atlanta. Premier lighting and accent furniture brand. Known for statement chandeliers and unique materials. Strong natural and organic aesthetic alongside traditional designs.",
    trade_discount: "50% off retail",
    stocking_program: true,
    stocking_note: "Atlanta warehouse with excellent stock levels. Most items ship within 1-2 weeks.",
  },

  "visual-comfort": {
    vendor_name: "Visual Comfort & Co.",
    vendor_id: "visual-comfort",
    order_method: ["dealer-portal", "through-rep", "showroom"],
    dealer_portal_url: "https://www.visualcomfort.com/trade",
    minimum_order: null,
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 1, custom: 8, import: 12 },
    shipping_method: ["freight", "small-parcel"],
    freight_cost_estimate: "$25-200; free shipping on most orders over $1,000",
    return_policy: "Returnable within 30 days. Custom finishes non-returnable.",
    com_col: false,
    com_process: null,
    grade_out: false,
    grade_count: 0,
    grade_pricing: null,
    warranty: "1 year limited warranty",
    notes: "The dominant force in designer lighting. Houses multiple brands: Visual Comfort,Aerin, Chapman & Myers, Kate Spade, Ralph Lauren Home lighting. Largest designer lighting inventory in the industry.",
    trade_discount: "40-50% off retail",
    stocking_program: true,
    stocking_note: "Massive Houston warehouse. 90% of catalog in stock and ships within 1-3 business days.",
  },

  "regina-andrew": {
    vendor_name: "Regina Andrew",
    vendor_id: "regina-andrew",
    order_method: ["dealer-portal", "through-rep"],
    dealer_portal_url: "https://www.reginaandrew.com/trade",
    minimum_order: "$500 opening order",
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 1, import: 12 },
    shipping_method: ["freight", "small-parcel"],
    freight_cost_estimate: "$50-200; free freight on orders over $2,000",
    return_policy: "Returnable within 30 days. 25% restocking fee.",
    com_col: false,
    com_process: null,
    grade_out: false,
    grade_count: 0,
    grade_pricing: null,
    warranty: "1 year limited warranty",
    notes: "Detroit-based. Strong in lighting, accent furniture, and accessories. Modern glam aesthetic. Very popular on social media. Good value for designer-quality lighting.",
    trade_discount: "50% off retail",
    stocking_program: true,
    stocking_note: "Detroit warehouse with strong in-stock levels. Most items ship within 1-2 weeks.",
  },

  "made-goods": {
    vendor_name: "Made Goods",
    vendor_id: "made-goods",
    order_method: ["through-rep", "showroom"],
    dealer_portal_url: "https://www.madegoods.com/trade",
    minimum_order: "$2,500 opening order",
    com_minimum: "3 yards minimum",
    typical_deposit: 50,
    payment_terms: ["net-30", "pro-forma"],
    lead_time_weeks: { standard: 2, com: 10, custom: 14 },
    shipping_method: ["white-glove", "freight"],
    freight_cost_estimate: "$200-600; white glove pricing varies by region",
    return_policy: "Returnable within 14 days in original packaging. 25% restocking fee. COM non-returnable.",
    com_col: true,
    com_process: "Ship fabric to LA facility. Minimum 3 yards. Must pass Made Goods quality inspection. Allow 8-10 extra weeks.",
    grade_out: true,
    grade_count: 4,
    grade_pricing: "4 fabric/material grades. Premium materials (shagreen, raffia) at significant upcharge.",
    warranty: "1 year limited warranty",
    notes: "Ultra high-end accent furniture, dining chairs, and accessories. Known for unique materials: shagreen, raffia, coco beads, grasscloth. Every piece is a statement. Very popular with high-end designers.",
    trade_discount: "50% off retail",
    stocking_program: true,
    stocking_note: "LA warehouse with most items in stock. Ships within 1-2 weeks for stocked items.",
  },

  palecek: {
    vendor_name: "Palecek",
    vendor_id: "palecek",
    order_method: ["through-rep", "dealer-portal"],
    dealer_portal_url: "https://www.palecek.com/trade",
    minimum_order: "$500 opening order",
    com_minimum: "2 yards minimum",
    typical_deposit: 50,
    payment_terms: ["net-30", "credit-card"],
    lead_time_weeks: { standard: 2, com: 10, custom: 12 },
    shipping_method: ["freight"],
    freight_cost_estimate: "$150-500 depending on size and destination",
    return_policy: "Stock items returnable within 30 days with 25% restocking fee. Custom/COM non-returnable.",
    com_col: true,
    com_process: "Ship fabric to Richmond, CA facility. Minimum 2 yards. Allow 8-10 weeks for COM pieces.",
    grade_out: true,
    grade_count: 4,
    grade_pricing: "4 grades with moderate variation. Natural materials carry premium over standard fabrics.",
    warranty: "1 year limited warranty",
    notes: "Richmond, CA based. Specialists in natural fiber furniture—rattan, wicker, seagrass, abaca. Coastal and organic modern aesthetic. Handcrafted artisan quality. Each piece has natural variation.",
    trade_discount: "50% off retail",
    stocking_program: true,
    stocking_note: "CA warehouse with core items in stock. Ships within 2-3 weeks for stocked items.",
  },

  "serena-and-lily": {
    vendor_name: "Serena & Lily",
    vendor_id: "serena-and-lily",
    order_method: ["trade-portal", "phone", "design-shop"],
    dealer_portal_url: "https://www.serenaandlily.com/trade",
    minimum_order: null,
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["credit-card"],
    lead_time_weeks: { standard: 2, upholstery: 8, in_stock: 1 },
    shipping_method: ["white-glove", "small-parcel", "freight"],
    freight_cost_estimate: "$99-299 flat rate white glove on most furniture",
    return_policy: "Returnable within 30 days. Furniture has $50 return fee. Custom upholstery non-returnable.",
    com_col: false,
    com_process: null,
    grade_out: true,
    grade_count: 3,
    grade_pricing: "3 fabric tiers. Performance fabrics and premium linens at higher price points.",
    warranty: "1 year limited warranty",
    notes: "Coastal-inspired brand. Retail and trade. Trade program offers 20% off. Known for rattan, blue-and-white palettes, and relaxed California coastal style. Physical design shops in key markets.",
    trade_discount: "20% off retail with trade program",
    stocking_program: true,
    stocking_note: "Good in-stock availability on core items. Ships within 1-2 weeks.",
  },

  "mcgee-and-co": {
    vendor_name: "McGee & Co.",
    vendor_id: "mcgee-and-co",
    order_method: ["website", "trade-portal"],
    dealer_portal_url: "https://www.mcgeeandco.com/trade",
    minimum_order: null,
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["credit-card"],
    lead_time_weeks: { standard: 2, upholstery: 10, in_stock: 1 },
    shipping_method: ["white-glove", "small-parcel", "freight"],
    freight_cost_estimate: "$149-399 white glove on furniture items",
    return_policy: "Returnable within 30 days in original condition. Custom upholstery non-returnable. Furniture return fee applies.",
    com_col: false,
    com_process: null,
    grade_out: true,
    grade_count: 3,
    grade_pricing: "3 fabric grades on upholstered pieces. Moderate price variation.",
    warranty: "1 year limited warranty",
    notes: "Founded by Shea McGee (Netflix Dream Home Makeover). Modern traditional aesthetic. Retail and trade. Trade program offers 15-20% off. Strong in curated accessories, lighting, and upholstery.",
    trade_discount: "15-20% off retail with trade program",
    stocking_program: true,
    stocking_note: "Most accessories and in-stock furniture ships within 1-2 weeks. Upholstery made to order.",
  },

  "lulu-and-georgia": {
    vendor_name: "Lulu and Georgia",
    vendor_id: "lulu-and-georgia",
    order_method: ["website", "trade-portal"],
    dealer_portal_url: "https://www.luluandgeorgia.com/trade",
    minimum_order: null,
    com_minimum: null,
    typical_deposit: 0,
    payment_terms: ["credit-card"],
    lead_time_weeks: { standard: 2, made_to_order: 10, in_stock: 1 },
    shipping_method: ["white-glove", "small-parcel", "freight"],
    freight_cost_estimate: "$149-349 flat rate white glove; free shipping over $75 on small items",
    return_policy: "Returnable within 30 days. Furniture has flat-rate return fee. Made-to-order non-returnable.",
    com_col: false,
    com_process: null,
    grade_out: false,
    grade_count: 0,
    grade_pricing: null,
    warranty: "1 year limited warranty",
    notes: "LA-based e-commerce brand. Modern bohemian and California-cool aesthetic. Trade program offers 15-20% off. Strong in rugs, accent furniture, and accessories. Curated designer collections.",
    trade_discount: "15-20% off retail with trade program",
    stocking_program: true,
    stocking_note: "In-stock items ship within 1-2 weeks from LA and East Coast warehouses.",
  },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Normalise a string for fuzzy comparison.
 */
function normalise(str) {
  return str
    .toLowerCase()
    .replace(/[-_&]/g, " ")
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple similarity score between two strings (0-1).
 */
function similarity(a, b) {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const tokA = new Set(na.split(" "));
  const tokB = new Set(nb.split(" "));
  let shared = 0;
  for (const t of tokA) {
    if (tokB.has(t)) shared++;
  }
  const union = new Set([...tokA, ...tokB]).size;
  return union === 0 ? 0 : shared / union;
}

// ─────────────────────────────────────────────
// COM Yardage Reference
// ─────────────────────────────────────────────

const COM_YARDAGE = {
  "accent-chair": { yards_min: 5, yards_max: 7, label: "Accent Chair" },
  "club-chair": { yards_min: 6, yards_max: 8, label: "Club Chair" },
  "wing-chair": { yards_min: 7, yards_max: 9, label: "Wing Chair" },
  "sofa-small": { yards_min: 14, yards_max: 16, label: "Sofa (under 84\")" },
  "sofa-standard": { yards_min: 16, yards_max: 20, label: "Sofa (84\"-96\")" },
  "sofa-large": { yards_min: 20, yards_max: 24, label: "Sofa (over 96\")" },
  sectional: { yards_min: 25, yards_max: 35, label: "Sectional" },
  loveseat: { yards_min: 10, yards_max: 14, label: "Loveseat" },
  "dining-chair": { yards_min: 2, yards_max: 3, label: "Dining Chair" },
  "dining-chair-host": { yards_min: 3, yards_max: 5, label: "Dining Host Chair" },
  ottoman: { yards_min: 3, yards_max: 5, label: "Ottoman" },
  bench: { yards_min: 3, yards_max: 6, label: "Bench" },
  "headboard-twin": { yards_min: 4, yards_max: 5, label: "Headboard (Twin)" },
  "headboard-full": { yards_min: 5, yards_max: 6, label: "Headboard (Full)" },
  "headboard-queen": { yards_min: 6, yards_max: 8, label: "Headboard (Queen)" },
  "headboard-king": { yards_min: 8, yards_max: 10, label: "Headboard (King)" },
  "bed-frame-queen": { yards_min: 10, yards_max: 14, label: "Upholstered Bed (Queen)" },
  "bed-frame-king": { yards_min: 12, yards_max: 16, label: "Upholstered Bed (King)" },
  barstool: { yards_min: 1.5, yards_max: 3, label: "Barstool" },
  chaise: { yards_min: 10, yards_max: 14, label: "Chaise Lounge" },
  daybed: { yards_min: 12, yards_max: 16, label: "Daybed" },
};

// ─────────────────────────────────────────────
// Freight zone estimates (simplified)
// ─────────────────────────────────────────────

const FREIGHT_ZONES = {
  "northeast": { base: 200, per_lb: 0.35 },
  "southeast": { base: 150, per_lb: 0.30 },
  "midwest": { base: 175, per_lb: 0.32 },
  "southwest": { base: 200, per_lb: 0.35 },
  "west": { base: 225, per_lb: 0.38 },
  "northwest": { base: 250, per_lb: 0.40 },
};

function getZoneFromZip(zip) {
  if (!zip) return "southeast"; // default to SE (most vendors based there)
  const prefix = parseInt(String(zip).slice(0, 3), 10);
  if (prefix >= 0 && prefix <= 199) return "northeast";
  if (prefix >= 200 && prefix <= 399) return "southeast";
  if (prefix >= 400 && prefix <= 599) return "midwest";
  if (prefix >= 600 && prefix <= 799) return "southwest";
  if (prefix >= 800 && prefix <= 899) return "west";
  if (prefix >= 900 && prefix <= 999) return "west";
  return "southeast";
}

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * Get procurement info for a vendor by ID or name (fuzzy match).
 */
export function getVendorProcurement(vendorId) {
  if (!vendorId) return null;

  const normId = normalise(vendorId).replace(/\s+/g, "-");

  // Direct key lookup
  if (VENDOR_PROCUREMENT[normId]) {
    return VENDOR_PROCUREMENT[normId];
  }

  // Fuzzy match against keys and names
  let best = null;
  let bestScore = 0;

  for (const [key, vendor] of Object.entries(VENDOR_PROCUREMENT)) {
    const scores = [
      similarity(vendorId, key),
      similarity(vendorId, vendor.vendor_name),
    ];
    const score = Math.max(...scores);
    if (score > bestScore) {
      bestScore = score;
      best = vendor;
    }
  }

  return bestScore >= 0.4 ? best : null;
}

/**
 * Return the full vendor procurement database.
 */
export function getAllVendorProcurement() {
  return VENDOR_PROCUREMENT;
}

/**
 * Get procurement summary for a product.
 * Matches product.vendor_name to our procurement database.
 */
export function getProductProcurement(product) {
  if (!product) return null;

  const vendorName = product.vendor_name || product.manufacturer_name || product.vendor || product.brand || "";
  const vendor = getVendorProcurement(vendorName);

  if (!vendor) {
    return {
      vendor_info: null,
      lead_time: "Unknown — vendor not in procurement database",
      deposit: null,
      shipping: "Contact vendor for shipping details",
      ordering_steps: [
        "Identify vendor contact or sales representative.",
        "Request trade pricing and current availability.",
        "Confirm lead time, freight cost, and payment terms.",
        "Place order with required deposit.",
        "Track order and coordinate delivery.",
      ],
    };
  }

  const leadTimes = vendor.lead_time_weeks;
  const standardWeeks = leadTimes.standard || leadTimes.import || 8;
  const quickWeeks = leadTimes.quick_ship || leadTimes.in_stock || null;

  const orderingSteps = [];

  // Step 1: How to order
  if (vendor.order_method.includes("dealer-portal")) {
    orderingSteps.push(`Log in to dealer portal at ${vendor.dealer_portal_url || "vendor website"}.`);
  } else if (vendor.order_method.includes("through-rep")) {
    orderingSteps.push("Contact your sales representative to place the order.");
  } else if (vendor.order_method.includes("trade-portal")) {
    orderingSteps.push(`Place order through trade portal at ${vendor.dealer_portal_url || "vendor website"}.`);
  } else {
    orderingSteps.push("Contact vendor directly to place order.");
  }

  // Step 2: Payment
  if (vendor.typical_deposit > 0) {
    orderingSteps.push(`Submit ${vendor.typical_deposit}% deposit at time of order. Balance due on delivery.`);
  } else {
    orderingSteps.push("Full payment at time of order via accepted payment methods.");
  }

  // Step 3: Lead time
  if (quickWeeks) {
    orderingSteps.push(
      `Standard lead time: ${standardWeeks} weeks. Quick-ship/in-stock: ${quickWeeks} week(s).`
    );
  } else {
    orderingSteps.push(`Expected lead time: ${standardWeeks} weeks from order date.`);
  }

  // Step 4: Shipping
  orderingSteps.push(
    `Shipping via ${vendor.shipping_method.join(" or ")}. Estimated freight: ${vendor.freight_cost_estimate}.`
  );

  // Step 5: Delivery
  orderingSteps.push("Inspect upon delivery. Document any damage before signing delivery receipt.");

  return {
    vendor_info: vendor,
    lead_time: quickWeeks
      ? `${quickWeeks}-${standardWeeks} weeks depending on stock availability`
      : `${standardWeeks} weeks`,
    deposit: vendor.typical_deposit > 0 ? `${vendor.typical_deposit}%` : "None — paid in full at order",
    shipping: vendor.freight_cost_estimate,
    ordering_steps: orderingSteps,
  };
}

/**
 * Estimate total cost including freight and delivery.
 *
 * Returns: { product_price, estimated_freight, white_glove_fee, total_estimated }
 */
export function estimateFullCost(product, deliveryZip) {
  const price = product?.price || product?.trade_price || 0;
  const vendorName = product?.vendor_name || product?.vendor || product?.brand || "";
  const vendor = getVendorProcurement(vendorName);

  // Estimate weight from category if not provided
  const estimatedWeight = product?.weight_lbs || estimateWeight(product);

  const zone = getZoneFromZip(deliveryZip);
  const zoneData = FREIGHT_ZONES[zone] || FREIGHT_ZONES["southeast"];

  // Base freight estimate
  let freightEstimate = zoneData.base + estimatedWeight * zoneData.per_lb;

  // Adjust if vendor offers free freight thresholds
  if (vendor && price > 2500 && vendor.freight_cost_estimate.includes("free")) {
    freightEstimate = 0;
  }

  // White-glove fee (typically $100-200 on top of freight for inside delivery and placement)
  let whiteGloveFee = 0;
  if (vendor && vendor.shipping_method.includes("white-glove")) {
    whiteGloveFee = estimatedWeight > 200 ? 200 : estimatedWeight > 100 ? 150 : 100;
  }

  freightEstimate = Math.round(freightEstimate);

  return {
    product_price: price,
    estimated_freight: freightEstimate,
    white_glove_fee: whiteGloveFee,
    total_estimated: price + freightEstimate + whiteGloveFee,
    note: "Freight estimates are approximate and may vary. Contact vendor for exact shipping quote.",
  };
}

/**
 * Rough weight estimate based on product category.
 */
function estimateWeight(product) {
  const cat = normalise(product?.category || product?.type || "");
  if (cat.includes("sofa") || cat.includes("couch")) return 150;
  if (cat.includes("sectional")) return 250;
  if (cat.includes("chair") && cat.includes("dining")) return 25;
  if (cat.includes("chair")) return 60;
  if (cat.includes("table") && cat.includes("dining")) return 120;
  if (cat.includes("table") && (cat.includes("coffee") || cat.includes("cocktail"))) return 60;
  if (cat.includes("table") && (cat.includes("side") || cat.includes("end") || cat.includes("accent"))) return 30;
  if (cat.includes("table") && cat.includes("console")) return 50;
  if (cat.includes("bed")) return 180;
  if (cat.includes("dresser") || cat.includes("chest")) return 140;
  if (cat.includes("nightstand")) return 40;
  if (cat.includes("bookcase") || cat.includes("shelving")) return 100;
  if (cat.includes("ottoman")) return 35;
  if (cat.includes("bench")) return 40;
  if (cat.includes("mirror")) return 25;
  if (cat.includes("lighting") || cat.includes("lamp") || cat.includes("chandelier")) return 15;
  if (cat.includes("rug")) return 30;
  return 75; // default
}

/**
 * Estimate COM (Customer's Own Material) yardage requirements.
 *
 * category: furniture type key or description
 * product_width_in: optional width of the piece in inches
 *
 * Returns: { yards_min, yards_max, yards_recommended, note }
 */
export function estimateCOMYardage(category, product_width_in) {
  if (!category) {
    return {
      yards_min: null,
      yards_max: null,
      yards_recommended: null,
      note: "Please provide a furniture category to estimate COM yardage.",
    };
  }

  const normCat = normalise(category);

  // Try direct key match
  if (COM_YARDAGE[normCat]) {
    const ref = COM_YARDAGE[normCat];
    const recommended = Math.ceil((ref.yards_min + ref.yards_max) / 2) + 1;
    return {
      yards_min: ref.yards_min,
      yards_max: ref.yards_max,
      yards_recommended: recommended,
      note: `For ${ref.label}: order ${recommended} yards to be safe. This includes ~10% waste allowance. If using a patterned fabric with a large repeat, add 15-20% more.`,
    };
  }

  // Fuzzy match to COM_YARDAGE keys
  let bestKey = null;
  let bestScore = 0;
  for (const key of Object.keys(COM_YARDAGE)) {
    const score = similarity(category, COM_YARDAGE[key].label);
    const keyScore = similarity(category, key);
    const best = Math.max(score, keyScore);
    if (best > bestScore) {
      bestScore = best;
      bestKey = key;
    }
  }

  if (bestKey && bestScore >= 0.4) {
    const ref = COM_YARDAGE[bestKey];

    // Adjust for width if provided
    let minYards = ref.yards_min;
    let maxYards = ref.yards_max;

    if (product_width_in) {
      // Rough scaling: base estimates assume standard width. Scale proportionally.
      const standardWidths = {
        "accent-chair": 30, "club-chair": 34, "wing-chair": 32,
        "sofa-small": 78, "sofa-standard": 88, "sofa-large": 100,
        sectional: 110, loveseat: 60,
        "dining-chair": 20, "dining-chair-host": 24,
        ottoman: 24, bench: 48,
        "headboard-twin": 40, "headboard-full": 56,
        "headboard-queen": 62, "headboard-king": 78,
        "bed-frame-queen": 62, "bed-frame-king": 78,
        barstool: 18, chaise: 68, daybed: 80,
      };
      const stdWidth = standardWidths[bestKey] || 48;
      const ratio = product_width_in / stdWidth;
      if (ratio > 1.1) {
        minYards = Math.ceil(minYards * ratio);
        maxYards = Math.ceil(maxYards * ratio);
      }
    }

    const recommended = Math.ceil((minYards + maxYards) / 2) + 1;

    return {
      yards_min: minYards,
      yards_max: maxYards,
      yards_recommended: recommended,
      note: `For ${ref.label}: order ${recommended} yards to be safe (includes ~10% waste). Patterned fabrics with large repeats may require 15-20% more. Always confirm with the vendor's COM department.`,
    };
  }

  // Fallback
  return {
    yards_min: 5,
    yards_max: 10,
    yards_recommended: 8,
    note: "Unable to match specific category. Providing general estimate of 5-10 yards. Please confirm with vendor's COM department for accurate yardage requirements.",
  };
}

/**
 * Check if a vendor accepts COM (Customer's Own Material).
 *
 * Returns: { available, process, extra_lead_time_weeks, minimum_yardage }
 */
export function checkCOMAvailability(vendorId) {
  const vendor = getVendorProcurement(vendorId);

  if (!vendor) {
    return {
      available: false,
      process: "Vendor not found in procurement database. Contact vendor directly to inquire about COM.",
      extra_lead_time_weeks: null,
      minimum_yardage: null,
    };
  }

  if (!vendor.com_col) {
    return {
      available: false,
      process: `${vendor.vendor_name} does not accept COM/COL on their products.`,
      extra_lead_time_weeks: 0,
      minimum_yardage: null,
    };
  }

  // Calculate extra lead time for COM
  const standardWeeks = vendor.lead_time_weeks.standard || vendor.lead_time_weeks.import || 8;
  const comWeeks = vendor.lead_time_weeks.com || standardWeeks + 4;
  const extraWeeks = comWeeks - standardWeeks;

  return {
    available: true,
    process: vendor.com_process || "Contact vendor for COM process details.",
    extra_lead_time_weeks: extraWeeks,
    minimum_yardage: vendor.com_minimum || "Contact vendor for minimum yardage requirements.",
  };
}
