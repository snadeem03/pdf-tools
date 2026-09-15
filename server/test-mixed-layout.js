const { PDFDocument, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { convertPdfToDocx } = require('./utils/pdfLayout/index');
const AdmZip = require('adm-zip');

async function createResearchPaperPDF() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);

  const p1 = doc.addPage([612, 792]);
  p1.drawText('Robust Multi-Column Layout Detection for PDF-to-Word Conversion', { x: 72, y: 740, size: 14, font: boldFont });
  p1.drawText('John Smith, Jane Doe, Robert Johnson', { x: 170, y: 718, size: 10, font });
  p1.drawText('Department of Computer Science, University of Research', { x: 130, y: 704, size: 9, font });
  p1.drawText('Abstract', { x: 72, y: 670, size: 10, font: boldFont });
  p1.drawText('This paper presents a comprehensive analysis of multi-column layout detection', { x: 72, y: 655, size: 10, font });
  p1.drawText('and reconstruction techniques for converting PDF documents to Word format.', { x: 72, y: 642, size: 10, font });
  p1.drawText('We evaluate the effectiveness of gap-based column detection.', { x: 72, y: 629, size: 10, font });
  p1.drawText('Index Terms', { x: 72, y: 600, size: 10, font: boldFont });
  p1.drawText('PDF conversion, multi-column layout, document reconstruction', { x: 165, y: 600, size: 10, font });
  p1.drawText('I. Introduction', { x: 50, y: 565, size: 10, font: boldFont });
  p1.drawText('PDF documents are widely used for sharing', { x: 50, y: 550, size: 10, font });
  p1.drawText('academic papers and technical reports.', { x: 50, y: 537, size: 10, font });
  p1.drawText('Converting PDF to editable formats', { x: 50, y: 524, size: 10, font });
  p1.drawText('while preserving layout remains challenging.', { x: 50, y: 511, size: 10, font });
  p1.drawText('III. Methodology', { x: 310, y: 565, size: 10, font: boldFont });
  p1.drawText('Our approach uses gap-based column', { x: 310, y: 550, size: 10, font });
  p1.drawText('detection to identify column structure.', { x: 310, y: 537, size: 10, font });
  p1.drawText('The algorithm finds the largest gap', { x: 310, y: 524, size: 10, font });
  p1.drawText('between text items on each page.', { x: 310, y: 511, size: 10, font });

  const p2 = doc.addPage([612, 792]);
  p2.drawText('II. Related Work', { x: 50, y: 740, size: 10, font: boldFont });
  p2.drawText('Previous approaches focused on text', { x: 50, y: 725, size: 10, font });
  p2.drawText('extraction without layout preservation.', { x: 50, y: 712, size: 10, font });
  p2.drawText('Rule-based systems often fail on', { x: 50, y: 699, size: 10, font });
  p2.drawText('complex multi-column layouts.', { x: 50, y: 686, size: 10, font });
  p2.drawText('IV. Results', { x: 310, y: 740, size: 10, font: boldFont });
  p2.drawText('Our evaluation shows significant', { x: 310, y: 725, size: 10, font });
  p2.drawText('improvement in layout fidelity.', { x: 310, y: 712, size: 10, font });
  p2.drawText('The gap-based approach correctly', { x: 310, y: 699, size: 10, font });
  p2.drawText('identifies columns in 95% of tests.', { x: 310, y: 686, size: 10, font });

  const p3 = doc.addPage([612, 792]);
  p3.drawText('Figure 1: Column Detection Algorithm', { x: 150, y: 740, size: 10, font: boldFont });
  p3.drawText('[  Left Column  ]    GAP    [  Right Column  ]', { x: 72, y: 720, size: 9, font });
  p3.drawText('[  text here    ]           [  text here     ]', { x: 72, y: 707, size: 9, font });
  p3.drawText('[  more text    ]           [  more text     ]', { x: 72, y: 694, size: 9, font });
  p3.drawText('TABLE I: Detection Accuracy', { x: 170, y: 665, size: 10, font: boldFont });
  p3.drawText('Method       | Accuracy', { x: 150, y: 650, size: 9, font });
  p3.drawText('Center-split | 72%', { x: 150, y: 637, size: 9, font });
  p3.drawText('Gap-based    | 95%', { x: 150, y: 624, size: 9, font });
  p3.drawText('V. Discussion', { x: 50, y: 595, size: 10, font: boldFont });
  p3.drawText('Results demonstrate our method', { x: 50, y: 580, size: 10, font });
  p3.drawText('outperforms traditional approaches.', { x: 50, y: 567, size: 10, font });
  p3.drawText('VI. Conclusion', { x: 310, y: 595, size: 10, font: boldFont });
  p3.drawText('This paper presented a robust', { x: 310, y: 580, size: 10, font });
  p3.drawText('approach to multi-column detection.', { x: 310, y: 567, size: 10, font });

  const p4 = doc.addPage([612, 792]);
  p4.drawText('TABLE II: Results Summary', { x: 170, y: 740, size: 10, font: boldFont });
  p4.drawText('Category  | Pages | Accuracy', { x: 130, y: 725, size: 9, font });
  p4.drawText('Academic  | 120   | 94%', { x: 130, y: 712, size: 9, font });
  p4.drawText('Technical | 85    | 96%', { x: 130, y: 699, size: 9, font });
  p4.drawText('Business  | 60    | 91%', { x: 130, y: 686, size: 9, font });
  p4.drawText('VII. Future Work', { x: 50, y: 655, size: 10, font: boldFont });
  p4.drawText('Future work will handle three-column', { x: 50, y: 640, size: 10, font });
  p4.drawText('layouts and more complex structures.', { x: 50, y: 627, size: 10, font });
  p4.drawText('VIII. References', { x: 310, y: 655, size: 10, font: boldFont });
  p4.drawText('[1] Smith et al., "PDF Layout"', { x: 310, y: 640, size: 9, font });
  p4.drawText('[2] Doe, "Document Reconstruction"', { x: 310, y: 627, size: 9, font });

  return doc;
}

async function inspectDocx(buffer, label) {
  const zip = new AdmZip(buffer);
  const docXml = zip.readAsText('word/document.xml');
  const sectPrMatches = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) || [];
  const colsMatches = docXml.match(/<w:cols[\s\S]*?\/?>/g) || [];
  const continuousMatches = docXml.match(/<w:type w:val="continuous"\/>/g) || [];
  console.log(`\n=== ${label} ===`);
  console.log(`Total <w:sectPr>: ${sectPrMatches.length}`);
  console.log(`Total <w:cols>: ${colsMatches.length}`);
  console.log(`Total continuous breaks: ${continuousMatches.length}`);
  sectPrMatches.forEach((sectPr, i) => {
    const typeMatch = sectPr.match(/<w:type w:val="([^"]+)"\/>/);
    const type = typeMatch ? typeMatch[1] : 'none(last section)';
    const colsInSect = sectPr.match(/w:num="(\d+)"/);
    const numCols = colsInSect ? colsInSect[1] : '1';
    console.log(`  Section ${i + 1}: type=${type}, columns=${numCols}`);
  });
  if (colsMatches.length > 0) {
    console.log(`  w:cols XML:`);
    colsMatches.forEach((c, i) => console.log(`    ${i}: ${c}`));
  }
  return { sectPrMatches, colsMatches, continuousMatches };
}

async function main() {
  console.log('=== Step 1: Generate research paper PDF ===');
  const doc = await createResearchPaperPDF();
  const pdfBytes = await doc.save();
  console.log(`PDF saved: ${pdfBytes.length} bytes`);

  console.log('\n=== Step 2: Convert to DOCX ===');
  const { buffer, stats } = await convertPdfToDocx(pdfBytes, { debug: true });

  const docxPath = path.join(__dirname, 'uploads', 'research_paper_mixed.docx');
  if (!fs.existsSync(path.dirname(docxPath))) fs.mkdirSync(path.dirname(docxPath), { recursive: true });
  fs.writeFileSync(docxPath, buffer);
  console.log(`DOCX saved: ${docxPath}`);

  console.log('\n=== Step 3: Inspect generated DOCX XML ===');
  const result = await inspectDocx(buffer, 'Generated DOCX');

  console.log('\n=== Step 4: Content order check ===');
  const zip = new AdmZip(buffer);
  const docXml = zip.readAsText('word/document.xml');
  const textContent = docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const expectedOrder = [
    'Robust Multi-Column', 'John Smith', 'Abstract', 'Index Terms',
    'Introduction', 'Methodology', 'Related Work', 'Results',
    'Figure 1', 'TABLE I', 'Discussion', 'Conclusion',
    'TABLE II', 'Future Work', 'References'
  ];
  let orderCorrect = true;
  let lastIdx = -1;
  for (const term of expectedOrder) {
    const idx = textContent.indexOf(term);
    if (idx === -1) {
      console.log(`  WARNING: "${term}" not found in output`);
    } else if (idx < lastIdx) {
      console.log(`  ORDER ISSUE: "${term}" at pos ${idx} appears before previous term at pos ${lastIdx}`);
      orderCorrect = false;
    } else {
      lastIdx = idx;
    }
  }
  console.log(`  Content order: ${orderCorrect ? 'PASS' : 'FAIL'}`);

  console.log('\n=== Summary ===');
  console.log(`sectPr: ${result.sectPrMatches.length}`);
  console.log(`w:cols: ${result.colsMatches.length}`);
  console.log(`continuous breaks: ${result.continuousMatches.length}`);
  console.log(`content order: ${orderCorrect ? 'PASS' : 'FAIL'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
