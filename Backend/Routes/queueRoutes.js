const express = require('express');
const router = express.Router();
const queueController = require('../Controllers/queueController');

router.get('/', queueController.listAll);
router.post('/', queueController.join);
router.get('/user/:user_id', queueController.listByUser);
router.patch('/:id/call', queueController.call);
router.patch('/:id/checkin', queueController.checkin);
router.patch('/:id/finish', queueController.finish);
router.patch('/:id/pay', queueController.pay);
router.patch('/:id/cancel', queueController.cancel);

module.exports = router;
