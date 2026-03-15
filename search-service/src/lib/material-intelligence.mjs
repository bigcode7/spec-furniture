// material-intelligence.mjs
// Comprehensive material knowledge base for furniture sourcing.
// Data reflects real interior design industry knowledge for trade professionals.

const MATERIALS = {
  "performance-fabric": {
    name: "Performance Fabric",
    category: "upholstery",
    durability: 9,
    cleaning_difficulty: 2,
    fading_resistance: 8,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 15,
    best_for_rooms: ["living-room", "family-room", "dining-room", "outdoor", "media-room"],
    avoid_for_rooms: [],
    care_instructions:
      "Spot clean with mild soap and water. Most stains wipe off easily. Machine washable covers on many pieces.",
    notes:
      "Crypton, Sunbrella, and Revolution are leading performance fabric brands. Virtually indistinguishable from natural fabrics.",
    price_tier: "mid",
    sustainability: "varies",
  },
  "natural-linen": {
    name: "Natural Linen",
    category: "upholstery",
    durability: 5,
    cleaning_difficulty: 7,
    fading_resistance: 4,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 8,
    best_for_rooms: ["bedroom", "formal-living-room", "home-office"],
    avoid_for_rooms: ["family-room", "dining-room", "outdoor", "nursery"],
    care_instructions:
      "Professional cleaning recommended. Blot spills immediately. Avoid direct sunlight. Wrinkles are natural and considered part of the aesthetic.",
    notes:
      "Beautiful casual texture but wrinkles easily and stains are difficult to remove. 'Lived-in' look is intentional.",
    price_tier: "mid",
    sustainability: "high",
  },
  cotton: {
    name: "Cotton",
    category: "upholstery",
    durability: 6,
    cleaning_difficulty: 5,
    fading_resistance: 4,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 7,
    best_for_rooms: ["bedroom", "living-room", "home-office"],
    avoid_for_rooms: ["outdoor", "sunroom", "high-traffic-hallway"],
    care_instructions:
      "Most cotton slipcovers are machine washable. Spot clean upholstered pieces. Will fade in direct sun; rotate cushions regularly.",
    notes:
      "Breathable and comfortable. Slipcover options make it more practical. Prone to fading and pilling over time.",
    price_tier: "budget",
    sustainability: "high",
  },
  velvet: {
    name: "Velvet",
    category: "upholstery",
    durability: 6,
    cleaning_difficulty: 6,
    fading_resistance: 5,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 10,
    best_for_rooms: ["living-room", "bedroom", "formal-living-room", "dining-room"],
    avoid_for_rooms: ["outdoor", "mudroom", "nursery"],
    care_instructions:
      "Vacuum with soft brush attachment. Steam to remove crush marks. Professional cleaning recommended for stains. Brush in direction of nap.",
    notes:
      "Shows seat marks and finger trails (called 'watermarking'). Performance velvet options now available that resist stains and crushing.",
    price_tier: "mid",
    sustainability: "varies",
  },
  boucle: {
    name: "Bouclé",
    category: "upholstery",
    durability: 4,
    cleaning_difficulty: 7,
    fading_resistance: 5,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 6,
    best_for_rooms: ["bedroom", "formal-living-room", "home-office"],
    avoid_for_rooms: ["family-room", "nursery", "mudroom", "media-room", "outdoor"],
    care_instructions:
      "Professional cleaning only. Do not rub stains—blot gently. Keep away from velcro, pet claws, and jewelry that can snag loops.",
    notes:
      "Extremely trendy but very high maintenance. Looped texture snags easily on pet claws, jewelry, and velcro. Not recommended for households with cats.",
    price_tier: "premium",
    sustainability: "varies",
  },
  mohair: {
    name: "Mohair",
    category: "upholstery",
    durability: 7,
    cleaning_difficulty: 6,
    fading_resistance: 6,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 15,
    best_for_rooms: ["formal-living-room", "bedroom", "home-office", "library"],
    avoid_for_rooms: ["family-room", "outdoor", "nursery", "mudroom"],
    care_instructions:
      "Professional cleaning only. Brush regularly with soft-bristle brush. Blot spills immediately. Naturally flame retardant.",
    notes:
      "One of the most durable natural fibers. Luxurious sheen and incredibly soft hand. Very expensive but ages beautifully. Often blended with wool.",
    price_tier: "luxury",
    sustainability: "high",
  },
  wool: {
    name: "Wool",
    category: "upholstery",
    durability: 7,
    cleaning_difficulty: 5,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: false,
    commercial_grade: true,
    expected_lifespan_years: 12,
    best_for_rooms: ["living-room", "bedroom", "home-office", "dining-room", "library"],
    avoid_for_rooms: ["outdoor", "bathroom"],
    care_instructions:
      "Vacuum regularly. Blot spills immediately—wool is naturally stain resistant due to lanolin. Professional cleaning for deep stains.",
    notes:
      "Naturally soil and flame resistant. Excellent for high-use pieces when blended with nylon for added strength. Temperature regulating.",
    price_tier: "premium",
    sustainability: "high",
  },
  silk: {
    name: "Silk",
    category: "upholstery",
    durability: 3,
    cleaning_difficulty: 9,
    fading_resistance: 2,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 5,
    best_for_rooms: ["formal-living-room", "bedroom"],
    avoid_for_rooms: [
      "family-room",
      "dining-room",
      "outdoor",
      "nursery",
      "kitchen",
      "media-room",
      "mudroom",
    ],
    care_instructions:
      "Dry clean only. Avoid water—even water drops can leave permanent marks. Keep out of direct sunlight. Rotate cushions frequently.",
    notes:
      "Extremely delicate and impractical for everyday use. Fades rapidly in sunlight. Water stains permanently. Best reserved for low-use decorative pieces.",
    price_tier: "luxury",
    sustainability: "high",
  },
  microfiber: {
    name: "Microfiber",
    category: "upholstery",
    durability: 8,
    cleaning_difficulty: 2,
    fading_resistance: 7,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 10,
    best_for_rooms: ["family-room", "living-room", "media-room", "nursery", "basement"],
    avoid_for_rooms: ["formal-living-room"],
    care_instructions:
      "Wipe with damp cloth. Most spills bead up and wipe away. Machine washable covers available. Vacuum regularly to prevent dust buildup.",
    notes:
      "Extremely practical and stain resistant. Can look less refined than natural fabrics. Excellent for family and pet-friendly spaces. Attracts less dust mites.",
    price_tier: "budget",
    sustainability: "low",
  },
  "outdoor-fabric": {
    name: "Outdoor Fabric (Sunbrella)",
    category: "upholstery",
    durability: 9,
    cleaning_difficulty: 1,
    fading_resistance: 10,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 10,
    best_for_rooms: ["outdoor", "patio", "sunroom", "pool-house", "covered-porch"],
    avoid_for_rooms: [],
    care_instructions:
      "Hose off or machine wash. Bleach-cleanable without color loss. Mold and mildew resistant. Air dry.",
    notes:
      "Sunbrella is the industry standard. Solution-dyed acrylic resists UV, mold, and mildew. Now available in indoor-quality textures and patterns.",
    price_tier: "mid",
    sustainability: "varies",
  },
  chenille: {
    name: "Chenille",
    category: "upholstery",
    durability: 5,
    cleaning_difficulty: 6,
    fading_resistance: 5,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 7,
    best_for_rooms: ["bedroom", "living-room"],
    avoid_for_rooms: ["family-room", "outdoor", "dining-room"],
    care_instructions:
      "Vacuum with upholstery attachment. Professional cleaning recommended. Avoid rubbing—blot only. Yarns can pull if snagged.",
    notes:
      "Incredibly soft and cozy but the pile can pull and mat over time. Not ideal for homes with pets. Shows wear patterns in high-use areas.",
    price_tier: "mid",
    sustainability: "varies",
  },
  tweed: {
    name: "Tweed",
    category: "upholstery",
    durability: 7,
    cleaning_difficulty: 4,
    fading_resistance: 7,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 12,
    best_for_rooms: ["living-room", "family-room", "home-office", "library", "den"],
    avoid_for_rooms: ["outdoor"],
    care_instructions:
      "Vacuum regularly. Spot clean with mild detergent. Multi-tonal weave naturally hides stains and wear. Professional cleaning for deep stains.",
    notes:
      "Excellent at hiding stains due to multi-colored weave. Very practical for everyday use. Traditional but available in modern colorways.",
    price_tier: "mid",
    sustainability: "varies",
  },
  "canvas-duck": {
    name: "Canvas / Duck Cloth",
    category: "upholstery",
    durability: 8,
    cleaning_difficulty: 3,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 10,
    best_for_rooms: ["family-room", "sunroom", "mudroom", "nursery", "playroom"],
    avoid_for_rooms: ["formal-living-room"],
    care_instructions:
      "Machine washable slipcovers. Spot clean upholstered pieces. Gets softer with each wash. Can be bleached if white.",
    notes:
      "Heavy-duty and highly practical. Popular for slipcovered sofas and casual furniture. Wrinkles are part of the relaxed aesthetic.",
    price_tier: "budget",
    sustainability: "high",
  },
  muslin: {
    name: "Muslin",
    category: "upholstery",
    durability: 3,
    cleaning_difficulty: 4,
    fading_resistance: 3,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 3,
    best_for_rooms: ["staging", "temporary", "guest-room"],
    avoid_for_rooms: ["family-room", "dining-room", "outdoor", "high-traffic-hallway"],
    care_instructions:
      "Machine washable but shrinks. Lightweight and tears easily. Best for temporary or light-use applications.",
    notes:
      "Very lightweight fabric used primarily for staging, prototyping, or temporary upholstery. Not suitable for daily use furniture.",
    price_tier: "budget",
    sustainability: "high",
  },
  "polyester-blend": {
    name: "Polyester Blend",
    category: "upholstery",
    durability: 7,
    cleaning_difficulty: 3,
    fading_resistance: 7,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 10,
    best_for_rooms: ["living-room", "family-room", "dining-room", "home-office", "media-room"],
    avoid_for_rooms: ["outdoor"],
    care_instructions:
      "Spot clean with water-based cleaner. Many are machine washable. Resists wrinkles and fading. Vacuum regularly.",
    notes:
      "Wrinkle resistant and easy to maintain. Often blended with natural fibers for better hand feel. Good all-around performer at accessible price.",
    price_tier: "budget",
    sustainability: "low",
  },

  // --- Leather ---
  "top-grain-leather": {
    name: "Top Grain Leather",
    category: "upholstery",
    durability: 9,
    cleaning_difficulty: 3,
    fading_resistance: 7,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 20,
    best_for_rooms: ["living-room", "family-room", "home-office", "library", "media-room"],
    avoid_for_rooms: ["outdoor"],
    care_instructions:
      "Wipe with damp cloth. Condition with leather conditioner every 6-12 months. Keep away from direct heat and prolonged sunlight.",
    notes:
      "Second highest grade of leather. Sanded and refinished surface is more uniform and stain resistant than full grain. Ages beautifully.",
    price_tier: "premium",
    sustainability: "varies",
  },
  "full-grain-leather": {
    name: "Full Grain Leather",
    category: "upholstery",
    durability: 10,
    cleaning_difficulty: 4,
    fading_resistance: 7,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 25,
    best_for_rooms: ["living-room", "home-office", "library", "family-room", "media-room"],
    avoid_for_rooms: ["outdoor"],
    care_instructions:
      "Dust with dry cloth. Condition every 6-12 months. Develops a patina over time that adds character. Avoid harsh chemicals.",
    notes:
      "The highest quality leather. Shows natural markings, scars, and grain variation—these are signs of authenticity, not defects. Develops a rich patina over decades.",
    price_tier: "luxury",
    sustainability: "varies",
  },
  "bonded-leather": {
    name: "Bonded Leather",
    category: "upholstery",
    durability: 3,
    cleaning_difficulty: 3,
    fading_resistance: 4,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 3,
    best_for_rooms: [],
    avoid_for_rooms: ["all"],
    care_instructions:
      "Wipe with damp cloth. Avoid conditioning products designed for real leather. Will peel regardless of care.",
    notes:
      "Contains only 10-20% real leather scraps bonded to fabric backing. Will peel and flake within 2-5 years guaranteed. Industry professionals unanimously recommend avoiding. Not a good value at any price.",
    price_tier: "budget",
    sustainability: "low",
  },
  "faux-leather": {
    name: "Faux Leather / PU Leather",
    category: "upholstery",
    durability: 5,
    cleaning_difficulty: 2,
    fading_resistance: 5,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: false,
    expected_lifespan_years: 5,
    best_for_rooms: ["dining-room", "home-office", "media-room", "kids-room"],
    avoid_for_rooms: ["outdoor", "sunroom"],
    care_instructions:
      "Wipe with damp cloth. Easy to disinfect. Avoid sharp objects. Does not need conditioning. Keep out of direct sunlight.",
    notes:
      "Vegan-friendly alternative to leather. Quality has improved significantly. Will not develop patina. Can crack or peel after several years. Good mid-range option.",
    price_tier: "budget",
    sustainability: "varies",
  },
  nubuck: {
    name: "Nubuck Leather",
    category: "upholstery",
    durability: 6,
    cleaning_difficulty: 8,
    fading_resistance: 5,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 10,
    best_for_rooms: ["bedroom", "formal-living-room", "home-office"],
    avoid_for_rooms: ["family-room", "dining-room", "outdoor", "nursery", "mudroom"],
    care_instructions:
      "Brush with nubuck brush regularly. Treat with nubuck protector spray. Blot spills immediately—water can stain. Professional cleaning for stains.",
    notes:
      "Top grain leather buffed to a suede-like nap. Incredibly soft but stains very easily. Requires diligent protection and care. Beautiful when well maintained.",
    price_tier: "premium",
    sustainability: "varies",
  },
  "aniline-leather": {
    name: "Aniline Leather",
    category: "upholstery",
    durability: 7,
    cleaning_difficulty: 7,
    fading_resistance: 5,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 15,
    best_for_rooms: ["living-room", "home-office", "library", "bedroom"],
    avoid_for_rooms: ["family-room", "dining-room", "outdoor", "nursery"],
    care_instructions:
      "Dust regularly. Condition every 6 months. No protective topcoat so spills absorb quickly—blot immediately. Keep out of direct sunlight.",
    notes:
      "Dyed with transparent dye only; no protective surface coating. Shows all natural markings and develops character over time. More susceptible to staining than protected leathers.",
    price_tier: "luxury",
    sustainability: "varies",
  },

  // --- Woods ---
  walnut: {
    name: "Walnut",
    category: "wood",
    durability: 8,
    cleaning_difficulty: 3,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 30,
    best_for_rooms: ["living-room", "dining-room", "bedroom", "home-office", "library"],
    avoid_for_rooms: ["outdoor", "bathroom"],
    care_instructions:
      "Dust with soft cloth. Clean with damp cloth and dry immediately. Apply furniture wax or oil annually. Use coasters and trivets.",
    notes:
      "Rich dark brown tone with beautiful grain. Mid-century modern staple. Can lighten with prolonged sun exposure. American Black Walnut is the most prized variety.",
    price_tier: "premium",
    sustainability: "varies",
  },
  "white-oak": {
    name: "White Oak",
    category: "wood",
    durability: 9,
    cleaning_difficulty: 2,
    fading_resistance: 7,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 40,
    best_for_rooms: ["living-room", "dining-room", "bedroom", "bathroom", "kitchen", "home-office"],
    avoid_for_rooms: ["outdoor"],
    care_instructions:
      "Dust regularly. Clean with slightly damp cloth. Oil or wax finish can be refreshed. Very water resistant due to closed grain.",
    notes:
      "The most popular furniture wood currently. Closed grain structure makes it naturally water resistant. Takes stains beautifully. Dominant in modern and transitional design.",
    price_tier: "premium",
    sustainability: "high",
  },
  "red-oak": {
    name: "Red Oak",
    category: "wood",
    durability: 8,
    cleaning_difficulty: 3,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 30,
    best_for_rooms: ["living-room", "dining-room", "bedroom", "home-office"],
    avoid_for_rooms: ["outdoor", "bathroom"],
    care_instructions:
      "Dust and clean with damp cloth. Refinish as needed. Open grain—avoid excessive moisture. Use coasters.",
    notes:
      "Warm pinkish-red undertone. More porous than white oak so less water resistant. Very strong and widely available. Common in traditional and craftsman styles.",
    price_tier: "mid",
    sustainability: "high",
  },
  maple: {
    name: "Maple",
    category: "wood",
    durability: 8,
    cleaning_difficulty: 2,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 30,
    best_for_rooms: ["kitchen", "dining-room", "bedroom", "nursery", "home-office"],
    avoid_for_rooms: ["outdoor", "bathroom"],
    care_instructions:
      "Dust regularly. Clean with mild soap and water. Very hard surface resists scratches. Can be difficult to stain evenly due to tight grain.",
    notes:
      "Very hard and durable with light, creamy color. Tight grain gives smooth finish. Can be difficult to stain evenly—best in natural or painted finishes.",
    price_tier: "mid",
    sustainability: "high",
  },
  cherry: {
    name: "Cherry",
    category: "wood",
    durability: 7,
    cleaning_difficulty: 3,
    fading_resistance: 3,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 25,
    best_for_rooms: ["living-room", "dining-room", "bedroom", "home-office", "library"],
    avoid_for_rooms: ["outdoor", "sunroom"],
    care_instructions:
      "Dust regularly. Avoid prolonged sunlight—cherry darkens significantly with UV exposure. Use furniture polish sparingly.",
    notes:
      "Starts as light pinkish-brown and darkens dramatically to deep reddish-brown over years. This color change is prized and considered a feature. Classic American hardwood.",
    price_tier: "premium",
    sustainability: "high",
  },
  pine: {
    name: "Pine",
    category: "wood",
    durability: 5,
    cleaning_difficulty: 3,
    fading_resistance: 5,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: false,
    expected_lifespan_years: 15,
    best_for_rooms: ["bedroom", "nursery", "guest-room", "mudroom", "cabin"],
    avoid_for_rooms: ["outdoor", "high-traffic-hallway"],
    care_instructions:
      "Dust regularly. Dents and scratches add character. Can be refinished. Knots may weep sap occasionally on newer pieces.",
    notes:
      "Soft wood that dents and scratches easily—many consider this 'character.' Very affordable. Knotty pine has a rustic/farmhouse aesthetic. Yellows with age.",
    price_tier: "budget",
    sustainability: "high",
  },
  teak: {
    name: "Teak",
    category: "wood",
    durability: 10,
    cleaning_difficulty: 2,
    fading_resistance: 9,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 50,
    best_for_rooms: ["outdoor", "patio", "bathroom", "pool-house", "sunroom"],
    avoid_for_rooms: [],
    care_instructions:
      "Can be left untreated outdoors—weathers to silver-gray patina. Apply teak oil to maintain golden color. Clean with mild soap and soft brush.",
    notes:
      "The gold standard for outdoor furniture. Natural oils make it resistant to water, insects, and rot. Weathers to silver-gray if untreated. Plantation-grown teak is sustainable.",
    price_tier: "luxury",
    sustainability: "varies",
  },
  mahogany: {
    name: "Mahogany",
    category: "wood",
    durability: 8,
    cleaning_difficulty: 3,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 35,
    best_for_rooms: ["living-room", "dining-room", "bedroom", "home-office", "library"],
    avoid_for_rooms: ["outdoor"],
    care_instructions:
      "Dust regularly. Polish with quality furniture polish. Refinishes beautifully. Avoid excessive moisture.",
    notes:
      "Classic luxury wood with straight, fine grain and deep reddish-brown color. Resists swelling and shrinking. Historically prized for fine furniture. Ensure sustainably sourced.",
    price_tier: "luxury",
    sustainability: "low",
  },
  acacia: {
    name: "Acacia",
    category: "wood",
    durability: 7,
    cleaning_difficulty: 3,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: false,
    expected_lifespan_years: 20,
    best_for_rooms: ["dining-room", "living-room", "kitchen", "outdoor-covered"],
    avoid_for_rooms: ["outdoor-uncovered"],
    care_instructions:
      "Oil regularly to maintain luster. Clean with damp cloth. Seal for outdoor use. Can crack if overly dry—avoid placing near heat vents.",
    notes:
      "Dramatically varied grain patterns with striking color contrasts. Fast-growing and sustainable. Popular for live-edge dining tables. Each piece is truly unique.",
    price_tier: "mid",
    sustainability: "high",
  },
  "mango-wood": {
    name: "Mango Wood",
    category: "wood",
    durability: 6,
    cleaning_difficulty: 3,
    fading_resistance: 5,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: false,
    expected_lifespan_years: 15,
    best_for_rooms: ["dining-room", "living-room", "bedroom", "home-office"],
    avoid_for_rooms: ["outdoor", "bathroom"],
    care_instructions:
      "Dust regularly. Treat with wood oil every few months. Avoid standing water. Keep away from extreme temperature changes.",
    notes:
      "Harvested from mango fruit trees at end of fruit-bearing life, making it very sustainable. Unique grain with color variations from golden to dark brown. Softer than oak.",
    price_tier: "mid",
    sustainability: "high",
  },
  "reclaimed-wood": {
    name: "Reclaimed Wood",
    category: "wood",
    durability: 7,
    cleaning_difficulty: 4,
    fading_resistance: 7,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: false,
    expected_lifespan_years: 20,
    best_for_rooms: ["dining-room", "living-room", "home-office", "restaurant", "retail"],
    avoid_for_rooms: ["outdoor"],
    care_instructions:
      "Dust with soft cloth. Use appropriate finish for the wood species. Existing patina and character marks should be preserved, not sanded away.",
    notes:
      "Sourced from old barns, factories, and structures. Each piece has unique history and character. Nail holes, saw marks, and weathering are features. Verify source for quality.",
    price_tier: "premium",
    sustainability: "high",
  },
  bamboo: {
    name: "Bamboo",
    category: "wood",
    durability: 7,
    cleaning_difficulty: 2,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 20,
    best_for_rooms: ["bedroom", "dining-room", "home-office", "sunroom", "bathroom"],
    avoid_for_rooms: ["outdoor-uncovered"],
    care_instructions:
      "Dust regularly. Clean with damp cloth. Avoid excessive moisture despite good water resistance. Can be refinished.",
    notes:
      "Technically a grass, not a wood. Extremely fast growing and highly sustainable. Strand-woven bamboo is harder than most hardwoods. Light, modern aesthetic.",
    price_tier: "mid",
    sustainability: "high",
  },

  // --- Stone ---
  marble: {
    name: "Marble",
    category: "stone",
    durability: 7,
    cleaning_difficulty: 7,
    fading_resistance: 9,
    pet_friendly: true,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 50,
    best_for_rooms: ["living-room", "dining-room", "bathroom", "foyer", "bedroom"],
    avoid_for_rooms: ["kitchen", "outdoor", "nursery"],
    care_instructions:
      "Seal every 6-12 months. Clean with pH-neutral cleaner only. Never use vinegar, lemon, or acidic cleaners. Blot spills immediately—do not wipe.",
    notes:
      "Etches with any acid contact (wine, citrus, tomato sauce, vinegar). Requires sealing and careful maintenance. Absolutely stunning but high maintenance. Calacatta and Carrara are most popular varieties.",
    price_tier: "luxury",
    sustainability: "varies",
  },
  travertine: {
    name: "Travertine",
    category: "stone",
    durability: 6,
    cleaning_difficulty: 7,
    fading_resistance: 8,
    pet_friendly: true,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 30,
    best_for_rooms: ["living-room", "foyer", "dining-room", "bathroom"],
    avoid_for_rooms: ["kitchen", "outdoor-uncovered", "nursery"],
    care_instructions:
      "Seal regularly—porous surface absorbs liquids quickly. Use pH-neutral cleaner. Fill natural pits with sealant to prevent debris accumulation.",
    notes:
      "Natural pitting and holes are characteristic. Very porous—requires consistent sealing. Warm, earthy aesthetic. Having a major design resurgence. Honed finish is most popular.",
    price_tier: "premium",
    sustainability: "varies",
  },
  granite: {
    name: "Granite",
    category: "stone",
    durability: 9,
    cleaning_difficulty: 2,
    fading_resistance: 9,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 50,
    best_for_rooms: ["kitchen", "dining-room", "bathroom", "outdoor"],
    avoid_for_rooms: [],
    care_instructions:
      "Seal annually. Clean with mild soap and water. Virtually scratch-proof. Resists heat. One of the most durable natural stones available.",
    notes:
      "Nearly indestructible for furniture use. Less fashionable than marble or quartz in current design trends but incredibly practical. Excellent for outdoor tables.",
    price_tier: "premium",
    sustainability: "varies",
  },
  "quartz-engineered": {
    name: "Quartz (Engineered)",
    category: "stone",
    durability: 9,
    cleaning_difficulty: 1,
    fading_resistance: 8,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 30,
    best_for_rooms: ["kitchen", "dining-room", "bathroom", "home-office"],
    avoid_for_rooms: ["outdoor"],
    care_instructions:
      "Wipe with soap and water. No sealing required—non-porous surface. Avoid placing extremely hot items directly on surface.",
    notes:
      "Engineered from ground quartz and resin. Non-porous so never needs sealing. Does not etch like marble. Can mimic marble veining. Not suitable for outdoor use—UV can yellow the resin.",
    price_tier: "premium",
    sustainability: "varies",
  },
  slate: {
    name: "Slate",
    category: "stone",
    durability: 8,
    cleaning_difficulty: 3,
    fading_resistance: 9,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 40,
    best_for_rooms: ["outdoor", "living-room", "foyer", "patio"],
    avoid_for_rooms: [],
    care_instructions:
      "Seal to prevent staining. Clean with mild detergent. Natural cleft surface has texture—smooth honed finish also available.",
    notes:
      "Naturally textured surface with earthy color palette. Excellent for outdoor use. Layers can flake over time on lower-quality pieces. Very slip-resistant.",
    price_tier: "mid",
    sustainability: "varies",
  },
  concrete: {
    name: "Concrete",
    category: "stone",
    durability: 8,
    cleaning_difficulty: 4,
    fading_resistance: 8,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 30,
    best_for_rooms: ["outdoor", "living-room", "dining-room", "patio", "restaurant"],
    avoid_for_rooms: [],
    care_instructions:
      "Seal every 1-2 years. Clean with pH-neutral cleaner. Can develop hairline cracks—this is normal and adds character. Very heavy—ensure floor can support weight.",
    notes:
      "Industrial aesthetic very popular in modern design. Extremely heavy. Can develop hairline cracks over time. GFRC (glass fiber reinforced concrete) is lighter alternative. Custom colors available.",
    price_tier: "mid",
    sustainability: "varies",
  },
  terrazzo: {
    name: "Terrazzo",
    category: "stone",
    durability: 9,
    cleaning_difficulty: 2,
    fading_resistance: 9,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 40,
    best_for_rooms: ["living-room", "dining-room", "foyer", "bathroom", "outdoor"],
    avoid_for_rooms: [],
    care_instructions:
      "Seal periodically. Clean with pH-neutral cleaner. Polish to restore shine. Extremely low maintenance for a natural material.",
    notes:
      "Composite of marble, quartz, granite, or glass chips set in concrete or resin. Major design comeback. Extremely durable and customizable. Available in tables, accessories, and lighting.",
    price_tier: "premium",
    sustainability: "high",
  },

  // --- Metals ---
  brass: {
    name: "Brass",
    category: "metal",
    durability: 8,
    cleaning_difficulty: 5,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 30,
    best_for_rooms: ["living-room", "dining-room", "bedroom", "bathroom", "foyer"],
    avoid_for_rooms: ["outdoor"],
    care_instructions:
      "Lacquered brass—dust only. Unlacquered brass—polish with brass cleaner or allow to patina naturally. Avoid abrasive cleaners.",
    notes:
      "Warm gold tone. Lacquered finishes maintain shine; unlacquered develops a living patina. Antique brass finish is currently very popular. Pairs beautifully with most wood tones.",
    price_tier: "premium",
    sustainability: "high",
  },
  "steel-iron": {
    name: "Steel / Iron",
    category: "metal",
    durability: 9,
    cleaning_difficulty: 3,
    fading_resistance: 7,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 30,
    best_for_rooms: ["living-room", "dining-room", "outdoor", "industrial-loft", "restaurant"],
    avoid_for_rooms: [],
    care_instructions:
      "Dust regularly. Powder-coated finishes are low maintenance. Raw iron or steel must be sealed to prevent rust. Touch up scratches to prevent corrosion.",
    notes:
      "Industrial aesthetic staple. Powder coating provides durable colored finish. Raw steel/iron will rust without protective coating. Very heavy and strong. Weldable for custom work.",
    price_tier: "mid",
    sustainability: "high",
  },
  "stainless-steel": {
    name: "Stainless Steel",
    category: "metal",
    durability: 9,
    cleaning_difficulty: 4,
    fading_resistance: 9,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 30,
    best_for_rooms: ["kitchen", "outdoor", "dining-room", "modern-living-room", "commercial"],
    avoid_for_rooms: [],
    care_instructions:
      "Wipe with stainless steel cleaner or mild soap. Wipe in direction of grain. Fingerprints show easily on polished finishes. Brushed finish hides prints better.",
    notes:
      "Modern, clean aesthetic. Will not rust or corrode. Shows fingerprints on polished finishes—brushed or matte finishes are more practical. Heavier than aluminum.",
    price_tier: "mid",
    sustainability: "high",
  },
  aluminum: {
    name: "Aluminum",
    category: "metal",
    durability: 7,
    cleaning_difficulty: 2,
    fading_resistance: 8,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 25,
    best_for_rooms: ["outdoor", "patio", "sunroom", "modern-living-room", "pool-house"],
    avoid_for_rooms: [],
    care_instructions:
      "Wipe with damp cloth. Powder-coated aluminum is virtually maintenance-free. Rinse outdoor pieces periodically to prevent salt/dirt buildup.",
    notes:
      "Lightweight and rust-proof—ideal for outdoor furniture. Powder coating allows any color. Easy to move and rearrange. Less premium feel than steel or iron due to light weight.",
    price_tier: "mid",
    sustainability: "high",
  },
  copper: {
    name: "Copper",
    category: "metal",
    durability: 7,
    cleaning_difficulty: 6,
    fading_resistance: 5,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: false,
    expected_lifespan_years: 30,
    best_for_rooms: ["living-room", "dining-room", "bathroom", "kitchen"],
    avoid_for_rooms: ["outdoor-uncovered"],
    care_instructions:
      "Polish with copper cleaner to maintain shine, or allow to develop green verdigris patina. Seal with lacquer or wax to slow patina development.",
    notes:
      "Develops green verdigris patina over time when exposed to air and moisture. Antimicrobial properties. Warm, unique aesthetic. Each piece develops its own unique patina pattern.",
    price_tier: "premium",
    sustainability: "high",
  },
  bronze: {
    name: "Bronze",
    category: "metal",
    durability: 8,
    cleaning_difficulty: 4,
    fading_resistance: 7,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: true,
    expected_lifespan_years: 50,
    best_for_rooms: ["living-room", "foyer", "dining-room", "library", "outdoor"],
    avoid_for_rooms: [],
    care_instructions:
      "Dust regularly. Can be waxed to maintain finish. Develops warm patina over time. Very low maintenance once patina stabilizes.",
    notes:
      "Alloy of copper and tin with warm, dark golden tone. Extremely long-lasting. Classic material for sculpture and decorative hardware. Patina adds warmth and character over time.",
    price_tier: "luxury",
    sustainability: "high",
  },

  // --- Natural Fibers / Other ---
  rattan: {
    name: "Rattan",
    category: "natural-fiber",
    durability: 5,
    cleaning_difficulty: 4,
    fading_resistance: 4,
    pet_friendly: false,
    kid_friendly: true,
    commercial_grade: false,
    expected_lifespan_years: 10,
    best_for_rooms: ["sunroom", "bedroom", "living-room", "covered-porch", "nursery"],
    avoid_for_rooms: ["outdoor-uncovered", "bathroom"],
    care_instructions:
      "Dust with soft brush. Wipe with damp cloth. Avoid prolonged moisture and direct sunlight. Occasional light misting prevents drying and cracking.",
    notes:
      "Natural palm vine material. Lightweight and flexible. Not to be confused with wicker (which is a weaving technique). Can dry out and crack in very dry climates. Major design trend.",
    price_tier: "mid",
    sustainability: "high",
  },
  wicker: {
    name: "Wicker",
    category: "natural-fiber",
    durability: 4,
    cleaning_difficulty: 5,
    fading_resistance: 3,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 8,
    best_for_rooms: ["covered-porch", "sunroom", "bedroom"],
    avoid_for_rooms: ["outdoor-uncovered", "bathroom", "family-room"],
    care_instructions:
      "Vacuum with brush attachment. Wipe with damp cloth. Keep out of rain and direct sun. Synthetic wicker (resin wicker) is available for outdoor use.",
    notes:
      "Wicker is a weaving technique, not a material—can be made from rattan, willow, or synthetic resin. Natural wicker is indoor/covered outdoor only. Resin wicker is all-weather.",
    price_tier: "mid",
    sustainability: "high",
  },
  cane: {
    name: "Cane",
    category: "natural-fiber",
    durability: 5,
    cleaning_difficulty: 4,
    fading_resistance: 5,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 10,
    best_for_rooms: ["bedroom", "dining-room", "living-room", "home-office"],
    avoid_for_rooms: ["outdoor", "bathroom", "nursery"],
    care_instructions:
      "Dust regularly. Mist occasionally to prevent drying. Avoid sitting heavily on cane seats—they can stretch and sag. Professional re-caning is available.",
    notes:
      "Woven from rattan outer skin. Elegant, airy look for chair backs and cabinet doors. Can sag over time with heavy use. Hand-caned is more durable than machine-caned. Very on-trend.",
    price_tier: "mid",
    sustainability: "high",
  },
  jute: {
    name: "Jute",
    category: "natural-fiber",
    durability: 4,
    cleaning_difficulty: 6,
    fading_resistance: 5,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 5,
    best_for_rooms: ["bedroom", "living-room", "dining-room", "home-office"],
    avoid_for_rooms: ["outdoor", "bathroom", "kitchen", "high-traffic-hallway", "mudroom"],
    care_instructions:
      "Vacuum regularly without beater bar. Blot spills immediately—absorbs liquid quickly. Professional cleaning only. Will shed fibers initially—this decreases over time.",
    notes:
      "Most common natural fiber rug material. Sheds significantly when new. Stains easily and is difficult to clean. Soft underfoot but not very durable. Best for low-traffic areas.",
    price_tier: "budget",
    sustainability: "high",
  },
  seagrass: {
    name: "Seagrass",
    category: "natural-fiber",
    durability: 6,
    cleaning_difficulty: 3,
    fading_resistance: 6,
    pet_friendly: true,
    kid_friendly: true,
    commercial_grade: false,
    expected_lifespan_years: 8,
    best_for_rooms: ["living-room", "dining-room", "bedroom", "sunroom", "foyer"],
    avoid_for_rooms: ["outdoor", "bathroom"],
    care_instructions:
      "Vacuum regularly. Non-porous surface resists staining better than jute. Wipe spills with damp cloth. Cannot be dyed—only available in natural green-brown tones.",
    notes:
      "More durable and stain-resistant than jute. Natural waxy coating repels liquids. Cannot be dyed or stained—limited to natural colors. Slight green tint when new that fades to warm brown.",
    price_tier: "budget",
    sustainability: "high",
  },
  sisal: {
    name: "Sisal",
    category: "natural-fiber",
    durability: 7,
    cleaning_difficulty: 5,
    fading_resistance: 6,
    pet_friendly: false,
    kid_friendly: false,
    commercial_grade: true,
    expected_lifespan_years: 10,
    best_for_rooms: ["living-room", "home-office", "foyer", "hallway", "stairway"],
    avoid_for_rooms: ["outdoor", "bathroom", "dining-room", "basement"],
    care_instructions:
      "Vacuum regularly. Blot liquid spills immediately—sisal absorbs water and can stain. Do not steam clean. Dry extraction cleaning recommended.",
    notes:
      "Toughest natural rug fiber. Rough texture—not comfortable for bare feet or sitting. Excellent for high-traffic areas. Stains easily with liquids. Not recommended under dining tables.",
    price_tier: "mid",
    sustainability: "high",
  },
  "tempered-glass": {
    name: "Glass (Tempered)",
    category: "glass",
    durability: 7,
    cleaning_difficulty: 5,
    fading_resistance: 10,
    pet_friendly: true,
    kid_friendly: false,
    commercial_grade: true,
    expected_lifespan_years: 20,
    best_for_rooms: ["living-room", "dining-room", "home-office", "foyer"],
    avoid_for_rooms: ["nursery", "playroom"],
    care_instructions:
      "Clean with glass cleaner. Shows every fingerprint, dust particle, and smudge. Tempered glass shatters into small rounded pieces rather than sharp shards for safety.",
    notes:
      "Makes spaces feel open and airy. Shows fingerprints constantly—high maintenance for cleanliness. Tempered glass is 4x stronger than regular glass. Weight of glass tables helps with stability.",
    price_tier: "mid",
    sustainability: "high",
  },
  "antiqued-mirror": {
    name: "Mirror / Antiqued Mirror",
    category: "glass",
    durability: 6,
    cleaning_difficulty: 5,
    fading_resistance: 8,
    pet_friendly: true,
    kid_friendly: false,
    commercial_grade: false,
    expected_lifespan_years: 15,
    best_for_rooms: ["living-room", "bedroom", "dining-room", "foyer", "bar"],
    avoid_for_rooms: ["nursery", "playroom", "outdoor"],
    care_instructions:
      "Clean with glass cleaner. Handle with care. Antiqued mirror finish may continue to develop naturally over time. Avoid moisture behind mirror surface.",
    notes:
      "Decorative material for furniture surfaces, cabinet doors, and accent pieces. Antiqued/smoky mirror finish is very popular for glamorous and transitional designs. Adds light and dimension to rooms.",
    price_tier: "premium",
    sustainability: "varies",
  },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * Normalise a string for fuzzy comparison: lowercase, strip accents, remove
 * hyphens / underscores / extra whitespace.
 */
function normalise(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacriticals (é → e)
    .replace(/[-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Simple token-overlap similarity between two normalised strings.
 * Returns a number between 0 and 1.
 */
function similarity(a, b) {
  const na = normalise(a);
  const nb = normalise(b);

  // Exact match after normalisation
  if (na === nb) return 1;

  // One contains the other
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  // Token overlap (Jaccard-ish)
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
// Public API
// ─────────────────────────────────────────────

/**
 * Get material info by name (fuzzy matching).
 * "walnut" → walnut, "boucle" → bouclé, "perf fabric" → performance-fabric
 */
export function getMaterial(name) {
  if (!name) return null;

  const norm = normalise(name);

  // Direct key lookup
  if (MATERIALS[norm.replace(/\s+/g, "-")]) {
    return MATERIALS[norm.replace(/\s+/g, "-")];
  }

  // Best fuzzy match
  let best = null;
  let bestScore = 0;

  for (const [key, mat] of Object.entries(MATERIALS)) {
    const scores = [
      similarity(name, key),
      similarity(name, mat.name),
    ];
    const score = Math.max(...scores);
    if (score > bestScore) {
      bestScore = score;
      best = { key, ...mat };
    }
  }

  return bestScore >= 0.4 ? best : null;
}

/**
 * Return the full materials database.
 */
export function getAllMaterials() {
  return MATERIALS;
}

/**
 * Match a product's material field to our database.
 *
 * product.material is a free-text string like "Top Grain Leather" or
 * "White Oak with Brass Accents".
 *
 * Returns an array of matched materials sorted by confidence:
 *   [{ material: {...}, confidence: 0-1 }]
 */

// Map single keywords to their best matching material DB key
const SHORTHAND_ALIASES = {
  leather: "top-grain-leather",
  velvet: "velvet",
  linen: "natural-linen",
  walnut: "walnut",
  oak: "white-oak",
  marble: "marble",
  teak: "teak",
  brass: "brass",
  steel: "stainless-steel",
  iron: "wrought-iron",
  rattan: "rattan",
  jute: "jute",
  seagrass: "seagrass",
  wicker: "rattan",
  suede: "nubuck-suede",
  chenille: "chenille",
  bouclé: "boucle",
  boucle: "boucle",
  mahogany: "mahogany",
  pine: "pine",
  mango: "mango-wood",
  granite: "granite",
  quartz: "quartz",
  travertine: "travertine",
  concrete: "concrete",
  terrazzo: "terrazzo",
  cotton: "cotton-duck",
  hemp: "hemp",
  wool: "wool",
  silk: "silk",
};

export function matchProductMaterial(product) {
  // Combine all available text fields for material detection
  const materialField = product?.material || product?.materials || "";
  const nameField = product?.product_name || product?.name || "";
  const descField = product?.description || "";
  const allText = [materialField, nameField, descField].filter(Boolean).join(" ");
  if (!allText.trim()) return [];

  const normAll = normalise(allText);
  const normMaterial = normalise(materialField);
  const results = [];
  const matchedKeys = new Set();

  // Phase 1: Shorthand alias matching — find common material words in text
  const allTokens = normAll.split(/\s+/);
  for (const [shorthand, dbKey] of Object.entries(SHORTHAND_ALIASES)) {
    if (allTokens.includes(shorthand) && MATERIALS[dbKey] && !matchedKeys.has(dbKey)) {
      const inMaterialField = normMaterial && normMaterial.includes(shorthand);
      results.push({
        material: { key: dbKey, ...MATERIALS[dbKey] },
        confidence: inMaterialField ? 0.8 : 0.55,
      });
      matchedKeys.add(dbKey);
    }
  }

  // Phase 2: Full material name matching
  for (const [key, mat] of Object.entries(MATERIALS)) {
    if (matchedKeys.has(key)) continue;
    const nameNorm = normalise(mat.name);
    const keyNorm = normalise(key);

    let confidence = 0;

    // Highest confidence: exact match in material field
    if (normMaterial && (normMaterial === nameNorm || normMaterial === keyNorm)) {
      confidence = 1.0;
    } else if (normMaterial && (normMaterial.includes(nameNorm) || normMaterial.includes(keyNorm))) {
      confidence = 0.85;
    }
    // Medium confidence: found in product name or description
    else if (normAll.includes(nameNorm) || normAll.includes(keyNorm)) {
      confidence = 0.65;
    } else {
      // Token-level matching across all text
      const nameTokens = nameNorm.split(/\s+/);
      const matchedTokens = nameTokens.filter((t) => allTokens.includes(t));
      if (matchedTokens.length > 0 && nameTokens.length > 0) {
        const ratio = matchedTokens.length / nameTokens.length;
        confidence = ratio * (normMaterial ? 0.7 : 0.5);
      }
    }

    if (confidence >= 0.4) {
      results.push({ material: { key, ...mat }, confidence });
      matchedKeys.add(key);
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

/**
 * Check material suitability for a project context.
 *
 * context: { room_type, has_pets, has_kids, is_commercial, sun_exposure, usage_level }
 *   - room_type: string, e.g. "family-room"
 *   - has_pets: boolean
 *   - has_kids: boolean
 *   - is_commercial: boolean
 *   - sun_exposure: "none" | "low" | "moderate" | "high"
 *   - usage_level: "light" | "moderate" | "heavy"
 *
 * Returns: { suitable: boolean, score: 0-100, warnings: [], recommendations: [] }
 */
export function checkMaterialSuitability(materialName, context = {}) {
  const mat = getMaterial(materialName);
  if (!mat) {
    return { suitable: false, score: 0, warnings: ["Material not found in database."], recommendations: [] };
  }

  let score = 70; // baseline
  const warnings = [];
  const recommendations = [];

  // --- Room type check ---
  if (context.room_type) {
    const room = normalise(context.room_type);
    const bestRooms = (mat.best_for_rooms || []).map(normalise);
    const avoidRooms = (mat.avoid_for_rooms || []).map(normalise);

    if (avoidRooms.includes(room) || avoidRooms.includes("all")) {
      score -= 40;
      warnings.push(`${mat.name} is explicitly not recommended for ${context.room_type}.`);
    } else if (bestRooms.some((r) => r === room || room.includes(r) || r.includes(room))) {
      score += 15;
    } else {
      score -= 5;
    }
  }

  // --- Pet check ---
  if (context.has_pets && !mat.pet_friendly) {
    score -= 25;
    warnings.push(`${mat.name} is not pet-friendly. Pet claws, fur, and accidents can damage this material.`);
    recommendations.push("Consider performance fabric, microfiber, or top/full grain leather instead.");
  } else if (context.has_pets && mat.pet_friendly) {
    score += 5;
  }

  // --- Kid check ---
  if (context.has_kids && !mat.kid_friendly) {
    score -= 20;
    warnings.push(`${mat.name} is not recommended for households with children due to staining or fragility concerns.`);
    recommendations.push("Look for materials with easy cleaning and high durability ratings.");
  } else if (context.has_kids && mat.kid_friendly) {
    score += 5;
  }

  // --- Commercial check ---
  if (context.is_commercial && !mat.commercial_grade) {
    score -= 30;
    warnings.push(`${mat.name} is not rated for commercial use. Consider commercial-grade alternatives.`);
  } else if (context.is_commercial && mat.commercial_grade) {
    score += 10;
  }

  // --- Sun exposure ---
  if (context.sun_exposure === "high" && mat.fading_resistance < 5) {
    score -= 20;
    warnings.push(`${mat.name} has low fading resistance (${mat.fading_resistance}/10) and will degrade in high sun exposure.`);
    recommendations.push("Consider outdoor fabric (Sunbrella) or materials with high fading resistance.");
  } else if (context.sun_exposure === "moderate" && mat.fading_resistance < 4) {
    score -= 10;
    warnings.push(`${mat.name} may fade with moderate sun exposure.`);
  }

  // --- Usage level ---
  if (context.usage_level === "heavy" && mat.durability < 6) {
    score -= 20;
    warnings.push(`${mat.name} has a durability rating of ${mat.durability}/10, which is below recommended for heavy use.`);
    recommendations.push("For heavy use, choose materials rated 7+ on durability.");
  } else if (context.usage_level === "heavy" && mat.durability >= 8) {
    score += 10;
  } else if (context.usage_level === "moderate" && mat.durability < 4) {
    score -= 10;
    warnings.push(`${mat.name} may not hold up well under moderate daily use.`);
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return {
    suitable: score >= 50 && warnings.length <= 1,
    score,
    warnings,
    recommendations,
  };
}

/**
 * Compare two materials, optionally in a given context.
 *
 * Returns:
 *   { winner, comparison: { durability, cleaning, fading, ... }, summary }
 */
export function compareMaterials(material1, material2, context = {}) {
  const mat1 = getMaterial(material1);
  const mat2 = getMaterial(material2);

  if (!mat1 || !mat2) {
    return { winner: null, comparison: {}, summary: "One or both materials were not found." };
  }

  const comparison = {
    durability: {
      [mat1.name]: mat1.durability,
      [mat2.name]: mat2.durability,
      winner: mat1.durability >= mat2.durability ? mat1.name : mat2.name,
    },
    cleaning_ease: {
      [mat1.name]: 10 - mat1.cleaning_difficulty,
      [mat2.name]: 10 - mat2.cleaning_difficulty,
      winner: mat1.cleaning_difficulty <= mat2.cleaning_difficulty ? mat1.name : mat2.name,
    },
    fading_resistance: {
      [mat1.name]: mat1.fading_resistance,
      [mat2.name]: mat2.fading_resistance,
      winner: mat1.fading_resistance >= mat2.fading_resistance ? mat1.name : mat2.name,
    },
    pet_friendly: {
      [mat1.name]: mat1.pet_friendly,
      [mat2.name]: mat2.pet_friendly,
      winner:
        mat1.pet_friendly === mat2.pet_friendly
          ? "tie"
          : mat1.pet_friendly
            ? mat1.name
            : mat2.name,
    },
    kid_friendly: {
      [mat1.name]: mat1.kid_friendly,
      [mat2.name]: mat2.kid_friendly,
      winner:
        mat1.kid_friendly === mat2.kid_friendly
          ? "tie"
          : mat1.kid_friendly
            ? mat1.name
            : mat2.name,
    },
    expected_lifespan: {
      [mat1.name]: mat1.expected_lifespan_years,
      [mat2.name]: mat2.expected_lifespan_years,
      winner:
        mat1.expected_lifespan_years >= mat2.expected_lifespan_years ? mat1.name : mat2.name,
    },
    price_tier: {
      [mat1.name]: mat1.price_tier,
      [mat2.name]: mat2.price_tier,
    },
  };

  // Determine overall winner via scoring categories
  const points = { [mat1.name]: 0, [mat2.name]: 0 };
  for (const cat of ["durability", "cleaning_ease", "fading_resistance", "pet_friendly", "kid_friendly", "expected_lifespan"]) {
    const w = comparison[cat].winner;
    if (w && w !== "tie") points[w]++;
  }

  // Context-adjusted scoring
  if (context.has_pets) {
    if (mat1.pet_friendly && !mat2.pet_friendly) points[mat1.name] += 2;
    if (mat2.pet_friendly && !mat1.pet_friendly) points[mat2.name] += 2;
  }
  if (context.has_kids) {
    if (mat1.kid_friendly && !mat2.kid_friendly) points[mat1.name] += 2;
    if (mat2.kid_friendly && !mat1.kid_friendly) points[mat2.name] += 2;
  }
  if (context.usage_level === "heavy") {
    if (mat1.durability > mat2.durability) points[mat1.name] += 2;
    else if (mat2.durability > mat1.durability) points[mat2.name] += 2;
  }

  const winner =
    points[mat1.name] > points[mat2.name]
      ? mat1.name
      : points[mat2.name] > points[mat1.name]
        ? mat2.name
        : "tie";

  const summary =
    winner === "tie"
      ? `${mat1.name} and ${mat2.name} are closely matched overall. Your decision should be based on aesthetic preference and specific use case.`
      : `${winner} is the stronger choice overall, winning in more practical categories.${
          context.has_pets || context.has_kids
            ? " Lifestyle factors (pets/kids) were weighted in this comparison."
            : ""
        }`;

  return { winner, comparison, summary };
}

/**
 * Get smart badges for a product based on its material.
 *
 * Returns an array of badge objects:
 *   [{ label, color, icon }]
 */
export function getProductMaterialBadges(product) {
  const matches = matchProductMaterial(product);
  if (matches.length === 0) return [];

  const validMatches = matches.filter(m => m.confidence >= 0.4);

  // Pre-scan for conflicting traits — prefer positive
  const anyPetFriendly = validMatches.some(m => m.material.pet_friendly);
  const anyKidFriendly = validMatches.some(m => m.material.kid_friendly);

  const badges = [];
  const seen = new Set();

  for (const { material } of validMatches) {
    if (anyPetFriendly && material.pet_friendly && !seen.has("pet")) {
      badges.push({ label: "Pet Friendly", color: "green", icon: "paw" });
      seen.add("pet");
    }
    if (!anyPetFriendly && !material.pet_friendly && material.category === "upholstery" && !seen.has("nopet")) {
      badges.push({ label: "Not Pet Friendly", color: "red", icon: "paw-off" });
      seen.add("nopet");
    }

    if (anyKidFriendly && material.kid_friendly && !seen.has("kid")) {
      badges.push({ label: "Kid Friendly", color: "green", icon: "child" });
      seen.add("kid");
    }

    if (material.commercial_grade && !seen.has("commercial")) {
      badges.push({ label: "Commercial Grade", color: "blue", icon: "building" });
      seen.add("commercial");
    }

    if (material.durability >= 9 && !seen.has("durable")) {
      badges.push({ label: "Extremely Durable", color: "green", icon: "shield" });
      seen.add("durable");
    }

    if (material.cleaning_difficulty <= 2 && !seen.has("easyClean")) {
      badges.push({ label: "Easy to Clean", color: "green", icon: "sparkle" });
      seen.add("easyClean");
    }
    if (material.cleaning_difficulty >= 8 && !seen.has("hardClean")) {
      badges.push({ label: "High Maintenance", color: "yellow", icon: "alert" });
      seen.add("hardClean");
    }

    if (material.fading_resistance >= 9 && !seen.has("uvResist")) {
      badges.push({ label: "UV Resistant", color: "blue", icon: "sun" });
      seen.add("uvResist");
    }

    if (material.sustainability === "high" && !seen.has("sustainable")) {
      badges.push({ label: "Sustainable", color: "green", icon: "leaf" });
      seen.add("sustainable");
    }

    if (material.price_tier === "luxury" && !seen.has("luxury")) {
      badges.push({ label: "Luxury Material", color: "gold", icon: "gem" });
      seen.add("luxury");
    }

    if (material.expected_lifespan_years >= 25 && !seen.has("longlasting")) {
      badges.push({ label: "25+ Year Lifespan", color: "green", icon: "clock" });
      seen.add("longlasting");
    }

    // Specific warnings
    if (material.key === "bonded-leather" && !seen.has("avoid")) {
      badges.push({ label: "Avoid – Will Peel", color: "red", icon: "warning" });
      seen.add("avoid");
    }

    if (material.key === "boucle" && !seen.has("snagging")) {
      badges.push({ label: "Snag Risk", color: "yellow", icon: "alert" });
      seen.add("snagging");
    }
  }

  return badges;
}

/**
 * Score how well a product's material fits a given project context.
 * Returns a number 0-100.
 */
export function scoreMaterialFit(product, context = {}) {
  const matches = matchProductMaterial(product);
  if (matches.length === 0) return 50; // neutral when unknown

  // Use the highest-confidence match for scoring
  const primary = matches[0];
  const result = checkMaterialSuitability(primary.material.name, context);

  // Weight the confidence of the match into the score
  const adjustedScore = result.score * primary.confidence;
  return Math.round(Math.max(0, Math.min(100, adjustedScore)));
}
