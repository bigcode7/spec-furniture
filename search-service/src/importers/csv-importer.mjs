/**
 * METHOD 5 — CSV/Excel product import
 *
 * Parses uploaded CSV data and imports products into the catalog.
 * Supports standard column names with flexible header mapping.
 *
 * Expected columns (flexible naming):
 *   product_name / name / title
 *   vendor / vendor_name / manufacturer
 *   image_url / image / photo_url
 *   product_url / url / link
 *   category / product_type / type
 *   material / materials
 *   style / design_style
 *   collection / line / series
 *   sku / item_number / model
 *   description / desc / details
 *   retail_price / price / msrp
 *   wholesale_price / trade_price / net_price
 *   color / finish
 *   dimensions / size
 */

// ── Progress ─────────────────────────────────────────────────

let lastImportResult = null;

export function getCsvProgress() {
  return lastImportResult;
}

// ── CSV parsing ──────────────────────────────────────────────

/**
 * Parse CSV text into rows. Handles quoted fields with commas and newlines.
 */
function parseCsv(text) {
  const rows = [];
  let current = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ",") {
        current.push(field.trim());
        field = "";
        i++;
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        current.push(field.trim());
        if (current.some((f) => f.length > 0)) {
          rows.push(current);
        }
        current = [];
        field = "";
        i += ch === "\r" ? 2 : 1;
      } else if (ch === "\r") {
        current.push(field.trim());
        if (current.some((f) => f.length > 0)) {
          rows.push(current);
        }
        current = [];
        field = "";
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Last field/row
  current.push(field.trim());
  if (current.some((f) => f.length > 0)) {
    rows.push(current);
  }

  return rows;
}

// ── TSV detection and parsing ────────────────────────────────

function detectDelimiter(firstLine) {
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return tabCount > commaCount ? "\t" : ",";
}

function parseTsv(text) {
  return text.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split("\t").map((f) => f.trim()));
}

// ── Header mapping ───────────────────────────────────────────

const HEADER_MAP = {
  // product_name
  product_name: "product_name", name: "product_name", title: "product_name",
  "product name": "product_name", "product title": "product_name",
  // vendor
  vendor: "vendor_name", vendor_name: "vendor_name", manufacturer: "vendor_name",
  brand: "vendor_name", "vendor name": "vendor_name",
  // vendor_id
  vendor_id: "vendor_id", "vendor id": "vendor_id",
  // image
  image_url: "image_url", image: "image_url", photo_url: "image_url",
  "image url": "image_url", photo: "image_url", "main image": "image_url",
  // url
  product_url: "product_url", url: "product_url", link: "product_url",
  "product url": "product_url", "product link": "product_url",
  // category
  category: "category", product_type: "category", type: "category",
  "product type": "category", "product category": "category",
  // material
  material: "material", materials: "material",
  // style
  style: "style", design_style: "style", "design style": "style",
  // collection
  collection: "collection", line: "collection", series: "collection",
  // sku
  sku: "sku", item_number: "sku", model: "sku", "item number": "sku",
  "model number": "sku", "item #": "sku", "sku #": "sku",
  // description
  description: "description", desc: "description", details: "description",
  // prices
  retail_price: "retail_price", price: "retail_price", msrp: "retail_price",
  "retail price": "retail_price", "list price": "retail_price",
  wholesale_price: "wholesale_price", trade_price: "wholesale_price",
  net_price: "wholesale_price", "wholesale price": "wholesale_price",
  "trade price": "wholesale_price", "net price": "wholesale_price",
  // color
  color: "color", finish: "color", colours: "color", colors: "color",
  // dimensions
  dimensions: "dimensions", size: "dimensions", measurements: "dimensions",
};

function mapHeaders(headerRow) {
  return headerRow.map((h) => {
    const normalized = h.toLowerCase().replace(/[^a-z0-9\s#_]/g, "").replace(/_/g, " ").trim();
    return HEADER_MAP[normalized] || null;
  });
}

function slugify(text) {
  return (text || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ── Main export ──────────────────────────────────────────────

/**
 * Import products from CSV text data.
 *
 * @param {string} csvText - Raw CSV content
 * @param {object} options - { vendor_id?, vendor_name?, source? }
 * @param {object} catalogDB - { insertProducts }
 * @returns {{ products_found, products_imported, errors, column_mapping }}
 */
export function importFromCsv(csvText, options = {}, catalogDB) {
  const result = {
    products_found: 0,
    products_imported: 0,
    rows_total: 0,
    rows_skipped: 0,
    errors: [],
    column_mapping: {},
    started_at: new Date().toISOString(),
    completed_at: null,
  };

  try {
    // Detect delimiter
    const firstLine = csvText.split(/\r?\n/)[0] || "";
    const delimiter = detectDelimiter(firstLine);

    // Parse
    const rows = delimiter === "\t" ? parseTsv(csvText) : parseCsv(csvText);
    if (rows.length < 2) {
      result.errors.push("File has no data rows");
      result.completed_at = new Date().toISOString();
      lastImportResult = result;
      return result;
    }

    // Map headers
    const headerRow = rows[0];
    const mapping = mapHeaders(headerRow);
    result.column_mapping = {};
    for (let i = 0; i < headerRow.length; i++) {
      if (mapping[i]) result.column_mapping[headerRow[i]] = mapping[i];
    }

    const nameIdx = mapping.indexOf("product_name");
    if (nameIdx === -1) {
      result.errors.push("No product name column found. Expected: product_name, name, or title");
      result.completed_at = new Date().toISOString();
      lastImportResult = result;
      return result;
    }

    // Parse rows
    const products = [];
    const dataRows = rows.slice(1);
    result.rows_total = dataRows.length;

    for (let r = 0; r < dataRows.length; r++) {
      const row = dataRows[r];
      const name = row[nameIdx];
      if (!name || name.length < 2) {
        result.rows_skipped++;
        continue;
      }

      const product = {
        product_name: name,
        vendor_id: options.vendor_id || null,
        vendor_name: options.vendor_name || null,
        ingestion_source: options.source || "csv-import",
      };

      // Map each column
      for (let c = 0; c < mapping.length; c++) {
        const field = mapping[c];
        if (!field || field === "product_name") continue;
        const val = row[c];
        if (!val) continue;

        if (field === "retail_price" || field === "wholesale_price") {
          const num = parseFloat(val.replace(/[^0-9.]/g, ""));
          if (!isNaN(num) && num > 0) product[field] = num;
        } else {
          product[field] = val;
        }
      }

      // Generate vendor_id from vendor_name if missing
      if (!product.vendor_id && product.vendor_name) {
        product.vendor_id = slugify(product.vendor_name);
      }

      product.id = `${product.vendor_id || "csv"}_${slugify(product.product_name)}`;
      products.push(product);
    }

    result.products_found = products.length;

    // Insert into catalog DB
    if (products.length > 0 && catalogDB) {
      const dbResult = catalogDB.insertProducts(products);
      result.products_imported = dbResult.inserted + dbResult.updated;
    }

    result.completed_at = new Date().toISOString();
    lastImportResult = result;
    return result;
  } catch (err) {
    result.errors.push(err.message);
    result.completed_at = new Date().toISOString();
    lastImportResult = result;
    return result;
  }
}
