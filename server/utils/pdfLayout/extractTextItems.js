let pdfjsLib = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

/**
 * Extract text items with full layout metadata from every page of a PDF.
 *
 * Each item contains:
 *   str        – text content
 *   x          – left edge X (PDF coords, origin bottom-left)
 *   y          – baseline Y  (PDF coords, origin bottom-left)
 *   topY       – top of bounding box (y + height) – convenience
 *   width      – text width in PDF units
 *   height     – text height in PDF units
 *   fontSize   – effective font size (extracted from transform matrix)
 *   fontName   – internal PDF font name
 *   pageWidth  – width of the page this item belongs to
 *   pageHeight – height of the page this item belongs to
 *   pageIndex  – 0-based page index
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @returns {Promise<{ pages: object[], allItems: object[] }>}
 */
async function extractTextItems(pdfBytes) {
  const lib = await getPdfJs();
  const loadingTask = lib.getDocument({ data: new Uint8Array(pdfBytes) });
  const pdf = await loadingTask.promise;

  const pages = [];
  const allItems = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const pageData = {
      pageIndex: i - 1,
      width: viewport.width,
      height: viewport.height,
      items: [],
    };

    for (const item of textContent.items) {
      if (!item.str && !item.hasEOL) continue;

      const t = item.transform;
      // PDF transform matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
      // For most text: t[3] is the font size (scaleY), t[4]=x, t[5]=y (baseline from bottom)
      const fontSize = Math.abs(t[3]);
      const x = t[4];
      const y = t[5];

      const textItem = {
        str: item.str || '',
        x,
        y,
        topY: y + (item.height || fontSize),
        bottomY: y,
        width: item.width || 0,
        height: item.height || fontSize,
        fontSize,
        fontName: item.fontName || '',
        hasEOL: item.hasEOL || false,
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        pageIndex: i - 1,
      };

      pageData.items.push(textItem);
      allItems.push(textItem);
    }

    pages.push(pageData);
  }

  return { pages, allItems };
}

module.exports = { extractTextItems };
