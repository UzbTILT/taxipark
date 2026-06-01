const express = require('express');
const router = express.Router();
const { getAllDrivers, blockDriver, getSystemStatus, toggleSystem } = require('../controllers/adminController');

// Barcha haydovchilar
router.get('/drivers', getAllDrivers);

// Haydovchini bloklash/ochish
router.put('/driver/:id/block', blockDriver);

// Tizim holati
router.get('/system-status', getSystemStatus);

// Tizimni yoqish/o'chirish
router.post('/system-toggle', toggleSystem);

module.exports = router;