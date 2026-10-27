const express = require('express');
const router = express.Router();
const queueController = require('../Controllers/queueController'); 
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Public / Shared Routes 
router.get('/', queueController.listAll); // Consider protecting this if it contains PII
router.get('/user/:user_id', verifyToken, queueController.listByUser); 

// Customer Routes
router.post('/', verifyToken, requireRole('customer'), queueController.join);
router.post('/:id/rejoin', verifyToken, requireRole('customer'), queueController.customerRejoin);
router.patch('/:id/cancel', verifyToken, queueController.cancel); // Both manager and customer can cancel

// Manager Only Routes
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