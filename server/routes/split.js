const express = require('express');
const router = express.Router();
const { uploadPdf } = require('../utils/upload');
const { splitPdf } = require('../controllers/splitController');

// POST /api/split - Upload a PDF and split by range or extract all pages
router.post('/', uploadPdf.single('file'), splitPdf);

module.exports = router;
