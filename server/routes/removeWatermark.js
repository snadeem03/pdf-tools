const express = require('express');
const router = express.Router();
const removeWatermarkController = require('../controllers/removeWatermarkController');
const { uploadPdf, verifySinglePdf } = require('../utils/upload');

router.post('/', uploadPdf.single('pdf'), verifySinglePdf, removeWatermarkController.removeWatermark);

module.exports = router;
