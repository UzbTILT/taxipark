const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');
const tokenMiddleware = require('../middleware/tokenMiddleware');
const pool = require('../config/db');
const { TARIFF_PLANS } = require('../constants');

router.post('/register', register);
router.post('/login', login);

// Haydovchi tarif tanlaydi (faqat per_order avtomatik faol bo'ladi)
router.post('/select-tariff', tokenMiddleware, async (req, res) => {
  try {
    const { tariff_type } = req.body;
    const plan = TARIFF_PLANS.find(p => p.id === tariff_type);
    if (!plan) return res.status(400).json({ message: 'Noto\'g\'ri tarif!' });

    if (tariff_type === 'per_order') {
      await pool.query(
        'UPDATE drivers SET tariff_type = $1, tariff_expires_at = NULL WHERE id = $2',
        ['per_order', req.driver.id]
      );
      return res.json({ message: 'Donali tarif faollashtirildi!', tariff_type: 'per_order', tariff_expires_at: null });
    }

    // To'lovli tarif — dispetcher faollashtiradi, hozircha null saqlanadi
    return res.json({
      message: `${plan.name} tarifi tanlandi. To'lovdan so'ng dispetcherga murojaat qiling.`,
      tariff_type: null,
      pending: tariff_type,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi!' });
  }
});

// Haydovchi joriy tarif holatini oladi
router.get('/tariff-status', tokenMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT tariff_type, tariff_expires_at FROM drivers WHERE id = $1',
      [req.driver.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Topilmadi!' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server xatosi!' });
  }
});

module.exports = router;
