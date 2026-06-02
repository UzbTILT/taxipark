const adminMiddleware = (req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return res.status(401).json({ message: 'Ruxsat yo\'q! Admin kaliti noto\'g\'ri.' });
  }
  next();
};

module.exports = adminMiddleware;
