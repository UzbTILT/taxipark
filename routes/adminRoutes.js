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
} = require('../controllers/adminController');

router.get('/drivers', adminMiddleware, getAllDrivers);
router.put('/driver/:id/block', adminMiddleware, blockDriver);
router.post('/driver/:id/reset-password', adminMiddleware, resetDriverPassword);

router.get('/dispatchers', adminMiddleware, getAllDispatchers);
router.post('/dispatcher/:id/reset-password', adminMiddleware, resetDispatcherPassword);
router.delete('/dispatcher/:id', adminMiddleware, deleteDispatcher);

router.get('/system-status', adminMiddleware, getSystemStatus);
router.post('/system-toggle', adminMiddleware, toggleSystem);

module.exports = router;
