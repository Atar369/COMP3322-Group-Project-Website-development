const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/verify-email', authController.verifyEmail);
router.post('/resend-verification', authController.resendEmailVerification);

router.post('/create-manager', verifyToken, requireRole('manager'), authController.createManager);

router.get('/me', verifyToken, authController.me);
router.patch('/profile', verifyToken, authController.updateProfile);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;