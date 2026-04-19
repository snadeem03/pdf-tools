const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Add page numbers to a PDF.
 * Body params: position ("bottom-center"|"bottom-left"|"bottom-right"|"top-center"|"top-left"|"top-right"),
 *              startFrom (number, default 1), fontSize (default 12)
 */
exports.addPageNumbers = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  const {
    position = 'bottom-center',
    startFrom = '1',
    fontSize: fontSizeStr = '12',
    format = 'numeric', // numeric, roman, dash
  } = req.body;

  const startNum = parseInt(startFrom, 10);
  const fontSize = parseInt(fontSizeStr, 10);

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    pages.forEach((page, idx) => {
      const pageNum = startNum + idx;
      const { width, height } = page.getSize();

      // Format the page number text
      let numText;
      switch (format) {
        case 'roman':
          numText = toRoman(pageNum);
          break;
        case 'dash':
          numText = `- ${pageNum} -`;
          break;
        default:
          numText = `${pageNum}`;
      }

      const textWidth = font.widthOfTextAtSize(numText, fontSize);
      const margin = 30;

      let x, y;
      switch (position) {
        case 'top-left':
          x = margin;
          y = height - margin;
          break;
        case 'top-center':
          x = (width - textWidth) / 2;
          y = height - margin;
          break;
        case 'top-right':
          x = width - textWidth - margin;
          y = height - margin;
          break;
        case 'bottom-left':
          x = margin;
          y = margin;
          break;
        case 'bottom-right':
          x = width - textWidth - margin;
          y = margin;
          break;
        case 'bottom-center':
        default:
          x = (width - textWidth) / 2;
          y = margin;
          break;
      }

      page.drawText(numText, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    });

    const numberedBytes = await pdfDoc.save();
    const outputPath = path.join(uploadDir, `numbered-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, numberedBytes);

    logger.info(`Added page numbers to ${totalPages} pages (position: ${position})`);

    res.download(outputPath, 'numbered.pdf', () => {
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};

/**
 * Convert number to Roman numerals.
 */
function toRoman(num) {
  const romanNumerals = [
    ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
    ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
    ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
  ];
  let result = '';
  for (const [letter, value] of romanNumerals) {
    while (num >= value) {
      result += letter;
      num -= value;
    }
  }
  return result;
}
