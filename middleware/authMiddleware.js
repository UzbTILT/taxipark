const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Token yo\'q! Iltimos login qiling.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await pool.query(
      'SELECT * FROM drivers WHERE id = $1', [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Haydovchi topilmadi!' });
    }

    if (result.rows[0].is_blocked) {
      return res.status(403).json({ message: 'Hisobingiz bloklangan! Adminga murojaat qiling.' });
    }

    req.driver = result.rows[0];
    next();
  } catch (error) {
    res.status(401).json({ message: 'Token noto\'g\'ri!' });
  }
};

module.exports = authMiddleware;