import https from 'node:https';
import http from 'node:http';

const CATEGORIES = [
  { url: 'https://www.leeindustries.com/Product/Category/SOFA-LOVESEAT', category: 'sofas' },
  { url: 'https://www.leeindustries.com/Product/Category/SECTIONAL', category: 'sectionals' },
  { url: 'https://www.leeindustries.com/Product/Category/CHAIR', category: 'accent-chairs' },
  { url: 'https://www.leeindustries.com/Product/Category/SWIVEL-CHAIR', category: 'swivel-chairs' },
  { url: 'https://www.leeindustries.com/Product/Category/DESK-CHAIR', category: 'desk-chairs' },
  { url: 'https://www.leeindustries.com/Product/Category/RELAXOR', category: 'recliners' },
  { url: 'https://www.leeindustries.com/Product/Category/SLEEPER', category: 'sleepers' },
  { url: 'https://www.leeindustries.com/Product/Category/OTTOMAN-BENCH', category: 'ottomans' },
  { url: 'https://www.leeindustries.com/Product/Category/CHAISE', category: 'chaises' },
  { url: 'https://www.leeindustries.com/Product/Category/BED', category: 'beds' },
  { url: 'https://www.leeindustries.com/Product/Category/OUTDOOR', category: 'outdoor' },
  { url: 'https://www.leeindustries.com/Product/Category/DINING', category: 'dining-chairs' },
  { url: 'https://www.leeindustries.com/Product/Category/BAR-STOOL', category: 'bar-stools' },
  { url: 'https://www.leeindustries.com/Product/Category/MCALPINE', category: 'accent-chairs' },
];

const BASE = 'https://www.leeindustries.com';
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
  // Pattern: /Product/Detail/CATEGORY/TYPE/MODEL-NUMBER
  const pattern = /href="(\/Product\/Detail\/([^"]+))"/gi;
  const products = new Map();
  let m;
  while ((m = pattern.exec(html)) !== null) {
    const path = m[1];
    const parts = m[2].split('/');
    // parts: [CATEGORY, SUBCATEGORY, MODEL]
    if (parts.length >= 3) {
      const model = parts[parts.length - 1];
      const subcat = parts[parts.length - 2];
      const key = path; // dedupe by full path
      if (!products.has(key)) {
        products.set(key, { path, model, subcat });
      }
    }
  }
  return products;
}

function extractDetail(html, model) {
  const result = {};

  // Description - look for text content describing the product
  // Lee pages have description text near the model number
  const descPatterns = [
    /(?:description|details?)[:\s]*([^<]{10,200})/i,
    /Same frame as[^<]+/i,
    /(?:featuring|features?)[^<]{5,150}/i,
  ];
  for (const pat of descPatterns) {
    const dm = html.match(pat);
    if (dm) { result.description = dm[0].trim(); break; }
  }

  // Dimensions - "W93 × D37 × H38" or "W32 D32 H35"
  const dimPatterns = [
    /OVERALL[:\s]*W(\d+)\s*[×xX\s]\s*D(\d+)\s*[×xX\s]\s*H(\d+)/i,
    /W(\d+)\s*[×xX]\s*D(\d+)\s*[×xX]\s*H(\d+)/i,
    /W(\d+)\s+D(\d+)\s+H(\d+)/i,
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

  // Inside dimensions
  const insideMatch = html.match(/INSIDE[:\s]*W(\d+)\s*[×xX\s]\s*D(\d+)\s*[×xX\s]\s*H(\d+)/i);
  if (insideMatch) {
    result.inside_dims = `${insideMatch[1]}W x ${insideMatch[2]}D x ${insideMatch[3]}H`;
  }

  // Seat height
  const seatH = html.match(/SEAT\s*HEIGHT[:\s]*(\d+)/i);
  if (seatH) result.seat_height = seatH[1];

  // Arm height
  const armH = html.match(/ARM\s*HEIGHT[:\s]*(\d+)/i);
  if (armH) result.arm_height = armH[1];

  // Back rail height
  const backH = html.match(/BACK\s*RAIL\s*HEIGHT[:\s]*(\d+)/i);
  if (backH) result.back_rail_height = backH[1];

  // Weight
  const weightMatch = html.match(/WEIGHT[:\s]*(\d+)/i);
  if (weightMatch) result.weight = weightMatch[1] + ' lbs';

  // COM yardage
  const comMatch = html.match(/COM\s*PLAIN\s*YARDAGE[:\s]*([\d.]+)/i);
  if (comMatch) result.com_yardage = comMatch[1];

  // Materials - fabric shown in, cushion type
  const materials = [];
  const shownIn = html.match(/(?:Shown\s+in|Shown\s+with)[:\s]*([^<\n]{3,80})/i);
  if (shownIn) materials.push(shownIn[1].trim());
  const cushion = html.match(/naturalLEE|(?:down|spring\s*down|firm)\s*(?:cushion|seat|back)/gi);
  if (cushion) materials.push(...new Set(cushion.map(c => c.trim())));
  const welt = html.match(/(?:mini\s*welt|french\s*welt|self\s*welt|contrast\s*welt|nail\s*head|nailhead)/gi);
  if (welt) materials.push(...new Set(welt.map(w => w.trim())));
  if (comMatch) materials.push(`COM: ${comMatch[1]} yds`);
  if (materials.length) result.material = materials.join('; ');

  // Hero image - Azure blob
  const imgMatch = html.match(/src="(https:\/\/leeprodimage[^"]+)"/i);
  if (imgMatch) {
    result.image_url = imgMatch[1];
  } else {
    // Try relative path
    const relImg = html.match(/src="(\/[^"]*product[^"]*\.jpg[^"]*)"/i);
    if (relImg) result.image_url = BASE + relImg[1];
  }

  // Product name/type from page title or heading
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim();

  // Type from the page - e.g., "SOFA", "CHAIR", etc.
  const typeMatch = html.match(new RegExp(`${model.replace(/[-]/g, '[-\\s]')}\\s+(\\w[\\w\\s&/]+)`, 'i'));
  if (typeMatch) result.product_type = typeMatch[1].trim();

  return result;
}

function inferCategory(subcat, assignedCategory) {
  const s = subcat.toLowerCase().replace(/-/g, ' ');
  if (/sofa|apartment.sofa|extra.long|one.arm.sofa|wedge.sofa|two.cushion.sofa/.test(s)) return 'sofas';
  if (/loveseat|curved.loveseat|armless.loveseat/.test(s)) return 'loveseats';
  if (/sectional/.test(s)) return 'sectionals';
  if (/swivel/.test(s)) return 'swivel-chairs';
  if (/desk.chair/.test(s)) return 'desk-chairs';
  if (/relaxor|recliner/.test(s)) return 'recliners';
  if (/sleeper/.test(s)) return 'sleepers';
  if (/ottoman/.test(s)) return 'ottomans';
  if (/bench/.test(s)) return 'benches';
  if (/chaise/.test(s)) return 'chaises';
  if (/bed|headboard|daybed/.test(s)) return 'beds';
  if (/dining|host/.test(s)) return 'dining-chairs';
  if (/bar.stool|counter.stool|stool/.test(s)) return 'bar-stools';
  if (/chair/.test(s)) return 'accent-chairs';
  if (/outdoor/.test(s)) return 'outdoor';
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
  console.log('=== Lee Industries Scraper ===\n');

  // Step 1: Collect all product links from category pages
  const allProducts = new Map(); // path -> { path, model, subcat, category }

  for (const cat of CATEGORIES) {
    const catName = cat.url.split('/Category/')[1];
    const res = await fetchWithRetry(cat.url);
    if (res.status !== 200) {
      console.log(`  [SKIP] ${catName}: HTTP ${res.status}`);
      continue;
    }

    const links = extractProductLinks(res.body);
    let newCount = 0;
    for (const [key, prod] of links) {
      if (!allProducts.has(key)) {
        allProducts.set(key, { ...prod, category: cat.category });
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

        const detail = extractDetail(res.body, prod.model);
        const category = inferCategory(prod.subcat, prod.category);
        const productType = prod.subcat.replace(/-/g, ' ').replace(/&/g, '&');

        if (!detail.image_url) noImageCount++;

        return {
          id: `lee-${prod.model}`,
          product_name: `Lee Industries ${prod.model} ${productType}`,
          vendor_name: 'Lee Industries',
          vendor_id: 'lee-industries',
          sku: prod.model,
          category,
          collection: detail.title?.includes('McAlpine') ? 'McAlpine for Lee Industries' : '',
          description: [detail.product_type, detail.description].filter(Boolean).join('. ') || productType,
          material: detail.material || '',
          image_url: detail.image_url || '',
          product_url: BASE + prod.path,
          dimensions: detail.width ? `${detail.width}"W x ${detail.depth}"D x ${detail.height}"H` : '',
          width: detail.width ? parseFloat(detail.width) : null,
          depth: detail.depth ? parseFloat(detail.depth) : null,
          height: detail.height ? parseFloat(detail.height) : null,
          price: null,
          in_stock: true,
          source: 'lee-scraper',
          tags: [
            detail.seat_height ? `seat-height-${detail.seat_height}` : null,
            detail.arm_height ? `arm-height-${detail.arm_height}` : null,
            detail.weight || null,
            detail.com_yardage ? `com-${detail.com_yardage}-yds` : null,
            'upholstery',
            'custom-upholstery',
            'com-available',
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
=== LEE INDUSTRIES SCRAPER SUMMARY ===
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
