/**
 * Typography analysis and font mapping.
 *
 * Maps PDF internal font names to readable metadata and
 * provides Word-compatible font recommendations.
 */

// Common PDF font name patterns to Word-compatible names
const FONT_MAP = {
  // Serif
  times: 'Times New Roman',
  courier: 'Courier New',
  serif: 'Times New Roman',
  // Sans-serif
  helvetica: 'Arial',
  arial: 'Arial',
  sans: 'Arial',
  calibri: 'Calibri',
  // Monospace
  mono: 'Courier New',
  consolas: 'Courier New',
  // Chinese/Japanese/Korean
  'ms-mincho': 'MS Mincho',
  'ms-gothic': 'MS Gothic',
  'simhei': 'SimHei',
  'simsun': 'SimSun',
};

/**
 * Map a PDF font name to a Word-compatible font name.
 */
function mapFontName(pdfFontName) {
  if (!pdfFontName) return 'Arial';

  const lower = pdfFontName.toLowerCase();

  // Check direct matches first
  for (const [pattern, wordName] of Object.entries(FONT_MAP)) {
    if (lower.includes(pattern)) return wordName;
  }

  // Check for common patterns
  if (lower.includes('bold') && lower.includes('italic')) return 'Arial';
  if (lower.includes('bold')) return 'Arial';
  if (lower.includes('italic') || lower.includes('oblique')) return 'Arial';

  // Default to Arial for sans-serif, Times for serif
  if (lower.includes('serif') && !lower.includes('sans')) return 'Times New Roman';
  return 'Arial';
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

  // Collect all font sizes and their frequencies
  const sizeFreq = {};
  for (const block of blocks) {
    const size = Math.round(block.fontSize);
    sizeFreq[size] = (sizeFreq[size] || 0) + block.text.length;
  }

  // The body font size is the most frequent size by character count
  let bodySize = 12;
  let maxChars = 0;
  for (const [size, chars] of Object.entries(sizeFreq)) {
    if (chars > maxChars) {
      maxChars = chars;
      bodySize = Number(size);
    }
  }

  // Classify sizes
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
};
