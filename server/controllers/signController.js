const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

exports.signPdf = async (req, res, next) => {
  const pdfFile = req.files['pdf'] ? req.files['pdf'][0] : null;
  const signatureFile = req.files['signature'] ? req.files['signature'][0] : null;

  if (!pdfFile || !signatureFile) {
    return res.status(400).json({ success: false, error: 'Please upload both a PDF and a Signature image' });
  }

  const outputPath = path.join(uploadDir, `signed-${Date.now()}.pdf`);

  try {
    const pdfBytes = fs.readFileSync(pdfFile.path);
    const sigBytes = fs.readFileSync(signatureFile.path);

    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Embed signature (PNG or JPG)
    let signatureImage;
    if (signatureFile.mimetype === 'image/png') {
      signatureImage = await pdfDoc.embedPng(sigBytes);
    } else {
      signatureImage = await pdfDoc.embedJpg(sigBytes);
    }

    // Default: put signature at bottom right of the first page
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    
    const sigDims = signatureImage.scale(0.5); // scale down

    firstPage.drawImage(signatureImage, {
      x: width - sigDims.width - 50,
      y: 50, // 50 units from bottom
      width: sigDims.width,
      height: sigDims.height,
    });

    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);

    require('../utils/responseHandler').sendDownloadResponse(req, res, outputPath, 'signed.pdf', 'sign', (err) => {
      fs.unlink(pdfFile.path, () => {});
      fs.unlink(signatureFile.path, () => {});
      fs.unlink(outputPath, () => {});
    });

  } catch (err) {
    fs.unlink(pdfFile.path, () => {});
    fs.unlink(signatureFile.path, () => {});
    next(err);
  }
};
