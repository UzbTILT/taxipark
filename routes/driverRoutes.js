const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const pool = require('../config/db');

// Haydovchi o'z ma'lumotlarini olish
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({ driver: req.driver });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!' });
  }
});

// Haydovchi online/offline holati
router.put('/status', authMiddleware, async (req, res) => {
  try {
    const { is_online } = req.body;
    await pool.query(
      'UPDATE drivers SET is_online = $1 WHERE id = $2',
      [is_online, req.driver.id]
    );
    res.json({ message: is_online ? 'Siz onlinesiz!' : 'Siz offlinedasiz!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!' });
  }
});

// Haydovchi GPS joylashuvini yuborish
router.put('/location', authMiddleware, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    await pool.query(
      'UPDATE drivers SET latitude = $1, longitude = $2 WHERE id = $3',
      [latitude, longitude, req.driver.id]
    );
    res.json({ message: 'Joylashuv yangilandi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!' });
  }
});

module.exports = router;