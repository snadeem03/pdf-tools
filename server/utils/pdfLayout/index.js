/**
 * Layout-aware PDF → DOCX conversion pipeline.
 *
 * Stages:
 *   1. Extract text items with coordinates via pdfjs-dist
 *   2. Text-item normalization
 *   3. Word-spacing reconstruction (groupLines)
 *   4. Document-zone classification
 *   5. Line grouping
 *   6. Paragraph/block grouping
 *   7. Typography analysis
 *   8. Table detection
 *   9. DOCX reconstruction
 */

const { extractTextItems } = require('./extractTextItems');
const { extractImages } = require('./extractImages');
const { groupLines } = require('./groupLines');
const { classifyZones } = require('./classifyZones');
const { groupBlocks } = require('./groupBlocks');
const { detectTables } = require('./detectTables');
const { buildDocx } = require('./buildDocx');
const { analyzeDocumentTypography } = require('./analyzeTypography');

/**
 * Convert a PDF buffer to a DOCX buffer with layout preservation.
 *
 * @param {Buffer} pdfBytes – PDF file content
 * @param {object} [options]
 * @param {boolean} [options.debug=false] – log debug info
 * @returns {Promise<{ buffer: Buffer, stats: object }>}
 */
async function convertPdfToDocx(pdfBytes, options = {}) {
  const { debug = false } = options;
  const stats = {
    totalPages: 0,
    totalItems: 0,
    totalLines: 0,
    totalBlocks: 0,
    tablesDetected: 0,
    mode: 'layout',
  };

  // Stage 1: Extract text items
  const { pages, allItems, fontMap } = await extractTextItems(pdfBytes);
  stats.totalPages = pages.length;
  stats.totalItems = allItems.length;

  // Stage 1b: Extract embedded images
  const { images: extractedImages } = await extractImages(pdfBytes, { debug });
  stats.totalImages = extractedImages.length;

  if (debug) {
    // eslint-disable-next-line no-console
    console.log(`[pdfLayout] Extracted ${allItems.length} items from ${pages.length} pages`);
  }

  // Stage 2: Analyze document typography (before processing)
  const typographyContext = analyzeDocumentTypography(pages);
  typographyContext.fontMap = fontMap;

  if (debug) {
    // eslint-disable-next-line no-console
    console.log(`[pdfLayout] Typography: serif=${typographyContext.serifDetected}, default=${typographyContext.defaultFont}, obfuscated=${typographyContext.isObfuscated}`);
  }

  // Process each page
  const processedPages = [];

  for (const page of pages) {
    const pageResult = processPage(page, { debug, typographyContext });
    processedPages.push(pageResult);

    stats.totalLines += pageResult.lines.length;
    stats.totalBlocks += pageResult.blocks.length;
    stats.tablesDetected += pageResult.tables.length;
  }

  // Stage 5: Classify document zones (after line grouping, on lines)
  classifyZones(processedPages);

  // Stage 6: Re-apply zone-dependent block properties (bold/italic from zone context)
  for (const page of processedPages) {
    for (const block of page.blocks || []) {
      if (block.lines && block.lines.length > 0 && block.lines[0].zone) {
        block.zone = block.lines[0].zone;
      }
      // Update bold/italic based on zone
      block.bold = detectBlockBoldFromZone(block);
      block.italic = detectBlockItalicFromZone(block);
    }
  }

  if (debug) {
    // eslint-disable-next-line no-console
    const zoneCounts = {};
    for (const page of processedPages) {
      for (const line of page.lines) {
        const zone = line.zone || 'UNCLASSIFIED';
        zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
      }
    }
    console.log(`[pdfLayout] Zone classification:`, JSON.stringify(zoneCounts, null, 2));
  }

  // Stage 7: Build DOCX
  const buffer = await buildDocx(processedPages, { typographyContext, images: extractedImages });

  if (debug) {
    // eslint-disable-next-line no-console
    console.log(`[pdfLayout] Stats:`, JSON.stringify(stats, null, 2));
  }

  return { buffer, stats };
}

/**
 * Process a single page through the layout pipeline.
 */
function processPage(page, options = {}) {
  const { debug = false, typographyContext = {} } = options;

  // Stage 2: Group text items into lines
  const lines = groupLines(page.items, page.height).filter(Boolean);

  if (debug) {
    // eslint-disable-next-line no-console
    console.log(`[pdfLayout] Page ${page.pageIndex}: ${page.items.length} items → ${lines.length} lines`);
  }

  // Stage 3: Group lines into blocks/paragraphs
  const blocks = groupBlocks(lines);

  if (debug) {
    // eslint-disable-next-line no-console
    console.log(`[pdfLayout] Page ${page.pageIndex}: ${lines.length} lines → ${blocks.length} blocks`);
  }

  // Stage 4: Detect tables
  const { tables, remaining } = detectTables(blocks, page.width);

  if (debug && tables.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[pdfLayout] Page ${page.pageIndex}: detected ${tables.length} table(s)`);
  }

  return {
    pageIndex: page.pageIndex,
    width: page.width,
    height: page.height,
    items: page.items,
    lines,
    blocks: remaining,
    tables,
  };
}

/**
 * Detect bold from zone context (called after classifyZones).
 * Bold should only be applied based on actual font properties and
 * visual evidence, not blanket zone assignment.
 */
function detectBlockBoldFromZone(block) {
  // Check if the font name itself indicates bold
  if (block.bold) return true;
  if (!block.lines || block.lines.length === 0) return false;

  // Do NOT apply bold to headings - they use heading styles
  // Do NOT apply bold to abstract/index terms - handled at item level
  // Only apply bold if the actual font name indicates it
  return false;
}

/**
 * Detect italic from zone context (called after classifyZones).
 * For ABSTRACT/INDEX_TERMS zones, italic is handled at item level in buildTextRuns,
 * so we don't set block-level italic here.
 */
function detectBlockItalicFromZone(block) {
  if (block.italic) return true;
  if (!block.lines || block.lines.length === 0) return false;

  // ABSTRACT/INDEX_TERMS italic is handled at item level in buildTextRuns
  // (label is italic, body is not)
  const zone = block.zone || block.lines[0].zone || 'BODY';
  if (zone === 'ABSTRACT' || zone === 'INDEX_TERMS') {
    return false;
  }

  return false;
}

module.exports = { convertPdfToDocx };
