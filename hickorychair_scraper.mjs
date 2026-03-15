import https from 'node:https';
import http from 'node:http';

const CATEGORIES = [
  // SEATING
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=79&SearchName=Sofas+%26+Loveseats', category: 'sofas' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=48&SearchName=Settees+%26+Banquettes', category: 'loveseats' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=14&SearchName=Sectionals', category: 'sectionals' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=81&SearchName=Chairs+%26+Chaises', category: 'accent-chairs' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=76&SearchName=Ottomans+%26+Benches', category: 'ottomans' },
  // TABLES
  { url: 'https://www.hickorychair.com/Products/ShowResults?SubTypeID=42&SearchName=Cocktail+Tables', category: 'coffee-tables' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?SubTypeID=78&SearchName=Side+Tables', category: 'side-tables' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?SubTypeID=942,79&SearchName=Center+Tables+%26+Game+tables', category: 'side-tables' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=70&SearchName=Bar+%26+Bar+Carts', category: 'bars-bar-sets' },
  // STORAGE AND ACCENTS
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=34,72&SearchName=Desks+%26+Consoles', category: 'desks' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?SubTypeID=92,57&SearchName=Bookcases+%26+Display+Cabinets', category: 'bookcases' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?SubTypeID=17,1507,130&SearchName=Mirrors%2c+Trays+%26+Accents', category: 'decorative-objects' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=132&SearchName=Lighting', category: 'table-lamps' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=32&SearchName=Chests', category: 'chests' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?SubTypeID=61&SearchName=Consoles+%26+Credenzas', category: 'console-tables' },
  // DINING
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=74&SearchName=Dining+Tables', category: 'dining-tables' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?SubTypeID=942&SearchName=Center+Tables', category: 'side-tables' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=73&SearchName=Dining+Chairs', category: 'dining-chairs' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=61&SearchName=Bar+%26+Counter+Stools', category: 'bar-stools' },
  // BEDROOM
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=25&SearchName=Beds', category: 'beds' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?TypeID=29&SearchName=Dressers', category: 'dressers' },
  { url: 'https://www.hickorychair.com/Products/ShowResults?SubTypeID=82&SearchName=Nightstand+%26+Bedside+Tables', category: 'nightstands' },
  // OUTDOOR
  { url: 'https://www.hickorychair.com/products/showresults?CollectionID=G3&SearchName=Hable+Outdoor+', category: 'outdoor' },
];

const BASE = 'https://www.hickorychair.com';
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
  // Pattern: /Products/ProductDetails/HC5311-00 or /Products/ProductDetails/PE2378-10
  const pattern = /href="(\/Products\/ProductDetails\/([^"]+))"/gi;
  const products = new Map();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1];
    const sku = decodeURIComponent(m[2]);
    if (!products.has(sku)) {
      products.set(sku, { path, sku });
    }
  }
  return products;
}

function extractDetail(html, sku) {
  const result = {};

  // Product name
  const nameMatch = html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i)
    || html.match(/<title>([^<|]+)/i);
  if (nameMatch) result.name = nameMatch[1].trim();

  // Collection
  const collMatch = html.match(/(\w[\w\s&']+)\s+(?:Upholstery\s+)?Collection/i);
  if (collMatch) result.collection = collMatch[1].trim();

  // Description
  const descMatch = html.match(/(?:<p[^>]*>|"|&quot;)((?:This|Named|A |An |The |Inspired|Featuring|With its|Our )[^<"]{10,300})/i);
  if (descMatch) result.description = descMatch[1].replace(/&quot;/g, '"').replace(/&#?\w+;/g, '').trim();

  // Dimensions - multiple formats
  // "W 90in D 38in H 35.5in" or "Overall Width: 90 in"
  const wMatch = html.match(/(?:Overall\s+)?Width[:\s]*([\d.]+)\s*in/i)
    || html.match(/W\s*([\d.]+)\s*in/i);
  const dMatch = html.match(/(?:Overall\s+)?Depth[:\s]*([\d.]+)\s*in/i)
    || html.match(/D\s*([\d.]+)\s*in/i);
  const hMatch = html.match(/(?:Overall\s+)?Height[:\s]*([\d.]+)\s*in/i)
    || html.match(/H\s*([\d.]+)\s*in/i);

  if (wMatch) result.width = wMatch[1];
  if (dMatch) result.depth = dMatch[1];
  if (hMatch) result.height = hMatch[1];

  // Seat height
  const seatH = html.match(/Seat\s*Height[:\s]*([\d.]+)\s*in/i);
  if (seatH) result.seat_height = seatH[1];

  // Arm height
  const armH = html.match(/Arm\s*Height[:\s]*([\d.]+)\s*in/i);
  if (armH) result.arm_height = armH[1];

  // Weight
  const weightMatch = html.match(/Weight[:\s]*([\d.]+)\s*(?:lb|lbs)/i);
  if (weightMatch) result.weight = weightMatch[1] + ' lbs';

  // Materials
  const materials = [];
  const woodMatch = html.match(/Wood\s*(?:Species)?[:\s]*([^<\n,]{3,60})/i);
  if (woodMatch) materials.push('Wood: ' + woodMatch[1].trim());

  const seatFill = html.match(/Seat\s*Fill[:\s]*([^<\n]{3,40})/i);
  if (seatFill) materials.push('Seat: ' + seatFill[1].trim());

  const backFill = html.match(/Back\s*Fill[:\s]*([^<\n]{3,40})/i);
  if (backFill) materials.push('Back: ' + backFill[1].trim());

  const finishMatch = html.match(/Finish[:\s]*([^<\n]{3,60})/i);
  if (finishMatch && !finishMatch[1].match(/options|available|custom/i)) {
    materials.push('Finish: ' + finishMatch[1].trim());
  }

  const comMatch = html.match(/COM[:\s]*([\d.]+)\s*(?:yds|yards)/i);
  if (comMatch) materials.push(`COM: ${comMatch[1]} yds`);

  const leatherMatch = html.match(/Leather[:\s]*([\d.]+)\s*sq/i);
  if (leatherMatch) materials.push(`Leather: ${leatherMatch[1]} sq ft`);

  if (materials.length) result.material = materials.join('; ');

  // Hero image - /prod-images/SKU_DIGITS.jpg or _medium.jpg (single or double quotes)
  const imgMatch = html.match(/src=['"]([^'"]*\/prod-images\/[^'"]+\.jpg)['"]/i);
  if (imgMatch) {
    // Use full-size image (remove _medium suffix if present)
    result.image_url = BASE + imgMatch[1].replace(/_medium\.jpg$/i, '.jpg');
  }

  return result;
}

function inferCategory(sku, name, assignedCategory) {
  const text = `${name || ''} ${sku}`.toLowerCase();
  if (/sofa/.test(text)) return 'sofas';
  if (/loveseat/.test(text)) return 'loveseats';
  if (/settee|banquette/.test(text)) return 'loveseats';
  if (/sectional/.test(text)) return 'sectionals';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/chaise/.test(text)) return 'chaises';
  if (/swivel/.test(text)) return 'swivel-chairs';
  if (/recliner/.test(text)) return 'recliners';
  if (/bed/.test(text)) return 'beds';
  if (/nightstand/.test(text)) return 'nightstands';
  if (/dresser/.test(text)) return 'dressers';
  if (/dining\s*(?:chair|arm|side)/.test(text)) return 'dining-chairs';
  if (/stool/.test(text)) return 'bar-stools';
  if (/mirror/.test(text)) return 'mirrors';
  if (/lamp|sconce|chandelier|pendant/.test(text)) return 'table-lamps';
  if (/desk/.test(text)) return 'desks';
  if (/console/.test(text)) return 'console-tables';
  if (/bookcase|etagere|cabinet/.test(text)) return 'bookcases';
  if (/chest/.test(text)) return 'chests';
  if (/cocktail|coffee/.test(text)) return 'coffee-tables';
  if (/side\s*table|end\s*table/.test(text)) return 'side-tables';
  if (/dining\s*table/.test(text)) return 'dining-tables';
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
  console.log('=== Hickory Chair Scraper ===\n');

  // Step 1: Collect all product links from category pages
  const allProducts = new Map(); // sku -> { path, sku, category }

  for (const cat of CATEGORIES) {
    const catName = decodeURIComponent(cat.url.split('SearchName=')[1] || '').replace(/\+/g, ' ');
    const res = await fetchWithRetry(cat.url);
    if (res.status !== 200) {
      console.log(`  [SKIP] ${catName}: HTTP ${res.status}`);
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

        const detail = extractDetail(res.body, prod.sku);
        const name = detail.name || prod.sku;
        const category = inferCategory(prod.sku, name, prod.category);

        if (!detail.image_url) noImageCount++;

        return {
          id: `hickorychair-${prod.sku}`,
          product_name: `Hickory Chair ${name}`,
          vendor_name: 'Hickory Chair',
          vendor_id: 'hickory-chair',
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
          source: 'hickorychair-scraper',
          tags: [
            detail.seat_height ? `seat-height-${detail.seat_height}` : null,
            detail.arm_height ? `arm-height-${detail.arm_height}` : null,
            detail.weight || null,
            'luxury',
            'trade',
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
  const withCollection = detailedProducts.filter(p => p.collection).length;

  const byCat = {};
  for (const p of detailedProducts) {
    byCat[p.category] = (byCat[p.category] || 0) + 1;
  }

  console.log(`
============================================================
=== HICKORY CHAIR SCRAPER SUMMARY ===
============================================================
Total unique products: ${detailedProducts.length}
Detail pages OK:       ${okCount}
Errors:                ${errCount}
Posted:                ${detailedProducts.length}
With image:            ${withImage} (${Math.round(100 * withImage / detailedProducts.length)}%)
With dimensions:       ${withDims} (${Math.round(100 * withDims / detailedProducts.length)}%)
With material:         ${withMaterial} (${Math.round(100 * withMaterial / detailedProducts.length)}%)
With collection:       ${withCollection} (${Math.round(100 * withCollection / detailedProducts.length)}%)

By category:
${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
============================================================`);
}

main().catch(e => console.error(e));
