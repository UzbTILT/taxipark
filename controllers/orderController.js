const pool = require('../config/db');
const { BASE_PRICE, COMPANY_SHARE, PAUSE_PRICE_PER_MIN, WAITING_FREE_MINUTES, WAITING_PRICE_PER_MIN, calcKmPrice } = require('../constants');

// company_share kolonini qo'shish (mavjud bo'lmasa)
pool.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS company_share INTEGER DEFAULT 0')
  .catch(err => console.error('company_share column xatosi:', err));

// Yangi buyurtma yaratish (dispetcher)
const createOrder = async (req, res) => {
  try {
    const { customer_phone, from_address } = req.body;

    if (!customer_phone || !from_address) {
      return res.status(400).json({ message: 'Telefon va manzil kiritilishi shart!' });
    }

    const base_price = BASE_PRICE;

    const result = await pool.query(
      `INSERT INTO orders 
        (customer_phone, from_address, base_price, total_price)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
      [customer_phone, from_address, base_price, base_price]
    );

    if (global.io) global.io.emit('orders_updated');
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

    if (global.io) global.io.emit('orders_updated');
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
    const { order_id, distance_km, pause_minutes, waiting_minutes = 0, extra_price, extra_services } = req.body;

    const tashkentHour = parseInt(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false })
    );
    const isNight = tashkentHour >= 18 || tashkentHour < 6;

    const km = parseFloat(distance_km) || 0;
    const pauseMin = parseFloat(pause_minutes) || 0;

    const totalKmPrice = calcKmPrice(km, isNight);
    const pausePrice = Math.round(pauseMin * PAUSE_PRICE_PER_MIN);
    const billableWaiting = Math.max(0, parseFloat(waiting_minutes) - WAITING_FREE_MINUTES);
    const waitingFee = Math.round(billableWaiting * WAITING_PRICE_PER_MIN);
    const extraAmount = parseFloat(extra_price) || 0;
    const total_price = Math.round(BASE_PRICE + totalKmPrice + pausePrice + waitingFee + extraAmount);

    // Faqat donali tarifda kompaniya ulushi olinadi
    const company_share = req.driver.tariff_type === 'per_order' ? COMPANY_SHARE : 0;

    await pool.query(
      'UPDATE orders SET status = $1, finished_at = NOW(), total_price = $2, extra_services = $3, company_share = $4 WHERE id = $5',
      ['finished', total_price, JSON.stringify(extra_services || []), company_share, order_id]
    );

    if (global.io) global.io.emit('orders_updated');
    res.json({
      message: 'Reys tugadi!',
      total_price,
      company_share,
      distance_km: km,
      pause_minutes: pauseMin,
      pause_price: pausePrice,
      waiting_fee: waitingFee,
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

    // Faqat shu haydovchiga assigned bo'lgan va hali accepted bo'lmagan buyurtmani qabul qilish
    // Bu ikki haydovchi bir vaqtda qabul qilishiga yo'l qo'ymaydi
    const result = await pool.query(
      `UPDATE orders SET status = 'accepted'
       WHERE id = $1 AND status = 'assigned' AND driver_id = $2
       RETURNING id`,
      [order_id, req.driver.id]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ message: 'Bu buyurtma allaqachon qabul qilingan yoki sizga tegishli emas!' });
    }

    if (global.io) global.io.emit('orders_updated');
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
      global.io.emit('orders_updated');
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
    const { active, status, limit = 100, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query, params;

    if (active === 'true') {
      // Faqat tugallanmagan buyurtmalar — pagination shart emas
      query = `SELECT * FROM orders WHERE status != 'finished' ORDER BY created_at DESC`;
      params = [];
    } else if (status === 'finished') {
      query = `SELECT * FROM orders WHERE status = 'finished' ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
      params = [parseInt(limit), offset];
    } else {
      query = `SELECT * FROM orders ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
      params = [parseInt(limit), offset];
    }

    const result = await pool.query(query, params);
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