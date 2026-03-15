import puppeteer from 'puppeteer';
import http from 'http';

const SEARCH_SERVICE = 'http://127.0.0.1:4310/catalog/insert';
const BATCH_SIZE = 25;

const CATEGORIES = [
  { url: 'https://www.bernhardt.com/shop/?$MultiView=Yes&Sub-Category=Beds&orderBy=BedroomPosition,Id&context=shop&page=PAGE', expected: 102, cat: 'beds' },
  { url: 'https://www.bernhardt.com/shop/?$MultiView=Yes&Sub-Category=Bedroom%20Storage&orderBy=BedroomPosition,Id&context=shop&page=PAGE', expected: 191, cat: 'dressers' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Bedroom&$MultiView=Yes&Sub-Category=Benches%20%26%20Ottomans&orderBy=BedroomPosition,Id&context=shop&page=PAGE', expected: 52, cat: 'benches' },
  { url: 'https://www.bernhardt.com/shop/?$MultiView=Yes&Sub-Category=Mirrors&orderBy=BedroomPosition,Id&context=shop&page=PAGE', expected: 24, cat: 'mirrors' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Dining&$MultiView=Yes&Sub-Category=Tables&orderBy=DiningPosition,Id&context=shop&page=PAGE', expected: 86, cat: 'dining-tables' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Dining&$MultiView=Yes&Sub-Category=Chairs&orderBy=DiningPosition,Id&context=shop&page=PAGE', expected: 106, cat: 'dining-chairs' },
  { url: 'https://www.bernhardt.com/shop/?$MultiView=Yes&Sub-Category=Dining%20Storage&orderBy=DiningPosition,Id&context=shop&page=PAGE', expected: 70, cat: 'credenzas' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Living&$MultiView=Yes&Sub-Category=Seating&orderBy=LivingPosition,Id&context=shop&page=PAGE', expected: 490, cat: 'sofas' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Living&$MultiView=Yes&Sub-Category=Living%20Tables&orderBy=LivingPosition,Id&context=shop&page=PAGE', expected: 372, cat: 'coffee-tables' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Living&$MultiView=Yes&Sub-Category=Living%20Storage&orderBy=LivingPosition,Id&context=shop&page=PAGE', expected: 81, cat: 'credenzas' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Workspace&$MultiView=Yes&Sub-Category=All%20Desks%20%26%20Chairs&orderBy=WorkspacePosition,Id&context=shop&page=PAGE', expected: 18, cat: 'desks' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Workspace&$MultiView=Yes&Sub-Category=Workspace%20Storage&orderBy=WorkspacePosition,Id&context=shop&page=PAGE', expected: 23, cat: 'bookcases' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Outdoor&$MultiView=Yes&Sub-Category=Outdoor%20Seating&orderBy=OutdoorPosition,Id&context=shop&page=PAGE', expected: 117, cat: 'sofas' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Outdoor&$MultiView=Yes&Sub-Category=Outdoor%20Dining&orderBy=OutdoorPosition,Id&context=shop&page=PAGE', expected: 36, cat: 'dining-tables' },
  { url: 'https://www.bernhardt.com/shop/?RoomType=Outdoor&$MultiView=Yes&Sub-Category=Outdoor%20Tables&orderBy=OutdoorPosition,Id&context=shop&page=PAGE', expected: 65, cat: 'side-tables' },
];

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

function inferCategory(name, defaultCat) {
  const n = name.toLowerCase();
  if (/\bsofa\b/.test(n)) return 'sofas';
  if (/\bsectional\b/.test(n)) return 'sectionals';
  if (/\bloveseat\b/.test(n)) return 'loveseats';
  if (/\bswivel\b.*\bchair\b/.test(n)) return 'swivel-chairs';
  if (/\baccent\s*chair\b|\blounge\s*chair\b|\bclub\s*chair\b/.test(n)) return 'accent-chairs';
  if (/\bdining\b.*\bchair\b|\bside\s*chair\b|\bhost\b.*\bchair\b/.test(n)) return 'dining-chairs';
  if (/\bbar\s*stool\b|\bcounter\s*stool\b/.test(n)) return 'bar-stools';
  if (/\brecliner\b/.test(n)) return 'recliners';
  if (/\bottoman\b|\bpouf\b/.test(n)) return 'ottomans';
  if (/\bbench\b/.test(n)) return 'benches';
  if (/\bchaise\b/.test(n)) return 'chaises';
  if (/\bcanopy\b.*\bbed\b|\bpanel\b.*\bbed\b|\bbed\b.*\bking\b|\bbed\b.*\bqueen\b/.test(n)) return 'beds';
  if (/\bbed\b/.test(n)) return 'beds';
  if (/\bheadboard\b/.test(n)) return 'headboards';
  if (/\bdining\b.*\btable\b/.test(n)) return 'dining-tables';
  if (/\bcoffee\b.*\btable\b|\bcocktail\b.*\btable\b/.test(n)) return 'coffee-tables';
  if (/\bconsole\b.*\btable\b|\bconsole\b/.test(n)) return 'console-tables';
  if (/\bside\b.*\btable\b|\bend\b.*\btable\b|\baccent\b.*\btable\b|\bmartini\b/.test(n)) return 'side-tables';
  if (/\bnightstand\b|\bbedside\b/.test(n)) return 'nightstands';
  if (/\bdesk\b/.test(n)) return 'desks';
  if (/\bdresser\b/.test(n)) return 'dressers';
  if (/\bcredenza\b|\bsideboard\b|\bbuffet\b|\bserver\b/.test(n)) return 'credenzas';
  if (/\bmedia\b.*\bconsole\b/.test(n)) return 'media-consoles';
  if (/\bbookcase\b|\betagere\b/.test(n)) return 'bookcases';
  if (/\bcabinet\b/.test(n)) return 'cabinets';
  if (/\bchest\b/.test(n)) return 'chests';
  if (/\bmirror\b/.test(n)) return 'mirrors';
  if (/\bchair\b/.test(n)) return 'accent-chairs';
  return defaultCat;
}

async function scrapeCategory(browser, catConfig) {
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.setViewport({ width: 1920, height: 1080 });

  const allProducts = new Map();
  let pageNum = 1;
  let consecutiveEmpty = 0;

  while (allProducts.size < catConfig.expected * 1.2) {
    const url = catConfig.url.replace('PAGE', String(pageNum));
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await page.waitForSelector('.grid-item', { timeout: 12000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 4000));

      const products = await page.evaluate(() => {
        const items = [];
        const cards = document.querySelectorAll('.grid-item.item');

        for (const card of cards) {
          // Product name from .product-header
          const nameEl = card.querySelector('.product-header');
          const name = nameEl ? nameEl.textContent.trim() : '';

          // SKU from .product-id
          const skuEl = card.querySelector('.product-id');
          const sku = skuEl ? skuEl.textContent.trim() : '';

          // Collection from .product-grade
          const gradeEls = card.querySelectorAll('.product-grade');
          const collection = gradeEls.length > 0 ? gradeEls[0].textContent.trim() : '';

          // Image
          const imgEl = card.querySelector('img');
          let imgSrc = imgEl ? (imgEl.src || imgEl.getAttribute('ng-src') || '') : '';

          // Price - look for currency-formatted text
          const allText = card.textContent;
          const priceMatch = allText.match(/\$[\d,]+/);
          const price = priceMatch ? parseFloat(priceMatch[0].replace(/[$,]/g, '')) : null;

          if (name && name.length > 2) {
            items.push({ name, sku, collection, image: imgSrc, price });
          }
        }
        return items;
      });

      if (products.length === 0) {
        consecutiveEmpty++;
        if (consecutiveEmpty >= 2) break;
      } else {
        const sizeBefore = allProducts.size;
        for (const p of products) {
          const key = p.sku || p.name;
          if (!allProducts.has(key)) {
            allProducts.set(key, p);
          }
        }
        const newCount = allProducts.size - sizeBefore;
        process.stdout.write(`  p${pageNum}: ${products.length} items, ${newCount} new (${allProducts.size} total)\n`);
        // Stop if no new products found (we've paginated past the end)
        if (newCount === 0) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 2) break;
        } else {
          consecutiveEmpty = 0;
        }
      }

      pageNum++;
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`  p${pageNum} error: ${err.message.substring(0, 60)}`);
      consecutiveEmpty++;
      if (consecutiveEmpty >= 3) break;
      pageNum++;
    }
  }

  await page.close();
  return Array.from(allProducts.values());
}

async function main() {
  console.log('Launching headless Chrome...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const globalDedup = new Map();
  let totalPosted = 0;

  for (const catConfig of CATEGORIES) {
    const subCat = decodeURIComponent(catConfig.url.match(/Sub-Category=([^&]+)/)?.[1] || '?');
    console.log(`\n▸ ${subCat} (target: ${catConfig.expected})`);

    try {
      const rawProducts = await scrapeCategory(browser, catConfig);
      const catalogProducts = [];

      for (const p of rawProducts) {
        const key = p.sku || p.name;
        if (globalDedup.has(key)) continue;
        globalDedup.set(key, true);

        catalogProducts.push({
          product_name: p.name,
          vendor_id: 'bernhardt',
          vendor_name: 'Bernhardt',
          vendor_domain: 'bernhardt.com',
          image_url: p.image || '',
          product_url: `https://www.bernhardt.com/shop/#/product/${p.sku || encodeURIComponent(p.name)}`,
          sku: p.sku,
          category: inferCategory(p.name, catConfig.cat),
          collection: p.collection || '',
          retail_price: p.price || null,
        });
      }

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
      const status = pct >= 80 ? '✓' : pct >= 50 ? '⚠' : '✗';
      console.log(`  ${status} ${rawProducts.length}/${catConfig.expected} (${pct}%) — ${catalogProducts.length} new posted`);
      if (pct < 70) console.log(`  ⚠ FLAGGED: Under target`);
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
    }
  }

  await browser.close();

  console.log('\n═══════════════════════════════════════');
  console.log(`TOTAL UNIQUE: ${globalDedup.size}`);
  console.log(`TOTAL POSTED: ${totalPosted}`);
  console.log('═══════════════════════════════════════');

  const catCounts = {};
  for (const [key, _] of globalDedup) catCounts[key] = (catCounts[key] || 0) + 1;
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
