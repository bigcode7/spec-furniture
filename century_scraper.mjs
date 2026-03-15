/**
 * Century Furniture Scraper
 *
 * Crawls all 32 category listing pages, extracts product links,
 * then fetches each product detail page for full data.
 * Posts batches to the search service catalog.
 */

import https from 'node:https';
import http from 'node:http';

const BASE = 'https://www.centuryfurniture.com';
const SEARCH_SERVICE = 'http://127.0.0.1:4310';
const CONCURRENCY = 5;
const DELAY_MS = 400;
const BATCH_SIZE = 25;

const CATEGORY_URLS = [
  { url: '/products.aspx?TypeID=81', category: 'accent-chairs' },
  { url: '/products.aspx?TypeID=32', category: 'chests' },
  { url: '/products.aspx?TypeID=72', category: 'sofas' },
  { url: '/products.aspx?TypeID=34', category: 'dining-chairs' },
  { url: '/products.aspx?TypeID=134', category: 'beds' },
  { url: '/products.aspx?TypeID=132', category: 'nightstands' },
  { url: '/products.aspx?TypeID=84', category: 'ottomans' },
  { url: '/products.aspx?TypeID=83', category: 'benches' },
  { url: '/products.aspx?TypeID=76', category: 'bar-stools' },
  { url: '/products.aspx?Search=recliner', category: 'recliners' },
  { url: '/products.aspx?search=sectional', category: 'sectionals' },
  { url: '/products.aspx?TypeID=48', category: 'dining-tables' },
  { url: '/products.aspx?TypeID=55', category: 'coffee-tables' },
  { url: '/products.aspx?TypeID=79', category: 'console-tables' },
  { url: '/products.aspx?TypeID=82', category: 'side-tables' },
  { url: '/products.aspx?TypeID=70', category: 'desks' },
  { url: '/products.aspx?TypeID=61', category: 'credenzas' },
  { url: '/products.aspx?TypeID=73', category: 'cabinets' },
  { url: '/products.aspx?TypeID=74', category: 'bookcases' },
  { url: '/products.aspx?TypeID=25', category: 'dressers' },
  { url: '/products.aspx?TypeID=29', category: 'mirrors' },
  { url: '/products.aspx?SubTypeID=82', category: 'chaises' },
  { url: '/products.aspx?TypeID=143', category: 'table-lamps' },
  { url: '/products.aspx?TypeID=137', category: 'chandeliers' },
  { url: '/products.aspx?TypeID=139', category: 'floor-lamps' },
  { url: '/products.aspx?TypeID=140', category: 'pendants' },
  { url: '/products.aspx?TypeID=148', category: 'decorative-objects' },
  { url: '/products.aspx?TypeID=142', category: 'sconces' },
  { url: '/products.aspx?TypeID=141', category: 'table-lamps' },
  { url: '/products.aspx?TypeID=146', category: 'decorative-objects' },
  { url: '/products.aspx?TypeID=138', category: 'chandeliers' },
  { url: '/products.aspx?TypeID=136', category: 'table-lamps' },
];

// ── HTTP helpers ──

function fetchPage(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(url, {
      timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirect = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsedUrl.origin}${res.headers.location}`;
        res.resume();
        return fetchPage(redirect, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Extract product links from listing page ──

function extractProductLinks(html) {
  const links = new Set();
  // Match /product-detail.aspx?sku=XXX
  const regex = /href=["']([^"']*product-detail\.aspx\?sku=[^"'&]+[^"']*?)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    // Clean up — remove &section= if empty
    href = href.replace(/&section=$/, '');
    // Normalize to full URL
    if (href.startsWith('/')) href = BASE + href;
    // Extract just the SKU part for dedup
    links.add(href);
  }
  return [...links];
}

// ── Extract product data from detail page ──

function extractProductData(html, url, fallbackCategory) {
  const product = {
    product_url: url,
    vendor_name: 'Century Furniture',
    vendor_id: 'century-furniture',
    vendor_domain: 'centuryfurniture.com',
    ingestion_source: 'century-scraper',
  };

  // Product name — Century uses <h2> with mismatched </h3>, also try <h1>, <title>, meta description
  const nameMatch = html.match(/<h2[^>]*>([\s\S]*?)<\/h[23]>/i)
    || html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (nameMatch) {
    let name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
    // Often formatted as "SKU - Name", extract just the name
    const skuDash = name.match(/^[A-Z0-9][\w-]+ - (.+)/i);
    if (skuDash) {
      product.sku = name.split(' - ')[0].trim();
      name = skuDash[1].trim();
    }
    product.product_name = name;
  }

  // Fallback: meta description often has "SKU - Name"
  if (!product.product_name) {
    const metaName = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaName) {
      let name = metaName[1].trim();
      const skuDash = name.match(/^[A-Z0-9][\w-]+ - (.+)/i);
      if (skuDash) {
        product.sku = name.split(' - ')[0].trim();
        name = skuDash[1].trim();
      }
      product.product_name = name;
    }
  }

  // SKU — try hidden field first, then from name
  const skuMatch = html.match(/id=["']hSKU["'][^>]*value=["']([^"']+)["']/i)
    || html.match(/name=["']hSKU["'][^>]*value=["']([^"']+)["']/i);
  if (skuMatch) product.sku = skuMatch[1].trim();
  if (!product.sku) {
    const urlSku = url.match(/sku=([^&]+)/i);
    if (urlSku) product.sku = decodeURIComponent(urlSku[1]);
  }

  // Hero image — look for main product image
  // Try og:image first
  const ogImg = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogImg) {
    product.image_url = ogImg[1].startsWith('http') ? ogImg[1] : BASE + ogImg[1];
  }

  // Fallback: look for prod-images in carousel or main image
  if (!product.image_url) {
    const imgMatch = html.match(/src=["']([^"']*prod-images[^"']+)["']/i);
    if (imgMatch) {
      product.image_url = imgMatch[1].startsWith('http') ? imgMatch[1] : BASE + imgMatch[1];
    }
  }

  // Fallback: any large product image
  if (!product.image_url) {
    const imgMatch2 = html.match(/src=["']([^"']+(?:silo|product|hero|large|main)[^"']*\.(?:jpg|jpeg|png|webp))["']/i);
    if (imgMatch2) {
      product.image_url = imgMatch2[1].startsWith('http') ? imgMatch2[1] : BASE + imgMatch2[1];
    }
  }

  // Description — look for meta description or product detail text
  const metaDesc = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)
    || html.match(/content=["']([^"']+)["']\s+name=["']description["']/i);
  if (metaDesc) product.description = metaDesc[1].trim();

  // Also try to find inline description
  if (!product.description || product.description.length < 20) {
    // Look for description paragraphs in product detail area
    const descMatch = html.match(/<div[^>]*class=["'][^"']*product-desc[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
      || html.match(/<div[^>]*id=["']product-details["'][^>]*>([\s\S]*?)<\/div>/i);
    if (descMatch) {
      const cleaned = descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleaned.length > 20) product.description = cleaned;
    }
  }

  // Look for longer description text blocks
  if (!product.description || product.description.length < 30) {
    const pBlocks = html.match(/<p[^>]*>([\s\S]{40,500}?)<\/p>/gi);
    if (pBlocks) {
      for (const p of pBlocks) {
        const text = p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (text.length > 40 && !text.includes('©') && !text.includes('cookie') && !text.includes('Century Furniture')) {
          product.description = text;
          break;
        }
      }
    }
  }

  // Materials/finish
  const materialPatterns = [
    /(?:material|finish|fabric|upholster)[^<:]*[:>]\s*([^<]{5,200})/gi,
    /(?:wood|frame|cover|surface)[^<:]*[:>]\s*([^<]{5,200})/gi,
  ];
  const materials = [];
  for (const pat of materialPatterns) {
    let m;
    while ((m = pat.exec(html)) !== null) {
      const val = m[1].replace(/\s+/g, ' ').trim();
      if (val.length < 200 && !materials.includes(val)) materials.push(val);
    }
  }
  if (materials.length > 0) product.material = materials.join('; ');

  // Also check for specific material markers
  if (!product.material) {
    const matSection = html.match(/(?:Back Type|Seat Type|Back Fill|Seat Fill|Frame)[^<]*<[^>]*>([^<]+)/gi);
    if (matSection) {
      const mats = matSection.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(m => m.length > 3);
      if (mats.length > 0) product.material = mats.join('; ');
    }
  }

  // Dimensions
  const dimPatterns = [
    /W:\s*([\d.]+)\s*(?:in)?[^D]*D:\s*([\d.]+)\s*(?:in)?[^H]*H:\s*([\d.]+)\s*(?:in)?/i,
    /Width:\s*([\d.]+)[^D]*Depth:\s*([\d.]+)[^H]*Height:\s*([\d.]+)/i,
    /([\d.]+)"?\s*[Ww]\s*x\s*([\d.]+)"?\s*[Dd]\s*x\s*([\d.]+)"?\s*[Hh]/i,
    /(\d+(?:-\d+)?)\s*(?:in\s*)?[Ww]\s*[|x]\s*(\d+(?:-\d+)?)\s*(?:in\s*)?[Dd]\s*[|x]\s*(\d+(?:-\d+)?)\s*(?:in\s*)?[Hh]/i,
  ];
  for (const pat of dimPatterns) {
    const dm = html.match(pat);
    if (dm) {
      product.dimensions = `W: ${dm[1]} in x D: ${dm[2]} in x H: ${dm[3]} in`;
      break;
    }
  }

  // Also try a looser dimension pattern
  if (!product.dimensions) {
    const looseDim = html.match(/(\d{2,3}(?:-\d{2,3})?)\s*(?:"|in)?\s*[Ww](?:idth)?\s*[|,x]\s*(\d{2,3}(?:-\d{2,3})?)\s*(?:"|in)?\s*[Dd](?:epth)?\s*[|,x]\s*(\d{2,3}(?:-\d{2,3})?)\s*(?:"|in)?\s*[Hh](?:eight)?/i);
    if (looseDim) {
      product.dimensions = `W: ${looseDim[1]} in x D: ${looseDim[2]} in x H: ${looseDim[3]} in`;
    }
  }

  // Collection
  const collMatch = html.match(/(?:collection|series)[^<:]*[:>]\s*([^<]{3,100})/i);
  if (collMatch) {
    product.collection = collMatch[1].replace(/\s+/g, ' ').trim();
  }
  // Try breadcrumb for collection
  if (!product.collection) {
    const breadcrumb = html.match(/class=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]*?)<\/(?:nav|div|ol|ul)>/i);
    if (breadcrumb) {
      const crumbs = breadcrumb[1].match(/<a[^>]*>([^<]+)<\/a>/gi);
      if (crumbs && crumbs.length >= 2) {
        const lastCrumb = crumbs[crumbs.length - 1].replace(/<[^>]+>/g, '').trim();
        if (lastCrumb.length > 2 && lastCrumb.length < 60) {
          product.collection = lastCrumb;
        }
      }
    }
  }

  // Category — use fallback from listing page
  product.category = fallbackCategory;

  // Try to infer category from product name
  if (product.product_name) {
    const name = product.product_name.toLowerCase();
    if (name.includes('sofa')) product.category = 'sofas';
    else if (name.includes('sectional')) product.category = 'sectionals';
    else if (name.includes('loveseat')) product.category = 'loveseats';
    else if (name.includes('recliner') || name.includes('reclining')) product.category = 'recliners';
    else if (name.includes('swivel')) product.category = 'swivel-chairs';
    else if (name.includes('ottoman')) product.category = 'ottomans';
    else if (name.includes('bench')) product.category = 'benches';
    else if (name.includes('chaise')) product.category = 'chaises';
    else if (name.includes('bar stool') || name.includes('barstool') || name.includes('counter stool')) product.category = 'bar-stools';
    else if (name.includes('dining chair') || name.includes('side chair') || name.includes('host chair')) product.category = 'dining-chairs';
    else if (name.includes('dining table') || name.includes('extension table')) product.category = 'dining-tables';
    else if (name.includes('coffee table') || name.includes('cocktail table')) product.category = 'coffee-tables';
    else if (name.includes('console') && !name.includes('media')) product.category = 'console-tables';
    else if (name.includes('end table') || name.includes('side table') || name.includes('accent table') || name.includes('drink table')) product.category = 'side-tables';
    else if (name.includes('nightstand') || name.includes('night table') || name.includes('bedside')) product.category = 'nightstands';
    else if (name.includes('desk')) product.category = 'desks';
    else if (name.includes('credenza') || name.includes('sideboard') || name.includes('buffet')) product.category = 'credenzas';
    else if (name.includes('bookcase') || name.includes('etagere') || name.includes('shelf')) product.category = 'bookcases';
    else if (name.includes('cabinet') || name.includes('hutch')) product.category = 'cabinets';
    else if (name.includes('media console') || name.includes('tv ')) product.category = 'media-consoles';
    else if (name.includes('dresser')) product.category = 'dressers';
    else if (name.includes('chest')) product.category = 'chests';
    else if (name.includes('mirror')) product.category = 'mirrors';
    else if (name.includes('bed') && !name.includes('bedside') && !name.includes('bedroom')) product.category = 'beds';
    else if (name.includes('headboard')) product.category = 'headboards';
    else if (name.includes('chandelier')) product.category = 'chandeliers';
    else if (name.includes('pendant')) product.category = 'pendants';
    else if (name.includes('sconce')) product.category = 'sconces';
    else if (name.includes('floor lamp')) product.category = 'floor-lamps';
    else if (name.includes('table lamp') || name.includes('lamp')) product.category = 'table-lamps';
  }

  // Generate ID
  product.id = `century-furniture_${(product.sku || product.product_name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)}`;

  return product;
}

// ── Post products to search service ──

function postProducts(products) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ products, vendor_id: 'century-furniture' });
    const req = http.request(`${SEARCH_SERVICE}/catalog/insert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 30000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ ok: false, raw: body });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('POST timeout')); });
    req.write(data);
    req.end();
  });
}

// ── Process items with concurrency limit ──

async function processConcurrent(items, fn, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      try {
        results[i] = await fn(items[i], i);
      } catch (err) {
        results[i] = { error: err.message };
      }
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }
  }

  const workers = [];
  for (let w = 0; w < concurrency; w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// ── Main ──

async function main() {
  console.log('=== Century Furniture Scraper ===\n');

  // Phase 1: Collect all product links from listing pages
  const allLinks = new Map(); // url -> category
  let totalListingProducts = 0;

  console.log('Phase 1: Collecting product links from 32 category pages...\n');

  for (const { url, category } of CATEGORY_URLS) {
    const fullUrl = BASE + url;
    try {
      const html = await fetchPage(fullUrl);
      const links = extractProductLinks(html);
      let newCount = 0;
      for (const link of links) {
        if (!allLinks.has(link)) {
          allLinks.set(link, category);
          newCount++;
        }
      }
      totalListingProducts += links.length;
      console.log(`  ${category.padEnd(20)} ${links.length.toString().padStart(4)} products (${newCount} new) | ${url}`);
      await sleep(300);
    } catch (err) {
      console.error(`  ERROR ${category}: ${err.message}`);
    }
  }

  console.log(`\nPhase 1 complete: ${allLinks.size} unique product links (${totalListingProducts} total across categories)\n`);

  // Phase 2: Fetch each product detail page
  console.log('Phase 2: Fetching product detail pages...\n');

  const productEntries = [...allLinks.entries()]; // [url, category]
  const products = [];
  let fetched = 0;
  let failed = 0;

  const results = await processConcurrent(
    productEntries,
    async ([url, category], idx) => {
      try {
        const html = await fetchPage(url);
        const product = extractProductData(html, url, category);

        if (!product.product_name || product.product_name.length < 2) {
          failed++;
          if (failed <= 5) console.error(`  NO NAME: ${url} (html len: ${html.length})`);
          return null;
        }

        fetched++;
        if (fetched % 200 === 0 || fetched === 1 || fetched === 50) {
          console.log(`  [${fetched}/${productEntries.length}] ${product.product_name} | ${product.category} | img: ${product.image_url ? 'YES' : 'NO'}`);
        }

        return product;
      } catch (err) {
        failed++;
        if (failed <= 15) console.error(`  FAIL [${failed}]: ${url} — ${err.message}`);
        return null;
      }
    },
    CONCURRENCY,
  );

  const validProducts = results.filter(Boolean);
  console.log(`\nPhase 2 complete: ${validProducts.length} products fetched, ${failed} failed\n`);

  // Deduplicate by SKU and URL
  const seen = new Set();
  const deduped = [];
  for (const p of validProducts) {
    const key = p.sku || p.product_url;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }
  console.log(`After dedup: ${deduped.length} unique products\n`);

  // Phase 3: Post to search service in batches
  console.log('Phase 3: Posting to search service...\n');

  let posted = 0;
  let insertedTotal = 0;
  let updatedTotal = 0;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    try {
      const result = await postProducts(batch);
      insertedTotal += result.inserted || 0;
      updatedTotal += result.updated || 0;
      posted += batch.length;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} products → inserted: ${result.inserted || 0}, updated: ${result.updated || 0}`);
    } catch (err) {
      console.error(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} FAILED: ${err.message}`);
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Category pages crawled:  32`);
  console.log(`Product links found:     ${allLinks.size}`);
  console.log(`Products fetched:        ${validProducts.length}`);
  console.log(`Products after dedup:    ${deduped.length}`);
  console.log(`Posted to catalog:       ${posted}`);
  console.log(`  New inserts:           ${insertedTotal}`);
  console.log(`  Updates:               ${updatedTotal}`);
  console.log(`  Failed fetches:        ${failed}`);

  // Category breakdown
  const catCounts = {};
  for (const p of deduped) {
    catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  }
  console.log('\nCategory breakdown:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(5)}  ${cat}`);
  }

  // Sample products
  console.log('\nSample products:');
  for (const p of deduped.slice(0, 10)) {
    console.log(`  ${p.product_name} | ${p.category} | ${p.sku || 'no-sku'} | img: ${p.image_url ? 'YES' : 'NO'}`);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
