const express = require('express');
const router = express.Router();
const adminMiddleware = require('../middleware/adminMiddleware');
const { getAllDrivers, blockDriver, getSystemStatus, toggleSystem } = require('../controllers/adminController');

// Barcha haydovchilar
router.get('/drivers', adminMiddleware, getAllDrivers);

// Haydovchini bloklash/ochish
router.put('/driver/:id/block', adminMiddleware, blockDriver);

// Tizim holati
router.get('/system-status', adminMiddleware, getSystemStatus);

// Tizimni yoqish/o'chirish
router.post('/system-toggle', adminMiddleware, toggleSystem);

module.exports = router;