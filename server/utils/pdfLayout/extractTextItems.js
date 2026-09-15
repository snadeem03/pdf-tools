let pdfjsLib = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

/**
 * Extract font metadata from the PDF using pdf-lib.
 * Returns a per-page map: { pageIndex: { fontResourceName: fontInfo } }
 * and a flat deduplicated map by base font name.
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @returns {Promise<{ perPage: object, byBaseFont: object }>}
 */
async function extractFontMetadata(pdfBytes) {
  const { PDFDocument, PDFName } = require('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const context = pdfDoc.context;

  const pages = pdfDoc.getPages();
  const perPage = {};
  const byBaseFont = {};

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const resources = page.node.Resources();
    if (!resources) continue;

    const fontDict = resources.get(PDFName.of('Font'));
    if (!fontDict) continue;

    const fontDictObj = context.lookup(fontDict);
    if (!fontDictObj || !fontDictObj.entries) continue;

    perPage[pageIdx] = {};

    for (const [key, ref] of fontDictObj.entries()) {
      const fontResName = key.value().replace(/^\//, '');

      try {
        const fontObj = context.lookup(ref);
        if (!fontObj || !fontObj.entries) continue;

        const baseFontRef = fontObj.get(PDFName.of('BaseFont'));
        const baseFont = baseFontRef ? context.lookup(baseFontRef)?.value() || '' : '';

        let weight = 400;
        let italicAngle = 0;
        let flags = 0;

        const fdRef = fontObj.get(PDFName.of('FontDescriptor'));
        if (fdRef) {
          const fd = context.lookup(fdRef);
          if (fd && fd.entries) {
            const flagsRef = fd.get(PDFName.of('Flags'));
            if (flagsRef) flags = context.lookup(flagsRef)?.value() || 0;
            const fwRef = fd.get(PDFName.of('FontWeight'));
            if (fwRef) weight = context.lookup(fwRef)?.value() || 400;
            const iaRef = fd.get(PDFName.of('ItalicAngle'));
            if (iaRef) italicAngle = context.lookup(iaRef)?.value() || 0;
          }
        }

        // Handle Type0 fonts
        if (!fdRef) {
          const descRef = fontObj.get(PDFName.of('DescendantFonts'));
          if (descRef) {
            const descArray = context.lookup(descRef);
            if (descArray && descArray.get) {
              const firstFontRef = descArray.get(0);
              if (firstFontRef) {
                const descFont = context.lookup(firstFontRef);
                if (descFont) {
                  const fdRef2 = descFont.get(PDFName.of('FontDescriptor'));
                  if (fdRef2) {
                    const fd2 = context.lookup(fdRef2);
                    if (fd2 && fd2.entries) {
                      const fwRef2 = fd2.get(PDFName.of('FontWeight'));
                      if (fwRef2) weight = context.lookup(fwRef2)?.value() || weight;
                      const iaRef2 = fd2.get(PDFName.of('ItalicAngle'));
                      if (iaRef2) italicAngle = context.lookup(iaRef2)?.value() || italicAngle;
                    }
                  }
                }
              }
            }
          }
        }

        const lowerBase = (baseFont || '').toLowerCase();
        const isStdFont = !fdRef && baseFont;
        let isBold = weight >= 600 || lowerBase.includes('bold');
        let isItalic = Math.abs(italicAngle) > 5 || lowerBase.includes('italic');
        if (isStdFont) {
          isBold = lowerBase.includes('bold') || lowerBase.includes('black') || lowerBase.includes('heavy');
          isItalic = lowerBase.includes('italic') || lowerBase.includes('oblique');
        }

        const info = {
          name: fontResName,
          baseFont,
          flags,
          weight,
          italicAngle,
          isBold,
          isItalic,
          _objRef: ref.toString(),
        };

        perPage[pageIdx][fontResName] = info;

        // Deduplicate by base font name (all variants of same base font have same properties)
        const normBase = baseFont.replace(/^[A-Z]+\+/, '').toLowerCase();
        if (normBase && !byBaseFont[normBase]) {
          byBaseFont[normBase] = info;
        }
      } catch {
        perPage[pageIdx][fontResName] = {
          name: fontResName,
          baseFont: '',
          flags: 0,
          weight: 400,
          italicAngle: 0,
          isBold: false,
          isItalic: false,
        };
      }
    }
  }

  return { perPage, byBaseFont };
}

/**
 * Build a mapping from pdfjs font names to font info.
 *
 * pdfjs font names are "g_d{pageObjId}_f{fontIndex}" where fontIndex
 * is 1-based and corresponds to the order of first appearance of each
 * unique font object reference in the page's font dictionary.
 *
 * pdf-lib creates a new dictionary entry for each drawText call, but they
 * all reference the same underlying font object. We deduplicate by the
 * indirect object reference to get the unique fonts in first-appearance order.
 */
function buildFontMapping(pages, pdfLibPerPage) {
  const mapping = {};

  for (const page of pages) {
    const pageFonts = pdfLibPerPage[page.pageIndex] || {};

    // Get font resource names in dictionary order
    const fontResNames = Object.keys(pageFonts);

    // Build ordered list of unique fonts by indirect object reference
    // (first appearance of each unique font object = the order pdfjs assigns indices)
    const uniqueByRef = [];
    const seenRefs = new Set();
    for (const resName of fontResNames) {
      const info = pageFonts[resName];
      // Use baseFont as a proxy for the object identity (all entries with same
      // baseFont reference the same underlying PDF object)
      const refKey = info._objRef || info.baseFont;
      if (refKey && !seenRefs.has(refKey)) {
        seenRefs.add(refKey);
        uniqueByRef.push(info);
      }
    }

    // Collect unique pdfjs font names used on this page
    const pagePdfjsFonts = new Set();
    for (const item of page.items) {
      if (item.fontName) pagePdfjsFonts.add(item.fontName);
    }

    // Sort pdfjs fonts by their index number
    const sortedPdfjs = [];
    for (const name of pagePdfjsFonts) {
      const match = name.match(/^g_d\d+_f(\d+)$/);
      if (match) {
        sortedPdfjs.push({ name, idx: parseInt(match[1]) });
      }
    }
    sortedPdfjs.sort((a, b) => a.idx - b.idx);

    // Map by position: f1→uniqueByRef[0], f2→uniqueByRef[1], etc.
    for (let i = 0; i < sortedPdfjs.length; i++) {
      const pdfjsName = sortedPdfjs[i].name;
      if (mapping[pdfjsName]) continue;

      if (i < uniqueByRef.length) {
        mapping[pdfjsName] = uniqueByRef[i];
      } else {
        mapping[pdfjsName] = {
          name: pdfjsName,
          baseFont: '',
          flags: 0,
          weight: 400,
          italicAngle: 0,
          isBold: false,
          isItalic: false,
        };
      }
    }
  }

  return mapping;
}

/**
 * Extract text items with full layout metadata from every page of a PDF.
 *
 * Each item contains:
 *   str, x, y, topY, bottomY, width, height, fontSize, fontName,
 *   fontBold, fontItalic, fontBaseFont, pageWidth, pageHeight, pageIndex
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @returns {Promise<{ pages: object[], allItems: object[], fontMap: object }>}
 */
async function extractTextItems(pdfBytes) {
  const lib = await getPdfJs();
  const loadingTask = lib.getDocument({ data: new Uint8Array(pdfBytes) });
  const pdf = await loadingTask.promise;

  // Extract font metadata using pdf-lib (per-page)
  const { perPage: pdfLibPerPage, byBaseFont } = await extractFontMetadata(pdfBytes);

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
      const fontSize = Math.abs(t[3]);
      const x = t[4];
      const y = t[5];

      pageData.items.push({
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
      });
    }

    pages.push(pageData);
  }

  // Build mapping from pdfjs names to pdf-lib font info
  const fontMapping = buildFontMapping(pages, pdfLibPerPage);

  // Enrich items with font metadata
  for (const page of pages) {
    for (const item of page.items) {
      const fontInfo = fontMapping[item.fontName] || {};
      item.fontBold = fontInfo.isBold || false;
      item.fontItalic = fontInfo.isItalic || false;
      item.fontBaseFont = fontInfo.baseFont || '';
    }
    allItems.push(...page.items);
  }

  return { pages, allItems, fontMap: byBaseFont };
}

module.exports = { extractTextItems };
