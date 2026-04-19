const express = require('express');
const router = express.Router();
const { uploadPdf } = require('../utils/upload');
const { rotatePdf } = require('../controllers/rotateController');

// POST /api/rotate - Upload a PDF and rotate pages
router.post('/', uploadPdf.single('file'), rotatePdf);

module.exports = router;
