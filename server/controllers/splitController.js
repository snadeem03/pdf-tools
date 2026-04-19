const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const archiver = require('archiver');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Split a PDF by page range or extract all pages.
 * Body params: mode ("range" | "all"), ranges (e.g. "1-3,5,7-9")
 */
exports.splitPdf = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  const { mode = 'all', ranges = '' } = req.body;

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();

    if (mode === 'range' && ranges) {
      // Parse ranges like "1-3,5,7-9" and create a single PDF with those pages
      const pageIndices = parseRanges(ranges, totalPages);
      const newPdf = await PDFDocument.create();
      const pages = await newPdf.copyPages(pdfDoc, pageIndices);
      pages.forEach((p) => newPdf.addPage(p));

      const outputPath = path.join(uploadDir, `split-${Date.now()}.pdf`);
      const newBytes = await newPdf.save();
      fs.writeFileSync(outputPath, newBytes);

      res.download(outputPath, 'split.pdf', () => {
        fs.unlink(file.path, () => {});
        fs.unlink(outputPath, () => {});
      });
    } else {
      // Extract all pages into individual PDFs, return as ZIP
      const zipPath = path.join(uploadDir, `split-all-${Date.now()}.zip`);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        res.download(zipPath, 'split-pages.zip', () => {
          fs.unlink(file.path, () => {});
          fs.unlink(zipPath, () => {});
        });
      });

      archive.on('error', (err) => { throw err; });
      archive.pipe(output);

      for (let i = 0; i < totalPages; i++) {
        const singlePdf = await PDFDocument.create();
        const [page] = await singlePdf.copyPages(pdfDoc, [i]);
        singlePdf.addPage(page);
        const singleBytes = await singlePdf.save();
        archive.append(Buffer.from(singleBytes), { name: `page-${i + 1}.pdf` });
      }

      await archive.finalize();
    }
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};

/**
 * Parse range string "1-3,5,7-9" into 0-indexed page indices.
 */
function parseRanges(rangeStr, totalPages) {
  const indices = new Set();
  const parts = rangeStr.split(',').map((s) => s.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end && i <= totalPages; i++) {
        if (i >= 1) indices.add(i - 1);
      }
    } else {
      const num = parseInt(part, 10);
      if (num >= 1 && num <= totalPages) indices.add(num - 1);
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}
