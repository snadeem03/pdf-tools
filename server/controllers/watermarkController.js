const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Add text watermark to PDF.
 * Body params: text, position ("center"|"top-left"|"top-right"|"bottom-left"|"bottom-right"),
 *              opacity (0-1), fontSize, color (hex)
 */
exports.addWatermark = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  const {
    text = 'WATERMARK',
    position = 'center',
    opacity = '0.3',
    fontSize: fontSizeStr = '50',
    color = '#999999',
  } = req.body;

  const opacityVal = parseFloat(opacity);
  const fontSize = parseInt(fontSizeStr, 10);

  // Parse hex color
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = fontSize;

      // Calculate position
      let x, y;
      switch (position) {
        case 'top-left':
          x = 30;
          y = height - 30 - textHeight;
          break;
        case 'top-right':
          x = width - textWidth - 30;
          y = height - 30 - textHeight;
          break;
        case 'bottom-left':
          x = 30;
          y = 30;
          break;
        case 'bottom-right':
          x = width - textWidth - 30;
          y = 30;
          break;
        case 'center':
        default:
          x = (width - textWidth) / 2;
          y = (height - textHeight) / 2;
          break;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(r, g, b),
        opacity: opacityVal,
      });
    }

    const watermarkedBytes = await pdfDoc.save();
    const outputPath = path.join(uploadDir, `watermarked-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, watermarkedBytes);

    logger.info(`Added watermark "${text}" at ${position} on ${pages.length} pages`);

    res.download(outputPath, 'watermarked.pdf', () => {
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
