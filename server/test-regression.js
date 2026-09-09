/**
 * PDF-to-Word conversion regression test suite.
 *
 * Compares PDFNova output against iLovePDF reference output
 * and the source PDF to measure conversion quality.
 *
 * Usage:
 *   node test-regression.js
 */

const fs = require('fs');
const path = require('path');
const { convertPdfToDocx } = require('./utils/pdfLayout/index');

const SOURCE_PDF = path.join(__dirname, 'uploads', 'source.pdf');
const PDFNOVA_OUT = path.join(__dirname, 'uploads', 'pdfnova-output.docx');
const ILOVEPDF_REF = path.join(__dirname, 'uploads', 'ilovepdf-reference.docx');
const PDFNOVA_GEN = path.join(__dirname, 'uploads', 'regression-test.docx');

let AdmZip;
try {
  AdmZip = require('adm-zip');
} catch {
  console.error('Run: npm install adm-zip --no-save');
  process.exit(1);
}

function extractDocxStructure(docxPath) {
  const zip = new AdmZip(docxPath);
  const docXml = zip.readAsText('word/document.xml');
  const stylesXml = zip.getEntry('word/styles.xml') ? zip.readAsText('word/styles.xml') : '';

  const result = {
    paragraphs: 0,
    tables: 0,
    tableRows: 0,
    tableCells: 0,
    runs: 0,
    textRuns: 0,
    boldRuns: 0,
    italicRuns: 0,
    underlineRuns: 0,
    superscriptRuns: 0,
    heading1: 0,
    heading2: 0,
    heading3: 0,
    heading4: 0,
    titleStyle: 0,
    alignments: {},
    fonts: {},
    fontSizes: {},
    indents: {},
    spacings: {},
    images: 0,
    hyperlinks: 0,
    hasJustified: false,
    pageWidth: 0,
    pageHeight: 0,
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    totalTextLength: 0,
    listParagraphs: 0,
  };

  // Count paragraphs (w:p elements that are direct children of w:body)
  const pMatches = docXml.match(/<w:p[\s>]/g);
  result.paragraphs = pMatches ? pMatches.length : 0;

  // Count tables
  const tMatches = docXml.match(/<w:tbl[\s>]/g);
  result.tables = tMatches ? tMatches.length : 0;

  // Count table rows and cells
  const trMatches = docXml.match(/<w:tr[\s>]/g);
  result.tableRows = trMatches ? trMatches.length : 0;
  const tcMatches = docXml.match(/<w:tc[\s>]/g);
  result.tableCells = tcMatches ? tcMatches.length : 0;

  // Count runs
  const rMatches = docXml.match(/<w:r[\s>]/g);
  result.runs = rMatches ? rMatches.length : 0;

  // Count text runs with content
  const tMatches2 = docXml.match(/<w:t[\s>][^>]*>[^<]+/g);
  result.textRuns = tMatches2 ? tMatches2.length : 0;

  // Extract total text length
  const textContent = docXml.replace(/<[^>]+>/g, '');
  result.totalTextLength = textContent.length;

  // Bold runs (explicitly true only, not w:val="false")
  const boldExplicit = (docXml.match(/<w:b\/>/g) || []).length;
  const boldTrue = (docXml.match(/<w:b w:val="true"\/>/g) || []).length;
  result.boldRuns = boldExplicit + boldTrue;

  // Italic runs (explicitly true only)
  const italicExplicit = (docXml.match(/<w:i\/>/g) || []).length;
  const italicTrue = (docXml.match(/<w:i w:val="true"\/>/g) || []).length;
  result.italicRuns = italicExplicit + italicTrue;

  // Underline runs
  const underlineMatches = docXml.match(/<w:u[\s/>]/g);
  result.underlineRuns = underlineMatches ? underlineMatches.length : 0;

  // Superscript
  const supMatches = docXml.match(/<w:vertAlign w:val="superscript"\/>/g);
  result.superscriptRuns = supMatches ? supMatches.length : 0;

  // Headings
  result.heading1 = (docXml.match(/<w:pStyle w:val="Heading1"\/>/g) || []).length;
  result.heading2 = (docXml.match(/<w:pStyle w:val="Heading2"\/>/g) || []).length;
  result.heading3 = (docXml.match(/<w:pStyle w:val="Heading3"\/>/g) || []).length;
  result.heading4 = (docXml.match(/<w:pStyle w:val="Heading4"\/>/g) || []).length;
  result.titleStyle = (docXml.match(/<w:pStyle w:val="Title"\/>/g) || []).length;
  result.listParagraphs = (docXml.match(/<w:pStyle w:val="ListParagraph"\/>/g) || []).length;

  // Alignment
  const alignMatches = docXml.match(/<w:jc w:val="([^"]+)"/g) || [];
  for (const m of alignMatches) {
    const val = m.match(/w:val="([^"]+)"/)[1];
    result.alignments[val] = (result.alignments[val] || 0) + 1;
  }
  result.hasJustified = !!result.alignments['both'];

  // Images
  const imgMatches = docXml.match(/<a:blip[\s>]/g) || [];
  const pictMatches = docXml.match(/<w:pict[\s>]/g) || [];
  result.images = imgMatches.length + pictMatches.length;

  // Check for images in zip
  const entries = zip.getEntries();
  result.imageFiles = entries.filter(e => e.entryName.match(/\.(jpeg|jpg|png|gif|bmp|emf|wmf)$/i)).map(e => e.entryName);

  // Hyperlinks
  const hlMatches = docXml.match(/<w:hyperlink[\s>]/g) || [];
  result.hyperlinks = hlMatches.length;

  // Page dimensions from sectPr
  const sectPrMatch = docXml.match(/<w:pgSz[^/]+w:w="(\d+)"[^/]+w:h="(\d+)"/);
  if (sectPrMatch) {
    result.pageWidth = parseInt(sectPrMatch[1]);
    result.pageHeight = parseInt(sectPrMatch[2]);
  }

  // Margins from sectPr (any attribute order)
  const pgMarMatch = docXml.match(/<w:pgMar[^/]+\/>/);
  if (pgMarMatch) {
    const pgMarStr = pgMarMatch[0];
    const topM = pgMarStr.match(/w:top="(\d+)"/);
    const rightM = pgMarStr.match(/w:right="(\d+)"/);
    const bottomM = pgMarStr.match(/w:bottom="(\d+)"/);
    const leftM = pgMarStr.match(/w:left="(\d+)"/);
    result.margins = {
      top: topM ? parseInt(topM[1]) : 0,
      right: rightM ? parseInt(rightM[1]) : 0,
      bottom: bottomM ? parseInt(bottomM[1]) : 0,
      left: leftM ? parseInt(leftM[1]) : 0,
    };
  }

  // Extract font usage from styles.xml
  const fontMatches = stylesXml.match(/<w:rFonts w:ascii="([^"]+)"/g) || [];
  for (const m of fontMatches) {
    const val = m.match(/w:ascii="([^"]+)"/)[1];
    result.fonts[val] = (result.fonts[val] || 0) + 1;
  }

  // Font sizes from document.xml
  const sizeMatches = docXml.match(/<w:sz w:val="(\d+)"/g) || [];
  for (const m of sizeMatches) {
    const val = m.match(/w:val="(\d+)"/)[1];
    result.fontSizes[val] = (result.fontSizes[val] || 0) + 1;
  }

  // Indentation
  const indentMatches = docXml.match(/<w:ind[^/]+/g) || [];
  for (const m of indentMatches) {
    const left = m.match(/w:left="(\d+)"/);
    const right = m.match(/w:right="(\d+)"/);
    const firstLine = m.match(/w:firstLine="(\d+)"/);
    const key = `L${left ? left[1] : '0'}_R${right ? right[1] : '0'}_F${firstLine ? firstLine[1] : '0'}`;
    result.indents[key] = (result.indents[key] || 0) + 1;
  }

  // Spacing
  const spaceMatches = docXml.match(/<w:spacing[^/]+/g) || [];
  for (const m of spaceMatches) {
    const before = m.match(/w:before="(\d+)"/);
    const after = m.match(/w:after="(\d+)"/);
    const line = m.match(/w:line="(\d+)"/);
    const key = `B${before ? before[1] : '0'}_A${after ? after[1] : '0'}_L${line ? line[1] : '0'}`;
    result.spacings[key] = (result.spacings[key] || 0) + 1;
  }

  return result;
}

function getVal(obj, key) {
  const parts = key.split('.');
  let v = obj;
  for (const p of parts) v = v && v[p];
  return v;
}

function score(current, reference, property) {
  const c = getVal(current, property);
  const t = getVal(reference, property);
  if (typeof c !== 'number' || typeof t !== 'number') return 0;
  if (c === t) return 100;
  const diff = Math.abs(c - t);
  const base = Math.max(Math.abs(t), 1);
  return Math.round(Math.max(0, 100 - (diff / base) * 100));
}

async function main() {
  console.log('='.repeat(70));
  console.log('PDFNova Conversion Regression Test Suite');
  console.log('='.repeat(70));

  // 1. Generate fresh PDFNova output
  console.log('\n[1/4] Generating fresh PDFNova conversion...');
  const pdfBuf = fs.readFileSync(SOURCE_PDF);
  const { buffer: generatedBuf, stats } = await convertPdfToDocx(pdfBuf, { debug: false });
  fs.writeFileSync(PDFNOVA_GEN, generatedBuf);
  console.log(`  Generated: ${generatedBuf.length} bytes`);
  console.log(`  Stats: ${JSON.stringify(stats)}`);

  // 2. Extract structures
  console.log('\n[2/4] Extracting document structures...');
  const pdfnova = extractDocxStructure(PDFNOVA_GEN);
  const reference = extractDocxStructure(ILOVEPDF_REF);
  const pdfnovaOld = extractDocxStructure(PDFNOVA_OUT);

  // 3. Print comparison
  console.log('\n[3/4] Comparison Results:');
  console.log('');

  const metrics = [
    { name: 'Paragraphs', key: 'paragraphs' },
    { name: 'Tables', key: 'tables' },
    { name: 'Table Rows', key: 'tableRows' },
    { name: 'Runs (total)', key: 'runs' },
    { name: 'Text Runs', key: 'textRuns' },
    { name: 'Bold Runs', key: 'boldRuns' },
    { name: 'Italic Runs', key: 'italicRuns' },
    { name: 'Superscripts', key: 'superscriptRuns' },
    { name: 'Heading 1', key: 'heading1' },
    { name: 'Heading 2', key: 'heading2' },
    { name: 'Title Style', key: 'titleStyle' },
    { name: 'List Paragraphs', key: 'listParagraphs' },
    { name: 'Images', key: 'images' },
    { name: 'Hyperlinks', key: 'hyperlinks' },
    { name: 'Page Width (twips)', key: 'pageWidth' },
    { name: 'Page Height (twips)', key: 'pageHeight' },
    { name: 'Margin Top', key: 'margins.top' },
    { name: 'Margin Bottom', key: 'margins.bottom' },
    { name: 'Margin Left', key: 'margins.left' },
    { name: 'Margin Right', key: 'margins.right' },
  ];

  console.log(`${'Metric'.padEnd(24)} ${'PDFNova'.padStart(10)} ${'iLovePDF'.padStart(10)} ${'Score'.padStart(7)}`);
  console.log('-'.repeat(55));

  let totalScore = 0;
  let scoredMetrics = 0;

  for (const m of metrics) {
    const val = getVal(pdfnova, m.key);
    const ref = getVal(reference, m.key);
    const s = score(pdfnova, reference, m.key);
    totalScore += s;
    scoredMetrics++;

    const status = s === 100 ? '  ' : s >= 80 ? ' ~' : ' !';
    console.log(`${m.name.padEnd(24)} ${String(val).padStart(10)} ${String(ref).padStart(10)} ${String(s + '%').padStart(6)}${status}`);
  }

  console.log('-'.repeat(55));
  console.log(`${'OVERALL SCORE'.padEnd(24)} ${''.padStart(10)} ${''.padStart(10)} ${String(Math.round(totalScore / scoredMetrics) + '%').padStart(6)}`);

  // 4. Print detailed findings
  console.log('\n[4/4] Detailed Findings:');

  // Text fragmentation check
  const avgRunLength = pdfnova.totalTextLength / Math.max(pdfnova.textRuns, 1);
  const refAvgRunLength = reference.totalTextLength / Math.max(reference.textRuns, 1);
  console.log(`\n  Text Fragmentation:`);
  console.log(`    PDFNova avg run length: ${avgRunLength.toFixed(1)} chars/run`);
  console.log(`    iLovePDF avg run length: ${refAvgRunLength.toFixed(1)} chars/run`);

  // Bold ratio
  const boldRatio = pdfnova.boldRuns / Math.max(pdfnova.runs, 1);
  const refBoldRatio = reference.boldRuns / Math.max(reference.runs, 1);
  console.log(`\n  Bold Usage:`);
  console.log(`    PDFNova: ${(boldRatio * 100).toFixed(1)}% of runs bold (${pdfnova.boldRuns}/${pdfnova.runs})`);
  console.log(`    iLovePDF: ${(refBoldRatio * 100).toFixed(1)}% of runs bold (${reference.boldRuns}/${reference.runs})`);

  // Alignment
  console.log(`\n  Alignment:`);
  console.log(`    PDFNova: ${JSON.stringify(pdfnova.alignments)}`);
  console.log(`    iLovePDF: ${JSON.stringify(reference.alignments)}`);

  // Fonts
  console.log(`\n  Fonts (from styles):`);
  console.log(`    PDFNova: ${JSON.stringify(pdfnova.fonts)}`);
  console.log(`    iLovePDF: ${JSON.stringify(reference.fonts)}`);

  // Font sizes
  console.log(`\n  Font Sizes (half-pts, top 5):`);
  const pdfnovaSizes = Object.entries(pdfnova.fontSizes).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const refSizes = Object.entries(reference.fontSizes).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`    PDFNova: ${pdfnovaSizes.map(([k, v]) => `${k}pt(${v})`).join(', ')}`);
  console.log(`    iLovePDF: ${refSizes.map(([k, v]) => `${k}pt(${v})`).join(', ')}`);

  // Image files
  console.log(`\n  Image Files in DOCX:`);
  console.log(`    PDFNova: ${pdfnova.imageFiles.length > 0 ? pdfnova.imageFiles.join(', ') : 'NONE'}`);
  console.log(`    iLovePDF: ${reference.imageFiles.length > 0 ? reference.imageFiles.join(', ') : 'NONE'}`);

  // Indentation diversity
  console.log(`\n  Indentation patterns: PDFNova=${Object.keys(pdfnova.indents).length}, iLovePDF=${Object.keys(reference.indents).length}`);
  console.log(`  Spacing patterns: PDFNova=${Object.keys(pdfnova.spacings).length}, iLovePDF=${Object.keys(reference.spacings).length}`);

  // Justified text
  console.log(`\n  Justified text: PDFNova=${pdfnova.hasJustified}, iLovePDF=${reference.hasJustified}`);

  console.log('\n' + '='.repeat(70));
  console.log('Test complete.');
  console.log('='.repeat(70));
}

main().catch((e) => {
  console.error('Test failed:', e);
  process.exit(1);
});
