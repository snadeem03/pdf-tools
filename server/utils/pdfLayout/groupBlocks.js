/**
 * Group visual lines into text blocks / paragraphs.
 *
 * Uses multiple signals to detect paragraph boundaries:
 *   1. Zone boundaries (never merge across zones)
 *   2. Section heading detection (I., II., A., B., numbered)
 *   3. First-line indentation changes
 *   4. Vertical spacing gaps
 *   5. Font size changes
 *   6. Page boundaries
 *   7. Blank/empty lines
 *
 * @param {object[]} lines – output of groupLines (already filtered of nulls)
 * @returns {object[]} blocks – array of { lines, text, type, alignment, fontSize, ... }
 */
function groupBlocks(lines) {
  if (!lines || lines.length === 0) return [];

  const validLines = lines.filter(Boolean);
  if (validLines.length === 0) return [];

  // Compute body font size (most common font size by character count)
  const bodyFontSize = computeBodyFontSize(validLines);

  const blocks = [];
  let currentBlock = [validLines[0]];

  for (let i = 1; i < validLines.length; i++) {
    const line = validLines[i];
    const prevLine = currentBlock[currentBlock.length - 1];

    const shouldBreak = detectParagraphBreak(prevLine, line, currentBlock, bodyFontSize);

    if (shouldBreak) {
      blocks.push(finalizeBlock(currentBlock, bodyFontSize));
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  blocks.push(finalizeBlock(currentBlock, bodyFontSize));

  return blocks;
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
 * Determine whether two adjacent lines belong to different paragraphs.
 */
function detectParagraphBreak(prevLine, newLine, currentBlock, bodyFontSize) {
  // 1. Zone boundary: never merge across zones
  if (newLine.zone && prevLine.zone && newLine.zone !== prevLine.zone) return true;

  // 2. Page boundary
  if (newLine.pageIndex !== prevLine.pageIndex) return true;

  // 3. Section heading detection
  if (isSectionHeading(newLine)) return true;
  if (isSubsectionHeading(newLine)) return true;

  // 4. Font size change (heading vs body)
  const fontSizeRatio = newLine.fontSize / prevLine.fontSize;
  if (fontSizeRatio > 1.2 || fontSizeRatio < 0.8) return true;

  // 5. First-line indentation: if new line is indented more than continuation
  const indentDiff = newLine.x - prevLine.x;
  const isIndented = indentDiff > 15; // New line starts significantly to the right
  const isDedented = indentDiff < -15; // New line starts significantly to the left

  // If this is the first line of a new paragraph (indented), break
  if (isIndented && currentBlock.length >= 1) {
    // But only if the previous line looks like it ended a paragraph
    // (not if it's just continuation of indented text)
    const prevLineEndsParagraph = prevLine.text && /[.!?;:]$/.test(prevLine.text.trim());
    if (prevLineEndsParagraph || currentBlock.length > 1) return true;
  }

  // If new line is dedented (left margin), likely new paragraph
  if (isDedented && currentBlock.length > 1) return true;

  // 6. Vertical gap: significant gap between lines
  const gap = prevLine.bottomY - newLine.topY; // positive = new line is below
  const avgHeight = (prevLine.height + newLine.height) / 2;

  // If gap is more than 1.3× the line height, it's a paragraph break
  if (gap > avgHeight * 1.3) return true;

  // If there's a negative gap (overlap), keep on same line (shouldn't happen but safety)
  if (gap < -avgHeight * 0.5) return true;

  // 7. Blank line detection: if the previous line is very short and
  //    the gap is larger than normal, treat as blank line separator
  if (prevLine.text && prevLine.text.trim().length < 5 && gap > avgHeight * 0.5) return true;

  // 8. If the new line looks like a list item start
  if (isListItemStart(newLine) && currentBlock.length > 0) return true;

  // 9. Very large vertical jump
  const verticalJump = Math.abs(prevLine.y - newLine.y);
  if (verticalJump > avgHeight * 3) return true;

  return false;
}

/**
 * Detect if a line is a section heading (I., II., III., etc.).
 */
function isSectionHeading(line) {
  const text = (line.text || '').trim();
  // Roman numeral headings: I. INTRODUCTION, II. RELATED WORK, etc.
  if (/^[IVX]+\.\s+[A-Z]/.test(text)) return true;
  // Numbered sections: 1. Introduction, 2. Background, etc.
  if (/^\d+\.\s+[A-Z][a-z]/.test(text)) return true;
  return false;
}

/**
 * Detect if a line is a subsection heading (A., B., C., etc.).
 */
function isSubsectionHeading(line) {
  const text = (line.text || '').trim();
  // Letter subsections: A. Fault tolerance mechanisms, B. Configurations, etc.
  if (/^[A-Z]\.\s+[A-Z]/.test(text)) return true;
  // Numbered subsections: 1.1 User Authentication, 2.1 Data Management, etc.
  if (/^\d+\.\d+\s+[A-Z]/.test(text)) return true;
  return false;
}

/**
 * Detect if a line starts a list item.
 */
function isListItemStart(line) {
  const text = (line.text || '').trim();
  // Bullet points
  if (/^[•●○▪▸►]\s/.test(text)) return true;
  if (/^[-*+]\s/.test(text)) return true;
  // Numbered lists
  if (/^\d+[.)]\s/.test(text)) return true;
  // Lettered lists
  if (/^[a-z][.)]\s/i.test(text)) return true;
  return false;
}

/**
 * Compute aggregate properties for a block from its lines.
 */
function finalizeBlock(blockLines, bodyFontSize) {
  const text = blockLines.map((l) => l.text).join(' ');
  const dominantFontSize = Math.max(...blockLines.map((l) => l.fontSize));

  // Determine alignment
  const alignment = detectBlockAlignment(blockLines);

  // Detect if this might be a heading
  const isHeading = detectHeadingCandidate(blockLines, dominantFontSize, bodyFontSize);

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
    zone: blockLines[0].zone || 'BODY',
    alignment,
    isHeading,
    headingLevel: isHeading ? computeHeadingLevel(dominantFontSize, bodyFontSize) : 0,
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
  const margins = { left: 72, right: pageWidth - 72 };

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
function detectHeadingCandidate(blockLines, fontSize, bodyFontSize) {
  // Check if font size is notably larger than body text
  if (fontSize > bodyFontSize * 1.2) return true;

  // Single line blocks with larger font are likely headings
  if (blockLines.length === 1) {
    const text = blockLines[0].text.trim();

    // Section headings: I. INTRODUCTION, II. RELATED WORK
    if (/^[IVX]+\.\s+[A-Z]/.test(text)) return true;

    // Subsection headings: A. Fault tolerance mechanisms
    if (/^[A-Z]\.\s+[A-Z]/.test(text)) return true;

    // Numbered sections: 1. Introduction
    if (/^\d+\.\s+[A-Z][a-z]/.test(text)) return true;

    // Numbered subsections: 1.1 User Authentication
    if (/^\d+\.\d+\s+[A-Z]/.test(text)) return true;

    // Table/figure captions: TABLE I, Figure 1.
    if (/^(TABLE|Figure|Fig\.|Table)\s+\w+/i.test(text)) return true;
  }

  return false;
}

/**
 * Compute heading level from font size relative to body.
 */
function computeHeadingLevel(fontSize, bodyFontSize) {
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
