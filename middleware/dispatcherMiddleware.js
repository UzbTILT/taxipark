const jwt = require('jsonwebtoken');

const dispatcherMiddleware = (req, res, next) => {
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
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token noto\'g\'ri yoki muddati tugagan!' });
  }
};

module.exports = dispatcherMiddleware;
