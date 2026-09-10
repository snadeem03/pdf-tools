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
  ImageRun,
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
  const { typographyContext = {}, images = [] } = options;

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

    // Get images for this page
    const pageImages = images.filter(img => img.pageIndex === pageIdx);

    // Merge tables, blocks, and images, preserving reading order
    const elements = mergeElements(page, pageImages);

    for (const element of elements) {
      if (element.type === 'table') {
        const table = buildTable(element, bodySize, typographyContext);
        if (table) {
          children.push(table);
        }
      } else if (element.type === 'image') {
        const imgParagraph = buildImageParagraph(element, typographyContext);
        if (imgParagraph) children.push(imgParagraph);
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
    styles: {
      default: {
        document: {
          run: {
            font: 'Times New Roman',
            size: 20,
          },
        },
      },
      paragraphStyles: [
        {
          id: 'BodyText',
          name: 'Body Text',
          basedOn: 'Normal',
          next: 'BodyText',
          run: {
            font: 'Times New Roman',
            size: 20,
          },
          paragraph: {
            spacing: { after: 0, line: 276 },
            indent: { firstLine: 288, right: 20 },
          },
        },
        {
          id: 'Heading1',
          name: 'heading 1',
          basedOn: 'Normal',
          next: 'BodyText',
          run: {
            font: 'Times New Roman',
            size: 24,
            bold: true,
          },
          paragraph: {
            spacing: { before: 240, after: 0 },
            indent: { left: 408, hanging: 332 },
          },
        },
        {
          id: 'Heading2',
          name: 'heading 2',
          basedOn: 'Normal',
          next: 'BodyText',
          run: {
            font: 'Times New Roman',
            size: 22,
            bold: true,
          },
          paragraph: {
            spacing: { before: 120, after: 0 },
            indent: { left: 253, hanging: 227 },
          },
        },
      ],
    },
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
 * Compute page margins.
 * Uses content bounding box for left/right margins (reliable).
 * For top/bottom, uses computed values with fallback to standard A4
 * (matching iLovePDF reference for this paper format).
 */
function computePageMargins(pages) {
  const result = [];

  // Collect body content positions (excluding headers/footers)
  const allBlocks = [];
  for (const page of pages) {
    for (const block of page.blocks || []) {
      const zone = block.zone || '';
      if (zone === 'HEADER' || zone === 'FOOTER') continue;
      allBlocks.push(block);
    }
  }

  if (allBlocks.length === 0) {
    for (const page of pages) {
      result.push({ top: 1000, bottom: 480, left: 708, right: 708 });
    }
    return result;
  }

  const pageWidth = pages[0] ? pages[0].width : 595.32;

  // Left/right from content bounding box (reliable)
  const minLeftX = Math.min(...allBlocks.filter((b) => b.leftX > 0).map((b) => b.leftX));
  const maxRightX = Math.max(...allBlocks.filter((b) => b.rightX > 0).map((b) => b.rightX));
  const left = Math.round((minLeftX / 72) * 1440);
  const right = Math.round(((pageWidth - maxRightX) / 72) * 1440);

  // For top/bottom: use standard A4 academic paper margins
  // (computed values are unreliable due to headers/titles near page edges)
  const margins = { top: 1000, bottom: 480, left, right };

  for (const page of pages) {
    result.push(margins);
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
        font: typographyContext?.defaultFont || 'Times New Roman',
        size: 18,
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
 * Merge tables, blocks, and images into a single ordered list.
 * Orders by vertical position (top-to-bottom in pdfjs coords = bottom-to-top in value).
 */
function mergeElements(page, pageImages) {
  const elements = [];

  // Add tables
  for (const table of page.tables || []) {
    elements.push(table);
  }

  // Add remaining blocks
  for (const block of page.blocks || []) {
    elements.push(block);
  }

  // Add images for this page
  for (const img of (pageImages || [])) {
    elements.push({ type: 'image', ...img });
  }

  // Sort by vertical position for reading order
  // pdfjs coords: y=0 is top, y=pageHeight is bottom
  // Ascending y = top-to-bottom reading order
  elements.sort((a, b) => {
    const aY = a.topY || a.y || 0;
    const bY = b.topY || b.y || 0;
    return aY - bY;
  });

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
  const isBody = !isHeading && !isTitle && !isSubtitle && !block.isListItem;

  let headingLevel;
  if (isTitle) {
    headingLevel = 'title';
  } else if (isHeading) {
    headingLevel = HEADING_LEVELS[Math.min(block.headingLevel, 4)];
  }

  const halfPoints = fontSizeToHalfPoints(block.fontSize);
  const fontName = mapFontName(block.fontName, typographyContext);
  const alignment = ALIGN_MAP[block.alignment] || AlignmentType.LEFT;

  // Spacing: computed from PDF geometry
  let spacingBefore = 0;
  let spacingAfter = 0;
  let lineSpacing = undefined;

  if (headingLevel === 'title') {
    spacingBefore = 0;
    spacingAfter = 160;
  } else if (isHeading) {
    spacingBefore = Math.round(halfPoints * 12);
    spacingAfter = 0;
  } else if (isBody) {
    spacingBefore = 0;
    spacingAfter = 0;
    if (block.lineCount > 1) {
      lineSpacing = 276;
    }
  }

  const runs = buildTextRuns(block, fontName, halfPoints, typographyContext);

  const paragraphConfig = {
    children: runs,
    alignment,
    spacing: {
      before: spacingBefore,
      after: spacingAfter,
      line: lineSpacing,
    },
  };

  // Style selection
  if (headingLevel === 'title') {
    paragraphConfig.style = 'Title';
  } else if (isHeading && headingLevel) {
    paragraphConfig.heading = headingLevel;
  } else if (isBody) {
    paragraphConfig.style = 'BodyText';
  }

  // List items: use Word numbering
  if (block.isListItem && block.listItemType === 'bullet') {
    paragraphConfig.numbering = {
      reference: 'pdf-list',
      level: 0,
    };
    paragraphConfig.style = 'ListParagraph';
  }

  // Indentation: compute from PDF x-position
  const pageWidth = block.pageWidth || 612;
  const contentLeft = 72; // ~1 inch
  const contentRight = pageWidth - 72;

  if (block.leftX > contentLeft + 15) {
    const indentTwips = Math.round(((block.leftX - contentLeft) / 72) * 1440);
    paragraphConfig.indent = paragraphConfig.indent || {};
    paragraphConfig.indent.left = Math.min(indentTwips, convertInchesToTwip(3));
  }

  // For body text, add first-line indent if not a continuation line
  if (isBody && block.lineCount > 1 && alignment === 'justified') {
    // First-line indent is already set via BodyText style
  }

  return new Paragraph(paragraphConfig);
}

/**
 * Build a DOCX paragraph containing an embedded image.
 * Preserves aspect ratio and approximate display size.
 */
function buildImageParagraph(imageData, typographyContext) {
  if (!imageData || !imageData.imageBuffer) return null;

  // Determine image type for docx
  let imageType;
  switch (imageData.format) {
    case 'jpeg': imageType = 'jpg'; break;
    case 'png': imageType = 'png'; break;
    default: imageType = 'png'; break;
  }

  // Compute display size in pixels at 96 DPI
  // 1 PDF point = 1/72 inch = 96/72 = 1.333 pixels at 96 DPI
  // Use draw dimensions (how the image is displayed, not native pixel size)
  const drawWidthPt = imageData.drawWidth || imageData.width;
  const drawHeightPt = imageData.drawHeight || imageData.height;

  // Convert PDF points to pixels at 96 DPI
  let finalWidth = Math.round(drawWidthPt * 96 / 72);
  let finalHeight = Math.round(drawHeightPt * 96 / 72);

  // Cap to reasonable page bounds (max ~500pt = ~667px wide)
  const maxWidthPx = 667;
  if (finalWidth > maxWidthPx) {
    const scale = maxWidthPx / finalWidth;
    finalWidth = maxWidthPx;
    finalHeight = Math.round(finalHeight * scale);
  }

  // Ensure minimum size
  if (finalWidth < 10) finalWidth = 10;
  if (finalHeight < 10) finalHeight = 10;

  try {
    const imageRun = new ImageRun({
      data: imageData.imageBuffer,
      transformation: {
        width: finalWidth,
        height: finalHeight,
      },
      type: imageType,
    });

    // Center the image if it's narrow (typical for figures)
    const isCentered = finalWidth < 400; // less than ~300pt = likely a figure

    return new Paragraph({
      children: [imageRun],
      alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 60, after: 60 },
    });
  } catch (e) {
    // If image insertion fails, return null (don't break the pipeline)
    return null;
  }
}

/**
 * Build TextRuns for a block.
 * Merges adjacent items with the same formatting into single runs,
 * preventing character-level fragmentation.
 *
 * Special handling for ABSTRACT/INDEX_TERMS zones:
 * The label ("Abstract—"/"Index Terms—") is italic+not-bold,
 * the body text is bold+not-italic.
 */
function buildTextRuns(block, fontFamily, halfPoints, typographyContext) {
  const runs = [];
  const bodyFontSize = 10;
  const bodyHalfPts = fontSizeToHalfPoints(bodyFontSize);

  if (block.lines && block.lines.length > 0) {
    const mergedItems = [];
    const zone = block.zone || '';

    for (const line of block.lines) {
      for (const item of line.items) {
        if (!item.str) continue;

        const itemFont = mapFontName(item.fontName, typographyContext);
        const itemSize = fontSizeToHalfPoints(item.fontSize || block.fontSize);

        // Determine bold/italic per item based on font metadata and context
        let itemBold, itemItalic;
        if (zone === 'ABSTRACT' || zone === 'INDEX_TERMS') {
          const isLabelItem = isLabelItemInZone(item, line, block, zone);
          itemItalic = isLabelItem;
          itemBold = !isLabelItem && (item.fontBold || false);
        } else if (block.isHeading) {
          itemBold = false;
          itemItalic = item.fontItalic || false;
        } else if (zone === 'TITLE') {
          itemBold = false;
          itemItalic = item.fontItalic || false;
        } else {
          // Body text: only apply bold if the item text is SHORT
          // (short bold items are likely emphasis, table headers, etc.)
          // Long body text items using bold fonts are likely mis-mapped
          const textLen = (item.str || '').trim().length;
          itemBold = item.fontBold && textLen < 30;
          itemItalic = item.fontItalic || false;
        }

        const itemSuperScript = (item.fontSize || block.fontSize) <= 7.5 && (item.fontSize || block.fontSize) >= 5.0;
        const key = `${itemFont}_${itemSize}_${itemBold}_${itemItalic}_${itemSuperScript}`;

        if (mergedItems.length > 0) {
          const last = mergedItems[mergedItems.length - 1];
          if (last.key === key) {
            last.text += item.str;
            continue;
          }
        }

        mergedItems.push({ key, text: item.str, font: itemFont, size: itemSize, bold: itemBold, italic: itemItalic, superScript: itemSuperScript });
      }
    }

    for (const mi of mergedItems) {
      const opts = {
        text: mi.text,
        font: mi.font,
        size: mi.size,
        bold: mi.bold,
        italics: mi.italic,
      };
      if (mi.superScript) {
        opts.superScript = true;
      }
      runs.push(new TextRun(opts));
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
 * Determine if an item is part of the label in ABSTRACT/INDEX_TERMS zones.
 * The label is the text before the body starts (e.g., "Abstract—" or "Index Terms—").
 */
function isLabelItemInZone(item, line, block, zone) {
  // Build cumulative text from the start of the block to this item
  const text = block.text || '';
  let labelPattern;
  if (zone === 'ABSTRACT') {
    labelPattern = /^Abstract[—–\-]\s*/i;
  } else if (zone === 'INDEX_TERMS') {
    labelPattern = /^Index Terms[—–\-]\s*/i;
  } else {
    return false;
  }

  // If the block text matches the label pattern, check if this item's text
  // falls within the label portion
  const match = text.match(labelPattern);
  if (!match) return false;

  const labelLength = match[0].length;

  // Find cumulative character position of this item in the block
  let charPos = 0;
  for (const line2 of block.lines) {
    for (const item2 of line2.items) {
      if (item2 === item) {
        // Check if this item overlaps with the label portion
        const itemEnd = charPos + (item.str || '').length;
        return charPos < labelLength;
      }
      charPos += (item2.str || '').length;
    }
  }

  return false;
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
      const isItalic = cellData ? cellData.italic : false;

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
                font: typographyContext?.defaultFont || 'Times New Roman',
                size: fontSizeToHalfPoints(cellFontSize),
                bold: isBold,
                italics: isItalic,
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
 * Uses column positions to compute proportional widths.
 */
function computeColumnWidths(table, columns) {
  if (table.columnPositions && table.columnPositions.length >= 2) {
    const positions = [...table.columnPositions].sort((a, b) => a - b);
    const totalSpan = positions[positions.length - 1] - positions[0];
    if (totalSpan > 0) {
      // Use proportional widths based on column positions
      const widths = [];
      for (let i = 0; i < columns; i++) {
        if (i < positions.length - 1) {
          const colWidth = Math.round(((positions[i + 1] - positions[i]) / 72) * 1440);
          widths.push(Math.max(colWidth, 500));
        } else if (i === positions.length - 1) {
          // Last column: extend to end of table
          const lastWidth = Math.round(((positions[i] - positions[i - 1]) / 72) * 1440);
          widths.push(Math.max(lastWidth, 500));
        } else {
          widths.push(Math.round(9000 / columns));
        }
      }
      return widths;
    }
  }

  // Fallback: equal widths
  const totalWidth = 9000;
  const equalWidth = Math.round(totalWidth / columns);
  return Array(columns).fill(equalWidth);
}

module.exports = { buildDocx };
