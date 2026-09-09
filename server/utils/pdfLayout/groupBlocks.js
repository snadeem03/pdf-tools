/**
 * Group visual lines into text blocks / paragraphs.
 *
 * A new paragraph is started when:
 *   - vertical gap between lines exceeds 1.5× the average line height
 *   - indentation changes significantly
 *   - font size changes (heading vs body)
 *   - alignment changes
 *   - a page boundary is crossed
 *
 * @param {object[]} lines – output of groupLines (already filtered of nulls)
 * @returns {object[]} blocks – array of { lines, text, type, alignment, fontSize, ... }
 */
function groupBlocks(lines) {
  if (!lines || lines.length === 0) return [];

  const validLines = lines.filter(Boolean);
  if (validLines.length === 0) return [];

  const blocks = [];
  let currentBlock = [validLines[0]];

  for (let i = 1; i < validLines.length; i++) {
    const line = validLines[i];
    const prevLine = currentBlock[currentBlock.length - 1];

    const shouldBreak = detectParagraphBreak(prevLine, line, currentBlock);

    if (shouldBreak) {
      blocks.push(finalizeBlock(currentBlock));
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  blocks.push(finalizeBlock(currentBlock));

  return blocks;
}

/**
 * Determine whether two adjacent lines belong to different paragraphs.
 */
function detectParagraphBreak(prevLine, newLine, currentBlock) {
  // Page boundary
  if (newLine.pageIndex !== prevLine.pageIndex) return true;

  // Font size change (likely heading or different section)
  const fontSizeRatio = newLine.fontSize / prevLine.fontSize;
  if (fontSizeRatio > 1.3 || fontSizeRatio < 0.7) return true;

  // Vertical gap: if the gap between bottom of prev and top of new is large
  const gap = prevLine.bottomY - newLine.topY; // positive = new line is below
  const avgHeight = (prevLine.height + newLine.height) / 2;
  if (gap > avgHeight * 1.2) return true;

  // Indentation change (more than 20 PDF units difference)
  const indentDiff = Math.abs(newLine.x - prevLine.x);
  if (indentDiff > 20 && currentBlock.length <= 2) return true;

  // Very large vertical jump (more than 3× average height)
  const verticalJump = Math.abs(prevLine.y - newLine.y);
  if (verticalJump > avgHeight * 3) return true;

  return false;
}

/**
 * Compute aggregate properties for a block from its lines.
 */
function finalizeBlock(blockLines) {
  const text = blockLines.map((l) => l.text).join(' ');
  const dominantFontSize = Math.max(...blockLines.map((l) => l.fontSize));

  // Determine alignment
  const alignment = detectBlockAlignment(blockLines);

  // Detect if this might be a heading
  const isHeading = detectHeadingCandidate(blockLines, dominantFontSize);

  // Detect if this might be a list item
  const isListItem = detectListItem(blockLines);

  // Compute left margin (minimum x across lines)
  const leftX = Math.min(...blockLines.map((l) => l.x));

  // Compute right edge
  const rightX = Math.max(...blockLines.map((l) => l.rightX));

  // Average spacing between lines in this block
  let avgLineSpacing = 0;
  if (blockLines.length > 1) {
    let totalSpacing = 0;
    for (let i = 1; i < blockLines.length; i++) {
      totalSpacing += blockLines[i - 1].bottomY - blockLines[i].topY;
    }
    avgLineSpacing = totalSpacing / (blockLines.length - 1);
  }

  return {
    lines: blockLines,
    text,
    fontSize: dominantFontSize,
    fontName: blockLines[0].fontName,
    alignment,
    isHeading,
    headingLevel: isHeading ? computeHeadingLevel(dominantFontSize) : 0,
    isListItem,
    listItemType: isListItem ? detectListItemType(blockLines[0].text) : null,
    leftX,
    rightX,
    width: rightX - leftX,
    pageWidth: blockLines[0].pageWidth,
    pageHeight: blockLines[0].pageHeight,
    pageIndex: blockLines[0].pageIndex,
    topY: blockLines[0].topY,
    bottomY: blockLines[blockLines.length - 1].bottomY,
    lineCount: blockLines.length,
    avgLineSpacing,
    bold: isLikelyBold(blockLines),
    italic: isLikelyItalic(blockLines),
  };
}

/**
 * Detect alignment of a block based on line positions.
 */
function detectBlockAlignment(blockLines) {
  if (blockLines.length === 0) return 'left';

  const pageWidth = blockLines[0].pageWidth;
  const margins = { left: 72, right: pageWidth - 72 }; // ~1 inch margins

  // Check if lines are centered (within tolerance)
  const centeredCount = blockLines.filter((line) => {
    const centerX = line.x + line.width / 2;
    return Math.abs(centerX - pageWidth / 2) < pageWidth * 0.1;
  }).length;

  if (centeredCount >= blockLines.length * 0.7) return 'center';

  // Check if lines are right-aligned
  const rightAlignedCount = blockLines.filter((line) => {
    return line.rightX > margins.right - 30;
  }).length;

  if (rightAlignedCount >= blockLines.length * 0.7) return 'right';

  // Check for justified text (lines extend close to both margins)
  const justifiedCount = blockLines.filter((line) => {
    return line.x <= margins.left + 20 && line.rightX >= margins.right - 20;
  }).length;

  if (justifiedCount >= blockLines.length * 0.7 && blockLines.length > 1) return 'justified';

  return 'left';
}

/**
 * Detect if a block is likely a heading.
 */
function detectHeadingCandidate(blockLines, fontSize) {
  // Single line blocks with larger font are likely headings
  if (blockLines.length === 1) {
    // Check if font size is notably larger than typical body text (12pt)
    if (fontSize > 14) return true;

    // Check for numbering pattern (1., 2., 1.1, etc.)
    const text = blockLines[0].text.trim();
    if (/^\d+(\.\d+)*\.?\s/.test(text)) return true;
  }

  // Multi-line blocks where first line is notably larger
  if (blockLines.length > 1) {
    const firstLineFontSize = blockLines[0].fontSize;
    const subsequentAvg = blockLines.slice(1).reduce((s, l) => s + l.fontSize, 0) / (blockLines.length - 1);
    if (firstLineFontSize > subsequentAvg * 1.3) return true;
  }

  return false;
}

/**
 * Compute heading level from font size.
 */
function computeHeadingLevel(fontSize) {
  if (fontSize >= 22) return 1;
  if (fontSize >= 18) return 2;
  if (fontSize >= 15) return 3;
  if (fontSize >= 13) return 4;
  return 5;
}

/**
 * Detect if a block is a list item.
 */
function detectListItem(blockLines) {
  if (blockLines.length === 0) return false;
  const text = blockLines[0].text.trim();

  // Bullet patterns
  if (/^[•●○▪▸►]\s/.test(text)) return true;
  if (/^[-*+]\s/.test(text)) return true;

  // Numbered list patterns
  if (/^\d+[.)]\s/.test(text)) return true;
  if (/^[ivxlc]+[.)]\s/i.test(text)) return true;
  if (/^[a-z][.)]\s/i.test(text)) return true;

  return false;
}

/**
 * Detect list item type.
 */
function detectListItemType(text) {
  const trimmed = text.trim();
  if (/^[•●○▪▸►]\s/.test(trimmed)) return 'bullet';
  if (/^[-*+]\s/.test(trimmed)) return 'bullet';
  if (/^\d+[.)]\s/.test(trimmed)) return 'ordered';
  return 'unknown';
}

/**
 * Detect if text is likely bold based on font name patterns.
 */
function isLikelyBold(blockLines) {
  const fontNames = blockLines.map((l) => l.fontName.toLowerCase());
  return fontNames.some(
    (fn) => fn.includes('bold') || fn.includes('black') || fn.includes('heavy')
  );
}

/**
 * Detect if text is likely italic based on font name patterns.
 */
function isLikelyItalic(blockLines) {
  const fontNames = blockLines.map((l) => l.fontName.toLowerCase());
  return fontNames.some((fn) => fn.includes('italic') || fn.includes('oblique'));
}

module.exports = { groupBlocks };
