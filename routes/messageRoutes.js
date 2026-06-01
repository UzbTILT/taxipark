const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { broadcastMessage, getMyMessages, markAllRead, savePushToken } = require('../controllers/messageController');

// Dispetcher — barcha haydovchilarga xabar yuborish
router.post('/broadcast', broadcastMessage);

// Haydovchi — o'z xabarlarini olish
router.get('/my', authMiddleware, getMyMessages);

// Haydovchi — hammasini o'qilgan deb belgilash
router.put('/read-all', authMiddleware, markAllRead);

// Haydovchi — push token saqlash
router.post('/push-token', authMiddleware, savePushToken);

module.exports = router;
