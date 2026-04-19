const express = require('express');
const router = express.Router();
const { uploadWord } = require('../utils/upload');
const { wordToPdf } = require('../controllers/wordToPdfController');

// POST /api/word-to-pdf - Upload a DOCX and convert to PDF
router.post('/', uploadWord.single('file'), wordToPdf);

module.exports = router;
