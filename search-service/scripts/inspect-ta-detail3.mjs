import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
await page.setViewport({ width: 1440, height: 900 });

// 1. Get listing page source and extract items via regex
const listUrl = "https://theodorealexander.com/item/category/room/value/bedroom?page=1";
await page.goto(listUrl, { waitUntil: "networkidle2", timeout: 60000 });
const listHtml = await page.content();

const match = listHtml.match(/let\s+listItems\s*=\s*(\[[\s\S]*?\]);\s*(?:let|var|const)/);
if (!match) {
  console.log("ERROR: No listItems found");
  await browser.close();
  process.exit(1);
}

let items;
try {
  items = JSON.parse(match[1]);
} catch(e) {
  console.log("JSON parse failed, trying eval...");
  // Can't eval in node easily, let's use page context
  items = await page.evaluate((raw) => {
    try { return eval(raw); } catch { return null; }
  }, match[1]);
}

console.log(`Found ${items?.length} items on bedroom page 1`);
if (items && items.length > 0) {
  const first = items[0];
  console.log("First item keys:", Object.keys(first));
  console.log("First item:", JSON.stringify(first, null, 2));

  // 2. Visit the first product detail page
  const detailUrl = `https://theodorealexander.com/item/product-detail/${first.urlCode}`;
  console.log(`\nVisiting: ${detailUrl}`);
  
  await page.goto(detailUrl, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));
  
  const detailHtml = await page.content();
  
  // Check for error
  if (detailHtml.includes("Something went wrong")) {
    console.log("ERROR: Page returned error");
  } else {
    console.log("Page loaded OK! Title:", await page.title());
    
    // Extract itemDto from source
    const dtoMatch = detailHtml.match(/(?:var|let|const)\s+itemDto\s*=\s*(\{[\s\S]*?\});\s*(?:var|let|const|function|\/\/|<\/script)/);
    if (dtoMatch) {
      // Parse in browser context since it may have JS-specific syntax
      const dto = await page.evaluate((raw) => {
        try { return eval('(' + raw + ')'); } catch(e) { return { error: e.message }; }
      }, dtoMatch[1]);
      
      console.log("\n=== itemDto parsed successfully");
      console.log("Product:", dto.productName);
      console.log("SKU:", dto.sku);
      console.log("Description:", dto.extendedDescription?.slice(0, 300));
      console.log("Width (in):", dto.widthInch, "Depth:", dto.depthInch, "Height:", dto.heightInch);
      console.log("Width (cm):", dto.widthCm, "Depth:", dto.depthCm, "Height:", dto.heightCm);
      console.log("Images:", dto.itemImagetDtos?.length);
      if (dto.itemImagetDtos) {
        for (const img of dto.itemImagetDtos) {
          console.log(`  ${img.isMain ? 'MAIN' : 'ALT '}: ${img.url}`);
        }
      }
      console.log("Collection:", dto.collection?.name);
      console.log("Finish:", dto.finishName);
      console.log("Fabric:", dto.fabricName);
      console.log("Fabric Content:", dto.fabricContent);
      console.log("Cleaning Code:", dto.cleaningCode);
      console.log("Trim:", dto.trimName);
      console.log("Is New:", dto.isNew);
      console.log("Type:", dto.type?.name);
      console.log("Room:", dto.roomAndUsage?.name);
      console.log("Materials:", JSON.stringify(dto.materials));
      console.log("Retail Price:", JSON.stringify(dto.retailPriceList));
      
      // Show ALL keys
      console.log("\n=== ALL itemDto keys:", Object.keys(dto).join(", "));
    } else {
      console.log("No itemDto found in source");
      // Try to find it as a script block
      const scriptMatch = detailHtml.match(/itemDto\s*=\s*(\{[\s\S]{100,}?\})\s*;/);
      console.log("Alternative search:", scriptMatch ? "found" : "not found");
    }
    
    // Also check rendered DOM for images
    const domData = await page.evaluate(() => {
      const sirvImgs = Array.from(document.querySelectorAll('img'))
        .map(i => i.src)
        .filter(u => u.includes('ProductPhotos'));
      const allText = document.body.innerText.slice(0, 2000);
      return { sirvImgs, textSample: allText };
    });
    console.log("\nSirv product images in DOM:", domData.sirvImgs);
    console.log("\nPage text sample:", domData.textSample.slice(0, 1000));
  }
}

await browser.close();
