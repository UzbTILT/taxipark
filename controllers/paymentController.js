const pool = require('../config/db');

// Haydovchi kunlik hisoboti
const getDailyReport = async (req, res) => {
  try {
    const driver_id = req.driver.id;
    const today = new Date().toISOString().split('T')[0];

    // Bugungi reyslar
    const ordersResult = await pool.query(
      `SELECT * FROM orders 
       WHERE driver_id = $1 
       AND DATE(finished_at) = $2
       AND status = 'finished'`,
      [driver_id, today]
    );

    const orders = ordersResult.rows;
    const total_earned = orders.reduce((sum, o) => sum + parseFloat(o.total_price || 0), 0);
    const company_amount = orders.length * 500;
    const driver_amount = total_earned - company_amount;

    res.json({
      date: today,
      total_orders: orders.length,
      total_earned: total_earned.toFixed(2),
      company_amount: company_amount.toFixed(2),
      driver_amount: driver_amount.toFixed(2),
      orders: orders
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// To'lov qilish
const makePayment = async (req, res) => {
  try {
    const driver_id = req.driver.id;
    const today = new Date().toISOString().split('T')[0];

    // Bugungi to'lanmagan reyslar
    const ordersResult = await pool.query(
      `SELECT * FROM orders 
       WHERE driver_id = $1 
       AND DATE(finished_at) = $2
       AND status = 'finished'`,
      [driver_id, today]
    );

    const orders = ordersResult.rows;
    const company_amount = orders.length * 500;

    if (orders.length === 0) {
      return res.status(400).json({ message: 'Bugun tugallangan reys yo\'q!' });
    }

    // To'lovni saqlash
    await pool.query(
      `INSERT INTO payments (driver_id, amount, period_start, period_end)
       VALUES ($1, $2, $3, $4)`,
      [driver_id, company_amount, today, today]
    );

    res.json({
      message: 'To\'lov amalga oshirildi!',
      company_amount: company_amount,
      orders_count: orders.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Admin - to'lovni tasdiqlash
const confirmPayment = async (req, res) => {
  try {
    const { payment_id } = req.body;

    await pool.query(
      `UPDATE payments SET is_paid = true, paid_at = NOW() WHERE id = $1`,
      [payment_id]
    );

    res.json({ message: 'To\'lov tasdiqlandi! ✅' });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

// Admin - barcha to'lovlar
const getAllPayments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, d.full_name, d.phone 
       FROM payments p
       JOIN drivers d ON p.driver_id = d.id
       ORDER BY p.created_at DESC`
    );

    res.json({ payments: result.rows });
  } catch (error) {
    res.status(500).json({ message: 'Server xatosi!', error: error.message });
  }
};

module.exports = {
  getDailyReport,
  makePayment,
  confirmPayment,
  getAllPayments
};