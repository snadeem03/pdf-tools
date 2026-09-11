/**
 * Group visual lines into text items into visual lines based on vertical proximity.
 *
 * Items on the same visual line have:
 *   - similar Y baseline (within a tolerance based on font size)
 *   - overlapping or adjacent vertical bounding boxes
 *   - similar X position (within the same column when columns are detected)
 *
 * Within each line, items are sorted left-to-right by X coordinate.
 *
 * @param {object[]} items - text items from extractTextItems (single page)
 * @param {number} [pageHeight] - page height for coordinate reference
 * @param {object} [options] - { columnInfo } for column-aware grouping
 * @returns {object[]} lines - array of { items: object[], y, x, width, height, fontSize, pageIndex }
 */
function groupLines(items, pageHeight, options = {}) {
  if (!items || items.length === 0) return [];

  const meaningful = items.filter((it) => it.str.trim().length > 0 || it.width > 0);
  if (meaningful.length === 0) return [];

  const columnInfo = options.columnInfo || null;

  // Sort by Y descending (top of page first in PDF coords = highest Y value),
  // then by X ascending
  const sorted = [...meaningful].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 1) return yDiff;
    return a.x - b.x;
  });

  const lines = [];
  let currentLine = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const prev = currentLine[currentLine.length - 1];

    // Calculate baseline tolerance: items on the same line should have
    // baselines within ~40% of the larger font size
    const tolerance = Math.max(prev.fontSize, item.fontSize) * 0.4;

    // Also check if items overlap vertically (bounding boxes intersect)
    const yOverlap = !(item.bottomY > prev.topY + tolerance || item.topY < prev.bottomY - tolerance);

    // Check if items are on the same baseline
    const sameBaseline = Math.abs(item.y - prev.y) <= tolerance;

    // Check vertical distance (gap between baselines should be small relative to font size)
    const verticalGap = Math.abs(item.y - prev.y);

    // Column check: items in different columns should NOT be on the same line
    let sameColumn = true;
    if (columnInfo && columnInfo.count > 1) {
      const prevCol = getColumnIndex(prev.x, columnInfo);
      const itemCol = getColumnIndex(item.x, columnInfo);
      if (prevCol !== itemCol) sameColumn = false;
    }

    if ((sameBaseline || yOverlap) && verticalGap <= tolerance && sameColumn) {
      currentLine.push(item);
    } else {
      lines.push(finalizeLine(currentLine));
      currentLine = [item];
    }
  }
  lines.push(finalizeLine(currentLine));

  return lines;
}

/**
 * Get the column index for an item based on its X position.
 */
function getColumnIndex(x, columnInfo) {
  if (!columnInfo || columnInfo.count <= 1) return 0;

  // Check if in the gap (full-width)
  if (columnInfo.gapStart !== undefined && x >= columnInfo.gapStart && x <= columnInfo.gapEnd) {
    return -1;
  }

  // Assign to nearest column
  let bestColumn = 0;
  let bestDist = Infinity;
  for (let i = 0; i < columnInfo.columns.length; i++) {
    const dist = Math.abs(x - columnInfo.columns[i].center);
    if (dist < bestDist) {
      bestDist = dist;
      bestColumn = i;
    }
  }
  return bestColumn;
}

/**
 * Determine whether a text item is an explicit PDF space character.
 */
function isSpaceItem(item) {
  return item.str.trim() === '' && item.str.length > 0 && item.width > 0.1 * item.fontSize;
}

/**
 * Characters that should NOT have a space inserted before them.
 */
const NO_SPACE_BEFORE = new Set([',', '.', ';', ':', '!', '?', ')', ']', '}', '%', '\u2019', '\u201D', '\u2018', '\u201C']);

/**
 * Characters that should NOT have a space inserted after them.
 */
const NO_SPACE_AFTER = new Set(['(', '[', '{', '\u2018', '\u201C']);

/**
 * Determine whether a space should be inserted between two adjacent text items.
 *
 * Uses geometric gap analysis:
 *   - Positive gap (even tiny) between non-space items → word boundary
 *   - Zero/negative gap → use linguistic heuristics
 *
 * @param {object} prevItem - the preceding text item
 * @param {object} nextItem - the following text item
 * @param {boolean} hasExplicitSpace - whether an explicit space item exists between them
 * @returns {boolean}
 */
function shouldInsertSpace(prevItem, nextItem, hasExplicitSpace) {
  if (hasExplicitSpace) return true;

  const prevStr = (prevItem.str || '').trim();
  const nextStr = (nextItem.str || '').trim();

  if (prevStr.length === 0 || nextStr.length === 0) return false;

  const prevRight = prevItem.x + prevItem.width;
  const gap = nextItem.x - prevRight;

  const fontSize = Math.max(prevItem.fontSize || 10, nextItem.fontSize || 10);
  const minGapThreshold = 0.15;

  // Positive gap between items → likely a word boundary
  // Use a very low threshold: any measurable gap above floating-point noise
  if (gap > minGapThreshold) {
    const lastChar = prevStr[prevStr.length - 1];
    const firstChar = nextStr[0];
    if (NO_SPACE_BEFORE.has(firstChar)) return false;
    if (NO_SPACE_AFTER.has(lastChar)) return false;
    return true;
  }

  // Near-zero gap (items touch or nearly touch)
  if (gap > -fontSize * 0.1 && gap <= minGapThreshold) {
    const lastChar = prevStr[prevStr.length - 1];
    const firstChar = nextStr[0];

    if (NO_SPACE_BEFORE.has(firstChar)) return false;
    if (NO_SPACE_AFTER.has(lastChar)) return false;

    // camelCase boundary: lowercase followed by uppercase → word boundary
    if (lastChar === lastChar.toLowerCase() && firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
      return true;
    }

    // Uppercase followed by uppercase+lowercase → potential word boundary
    // e.g., "AB" + "testing" → "AB testing"
    if (prevStr.length <= 3 && lastChar === lastChar.toUpperCase() && firstChar === firstChar.toUpperCase() && nextStr.length > 1 && nextStr[1] === nextStr[1].toLowerCase()) {
      return true;
    }

    // Items at exact character boundaries (gap ≈ 0) with both lowercase
    // In real PDFs, split words have negative gaps (kerning overlap).
    // Exact touches are likely separate words at character boundaries.
    if (Math.abs(gap) < 0.2 && lastChar === lastChar.toLowerCase() && firstChar === firstChar.toLowerCase()) {
      return true;
    }
  }

  return false;
}

/**
 * Reconstruct line text from sorted items with correct word spacing.
 * Uses geometric gap analysis to insert spaces between separate word items.
 */
function buildLineText(sortedItems) {
  const nonEmpty = sortedItems.filter((it) => {
    const str = it.str || '';
    return str.length > 0;
  });

  if (nonEmpty.length === 0) return '';

  const parts = [];

  for (let i = 0; i < nonEmpty.length; i++) {
    const item = nonEmpty[i];
    const str = item.str;

    if (isSpaceItem(item)) {
      if (parts.length > 0 && !parts[parts.length - 1].endsWith(' ')) {
        parts.push(' ');
      }
      continue;
    }

    if (parts.length > 0) {
      const prevItem = nonEmpty[i - 1];
      const prevIsSpace = isSpaceItem(prevItem);

      if (!prevIsSpace) {
        const prevStr = (prevItem.str || '').trim();
        if (prevStr.length > 0) {
          const lastChar = prevStr[prevStr.length - 1];
          if (lastChar !== ' ' && !parts[parts.length - 1].endsWith(' ')) {
            const insertSpace = shouldInsertSpace(prevItem, item, false);
            if (insertSpace) {
              parts.push(' ');
            }
          }
        }
      }
    }

    parts.push(str);
  }

  return parts.join('').trim();
}

/**
 * Compute aggregate properties for a line from its items.
 */
function finalizeLine(lineItems) {
  const sorted = [...lineItems].sort((a, b) => a.x - b.x);

  const leftX = sorted[0].x;
  const rightEdge = Math.max(...sorted.map((it) => it.x + it.width));
  const maxWidth = sorted[0].pageWidth || 612;

  const dominantFontSize = Math.max(...sorted.map((it) => it.fontSize));

  const text = buildLineText(sorted);

  if (!text && sorted.every((it) => it.width === 0)) {
    return null;
  }

  return {
    items: sorted,
    text,
    x: leftX,
    rightX: rightEdge,
    width: rightEdge - leftX,
    y: sorted[0].y,
    topY: Math.max(...sorted.map((it) => it.topY)),
    bottomY: Math.min(...sorted.map((it) => it.bottomY)),
    height: dominantFontSize,
    fontSize: dominantFontSize,
    fontName: sorted[0].fontName,
    pageIndex: sorted[0].pageIndex,
    pageWidth: maxWidth,
    pageHeight: sorted[0].pageHeight || 792,
    centerX: leftX + (rightEdge - leftX) / 2,
    pageCenterX: maxWidth / 2,
  };
}

module.exports = { groupLines, shouldInsertSpace };
