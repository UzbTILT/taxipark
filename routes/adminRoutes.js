const express = require('express');
const router = express.Router();
const adminMiddleware = require('../middleware/adminMiddleware');
const {
  getAllDrivers,
  blockDriver,
  getSystemStatus,
  toggleSystem,
  getAllDispatchers,
  resetDispatcherPassword,
  resetDriverPassword,
  deleteDispatcher,
  activateDriverTariff,
} = require('../controllers/adminController');
const { TARIFF_PLANS } = require('../constants');

router.get('/drivers', adminMiddleware, getAllDrivers);
router.put('/driver/:id/block', adminMiddleware, blockDriver);
router.post('/driver/:id/reset-password', adminMiddleware, resetDriverPassword);

router.get('/dispatchers', adminMiddleware, getAllDispatchers);
router.post('/dispatcher/:id/reset-password', adminMiddleware, resetDispatcherPassword);
router.delete('/dispatcher/:id', adminMiddleware, deleteDispatcher);

router.post('/driver/:id/activate-tariff', adminMiddleware, activateDriverTariff);

router.get('/system-status', adminMiddleware, getSystemStatus);
router.post('/system-toggle', adminMiddleware, toggleSystem);

// Tarif rejalari ro'yxati (public)
router.get('/tariff-plans', (req, res) => res.json({ plans: TARIFF_PLANS }));

module.exports = router;
