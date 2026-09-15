const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');
const { rasterizePdfToJpegs } = require('../utils/pdfRasterizer');
const { convertPdfToDocx } = require('../utils/pdfLayout');

// Existing docx imports for image fallback only
const { Document, Packer, Paragraph, TextRun, ImageRun, PageBreak } = require('docx');
const { imageSize } = require('image-size');

// If the extracted text averages out to less than this many characters per
// page, we treat the PDF as having "no meaningful text" and fall back to
// embedding rendered page images.
const MIN_CHARS_PER_PAGE = 15;

// A4-ish content width in pixels at 96 DPI for image scaling
const MAX_IMAGE_WIDTH_PX = 600;

/**
 * Convert PDF to Word (DOCX) with layout-aware formatting preservation.
 *
 * Pipeline:
 *   1. Extract text items with coordinates via pdfjs-dist
 *   2. Group items into visual lines
 *   3. Group lines into paragraphs/blocks
 *   4. Detect tables
 *   5. Build DOCX with typography, alignment, spacing, tables preserved
 *
 * Falls back to image-based conversion for scanned/image-only PDFs.
 */
exports.pdfToWord = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  let pdfBuffer;
  try {
    pdfBuffer = fs.readFileSync(file.path);
  } catch (err) {
    fs.unlink(file.path, () => {});
    return res.status(400).json({ success: false, error: 'Could not read uploaded file' });
  }

  try {
    // Check if PDF has meaningful text content
    const pdfData = await pdfParse(pdfBuffer);
    const trimmedText = pdfData.text.trim();
    const avgCharsPerPage =
      pdfData.numpages > 0 ? trimmedText.length / pdfData.numpages : trimmedText.length;
    const hasMeaningfulText = avgCharsPerPage >= MIN_CHARS_PER_PAGE;

    let doc;
    let mode;

    if (hasMeaningfulText) {
      // PRIMARY PATH: Layout-aware conversion via pdfjs-dist
      try {
        const { buffer, stats } = await convertPdfToDocx(pdfBuffer, {
          debug: process.env.NODE_ENV !== 'production',
        });

        // Write buffer to temp file for download
        const outputPath = path.join(uploadDir, `converted-${Date.now()}.docx`);
        fs.writeFileSync(outputPath, buffer);

        logger.info(
          `Layout conversion: ${stats.totalPages} pages, ` +
            `${stats.totalItems} items, ${stats.totalBlocks} blocks, ` +
            `${stats.tablesDetected} tables`
        );

        res.setHeader('X-Conversion-Method', 'layout');

        res.download(outputPath, 'converted.docx', (err) => {
          if (err) logger.error(`PDF-to-Word download error: ${err.message}`);
          fs.unlink(file.path, () => {});
          fs.unlink(outputPath, () => {});
        });
        return;
      } catch (layoutErr) {
        logger.warn(`Layout conversion failed, falling back to image mode: ${layoutErr.message}`);
        // Fall through to image mode below
      }
    }

    // FALLBACK: Image-based conversion for scanned/graphics-only PDFs
    if (!hasMeaningfulText) {
      logger.info(
        `PDF has little/no extractable text (${trimmedText.length} chars over ${pdfData.numpages} pages); ` +
          'falling back to image-based conversion'
      );
    }

    doc = await buildImageDocument(pdfBuffer);
    mode = 'image';

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(uploadDir, `converted-${Date.now()}.docx`);
    fs.writeFileSync(outputPath, buffer);

    logger.info(
      `Converted PDF to DOCX via ${mode} mode: ${pdfData.numpages} pages, ${trimmedText.length} chars`
    );

    res.setHeader('X-Conversion-Method', mode);

    res.download(outputPath, 'converted.docx', (err) => {
      if (err) logger.error(`PDF-to-Word download error: ${err.message}`);
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};

/**
 * Build an image-based DOCX by embedding one rendered page image per page.
 * Used for scanned/graphics-only PDFs.
 */
async function buildImageDocument(pdfBytes) {
  const pages = await rasterizePdfToJpegs(pdfBytes);

  const children = [
    new Paragraph({
      children: [
        new TextRun({
          text:
            'This PDF is graphic/scanned content with no selectable text, so each page below ' +
            'is embedded as an image rather than editable text.',
          italics: true,
          size: 20,
          color: '666666',
        }),
      ],
      spacing: { after: 240 },
    }),
  ];

  pages.forEach((p, idx) => {
    const { width: naturalWidth, height: naturalHeight } = imageSize(p.buffer);
    const scale = Math.min(1, MAX_IMAGE_WIDTH_PX / naturalWidth);
    const width = Math.round(naturalWidth * scale);
    const height = Math.round(naturalHeight * scale);

    children.push(
      new Paragraph({
        children: [
          new ImageRun({ data: p.buffer, transformation: { width, height }, type: 'jpg' }),
        ],
        spacing: { after: 240 },
      })
    );

    if (idx < pages.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  return new Document({ sections: [{ properties: {}, children }] });
}
