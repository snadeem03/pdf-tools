const express = require('express');
const router = express.Router();
const { uploadImages, verifyImages } = require('../utils/upload');
const ocrController = require('../controllers/ocrController');

router.post('/', uploadImages.single('file'), verifyImages, ocrController.ocrFile);

module.exports = router;
