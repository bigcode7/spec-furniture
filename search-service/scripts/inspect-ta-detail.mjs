import puppeteer from 'puppeteer';

const url = "https://theodorealexander.com/item/product-detail/breeze-upholstered-us-king-bed-ta830101cfz";
console.log("Inspecting:", url);

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
await page.setViewport({ width: 1440, height: 900 });

await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));

// 1. Check for itemDto JS variable
const hasItemDto = await page.evaluate(() => typeof window.itemDto !== 'undefined');
console.log("\n=== itemDto exists on window:", hasItemDto);

if (hasItemDto) {
  const dto = await page.evaluate(() => {
    const d = window.itemDto;
    return {
      productName: d.productName,
      sku: d.sku,
      defaultCode: d.defaultCode,
      extendedDescription: d.extendedDescription?.slice(0, 300),
      widthInch: d.widthInch,
      depthInch: d.depthInch,
      heightInch: d.heightInch,
      widthCm: d.widthCm,
      depthCm: d.depthCm,
      heightCm: d.heightCm,
      materials: d.materials,
      materialList: d.materialList,
      finishName: d.finishName,
      collectionName: d.collection?.name,
      retailPrice: d.retailPriceList,
      wholesalePrice: d.wholesalePriceList,
      isNew: d.isNew,
      isStocked: d.isStocked,
      imageCount: d.itemImagetDtos?.length,
      images: d.itemImagetDtos?.map(i => ({ url: i.url, isMain: i.isMain, sortOrder: i.sortOrder })),
      // Check for extra fields
      fabricName: d.fabricName,
      fabricContent: d.fabricContent,
      cleaningCode: d.cleaningCode,
      trimName: d.trimName,
      bedSize: d.bedSize,
      typeName: d.type?.name,
      roomName: d.roomAndUsage?.name,
      keys: Object.keys(d).slice(0, 80),
    };
  });
  console.log("\n=== itemDto fields:", JSON.stringify(dto, null, 2));
}

// 2. Check rendered DOM for spec details, description, price
const pageData = await page.evaluate(() => {
  const data = {};

  // Description paragraphs
  const descEls = document.querySelectorAll('.product-description p, .product-info p, .description p, [class*="description"] p');
  data.descParagraphs = Array.from(descEls).map(el => el.textContent.trim()).filter(t => t.length > 10);

  // Spec/detail bullet points
  const specLis = document.querySelectorAll('.product-specs li, .specs li, .product-details li, [class*="spec"] li, .detail-list li');
  data.specBullets = Array.from(specLis).map(el => el.textContent.trim()).filter(Boolean);

  // Try broader selectors for specs
  const allLis = document.querySelectorAll('ul li');
  data.allLiCount = allLis.length;
  data.sampleLis = Array.from(allLis).slice(0, 20).map(el => el.textContent.trim().slice(0, 100));

  // Price elements
  const priceEls = document.querySelectorAll('[class*="price"], [class*="Price"]');
  data.priceTexts = Array.from(priceEls).map(el => el.textContent.trim()).filter(Boolean);

  // Dimensions table
  const dimRows = document.querySelectorAll('table tr, .dimensions tr');
  data.dimRows = Array.from(dimRows).map(r => r.textContent.trim().slice(0, 200));

  // Image gallery - thumbnails
  const thumbImgs = document.querySelectorAll('.thumbnail img, .thumb img, [class*="thumb"] img, .gallery img, .slider img, .carousel img');
  data.thumbImages = Array.from(thumbImgs).map(img => img.src || img.getAttribute('data-src'));

  // All images with sirv in the URL
  const allImgs = document.querySelectorAll('img');
  data.sirvImages = Array.from(allImgs)
    .map(img => img.src || img.getAttribute('data-src') || img.getAttribute('data-original'))
    .filter(u => u && u.includes('sirv'));

  // Main product image
  const mainImg = document.querySelector('.product-image img, .main-image img, [class*="product"] img');
  data.mainImage = mainImg?.src;

  // Dropdowns / selectors (size options)
  const selects = document.querySelectorAll('select');
  data.selectOptions = Array.from(selects).map(sel => ({
    name: sel.name || sel.id || sel.className,
    options: Array.from(sel.options).map(o => o.textContent.trim()),
  }));

  // Breadcrumbs
  const breadcrumbs = document.querySelectorAll('.breadcrumb a, [class*="breadcrumb"] a, nav a');
  data.breadcrumbs = Array.from(breadcrumbs).map(a => a.textContent.trim()).filter(Boolean);

  // Badge / tags
  const badges = document.querySelectorAll('.badge, .tag, [class*="badge"], [class*="new"], [class*="label"]');
  data.badges = Array.from(badges).map(b => b.textContent.trim()).filter(Boolean);

  // Get ALL text content sections
  const sections = document.querySelectorAll('section, .section, .product-section, [class*="detail"]');
  data.sectionClasses = Array.from(sections).map(s => s.className);

  return data;
});

console.log("\n=== Rendered DOM data:");
console.log("Desc paragraphs:", pageData.descParagraphs);
console.log("Spec bullets:", pageData.specBullets);
console.log("Sample LIs:", pageData.sampleLis);
console.log("Price texts:", pageData.priceTexts);
console.log("Dim rows:", pageData.dimRows);
console.log("Thumb images:", pageData.thumbImages);
console.log("Sirv images:", pageData.sirvImages);
console.log("Main image:", pageData.mainImage);
console.log("Select options:", JSON.stringify(pageData.selectOptions));
console.log("Breadcrumbs:", pageData.breadcrumbs);
console.log("Badges:", pageData.badges);
console.log("Section classes:", pageData.sectionClasses);

// 3. Dump a targeted slice of the HTML around the product info
const infoHtml = await page.evaluate(() => {
  // Try to find the main product info container
  const container = document.querySelector('#productDetail, .product-detail, [class*="product-detail"], main');
  if (container) return container.innerHTML.slice(0, 5000);
  return document.body.innerHTML.slice(0, 5000);
});
console.log("\n=== Product info HTML (first 5000 chars):\n", infoHtml);

await browser.close();
