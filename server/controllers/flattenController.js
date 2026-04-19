const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

exports.flattenPdf = async (req, res, next) => {
  const file = req.file;
  if (!file) return res.status(400).json({ success: false, error: 'Please upload a PDF' });

  const outputPath = path.join(uploadDir, `flattened-${Date.now()}.pdf`);

  try {
    const pdfBytes = fs.readFileSync(file.path);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    const form = pdfDoc.getForm();
    form.flatten(); // Flattens all interactive form fields into the PDF canvas

    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    require('../utils/responseHandler').sendDownloadResponse(req, res, outputPath, 'flattened.pdf', 'flatten', (err) => {
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });

  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
