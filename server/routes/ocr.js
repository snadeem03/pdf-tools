const express = require('express');
const router = express.Router();
const multer = require('multer');
const ocrController = require('../controllers/ocrController');

// For OCR, allow image uploads
const upload = multer({ dest: 'uploads/', limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/', upload.single('file'), ocrController.ocrFile);

module.exports = router;
