const express = require('express');
const router = express.Router();
const multer = require('multer');
const signController = require('../controllers/signController');

const upload = multer({ dest: 'uploads/', limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/', upload.fields([{ name: 'pdf', maxCount: 1 }, { name: 'signature', maxCount: 1 }]), signController.signPdf);

module.exports = router;
