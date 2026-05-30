const express = require('express');
const router = express.Router();
const { getAllDrivers, blockDriver } = require('../controllers/adminController');

// Barcha haydovchilar
router.get('/drivers', getAllDrivers);

// Haydovchini bloklash/ochish
router.put('/driver/:id/block', blockDriver);

module.exports = router;