const pool = require('../config/db');

// Settings jadvalini yaratish va boshlang'ich qiymat qo'yish
const initSettings = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await pool.query(`
    INSERT INTO settings (key, value) VALUES ('system_online', 'true')
    ON CONFLICT (key) DO NOTHING
  `);
};
initSettings().catch(err => console.error('Settings init xatosi:', err));

// Tizim holatini DB dan o'qish
const getSystemOnline = async () => {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'system_online'");
  return result.rows[0]?.value === 'true';
};

// Barcha haydovchilar
const getAllDrivers = async (req, res) => {
  try {
    const isOnline = await getSystemOnline();
    if (!isOnline) {
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
  try {
    const isOnline = await getSystemOnline();
    res.json({ is_online: isOnline });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Tizimni yoqish/o'chirish
const toggleSystem = async (req, res) => {
  try {
    const { is_online } = req.body;

    // DB ga saqlash — server restart bo'lsa ham holat saqlanadi
    await pool.query(
      "UPDATE settings SET value = $1 WHERE key = 'system_online'",
      [is_online ? 'true' : 'false']
    );

    if (!is_online) {
      await pool.query('UPDATE drivers SET is_online = false');
      if (global.io) {
        global.io.emit('system_offline', {
          message: 'Tizim vaqtincha o\'chirildi. Keyinroq urinib ko\'ring.'
        });
      }
    } else {
      if (global.io) {
        global.io.emit('system_online', { message: 'Tizim yana ishlayapti!' });
      }
    }

    res.json({
      message: is_online ? 'Tizim yoqildi!' : 'Tizim o\'chirildi!',
      is_online
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

module.exports = { getAllDrivers, blockDriver, getSystemStatus, toggleSystem };