const express = require('express');
const router = express.Router();
const orderController = require('../Controllers/orderController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', orderController.listAll);
router.post('/', orderController.create);
router.get('/manager/history', verifyToken, requireRole('manager'), orderController.listManagerHistory);
router.get('/history/:user_id', orderController.listHistoryByUser);
router.get('/user/:user_id', orderController.listByUser);
router.get('/:id', orderController.getOne);
router.patch('/:id/status', orderController.advanceStatus);
router.patch('/:id/finish', orderController.finishOrder);
router.patch('/:id/pay', orderController.markPaid);

module.exports = router;
