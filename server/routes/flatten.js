const express = require('express');
const router = express.Router();
const { uploadPdf, verifySinglePdf } = require('../utils/upload');
const flattenController = require('../controllers/flattenController');

router.post('/', uploadPdf.single('file'), verifySinglePdf, flattenController.flattenPdf);

module.exports = router;
