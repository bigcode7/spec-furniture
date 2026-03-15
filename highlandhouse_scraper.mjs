import https from 'node:https';
import http from 'node:http';

const CATEGORIES = [
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=81', category: 'accent-chairs', name: 'Chairs' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=32', category: 'chests', name: 'Chests' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=72', category: 'console-tables', name: 'Consoles' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=34', category: 'desks', name: 'Desks' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=83', category: 'coffee-tables', name: 'Cocktail Tables' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=76', category: 'ottomans', name: 'Ottomans & Benches' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?Search=sectionals', category: 'sectionals', name: 'Sectionals' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=48', category: 'loveseats', name: 'Settees' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=55', category: 'side-tables', name: 'Side Tables' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=79', category: 'sofas', name: 'Sofas & Loveseats' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=82', category: 'nightstands', name: 'Nightstands' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=70', category: 'bars-bar-sets', name: 'Bar & Bar Carts' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=61', category: 'bar-stools', name: 'Bar & Counter Stools' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=73', category: 'dining-chairs', name: 'Dining Chairs' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=74', category: 'dining-tables', name: 'Dining Tables' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=84', category: 'dressers', name: 'Bedroom Storage' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=25', category: 'beds', name: 'Beds' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?TypeID=29', category: 'dressers', name: 'Dressers' },
  { url: 'https://www.highlandhousefurniture.com/Consumer/ShowItems.aspx?SubTypeID=82', category: 'nightstands', name: 'Bedside Tables' },
];

const BASE = 'https://www.highlandhousefurniture.com';
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
  // Pattern: ShowItemDetail.aspx?SKU=2613-88
  const pattern = /ShowItemDetail\.aspx\?SKU=([^'"&\s>]+)/gi;
  const products = new Map();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const sku = decodeURIComponent(m[1]);
    const path = `/Consumer/ShowItemDetail.aspx?SKU=${sku}`;
    if (!products.has(sku)) {
      products.set(sku, { path, sku });
    }
  }
  return products;
}

function extractDetail(html, sku) {
  const result = {};

  // Product name - from title or heading
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    result.name = titleMatch[1]
      .replace(/Highland\s*House\s*Furniture/i, '')
      .replace(/\|/g, '')
      .replace(/Consumer/i, '')
      .trim();
  }

  // Also try h1/h2
  if (!result.name || result.name.length < 3) {
    const hMatch = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
    if (hMatch) result.name = hMatch[1].trim();
  }

  // Collection
  const collMatch = html.match(/Collection[:\s]*([^<\n]{3,50})/i);
  if (collMatch) result.collection = collMatch[1].trim();

  // Description / Notes
  const notesMatch = html.match(/Notes[:\s<\/strong>]*([^<]{5,200})/i);
  if (notesMatch) result.description = notesMatch[1].trim();

  // Dimensions - in <span id="width">88 in</span> etc.
  const wSpan = html.match(/id="width"[^>]*>([\d.]+)\s*in/i);
  const dSpan = html.match(/id="depth"[^>]*>([\d.]+)\s*in/i);
  const hSpan = html.match(/id="height"[^>]*>([\d.]+)\s*in/i);
  if (wSpan) result.width = wSpan[1];
  if (dSpan) result.depth = dSpan[1];
  if (hSpan) result.height = hSpan[1];

  // Fallback: W: ... D: ... H: ... with possible tags in between
  if (!result.width) {
    const dimMatch = html.match(/W[:\s]*(?:<[^>]*>)?\s*([\d.]+)\s*in/i);
    if (dimMatch) result.width = dimMatch[1];
  }
  if (!result.depth) {
    const dimMatch = html.match(/D[:\s]*(?:<[^>]*>)?\s*([\d.]+)\s*in/i);
    if (dimMatch) result.depth = dimMatch[1];
  }
  if (!result.height) {
    const dimMatch = html.match(/H[:\s]*(?:<[^>]*>)?\s*([\d.]+)\s*in/i);
    if (dimMatch) result.height = dimMatch[1];
  }

  // Seat height
  const seatH = html.match(/Seat\s*Height[:\s]*([\d.]+)/i);
  if (seatH) result.seat_height = seatH[1];

  // Arm height
  const armH = html.match(/Arm\s*Height[:\s]*([\d.]+)/i);
  if (armH) result.arm_height = armH[1];

  // Materials
  const materials = [];
  const matMatch = html.match(/Material[:\s<\/strong>]*([^<\n]{3,60})/i);
  if (matMatch) materials.push(matMatch[1].trim());

  const backType = html.match(/Back\s*Type[:\s<\/strong>]*([^<\n]{3,30})/i);
  if (backType) materials.push('Back: ' + backType[1].trim());

  const seatType = html.match(/Seat\s*Type[:\s<\/strong>]*([^<\n]{3,30})/i);
  if (seatType) materials.push('Seat: ' + seatType[1].trim());

  const seatFill = html.match(/Seat\s*Fill[:\s<\/strong>]*([^<\n]{3,30})/i);
  if (seatFill) materials.push('Fill: ' + seatFill[1].trim());

  const finishMatch = html.match(/Finish[:\s<\/strong>]*([^<\n]{3,60})/i);
  if (finishMatch) materials.push('Finish: ' + finishMatch[1].trim());

  const comMatch = html.match(/COM[:\s]*([\d.]+)\s*(?:yds|yards)/i);
  if (comMatch) materials.push(`COM: ${comMatch[1]} yds`);

  if (materials.length) result.material = materials.join('; ');

  // Hero image - single quotes: src='/ProductCatalog/prod-images/SKU_silo.jpg'
  const imgMatch = html.match(/src=['"]([^'"]*\/prod-images\/[^'"]+\.jpg)['"]/i);
  if (imgMatch) {
    result.image_url = imgMatch[1].startsWith('http') ? imgMatch[1] : BASE + imgMatch[1];
  }

  return result;
}

function inferCategory(sku, name, assignedCategory) {
  const text = `${name || ''} ${sku}`.toLowerCase();
  if (/sectional/.test(text)) return 'sectionals';
  if (/sofa/.test(text)) return 'sofas';
  if (/loveseat/.test(text)) return 'loveseats';
  if (/settee|banquette/.test(text)) return 'loveseats';
  if (/swivel/.test(text)) return 'swivel-chairs';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/chaise/.test(text)) return 'chaises';
  if (/recliner/.test(text)) return 'recliners';
  if (/stool/.test(text)) return 'bar-stools';
  if (/bed/.test(text)) return 'beds';
  if (/nightstand|bedside/.test(text)) return 'nightstands';
  if (/dresser/.test(text)) return 'dressers';
  if (/chest/.test(text)) return 'chests';
  if (/desk/.test(text)) return 'desks';
  if (/console|credenza/.test(text)) return 'console-tables';
  if (/cocktail|coffee/.test(text)) return 'coffee-tables';
  if (/side\s*table|end\s*table|accent\s*table/.test(text)) return 'side-tables';
  if (/dining\s*table/.test(text)) return 'dining-tables';
  if (/dining\s*chair|host/.test(text)) return 'dining-chairs';
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
  console.log('=== Highland House Furniture Scraper ===\n');

  // Step 1: Collect all product links from category pages
  const allProducts = new Map(); // sku -> { path, sku, category }

  for (const cat of CATEGORIES) {
    const res = await fetchWithRetry(cat.url);
    if (res.status !== 200) {
      console.log(`  [SKIP] ${cat.name}: HTTP ${res.status}`);
      continue;
    }

    const links = extractProductLinks(res.body);
    let newCount = 0;
    for (const [sku, prod] of links) {
      if (!allProducts.has(sku)) {
        allProducts.set(sku, { ...prod, category: cat.category });
        newCount++;
      }
    }
    console.log(`  ${cat.name}: ${links.size} products, +${newCount} new | total: ${allProducts.size}`);
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

        const detail = extractDetail(res.body, prod.sku);
        const name = detail.name || prod.sku;
        const category = inferCategory(prod.sku, name, prod.category);

        if (!detail.image_url) noImageCount++;

        return {
          id: `highlandhouse-${prod.sku}`,
          product_name: `Highland House ${name}`,
          vendor_name: 'Highland House',
          vendor_id: 'highland-house',
          sku: prod.sku,
          category,
          collection: detail.collection || '',
          description: detail.description || '',
          material: detail.material || '',
          image_url: detail.image_url || '',
          product_url: BASE + prod.path,
          dimensions: detail.width && detail.depth && detail.height
            ? `${detail.width}"W x ${detail.depth}"D x ${detail.height}"H` : '',
          width: detail.width ? parseFloat(detail.width) : null,
          depth: detail.depth ? parseFloat(detail.depth) : null,
          height: detail.height ? parseFloat(detail.height) : null,
          price: null,
          in_stock: true,
          source: 'highlandhouse-scraper',
          tags: [
            detail.seat_height ? `seat-height-${detail.seat_height}` : null,
            detail.arm_height ? `arm-height-${detail.arm_height}` : null,
            'upholstery',
            'custom-upholstery',
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
=== HIGHLAND HOUSE SCRAPER SUMMARY ===
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
