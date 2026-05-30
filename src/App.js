import React, { useState, useEffect } from 'react';

const API = 'https://taxipark-production.up.railway.app/api';

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'
];

export default function App() {
  const [activeTab, setActiveTab] = useState('drivers');
  const [drivers, setDrivers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);

  // Statistika uchun
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  useEffect(() => {
    fetchDrivers();
    fetchOrders();
    fetchPayments();
    const interval = setInterval(() => {
      fetchDrivers();
      fetchOrders();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchDrivers = async () => {
    try {
      const res = await fetch(`${API}/admin/drivers`);
      const data = await res.json();
      setDrivers(data.drivers);
    } catch (err) {}
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API}/order/all`);
      const data = await res.json();
      setOrders(data.orders);
    } catch (err) {}
  };

  const fetchPayments = async () => {
    try {
      const res = await fetch(`${API}/payment/all`);
      const data = await res.json();
      setPayments(data.payments);
    } catch (err) {}
  };

  const blockDriver = async (id, block) => {
    try {
      await fetch(`${API}/admin/driver/${id}/block`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_blocked: block })
      });
      fetchDrivers();
    } catch (err) {}
  };

  const confirmPayment = async (id) => {
    try {
      await fetch(`${API}/payment/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_id: id })
      });
      fetchPayments();
    } catch (err) {}
  };

  // ✅ Tanlangan oy bo'yicha buyurtmalarni filtrlash
  const getMonthlyOrders = () => {
    return orders.filter(order => {
      const d = new Date(order.created_at);
      return d.getMonth() === selectedMonth &&
             d.getFullYear() === selectedYear &&
             order.status === 'finished';
    });
  };

  // ✅ Haydovchi bo'yicha statistika
  const getDriverStats = (monthlyOrders) => {
    const stats = {};
    drivers.forEach(d => {
      stats[d.id] = {
        name: d.full_name,
        car: `${d.car_model} | ${d.car_number}`,
        orders: 0,
        earned: 0,
        company: 0
      };
    });
    monthlyOrders.forEach(order => {
      if (order.driver_id && stats[order.driver_id]) {
        stats[order.driver_id].orders += 1;
        stats[order.driver_id].earned += parseFloat(order.total_price || 0);
        stats[order.driver_id].company += 500;
      }
    });
    return Object.values(stats).filter(s => s.orders > 0)
      .sort((a, b) => b.orders - a.orders);
  };

  const getStatusColor = (status) => {
    if (status === 'new') return 'bg-blue-100 text-blue-800';
    if (status === 'assigned') return 'bg-yellow-100 text-yellow-800';
    if (status === 'started') return 'bg-green-100 text-green-800';
    if (status === 'finished') return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100';
  };

  const getStatusText = (status) => {
    if (status === 'new') return '🆕 Yangi';
    if (status === 'assigned') return '🚗 Yuborildi';
    if (status === 'started') return '▶️ Ketmoqda';
    if (status === 'finished') return '✅ Tugadi';
    return status;
  };

  const monthlyOrders = getMonthlyOrders();
  const driverStats = getDriverStats(monthlyOrders);
  const totalEarned = monthlyOrders.reduce((s, o) => s + parseFloat(o.total_price || 0), 0);
  const totalCompany = monthlyOrders.length * 500;
  const totalDrivers = totalEarned - totalCompany;

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-700 text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold">⚙️ TaxiPark Admin Panel</h1>
      </div>

      <div className="bg-white shadow">
        <div className="flex">
          {[
            { key: 'drivers', label: '👥 Haydovchilar' },
            { key: 'orders', label: '📋 Buyurtmalar' },
            { key: 'payments', label: '💰 To\'lovlar' },
            { key: 'stats', label: '📊 Statistika' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-6 py-3 font-bold ${activeTab === tab.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">

        {/* HAYDOVCHILAR */}
        {activeTab === 'drivers' && (
          <div>
            <div className="bg-white rounded-xl shadow p-4 mb-4">
              <h2 className="text-lg font-bold text-blue-700 mb-2">👥 Haydovchilar ro'yxati</h2>
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div className="bg-green-100 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">{drivers.filter(d => d.is_online).length}</p>
                  <p className="text-sm text-gray-500">Online</p>
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-600">{drivers.filter(d => !d.is_online).length}</p>
                  <p className="text-sm text-gray-500">Offline</p>
                </div>
                <div className="bg-red-100 rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-600">{drivers.filter(d => d.is_blocked).length}</p>
                  <p className="text-sm text-gray-500">Bloklangan</p>
                </div>
              </div>
            </div>
            {drivers.map(driver => (
              <div key={driver.id} className="bg-white rounded-xl shadow p-4 mb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-lg">{driver.full_name}</p>
                    <p className="text-gray-500">📞 {driver.phone}</p>
                    <p className="text-gray-500">🚗 {driver.car_model} | {driver.car_number}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${driver.is_online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {driver.is_online ? '🟢 Online' : '⚫ Offline'}
                      </span>
                      {driver.is_blocked && (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">🔴 Bloklangan</span>
                      )}
                    </div>
                  </div>
                  <div>
                    {driver.is_blocked ? (
                      <button onClick={() => blockDriver(driver.id, false)} className="bg-green-500 text-white px-3 py-1 rounded-lg text-sm font-bold">✅ Ochish</button>
                    ) : (
                      <button onClick={() => blockDriver(driver.id, true)} className="bg-red-500 text-white px-3 py-1 rounded-lg text-sm font-bold">🔴 Bloklash</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BUYURTMALAR */}
        {activeTab === 'orders' && (
          <div>
            <div className="bg-white rounded-xl shadow p-4 mb-4">
              <h2 className="text-lg font-bold text-blue-700 mb-2">📋 Buyurtmalar statistikasi</h2>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div className="bg-blue-100 rounded-lg p-3">
                  <p className="text-2xl font-bold text-blue-600">{orders.filter(o => o.status === 'new').length}</p>
                  <p className="text-xs text-gray-500">Yangi</p>
                </div>
                <div className="bg-yellow-100 rounded-lg p-3">
                  <p className="text-2xl font-bold text-yellow-600">{orders.filter(o => o.status === 'assigned').length}</p>
                  <p className="text-xs text-gray-500">Yuborildi</p>
                </div>
                <div className="bg-green-100 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">{orders.filter(o => o.status === 'started').length}</p>
                  <p className="text-xs text-gray-500">Ketmoqda</p>
                </div>
                <div className="bg-gray-100 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-600">{orders.filter(o => o.status === 'finished').length}</p>
                  <p className="text-xs text-gray-500">Tugadi</p>
                </div>
              </div>
            </div>
            {orders.map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow p-4 mb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold">📞 {order.customer_phone}</p>
                    <p className="text-sm text-gray-500">📍 {order.from_address}</p>
                    <p className="text-sm font-bold text-green-600">
                      💰 {order.total_price ? Math.round(order.total_price).toLocaleString() : 500} so'm
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(order.status)}`}>
                    {getStatusText(order.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TO'LOVLAR */}
        {activeTab === 'payments' && (
          <div>
            <div className="bg-white rounded-xl shadow p-4 mb-4">
              <h2 className="text-lg font-bold text-blue-700">💰 To'lovlar</h2>
            </div>
            {payments.length === 0 ? (
              <p className="text-center text-gray-400 py-8">To'lovlar yo'q</p>
            ) : (
              payments.map(payment => (
                <div key={payment.id} className="bg-white rounded-xl shadow p-4 mb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold">{payment.full_name}</p>
                      <p className="text-gray-500">📞 {payment.phone}</p>
                      <p className="text-green-600 font-bold">💰 {Math.round(payment.amount).toLocaleString()} so'm</p>
                      <p className="text-xs text-gray-400">{payment.period_start}</p>
                    </div>
                    <div>
                      {payment.is_paid ? (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">✅ To'langan</span>
                      ) : (
                        <button onClick={() => confirmPayment(payment.id)} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-bold">✅ Tasdiqlash</button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ✅ STATISTIKA */}
        {activeTab === 'stats' && (
          <div>
            {/* Oy va yil tanlash */}
            <div className="bg-white rounded-xl shadow p-4 mb-4">
              <h2 className="text-lg font-bold text-blue-700 mb-3">📊 Oylik statistika</h2>
              <div className="flex gap-3 mb-3">
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(parseInt(e.target.value))}
                  className="border rounded-lg px-3 py-2 font-bold text-blue-600"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(parseInt(e.target.value))}
                  className="border rounded-lg px-3 py-2 font-bold text-blue-600"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-gray-500">
                📅 {MONTHS[selectedMonth]} {selectedYear} — faqat tugallangan reyslar
              </p>
            </div>

            {/* Jami ko'rsatkichlar */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">{monthlyOrders.length}</p>
                <p className="text-sm text-gray-500 mt-1">📦 Jami reyslar</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{Math.round(totalEarned).toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">💰 Jami daromad (so'm)</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{Math.round(totalCompany).toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">🏢 Kompaniya ulushi (so'm)</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-purple-600">{Math.round(totalDrivers).toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">👤 Haydovchilar ulushi (so'm)</p>
              </div>
            </div>

            {/* Haydovchilar bo'yicha */}
            <div className="bg-white rounded-xl shadow p-4">
              <h3 className="text-lg font-bold text-blue-700 mb-3">🚖 Haydovchilar bo'yicha</h3>
              {driverStats.length === 0 ? (
                <p className="text-center text-gray-400 py-6">
                  {MONTHS[selectedMonth]} {selectedYear} da tugallangan reys yo'q
                </p>
              ) : (
                driverStats.map((stat, index) => (
                  <div key={index} className="border rounded-xl p-4 mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-lg">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {stat.name}
                        </p>
                        <p className="text-sm text-gray-500">🚗 {stat.car}</p>
                      </div>
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold text-sm">
                        {stat.orders} reys
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mt-2">
                      <div className="bg-green-50 rounded-lg p-2">
                        <p className="font-bold text-green-600 text-sm">{Math.round(stat.earned).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">Jami (so'm)</p>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2">
                        <p className="font-bold text-red-600 text-sm">{Math.round(stat.company).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">Kompaniya</p>
                      </div>
                      <div className="bg-purple-50 rounded-lg p-2">
                        <p className="font-bold text-purple-600 text-sm">{Math.round(stat.earned - stat.company).toLocaleString()}</p>
                        <p className="text-xs text-gray-400">Haydovchi</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}