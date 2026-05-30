import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { io } from 'socket.io-client';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createCarIcon = (isOnline, driverName) => L.divIcon({
  className: '',
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
      <div style="background:${isOnline ? '#16a34a' : '#6b7280'};border:2px solid white;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;">🚖</div>
      <div style="background:${isOnline ? '#16a34a' : '#6b7280'};color:white;font-size:10px;font-weight:bold;padding:2px 6px;border-radius:4px;margin-top:2px;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis;border:1px solid white;">${driverName.split(' ')[0]}</div>
    </div>
  `,
  iconSize: [36, 56],
  iconAnchor: [18, 56],
  popupAnchor: [0, -58],
});

const API = 'https://taxipark-production.up.railway.app/api';
const SOCKET_URL = 'https://taxipark-production.up.railway.app';
const VILLAGE_CENTER = [41.292305, 71.665635];
const TIMEOUT_SECONDS = 60;

export default function App() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [nearestDrivers, setNearestDrivers] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState({ customer_phone: '', from_address: '' });
  const [countdown, setCountdown] = useState(0);
  const [sentOrder, setSentOrder] = useState(null);
  const [rejectedMsg, setRejectedMsg] = useState(null);
  const [resendingOrder, setResendingOrder] = useState(null); // ✅ mavjud buyurtmani yuborish

  const countdownRef = useRef(null);
  const autoSendRef = useRef(null);
  const statusCheckerRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
    const interval = setInterval(() => {
      fetchOrders();
      fetchDrivers();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    // ✅ Rad etilganda — timerlar to'xtaydi, forma chiqadi
    socketRef.current.on('order_rejected', (data) => {
      setRejectedMsg(`❌ ${data.driver_name} rad etdi!`);
      stopAllTimers();
      setSentOrder(null);
      setCountdown(0);
      fetchOrders();
      setTimeout(() => setRejectedMsg(null), 5000);
    });

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (autoSendRef.current) clearTimeout(autoSendRef.current);
      if (statusCheckerRef.current) clearInterval(statusCheckerRef.current);
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API}/order/all`);
      const data = await res.json();
      setOrders(data.orders);
    } catch (err) {}
  };

  const fetchDrivers = async () => {
    try {
      const res = await fetch(`${API}/admin/drivers`);
      const data = await res.json();
      setDrivers(data.drivers);
    } catch (err) {}
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const createOrder = async () => {
    if (!form.customer_phone || !form.from_address) {
      alert('Telefon va manzilni kiriting!');
      return;
    }
    try {
      const res = await fetch(`${API}/order/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      const onlineDrivers = drivers.filter(d => d.latitude && d.longitude && d.is_online);
      const sorted = onlineDrivers.map(d => ({
        ...d,
        distance: getDistance(
          VILLAGE_CENTER[0], VILLAGE_CENTER[1],
          parseFloat(d.latitude), parseFloat(d.longitude)
        ).toFixed(2)
      })).sort((a, b) => a.distance - b.distance);
      setNearestDrivers(sorted);
      setSelectedOrder(data.order);
      setForm({ customer_phone: '', from_address: '' });
      fetchOrders();
    } catch (err) {
      alert('Xato yuz berdi!');
    }
  };

  // ✅ Mavjud buyurtmani haydovchiga yuborish (buyurtmalar ro'yxatidan)
  const selectOrderToResend = (order) => {
    const onlineDrivers = drivers.filter(d => d.latitude && d.longitude && d.is_online);
    const sorted = onlineDrivers.map(d => ({
      ...d,
      distance: getDistance(
        VILLAGE_CENTER[0], VILLAGE_CENTER[1],
        parseFloat(d.latitude), parseFloat(d.longitude)
      ).toFixed(2)
    })).sort((a, b) => a.distance - b.distance);
    setResendingOrder(order);
    setNearestDrivers(sorted);
    setSelectedOrder(order);
  };

  const stopAllTimers = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (autoSendRef.current) clearTimeout(autoSendRef.current);
    if (statusCheckerRef.current) clearInterval(statusCheckerRef.current);
  };

  const sendToDriver = async (orderId, driverId) => {
    try {
      await fetch(`${API}/order/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, driver_id: driverId })
      });
      await fetch(`${API}/order/send-to-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, driver_id: driverId })
      });

      setSentOrder({ orderId, driverId });
      setNearestDrivers([]);
      setSelectedOrder(null);
      setResendingOrder(null);
      setCountdown(TIMEOUT_SECONDS);
      setRejectedMsg(null);
      fetchOrders();

      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown(c => {
          if (c <= 1) {
            clearInterval(countdownRef.current);
            setSentOrder(null);
            return 0;
          }
          return c - 1;
        });
      }, 1000);

      if (autoSendRef.current) clearTimeout(autoSendRef.current);
      autoSendRef.current = setTimeout(() => {
        stopAllTimers();
        setSentOrder(null);
        setCountdown(0);
        fetchOrders();
      }, TIMEOUT_SECONDS * 1000);

      if (statusCheckerRef.current) clearInterval(statusCheckerRef.current);
      statusCheckerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API}/order/all`);
          const data = await res.json();
          const order = data.orders.find(o => o.id === orderId);
          if (order && order.status !== 'assigned') {
            stopAllTimers();
            setSentOrder(null);
            setCountdown(0);
            fetchOrders();
          }
        } catch (e) {}
      }, 3000);

    } catch (err) {
      alert('Xato!');
    }
  };

  const resendToDriver = async (driverId) => {
    if (!sentOrder) return;
    stopAllTimers();
    setSentOrder(null);
    setCountdown(0);
    await sendToDriver(sentOrder.orderId, driverId);
  };

  const getStatusColor = (status) => {
    if (status === 'new') return 'bg-blue-100 text-blue-800';
    if (status === 'assigned') return 'bg-yellow-100 text-yellow-800';
    if (status === 'accepted') return 'bg-purple-100 text-purple-800';
    if (status === 'started') return 'bg-green-100 text-green-800';
    if (status === 'finished') return 'bg-gray-100 text-gray-800';
    return 'bg-gray-100';
  };

  const getStatusText = (status) => {
    if (status === 'new') return '🆕 Yangi';
    if (status === 'assigned') return '📤 Yuborildi';
    if (status === 'accepted') return '✋ Qabul qilindi';
    if (status === 'started') return '▶️ Ketmoqda';
    if (status === 'finished') return '✅ Tugadi';
    return status;
  };

  const driversOnMap = drivers.filter(d => d.latitude && d.longitude);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center">
        <h1 className="text-2xl font-bold">🚖 TaxiPark Dispetcher Panel</h1>
        <div className="flex gap-4">
          <span className="bg-green-500 px-3 py-1 rounded-full text-sm font-bold">
            🟢 Online: {drivers.filter(d => d.is_online).length}
          </span>
          <span className="bg-orange-500 px-3 py-1 rounded-full text-sm font-bold">
            📋 Yangi: {orders.filter(o => o.status === 'new').length}
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-3 gap-4">
        <div className="col-span-1">

          {/* RAD ETISH XABARI */}
          {rejectedMsg && (
            <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 mb-4 flex justify-between items-center">
              <span className="text-red-700 font-bold">{rejectedMsg}</span>
              <button onClick={() => setRejectedMsg(null)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
            </div>
          )}

          {/* COUNTDOWN BLOKI */}
          {countdown > 0 && sentOrder && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl shadow p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-lg font-bold text-yellow-700">⏳ Haydovchi kutilmoqda</h2>
                <div className="text-3xl font-bold text-red-600">{countdown}s</div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
                <div
                  className="bg-yellow-400 h-3 rounded-full transition-all"
                  style={{ width: `${(countdown / TIMEOUT_SECONDS) * 100}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 mb-2">
                {countdown}s ichida olmasa — tizim hammaga yuboradi
              </p>
              <p className="text-xs font-bold text-gray-600 mb-1">Boshqa haydovchiga yuborish:</p>
              {drivers.filter(d => d.is_online && d.id !== sentOrder.driverId).map(d => (
                <button
                  key={d.id}
                  onClick={() => resendToDriver(d.id)}
                  className="w-full text-left bg-white border rounded-lg px-3 py-2 mb-1 text-sm hover:bg-yellow-50"
                >
                  🚖 {d.full_name} — {d.car_number}
                </button>
              ))}
            </div>
          )}

          {/* BUYURTMA YARATISH */}
          {countdown === 0 && (
            <div className="bg-white rounded-xl shadow p-5 mb-4">
              <h2 className="text-xl font-bold mb-4 text-blue-600">📋 Yangi Buyurtma</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">📞 Yo'lovchi telefon</label>
                  <input
                    className="w-full border rounded-lg p-2 mt-1"
                    placeholder="+998901234567"
                    value={form.customer_phone}
                    onChange={e => setForm({ ...form, customer_phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-500">📍 Qayerdan</label>
                  <input
                    className="w-full border rounded-lg p-2 mt-1"
                    placeholder="Manzil kiriting"
                    value={form.from_address}
                    onChange={e => setForm({ ...form, from_address: e.target.value })}
                  />
                </div>
                <button
                  onClick={createOrder}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
                >
                  🚖 Buyurtma Yaratish
                </button>
              </div>
            </div>
          )}

          {/* ✅ YAQIN HAYDOVCHILAR — yangi yoki mavjud buyurtma uchun */}
          {nearestDrivers.length > 0 && selectedOrder && (
            <div className="bg-white rounded-xl shadow p-5 mb-4 border-2 border-green-400">
              <h2 className="text-lg font-bold mb-1 text-green-600">🚗 Yaqin haydovchilar</h2>
              {resendingOrder && (
                <p className="text-xs text-gray-500 mb-3">
                  📞 {resendingOrder.customer_phone} — {resendingOrder.from_address}
                </p>
              )}
              {nearestDrivers.map((driver, index) => (
                <div key={driver.id} className="border rounded-lg p-3 mb-2">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {driver.full_name}
                      </p>
                      <p className="text-sm text-gray-500">🚗 {driver.car_model} | {driver.car_number}</p>
                      <p className="text-sm text-blue-600 font-bold">📏 {driver.distance} km</p>
                    </div>
                    <button
                      onClick={() => sendToDriver(selectedOrder?.id, driver.id)}
                      className="bg-green-500 text-white px-3 py-2 rounded-lg text-sm font-bold"
                    >
                      📤 Yuborish
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => { setNearestDrivers([]); setSelectedOrder(null); setResendingOrder(null); }}
                className="w-full text-center text-gray-400 text-sm mt-1 hover:text-gray-600"
              >
                ✕ Bekor qilish
              </button>
            </div>
          )}

          {/* BUYURTMALAR */}
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-xl font-bold mb-4 text-blue-600">📊 Buyurtmalar</h2>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {orders.length === 0 ? (
                <p className="text-gray-400 text-center py-4">Hozircha buyurtma yo'q</p>
              ) : (
                orders.map(order => (
                  <div key={order.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">📞 {order.customer_phone}</p>
                        <p className="text-sm text-gray-500">📍 {order.from_address}</p>
                        <p className="text-sm font-bold text-green-600">
                          💰 {order.total_price ? Math.round(order.total_price).toLocaleString() : 500} so'm
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                        {/* ✅ Faqat "new" statusidagi buyurtmaga yuborish tugmasi */}
                        {order.status === 'new' && countdown === 0 && (
                          <button
                            onClick={() => selectOrderToResend(order)}
                            className="text-xs bg-blue-500 text-white px-2 py-1 rounded-lg hover:bg-blue-600"
                          >
                            📤 Yuborish
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* XARITA */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow p-3">
            <h2 className="text-lg font-bold mb-2 text-blue-600">
              🗺️ Xarita — Haydovchilar joylashuvi ({driversOnMap.length} ta)
            </h2>
            <MapContainer
              center={VILLAGE_CENTER}
              zoom={15}
              style={{ height: '580px', width: '100%', borderRadius: '8px' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap &copy; CARTO'
              />
              {driversOnMap.map(driver => (
                <Marker
                  key={driver.id}
                  position={[parseFloat(driver.latitude), parseFloat(driver.longitude)]}
                  icon={createCarIcon(driver.is_online, driver.full_name)}
                >
                  <Popup>
                    <div style={{ minWidth: '160px' }}>
                      <p style={{ fontWeight: 'bold', fontSize: '14px' }}>👤 {driver.full_name}</p>
                      <p style={{ fontSize: '12px', color: '#555' }}>🚗 {driver.car_model} | {driver.car_number}</p>
                      <p style={{ fontSize: '12px', color: '#555' }}>📞 {driver.phone}</p>
                      <p style={{ fontSize: '12px', color: driver.is_online ? 'green' : 'gray', fontWeight: 'bold' }}>
                        {driver.is_online ? '🟢 Online' : '⚫ Offline'}
                      </p>
                      <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                        📍 {parseFloat(driver.latitude).toFixed(4)}, {parseFloat(driver.longitude).toFixed(4)}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <div className="mt-3 flex flex-wrap gap-2">
              {drivers.map(driver => (
                <div
                  key={driver.id}
                  className={`px-3 py-2 rounded-lg text-sm font-bold ${
                    driver.is_online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {driver.is_online ? '🟢' : '⚫'} {driver.full_name} — {driver.car_number}
                  {driver.latitude && driver.longitude ? ' 📍' : ' (GPS yo\'q)'}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}