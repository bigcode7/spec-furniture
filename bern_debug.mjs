import puppeteer from 'puppeteer';

async function debug() {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const url = 'https://www.bernhardt.com/shop/?$MultiView=Yes&Sub-Category=Beds&orderBy=BedroomPosition,Id&context=shop&page=1';
  console.log('Loading:', url);

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait extra for Angular
  await new Promise(r => setTimeout(r, 8000));

  // Take screenshot
  await page.screenshot({ path: '/tmp/bern_debug.png', fullPage: true });
  console.log('Screenshot saved to /tmp/bern_debug.png');

  // Dump all element selectors with counts
  const domInfo = await page.evaluate(() => {
    const info = {};
    // Count elements by tag
    for (const tag of ['div', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'span', 'p']) {
      info[tag] = document.querySelectorAll(tag).length;
    }

    // Find elements with product-related classes
    const allEls = document.querySelectorAll('*');
    const productClasses = new Set();
    const productRepeat = new Set();
    for (const el of allEls) {
      const cls = el.className;
      if (typeof cls === 'string' && cls.length > 0) {
        if (/product|item|card|grid|shop|multi-view/i.test(cls)) {
          productClasses.add(cls.substring(0, 100));
        }
      }
      const ngRepeat = el.getAttribute('ng-repeat');
      if (ngRepeat) productRepeat.add(ngRepeat);
    }

    // Find all images
    const images = [];
    for (const img of document.querySelectorAll('img')) {
      const src = img.src || img.getAttribute('ng-src') || img.getAttribute('data-src') || '';
      if (src && !src.includes('pixel') && !src.includes('spacer')) {
        images.push(src.substring(0, 120));
      }
    }

    // Get all text content in h3/h4/h5 elements
    const headings = [];
    for (const h of document.querySelectorAll('h3, h4, h5')) {
      const text = h.textContent.trim();
      if (text && text.length > 2 && text.length < 100) headings.push(text);
    }

    return {
      tagCounts: info,
      productClasses: [...productClasses].slice(0, 30),
      ngRepeats: [...productRepeat],
      images: images.slice(0, 20),
      headings: headings.slice(0, 30),
      bodyText: document.body.innerText.substring(0, 2000),
    };
  });

  console.log('\nTag counts:', domInfo.tagCounts);
  console.log('\nProduct-related classes:', domInfo.productClasses);
  console.log('\nng-repeat directives:', domInfo.ngRepeats);
  console.log('\nImages:', domInfo.images.slice(0, 10));
  console.log('\nHeadings:', domInfo.headings.slice(0, 20));
  console.log('\nBody text (first 1000):', domInfo.bodyText.substring(0, 1000));

  await browser.close();
}

debug().catch(err => { console.error(err); process.exit(1); });
