const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// POST /api/auth/create-manager
router.post('/create-manager', verifyToken, requireRole('manager'), authController.createManager);

// GET /api/auth/me (protected)
router.get('/me', verifyToken, authController.me);

// POST /api/auth/change-password (protected)
router.post('/change-password', verifyToken, authController.changePassword);

// POST /api/auth/forgot-password (step 1: request reset)
router.post('/forgot-password', authController.forgotPassword);

// POST /api/auth/reset-password (step 2: reset with token)
router.post('/reset-password', authController.resetPassword);

module.exports = router;