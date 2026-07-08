const express = require('express');
const router = express.Router();
const { uploadPdf, verifySinglePdf } = require('../utils/upload');
const { pdfToJpg } = require('../controllers/pdfToJpgController');

// POST /api/pdf-to-jpg - Upload a PDF and convert pages to JPG
router.post('/', uploadPdf.single('file'), verifySinglePdf, pdfToJpg);

module.exports = router;
