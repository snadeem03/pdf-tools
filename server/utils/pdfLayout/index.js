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
  const { pages, allItems } = await extractTextItems(pdfBytes);
  stats.totalPages = pages.length;
  stats.totalItems = allItems.length;

  if (debug) {
    // eslint-disable-next-line no-console
    console.log(`[pdfLayout] Extracted ${allItems.length} items from ${pages.length} pages`);
  }

  // Stage 2: Analyze document typography (before processing)
  const typographyContext = analyzeDocumentTypography(pages);

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
      // Update italic based on zone (abstract body text is italic)
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
  const buffer = await buildDocx(processedPages, { typographyContext });

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
 * Detect italic from zone context (called after classifyZones).
 */
function detectBlockItalicFromZone(block) {
  if (block.italic) return true;
  if (!block.lines || block.lines.length === 0) return false;

  const text = block.text || '';
  const zone = block.zone || block.lines[0].zone || 'BODY';

  // Abstract label and Index Terms label are italic
  if (zone === 'ABSTRACT') {
    if (/^Abstract[—–\-]/i.test(text) || /^Index Terms[—–\-]/i.test(text)) {
      return true;
    }
  }

  return false;
}

module.exports = { convertPdfToDocx };
