const pool = require('../config/db');

// Yangi buyurtma yaratish (dispetcher)
const createOrder = async (req, res) => {
  try {
    const { customer_phone, from_address } = req.body;

    if (!customer_phone || !from_address) {
      return res.status(400).json({ message: 'Telefon va manzil kiritilishi shart!' });
    }

    const base_price = 500;

    const result = await pool.query(
      `INSERT INTO orders 
       (customer_phone, from_address, base_price, total_price)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [customer_phone, from_address, base_price, base_price]
    );

    // ❌ Bu yerda socket YUBORILMAYDI — faqat dispetcher ko'radi
    // Haydovchiga faqat "Yuborish" tugmasidan signal ketadi

    res.status(201).json({
      message: 'Buyurtma yaratildi!',
      order: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Buyurtmani haydovchiga yuborish (faqat status o'zgartiradi)
const assignOrder = async (req, res) => {
  try {
    const { order_id, driver_id } = req.body;

    await pool.query(
      'UPDATE orders SET status = $1, driver_id = $2 WHERE id = $3',
      ['assigned', driver_id, order_id]
    );

    res.json({ message: 'Buyurtma haydovchiga yuborildi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Buyurtmani boshlash (haydovchi BOSHLASH tugmasini bosadi)
const startOrder = async (req, res) => {
  try {
    const { order_id } = req.body;

    await pool.query(
      'UPDATE orders SET status = $1, started_at = NOW(), driver_id = $2 WHERE id = $3',
      ['started', req.driver.id, order_id]
    );

    res.json({ message: 'Reys boshlandi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Buyurtmani tugatish (haydovchi)
const finishOrder = async (req, res) => {
  try {
    const { order_id, total_price } = req.body;

    await pool.query(
      'UPDATE orders SET status = $1, finished_at = NOW(), total_price = $2 WHERE id = $3',
      ['finished', total_price, order_id]
    );

    res.json({ message: 'Reys tugadi!', total_price });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// ✅ YANGI — Zakazni qabul qilish (haydovchi QABUL QILISH tugmasini bosadi)
const acceptOrder = async (req, res) => {
  try {
    const { order_id } = req.body;

    await pool.query(
      'UPDATE orders SET status = $1 WHERE id = $2',
      ['accepted', order_id]
    );

    res.json({ message: 'Zakaz qabul qilindi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Haydovchi buyurtmalarini olish
const getDriverOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM orders 
       WHERE driver_id = $1 
       ORDER BY created_at DESC`,
      [req.driver.id]
    );

    res.json({ orders: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Barcha buyurtmalar (dispetcher)
const getAllOrders = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    res.json({ orders: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Faqat bir haydovchiga yuborish + 1 daqiqa timeout
const sendToDriver = async (req, res) => {
  try {
    const { order_id, driver_id } = req.body;

    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1', [order_id]
    );
    const order = orderResult.rows[0];

    // Faqat o'sha haydovchiga socket yuborish
    if (global.connectedDrivers && global.connectedDrivers[driver_id]) {
      global.io.to(global.connectedDrivers[driver_id]).emit('new_order', order);
    }

    // ✅ 1 daqiqada qabul qilmasa (status hali 'assigned') — hammaga yuborish
    setTimeout(async () => {
      const check = await pool.query(
        'SELECT * FROM orders WHERE id = $1 AND status = $2',
        [order_id, 'assigned']
      );
      if (check.rows.length > 0) {
        await pool.query(
          'UPDATE orders SET driver_id = NULL, status = $1 WHERE id = $2',
          ['new', order_id]
        );
        global.io.emit('new_order', order);
      }
    }, 1 * 60 * 1000); // ✅ 1 daqiqa (oldin 5 daqiqa edi)

    res.json({ message: 'Haydovchiga yuborildi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};
const rejectOrder = async (req, res) => {
  try {
    const { order_id } = req.body;

    // Haydovchi ismini olamiz
    const orderResult = await pool.query(
      `SELECT orders.*, drivers.full_name as driver_name 
       FROM orders 
       JOIN drivers ON orders.driver_id = drivers.id 
       WHERE orders.id = $1`,
      [order_id]
    );
    const order = orderResult.rows[0];

    // Status yangilash
    await pool.query(
      'UPDATE orders SET status = $1, driver_id = NULL WHERE id = $2',
      ['new', order_id]
    );

    // ✅ Backend orqali dispetcherga socket xabar
    if (global.io) {
      global.io.emit('order_rejected', {
        order_id: order_id,
        driver_name: order?.driver_name || 'Haydovchi'
      });
    }

    res.json({ message: 'Zakaz rad etildi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};
module.exports = {
  createOrder,
  assignOrder,
  startOrder,
  finishOrder,
  acceptOrder,
  rejectOrder,  // ✅ YANGI
  getDriverOrders,
  getAllOrders,
  sendToDriver
};