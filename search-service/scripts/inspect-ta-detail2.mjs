import puppeteer from 'puppeteer';

// First, get a working product URL from the listing page
const listUrl = "https://theodorealexander.com/item/category/room/value/bedroom?page=1";

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
await page.setViewport({ width: 1440, height: 900 });

// Get listing items
await page.goto(listUrl, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));

// Extract listItems from the page context
const listItems = await page.evaluate(() => {
  return typeof window.listItems !== 'undefined' ? window.listItems.slice(0, 5) : null;
});

if (listItems) {
  console.log("=== First 3 listing items:");
  for (const item of listItems.slice(0, 3)) {
    console.log(`  Name: ${item.productName}`);
    console.log(`  SKU: ${item.sku}`);
    console.log(`  urlCode: ${item.urlCode}`);
    console.log(`  Image: ${item.imageSirv || item.imageUrl}`);
    console.log(`  Collection: ${item.collectionName}`);
    console.log(`  ---`);
  }
} else {
  // Try regex from source
  const html = await page.content();
  const match = html.match(/let\s+listItems\s*=\s*(\[[\s\S]*?\]);\s/);
  console.log("listItems from regex:", match ? "found" : "not found");
}

// Also search for "breeze" in the listing
const breezeItem = await page.evaluate(() => {
  if (typeof window.listItems === 'undefined') return null;
  return window.listItems.find(i => i.productName?.toLowerCase().includes('breeze') && i.productName?.toLowerCase().includes('king'));
});
console.log("\n=== Breeze King Bed from listings:", breezeItem ? JSON.stringify(breezeItem, null, 2) : "NOT FOUND on page 1");

// Now visit a working product detail page
const firstUrl = listItems?.[0]?.urlCode;
if (firstUrl) {
  const detailUrl = `https://theodorealexander.com/item/product-detail/${firstUrl}`;
  console.log(`\n=== Visiting detail page: ${detailUrl}`);
  
  await page.goto(detailUrl, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Check if page loaded or errored
  const pageTitle = await page.title();
  console.log("Page title:", pageTitle);
  
  const hasError = await page.evaluate(() => {
    return document.body.textContent.includes('Something went wrong');
  });
  console.log("Has error:", hasError);
  
  if (!hasError) {
    // Check for itemDto
    const hasDto = await page.evaluate(() => typeof window.itemDto !== 'undefined');
    console.log("itemDto on window:", hasDto);
    
    if (hasDto) {
      const dto = await page.evaluate(() => {
        const d = window.itemDto;
        return {
          productName: d.productName,
          sku: d.sku,
          extendedDescription: d.extendedDescription?.slice(0, 500),
          widthInch: d.widthInch,
          depthInch: d.depthInch, 
          heightInch: d.heightInch,
          widthCm: d.widthCm,
          depthCm: d.depthCm,
          heightCm: d.heightCm,
          imageCount: d.itemImagetDtos?.length,
          images: d.itemImagetDtos,
          materials: d.materials,
          finishName: d.finishName,
          fabricName: d.fabricName,
          fabricContent: d.fabricContent,
          cleaningCode: d.cleaningCode,
          trimName: d.trimName,
          collectionName: d.collection?.name,
          typeName: d.type?.name,
          isNew: d.isNew,
          retailPrice: d.retailPriceList,
          allKeys: Object.keys(d),
        };
      });
      console.log("\n=== FULL itemDto:");
      console.log(JSON.stringify(dto, null, 2));
    }

    // Check DOM for rendered content
    const rendered = await page.evaluate(() => {
      // All images with product photos
      const imgs = document.querySelectorAll('img[src*="sirv"]');
      const productImgs = Array.from(imgs)
        .map(i => i.src)
        .filter(u => u.includes('ProductPhotos'));

      // Description text
      const descEls = document.querySelectorAll('p');
      const descs = Array.from(descEls)
        .map(p => p.textContent.trim())
        .filter(t => t.length > 50);

      // Price
      const priceEls = document.querySelectorAll('span, div, p');
      const prices = Array.from(priceEls)
        .map(e => e.textContent.trim())
        .filter(t => t.includes('$') && t.length < 30);

      return { productImgs, descs: descs.slice(0, 5), prices: prices.slice(0, 5) };
    });
    console.log("\n=== Rendered content:");
    console.log("Product images:", rendered.productImgs);
    console.log("Descriptions:", rendered.descs);
    console.log("Prices:", rendered.prices);
  }
}

await browser.close();
