const express = require('express');
const router = express.Router();
const removeWatermarkController = require('../controllers/removeWatermarkController');
const { upload } = require('../utils/upload');

router.post('/', upload.single('pdf'), removeWatermarkController.removeWatermark);

module.exports = router;
