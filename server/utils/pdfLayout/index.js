/**
 * Layout-aware PDF → DOCX conversion pipeline.
 *
 * Stages:
 *   1. Extract text items with coordinates via pdfjs-dist
 *   2. Group items into visual lines
 *   3. Group lines into paragraphs/blocks
 *   4. Detect tables from block geometry
 *   5. Build DOCX preserving typography, alignment, spacing, tables
 */

const { extractTextItems } = require('./extractTextItems');
const { groupLines } = require('./groupLines');
const { groupBlocks } = require('./groupBlocks');
const { detectTables } = require('./detectTables');
const { buildDocx } = require('./buildDocx');

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

  // Process each page
  const processedPages = [];

  for (const page of pages) {
    const pageResult = processPage(page, { debug });
    processedPages.push(pageResult);

    stats.totalLines += pageResult.lines.length;
    stats.totalBlocks += pageResult.blocks.length;
    stats.tablesDetected += pageResult.tables.length;
  }

  // Stage 7: Build DOCX
  const buffer = await buildDocx(processedPages);

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
  const { debug = false } = options;

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
    lines,
    blocks: remaining,
    tables,
  };
}

module.exports = { convertPdfToDocx };
