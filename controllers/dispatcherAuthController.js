const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const initTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispatchers (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
};
initTable().catch(err => console.error('Dispatchers table init xatosi:', err));

const registerDispatcher = async (req, res) => {
  try {
    const { username, password, full_name } = req.body;

    if (!username?.trim() || !full_name?.trim()) {
      return res.status(400).json({ message: 'Barcha maydonlar to\'ldirilishi shart!' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak!' });
    }

    const exists = await pool.query('SELECT id FROM dispatchers WHERE username = $1', [username.trim()]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'Bu username band! Boshqa tanlang.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO dispatchers (username, password, full_name) VALUES ($1, $2, $3) RETURNING id, username, full_name',
      [username.trim(), hashed, full_name.trim()]
    );

    res.status(201).json({ message: 'Muvaffaqiyatli ro\'yxatdan o\'tildi!', dispatcher: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

const loginDispatcher = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({ message: 'Username va parol kiritilishi shart!' });
    }

    const result = await pool.query('SELECT * FROM dispatchers WHERE username = $1', [username.trim()]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Username yoki parol noto\'g\'ri!' });
    }

    const dispatcher = result.rows[0];
    const isMatch = await bcrypt.compare(password, dispatcher.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Username yoki parol noto\'g\'ri!' });
    }

    const token = jwt.sign(
      { id: dispatcher.id, username: dispatcher.username, role: 'dispatcher' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Muvaffaqiyatli kirildi!',
      token,
      dispatcher: { id: dispatcher.id, username: dispatcher.username, full_name: dispatcher.full_name }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

module.exports = { registerDispatcher, loginDispatcher };
