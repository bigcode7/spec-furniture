/**
 * Vanguard Furniture Scraper (Puppeteer)
 * Uses headless browser to click product type filters on the ASP.NET site.
 * Each product type yields <=200 products, so we iterate through all 31 types.
 */

import puppeteer from 'puppeteer';
import https from 'node:https';
import http from 'node:http';

const BASE = 'https://www.vanguardfurniture.com';
const SEARCH_SERVICE = 'http://127.0.0.1:4310';
const CONCURRENCY = 5;
const DELAY_MS = 300;
const BATCH_SIZE = 25;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchPage(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout, headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'text/html',
    }}, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        const redir = res.headers.location.startsWith('http') ? res.headers.location : BASE + res.headers.location;
        return fetchPage(redir, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => body += c);
      res.on('end', () => resolve(body));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

/**
 * Use Puppeteer to click each product type filter and extract SKUs.
 * Returns Map of sku -> { listing_image }
 */
async function extractAllSkus(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const allSkus = new Map();

  // Helper: extract SKUs from current page state
  const extractCurrentSkus = async () => {
    return page.evaluate(() => {
      const links = document.querySelectorAll("a[href*='/styles/sku/']");
      return [...links].map(a => {
        const m = a.getAttribute('href').match(/\/styles\/sku\/(.+)/);
        const img = a.querySelector('img');
        return m ? { sku: m[1], image: img?.src || null } : null;
      }).filter(Boolean);
    });
  };

  // Helper: get showing/total count
  const getCount = async () => {
    return page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/Showing\s+(\d+)\s+of\s+(\d+)/i);
      return match ? { showing: parseInt(match[1]), total: parseInt(match[2]) } : { showing: 0, total: 0 };
    });
  };

  // Load the base listing page (no room filter = ALL products)
  console.log('Loading all-products page...');
  await page.goto(`${BASE}/styles`, { waitUntil: 'networkidle2', timeout: 30000 });

  const initialCount = await getCount();
  console.log(`Full catalog: ${initialCount.total} total products\n`);

  // Get product type filter IDs
  const typeFilters = await page.evaluate(() => {
    const panels = document.querySelectorAll('.ClarityPanelBarItemContent');
    for (const panel of panels) {
      const prevHeader = panel.previousElementSibling;
      if (prevHeader && prevHeader.textContent.includes('Product Type')) {
        const cbs = panel.querySelectorAll('input[type="checkbox"]');
        return [...cbs].filter(cb => !cb.id.includes('All')).map(cb => {
          const label = cb.closest('label') || cb.parentElement;
          return { id: cb.id, text: (label?.textContent || '').trim() };
        });
      }
    }
    return [];
  });

  console.log(`Found ${typeFilters.length} product type filters\n`);

  // Click each filter one at a time to get all products of that type
  for (let i = 0; i < typeFilters.length; i++) {
    const filter = typeFilters[i];
    const beforeCount = allSkus.size;

    try {
      // Reload page fresh for each filter (clean state)
      await page.goto(`${BASE}/styles`, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(300);

      // Click just this one product type checkbox and trigger filter
      await page.evaluate((filterId) => {
        const cb = document.getElementById(filterId);
        if (cb) {
          cb.checked = true;
          // Set hidden filter value
          const hid = document.getElementById('hidFilterVal');
          if (hid) hid.value = cb.value || cb.name;
          // Trigger postback
          const btn = document.getElementById('btnFilterSelect');
          if (btn) btn.click();
        }
      }, filter.id);

      // Wait for ASP.NET postback to complete
      try {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
      } catch {}
      await sleep(800);

      const count = await getCount();
      const skus = await extractCurrentSkus();

      let newCount = 0;
      for (const s of skus) {
        if (!allSkus.has(s.sku)) {
          allSkus.set(s.sku, { listing_image: s.image });
          newCount++;
        }
      }

      const status = count.showing < count.total ? '⚠ CAPPED' : '✓';
      console.log(`  [${i+1}/${typeFilters.length}] ${filter.text}: ${skus.length} found (${count.showing}/${count.total}) | +${newCount} new | total: ${allSkus.size} ${status}`);

      // If this type has >200, we need to sub-filter by room
      if (count.showing < count.total) {
        console.log(`    Splitting by room to get all ${count.total}...`);
        const rooms = ['BR', 'DR', 'LR', 'OF', 'OD'];
        for (const room of rooms) {
          await page.goto(`${BASE}/styles?Room=${room}`, { waitUntil: 'networkidle2', timeout: 30000 });
          await sleep(300);

          await page.evaluate((filterId) => {
            const cb = document.getElementById(filterId);
            if (cb) {
              cb.checked = true;
              const hid = document.getElementById('hidFilterVal');
              if (hid) hid.value = cb.value || cb.name;
              const btn = document.getElementById('btnFilterSelect');
              if (btn) btn.click();
            }
          }, filter.id);

          try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); } catch {}
          await sleep(800);

          const roomCount = await getCount();
          const roomSkus = await extractCurrentSkus();
          let roomNew = 0;
          for (const s of roomSkus) {
            if (!allSkus.has(s.sku)) { allSkus.set(s.sku, { listing_image: s.image }); roomNew++; }
          }
          if (roomNew > 0) {
            console.log(`      Room ${room}: ${roomSkus.length} (${roomCount.showing}/${roomCount.total}), +${roomNew} new`);
          }

          // If room+type still capped, split by collection
          if (roomCount.showing < roomCount.total) {
            console.log(`      Room ${room} still capped (${roomCount.showing}/${roomCount.total}), splitting by collection...`);
            // Get collection filter IDs
            const collFilters = await page.evaluate(() => {
              const panels = document.querySelectorAll('.ClarityPanelBarItemContent');
              for (const panel of panels) {
                const prevHeader = panel.previousElementSibling;
                if (prevHeader && prevHeader.textContent.includes('Collection')) {
                  const cbs = panel.querySelectorAll('input[type="checkbox"]');
                  return [...cbs].filter(cb => !cb.id.includes('All')).map(cb => {
                    const label = cb.closest('label') || cb.parentElement;
                    return { id: cb.id, text: (label?.textContent || '').trim() };
                  });
                }
              }
              return [];
            });

            for (const coll of collFilters) {
              // Reload room page, apply type + collection filters
              await page.goto(`${BASE}/styles?Room=${room}`, { waitUntil: 'networkidle2', timeout: 30000 });
              await sleep(300);

              await page.evaluate((typeId, collId) => {
                const typeCb = document.getElementById(typeId);
                const collCb = document.getElementById(collId);
                if (typeCb) typeCb.checked = true;
                if (collCb) collCb.checked = true;
                const hid = document.getElementById('hidFilterVal');
                if (hid) hid.value = (typeCb?.value || '') + '|' + (collCb?.value || '');
                const btn = document.getElementById('btnFilterSelect');
                if (btn) btn.click();
              }, filter.id, coll.id);

              try { await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); } catch {}
              await sleep(800);

              const collSkus = await extractCurrentSkus();
              let collNew = 0;
              for (const s of collSkus) {
                if (!allSkus.has(s.sku)) { allSkus.set(s.sku, { listing_image: s.image }); collNew++; }
              }
              if (collNew > 0) {
                console.log(`        ${coll.text}: +${collNew} new`);
              }
            }
          }
        }
        console.log(`    After room+collection split: total ${allSkus.size}`);
      }
    } catch (err) {
      console.log(`  [${i+1}/${typeFilters.length}] ${filter.text}: ERROR - ${err.message}`);
    }
  }

  // Also check OutdoorLiving page
  console.log('\nChecking OutdoorLiving page...');
  try {
    await page.goto(`${BASE}/OutdoorLiving`, { waitUntil: 'networkidle2', timeout: 30000 });
    const outdoorSkus = await extractCurrentSkus();
    let newFromOutdoor = 0;
    for (const s of outdoorSkus) {
      if (!allSkus.has(s.sku)) { allSkus.set(s.sku, { listing_image: s.image }); newFromOutdoor++; }
    }
    console.log(`OutdoorLiving: ${outdoorSkus.length} products, ${newFromOutdoor} new`);
  } catch (err) {
    console.log(`OutdoorLiving ERROR: ${err.message}`);
  }

  await page.close();
  return allSkus;
}

function extractProductDetails(html, sku, url) {
  const product = { sku, product_url: url, vendor_name: 'Vanguard Furniture', vendor_id: 'vanguard-furniture' };

  // Product name
  const nameMatch = html.match(/<span[^>]*class='[^']*StyleName[^']*'[^>]*>([^<]+)/i)
    || html.match(/<h1[^>]*>([^<]+)</i)
    || html.match(/<title>([^<|-]+)/i);
  if (nameMatch) {
    product.product_name = nameMatch[1].trim().replace(/\s+/g, ' ');
  }

  // Image: CloudFront CDN
  const imgMatch = html.match(/(https:\/\/d1o5owjiil9xk2\.cloudfront\.net\/vdir\/ImageCabinet\/Styles\/\d+x\d+\/[^"'?\s]+)/i);
  if (imgMatch) {
    product.image_url = imgMatch[1].replace(/\/\d+x\d+\//, '/600x600/').replace(/__\d+x\d+\./, '__600x600.');
  }

  // Description
  const descMatch = html.match(/<meta\s+name=['"]description['"]\s+content=['"]([^'"]+)['"]/i);
  if (descMatch) product.description = descMatch[1].trim().slice(0, 500);

  // Dimensions: "W 34 D 22 H 27" or "34"W x 22"D x 27"H"
  const dimMatch = html.match(/W\s+(\d+(?:\.\d+)?)\s+D\s+(\d+(?:\.\d+)?)\s+H\s+(\d+(?:\.\d+)?)/i)
    || html.match(/(\d+(?:\.\d+)?)['""]?\s*W\s*[x×]\s*(\d+(?:\.\d+)?)['""]?\s*D\s*[x×]\s*(\d+(?:\.\d+)?)['""]?\s*H/i);
  if (dimMatch) product.dimensions = `${dimMatch[1]}"W x ${dimMatch[2]}"D x ${dimMatch[3]}"H`;

  // Materials
  const matMatch = html.match(/Wood Species:\s*([^<\n]+)/i) || html.match(/Material[s]?:\s*([^<\n]+)/i);
  if (matMatch) product.material = matMatch[1].trim();

  // Collection
  const collMatch = html.match(/class='[^']*StyleCollection[^']*'[^>]*>([^<]+)/i)
    || html.match(/([\w\s]+)\s+Collection/i);
  if (collMatch) product.collection = collMatch[1].trim();

  // Weight
  const weightMatch = html.match(/Weight:\s*(\d+)\s*lbs/i) || html.match(/(\d+)\s*lbs/i);
  if (weightMatch) product.weight = `${weightMatch[1]} lbs`;

  // Category from name
  const n = (product.product_name || '').toLowerCase();
  if (n.includes('sofa') || n.includes('loveseat')) product.category = 'sofas';
  else if (n.includes('sectional')) product.category = 'sectionals';
  else if (n.match(/\bbed\b/) && !n.includes('bedside')) product.category = 'beds';
  else if (n.includes('nightstand') || n.includes('bedside')) product.category = 'nightstands';
  else if (n.includes('dresser')) product.category = 'dressers';
  else if (n.match(/\bchest\b/)) product.category = 'chests';
  else if (n.includes('mirror')) product.category = 'mirrors';
  else if (n.includes('dining table')) product.category = 'dining-tables';
  else if (n.includes('dining chair') || n.includes('banquette')) product.category = 'dining-chairs';
  else if (n.includes('bar stool') || n.includes('counter stool')) product.category = 'bar-stools';
  else if (n.includes('cocktail table') || n.includes('coffee table')) product.category = 'coffee-tables';
  else if (n.match(/side table|end table|lamp table|accent table/)) product.category = 'side-tables';
  else if (n.includes('console') || n.includes('sofa table')) product.category = 'console-tables';
  else if (n.match(/desk chair|office chair/)) product.category = 'swivel-chairs';
  else if (n.includes('desk')) product.category = 'desks';
  else if (n.includes('bookcase') || n.includes('etagere') || n.includes('étagère')) product.category = 'bookcases';
  else if (n.includes('buffet') || n.includes('sideboard') || n.includes('credenza')) product.category = 'credenzas';
  else if (n.includes('cabinet')) product.category = 'cabinets';
  else if (n.includes('ottoman')) product.category = 'ottomans';
  else if (n.includes('bench')) product.category = 'benches';
  else if (n.includes('recliner')) product.category = 'recliners';
  else if (n.includes('chaise') || n.includes('settee')) product.category = 'chaises';
  else if (n.includes('swivel')) product.category = 'swivel-chairs';
  else if (n.includes('chair')) product.category = 'accent-chairs';
  else if (n.includes('entertainment') || n.includes('media')) product.category = 'media-consoles';
  else if (n.includes('sleeper')) product.category = 'sofas';

  return product;
}

async function postProducts(products) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ products });
    const req = http.request(`${SEARCH_SERVICE}/catalog/insert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 30000,
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== Vanguard Furniture Scraper ===\n');

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // Phase 1: Extract all SKUs using Puppeteer product type filters
  const allSkus = await extractAllSkus(browser);
  await browser.close();

  console.log(`\n━━━ TOTAL UNIQUE SKUs: ${allSkus.size} ━━━\n`);

  // Phase 2: Fetch product details via HTTP
  console.log(`Fetching ${allSkus.size} product detail pages...`);
  const skuList = [...allSkus.keys()];
  const detailedProducts = [];
  let fetched = 0, errors = 0;
  const failedSkus = [];

  for (let i = 0; i < skuList.length; i += CONCURRENCY) {
    const batch = skuList.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (sku) => {
      try {
        const html = await fetchPage(`${BASE}/styles/sku/${sku}`);
        const product = extractProductDetails(html, sku, `${BASE}/styles/sku/${sku}`);
        if (!product.image_url && allSkus.get(sku)?.listing_image) {
          product.image_url = allSkus.get(sku).listing_image;
        }
        if (product.product_name) { detailedProducts.push(product); fetched++; }
        else { errors++; failedSkus.push(sku); }
      } catch (err) {
        errors++; failedSkus.push(sku);
        if (errors <= 10) console.log(`  ✗ ${sku}: ${err.message}`);
      }
    }));

    if ((fetched + errors) % 200 === 0 || i + CONCURRENCY >= skuList.length) {
      console.log(`  Progress: ${fetched + errors}/${skuList.length} (${fetched} OK, ${errors} errors)`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDetail fetch: ${fetched} products, ${errors} errors`);
  if (failedSkus.length > 0 && failedSkus.length <= 20) {
    console.log(`Failed: ${failedSkus.join(', ')}`);
  }

  // Phase 3: Post to search service
  console.log(`\nPosting ${detailedProducts.length} products...`);
  let posted = 0;
  for (let i = 0; i < detailedProducts.length; i += BATCH_SIZE) {
    const batch = detailedProducts.slice(i, i + BATCH_SIZE).map(p => ({
      id: `vanguard_${p.sku.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      product_name: p.product_name,
      vendor_name: 'Vanguard Furniture',
      vendor_id: 'vanguard-furniture',
      sku: p.sku,
      product_url: p.product_url,
      image_url: p.image_url || '',
      description: p.description || '',
      material: p.material || '',
      dimensions: p.dimensions || '',
      collection: p.collection || '',
      category: p.category || '',
      style: '',
      ingestion_source: 'vanguard-scraper',
    }));
    try {
      await postProducts(batch);
      posted += batch.length;
      if (posted % 500 === 0) console.log(`  Posted: ${posted}/${detailedProducts.length}`);
    } catch (err) {
      console.log(`  Post error: ${err.message}`);
    }
  }

  // Summary
  const wi = detailedProducts.filter(p => p.image_url).length;
  const wd = detailedProducts.filter(p => p.dimensions).length;
  const wm = detailedProducts.filter(p => p.material).length;
  const wc = detailedProducts.filter(p => p.collection).length;

  console.log('\n' + '='.repeat(60));
  console.log('=== VANGUARD SCRAPER SUMMARY ===');
  console.log('='.repeat(60));
  console.log(`Total unique SKUs:    ${allSkus.size}`);
  console.log(`Detail pages OK:      ${fetched}`);
  console.log(`Errors:               ${errors}`);
  console.log(`Posted:               ${posted}`);
  console.log(`With image:           ${wi} (${Math.round(wi/Math.max(fetched,1)*100)}%)`);
  console.log(`With dimensions:      ${wd} (${Math.round(wd/Math.max(fetched,1)*100)}%)`);
  console.log(`With material:        ${wm} (${Math.round(wm/Math.max(fetched,1)*100)}%)`);
  console.log(`With collection:      ${wc} (${Math.round(wc/Math.max(fetched,1)*100)}%)`);
  console.log('='.repeat(60));
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
