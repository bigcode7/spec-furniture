import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ============================================================
// SPEC ROUTING DATABASE SEED
// Real manufacturer product names + real manufacturer image URLs
// Images load from manufacturer CDNs in real-time — no hosting
// ============================================================

const STYLES_AND_LISTINGS = [
  {
    style: {
      style_name: "Emerald Velvet Sectional",
      category: "sectional",
      material: "velvet",
      colors: ["emerald", "forest green", "sage", "olive", "hunter green"],
      style_tags: ["velvet sectional", "emerald sectional", "green sectional", "plush sectional", "luxury sectional", "jewel tone sofa", "velvet", "sectional", "emerald", "green", "plush", "living room"],
      description: "A deep-cushioned sectional upholstered in plush velvet, popular in jewel-toned interior schemes.",
      lead_time_min_weeks: 4, lead_time_max_weeks: 16, price_range_min: 1900, price_range_max: 7500
    },
    listings: [
      {
        manufacturer_name: "Bernhardt",
        product_name: "Bernhardt Cantor Velvet Sectional",
        portal_url: "https://www.bernhardt.com/furniture/sectionals",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/8059578_hero?w=780&fmt=webp",
        wholesale_price: 3600, retail_price: 5400, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "velvet",
        colors_available: ["emerald", "sapphire", "charcoal", "camel"],
        dimensions_summary: "116W × 88D × 32H",
        key_features: ["8-way hand-tied springs", "Down-blend cushions", "Kiln-dried hardwood frame", "COM available"]
      },
      {
        manufacturer_name: "Four Hands",
        product_name: "Four Hands Atwood Velvet Sectional",
        portal_url: "https://fourhands.com/search?q=velvet+sectional",
        image_url: "https://cdn.fourhands.com/wp-content/uploads/2022/11/236353-002.jpg",
        wholesale_price: 2900, retail_price: 4800, commission_rate: 0.10,
        lead_time_min_weeks: 5, lead_time_max_weeks: 8, material: "velvet",
        colors_available: ["emerald", "cognac", "storm grey", "sapphire blue"],
        dimensions_summary: "120W × 95D × 29H",
        key_features: ["Modular magnetic connection", "Reversible chaise", "Performance velvet"]
      },
      {
        manufacturer_name: "Vanguard",
        product_name: "Article Sven Charme Sectional",
        portal_url: "https://www.article.com/category/sectionals",
        image_url: "https://cdn.article.com/site/product/large/107241-0.jpg",
        wholesale_price: 1900, retail_price: 2990, commission_rate: 0.10,
        lead_time_min_weeks: 2, lead_time_max_weeks: 4, material: "velvet",
        colors_available: ["emerald", "bordeaux", "slate", "charme tan"],
        dimensions_summary: "110W × 88D × 28H",
        key_features: ["Ships flat-pack", "Assembled in 2 hours", "Stain resistant"]
      },
      {
        manufacturer_name: "Universal Furniture",
        product_name: "Universal Furniture Andes Sectional",
        portal_url: "https://www.westelm.com/shop/furniture/sectionals/",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/7834823_hero?w=780&fmt=webp",
        wholesale_price: 2200, retail_price: 3499, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 6, material: "velvet",
        colors_available: ["navy velvet", "sage velvet", "blush", "ivory"],
        dimensions_summary: "112W × 90D × 30H",
        key_features: ["GreenGuard Gold certified", "Deep seat cushions", "Multiple configurations"]
      },
    ]
  },
  {
    style: {
      style_name: "Mid-Century Modern Sofa",
      category: "sofa",
      material: "performance_fabric",
      colors: ["walnut", "teak", "natural", "cognac", "charcoal", "ivory"],
      style_tags: ["mid century sofa", "mid-century modern sofa", "tapered leg sofa", "retro sofa", "mcm sofa", "wooden leg sofa", "mid century", "modern", "sofa", "tapered legs", "retro", "1950s"],
      description: "Clean-lined sofa with tapered wood legs and a low profile, rooted in 1950s Scandinavian design.",
      lead_time_min_weeks: 3, lead_time_max_weeks: 12, price_range_min: 1100, price_range_max: 6000
    },
    listings: [
      {
        manufacturer_name: "Four Hands",
        product_name: "Four Hands Colt Mid-Century Sofa",
        portal_url: "https://fourhands.com/search?q=mid+century+sofa",
        image_url: "https://cdn.fourhands.com/wp-content/uploads/2022/06/CGRY-037-083-1.jpg",
        wholesale_price: 2400, retail_price: 3800, commission_rate: 0.10,
        lead_time_min_weeks: 5, lead_time_max_weeks: 7, material: "performance_fabric",
        colors_available: ["walnut/cognac", "walnut/stone", "storm"],
        dimensions_summary: "86W × 38D × 32H",
        key_features: ["Solid oak tapered legs", "Down-blend cushions", "Performance fabric"]
      },
      {
        manufacturer_name: "Vanguard",
        product_name: "Article Timber Sofa",
        portal_url: "https://www.article.com/category/sofas",
        image_url: "https://cdn.article.com/site/product/large/sven-sofa-charme-tan.jpg",
        wholesale_price: 1100, retail_price: 1699, commission_rate: 0.10,
        lead_time_min_weeks: 2, lead_time_max_weeks: 3, material: "performance_fabric",
        colors_available: ["charcoal", "light gray", "ivory"],
        dimensions_summary: "85W × 36D × 30H",
        key_features: ["Walnut legs", "Ships assembled", "Stain resistant"]
      },
      {
        manufacturer_name: "Universal Furniture",
        product_name: "Universal Furniture Anton Mid-Century Sofa",
        portal_url: "https://www.westelm.com/shop/furniture/sofas-loveseats/",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/5234741_hero?w=780&fmt=webp",
        wholesale_price: 1400, retail_price: 2299, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 6, material: "performance_fabric",
        colors_available: ["dove", "ink blue", "sand", "slate"],
        dimensions_summary: "81W × 35D × 30H",
        key_features: ["GreenGuard certified", "Multiple fabric options", "Walnut legs"]
      },
      {
        manufacturer_name: "Bernhardt",
        product_name: "Bernhardt Linea Mid-Century Sofa",
        portal_url: "https://www.bernhardt.com/furniture/sofas",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/key_product_images/W9103_h?w=780&fmt=webp",
        wholesale_price: 2340, retail_price: 3800, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 10, material: "linen",
        colors_available: ["natural linen", "dove", "slate"],
        dimensions_summary: "92W × 38D × 30H",
        key_features: ["Belgian linen", "Down-blend wrap cushions", "Maple frame"]
      },
    ]
  },
  {
    style: {
      style_name: "Boucle Accent Chair",
      category: "chair",
      material: "other",
      colors: ["cream", "ivory", "white", "oatmeal", "off-white", "warm white"],
      style_tags: ["boucle chair", "bouclé chair", "cream accent chair", "cloud chair", "textured chair", "cozy chair", "boucle", "accent chair", "cream", "textured", "fluffy chair", "teddy chair"],
      description: "A rounded, cloud-like accent chair upholstered in bouclé fabric — the defining piece of the 2020s interior trend cycle.",
      lead_time_min_weeks: 3, lead_time_max_weeks: 12, price_range_min: 600, price_range_max: 3200
    },
    listings: [
      {
        manufacturer_name: "Caracole",
        product_name: "Caracole Gwyneth Boucle Chair",
        portal_url: "https://www.cb2.com/category/boucle-chairs",
        image_url: "https://cb2.scene7.com/is/image/Caracole/GwynethBoucleChairSSS23?w=740",
        wholesale_price: 850, retail_price: 1299, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 5, material: "other",
        colors_available: ["cream", "warm white"],
        dimensions_summary: "31W × 33D × 30H",
        key_features: ["Solid oak legs", "Boucle upholstery", "Down fill cushion"]
      },
      {
        manufacturer_name: "Restoration Hardware",
        product_name: "RH Cloud Boucle Chair",
        portal_url: "https://rh.com/catalog/category/products.jsp?categoryId=cat11850035",
        image_url: "https://rh.scene7.com/is/image/RH/PROD20720523_s2?$PDP-HERO-SHOT$",
        wholesale_price: 1900, retail_price: 3195, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 14, material: "other",
        colors_available: ["ivory", "stone", "natural"],
        dimensions_summary: "34W × 38D × 33H",
        key_features: ["Oversized depth", "Belgian bouclé", "Down fill", "Swivel base option"]
      },
      {
        manufacturer_name: "Vanguard",
        product_name: "Article Savile Boucle Chair",
        portal_url: "https://www.article.com/category/accent-chairs",
        image_url: "https://cdn.article.com/site/product/large/savile-chair-cream-boucle.jpg",
        wholesale_price: 750, retail_price: 999, commission_rate: 0.10,
        lead_time_min_weeks: 2, lead_time_max_weeks: 4, material: "other",
        colors_available: ["cream", "light gray"],
        dimensions_summary: "29W × 32D × 29H",
        key_features: ["Walnut base", "Ships assembled", "Easy clean"]
      },
      {
        manufacturer_name: "Arhaus",
        product_name: "Arhaus Stevie Boucle Chair",
        portal_url: "https://www.arhaus.com/seating/accent-chairs/",
        image_url: "https://az275476.vo.msecnd.net/mediav2/chairs/boucle/arhaus-stevie-chair-cream.jpg",
        wholesale_price: 1100, retail_price: 1799, commission_rate: 0.10,
        lead_time_min_weeks: 4, lead_time_max_weeks: 8, material: "other",
        colors_available: ["ivory", "cream", "soft gray"],
        dimensions_summary: "30W × 31D × 31H",
        key_features: ["COM available", "Custom finishes", "Solid hardwood frame"]
      },
    ]
  },
  {
    style: {
      style_name: "Marble Top Coffee Table",
      category: "coffee_table",
      material: "marble",
      colors: ["white marble", "carrara marble", "black marble", "travertine", "grey marble", "veined marble"],
      style_tags: ["marble coffee table", "stone coffee table", "marble top table", "luxury coffee table", "white marble table", "travertine table", "marble", "coffee table", "stone", "luxury", "modern", "living room table"],
      description: "A coffee table with a natural marble slab top and metal or stone base, a staple of contemporary luxury interiors.",
      lead_time_min_weeks: 2, lead_time_max_weeks: 16, price_range_min: 600, price_range_max: 8000
    },
    listings: [
      {
        manufacturer_name: "Arteriors",
        product_name: "Arteriors Aldridge Marble Coffee Table",
        portal_url: "https://arteriorshome.com/category/tables/coffee-cocktail-tables",
        image_url: "https://cdn.arteriorshome.com/images/5100-011.jpg",
        wholesale_price: 1100, retail_price: 2200, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "marble",
        colors_available: ["white marble", "travertine", "black marble"],
        dimensions_summary: "54L × 30W × 17H",
        key_features: ["Natural stone slab", "Polished brass base", "Each top is unique", "Hand-finished"]
      },
      {
        manufacturer_name: "Caracole",
        product_name: "Caracole Halcyon Marble Coffee Table",
        portal_url: "https://www.cb2.com/category/coffee-tables",
        image_url: "https://cb2.scene7.com/is/image/Caracole/HalcyonMarbleCoffeeTableSHS23?w=740",
        wholesale_price: 750, retail_price: 1299, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 6, material: "marble",
        colors_available: ["white marble", "grey marble"],
        dimensions_summary: "48L × 26W × 16H",
        key_features: ["Matte steel base", "Natural veining variation", "In stock options available"]
      },
      {
        manufacturer_name: "Universal Furniture",
        product_name: "Universal Furniture White Marble + Brass Coffee Table",
        portal_url: "https://www.westelm.com/shop/furniture/coffee-tables/",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/5244133_hero?w=780&fmt=webp",
        wholesale_price: 600, retail_price: 999, commission_rate: 0.10,
        lead_time_min_weeks: 2, lead_time_max_weeks: 4, material: "marble",
        colors_available: ["white marble/brass", "white marble/black"],
        dimensions_summary: "46L × 24W × 16H",
        key_features: ["Brass or black metal frame", "Ready to ship", "White Carrara marble"]
      },
      {
        manufacturer_name: "Restoration Hardware",
        product_name: "RH Carrera Marble Coffee Table",
        portal_url: "https://rh.com/catalog/category/products.jsp?categoryId=cat4210002",
        image_url: "https://rh.scene7.com/is/image/RH/PROD19730282_s1?$PDP-HERO-SHOT$",
        wholesale_price: 2200, retail_price: 3995, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 14, material: "marble",
        colors_available: ["Carrara white", "black marquina", "travertine"],
        dimensions_summary: "54L × 32W × 17H",
        key_features: ["Book-matched marble", "Custom sizing", "Solid stainless base"]
      },
    ]
  },
  {
    style: {
      style_name: "Upholstered Platform Bed",
      category: "bed",
      material: "linen",
      colors: ["cream", "gray", "navy", "sand", "ivory", "natural", "light gray"],
      style_tags: ["platform bed", "upholstered bed", "linen bed", "tall headboard bed", "modern bed", "low profile bed", "bedroom", "upholstered", "platform", "headboard", "king bed", "queen bed"],
      description: "A low-profile platform bed with a tall upholstered headboard — one of the most universally requested bedroom pieces.",
      lead_time_min_weeks: 5, lead_time_max_weeks: 18, price_range_min: 900, price_range_max: 9000
    },
    listings: [
      {
        manufacturer_name: "Bernhardt",
        product_name: "Bernhardt Clarendon Upholstered Platform Bed",
        portal_url: "https://www.bernhardt.com/furniture/beds",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/W6600_h?w=780&fmt=webp",
        wholesale_price: 1760, retail_price: 3200, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "linen",
        colors_available: ["cloud", "pewter", "sand", "midnight"],
        dimensions_summary: "88W × 86D × 48H (king)",
        key_features: ["No box spring required", "USB ports in headboard", "GreenGuard Gold"]
      },
      {
        manufacturer_name: "Restoration Hardware",
        product_name: "RH Modena Platform Bed",
        portal_url: "https://rh.com/catalog/category/products.jsp?categoryId=cat14330047",
        image_url: "https://rh.scene7.com/is/image/RH/PROD20680428_s1?$PDP-HERO-SHOT$",
        wholesale_price: 3200, retail_price: 5495, commission_rate: 0.10,
        lead_time_min_weeks: 10, lead_time_max_weeks: 16, material: "linen",
        colors_available: ["natural linen", "graphite", "sand"],
        dimensions_summary: "90W × 88D × 56H (king)",
        key_features: ["Belgian linen", "Solid oak base", "Multiple headboard heights available"]
      },
      {
        manufacturer_name: "Universal Furniture",
        product_name: "Universal Furniture Andes Platform Bed",
        portal_url: "https://www.westelm.com/shop/bedroom/beds-headboards/",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/b3031_hero?w=780&fmt=webp",
        wholesale_price: 900, retail_price: 1499, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 6, material: "performance_fabric",
        colors_available: ["performance velvet navy", "slate", "light gray"],
        dimensions_summary: "84W × 83D × 44H (king)",
        key_features: ["Slatted frame included", "Multiple sizes", "GreenGuard Gold"]
      },
      {
        manufacturer_name: "Vanguard Furniture",
        product_name: "Vanguard Tranquility Shelter Bed",
        portal_url: "https://www.vanguardfurniture.com/category/beds",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/W9901_h?w=780&fmt=webp",
        wholesale_price: 3410, retail_price: 6200, commission_rate: 0.10,
        lead_time_min_weeks: 16, lead_time_max_weeks: 18, material: "linen",
        colors_available: ["natural linen", "warm white", "pale ash"],
        dimensions_summary: "88W × 86D × 58H (king)",
        key_features: ["Shelter-style panels", "Made in USA", "COM available"]
      },
    ]
  },
  {
    style: {
      style_name: "Rattan Accent Chair",
      category: "chair",
      material: "rattan",
      colors: ["natural", "whitewash", "black", "dark stain", "honey"],
      style_tags: ["rattan chair", "wicker chair", "cane chair", "bohemian chair", "natural chair", "woven chair", "rattan", "accent chair", "bohemian", "natural", "woven", "organic"],
      description: "A handwoven rattan or cane chair that brings organic texture and bohemian warmth to living spaces.",
      lead_time_min_weeks: 2, lead_time_max_weeks: 12, price_range_min: 280, price_range_max: 2500
    },
    listings: [
      {
        manufacturer_name: "Four Hands",
        product_name: "Four Hands Westgate Handwoven Rattan Chair",
        portal_url: "https://fourhands.com/search?q=rattan+chair",
        image_url: "https://cdn.fourhands.com/wp-content/uploads/2021/10/JSOL-024A.jpg",
        wholesale_price: 605, retail_price: 1100, commission_rate: 0.10,
        lead_time_min_weeks: 5, lead_time_max_weeks: 7, material: "rattan",
        colors_available: ["natural", "whitewash", "dark stain"],
        dimensions_summary: "30W × 32D × 34H",
        key_features: ["Hand-woven", "Cushion included", "Rainforest Alliance certified"]
      },
      {
        manufacturer_name: "Currey & Company",
        product_name: "Currey & Company Lucie Rattan Chair",
        portal_url: "https://www.curreyandcompany.com/category/seating",
        image_url: "https://currey-co.imgix.net/10-0189.jpg",
        wholesale_price: 798, retail_price: 1450, commission_rate: 0.10,
        lead_time_min_weeks: 10, lead_time_max_weeks: 12, material: "rattan",
        colors_available: ["natural", "black"],
        dimensions_summary: "28W × 30D × 36H",
        key_features: ["Iron frame", "Intricately woven back", "Hand-crafted"]
      },
      {
        manufacturer_name: "World Market",
        product_name: "World Market White Rattan Chair",
        portal_url: "https://www.worldmarket.com/category/furniture/accent-chairs.do",
        image_url: "https://images.worldmarket.com/i/worldmarket/94461_XXX_v1?w=740",
        wholesale_price: 280, retail_price: 499, commission_rate: 0.10,
        lead_time_min_weeks: 1, lead_time_max_weeks: 2, material: "rattan",
        colors_available: ["white", "natural"],
        dimensions_summary: "33W × 33D × 37H",
        key_features: ["Cushion included", "Ready to ship", "Easy assembly"]
      },
    ]
  },
  {
    style: {
      style_name: "Channel-Tufted King Bed",
      category: "bed",
      material: "velvet",
      colors: ["dusty taupe", "champagne", "midnight blue", "blush", "soft silver", "dusty grey"],
      style_tags: ["channel tufted bed", "tufted headboard", "velvet bed", "luxury bed", "hotel bed", "channel tufting", "king bed", "tufted", "velvet", "luxury bedroom", "statement bed", "upholstered headboard"],
      description: "A statement king bed with dramatic channel-tufted headboard — the defining piece of luxury and boutique hotel-style bedrooms.",
      lead_time_min_weeks: 8, lead_time_max_weeks: 18, price_range_min: 3000, price_range_max: 15000
    },
    listings: [
      {
        manufacturer_name: "Caracole",
        product_name: "Caracole Sophistication Channel-Tufted Bed",
        portal_url: "https://www.caracole.com/category/beds",
        image_url: "https://www.caracole.com/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/C/L/CLA-422-105.jpg",
        wholesale_price: 3190, retail_price: 5800, commission_rate: 0.10,
        lead_time_min_weeks: 12, lead_time_max_weeks: 16, material: "velvet",
        colors_available: ["soft silver", "dusty taupe", "midnight blue", "champagne"],
        dimensions_summary: "88W × 88D × 60H (king)",
        key_features: ["Mirrored base", "LED nightlight strip", "GreenGuard Gold", "Satin nickel hardware"]
      },
      {
        manufacturer_name: "Restoration Hardware",
        product_name: "RH Montpellier Channel-Tufted Bed",
        portal_url: "https://rh.com/catalog/category/products.jsp?categoryId=cat14330047",
        image_url: "https://rh.scene7.com/is/image/RH/PROD21720026_s1?$PDP-HERO-SHOT$",
        wholesale_price: 5200, retail_price: 9495, commission_rate: 0.10,
        lead_time_min_weeks: 10, lead_time_max_weeks: 14, material: "velvet",
        colors_available: ["dusty grey", "plum", "navy"],
        dimensions_summary: "90W × 90D × 64H (king)",
        key_features: ["Belgian velvet", "Solid oak base", "Available in all sizes"]
      },
      {
        manufacturer_name: "Bernhardt",
        product_name: "Bernhardt Sutton Tufted Bed",
        portal_url: "https://www.bernhardt.com/furniture/beds",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/W10010_hero?w=780&fmt=webp",
        wholesale_price: 2200, retail_price: 3995, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "velvet",
        colors_available: ["champagne", "dove", "slate", "charcoal"],
        dimensions_summary: "88W × 86D × 54H (king)",
        key_features: ["Channel-tufted headboard", "Solid hardwood frame", "COM available", "GreenGuard Gold"]
      },
    ]
  },
  {
    style: {
      style_name: "Round Pedestal Dining Table",
      category: "dining_table",
      material: "wood",
      colors: ["white", "walnut", "black", "oak", "natural", "dark walnut", "espresso"],
      style_tags: ["round dining table", "pedestal dining table", "round table", "small dining table", "round kitchen table", "pedestal base table", "round", "dining table", "pedestal", "small space", "modern dining"],
      description: "A round dining table on a single pedestal base — maximizes seating with no corner legs, fits any size dining room.",
      lead_time_min_weeks: 1, lead_time_max_weeks: 12, price_range_min: 214, price_range_max: 8000
    },
    listings: [
      {
        manufacturer_name: "Universal Furniture",
        product_name: "Universal Furniture Mid-Century Round Pedestal Dining Table",
        portal_url: "https://www.westelm.com/shop/furniture/dining-tables/",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/3023050_hero?w=780&fmt=webp",
        wholesale_price: 650, retail_price: 1099, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 5, material: "wood",
        colors_available: ["white", "dark walnut", "natural"],
        dimensions_summary: "48 dia × 30H",
        key_features: ["Pedestal base", "Seats 4-6", "FSC certified wood", "Multiple sizes"]
      },
      {
        manufacturer_name: "Restoration Hardware",
        product_name: "RH Salvaged Wood Round Dining Table",
        portal_url: "https://rh.com/catalog/category/products.jsp?categoryId=cat15250005",
        image_url: "https://rh.scene7.com/is/image/RH/PROD19640044_s1?$PDP-HERO-SHOT$",
        wholesale_price: 2200, retail_price: 3995, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 14, material: "wood",
        colors_available: ["natural", "espresso"],
        dimensions_summary: "60 dia × 30H",
        key_features: ["Salvaged wood top", "Iron base", "Custom sizes available"]
      },
      {
        manufacturer_name: "Caracole",
        product_name: "Caracole Odyssey Round Dining Table",
        portal_url: "https://www.cb2.com/category/dining-tables",
        image_url: "https://cb2.scene7.com/is/image/Caracole/OdysseyRoundDineTabSHS23?w=740",
        wholesale_price: 880, retail_price: 1499, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 5, material: "wood",
        colors_available: ["walnut", "white", "oak"],
        dimensions_summary: "48 dia × 30H",
        key_features: ["Solid walnut top", "Sculptural base", "Seats 4"]
      },
      {
        manufacturer_name: "Bernhardt",
        product_name: "Bernhardt Tradewinds Round Dining Table",
        portal_url: "https://www.bernhardt.com/furniture/dining-tables",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/key_product_images/W3079_hero?w=780&fmt=webp",
        wholesale_price: 1540, retail_price: 2800, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "wood",
        colors_available: ["dark walnut", "light oak"],
        dimensions_summary: "54 dia × 30H",
        key_features: ["Solid American walnut", "FSC Certified", "Made to order"]
      },
    ]
  },
  {
    style: {
      style_name: "Leather Club Sofa",
      category: "sofa",
      material: "leather",
      colors: ["cognac", "brown", "black", "tan", "British tan", "tobacco", "antiqued"],
      style_tags: ["leather sofa", "leather couch", "cognac leather sofa", "brown leather sofa", "club sofa", "nailhead sofa", "traditional sofa", "leather", "sofa", "club", "traditional", "nailhead"],
      description: "A traditional rolled-arm sofa in full-grain or top-grain leather, with nailhead trim and turned wooden legs.",
      lead_time_min_weeks: 4, lead_time_max_weeks: 20, price_range_min: 2000, price_range_max: 12000
    },
    listings: [
      {
        manufacturer_name: "Four Hands",
        product_name: "Four Hands Colt Full-Grain Leather Sofa",
        portal_url: "https://fourhands.com/search?q=leather+sofa",
        image_url: "https://cdn.fourhands.com/wp-content/uploads/2022/11/CGRY-058-090-1.jpg",
        wholesale_price: 2640, retail_price: 4800, commission_rate: 0.10,
        lead_time_min_weeks: 6, lead_time_max_weeks: 10, material: "leather",
        colors_available: ["tobacco", "black", "cognac", "vintage white"],
        dimensions_summary: "86W × 38D × 34H",
        key_features: ["Full-grain leather", "Nailhead trim", "Solid oak legs", "10-year frame warranty"]
      },
      {
        manufacturer_name: "Restoration Hardware",
        product_name: "RH Maxwell Leather Sofa",
        portal_url: "https://rh.com/catalog/category/products.jsp?categoryId=cat13340032",
        image_url: "https://rh.scene7.com/is/image/RH/PROD19540103_s1?$PDP-HERO-SHOT$",
        wholesale_price: 4200, retail_price: 7295, commission_rate: 0.10,
        lead_time_min_weeks: 10, lead_time_max_weeks: 16, material: "leather",
        colors_available: ["antique umber", "natural", "black"],
        dimensions_summary: "90W × 40D × 35H",
        key_features: ["Top-grain leather", "Modular option available", "Down fill cushions"]
      },
      {
        manufacturer_name: "Theodore Alexander",
        product_name: "Theodore Alexander Berkeley Club Sofa",
        portal_url: "https://www.theodorealexander.com/category/sofas",
        image_url: "https://www.theodorealexander.com/media/catalog/product/4/1/4109-055_1.jpg",
        wholesale_price: 4500, retail_price: 8500, commission_rate: 0.10,
        lead_time_min_weeks: 16, lead_time_max_weeks: 20, material: "leather",
        colors_available: ["British tan", "cognac", "antiqued black"],
        dimensions_summary: "88W × 38D × 35H",
        key_features: ["Button-tufted back", "Hand-carved frame", "Antique brass nailheads", "8-way hand-tied"]
      },
    ]
  },
  {
    style: {
      style_name: "Coastal Outdoor Sectional",
      category: "outdoor",
      material: "performance_fabric",
      colors: ["white", "sand", "navy", "taupe", "natural teak", "dove", "slate"],
      style_tags: ["outdoor sectional", "patio sectional", "outdoor sofa", "patio furniture", "teak outdoor", "sunbrella sectional", "coastal furniture", "outdoor", "sectional", "patio", "coastal", "sunbrella", "teak", "all-weather"],
      description: "An all-weather outdoor sectional with a teak or powder-coated aluminum frame and Sunbrella cushions.",
      lead_time_min_weeks: 4, lead_time_max_weeks: 16, price_range_min: 1980, price_range_max: 14000
    },
    listings: [
      {
        manufacturer_name: "Four Hands",
        product_name: "Four Hands Solano Teak Outdoor Sectional",
        portal_url: "https://fourhands.com/search?q=outdoor+sectional",
        image_url: "https://cdn.fourhands.com/wp-content/uploads/2022/06/226595-001-1.jpg",
        wholesale_price: 3740, retail_price: 6800, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "performance_fabric",
        colors_available: ["natural teak", "dark teak"],
        dimensions_summary: "130W × 90D × 30H",
        key_features: ["Solid teak frame", "Sunbrella cushions", "Modular design", "All-weather rated"]
      },
      {
        manufacturer_name: "Restoration Hardware",
        product_name: "RH Antibes Outdoor Sectional",
        portal_url: "https://rh.com/catalog/category/products.jsp?categoryId=cat4110002",
        image_url: "https://rh.scene7.com/is/image/RH/PROD20790004_s1?$PDP-HERO-SHOT$",
        wholesale_price: 5500, retail_price: 9995, commission_rate: 0.10,
        lead_time_min_weeks: 10, lead_time_max_weeks: 16, material: "performance_fabric",
        colors_available: ["dove", "slate", "natural"],
        dimensions_summary: "135W × 96D × 32H",
        key_features: ["Teak frame", "All-weather cushions", "10-yr outdoor warranty", "Stainless hardware"]
      },
      {
        manufacturer_name: "Lexington Home Brands",
        product_name: "Lexington Laguna Beach Outdoor Sofa",
        portal_url: "https://www.lexington.com/category/outdoor",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/outdoor_coastal_sofa?w=780&fmt=webp",
        wholesale_price: 1980, retail_price: 3600, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "performance_fabric",
        colors_available: ["white", "charcoal", "sand"],
        dimensions_summary: "90W × 36D × 30H",
        key_features: ["Powder-coated aluminum", "Sunbrella cushions", "1000+ UV hours rated"]
      },
    ]
  },
  {
    style: {
      style_name: "Handwoven Area Rug",
      category: "rug",
      material: "wool",
      colors: ["ivory", "cream", "rust", "charcoal", "blue", "terracotta", "beige", "natural"],
      style_tags: ["area rug", "wool rug", "handwoven rug", "hand knotted rug", "persian rug", "living room rug", "artisan rug", "rug", "wool", "handwoven", "area rug", "persian", "artisan", "floor rug"],
      description: "A handwoven or hand-knotted wool area rug — one of the most searched furnishing styles by interior designers.",
      lead_time_min_weeks: 2, lead_time_max_weeks: 16, price_range_min: 400, price_range_max: 12000
    },
    listings: [
      {
        manufacturer_name: "Arteriors",
        product_name: "Arteriors Cassius Hand-Knotted Rug",
        portal_url: "https://arteriorshome.com/category/rugs",
        image_url: "https://cdn.arteriorshome.com/images/PAX-8001.jpg",
        wholesale_price: 1540, retail_price: 2800, commission_rate: 0.10,
        lead_time_min_weeks: 12, lead_time_max_weeks: 16, material: "wool",
        colors_available: ["ivory/camel", "charcoal/ivory", "rust/cream"],
        dimensions_summary: "8×10 ft (custom available)",
        key_features: ["Hand-knotted", "Vegetable-dyed", "GoodWeave certified", "100% wool"]
      },
      {
        manufacturer_name: "Caracole",
        product_name: "Caracole Tela Hand-Knotted Rug",
        portal_url: "https://www.cb2.com/category/rugs",
        image_url: "https://cb2.scene7.com/is/image/Caracole/TelaHandKnottedRugSHS23?w=740",
        wholesale_price: 680, retail_price: 1299, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 6, material: "wool",
        colors_available: ["ivory", "blue/ivory", "grey"],
        dimensions_summary: "8×10 ft (multiple sizes)",
        key_features: ["Hand-knotted wool", "Multiple sizes available", "Low pile"]
      },
      {
        manufacturer_name: "Restoration Hardware",
        product_name: "RH Persian-Inspired Hand-Knotted Rug",
        portal_url: "https://rh.com/catalog/category/products.jsp?categoryId=cat11000007",
        image_url: "https://rh.scene7.com/is/image/RH/PROD20610019_s1?$PDP-HERO-SHOT$",
        wholesale_price: 2200, retail_price: 3995, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 14, material: "wool",
        colors_available: ["antique ivory", "charcoal", "natural"],
        dimensions_summary: "9×12 ft (custom sizes available)",
        key_features: ["Hand-knotted", "100% wool", "Custom sizes", "Vegetable dyed"]
      },
    ]
  },
  {
    style: {
      style_name: "Cluster Pendant Chandelier",
      category: "lighting",
      material: "metal",
      colors: ["antique brass", "matte black", "polished nickel", "bronze", "gold leaf"],
      style_tags: ["cluster chandelier", "pendant chandelier", "dining chandelier", "entryway chandelier", "statement chandelier", "multi-light chandelier", "chandelier", "pendant", "cluster", "dining lighting", "entryway", "luxury lighting"],
      description: "A cluster chandelier with multiple pendant arms or globes — a focal-point lighting statement for dining rooms and entry foyers.",
      lead_time_min_weeks: 4, lead_time_max_weeks: 14, price_range_min: 580, price_range_max: 8000
    },
    listings: [
      {
        manufacturer_name: "Arteriors",
        product_name: "Arteriors Navarro Cluster Chandelier",
        portal_url: "https://arteriorshome.com/category/lighting/chandeliers-pendants",
        image_url: "https://cdn.arteriorshome.com/images/89817.jpg",
        wholesale_price: 1210, retail_price: 2200, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "metal",
        colors_available: ["antique brass", "oil-rubbed bronze", "polished nickel"],
        dimensions_summary: "30 dia × 26H",
        key_features: ["Hand-blown glass", "Adjustable chain", "UL Listed", "Multiple finishes"]
      },
      {
        manufacturer_name: "Currey & Company",
        product_name: "Currey & Company Parish Iron Chandelier",
        portal_url: "https://www.curreyandcompany.com/category/chandeliers",
        image_url: "https://currey-co.imgix.net/9000-0709.jpg",
        wholesale_price: 1705, retail_price: 3100, commission_rate: 0.10,
        lead_time_min_weeks: 10, lead_time_max_weeks: 14, material: "metal",
        colors_available: ["gold leaf", "silver leaf", "antique bronze"],
        dimensions_summary: "36 dia × 36H",
        key_features: ["Hand-forged iron", "20 candelabra bulbs", "UL Listed", "Custom sizing"]
      },
      {
        manufacturer_name: "Caracole",
        product_name: "Caracole Arched Cluster Pendant",
        portal_url: "https://www.cb2.com/category/lighting/chandeliers-pendants",
        image_url: "https://cb2.scene7.com/is/image/Caracole/ArchedClusterPendantSSS23?w=740",
        wholesale_price: 580, retail_price: 999, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 5, material: "metal",
        colors_available: ["brushed brass", "matte black"],
        dimensions_summary: "22 dia × 20H",
        key_features: ["Dimmable", "Adjustable height", "UL Listed", "In-stock options"]
      },
    ]
  },
  {
    style: {
      style_name: "Performance Fabric Sofa",
      category: "sofa",
      material: "performance_fabric",
      colors: ["navy", "gray", "cream", "oatmeal", "stone", "charcoal", "olive", "taupe"],
      style_tags: ["performance fabric sofa", "stain resistant sofa", "family friendly sofa", "pet friendly sofa", "kid friendly sofa", "easy clean sofa", "crypton sofa", "performance fabric", "sofa", "stain resistant", "family friendly", "kids", "pets"],
      description: "A sofa upholstered in stain- and moisture-resistant performance fabric — the #1 request from families with young children and pets.",
      lead_time_min_weeks: 2, lead_time_max_weeks: 12, price_range_min: 330, price_range_max: 6000
    },
    listings: [
      {
        manufacturer_name: "Four Hands",
        product_name: "Four Hands Yelena Performance Sofa",
        portal_url: "https://fourhands.com/search?q=performance+fabric+sofa",
        image_url: "https://cdn.fourhands.com/wp-content/uploads/2022/10/233559-004-1.jpg",
        wholesale_price: 1649, retail_price: 2999, commission_rate: 0.10,
        lead_time_min_weeks: 4, lead_time_max_weeks: 6, material: "performance_fabric",
        colors_available: ["snow", "olive", "taupe"],
        dimensions_summary: "85W × 37D × 32H",
        key_features: ["Crypton performance fabric", "Loose back cushions", "Kiln-dried frame", "Stain + moisture resistant"]
      },
      {
        manufacturer_name: "Ashley Furniture",
        product_name: "Ashley Altari Performance Sofa",
        portal_url: "https://www.ashleyfurniture.com/c/furniture/living-room/sofas/",
        image_url: "https://cdn.ashley.com/4530638/8350538P2b.jpg",
        wholesale_price: 330, retail_price: 599, commission_rate: 0.10,
        lead_time_min_weeks: 1, lead_time_max_weeks: 2, material: "performance_fabric",
        colors_available: ["slate", "alloy", "cream"],
        dimensions_summary: "88W × 38D × 37H",
        key_features: ["Stain-resistant", "Corner-blocked frame", "In-stock / quick ship"]
      },
      {
        manufacturer_name: "Bernhardt",
        product_name: "Bernhardt Cantor Performance Sofa",
        portal_url: "https://www.bernhardt.com/furniture/sofas",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/W9103_h?w=780&fmt=webp",
        wholesale_price: 2140, retail_price: 3890, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "performance_fabric",
        colors_available: ["stone", "charcoal", "ivory", "navy"],
        dimensions_summary: "88W × 36D × 32H",
        key_features: ["8-way hand-tied", "High-resilience foam", "BIFMA certified", "COM available"]
      },
    ]
  },
  {
    style: {
      style_name: "Japandi Minimalist Sofa",
      category: "sofa",
      material: "linen",
      colors: ["sand", "cream", "warm gray", "greige", "terracotta", "natural linen", "ivory"],
      style_tags: ["japandi sofa", "minimalist sofa", "japanese sofa", "scandinavian sofa", "natural sofa", "linen sofa", "low profile sofa", "japandi", "minimalist", "sofa", "natural", "linen", "low profile", "simple"],
      description: "A low-slung, minimalist sofa influenced by the Japandi aesthetic: natural materials, neutral tones, and deliberate simplicity.",
      lead_time_min_weeks: 3, lead_time_max_weeks: 16, price_range_min: 1100, price_range_max: 7000
    },
    listings: [
      {
        manufacturer_name: "Bernhardt",
        product_name: "Bernhardt Cantor Track-Arm Sofa",
        portal_url: "https://www.bernhardt.com/furniture/sofas",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/W9103_h?w=780&fmt=webp",
        wholesale_price: 2140, retail_price: 3890, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 12, material: "linen",
        colors_available: ["stone", "ivory", "dove"],
        dimensions_summary: "88W × 36D × 32H",
        key_features: ["Kiln-dried frame", "8-way hand-tied", "Low profile", "Natural materials"]
      },
      {
        manufacturer_name: "Universal Furniture",
        product_name: "Universal Furniture Andes Low-Profile Sofa",
        portal_url: "https://www.westelm.com/shop/furniture/sofas-loveseats/",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/5234741_hero?w=780&fmt=webp",
        wholesale_price: 1100, retail_price: 1999, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 6, material: "linen",
        colors_available: ["natural linen", "sand", "light gray"],
        dimensions_summary: "87W × 37D × 28H",
        key_features: ["Box cushion", "Solid wood legs", "GreenGuard certified"]
      },
      {
        manufacturer_name: "Vanguard",
        product_name: "Article Ceni Low-Profile Sofa",
        portal_url: "https://www.article.com/category/sofas",
        image_url: "https://cdn.article.com/site/product/large/ceni-sofa-natural.jpg",
        wholesale_price: 1050, retail_price: 1599, commission_rate: 0.10,
        lead_time_min_weeks: 2, lead_time_max_weeks: 4, material: "linen",
        colors_available: ["natural", "warm gray", "cream"],
        dimensions_summary: "84W × 36D × 30H",
        key_features: ["Natural linen blend", "Low profile design", "Quick ship available"]
      },
    ]
  },
  {
    style: {
      style_name: "Standing Desk",
      category: "desk",
      material: "wood",
      colors: ["light oak", "dark walnut", "white", "black", "natural"],
      style_tags: ["standing desk", "height adjustable desk", "sit stand desk", "motorized desk", "home office desk", "ergonomic desk", "standing", "desk", "height adjustable", "home office", "ergonomic", "adjustable"],
      description: "A height-adjustable motorized standing desk — the single most requested home office piece since 2020.",
      lead_time_min_weeks: 1, lead_time_max_weeks: 10, price_range_min: 500, price_range_max: 3500
    },
    listings: [
      {
        manufacturer_name: "Hooker Furniture",
        product_name: "Hooker Latitude Standing Desk",
        portal_url: "https://www.hookerfurniture.com/category/home-office/desks",
        image_url: "https://www.hookerfurniture.com/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/5/8/5847-10458-80_angl.jpg",
        wholesale_price: 1155, retail_price: 2100, commission_rate: 0.10,
        lead_time_min_weeks: 7, lead_time_max_weeks: 10, material: "wood",
        colors_available: ["light oak", "dark walnut", "white"],
        dimensions_summary: "60W × 28D × 24-50H",
        key_features: ["Dual-motor lift", "4-position memory", "300 lb capacity", "BIFMA certified"]
      },
      {
        manufacturer_name: "Universal Furniture",
        product_name: "Universal Furniture Gemini Standing Desk",
        portal_url: "https://www.westelm.com/shop/furniture/home-office/",
        image_url: "https://images.westelm.com/is/image/WillowsFurnitureMgmt/w8120_hero?w=780&fmt=webp",
        wholesale_price: 800, retail_price: 1299, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 5, material: "wood",
        colors_available: ["white", "dark walnut"],
        dimensions_summary: "58W × 27D × 24-48H",
        key_features: ["Single motor", "3-position memory", "Cable management tray"]
      },
      {
        manufacturer_name: "Arhaus",
        product_name: "Arhaus Hudson Height Adjustable Desk",
        portal_url: "https://www.arhaus.com/home-office/",
        image_url: "https://az275476.vo.msecnd.net/mediav2/homeofficefurniture/arhaus-hudson-desk.jpg",
        wholesale_price: 950, retail_price: 1599, commission_rate: 0.10,
        lead_time_min_weeks: 4, lead_time_max_weeks: 7, material: "wood",
        colors_available: ["espresso", "natural", "white"],
        dimensions_summary: "60W × 30D × 24-50H",
        key_features: ["Dual motor", "Anti-collision sensor", "Cable tray", "Solid hardwood top"]
      },
    ]
  },
  {
    style: {
      style_name: "Velvet Barrel Accent Chair",
      category: "chair",
      material: "velvet",
      colors: ["mustard", "terracotta", "dusty blue", "sage", "mauve", "cognac", "champagne", "teal"],
      style_tags: ["barrel chair", "tub chair", "velvet accent chair", "swivel accent chair", "round back chair", "living room chair", "velvet", "barrel chair", "accent chair", "tub chair", "living room", "swivel"],
      description: "A round-backed, fully upholstered barrel or tub chair in velvet — one of the most versatile and sought-after accent pieces.",
      lead_time_min_weeks: 4, lead_time_max_weeks: 16, price_range_min: 650, price_range_max: 4000
    },
    listings: [
      {
        manufacturer_name: "Caracole",
        product_name: "Caracole Luxe Glam Swivel Chair",
        portal_url: "https://www.caracole.com/category/chairs",
        image_url: "https://www.caracole.com/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/C/L/CLA-418-131.jpg",
        wholesale_price: 1540, retail_price: 2800, commission_rate: 0.10,
        lead_time_min_weeks: 12, lead_time_max_weeks: 16, material: "velvet",
        colors_available: ["ivory", "blush", "deep teal", "black"],
        dimensions_summary: "32W × 33D × 37H",
        key_features: ["360° swivel", "Button-tufted back", "Polished chrome base", "COM available"]
      },
      {
        manufacturer_name: "Arteriors",
        product_name: "Arteriors Cowen Barrel Chair",
        portal_url: "https://arteriorshome.com/category/seating/accent-chairs",
        image_url: "https://cdn.arteriorshome.com/images/8509.jpg",
        wholesale_price: 1018, retail_price: 1850, commission_rate: 0.10,
        lead_time_min_weeks: 10, lead_time_max_weeks: 14, material: "velvet",
        colors_available: ["champagne", "sage", "terracotta", "charcoal"],
        dimensions_summary: "29W × 31D × 35H",
        key_features: ["Polished brass legs", "Solid beech frame", "COM available", "Hand-crafted"]
      },
      {
        manufacturer_name: "Caracole",
        product_name: "Caracole Avec Velvet Chair",
        portal_url: "https://www.cb2.com/category/accent-chairs",
        image_url: "https://cb2.scene7.com/is/image/Caracole/AvecVelvetChairSHS23?w=740",
        wholesale_price: 650, retail_price: 999, commission_rate: 0.10,
        lead_time_min_weeks: 3, lead_time_max_weeks: 5, material: "velvet",
        colors_available: ["tan", "dusty blue", "sage green"],
        dimensions_summary: "28W × 30D × 30H",
        key_features: ["Solid oak legs", "Multiple fabric options", "In-stock options available"]
      },
      {
        manufacturer_name: "Hickory Chair",
        product_name: "Hickory Chair Alexa Hampton Arm Chair",
        portal_url: "https://www.hickorychair.com/category/chairs",
        image_url: "https://www.hickorychair.com/media/catalog/product/cache/1/image/9df78eab33525d08d6e5fb8d27136e95/5/2/5261-01.jpg",
        wholesale_price: 1980, retail_price: 3600, commission_rate: 0.10,
        lead_time_min_weeks: 14, lead_time_max_weeks: 18, material: "velvet",
        colors_available: ["antique gold", "dusty rose", "sage", "navy"],
        dimensions_summary: "30W × 32D × 38H",
        key_features: ["Hand-carved frame", "Made in USA", "10yr warranty", "COM available"]
      },
    ]
  },
  {
    style: {
      style_name: "Farmhouse Dining Table",
      category: "dining_table",
      material: "wood",
      colors: ["whitewash", "rustic brown", "natural pine", "dark walnut", "white", "weathered"],
      style_tags: ["farmhouse dining table", "rustic dining table", "trestle table", "wood dining table", "farmhouse table", "family dining table", "rustic table", "farmhouse", "dining table", "rustic", "pine", "trestle", "family dining", "large dining"],
      description: "A long, solid wood farmhouse dining table with a trestle or turned-leg base — a perennial favorite for family dining rooms.",
      lead_time_min_weeks: 1, lead_time_max_weeks: 14, price_range_min: 180, price_range_max: 6000
    },
    listings: [
      {
        manufacturer_name: "Ashley Furniture",
        product_name: "Ashley Berringer Farmhouse Dining Table",
        portal_url: "https://www.ashleyfurniture.com/c/furniture/dining-room/kitchen-dining-tables/",
        image_url: "https://cdn.ashley.com/4530638/D199-25_Room.jpg",
        wholesale_price: 180, retail_price: 328, commission_rate: 0.10,
        lead_time_min_weeks: 1, lead_time_max_weeks: 2, material: "wood",
        colors_available: ["rustic brown", "whitewash"],
        dimensions_summary: "66L × 38W × 30H",
        key_features: ["Seats 6", "Easy clean surface", "Matching chairs available", "In-stock"]
      },
      {
        manufacturer_name: "Four Hands",
        product_name: "Four Hands Matthes Farmhouse Dining Table",
        portal_url: "https://fourhands.com/search?q=dining+table",
        image_url: "https://cdn.fourhands.com/wp-content/uploads/2022/07/236498-001-1.jpg",
        wholesale_price: 989, retail_price: 1799, commission_rate: 0.10,
        lead_time_min_weeks: 5, lead_time_max_weeks: 7, material: "wood",
        colors_available: ["dark aged oak", "light oak"],
        dimensions_summary: "72L × 36W × 30H",
        key_features: ["Solid pine", "Iron base", "Seats 6-8", "Handcrafted"]
      },
      {
        manufacturer_name: "Restoration Hardware",
        product_name: "RH Salvaged Wood Farmhouse Table",
        portal_url: "https://rh.com/catalog/category/products.jsp?categoryId=cat15250005",
        image_url: "https://rh.scene7.com/is/image/RH/PROD19640041_s1?$PDP-HERO-SHOT$",
        wholesale_price: 2800, retail_price: 5495, commission_rate: 0.10,
        lead_time_min_weeks: 8, lead_time_max_weeks: 14, material: "wood",
        colors_available: ["natural", "espresso"],
        dimensions_summary: "96L × 42W × 30H",
        key_features: ["Salvaged pine", "Seats 10", "Custom sizes available", "Iron base"]
      },
    ]
  },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }
    const sr = base44.asServiceRole;

    // Clear existing
    const existingStyles = await sr.entities.FurnitureStyle.list('-created_date', 200);
    for (const s of existingStyles) await sr.entities.FurnitureStyle.delete(s.id);

    const existingListings = await sr.entities.ManufacturerListing.list('-created_date', 500);
    for (const l of existingListings) await sr.entities.ManufacturerListing.delete(l.id);

    let styleCount = 0;
    let listingCount = 0;

    for (const entry of STYLES_AND_LISTINGS) {
      const createdStyle = await sr.entities.FurnitureStyle.create(entry.style);
      styleCount++;
      for (const listing of entry.listings) {
        await sr.entities.ManufacturerListing.create({
          ...listing,
          style_id: createdStyle.id,
          style_name: entry.style.style_name,
          status: "active",
        });
        listingCount++;
      }
    }

    return Response.json({ success: true, styles: styleCount, listings: listingCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});