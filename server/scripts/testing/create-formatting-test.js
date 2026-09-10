/**
 * Create a test PDF with inline formatting transitions:
 * - Bold phrases within body text
 * - Italic phrases within body text
 * - Superscript text (e.g. citations, exponents)
 * - Mixed font sizes within a single paragraph
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createFormattingTest() {
  const outDir = path.join(__dirname, '..', '..', 'uploads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const doc = await PDFDocument.create();
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const timesBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const courier = await doc.embedFont(StandardFonts.Courier);

  // ── Page 1: Paragraphs with inline formatting ──
  const p1 = doc.addPage([612, 792]);

  // Title
  p1.drawText('Formatting Transitions Test', { x: 150, y: 760, size: 16, font: timesBold });

  // Paragraph 1: Normal text with a bold phrase in the middle
  // "This paper presents a novel approach to document analysis. The key innovation is the use of machine learning for layout detection."
  // "This paper presents a novel approach to " (normal)
  // "document analysis" (bold)
  // ". The key innovation is the use of " (normal)
  // "machine learning" (bold)
  // " for layout detection." (normal)
  let y = 720;
  p1.drawText('This paper presents a novel approach to ', { x: 50, y, size: 10, font: times });
  p1.drawText('document analysis', { x: 285, y, size: 10, font: timesBold });
  p1.drawText('. The key innovation is the use of ', { x: 390, y, size: 10, font: times });
  // Wrap to next line
  y -= 14;
  p1.drawText('machine learning for layout detection. ', { x: 50, y, size: 10, font: times });
  p1.drawText('This approach', { x: 278, y, size: 10, font: timesItalic });
  p1.drawText(' significantly improves accuracy over traditional methods.', { x: 352, y, size: 10, font: times });

  // Paragraph 2: Text with superscript (citation) inline
  // "Recent studies have shown promising resultsSmith et al. (2024). Further workJones (2023) confirmed these findings."
  y -= 30;
  p1.drawText('Recent studies have shown promising results', { x: 50, y, size: 10, font: times });
  p1.drawText('[1]', { x: 305, y, size: 7, font: times }); // superscript citation
  p1.drawText('. Further work', { x: 322, y, size: 10, font: times });
  p1.drawText('[2]', { x: 405, y, size: 7, font: times }); // superscript citation
  p1.drawText(' confirmed these findings across multiple domains.', { x: 422, y, size: 10, font: times });

  // Paragraph 3: Mathematical notation with superscripts
  // "The complexity is O(n^2) for the naive approach, but O(n log n) with optimization."
  y -= 30;
  p1.drawText('The complexity is O(n', { x: 50, y, size: 10, font: times });
  p1.drawText('2', { x: 152, y, size: 7, font: times }); // superscript 2
  p1.drawText(') for the naive approach, but O(n log n) with optimization.', { x: 160, y, size: 10, font: times });

  // Paragraph 4: Bold + italic mixed
  // "The results show that our method outperforms the baseline in both precision and recall."
  y -= 30;
  p1.drawText('The results show that ', { x: 50, y, size: 10, font: times });
  p1.drawText('our method', { x: 168, y, size: 10, font: timesBoldItalic });
  p1.drawText(' outperforms the baseline in both ', { x: 236, y, size: 10, font: times });
  p1.drawText('precision', { x: 420, y, size: 10, font: timesBold });
  p1.drawText(' and ', { x: 473, y, size: 10, font: times });
  p1.drawText('recall', { x: 496, y, size: 10, font: timesItalic });
  p1.drawText('.', { x: 524, y, size: 10, font: times });

  // Paragraph 5: Courier (code) mixed with normal text
  y -= 30;
  p1.drawText('The function ', { x: 50, y, size: 10, font: times });
  p1.drawText('calculate(x)', { x: 125, y, size: 10, font: courier });
  p1.drawText(' processes the input and returns the result.', { x: 215, y, size: 10, font: times });

  // ── Page 2: More complex formatting ──
  const p2 = doc.addPage([612, 792]);

  // Section heading
  p2.drawText('II. Analysis', { x: 50, y: 760, size: 14, font: timesBold });

  // Paragraph with bold heading-like phrase
  y = 735;
  p2.drawText('Key Finding: ', { x: 50, y, size: 10, font: timesBold });
  p2.drawText('The proposed architecture achieves 95% accuracy on the test dataset, ', { x: 122, y, size: 10, font: times });
  y -= 14;
  p2.drawText('which represents a significant improvement over the state-of-the-art.', { x: 50, y, size: 10, font: times });

  // Paragraph with multiple formatting transitions
  y -= 30;
  p2.drawText('In summary, we contributions include: (1) a novel algorithm for ', { x: 50, y, size: 10, font: times });
  p2.drawText('text extraction', { x: 408, y, size: 10, font: timesItalic });
  y -= 14;
  p2.drawText(', (2) a robust method for ', { x: 50, y, size: 10, font: times });
  p2.drawText('table detection', { x: 200, y, size: 10, font: timesBold });
  p2.drawText(', and (3) an efficient approach for ', { x: 290, y, size: 10, font: times });
  p2.drawText('image extraction', { x: 478, y, size: 10, font: timesItalic });
  p2.drawText('.', { x: 560, y, size: 10, font: times });

  // Table header (bold, smaller font)
  y -= 40;
  p2.drawText('Table 1: Performance Metrics', { x: 200, y, size: 10, font: timesBold });
  y -= 20;
  p2.drawText('Method', { x: 100, y, size: 10, font: timesBold });
  p2.drawText('Precision', { x: 250, y, size: 10, font: timesBold });
  p2.drawText('Recall', { x: 350, y, size: 10, font: timesBold });
  p2.drawText('F1-Score', { x: 450, y, size: 10, font: timesBold });
  y -= 16;
  p2.drawText('Baseline', { x: 100, y, size: 10, font: times });
  p2.drawText('0.82', { x: 260, y, size: 10, font: times });
  p2.drawText('0.78', { x: 360, y, size: 10, font: times });
  p2.drawText('0.80', { x: 460, y, size: 10, font: times });
  y -= 14;
  p2.drawText('Ours', { x: 100, y, size: 10, font: times });
  p2.drawText('0.95', { x: 260, y, size: 10, font: timesBold });
  p2.drawText('0.93', { x: 360, y, size: 10, font: timesBold });
  p2.drawText('0.94', { x: 460, y, size: 10, font: timesBold });

  // References section
  y -= 40;
  p2.drawText('References', { x: 50, y, size: 14, font: timesBold });
  y -= 20;
  p2.drawText('[1] Smith et al., "PDF Image Extraction", 2024.', { x: 50, y, size: 10, font: times });
  y -= 14;
  p2.drawText('[2] Jones, "Document Layout Analysis", 2023.', { x: 50, y, size: 10, font: times });

  const bytes = await doc.save();
  const outPath = path.join(outDir, 'formatting-test.pdf');
  fs.writeFileSync(outPath, bytes);
  console.log(`Created: ${outPath} (${bytes.length} bytes)`);
  console.log('Features:');
  console.log('  - Bold phrases within body text');
  console.log('  - Italic phrases within body text');
  console.log('  - Bold+italic combined');
  console.log('  - Superscript citations [1], [2]');
  console.log('  - Superscript math notation (n^2)');
  console.log('  - Courier (code) mixed with normal text');
  console.log('  - Multi-line paragraphs with formatting transitions');
}

createFormattingTest().catch(console.error);
