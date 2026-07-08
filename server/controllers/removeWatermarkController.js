const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

const VALID_MODES = ['redact', 'crop'];

/**
 * NOTE ON CAPABILITY: this does not detect or remove watermark content
 * anywhere on the page - it only crops or paints white rectangles over the
 * margins the caller specifies. A watermark that isn't confined to the
 * margins (e.g. a diagonal watermark across the middle of the page) will not
 * be affected. This is intentional scope, not a bug, but the response now
 * carries an X-Removal-Method header so the frontend can be accurate about
 * what happened rather than implying full watermark detection.
 */
exports.removeWatermark = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  const mode = req.body.mode || 'redact'; // 'redact' or 'crop'
  if (!VALID_MODES.includes(mode)) {
    return res.status(400).json({ success: false, error: `mode must be one of: ${VALID_MODES.join(', ')}` });
  }

  const marginT = Math.max(0, parseFloat(req.body.marginTop) || 0);
  const marginB = Math.max(0, parseFloat(req.body.marginBottom) || 0);
  const marginL = Math.max(0, parseFloat(req.body.marginLeft) || 0);
  const marginR = Math.max(0, parseFloat(req.body.marginRight) || 0);

  if (marginT === 0 && marginB === 0 && marginL === 0 && marginR === 0) {
    return res.status(400).json({
      success: false,
      error: 'Please specify at least one non-zero margin (top/bottom/left/right) to remove.',
    });
  }

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
        } else {
          logger.warn('Skipped crop on a page: requested margins would leave zero or negative area');
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

    logger.info(`Removed margin content using mode "${mode}" (T:${marginT} B:${marginB} L:${marginL} R:${marginR})`);

    res.setHeader('X-Removal-Method', mode === 'crop' ? 'margin-crop' : 'margin-redact');

    res.download(outputPath, 'watermark-removed.pdf', (err) => {
      if (err) logger.error(`Remove-watermark download error: ${err.message}`);
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
