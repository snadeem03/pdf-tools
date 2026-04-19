const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

exports.removeWatermark = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  // Parse fields
  const mode = req.body.mode || 'redact'; // 'redact' or 'crop'
  const marginT = parseFloat(req.body.marginTop) || 0;
  const marginB = parseFloat(req.body.marginBottom) || 0;
  const marginL = parseFloat(req.body.marginLeft) || 0;
  const marginR = parseFloat(req.body.marginRight) || 0;

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    for (const page of pages) {
      const { width, height } = page.getSize();

      if (mode === 'crop') {
        const newX = marginL;
        const newY = marginB;
        const newWidth = width - marginL - marginR;
        const newHeight = height - marginT - marginB;

        // Ensure we don't crop out the entire page
        if (newWidth > 0 && newHeight > 0) {
          page.setCropBox(newX, newY, newWidth, newHeight);
        }
      } else if (mode === 'redact') {
        // Draw white rectangles over the margins
        if (marginT > 0) {
          page.drawRectangle({ x: 0, y: height - marginT, width, height: marginT, color: rgb(1, 1, 1) });
        }
        if (marginB > 0) {
          page.drawRectangle({ x: 0, y: 0, width, height: marginB, color: rgb(1, 1, 1) });
        }
        if (marginL > 0) {
          page.drawRectangle({ x: 0, y: 0, width: marginL, height, color: rgb(1, 1, 1) });
        }
        if (marginR > 0) {
          page.drawRectangle({ x: width - marginR, y: 0, width: marginR, height, color: rgb(1, 1, 1) });
        }
      }
    }

    // Embed metadata
    pdfDoc.setTitle('Watermark Removed PDF');
    pdfDoc.setProducer('PDFNova');

    const outputBytes = await pdfDoc.save();
    const outputPath = path.join(uploadDir, `unwatermarked-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, outputBytes);

    logger.info(`Removed watermark using mode ${mode} for file`);

    res.download(outputPath, 'watermark-removed.pdf', () => {
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
