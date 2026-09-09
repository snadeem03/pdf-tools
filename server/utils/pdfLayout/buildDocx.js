/**
 * DOCX reconstruction from analyzed PDF layout data.
 *
 * Builds a Word document preserving:
 *   - headings (H1-H4)
 *   - font sizes
 *   - bold / italic
 *   - alignment
 *   - paragraph spacing
 *   - tables (editable, with borders)
 *   - page breaks
 *   - page dimensions and margins
 *   - headers and footers
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  PageBreak,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  WidthType,
  ShadingType,
  convertInchesToTwip,
  Header,
  Footer,
} = require('docx');

const { mapFontName, fontSizeToHalfPoints, classifyFontSizes } = require('./analyzeTypography');

// Word heading levels mapping
const HEADING_LEVELS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
};

// PDF to Word alignment mapping
const ALIGN_MAP = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justified: AlignmentType.JUSTIFIED,
};

/**
 * Build a complete DOCX document from analyzed page data.
 *
 * @param {object[]} pages – array of { blocks: object[], tables: object[], width, height, pageIndex }
 * @param {object} [options]
 * @param {object} [options.typographyContext] – typography analysis results
 * @returns {Promise<Buffer>} – DOCX file buffer
 */
async function buildDocx(pages, options = {}) {
  const { typographyContext = {} } = options;

  // Classify font sizes across all blocks
  const allBlocks = pages.flatMap((p) => p.blocks || []);
  const { bodySize } = classifyFontSizes(allBlocks);

  // Extract headers and footers from all pages
  const headerFooter = extractHeaderFooter(pages);

  // Compute default margins (approximate from typical PDF margins)
  const defaultMargin = convertInchesToTwip(1);

  const sections = [];

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const pageWidth = page.width || 612;
    const pageHeight = page.height || 792;

    const sectionWidth = Math.round((pageWidth / 72) * 1440);
    const sectionHeight = Math.round((pageHeight / 72) * 1440);

    const children = [];

    // Merge tables and blocks, preserving order
    const elements = mergeElements(page);

    for (const element of elements) {
      if (element.type === 'table') {
        const table = buildTable(element, bodySize, typographyContext);
        if (table) {
          children.push(table);
          children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
        }
      } else {
        const paragraph = buildParagraph(element, bodySize, typographyContext);
        if (paragraph) children.push(paragraph);
      }
    }

    // Add page break between pages (except after last page)
    if (pageIdx < pages.length - 1 && children.length > 0) {
      children.push(
        new Paragraph({
          children: [new PageBreak()],
          spacing: { before: 0, after: 0 },
        })
      );
    }

    // Build section config with headers/footers
    const sectionConfig = {
      properties: {
        page: {
          size: {
            width: sectionWidth,
            height: sectionHeight,
          },
          margin: {
            top: defaultMargin,
            bottom: defaultMargin,
            left: defaultMargin,
            right: defaultMargin,
          },
        },
      },
      children,
    };

    // Add headers and footers for this page
    const pageHeaders = headerFooter.headers.filter((h) => h.pageIndex === pageIdx);
    const pageFooters = headerFooter.footers.filter((f) => f.pageIndex === pageIdx);

    if (pageHeaders.length > 0 || pageFooters.length > 0) {
      const headerContent = buildHeaderFooter(pageHeaders, pageWidth, typographyContext, 'header');
      const footerContent = buildHeaderFooter(pageFooters, pageWidth, typographyContext, 'footer');

      if (headerContent) {
        sectionConfig.headers = { default: headerContent };
      }
      if (footerContent) {
        sectionConfig.footers = { default: footerContent };
      }
    }

    sections.push(sectionConfig);
  }

  // If no sections were created (empty PDF), add a minimal one
  if (sections.length === 0) {
    sections.push({
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({ text: 'No content could be extracted from this PDF.', size: 24, font: 'Arial' }),
          ],
        }),
      ],
    });
  }

  const doc = new Document({
    creator: 'PDFNova',
    title: 'Converted from PDF',
    sections,
  });

  return Packer.toBuffer(doc);
}

/**
 * Extract headers and footers from page data.
 */
function extractHeaderFooter(pages) {
  const headers = [];
  const footers = [];

  for (const page of pages) {
    const allItems = page.items || [];
    const pageIdx = page.pageIndex;

    for (const item of allItems) {
      const zone = item.zone || '';

      // Header items are at the top of the page
      if (zone === 'HEADER') {
        headers.push({
          text: (item.str || '').trim(),
          y: item.y,
          pageIndex: pageIdx,
        });
      }

      // Footer items are at the bottom of the page
      if (zone === 'FOOTER') {
        footers.push({
          text: (item.str || '').trim(),
          y: item.y,
          pageIndex: pageIdx,
        });
      }
    }
  }

  return { headers, footers };
}

/**
 * Build a header or footer.
 * @param {object[]} items - header/footer items
 * @param {number} pageWidth - page width in points
 * @param {object} typographyContext - typography context
 * @param {string} type - 'header' or 'footer'
 * @returns {Header|Footer|null}
 */
function buildHeaderFooter(items, pageWidth, typographyContext, type) {
  if (!items || items.length === 0) return null;

  // Sort by Y position
  items.sort((a, b) => a.y - b.y);

  // Combine text items into a single line
  const text = items.map((i) => i.text).join(' ');

  if (!text.trim()) return null;

  // Determine alignment based on position
  const avgX = items.reduce((s, i) => s + (i.x || 0), 0) / items.length;
  const centerX = pageWidth / 2;

  let alignment = AlignmentType.CENTER;
  if (avgX < centerX * 0.5) alignment = AlignmentType.LEFT;
  else if (avgX > centerX * 1.5) alignment = AlignmentType.RIGHT;

  const paragraph = new Paragraph({
    children: [
      new TextRun({
        text,
        font: typographyContext?.defaultFont || 'Arial',
        size: 18,
        color: '888888',
      }),
    ],
    alignment,
    spacing: { before: 0, after: 0 },
  });

  if (type === 'footer') {
    return new Footer({ children: [paragraph] });
  }
  return new Header({ children: [paragraph] });
}

/**
 * Merge tables and blocks into a single ordered list.
 */
function mergeElements(page) {
  const elements = [];
  const processedBlocks = new Set();

  // Add tables first
  for (const table of page.tables || []) {
    elements.push(table);
  }

  // Add remaining blocks
  for (const block of page.blocks || []) {
    if (!processedBlocks.has(block)) {
      elements.push(block);
    }
  }

  return elements;
}

/**
 * Build a docx Paragraph from a text block.
 */
function buildParagraph(block, bodySize, typographyContext) {
  if (!block || !block.text || !block.text.trim()) return null;

  const isHeading = block.isHeading && block.headingLevel > 0;
  const headingLevel = isHeading ? HEADING_LEVELS[Math.min(block.headingLevel, 4)] : undefined;

  const halfPoints = fontSizeToHalfPoints(block.fontSize);
  const fontName = mapFontName(block.fontName, typographyContext);
  const alignment = ALIGN_MAP[block.alignment] || AlignmentType.LEFT;

  // Spacing estimation
  const spacingBefore = isHeading ? Math.round(bodySize * 40) : 0;
  const spacingAfter = isHeading ? Math.round(bodySize * 20) : 120;

  const runs = buildTextRuns(block, fontName, halfPoints, typographyContext);

  const paragraphConfig = {
    children: runs,
    alignment,
    spacing: {
      before: spacingBefore,
      after: spacingAfter,
      line: block.lineCount > 1 ? 276 : undefined,
    },
  };

  if (isHeading && headingLevel) {
    paragraphConfig.heading = headingLevel;
  }

  // Indentation
  const leftMargin = 72;
  if (block.leftX > leftMargin + 20) {
    const indentTwips = Math.round(((block.leftX - leftMargin) / 72) * 1440);
    paragraphConfig.indent = { left: Math.min(indentTwips, convertInchesToTwip(3)) };
  }

  return new Paragraph(paragraphConfig);
}

/**
 * Build TextRuns for a block.
 */
function buildTextRuns(block, fontFamily, halfPoints, typographyContext) {
  const runs = [];

  if (block.lines && block.lines.length > 0) {
    for (const line of block.lines) {
      for (const item of line.items) {
        if (item.str && item.str.trim()) {
          const itemFont = mapFontName(item.fontName, typographyContext);
          runs.push(
            new TextRun({
              text: item.str,
              font: itemFont,
              size: fontSizeToHalfPoints(item.fontSize || block.fontSize),
              bold: block.bold || false,
              italics: block.italic || false,
            })
          );
        }
      }
    }
  }

  if (runs.length === 0) {
    runs.push(
      new TextRun({
        text: block.text,
        font: fontFamily,
        size: halfPoints,
        bold: block.bold || false,
        italics: block.italic || false,
      })
    );
  }

  return runs;
}

/**
 * Build a docx Table from a detected table structure.
 */
function buildTable(table, bodySize, typographyContext) {
  if (!table || !table.rows || table.rows.length === 0) return null;

  const columns = table.columns || (table.rows[0] ? table.rows[0].length : 0);
  if (columns === 0) return null;

  const columnWidths = computeColumnWidths(table, columns);
  const tableRows = [];

  for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
    const row = table.rows[rowIdx];
    const cells = [];

    for (let colIdx = 0; colIdx < columns; colIdx++) {
      const cellData = row[colIdx];
      const text = cellData ? cellData.text : '';
      const cellFontSize = cellData ? cellData.fontSize : bodySize;
      const isBold = cellData ? cellData.bold : false;

      const cellWidth = columnWidths[colIdx] || 2000;

      const cell = new TableCell({
        width: {
          size: cellWidth,
          type: WidthType.DXA,
        },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
          right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text,
                font: typographyContext?.defaultFont || 'Arial',
                size: fontSizeToHalfPoints(cellFontSize),
                bold: isBold,
              }),
            ],
            spacing: { before: 40, after: 40 },
          }),
        ],
      });

      cells.push(cell);
    }

    tableRows.push(new TableRow({ children: cells }));
  }

  return new Table({
    rows: tableRows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

/**
 * Compute approximate column widths based on table structure.
 */
function computeColumnWidths(table, columns) {
  const totalWidth = 9000;

  if (table.columnPositions && table.columnPositions.length >= 2) {
    const positions = [...table.columnPositions].sort((a, b) => a - b);
    const widths = [];

    for (let i = 0; i < columns; i++) {
      if (i === 0) {
        widths.push(Math.round(((positions[1] || positions[0] + 100) - positions[0]) / 72 * 1440));
      } else if (i < positions.length) {
        widths.push(Math.round(((positions[i] - positions[i - 1]) / 72) * 1440));
      } else {
        widths.push(Math.round(totalWidth / columns));
      }
    }

    return widths;
  }

  const equalWidth = Math.round(totalWidth / columns);
  return Array(columns).fill(equalWidth);
}

module.exports = { buildDocx };
