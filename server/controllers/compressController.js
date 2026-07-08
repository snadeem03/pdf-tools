const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Compress a PDF by stripping metadata and re-saving with object streams.
 *
 * Honest limitation: this is a lossless, metadata/structure-level pass - it
 * does not re-encode or downsample embedded images, so for image-heavy PDFs
 * the size reduction can be small or even zero. We never return a file
 * larger than the original in that case (we just serve the original back)
 * instead of reporting a misleading "-4% reduction".
 */
exports.compressPdf = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Strip metadata for a smaller size / privacy.
    pdfDoc.setTitle('Compressed PDF');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setProducer('PDFNova');
    pdfDoc.setCreator('PDFNova');

    // Save with object streams for better compression
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const originalSize = fs.statSync(file.path).size;
    const compressedSize = compressedBytes.length;

    // If our "compression" didn't actually shrink the file (common for
    // image-heavy PDFs, since we don't re-encode embedded images), just
    // return the original rather than a bigger file with a confusing
    // negative reduction percentage.
    const useOriginal = compressedSize >= originalSize;
    const finalBytes = useOriginal ? pdfBytes : compressedBytes;
    const finalSize = useOriginal ? originalSize : compressedSize;
    const reduction = Math.max(0, Math.round((1 - finalSize / originalSize) * 100));

    if (useOriginal) {
      logger.info(
        `Compression pass did not reduce size for ${file.originalname} ` +
        `(${originalSize} -> ${compressedSize} bytes); returning original file. ` +
        'This tool does not re-encode embedded images, so image-heavy PDFs may see little to no reduction.'
      );
    } else {
      logger.info(`Compressed PDF: ${originalSize} -> ${finalSize} bytes (${reduction}% reduction)`);
    }

    const outputPath = path.join(uploadDir, `compressed-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, finalBytes);

    res.setHeader('X-Original-Size', originalSize);
    res.setHeader('X-Compressed-Size', finalSize);
    res.setHeader('X-Reduction', `${reduction}%`);

    res.download(outputPath, 'compressed.pdf', (err) => {
      if (err) logger.error(`Compress download error: ${err.message}`);
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
