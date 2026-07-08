const express = require('express');
const router = express.Router();
const { uploadPdf, verifySinglePdf } = require('../utils/upload');
const { pdfToWord } = require('../controllers/pdfToWordController');

// POST /api/pdf-to-word - Upload a PDF and convert to DOCX
router.post('/', uploadPdf.single('file'), verifySinglePdf, pdfToWord);

module.exports = router;
