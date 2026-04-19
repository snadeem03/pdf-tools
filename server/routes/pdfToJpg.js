const express = require('express');
const router = express.Router();
const { uploadPdf } = require('../utils/upload');
const { pdfToJpg } = require('../controllers/pdfToJpgController');

// POST /api/pdf-to-jpg - Upload a PDF and convert pages to JPG
router.post('/', uploadPdf.single('file'), pdfToJpg);

module.exports = router;
