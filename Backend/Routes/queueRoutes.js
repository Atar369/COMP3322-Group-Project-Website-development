const express = require('express');
const router = express.Router();
const queueController = require('../Controllers/queueController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', queueController.listAll);
router.post('/', queueController.join);
router.get('/manager/history', verifyToken, requireRole('manager'), queueController.managerHistory);
router.get('/user/:user_id', queueController.listByUser);
router.get('/auto-call', verifyToken, requireRole('manager'), queueController.autoCallSettings);
router.patch('/auto-call/:group', verifyToken, requireRole('manager'), queueController.setAutoCall);
router.patch('/:id/call', queueController.call);
router.patch('/:id/checkin', queueController.checkin);
router.patch('/:id/seat', verifyToken, requireRole('manager'), queueController.seat);
router.patch('/:id/finish', queueController.finish);
router.patch('/:id/pay', queueController.pay);
router.patch('/:id/cancel', queueController.cancel);
router.post('/:id/rejoin', verifyToken, requireRole('customer'), queueController.customerRejoin);
router.patch('/:id/reissue', queueController.reissue);

module.exports = router;
