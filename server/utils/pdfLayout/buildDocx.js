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
 *   - multi-column layout
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
  Header,
  Footer,
  Numbering,
  LevelFormat,
  convertMillimetersToTwip,
  SectionType,
} = require('docx');

const { mapFontName, fontSizeToHalfPoints, classifyFontSizes } = require('./analyzeTypography');
const { shouldInsertSpace } = require('./groupLines');

const HEADING_LEVELS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
};

const ALIGN_MAP = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justified: AlignmentType.JUSTIFIED,
};

async function buildDocx(pages, options = {}) {
  const { typographyContext = {}, images = [] } = options;

  const allBlocks = pages.flatMap((p) => p.blocks || []);
  const { bodySize } = classifyFontSizes(allBlocks);

  const headerFooter = extractHeaderFooter(pages);
  const pageMargins = computePageMargins(pages);

  const segments = buildLayoutSegments(pages, images);
  const sections = buildSectionsFromSegments(segments, pages, headerFooter, pageMargins, bodySize, typographyContext);

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
            indent: { right: 20 },
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

function sortElementsColumnFirst(elements, gapCenter) {
  elements.sort((a, b) => {
    const aCenterX = (a.x || 0) + ((a.width || 0) / 2);
    const bCenterX = (b.x || 0) + ((b.width || 0) / 2);
    const aCol = aCenterX < gapCenter ? 0 : 1;
    const bCol = bCenterX < gapCenter ? 0 : 1;
    if (aCol !== bCol) return aCol - bCol;
    return (b.topY || b.y || 0) - (a.topY || a.y || 0);
  });
}

function buildLayoutSegments(pages, images) {
  const segments = [];

  for (const page of pages) {
    const layout = page.layout;
    if (!layout) {
      const allElements = [
        ...(page.blocks || []).map(b => ({ ...b, _elementType: 'block', _sourcePageIndex: page.pageIndex })),
        ...(page.tables || []).map(t => ({ ...t, _elementType: 'table', _sourcePageIndex: page.pageIndex })),
      ];
      segments.push({
        columnCount: 1,
        elements: allElements,
        pageIndex: page.pageIndex,
        isFirstPage: page.pageIndex === 0,
        isLastPage: page.pageIndex === pages.length - 1,
      });
      continue;
    }

    const pageColCount = layout.columnCount;
    if (pageColCount <= 1) {
      const allElements = [];
      for (const zone of layout.zones) {
        for (const el of zone.elements) {
          allElements.push({ ...el, _sourcePageIndex: page.pageIndex, _zoneType: zone.type });
        }
      }
      segments.push({
        columnCount: 1,
        elements: allElements,
        pageIndex: page.pageIndex,
        isFirstPage: page.pageIndex === 0 && segments.length === 0,
        isLastPage: page.pageIndex === pages.length - 1,
      });
      continue;
    }

    const zoneGroups = [];
    for (const zone of layout.zones) {
      const zoneType = zone.type === 'fullWidth' ? 'fullWidth' : 'columns';
      if (zoneGroups.length > 0 && zoneGroups[zoneGroups.length - 1].type === zoneType) {
        zoneGroups[zoneGroups.length - 1].zones.push(zone);
      } else {
        zoneGroups.push({ type: zoneType, zones: [zone] });
      }
    }

    const mergedGroups = [];
    for (let gi = 0; gi < zoneGroups.length; gi++) {
      const group = zoneGroups[gi];

      if (group.type === 'columns' && mergedGroups.length > 0 && gi < zoneGroups.length - 1) {
        const prevGroup = mergedGroups[mergedGroups.length - 1];
        const nextGroup = zoneGroups[gi + 1];
        if (prevGroup.type === 'fullWidth' && nextGroup.type === 'fullWidth') {
          const totalElements = group.zones.reduce((sum, z) => sum + z.elements.length, 0);
          if (totalElements <= 2) {
            for (const z of group.zones) prevGroup.zones.push(z);
            continue;
          }
        }
      }

      if (mergedGroups.length > 0 && mergedGroups[mergedGroups.length - 1].type === group.type) {
        mergedGroups[mergedGroups.length - 1].zones.push(...group.zones);
      } else {
        mergedGroups.push({ type: group.type, zones: [...group.zones] });
      }
    }

    for (const group of mergedGroups) {
      const useFullWidth = group.type === 'fullWidth';
      const colCount = useFullWidth ? 1 : pageColCount;
      const elements = [];
      for (const zone of group.zones) {
        for (const el of zone.elements) {
          elements.push({ ...el, _sourcePageIndex: page.pageIndex, _zoneType: zone.type });
        }
      }
      if (!useFullWidth && pageColCount > 1 && layout.columns) {
        sortElementsColumnFirst(elements, layout.columns.gapCenter);
      }
      segments.push({
        columnCount: colCount,
        elements,
        pageIndex: page.pageIndex,
        isFirstPage: page.pageIndex === 0 && segments.length === 0,
        isLastPage: page.pageIndex === pages.length - 1,
      });
    }
  }

  const merged = [];
  for (const seg of segments) {
    if (merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (prev.columnCount === seg.columnCount && prev.columnCount > 1
          && seg.pageIndex === prev.pageIndex + 1) {
        prev.elements.push(...seg.elements);
        prev.isLastPage = seg.isLastPage;
        continue;
      }
    }
    merged.push({ ...seg, elements: [...seg.elements] });
  }

  for (const seg of merged) {
    if (seg.columnCount > 1) {
      const page = pages[seg.pageIndex];
      if (page && page.layout && page.layout.columns) {
        sortElementsColumnFirst(seg.elements, page.layout.columns.gapCenter);
      }
    }
  }

  return merged;
}

function buildSectionsFromSegments(segments, pages, headerFooter, pageMargins, bodySize, typographyContext) {
  if (segments.length === 0) return [];

  const sections = [];

  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const segment = segments[segIdx];
    const pageIdx = segment.pageIndex;
    const page = pages[pageIdx];
    const pageWidth = page.width || 612;
    const pageHeight = page.height || 792;

    const sectionWidth = Math.round((pageWidth / 72) * 1440);
    const sectionHeight = Math.round((pageHeight / 72) * 1440);
    const margins = pageMargins[pageIdx] || { top: 720, bottom: 720, left: 708, right: 708 };

    const children = [];
    for (const el of segment.elements) {
      const child = buildElement(el, bodySize, typographyContext);
      if (child) children.push(child);
    }

    if (children.length === 0) continue;

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

    if (segIdx > 0) {
      const prevSeg = segments[segIdx - 1];
      if (prevSeg.pageIndex === segment.pageIndex && prevSeg.columnCount !== segment.columnCount) {
        sectionConfig.properties.type = SectionType.CONTINUOUS;
      }
    }

    if (segment.columnCount > 1) {
      const layout = page.layout;
      const gap = (layout && layout.columnGap > 0) ? layout.columnGap : 36;
      const gapTwips = Math.max(Math.round(gap * 20), 100);

      sectionConfig.properties.column = {
        count: segment.columnCount,
        space: gapTwips,
      };
    }

    const pageHeaders = headerFooter.headers.filter((h) => h.pageIndex === pageIdx);
    const pageFooters = headerFooter.footers.filter((f) => f.pageIndex === pageIdx);

    if (pageHeaders.length > 0 || pageFooters.length > 0) {
      const headerContent = buildHeaderFooter(pageHeaders, pageWidth, typographyContext, 'header');
      const footerContent = buildHeaderFooter(pageFooters, pageWidth, typographyContext, 'footer');
      if (headerContent) sectionConfig.headers = { default: headerContent };
      if (footerContent) sectionConfig.footers = { default: footerContent };
    }

    sections.push(sectionConfig);
  }

  return sections;
}

function buildElement(element, bodySize, typographyContext) {
  if (element._elementType === 'table') {
    return buildTable(element, bodySize, typographyContext);
  } else if (element._elementType === 'image') {
    return buildImageParagraph(element, typographyContext);
  } else {
    return buildParagraph(element, bodySize, typographyContext);
  }
}

function computePageMargins(pages) {
  const result = [];
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
  const minLeftX = Math.min(...allBlocks.filter((b) => b.leftX > 0).map((b) => b.leftX));
  const maxRightX = Math.max(...allBlocks.filter((b) => b.rightX > 0).map((b) => b.rightX));
  const left = Math.max(0, Math.round((minLeftX / 72) * 1440));
  const right = Math.max(0, Math.round(((pageWidth - maxRightX) / 72) * 1440));
  const margins = { top: 1000, bottom: 480, left, right };

  for (const page of pages) {
    result.push(margins);
  }
  return result;
}

function extractHeaderFooter(pages) {
  const headers = [];
  const footers = [];
  for (const page of pages) {
    const allItems = page.items || [];
    const pageIdx = page.pageIndex;
    for (const item of allItems) {
      const zone = item.zone || '';
      if (zone === 'HEADER') {
        headers.push({ text: (item.str || '').trim(), y: item.y, pageIndex: pageIdx });
      }
      if (zone === 'FOOTER') {
        footers.push({ text: (item.str || '').trim(), y: item.y, pageIndex: pageIdx });
      }
    }
  }
  return { headers, footers };
}

function buildHeaderFooter(items, pageWidth, typographyContext, type) {
  if (!items || items.length === 0) return null;
  items.sort((a, b) => a.y - b.y);
  const text = items.map((i) => i.text).join(' ');
  if (!text.trim()) return null;

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

function ptToTwips(pt) {
  return Math.round(pt * 20);
}

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

  const pageHeight = block.pageHeight || 792;
  const lineH = block.lineHeights ? Math.max(...block.lineHeights) : block.fontSize * 1.2;

  let spacingBefore = 0;
  let spacingAfter = 0;
  let lineSpacing = undefined;

  if (headingLevel === 'title') {
    spacingBefore = 0;
    spacingAfter = 160;
  } else if (isHeading) {
    const gapBefore = block._gapBefore || 0;
    spacingBefore = gapBefore > lineH * 0.3 ? ptToTwips(gapBefore) : Math.round(halfPoints * 12);
    spacingAfter = 0;
  } else {
    const gapBefore = block._gapBefore || 0;
    const gapAfter = block._gapAfter || 0;
    if (gapBefore > lineH * 0.4) {
      spacingBefore = ptToTwips(gapBefore);
    }
    if (gapAfter > lineH * 0.4) {
      spacingAfter = ptToTwips(gapAfter);
    }
    const maxSpacing = ptToTwips(lineH * 3);
    spacingBefore = Math.min(spacingBefore, maxSpacing);
    spacingAfter = Math.min(spacingAfter, maxSpacing);
  }

  if (block.lineCount > 1 && block.computedLineSpacing > 0) {
    lineSpacing = ptToTwips(block.computedLineSpacing);
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

  if (headingLevel === 'title') {
    paragraphConfig.style = 'Title';
  } else if (isHeading && headingLevel) {
    paragraphConfig.heading = headingLevel;
  } else if (isBody) {
    paragraphConfig.style = 'BodyText';
  }

  if (block.isListItem && block.listItemType === 'bullet') {
    paragraphConfig.numbering = {
      reference: 'pdf-list',
      level: 0,
    };
    paragraphConfig.style = 'ListParagraph';
  }

  const pageWidth = block.pageWidth || 612;
  const contentLeft = 72;
  const contentRight = pageWidth - 72;

  if (block.leftX > contentLeft + 5) {
    const leftIndentPt = block.leftX - contentLeft;
    paragraphConfig.indent = paragraphConfig.indent || {};
    paragraphConfig.indent.left = Math.max(0, ptToTwips(leftIndentPt));
  }

  if (block.lineCount > 1 && block.firstLineX !== undefined && block.continuationLineX !== undefined) {
    const firstLineIndentPt = block.firstLineX - block.continuationLineX;
    if (Math.abs(firstLineIndentPt) > 3) {
      paragraphConfig.indent = paragraphConfig.indent || {};
      paragraphConfig.indent.firstLine = Math.max(0, ptToTwips(firstLineIndentPt));
    }
  }

  const actualRight = block.rightX || (block.leftX + (block.width || 0));
  if (actualRight < contentRight - 10 && actualRight > contentLeft) {
    const rightIndentPt = contentRight - actualRight;
    if (rightIndentPt > 3) {
      paragraphConfig.indent = paragraphConfig.indent || {};
      paragraphConfig.indent.right = Math.max(0, ptToTwips(rightIndentPt));
    }
  }

  return new Paragraph(paragraphConfig);
}

function buildImageParagraph(imageData, typographyContext) {
  if (!imageData || !imageData.imageBuffer) return null;

  let imageType;
  switch (imageData.format) {
    case 'jpeg': imageType = 'jpg'; break;
    case 'png': imageType = 'png'; break;
    default: imageType = 'png'; break;
  }

  const drawWidthPt = imageData.drawWidth || imageData.width;
  const drawHeightPt = imageData.drawHeight || imageData.height;

  let finalWidth = Math.round(drawWidthPt * 96 / 72);
  let finalHeight = Math.round(drawHeightPt * 96 / 72);

  const maxWidthPx = 667;
  if (finalWidth > maxWidthPx) {
    const scale = maxWidthPx / finalWidth;
    finalWidth = maxWidthPx;
    finalHeight = Math.round(finalHeight * scale);
  }

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

    const isCentered = finalWidth < 400;

    return new Paragraph({
      children: [imageRun],
      alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { before: 60, after: 60 },
    });
  } catch (e) {
    return null;
  }
}

function buildTextRuns(block, fontFamily, halfPoints, typographyContext) {
  const runs = [];
  const bodyFontSize = 10;
  const bodyHalfPts = fontSizeToHalfPoints(bodyFontSize);

  if (block.lines && block.lines.length > 0) {
    const mergedItems = [];
    const zone = block.zone || '';
    let prevItem = null;
    let prevLineIndex = -1;

    for (let lineIdx = 0; lineIdx < block.lines.length; lineIdx++) {
      const line = block.lines[lineIdx];

      for (let itemIdx = 0; itemIdx < line.items.length; itemIdx++) {
        const item = line.items[itemIdx];
        if (!item.str) continue;

        const itemFont = mapFontName(item.fontName, typographyContext);
        const itemSize = fontSizeToHalfPoints(item.fontSize || block.fontSize);

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
          const textLen = (item.str || '').trim().length;
          itemBold = item.fontBold && textLen < 30;
          itemItalic = item.fontItalic || false;
        }

        const itemSuperScript = (item.fontSize || block.fontSize) <= 7.5 && (item.fontSize || block.fontSize) >= 5.0;
        const key = itemFont + '_' + itemSize + '_' + itemBold + '_' + itemItalic + '_' + itemSuperScript;

        // Determine if we should insert a space before this item
        let insertSpace = false;
        const isSpaceItem = item.str.trim() === '' && item.str.length > 0 && item.width > 0.1 * (item.fontSize || 10);

        if (isSpaceItem) {
          // Explicit space item: add space to previous merged item
          if (mergedItems.length > 0) {
            const last = mergedItems[mergedItems.length - 1];
            if (!last.text.endsWith(' ')) {
              last.text += ' ';
            }
          }
          prevItem = item;
          prevLineIndex = lineIdx;
          continue;
        }

        if (item.str.trim().length === 0) {
          prevItem = item;
          prevLineIndex = lineIdx;
          continue;
        }

        // Insert space at line transitions (within same block)
        if (prevItem && prevLineIndex !== lineIdx && !isSpaceItem && item.str.trim().length > 0 && mergedItems.length > 0) {
          insertSpace = true;
        }

        // Check if we need to insert a space between previous text item and this one (same line)
        if (!insertSpace && prevItem && prevLineIndex === lineIdx && !isSpaceItem && prevItem.str && prevItem.str.trim().length > 0) {
          const prevIsSpaceItem = prevItem.str.trim() === '' && prevItem.str.length > 0 && prevItem.width > 0.1 * (prevItem.fontSize || 10);
          if (!prevIsSpaceItem) {
            insertSpace = shouldInsertSpace(prevItem, item, false);
          }
        }

        if (mergedItems.length > 0) {
          const last = mergedItems[mergedItems.length - 1];
          if (last.key === key) {
            if (insertSpace && !last.text.endsWith(' ')) {
              last.text += ' ';
            }
            last.text += item.str;
            prevItem = item;
            prevLineIndex = lineIdx;
            continue;
          }
        }

        // If inserting space but keys differ, add space to new run
        const textWithSpace = (insertSpace ? ' ' : '') + item.str;
        mergedItems.push({ key: key, text: textWithSpace, font: itemFont, size: itemSize, bold: itemBold, italic: itemItalic, superScript: itemSuperScript });
        prevItem = item;
        prevLineIndex = lineIdx;
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

function isLabelItemInZone(item, line, block, zone) {
  const text = block.text || '';
  let labelPattern;
  if (zone === 'ABSTRACT') {
    labelPattern = /^Abstract[\u201C\u201D\-]\s*/i;
  } else if (zone === 'INDEX_TERMS') {
    labelPattern = /^Index Terms[\u201C\u201D\-]\s*/i;
  } else {
    return false;
  }

  const match = text.match(labelPattern);
  if (!match) return false;

  const labelLength = match[0].length;

  let charPos = 0;
  for (const line2 of block.lines) {
    for (const item2 of line2.items) {
      if (item2 === item) {
        return charPos < labelLength;
      }
      charPos += (item2.str || '').length;
    }
  }

  return false;
}

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
                text: text,
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

function computeColumnWidths(table, columns) {
  if (table.columnPositions && table.columnPositions.length >= 2) {
    const positions = [...table.columnPositions].sort((a, b) => a - b);
    const totalSpan = positions[positions.length - 1] - positions[0];
    if (totalSpan > 0) {
      const widths = [];
      for (let i = 0; i < columns; i++) {
        if (i < positions.length - 1) {
          const colWidth = Math.round(((positions[i + 1] - positions[i]) / 72) * 1440);
          widths.push(Math.max(colWidth, 500));
        } else if (i === positions.length - 1) {
          const lastWidth = Math.round(((positions[i] - positions[i - 1]) / 72) * 1440);
          widths.push(Math.max(lastWidth, 500));
        } else {
          widths.push(Math.round(9000 / columns));
        }
      }
      return widths;
    }
  }

  const totalWidth = 9000;
  const equalWidth = Math.round(totalWidth / columns);
  return Array(columns).fill(equalWidth);
}

module.exports = { buildDocx };
