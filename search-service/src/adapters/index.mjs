import { priorityVendors } from "../config/vendors.mjs";
import { buildCrawlerAdapter, buildSeedAdapter } from "./helpers.mjs";

const adapterConfig = {
  hooker: {
    crawlTargets: [
      "https://www.hookerfurniture.com/products",
      "https://www.hookerfurniture.com/living-room",
      "https://www.hookerfurniture.com/seating",
      "https://www.hookerfurniture.com/accent-chairs",
    ],
    maxProducts: 14,
  },
  bernhardt: {
    crawlTargets: [
      "https://www.bernhardt.com/furniture",
      "https://www.bernhardt.com/furniture/seating",
      "https://www.bernhardt.com/shop/?Sub-Category=Swivel%20Chairs&$MultiView=Yes&orderBy=OutdoorPosition,Id",
      "https://www.bernhardt.com/shop/?Sub-Category=Chairs&$MultiView=Yes&orderBy=LivingPosition,Id",
    ],
    maxProducts: 14,
  },
  fourhands: {
    crawlTargets: [
      "https://fourhands.com/products",
      "https://fourhands.com/shop/seating",
      "https://fourhands.com/search?q=swivel%20chair",
      "https://fourhands.com/search?q=chair",
    ],
    maxProducts: 14,
  },
  universal: { crawlTargets: ["https://www.universalfurniture.com/products"] },
  "theodore-alexander": { crawlTargets: ["https://www.theodorealexander.com/products"] },
  caracole: { crawlTargets: ["https://www.caracole.com/products"] },
  century: { crawlTargets: ["https://www.centuryfurniture.com/products"] },
  baker: { crawlTargets: ["https://www.bakerfurniture.com/products"] },
  vanguard: { crawlTargets: ["https://www.vanguardfurniture.com/products"] },
  lexington: { crawlTargets: ["https://www.lexington.com/products"] },
  bassett: { crawlTargets: ["https://www.bassettfurniture.com/products"] },
  stickley: { crawlTargets: ["https://www.stickley.com/products"] },
};

const crawlerVendorIds = new Set(
  priorityVendors
    .filter((vendor) => vendor.discovery?.search_paths?.length > 0)
    .map((vendor) => vendor.id),
);

export const vendorAdapters = priorityVendors.map((vendor) => {
  const config = adapterConfig[vendor.id] || {};
  const baseOptions = {
    vendor,
    vendorName: vendor.name,
    vendorDomain: vendor.domain,
    crawlTargets: config.crawlTargets || [],
    label: `${vendor.name} adapter`,
    maxProducts: config.maxProducts || 12,
  };

  return crawlerVendorIds.has(vendor.id)
    ? buildCrawlerAdapter(vendor.id, baseOptions)
    : buildSeedAdapter(vendor.id, baseOptions);
});

export function getVendorAdapter(vendorId) {
  return vendorAdapters.find((adapter) => adapter.vendorId === vendorId) || null;
}
