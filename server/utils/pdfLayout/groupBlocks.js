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
 *   8. List item patterns
 *
 * Also detects bold/italic using contextual heuristics since PDF fonts
 * are often obfuscated and don't expose style info.
 *
 * @param {object[]} lines – output of groupLines (already filtered of nulls)
 * @returns {object[]} blocks – array of { lines, text, type, alignment, fontSize, ... }
 */
function groupBlocks(lines) {
  if (!lines || lines.length === 0) return [];

  const validLines = lines.filter(Boolean);
  if (validLines.length === 0) return [];

  const bodyFontSize = computeBodyFontSize(validLines);
  const pageMargins = detectPageMargins(validLines);

  const blocks = [];
  let currentBlock = [validLines[0]];

  for (let i = 1; i < validLines.length; i++) {
    const line = validLines[i];
    const prevLine = currentBlock[currentBlock.length - 1];

    const shouldBreak = detectParagraphBreak(prevLine, line, currentBlock, bodyFontSize);

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
 * Returns the most common left/right edges across all lines.
 */
function detectPageMargins(lines) {
  if (lines.length === 0) return { left: 72, right: 540 };

  const leftEdges = lines.map((l) => l.x).sort((a, b) => a - b);
  const rightEdges = lines.map((l) => l.rightX).sort((a, b) => b - a);

  // Use the 10th percentile for left margin and 90th for right margin
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
function detectParagraphBreak(prevLine, newLine, currentBlock, bodyFontSize) {
  // 1. Zone boundary: never merge across zones
  if (newLine.zone && prevLine.zone && newLine.zone !== prevLine.zone) return true;

  // 2. Page boundary
  if (newLine.pageIndex !== prevLine.pageIndex) return true;

  // 3. Title lines: merge consecutive centered large-font lines (title may wrap)
  if (isTitleLikeLine(prevLine, bodyFontSize) && isTitleLikeLine(newLine, bodyFontSize)) {
    return false;
  }

  // 4. Section heading detection
  if (isSectionHeading(newLine)) return true;
  if (isSubsectionHeading(newLine)) return true;

  // 4. Font size change (heading vs body)
  const fontSizeRatio = newLine.fontSize / prevLine.fontSize;
  if (fontSizeRatio > 1.2 || fontSizeRatio < 0.8) return true;

  // 5. First-line indentation
  const indentDiff = newLine.x - prevLine.x;
  const isIndented = indentDiff > 15;
  const isDedented = indentDiff < -15;

  if (isIndented && currentBlock.length >= 1) {
    const prevLineEndsParagraph = prevLine.text && /[.!?;:]$/.test(prevLine.text.trim());
    if (prevLineEndsParagraph || currentBlock.length > 1) return true;
  }

  if (isDedented && currentBlock.length > 1) return true;

  // 6. Vertical gap
  const gap = prevLine.bottomY - newLine.topY;
  const avgHeight = (prevLine.height + newLine.height) / 2;

  if (gap > avgHeight * 1.3) return true;
  if (gap < -avgHeight * 0.5) return true;

  // 7. Blank line detection
  if (prevLine.text && prevLine.text.trim().length < 5 && gap > avgHeight * 0.5) return true;

  // 8. List item starts
  if (isListItemStart(newLine) && currentBlock.length > 0) return true;

  // 9. Very large vertical jump
  const verticalJump = Math.abs(prevLine.y - newLine.y);
  if (verticalJump > avgHeight * 3) return true;

  // 10. Different font name (different font variant = different style)
  // Only break if the font change is significant (not just spacing/symbol variants)
  if (newLine.fontName !== prevLine.fontName && currentBlock.length > 0) {
    // Don't break within TITLE zone (title can span multiple lines with same font)
    const zone = newLine.zone || prevLine.zone || 'BODY';
    if (zone === 'TITLE' || zone === 'AUTHOR' || zone === 'ABSTRACT' || zone === 'INDEX_TERMS') {
      return false;
    }
    // Don't break for single-character font changes (likely symbols/punctuation)
    if (newLine.text.trim().length > 3 && prevLine.text.trim().length > 3) {
      // Only break if the font sizes are the same (same style, different variant)
      if (Math.abs(newLine.fontSize - prevLine.fontSize) < 0.5) {
        return true;
      }
    }
  }

  return false;
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
  if (/^[•●○▪▸►]\s/.test(text)) return true;
  if (/^[-*+]\s/.test(text)) return true;
  if (/^\d+[.)]\s/.test(text)) return true;
  if (/^[a-z][.)]\s/i.test(text)) return true;
  return false;
}

/**
 * Detect if a line is title-like (centered, large font).
 * Used to merge multi-line titles into a single block.
 */
function isTitleLikeLine(line, bodyFontSize) {
  if (!line) return false;
  const text = (line.text || '').trim();
  if (text.length < 5) return false;
  if (line.fontSize < bodyFontSize * 1.2) return false;

  const centerX = line.x + (line.width || 0) / 2;
  const pageWidth = line.pageWidth || 612;
  if (Math.abs(centerX - pageWidth / 2) > pageWidth * 0.15) return false;

  // Exclude header/footer-like patterns
  const nonTitlePatterns = ['ISSN', 'www.', 'http', 'Volume', 'Issue', '©'];
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

  let avgLineSpacing = 0;
  if (blockLines.length > 1) {
    let totalSpacing = 0;
    for (let i = 1; i < blockLines.length; i++) {
      totalSpacing += blockLines[i - 1].bottomY - blockLines[i].topY;
    }
    avgLineSpacing = totalSpacing / (blockLines.length - 1);
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
    pageWidth: blockLines[0].pageWidth,
    pageHeight: blockLines[0].pageHeight,
    pageIndex: blockLines[0].pageIndex,
    topY: blockLines[0].topY,
    bottomY: blockLines[blockLines.length - 1].bottomY,
    lineCount: blockLines.length,
    avgLineSpacing,
    bold,
    italic,
  };
}

/**
 * Detect alignment of a block based on line positions.
 * Uses actual page margins instead of hardcoded values.
 *
 * Priority order:
 *   1. Justified – lines extend close to both left and right margins
 *   2. Centered – narrow text centered on page (title, author block)
 *   3. Right-aligned
 *   4. Left-aligned (default)
 *
 * Justified must be checked BEFORE centered because wide body text
 * spanning both margins always has its centerX near page center.
 */
function detectBlockAlignment(blockLines, pageMargins) {
  if (blockLines.length === 0) return 'left';

  const pageWidth = blockLines[0].pageWidth;
  const leftMargin = pageMargins.left;
  const rightMargin = pageMargins.right;
  const contentWidth = rightMargin - leftMargin;

  // 1. Check for justified text FIRST (lines extend close to both margins)
  //    Use relaxed matching: line left edge within 35pt of left margin AND
  //    line right edge within 35pt of right margin
  const justifiedCount = blockLines.filter((line) => {
    const nearLeft = line.x <= leftMargin + 35;
    const nearRight = line.rightX >= rightMargin - 35;
    return nearLeft && nearRight;
  }).length;

  // For multi-line blocks, if most lines span both margins, it's justified
  if (blockLines.length > 1 && justifiedCount >= blockLines.length * 0.4) return 'justified';

  // For single-line blocks, check if it spans most of the content width
  if (blockLines.length === 1) {
    const line = blockLines[0];
    const lineWidth = line.rightX - line.x;
    if (lineWidth > contentWidth * 0.7) return 'justified';
  }

  // 2. Check if lines are centered (narrow text centered on page)
  //    Must check that text is NOT wide (otherwise it's justified, not centered)
  const centeredCount = blockLines.filter((line) => {
    const centerX = line.x + line.width / 2;
    const isNearCenter = Math.abs(centerX - pageWidth / 2) < pageWidth * 0.1;
    const isNarrow = line.width < contentWidth * 0.65;
    return isNearCenter && isNarrow;
  }).length;

  if (centeredCount >= blockLines.length * 0.7) return 'center';

  // 3. Check if lines are right-aligned (rare, mostly for specific elements)
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
  if (fontSize > bodyFontSize * 1.2) return true;

  if (blockLines.length === 1) {
    const text = blockLines[0].text.trim();
    if (/^[IVX]+\.\s+[A-Z]/.test(text)) return true;
    if (/^[A-Z]\.\s+[A-Z]/.test(text)) return true;
    if (/^\d+\.\s+[A-Z][a-z]/.test(text)) return true;
    if (/^\d+\.\d+\s+[A-Z]/.test(text)) return true;
    if (/^(TABLE|Figure|Fig\.|Table)\s+\w+/i.test(text)) return true;
    // Do NOT treat "Abstract" or "Index Terms" as headings - they are
    // styled as italic text in academic papers, not as heading elements
  }

  return false;
}

/**
 * Compute heading level from font size relative to body.
 * Also uses pattern-based detection for same-size headings.
 */
function computeHeadingLevel(fontSize, bodyFontSize, text) {
  // Pattern-based detection takes priority over font-size ratios
  if (text) {
    const trimmed = text.trim();
    // Section headings: I. INTRODUCTION, II. RELATED WORK, III. METHODOLOGY
    if (/^[IVX]+\.\s+[A-Z]/.test(trimmed)) return 1;
    // Subsection headings: A. Fault tolerance mechanisms, B. Experimental
    if (/^[A-Z]\.\s+[A-Z]/.test(trimmed)) return 2;
    // Numbered subsections: 1.1 User Authentication, 2.3 Results
    if (/^\d+\.\d+\s+[A-Z]/.test(trimmed)) return 3;
  }

  // Font-size-based fallback
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
 * Detect bold using font metadata from items.
 * Checks the actual font descriptor weight for each item.
 */
function detectBlockBold(blockLines, bodyFontSize) {
  // Check if any item in the block has a bold font (from font descriptor)
  const hasBoldFont = blockLines.some((l) => {
    // Check items for fontBold property (set from PDF font descriptor)
    if (l.items) {
      return l.items.some((item) => item.fontBold);
    }
    // Fallback: check font name for bold indicators
    const fn = (l.fontName || '').toLowerCase();
    return fn.includes('bold') || fn.includes('black') || fn.includes('heavy');
  });
  return hasBoldFont;
}

/**
 * Detect italic using font metadata from items.
 * Checks the actual font descriptor italic angle for each item.
 */
function detectBlockItalic(blockLines) {
  // Check if any item in the block has an italic font (from font descriptor)
  const hasItalicFont = blockLines.some((l) => {
    // Check items for fontItalic property (set from PDF font descriptor)
    if (l.items) {
      return l.items.some((item) => item.fontItalic);
    }
    // Fallback: check font name for italic indicators
    const fn = (l.fontName || '').toLowerCase();
    return fn.includes('italic') || fn.includes('oblique');
  });
  return hasItalicFont;
}

module.exports = { groupBlocks };
