import fs from 'fs';
import AdmZip from 'adm-zip';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use dynamic import for pdfjs-dist (ESM)
const pdfjsLib = await import('pdfjs-dist');

const UPLOADS = path.join(__dirname, 'uploads');

async function extractPDFInfo(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const info = {
    pageCount: doc.numPages,
    pages: [],
    allTextItems: [],
    fonts: new Set(),
    fontSizes: new Set(),
    totalChars: 0
  };

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const pageInfo = {
      index: i,
      width: viewport.width,
      height: viewport.height,
      rotation: page.rotate,
      textItems: [],
      fonts: new Set(),
      fontSizes: new Set()
    };

    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      const tx = item.transform;
      const x = tx[4];
      const y = tx[5];
      const width = item.width;
      const height = item.height;

      const fontName = item.fontName || 'unknown';
      const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);

      const isBold = /bold/i.test(fontName);
      const isItalic = /italic|oblique/i.test(fontName);

      const textItem = {
        text: item.str,
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
        fontSize: Math.round(fontSize * 100) / 100,
        fontName,
        isBold,
        isItalic,
        pageNum: i
      };

      pageInfo.textItems.push(textItem);
      info.allTextItems.push(textItem);
      info.fonts.add(fontName);
      info.fontSizes.add(textItem.fontSize);
      pageInfo.fonts.add(fontName);
      pageInfo.fontSizes.add(textItem.fontSize);
      info.totalChars += item.str.length;
    }

    info.pages.push(pageInfo);
  }

  info.fonts = Array.from(info.fonts);
  info.fontSizes = Array.from(info.fontSizes).sort((a, b) => a - b);
  info.pages.forEach(p => {
    p.fonts = Array.from(p.fonts);
    p.fontSizes = Array.from(p.fontSizes).sort((a, b) => a - b);
  });

  return info;
}

function extractDocxInfo(docxPath) {
  const zip = new AdmZip(docxPath);
  const entries = zip.getEntries();

  const info = {
    path: docxPath,
    size: fs.statSync(docxPath).size,
    zipEntries: entries.map(e => e.entryName),
    hasDocumentXml: entries.some(e => e.entryName === 'word/document.xml'),
    hasStylesXml: entries.some(e => e.entryName === 'word/styles.xml'),
    hasSettingsXml: entries.some(e => e.entryName === 'word/settings.xml'),
    hasNumberingXml: entries.some(e => e.entryName === 'word/numbering.xml'),
    hasFootnotesXml: entries.some(e => e.entryName === 'word/footnotes.xml'),
    hasEndnotesXml: entries.some(e => e.entryName === 'word/endnotes.xml'),
    hasHeaderXml: entries.some(e => e.entryName.match(/word\/header\d+\.xml/)),
    hasFooterXml: entries.some(e => e.entryName.match(/word\/footer\d+\.xml/)),
    hasMediaFiles: entries.some(e => e.entryName.match(/word\/media\//)),
    hasThemeXml: entries.some(e => e.entryName === 'word/theme/theme1.xml'),
    documentXmlSize: 0,
    stylesXmlSize: 0,
    fullText: '',
    paragraphs: 0,
    tables: 0,
    runs: 0,
    boldRuns: 0,
    italicRuns: 0,
    boldItalicRuns: 0,
    fonts: new Set(),
    fontSizes: new Set(),
    alignments: new Set(),
    headingStyles: {},
    paragraphStyles: new Set(),
    spacing: [],
    indentation: [],
    images: 0
  };

  const docXmlEntry = zip.getEntry('word/document.xml');
  if (docXmlEntry) {
    const docXml = zip.readAsText('word/document.xml');
    info.documentXmlSize = docXml.length;
    info.documentXml = docXml;

    const pMatches = docXml.match(/<w:p[\s>]/g);
    info.paragraphs = pMatches ? pMatches.length : 0;

    const tblMatches = docXml.match(/<w:tbl[\s>]/g);
    info.tables = tblMatches ? tblMatches.length : 0;

    const rMatches = docXml.match(/<w:r[\s>]/g);
    info.runs = rMatches ? rMatches.length : 0;

    const boldMatches = docXml.match(/<w:b[\s\/]/g);
    info.boldRuns = boldMatches ? boldMatches.length : 0;

    const italicMatches = docXml.match(/<w:i[\s\/]/g);
    info.italicRuns = italicMatches ? italicMatches.length : 0;

    // Both bold and italic
    const biMatches = docXml.match(/<w:b[\s\/].*?<w:i[\s\/]/g);
    info.boldItalicRuns = biMatches ? biMatches.length : 0;

    const fontMatches = docXml.match(/w:ascii="([^"]+)"/g);
    if (fontMatches) {
      fontMatches.forEach(m => {
        const font = m.match(/w:ascii="([^"]+)"/);
        if (font) info.fonts.add(font[1]);
      });
    }

    const hAnsiMatches = docXml.match(/w:hAnsi="([^"]+)"/g);
    if (hAnsiMatches) {
      hAnsiMatches.forEach(m => {
        const font = m.match(/w:hAnsi="([^"]+)"/);
        if (font) info.fonts.add(font[1]);
      });
    }

    const szMatches = docXml.match(/<w:sz w:val="(\d+)"/g);
    if (szMatches) {
      szMatches.forEach(m => {
        const sz = m.match(/w:val="(\d+)"/);
        if (sz) info.fontSizes.add(parseInt(sz[1]) / 2);
      });
    }

    const alignMatches = docXml.match(/<w:jc w:val="([^"]+)"/g);
    if (alignMatches) {
      alignMatches.forEach(m => {
        const align = m.match(/w:val="([^"]+)"/);
        if (align) info.alignments.add(align[1]);
      });
    }

    const pStyleMatches = docXml.match(/<w:pStyle w:val="([^"]+)"/g);
    if (pStyleMatches) {
      pStyleMatches.forEach(m => {
        const style = m.match(/w:val="([^"]+)"/);
        if (style) info.paragraphStyles.add(style[1]);
      });
    }

    const headingStyles = ['Heading1', 'Heading2', 'Heading3', 'Heading4', 'Heading5', 'Heading6'];
    headingStyles.forEach(h => {
      const regex = new RegExp(`w:pStyle w:val="${h}"`, 'g');
      const matches = docXml.match(regex);
      if (matches && matches.length > 0) {
        info.headingStyles[h] = matches.length;
      }
    });

    const textMatches = docXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (textMatches) {
      info.fullText = textMatches.map(m => {
        const t = m.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
        return t ? t[1] : '';
      }).join('\n');
    }

    // Extract spacing values
    const spacingMatches = docXml.match(/<w:spacing[^\/]+/g);
    if (spacingMatches) {
      const spacingSet = new Set();
      spacingMatches.forEach(m => spacingSet.add(m.substring(0, 300)));
      info.spacing = Array.from(spacingSet).slice(0, 20);
    }

    const indentMatches = docXml.match(/<w:ind[^\/]+/g);
    if (indentMatches) {
      const indentSet = new Set();
      indentMatches.forEach(m => indentSet.add(m.substring(0, 300)));
      info.indentation = Array.from(indentSet).slice(0, 20);
    }

    // Extract page margin info from sectPr
    const sectPrMatch = docXml.match(/<w:sectPr[^>]*>([\s\S]*?)<\/w:sectPr>/);
    if (sectPrMatch) {
      info.sectionProps = sectPrMatch[1];
      // Extract page size
      const pgSzMatch = sectPrMatch[1].match(/<w:pgSz[^\/]+/);
      if (pgSzMatch) info.pageSize = pgSzMatch[0];
      const pgMarMatch = sectPrMatch[1].match(/<w:pgMar[^\/]+/);
      if (pgMarMatch) info.pageMargin = pgMarMatch[0];
    }
  }

  const stylesEntry = zip.getEntry('word/styles.xml');
  if (stylesEntry) {
    const stylesXml = zip.readAsText('word/styles.xml');
    info.stylesXmlSize = stylesXml.length;
    info.stylesXml = stylesXml;
  }

  const mediaEntries = entries.filter(e => e.entryName.match(/word\/media\//));
  info.images = mediaEntries.length;
  info.mediaFiles = mediaEntries.map(e => e.entryName);

  info.fonts = Array.from(info.fonts);
  info.fontSizes = Array.from(info.fontSizes).sort((a, b) => a - b);
  info.alignments = Array.from(info.alignments);
  info.paragraphStyles = Array.from(info.paragraphStyles);

  return info;
}

function textDiff(t1, t2) {
  const lines1 = t1.split('\n');
  const lines2 = t2.split('\n');
  const maxLen = Math.max(lines1.length, lines2.length);
  let common = 0;
  let onlyIn1 = 0;
  let onlyIn2 = 0;
  let different = 0;
  const differences = [];

  for (let i = 0; i < maxLen; i++) {
    const l1 = lines1[i] || '';
    const l2 = lines2[i] || '';
    if (l1 === l2) {
      common++;
    } else if (!l1) {
      onlyIn2++;
    } else if (!l2) {
      onlyIn1++;
    } else {
      different++;
      if (differences.length < 30) {
        differences.push({ line: i + 1, pdfnova: l1.substring(0, 150), ilovepdf: l2.substring(0, 150) });
      }
    }
  }

  return { common, onlyIn1, onlyIn2, different, totalLines1: lines1.length, totalLines2: lines2.length, sampleDifferences: differences };
}

// ============================================================
// MAIN
// ============================================================

console.log('='.repeat(80));
console.log('COMPREHENSIVE PDF-TO-WORD CONVERSION COMPARISON');
console.log('='.repeat(80));

// 1. PDF
console.log('\n1. SOURCE PDF ANALYSIS');
console.log('-'.repeat(60));
const pdfInfo = await extractPDFInfo(path.join(UPLOADS, 'source.pdf'));
console.log(`File size: ${fs.statSync(path.join(UPLOADS, 'source.pdf')).size} bytes`);
console.log(`Page count: ${pdfInfo.pageCount}`);
console.log(`Total text items: ${pdfInfo.allTextItems.length}`);
console.log(`Total characters: ${pdfInfo.totalChars}`);
console.log(`Fonts used: ${pdfInfo.fonts.join(', ')}`);
console.log(`Font sizes (pt): ${pdfInfo.fontSizes.join(', ')}`);
console.log(`Bold text items: ${pdfInfo.allTextItems.filter(i => i.isBold).length}`);
console.log(`Italic text items: ${pdfInfo.allTextItems.filter(i => i.isItalic).length}`);
console.log(`\nPage details:`);
pdfInfo.pages.forEach(p => {
  console.log(`  Page ${p.index}: ${p.width} x ${p.height} pt, rotation: ${p.rotation}°`);
  console.log(`    Text items: ${p.textItems.length}, Fonts: ${p.fonts.join(', ')}, Sizes: ${p.fontSizes.join(', ')}`);
});

// 2. PDFNova DOCX
console.log('\n2. PDFNova DOCX OUTPUT');
console.log('-'.repeat(60));
const pn = extractDocxInfo(path.join(UPLOADS, 'pdfnova-output.docx'));
console.log(`File size: ${pn.size} bytes`);
console.log(`ZIP entries: ${pn.zipEntries.length}`);
console.log(`document.xml size: ${pn.documentXmlSize} chars`);
console.log(`styles.xml size: ${pn.stylesXmlSize} chars`);
console.log(`Paragraphs: ${pn.paragraphs}`);
console.log(`Tables: ${pn.tables}`);
console.log(`Runs: ${pn.runs}`);
console.log(`Bold runs: ${pn.boldRuns}`);
console.log(`Italic runs: ${pn.italicRuns}`);
console.log(`Bold+Italic runs: ${pn.boldItalicRuns}`);
console.log(`Images: ${pn.images}`);
console.log(`Fonts: ${pn.fonts.join(', ')}`);
console.log(`Font sizes (half-pt): ${pn.fontSizes.join(', ')}`);
console.log(`Alignments: ${pn.alignments.join(', ')}`);
console.log(`Paragraph styles: ${pn.paragraphStyles.join(', ')}`);
console.log(`Heading styles: ${JSON.stringify(pn.headingStyles)}`);
console.log(`Page size: ${pn.pageSize}`);
console.log(`Page margin: ${pn.pageMargin}`);
console.log(`Section props present: ${!!pn.sectionProps}`);
console.log(`Has styles.xml: ${pn.hasStylesXml}`);
console.log(`Has settings.xml: ${pn.hasSettingsXml}`);
console.log(`Has numbering.xml: ${pn.hasNumberingXml}`);
console.log(`Has header/footer: ${pn.hasHeaderXml}/${pn.hasFooterXml}`);
console.log(`Has theme.xml: ${pn.hasThemeXml}`);
console.log(`Has media: ${pn.hasMediaFiles}`);
console.log(`Full text length: ${pn.fullText.length} chars`);
console.log(`ZIP files: ${pn.zipEntries.join(', ')}`);

// 3. iLovePDF DOCX
console.log('\n3. iLovePDF DOCX REFERENCE');
console.log('-'.repeat(60));
const il = extractDocxInfo(path.join(UPLOADS, 'ilovepdf-reference.docx'));
console.log(`File size: ${il.size} bytes`);
console.log(`ZIP entries: ${il.zipEntries.length}`);
console.log(`document.xml size: ${il.documentXmlSize} chars`);
console.log(`styles.xml size: ${il.stylesXmlSize} chars`);
console.log(`Paragraphs: ${il.paragraphs}`);
console.log(`Tables: ${il.tables}`);
console.log(`Runs: ${il.runs}`);
console.log(`Bold runs: ${il.boldRuns}`);
console.log(`Italic runs: ${il.italicRuns}`);
console.log(`Bold+Italic runs: ${il.boldItalicRuns}`);
console.log(`Images: ${il.images}`);
console.log(`Media files: ${il.mediaFiles.join(', ')}`);
console.log(`Fonts: ${il.fonts.join(', ')}`);
console.log(`Font sizes (half-pt): ${il.fontSizes.join(', ')}`);
console.log(`Alignments: ${il.alignments.join(', ')}`);
console.log(`Paragraph styles: ${il.paragraphStyles.join(', ')}`);
console.log(`Heading styles: ${JSON.stringify(il.headingStyles)}`);
console.log(`Page size: ${il.pageSize}`);
console.log(`Page margin: ${il.pageMargin}`);
console.log(`Section props present: ${!!il.sectionProps}`);
console.log(`Has styles.xml: ${il.hasStylesXml}`);
console.log(`Has settings.xml: ${il.hasSettingsXml}`);
console.log(`Has numbering.xml: ${il.hasNumberingXml}`);
console.log(`Has header/footer: ${il.hasHeaderXml}/${il.hasFooterXml}`);
console.log(`Has theme.xml: ${il.hasThemeXml}`);
console.log(`Has media: ${il.hasMediaFiles}`);
console.log(`Full text length: ${il.fullText.length} chars`);
console.log(`ZIP files: ${il.zipEntries.join(', ')}`);

// 4. Side-by-side comparison
console.log('\n4. SIDE-BY-SIDE COMPARISON');
console.log('-'.repeat(60));
const compare = (label, a, b) => {
  const eq = JSON.stringify(a) === JSON.stringify(b) ? '==' : '!=';
  console.log(`  ${label}: PDFNova=${JSON.stringify(a)} ${eq} iLovePDF=${JSON.stringify(b)}`);
};
compare('File size (bytes)', pn.size, il.size);
compare('ZIP entries', pn.zipEntries.length, il.zipEntries.length);
compare('document.xml size', pn.documentXmlSize, il.documentXmlSize);
compare('styles.xml size', pn.stylesXmlSize, il.stylesXmlSize);
compare('Paragraphs', pn.paragraphs, il.paragraphs);
compare('Tables', pn.tables, il.tables);
compare('Runs', pn.runs, il.runs);
compare('Bold runs', pn.boldRuns, il.boldRuns);
compare('Italic runs', pn.italicRuns, il.italicRuns);
compare('Images', pn.images, il.images);
compare('Fonts', pn.fonts, il.fonts);
compare('Font sizes', pn.fontSizes, il.fontSizes);
compare('Alignments', pn.alignments, il.alignments);
compare('Paragraph styles', pn.paragraphStyles, il.paragraphStyles);
compare('Heading styles', pn.headingStyles, il.headingStyles);
compare('Page size', pn.pageSize, il.pageSize);
compare('Page margin', pn.pageMargin, il.pageMargin);
compare('Has styles.xml', pn.hasStylesXml, il.hasStylesXml);
compare('Has numbering.xml', pn.hasNumberingXml, il.hasNumberingXml);
compare('Has header', pn.hasHeaderXml, il.hasHeaderXml);
compare('Has footer', pn.hasFooterXml, il.hasFooterXml);
compare('Has theme.xml', pn.hasThemeXml, il.hasThemeXml);
compare('Has media', pn.hasMediaFiles, il.hasMediaFiles);

// 5. ZIP structure diff
console.log('\n5. ZIP FILE STRUCTURE DIFFERENCES');
console.log('-'.repeat(60));
const onlyInP = pn.zipEntries.filter(e => !il.zipEntries.includes(e));
const onlyInI = il.zipEntries.filter(e => !pn.zipEntries.includes(e));
console.log(`Files only in PDFNova (${onlyInP.length}): ${onlyInP.join(', ')}`);
console.log(`Files only in iLovePDF (${onlyInI.length}): ${onlyInI.join(', ')}`);
const common = pn.zipEntries.filter(e => il.zipEntries.includes(e));
console.log(`Common files (${common.length}): ${common.join(', ')}`);

// 6. Text content comparison
console.log('\n6. TEXT CONTENT COMPARISON');
console.log('-'.repeat(60));
const td = textDiff(pn.fullText, il.fullText);
console.log(`PDFNova total lines: ${td.totalLines1}`);
console.log(`iLovePDF total lines: ${td.totalLines2}`);
console.log(`Common lines: ${td.common}`);
console.log(`Lines only in PDFNova: ${td.onlyIn1}`);
console.log(`Lines only in iLovePDF: ${td.onlyIn2}`);
console.log(`Different lines: ${td.different}`);
console.log(`\nFirst 30 differences:`);
td.sampleDifferences.forEach(d => {
  console.log(`  Line ${d.line}:`);
  console.log(`    PN:  "${d.pdfnova}"`);
  console.log(`    IL:  "${d.ilovepdf}"`);
});

// 7. Spacing analysis
console.log('\n7. SPACING AND INDENTATION ANALYSIS');
console.log('-'.repeat(60));
console.log(`PDFNova spacing samples (${pn.spacing.length} unique):`);
pn.spacing.slice(0, 8).forEach(s => console.log(`  ${s}`));
console.log(`iLovePDF spacing samples (${il.spacing.length} unique):`);
il.spacing.slice(0, 8).forEach(s => console.log(`  ${s}`));
console.log(`PDFNova indentation samples (${pn.indentation.length} unique):`);
pn.indentation.slice(0, 8).forEach(s => console.log(`  ${s}`));
console.log(`iLovePDF indentation samples (${il.indentation.length} unique):`);
il.indentation.slice(0, 8).forEach(s => console.log(`  ${s}`));

// 8. PDF text item details
console.log('\n8. PDF TEXT ITEM DETAILS (page by page)');
console.log('-'.repeat(60));
for (const page of pdfInfo.pages) {
  console.log(`\n--- Page ${page.index} (${page.width}x${page.height} pt, rotation: ${page.rotation}°) ---`);
  const lines = {};
  page.textItems.forEach(item => {
    const yKey = Math.round(item.y / 2) * 2;
    if (!lines[yKey]) lines[yKey] = [];
    lines[yKey].push(item);
  });

  const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
  sortedY.forEach((y, idx) => {
    const items = lines[y].sort((a, b) => a.x - b.x);
    const text = items.map(i => i.text).join(' ');
    const fonts = items.map(i => `${i.fontSize}pt/${i.fontName}/${i.isBold ? 'B' : ''}${i.isItalic ? 'I' : ''}`).join('; ');
    if (idx < 50) {
      console.log(`  y=${y}: "${text.substring(0, 120)}"`);
      console.log(`         Fonts: ${fonts}`);
    }
  });
  if (sortedY.length > 50) {
    console.log(`  ... ${sortedY.length - 50} more lines`);
  }
}

// 9. Full text samples
console.log('\n9. FULL TEXT SAMPLES');
console.log('-'.repeat(60));
console.log('\n--- PDFNova text (first 3000 chars) ---');
console.log(pn.fullText.substring(0, 3000));
console.log('\n--- iLovePDF text (first 3000 chars) ---');
console.log(il.fullText.substring(0, 3000));

// Save XML for manual inspection
fs.writeFileSync(path.join(UPLOADS, 'compare-pnova-doc.xml'), pn.documentXml || '');
fs.writeFileSync(path.join(UPLOADS, 'compare-ilove-doc.xml'), il.documentXml || '');
fs.writeFileSync(path.join(UPLOADS, 'compare-pnova-styles.xml'), pn.stylesXml || '');
fs.writeFileSync(path.join(UPLOADS, 'compare-ilove-styles.xml'), il.stylesXml || '');

console.log('\n10. SAVED FILES');
console.log('-'.repeat(60));
console.log('Saved: compare-pnova-doc.xml, compare-ilove-doc.xml');
console.log('Saved: compare-pnova-styles.xml, compare-ilove-styles.xml');

console.log('\n' + '='.repeat(80));
console.log('ANALYSIS COMPLETE');
console.log('='.repeat(80));
