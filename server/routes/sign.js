const express = require('express');
const router = express.Router();
const { uploadSign, verifySignFields } = require('../utils/upload');
const signController = require('../controllers/signController');

router.post(
  '/',
  uploadSign.fields([{ name: 'pdf', maxCount: 1 }, { name: 'signature', maxCount: 1 }]),
  verifySignFields,
  signController.signPdf
);

module.exports = router;
