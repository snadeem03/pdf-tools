const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const PDFMerger = require('pdf-merger-js');
const logger = require('../utils/logger');
const { withFallback } = require('../utils/fallback');
const { uploadDir } = require('../utils/upload');

/**
 * Merge multiple PDFs into one.
 * Primary: pdf-lib | Fallback: pdf-merger-js
 */
exports.mergePdfs = async (req, res, next) => {
  const files = req.files;
  if (!files || files.length < 2) {
    return res.status(400).json({ success: false, error: 'Please upload at least 2 PDF files' });
  }

  // Parse optional order from body (comma-separated indices)
  let order = files.map((_, i) => i);
  if (req.body.order) {
    try {
      order = JSON.parse(req.body.order);
    } catch { /* use default order */ }
  }

  const orderedFiles = order.map((i) => files[i]).filter(Boolean);
  const outputPath = path.join(uploadDir, `merged-${Date.now()}.pdf`);

  try {
    await withFallback(
      // Primary: pdf-lib
      async () => {
        const mergedPdf = await PDFDocument.create();
        for (const file of orderedFiles) {
          const pdfBytes = fs.readFileSync(file.path);
          const pdf = await PDFDocument.load(pdfBytes);
          const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          pages.forEach((page) => mergedPdf.addPage(page));
        }
        const mergedBytes = await mergedPdf.save();
        fs.writeFileSync(outputPath, mergedBytes);
      },
      // Fallback: pdf-merger-js
      async () => {
        const merger = new PDFMerger();
        for (const file of orderedFiles) {
          await merger.add(file.path);
        }
        await merger.save(outputPath);
      },
      'merge'
    );

    res.download(outputPath, 'merged.pdf', (err) => {
      // Cleanup input and output files
      files.forEach((f) => fs.unlink(f.path, () => {}));
      fs.unlink(outputPath, () => {});
      if (err && !res.headersSent) next(err);
    });
  } catch (err) {
    files.forEach((f) => fs.unlink(f.path, () => {}));
    next(err);
  }
};
