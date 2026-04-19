const express = require('express');
const router = express.Router();
const { uploadPdf } = require('../utils/upload');
const { addWatermark } = require('../controllers/watermarkController');

// POST /api/watermark - Upload a PDF and add text watermark
router.post('/', uploadPdf.single('file'), addWatermark);

module.exports = router;
