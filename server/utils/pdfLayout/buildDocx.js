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

  // Compute default margins (approximate from typical PDF margins)
  const defaultMargin = convertInchesToTwip(1);

  const sections = [];

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const pageWidth = page.width || 612;
    const pageHeight = page.height || 792;

    // Map PDF points to Word twips (1 pt = 20 twips, but we scale to inches first)
    // PDF 72 pts = 1 inch
    const sectionWidth = Math.round((pageWidth / 72) * 1440); // twips
    const sectionHeight = Math.round((pageHeight / 72) * 1440); // twips

    const children = [];

    // Merge tables and blocks, preserving order
    const elements = mergeElements(page);

    for (const element of elements) {
      if (element.type === 'table') {
        const table = buildTable(element, bodySize);
        if (table) {
          children.push(table);
          // Add spacing after table
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

    sections.push({
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
    });
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

  // Font size
  const halfPoints = fontSizeToHalfPoints(block.fontSize);

  // Font name (with typography context for better mapping)
  const fontName = mapFontName(block.fontName, typographyContext);

  // Alignment
  const alignment = ALIGN_MAP[block.alignment] || AlignmentType.LEFT;

  // Spacing estimation
  const spacingBefore = isHeading ? Math.round(bodySize * 40) : 0;
  const spacingAfter = isHeading ? Math.round(bodySize * 20) : 120;

  // Build TextRuns for the paragraph
  const runs = buildTextRuns(block, fontName, halfPoints, typographyContext);

  const paragraphConfig = {
    children: runs,
    alignment,
    spacing: {
      before: spacingBefore,
      after: spacingAfter,
      line: block.lineCount > 1 ? 276 : undefined, // 1.15 line spacing for multi-line
    },
  };

  if (isHeading && headingLevel) {
    paragraphConfig.heading = headingLevel;
  }

  // Indentation
  const leftMargin = 72; // ~1 inch in PDF points
  if (block.leftX > leftMargin + 20) {
    const indentTwips = Math.round(((block.leftX - leftMargin) / 72) * 1440);
    paragraphConfig.indent = { left: Math.min(indentTwips, convertInchesToTwip(3)) };
  }

  return new Paragraph(paragraphConfig);
}

/**
 * Build TextRuns for a block.
 * Currently creates a single run; could be extended for mixed formatting
 * within a single block (e.g., bold labels + regular values).
 */
function buildTextRuns(block, fontFamily, halfPoints, typographyContext) {
  const runs = [];

  // Check if this block has items with mixed formatting
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

  // Fallback: single run with block text
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
function buildTable(table, bodySize) {
  if (!table || !table.rows || table.rows.length === 0) return null;

  const columns = table.columns || table.rows[0].length;
  if (columns === 0) return null;

  // Calculate column widths
  const columnWidths = computeColumnWidths(table, columns);

  const tableRows = [];

  for (let rowIdx = 0; rowIdx < table.rows.length; rowIdx++) {
    const row = table.rows[rowIdx];
    const cells = [];

    for (let colIdx = 0; colIdx < columns; colIdx++) {
      const cellData = row[colIdx];
      const text = cellData ? cellData.text : '';
      const cellFontSize = cellData ? cellData.fontSize : bodySize;

      // Determine if cell should be bold: label cells (first column ending with colon) are bold
      const isLabel = colIdx === 0 && text.trim().endsWith(':');
      const isBold = isLabel;

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
                text: text,
                font: 'Arial',
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
  const totalWidth = 9000; // Approximate usable width in twips

  if (table.columnPositions && table.columnPositions.length >= 2) {
    // Use actual column positions
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

  // Fallback: equal widths
  const equalWidth = Math.round(totalWidth / columns);
  return Array(columns).fill(equalWidth);
}

module.exports = { buildDocx };
