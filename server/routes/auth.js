const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../utils/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', auth, authController.getMe);
router.get('/history', auth, authController.getHistory);

module.exports = router;
