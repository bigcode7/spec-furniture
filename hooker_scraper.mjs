import http from 'http';
import https from 'https';

const SEARCH_SERVICE = 'http://127.0.0.1:4310/catalog/insert';
const BATCH_SIZE = 25;
const CONCURRENCY = 5; // Parallel product page fetches
const DELAY_MS = 400; // Delay between batches of fetches

const CATEGORIES = [
  { url: 'https://hookerfurnishings.com/living/seating?page=PAGE', maxPage: 26, expected: 1239, cat: 'sofas', room: 'living' },
  { url: 'https://hookerfurnishings.com/bedroom?page=PAGE', maxPage: 10, expected: 442, cat: 'beds', room: 'bedroom' },
  { url: 'https://hookerfurnishings.com/dining?page=PAGE', maxPage: 9, expected: 423, cat: 'dining-tables', room: 'dining' },
  { url: 'https://hookerfurnishings.com/outdoor?page=PAGE', maxPage: 12, expected: 557, cat: 'sofas', room: 'outdoor' },
  { url: 'https://hookerfurnishings.com/office?page=PAGE', maxPage: 6, expected: 280, cat: 'desks', room: 'workspace' },
  { url: 'https://hookerfurnishings.com/living/accents?page=PAGE', maxPage: 15, expected: 674, cat: 'side-tables', room: 'living' },
];

// ── HTTP helpers ──

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 30000,
    }, (res) => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve, reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function postJSON(url, data) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = JSON.stringify(data);
    const req = http.request({
      hostname: parsed.hostname, port: parsed.port, path: parsed.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: 30000,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Category inference from product name ──

function inferCategory(name, defaultCat) {
  const n = name.toLowerCase();
  if (/\bsofa\b/.test(n)) return 'sofas';
  if (/\bsectional\b/.test(n)) return 'sectionals';
  if (/\bloveseat\b|\blove seat\b/.test(n)) return 'loveseats';
  if (/\bswivel\b.*\bchair\b/.test(n)) return 'swivel-chairs';
  if (/\brecliner\b|\breclining\b|\blounger\b/.test(n)) return 'recliners';
  if (/\baccent\s*chair\b|\blounge\s*chair\b|\bclub\s*chair\b|\bwing\b.*\bchair\b/.test(n)) return 'accent-chairs';
  if (/\bdining\b.*\bchair\b|\bside\s*chair\b|\barm\s*chair\b|\bhost\b.*\bchair\b/.test(n)) return 'dining-chairs';
  if (/\bbar\s*stool\b|\bcounter\s*stool\b|\bstool\b/.test(n)) return 'bar-stools';
  if (/\bottoman\b|\bpouf\b|\bcocktail\s*ottoman\b/.test(n)) return 'ottomans';
  if (/\bbench\b/.test(n)) return 'benches';
  if (/\bchaise\b/.test(n)) return 'chaises';
  if (/\bbed\b/.test(n)) return 'beds';
  if (/\bheadboard\b/.test(n)) return 'headboards';
  if (/\bnightstand\b|\bnight\s*table\b|\bbedside\b/.test(n)) return 'nightstands';
  if (/\bdresser\b/.test(n)) return 'dressers';
  if (/\bchest\b/.test(n)) return 'chests';
  if (/\bwardrobe\b|\barmoire\b/.test(n)) return 'wardrobes';
  if (/\bmirror\b/.test(n)) return 'mirrors';
  if (/\bdining\b.*\btable\b/.test(n)) return 'dining-tables';
  if (/\bcoffee\b.*\btable\b|\bcocktail\b.*\btable\b/.test(n)) return 'coffee-tables';
  if (/\bconsole\b.*\btable\b|\bconsole\b/.test(n)) return 'console-tables';
  if (/\bside\b.*\btable\b|\bend\b.*\btable\b|\baccent\b.*\btable\b|\bmartini\b/.test(n)) return 'side-tables';
  if (/\bdesk\b/.test(n)) return 'desks';
  if (/\bcredenza\b|\bsideboard\b|\bbuffet\b|\bserver\b/.test(n)) return 'credenzas';
  if (/\bmedia\b.*\bconsole\b|\btv\b/.test(n)) return 'media-consoles';
  if (/\bbookcase\b|\bshelf\b|\betagere\b|\bshelving\b/.test(n)) return 'bookcases';
  if (/\bcabinet\b|\bhutch\b/.test(n)) return 'cabinets';
  if (/\bfloor\b.*\blamp\b/.test(n)) return 'floor-lamps';
  if (/\btable\b.*\blamp\b|\bdesk\b.*\blamp\b|\blamp\b/.test(n)) return 'table-lamps';
  if (/\btable\b/.test(n)) return 'side-tables';
  if (/\bchair\b/.test(n)) return 'accent-chairs';
  return defaultCat;
}

// ── Extract product links from listing page HTML ──

function extractProductLinks(html) {
  const products = [];
  // Match <a> tags with hookerfurnishings.com product URLs
  // Pattern: links to product pages (not category pages)
  const linkRegex = /<a[^>]*href="(https:\/\/hookerfurnishings\.com\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const seen = new Set();

  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1];
    const innerHtml = match[2];

    // Skip category/navigation links
    if (url.includes('?page=') || url.includes('/living/') || url.includes('/bedroom') ||
        url.includes('/dining') || url.includes('/outdoor') || url.includes('/office') ||
        url.includes('/about') || url.includes('/contact') || url.includes('/account') ||
        url.includes('/cart') || url.includes('/search') || url.includes('/collections') ||
        url.endsWith('hookerfurnishings.com/') || url.endsWith('hookerfurnishings.com')) continue;

    // Must look like a product URL (has a slug)
    const slug = url.replace('https://hookerfurnishings.com/', '');
    if (!slug || slug.includes('/') || slug.length < 5) continue;

    if (seen.has(url)) continue;
    seen.add(url);

    // Try to extract product name from inner text
    const textOnly = innerHtml.replace(/<[^>]+>/g, '').trim();

    products.push({ url, name: textOnly || slug });
  }

  return products;
}

// ── Extract SKU from listing page for a given URL ──

function extractSkuFromListing(html, productUrl) {
  // SKU often appears near the product link
  const idx = html.indexOf(productUrl);
  if (idx === -1) return '';
  // Look at surrounding 500 chars for SKU-like text
  const context = html.substring(idx, idx + 500);
  // Common SKU patterns for Hooker
  const skuMatch = context.match(/([A-Z]{2,4}[-]?[\d]{3,}[-\w]*)/);
  return skuMatch ? skuMatch[1] : '';
}

// ── Extract product details from product page HTML ──

function extractProductDetails(html, productUrl) {
  const details = { url: productUrl };

  // Product name - look for <h1> or og:title
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                       html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
  let rawName = ogTitleMatch ? ogTitleMatch[1] : (h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '');
  details.name = rawName.replace(/\s*[-|]\s*Hooker Furnishings.*$/i, '').trim();

  // Description - og:description or meta description
  const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) ||
                      html.match(/<meta\s+content="([^"]+)"\s+property="og:description"/i);
  const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  details.description = ogDescMatch ? ogDescMatch[1] : (metaDescMatch ? metaDescMatch[1] : '');

  // Image - og:image
  const ogImgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                     html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
  details.image = ogImgMatch ? ogImgMatch[1] : '';

  // If no og:image, try first product image in HTML
  if (!details.image) {
    const imgMatch = html.match(/<img[^>]*src="(https:\/\/[^"]*hookerfurnishings[^"]*(?:\.jpg|\.png|\.webp)[^"]*)"/i) ||
                     html.match(/<img[^>]*src="([^"]*(?:silo|product)[^"]*(?:\.jpg|\.png|\.webp)[^"]*)"/i);
    if (imgMatch) details.image = imgMatch[1];
  }

  // SKU - look for various patterns
  const skuPatterns = [
    /SKU[:\s]*([A-Z0-9][-A-Z0-9]+)/i,
    /Item\s*#?[:\s]*([A-Z0-9][-A-Z0-9]+)/i,
    /Product\s*(?:Number|Code|ID)[:\s]*([A-Z0-9][-A-Z0-9]+)/i,
    /"sku"\s*:\s*"([^"]+)"/i,
  ];
  for (const pat of skuPatterns) {
    const m = html.match(pat);
    if (m) { details.sku = m[1]; break; }
  }
  if (!details.sku) details.sku = '';

  // Price - MSRP (format: "MSRP Price: 4287<br>")
  const priceMatch = html.match(/MSRP Price:\s*([\d,]+(?:\.\d+)?)/i) ||
                     html.match(/MSRP[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  details.price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : null;

  // Dimensions (format: "Height: 46<br>Width: 36.5<br>Depth: 40<br>")
  // Use the standalone values (not Carton Height, Seat Height, etc.)
  const w = html.match(/(?:<br>|^)Width:\s*([\d.]+)/i) || html.match(/Width:\s*([\d.]+)<br>/i);
  const d = html.match(/(?:<br>|^)Depth:\s*([\d.]+)/i) || html.match(/Depth:\s*([\d.]+)<br>/i);
  const h = html.match(/(?:<br>|^)Height:\s*([\d.]+)/i) || html.match(/Height:\s*([\d.]+)<br>/i);
  details.dimensions = '';
  if (w || d || h) {
    const parts = [];
    if (w) parts.push(`W${w[1]}"`);
    if (d) parts.push(`D${d[1]}"`);
    if (h) parts.push(`H${h[1]}"`);
    details.dimensions = parts.join(' x ');
    details.width = w ? parseFloat(w[1]) : null;
    details.depth = d ? parseFloat(d[1]) : null;
    details.height = h ? parseFloat(h[1]) : null;
  }

  // Materials (format: "Leather: Aniline Plus<br>" or "Frame: hardwood<br>")
  const materials = [];
  const matPatterns = [
    /Leather:\s*([^<\n]{3,100})/i,
    /Fabric:\s*([^<\n]{3,100})/i,
    /Frame:\s*([^<\n]{3,100})/i,
    /Material[s]?:\s*([^<\n]{3,100})/i,
    /Wood:\s*([^<\n]{3,100})/i,
    /Finish:\s*([^<\n]{3,100})/i,
  ];
  for (const pat of matPatterns) {
    const m = html.match(pat);
    if (m && m[1].trim().length > 2) materials.push(m[1].trim());
  }
  details.material = materials.join('; ');

  // Collection (format: "Suite: Alta<br>" or "Marketing Collection Name: Alta<br>")
  const collMatch = html.match(/Suite:\s*([^<\n]{2,60})/i) ||
                    html.match(/Marketing Collection Name:\s*([^<\n]{2,60})/i) ||
                    html.match(/Collection[:\s]*([^<\n]{3,60})/i);
  details.collection = collMatch ? collMatch[1].replace(/^Name:\s*/i, '').trim() : '';

  // Sub Type (format: "Sub Type: Recliners<br>")
  const subTypeMatch = html.match(/Sub Type:\s*([^<\n]{2,60})/i) ||
                       html.match(/Type:\s*([^<\n]{2,60})/i);
  details.subType = subTypeMatch ? subTypeMatch[1].trim() : '';

  // Category breadcrumb
  const breadcrumbMatch = html.match(/(?:Living|Bedroom|Dining|Outdoor|Office)\s*>\s*([^<>\n]+?)(?:<|$)/i);
  details.breadcrumb = breadcrumbMatch ? breadcrumbMatch[1].trim() : '';

  return details;
}

// ── Parallel fetch with concurrency limit ──

async function fetchParallel(urls, concurrency, fetchFn) {
  const results = [];
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fetchFn));
    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
    if (i + concurrency < urls.length) await sleep(DELAY_MS);
  }
  return results;
}

// ── Scrape one category ──

async function scrapeCategory(catConfig) {
  const allLinks = new Map(); // url -> {url, name}

  // Phase 1: Collect all product links from listing pages
  for (let page = 1; page <= catConfig.maxPage; page++) {
    const url = catConfig.url.replace('PAGE', String(page));
    try {
      const html = await fetchPage(url);
      const links = extractProductLinks(html);

      const sizeBefore = allLinks.size;
      for (const link of links) {
        if (!allLinks.has(link.url)) allLinks.set(link.url, link);
      }
      const newCount = allLinks.size - sizeBefore;
      process.stdout.write(`  Listing p${page}: ${links.length} links, ${newCount} new (${allLinks.size} total)\n`);

      if (links.length === 0 && page > 1) {
        process.stdout.write(`  Empty listing page — stopping pagination\n`);
        break;
      }

      await sleep(300);
    } catch (err) {
      console.error(`  Listing p${page} error: ${err.message.substring(0, 60)}`);
    }
  }

  process.stdout.write(`  Phase 1 complete: ${allLinks.size} product links collected\n`);

  // Phase 2: Fetch product detail pages in parallel
  const productUrls = Array.from(allLinks.keys());
  let fetched = 0;
  let errors = 0;
  const products = [];

  for (let i = 0; i < productUrls.length; i += CONCURRENCY) {
    const batch = productUrls.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.allSettled(batch.map(async (pUrl) => {
      try {
        const html = await fetchPage(pUrl);
        const details = extractProductDetails(html, pUrl);
        return details;
      } catch (err) {
        errors++;
        return null;
      }
    }));

    for (const r of batchResults) {
      if (r.status === 'fulfilled' && r.value && r.value.name) {
        products.push(r.value);
      }
    }

    fetched += batch.length;
    if (fetched % 50 === 0 || fetched === productUrls.length) {
      process.stdout.write(`  Detail pages: ${fetched}/${productUrls.length} fetched (${products.length} parsed, ${errors} errors)\n`);
    }

    await sleep(DELAY_MS);
  }

  return products;
}

// ── Main ──

async function main() {
  console.log('Hooker Furnishings Scraper');
  console.log('═══════════════════════════════════════');

  const globalDedup = new Map();
  let totalPosted = 0;

  for (const catConfig of CATEGORIES) {
    const catName = catConfig.url.match(/\.com\/([^?]+)/)?.[1] || '?';
    console.log(`\n▸ ${catName.toUpperCase()} (target: ${catConfig.expected})`);

    try {
      const rawProducts = await scrapeCategory(catConfig);
      const catalogProducts = [];

      for (const p of rawProducts) {
        if (!p.name || p.name.length < 3) continue;
        const key = p.url || p.name;
        if (globalDedup.has(key)) continue;
        globalDedup.set(key, true);

        catalogProducts.push({
          product_name: p.name,
          vendor_id: 'hooker',
          vendor_name: 'Hooker Furniture',
          vendor_domain: 'hookerfurnishings.com',
          image_url: p.image || '',
          product_url: p.url,
          sku: p.sku || '',
          category: inferCategory(p.name, catConfig.cat),
          collection: p.collection || '',
          description: p.description || '',
          retail_price: p.price || null,
          material: p.material || '',
          dimensions: p.dimensions || '',
          dimensions_width: p.width || null,
          dimensions_depth: p.depth || null,
          dimensions_height: p.height || null,
        });
      }

      // POST to search service in batches
      for (let i = 0; i < catalogProducts.length; i += BATCH_SIZE) {
        const batch = catalogProducts.slice(i, i + BATCH_SIZE);
        try {
          const res = await postJSON(SEARCH_SERVICE, { products: batch });
          if (res.status >= 200 && res.status < 300) totalPosted += batch.length;
          else console.error(`  POST error (${res.status})`);
        } catch (err) {
          console.error(`  POST failed: ${err.message}`);
        }
      }

      const pct = Math.round(rawProducts.length / catConfig.expected * 100);
      const statusMark = pct >= 80 ? '✓' : pct >= 50 ? '⚠' : '✗';
      console.log(`  ${statusMark} ${rawProducts.length}/${catConfig.expected} scraped (${pct}%) — ${catalogProducts.length} new posted`);
      if (pct < 70) console.log(`  ⚠ FLAGGED: Significantly under target`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════');
  console.log(`TOTAL UNIQUE: ${globalDedup.size}`);
  console.log(`TOTAL POSTED: ${totalPosted}`);
  console.log('═══════════════════════════════════════');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
