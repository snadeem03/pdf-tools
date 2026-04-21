const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const logger = require('../utils/logger');
const { uploadDir } = require('../utils/upload');

exports.signPdf = async (req, res, next) => {
  const pdfFile = req.files['pdf'] ? req.files['pdf'][0] : null;
  const signatureFile = req.files['signature'] ? req.files['signature'][0] : null;
  const { pageIndex, x, y } = req.body;

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

    const pages = pdfDoc.getPages();
    const pIdx = parseInt(pageIndex) || 0;
    const targetPage = pages[pIdx] || pages[0];
    
    const sigDims = signatureImage.scale(0.3); // Scale it down a bit more by default

    // Use provided x, y or default to bottom-right
    const posX = x !== undefined ? parseFloat(x) : 50;
    const posY = y !== undefined ? parseFloat(y) : 50;

    targetPage.drawImage(signatureImage, {
      x: posX - (sigDims.width / 2), // Center it on the click point
      y: posY - (sigDims.height / 2),
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

