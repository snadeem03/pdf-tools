const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { Document, Packer, Paragraph, TextRun, ImageRun, PageBreak } = require('docx');
const { imageSize } = require('image-size');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');
const { rasterizePdfToJpegs } = require('../utils/pdfRasterizer');

// If the extracted text averages out to less than this many characters per
// page, we treat the PDF as having "no meaningful text" (e.g. a design PDF
// made entirely of graphics, or a scanned/photographed document) and fall
// back to embedding rendered page images instead of producing an empty doc.
const MIN_CHARS_PER_PAGE = 15;

// A4-ish content width in pixels at 96 DPI, matching the ~1in margins docx
// gives by default on an A4/Letter page. Used to scale embedded page images
// down so they fit on the page instead of overflowing it.
const MAX_IMAGE_WIDTH_PX = 600;

/**
 * Build a text-based DOCX from extracted PDF text.
 */
function buildTextDocument(text) {
  const paragraphs = text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(
      (line) =>
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              size: 24, // 12pt
              font: 'Calibri',
            }),
          ],
          spacing: { after: 120 },
        })
    );

  return new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });
}

/**
 * Build an image-based DOCX by embedding one rendered page image per page.
 * Used when a PDF has no meaningful extractable text (design/graphics-only
 * PDFs, scanned documents, etc.) so the user still gets a usable file
 * instead of a blank one.
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

/**
 * Convert PDF to Word (DOCX).
 * Extracts text where available; falls back to embedding page images for
 * PDFs made of graphics/scans with no meaningful extractable text.
 */
exports.pdfToWord = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  try {
    const pdfBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(pdfBuffer);

    const trimmedText = pdfData.text.trim();
    const avgCharsPerPage = pdfData.numpages > 0 ? trimmedText.length / pdfData.numpages : trimmedText.length;
    const hasMeaningfulText = avgCharsPerPage >= MIN_CHARS_PER_PAGE;

    let doc;
    let mode;
    if (hasMeaningfulText) {
      doc = buildTextDocument(pdfData.text);
      mode = 'text';
    } else {
      logger.info(
        `PDF has little/no extractable text (${trimmedText.length} chars over ${pdfData.numpages} pages); ` +
        'falling back to image-based conversion'
      );
      doc = await buildImageDocument(pdfBuffer);
      mode = 'image';
    }

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(uploadDir, `converted-${Date.now()}.docx`);
    fs.writeFileSync(outputPath, buffer);

    logger.info(`Converted PDF to DOCX via ${mode} mode: ${pdfData.numpages} pages, ${trimmedText.length} chars`);

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
