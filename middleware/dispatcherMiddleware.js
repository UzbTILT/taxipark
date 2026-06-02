const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const getSystemOnline = async () => {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'system_online'");
  return result.rows[0]?.value === 'true';
};

const dispatcherMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token yo\'q! Iltimos login qiling.' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'dispatcher') {
      return res.status(403).json({ message: 'Ruxsat yo\'q!' });
    }
    req.dispatcher = decoded;

    const isOnline = await getSystemOnline();
    if (!isOnline) {
      return res.status(503).json({
        message: 'Tizim vaqtincha o\'chirilgan. Admin tomonidan bloklangan.',
        system_offline: true,
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token noto\'g\'ri yoki muddati tugagan!' });
  }
};

module.exports = dispatcherMiddleware;
