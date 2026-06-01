const pool = require('../config/db');

// Tizim holati (xotirada saqlanadi)
let systemOnline = true;

// Barcha haydovchilar
const getAllDrivers = async (req, res) => {
  try {
    // Tizim o'chiq bo'lsa — 503
    if (!systemOnline) {
      return res.status(503).json({ message: 'Tizim vaqtincha o\'chiq!' });
    }
    const result = await pool.query(
      'SELECT id, full_name, phone, car_model, car_number, is_online, is_blocked, latitude, longitude, created_at FROM drivers ORDER BY created_at DESC'
    );
    res.json({ drivers: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Haydovchini bloklash/ochish
const blockDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_blocked } = req.body;

    await pool.query(
      'UPDATE drivers SET is_blocked = $1 WHERE id = $2',
      [is_blocked, id]
    );

    res.json({ message: is_blocked ? 'Haydovchi bloklandi!' : 'Haydovchi blokdan chiqarildi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Tizim holatini olish
const getSystemStatus = async (req, res) => {
  res.json({ is_online: systemOnline });
};

// Tizimni yoqish/o'chirish
const toggleSystem = async (req, res) => {
  try {
    const { is_online } = req.body;
    systemOnline = is_online;

    if (!is_online) {
      // Barcha haydovchilarni offline qilish
      await pool.query('UPDATE drivers SET is_online = false');

      // Socket orqali barcha haydovchilarga signal
      if (global.io) {
        global.io.emit('system_offline', {
          message: 'Tizim vaqtincha o\'chirildi. Keyinroq urinib ko\'ring.'
        });
      }
    } else {
      // Tizim yoqildi
      if (global.io) {
        global.io.emit('system_online', {
          message: 'Tizim yana ishlayapti!'
        });
      }
    }

    res.json({
      message: is_online ? 'Tizim yoqildi!' : 'Tizim o\'chirildi!',
      is_online: systemOnline
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

module.exports = { getAllDrivers, blockDriver, getSystemStatus, toggleSystem, systemOnline: () => systemOnline };