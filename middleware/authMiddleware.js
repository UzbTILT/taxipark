const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token yo\'q! Iltimos login qiling.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query('SELECT * FROM drivers WHERE id = $1', [decoded.id]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Haydovchi topilmadi!' });
    }

    const driver = result.rows[0];

    if (driver.is_blocked) {
      return res.status(403).json({ message: 'Hisobingiz bloklangan! Adminga murojaat qiling.' });
    }

    // Tarif tekshirish (per_order uchun cheksiz)
    if (driver.tariff_type && driver.tariff_type !== 'per_order') {
      if (!driver.tariff_expires_at || new Date(driver.tariff_expires_at) < new Date()) {
        return res.status(403).json({
          message: 'Tarifingiz tugadi! Dispetcherga murojaat qiling.',
          tariff_expired: true,
        });
      }
    }

    req.driver = driver;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token noto\'g\'ri!' });
  }
};

module.exports = authMiddleware;
