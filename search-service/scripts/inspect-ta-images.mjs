import puppeteer from 'puppeteer';

const urls = [
  'https://theodorealexander.com/item/product-detail/amalia-cocktail-table-axh51005-c157',
  'https://theodorealexander.com/item/product-detail/baron-cocktail-table-axh51015-c105',
  'https://theodorealexander.com/item/product-detail/breeze-king-bed-tas82010-c254',
];

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

for (const url of urls) {
  console.log('\n=== ' + url.split('/').pop() + ' ===');
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    // Extract itemDto
    const html = await page.content();
    const match = html.match(/var\s+itemDto\s*=\s*(\{[\s\S]*?\});\s*(?:var|let|const|function|<\/script>)/);
    if (match) {
      const dto = await page.evaluate((raw) => {
        try { return eval('(' + raw + ')'); } catch(e) { return null; }
      }, match[1]);
      
      if (dto) {
        console.log('itemImagetDtos count:', dto.itemImagetDtos?.length || 0);
        if (dto.itemImagetDtos) {
          for (const img of dto.itemImagetDtos) {
            console.log('  ', img.isMain ? 'MAIN' : 'ALT', '|', img.url || img.imageUrl || JSON.stringify(img));
          }
        }
      }
    } else {
      console.log('No itemDto found in page source');
    }
    
    // Also check all img tags with sirv.com
    const allImgs = await page.evaluate(() => {
      return [...document.querySelectorAll('img')]
        .map(i => i.src)
        .filter(s => s.includes('sirv.com') || s.includes('theodore'));
    });
    console.log('\nAll sirv.com img tags on page:', allImgs.length);
    for (const src of allImgs) {
      console.log('  ', src);
    }
    
    // Check for Sirv viewer / zoom galleries
    const sirvViewers = await page.evaluate(() => {
      const viewers = document.querySelectorAll('.Sirv, .sirv-viewer, [data-src*="sirv"]');
      return [...viewers].map(v => ({
        tag: v.tagName,
        class: v.className,
        dataSrc: v.getAttribute('data-src'),
        innerHTML: v.innerHTML.slice(0, 200)
      }));
    });
    if (sirvViewers.length > 0) {
      console.log('\nSirv viewers found:', sirvViewers.length);
      for (const v of sirvViewers) console.log('  ', JSON.stringify(v));
    }
    
  } catch(e) {
    console.log('Error:', e.message);
  }
}

await browser.close();
