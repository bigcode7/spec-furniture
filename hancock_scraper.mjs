import https from 'node:https';
import http from 'node:http';

const CATEGORIES = [
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT9%2CCSTOOL', category: 'bar-stools', name: 'Bar & Counter Stools' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT23%2CCAT28', category: 'beds', name: 'Beds & Headboards' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=SOFACHAIR', category: 'accent-chairs', name: 'Sofa/Chair Collections' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT13', category: 'dining-chairs', name: 'Dining Chairs' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT27', category: 'accent-chairs', name: 'Desk Chairs' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT15', category: 'accent-chairs', name: 'Game Chairs' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT4', category: 'accent-chairs', name: 'Lounge Chairs' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT26', category: 'loveseats', name: 'Loveseats' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT19', category: 'accent-chairs', name: 'Occasional Chairs' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT18', category: 'ottomans', name: 'Ottomans' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT14', category: 'recliners', name: 'Recliners' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=SETTEES', category: 'loveseats', name: 'Settees' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT16', category: 'sectionals', name: 'Sectionals' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=SOFAS', category: 'sofas', name: 'Sofas' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT2', category: 'swivel-chairs', name: 'Swivel Chairs' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT30', category: 'side-tables', name: 'Tables' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=CAT5', category: 'accent-chairs', name: 'Wing Chairs' },
  { url: 'https://www.hancockandmoore.com/Products/Search?TypeID=STOCKED', category: 'accent-chairs', name: 'Stocked Collection' },
  { url: 'https://www.hancockandmoore.com/Products/UrbanLogic', category: 'accent-chairs', name: 'Urban Logic' },
  { url: 'https://www.hancockandmoore.com/Products/Search?CollectionNo=MILO', category: 'accent-chairs', name: 'Milo Collection' },
  { url: 'https://www.hancockandmoore.com/Products/CDJ', category: 'accent-chairs', name: 'CDJ Collection' },
];

const BASE = 'https://www.hancockandmoore.com';
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
  // Pattern: /Products/Detail?SKU=4716 (single or double quotes)
  const pattern = /href=['"]?(\/Products\/Detail\?SKU=([^'"&\s>]+))['">\s]/gi;
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

function hasNextPage(html, currentPage) {
  // Look for pagination link to next page
  const nextPage = currentPage + 1;
  const pattern = new RegExp(`Page=${nextPage}`, 'i');
  return pattern.test(html);
}

function extractDetail(html, sku) {
  const result = {};

  // Product name
  const nameMatch = html.match(new RegExp(`${sku.replace(/[-]/g, '[-\\s]?')}\\s+([A-Z][A-Za-z\\s&']+?)(?:<|\\n|$)`, 'i'))
    || html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i)
    || html.match(/<title>([^<|]+)/i);
  if (nameMatch) result.name = nameMatch[1].trim();

  // Collection
  const collMatch = html.match(/Collection[:\s]*([^<\n]{3,50})/i);
  if (collMatch) result.collection = collMatch[1].trim();

  // Description - photographed in info
  const photoMatch = html.match(/[Pp]hotographed\s+in\s+([^<\n.]{3,100})/);
  if (photoMatch) result.description = 'Photographed in ' + photoMatch[1].trim();

  // Dimensions - quotes may be &quot; or " or missing
  const q = '(?:&quot;|"|\'|″)?';
  const hMatch = html.match(new RegExp(`Height[:\\s]*([\\d.]+)${q}`, 'i'));
  const wMatch = html.match(new RegExp(`Width[:\\s]*([\\d.]+)${q}`, 'i'));
  const dMatch = html.match(new RegExp(`(?:Overall\\s+)?Depth[:\\s]*([\\d.]+)${q}`, 'i'));
  if (wMatch) result.width = wMatch[1];
  if (dMatch) result.depth = dMatch[1];
  if (hMatch) result.height = hMatch[1];

  // Seat height
  const seatH = html.match(new RegExp(`Seat\\s*Height[:\\s]*([\\d.]+)${q}`, 'i'));
  if (seatH) result.seat_height = seatH[1];

  // Arm height
  const armH = html.match(new RegExp(`Arm\\s*Height[:\\s]*([\\d.]+)${q}`, 'i'));
  if (armH) result.arm_height = armH[1];

  // Materials
  const materials = [];
  const comMatch = html.match(/COM\s*(?:Requirement)?[:\s]*([\d.]+)\s*(?:yds|yards)/i);
  if (comMatch) materials.push(`COM: ${comMatch[1]} yds`);
  const colMatch = html.match(/COL\s*(?:Requirement)?[:\s]*([\d.]+)\s*sq/i);
  if (colMatch) materials.push(`COL: ${colMatch[1]} sq ft`);
  if (photoMatch) {
    const leatherFabric = photoMatch[1].trim();
    materials.push(leatherFabric);
  }
  // Hancock & Moore is primarily leather
  materials.push('Leather');
  result.material = materials.join('; ');

  // Hero image - /Documents/prod-images/SKU_Name_HR.jpg
  const imgMatch = html.match(/(?:src|href)=['"]([^'"]*\/Documents\/prod-images\/[^'"]+\.jpg)['"]/i)
    || html.match(/(?:src|href)=['"]([^'"]*prod-images\/[^'"]+\.jpg)['"]/i);
  if (imgMatch) {
    result.image_url = imgMatch[1].startsWith('http') ? imgMatch[1] : BASE + imgMatch[1];
  }

  // Also try the search image pattern
  if (!result.image_url) {
    const searchImg = html.match(/(?:src|href)=['"]([^'"]*ImgSearch\/ResizeImage\?imageName=[^'"]+)['"]/i);
    if (searchImg) {
      result.image_url = searchImg[1].startsWith('http') ? searchImg[1] : BASE + searchImg[1];
    }
  }

  return result;
}

function inferCategory(sku, name, assignedCategory) {
  const text = `${name || ''} ${sku}`.toLowerCase();
  if (/sofa/.test(text) && !/chair/.test(text)) return 'sofas';
  if (/loveseat/.test(text)) return 'loveseats';
  if (/settee/.test(text)) return 'loveseats';
  if (/sectional/.test(text)) return 'sectionals';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/recliner|relaxor|motion/.test(text)) return 'recliners';
  if (/swivel/.test(text)) return 'swivel-chairs';
  if (/wing/.test(text)) return 'accent-chairs';
  if (/dining/.test(text)) return 'dining-chairs';
  if (/stool|counter/.test(text)) return 'bar-stools';
  if (/desk/.test(text)) return 'desk-chairs';
  if (/bed|headboard/.test(text)) return 'beds';
  if (/table/.test(text)) return 'side-tables';
  if (/chaise/.test(text)) return 'chaises';
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

async function fetchAllPages(baseUrl, category, name) {
  const allLinks = new Map();
  let page = 1;
  const maxPages = 20; // safety limit

  while (page <= maxPages) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const url = page === 1 ? baseUrl : `${baseUrl}${sep}Page=${page}`;

    const res = await fetchWithRetry(url);
    if (res.status !== 200) break;

    const links = extractProductLinks(res.body);
    if (links.size === 0) break;

    let newOnPage = 0;
    for (const [sku, prod] of links) {
      if (!allLinks.has(sku)) {
        allLinks.set(sku, prod);
        newOnPage++;
      }
    }

    if (page > 1 && newOnPage === 0) break; // No new products on this page

    const hasMore = hasNextPage(res.body, page);
    if (!hasMore) break;

    page++;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  return { links: allLinks, pages: page };
}

async function main() {
  console.log('=== Hancock & Moore Scraper ===\n');

  // Step 1: Collect all product links from category pages with pagination
  const allProducts = new Map(); // sku -> { path, sku, category }

  for (const cat of CATEGORIES) {
    const { links, pages } = await fetchAllPages(cat.url, cat.category, cat.name);

    let newCount = 0;
    for (const [sku, prod] of links) {
      if (!allProducts.has(sku)) {
        allProducts.set(sku, { ...prod, category: cat.category });
        newCount++;
      }
    }

    const pageInfo = pages > 1 ? ` (${pages} pages)` : '';
    console.log(`  ${cat.name}: ${links.size} products${pageInfo}, +${newCount} new | total: ${allProducts.size}`);
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
          id: `hancock-${prod.sku}`,
          product_name: `Hancock & Moore ${name} ${prod.sku}`,
          vendor_name: 'Hancock & Moore',
          vendor_id: 'hancock-moore',
          sku: prod.sku,
          category,
          collection: detail.collection || '',
          description: detail.description || '',
          material: detail.material || 'Leather',
          image_url: detail.image_url || '',
          product_url: BASE + prod.path,
          dimensions: detail.width && detail.depth && detail.height
            ? `${detail.width}"W x ${detail.depth}"D x ${detail.height}"H` : '',
          width: detail.width ? parseFloat(detail.width) : null,
          depth: detail.depth ? parseFloat(detail.depth) : null,
          height: detail.height ? parseFloat(detail.height) : null,
          price: null,
          in_stock: true,
          source: 'hancock-scraper',
          tags: [
            detail.seat_height ? `seat-height-${detail.seat_height}` : null,
            detail.arm_height ? `arm-height-${detail.arm_height}` : null,
            'leather',
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
=== HANCOCK & MOORE SCRAPER SUMMARY ===
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
