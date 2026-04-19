const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const { uploadDir } = require('../utils/upload');
const logger = require('../utils/logger');

exports.ocrFile = async (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, error: 'Please upload an image file' });
  }

  const outputPath = path.join(uploadDir, `ocr-result-${Date.now()}.txt`);

  try {
    logger.info(`Starting OCR on ${file.filename}`);
    
    // Run OCR
    const { data: { text } } = await Tesseract.recognize(
      file.path,
      'eng',
      { logger: m => console.log(m) }
    );

    fs.writeFileSync(outputPath, text);
    logger.info(`OCR completed. Text saved to ${outputPath}`);

    // Download the text file
    require('../utils/responseHandler').sendDownloadResponse(req, res, outputPath, 'ocr-extracted.txt', 'ocr', (err) => {
      fs.unlink(file.path, () => {});
      fs.unlink(outputPath, () => {});
    });

  } catch (err) {
    fs.unlink(file.path, () => {});
    next(err);
  }
};
