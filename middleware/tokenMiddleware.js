const jwt = require('jsonwebtoken');

// Faqat token tekshiradi — tarif va blok holati tekshirilmaydi
const tokenMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token yo\'q!' });
  try {
    req.driver = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Token noto\'g\'ri!' });
  }
};

module.exports = tokenMiddleware;
