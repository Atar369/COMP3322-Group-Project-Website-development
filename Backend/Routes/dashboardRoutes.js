const express = require('express');
const router = express.Router();

const {dashboardData} = require('../Controllers/dashboardController');

const {protect, managerOnly} = require('../middleware/authMiddleware');

router.use((request, response, next) => {
    console.info(`[Dashboard Route Access] ${request.method} ${request.originalUrl} | IP: ${request.ip} | Time: ${new Date().toISOString()}`);
    next();
});

router.get(
    '/dashboard', 
    protect, 
    managerOnly, 
    dashboardData
);

module.exports = router;