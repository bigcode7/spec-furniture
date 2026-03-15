import https from 'node:https';
import http from 'node:http';

const BASE = 'https://caracole.com';
const SEARCH_SERVICE = 'http://localhost:4310';
const CONCURRENCY = 5;
const DELAY_MS = 200;

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
  if (/sofa/.test(type)) return 'sofas';
  if (/loveseat|settee/.test(text)) return 'loveseats';
  if (/chaise/.test(text)) return 'chaises';
  if (/swivel/.test(text)) return 'swivel-chairs';
  if (/dining\s*chair/.test(type)) return 'dining-chairs';
  if (/accent\s*chair|lounge\s*chair|club\s*chair/.test(type)) return 'accent-chairs';
  if (/chair/.test(type)) return 'accent-chairs';
  if (/ottoman/.test(text)) return 'ottomans';
  if (/bench/.test(text)) return 'benches';
  if (/stool|bar\s*stool|counter\s*stool/.test(text)) return 'bar-stools';
  if (/recliner/.test(text)) return 'recliners';
  if (/cocktail|coffee\s*table/.test(text)) return 'coffee-tables';
  if (/console|sofa.*table/.test(type)) return 'console-tables';
  if (/dining\s*table/.test(type)) return 'dining-tables';
  if (/end\s*table|side\s*table|accent\s*table|spot\s*table/.test(text)) return 'side-tables';
  if (/nesting/.test(text)) return 'side-tables';
  if (/nightstand|bedside/.test(text)) return 'nightstands';
  if (/desk|writing\s*table/.test(text)) return 'desks';
  if (/\bbed\b|headboard/.test(text)) return 'beds';
  if (/dresser/.test(text)) return 'dressers';
  if (/chest/.test(text)) return 'chests';
  if (/mirror/.test(text)) return 'mirrors';
  if (/credenza|sideboard|buffet/.test(text)) return 'credenzas';
  if (/entertainment|media\s*console/.test(text)) return 'media-consoles';
  if (/cabinet|bookcase|etagere|display|bar\s*cabinet/.test(text)) return 'bookcases';
  if (/lamp|light|chandelier|sconce|pendant/.test(text)) return 'table-lamps';
  if (/table/.test(text)) return 'side-tables';
  if (/chair/.test(text)) return 'accent-chairs';
  return 'decorative-objects';
}

function extractDetailFromPage(html) {
  const result = {};

  // Dimensions: "21W X 24.25D X 39.75H" or "86W × 39D × 33H"
  const dimMatch = html.match(/([\d.]+)\s*W\s*(?:X|×|x)\s*([\d.]+)\s*D\s*(?:X|×|x)\s*([\d.]+)\s*H/);
  if (dimMatch) {
    result.width = dimMatch[1];
    result.depth = dimMatch[2];
    result.height = dimMatch[3];
  }

  // Seat height: "SH: 19" or "Seat Height: 19"
  const shMatch = html.match(/(?:SH|Seat\s*Height)[:\s]*([\d.]+)/i);
  if (shMatch) result.seat_height = shMatch[1];

  // Arm height
  const ahMatch = html.match(/(?:AH|Arm\s*Height)[:\s]*([\d.]+)/i);
  if (ahMatch) result.arm_height = ahMatch[1];

  // Features section - between FEATURES and next section or closing tag
  const featMatch = html.match(/FEATURES[\s\S]*?(?=CONSTRUCTION|MATERIALS|Read more|<\/div>\s*<\/div>\s*<\/div>)/i);
  if (featMatch) {
    const features = featMatch[0].replace(/<[^>]+>/g, ' ').replace(/FEATURES/i, '').replace(/\s+/g, ' ').trim();
    if (features.length > 5) result.features = features.slice(0, 300);
  }

  // Construction section
  const constMatch = html.match(/CONSTRUCTION[\s\S]*?(?=MATERIALS|Read more|<\/div>\s*<\/div>\s*<\/div>)/i);
  if (constMatch) {
    const construction = constMatch[0].replace(/<[^>]+>/g, ' ').replace(/CONSTRUCTION/i, '').replace(/\s+/g, ' ').trim();
    if (construction.length > 5) result.construction = construction.slice(0, 300);
  }

  // Materials from features + construction
  const materials = [];
  const fullText = (result.features || '') + ' ' + (result.construction || '');
  if (/mahogany/i.test(fullText)) materials.push('Mahogany');
  if (/walnut/i.test(fullText)) materials.push('Walnut');
  if (/oak/i.test(fullText)) materials.push('Oak');
  if (/maple/i.test(fullText)) materials.push('Maple');
  if (/birch/i.test(fullText)) materials.push('Birch');
  if (/metal/i.test(fullText)) materials.push('Metal');
  if (/brass/i.test(fullText)) materials.push('Brass');
  if (/stainless/i.test(fullText)) materials.push('Stainless Steel');
  if (/marble/i.test(fullText)) materials.push('Marble');
  if (/glass/i.test(fullText)) materials.push('Glass');
  if (/stone/i.test(fullText)) materials.push('Stone');
  if (/leather/i.test(fullText)) materials.push('Leather');
  if (/velvet/i.test(fullText)) materials.push('Velvet');
  if (/linen/i.test(fullText)) materials.push('Linen');
  if (/acrylic/i.test(fullText)) materials.push('Acrylic');
  if (/lacquer/i.test(fullText)) materials.push('Lacquer');
  if (/rattan/i.test(fullText)) materials.push('Rattan');
  if (/wicker/i.test(fullText)) materials.push('Wicker');
  if (/8-way hand tied/i.test(fullText)) materials.push('8-way hand tied');
  if (/spring\s*down/i.test(fullText)) materials.push('Spring down cushion');
  if (/feather/i.test(fullText)) materials.push('Feather down');

  // Finish from features
  const finishMatch = fullText.match(/(?:finish(?:ed)?|in)\s+(?:in\s+)?([A-Z][A-Za-z\s]+?)(?:\.|,|$)/);
  if (finishMatch && finishMatch[1].length < 50) materials.push('Finish: ' + finishMatch[1].trim());

  if (materials.length) result.material = materials.join('; ');

  // Collection from page
  const collMatch = html.match(/collection['"]*\s*:\s*['"]([^'"]+)/i);
  if (collMatch) result.collection = collMatch[1];

  return result;
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
  console.log('=== Caracole Scraper ===\n');

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

    for (const p of data.products) {
      const handle = p.handle;
      if (!allProducts.has(handle)) {
        allProducts.set(handle, p);
      }
    }

    console.log(`  Page ${page}: ${data.products.length} products | total unique: ${allProducts.size}`);
    if (data.products.length < 250) break;
    page++;
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  console.log(`\n━━━ SHOPIFY API: ${allProducts.size} unique products ━━━\n`);

  // Step 2: Fetch detail pages for dimensions/materials
  console.log('Step 2: Fetching detail pages for dimensions & materials...');
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
          // Still use Shopify data without detail
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
=== CARACOLE SCRAPER SUMMARY ===
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

function buildProduct(shopifyProd, detail) {
  const sku = shopifyProd.variants?.[0]?.sku || shopifyProd.handle || '';
  const title = shopifyProd.title || '';
  const category = inferCategory(shopifyProd.product_type, title, shopifyProd.tags);

  // Image: use first image from Shopify
  let imageUrl = '';
  if (shopifyProd.images && shopifyProd.images.length > 0) {
    imageUrl = shopifyProd.images[0].src || '';
  }

  // Description from Shopify body_html
  const description = (shopifyProd.body_html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

  // Price
  const price = shopifyProd.variants?.[0]?.price ? parseFloat(shopifyProd.variants[0].price) : null;

  // Collection from tags
  let collection = detail.collection || '';
  if (!collection) {
    // Try to extract collection from tags — skip generic ones
    const skipTags = new Set(['whole sku', 'dining chairs', 'dining room', 'living room', 'bedroom',
      'sofas', 'chairs', 'tables', 'beds', 'nightstands', 'sectionals', 'benches', 'ottomans',
      'dressers', 'accent chairs', 'coffee & cocktail tables', 'end tables', 'sofa & console tables',
      'dining tables', 'bar cabinets', 'sideboards & buffets', 'entertainment consoles',
      'desks', 'mirrors', 'chests', 'etageres', 'outdoor', 'bar & counter stools']);
    for (const tag of (shopifyProd.tags || [])) {
      const lower = tag.toLowerCase();
      if (skipTags.has(lower)) continue;
      if (/^(?:spring|fall|summer|winter|new)\s+\d{4}/i.test(tag)) continue;
      if (/^\d{4}/.test(tag)) continue;
      // Likely a collection name
      if (tag.length >= 3 && tag.length <= 30 && /^[A-Z]/.test(tag)) {
        collection = tag;
        break;
      }
    }
  }

  // Material from detail page or features
  let material = detail.material || '';

  // Dimensions from detail page
  const width = detail.width ? parseFloat(detail.width) : null;
  const depth = detail.depth ? parseFloat(detail.depth) : null;
  const height = detail.height ? parseFloat(detail.height) : null;
  const dimensions = width && depth && height
    ? `${detail.width}"W x ${detail.depth}"D x ${detail.height}"H` : '';

  const tags = ['luxury', 'trade', 'modern-glam'];
  if (detail.seat_height) tags.push(`seat-height-${detail.seat_height}`);
  if (detail.arm_height) tags.push(`arm-height-${detail.arm_height}`);
  if (shopifyProd.variants?.[0]?.available) tags.push('in-stock');
  if (/outdoor/i.test((shopifyProd.tags || []).join(' '))) tags.push('outdoor');

  return {
    id: `caracole-${sku || shopifyProd.handle}`,
    product_name: `Caracole ${title}${sku ? ' ' + sku : ''}`,
    vendor_name: 'Caracole',
    vendor_id: 'caracole',
    sku,
    category,
    collection,
    description,
    material,
    image_url: imageUrl,
    product_url: `${BASE}/products/${shopifyProd.handle}`,
    dimensions,
    width,
    depth,
    height,
    price,
    in_stock: shopifyProd.variants?.[0]?.available || false,
    source: 'caracole-scraper',
    tags,
  };
}

main().catch(e => console.error(e));
