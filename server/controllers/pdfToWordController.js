const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

/**
 * Convert PDF to Word (DOCX).
 * Extracts text from PDF and creates a DOCX document.
 */
exports.pdfToWord = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload a PDF file' });
  }

  try {
    const pdfBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(pdfBuffer);

    // Split text into paragraphs
    const paragraphs = pdfData.text
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

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const outputPath = path.join(uploadDir, `converted-${Date.now()}.docx`);
    fs.writeFileSync(outputPath, buffer);

    logger.info(`Converted PDF to DOCX: ${pdfData.numpages} pages, ${pdfData.text.length} chars`);

    res.download(outputPath, 'converted.docx', () => {
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });
  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
