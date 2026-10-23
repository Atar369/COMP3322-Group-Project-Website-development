const express = require('express');
const router = express.Router();
const orderController = require('../Controllers/orderController');

router.get('/', orderController.listAll);
router.post('/', orderController.create);
router.get('/user/:user_id', orderController.listByUser);
router.get('/:id', orderController.getOne);
router.patch('/:id/status', orderController.advanceStatus);
router.patch('/:id/finish', orderController.finishOrder);
router.patch('/:id/pay', orderController.markPaid);

module.exports = router;
