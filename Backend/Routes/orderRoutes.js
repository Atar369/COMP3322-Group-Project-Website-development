const express = require('express');
const router = express.Router();
const orderController = require('../Controllers/orderController');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', verifyToken, requireRole('manager'), orderController.listAll);
router.post('/', verifyToken, requireRole('customer'), orderController.create);
router.get('/manager/history', verifyToken, requireRole('manager'), orderController.listManagerHistory);
router.get('/history/:user_id/review-dishes', verifyToken, requireRole('customer'), orderController.listPaidReviewDishes);
router.get('/history/:user_id', verifyToken, requireRole('customer'), orderController.listHistoryByUser);
router.get('/user/:user_id', verifyToken, requireRole('customer'), orderController.listByUser);
router.get('/:id', verifyToken, requireRole('customer'), orderController.getOne);
router.patch('/:id/status', verifyToken, requireRole('manager'), orderController.advanceStatus);
router.patch('/:id/finish', verifyToken, requireRole('customer'), orderController.finishOrder);
router.patch('/:id/pay', verifyToken, requireRole('manager'), orderController.markPaid);

module.exports = router;
