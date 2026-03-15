import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.goto('https://www.vanguardfurniture.com/styles?Room=LR', {
    waitUntil: 'networkidle2', timeout: 30000,
  });

  // Get the product type filter checkboxes
  const filters = await page.evaluate(() => {
    // Find the "Product Types" panel content
    const panels = document.querySelectorAll('.ClarityPanelBarItemContent');
    for (const panel of panels) {
      const prevHeader = panel.previousElementSibling;
      if (prevHeader && prevHeader.textContent.includes('Product Type')) {
        // Get all checkboxes in this panel
        const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
        return [...checkboxes].map(cb => {
          const label = cb.closest('label') || cb.parentElement;
          const text = label ? label.textContent.trim() : '';
          return {
            id: cb.id,
            name: cb.name,
            value: cb.value,
            text,
          };
        });
      }
    }
    return [];
  });

  console.log(`Found ${filters.length} product type filters:`);
  filters.forEach(f => console.log(`  ${f.text} | id=${f.id}`));

  // Now let's try clicking one filter and see if the page updates
  console.log('\nTesting: Click "Cocktail Tables" filter...');

  // Find and click the cocktail tables checkbox
  const cocktailFilter = filters.find(f => f.text.toLowerCase().includes('cocktail'));
  if (cocktailFilter) {
    console.log(`Clicking: ${cocktailFilter.text} (${cocktailFilter.id})`);

    // Set hidFilterVal and click
    await page.evaluate((filterId) => {
      const cb = document.getElementById(filterId);
      if (cb) {
        cb.checked = true;
        // Set the hidden filter val
        const hidFilter = document.getElementById('hidFilterVal');
        if (hidFilter) hidFilter.value = cb.value || cb.name;
        // Click the filter submit button
        const btn = document.getElementById('btnFilterSelect');
        if (btn) btn.click();
      }
    }, cocktailFilter.id);

    // Wait for postback
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    } catch {}
    await new Promise(r => setTimeout(r, 2000));

    // Check the count now
    const count = await page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/Showing\s+(\d+)\s+of\s+(\d+)/i);
      return match ? { showing: parseInt(match[1]), total: parseInt(match[2]) } : null;
    });
    console.log(`After filter: ${JSON.stringify(count)}`);

    // Extract SKUs
    const skus = await page.evaluate(() => {
      const links = document.querySelectorAll("a[href*='/styles/sku/']");
      return [...links].map(a => a.getAttribute('href').match(/\/styles\/sku\/(.+)/)?.[1]).filter(Boolean);
    });
    console.log(`SKUs found: ${skus.length}`);
    console.log(`First 5: ${skus.slice(0, 5).join(', ')}`);
  }

  await browser.close();
}

main().catch(e => console.error(e));
