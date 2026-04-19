const fs = require('fs');
const path = require('path');
const { PDFDocument, degrees } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Rotate selected pages (or all) in a PDF.
 * Body params: angle (90, 180, 270), pages ("all" or "1,3,5")
 */
exports.rotatePdf = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  const { angle = '90', pages = 'all' } = req.body;
  const rotationAngle = parseInt(angle, 10);

  if (![90, 180, 270].includes(rotationAngle)) {
    fs.unlink(file.path, () => {});
    return res.status(400).json({ success: false, error: 'Angle must be 90, 180, or 270' });
  }

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const allPages = pdfDoc.getPages();
    const totalPages = allPages.length;

    // Determine which pages to rotate
    let pageIndices;
    if (pages === 'all') {
      pageIndices = allPages.map((_, i) => i);
    } else {
      pageIndices = pages
        .split(',')
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((i) => i >= 0 && i < totalPages);
    }

    // Apply rotation
    pageIndices.forEach((idx) => {
      const page = allPages[idx];
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + rotationAngle));
    });

    const rotatedBytes = await pdfDoc.save();
    const outputPath = path.join(uploadDir, `rotated-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, rotatedBytes);

    logger.info(`Rotated ${pageIndices.length}/${totalPages} pages by ${rotationAngle}°`);

    res.download(outputPath, 'rotated.pdf', () => {
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
