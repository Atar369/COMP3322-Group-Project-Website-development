const express = require('express');
const router = express.Router();
const queueController = require('../Controllers/queueController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Public board (no PII: no user_id in response)
router.get('/', queueController.listAll);

// Customer + manager
router.get('/user/:user_id', verifyToken, queueController.listByUser);
router.post('/', verifyToken, requireRole('customer'), queueController.join);
router.patch('/:id/cancel', verifyToken, queueController.cancel);

// Manager only
router.get('/manager/history', verifyToken, requireRole('manager'), queueController.managerHistory);
router.get('/auto-call', verifyToken, requireRole('manager'), queueController.autoCallSettings);
router.patch('/auto-call/:group', verifyToken, requireRole('manager'), queueController.setAutoCall);

router.patch('/:id/call', verifyToken, requireRole('manager'), queueController.call);
router.patch('/:id/checkin', verifyToken, requireRole('manager'), queueController.checkin);
router.patch('/:id/seat', verifyToken, requireRole('manager'), queueController.seat);
router.patch('/:id/finish', verifyToken, requireRole('manager'), queueController.finish);
router.patch('/:id/pay', verifyToken, requireRole('manager'), queueController.pay);
router.patch('/:id/reissue', verifyToken, requireRole('manager'), queueController.reissue);

module.exports = router;