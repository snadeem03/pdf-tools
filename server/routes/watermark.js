const express = require('express');
const router = express.Router();
const { uploadPdf, verifySinglePdf } = require('../utils/upload');
const { addWatermark } = require('../controllers/watermarkController');

// POST /api/watermark - Upload a PDF and add text watermark
router.post('/', uploadPdf.single('file'), verifySinglePdf, addWatermark);

module.exports = router;
