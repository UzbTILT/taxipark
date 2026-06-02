const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Telefon raqam formati tekshirish: +998XXXXXXXXX
const isValidPhone = (phone) => /^\+998\d{9}$/.test(phone);

// Haydovchi ro'yxatdan o'tish
const register = async (req, res) => {
  try {
    const { full_name, phone, password, car_model, car_number } = req.body;

    if (!full_name?.trim()) {
      return res.status(400).json({ message: 'Ism kiritilishi shart!' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Telefon raqam noto\'g\'ri! Namuna: +998901234567' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak!' });
    }
    if (!car_model?.trim() || !car_number?.trim()) {
      return res.status(400).json({ message: 'Mashina modeli va raqami kiritilishi shart!' });
    }

    // Telefon raqam mavjudmi tekshirish
    const exists = await pool.query(
      'SELECT * FROM drivers WHERE phone = $1', [phone]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Bu raqam allaqachon ro\'yxatdan o\'tgan!' });
    }

    // Parolni shifrlash
    const hashedPassword = await bcrypt.hash(password, 10);

    // Haydovchini saqlash
    const result = await pool.query(
      `INSERT INTO drivers (full_name, phone, password, car_model, car_number)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, phone`,
      [full_name, phone, hashedPassword, car_model, car_number]
    );

    res.status(201).json({
      message: 'Ro\'yxatdan o\'tildi!',
      driver: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Haydovchi login
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Telefon raqam noto\'g\'ri! Namuna: +998901234567' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Parol kiritilishi shart!' });
    }

    // Haydovchini topish
    const result = await pool.query(
      'SELECT * FROM drivers WHERE phone = $1', [phone]
    );
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Telefon raqam yoki parol noto\'g\'ri!' });
    }

    const driver = result.rows[0];

    // Bloklangan mi tekshirish
    if (driver.is_blocked) {
      return res.status(403).json({ message: 'Hisobingiz bloklangan! Adminga murojaat qiling.' });
    }

    // Parolni tekshirish
    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Telefon raqam yoki parol noto\'g\'ri!' });
    }

    // Token yaratish
    const token = jwt.sign(
      { id: driver.id, phone: driver.phone },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Muvaffaqiyatli kirildi!',
      token,
      driver: {
        id: driver.id,
        full_name: driver.full_name,
        phone: driver.phone,
        car_model: driver.car_model,
        car_number: driver.car_number,
        is_blocked: driver.is_blocked
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

module.exports = { register, login };