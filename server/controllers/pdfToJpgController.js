const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');
const { rasterizePdfToJpegs } = require('../utils/pdfRasterizer');

/**
 * Convert PDF to JPG (one image per page, delivered as a ZIP).
 */
exports.pdfToJpg = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pages = await rasterizePdfToJpegs(pdfBytes);

    const zipPath = path.join(uploadDir, `pdf-to-jpg-${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Throwing inside an event-listener callback is NOT caught by the
    // surrounding try/catch (different call stack), so it used to crash the
    // process with an unhandled exception on any archive/stream error.
    let responded = false;
    const handleArchiveError = (err) => {
      logger.error(`Archive error during pdf-to-jpg: ${err.message}`);
      fs.unlink(file.path, () => {});
      fs.unlink(zipPath, () => {});
      if (!responded && !res.headersSent) {
        responded = true;
        res.status(500).json({ success: false, error: 'Failed to build the ZIP archive' });
      }
    };

    output.on('close', () => {
      if (responded) return;
      responded = true;
      res.download(zipPath, 'pdf-images.zip', (err) => {
        if (err) logger.error(`pdf-to-jpg download error: ${err.message}`);
        fs.unlink(file.path, () => {});
        fs.unlink(zipPath, () => {});
      });
    });

    output.on('error', handleArchiveError);
    archive.on('error', handleArchiveError);
    archive.pipe(output);

    pages.forEach((p, idx) => {
      archive.append(p.buffer, { name: `page-${idx + 1}.jpg` });
    });

    logger.info(`Converted ${pages.length} PDF pages to JPG`);
    await archive.finalize();
  } catch (err) {
    fs.unlink(file.path, () => {});
    logger.error('Puppeteer Rasterize Error: ' + err.message);
    next(err);
  }
};
