const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Convert Word (DOCX) to PDF.
 * Extracts text from DOCX using mammoth, then creates PDF with pdf-lib.
 */
exports.wordToPdf = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a Word document' });
  }

  try {
    // Extract plain text from DOCX
    const result = await mammoth.extractRawText({ path: file.path });
    const text = result.value;

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontSize = 12;
    const margin = 50;
    const lineHeight = fontSize * 1.5;

    // Split text into lines that fit on page
    const lines = text.split('\n');
    let page = pdfDoc.addPage([612, 792]); // Letter size
    let y = 792 - margin;

    for (const line of lines) {
      // Word wrap long lines
      const words = line.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);

        if (width > 612 - 2 * margin) {
          if (y < margin + lineHeight) {
            page = pdfDoc.addPage([612, 792]);
            y = 792 - margin;
          }
          page.drawText(currentLine, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      // Draw remaining text in line
      if (currentLine) {
        if (y < margin + lineHeight) {
          page = pdfDoc.addPage([612, 792]);
          y = 792 - margin;
        }
        page.drawText(currentLine, { x: margin, y, size: fontSize, font, color: rgb(0, 0, 0) });
        y -= lineHeight;
      } else {
        y -= lineHeight; // Empty line
      }
    }

    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(uploadDir, `converted-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    logger.info(`Converted DOCX to PDF: ${lines.length} lines`);

    res.download(outputPath, 'converted.pdf', () => {
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
