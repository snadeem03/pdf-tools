/**
 * Document zone classification for PDF content.
 *
 * Classifies extracted content into zones:
 *   HEADER    – repeated content near top of pages
 *   TITLE     – prominent centered text on page 1
 *   SUBTITLE  – text directly below title (smaller font)
 *   AUTHOR    – author names, affiliations, emails
 *   ABSTRACT  – "Abstract" / "Abstract—" content
 *   INDEX_TERMS – "Index Terms" / "Index Terms—" content
 *   BODY      – main document content
 *   FOOTER    – repeated content near bottom of pages
 *
 * Works on lines (after line grouping) and propagates zone info
 * to items and blocks.
 */

function classifyZones(pages) {
  if (!pages || pages.length === 0) return;

  const headerFooter = detectHeaderFooter(pages);

  for (const page of pages) {
    classifyPageZones(page, headerFooter);
  }
}

function detectHeaderFooter(pages) {
  if (pages.length < 2) return { headers: [], footers: [] };

  const headerCandidates = [];
  const footerCandidates = [];

  for (const page of pages) {
    if (!page.lines) continue;
    const topThreshold = page.height * 0.9;
    const bottomThreshold = page.height * 0.1;

    for (const line of page.lines) {
      if (!line.text || line.text.trim().length === 0) continue;
      if (line.y >= topThreshold) {
        headerCandidates.push({ text: line.text.trim(), pageIndex: page.pageIndex, y: line.y, x: line.x, fontSize: line.fontSize, fontName: line.fontName });
      }
      if (line.y <= bottomThreshold) {
        footerCandidates.push({ text: line.text.trim(), pageIndex: page.pageIndex, y: line.y, x: line.x, fontSize: line.fontSize, fontName: line.fontName });
      }
    }
  }

  return { headers: findRepeatedContent(headerCandidates), footers: findRepeatedContent(footerCandidates) };
}

function findRepeatedContent(candidates) {
  if (candidates.length === 0) return [];

  const textGroups = {};
  for (const c of candidates) {
    const normalized = c.text.replace(/\s+/g, ' ').replace(/\s+\d+\s*$/, '').trim();
    if (!textGroups[normalized]) textGroups[normalized] = [];
    textGroups[normalized].push(c);
  }

  const repeated = [];
  for (const [text, occurrences] of Object.entries(textGroups)) {
    const uniquePages = new Set(occurrences.map((o) => o.pageIndex));
    if (uniquePages.size >= 2) {
      repeated.push({
        text,
        pattern: text,
        avgY: occurrences.reduce((s, o) => s + o.y, 0) / occurrences.length,
        avgX: occurrences.reduce((s, o) => s + o.x, 0) / occurrences.length,
        avgFontSize: occurrences.reduce((s, o) => s + o.fontSize, 0) / occurrences.length,
        fontName: occurrences[0].fontName,
        pageCount: uniquePages.size,
        pages: [...uniquePages],
      });
    }
  }

  return repeated;
}

/**
 * Classify zones for a single page.
 *
 * Strategy: Find anchor points first (abstract heading, index terms heading),
 * then classify regions between them.
 */
function classifyPageZones(page, headerFooter) {
  const { headers, footers } = headerFooter;
  const isPage1 = page.pageIndex === 0;

  if (!page.lines) return;

  const headerRegion = headers.length > 0 ? Math.min(...headers.map((h) => h.avgY)) - 20 : page.height;
  const footerRegion = footers.length > 0 ? Math.max(...footers.map((f) => f.avgY)) + 20 : 0;

  const sortedLines = [...page.lines].sort((a, b) => b.y - a.y);

  // Phase 1: Mark headers and footers
  for (const line of sortedLines) {
    const text = (line.text || '').trim();
    if (text.length === 0) { line.zone = 'EMPTY'; continue; }

    if (line.y >= headerRegion && isHeaderText(text, headers)) {
      line.zone = 'HEADER';
      continue;
    }
    if (line.y <= footerRegion && isFooterText(text, footers)) {
      line.zone = 'FOOTER';
      continue;
    }
  }

  if (!isPage1) {
    // Pages 2+: everything non-header/footer is BODY
    for (const line of sortedLines) {
      if (!line.zone) line.zone = 'BODY';
    }
    propagateZones(page, sortedLines);
    return;
  }

  // Page 1: Find anchor points
  let abstractLine = null;
  let indexTermsLine = null;

  for (const line of sortedLines) {
    if (line.zone) continue; // Already classified as header/footer
    const text = (line.text || '').trim();

    if (abstractLine === null && detectAbstractStart(text)) {
      abstractLine = line;
      continue;
    }
    if (indexTermsLine === null && detectIndexTermsStart(text)) {
      indexTermsLine = line;
      continue;
    }
  }

  // Define Y boundaries for zones
  const abstractY = abstractLine ? abstractLine.y : -Infinity;
  const indexTermsY = indexTermsLine ? indexTermsLine.y : -Infinity;

  // Find title: prominent centered text above abstract
  let titleLines = [];
  let titleBottom = null;

  for (const line of sortedLines) {
    if (line.zone) continue;
    const text = (line.text || '').trim();
    if (text.length === 0) continue;

    // Must be above abstract
    if (abstractLine && line.y <= abstractY) break;

    // Title must be centered and have large font
    if (detectTitleLine(line, page)) {
      titleLines.push(line);
      titleBottom = line.y;
    } else if (titleLines.length > 0) {
      // Once we stop finding title lines, stop looking
      break;
    }
  }

  // Mark title lines
  for (const line of titleLines) {
    line.zone = 'TITLE';
  }

  // Find author/affiliation block: centered text between title bottom and abstract
  let authorLines = [];
  const authorSearchStart = titleBottom !== null ? titleBottom : (abstractLine ? abstractY + 50 : page.height * 0.7);

  for (const line of sortedLines) {
    if (line.zone) continue;
    const text = (line.text || '').trim();
    if (text.length === 0) continue;

    // Must be between title and abstract
    if (abstractLine && line.y <= abstractY) break;
    if (line.y > authorSearchStart) continue;

    // Author lines are centered and contain author-like content
    if (isCenteredOrNearCenter(line, page) && isAuthorLikeContent(text)) {
      authorLines.push(line);
    }
  }

  // Mark author lines
  for (const line of authorLines) {
    line.zone = 'AUTHOR';
  }

  // Mark abstract content
  if (abstractLine) {
    abstractLine.zone = 'ABSTRACT';
    for (const line of sortedLines) {
      if (line.zone) continue;
      if (line.y <= abstractY && (indexTermsLine ? line.y > indexTermsY : line.y > footerRegion)) {
        line.zone = 'ABSTRACT';
      }
    }
  }

  // Mark index terms content
  if (indexTermsLine) {
    indexTermsLine.zone = 'INDEX_TERMS';
    for (const line of sortedLines) {
      if (line.zone) continue;
      if (line.y <= indexTermsY && line.y > footerRegion) {
        // Stop at section headings
        const text = (line.text || '').trim();
        if (/^[IVX]+\.\s+[A-Z]/.test(text)) break;
        line.zone = 'INDEX_TERMS';
      }
    }
  }

  // Everything else on page 1 between title and footer is BODY
  for (const line of sortedLines) {
    if (!line.zone && line.y > footerRegion) {
      line.zone = 'BODY';
    }
  }

  propagateZones(page, sortedLines);
}

function propagateZones(page, sortedLines) {
  if (page.items) {
    for (const item of page.items) {
      const parentLine = sortedLines.find((line) => Math.abs(item.y - line.y) < line.fontSize * 0.5);
      item.zone = parentLine ? parentLine.zone : 'BODY';
    }
  }

  if (page.blocks) {
    for (const block of page.blocks) {
      block.zone = (block.lines && block.lines.length > 0) ? (block.lines[0].zone || 'BODY') : 'BODY';
    }
  }
}

function isHeaderText(text, headers) {
  return headers.some((h) => {
    const normalized = text.replace(/\s+/g, ' ');
    return normalized.includes(h.pattern) || h.pattern.includes(normalized);
  });
}

function isFooterText(text, footers) {
  return footers.some((f) => {
    const normalized = text.replace(/\s+/g, ' ');
    return normalized.includes(f.pattern) || f.pattern.includes(normalized);
  });
}

function detectTitleLine(line, page) {
  const text = (line.text || '').trim();
  if (text.length < 5) return false;
  if (line.fontSize < 14) return false;

  const centerX = line.x + (line.width || 0) / 2;
  const pageCenterX = page.width / 2;
  if (Math.abs(centerX - pageCenterX) > page.width * 0.15) return false;

  const nonTitlePatterns = ['ISSN', 'www.', 'http', 'Volume', 'Issue', '©'];
  if (nonTitlePatterns.some((p) => text.includes(p))) return false;

  return true;
}

function isCenteredOrNearCenter(line, page) {
  const centerX = line.x + (line.width || 0) / 2;
  const pageCenterX = page.width / 2;
  return Math.abs(centerX - pageCenterX) <= page.width * 0.2;
}

function isAuthorLikeContent(text) {
  const patterns = [
    /department/i, /university/i, /college/i, /institute/i,
    /school/i, /faculty/i, /student/i, /professor/i,
    /@.*\.(edu|com|org|net)/i,
    /^\d+[A-Z][a-z]+/, // "1Tanishq"
    /^\d+,\s*\d+/, // "1, 2, 3"
    /^[A-Z][a-z]+ [A-Z][a-z]+/, // "FirstName LastName"
  ];
  return patterns.some((p) => p.test(text));
}

function detectAbstractStart(text) {
  if (!text) return false;
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return normalized === 'abstract' || normalized.startsWith('abstract—') || normalized.startsWith('abstract:');
}

function detectIndexTermsStart(text) {
  if (!text) return false;
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return normalized.startsWith('index terms') || normalized.startsWith('keywords') || normalized.startsWith('key words');
}

module.exports = { classifyZones };
