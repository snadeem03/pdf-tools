/**
 * Page layout detection for multi-column PDF pages.
 */

function detectPageLayouts(pages, images = []) {
  const layouts = [];
  for (const page of pages) {
    layouts.push(detectPageLayout(page, images));
  }
  return layouts;
}

function detectPageLayout(page, images = []) {
  const pageWidth = page.width || 612;
  const pageHeight = page.height || 792;
  const textItems = (page.items || []).filter(i => i.str && i.str.trim().length > 0);
  const contentBounds = computeContentBounds(textItems, pageWidth, pageHeight);
  const columnInfo = detectColumns(textItems, pageWidth, contentBounds);
  const pageImages = images.filter(i => i.pageIndex === page.pageIndex);
  const classified = classifyElements(page, columnInfo, contentBounds, pageImages);
  const zones = buildLayoutZones(classified, columnInfo, contentBounds);
  const readingOrder = computeReadingOrder(zones);

  return {
    pageIndex: page.pageIndex,
    pageWidth,
    pageHeight,
    contentBounds,
    columnCount: columnInfo.count,
    columns: columnInfo.columns,
    columnGap: columnInfo.gap,
    classified,
    zones,
    readingOrder,
  };
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

/**
 * Detect column structure from text items.
 *
 * Algorithm:
 *   1. Split items into left/right halves based on page center
 *   2. Find the gap between the rightmost start-X of left items
 *      and leftmost start-X of right items
 *   3. Verify the gap is large enough
 *   4. Verify items on each side have consistent X positions
 *      (i.e., they cluster at column-start positions, not randomly spread)
 */
function detectColumns(textItems, pageWidth, contentBounds) {
  if (textItems.length < 6) {
    return {
      count: 1,
      columns: [{ left: contentBounds.left, right: contentBounds.right, center: (contentBounds.left + contentBounds.right) / 2 }],
      gap: 0,
      gapCenter: pageWidth / 2,
    };
  }

  const xValues = textItems.map(i => i.x).sort((a, b) => a - b);
  const minX = xValues[0];
  const maxX = xValues[xValues.length - 1];
  const contentWidth = maxX - minX;

  if (contentWidth < 60) {
    return {
      count: 1,
      columns: [{ left: contentBounds.left, right: contentBounds.right, center: (contentBounds.left + contentBounds.right) / 2 }],
      gap: 0,
      gapCenter: pageWidth / 2,
    };
  }

  const centerX = minX + contentWidth / 2;
  const leftItems = textItems.filter(i => i.x < centerX);
  const rightItems = textItems.filter(i => i.x >= centerX);

  if (leftItems.length < 3 || rightItems.length < 3) {
    return {
      count: 1,
      columns: [{ left: contentBounds.left, right: contentBounds.right, center: (contentBounds.left + contentBounds.right) / 2 }],
      gap: 0,
      gapCenter: pageWidth / 2,
    };
  }

  const leftMaxX = Math.max(...leftItems.map(i => i.x));
  const rightMinX = Math.min(...rightItems.map(i => i.x));
  const gap = rightMinX - leftMaxX;

  if (gap < 25) {
    return {
      count: 1,
      columns: [{ left: contentBounds.left, right: contentBounds.right, center: (contentBounds.left + contentBounds.right) / 2 }],
      gap: 0,
      gapCenter: pageWidth / 2,
    };
  }

  // Verify items cluster at specific X positions (not randomly spread)
  // Compute the most common X value on each side
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

  // Find the most frequent X on each side
  const leftMostFrequent = Object.entries(leftXCounts).sort((a, b) => b[1] - a[1])[0];
  const rightMostFrequent = Object.entries(rightXCounts).sort((a, b) => b[1] - a[1])[0];

  // At least 30% of items on each side should share the same X position
  // (indicating a consistent column-start position)
  const leftClusterRatio = leftMostFrequent[1] / leftItems.length;
  const rightClusterRatio = rightMostFrequent[1] / rightItems.length;

  if (leftClusterRatio < 0.25 || rightClusterRatio < 0.25) {
    return {
      count: 1,
      columns: [{ left: contentBounds.left, right: contentBounds.right, center: (contentBounds.left + contentBounds.right) / 2 }],
      gap: 0,
      gapCenter: pageWidth / 2,
    };
  }

  // Two-column layout confirmed
  const gapCenter = (leftMaxX + rightMinX) / 2;

  const colLeft = {
    left: Math.min(...leftItems.map(i => i.x)),
    right: leftMaxX,
  };
  const colRight = {
    left: rightMinX,
    right: Math.max(...rightItems.map(i => i.x + (i.width || 0))),
  };

  return {
    count: 2,
    columns: [
      { left: colLeft.left, right: colLeft.right, center: (colLeft.left + colLeft.right) / 2 },
      { left: colRight.left, right: colRight.right, center: (colRight.left + colRight.right) / 2 },
    ],
    gap,
    gapCenter,
    gapStart: leftMaxX,
    gapEnd: rightMinX,
  };
}

function classifyElements(page, columnInfo, contentBounds, pageImages) {
  const classified = { blocks: [], images: [], tables: [] };
  for (const block of (page.blocks || [])) {
    const classification = classifyBlock(block, columnInfo, contentBounds);
    classified.blocks.push({ ...block, _column: classification.column, _fullWidth: classification.fullWidth });
  }
  for (const img of pageImages) {
    const classification = classifyImage(img, columnInfo, contentBounds);
    classified.images.push({ ...img, _column: classification.column, _fullWidth: classification.fullWidth });
  }
  for (const table of (page.tables || [])) {
    const classification = classifyTable(table, columnInfo, contentBounds);
    classified.tables.push({ ...table, _column: classification.column, _fullWidth: classification.fullWidth });
  }
  return classified;
}

function classifyBlock(block, columnInfo, contentBounds) {
  if (columnInfo.count <= 1) return { column: 0, fullWidth: true };
  const blockLeft = block.leftX || 0;
  const blockRight = block.rightX || blockLeft;
  const blockWidth = blockRight - blockLeft;
  const contentWidth = contentBounds.width;
  if (contentWidth > 0 && blockWidth > contentWidth * 0.65) return { column: -1, fullWidth: true };
  if (columnInfo.columns.length >= 2 && blockLeft < columnInfo.columns[0].right && blockRight > columnInfo.columns[1].left) {
    const overlapLeft = Math.max(blockLeft, columnInfo.columns[0].left);
    const overlapRight = Math.min(blockRight, columnInfo.columns[1].right);
    if (overlapRight - overlapLeft > contentWidth * 0.5) return { column: -1, fullWidth: true };
  }
  const blockCenter = (blockLeft + blockRight) / 2;
  let bestColumn = 0;
  let bestDist = Infinity;
  for (let i = 0; i < columnInfo.columns.length; i++) {
    const dist = Math.abs(blockCenter - columnInfo.columns[i].center);
    if (dist < bestDist) { bestDist = dist; bestColumn = i; }
  }
  return { column: bestColumn, fullWidth: false };
}

function classifyImage(img, columnInfo, contentBounds) {
  if (columnInfo.count <= 1) return { column: 0, fullWidth: true };
  const imgLeft = img.x || 0;
  const imgWidth = img.drawWidth || 0;
  const contentWidth = contentBounds.width;
  if (contentWidth > 0 && imgWidth > contentWidth * 0.6) return { column: -1, fullWidth: true };
  const imgCenter = imgLeft + imgWidth / 2;
  if (columnInfo.gapStart !== undefined && imgCenter >= columnInfo.gapStart && imgCenter <= columnInfo.gapEnd) return { column: -1, fullWidth: true };
  let bestColumn = 0;
  let bestDist = Infinity;
  for (let i = 0; i < columnInfo.columns.length; i++) {
    const dist = Math.abs(imgCenter - columnInfo.columns[i].center);
    if (dist < bestDist) { bestDist = dist; bestColumn = i; }
  }
  return { column: bestColumn, fullWidth: false };
}

function classifyTable(table, columnInfo, contentBounds) {
  if (columnInfo.count <= 1) return { column: 0, fullWidth: true };
  const tableLeft = table.leftX || 0;
  const tableRight = table.rightX || (tableLeft + (table.width || 0));
  const tableWidth = tableRight - tableLeft;
  const contentWidth = contentBounds.width;
  if (contentWidth > 0 && tableWidth > contentWidth * 0.6) return { column: -1, fullWidth: true };
  if (table.columnPositions && table.columnPositions.length > 0) {
    const firstCol = table.columnPositions[0];
    const lastCol = table.columnPositions[table.columnPositions.length - 1];
    if (lastCol - firstCol > contentWidth * 0.5) return { column: -1, fullWidth: true };
  }
  const tableCenter = (tableLeft + tableRight) / 2;
  let bestColumn = 0;
  let bestDist = Infinity;
  for (let i = 0; i < columnInfo.columns.length; i++) {
    const dist = Math.abs(tableCenter - columnInfo.columns[i].center);
    if (dist < bestDist) { bestDist = dist; bestColumn = i; }
  }
  return { column: bestColumn, fullWidth: false };
}

function buildLayoutZones(classified, columnInfo, contentBounds) {
  if (columnInfo.count <= 1) {
    const allElements = [
      ...classified.blocks.map(b => ({ ...b, _elementType: 'block' })),
      ...classified.tables.map(t => ({ ...t, _elementType: 'table' })),
      ...classified.images.map(i => ({ ...i, _elementType: 'image' })),
    ];
    allElements.sort((a, b) => (a.topY || a.y || 0) - (b.topY || b.y || 0));
    if (allElements.length === 0) return [];
    return [{
      type: 'fullWidth',
      top: Math.max(...allElements.map(e => e.topY || e.y || 0)),
      bottom: Math.min(...allElements.map(e => e.bottomY || e.y || 0)),
      elements: allElements,
      columnIndex: 0,
    }];
  }

  const allElements = [
    ...classified.blocks.map(b => ({ ...b, _elementType: 'block' })),
    ...classified.tables.map(t => ({ ...t, _elementType: 'table' })),
    ...classified.images.map(i => ({ ...i, _elementType: 'image' })),
  ];
  if (allElements.length === 0) return [];
  allElements.sort((a, b) => (a.topY || a.y || 0) - (b.topY || b.y || 0));

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
        zones.push(finalizeZone(currentZone));
        currentZone = {
          type: isFullWidth ? 'fullWidth' : 'columns',
          top: elTop,
          bottom: elBottom,
          elements: [el],
          columnAssignments: isFullWidth ? {} : { [el._column]: [el] },
        };
      } else if (isFullWidth && currentZone.type === 'columns') {
        zones.push(finalizeZone(currentZone));
        currentZone = {
          type: 'fullWidth',
          top: elTop,
          bottom: elBottom,
          elements: [el],
          columnAssignments: {},
        };
      } else if (!isFullWidth && currentZone.type === 'fullWidth') {
        zones.push(finalizeZone(currentZone));
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
  if (currentZone) zones.push(finalizeZone(currentZone));
  return zones;
}

function finalizeZone(zone) {
  return {
    type: zone.type,
    top: zone.top,
    bottom: zone.bottom,
    elements: zone.elements,
    columnAssignments: zone.columnAssignments || {},
  };
}

function computeReadingOrder(zones) {
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

module.exports = { detectPageLayouts, detectPageLayout, computeReadingOrder };
