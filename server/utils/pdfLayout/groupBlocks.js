/**
 * Group visual lines into text blocks / paragraphs.
 *
 * Uses multiple signals to detect paragraph boundaries:
 *   1. Column boundaries (never merge across columns)
 *   2. Zone boundaries (never merge across zones)
 *   3. Section heading detection (I., II., A., B., numbered)
 *   4. First-line indentation changes
 *   5. Vertical spacing gaps
 *   6. Font size changes
 *   7. Page boundaries
 *   8. Blank/empty lines
 *   9. List item patterns
 *
 * Also detects bold/italic using contextual heuristics since PDF fonts
 * are often obfuscated and don't expose style info.
 *
 * @param {object[]} lines - output of groupLines (already filtered of nulls)
 * @param {object} [options] - { columnInfo } for column-aware grouping
 * @returns {object[]} blocks - array of { lines, text, type, alignment, fontSize, ... }
 */
function groupBlocks(lines, options = {}) {
  if (!lines || lines.length === 0) return [];

  const validLines = lines.filter(Boolean);
  if (validLines.length === 0) return [];

  const bodyFontSize = computeBodyFontSize(validLines);
  const pageMargins = detectPageMargins(validLines);
  const columnInfo = options.columnInfo || null;

  const blocks = [];
  let currentBlock = [validLines[0]];

  for (let i = 1; i < validLines.length; i++) {
    const line = validLines[i];
    const prevLine = currentBlock[currentBlock.length - 1];

    const shouldBreak = detectParagraphBreak(prevLine, line, currentBlock, bodyFontSize, columnInfo);

    if (shouldBreak) {
      blocks.push(finalizeBlock(currentBlock, bodyFontSize, pageMargins));
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  blocks.push(finalizeBlock(currentBlock, bodyFontSize, pageMargins));

  return blocks;
}

/**
 * Compute median of a numeric array.
 */
function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Compute the body font size (most frequent font size by character count).
 */
function computeBodyFontSize(lines) {
  const sizeFreq = {};
  for (const line of lines) {
    const size = Math.round(line.fontSize);
    sizeFreq[size] = (sizeFreq[size] || 0) + (line.text || '').length;
  }

  let bodySize = 10;
  let maxChars = 0;
  for (const [size, chars] of Object.entries(sizeFreq)) {
    if (chars > maxChars) {
      maxChars = chars;
      bodySize = Number(size);
    }
  }
  return bodySize;
}

/**
 * Detect page margins from actual text positions.
 */
function detectPageMargins(lines) {
  if (lines.length === 0) return { left: 72, right: 540 };

  const leftEdges = lines.map((l) => l.x).sort((a, b) => a - b);
  const rightEdges = lines.map((l) => l.rightX).sort((a, b) => b - a);

  const leftIdx = Math.floor(leftEdges.length * 0.1);
  const rightIdx = Math.floor(rightEdges.length * 0.1);

  return {
    left: leftEdges[leftIdx] || 72,
    right: rightEdges[rightIdx] || 540,
  };
}

/**
 * Determine whether two adjacent lines belong to different paragraphs.
 */
function detectParagraphBreak(prevLine, newLine, currentBlock, bodyFontSize, columnInfo) {
  // 1. Column boundary: never merge across columns
  if (columnInfo && columnInfo.count > 1) {
    const prevCol = assignLineToColumn(prevLine, columnInfo);
    const newCol = assignLineToColumn(newLine, columnInfo);
    if (prevCol !== newCol) return true;
  }

  // 2. Zone boundary: never merge across zones
  if (newLine.zone && prevLine.zone && newLine.zone !== prevLine.zone) return true;

  // 3. Page boundary
  if (newLine.pageIndex !== prevLine.pageIndex) return true;

  // 4. Title lines: merge consecutive centered large-font lines (title may wrap)
  if (isTitleLikeLine(prevLine, bodyFontSize) && isTitleLikeLine(newLine, bodyFontSize)) {
    return false;
  }

  // 5. Section heading detection
  if (isSectionHeading(newLine)) return true;
  if (isSubsectionHeading(newLine)) return true;

  // 6. Font size change - only break for large structural differences
  const fontSizeRatio = newLine.fontSize / prevLine.fontSize;
  if (fontSizeRatio > 1.5 || fontSizeRatio < 0.67) return true;

  // 7. First-line indentation
  const indentDiff = newLine.x - prevLine.x;
  const isIndented = indentDiff > 15;
  const isDedented = indentDiff < -15;

  if (isIndented && currentBlock.length >= 1) {
    const prevLineEndsParagraph = prevLine.text && /[.!?;:]$/.test(prevLine.text.trim());
    if (prevLineEndsParagraph || currentBlock.length > 1) return true;
  }

  if (isDedented && currentBlock.length > 1) return true;

  // 8. Vertical gap
  const gap = prevLine.bottomY - newLine.topY;
  const avgHeight = (prevLine.height + newLine.height) / 2;

  if (gap > avgHeight * 1.3) return true;
  if (gap < -avgHeight * 0.5) return true;

  // 9. Blank line detection
  if (prevLine.text && prevLine.text.trim().length < 5 && gap > avgHeight * 0.5) return true;

  // 10. List item starts
  if (isListItemStart(newLine) && currentBlock.length > 0) return true;

  // 11. Very large vertical jump
  const verticalJump = Math.abs(prevLine.y - newLine.y);
  if (verticalJump > avgHeight * 3) return true;

  return false;
}

/**
 * Assign a line to a column based on its X position.
 * Returns the column index (0-based) or -1 if not in any column.
 */
function assignLineToColumn(line, columnInfo) {
  if (!columnInfo || columnInfo.count <= 1) return 0;

  const lineCenterX = line.x + (line.width || 0) / 2;

  // Check if line is in the gap (full-width)
  if (columnInfo.gapStart !== undefined && lineCenterX >= columnInfo.gapStart && lineCenterX <= columnInfo.gapEnd) {
    return -1; // full-width
  }

  // Assign to nearest column
  let bestColumn = 0;
  let bestDist = Infinity;
  for (let i = 0; i < columnInfo.columns.length; i++) {
    const colCenter = columnInfo.columns[i].center;
    const dist = Math.abs(lineCenterX - colCenter);
    if (dist < bestDist) {
      bestDist = dist;
      bestColumn = i;
    }
  }

  return bestColumn;
}

/**
 * Detect if a line is a section heading (I., II., III., etc.).
 */
function isSectionHeading(line) {
  const text = (line.text || '').trim();
  if (/^[IVX]+\.\s+[A-Z]/.test(text)) return true;
  if (/^\d+\.\s+[A-Z][a-z]/.test(text)) return true;
  return false;
}

/**
 * Detect if a line is a subsection heading (A., B., C., etc.).
 */
function isSubsectionHeading(line) {
  const text = (line.text || '').trim();
  if (/^[A-Z]\.\s+[A-Z]/.test(text)) return true;
  if (/^\d+\.\d+\s+[A-Z]/.test(text)) return true;
  return false;
}

/**
 * Detect if a line starts a list item.
 */
function isListItemStart(line) {
  const text = (line.text || '').trim();
  if (/^[\u2022\u2023\u25E6\u2043\u2219\u2038\u2039\u203A\u203B\u203C\u203D\u203E\u203F\u2040\u2041\u2042]\s/.test(text)) return true;
  if (/^[-*+]\s/.test(text)) return true;
  if (/^\d+[.)]\s/.test(text)) return true;
  if (/^[a-z][.)]\s/i.test(text)) return true;
  return false;
}

/**
 * Detect if a line is title-like (centered, large font).
 */
function isTitleLikeLine(line, bodyFontSize) {
  if (!line) return false;
  const text = (line.text || '').trim();
  if (text.length < 5) return false;
  if (line.fontSize < bodyFontSize * 1.2) return false;

  const centerX = line.x + (line.width || 0) / 2;
  const pageWidth = line.pageWidth || 612;
  if (Math.abs(centerX - pageWidth / 2) > pageWidth * 0.15) return false;

  const nonTitlePatterns = ['ISSN', 'www.', 'http', 'Volume', 'Issue', 'Ac'];
  if (nonTitlePatterns.some((p) => text.includes(p))) return false;

  return true;
}

/**
 * Compute aggregate properties for a block from its lines.
 */
function finalizeBlock(blockLines, bodyFontSize, pageMargins) {
  const text = blockLines.map((l) => l.text).join(' ');
  const dominantFontSize = Math.max(...blockLines.map((l) => l.fontSize));

  const alignment = detectBlockAlignment(blockLines, pageMargins);
  const isHeading = detectHeadingCandidate(blockLines, dominantFontSize, bodyFontSize);
  const isListItem = detectListItem(blockLines);

  const leftX = Math.min(...blockLines.map((l) => l.x));
  const rightX = Math.max(...blockLines.map((l) => l.rightX));

  const firstLineX = blockLines[0].x;
  let continuationLineX = firstLineX;
  if (blockLines.length > 1) {
    const nonFirstXs = blockLines.slice(1).map((l) => l.x);
    continuationLineX = median(nonFirstXs);
  }

  const lineHeights = blockLines.map((l) => l.height || l.fontSize || 10);

  let computedLineSpacing = 0;
  if (blockLines.length > 1) {
    const baselines = blockLines.map((l) => l.y);
    const gaps = [];
    for (let i = 1; i < baselines.length; i++) {
      gaps.push(Math.abs(baselines[i - 1] - baselines[i]));
    }
    computedLineSpacing = median(gaps);
  }

  const bold = detectBlockBold(blockLines, bodyFontSize);
  const italic = detectBlockItalic(blockLines);

  return {
    lines: blockLines,
    text,
    fontSize: dominantFontSize,
    fontName: blockLines[0].fontName,
    zone: blockLines[0].zone || 'BODY',
    alignment,
    isHeading,
    headingLevel: isHeading ? computeHeadingLevel(dominantFontSize, bodyFontSize, text) : 0,
    isListItem,
    listItemType: isListItem ? detectListItemType(blockLines[0].text) : null,
    leftX,
    rightX,
    width: rightX - leftX,
    firstLineX,
    continuationLineX,
    lineHeights,
    computedLineSpacing,
    pageWidth: blockLines[0].pageWidth,
    pageHeight: blockLines[0].pageHeight,
    pageIndex: blockLines[0].pageIndex,
    topY: blockLines[0].topY,
    bottomY: blockLines[blockLines.length - 1].bottomY,
    lineCount: blockLines.length,
    bold,
    italic,
  };
}

/**
 * Detect alignment of a block based on line positions.
 */
function detectBlockAlignment(blockLines, pageMargins) {
  if (blockLines.length === 0) return 'left';

  const pageWidth = blockLines[0].pageWidth;
  const leftMargin = pageMargins.left;
  const rightMargin = pageMargins.right;
  const contentWidth = rightMargin - leftMargin;

  const justifiedCount = blockLines.filter((line) => {
    const nearLeft = line.x <= leftMargin + 35;
    const nearRight = line.rightX >= rightMargin - 35;
    return nearLeft && nearRight;
  }).length;

  if (blockLines.length > 1 && justifiedCount >= blockLines.length * 0.4) return 'justified';

  if (blockLines.length === 1) {
    const line = blockLines[0];
    const lineWidth = line.rightX - line.x;
    if (lineWidth > contentWidth * 0.7) return 'justified';
  }

  const centeredCount = blockLines.filter((line) => {
    const centerX = line.x + line.width / 2;
    const isNearCenter = Math.abs(centerX - pageWidth / 2) < pageWidth * 0.1;
    const isNarrow = line.width < contentWidth * 0.65;
    return isNearCenter && isNarrow;
  }).length;

  if (centeredCount >= blockLines.length * 0.7) return 'center';

  const rightAlignedCount = blockLines.filter((line) => {
    return line.rightX > rightMargin - 15 && line.x > leftMargin + 30;
  }).length;

  if (rightAlignedCount >= blockLines.length * 0.7) return 'right';

  return 'left';
}

/**
 * Detect if a block is likely a heading.
 */
function detectHeadingCandidate(blockLines, fontSize, bodyFontSize) {
  if (blockLines.length === 1) {
    const text = blockLines[0].text.trim();
    if (/^[IVX]+\.\s+[A-Z]/.test(text)) return true;
    if (/^[A-Z]\.\s+[A-Z]/.test(text)) return true;
    if (/^\d+\.\d+\s+[A-Z]/.test(text)) return true;
    if (/^(TABLE|Figure|Fig\.|Table)\s+\w+/i.test(text)) return true;
  }

  if (fontSize > bodyFontSize * 1.3 && blockLines.length <= 2) return true;

  return false;
}

/**
 * Compute heading level from font size relative to body.
 */
function computeHeadingLevel(fontSize, bodyFontSize, text) {
  if (text) {
    const trimmed = text.trim();
    if (/^[IVX]+\.\s+[A-Z]/.test(trimmed)) return 1;
    if (/^[A-Z]\.\s+[A-Z]/.test(trimmed)) return 2;
    if (/^\d+\.\d+\s+[A-Z]/.test(trimmed)) return 3;
    if (/^Abstract/i.test(trimmed)) return 2;
    if (/^Index Terms/i.test(trimmed)) return 2;
  }

  const ratio = fontSize / bodyFontSize;
  if (ratio >= 1.8) return 1;
  if (ratio >= 1.5) return 2;
  if (ratio >= 1.3) return 3;

  return 4;
}

/**
 * Detect if a block is a list item.
 */
function detectListItem(blockLines) {
  if (blockLines.length === 0) return false;
  return isListItemStart(blockLines[0]);
}

/**
 * Detect list item type.
 */
function detectListItemType(text) {
  const trimmed = text.trim();
  if (/^[\u2022\u2023\u25E6\u2043\u2219\u2038\u2039\u203A\u203B\u203C\u203D\u203E\u203F\u2040\u2041\u2042]\s/.test(trimmed)) return 'bullet';
  if (/^[-*+]\s/.test(trimmed)) return 'bullet';
  if (/^\d+[.)]\s/.test(trimmed)) return 'ordered';
  return 'unknown';
}

/**
 * Detect bold using font metadata from items.
 */
function detectBlockBold(blockLines, bodyFontSize) {
  const hasBoldFont = blockLines.some((l) => {
    if (l.items) {
      return l.items.some((item) => item.fontBold);
    }
    const fn = (l.fontName || '').toLowerCase();
    return fn.includes('bold') || fn.includes('black') || fn.includes('heavy');
  });
  return hasBoldFont;
}

/**
 * Detect italic using font metadata from items.
 */
function detectBlockItalic(blockLines) {
  const hasItalicFont = blockLines.some((l) => {
    if (l.items) {
      return l.items.some((item) => item.fontItalic);
    }
    const fn = (l.fontName || '').toLowerCase();
    return fn.includes('italic') || fn.includes('oblique');
  });
  return hasItalicFont;
}

module.exports = { groupBlocks, assignLineToColumn };
