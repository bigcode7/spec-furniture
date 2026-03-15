import https from 'node:https';
import http from 'node:http';

const CATEGORIES = [
  { url: 'https://www.wesleyhall.com/styles/func/cat/SOF', category: 'sofas' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/SEC', category: 'sectionals' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/TBC', category: 'accent-chairs' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/CHR', category: 'accent-chairs' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/OTT', category: 'ottomans' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/BCH', category: 'benches' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/LSO', category: 'sofas' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/LSE', category: 'sectionals' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/TBL', category: 'side-tables' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/LCH', category: 'accent-chairs' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/LOT', category: 'ottomans' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/LBC', category: 'benches' },
  { url: 'https://www.wesleyhall.com/search?search=SWIVEL+GLIDER', category: 'swivel-chairs' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/BAR', category: 'bar-stools' },
  { url: 'https://www.wesleyhall.com/styles/func/cat/BED', category: 'beds' },
];

const BASE = 'https://www.wesleyhall.com';
const SEARCH_SERVICE = 'http://localhost:4310';
const CONCURRENCY = 5;
const DELAY_MS = 200;

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
  // Pattern: /styledetail/wh/id/710-56/rid/1/cat/SOF/wc/
  const pattern = /href=['"]?(\/styledetail\/wh\/id\/([^/]+)\/rid\/\d+\/cat\/[^/]*\/wc\/?)['">\s]/gi;
  const products = new Map();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1];
    const id = m[2];
    if (!products.has(id)) {
      products.set(id, { path, id });
    }
  }
  return products;
}

function extractDetail(html, productId) {
  const result = {};

  // Product name - look for the style number + name pattern
  // e.g., "710-56 Grantham Settee" or "414 Gordon Swivel Chair"
  const nameMatch = html.match(new RegExp(`${productId.replace(/[-]/g, '[-\\s]?')}\\s+([A-Z][A-Za-z\\s&']+)`, 'i'));
  if (nameMatch) result.name = nameMatch[1].trim();

  // Also try title tag
  if (!result.name) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) result.name = titleMatch[1].replace(/Wesley\s*Hall/i, '').replace(/\|/g, '').trim();
  }

  // Dimensions - "OUTSIDE:\nL 56" D 31" H 38"" (uses L for length/width, may be on next line)
  const outsideMatch = html.match(/L\s+([\d.]+)["″]?\s*D\s+([\d.]+)["″]?\s*H\s+([\d.]+)/i);
  if (outsideMatch) {
    result.width = outsideMatch[1];
    result.depth = outsideMatch[2];
    result.height = outsideMatch[3];
  }

  // Seat height and arm height - "SEAT:\nH 20" ARM H 24.5""
  const seatMatch = html.match(/SEAT[:\s<br\/>\n]*H\s*([\d.]+)/i);
  if (seatMatch) result.seat_height = seatMatch[1];

  const armMatch = html.match(/ARM\s*H\s*([\d.]+)/i);
  if (armMatch) result.arm_height = armMatch[1];

  // Materials - Wesley Hall is primarily upholstery
  const materials = [];
  const fabricMatch = html.match(/(?:Fabric|Shown\s+in)[:\s]*([^<\n]{3,80})/i);
  if (fabricMatch) materials.push(fabricMatch[1].trim());
  const finishMatch = html.match(/Finish[:\s]*([^<\n]{3,50})/i);
  if (finishMatch) materials.push('Finish: ' + finishMatch[1].trim());
  // Check if leather variant
  if (productId.startsWith('L') || /leather/i.test(html.slice(0, 5000))) {
    materials.push('Leather');
  }
  if (materials.length) result.material = materials.join('; ');

  // Image - thumbnail at /assets/images/products/thumbnail/{id}.jpg
  // Also check for zoom path reference
  const zoomMatch = html.match(/\/assets\/images\/products\/zooms\/([^"'\s,]+)/i);
  if (zoomMatch) {
    // Use thumbnail version for a direct image URL
    result.image_url = `${BASE}/assets/images/products/thumbnail/${zoomMatch[1]}.jpg`;
  } else {
    // Fallback to constructing from product ID
    result.image_url = `${BASE}/assets/images/products/thumbnail/${productId}.jpg`;
  }

  // Description - look for descriptive text
  const descMatch = html.match(/(?:description|details?)[:\s]*([^<]{10,200})/i);
  if (descMatch) result.description = descMatch[1].trim();

  return result;
}

function inferCategory(id, name, assignedCategory) {
  const text = `${name || ''} ${id}`.toLowerCase();
  if (/sectional/.test(text)) return 'sectionals';
  if (/sofa|sleeper/.test(text)) return 'sofas';
  if (/loveseat|settee/.test(text)) return 'loveseats';
  if (/swivel\s*glider/.test(text)) return 'swivel-chairs';
  if (/swivel/.test(text)) return 'swivel-chairs';
  if (/tub\s*chair/.test(text)) return 'accent-chairs';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/chaise/.test(text)) return 'chaises';
  if (/stool/.test(text)) return 'bar-stools';
  if (/bed/.test(text)) return 'beds';
  if (/table/.test(text)) return 'side-tables';
  if (/chair/.test(text)) return 'accent-chairs';
  return assignedCategory;
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
  console.log('=== Wesley Hall Scraper ===\n');

  // Step 1: Collect all product links from category pages
  const allProducts = new Map(); // id -> { path, id, category }

  for (const cat of CATEGORIES) {
    const catName = cat.url.includes('search?')
      ? 'Swivel Gliders (search)'
      : cat.url.split('/cat/')[1];
    const res = await fetchWithRetry(cat.url);
    if (res.status !== 200) {
      console.log(`  [SKIP] ${catName}: HTTP ${res.status}`);
      continue;
    }

    const links = extractProductLinks(res.body);
    let newCount = 0;
    for (const [id, prod] of links) {
      if (!allProducts.has(id)) {
        allProducts.set(id, { ...prod, category: cat.category });
        newCount++;
      }
    }
    console.log(`  ${catName}: ${links.size} products, +${newCount} new | total: ${allProducts.size}`);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n━━━ TOTAL UNIQUE PRODUCTS: ${allProducts.size} ━━━\n`);

  // Step 2: Fetch detail pages
  const productList = [...allProducts.values()];
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

        const detail = extractDetail(res.body, prod.id);
        const name = detail.name || prod.id;
        const category = inferCategory(prod.id, name, prod.category);

        if (!detail.image_url) noImageCount++;

        const isLeather = prod.id.startsWith('L') || (detail.material && /leather/i.test(detail.material));

        return {
          id: `wesleyhall-${prod.id}`,
          product_name: `Wesley Hall ${name} ${prod.id}`,
          vendor_name: 'Wesley Hall',
          vendor_id: 'wesley-hall',
          sku: prod.id,
          category,
          collection: '',
          description: [detail.description, isLeather ? 'Leather upholstery' : 'Fabric upholstery'].filter(Boolean).join('. '),
          material: detail.material || (isLeather ? 'Leather' : 'Fabric upholstery'),
          image_url: detail.image_url || '',
          product_url: BASE + prod.path,
          dimensions: detail.width ? `${detail.width}"L x ${detail.depth}"D x ${detail.height}"H` : '',
          width: detail.width ? parseFloat(detail.width) : null,
          depth: detail.depth ? parseFloat(detail.depth) : null,
          height: detail.height ? parseFloat(detail.height) : null,
          price: null,
          in_stock: true,
          source: 'wesleyhall-scraper',
          tags: [
            detail.seat_height ? `seat-height-${detail.seat_height}` : null,
            detail.arm_height ? `arm-height-${detail.arm_height}` : null,
            'upholstery',
            'custom-upholstery',
            isLeather ? 'leather' : null,
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
=== WESLEY HALL SCRAPER SUMMARY ===
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
