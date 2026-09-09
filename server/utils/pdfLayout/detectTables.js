/**
 * Table detection from text block geometry.
 *
 * Strategy:
 *   1. Analyze item-level X positions within lines to find column boundaries
 *   2. Look for rows where items are distributed across multiple X positions
 *   3. Find recurring column positions across multiple lines
 *   4. Build a table from the detected grid
 *
 * @param {object[]} blocks – output of groupBlocks for a single page
 * @param {number} pageWidth
 * @returns {{ tables: object[], remaining: object[] }}
 */
function detectTables(blocks, pageWidth) {
  if (!blocks || blocks.length < 2) {
    return { tables: [], remaining: blocks || [] };
  }

  // Look at item-level X positions within each block's lines
  // to detect multi-column structures (key-value pairs, table cells, etc.)
  const candidateRows = [];

  for (const block of blocks) {
    if (!block.lines) continue;

    for (const line of block.lines) {
      if (!line.items || line.items.length < 2) continue;

      // Filter to meaningful text items (not spaces/empty)
      const meaningfulItems = line.items.filter((it) => it.str && it.str.trim().length > 0);
      if (meaningfulItems.length < 2) continue;

      // Check if items span a significant horizontal distance
      const minX = Math.min(...meaningfulItems.map((it) => it.x));
      const maxX = Math.max(...meaningfulItems.map((it) => it.x + it.width));
      const span = maxX - minX;

      // Use a lower threshold: at least 10% of page width or 50 PDF units
      if (span < Math.max(pageWidth * 0.1, 50)) continue;

      // This line has multiple items spread horizontally – candidate for table row
      candidateRows.push({
        items: meaningfulItems,
        y: line.y,
        fontSize: line.fontSize,
        block,
      });
    }
  }

  if (candidateRows.length < 2) {
    return { tables: [], remaining: blocks };
  }

  // Find column positions by clustering item X positions
  const allItemXPositions = [];
  for (const row of candidateRows) {
    for (const item of row.items) {
      allItemXPositions.push(item.x);
    }
  }

  const columnClusters = clusterValues(allItemXPositions, 25);

  if (columnClusters.length < 2) {
    return { tables: [], remaining: blocks };
  }

  // Sort columns by position
  columnClusters.sort((a, b) => a.center - b.center);

  // Check that column positions are reasonably evenly spaced
  const colPositions = columnClusters.map((c) => c.center);
  if (colPositions.length >= 2) {
    const gaps = [];
    for (let i = 1; i < colPositions.length; i++) {
      gaps.push(colPositions[i] - colPositions[i - 1]);
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    const gapVariance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length;
    const gapStdDev = Math.sqrt(gapVariance);

    // If gaps are too inconsistent, probably not a real table
    if (avgGap > 0 && gapStdDev / avgGap > 0.8) {
      return { tables: [], remaining: blocks };
    }
  }

  // Build table rows from candidate rows
  const tableRows = [];
  const usedBlockIndices = new Set();

  // Sort candidate rows by Y position (top to bottom in PDF coords = highest Y first)
  candidateRows.sort((a, b) => b.y - a.y);

  for (const row of candidateRows) {
    const tableRow = [];
    for (const colCluster of columnClusters) {
      // Find the item in this row that is closest to this column position
      let bestItem = null;
      let bestDist = Infinity;
      for (const item of row.items) {
        const dist = Math.abs(item.x - colCluster.center);
        if (dist < bestDist && dist < colCluster.tolerance + 30) {
          bestDist = dist;
          bestItem = item;
        }
      }

      tableRow.push(
        bestItem
          ? {
              text: bestItem.str.trim(),
              bold: row.block ? row.block.bold : false,
              fontSize: row.block ? row.block.fontSize : 12,
              alignment: 'left',
            }
          : null
      );
    }

    // Only add rows that have at least one non-null cell
    if (tableRow.some(Boolean)) {
      tableRows.push(tableRow);
      if (row.block) {
        usedBlockIndices.add(blocks.indexOf(row.block));
      }
    }
  }

  if (tableRows.length < 2) {
    return { tables: [], remaining: blocks };
  }

  // Calculate fill ratio
  const totalCells = tableRows.length * columnClusters.length;
  const filledCells = tableRows.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const fillRatio = totalCells > 0 ? filledCells / totalCells : 0;

  if (fillRatio < 0.4 || filledCells < 4) {
    return { tables: [], remaining: blocks };
  }

  const table = {
    type: 'table',
    rows: tableRows,
    columns: columnClusters.length,
    columnPositions: columnClusters.map((c) => c.center),
    fillRatio,
    confidence: Math.min(1, fillRatio * (columnClusters.length / 2)),
  };

  // Remaining blocks are those not consumed by the table
  const remaining = blocks.filter((_, idx) => !usedBlockIndices.has(idx));

  return { tables: [table], remaining };
}

/**
 * Cluster numeric values by proximity.
 * Count represents how many input values fall into this cluster.
 * Returns array of { center, count, tolerance }
 */
function clusterValues(values, tolerance) {
  if (values.length === 0) return [];

  // Keep all values (including duplicates from different rows) and sort
  const sorted = [...values].sort((a, b) => a - b);
  const clusters = [];
  let currentCluster = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - currentCluster[currentCluster.length - 1] <= tolerance) {
      currentCluster.push(sorted[i]);
    } else {
      clusters.push({
        center: currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length,
        count: currentCluster.length,
        tolerance,
      });
      currentCluster = [sorted[i]];
    }
  }
  clusters.push({
    center: currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length,
    count: currentCluster.length,
    tolerance,
  });

  return clusters.filter((c) => c.count >= 2); // At least 2 items to form a column
}

module.exports = { detectTables };
