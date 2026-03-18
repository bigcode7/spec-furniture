import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

const categories = [
  '/item/category/room/value/living-room',
  '/item/category/room/value/dining-room',
  '/item/category/room/value/bedroom',
  '/item/category/room/value/office',
  '/item/category/room/value/lighting',
  '/item/category/room/value/decor',
  '/item/category/collection/value/art-by-ta',
  '/item/category/special/value/new-product',
  '/item/category/special/value/in-stock',
];

for (const cat of categories) {
  // Go to last possible page to find the true count
  let maxPage = 1;
  // Binary search - try page 100 first
  for (const tryPage of [200, 100, 80, 60, 50, 40, 30, 20, 10, 5]) {
    try {
      await page.goto(`https://theodorealexander.com${cat}?page=${tryPage}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 2000));
      const html = await page.content();
      const match = html.match(/let\s+listItems\s*=\s*(\[[\s\S]*?\]);\s*(?:let|var|const|<\/script>)/);
      if (match) {
        const count = await page.evaluate((raw) => { try { return eval(raw).length; } catch(e) { return 0; } }, match[1]);
        if (count > 0) {
          maxPage = Math.max(maxPage, tryPage);
          // Try higher
          break;
        }
      }
    } catch(e) {}
  }
  
  // Now find the exact last page
  if (maxPage > 1) {
    let lo = maxPage, hi = maxPage + 20;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      try {
        await page.goto(`https://theodorealexander.com${cat}?page=${mid}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise(r => setTimeout(r, 1500));
        const html = await page.content();
        const match = html.match(/let\s+listItems\s*=\s*(\[[\s\S]*?\]);\s*(?:let|var|const|<\/script>)/);
        let count = 0;
        if (match) count = await page.evaluate((raw) => { try { return eval(raw).length; } catch(e) { return 0; } }, match[1]);
        if (count > 0) { lo = mid; hi = mid + 10; } else { hi = mid - 1; }
      } catch(e) { hi = mid - 1; }
    }
    maxPage = lo;
  }
  
  // Count items on page 1
  await page.goto(`https://theodorealexander.com${cat}?page=1`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  const html = await page.content();
  const match = html.match(/let\s+listItems\s*=\s*(\[[\s\S]*?\]);\s*(?:let|var|const|<\/script>)/);
  let perPage = 0;
  if (match) perPage = await page.evaluate((raw) => { try { return eval(raw).length; } catch(e) { return 0; } }, match[1]);
  
  const estimated = maxPage > 1 ? `~${(maxPage - 1) * perPage + perPage} (${maxPage} pages × ${perPage}/page)` : `${perPage}`;
  console.log(`${cat}: ${maxPage} pages, ${perPage}/page, est total: ${estimated}`);
}

await browser.close();
