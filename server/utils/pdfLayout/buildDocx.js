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
  Numbering,
  LevelFormat,
  convertMillimetersToTwip,
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

  // Compute actual margins from page content
  const pageMargins = computePageMargins(pages);

  const sections = [];

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const pageWidth = page.width || 612;
    const pageHeight = page.height || 792;

    const sectionWidth = Math.round((pageWidth / 72) * 1440);
    const sectionHeight = Math.round((pageHeight / 72) * 1440);

    const margins = pageMargins[pageIdx] || { top: 720, bottom: 720, left: 708, right: 708 };

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
            top: margins.top,
            bottom: margins.bottom,
            left: margins.left,
            right: margins.right,
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
    numbering: {
      config: [
        {
          reference: 'pdf-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '\u2022',
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: convertMillimetersToTwip(12.7), hanging: convertMillimetersToTwip(6.35) },
                },
              },
            },
          ],
        },
      ],
    },
    sections,
  });

  return Packer.toBuffer(doc);
}

/**
 * Compute actual page margins from block positions.
 */
function computePageMargins(pages) {
  const result = [];

  for (const page of pages) {
    const blocks = page.blocks || [];
    if (blocks.length === 0) {
      result.push({ top: 720, bottom: 720, left: 708, right: 708 });
      continue;
    }

    const allLeftX = blocks.map((b) => b.leftX).filter((x) => x > 0).sort((a, b) => a - b);
    const allRightX = blocks.map((b) => b.rightX).filter((x) => x > 0).sort((a, b) => b - a);
    const allTopY = blocks.map((b) => b.topY).sort((a, b) => b - a);
    const allBottomY = blocks.map((b) => b.bottomY).sort((a, b) => a - b);

    // Use 10th percentile for margins
    const leftPt = allLeftX[Math.floor(allLeftX.length * 0.1)] || 72;
    const rightPt = allRightX[Math.floor(allRightX.length * 0.1)] || (page.width - 72);
    const topPt = allTopY[Math.floor(allTopY.length * 0.1)] || (page.height - 72);
    const bottomPt = allBottomY[Math.floor(allBottomY.length * 0.1)] || 72;

    result.push({
      top: Math.round(((page.height - topPt) / 72) * 1440),
      bottom: Math.round((bottomPt / 72) * 1440),
      left: Math.round((leftPt / 72) * 1440),
      right: Math.round(((page.width - rightPt) / 72) * 1440),
    });
  }

  return result;
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
  const isTitle = block.zone === 'TITLE';
  const isSubtitle = block.zone === 'SUBTITLE';

  let headingLevel;
  if (isTitle) {
    headingLevel = 'title';
  } else if (isHeading) {
    headingLevel = HEADING_LEVELS[Math.min(block.headingLevel, 4)];
  }

  const halfPoints = fontSizeToHalfPoints(block.fontSize);
  const fontName = mapFontName(block.fontName, typographyContext);
  const alignment = ALIGN_MAP[block.alignment] || AlignmentType.LEFT;

  // Spacing: titles get less before/after, headings get more
  let spacingBefore = 0;
  let spacingAfter = 120;
  if (headingLevel === 'title') {
    spacingBefore = 0;
    spacingAfter = 120;
  } else if (isHeading) {
    spacingBefore = Math.round(bodySize * 40);
    spacingAfter = Math.round(bodySize * 20);
  }

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

  if (headingLevel === 'title') {
    paragraphConfig.style = 'Title';
  } else if (isHeading && headingLevel) {
    paragraphConfig.heading = headingLevel;
  }

  // List items: use Word numbering
  if (block.isListItem && block.listItemType === 'bullet') {
    paragraphConfig.numbering = {
      reference: 'pdf-list',
      level: 0,
    };
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
 * Merges adjacent items with the same formatting into single runs,
 * preventing character-level fragmentation.
 */
function buildTextRuns(block, fontFamily, halfPoints, typographyContext) {
  const runs = [];

  if (block.lines && block.lines.length > 0) {
    const mergedItems = [];

    for (const line of block.lines) {
      for (const item of line.items) {
        if (!item.str) continue;

        const itemFont = mapFontName(item.fontName, typographyContext);
        const itemSize = fontSizeToHalfPoints(item.fontSize || block.fontSize);
        const itemBold = block.bold || false;
        const itemItalic = block.italic || false;
        const key = `${itemFont}_${itemSize}_${itemBold}_${itemItalic}`;

        if (mergedItems.length > 0) {
          const last = mergedItems[mergedItems.length - 1];
          if (last.key === key) {
            last.text += item.str;
            continue;
          }
        }

        mergedItems.push({ key, text: item.str, font: itemFont, size: itemSize, bold: itemBold, italic: itemItalic });
      }
    }

    for (const mi of mergedItems) {
      runs.push(
        new TextRun({
          text: mi.text,
          font: mi.font,
          size: mi.size,
          bold: mi.bold,
          italics: mi.italic,
        })
      );
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
