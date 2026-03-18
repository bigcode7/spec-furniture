import puppeteer from 'puppeteer';

const url = "https://www.wesleyhall.com/styles/func/cat/SOF";
const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise(r => setTimeout(r, 5000));

const samples = await page.evaluate(() => {
  const links = document.querySelectorAll('a[href*="/styledetail/"]');
  const results = [];
  for (let i = 0; i < Math.min(links.length, 10); i++) {
    const link = links[i];
    results.push({
      href: link.href,
      innerHTML: link.innerHTML.slice(0, 500),
      textContent: link.textContent?.trim()?.slice(0, 200),
      img: link.querySelector("img")?.src || link.querySelector("img")?.getAttribute("lazyload") || null,
    });
  }
  return results;
});

for (const s of samples) {
  console.log("\n---");
  console.log("href:", s.href);
  console.log("text:", s.textContent);
  console.log("img:", s.img);
  console.log("innerHTML:", s.innerHTML.slice(0, 300));
}

await browser.close();
