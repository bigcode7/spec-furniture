import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.goto('https://www.vanguardfurniture.com/styles?Room=LR', {
    waitUntil: 'networkidle2', timeout: 30000,
  });

  // Dump the filter panel structure
  const filterInfo = await page.evaluate(() => {
    const results = {};

    // Find all checkboxes
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    results.totalCheckboxes = checkboxes.length;
    results.checkboxSamples = [...checkboxes].slice(0, 10).map(cb => ({
      id: cb.id,
      name: cb.name,
      value: cb.value,
      checked: cb.checked,
      parentText: cb.parentElement?.textContent?.trim()?.slice(0, 80),
      parentClass: cb.parentElement?.className,
      grandparentClass: cb.parentElement?.parentElement?.className,
    }));

    // Find elements with "Product Type" text
    const allElements = document.querySelectorAll('*');
    const prodTypeElements = [];
    for (const el of allElements) {
      if (el.textContent.includes('Product Type') && el.children.length < 3) {
        prodTypeElements.push({
          tag: el.tagName,
          className: el.className,
          id: el.id,
          text: el.textContent.trim().slice(0, 100),
          nextSiblingTag: el.nextElementSibling?.tagName,
          nextSiblingClass: el.nextElementSibling?.className,
        });
      }
    }
    results.prodTypeElements = prodTypeElements;

    // Find the hidFilterVal
    const hidFilter = document.querySelector('[id*="hidFilterVal"]');
    results.hidFilterVal = hidFilter ? {
      id: hidFilter.id,
      value: hidFilter.value,
      tagName: hidFilter.tagName,
    } : null;

    // Find btnFilterSelect
    const btnFilter = document.querySelector('[id*="btnFilterSelect"]');
    results.btnFilterSelect = btnFilter ? {
      id: btnFilter.id,
      tagName: btnFilter.tagName,
      type: btnFilter.type,
    } : null;

    // Look for divFilters
    const divFilters = document.querySelector('#divFilters, [id*="divFilter"]');
    results.divFilters = divFilters ? {
      id: divFilters.id,
      className: divFilters.className,
      childCount: divFilters.children.length,
      innerHTML: divFilters.innerHTML.slice(0, 1000),
    } : null;

    return results;
  });

  console.log(JSON.stringify(filterInfo, null, 2));

  await browser.close();
}

main().catch(e => console.error(e));
