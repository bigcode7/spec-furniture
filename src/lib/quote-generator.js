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
  black: [18, 15, 13],
  darkGray: [34, 29, 25],
  mediumGray: [118, 106, 95],
  lightGray: [191, 181, 170],
  white: [244, 237, 227],
  gold: [198, 161, 106],
  cream: [236, 226, 212],
  taupe: [83, 71, 61],
  sage: [133, 146, 121],
  blueGray: [148, 164, 178],
  cardBg: [28, 24, 21],
  cardSoft: [38, 33, 29],
};

const ROOM_PAGE_TONES = [
  [198, 161, 106],
  [148, 164, 178],
  [133, 146, 121],
  [181, 137, 123],
];

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

function drawGradientBand(doc, x, y, w, h, rgb, alphaSteps = 8) {
  for (let i = 0; i < alphaSteps; i++) {
    const stepY = y + (h / alphaSteps) * i;
    const stepH = h / alphaSteps + 0.2;
    const factor = 0.18 - i * (0.14 / alphaSteps);
    const fill = rgb.map((value) => Math.min(255, Math.round(COLORS.black[0] + (value - COLORS.black[0]) * Math.max(0.2, factor * 4))));
    doc.setFillColor(...fill);
    doc.rect(x, stepY, w, stepH, "F");
  }
}

function drawLuxePanel(doc, x, y, w, h, fill = COLORS.cardBg, radius = 6) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, h, radius, radius, "F");
  doc.setDrawColor(...COLORS.taupe);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, radius, radius, "S");
}

function drawSectionEyebrow(doc, text, x, y, color = COLORS.gold) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...color);
  doc.text(text.toUpperCase(), x, y);
}

function drawRule(doc, x, y, w, color = COLORS.gold, thickness = 0.8) {
  doc.setFillColor(...color);
  doc.rect(x, y, w, thickness, "F");
}

function drawInfoPill(doc, text, x, y, w, fill = COLORS.cardSoft, textColor = COLORS.cream) {
  doc.setFillColor(...fill);
  doc.roundedRect(x, y, w, 10, 5, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...textColor);
  doc.text(text.toUpperCase(), x + w / 2, y + 6.4, { align: "center" });
}

function getTextLines(doc, text, maxWidth, maxLines = Infinity) {
  return doc.splitTextToSize(String(text || ""), maxWidth).slice(0, maxLines);
}

function getBlockHeight(lines, lineHeight, padding = 0) {
  return lines.length * lineHeight + padding;
}

function drawPanelHeading(doc, label, x, y, color = COLORS.gold) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...color);
  doc.text(label.toUpperCase(), x, y);
}

function drawSpecGrid(doc, rows, x, y, w) {
  const gap = 6;
  const colW = (w - gap) / 2;
  const rowH = 18;
  rows.forEach((row, index) => {
    const col = index % 2;
    const line = Math.floor(index / 2);
    const boxX = x + col * (colW + gap);
    const boxY = y + line * (rowH + 4);
    drawLuxePanel(doc, boxX, boxY, colW, rowH, COLORS.cardSoft, 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.mediumGray);
    doc.text(row.label.toUpperCase(), boxX + 6, boxY + 6.5);
    doc.setFont("times", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.white);
    const valueLines = getTextLines(doc, row.value, colW - 12, 2);
    doc.text(valueLines, boxX + 6, boxY + 12);
  });
  return Math.ceil(rows.length / 2) * 22 - 4;
}

function estimateSummaryRoomHeight(roomItems, includeHeader) {
  return (includeHeader ? 18 : 0) + roomItems.length * 8 + 18;
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
  drawGradientBand(doc, 0, 0, pageWidth, 92, COLORS.gold);
  drawGradientBand(doc, 0, pageHeight - 80, pageWidth, 80, COLORS.taupe, 6);

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

  drawSectionEyebrow(doc, "Presentation quote", margin, 24);
  drawRule(doc, margin, 30, 48, COLORS.gold, 1.1);

  // Designer business name (if set)
  if (settings.business_name) {
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.white);
    doc.text(settings.business_name, margin, 50);
  }

  // Designer info line
  const designerParts = [settings.designer_name, settings.email, settings.phone].filter(Boolean);
  if (designerParts.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.mediumGray);
    doc.text(designerParts.join("  |  "), margin, settings.business_name ? 58 : 50);
  }

  const titleY = settings.business_name ? 84 : 76;

  // Project title
  doc.setFont("times", "bold");
  doc.setFontSize(31);
  doc.setTextColor(...COLORS.white);
  const titleLines = doc.splitTextToSize(projectName, contentWidth - 10);
  doc.text(titleLines, margin, titleY);

  // Client name
  let subtitleY = titleY + titleLines.length * 12 + 6;
  if (quote.client_name) {
    doc.setFont("times", "italic");
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.cream);
    doc.text(`Prepared for ${quote.client_name}`, margin, subtitleY);
    subtitleY += 10;
  }

  // Product quote subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text(pdfMode === "trade" ? "Internal trade presentation" : "Curated furniture presentation", margin, subtitleY);

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
  drawInfoPill(doc, pdfMode === "trade" ? "trade presentation" : "client presentation", pageWidth - margin - 42, subtitleY - 6, 42, COLORS.cardSoft, COLORS.gold);

  // Summary stats card
  const statsY = 160;
  drawLuxePanel(doc, margin, statsY, contentWidth, 42, COLORS.cardBg, 7);

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
    doc.setFont("times", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...COLORS.white);
    doc.text(stat.value, x, statsY + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.mediumGray);
    doc.text(stat.label, x, statsY + 28);
  });

  drawLuxePanel(doc, margin, statsY + 48, contentWidth, 18, COLORS.cardSoft, 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.cream);
  doc.text("Curated for client-ready review, room by room, with clear sourcing and pricing context.", margin + 8, statsY + 59);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text("Crafted with Spekd", margin, pageHeight - 18);
  doc.setFont("times", "italic");
  doc.setTextColor(...COLORS.lightGray);
  doc.text("A sourcing presentation designed for refined client review.", margin, pageHeight - 11);

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
      const roomTone = ROOM_PAGE_TONES[(pageNum - 2) % ROOM_PAGE_TONES.length];
      doc.addPage();
      doc.setFillColor(...COLORS.black);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      drawGradientBand(doc, 0, 0, pageWidth, pageHeight, roomTone, 10);
      drawSectionEyebrow(doc, "Room presentation", margin, 42, roomTone);
      drawRule(doc, margin, 48, 44, roomTone, 1.1);

      doc.setFont("times", "bold");
      doc.setFontSize(30);
      doc.setTextColor(...COLORS.white);
      doc.text(roomName, margin, pageHeight / 2 - 6);

      const roomTotal = roomItems.reduce(
        (sum, i) => sum + (Number(i.retail_price) || 0) * (i._quantity || 1), 0
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.setTextColor(...COLORS.mediumGray);
      doc.text(
        `${roomItems.length} ${roomItems.length === 1 ? "selection" : "selections"}${roomTotal > 0 ? ` — $${roomTotal.toLocaleString()}` : ""}`,
        margin, pageHeight / 2 + 10
      );
      drawLuxePanel(doc, margin, pageHeight / 2 + 24, 94, 18, COLORS.cardSoft, 5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.cream);
      doc.text("Composed for room-level review and pricing clarity.", margin + 8, pageHeight / 2 + 35);

      drawFooter(doc, projectName, pageNum, margin, pageWidth, pageHeight);
      pageNum++;
    }

    // Individual product pages
    for (const item of roomItems) {
      doc.addPage();
      doc.setFillColor(...COLORS.black);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      drawGradientBand(doc, 0, 0, pageWidth, 40, COLORS.gold, 6);

      // Header
      drawSectionEyebrow(doc, rooms.size > 1 ? roomName : "Product presentation", margin, 16);
      drawRule(doc, margin, 20, 30, COLORS.gold, 0.9);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.gold);
      const headerText = rooms.size > 1
        ? `${roomName.toUpperCase()} — ITEM ${globalIdx + 1} OF ${items.length}`
        : `PRODUCT ${globalIdx + 1} OF ${items.length}`;
      doc.text(headerText, margin, 26);

      // Quantity badge (if >1)
      if ((item._quantity || 1) > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.gold);
        doc.text(`QTY: ${item._quantity}`, pageWidth - margin, 26, { align: "right" });
      }

      // Product image — aspect-ratio-preserving
      const imgCached = imageCache.get(item.id);
      const imgY = 28;
      const imgBoxHeight = 78;

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
      let y = imgY + imgBoxHeight + 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.gold);
      doc.text(item.manufacturer_name || "Unknown Vendor", margin, y);

      // Product name
      y += 9;
      doc.setFont("times", "bold");
      doc.setFontSize(20);
      doc.setTextColor(...COLORS.white);
      const nameLines = getTextLines(doc, item.product_name || "Untitled Product", contentWidth, 3);
      doc.text(nameLines, margin, y);
      if (item.portal_url) {
        doc.link(margin, y - 7, contentWidth, nameLines.length * 8, { url: item.portal_url });
      }

      y += nameLines.length * 7 + 4;

      // AI Narrative — short one-liner
      const narrative = narrativeMap.get(item.id);
      if (narrative?.narrative) {
        const narrativeLines = getTextLines(doc, narrative.narrative, contentWidth - 16, 3);
        const narrativeHeight = getBlockHeight(narrativeLines, 4.4, 10);
        drawLuxePanel(doc, margin, y - 2, contentWidth, narrativeHeight, COLORS.cardSoft, 5);
        drawPanelHeading(doc, "Editorial note", margin + 8, y + 4, COLORS.gold);
        doc.setFont("times", "italic");
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.cream);
        doc.text(narrativeLines, margin + 8, y + 10);
        y += narrativeHeight + 4;
      }

      // Description fallback (only if no AI narrative)
      const desc = item.snippet || item.description;
      if (desc && !narrative?.narrative) {
        drawPanelHeading(doc, "Description", margin, y + 2, COLORS.mediumGray);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.lightGray);
        const descLines = getTextLines(doc, desc, contentWidth, 3);
        doc.text(descLines, margin, y + 8);
        y += descLines.length * 4.5 + 10;
      } else {
        y += 2;
      }

      // Design justification (Why This Piece)
      const itemJustification = justifications[item.id];
      if (itemJustification) {
        const justLines = getTextLines(doc, itemJustification, contentWidth - 16, 5);
        const justHeight = getBlockHeight(justLines, 4.2, 12);
        drawLuxePanel(doc, margin, y - 1, contentWidth, justHeight, COLORS.cardSoft, 5);
        drawPanelHeading(doc, "Why this piece", margin + 8, y + 5, COLORS.gold);
        doc.setFont("times", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.gold);
        doc.text(justLines, margin + 8, y + 11);
        y += justHeight + 5;
      }

      // Specs card
      const specRows = buildSpecRows(item);
      drawPanelHeading(doc, "Specifications", margin, y + 2, COLORS.mediumGray);
      y += 6;
      y += drawSpecGrid(doc, specRows, margin, y, contentWidth) + 6;

      // Designer notes for this item
      if (item.notes) {
        const noteLines = getTextLines(doc, item.notes, contentWidth - 16, 4);
        const noteHeight = getBlockHeight(noteLines, 4, 12);
        drawLuxePanel(doc, margin, y, contentWidth, noteHeight, COLORS.cardSoft, 5);
        drawPanelHeading(doc, "Designer note", margin + 8, y + 6, COLORS.gold);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(...COLORS.cream);
        doc.text(noteLines, margin + 8, y + 12);
        y += noteHeight + 6;
      }

      // Vendor link button
      if (item.portal_url && y < pageHeight - 35) {
        drawLuxePanel(doc, margin, y, contentWidth, 14, COLORS.cardSoft, 4);
        doc.setFont("times", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...COLORS.gold);
        const linkText = `View on ${item.manufacturer_name || "vendor"} website`;
        doc.text(linkText, margin + contentWidth / 2, y + 9, { align: "center" });
        doc.link(margin, y, contentWidth, 14, { url: item.portal_url });
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
  drawGradientBand(doc, 0, 0, pageWidth, 56, COLORS.gold, 7);
  drawSectionEyebrow(doc, "Quote summary", margin, 24);
  drawRule(doc, margin, 30, 30, COLORS.gold, 0.9);

  let sy = 44;
  drawLuxePanel(doc, margin, sy, contentWidth, 18, COLORS.cardSoft, 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.cream);
  doc.text("Executive summary by room, followed by terms and signature.", margin + 8, sy + 11);
  sy += 28;

  // Room-by-room summary
  for (const [roomName, roomItems] of rooms) {
    const requiredHeight = estimateSummaryRoomHeight(roomItems, rooms.size > 1);
    if (sy + requiredHeight > pageHeight - 52) {
      drawFooter(doc, projectName, pageNum, margin, pageWidth, pageHeight);
      doc.addPage();
      doc.setFillColor(...COLORS.black);
      doc.rect(0, 0, pageWidth, pageHeight, "F");
      drawGradientBand(doc, 0, 0, pageWidth, 38, COLORS.gold, 6);
      drawSectionEyebrow(doc, "Quote summary", margin, 22);
      drawRule(doc, margin, 27, 24, COLORS.gold, 0.8);
      pageNum++;
      sy = 38;
    }

    if (rooms.size > 1) {
      drawLuxePanel(doc, margin, sy - 2, contentWidth, 12, COLORS.cardSoft, 4);
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...COLORS.white);
      doc.text(roomName, margin + 8, sy + 6);
      sy += 16;
    }

    for (const item of roomItems) {
      const qty = item._quantity || 1;
      const price = Number(item.retail_price) || 0;
      const lineTotal = price * qty;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.lightGray);
      const nameTrunc = (item.product_name || "").slice(0, 58) + ((item.product_name || "").length > 58 ? "..." : "");
      doc.text(`${nameTrunc}`, margin + (rooms.size > 1 ? 6 : 0), sy);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.mediumGray);
      const qtyText = qty > 1 ? `x${qty}` : "";
      doc.text(qtyText, pageWidth - margin - 50, sy, { align: "right" });

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.white);
      doc.text(lineTotal > 0 ? `$${lineTotal.toLocaleString()}` : "TBD", pageWidth - margin, sy, { align: "right" });

      doc.setDrawColor(...COLORS.taupe);
      doc.setLineWidth(0.15);
      doc.line(margin + (rooms.size > 1 ? 6 : 0), sy + 2, pageWidth - margin, sy + 2);

      sy += 8;
    }

    // Room subtotal
    if (rooms.size > 1) {
      const roomTotal = roomItems.reduce((sum, i) => sum + (Number(i.retail_price) || 0) * (i._quantity || 1), 0);
      doc.setDrawColor(...COLORS.mediumGray);
      doc.setLineWidth(0.3);
      doc.line(pageWidth - margin - 60, sy, pageWidth - margin, sy);
      sy += 5;
      doc.setFont("times", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...COLORS.white);
      doc.text(`${roomName} Subtotal`, margin + 6, sy);
      doc.text(roomTotal > 0 ? `$${roomTotal.toLocaleString()}` : "TBD", pageWidth - margin, sy, { align: "right" });
      sy += 12;
    }
  }

  // Grand total
  sy += 4;
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.5);
  doc.line(margin, sy, pageWidth - margin, sy);
  sy += 8;
  doc.setFont("times", "bold");
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
  const terms = quote.terms || "Prices valid for 30 days from quote date. Lead times are estimates and may vary. All items remain subject to availability and vendor confirmation.";
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
  doc.setDrawColor(...COLORS.taupe);
  doc.setLineWidth(0.2);
  doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.mediumGray);
  doc.text(`Spekd presentation`, margin, pageHeight - 11);
  doc.text(projectName.slice(0, 48), pageWidth / 2, pageHeight - 11, { align: "center" });
  doc.text(`Page ${pageNum}`, pageWidth - margin, pageHeight - 11, { align: "right" });
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
