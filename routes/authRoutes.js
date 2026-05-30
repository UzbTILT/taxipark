const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/authController');

// Ro'yxatdan o'tish
router.post('/register', register);

// Kirish
router.post('/login', login);

module.exports = router;