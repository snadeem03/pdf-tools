/**
 * Create a test PDF with two-column layout to test multi-column detection.
 */
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function createTwoColumnPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold);

  // Page 1: Full-width title + two-column body
  const page1 = doc.addPage([612, 792]); // Letter size

  // Full-width title area
  page1.drawText('Multi-Column Layout Test Document', { x: 120, y: 750, size: 18, font: boldFont });
  page1.drawText('Author A and Author B', { x: 220, y: 720, size: 11, font });
  page1.drawText('Abstract', { x: 50, y: 680, size: 12, font: boldFont });
  page1.drawText('This document tests multi-column detection for PDF conversion.', { x: 50, y: 660, size: 10, font });

  // Left column content (x: 50-280)
  page1.drawText('I. Introduction', { x: 50, y: 600, size: 11, font: boldFont });
  page1.drawText('This is the introduction text in the left column.', { x: 50, y: 580, size: 10, font });
  page1.drawText('It spans multiple lines to demonstrate the column layout.', { x: 50, y: 565, size: 10, font });
  page1.drawText('The two-column format is common in academic papers.', { x: 50, y: 550, size: 10, font });
  page1.drawText('II. Related Work', { x: 50, y: 510, size: 11, font: boldFont });
  page1.drawText('Several approaches exist for document layout analysis.', { x: 50, y: 490, size: 10, font });
  page1.drawText('These include rule-based and machine learning methods.', { x: 50, y: 475, size: 10, font });

  // Right column content (x: 310-550)
  page1.drawText('III. Methodology', { x: 310, y: 600, size: 11, font: boldFont });
  page1.drawText('Our approach uses X-coordinate analysis to detect', { x: 310, y: 580, size: 10, font });
  page1.drawText('column boundaries in the PDF text items.', { x: 310, y: 565, size: 10, font });
  page1.drawText('The algorithm identifies gaps between columns', { x: 310, y: 550, size: 10, font });
  page1.drawText('and assigns content to the correct column.', { x: 310, y: 535, size: 10, font });
  page1.drawText('IV. Results', { x: 310, y: 510, size: 11, font: boldFont });
  page1.drawText('The results show accurate column detection.', { x: 310, y: 490, size: 10, font });
  page1.drawText('Content is properly ordered in reading sequence.', { x: 310, y: 475, size: 10, font });

  // Full-width figure spanning both columns
  page1.drawText('Figure 1: System Architecture', { x: 180, y: 420, size: 9, font });
  // Draw a rectangle to simulate a figure
  page1.drawRectangle({ x: 100, y: 300, width: 350, height: 100, borderColor: rgb(0, 0, 0), borderWidth: 1 });

  // More two-column content after figure
  page1.drawText('V. Discussion', { x: 50, y: 260, size: 11, font: boldFont });
  page1.drawText('The layout detection correctly identifies the full-width figure.', { x: 50, y: 240, size: 10, font });
  page1.drawText('and switches back to two-column layout afterward.', { x: 50, y: 225, size: 10, font });
  page1.drawText('VI. Conclusion', { x: 310, y: 260, size: 11, font: boldFont });
  page1.drawText('Multi-column detection improves DOCX output quality.', { x: 310, y: 240, size: 10, font });
  page1.drawText('The page count matches the reference document.', { x: 310, y: 225, size: 10, font });

  const pdfBytes = await doc.save();
  const outPath = path.join(__dirname, '..', 'uploads', 'two-column-test.pdf');
  fs.writeFileSync(outPath, pdfBytes);
  console.log(`Created: ${outPath} (${pdfBytes.length} bytes)`);
}

createTwoColumnPdf().catch(console.error);
