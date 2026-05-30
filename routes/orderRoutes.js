const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const {
  createOrder,
  assignOrder,
  startOrder,
  finishOrder,
  acceptOrder,
  rejectOrder,
  getDriverOrders,
  getAllOrders,
  sendToDriver
} = require('../controllers/orderController');

// Dispetcher - yangi buyurtma yaratish
router.post('/create', createOrder);

// Dispetcher - haydovchiga buyurtma yuborish
router.post('/assign', assignOrder);

// Dispetcher - barcha buyurtmalar
router.get('/all', getAllOrders);

// Haydovchi - zakazni qabul qilish
router.post('/accept', authMiddleware, acceptOrder);

// Haydovchi - zakazni rad etish
router.post('/reject', authMiddleware, rejectOrder);

// Haydovchi - buyurtmani boshlash
router.post('/start', authMiddleware, startOrder);

// Haydovchi - buyurtmani tugatish
router.post('/finish', authMiddleware, finishOrder);

// Haydovchi - o'z buyurtmalari tarixi
router.get('/my-orders', authMiddleware, getDriverOrders);

// Faqat bir haydovchiga yuborish
router.post('/send-to-driver', sendToDriver);

module.exports = router;