const express = require('express');
const router = express.Router();
const { uploadPdf, verifySinglePdf } = require('../utils/upload');
const { addPageNumbers } = require('../controllers/pageNumbersController');

// POST /api/page-numbers - Upload a PDF and add page numbers
router.post('/', uploadPdf.single('file'), verifySinglePdf, addPageNumbers);

module.exports = router;
