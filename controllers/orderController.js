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

    res.status(201).json({
      message: 'Buyurtma yaratildi!',
      order: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Buyurtmani haydovchiga yuborish
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

    // Tuzatish: SQL parametrlar tartibi to'g'rilandi
    await pool.query(
      'UPDATE orders SET status = $1, started_at = NOW(), driver_id = $2 WHERE id = $3',
      ['started', req.driver.id, order_id]
    );

    res.json({ message: 'Reys boshlandi!' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Buyurtmani tugatish — narx backendda hisoblanadi
const finishOrder = async (req, res) => {
  try {
    const { order_id, distance_km, pause_minutes, extra_price, extra_services } = req.body;

    // 1. VAQTNI TOSHKENТ SOATIGA O'GIRISH (0-23 raqam qaytaradi)
    const tashkentHour = parseInt(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false })
    );

    // 2. SIZ AYTGAN VAQT CHEGARA SHARTI:
    // Kunduzi: 06:00 dan 18:00 gacha (ya'ni soat 6 dan 17 gacha bo'lgan vaqt)
    // Kechasi: 18:01 dan 05:59 gacha (ya'ni soat 18 va undan katta yoki soat 6 dan kichik bo'lsa)
    const isNight = tashkentHour >= 18 || tashkentHour < 6;

    const BASE_PRICE = 500;
    const km = parseFloat(distance_km) || 0;
    const pauseMin = parseFloat(pause_minutes) || 0;

    // Km narx hisoblash (regressive tarif)
    let totalKmPrice = 0;

    if (isNight) {
      // Tun: 1km=6000, 2km=5000, 3km=4000, 4km=3000, 5km+=2000
      if (km <= 1)      totalKmPrice = km * 6000;
      else if (km <= 2) totalKmPrice = 6000 + (km - 1) * 5000;
      else if (km <= 3) totalKmPrice = 6000 + 5000 + (km - 2) * 4000;
      else if (km <= 4) totalKmPrice = 6000 + 5000 + 4000 + (km - 3) * 3000;
      else              totalKmPrice = 6000 + 5000 + 4000 + 3000 + (km - 4) * 2000;
    } else {
      // Kunduz: 1km=4000, 2km=3000, 3km+=2000
      if (km <= 1)      totalKmPrice = km * 4000;
      else if (km <= 2) totalKmPrice = 4000 + (km - 1) * 3000;
      else              totalKmPrice = 4000 + 3000 + (km - 2) * 2000;
    }

    // Pauza narxi: har 1 daqiqa = 200 so'm
    const pausePrice = Math.round(pauseMin * 200);

    const extraAmount = parseFloat(extra_price) || 0;
    const total_price = Math.round(BASE_PRICE + totalKmPrice + pausePrice + extraAmount);

    await pool.query(
      'UPDATE orders SET status = $1, finished_at = NOW(), total_price = $2, extra_services = $3 WHERE id = $4',
      ['finished', total_price, JSON.stringify(extra_services || []), order_id]
    );

    res.json({
      message: 'Reys tugadi!',
      total_price,
      distance_km: km,
      pause_minutes: pauseMin,
      pause_price: pausePrice,
      extra_price: extraAmount,
      is_night: isNight,
      tashkent_hour: tashkentHour
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Zakazni qabul qilish
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

// Zakazni rad etish
const rejectOrder = async (req, res) => {
  try {
    const { order_id } = req.body;

    const orderResult = await pool.query(
      `SELECT orders.*, drivers.full_name as driver_name 
       FROM orders 
       JOIN drivers ON orders.driver_id = drivers.id 
       WHERE orders.id = $1`,
      [order_id]
    );
    const order = orderResult.rows[0];

    await pool.query(
      'UPDATE orders SET status = $1, driver_id = NULL WHERE id = $2',
      ['new', order_id]
    );

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

// Haydovchi buyurtmalari tarixi
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

    if (global.connectedDrivers && global.connectedDrivers[driver_id]) {
      global.io.to(global.connectedDrivers[driver_id]).emit('new_order', order);
    }

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
    }, 1 * 60 * 1000);

    res.json({ message: 'Haydovchiga yuborildi!' });
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
  rejectOrder,
  getDriverOrders,
  getAllOrders,
  sendToDriver
};