const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  getDailyReport,
  makePayment,
  confirmPayment,
  getAllPayments
} = require('../controllers/paymentController');

// Haydovchi - kunlik hisobot
router.get('/daily-report', authMiddleware, getDailyReport);

// Haydovchi - to'lov qilish
router.post('/pay', authMiddleware, makePayment);

// Admin - to'lovni tasdiqlash
router.post('/confirm', confirmPayment);

// Admin - barcha to'lovlar
router.get('/all', getAllPayments);

module.exports = router;