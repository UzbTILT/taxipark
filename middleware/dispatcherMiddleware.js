const dispatcherMiddleware = (req, res, next) => {
  const key = req.headers['x-dispatcher-key'];
  if (!key || key !== process.env.DISPATCHER_API_KEY) {
    return res.status(401).json({ message: 'Ruxsat yo\'q! Dispetcher kaliti noto\'g\'ri.' });
  }
  next();
};

module.exports = dispatcherMiddleware;
