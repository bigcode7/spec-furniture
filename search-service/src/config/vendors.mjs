/**
 * Priority Vendor Profiles for HTML Crawling
 *
 * SPEC is a trade-only platform. These are established home furnishings
 * manufacturers and trade brands that sell through retailers, designers,
 * reps, and dealer networks.
 *
 * NO consumer/DTC brands: no IKEA, Wayfair, West Elm, Pottery Barn,
 * CB2, Target, Amazon, Article, Castlery, or any mass-market retailer.
 */

export const priorityVendors = [
  {
    id: "bernhardt",
    name: "Bernhardt",
    domain: "bernhardt.com",
    profile: {
      asset_hosts: ["bernhardt.com", "bernhardt.scene7.com", "images.bernhardt.com"],
      title_suffixes: ["| Bernhardt", "| Bernhardt Furniture"],
      product_path_tokens: ["shop"],
      reject_path_tokens: ["search", "showrooms"],
      image_path_hints: ["/is/image/", "/products/", "/images/", "/media/"],
      listing_path_tokens: ["shop", "furniture", "seating"],
    },
    discovery: {
      search_paths: ["/shop/?ReferringState=Search&q={query}"],
      category_paths: {
        "swivel chair": ["/shop/?Sub-Category=Swivel%20Chairs&$MultiView=Yes&orderBy=OutdoorPosition,Id"],
        chair: ["/shop/?Sub-Category=Chairs&$MultiView=Yes&orderBy=LivingPosition,Id"],
        sofa: ["/shop/?Sub-Category=Sofas&$MultiView=Yes&orderBy=LivingPosition,Id"],
      },
    },
  },
  {
    id: "hooker",
    name: "Hooker Furniture",
    domain: "hookerfurnishings.com",
    flat_product_urls: true,
    profile: {
      asset_hosts: ["hookerfurnishings.com", "hookerfurniture.com", "images.hookerfurniture.com"],
      title_suffixes: ["| Hooker Furniture", "| Hooker Furnishings"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "catalogs", "collections", "inspiration", "customer", "cms"],
      image_path_hints: ["/products/", "/images/", "/media/", "/catalog/"],
      listing_path_tokens: ["products", "living-room", "seating", "accent-chairs"],
    },
    discovery: {
      search_paths: ["/catalogsearch/result/?q={query}"],
      category_paths: {
        chair: ["/accent-chairs"],
        "swivel chair": ["/accent-chairs"],
        sofa: ["/sofas-sectionals"],
      },
    },
  },
  {
    id: "century",
    name: "Century Furniture",
    domain: "centuryfurniture.com",
    profile: {
      asset_hosts: ["centuryfurniture.com", "cdn.centuryfurniture.com"],
      title_suffixes: ["| Century Furniture"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/catalogsearch/result/?q={query}"],
    },
  },
  {
    id: "vanguard",
    name: "Vanguard Furniture",
    domain: "vanguardfurniture.com",
    profile: {
      asset_hosts: ["vanguardfurniture.com", "cdn.vanguardfurniture.com"],
      title_suffixes: ["| Vanguard Furniture"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "lexington",
    name: "Lexington Home Brands",
    domain: "lexington.com",
    flat_product_urls: true,
    profile: {
      asset_hosts: ["lexington.com", "cdn.lexington.com"],
      title_suffixes: ["| Lexington Home Brands", "| Lexington"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections", "customer", "cms", "catalogsearch"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/catalogsearch/result/?q={query}"],
    },
  },
  {
    id: "universal",
    name: "Universal Furniture",
    domain: "universalfurniture.com",
    profile: {
      asset_hosts: ["universalfurniture.com", "cdn.universalfurniture.com"],
      title_suffixes: ["| Universal Furniture"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections", "blog"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "hickory-chair",
    name: "Hickory Chair",
    domain: "hickorychair.com",
    profile: {
      asset_hosts: ["hickorychair.com", "cdn.hickorychair.com"],
      title_suffixes: ["| Hickory Chair"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "theodore-alexander",
    name: "Theodore Alexander",
    domain: "theodorealexander.com",
    profile: {
      asset_hosts: ["theodorealexander.com", "cdn.theodorealexander.com"],
      title_suffixes: ["| Theodore Alexander"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/catalogsearch/result/?q={query}"],
    },
  },
  {
    id: "fourhands",
    name: "Four Hands",
    domain: "fourhands.com",
    shopify_domain: "fourhands.com",
    shopify_collections: ["seating", "chairs", "living", "bedroom", "storage", "dining"],
    profile: {
      asset_hosts: ["fourhands.com", "cdn.shopify.com", "assets.fourhands.com"],
      title_suffixes: ["| Four Hands", "| Shop Four Hands"],
      product_path_tokens: ["product", "products", "shop"],
      reject_path_tokens: ["search", "collections", "trade-program", "designers"],
      image_path_hints: ["/files/", "/products/", "/images/", "/cdn/shop/"],
      listing_path_tokens: ["products", "shop", "search"],
    },
    discovery: {
      search_paths: ["/search?q={query}", "/shop?q={query}"],
    },
  },
  {
    id: "caracole",
    name: "Caracole",
    domain: "caracole.com",
    profile: {
      asset_hosts: ["caracole.com", "cdn.caracole.com"],
      title_suffixes: ["| Caracole"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/catalogsearch/result/?q={query}"],
    },
  },
  {
    id: "baker",
    name: "Baker Furniture",
    domain: "bakerfurniture.com",
    profile: {
      asset_hosts: ["bakerfurniture.com", "cdn.bakerfurniture.com"],
      title_suffixes: ["| Baker Furniture"],
      product_path_tokens: ["living", "dining", "bedroom", "outdoor"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
      min_path_segments: 4,
    },
    discovery: {
      search_paths: ["/catalogsearch/result/?q={query}"],
    },
  },
  {
    id: "stickley",
    name: "Stickley",
    domain: "stickley.com",
    profile: {
      asset_hosts: ["stickley.com", "cdn.stickley.com"],
      title_suffixes: ["| Stickley"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "cr-laine",
    name: "CR Laine",
    domain: "crlaine.com",
    profile: {
      asset_hosts: ["crlaine.com", "cdn.crlaine.com"],
      title_suffixes: ["| CR Laine"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "lee-industries",
    name: "Lee Industries",
    domain: "leeindustries.com",
    profile: {
      asset_hosts: ["leeindustries.com", "cdn.leeindustries.com"],
      title_suffixes: ["| Lee Industries"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "sherrill",
    name: "Sherrill Furniture",
    domain: "sherrillfurniture.com",
    profile: {
      asset_hosts: ["sherrillfurniture.com", "cdn.sherrillfurniture.com"],
      title_suffixes: ["| Sherrill Furniture"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  // ── TIER 2 ──
  {
    id: "arteriors",
    name: "Arteriors",
    domain: "arteriorshome.com",
    flat_product_urls: true,
    profile: {
      asset_hosts: ["arteriorshome.com", "arteriors.com", "cdn.arteriors.com"],
      title_suffixes: ["| Arteriors"],
      product_path_tokens: ["product", "products", "item"],
      reject_path_tokens: ["search", "collections", "customer", "cms", "catalogsearch", "checkout"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "visual-comfort",
    name: "Visual Comfort",
    domain: "visualcomfort.com",
    profile: {
      asset_hosts: ["visualcomfort.com", "cdn.visualcomfort.com"],
      title_suffixes: ["| Visual Comfort"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "surya",
    name: "Surya",
    domain: "surya.com",
    profile: {
      asset_hosts: ["surya.com", "cdn.surya.com"],
      title_suffixes: ["| Surya"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "loloi",
    name: "Loloi Rugs",
    domain: "loloirugs.com",
    profile: {
      asset_hosts: ["loloirugs.com", "cdn.loloirugs.com"],
      title_suffixes: ["| Loloi Rugs", "| Loloi"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "made-goods",
    name: "Made Goods",
    domain: "madegoods.com",
    profile: {
      asset_hosts: ["madegoods.com", "cdn.madegoods.com"],
      title_suffixes: ["| Made Goods"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "uttermost",
    name: "Uttermost",
    domain: "uttermost.com",
    flat_product_urls: true,
    profile: {
      asset_hosts: ["uttermost.com", "cdn.uttermost.com"],
      title_suffixes: ["| Uttermost"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections", "customer", "cms", "catalogsearch", "checkout"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "palecek",
    name: "Palecek",
    domain: "palecek.com",
    profile: {
      asset_hosts: ["palecek.com", "cdn.palecek.com"],
      title_suffixes: ["| Palecek"],
      product_path_tokens: ["palecek-"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "gabby",
    name: "Gabby",
    domain: "gabbyhome.com",
    profile: {
      asset_hosts: ["gabbyhome.com", "cdn.gabbyhome.com"],
      title_suffixes: ["| Gabby"],
      product_path_tokens: ["product", "products", "shop"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "noir",
    name: "Noir Furniture",
    domain: "noirfurniturela.com",
    profile: {
      asset_hosts: ["noirfurniturela.com", "cdn.noirfurniturela.com"],
      title_suffixes: ["| Noir"],
      product_path_tokens: ["product", "products", "shop"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "currey",
    name: "Currey & Company",
    domain: "currey.com",
    profile: {
      asset_hosts: ["currey.com", "cdn.currey.com"],
      title_suffixes: ["| Currey & Company"],
      product_path_tokens: ["product", "products", "shop"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "jaipur-living",
    name: "Jaipur Living",
    domain: "jaipurliving.com",
    profile: {
      asset_hosts: ["jaipurliving.com", "cdn.jaipurliving.com"],
      title_suffixes: ["| Jaipur Living"],
      product_path_tokens: ["product", "products", "shop"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "bungalow5",
    name: "Bungalow 5",
    domain: "bungalow5.com",
    profile: {
      asset_hosts: ["bungalow5.com", "cdn.bungalow5.com"],
      title_suffixes: ["| Bungalow 5"],
      product_path_tokens: ["product", "products", "shop"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "worlds-away",
    name: "Worlds Away",
    domain: "worldsaway.com",
    profile: {
      asset_hosts: ["worldsaway.com", "cdn.worldsaway.com"],
      title_suffixes: ["| Worlds Away"],
      product_path_tokens: ["product", "products", "shop"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "global-views",
    name: "Global Views",
    domain: "globalviews.com",
    profile: {
      asset_hosts: ["globalviews.com", "cdn.globalviews.com"],
      title_suffixes: ["| Global Views"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "aidan-gray",
    name: "Aidan Gray",
    domain: "aidangray.com",
    profile: {
      asset_hosts: ["aidangray.com", "cdn.aidangray.com"],
      title_suffixes: ["| Aidan Gray"],
      product_path_tokens: ["product", "products", "shop"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  // ── TIER 3 ──
  {
    id: "hancock-moore",
    name: "Hancock & Moore",
    domain: "hancockandmoore.com",
    profile: {
      asset_hosts: ["hancockandmoore.com", "cdn.hancockandmoore.com"],
      title_suffixes: ["| Hancock & Moore"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "riverside",
    name: "Riverside Furniture",
    domain: "riversidefurniture.com",
    profile: {
      asset_hosts: ["riversidefurniture.com", "cdn.riversidefurniture.com"],
      title_suffixes: ["| Riverside Furniture"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "marge-carson",
    name: "Marge Carson",
    domain: "margecarson.com",
    profile: {
      asset_hosts: ["margecarson.com", "cdn.margecarson.com"],
      title_suffixes: ["| Marge Carson"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  // ── TIER 4 ──
  {
    id: "rh-trade",
    name: "RH (Trade Program)",
    domain: "rh.com",
    profile: {
      asset_hosts: ["rh.com", "arha.scene7.com", "rhmodern.scene7.com", "cdn.rh.com"],
      title_suffixes: ["| RH", "| Restoration Hardware", " - RH"],
      product_path_tokens: ["product", "products", "catalog"],
      reject_path_tokens: ["search", "gallery", "sourcebooks", "gifts", "category"],
      image_path_hints: ["/is/image/", "/images/", "/catalog/"],
    },
    discovery: {
      search_paths: ["/search?query={query}"],
    },
  },
  {
    id: "holly-hunt",
    name: "Holly Hunt",
    domain: "hollyhunt.com",
    profile: {
      asset_hosts: ["hollyhunt.com", "cdn.hollyhunt.com"],
      title_suffixes: ["| Holly Hunt"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "kravet",
    name: "Kravet Furniture",
    domain: "kravet.com",
    profile: {
      asset_hosts: ["kravet.com", "cdn.kravet.com"],
      title_suffixes: ["| Kravet"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  {
    id: "kincaid",
    name: "Kincaid",
    domain: "kincaidfurniture.com",
    profile: {
      asset_hosts: ["kincaidfurniture.com", "cdn.kincaidfurniture.com"],
      title_suffixes: ["| Kincaid"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
    discovery: {
      search_paths: ["/search?q={query}"],
    },
  },
  // ── ADDITIONAL SHOPIFY VENDORS ──
  {
    id: "jonathan-adler",
    name: "Jonathan Adler",
    domain: "jonathanadler.com",
    shopify_domain: "jonathanadler.com",
    profile: {
      asset_hosts: ["jonathanadler.com", "cdn.shopify.com"],
      title_suffixes: ["| Jonathan Adler"],
      product_path_tokens: ["products"],
      reject_path_tokens: ["search", "collections"],
    },
  },
  {
    id: "abc-home",
    name: "ABC Home",
    domain: "abchome.com",
    shopify_domain: "abchome.com",
    profile: {
      asset_hosts: ["abchome.com", "cdn.shopify.com"],
      title_suffixes: ["| ABC Home"],
      product_path_tokens: ["products"],
      reject_path_tokens: ["search", "collections"],
    },
  },
  {
    id: "jayson-home",
    name: "Jayson Home",
    domain: "jaysonhome.com",
    shopify_domain: "jaysonhome.com",
    profile: {
      asset_hosts: ["jaysonhome.com", "cdn.shopify.com"],
      title_suffixes: ["| Jayson Home"],
      product_path_tokens: ["products"],
      reject_path_tokens: ["search", "collections"],
    },
  },
  {
    id: "high-fashion-home",
    name: "High Fashion Home",
    domain: "highfashionhome.com",
    shopify_domain: "highfashionhome.com",
    profile: {
      asset_hosts: ["highfashionhome.com", "cdn.shopify.com"],
      title_suffixes: ["| High Fashion Home"],
      product_path_tokens: ["products"],
      reject_path_tokens: ["search", "collections"],
    },
  },
  {
    id: "flexsteel",
    name: "Flexsteel",
    domain: "flexsteel.com",
    shopify_domain: "flexsteel.com",
    profile: {
      asset_hosts: ["flexsteel.com", "cdn.shopify.com"],
      title_suffixes: ["| Flexsteel"],
      product_path_tokens: ["products"],
      reject_path_tokens: ["search", "collections"],
    },
  },
  {
    id: "lulu-and-georgia",
    name: "Lulu and Georgia",
    domain: "luluandgeorgia.com",
    shopify_domain: "luluandgeorgia.com",
    profile: {
      asset_hosts: ["luluandgeorgia.com", "cdn.shopify.com"],
      title_suffixes: ["| Lulu and Georgia"],
      product_path_tokens: ["products"],
      reject_path_tokens: ["search", "collections"],
    },
  },
  {
    id: "mcgee-and-co",
    name: "McGee & Co",
    domain: "mcgeeandco.com",
    shopify_domain: "mcgeeandco.com",
    profile: {
      asset_hosts: ["mcgeeandco.com", "cdn.shopify.com"],
      title_suffixes: ["| McGee & Co"],
      product_path_tokens: ["products"],
      reject_path_tokens: ["search", "collections"],
    },
  },
  {
    id: "schoolhouse",
    name: "Schoolhouse Electric",
    domain: "schoolhouseelectric.com",
    shopify_domain: "schoolhouseelectric.com",
    profile: {
      asset_hosts: ["schoolhouseelectric.com", "cdn.shopify.com"],
      title_suffixes: ["| Schoolhouse"],
      product_path_tokens: ["products"],
      reject_path_tokens: ["search", "collections"],
    },
  },
  // ── ADDITIONAL TIER 3 VENDORS ──
  {
    id: "sam-moore",
    name: "Sam Moore",
    domain: "sammoore.com",
    profile: {
      asset_hosts: ["sammoore.com"],
      title_suffixes: ["| Sam Moore"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "fairfield-chair",
    name: "Fairfield Chair",
    domain: "fairfieldchair.com",
    profile: {
      asset_hosts: ["fairfieldchair.com"],
      title_suffixes: ["| Fairfield Chair"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "american-drew",
    name: "American Drew",
    domain: "americandrew.com",
    profile: {
      asset_hosts: ["americandrew.com"],
      title_suffixes: ["| American Drew"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "hammary",
    name: "Hammary",
    domain: "hammary.com",
    profile: {
      asset_hosts: ["hammary.com"],
      title_suffixes: ["| Hammary"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
  {
    id: "thomasville",
    name: "Thomasville",
    domain: "thomasville.com",
    profile: {
      asset_hosts: ["thomasville.com"],
      title_suffixes: ["| Thomasville"],
      product_path_tokens: ["product", "products"],
      reject_path_tokens: ["search", "collections"],
      image_path_hints: ["/products/", "/images/", "/media/"],
    },
  },
];
