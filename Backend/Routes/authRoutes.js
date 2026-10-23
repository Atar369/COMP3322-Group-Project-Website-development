const express = require('express');
const router = express.Router();
const authController = require('../Controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', authController.register);

// POST /api/auth/login
router.post('/login', authController.login);

// GET /api/auth/me (protected)
router.get('/me', verifyToken, authController.me);

// POST /api/auth/change-password (protected)
router.post('/change-password', verifyToken, authController.changePassword);

// POST /api/auth/forgot-password
router.post('/forgot-password', authController.forgotPassword);

module.exports = router;