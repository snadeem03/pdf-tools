/**
 * Layout-aware PDF -> DOCX conversion pipeline.
 */

const { extractTextItems } = require('./extractTextItems');
const { extractImages } = require('./extractImages');
const { groupLines } = require('./groupLines');
const { classifyZones } = require('./classifyZones');
const { groupBlocks, assignLineToColumn } = require('./groupBlocks');
const { detectTables } = require('./detectTables');
const { detectPageLayouts } = require('./detectPageLayout');
const { buildDocx } = require('./buildDocx');
const { analyzeDocumentTypography } = require('./analyzeTypography');

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

  const { pages, allItems, fontMap } = await extractTextItems(pdfBytes);
  stats.totalPages = pages.length;
  stats.totalItems = allItems.length;

  const { images: extractedImages } = await extractImages(pdfBytes, { debug });
  stats.totalImages = extractedImages.length;

  if (debug) {
    console.log(`[pdfLayout] Extracted ${allItems.length} items from ${pages.length} pages`);
  }

  const typographyContext = analyzeDocumentTypography(pages);
  typographyContext.fontMap = fontMap;

  if (debug) {
    console.log(`[pdfLayout] Typography: serif=${typographyContext.serifDetected}, default=${typographyContext.defaultFont}, obfuscated=${typographyContext.isObfuscated}`);
  }

  const processedPages = [];

  for (const page of pages) {
    const pageResult = processPage(page, { debug, typographyContext });
    processedPages.push(pageResult);
    stats.totalLines += pageResult.lines.length;
    stats.totalBlocks += pageResult.blocks.length;
    stats.tablesDetected += pageResult.tables.length;
  }

  classifyZones(processedPages);

  for (const page of processedPages) {
    for (const block of page.blocks || []) {
      if (block.lines && block.lines.length > 0 && block.lines[0].zone) {
        block.zone = block.lines[0].zone;
      }
      block.bold = detectBlockBoldFromZone(block);
      block.italic = detectBlockItalicFromZone(block);
    }
  }

  if (debug) {
    const zoneCounts = {};
    for (const page of processedPages) {
      for (const line of page.lines) {
        const zone = line.zone || 'UNCLASSIFIED';
        zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
      }
    }
    console.log(`[pdfLayout] Zone classification:`, JSON.stringify(zoneCounts, null, 2));
  }

  const pageLayouts = detectPageLayoutsWithColumnInfo(processedPages, extractedImages);

  for (let i = 0; i < processedPages.length; i++) {
    processedPages[i].layout = pageLayouts[i];
  }

  if (debug) {
    for (const layout of pageLayouts) {
      console.log(`[pdfLayout] Page ${layout.pageIndex + 1}: ${layout.columnCount} column(s), gap=${layout.columnGap?.toFixed(1) || 0}, zones=${layout.zones.length}`);
    }
  }

  const buffer = await buildDocx(processedPages, { typographyContext, images: extractedImages });

  if (debug) {
    console.log(`[pdfLayout] Stats:`, JSON.stringify(stats, null, 2));
  }

  return { buffer, stats };
}

function processPage(page, options = {}) {
  const { debug = false, typographyContext = {} } = options;

  const columnInfo = detectColumnsFromItems(page.items, page.width);

  if (debug && columnInfo.count > 1) {
    console.log(`[pdfLayout] Page ${page.pageIndex}: ${columnInfo.count} columns detected, gap=${columnInfo.gap.toFixed(1)}`);
  }

  const lines = groupLines(page.items, page.height, { columnInfo }).filter(Boolean);

  if (debug) {
    console.log(`[pdfLayout] Page ${page.pageIndex}: ${page.items.length} items -> ${lines.length} lines`);
  }

  const blocks = groupBlocks(lines, { columnInfo });

  if (debug) {
    console.log(`[pdfLayout] Page ${page.pageIndex}: ${lines.length} lines -> ${blocks.length} blocks`);
  }

  const { tables, remaining } = detectTables(blocks, page.width);

  if (debug && tables.length > 0) {
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
    columnInfo,
  };
}

/**
 * Detect column structure from text items.
 * Uses clustering approach: verify items cluster at specific X positions.
 */
function detectColumnsFromItems(items, pageWidth) {
  const textItems = (items || []).filter(i => i.str && i.str.trim().length > 0);

  if (textItems.length < 6) {
    return { count: 1, columns: [], gap: 0, gapCenter: pageWidth / 2 };
  }

  const xValues = textItems.map(i => i.x).sort((a, b) => a - b);
  const minX = xValues[0];
  const maxX = xValues[xValues.length - 1];
  const contentWidth = maxX - minX;

  if (contentWidth < 60) {
    return { count: 1, columns: [], gap: 0, gapCenter: pageWidth / 2 };
  }

  const centerX = minX + contentWidth / 2;
  const leftItems = textItems.filter(i => i.x < centerX);
  const rightItems = textItems.filter(i => i.x >= centerX);

  if (leftItems.length < 3 || rightItems.length < 3) {
    return { count: 1, columns: [], gap: 0, gapCenter: pageWidth / 2 };
  }

  const leftMaxX = Math.max(...leftItems.map(i => i.x));
  const rightMinX = Math.min(...rightItems.map(i => i.x));
  const gap = rightMinX - leftMaxX;

  if (gap < 25) {
    return { count: 1, columns: [], gap: 0, gapCenter: pageWidth / 2 };
  }

  // Verify items cluster at specific X positions on each side
  const leftXCounts = {};
  for (const item of leftItems) {
    const key = Math.round(item.x);
    leftXCounts[key] = (leftXCounts[key] || 0) + 1;
  }
  const rightXCounts = {};
  for (const item of rightItems) {
    const key = Math.round(item.x);
    rightXCounts[key] = (rightXCounts[key] || 0) + 1;
  }

  const leftMostFrequent = Object.entries(leftXCounts).sort((a, b) => b[1] - a[1])[0];
  const rightMostFrequent = Object.entries(rightXCounts).sort((a, b) => b[1] - a[1])[0];

  const leftClusterRatio = leftMostFrequent[1] / leftItems.length;
  const rightClusterRatio = rightMostFrequent[1] / rightItems.length;

  if (leftClusterRatio < 0.25 || rightClusterRatio < 0.25) {
    return { count: 1, columns: [], gap: 0, gapCenter: pageWidth / 2 };
  }

  return {
    count: 2,
    columns: [
      { left: Math.min(...leftItems.map(i => i.x)), right: leftMaxX, center: (Math.min(...leftItems.map(i => i.x)) + leftMaxX) / 2 },
      { left: rightMinX, right: Math.max(...rightItems.map(i => i.x + (i.width || 0))), center: (rightMinX + Math.max(...rightItems.map(i => i.x + (i.width || 0)))) / 2 },
    ],
    gap,
    gapCenter: (leftMaxX + rightMinX) / 2,
    gapStart: leftMaxX,
    gapEnd: rightMinX,
  };
}

function detectPageLayoutsWithColumnInfo(pages, images = []) {
  const layouts = [];
  for (const page of pages) {
    const layout = detectPageLayoutWithColumnInfo(page, images);
    layouts.push(layout);
  }
  return layouts;
}

function detectPageLayoutWithColumnInfo(page, images = []) {
  const pageWidth = page.width || 612;
  const pageHeight = page.height || 792;
  const columnInfo = page.columnInfo || { count: 1, columns: [], gap: 0 };

  const pageImages = images.filter(i => i.pageIndex === page.pageIndex);

  const allElements = [
    ...(page.blocks || []).map(b => ({ ...b, _elementType: 'block' })),
    ...(page.tables || []).map(t => ({ ...t, _elementType: 'table' })),
    ...pageImages.map(i => ({ ...i, _elementType: 'image' })),
  ];

  for (const el of allElements) {
    if (columnInfo.count <= 1) {
      el._column = 0;
      el._fullWidth = true;
    } else if (el._elementType === 'image') {
      const imgLeft = el.x || 0;
      const imgWidth = el.drawWidth || 0;
      const contentWidth = columnInfo.columns.length > 0
        ? columnInfo.columns[1].right - columnInfo.columns[0].left
        : pageWidth;
      if (contentWidth > 0 && imgWidth > contentWidth * 0.6) {
        el._column = -1;
        el._fullWidth = true;
      } else {
        const imgCenter = imgLeft + imgWidth / 2;
        let bestCol = 0;
        let bestDist = Infinity;
        for (let i = 0; i < columnInfo.columns.length; i++) {
          const dist = Math.abs(imgCenter - columnInfo.columns[i].center);
          if (dist < bestDist) { bestDist = dist; bestCol = i; }
        }
        el._column = bestCol;
        el._fullWidth = false;
      }
    } else if (el._elementType === 'table') {
      el._column = -1;
      el._fullWidth = true;
    } else {
      const blockLeft = el.leftX || 0;
      const blockRight = el.rightX || blockLeft;
      const blockWidth = blockRight - blockLeft;
      if (columnInfo.columns.length > 0) {
        const contentWidth = columnInfo.columns[1].right - columnInfo.columns[0].left;
        if (contentWidth > 0 && blockWidth > contentWidth * 0.65) {
          el._column = -1;
          el._fullWidth = true;
        } else {
          const blockCenter = (blockLeft + blockRight) / 2;
          let bestCol = 0;
          let bestDist = Infinity;
          for (let i = 0; i < columnInfo.columns.length; i++) {
            const dist = Math.abs(blockCenter - columnInfo.columns[i].center);
            if (dist < bestDist) { bestDist = dist; bestCol = i; }
          }
          el._column = bestCol;
          el._fullWidth = false;
        }
      } else {
        el._column = 0;
        el._fullWidth = true;
      }
    }
  }

  const zones = buildZonesFromElements(allElements, columnInfo);
  const readingOrder = computeReadingOrderFromZones(zones);

  const textItems = (page.items || []).filter(i => i.str && i.str.trim().length > 0);
  const contentBounds = computeContentBounds(textItems, pageWidth, pageHeight);

  return {
    pageIndex: page.pageIndex,
    pageWidth,
    pageHeight,
    contentBounds,
    columnCount: columnInfo.count,
    columns: columnInfo.columns,
    columnGap: columnInfo.gap,
    classified: {
      blocks: allElements.filter(e => e._elementType === 'block'),
      images: allElements.filter(e => e._elementType === 'image'),
      tables: allElements.filter(e => e._elementType === 'table'),
    },
    zones,
    readingOrder,
  };
}

function buildZonesFromElements(allElements, columnInfo) {
  if (allElements.length === 0) return [];
  allElements.sort((a, b) => (a.topY || a.y || 0) - (b.topY || b.y || 0));

  if (columnInfo.count <= 1) {
    return [{
      type: 'fullWidth',
      top: Math.max(...allElements.map(e => e.topY || e.y || 0)),
      bottom: Math.min(...allElements.map(e => e.bottomY || e.y || 0)),
      elements: allElements,
      columnAssignments: {},
    }];
  }

  const zones = [];
  let currentZone = null;

  for (const el of allElements) {
    const elTop = el.topY || el.y || 0;
    const elBottom = el.bottomY || (elTop + (el.height || el.fontSize || 12));
    const isFullWidth = el._fullWidth;

    if (!currentZone) {
      currentZone = {
        type: isFullWidth ? 'fullWidth' : 'columns',
        top: elTop,
        bottom: elBottom,
        elements: [el],
        columnAssignments: isFullWidth ? {} : { [el._column]: [el] },
      };
    } else {
      const gap = elTop - currentZone.bottom;
      const lineHeight = el.height || el.fontSize || 12;

      if (gap > lineHeight * 1.5) {
        zones.push(currentZone);
        currentZone = {
          type: isFullWidth ? 'fullWidth' : 'columns',
          top: elTop,
          bottom: elBottom,
          elements: [el],
          columnAssignments: isFullWidth ? {} : { [el._column]: [el] },
        };
      } else if (isFullWidth && currentZone.type === 'columns') {
        zones.push(currentZone);
        currentZone = {
          type: 'fullWidth',
          top: elTop,
          bottom: elBottom,
          elements: [el],
          columnAssignments: {},
        };
      } else if (!isFullWidth && currentZone.type === 'fullWidth') {
        zones.push(currentZone);
        currentZone = {
          type: 'columns',
          top: elTop,
          bottom: elBottom,
          elements: [el],
          columnAssignments: { [el._column]: [el] },
        };
      } else {
        currentZone.bottom = Math.max(currentZone.bottom, elBottom);
        currentZone.elements.push(el);
        if (!isFullWidth) {
          if (!currentZone.columnAssignments[el._column]) {
            currentZone.columnAssignments[el._column] = [];
          }
          currentZone.columnAssignments[el._column].push(el);
        }
      }
    }
  }
  if (currentZone) zones.push(currentZone);
  return zones;
}

function computeReadingOrderFromZones(zones) {
  const ordered = [];
  let orderIndex = 0;
  for (const zone of zones) {
    if (zone.type === 'fullWidth') {
      const sorted = [...zone.elements].sort((a, b) => (a.topY || a.y || 0) - (b.topY || b.y || 0));
      for (const el of sorted) { el._readingOrder = orderIndex++; ordered.push(el); }
    } else {
      const columnIndices = Object.keys(zone.columnAssignments).map(Number).sort((a, b) => a - b);
      for (const colIdx of columnIndices) {
        const colElements = zone.columnAssignments[colIdx];
        const sorted = [...colElements].sort((a, b) => (a.topY || a.y || 0) - (b.topY || b.y || 0));
        for (const el of sorted) { el._readingOrder = orderIndex++; ordered.push(el); }
      }
    }
  }
  return ordered;
}

function computeContentBounds(textItems, pageWidth, pageHeight) {
  if (textItems.length === 0) {
    return { left: 72, right: pageWidth - 72, top: pageHeight - 72, bottom: 72, width: pageWidth - 144 };
  }
  const xValues = textItems.map(i => i.x).sort((a, b) => a - b);
  const rightEdges = textItems.map(i => i.x + (i.width || 0)).sort((a, b) => b - a);
  const yValues = textItems.map(i => i.y).sort((a, b) => b - a);
  const leftIdx = Math.floor(xValues.length * 0.05);
  const rightIdx = Math.floor(rightEdges.length * 0.05);
  return {
    left: xValues[leftIdx] || 72,
    right: rightEdges[rightIdx] || (pageWidth - 72),
    top: yValues[0] || (pageHeight - 72),
    bottom: yValues[yValues.length - 1] || 72,
    width: (rightEdges[rightIdx] || (pageWidth - 72)) - (xValues[leftIdx] || 72),
  };
}

function detectBlockBoldFromZone(block) {
  if (block.bold) return true;
  return false;
}

function detectBlockItalicFromZone(block) {
  if (block.italic) return true;
  return false;
}

module.exports = { convertPdfToDocx };
