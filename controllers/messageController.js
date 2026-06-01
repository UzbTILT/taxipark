const pool = require('../config/db');

// Barcha haydovchilarga xabar yuborish (bazaga saqlash)
const broadcastMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Xabar matni kiritilishi shart!' });
    }

    // Barcha haydovchilarni olish
    const driversResult = await pool.query('SELECT id, expo_push_token FROM drivers WHERE is_blocked = false');
    const drivers = driversResult.rows;

    // Har bir haydovchi uchun bazaga saqlash
    for (const driver of drivers) {
      await pool.query(
        'INSERT INTO messages (driver_id, message) VALUES ($1, $2)',
        [driver.id, message.trim()]
      );
    }

    // Socket orqali yuborish (ilova ochiq bo'lsa)
    if (global.io) {
      global.io.emit('broadcast_message', {
        message: message.trim(),
        sent_at: new Date().toISOString()
      });
    }

    // Expo push notification yuborish (token bo'lgan haydovchilarga)
    const pushTokens = drivers
      .filter(d => d.expo_push_token)
      .map(d => d.expo_push_token);

    if (pushTokens.length > 0) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(pushTokens.map(token => ({
            to: token,
            title: '🚖 TaxiPark',
            body: message.trim(),
            sound: 'default',
            badge: 1,
          })))
        });
      } catch (pushErr) {
        console.log('Push yuborishda xato:', pushErr.message);
      }
    }

    res.json({
      message: 'Xabar yuborildi!',
      total_drivers: drivers.length,
      push_sent: pushTokens.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Haydovchining xabarlarini olish
const getMyMessages = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM messages 
       WHERE driver_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [req.driver.id]
    );

    // O'qilmagan xabarlar soni
    const unreadResult = await pool.query(
      'SELECT COUNT(*) FROM messages WHERE driver_id = $1 AND is_read = false',
      [req.driver.id]
    );

    res.json({
      messages: result.rows,
      unread_count: parseInt(unreadResult.rows[0].count)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Xabarlarni o'qilgan deb belgilash
const markAllRead = async (req, res) => {
  try {
    await pool.query(
      'UPDATE messages SET is_read = true WHERE driver_id = $1',
      [req.driver.id]
    );

    res.json({ message: 'Barcha xabarlar o\'qildi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Expo push token saqlash
const savePushToken = async (req, res) => {
  try {
    const { expo_push_token } = req.body;

    await pool.query(
      'UPDATE drivers SET expo_push_token = $1 WHERE id = $2',
      [expo_push_token, req.driver.id]
    );

    res.json({ message: 'Token saqlandi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

module.exports = { broadcastMessage, getMyMessages, markAllRead, savePushToken };
