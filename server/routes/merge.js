const express = require('express');
const router = express.Router();
const { uploadPdfs } = require('../utils/upload');
const { mergePdfs } = require('../controllers/mergeController');

// POST /api/merge - Upload multiple PDFs and merge them
router.post('/', uploadPdfs.array('files', 20), mergePdfs);

module.exports = router;
