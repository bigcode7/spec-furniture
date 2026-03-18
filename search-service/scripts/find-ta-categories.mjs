import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
await page.goto('https://theodorealexander.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

// Get all nav links
const links = await page.evaluate(() => {
  return [...document.querySelectorAll('a[href*="/item/category"], a[href*="/item/"]')]
    .map(a => ({ href: a.href, text: a.textContent.trim() }))
    .filter(l => l.href.includes('/item/'));
});

console.log('All /item/ links found:');
const seen = new Set();
for (const l of links) {
  const path = new URL(l.href).pathname;
  if (!seen.has(path)) {
    seen.add(path);
    console.log(`  ${l.text} → ${path}`);
  }
}

// Also check the main category pages for total product counts
const categories = [
  '/item/category/room/value/living-room',
  '/item/category/room/value/dining-room', 
  '/item/category/room/value/bedroom',
  '/item/category/room/value/office',
  '/item/category/room/value/lighting',
  '/item/category/collection/value/art-by-ta',
  '/item/category/room/value/decor',
  '/item/category/type/value/upholstery',
  '/item/category/type/value/case-goods',
  '/item/category/type/value/outdoor',
];

console.log('\nChecking page counts per category...');
for (const cat of categories) {
  try {
    await page.goto('https://theodorealexander.com' + cat, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const html = await page.content();
    const match = html.match(/let\s+listItems\s*=\s*(\[[\s\S]*?\]);\s*(?:let|var|const|<\/script>)/);
    
    // Check pagination
    const pageInfo = await page.evaluate(() => {
      const paginationLinks = [...document.querySelectorAll('.pagination a, [class*="page"] a, a[href*="page="]')];
      const lastPage = paginationLinks.map(a => {
        const m = a.href.match(/page=(\d+)/);
        return m ? parseInt(m[1]) : 0;
      }).sort((a,b) => b-a)[0] || 1;
      
      const totalText = document.body.innerText.match(/(\d+)\s*(?:items?|products?|results?)/i);
      return { lastPage, totalText: totalText ? totalText[0] : null };
    });
    
    let itemCount = 0;
    if (match) {
      try {
        const items = await page.evaluate((raw) => eval(raw), match[1]);
        itemCount = items.length;
      } catch(e) {}
    }
    
    console.log(`  ${cat}: ${itemCount} items on page 1, pagination: ${JSON.stringify(pageInfo)}`);
  } catch(e) {
    console.log(`  ${cat}: ERROR - ${e.message}`);
  }
}

await browser.close();
