import puppeteer from 'puppeteer';

// Test a multi-image product and check ALL gallery images
const url = 'https://theodorealexander.com/item/product-detail/albert-sofa-u1001-84';

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await new Promise(r => setTimeout(r, 4000));

const html = await page.content();
const match = html.match(/var\s+itemDto\s*=\s*(\{[\s\S]*?\});\s*(?:var|let|const|function|<\/script>)/);

if (match) {
  const dto = await page.evaluate((raw) => {
    try { return eval('(' + raw + ')'); } catch(e) { return null; }
  }, match[1]);
  
  console.log('=== itemDto.itemImagetDtos ===');
  console.log('Count:', dto.itemImagetDtos?.length);
  for (const img of (dto.itemImagetDtos || [])) {
    console.log(`  ${img.isMain ? 'MAIN' : 'ALT '} sortOrder=${img.sortOrder} | ${img.url}`);
  }
}

// Extract ALL gallery images from the rendered Sirv viewer
const galleryImages = await page.evaluate(() => {
  // Method 1: smv-component divs (the actual gallery slides)
  const components = [...document.querySelectorAll('.smv-component[data-src], .galleryImg[data-src]')];
  const fromComponents = components.map(el => el.getAttribute('data-src'));
  
  // Method 2: gallery thumbnail images
  const thumbs = [...document.querySelectorAll('.smv-selector img, .smv-selector-thumb img')];
  const fromThumbs = thumbs.map(el => el.src || el.getAttribute('data-src'));
  
  // Method 3: any ProductPhotos images not in nav/footer
  const allImgs = [...document.querySelectorAll('img')];
  const productImgs = allImgs
    .filter(i => (i.src || '').includes('ProductPhotos/TA/'))
    .map(i => i.src.split('?')[0]);
  
  return { fromComponents, fromThumbs, productImgs: [...new Set(productImgs)] };
});

console.log('\n=== Rendered gallery components ===');
for (const src of galleryImages.fromComponents) console.log(' ', src);
console.log('\n=== Thumbnail images ===');
for (const src of galleryImages.fromThumbs) console.log(' ', src);
console.log('\n=== All ProductPhotos/TA/ imgs (deduped, no query params) ===');
for (const src of galleryImages.productImgs) console.log(' ', src);

await browser.close();
