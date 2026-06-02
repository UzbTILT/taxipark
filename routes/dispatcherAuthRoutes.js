const express = require('express');
const router = express.Router();
const { registerDispatcher, loginDispatcher } = require('../controllers/dispatcherAuthController');

router.post('/register', registerDispatcher);
router.post('/login', loginDispatcher);

module.exports = router;
