// ── SPEC Sourcing Brain ──
// Core intelligence module for furniture sourcing projects

// ── Room Template Library ──
// Comprehensive furniture checklists per room type/size

const ROOM_TEMPLATES = {
  "living-room": {
    small: {
      essential: [
        { item: "Sofa", qty: 1, priority: "high", search: "sofa 72 inch" },
        { item: "Coffee Table", qty: 1, priority: "high", search: "coffee table" },
        { item: "Side Table", qty: 1, priority: "medium", search: "side table" },
        { item: "Floor Lamp", qty: 1, priority: "medium", search: "floor lamp" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug 5x7" },
      ],
      optional: [
        { item: "Accent Chair", qty: 1, priority: "low", search: "accent chair" },
        { item: "Console Table", qty: 1, priority: "low", search: "console table" },
        { item: "Bookshelf", qty: 1, priority: "low", search: "bookshelf" },
      ],
    },
    medium: {
      essential: [
        { item: "Sofa", qty: 1, priority: "high", search: "sofa 84 inch" },
        { item: "Coffee Table", qty: 1, priority: "high", search: "coffee table rectangular" },
        { item: "Accent Chair", qty: 2, priority: "high", search: "accent chair" },
        { item: "Side Table", qty: 2, priority: "medium", search: "side table" },
        { item: "Floor Lamp", qty: 1, priority: "medium", search: "floor lamp" },
        { item: "Table Lamp", qty: 2, priority: "medium", search: "table lamp" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug 8x10" },
        { item: "TV Console", qty: 1, priority: "medium", search: "media console" },
      ],
      optional: [
        { item: "Console Table", qty: 1, priority: "low", search: "console table" },
        { item: "Bookshelf", qty: 1, priority: "low", search: "bookshelf" },
        { item: "Ottoman", qty: 1, priority: "low", search: "ottoman" },
        { item: "Throw Pillows", qty: 4, priority: "low", search: "throw pillow set" },
        { item: "Wall Art", qty: 2, priority: "low", search: "wall art" },
      ],
    },
    large: {
      essential: [
        { item: "Sectional Sofa", qty: 1, priority: "high", search: "sectional sofa" },
        { item: "Coffee Table", qty: 1, priority: "high", search: "coffee table large" },
        { item: "Accent Chair", qty: 2, priority: "high", search: "accent chair" },
        { item: "Side Table", qty: 2, priority: "medium", search: "side table" },
        { item: "Floor Lamp", qty: 2, priority: "medium", search: "floor lamp" },
        { item: "Table Lamp", qty: 2, priority: "medium", search: "table lamp" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug 9x12" },
        { item: "TV Console", qty: 1, priority: "medium", search: "media console 72 inch" },
        { item: "Bookshelf", qty: 2, priority: "medium", search: "bookshelf tall" },
      ],
      optional: [
        { item: "Console Table", qty: 1, priority: "low", search: "console table" },
        { item: "Bar Cart", qty: 1, priority: "low", search: "bar cart" },
        { item: "Chaise Lounge", qty: 1, priority: "low", search: "chaise lounge" },
        { item: "Ottoman", qty: 1, priority: "low", search: "ottoman large" },
        { item: "Throw Pillows", qty: 6, priority: "low", search: "throw pillow set" },
        { item: "Wall Art", qty: 3, priority: "low", search: "wall art large" },
        { item: "Room Divider", qty: 1, priority: "low", search: "room divider" },
      ],
    },
  },

  "bedroom": {
    small: {
      essential: [
        { item: "Bed Frame", qty: 1, priority: "high", search: "bed frame queen" },
        { item: "Mattress", qty: 1, priority: "high", search: "mattress queen" },
        { item: "Nightstand", qty: 1, priority: "high", search: "nightstand" },
        { item: "Table Lamp", qty: 1, priority: "medium", search: "table lamp bedroom" },
        { item: "Dresser", qty: 1, priority: "medium", search: "dresser compact" },
      ],
      optional: [
        { item: "Area Rug", qty: 1, priority: "low", search: "area rug bedroom 5x7" },
        { item: "Wall Mirror", qty: 1, priority: "low", search: "wall mirror bedroom" },
        { item: "Throw Blanket", qty: 1, priority: "low", search: "throw blanket" },
      ],
    },
    medium: {
      essential: [
        { item: "Bed Frame", qty: 1, priority: "high", search: "bed frame queen upholstered" },
        { item: "Mattress", qty: 1, priority: "high", search: "mattress queen" },
        { item: "Nightstand", qty: 2, priority: "high", search: "nightstand" },
        { item: "Table Lamp", qty: 2, priority: "medium", search: "table lamp bedroom" },
        { item: "Dresser", qty: 1, priority: "medium", search: "dresser 6 drawer" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug bedroom 8x10" },
      ],
      optional: [
        { item: "Bench", qty: 1, priority: "low", search: "bedroom bench end of bed" },
        { item: "Accent Chair", qty: 1, priority: "low", search: "bedroom accent chair" },
        { item: "Full-Length Mirror", qty: 1, priority: "low", search: "full length mirror" },
        { item: "Wall Art", qty: 2, priority: "low", search: "wall art bedroom" },
        { item: "Throw Pillows", qty: 4, priority: "low", search: "throw pillow bedroom" },
      ],
    },
    large: {
      essential: [
        { item: "Bed Frame", qty: 1, priority: "high", search: "bed frame king upholstered" },
        { item: "Mattress", qty: 1, priority: "high", search: "mattress king" },
        { item: "Nightstand", qty: 2, priority: "high", search: "nightstand" },
        { item: "Table Lamp", qty: 2, priority: "medium", search: "table lamp bedroom" },
        { item: "Dresser", qty: 1, priority: "medium", search: "dresser wide 9 drawer" },
        { item: "Chest of Drawers", qty: 1, priority: "medium", search: "tall chest of drawers" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug bedroom 9x12" },
        { item: "Bench", qty: 1, priority: "medium", search: "bedroom bench upholstered" },
      ],
      optional: [
        { item: "Accent Chair", qty: 1, priority: "low", search: "bedroom reading chair" },
        { item: "Vanity", qty: 1, priority: "low", search: "vanity table with mirror" },
        { item: "Chaise Lounge", qty: 1, priority: "low", search: "chaise lounge bedroom" },
        { item: "Full-Length Mirror", qty: 1, priority: "low", search: "full length mirror freestanding" },
        { item: "Wall Art", qty: 3, priority: "low", search: "wall art bedroom" },
        { item: "Throw Pillows", qty: 6, priority: "low", search: "throw pillow set" },
        { item: "Window Bench", qty: 1, priority: "low", search: "window bench seat" },
      ],
    },
  },

  "dining-room": {
    small: {
      essential: [
        { item: "Dining Table", qty: 1, priority: "high", search: "dining table 48 inch round" },
        { item: "Dining Chair", qty: 4, priority: "high", search: "dining chair" },
        { item: "Pendant Light", qty: 1, priority: "medium", search: "pendant light dining" },
      ],
      optional: [
        { item: "Area Rug", qty: 1, priority: "low", search: "area rug dining 5x7" },
        { item: "Sideboard", qty: 1, priority: "low", search: "sideboard compact" },
        { item: "Wall Art", qty: 1, priority: "low", search: "wall art dining room" },
      ],
    },
    medium: {
      essential: [
        { item: "Dining Table", qty: 1, priority: "high", search: "dining table 72 inch rectangular" },
        { item: "Dining Chair", qty: 6, priority: "high", search: "dining chair" },
        { item: "Chandelier", qty: 1, priority: "high", search: "chandelier dining room" },
        { item: "Sideboard", qty: 1, priority: "medium", search: "sideboard buffet" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug dining 8x10" },
      ],
      optional: [
        { item: "Bar Cart", qty: 1, priority: "low", search: "bar cart" },
        { item: "Wall Art", qty: 2, priority: "low", search: "wall art dining room" },
        { item: "Table Runner", qty: 1, priority: "low", search: "table runner" },
        { item: "Centerpiece", qty: 1, priority: "low", search: "table centerpiece decorative" },
      ],
    },
    large: {
      essential: [
        { item: "Dining Table", qty: 1, priority: "high", search: "dining table 96 inch extendable" },
        { item: "Dining Chair", qty: 8, priority: "high", search: "dining chair" },
        { item: "Host Chair", qty: 2, priority: "high", search: "dining arm chair host" },
        { item: "Chandelier", qty: 1, priority: "high", search: "chandelier dining large" },
        { item: "Sideboard", qty: 1, priority: "medium", search: "sideboard buffet large" },
        { item: "China Cabinet", qty: 1, priority: "medium", search: "china cabinet" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug dining 9x12" },
      ],
      optional: [
        { item: "Bar Cart", qty: 1, priority: "low", search: "bar cart" },
        { item: "Console Table", qty: 1, priority: "low", search: "console table dining" },
        { item: "Wall Art", qty: 3, priority: "low", search: "wall art dining room large" },
        { item: "Candle Holders", qty: 2, priority: "low", search: "candle holder decorative" },
        { item: "Wine Storage", qty: 1, priority: "low", search: "wine storage rack" },
      ],
    },
  },

  "home-office": {
    small: {
      essential: [
        { item: "Desk", qty: 1, priority: "high", search: "desk 48 inch" },
        { item: "Office Chair", qty: 1, priority: "high", search: "ergonomic office chair" },
        { item: "Desk Lamp", qty: 1, priority: "medium", search: "desk lamp" },
        { item: "Monitor Stand", qty: 1, priority: "medium", search: "monitor stand" },
      ],
      optional: [
        { item: "Bookshelf", qty: 1, priority: "low", search: "bookshelf small" },
        { item: "Filing Cabinet", qty: 1, priority: "low", search: "filing cabinet" },
        { item: "Desk Organizer", qty: 1, priority: "low", search: "desk organizer" },
      ],
    },
    medium: {
      essential: [
        { item: "Desk", qty: 1, priority: "high", search: "desk 60 inch executive" },
        { item: "Office Chair", qty: 1, priority: "high", search: "ergonomic office chair premium" },
        { item: "Bookshelf", qty: 1, priority: "high", search: "bookshelf office" },
        { item: "Desk Lamp", qty: 1, priority: "medium", search: "desk lamp adjustable" },
        { item: "Filing Cabinet", qty: 1, priority: "medium", search: "filing cabinet" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug office 5x7" },
      ],
      optional: [
        { item: "Guest Chair", qty: 2, priority: "low", search: "guest chair office" },
        { item: "Credenza", qty: 1, priority: "low", search: "credenza office" },
        { item: "Wall Art", qty: 1, priority: "low", search: "wall art office" },
        { item: "Floor Lamp", qty: 1, priority: "low", search: "floor lamp" },
      ],
    },
    large: {
      essential: [
        { item: "Executive Desk", qty: 1, priority: "high", search: "executive desk 72 inch" },
        { item: "Office Chair", qty: 1, priority: "high", search: "ergonomic office chair executive" },
        { item: "Bookshelf", qty: 2, priority: "high", search: "bookshelf tall office" },
        { item: "Credenza", qty: 1, priority: "medium", search: "credenza office large" },
        { item: "Filing Cabinet", qty: 2, priority: "medium", search: "filing cabinet" },
        { item: "Desk Lamp", qty: 1, priority: "medium", search: "desk lamp executive" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug office 8x10" },
      ],
      optional: [
        { item: "Guest Chair", qty: 2, priority: "low", search: "guest chair office leather" },
        { item: "Conference Table", qty: 1, priority: "low", search: "small conference table" },
        { item: "Floor Lamp", qty: 1, priority: "low", search: "floor lamp office" },
        { item: "Wall Art", qty: 2, priority: "low", search: "wall art office" },
        { item: "Sofa", qty: 1, priority: "low", search: "office sofa compact" },
        { item: "Side Table", qty: 1, priority: "low", search: "side table" },
      ],
    },
  },

  "entryway": {
    small: {
      essential: [
        { item: "Console Table", qty: 1, priority: "high", search: "entryway console table narrow" },
        { item: "Wall Mirror", qty: 1, priority: "high", search: "entryway mirror" },
        { item: "Coat Hook Rack", qty: 1, priority: "medium", search: "coat hook wall mount" },
      ],
      optional: [
        { item: "Small Rug", qty: 1, priority: "low", search: "entryway rug 2x3" },
        { item: "Key Tray", qty: 1, priority: "low", search: "decorative tray entryway" },
        { item: "Wall Sconce", qty: 2, priority: "low", search: "wall sconce entryway" },
      ],
    },
    medium: {
      essential: [
        { item: "Console Table", qty: 1, priority: "high", search: "entryway console table" },
        { item: "Wall Mirror", qty: 1, priority: "high", search: "entryway mirror large" },
        { item: "Bench", qty: 1, priority: "medium", search: "entryway bench storage" },
        { item: "Table Lamp", qty: 1, priority: "medium", search: "table lamp entryway" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "runner rug 2x8" },
      ],
      optional: [
        { item: "Umbrella Stand", qty: 1, priority: "low", search: "umbrella stand" },
        { item: "Wall Art", qty: 1, priority: "low", search: "wall art entryway" },
        { item: "Storage Basket", qty: 2, priority: "low", search: "storage basket decorative" },
        { item: "Coat Rack", qty: 1, priority: "low", search: "coat rack freestanding" },
      ],
    },
    large: {
      essential: [
        { item: "Console Table", qty: 1, priority: "high", search: "entryway console table large" },
        { item: "Wall Mirror", qty: 1, priority: "high", search: "entryway mirror oversized" },
        { item: "Bench", qty: 1, priority: "high", search: "entryway bench upholstered" },
        { item: "Table Lamp", qty: 2, priority: "medium", search: "table lamp entryway" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "runner rug 3x10" },
        { item: "Chandelier", qty: 1, priority: "medium", search: "foyer chandelier" },
      ],
      optional: [
        { item: "Hall Tree", qty: 1, priority: "low", search: "hall tree coat rack" },
        { item: "Umbrella Stand", qty: 1, priority: "low", search: "umbrella stand" },
        { item: "Wall Art", qty: 2, priority: "low", search: "wall art entryway" },
        { item: "Storage Cabinet", qty: 1, priority: "low", search: "entryway storage cabinet" },
        { item: "Accent Chair", qty: 1, priority: "low", search: "accent chair entryway" },
      ],
    },
  },

  "nursery": {
    small: {
      essential: [
        { item: "Crib", qty: 1, priority: "high", search: "baby crib convertible" },
        { item: "Crib Mattress", qty: 1, priority: "high", search: "crib mattress" },
        { item: "Changing Table", qty: 1, priority: "high", search: "changing table dresser" },
        { item: "Glider Chair", qty: 1, priority: "high", search: "nursery glider recliner" },
      ],
      optional: [
        { item: "Area Rug", qty: 1, priority: "low", search: "nursery area rug soft" },
        { item: "Mobile", qty: 1, priority: "low", search: "crib mobile" },
        { item: "Night Light", qty: 1, priority: "low", search: "night light nursery" },
      ],
    },
    medium: {
      essential: [
        { item: "Crib", qty: 1, priority: "high", search: "baby crib convertible" },
        { item: "Crib Mattress", qty: 1, priority: "high", search: "crib mattress" },
        { item: "Changing Table Dresser", qty: 1, priority: "high", search: "changing table dresser 6 drawer" },
        { item: "Glider Chair", qty: 1, priority: "high", search: "nursery glider recliner" },
        { item: "Bookshelf", qty: 1, priority: "medium", search: "nursery bookshelf" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "nursery area rug 5x7" },
      ],
      optional: [
        { item: "Side Table", qty: 1, priority: "low", search: "side table nursery" },
        { item: "Table Lamp", qty: 1, priority: "low", search: "table lamp nursery" },
        { item: "Storage Bins", qty: 3, priority: "low", search: "nursery storage bins" },
        { item: "Wall Art", qty: 2, priority: "low", search: "wall art nursery" },
        { item: "Mobile", qty: 1, priority: "low", search: "crib mobile" },
      ],
    },
    large: {
      essential: [
        { item: "Crib", qty: 1, priority: "high", search: "baby crib convertible" },
        { item: "Crib Mattress", qty: 1, priority: "high", search: "crib mattress" },
        { item: "Changing Table Dresser", qty: 1, priority: "high", search: "changing table dresser wide" },
        { item: "Glider Chair", qty: 1, priority: "high", search: "nursery glider recliner" },
        { item: "Wardrobe", qty: 1, priority: "medium", search: "nursery wardrobe armoire" },
        { item: "Bookshelf", qty: 1, priority: "medium", search: "nursery bookshelf" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "nursery area rug 8x10" },
        { item: "Side Table", qty: 1, priority: "medium", search: "side table nursery" },
      ],
      optional: [
        { item: "Toddler Bed", qty: 1, priority: "low", search: "toddler bed" },
        { item: "Play Mat", qty: 1, priority: "low", search: "play mat nursery" },
        { item: "Storage Cabinet", qty: 1, priority: "low", search: "nursery storage cabinet" },
        { item: "Wall Art", qty: 3, priority: "low", search: "wall art nursery" },
        { item: "Mobile", qty: 1, priority: "low", search: "crib mobile" },
        { item: "Floor Lamp", qty: 1, priority: "low", search: "floor lamp nursery dimmable" },
      ],
    },
  },

  "media-room": {
    small: {
      essential: [
        { item: "Sofa", qty: 1, priority: "high", search: "sofa deep seat" },
        { item: "TV Console", qty: 1, priority: "high", search: "media console" },
        { item: "Side Table", qty: 1, priority: "medium", search: "side table" },
      ],
      optional: [
        { item: "Floor Lamp", qty: 1, priority: "low", search: "floor lamp dimmable" },
        { item: "Area Rug", qty: 1, priority: "low", search: "area rug plush 5x7" },
        { item: "Throw Blanket", qty: 2, priority: "low", search: "throw blanket" },
      ],
    },
    medium: {
      essential: [
        { item: "Sectional Sofa", qty: 1, priority: "high", search: "sectional sofa media room" },
        { item: "Media Console", qty: 1, priority: "high", search: "media console 72 inch" },
        { item: "Coffee Table", qty: 1, priority: "medium", search: "coffee table large" },
        { item: "Side Table", qty: 2, priority: "medium", search: "side table" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug plush 8x10" },
      ],
      optional: [
        { item: "Bean Bag Chair", qty: 2, priority: "low", search: "bean bag chair" },
        { item: "Floor Lamp", qty: 1, priority: "low", search: "floor lamp dimmable" },
        { item: "Media Storage", qty: 1, priority: "low", search: "media storage cabinet" },
        { item: "Throw Blanket", qty: 3, priority: "low", search: "throw blanket" },
        { item: "Blackout Curtains", qty: 1, priority: "low", search: "blackout curtains" },
      ],
    },
    large: {
      essential: [
        { item: "Theater Seating", qty: 1, priority: "high", search: "home theater seating recliner row" },
        { item: "Media Console", qty: 1, priority: "high", search: "media console large" },
        { item: "Sectional Sofa", qty: 1, priority: "high", search: "sectional sofa large deep" },
        { item: "Coffee Table", qty: 1, priority: "medium", search: "coffee table large" },
        { item: "Side Table", qty: 3, priority: "medium", search: "side table" },
        { item: "Area Rug", qty: 1, priority: "medium", search: "area rug plush 9x12" },
      ],
      optional: [
        { item: "Bar", qty: 1, priority: "low", search: "home bar cabinet" },
        { item: "Bar Stools", qty: 3, priority: "low", search: "bar stool" },
        { item: "Mini Fridge Console", qty: 1, priority: "low", search: "mini fridge console" },
        { item: "Blackout Curtains", qty: 1, priority: "low", search: "blackout curtains large" },
        { item: "Acoustic Panels", qty: 4, priority: "low", search: "acoustic panel decorative" },
        { item: "Floor Lamp", qty: 2, priority: "low", search: "floor lamp dimmable" },
      ],
    },
  },

  "outdoor": {
    small: {
      essential: [
        { item: "Bistro Table", qty: 1, priority: "high", search: "outdoor bistro table" },
        { item: "Outdoor Chair", qty: 2, priority: "high", search: "outdoor dining chair" },
        { item: "Planter", qty: 2, priority: "medium", search: "outdoor planter large" },
      ],
      optional: [
        { item: "Outdoor Rug", qty: 1, priority: "low", search: "outdoor rug 4x6" },
        { item: "String Lights", qty: 1, priority: "low", search: "outdoor string lights" },
        { item: "Side Table", qty: 1, priority: "low", search: "outdoor side table" },
      ],
    },
    medium: {
      essential: [
        { item: "Outdoor Sofa", qty: 1, priority: "high", search: "outdoor sofa" },
        { item: "Outdoor Coffee Table", qty: 1, priority: "high", search: "outdoor coffee table" },
        { item: "Outdoor Dining Table", qty: 1, priority: "high", search: "outdoor dining table 60 inch" },
        { item: "Outdoor Dining Chair", qty: 4, priority: "high", search: "outdoor dining chair" },
        { item: "Umbrella", qty: 1, priority: "medium", search: "patio umbrella 9 foot" },
        { item: "Outdoor Rug", qty: 1, priority: "medium", search: "outdoor rug 8x10" },
      ],
      optional: [
        { item: "Outdoor Lounge Chair", qty: 2, priority: "low", search: "outdoor lounge chair" },
        { item: "Planter", qty: 4, priority: "low", search: "outdoor planter large" },
        { item: "String Lights", qty: 1, priority: "low", search: "outdoor string lights" },
        { item: "Fire Pit", qty: 1, priority: "low", search: "fire pit table" },
        { item: "Outdoor Side Table", qty: 2, priority: "low", search: "outdoor side table" },
      ],
    },
    large: {
      essential: [
        { item: "Outdoor Sectional", qty: 1, priority: "high", search: "outdoor sectional sofa" },
        { item: "Outdoor Coffee Table", qty: 1, priority: "high", search: "outdoor coffee table large" },
        { item: "Outdoor Dining Table", qty: 1, priority: "high", search: "outdoor dining table 84 inch" },
        { item: "Outdoor Dining Chair", qty: 8, priority: "high", search: "outdoor dining chair" },
        { item: "Umbrella", qty: 1, priority: "medium", search: "patio umbrella cantilever 11 foot" },
        { item: "Outdoor Rug", qty: 2, priority: "medium", search: "outdoor rug 9x12" },
        { item: "Outdoor Lounge Chair", qty: 2, priority: "medium", search: "outdoor chaise lounge" },
      ],
      optional: [
        { item: "Fire Pit Table", qty: 1, priority: "low", search: "fire pit table propane" },
        { item: "Outdoor Bar", qty: 1, priority: "low", search: "outdoor bar table" },
        { item: "Bar Stools", qty: 4, priority: "low", search: "outdoor bar stool" },
        { item: "Hammock", qty: 1, priority: "low", search: "hammock with stand" },
        { item: "Planter", qty: 6, priority: "low", search: "outdoor planter large" },
        { item: "String Lights", qty: 2, priority: "low", search: "outdoor string lights" },
        { item: "Daybed", qty: 1, priority: "low", search: "outdoor daybed canopy" },
      ],
    },
  },

  "kitchen": {
    small: {
      essential: [
        { item: "Bar Stool", qty: 2, priority: "high", search: "counter height bar stool" },
        { item: "Kitchen Cart", qty: 1, priority: "medium", search: "kitchen cart island" },
      ],
      optional: [
        { item: "Pendant Light", qty: 1, priority: "low", search: "pendant light kitchen" },
        { item: "Wall Shelf", qty: 2, priority: "low", search: "kitchen wall shelf" },
        { item: "Runner Rug", qty: 1, priority: "low", search: "kitchen runner rug" },
      ],
    },
    medium: {
      essential: [
        { item: "Bar Stool", qty: 3, priority: "high", search: "counter height bar stool" },
        { item: "Kitchen Island", qty: 1, priority: "high", search: "kitchen island" },
        { item: "Pendant Light", qty: 2, priority: "medium", search: "pendant light kitchen" },
        { item: "Runner Rug", qty: 1, priority: "medium", search: "kitchen runner rug" },
      ],
      optional: [
        { item: "Breakfast Nook Table", qty: 1, priority: "low", search: "breakfast nook table" },
        { item: "Breakfast Nook Bench", qty: 1, priority: "low", search: "breakfast nook bench" },
        { item: "Wall Shelf", qty: 2, priority: "low", search: "kitchen wall shelf" },
        { item: "Bakers Rack", qty: 1, priority: "low", search: "bakers rack" },
      ],
    },
    large: {
      essential: [
        { item: "Bar Stool", qty: 4, priority: "high", search: "counter height bar stool" },
        { item: "Kitchen Island", qty: 1, priority: "high", search: "kitchen island large" },
        { item: "Pendant Light", qty: 3, priority: "high", search: "pendant light kitchen" },
        { item: "Breakfast Table", qty: 1, priority: "medium", search: "kitchen breakfast table" },
        { item: "Breakfast Chair", qty: 4, priority: "medium", search: "kitchen dining chair" },
        { item: "Runner Rug", qty: 2, priority: "medium", search: "kitchen runner rug" },
      ],
      optional: [
        { item: "Pantry Cabinet", qty: 1, priority: "low", search: "kitchen pantry cabinet" },
        { item: "Wall Shelf", qty: 4, priority: "low", search: "kitchen wall shelf" },
        { item: "Wine Rack", qty: 1, priority: "low", search: "wine rack kitchen" },
        { item: "Bakers Rack", qty: 1, priority: "low", search: "bakers rack" },
        { item: "Step Stool", qty: 1, priority: "low", search: "kitchen step stool" },
      ],
    },
  },

  "bathroom": {
    small: {
      essential: [
        { item: "Vanity", qty: 1, priority: "high", search: "bathroom vanity 24 inch" },
        { item: "Mirror", qty: 1, priority: "high", search: "bathroom mirror" },
        { item: "Towel Bar", qty: 1, priority: "medium", search: "towel bar" },
      ],
      optional: [
        { item: "Bath Mat", qty: 1, priority: "low", search: "bath mat" },
        { item: "Wall Shelf", qty: 1, priority: "low", search: "bathroom wall shelf" },
        { item: "Waste Basket", qty: 1, priority: "low", search: "bathroom waste basket" },
      ],
    },
    medium: {
      essential: [
        { item: "Vanity", qty: 1, priority: "high", search: "bathroom vanity 36 inch" },
        { item: "Mirror", qty: 1, priority: "high", search: "bathroom mirror 36 inch" },
        { item: "Linen Tower", qty: 1, priority: "medium", search: "bathroom linen tower" },
        { item: "Towel Bar", qty: 1, priority: "medium", search: "towel bar set" },
        { item: "Bath Mat", qty: 1, priority: "medium", search: "bath mat" },
      ],
      optional: [
        { item: "Wall Sconce", qty: 2, priority: "low", search: "bathroom wall sconce" },
        { item: "Stool", qty: 1, priority: "low", search: "bathroom stool teak" },
        { item: "Tray", qty: 1, priority: "low", search: "bathroom vanity tray" },
        { item: "Waste Basket", qty: 1, priority: "low", search: "bathroom waste basket" },
      ],
    },
    large: {
      essential: [
        { item: "Double Vanity", qty: 1, priority: "high", search: "bathroom double vanity 60 inch" },
        { item: "Mirror", qty: 2, priority: "high", search: "bathroom mirror 30 inch" },
        { item: "Linen Cabinet", qty: 1, priority: "medium", search: "bathroom linen cabinet" },
        { item: "Towel Bar", qty: 2, priority: "medium", search: "towel bar" },
        { item: "Bath Mat", qty: 2, priority: "medium", search: "bath mat large" },
        { item: "Stool", qty: 1, priority: "medium", search: "bathroom stool" },
      ],
      optional: [
        { item: "Wall Sconce", qty: 4, priority: "low", search: "bathroom wall sconce" },
        { item: "Freestanding Tub", qty: 1, priority: "low", search: "freestanding bathtub" },
        { item: "Tub Caddy", qty: 1, priority: "low", search: "bathtub caddy tray" },
        { item: "Ladder Shelf", qty: 1, priority: "low", search: "bathroom ladder shelf" },
        { item: "Hamper", qty: 1, priority: "low", search: "laundry hamper bathroom" },
        { item: "Waste Basket", qty: 1, priority: "low", search: "bathroom waste basket" },
      ],
    },
  },
};

// ── Style DNA Profiles ──

const STYLE_DNA = {
  "modern": {
    materials: ["metal", "glass", "concrete", "leather", "chrome", "lacquer"],
    avoidMaterials: ["wicker", "rattan", "distressed wood"],
    colors: ["white", "black", "gray", "navy", "charcoal"],
    avoidColors: ["rustic brown", "country blue", "sage green"],
    keywords: ["clean lines", "minimal", "geometric", "sleek"],
    priceRange: { min: 500, max: 5000 },
  },
  "mid-century-modern": {
    materials: ["walnut", "teak", "brass", "leather", "molded plywood", "vinyl"],
    avoidMaterials: ["chrome", "mirrored", "marble", "wicker"],
    colors: ["mustard", "olive", "burnt orange", "teal", "walnut brown", "cream"],
    avoidColors: ["gray", "silver", "neon"],
    keywords: ["tapered legs", "organic curves", "retro", "atomic", "splayed legs"],
    priceRange: { min: 600, max: 6000 },
  },
  "coastal": {
    materials: ["rattan", "wicker", "linen", "driftwood", "jute", "cotton", "whitewashed wood"],
    avoidMaterials: ["dark metal", "black leather", "chrome", "lacquer"],
    colors: ["white", "sky blue", "sand", "seafoam", "coral", "navy"],
    avoidColors: ["black", "charcoal", "neon", "deep red"],
    keywords: ["airy", "relaxed", "natural texture", "beachy", "breezy"],
    priceRange: { min: 300, max: 4000 },
  },
  "traditional": {
    materials: ["mahogany", "cherry wood", "velvet", "silk", "marble", "brass", "damask"],
    avoidMaterials: ["concrete", "raw steel", "acrylic", "plywood"],
    colors: ["burgundy", "navy", "forest green", "gold", "cream", "rich brown"],
    avoidColors: ["neon", "hot pink", "electric blue"],
    keywords: ["ornate", "carved", "elegant", "classic", "tufted", "wingback"],
    priceRange: { min: 800, max: 8000 },
  },
  "minimalist": {
    materials: ["white oak", "concrete", "steel", "linen", "glass", "matte surfaces"],
    avoidMaterials: ["ornate wood", "velvet", "damask", "gilded", "wicker"],
    colors: ["white", "off-white", "light gray", "beige", "black"],
    avoidColors: ["bright red", "hot pink", "purple", "gold"],
    keywords: ["simple", "functional", "uncluttered", "clean", "essential"],
    priceRange: { min: 400, max: 4000 },
  },
  "bohemian": {
    materials: ["rattan", "macrame", "kilim", "cotton", "jute", "reclaimed wood", "clay"],
    avoidMaterials: ["chrome", "lacquer", "glass", "polished metal"],
    colors: ["terracotta", "mustard", "deep purple", "turquoise", "rust", "magenta", "ochre"],
    avoidColors: ["cold gray", "pure white", "silver"],
    keywords: ["eclectic", "layered", "textured", "handcrafted", "global", "collected"],
    priceRange: { min: 200, max: 3000 },
  },
  "industrial": {
    materials: ["raw steel", "reclaimed wood", "iron", "concrete", "brick", "leather", "pipe"],
    avoidMaterials: ["velvet", "silk", "wicker", "rattan", "lacquer"],
    colors: ["black", "charcoal", "rust", "brown", "dark gray", "aged bronze"],
    avoidColors: ["pastel pink", "baby blue", "lavender", "mint"],
    keywords: ["raw", "exposed", "utilitarian", "warehouse", "riveted", "distressed"],
    priceRange: { min: 400, max: 5000 },
  },
  "transitional": {
    materials: ["wood", "fabric", "metal", "stone", "leather", "linen"],
    avoidMaterials: ["raw concrete", "acrylic", "neon", "wicker"],
    colors: ["neutral", "gray", "navy", "cream", "soft blue", "warm taupe"],
    avoidColors: ["neon", "hot pink", "electric blue"],
    keywords: ["balanced", "timeless", "comfortable", "refined", "versatile"],
    priceRange: { min: 500, max: 5000 },
  },
  "japandi": {
    materials: ["light oak", "ash", "linen", "ceramic", "bamboo", "paper", "stone"],
    avoidMaterials: ["chrome", "velvet", "heavy ornate wood", "gilded", "plastic"],
    colors: ["warm white", "light wood", "charcoal", "sage", "muted earth tones", "black"],
    avoidColors: ["bright red", "hot pink", "royal blue", "gold"],
    keywords: ["wabi-sabi", "handcrafted", "organic", "functional", "serene", "understated"],
    priceRange: { min: 500, max: 5000 },
  },
  "art-deco": {
    materials: ["marble", "brass", "velvet", "lacquer", "mirrored glass", "exotic wood", "gold leaf"],
    avoidMaterials: ["raw wood", "burlap", "rattan", "concrete"],
    colors: ["emerald green", "sapphire blue", "gold", "black", "ivory", "deep plum"],
    avoidColors: ["pastel", "beige", "rustic brown"],
    keywords: ["glamorous", "geometric", "luxurious", "bold", "symmetrical", "opulent"],
    priceRange: { min: 800, max: 10000 },
  },
  "scandinavian": {
    materials: ["birch", "pine", "ash", "wool", "cotton", "sheepskin", "ceramic"],
    avoidMaterials: ["chrome", "marble", "velvet", "gilded", "exotic wood"],
    colors: ["white", "light gray", "pale blue", "blush", "warm wood tones", "soft green"],
    avoidColors: ["black", "deep red", "gold", "neon"],
    keywords: ["hygge", "cozy", "light", "functional", "natural", "simple"],
    priceRange: { min: 300, max: 4000 },
  },
  "farmhouse": {
    materials: ["reclaimed wood", "shiplap", "cotton", "linen", "wrought iron", "galvanized metal", "mason jar"],
    avoidMaterials: ["chrome", "glass", "lacquer", "acrylic", "velvet"],
    colors: ["white", "cream", "sage green", "dusty blue", "warm gray", "barn red"],
    avoidColors: ["black", "neon", "gold", "deep purple"],
    keywords: ["rustic", "cozy", "country", "weathered", "vintage", "homey", "apron sink"],
    priceRange: { min: 200, max: 3500 },
  },
};

// ── Exported Functions ──

export function getRoomTemplate(roomType, size) {
  const room = ROOM_TEMPLATES[roomType];
  if (!room) return null;
  const template = room[size];
  if (!template) return null;
  return { roomType, size, ...template };
}

export function getAllRoomTemplates() {
  return ROOM_TEMPLATES;
}

export function getStyleDNA(styleName) {
  return STYLE_DNA[styleName] || null;
}

export function checkStyleCoherence(products, styleName) {
  const style = STYLE_DNA[styleName];
  if (!style) {
    return { score: 0, issues: [`Unknown style: ${styleName}`], materialConflicts: [], colorConflicts: [], suggestions: [] };
  }

  const issues = [];
  const materialConflicts = [];
  const colorConflicts = [];
  const suggestions = [];

  let totalChecks = 0;
  let passedChecks = 0;

  for (const product of products) {
    const pName = (product.product_name || product.name || "").toLowerCase();
    const pDesc = (product.description || "").toLowerCase();
    const pMaterial = (product.material || "").toLowerCase();
    const pColor = (product.color || "").toLowerCase();
    const combined = `${pName} ${pDesc} ${pMaterial} ${pColor}`;

    // Check materials
    for (const avoid of style.avoidMaterials) {
      totalChecks++;
      if (combined.includes(avoid.toLowerCase())) {
        materialConflicts.push({
          product: product.product_name || product.name || product.id,
          material: avoid,
          reason: `"${avoid}" conflicts with ${styleName} style`,
        });
        issues.push(`${product.product_name || product.name}: material "${avoid}" conflicts with ${styleName} style`);
      } else {
        passedChecks++;
      }
    }

    // Check colors
    for (const avoid of style.avoidColors) {
      totalChecks++;
      if (combined.includes(avoid.toLowerCase())) {
        colorConflicts.push({
          product: product.product_name || product.name || product.id,
          color: avoid,
          reason: `"${avoid}" conflicts with ${styleName} color palette`,
        });
        issues.push(`${product.product_name || product.name}: color "${avoid}" conflicts with ${styleName} palette`);
      } else {
        passedChecks++;
      }
    }

    // Check positive style keywords match
    let hasStyleMatch = false;
    for (const keyword of style.keywords) {
      if (combined.includes(keyword.toLowerCase())) {
        hasStyleMatch = true;
        break;
      }
    }
    for (const mat of style.materials) {
      if (combined.includes(mat.toLowerCase())) {
        hasStyleMatch = true;
        break;
      }
    }
    totalChecks++;
    if (hasStyleMatch) {
      passedChecks++;
    } else {
      suggestions.push(`Consider swapping "${product.product_name || product.name}" for a ${styleName}-style alternative with ${style.materials.slice(0, 3).join(", ")} materials`);
    }

    // Price range check
    const price = product.retail_price || product.price || 0;
    if (price > 0) {
      totalChecks++;
      if (price >= style.priceRange.min && price <= style.priceRange.max) {
        passedChecks++;
      } else if (price < style.priceRange.min) {
        suggestions.push(`"${product.product_name || product.name}" at $${price} is below typical ${styleName} range ($${style.priceRange.min}-$${style.priceRange.max})`);
      } else {
        suggestions.push(`"${product.product_name || product.name}" at $${price} is above typical ${styleName} range ($${style.priceRange.min}-$${style.priceRange.max})`);
      }
    }
  }

  const score = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

  return {
    score,
    style: styleName,
    products_checked: products.length,
    issues,
    materialConflicts,
    colorConflicts,
    suggestions,
  };
}

export function generateSourcingQueries(roomTemplate, style, budget) {
  const styleDNA = STYLE_DNA[style];
  const allItems = [...(roomTemplate.essential || []), ...(roomTemplate.optional || [])];
  const budgetModifier = getBudgetModifier(budget, allItems.length);

  return allItems.map((item) => {
    let query = item.search;

    // Incorporate style
    if (styleDNA) {
      const styleKeyword = styleDNA.keywords[0] || style;
      const styleMaterial = styleDNA.materials[0] || "";
      query = `${style} ${query}`;
      if (styleMaterial && !query.toLowerCase().includes(styleMaterial.toLowerCase())) {
        query += ` ${styleMaterial}`;
      }
    }

    // Incorporate budget tier
    if (budgetModifier === "luxury") {
      query += " premium designer";
    } else if (budgetModifier === "budget") {
      query += " affordable";
    }

    return {
      item: item.item,
      qty: item.qty,
      priority: item.priority,
      search_query: query.trim(),
      estimated_budget_per_unit: budgetModifier === "luxury"
        ? (styleDNA?.priceRange.max || 5000)
        : budgetModifier === "budget"
          ? (styleDNA?.priceRange.min || 300)
          : Math.round(((styleDNA?.priceRange.min || 300) + (styleDNA?.priceRange.max || 5000)) / 2),
    };
  });
}

export function estimateLeadTime(products) {
  const risks = [];
  const criticalPath = [];
  let maxWeeks = 0;

  for (const product of products) {
    const name = product.product_name || product.name || "Unknown";
    let weeks = 2; // default

    // Estimate based on product type/category
    const cat = (product.category || product.product_type || "").toLowerCase();
    const desc = (product.description || "").toLowerCase();

    if (cat.includes("sofa") || cat.includes("sectional") || desc.includes("upholster")) {
      weeks = 10;
    } else if (cat.includes("bed") || cat.includes("mattress")) {
      weeks = 6;
    } else if (cat.includes("dining table") || cat.includes("desk") || cat.includes("cabinet")) {
      weeks = 8;
    } else if (cat.includes("chair")) {
      weeks = 6;
    } else if (cat.includes("rug") || cat.includes("area rug")) {
      weeks = 4;
    } else if (cat.includes("lamp") || cat.includes("light")) {
      weeks = 3;
    } else if (cat.includes("mirror") || cat.includes("art")) {
      weeks = 2;
    } else if (cat.includes("outdoor")) {
      weeks = 8;
    } else {
      weeks = 4;
    }

    // Custom/made-to-order flag
    if (desc.includes("custom") || desc.includes("made to order") || desc.includes("bespoke")) {
      weeks += 6;
      risks.push({ product: name, risk: "Custom/made-to-order item — lead time may vary significantly", weeks });
    }

    // Import risk
    if (desc.includes("import") || desc.includes("overseas") || desc.includes("ships from")) {
      weeks += 4;
      risks.push({ product: name, risk: "Imported item — subject to shipping delays and customs", weeks });
    }

    // Backorder
    if (product.in_stock === false || desc.includes("backorder") || desc.includes("pre-order")) {
      weeks += 4;
      risks.push({ product: name, risk: "Item may be backordered", weeks });
    }

    criticalPath.push({ product: name, weeks, priority: product.priority || "medium" });

    if (weeks > maxWeeks) {
      maxWeeks = weeks;
    }
  }

  // Sort critical path by weeks descending
  criticalPath.sort((a, b) => b.weeks - a.weeks);

  return {
    totalWeeks: maxWeeks,
    criticalPath: criticalPath.slice(0, 10),
    risks,
    summary: `Estimated ${maxWeeks} weeks total. ${risks.length} risk(s) identified across ${products.length} item(s).`,
  };
}

export function suggestSwaps(product, budget, style) {
  const name = product.product_name || product.name || "";
  const cat = product.category || product.product_type || name;
  const styleDNA = STYLE_DNA[style];

  let query = cat;

  // Add style keywords
  if (styleDNA) {
    query = `${style} ${query}`;
  }

  // Budget constraint
  if (budget && budget > 0) {
    query += ` under $${budget}`;
  } else {
    // Default: look for something cheaper than current
    const currentPrice = product.retail_price || product.price || 0;
    if (currentPrice > 0) {
      query += ` under $${Math.round(currentPrice * 0.7)}`;
    }
  }

  query += " affordable alternative";

  return {
    original: name,
    search_query: query.trim(),
    budget_target: budget || (product.retail_price ? Math.round(product.retail_price * 0.7) : null),
    style,
  };
}

// ── Internal helpers ──

function getBudgetModifier(budget, itemCount) {
  if (!budget || budget <= 0 || !itemCount) return "mid";
  const perItem = budget / itemCount;
  if (perItem > 3000) return "luxury";
  if (perItem < 500) return "budget";
  return "mid";
}
