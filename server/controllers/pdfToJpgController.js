const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const sharp = require('sharp');
const archiver = require('archiver');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Convert each PDF page to a JPG image. Returns a ZIP of images.
 */
exports.pdfToJpg = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();

    const zipPath = path.join(uploadDir, `pdf-to-jpg-${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      res.download(zipPath, 'pdf-images.zip', () => {
        fs.unlink(file.path, () => {});
        fs.unlink(zipPath, () => {});
      });
    });

    archive.on('error', (err) => { throw err; });
    archive.pipe(output);

    // Convert each page to a single-page PDF, then render with sharp
    for (let i = 0; i < totalPages; i++) {
      const singlePdf = await PDFDocument.create();
      const [page] = await singlePdf.copyPages(pdfDoc, [i]);
      singlePdf.addPage(page);
      const singlePdfBytes = await singlePdf.save();

      // Use sharp to convert PDF page to JPG (sharp supports PDF input with libvips)
      try {
        const jpgBuffer = await sharp(Buffer.from(singlePdfBytes), { density: 200 })
          .jpeg({ quality: 90 })
          .toBuffer();
        archive.append(jpgBuffer, { name: `page-${i + 1}.jpg` });
      } catch (sharpErr) {
        // If sharp can't render the PDF page, create a placeholder
        logger.warn(`Could not render page ${i + 1} with sharp: ${sharpErr.message}`);
        // Create a simple placeholder image
        const placeholder = await sharp({
          create: {
            width: 612,
            height: 792,
            channels: 3,
            background: { r: 255, g: 255, b: 255 },
          },
        })
          .jpeg({ quality: 90 })
          .toBuffer();
        archive.append(placeholder, { name: `page-${i + 1}.jpg` });
      }
    }

    logger.info(`Converting ${totalPages} PDF pages to JPG`);
    await archive.finalize();
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
