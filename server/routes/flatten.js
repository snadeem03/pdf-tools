const express = require('express');
const router = express.Router();
const multer = require('multer');
const flattenController = require('../controllers/flattenController');

const upload = multer({ dest: 'uploads/', limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/', upload.single('file'), flattenController.flattenPdf);

module.exports = router;
