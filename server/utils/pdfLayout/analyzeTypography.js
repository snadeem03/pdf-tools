/**
 * Typography analysis and font mapping.
 *
 * Maps PDF internal font names to readable metadata and
 * provides Word-compatible font recommendations.
 *
 * Handles obfuscated font names (e.g., g_d0_f2) by analyzing
 * usage patterns and document context.
 */

// Common PDF font name patterns to Word-compatible names
const FONT_MAP = {
  times: 'Times New Roman',
  courier: 'Courier New',
  serif: 'Times New Roman',
  helvetica: 'Arial',
  arial: 'Arial',
  sans: 'Arial',
  calibri: 'Calibri',
  mono: 'Courier New',
  consolas: 'Courier New',
  'ms-mincho': 'MS Mincho',
  'ms-gothic': 'MS Gothic',
  simhei: 'SimHei',
  simsun: 'SimSun',
};

/**
 * Map a PDF font name to a Word-compatible font name.
 * Uses font metadata when available for accurate mapping.
 */
function mapFontName(pdfFontName, context = {}) {
  if (!pdfFontName) return context.defaultFont || 'Arial';

  const lower = pdfFontName.toLowerCase();

  // Check direct matches first
  for (const [pattern, wordName] of Object.entries(FONT_MAP)) {
    if (lower.includes(pattern)) return wordName;
  }

  // Use font metadata (baseFont) if available
  if (context.fontMap && context.fontMap[pdfFontName]) {
    const fontInfo = context.fontMap[pdfFontName];
    const baseFont = (fontInfo.baseFont || '').toLowerCase();
    if (baseFont.includes('times')) return 'Times New Roman';
    if (baseFont.includes('courier')) return 'Courier New';
    if (baseFont.includes('arial')) return 'Arial';
    if (baseFont.includes('cambria')) return 'Cambria';
    if (baseFont.includes('calibri')) return 'Calibri';
  }

  // For obfuscated names (g_d0_f*), use context
  if (/^g_d\d+_f\d+$/.test(pdfFontName)) {
    // Use font metadata if available
    if (context.fontMap && context.fontMap[pdfFontName]) {
      const fontInfo = context.fontMap[pdfFontName];
      const baseFont = (fontInfo.baseFont || '').toLowerCase();
      if (baseFont.includes('times')) return 'Times New Roman';
      if (baseFont.includes('courier')) return 'Courier New';
      if (baseFont.includes('arial')) return 'Arial';
      if (baseFont.includes('cambria')) return 'Cambria';
    }
    // Fallback: if serif detected, use Times New Roman
    if (context.serifDetected) return 'Times New Roman';
    if (context.sansDetected) return 'Arial';
    return context.defaultFont || 'Times New Roman';
  }

  // Check for common patterns in font names
  if (lower.includes('bold') && lower.includes('italic')) return context.defaultFont || 'Times New Roman';
  if (lower.includes('bold')) return context.defaultFont || 'Times New Roman';
  if (lower.includes('italic') || lower.includes('oblique')) return context.defaultFont || 'Times New Roman';

  // Default based on serif/sans classification
  if (lower.includes('serif') && !lower.includes('sans')) return 'Times New Roman';
  return context.defaultFont || 'Arial';
}

/**
 * Analyze all items to detect serif vs sans-serif and bold/italic patterns.
 *
 * @param {object[]} pages – array of { items: object[] }
 * @returns {object} typography context
 */
function analyzeDocumentTypography(pages) {
  const fontUsages = {};
  let totalSerifScore = 0;
  let totalSansScore = 0;

  for (const page of pages) {
    if (!page.items) continue;
    for (const item of page.items) {
      if (!item.str || item.str.trim().length === 0) continue;

      const key = item.fontName;
      if (!fontUsages[key]) {
        fontUsages[key] = {
          name: key,
          count: 0,
          totalChars: 0,
          sizes: new Set(),
          hasBold: false,
          hasItalic: false,
          samples: [],
        };
      }
      fontUsages[key].count++;
      fontUsages[key].totalChars += (item.str || '').length;
      fontUsages[key].sizes.add(Math.round(item.fontSize));

      if (fontUsages[key].samples.length < 5) {
        fontUsages[key].samples.push(item.str.substring(0, 20));
      }

      // Check font name for bold/italic indicators
      const lower = (item.fontName || '').toLowerCase();
      if (lower.includes('bold') || lower.includes('black') || lower.includes('heavy')) {
        fontUsages[key].hasBold = true;
      }
      if (lower.includes('italic') || lower.includes('oblique') || lower.includes('slant')) {
        fontUsages[key].hasItalic = true;
      }
    }
  }

  // Determine if document is primarily serif or sans-serif
  // Academic papers are typically serif (Times New Roman)
  // Heuristic: if most body text (10pt) uses obfuscated fonts, assume serif
  const bodyTextFonts = Object.values(fontUsages).filter((f) => {
    const sizes = [...f.sizes];
    return sizes.some((s) => s >= 9 && s <= 12);
  });

  const totalBodyChars = bodyTextFonts.reduce((s, f) => s + f.totalChars, 0);
  const obfuscatedBodyChars = bodyTextFonts
    .filter((f) => /^g_d\d+_f\d+$/.test(f.name))
    .reduce((s, f) => s + f.totalChars, 0);

  // If most body text uses obfuscated fonts, it's likely a standard academic font
  const isObfuscated = obfuscatedBodyChars > totalBodyChars * 0.5;

  return {
    fontUsages,
    serifDetected: isObfuscated, // Academic papers with obfuscated fonts are typically serif
    sansDetected: false,
    defaultFont: isObfuscated ? 'Times New Roman' : 'Arial',
    isObfuscated,
  };
}

/**
 * Detect bold from font name.
 */
function detectBold(fontName) {
  if (!fontName) return false;
  const lower = fontName.toLowerCase();
  return lower.includes('bold') || lower.includes('black') || lower.includes('heavy') || lower.includes('strong');
}

/**
 * Detect italic from font name.
 */
function detectItalic(fontName) {
  if (!fontName) return false;
  const lower = fontName.toLowerCase();
  return lower.includes('italic') || lower.includes('oblique') || lower.includes('slant');
}

/**
 * Compute font size in half-points for the docx library.
 * docx uses half-points: 24 = 12pt, 28 = 14pt, etc.
 */
function fontSizeToHalfPoints(pdfFontSize) {
  return Math.round(pdfFontSize * 2);
}

/**
 * Determine if a font size represents a heading based on
 * the distribution of sizes in the document.
 */
function classifyFontSizes(blocks) {
  if (!blocks || blocks.length === 0) return { bodySize: 12, sizes: {} };

  const sizeFreq = {};
  for (const block of blocks) {
    const size = Math.round(block.fontSize);
    sizeFreq[size] = (sizeFreq[size] || 0) + block.text.length;
  }

  let bodySize = 12;
  let maxChars = 0;
  for (const [size, chars] of Object.entries(sizeFreq)) {
    if (chars > maxChars) {
      maxChars = chars;
      bodySize = Number(size);
    }
  }

  const sizes = {};
  for (const size of Object.keys(sizeFreq)) {
    const numSize = Number(size);
    if (numSize > bodySize * 1.8) sizes[numSize] = 'heading1';
    else if (numSize > bodySize * 1.5) sizes[numSize] = 'heading2';
    else if (numSize > bodySize * 1.2) sizes[numSize] = 'heading3';
    else if (numSize > bodySize * 1.1) sizes[numSize] = 'heading4';
    else sizes[numSize] = 'body';
  }

  return { bodySize, sizes };
}

module.exports = {
  mapFontName,
  detectBold,
  detectItalic,
  fontSizeToHalfPoints,
  classifyFontSizes,
  analyzeDocumentTypography,
};
