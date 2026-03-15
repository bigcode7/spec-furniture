import https from 'node:https';
import http from 'node:http';

const BASE = 'https://www.stickley.com';
const SEARCH_SERVICE = 'http://localhost:4310';
const CONCURRENCY = 5;
const DELAY_MS = 200;

// Product types that are NOT furniture — skip these
const SKIP_TYPES = new Set(['leather', 'fabric', 'finishes', 'rugs', '']);

function httpFetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/json',
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

function inferCategory(productType, title, tags) {
  const type = (productType || '').toLowerCase();
  const name = (title || '').toLowerCase();
  const text = `${type} ${name} ${(tags || []).join(' ').toLowerCase()}`;

  if (/sectional/.test(text)) return 'sectionals';
  if (/sofa|loveseat/.test(type)) return 'sofas';
  if (/loveseat/.test(name)) return 'loveseats';
  if (/chaise/.test(text)) return 'chaises';
  if (/recliner/.test(type)) return 'recliners';
  if (/swivel/.test(text)) return 'swivel-chairs';
  if (/ottoman/.test(type)) return 'ottomans';
  if (/bench|stool/.test(type) && !/bar|counter/.test(type)) return 'benches';
  if (/bar.*stool|counter.*stool/.test(type)) return 'bar-stools';
  if (/dining\s*chair/.test(type)) return 'dining-chairs';
  if (/accent\s*chair/.test(type)) return 'accent-chairs';
  if (/cocktail/.test(type)) return 'coffee-tables';
  if (/end.*table|side.*table/.test(type)) return 'side-tables';
  if (/dining\s*table/.test(type)) return 'dining-tables';
  if (/console/.test(type)) return 'console-tables';
  if (/media|tv\s*console/.test(type)) return 'media-consoles';
  if (/desk/.test(type)) return 'desks';
  if (/\bbed\b/.test(type)) return 'beds';
  if (/nightstand/.test(type)) return 'nightstands';
  if (/dresser|chest/.test(type)) return 'dressers';
  if (/buffet|sideboard/.test(type)) return 'credenzas';
  if (/bookcase|shelving|storage|display|cabinet/.test(type)) return 'bookcases';
  if (/mirror/.test(type)) return 'mirrors';
  // Name fallbacks
  if (/sofa/.test(name)) return 'sofas';
  if (/loveseat/.test(name)) return 'loveseats';
  if (/chair/.test(name)) return 'accent-chairs';
  if (/table/.test(name)) return 'side-tables';
  if (/bed/.test(name)) return 'beds';
  if (/desk/.test(name)) return 'desks';
  return 'decorative-objects';
}

function extractDetailFromPage(html) {
  const result = {};

  // Dimensions: W32 D24.5 H20.5 (or with spaces/tags between)
  const dimMatch = html.match(/W([\d.]+)\s*(?:<[^>]*>|\s)*D([\d.]+)\s*(?:<[^>]*>|\s)*H([\d.]+)/i);
  if (dimMatch) {
    result.width = dimMatch[1];
    result.depth = dimMatch[2];
    result.height = dimMatch[3];
  }

  // Materials: text after "Materials:" up to next label or closing tag
  const matMatch = html.match(/Materials:\s*(?:<[^>]*>)*\s*([^<]+)/i);
  if (matMatch) result.materials = matMatch[1].trim();

  // Finish: text after "Finish:"
  const finMatch = html.match(/Finish:\s*(?:<[^>]*>)*\s*([^<]+)/i);
  if (finMatch) result.finish = finMatch[1].trim();

  // Construction features
  const constIdx = html.indexOf('Construction features:');
  if (constIdx > -1) {
    const constArea = html.slice(constIdx, constIdx + 1000);
    const features = constArea.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|')
      .replace(/Construction features:\s*\|?/, '').split('|')
      .filter(s => s.trim().length > 3 && !/Origin:|Shown in:|Options:|CLEANING/i.test(s))
      .map(s => s.trim())
      .slice(0, 8);
    if (features.length) result.construction = features.join('; ');
  }

  // Shown in (fabric/leather)
  const shownMatch = html.match(/Shown in:\s*(?:<[^>]*>)*\s*(?:<[^>]*>)*\s*([^<]+)/i);
  if (shownMatch) result.shown_in = shownMatch[1].trim();

  // Origin
  const originMatch = html.match(/Origin:\s*(?:<[^>]*>)*\s*([^<]+)/i);
  if (originMatch) result.origin = originMatch[1].trim();

  // Seat height
  const shMatch = html.match(/Seat\s*Height[:\s]*([\d.]+)/i);
  if (shMatch) result.seat_height = shMatch[1];

  return result;
}

function buildProduct(shopifyProd, detail) {
  const sku = shopifyProd.variants?.[0]?.sku || '';
  const title = shopifyProd.title || '';
  const category = inferCategory(shopifyProd.product_type, title, shopifyProd.tags);

  let imageUrl = '';
  if (shopifyProd.images?.length > 0) {
    imageUrl = shopifyProd.images[0].src || '';
  }

  const description = (shopifyProd.body_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

  const price = shopifyProd.variants?.[0]?.price ? parseFloat(shopifyProd.variants[0].price) : null;

  // Collection from tags
  let collection = '';
  for (const tag of (shopifyProd.tags || [])) {
    if (/collection$/i.test(tag)) {
      collection = tag.replace(/\s*Collection$/i, '');
      break;
    }
  }
  // Fallback: check for known Stickley collections in tags
  if (!collection) {
    const collTags = ['Mission', 'Harvey Ellis', 'Collector', 'Metropolitan', 'Modern',
      'Classics', 'Nichols & Stone', 'Audi', 'Sterling', 'Highlands'];
    for (const ct of collTags) {
      if ((shopifyProd.tags || []).includes(ct)) { collection = ct; break; }
    }
  }

  // Build material string
  const materialParts = [];
  if (detail.materials) materialParts.push(detail.materials);
  if (detail.finish) materialParts.push('Finish: ' + detail.finish);
  if (detail.shown_in) materialParts.push('Shown in: ' + detail.shown_in);
  const material = materialParts.join('; ');

  // Build description with construction
  let fullDesc = description;
  if (detail.construction) fullDesc += '. ' + detail.construction;
  fullDesc = fullDesc.slice(0, 400);

  const width = detail.width ? parseFloat(detail.width) : null;
  const depth = detail.depth ? parseFloat(detail.depth) : null;
  const height = detail.height ? parseFloat(detail.height) : null;

  const tags = ['luxury', 'trade', 'craftsman', 'american-made'];
  if (detail.origin?.includes('New York')) tags.push('made-in-new-york');
  if (detail.origin?.includes('NC') || detail.origin?.includes('North Carolina')) tags.push('made-in-north-carolina');
  if (detail.seat_height) tags.push(`seat-height-${detail.seat_height}`);
  if ((shopifyProd.tags || []).includes('Mission')) tags.push('mission');
  if ((shopifyProd.tags || []).includes('Contract Grade')) tags.push('contract-grade');
  if ((shopifyProd.tags || []).includes('USA')) tags.push('made-in-usa');

  return {
    id: `stickley-${shopifyProd.handle}`,
    product_name: `Stickley ${title}${sku ? ' ' + sku : ''}`,
    vendor_name: 'Stickley',
    vendor_id: 'stickley',
    sku,
    category,
    collection,
    description: fullDesc,
    material,
    image_url: imageUrl,
    product_url: `${BASE}/products/${shopifyProd.handle}`,
    dimensions: width && depth && height
      ? `${detail.width}"W x ${detail.depth}"D x ${detail.height}"H` : '',
    width,
    depth,
    height,
    price,
    in_stock: shopifyProd.variants?.some(v => v.available) || false,
    source: 'stickley-scraper',
    tags,
  };
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
    if (posted % 200 === 0 || posted === products.length) {
      console.log(`  Posted: ${posted}/${products.length}`);
    }
  }
}

async function main() {
  console.log('=== Stickley Scraper ===\n');

  // Step 1: Fetch all products via Shopify API
  console.log('Step 1: Fetching all products via Shopify /products.json API...');
  const allProducts = new Map();
  let page = 1;

  while (true) {
    const res = await fetchWithRetry(`${BASE}/products.json?limit=250&page=${page}`);
    if (!res || res.status !== 200) break;

    let data;
    try {
      data = JSON.parse(res.body);
    } catch (e) {
      console.error('  JSON parse error on page', page);
      break;
    }

    if (!data.products || data.products.length === 0) break;

    let skipped = 0;
    for (const p of data.products) {
      const type = (p.product_type || '').toLowerCase();
      if (SKIP_TYPES.has(type)) {
        skipped++;
        continue;
      }
      if (!allProducts.has(p.handle)) {
        allProducts.set(p.handle, p);
      }
    }

    console.log(`  Page ${page}: ${data.products.length} products (${skipped} skipped swatches/rugs) | furniture: ${allProducts.size}`);
    if (data.products.length < 250) break;
    page++;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n━━━ SHOPIFY API: ${allProducts.size} unique furniture products ━━━\n`);

  // Step 2: Fetch detail pages for dimensions/materials
  console.log('Step 2: Fetching detail pages for dimensions, materials, finish...');
  const productList = [...allProducts.values()];
  let okCount = 0;
  let errCount = 0;
  const detailedProducts = [];

  for (let i = 0; i < productList.length; i += CONCURRENCY) {
    const batch = productList.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (shopifyProd) => {
      try {
        const url = `${BASE}/products/${shopifyProd.handle}`;
        const res = await fetchWithRetry(url);
        if (!res || res.status !== 200) {
          errCount++;
          return buildProduct(shopifyProd, {});
        }
        okCount++;
        const detail = extractDetailFromPage(res.body);
        return buildProduct(shopifyProd, detail);
      } catch (e) {
        errCount++;
        return buildProduct(shopifyProd, {});
      }
    }));

    detailedProducts.push(...results.filter(Boolean));

    const done = Math.min(i + CONCURRENCY, productList.length);
    if (done % 200 === 0 || done === productList.length) {
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
  const withPrice = detailedProducts.filter(p => p.price).length;

  const byCat = {};
  for (const p of detailedProducts) byCat[p.category] = (byCat[p.category] || 0) + 1;

  console.log(`
============================================================
=== STICKLEY SCRAPER SUMMARY ===
============================================================
Total unique products: ${detailedProducts.length}
Detail pages OK:       ${okCount}
Errors:                ${errCount}
Posted:                ${detailedProducts.length}
With image:            ${withImage} (${Math.round(100 * withImage / detailedProducts.length)}%)
With dimensions:       ${withDims} (${Math.round(100 * withDims / detailedProducts.length)}%)
With material:         ${withMaterial} (${Math.round(100 * withMaterial / detailedProducts.length)}%)
With collection:       ${withCollection} (${Math.round(100 * withCollection / detailedProducts.length)}%)
With price:            ${withPrice} (${Math.round(100 * withPrice / detailedProducts.length)}%)

By category:
${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
============================================================`);
}

main().catch(e => console.error(e));
