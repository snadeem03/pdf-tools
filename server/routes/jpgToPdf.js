const express = require('express');
const router = express.Router();
const { uploadImages } = require('../utils/upload');
const { jpgToPdf } = require('../controllers/jpgToPdfController');

// POST /api/jpg-to-pdf - Upload images and convert to PDF
router.post('/', uploadImages.array('files', 50), jpgToPdf);

module.exports = router;
