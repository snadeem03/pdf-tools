const express = require('express');
const router = express.Router();
const { uploadPdf } = require('../utils/upload');
const { compressPdf } = require('../controllers/compressController');

// POST /api/compress - Upload a PDF and compress it
router.post('/', uploadPdf.single('file'), compressPdf);

module.exports = router;
