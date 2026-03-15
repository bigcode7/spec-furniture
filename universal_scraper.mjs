/**
 * Universal Furniture Scraper
 *
 * Crawls 33 category listing pages, extracts /item/ links,
 * fetches product detail pages, extracts data from JSON-LD schema + HTML.
 * Posts batches to search service.
 */

import https from 'node:https';
import http from 'node:http';

const BASE = 'https://www.universalfurniture.com';
const SEARCH_SERVICE = 'http://127.0.0.1:4310';
const CONCURRENCY = 5;
const DELAY_MS = 400;
const BATCH_SIZE = 25;

const CATEGORY_URLS = [
  // BEDROOM
  { url: '/furniture/bedroom/armoires', category: 'wardrobes' },
  { url: '/furniture/bedroom/beds', category: 'beds' },
  { url: '/furniture/bedroom/benches%20ottomans%20and%20stools', category: 'benches' },
  { url: '/furniture/bedroom/chests', category: 'chests' },
  { url: '/furniture/bedroom/dressers', category: 'dressers' },
  { url: '/furniture/bedroom/mirrors', category: 'mirrors' },
  { url: '/furniture/bedroom/nightstands', category: 'nightstands' },
  { url: '/furniture/bedroom/spot%20tables', category: 'side-tables' },
  // LIVING ROOM
  { url: '/furniture/living%20room/benches%20ottomans%20and%20stools', category: 'ottomans' },
  { url: '/furniture/living%20room/chairs', category: 'accent-chairs' },
  { url: '/furniture/living%20room/chests', category: 'chests' },
  { url: '/furniture/living%20room/cocktail%20tables', category: 'coffee-tables' },
  { url: '/furniture/living%20room/consoles', category: 'console-tables' },
  { url: '/furniture/living%20room/credenzas%20and%20chests', category: 'credenzas' },
  { url: '/furniture/living%20room/desks', category: 'desks' },
  { url: '/furniture/living%20room/end%20tables%20and%20side%20tables', category: 'side-tables' },
  { url: '/furniture/living%20room/loveseats', category: 'loveseats' },
  { url: '/furniture/living%20room/motion', category: 'recliners' },
  { url: '/furniture/living%20room/sectionals', category: 'sectionals' },
  { url: '/furniture/living%20room/shelving', category: 'bookcases' },
  { url: '/furniture/living%20room/sofas', category: 'sofas' },
  { url: '/furniture/living%20room/spot%20tables', category: 'side-tables' },
  // DINING ROOM
  { url: '/furniture/dining%20room/bar%20carts%20%26%20cabinets', category: 'cabinets' },
  { url: '/furniture/dining%20room/chairs', category: 'dining-chairs' },
  { url: '/furniture/dining%20room/credenzas%20and%20chests', category: 'credenzas' },
  { url: '/furniture/dining%20room/dining%20seating', category: 'dining-chairs' },
  { url: '/furniture/dining%20room/dining%20tables', category: 'dining-tables' },
  { url: '/furniture/dining%20room/shelving', category: 'bookcases' },
  // OFFICE
  { url: '/furniture/office/desk%20chairs', category: 'accent-chairs' },
  { url: '/furniture/office/desks', category: 'desks' },
  { url: '/furniture/office/shelving', category: 'bookcases' },
  // OTHER
  { url: '/motion', category: 'recliners' },
  { url: '/outdoor-furniture', category: 'sofas' },
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Extract product links from listing page ──

function extractProductLinks(html) {
  const links = new Set();
  const regex = /href=["'](\/item\/[^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1].split('?')[0].split('#')[0]; // strip query/hash
    links.add(BASE + href);
  }
  return [...links];
}

// ── Extract product data from detail page ──

function extractProductData(html, url, fallbackCategory) {
  const product = {
    product_url: url,
    vendor_name: 'Universal Furniture',
    vendor_id: 'universal-furniture',
    vendor_domain: 'universalfurniture.com',
    ingestion_source: 'universal-scraper',
    category: fallbackCategory,
  };

  // ── Try JSON-LD schema first (most reliable) ──
  const schemaMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (schemaMatches) {
    for (const s of schemaMatches) {
      const jsonStr = s.replace(/<\/?script[^>]*>/gi, '').trim();
      try {
        const data = JSON.parse(jsonStr);
        if (data['@type'] === 'Product') {
          product.product_name = (data.name || '').trim();
          product.sku = data.sku || null;
          product.description = (data.description || '').replace(/&#x[\dA-Fa-f]+;/g, '').trim();

          // Image — take first from array or string
          if (Array.isArray(data.image) && data.image.length > 0) {
            product.image_url = data.image[0];
          } else if (typeof data.image === 'string') {
            product.image_url = data.image;
          }

          // Category from schema
          if (data.category) {
            const catParts = data.category.replace(/\s+/g, ' ').trim().split(/\s{2,}/);
            // Last non-empty part is usually the specific category
            product._schema_category = catParts.filter(Boolean).pop() || '';
          }

          break;
        }
      } catch {}
    }
  }

  // ── Fallback: title tag ──
  if (!product.product_name) {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      let name = titleMatch[1].replace(/<[^>]+>/g, '').trim();
      // Strip " | Universal Furniture" suffix
      name = name.replace(/\s*\|.*$/, '').replace(/\s*-\s*Universal\s*Furniture.*$/i, '').trim();
      product.product_name = name;
    }
  }

  // ── Fallback: og:image ──
  if (!product.image_url) {
    const ogImg = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
      || html.match(/content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
    if (ogImg) product.image_url = ogImg[1];
  }

  // ── Fallback: viewmastercms image ──
  if (!product.image_url) {
    const vImg = html.match(/src=["'](https?:\/\/[^"']*viewmastercms\.com[^"']+)["']/i);
    if (vImg) product.image_url = vImg[1];
  }

  // ── Dimensions from HTML ──
  const dimPatterns = [
    /(\d{2,3})\s*W\s*[Xx×]\s*(\d{2,3})\s*D\s*[Xx×]\s*(\d{2,3})\s*H/i,
    /Width[:\s]*(\d{2,3})[^D]*Depth[:\s]*(\d{2,3})[^H]*Height[:\s]*(\d{2,3})/i,
    /(\d{2,3})"?\s*W\s*[x×]\s*(\d{2,3})"?\s*D\s*[x×]\s*(\d{2,3})"?\s*H/i,
  ];
  for (const pat of dimPatterns) {
    const dm = html.match(pat);
    if (dm) {
      product.dimensions = `${dm[1]}W x ${dm[2]}D x ${dm[3]}H`;
      break;
    }
  }

  // ── Materials/finish ──
  const finishMatch = html.match(/Finish\s*<\/[^>]+>\s*<[^>]+>([^<]+)/i)
    || html.match(/Finish[:\s]+([A-Za-z][^<]{3,80})/i);
  if (finishMatch) product.material = finishMatch[1].trim();

  // Also check description for fabric/material info
  if (!product.material && product.description) {
    const fabMatch = product.description.match(/Fabric:\s*([^;]+)/i)
      || product.description.match(/(\d+%\s+\w+(?:,\s*\d+%\s+\w+)*)/i);
    if (fabMatch) product.material = fabMatch[1].trim();
  }

  // ── Collection from breadcrumb or page ──
  const collMatch = html.match(/class=["'][^"']*collection[^"']*["'][^>]*>([^<]{3,60})</i)
    || html.match(/breadcrumb[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>\s*<\/li>\s*<li/i);
  if (collMatch) product.collection = collMatch[1].trim();

  // Try extracting collection from description or product name patterns
  if (!product.collection && product._schema_category) {
    product.collection = product._schema_category;
  }

  // ── Category inference from product name ──
  if (product.product_name) {
    const name = product.product_name.toLowerCase();
    if (name.includes('sofa') && !name.includes('table')) product.category = 'sofas';
    else if (name.includes('sectional')) product.category = 'sectionals';
    else if (name.includes('loveseat')) product.category = 'loveseats';
    else if (name.includes('recliner') || name.includes('reclining')) product.category = 'recliners';
    else if (name.includes('swivel') && name.includes('chair')) product.category = 'swivel-chairs';
    else if (name.includes('ottoman')) product.category = 'ottomans';
    else if (name.includes('bench')) product.category = 'benches';
    else if (name.includes('chaise')) product.category = 'chaises';
    else if (name.includes('bar stool') || name.includes('barstool') || name.includes('counter stool')) product.category = 'bar-stools';
    else if (name.includes('dining chair') || name.includes('side chair') || name.includes('host chair') || name.includes('arm chair')) product.category = 'dining-chairs';
    else if (name.includes('dining table') || name.includes('extension table') || name.includes('gathering table')) product.category = 'dining-tables';
    else if (name.includes('cocktail table') || name.includes('coffee table')) product.category = 'coffee-tables';
    else if (name.includes('console')) product.category = 'console-tables';
    else if (name.includes('end table') || name.includes('side table') || name.includes('accent table') || name.includes('spot table') || name.includes('drink table')) product.category = 'side-tables';
    else if (name.includes('nightstand') || name.includes('night table') || name.includes('bedside')) product.category = 'nightstands';
    else if (name.includes('desk') && !name.includes('desk chair')) product.category = 'desks';
    else if (name.includes('credenza') || name.includes('sideboard') || name.includes('buffet')) product.category = 'credenzas';
    else if (name.includes('bookcase') || name.includes('etagere') || name.includes('shelf') || name.includes('shelving')) product.category = 'bookcases';
    else if (name.includes('cabinet') || name.includes('hutch') || name.includes('bar cart')) product.category = 'cabinets';
    else if (name.includes('media console') || name.includes('entertainment')) product.category = 'media-consoles';
    else if (name.includes('dresser')) product.category = 'dressers';
    else if (name.includes('chest')) product.category = 'chests';
    else if (name.includes('mirror')) product.category = 'mirrors';
    else if (name.includes('armoire') || name.includes('wardrobe')) product.category = 'wardrobes';
    else if (/\bbed\b/.test(name) && !name.includes('bedside')) product.category = 'beds';
    else if (name.includes('headboard')) product.category = 'headboards';
  }

  // Clean up description — truncate and decode entities
  if (product.description) {
    product.description = product.description
      .replace(/&#x[\dA-Fa-f]+;/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .slice(0, 500);
  }

  // Generate ID
  const slug = (product.sku || product.product_name || 'unknown')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  product.id = `universal-furniture_${slug}`;

  // Clean up temp fields
  delete product._schema_category;

  return product;
}

// ── Post products to search service ──

function postProducts(products) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ products, vendor_id: 'universal-furniture' });
    const req = http.request(`${SEARCH_SERVICE}/catalog/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve({ ok: false }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('POST timeout')); });
    req.write(data);
    req.end();
  });
}

// ── Concurrent processor ──

async function processConcurrent(items, fn, concurrency) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      try { results[i] = await fn(items[i], i); } catch (err) { results[i] = { error: err.message }; }
      if (DELAY_MS > 0) await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

// ── Main ──

async function main() {
  console.log('=== Universal Furniture Scraper ===\n');

  // Phase 1: Collect product links
  const allLinks = new Map(); // url -> category
  let totalListed = 0;

  console.log('Phase 1: Collecting product links from 33 category pages...\n');

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
      totalListed += links.length;
      const shortUrl = url.length > 50 ? url.slice(0, 50) + '...' : url;
      console.log(`  ${category.padEnd(18)} ${links.length.toString().padStart(4)} products (${String(newCount).padStart(3)} new) | ${shortUrl}`);
      await sleep(300);
    } catch (err) {
      console.error(`  ERROR ${category}: ${err.message}`);
    }
  }

  console.log(`\nPhase 1 complete: ${allLinks.size} unique product links (${totalListed} total across categories)\n`);

  // Phase 2: Fetch product detail pages
  console.log('Phase 2: Fetching product detail pages...\n');

  const productEntries = [...allLinks.entries()];
  let fetched = 0, failed = 0;

  const results = await processConcurrent(
    productEntries,
    async ([url, category], idx) => {
      try {
        const html = await fetchPage(url);
        const product = extractProductData(html, url, category);
        if (!product.product_name || product.product_name.length < 2) {
          failed++;
          if (failed <= 5) console.error(`  NO NAME: ${url}`);
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

  // Phase 3: Post to search service
  console.log('Phase 3: Posting to search service...\n');
  let posted = 0, insertedTotal = 0, updatedTotal = 0;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    try {
      const result = await postProducts(batch);
      insertedTotal += result.inserted || 0;
      updatedTotal += result.updated || 0;
      posted += batch.length;
      if ((i / BATCH_SIZE) % 10 === 0) {
        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} products → inserted: ${result.inserted || 0}, updated: ${result.updated || 0}`);
      }
    } catch (err) {
      console.error(`  Batch FAILED: ${err.message}`);
    }
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Category pages crawled:  33`);
  console.log(`Product links found:     ${allLinks.size}`);
  console.log(`Products fetched:        ${validProducts.length}`);
  console.log(`Products after dedup:    ${deduped.length}`);
  console.log(`Posted to catalog:       ${posted}`);
  console.log(`  New inserts:           ${insertedTotal}`);
  console.log(`  Updates:               ${updatedTotal}`);
  console.log(`  Failed fetches:        ${failed}`);

  const catCounts = {};
  for (const p of deduped) catCounts[p.category] = (catCounts[p.category] || 0) + 1;
  console.log('\nCategory breakdown:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count.toString().padStart(5)}  ${cat}`);
  }

  console.log('\nSample products:');
  for (const p of deduped.slice(0, 8)) {
    console.log(`  ${p.product_name} | ${p.category} | ${p.sku || 'no-sku'} | img: ${p.image_url ? 'YES' : 'NO'}`);
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
