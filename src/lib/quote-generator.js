import { jsPDF } from "jspdf";
import { getQuote, getQuoteSettings } from "@/lib/growth-store";

const searchServiceUrl = import.meta.env.VITE_SEARCH_SERVICE_URL;

async function fetchQuoteNarratives(items, projectName) {
  if (!searchServiceUrl) return null;
  try {
    const response = await fetch(`${searchServiceUrl.replace(/\/$/, "")}/quote-narratives`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ products: items, project_name: projectName }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.narratives;
  } catch {
    return null;
  }
}

const COLORS = {
  black: [10, 10, 15],
  darkGray: [30, 30, 38],
  mediumGray: [80, 80, 90],
  lightGray: [160, 160, 170],
  white: [255, 255, 255],
  gold: [201, 169, 110],
  cardBg: [20, 20, 28],
};

/**
 * Draw an image preserving its aspect ratio within a bounding box.
 * Centers the image horizontally and vertically, with white background.
 */
function drawImageContained(doc, imgData, boxX, boxY, boxW, boxH) {
  // White background for the image area
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "F");

  if (!imgData || !imgData.dataUrl) return;

  const imgW = imgData.width;
  const imgH = imgData.height;
  if (!imgW || !imgH) return;

  const padding = 4; // mm padding inside the box
  const availW = boxW - padding * 2;
  const availH = boxH - padding * 2;

  const scaleW = availW / imgW;
  const scaleH = availH / imgH;
  const scale = Math.min(scaleW, scaleH);

  const drawW = imgW * scale;
  const drawH = imgH * scale;

  // Center within box
  const drawX = boxX + (boxW - drawW) / 2;
  const drawY = boxY + (boxH - drawH) / 2;

  doc.addImage(imgData.dataUrl, "JPEG", drawX, drawY, drawW, drawH, undefined, "FAST");
}

/**
 * Generate a professional PDF quote from the current quote builder state.
 */
export async function generateQuotePdf(items, projectName = "Untitled Quote", options = {}) {
  const { pdfMode = "client", justifications = {} } = options;
  const quote = getQuote();
  const settings = getQuoteSettings();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ── Page 1: Cover ─────────────────────────────────────────
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Designer logo (top-right) — fit proportionally in a max 50x25mm box
  if (settings.logo_data_url) {
    try {
      const maxLogoW = 50, maxLogoH = 25;
      const img = new Image();
      img.src = settings.logo_data_url;
      const aspect = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 2;
      let logoW = maxLogoW, logoH = logoW / aspect;
      if (logoH > maxLogoH) { logoH = maxLogoH; logoW = logoH * aspect; }
      doc.addImage(settings.logo_data_url, "PNG", pageWidth - margin - logoW, 18, logoW, logoH, undefined, "FAST");
    } catch {
      // Logo failed — skip silently
    }
  }

  // Gold accent line
  doc.setFillColor(...COLORS.gold);
  doc.rect(margin, 36, 40, 1, "F");

  // Designer business name (if set)
  if (settings.business_name) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.white);
    doc.text(settings.business_name, margin, 52);
  }

  // Designer info line
  const designerParts = [settings.designer_name, settings.email, settings.phone].filter(Boolean);
  if (designerParts.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.mediumGray);
    doc.text(designerParts.join("  |  "), margin, settings.business_name ? 60 : 52);
  }

  const titleY = settings.business_name ? 85 : 75;

  // Project title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(...COLORS.white);
  const titleLines = doc.splitTextToSize(projectName, contentWidth);
  doc.text(titleLines, margin, titleY);

  // Client name
  let subtitleY = titleY + titleLines.length * 12 + 6;
  if (quote.client_name) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.lightGray);
    doc.text(`Prepared for ${quote.client_name}`, margin, subtitleY);
    subtitleY += 10;
  }

  // Product quote subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text(pdfMode === "trade" ? "Internal Trade Pricing" : "Product Selection & Quote", margin, subtitleY);

  // Date
  subtitleY += 10;
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.mediumGray);
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(dateStr, margin, subtitleY);

  // Summary stats card
  const statsY = 165;
  doc.setFillColor(...COLORS.cardBg);
  doc.roundedRect(margin, statsY, contentWidth, 30, 4, 4, "F");

  const vendorCount = new Set(items.map((i) => i.manufacturer_name)).size;
  const totalQuantity = items.reduce((sum, i) => sum + (i._quantity || 1), 0);
  const totalEstimate = items.reduce(
    (sum, i) => sum + (Number(i.retail_price) || 0) * (i._quantity || 1),
    0
  );
  const roomCount = new Set(items.map(i => i._room).filter(Boolean)).size;

  const stats = [
    { label: "Items", value: String(totalQuantity) },
    { label: "Vendors", value: String(vendorCount) },
    { label: roomCount > 1 ? "Rooms" : "Est. Total", value: roomCount > 1 ? String(roomCount) : (totalEstimate > 0 ? `$${totalEstimate.toLocaleString()}` : "TBD") },
    { label: "Est. Total", value: totalEstimate > 0 ? `$${totalEstimate.toLocaleString()}` : "TBD" },
  ].slice(0, roomCount > 1 ? 4 : 3);

  stats.forEach((stat, i) => {
    const colWidth = contentWidth / stats.length;
    const x = margin + 12 + i * colWidth;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.white);
    doc.text(stat.value, x, statsY + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.mediumGray);
    doc.text(stat.label, x, statsY + 22);
  });

  // Powered by Spekd
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text("Powered by Spekd", margin, pageHeight - 15);

  // ── Preload images ──────────────────────────────────────────
  const [narrativesData, imageCache] = await Promise.all([
    fetchQuoteNarratives(items, projectName),
    preloadImages(items),
  ]);

  const narrativeMap = new Map();
  if (narrativesData?.products) {
    for (const n of narrativesData.products) {
      if (n.id) narrativeMap.set(n.id, n);
    }
  }

  let pageNum = 2;

  // ── Product Pages ──────────────────────────────────────────
  const rooms = new Map();
  for (const item of items) {
    const room = item._room || "Selections";
    if (!rooms.has(room)) rooms.set(room, []);
    rooms.get(room).push(item);
  }

  let globalIdx = 0;
  for (const [roomName, roomItems] of rooms) {
    // Room divider page if multiple rooms
    if (rooms.size > 1) {
      doc.addPage();
      doc.setFillColor(...COLORS.black);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      doc.setFillColor(...COLORS.gold);
      doc.rect(margin, pageHeight / 2 - 20, 40, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(28);
      doc.setTextColor(...COLORS.white);
      doc.text(roomName, margin, pageHeight / 2);

      const roomTotal = roomItems.reduce(
        (sum, i) => sum + (Number(i.retail_price) || 0) * (i._quantity || 1), 0
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(...COLORS.mediumGray);
      doc.text(
        `${roomItems.length} ${roomItems.length === 1 ? "item" : "items"}${roomTotal > 0 ? ` — $${roomTotal.toLocaleString()}` : ""}`,
        margin, pageHeight / 2 + 14
      );

      drawFooter(doc, projectName, pageNum, margin, pageWidth, pageHeight);
      pageNum++;
    }

    // Individual product pages
    for (const item of roomItems) {
      doc.addPage();
      doc.setFillColor(...COLORS.black);
      doc.rect(0, 0, pageWidth, pageHeight, "F");

      // Header
      doc.setFillColor(...COLORS.gold);
      doc.rect(margin, 18, 30, 0.8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.gold);
      const headerText = rooms.size > 1
        ? `${roomName.toUpperCase()} — ITEM ${globalIdx + 1} OF ${items.length}`
        : `PRODUCT ${globalIdx + 1} OF ${items.length}`;
      doc.text(headerText, margin, 14);

      // Quantity badge (if >1)
      if ((item._quantity || 1) > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gold);
        doc.text(`QTY: ${item._quantity}`, pageWidth - margin, 14, { align: "right" });
      }

      // Product image — aspect-ratio-preserving
      const imgCached = imageCache.get(item.id);
      const imgY = 26;
      const imgBoxHeight = 85;

      if (imgCached) {
        try {
          drawImageContained(doc, imgCached, margin, imgY, contentWidth, imgBoxHeight);
        } catch {
          drawImagePlaceholder(doc, margin, imgY, contentWidth, imgBoxHeight, item);
        }
      } else {
        drawImagePlaceholder(doc, margin, imgY, contentWidth, imgBoxHeight, item);
      }

      if (item.portal_url) {
        doc.link(margin, imgY, contentWidth, imgBoxHeight, { url: item.portal_url });
      }

      // Vendor name
      let y = imgY + imgBoxHeight + 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.gold);
      doc.text(item.manufacturer_name || "Unknown Vendor", margin, y);

      // Product name
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(...COLORS.white);
      const nameLines = doc.splitTextToSize(item.product_name || "Untitled Product", contentWidth);
      doc.text(nameLines, margin, y);
      if (item.portal_url) {
        doc.link(margin, y - 7, contentWidth, nameLines.length * 8, { url: item.portal_url });
      }

      y += nameLines.length * 7 + 6;

      // AI Narrative — short one-liner
      const narrative = narrativeMap.get(item.id);
      if (narrative?.narrative) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.lightGray);
        const narrativeLines = doc.splitTextToSize(narrative.narrative, contentWidth).slice(0, 2);
        doc.text(narrativeLines, margin, y);
        y += narrativeLines.length * 4.5 + 5;
      }

      // Description fallback (only if no AI narrative)
      const desc = item.snippet || item.description;
      if (desc && !narrative?.narrative) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.lightGray);
        const descLines = doc.splitTextToSize(desc, contentWidth).slice(0, 2);
        doc.text(descLines, margin, y);
        y += descLines.length * 4.5 + 6;
      } else {
        y += 2;
      }

      // Design justification (Why This Piece)
      const itemJustification = justifications[item.id];
      if (itemJustification) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.gold);
        const justLines = doc.splitTextToSize(itemJustification, contentWidth - 16).slice(0, 4);
        doc.text(justLines, margin + 8, y);
        y += justLines.length * 4.5 + 5;
      }

      // Specs card
      doc.setFillColor(...COLORS.cardBg);
      const specRows = buildSpecRows(item);
      const specHeight = specRows.length * 10 + 12;
      doc.roundedRect(margin, y, contentWidth, specHeight, 3, 3, "F");

      specRows.forEach((row, i) => {
        const rowY = y + 10 + i * 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.mediumGray);
        doc.text(row.label, margin + 8, rowY);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.white);
        doc.text(String(row.value), margin + 55, rowY);
      });

      y += specHeight + 5;

      // Designer notes for this item
      if (item.notes) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gold);
        const noteLines = doc.splitTextToSize(`Note: ${item.notes}`, contentWidth - 16);
        doc.text(noteLines, margin + 8, y + 3);
        y += noteLines.length * 4 + 6;
      }

      // Vendor link button
      if (item.portal_url && y < pageHeight - 35) {
        doc.setFillColor(...COLORS.cardBg);
        doc.roundedRect(margin, y, contentWidth, 12, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.gold);
        const linkText = `View on ${item.manufacturer_name || "vendor"} website`;
        doc.text(linkText, margin + contentWidth / 2, y + 8, { align: "center" });
        doc.link(margin, y, contentWidth, 12, { url: item.portal_url });
      }

      drawFooter(doc, projectName, pageNum, margin, pageWidth, pageHeight);
      pageNum++;
      globalIdx++;
    }
  }

  // ── Summary Page ───────────────────────────────────────────
  doc.addPage();
  doc.setFillColor(...COLORS.black);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setFillColor(...COLORS.gold);
  doc.rect(margin, 30, 30, 0.8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gold);
  doc.text("QUOTE SUMMARY", margin, 26);

  let sy = 44;

  // Room-by-room summary
  for (const [roomName, roomItems] of rooms) {
    if (rooms.size > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...COLORS.white);
      doc.text(roomName, margin, sy);
      sy += 7;
    }

    for (const item of roomItems) {
      const qty = item._quantity || 1;
      const price = Number(item.retail_price) || 0;
      const lineTotal = price * qty;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.lightGray);
      const nameTrunc = (item.product_name || "").slice(0, 50) + ((item.product_name || "").length > 50 ? "..." : "");
      doc.text(`${nameTrunc}`, margin + (rooms.size > 1 ? 6 : 0), sy);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.mediumGray);
      const qtyText = qty > 1 ? `x${qty}` : "";
      doc.text(qtyText, pageWidth - margin - 50, sy, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.white);
      doc.text(lineTotal > 0 ? `$${lineTotal.toLocaleString()}` : "TBD", pageWidth - margin, sy, { align: "right" });

      sy += 6;

      if (sy > pageHeight - 60) {
        drawFooter(doc, projectName, pageNum, margin, pageWidth, pageHeight);
        doc.addPage();
        doc.setFillColor(...COLORS.black);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        pageNum++;
        sy = 30;
      }
    }

    // Room subtotal
    if (rooms.size > 1) {
      const roomTotal = roomItems.reduce((sum, i) => sum + (Number(i.retail_price) || 0) * (i._quantity || 1), 0);
      doc.setDrawColor(...COLORS.mediumGray);
      doc.setLineWidth(0.3);
      doc.line(pageWidth - margin - 60, sy, pageWidth - margin, sy);
      sy += 5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.white);
      doc.text(`${roomName} Subtotal`, margin + 6, sy);
      doc.text(roomTotal > 0 ? `$${roomTotal.toLocaleString()}` : "TBD", pageWidth - margin, sy, { align: "right" });
      sy += 10;
    }
  }

  // Grand total
  sy += 4;
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.5);
  doc.line(margin, sy, pageWidth - margin, sy);
  sy += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.white);
  doc.text("Total", margin, sy);
  doc.text(totalEstimate > 0 ? `$${totalEstimate.toLocaleString()}` : "Prices on request", pageWidth - margin, sy, { align: "right" });

  sy += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text(`${totalQuantity} items from ${vendorCount} vendors`, margin, sy);

  // Terms
  sy += 16;
  const terms = quote.terms || "Prices valid for 30 days from quote date. Lead times are estimates and may vary. All items subject to availability.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.mediumGray);
  const termLines = doc.splitTextToSize(terms, contentWidth);
  doc.text(termLines, margin, sy);

  // Signature line
  sy += termLines.length * 3.5 + 20;
  if (sy < pageHeight - 40) {
    doc.setDrawColor(...COLORS.mediumGray);
    doc.setLineWidth(0.3);
    doc.line(margin, sy, margin + 80, sy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.mediumGray);
    doc.text("Client Signature", margin, sy + 5);
    doc.text("Date: _______________", margin + 90, sy + 5);
  }

  drawFooter(doc, projectName, pageNum, margin, pageWidth, pageHeight);

  // Download
  const filename = sanitizeFilename(projectName || quote.client_name || "Quote");
  const suffix = pdfMode === "trade" ? "-TRADE" : "";
  doc.save(`Spekd-Quote-${filename}${suffix}.pdf`);
}

function buildSpecRows(item) {
  const rows = [];
  if (item.material) rows.push({ label: "Material", value: item.material });
  if (item.collection) rows.push({ label: "Collection", value: item.collection });
  if (item.sku) rows.push({ label: "SKU", value: item.sku });

  // Show price (already markup-adjusted if applicable)
  const priceLabel = item._is_trade ? "Est. Trade" : "Price";
  if (item.retail_price) rows.push({ label: priceLabel, value: `$${Number(item.retail_price).toLocaleString()}` });

  if (item.manufacturer_name) rows.push({ label: "Vendor", value: item.manufacturer_name });

  // Dimensions
  const dims = [];
  if (item.width) dims.push(`${item.width}"W`);
  if (item.depth) dims.push(`${item.depth}"D`);
  if (item.height) dims.push(`${item.height}"H`);
  const dimStr = dims.join(" x ") || item.dimensions || null;
  if (dimStr) rows.push({ label: "Dimensions", value: dimStr });

  if ((item._quantity || 1) > 1) rows.push({ label: "Quantity", value: String(item._quantity) });
  if (item.lead_time_weeks) rows.push({ label: "Lead Time", value: `${item.lead_time_weeks} weeks` });
  if (rows.length === 0) rows.push({ label: "Status", value: "Contact vendor for details" });
  return rows;
}

function drawFooter(doc, projectName, pageNum, margin, pageWidth, pageHeight) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text(`Powered by Spekd`, margin, pageHeight - 12);
  doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 12, { align: "right" });
}

function drawImagePlaceholder(doc, x, y, w, h, item) {
  doc.setFillColor(...COLORS.cardBg);
  doc.roundedRect(x, y, w, h, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.setTextColor(40, 40, 50);
  const initial = (item.manufacturer_name || "?")[0].toUpperCase();
  doc.text(initial, x + w / 2, y + h / 2 + 6, { align: "center" });
}

async function preloadImages(items) {
  const cache = new Map();
  const seen = new Set();
  const tasks = items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).map(async (item) => {
    const url = item.image_url || item.thumbnail;
    if (!url) return;
    try {
      // Try direct CORS first, then proxy fallback
      let result = await fetchImageDirect(url);
      if (!result && searchServiceUrl) {
        result = await fetchImageViaProxy(url);
      }
      if (result) cache.set(item.id, result);
    } catch {
      // Skip failed images
    }
  });
  await Promise.allSettled(tasks);
  return cache;
}

/**
 * Try loading image directly with CORS (works for CDNs that allow it).
 */
function fetchImageDirect(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const result = imageToDataUrl(img);
        resolve(result);
      } catch {
        resolve(null); // tainted canvas — CORS blocked
      }
    };
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 6000);
    img.src = url;
  });
}

/**
 * Fetch image through our backend proxy (bypasses CORS).
 */
async function fetchImageViaProxy(url) {
  try {
    const proxyUrl = `${searchServiceUrl.replace(/\/$/, "")}/proxy-image?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const result = imageToDataUrl(img);
          resolve(result);
        } catch {
          resolve(null);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(blobUrl); resolve(null); };
      setTimeout(() => { URL.revokeObjectURL(blobUrl); resolve(null); }, 8000);
      img.src = blobUrl;
    });
  } catch {
    return null;
  }
}

/**
 * Convert an Image element to a data URL + dimensions.
 * Draws onto canvas, returns { dataUrl, width, height }.
 */
function imageToDataUrl(img) {
  const canvas = document.createElement("canvas");
  const maxDim = 800;
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // White background (prevents black bg on transparent PNGs)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  // Return canvas dimensions (these are the actual pixel dims of the data URL)
  return { dataUrl, width: w, height: h };
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9-_\s]/g, "").replace(/\s+/g, "-").slice(0, 50) || "quote";
}
