const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

router.post('/create-manager', verifyToken, requireRole('manager'), authController.createManager);

router.get('/me', verifyToken, authController.me);
router.post('/change-password', verifyToken, authController.changePassword);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

module.exports = router;