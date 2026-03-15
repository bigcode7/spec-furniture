import https from 'node:https';
import http from 'node:http';

const SECTIONS = [
  { base: 'https://theodorealexander.com/item/category/room/value/living-room', maxPage: 44, name: 'Living Room', category: 'accent-chairs' },
  { base: 'https://theodorealexander.com/item/category/room/value/dining-room', maxPage: 21, name: 'Dining Room', category: 'dining-chairs' },
  { base: 'https://theodorealexander.com/item/category/room/value/bedroom', maxPage: 18, name: 'Bedroom', category: 'beds' },
  { base: 'https://theodorealexander.com/item/category/room/value/office', maxPage: 5, name: 'Office', category: 'desks' },
  { base: 'https://theodorealexander.com/item/category/room/value/lighting', maxPage: 5, name: 'Lighting', category: 'table-lamps' },
  { base: 'https://theodorealexander.com/item/category/collection/value/art-by-ta', maxPage: 31, name: 'Art Collection', category: 'decorative-objects' },
];

const BASE = 'https://theodorealexander.com';
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
  // Pattern: /item/product-detail/name-sku
  const pattern = /href="(\/item\/product-detail\/([^"]+))"/gi;
  const products = new Map();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1];
    const slug = m[2];
    if (!products.has(slug)) {
      products.set(slug, { path, slug });
    }
  }
  return products;
}

function extractDetail(html, slug) {
  const result = {};

  // Parse the JSON itemDto embedded in the page
  const jsonMatch = html.match(/var\s+itemDto\s*=\s*(\{[\s\S]+?\});\s*(?:<\/script>|var\s)/);
  if (jsonMatch) {
    try {
      const dto = JSON.parse(jsonMatch[1]);
      result.name = dto.productName || '';
      result.sku = dto.sku || '';
      result.description = (dto.extendedDescription || dto.description || '').replace(/<[^>]+>/g, '').slice(0, 300);
      result.collection = dto.collection?.name || '';
      result.width = dto.widthInch || '';
      result.depth = dto.depthInch || '';
      result.height = dto.heightInch || '';
      result.seat_height = dto.chairSeatHeightInch || '';
      result.arm_height = dto.chairArmHeightInch || '';
      result.material = dto.materialList || '';
      if (dto.finishName) result.material += '; Finish: ' + dto.finishName.trim();
      result.image_url = dto.imageUrl || dto.image || '';
      result.price = dto.price || null;
      result.room = dto.roomAndUsage?.name || '';
      result.type = dto.type?.name || '';
      result.in_stock = dto.isStocked || false;
      return result;
    } catch (e) {
      // Fall through to regex extraction
    }
  }

  // Fallback: regex extraction
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1) result.name = h1[1].trim();

  const skuMatch = slug.match(/([a-z]{1,4}\d{4,5}[-\w]*)$/i);
  if (skuMatch) result.sku = skuMatch[1].toUpperCase();

  const imgMatch = html.match(/src="(https:\/\/theodorealexander\.sirv\.com\/[^"]+_main_1\.jpg)"/i);
  if (imgMatch) result.image_url = imgMatch[1];
  else if (result.sku) result.image_url = `https://theodorealexander.sirv.com/ProductPhotos/TA/${result.sku}_main_1.jpg`;

  return result;
}

function inferCategory(name, slug, sectionCategory) {
  const text = `${name || ''} ${slug}`.toLowerCase();
  // Art
  if (/\bart\b|painting|print|canvas|artwork|frame/.test(text) && sectionCategory === 'decorative-objects') return 'decorative-objects';
  // Seating
  if (/sectional/.test(text)) return 'sectionals';
  if (/sofa/.test(text)) return 'sofas';
  if (/loveseat|settee/.test(text)) return 'loveseats';
  if (/swivel/.test(text)) return 'swivel-chairs';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/chaise/.test(text)) return 'chaises';
  if (/recliner/.test(text)) return 'recliners';
  if (/stool/.test(text)) return 'bar-stools';
  // Tables
  if (/cocktail|coffee/.test(text)) return 'coffee-tables';
  if (/console/.test(text)) return 'console-tables';
  if (/side\s*table|end\s*table|lamp\s*table|accent\s*table/.test(text)) return 'side-tables';
  if (/dining\s*table/.test(text)) return 'dining-tables';
  if (/dining\s*chair|host|side\s*chair/.test(text)) return 'dining-chairs';
  if (/desk/.test(text)) return 'desks';
  // Bedroom
  if (/bed\b/.test(text)) return 'beds';
  if (/nightstand|night\s*table|bedside/.test(text)) return 'nightstands';
  if (/dresser/.test(text)) return 'dressers';
  if (/mirror/.test(text)) return 'mirrors';
  // Storage
  if (/chest/.test(text)) return 'chests';
  if (/cabinet|bookcase|etagere|display/.test(text)) return 'bookcases';
  if (/credenza|buffet|sideboard/.test(text)) return 'credenzas';
  if (/media|tv/.test(text)) return 'media-consoles';
  // Lighting
  if (/lamp|light|sconce|chandelier|pendant/.test(text)) return 'table-lamps';
  // Chairs
  if (/chair/.test(text)) return 'accent-chairs';
  if (/table/.test(text)) return 'side-tables';
  return sectionCategory;
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
    if (posted % 200 === 0 || posted === products.length) {
      console.log(`  Posted: ${posted}/${products.length}`);
    }
  }
}

async function main() {
  console.log('=== Theodore Alexander Scraper ===\n');

  const allProducts = new Map();

  for (const section of SECTIONS) {
    const sectionStart = allProducts.size;
    let emptyPages = 0;

    for (let page = 1; page <= section.maxPage; page++) {
      const url = `${section.base}?page=${page}`;
      const res = await fetchWithRetry(url);
      if (!res || res.status !== 200) {
        emptyPages++;
        if (emptyPages >= 3) break; // 3 consecutive failures = stop
        continue;
      }

      const links = extractProductLinks(res.body);
      if (links.size === 0) {
        emptyPages++;
        if (emptyPages >= 3) break;
        continue;
      }
      emptyPages = 0;

      let newOnPage = 0;
      for (const [slug, prod] of links) {
        if (!allProducts.has(slug)) {
          allProducts.set(slug, { ...prod, category: section.category });
          newOnPage++;
        }
      }

      if (page % 10 === 0 || page === section.maxPage) {
        console.log(`    ${section.name} page ${page}/${section.maxPage}: ${links.size} on page, total unique: ${allProducts.size}`);
      }

      await new Promise(r => setTimeout(r, DELAY_MS));
    }

    const sectionNew = allProducts.size - sectionStart;
    console.log(`  ${section.name}: +${sectionNew} new products (${section.maxPage} pages) | total: ${allProducts.size}`);
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

        const detail = extractDetail(res.body, prod.slug);
        const name = detail.name || prod.slug.replace(/-/g, ' ');
        const sku = detail.sku || '';
        const category = inferCategory(name, prod.slug, prod.category);

        if (!detail.image_url) noImageCount++;

        return {
          id: `theodore-${sku || prod.slug}`,
          product_name: `Theodore Alexander ${name}${sku ? ' ' + sku : ''}`,
          vendor_name: 'Theodore Alexander',
          vendor_id: 'theodore-alexander',
          sku,
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
          price: detail.price || null,
          in_stock: true,
          source: 'theodore-scraper',
          tags: ['luxury', 'trade'].filter(Boolean),
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
  const withCollection = detailedProducts.filter(p => p.collection).length;

  const byCat = {};
  for (const p of detailedProducts) byCat[p.category] = (byCat[p.category] || 0) + 1;

  console.log(`
============================================================
=== THEODORE ALEXANDER SCRAPER SUMMARY ===
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
