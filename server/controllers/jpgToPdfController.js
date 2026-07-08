const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Convert JPG/PNG (and other common formats) images to a single PDF.
 */
exports.jpgToPdf = async (req, res, next) => {
  const files = req.files;
  if (!files || files.length === 0) {
    return res.status(400).json({ success: false, error: 'Please upload at least one image' });
  }

  try {
    const pdfDoc = await PDFDocument.create();

    for (const file of files) {
      const isJpeg = file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg';

      // JPEGs are embedded directly (no re-encode) to avoid needlessly
      // bloating photographic images by round-tripping them through
      // lossless PNG. Everything else is normalized to PNG, since pdf-lib
      // only supports embedding JPEG or PNG.
      const pipeline = sharp(file.path);
      const imageBuffer = isJpeg ? await pipeline.jpeg().toBuffer() : await pipeline.png().toBuffer();
      const metadata = await sharp(imageBuffer).metadata();
      const imgWidth = metadata.width || 612;
      const imgHeight = metadata.height || 792;

      const embeddedImage = isJpeg
        ? await pdfDoc.embedJpg(imageBuffer)
        : await pdfDoc.embedPng(imageBuffer);

      // Fit image to page while maintaining aspect ratio
      const pageWidth = 612;
      const pageHeight = 792;
      const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
      const scaledWidth = imgWidth * scale;
      const scaledHeight = imgHeight * scale;

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(embeddedImage, {
        x: (pageWidth - scaledWidth) / 2,
        y: (pageHeight - scaledHeight) / 2,
        width: scaledWidth,
        height: scaledHeight,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const outputPath = path.join(uploadDir, `images-to-pdf-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, pdfBytes);

    logger.info(`Converted ${files.length} images to PDF`);

    res.download(outputPath, 'images.pdf', (err) => {
      if (err) logger.error(`jpg-to-pdf download error: ${err.message}`);
      files.forEach((f) => fs.unlink(f.path, () => {}));
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    files.forEach((f) => fs.unlink(f.path, () => {}));
    next(err);
  }
};
