const url = "https://gabby.com/products/grand-ottoman";
const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
const html = await r.text();

// JSON-LD
const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
if (jsonLd) {
  for (const block of jsonLd) {
    try {
      const content = block.replace(/<[^>]+>/g, '');
      const ld = JSON.parse(content);
      if (ld.image) console.log("JSON-LD image:", JSON.stringify(ld.image).substring(0, 200));
    } catch {}
  }
}

// All shopify CDN URLs in the page
const cdnMatches = html.match(/https:\/\/cdn\.shopify\.com\/s\/files\/1\/0625[^"'\s\)]+/g);
if (cdnMatches) {
  const unique = [...new Set(cdnMatches)].filter(u => u.match(/\.(jpg|png|webp)/i));
  console.log("\nShopify CDN image URLs found:", unique.length);
  for (const u of unique.slice(0, 5)) {
    console.log("  ", u.substring(0, 120));
  }
} else {
  console.log("No Shopify CDN image URLs found");
}

// Check for preload image links
const preload = html.match(/<link[^>]+rel="preload"[^>]+href="([^"]*shopify[^"]+)"/g);
if (preload) {
  console.log("\nPreloaded images:");
  for (const p of preload) console.log("  ", p.substring(0, 120));
}
