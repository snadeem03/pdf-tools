const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Compress a PDF by stripping metadata, flattening, and re-saving.
 * pdf-lib's save() already does basic optimization.
 * We also remove unused objects and set useObjectStreams for smaller file.
 */
exports.compressPdf = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Strip metadata for smaller size
    pdfDoc.setTitle('');
    pdfDoc.setAuthor('');
    pdfDoc.setSubject('');
    pdfDoc.setTitle('Compressed PDF');
    pdfDoc.setProducer('PDFNova');
    pdfDoc.setCreator('PDFNova');

    // Save with object streams for better compression
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
    });

    const outputPath = path.join(uploadDir, `compressed-${Date.now()}.pdf`);
    fs.writeFileSync(outputPath, compressedBytes);

    const originalSize = fs.statSync(file.path).size;
    const compressedSize = compressedBytes.length;
    const reduction = Math.round((1 - compressedSize / originalSize) * 100);

    logger.info(`Compressed PDF: ${originalSize} -> ${compressedSize} bytes (${reduction}% reduction)`);

    // Set custom header with compression info
    res.setHeader('X-Original-Size', originalSize);
    res.setHeader('X-Compressed-Size', compressedSize);
    res.setHeader('X-Reduction', `${reduction}%`);

    res.download(outputPath, 'compressed.pdf', () => {
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
