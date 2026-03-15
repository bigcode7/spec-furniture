import https from 'node:https';
import http from 'node:http';

const CATEGORIES = [
  // BEDROOM
  { url: 'https://www.lexington.com/beds', category: 'beds' },
  { url: 'https://www.lexington.com/dressers', category: 'dressers' },
  { url: 'https://www.lexington.com/mirrors', category: 'mirrors' },
  { url: 'https://www.lexington.com/chests', category: 'chests' },
  { url: 'https://www.lexington.com/night-stands', category: 'nightstands' },
  { url: 'https://www.lexington.com/benches-ottomans1521', category: 'benches' },
  // DINING
  { url: 'https://www.lexington.com/dining-tables', category: 'dining-tables' },
  { url: 'https://www.lexington.com/dining-seating', category: 'dining-chairs' },
  { url: 'https://www.lexington.com/bistro-tables', category: 'dining-tables' },
  { url: 'https://www.lexington.com/counter-bar-stools', category: 'bar-stools' },
  { url: 'https://www.lexington.com/buffets-servers-chinas', category: 'credenzas' },
  { url: 'https://www.lexington.com/bar-cabinets3273', category: 'cabinets' },
  { url: 'https://www.lexington.com/bar-carts', category: 'bars-bar-sets' },
  { url: 'https://www.lexington.com/display-cabinets', category: 'bookcases' },
  { url: 'https://www.lexington.com/dining-seating1357', category: 'dining-chairs' },
  { url: 'https://www.lexington.com/dining-seating1271', category: 'dining-chairs' },
  { url: 'https://www.lexington.com/dining-tables2820', category: 'dining-tables' },
  { url: 'https://www.lexington.com/bistro-tables2842', category: 'dining-tables' },
  { url: 'https://www.lexington.com/counter-bar-stools2833', category: 'bar-stools' },
  // LIVING TABLES
  { url: 'https://www.lexington.com/cocktail-tables', category: 'coffee-tables' },
  { url: 'https://www.lexington.com/end-lamp-tables', category: 'side-tables' },
  { url: 'https://www.lexington.com/sofa-tables-consoles', category: 'console-tables' },
  { url: 'https://www.lexington.com/accent-items', category: 'decorative-objects' },
  { url: 'https://www.lexington.com/game-tables-game-chairs2099', category: 'side-tables' },
  { url: 'https://www.lexington.com/end-accent-tables', category: 'side-tables' },
  // STORAGE AND OFFICE
  { url: 'https://www.lexington.com/bookcases-etageres', category: 'bookcases' },
  { url: 'https://www.lexington.com/hall-chests', category: 'chests' },
  { url: 'https://www.lexington.com/desks', category: 'desks' },
  { url: 'https://www.lexington.com/file-chests', category: 'chests' },
  { url: 'https://www.lexington.com/credenza-decks', category: 'credenzas' },
  { url: 'https://www.lexington.com/bookcases-etageres1972', category: 'bookcases' },
  { url: 'https://www.lexington.com/tv-consoles', category: 'media-consoles' },
  { url: 'https://www.lexington.com/media-walls', category: 'media-consoles' },
  // SEATING - MAIN LINE
  { url: 'https://www.lexington.com/sofas', category: 'sofas' },
  { url: 'https://www.lexington.com/chairs', category: 'accent-chairs' },
  { url: 'https://www.lexington.com/swivel-chairs6263', category: 'swivel-chairs' },
  { url: 'https://www.lexington.com/benches-ottomans', category: 'ottomans' },
  { url: 'https://www.lexington.com/sectionals', category: 'sectionals' },
  { url: 'https://www.lexington.com/love-seats-settees1387', category: 'loveseats' },
  { url: 'https://www.lexington.com/chaises', category: 'chaises' },
  { url: 'https://www.lexington.com/chairs1987', category: 'accent-chairs' },
  // SEATING - SUB-BRAND 2
  { url: 'https://www.lexington.com/sofas927', category: 'sofas' },
  { url: 'https://www.lexington.com/chairs933', category: 'accent-chairs' },
  { url: 'https://www.lexington.com/swivel-chairs', category: 'swivel-chairs' },
  { url: 'https://www.lexington.com/benches-ottomans923', category: 'ottomans' },
  { url: 'https://www.lexington.com/sectionals1013', category: 'sectionals' },
  { url: 'https://www.lexington.com/love-seats-settees', category: 'loveseats' },
  // SEATING - SUB-BRAND 3
  { url: 'https://www.lexington.com/sofas2814', category: 'sofas' },
  { url: 'https://www.lexington.com/chairs2810', category: 'accent-chairs' },
  { url: 'https://www.lexington.com/benches-ottomans2816', category: 'ottomans' },
  { url: 'https://www.lexington.com/sectionals2889', category: 'sectionals' },
  { url: 'https://www.lexington.com/love-seats-settees2836', category: 'loveseats' },
  { url: 'https://www.lexington.com/chaises2818', category: 'chaises' },
  // OUTDOOR
  { url: 'https://www.lexington.com/umbrella', category: 'outdoor' },
];

const BASE = 'https://www.lexington.com';
const SEARCH_SERVICE = 'http://localhost:4310';
const CONCURRENCY = 5;
const DELAY_MS = 200;
const MAX_PAGES = 10;

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
  // Products are inside product-list-item divs
  // <a href="/amelia-sofa" aria-label="Amelia Sofa - 7275-33 Image ">
  const pattern = /product-list-item[\s\S]*?<a\s+href="(\/[a-z][a-z0-9-]+)"[^>]*aria-label="([^"]+)"/gi;
  const products = new Map();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1];
    const label = m[2];
    // Extract SKU from aria-label: "Amelia Sofa - 7275-33 Image"
    const skuMatch = label.match(/- ([A-Z0-9][\w-]+)\s+Image/i);
    const sku = skuMatch ? skuMatch[1] : '';
    const nameMatch = label.match(/^(.+?)\s*-\s*/);
    const name = nameMatch ? nameMatch[1].trim() : label.replace(/\s*Image.*/, '').trim();

    if (!products.has(path)) {
      products.set(path, { path, sku, name });
    }
  }

  // Fallback: also try simpler pattern for product-image links
  if (products.size === 0) {
    const simplePattern = /class="product-image"[\s\S]*?<a\s+href="(\/[a-z][a-z0-9-]+[a-z0-9])"/gi;
    while ((m = simplePattern.exec(html)) !== null) {
      const path = m[1];
      // Skip known non-product paths
      if (/^\/(beds|sofas|chairs|dining|contact|about|search|account|brand|find|privacy|terms|catalogs|resources|inspiration|to-the-trade|design-centers)$/i.test(path)) continue;
      if (!products.has(path)) {
        products.set(path, { path, sku: '', name: '' });
      }
    }
  }

  return products;
}

function hasNextPage(html, currentPage) {
  return html.includes(`?page=${currentPage + 1}`);
}

function extractDetail(html, path) {
  const result = {};

  // SKU - from aria-label or text like "7275-33"
  const skuMatch = html.match(/(\d{3,4}[-_]\d{2,3}[A-Z]?\b)/);
  if (skuMatch) result.sku = skuMatch[1].replace(/_/g, '-');

  // Product name from h1 or title
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) result.name = h1Match[1].trim();
  if (!result.name) {
    const titleMatch = html.match(/<title>([^<|]+)/i);
    if (titleMatch) result.name = titleMatch[1].replace(/Lexington Home Brands/i, '').replace(/\|/g, '').trim();
  }

  // Collection - from "View Collection" link or breadcrumb
  const collLink = html.match(/href="\/([^"]+)"\s*class="line">View Collection/i);
  if (collLink) result.collection = collLink[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Brand detection
  const brandPatterns = [
    [/Tommy\s*Bahama\s*Outdoor/i, 'Tommy Bahama Outdoor'],
    [/Tommy\s*Bahama\s*Home/i, 'Tommy Bahama Home'],
    [/Tommy\s*Bahama\s*Upholstery/i, 'Tommy Bahama Home'],
    [/Barclay\s*Butera/i, 'Barclay Butera'],
    [/Artistica\s*Home/i, 'Artistica Home'],
    [/Sligh/i, 'Sligh'],
  ];
  result.brand = 'Lexington';
  for (const [pat, brand] of brandPatterns) {
    if (pat.test(html.slice(0, 10000))) {
      // Check if it's in the product content area, not just navigation
      const contentArea = html.slice(html.indexOf('product-detail') || 0);
      if (pat.test(contentArea)) {
        result.brand = brand;
        break;
      }
    }
  }

  // Dimensions - "87W x 41D x 36H" format
  const dimMatch = html.match(/(\d+(?:\.\d+)?)W\s*x\s*(\d+(?:\.\d+)?)D\s*x\s*(\d+(?:\.\d+)?)H/i);
  if (dimMatch) {
    result.width = dimMatch[1];
    result.depth = dimMatch[2];
    result.height = dimMatch[3];
  }

  // Arm height, seat height
  const armH = html.match(/Arm\s*Height[:\s<\/span>]*([\d.]+)\s*in/i);
  if (armH) result.arm_height = armH[1];

  const seatH = html.match(/Seat\s*Height[:\s<\/span>]*([\d.]+)\s*in/i);
  if (seatH) result.seat_height = seatH[1];

  // Inside dimensions
  const insideW = html.match(/Inside\s*Width[:\s<\/span>]*([\d.]+)\s*in/i);
  const insideD = html.match(/Inside\s*Depth[:\s<\/span>]*([\d.]+)\s*in/i);
  if (insideW && insideD) result.inside_dims = `${insideW[1]}W x ${insideD[1]}D`;

  // Description
  const descMatch = html.match(/product-detail-description[^>]*>[\s\S]*?<p[^>]*>([\s\S]{10,500}?)<\/p>/i)
    || html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  if (descMatch) result.description = descMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 300);

  // Materials
  const materials = [];
  const matMatch = html.match(/Materials?[:\s<\/span>]*([^<\n]{3,80})/i);
  if (matMatch) materials.push(matMatch[1].trim());
  const finishMatch = html.match(/Finish[:\s<\/span>]*([^<\n]{3,60})/i);
  if (finishMatch) materials.push('Finish: ' + finishMatch[1].trim());
  if (materials.length) result.material = materials.join('; ');

  // Hero image - feedcache
  const imgMatch = html.match(/src="([^"]*feedcache\/productFull\/[^"]+\.jpg)"/i)
    || html.match(/src="([^"]*feedcache\/productLarge\/[^"]+\.jpg)"/i)
    || html.match(/src='([^']*feedcache\/product(?:Full|Large)\/[^']+\.jpg)'/i);
  if (imgMatch) {
    result.image_url = imgMatch[1].startsWith('http') ? imgMatch[1] : BASE + imgMatch[1];
  }

  // In Stock
  result.in_stock = /in\s*stock/i.test(html);

  return result;
}

function inferCategory(name, path, assignedCategory) {
  const text = `${name || ''} ${path}`.toLowerCase();
  if (/sectional/.test(text)) return 'sectionals';
  if (/sofa/.test(text)) return 'sofas';
  if (/loveseat|settee/.test(text)) return 'loveseats';
  if (/swivel/.test(text)) return 'swivel-chairs';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/chaise/.test(text)) return 'chaises';
  if (/recliner/.test(text)) return 'recliners';
  if (/stool/.test(text)) return 'bar-stools';
  if (/bed/.test(text)) return 'beds';
  if (/nightstand|night-stand|bedside/.test(text)) return 'nightstands';
  if (/dresser/.test(text)) return 'dressers';
  if (/mirror/.test(text)) return 'mirrors';
  if (/chest/.test(text)) return 'chests';
  if (/desk/.test(text)) return 'desks';
  if (/console|credenza|buffet|server/.test(text)) return 'console-tables';
  if (/bookcase|etagere|display\s*cabinet/.test(text)) return 'bookcases';
  if (/cocktail|coffee/.test(text)) return 'coffee-tables';
  if (/end\s*table|side\s*table|lamp\s*table|accent\s*table/.test(text)) return 'side-tables';
  if (/dining\s*table|bistro/.test(text)) return 'dining-tables';
  if (/dining\s*chair|host|side\s*chair/.test(text)) return 'dining-chairs';
  if (/umbrella/.test(text)) return 'outdoor';
  if (/chair/.test(text)) return 'accent-chairs';
  if (/table/.test(text)) return 'side-tables';
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

async function fetchAllPages(baseUrl) {
  const allLinks = new Map();
  let page = 1;

  while (page <= MAX_PAGES) {
    const url = page === 1 ? baseUrl : `${baseUrl}?page=${page}`;
    const res = await fetchWithRetry(url);
    if (!res || res.status !== 200) break;

    const links = extractProductLinks(res.body);
    if (links.size === 0) break;

    for (const [key, prod] of links) {
      if (!allLinks.has(key)) allLinks.set(key, prod);
    }

    if (!hasNextPage(res.body, page)) break;
    page++;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  return { links: allLinks, pages: page };
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
  console.log('=== Lexington Home Brands Scraper ===\n');

  const allProducts = new Map();

  for (const cat of CATEGORIES) {
    const catName = cat.url.replace(BASE + '/', '');
    const { links, pages } = await fetchAllPages(cat.url);

    let newCount = 0;
    for (const [key, prod] of links) {
      if (!allProducts.has(key)) {
        allProducts.set(key, { ...prod, category: cat.category });
        newCount++;
      }
    }

    const pageInfo = pages > 1 ? ` (${pages} pages)` : '';
    console.log(`  ${catName}: ${links.size} products${pageInfo}, +${newCount} new | total: ${allProducts.size}`);
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n━━━ TOTAL UNIQUE PRODUCTS: ${allProducts.size} ━━━\n`);

  // Fetch detail pages
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
        if (res.status !== 200) { errCount++; return null; }
        okCount++;

        const detail = extractDetail(res.body, prod.path);
        const name = detail.name || prod.name || prod.path.replace(/^\//, '').replace(/-/g, ' ');
        const sku = detail.sku || prod.sku || '';
        const category = inferCategory(name, prod.path, prod.category);
        const brand = detail.brand || 'Lexington';

        if (!detail.image_url) noImageCount++;

        return {
          id: `lexington-${sku || prod.path.replace(/\//g, '')}`,
          product_name: `${brand} ${name}${sku ? ' ' + sku : ''}`,
          vendor_name: 'Lexington Home Brands',
          vendor_id: 'lexington-home-brands',
          sku: sku,
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
          in_stock: detail.in_stock || false,
          source: 'lexington-scraper',
          tags: [
            detail.seat_height ? `seat-height-${detail.seat_height}` : null,
            detail.arm_height ? `arm-height-${detail.arm_height}` : null,
            brand !== 'Lexington' ? brand.toLowerCase().replace(/\s+/g, '-') : null,
            'trade',
          ].filter(Boolean),
        };
      } catch (e) { errCount++; return null; }
    }));

    detailedProducts.push(...results.filter(Boolean));

    const done = Math.min(i + CONCURRENCY, productList.length);
    if (done % 200 === 0 || done === productList.length) {
      console.log(`  Progress: ${done}/${productList.length} (${okCount} OK, ${errCount} errors)`);
    }
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\nDetail fetch: ${detailedProducts.length} products, ${errCount} errors, ${noImageCount} missing images\n`);

  // Post
  console.log(`Posting ${detailedProducts.length} products...`);
  await postProducts(detailedProducts);

  // Summary
  const withImage = detailedProducts.filter(p => p.image_url).length;
  const withDims = detailedProducts.filter(p => p.dimensions).length;
  const withMaterial = detailedProducts.filter(p => p.material).length;

  const byCat = {};
  for (const p of detailedProducts) byCat[p.category] = (byCat[p.category] || 0) + 1;

  const byBrand = {};
  for (const p of detailedProducts) {
    const brand = p.tags.find(t => t === 'tommy-bahama-home' || t === 'tommy-bahama-outdoor' || t === 'barclay-butera' || t === 'artistica-home' || t === 'sligh') || 'lexington';
    byBrand[brand] = (byBrand[brand] || 0) + 1;
  }

  console.log(`
============================================================
=== LEXINGTON HOME BRANDS SCRAPER SUMMARY ===
============================================================
Total unique products: ${detailedProducts.length}
Detail pages OK:       ${okCount}
Errors:                ${errCount}
Posted:                ${detailedProducts.length}
With image:            ${withImage} (${Math.round(100 * withImage / detailedProducts.length)}%)
With dimensions:       ${withDims} (${Math.round(100 * withDims / detailedProducts.length)}%)
With material:         ${withMaterial} (${Math.round(100 * withMaterial / detailedProducts.length)}%)

By brand:
${Object.entries(byBrand).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

By category:
${Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n')}
============================================================`);
}

main().catch(e => console.error(e));
