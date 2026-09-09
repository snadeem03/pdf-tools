/**
 * Group text items into visual lines based on vertical proximity.
 *
 * Items on the same visual line have:
 *   - similar Y baseline (within a tolerance based on font size)
 *   - overlapping or adjacent vertical bounding boxes
 *
 * Within each line, items are sorted left-to-right by X coordinate.
 *
 * @param {object[]} items – text items from extractTextItems (single page)
 * @param {number} [pageHeight] – page height for coordinate reference
 * @returns {object[]} lines – array of { items: object[], y, x, width, height, fontSize, pageIndex }
 */
function groupLines(items, pageHeight) {
  if (!items || items.length === 0) return [];

  // Filter out empty strings that are just EOL markers
  const meaningful = items.filter((it) => it.str.trim().length > 0 || it.width > 0);
  if (meaningful.length === 0) return [];

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

    if ((sameBaseline || yOverlap) && verticalGap <= tolerance) {
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
 * Determine whether a text item is an explicit PDF space character.
 *
 * PDF.js sometimes returns space characters as separate items with
 * str=" " and a measurable width (~0.25× fontSize). These are real
 * spaces that must be preserved in the reconstructed text.
 */
function isSpaceItem(item) {
  return item.str.trim() === '' && item.str.length > 0 && item.width > 0.1 * item.fontSize;
}

/**
 * Reconstruct line text from sorted items with correct word spacing.
 *
 * Algorithm:
 *   1. Items with str=" " and width > 0.1×fontSize are explicit spaces.
 *   2. Explicit space items are inserted as word boundaries.
 *   3. Non-space items are concatenated directly (no space inserted).
 *   4. Items containing internal spaces (e.g. "Department of") are
 *      preserved as-is.
 *   5. Leading/trailing whitespace is trimmed from the final result.
 *
 * @param {object[]} sortedItems – items sorted left-to-right by x
 * @returns {string} reconstructed line text with correct word spacing
 */
function buildLineText(sortedItems) {
  const parts = [];
  let prevRightEdge = null;

  for (const item of sortedItems) {
    const str = item.str;

    if (isSpaceItem(item)) {
      // Explicit PDF space — insert a single space.
      // Avoid doubling if the previous part already ends with a space.
      if (parts.length > 0 && !parts[parts.length - 1].endsWith(' ')) {
        parts.push(' ');
      }
      prevRightEdge = item.x + item.width;
      continue;
    }

    if (!str || str.length === 0) {
      prevRightEdge = item.x + item.width;
      continue;
    }

    // For non-space items, concatenate directly.
    // Do NOT insert a gap-based space here — PDF explicit space items
    // are the authoritative source of word boundaries.
    parts.push(str);
    prevRightEdge = item.x + item.width;
  }

  return parts.join('').trim();
}

/**
 * Compute aggregate properties for a line from its items.
 */
function finalizeLine(lineItems) {
  // Sort items left to right
  const sorted = [...lineItems].sort((a, b) => a.x - b.x);

  const leftX = sorted[0].x;
  const rightEdge = Math.max(...sorted.map((it) => it.x + it.width));
  const maxWidth = sorted[0].pageWidth || 612;

  // Determine the dominant font size (largest)
  const dominantFontSize = Math.max(...sorted.map((it) => it.fontSize));

  // Reconstruct text with correct word spacing
  const text = buildLineText(sorted);

  // If text is just whitespace/empty and all items have zero width, skip
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
    // Compute alignment hint
    centerX: leftX + (rightEdge - leftX) / 2,
    pageCenterX: maxWidth / 2,
  };
}

module.exports = { groupLines };
