import https from 'node:https';
import http from 'node:http';

const BASE = 'https://www.bakerfurniture.com';
const SEARCH_SERVICE = 'http://localhost:4310';
const API_URL = 'https://www.bakerfurniture.com/umbraco/api/searchapi/RefineSearch?httproute=True';
const ROOT_ID = 1121;
const PAGE_SIZE = 12; // API returns 12 per page
const DELAY_MS = 150;

// Baker categories mapped to our normalized categories
// Excludes "Fabrics" (swatches, not furniture)
const CATEGORIES = [
  { apiName: 'Sofas', category: 'sofas' },
  { apiName: 'Chairs', category: 'accent-chairs' },
  { apiName: 'Sectionals', category: 'sectionals' },
  { apiName: 'Chaises', category: 'chaises' },
  { apiName: 'Benches', category: 'benches' },
  { apiName: 'Ottomans', category: 'ottomans' },
  { apiName: 'Chests', category: 'chests' },
  { apiName: 'Cabinets', category: 'bookcases' },
  { apiName: 'Servers', category: 'credenzas' },
  { apiName: 'Etageres', category: 'bookcases' },
  { apiName: 'Tables', category: 'side-tables' },
  { apiName: 'Lighting', category: 'table-lamps' },
  { apiName: 'Accessories', category: 'decorative-objects' },
  { apiName: 'Beds', category: 'beds' },
  { apiName: 'Nightstands', category: 'nightstands' },
  { apiName: 'Desks', category: 'desks' },
  { apiName: 'Stools', category: 'bar-stools' },
];

function apiPost(data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const urlObj = new URL(API_URL);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.bakerfurniture.com/',
      },
    }, res => {
      let responseBody = '';
      res.setEncoding('utf8');
      res.on('data', c => responseBody += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, error: responseBody.slice(0, 200) });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function inferCategory(product, defaultCategory) {
  const name = (product.Product_Name || '').toLowerCase();
  const url = (product.Url || '').toLowerCase();
  const text = `${name} ${url}`;

  // Outdoor detection from URL
  const isOutdoor = url.includes('/outdoor/');

  // Seating
  if (/sectional/.test(text)) return 'sectionals';
  if (/sofa/.test(text)) return 'sofas';
  if (/loveseat|settee/.test(text)) return 'loveseats';
  if (/chaise/.test(text)) return 'chaises';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/stool|counter|bar\s*seat/.test(text)) return 'bar-stools';
  if (/recliner|motion/.test(text)) return 'recliners';
  if (/swivel/.test(text)) return 'swivel-chairs';

  // Tables
  if (/cocktail\s*table|coffee\s*table/.test(text)) return 'coffee-tables';
  if (/console/.test(text)) return 'console-tables';
  if (/dining\s*table/.test(text)) return 'dining-tables';
  if (/center\s*table/.test(text)) return 'side-tables';
  if (/side\s*table|spot\s*table|end\s*table|accent\s*table|nesting/.test(text)) return 'side-tables';
  if (/writing\s*table|desk/.test(text)) return 'desks';
  if (/nightstand|bedside|night\s*table/.test(text)) return 'nightstands';

  // Dining seating
  if (/dining.*chair|host.*chair|side.*chair|arm.*chair.*dining/.test(text)) return 'dining-chairs';
  if (url.includes('/dining/seating/')) return 'dining-chairs';

  // Bedroom
  if (/\bbed\b|headboard/.test(text)) return 'beds';
  if (/dresser/.test(text)) return 'dressers';
  if (/mirror/.test(text)) return 'mirrors';

  // Storage
  if (/chest/.test(text)) return 'chests';
  if (/cabinet|bookcase|etagere|vitrine|display/.test(text)) return 'bookcases';
  if (/credenza|buffet|sideboard|server/.test(text)) return 'credenzas';
  if (/media|entertainment/.test(text)) return 'media-consoles';

  // Lighting
  if (/floor\s*lamp/.test(text)) return 'table-lamps';
  if (/table\s*lamp/.test(text)) return 'table-lamps';
  if (/chandelier|pendant/.test(text)) return 'table-lamps';
  if (/sconce|wall\s*light/.test(text)) return 'table-lamps';
  if (/lamp|light/.test(text)) return 'table-lamps';

  // Chairs (general - after dining chairs check)
  if (/chair|lounge/.test(text)) return 'accent-chairs';

  // Tables (general)
  if (/table/.test(text)) return 'side-tables';

  return defaultCategory;
}

function buildProduct(item, defaultCategory) {
  const sku = item.Item_No || '';
  const name = item.Product_Name || '';
  const category = inferCategory(item, defaultCategory);
  const brand = (item.Brand_Category || [])[0] || 'Baker';
  const isOutdoor = (item.Url || '').includes('/outdoor/');

  // Image: Scene7 URL — append ?wid=800 for good quality
  let imageUrl = item.Image || '';
  if (imageUrl && !imageUrl.includes('?')) {
    imageUrl += '?wid=800&hei=800';
  }

  const tags = ['luxury', 'trade'];
  if (brand === 'McGuire') tags.push('mcguire');
  if (brand === 'Milling Road') tags.push('milling-road');
  if (item.In_Stock) tags.push('in-stock');
  if (item.New_Product) tags.push('new-arrival');
  if (item.IsFabric) tags.push('fabric');
  if (item.Foundational) tags.push('foundational');
  if (isOutdoor) tags.push('outdoor');
  if (item.Collection) tags.push(`collection-${item.Collection.toLowerCase().replace(/\s+/g, '-')}`);

  return {
    id: `baker-${item.Product_ID || sku}`,
    product_name: `Baker ${name}${sku ? ' ' + sku : ''}`,
    vendor_name: 'Baker Furniture',
    vendor_id: 'baker-furniture',
    sku,
    category,
    collection: item.Collection || '',
    description: item.ImageCaption || '',
    material: '', // API doesn't return material details
    image_url: imageUrl,
    product_url: item.Url ? BASE + item.Url : '',
    dimensions: item.Width && item.Depth && item.Height
      ? `${item.Width}"W x ${item.Depth}"D x ${item.Height}"H` : '',
    width: item.Width || null,
    depth: item.Depth || null,
    height: item.Height || null,
    price: null,
    in_stock: item.In_Stock || false,
    source: 'baker-scraper',
    tags,
  };
}

async function fetchCategory(apiName, defaultCategory) {
  const allProducts = [];
  let page = 0;
  let totalCount = 0;

  while (true) {
    const res = await apiPost({
      Query: '',
      Categories: [apiName],
      Collections: [],
      Brands: [],
      Showrooms: [],
      InStock: false,
      NewArrival: false,
      PriceHigh: '',
      PriceLow: '',
      Page: page,
      Order: '',
      PriceAttribute: '',
      RootId: ROOT_ID,
    });

    if (!res.data?.Success || !res.data?.Result?.value?.length) break;

    if (page === 0) {
      totalCount = res.data.Result['@odata.count'] || 0;
    }

    const items = res.data.Result.value;
    for (const item of items) {
      allProducts.push(buildProduct(item, defaultCategory));
    }

    const fetched = allProducts.length;
    if (fetched >= totalCount) break;

    page++;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  return { products: allProducts, total: totalCount };
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
  console.log('=== Baker Furniture Scraper ===');
  console.log('Using Umbraco RefineSearch API (no Puppeteer needed)\n');

  const allProducts = new Map(); // Product_ID -> product to dedup

  for (const cat of CATEGORIES) {
    const { products, total } = await fetchCategory(cat.apiName, cat.category);

    let newCount = 0;
    for (const p of products) {
      if (!allProducts.has(p.id)) {
        allProducts.set(p.id, p);
        newCount++;
      }
    }

    const pages = Math.ceil(total / PAGE_SIZE);
    console.log(`  ${cat.apiName}: ${total} total, ${products.length} fetched, +${newCount} new (${pages} pages) | total unique: ${allProducts.size}`);
  }

  // Also fetch all products without category filter to catch anything missed
  console.log('\n  Fetching ALL products (no category filter)...');
  let page = 0;
  let catchAllNew = 0;

  while (true) {
    const res = await apiPost({
      Query: '', Categories: [], Collections: [], Brands: [], Showrooms: [],
      InStock: false, NewArrival: false, PriceHigh: '', PriceLow: '',
      Page: page, Order: '', PriceAttribute: '', RootId: ROOT_ID,
    });

    if (!res.data?.Success || !res.data?.Result?.value?.length) break;

    const totalCount = res.data.Result['@odata.count'] || 0;
    const items = res.data.Result.value;

    for (const item of items) {
      // Skip fabrics (swatches, not furniture)
      if ((item.Product_Name || '').toLowerCase().includes('fabric swatch')) continue;

      const p = buildProduct(item, 'decorative-objects');
      if (!allProducts.has(p.id)) {
        allProducts.set(p.id, p);
        catchAllNew++;
      }
    }

    const fetched = (page + 1) * PAGE_SIZE;
    if (page % 20 === 0) {
      console.log(`    Page ${page}/${Math.ceil(totalCount / PAGE_SIZE)} | unique: ${allProducts.size}`);
    }

    if (fetched >= totalCount) break;
    page++;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`  Catch-all pass: +${catchAllNew} new products | total unique: ${allProducts.size}`);

  // Filter out fabric swatches
  const furniture = [...allProducts.values()].filter(p => {
    const name = p.product_name.toLowerCase();
    return !name.includes('fabric swatch') && !name.includes('fabric sample');
  });

  console.log(`\n━━━ TOTAL UNIQUE BAKER PRODUCTS: ${furniture.length} (excluded ${allProducts.size - furniture.length} fabric swatches) ━━━\n`);

  // Post to search service
  console.log(`Posting ${furniture.length} products...`);
  await postProducts(furniture);

  // Summary
  const withImage = furniture.filter(p => p.image_url).length;
  const withDims = furniture.filter(p => p.dimensions).length;
  const withCollection = furniture.filter(p => p.collection).length;

  const byCat = {};
  for (const p of furniture) byCat[p.category] = (byCat[p.category] || 0) + 1;

  const byBrand = {};
  for (const p of furniture) {
    const brand = p.tags.includes('mcguire') ? 'McGuire'
      : p.tags.includes('milling-road') ? 'Milling Road' : 'Baker';
    byBrand[brand] = (byBrand[brand] || 0) + 1;
  }

  console.log(`
============================================================
=== BAKER FURNITURE SCRAPER SUMMARY ===
============================================================
Total unique products: ${furniture.length}
Posted:                ${furniture.length}
With image:            ${withImage} (${Math.round(100 * withImage / furniture.length)}%)
With dimensions:       ${withDims} (${Math.round(100 * withDims / furniture.length)}%)
With collection:       ${withCollection} (${Math.round(100 * withCollection / furniture.length)}%)

By brand:
${Object.entries(byBrand).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

By category:
${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
============================================================`);
}

main().catch(e => console.error(e));
