import https from 'node:https';
import http from 'node:http';

const CATEGORIES = [
  { url: 'https://www.crlaine.com/products/CRL/cat/4/category/Sofas', category: 'sofas' },
  { url: 'https://www.crlaine.com/products/CRL/cat/5/category/Loveseats_Settees', category: 'loveseats' },
  { url: 'https://www.crlaine.com/products/CRL/cat/6/category/Sectionals', category: 'sectionals' },
  { url: 'https://www.crlaine.com/products/CRL/cat/7/category/Chairs_Chaises', category: 'chairs' },
  { url: 'https://www.crlaine.com/products/CRL/cat/8/category/Swivels_Swivel%20Gliders', category: 'swivel-chairs' },
  { url: 'https://www.crlaine.com/products/CRL/cat/9/category/Recliners', category: 'recliners' },
  { url: 'https://www.crlaine.com/products/CRL/cat/10/category/Dining_Bar%20Stools', category: 'dining-chairs' },
  { url: 'https://www.crlaine.com/products/CRL/cat/11/category/Ottomans', category: 'ottomans' },
  { url: 'https://www.crlaine.com/products/CRL/cat/53/category/Matching%20Ottomans', category: 'ottomans' },
  { url: 'https://www.crlaine.com/products/CRL/cat/12/category/Beds_Daybeds', category: 'beds' },
  { url: 'https://www.crlaine.com/products/CRL/cat/13/category/Accents_Web%20Exclusives', category: 'accent-chairs' },
  { url: 'https://www.crlaine.com/products/CRL/cat/64/category/Bria%20Hammel%20for%20CR%20Laine', category: 'accent-chairs' },
];

const BASE = 'https://www.crlaine.com';
const SEARCH_SERVICE = 'http://localhost:4310';
const CONCURRENCY = 5;
const DELAY_MS = 150;

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
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
  // Pattern: /productDetail/CRL/id/4645/styleName/Abingdon/styleNumber/3750-20B
  const pattern = /\/productDetail\/CRL\/id\/(\d+)\/styleName\/([^/]+)\/styleNumber\/([^"'\s<]+)/g;
  const products = new Map();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const id = m[1];
    const name = decodeURIComponent(m[2]).replace(/_/g, ' ');
    const styleNumber = m[3];
    if (!products.has(id)) {
      products.set(id, { id, name, styleNumber, path: m[0] });
    }
  }
  return products;
}

function extractDetail(html, sku) {
  const result = {};

  // Description - look for text after the style number heading
  // Pattern: product type with width like "Sofa (87W)" or "Chair"
  const descMatch = html.match(/(?:Sofa|Loveseat|Settee|Sectional|Chair|Chaise|Swivel|Glider|Recliner|Ottoman|Bed|Daybed|Bench|Stool|Accent)[^<]{0,60}/i);
  if (descMatch) result.description = descMatch[0].trim();

  // Dimensions - "Outside: 87W x 39D x 35H" or similar
  const dimPatterns = [
    /Outside:\s*([\d.]+)W\s*x\s*([\d.]+)D\s*x\s*([\d.]+)H/i,
    /([\d.]+)W\s*x\s*([\d.]+)D\s*x\s*([\d.]+)H/i,
  ];
  for (const pat of dimPatterns) {
    const dm = html.match(pat);
    if (dm) {
      result.width = dm[1];
      result.depth = dm[2];
      result.height = dm[3];
      break;
    }
  }

  // Seat height
  const seatH = html.match(/Seat\s*Height:\s*([\d.]+)/i);
  if (seatH) result.seat_height = seatH[1];

  // Arm height
  const armH = html.match(/Arm\s*Height:\s*([\d.]+)/i);
  if (armH) result.arm_height = armH[1];

  // Materials - cushion types, shown fabric
  const materials = [];
  const seatCush = html.match(/Seat\s*Cushion:\s*([^<\n]+)/i);
  if (seatCush) materials.push(seatCush[1].trim());
  const backCush = html.match(/Back\s*Cushion:\s*([^<\n]+)/i);
  if (backCush) materials.push(backCush[1].trim());

  // Fabric/leather info
  const fabricMatch = html.match(/(?:Shown\s+(?:with|in)\s+)?[Ff]abric:\s*([^<\n]+)/i);
  if (fabricMatch) materials.push('Fabric: ' + fabricMatch[1].trim());
  const leatherMatch = html.match(/[Ll]eather:\s*([^<\n]+)/i);
  if (leatherMatch) materials.push('Leather: ' + leatherMatch[1].trim());
  const finishMatch = html.match(/[Ff]inish:\s*([^<\n]+)/i);
  if (finishMatch) materials.push('Finish: ' + finishMatch[1].trim());

  if (materials.length) result.material = materials.join('; ');

  // Weight
  const weightMatch = html.match(/Weight:\s*([\d.]+)\s*lbs/i);
  if (weightMatch) result.weight = weightMatch[1] + ' lbs';

  // Image - /assets/images/products/xlarge/{styleNumber}.jpg
  result.image_url = `${BASE}/assets/images/products/xlarge/${sku}.jpg`;

  // Also check for actual img src in page
  const imgMatch = html.match(/src="(\/assets\/images\/products\/xlarge\/[^"]+)"/i);
  if (imgMatch) result.image_url = BASE + imgMatch[1];

  return result;
}

function inferCategory(name, description, assignedCategory) {
  const text = `${name} ${description || ''}`.toLowerCase();
  if (/sectional/.test(text)) return 'sectionals';
  if (/sofa/.test(text)) return 'sofas';
  if (/loveseat|settee/.test(text)) return 'loveseats';
  if (/recliner/.test(text)) return 'recliners';
  if (/swivel|glider/.test(text)) return 'swivel-chairs';
  if (/chaise/.test(text)) return 'chaises';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/stool/.test(text)) return 'bar-stools';
  if (/bed|daybed/.test(text)) return 'beds';
  if (/chair/.test(text)) return 'accent-chairs';
  return assignedCategory;
}

async function fetchWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url);
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
  console.log('=== CR Laine Scraper ===\n');

  // Step 1: Collect all product links from category pages
  const allProducts = new Map(); // id -> { id, name, styleNumber, path, category }

  for (const cat of CATEGORIES) {
    const catName = cat.url.split('/category/')[1];
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
    console.log(`  ${decodeURIComponent(catName)}: ${links.size} products, +${newCount} new | total: ${allProducts.size}`);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n━━━ TOTAL UNIQUE PRODUCTS: ${allProducts.size} ━━━\n`);

  // Step 2: Fetch detail pages
  const productList = [...allProducts.values()];
  let okCount = 0;
  let errCount = 0;
  const detailedProducts = [];

  // Process in batches for concurrency
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

        const detail = extractDetail(res.body, prod.styleNumber);
        const category = inferCategory(prod.name, detail.description, prod.category);

        return {
          id: `crlaine-${prod.styleNumber}`,
          product_name: `CR Laine ${prod.name} ${prod.styleNumber}`,
          vendor_name: 'CR Laine',
          vendor_id: 'cr-laine',
          sku: prod.styleNumber,
          category,
          collection: prod.name,
          description: detail.description || '',
          material: detail.material || '',
          image_url: detail.image_url,
          product_url: BASE + prod.path,
          dimensions: detail.width ? `${detail.width}"W x ${detail.depth}"D x ${detail.height}"H` : '',
          width: detail.width ? parseFloat(detail.width) : null,
          depth: detail.depth ? parseFloat(detail.depth) : null,
          height: detail.height ? parseFloat(detail.height) : null,
          price: null,
          in_stock: true,
          source: 'crlaine-scraper',
          tags: [
            detail.seat_height ? `seat-height-${detail.seat_height}` : null,
            detail.arm_height ? `arm-height-${detail.arm_height}` : null,
            detail.weight || null,
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

  console.log(`\nDetail fetch: ${detailedProducts.length} products, ${errCount} errors\n`);

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
=== CR LAINE SCRAPER SUMMARY ===
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
