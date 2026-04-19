const express = require('express');
const router = express.Router();
const removeWatermarkController = require('../controllers/removeWatermarkController');
const { uploadPdf } = require('../utils/upload');

router.post('/', uploadPdf.single('pdf'), removeWatermarkController.removeWatermark);

module.exports = router;
