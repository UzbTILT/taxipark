const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { TARIFF_PLANS } = require('../constants');

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

const getSystemOnline = async () => {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'system_online'");
  return result.rows[0]?.value === 'true';
};

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

const blockDriver = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_blocked } = req.body;
    await pool.query('UPDATE drivers SET is_blocked = $1 WHERE id = $2', [is_blocked, id]);
    res.json({ message: is_blocked ? 'Haydovchi bloklandi!' : 'Haydovchi blokdan chiqarildi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

const getSystemStatus = async (req, res) => {
  try {
    const isOnline = await getSystemOnline();
    res.json({ is_online: isOnline });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

const toggleSystem = async (req, res) => {
  try {
    const { is_online } = req.body;
    await pool.query(
      "UPDATE settings SET value = $1 WHERE key = 'system_online'",
      [is_online ? 'true' : 'false']
    );
    if (!is_online) {
      await pool.query('UPDATE drivers SET is_online = false');
      if (global.io) global.io.emit('system_offline', { message: 'Tizim vaqtincha o\'chirildi.' });
    } else {
      if (global.io) global.io.emit('system_online', { message: 'Tizim yana ishlayapti!' });
    }
    res.json({ message: is_online ? 'Tizim yoqildi!' : 'Tizim o\'chirildi!', is_online });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

const getAllDispatchers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, full_name, created_at FROM dispatchers ORDER BY created_at DESC'
    );
    res.json({ dispatchers: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

const resetDispatcherPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak!' });
    }
    const hashed = await bcrypt.hash(new_password, 12);
    const result = await pool.query(
      'UPDATE dispatchers SET password = $1 WHERE id = $2 RETURNING username, full_name',
      [hashed, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dispetcher topilmadi!' });
    }
    res.json({ message: `${result.rows[0].full_name} paroli muvaffaqiyatli yangilandi!` });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

const resetDriverPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak!' });
    }
    const hashed = await bcrypt.hash(new_password, 10);
    const result = await pool.query(
      'UPDATE drivers SET password = $1 WHERE id = $2 RETURNING full_name, phone',
      [hashed, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Haydovchi topilmadi!' });
    }
    res.json({ message: `${result.rows[0].full_name} paroli muvaffaqiyatli yangilandi!` });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

const deleteDispatcher = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM dispatchers WHERE id = $1 RETURNING username, full_name',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dispetcher topilmadi!' });
    }
    res.json({ message: `${result.rows[0].full_name} o'chirildi!` });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

const activateDriverTariff = async (req, res) => {
  try {
    const { id } = req.params;
    const { tariff_type } = req.body;
    const plan = TARIFF_PLANS.find(p => p.id === tariff_type);
    if (!plan) return res.status(400).json({ message: 'Noto\'g\'ri tarif turi!' });

    let expires_at = null;
    if (plan.duration_hours) {
      expires_at = new Date(Date.now() + plan.duration_hours * 60 * 60 * 1000);
    }

    const result = await pool.query(
      'UPDATE drivers SET tariff_type = $1, tariff_expires_at = $2 WHERE id = $3 RETURNING full_name, phone',
      [tariff_type, expires_at, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Haydovchi topilmadi!' });

    if (global.connectedDrivers && global.io) {
      const socketId = global.connectedDrivers[parseInt(id)];
      if (socketId) {
        global.io.to(socketId).emit('tariff_activated', {
          tariff_type,
          tariff_expires_at: expires_at,
        });
      }
    }

    res.json({
      message: `${result.rows[0].full_name} uchun ${plan.name} tarifi faollashtirildi!`,
      tariff_type,
      tariff_expires_at: expires_at,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

module.exports = {
  getAllDrivers,
  blockDriver,
  getSystemStatus,
  toggleSystem,
  getAllDispatchers,
  resetDispatcherPassword,
  resetDriverPassword,
  deleteDispatcher,
  activateDriverTariff,
};
