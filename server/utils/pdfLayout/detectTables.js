/**
 * Table detection from text block geometry.
 *
 * Uses explicit table headers ("TABLE I", "TABLE II") as anchors,
 * then finds table data below them with consistent column alignment.
 *
 * @param {object[]} blocks – output of groupBlocks for a single page
 * @param {number} pageWidth
 * @returns {{ tables: object[], remaining: object[] }}
 */
function detectTables(blocks, pageWidth) {
  if (!blocks || blocks.length < 2) {
    return { tables: [], remaining: blocks || [] };
  }

  // Check for explicit table headers
  const tableHeaderBlocks = blocks.filter((b) => {
    const text = (b.text || '').toUpperCase();
    return /\bTABLE\s+(I+V?|X+|V*I*|X*[IV]*)\b/.test(text);
  });

  if (tableHeaderBlocks.length === 0) {
    return { tables: [], remaining: blocks };
  }

  const allTables = [];
  const usedBlockIndices = new Set();

  for (const header of tableHeaderBlocks) {
    const headerIdx = blocks.indexOf(header);
    // Find blocks after this header
    const candidateBlocks = blocks.slice(headerIdx + 1).filter((b) => {
      const zone = b.zone || 'BODY';
      return zone === 'BODY';
    });

    if (candidateBlocks.length < 3) continue;

    // Find column positions from lines that have items spread horizontally
    const columnPositions = findColumnPositions(candidateBlocks, pageWidth);
    if (columnPositions.length < 2) continue;

    // Extract table rows from blocks
    const tableRows = extractTableRows(candidateBlocks, columnPositions, usedBlockIndices);

    if (tableRows.length >= 3) {
      allTables.push({
        type: 'table',
        rows: tableRows,
        columns: columnPositions.length,
        confidence: 0.85,
        headerText: header.text.substring(0, 60),
      });
    }
  }

  const remaining = blocks.filter((_, idx) => !usedBlockIndices.has(idx));

  return { tables: allTables, remaining };
}

/**
 * Find stable column positions from candidate blocks.
 */
function findColumnPositions(candidateBlocks, pageWidth) {
  const xPositions = [];

  for (const block of candidateBlocks) {
    if (!block.lines) continue;
    for (const line of block.lines) {
      const items = (line.items || []).filter((it) => it.str && it.str.trim().length > 0);
      if (items.length < 2) continue;

      // Check items span enough of the page
      const minX = Math.min(...items.map((it) => it.x));
      const maxX = Math.max(...items.map((it) => it.x));
      if (maxX - minX < pageWidth * 0.25) continue;

      for (const item of items) {
        xPositions.push(item.x);
      }
    }
  }

  if (xPositions.length < 6) return [];

  const clusters = clusterValues(xPositions, 18);
  // Only keep columns that appear in at least 3 lines
  return clusters.filter((c) => c.count >= 3).sort((a, b) => a.center - b.center);
}

/**
 * Extract table rows from candidate blocks using column positions.
 */
function extractTableRows(candidateBlocks, columnPositions, usedBlockIndices) {
  const rows = [];

  for (const block of candidateBlocks) {
    if (!block.lines || block.lines.length === 0) continue;

    for (const line of block.lines) {
      const items = (line.items || []).filter((it) => it.str && it.str.trim().length > 0);
      if (items.length < 2) continue;

      // Build one row per line
      const row = [];
      for (const col of columnPositions) {
        let bestItem = null;
        let bestDist = Infinity;
        for (const item of items) {
          const dist = Math.abs(item.x - col.center);
          if (dist < 30 && dist < bestDist) {
            bestDist = dist;
            bestItem = item;
          }
        }
        row.push(
          bestItem
            ? { text: bestItem.str.trim(), bold: block.bold || false, fontSize: block.fontSize || 12, alignment: 'left' }
            : null
        );
      }

      // Only add rows with at least 2 non-empty cells
      if (row.filter(Boolean).length >= 2) {
        rows.push(row);
        usedBlockIndices.add(candidateBlocks.indexOf(block));
      }
    }
  }

  return rows;
}

/**
 * Cluster numeric values by proximity.
 */
function clusterValues(values, tolerance) {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const clusters = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - current[current.length - 1] <= tolerance) {
      current.push(sorted[i]);
    } else {
      clusters.push({
        center: current.reduce((s, v) => s + v, 0) / current.length,
        count: current.length,
      });
      current = [sorted[i]];
    }
  }
  clusters.push({
    center: current.reduce((s, v) => s + v, 0) / current.length,
    count: current.length,
  });

  return clusters;
}

module.exports = { detectTables };
