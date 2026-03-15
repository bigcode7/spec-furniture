import https from 'node:https';
import http from 'node:http';

const LIST_URL = 'https://www.sherrillfurniture.com/search-results?items_per_page=All&';
const BASE = 'https://www.sherrillfurniture.com';
const SEARCH_SERVICE = 'http://localhost:4310';
const CONCURRENCY = 5;
const DELAY_MS = 150;

function httpFetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http') ? res.headers.location : BASE + res.headers.location;
        return httpFetch(loc).then(resolve, reject);
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function extractProductLinks(html) {
  // Pattern: /catalog/MODEL-NUMBER with optional ?items_per_page
  const pattern = /href="(\/catalog\/([^"?]+))(?:\?[^"]*)?" /gi;
  const products = new Map();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1];
    const slug = m[2];
    if (!products.has(slug)) {
      products.set(slug, { path, slug });
    }
  }

  // Also try without trailing space
  const pattern2 = /href="(\/catalog\/([^"?]+))(?:\?[^"]*)?"/gi;
  while ((m = pattern2.exec(html)) !== null) {
    const path = m[1];
    const slug = m[2];
    // Skip paths that are clearly not product pages
    if (slug.includes('.') || slug === 'search-results') continue;
    if (!products.has(slug)) {
      products.set(slug, { path, slug });
    }
  }

  return products;
}

function extractDetail(html, slug) {
  const result = {};

  // Product name - from title or heading
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    result.title = titleMatch[1].replace(/\s*\|\s*Sherrill Furniture.*$/i, '').trim();
  }

  // Model number from the page
  const modelMatch = html.match(/<strong>(\d+[A-Za-z0-9-]+)<\/strong>/);
  if (modelMatch) result.model = modelMatch[1];

  // Description - loose pillow back, tight back, etc.
  const descPatterns = [
    /(?:Loose\s+Pillow\s+Back|Tight\s+Back|Button\s+Tufted|Nail\s+Head|Channel\s+Back|Skirted|Carved)[^<]{0,100}/gi,
    /standard\s+with[^<]{3,80}/i,
  ];
  const descParts = [];
  for (const pat of descPatterns) {
    const dm = html.match(pat);
    if (dm) descParts.push(dm[0].trim());
  }
  if (descParts.length) result.description = descParts.join('. ');

  // Dimensions - "W72 D21 H35 in." or "H38 W37 D23 in." (order varies)
  const dimWDH = html.match(/W(\d+)\s+D(\d+)\s+H(\d+)\s*in/i);
  const dimHWD = html.match(/H(\d+)\s+W(\d+)\s+D(\d+)\s*in/i);
  if (dimWDH) {
    result.width = dimWDH[1];
    result.depth = dimWDH[2];
    result.height = dimWDH[3];
  } else if (dimHWD) {
    result.height = dimHWD[1];
    result.width = dimHWD[2];
    result.depth = dimHWD[3];
  }

  // Overall depth
  const overallD = html.match(/Overall\s+Depth[:\s]*(\d+)\s*in/i);
  if (overallD) result.overall_depth = overallD[1];

  // Seat height
  const seatH = html.match(/Seat\s+Height[:\s]*(\d+)\s*in/i);
  if (seatH) result.seat_height = seatH[1];

  // Arm height
  const armH = html.match(/Arm\s+Height[:\s]*(\d+)\s*in/i);
  if (armH) result.arm_height = armH[1];

  // Weight
  const weightMatch = html.match(/Weight[:\s]*(\d+)\s*(?:lbs?|pounds)/i);
  if (weightMatch) result.weight = weightMatch[1] + ' lbs';

  // Finish
  const finishMatch = html.match(/(?:Standard\s+)?Finish[:\s]*([^<\n]{2,50})/i);
  if (finishMatch) result.finish = finishMatch[1].trim();

  // Materials
  const materials = [];
  if (result.finish) materials.push('Finish: ' + result.finish);
  const fabricMatch = html.match(/(?:Fabric|Shown\s+in)[:\s]*([^<\n]{3,80})/i);
  if (fabricMatch) materials.push(fabricMatch[1].trim());
  const comMatch = html.match(/COM[:\s]*([\d.]+)\s*(?:yds|yards)/i);
  if (comMatch) materials.push(`COM: ${comMatch[1]} yds`);
  if (materials.length) result.material = materials.join('; ');

  // Hero image
  const imgMatch = html.match(/src="(https:\/\/www\.sherrillfurniture\.com\/sites\/[^"]+\.jpg)"/i)
    || html.match(/src="(\/sites\/[^"]+\.jpg)"/i);
  if (imgMatch) {
    result.image_url = imgMatch[1].startsWith('http') ? imgMatch[1] : BASE + imgMatch[1];
  }

  // Collection from breadcrumb or taxonomy
  const collMatch = html.match(/collection[:\s]*([^<\n]{3,50})/i);
  if (collMatch) result.collection = collMatch[1].trim();

  return result;
}

function inferCategory(slug, title) {
  const text = `${slug} ${title || ''}`.toLowerCase();
  if (/sectional/.test(text)) return 'sectionals';
  if (/sofa|sleeper/.test(text)) return 'sofas';
  if (/loveseat|settee/.test(text)) return 'loveseats';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/chaise/.test(text)) return 'chaises';
  if (/recliner|relaxor/.test(text)) return 'recliners';
  if (/swivel/.test(text)) return 'swivel-chairs';
  if (/bed|headboard|daybed/.test(text)) return 'beds';
  if (/dining|host/.test(text)) return 'dining-chairs';
  if (/stool|bar/.test(text)) return 'bar-stools';
  if (/desk/.test(text)) return 'desk-chairs';
  if (/chair/.test(text)) return 'accent-chairs';
  // Sherrill model number patterns
  if (/^[1-3]\d{3}/.test(slug)) return 'accent-chairs'; // 1000-3000 series are typically chairs
  if (/^[4-5]\d{3}/.test(slug)) return 'sofas'; // 4000-5000 series
  if (/^6\d{3}/.test(slug)) return 'sectionals'; // 6000 series
  if (/^[7-8]\d{3}/.test(slug)) return 'sofas'; // 7000-8000 series (leather)
  if (/^9\d{3}/.test(slug)) return 'accent-chairs'; // 9000 series (motion/specialty)
  return 'accent-chairs'; // default for upholstery specialist
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await httpFetch(url);
      if (res.status === 200) return res;
      if (res.status === 429 || res.status >= 500) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function postProducts(products) {
  const batches = [];
  for (let i = 0; i < products.length; i += 25) {
    batches.push(products.slice(i, i + 25));
  }

  let posted = 0;
  for (const batch of batches) {
    const data = JSON.stringify({ products: batch });
    await new Promise((resolve, reject) => {
      const req = http.request(`${SEARCH_SERVICE}/catalog/insert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      }, res => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
          if (res.statusCode !== 200) console.error(`  POST error ${res.statusCode}: ${body.slice(0, 200)}`);
          resolve();
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
    posted += batch.length;
    if (posted % 100 === 0 || posted === products.length) {
      console.log(`  Posted: ${posted}/${products.length}`);
    }
  }
}

async function main() {
  console.log('=== Sherrill Furniture Scraper ===\n');

  // Step 1: Get all product links from the listing page
  console.log('Fetching product listing page...');
  const listRes = await fetchWithRetry(LIST_URL);
  if (listRes.status !== 200) {
    console.error(`Failed to fetch listing page: HTTP ${listRes.status}`);
    return;
  }

  const products = extractProductLinks(listRes.body);
  console.log(`Found ${products.size} unique product links\n`);

  // Step 2: Fetch detail pages
  const productList = [...products.values()];
  let okCount = 0;
  let errCount = 0;
  let noImageCount = 0;
  const detailedProducts = [];

  console.log('Fetching detail pages...');

  for (let i = 0; i < productList.length; i += CONCURRENCY) {
    const batch = productList.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (prod) => {
      try {
        const url = BASE + prod.path;
        const res = await fetchWithRetry(url);
        if (res.status !== 200) {
          errCount++;
          return null;
        }
        okCount++;

        const detail = extractDetail(res.body, prod.slug);
        const model = detail.model || prod.slug;
        const name = detail.title || model;
        const category = inferCategory(prod.slug, detail.title);

        if (!detail.image_url) noImageCount++;

        return {
          id: `sherrill-${prod.slug}`,
          product_name: `Sherrill ${name}`,
          vendor_name: 'Sherrill Furniture',
          vendor_id: 'sherrill-furniture',
          sku: model,
          category,
          collection: detail.collection || '',
          description: detail.description || '',
          material: detail.material || '',
          image_url: detail.image_url || '',
          product_url: BASE + prod.path,
          dimensions: detail.width ? `${detail.width}"W x ${detail.depth}"D x ${detail.height}"H` : '',
          width: detail.width ? parseFloat(detail.width) : null,
          depth: detail.depth ? parseFloat(detail.depth) : null,
          height: detail.height ? parseFloat(detail.height) : null,
          price: null,
          in_stock: true,
          source: 'sherrill-scraper',
          tags: [
            detail.seat_height ? `seat-height-${detail.seat_height}` : null,
            detail.arm_height ? `arm-height-${detail.arm_height}` : null,
            detail.overall_depth ? `overall-depth-${detail.overall_depth}` : null,
            detail.weight || null,
            'upholstery',
            'custom-upholstery',
            'made-in-usa',
          ].filter(Boolean),
        };
      } catch (e) {
        errCount++;
        return null;
      }
    }));

    detailedProducts.push(...results.filter(Boolean));

    const done = Math.min(i + CONCURRENCY, productList.length);
    if (done % 100 === 0 || done === productList.length) {
      console.log(`  Progress: ${done}/${productList.length} (${okCount} OK, ${errCount} errors)`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDetail fetch: ${detailedProducts.length} products, ${errCount} errors, ${noImageCount} missing images\n`);

  // Step 3: Post to search service
  console.log(`Posting ${detailedProducts.length} products...`);
  await postProducts(detailedProducts);

  // Summary
  const withImage = detailedProducts.filter(p => p.image_url).length;
  const withDims = detailedProducts.filter(p => p.dimensions).length;
  const withMaterial = detailedProducts.filter(p => p.material).length;

  const byCat = {};
  for (const p of detailedProducts) {
    byCat[p.category] = (byCat[p.category] || 0) + 1;
  }

  console.log(`
============================================================
=== SHERRILL FURNITURE SCRAPER SUMMARY ===
============================================================
Total unique products: ${detailedProducts.length}
Detail pages OK:       ${okCount}
Errors:                ${errCount}
Posted:                ${detailedProducts.length}
With image:            ${withImage} (${Math.round(100 * withImage / detailedProducts.length)}%)
With dimensions:       ${withDims} (${Math.round(100 * withDims / detailedProducts.length)}%)
With material:         ${withMaterial} (${Math.round(100 * withMaterial / detailedProducts.length)}%)

By category:
${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
============================================================`);
}

main().catch(e => console.error(e));
