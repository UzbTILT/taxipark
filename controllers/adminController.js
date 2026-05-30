const pool = require('../config/db');

// Barcha haydovchilar
const getAllDrivers = async (req, res) => {
  try {
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

module.exports = { getAllDrivers, blockDriver };