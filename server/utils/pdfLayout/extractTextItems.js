let pdfjsLib = null;

async function getPdfJs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfjsLib;
}

/**
 * Extract font metadata from the PDF using pdf-lib.
 * Maps internal font names to their properties (baseFont, isBold, isItalic).
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @returns {Promise<object>} map of fontName → { baseFont, isBold, isItalic, weight, italicAngle }
 */
async function extractFontMetadata(pdfBytes) {
  const { PDFDocument, PDFName } = require('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const fontMap = {};
  const context = pdfDoc.context;

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const resources = page.node.Resources();
    if (!resources) continue;

    const fontDict = resources.get(PDFName.of('Font'));
    if (!fontDict) continue;

    // Iterate font entries
    const fontDictObj = context.lookup(fontDict);
    if (!fontDictObj || !fontDictObj.entries) continue;

    for (const [key, ref] of fontDictObj.entries()) {
      const fontName = key.value().replace(/^\//, '');
      if (fontMap[fontName]) continue;

      try {
        const fontObj = context.lookup(ref);
        if (!fontObj || !fontObj.entries) continue;

        // Get BaseFont
        const baseFontRef = fontObj.get(PDFName.of('BaseFont'));
        const baseFont = baseFontRef ? context.lookup(baseFontRef)?.value() || '' : '';

        // Get FontDescriptor
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

        // Handle Type0 fonts: check DescendantFonts for FontDescriptor
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
        fontMap[fontName] = {
          name: fontName,
          baseFont,
          flags,
          weight,
          italicAngle,
          isBold: weight >= 600 || lowerBase.includes('bold'),
          isItalic: Math.abs(italicAngle) > 5 || lowerBase.includes('italic'),
        };
      } catch {
        fontMap[fontName] = {
          name: fontName,
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

  return fontMap;
}

/**
 * Build a mapping from pdfjs font names to pdf-lib font names.
 * pdfjs uses "g_d0_fN" while pdf-lib uses "F1", "F2", etc.
 * Both reference the same fonts, so we match by base font name.
 */
function buildPdfjsToPdfLibMapping(textItems, pdfLibFontMap) {
  // Collect unique pdfjs font names from text items
  const pdfjsFonts = new Set();
  for (const item of textItems) {
    if (item.fontName) pdfjsFonts.add(item.fontName);
  }

  // Build mapping by matching base font names
  const mapping = {};
  const pdfLibByBase = {};

  for (const [pdfLibName, info] of Object.entries(pdfLibFontMap)) {
    const base = info.baseFont.replace(/^[A-Z]+\+/, '').toLowerCase();
    if (!pdfLibByBase[base]) pdfLibByBase[base] = [];
    pdfLibByBase[base].push({ name: pdfLibName, info });
  }

  for (const pdfjsName of pdfjsFonts) {
    // Try to find a matching pdf-lib font by position
    // pdfjs g_d0_f1 = pdf-lib F1, g_d0_f2 = F2, etc.
    const match = pdfjsName.match(/^g_d\d+_f(\d+)$/);
    if (match) {
      const idx = parseInt(match[1]);
      const pdfLibName = `F${idx}`;
      if (pdfLibFontMap[pdfLibName]) {
        mapping[pdfjsName] = pdfLibFontMap[pdfLibName];
        continue;
      }
    }

    // Fallback: no mapping found
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

  return mapping;
}

/**
 * Build a mapping from pdfjs font names to pdf-lib font info.
 * Matches by BaseFont name since pdfjs (g_d0_fN) and pdf-lib (F1, F2)
 * use different numbering schemes.
 */
function buildFontMapping(pdfjsFontNames, pdfLibFontMap) {
  // Build a lookup by normalized base font name
  const byBaseFont = {};
  for (const [, info] of Object.entries(pdfLibFontMap)) {
    const base = (info.baseFont || '').replace(/^[A-Z]+\+/, '').toLowerCase();
    if (base) {
      byBaseFont[base] = info;
    }
  }

  const mapping = {};
  for (const pdfjsName of pdfjsFontNames) {
    // Try to match by position first (g_d0_f1 = F1, g_d0_f2 = F2, etc.)
    const match = pdfjsName.match(/^g_d\d+_f(\d+)$/);
    if (match) {
      const idx = parseInt(match[1]);
      const pdfLibName = `F${idx}`;
      if (pdfLibFontMap[pdfLibName]) {
        mapping[pdfjsName] = pdfLibFontMap[pdfLibName];
        continue;
      }
    }

    // Fallback: try matching by base font name from the pdfjs name itself
    // Obfuscated names don't help, so use position-based mapping as best effort
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

  return mapping;
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
 *   fontBold   – whether the font is bold (from font descriptor)
 *   fontItalic – whether the font is italic (from font descriptor)
 *   pageWidth  – width of the page this item belongs to
 *   pageHeight – height of the page this item belongs to
 *   pageIndex  – 0-based page index
 *
 * @param {Buffer|Uint8Array} pdfBytes
 * @returns {Promise<{ pages: object[], allItems: object[], fontMap: object }>}
 */
async function extractTextItems(pdfBytes) {
  const lib = await getPdfJs();
  const loadingTask = lib.getDocument({ data: new Uint8Array(pdfBytes) });
  const pdf = await loadingTask.promise;

  // Extract font metadata using pdf-lib
  const pdfLibFontMap = await extractFontMetadata(pdfBytes);

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

  // Collect all unique pdfjs font names
  const pdfjsFontNames = new Set();
  for (const page of pages) {
    for (const item of page.items) {
      if (item.fontName) pdfjsFontNames.add(item.fontName);
    }
  }

  // Build mapping from pdfjs names to pdf-lib font info
  const fontMapping = buildFontMapping(pdfjsFontNames, pdfLibFontMap);

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

  return { pages, allItems, fontMap: pdfLibFontMap };
}

module.exports = { extractTextItems };
