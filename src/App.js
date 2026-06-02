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

const API = process.env.REACT_APP_API_URL || 'https://taxipark-production.up.railway.app/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'https://taxipark-production.up.railway.app';
const DISPATCHER_HEADERS = {
  'Content-Type': 'application/json',
  'x-dispatcher-key': process.env.REACT_APP_DISPATCHER_KEY || '',
};
const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  'x-admin-key': process.env.REACT_APP_ADMIN_KEY || '',
};
const VILLAGE_CENTER = [41.292305, 71.665635];
const TIMEOUT_SECONDS = 60;

const ADDRESSES = [
  { name: "Gulbog' qabristoni", lat: 41.29230018342693, lng: 71.66558437017086 },
  { name: "Baxtiyor elektrik", lat: 41.29250373542262, lng: 71.67049820477406 },
  { name: "Iskovot shifo", lat: 41.29543927089055, lng: 71.67056638563447 },
  { name: "16-maktab", lat: 41.29495099584616, lng: 71.67331989946767 },
  { name: "Xokim uyi", lat: 41.29201075599266, lng: 71.67395374987386 },
  { name: "QVP Iskovot 59", lat: 41.295560211611466, lng: 71.67936670687264 },
  { name: "Davlat bog'chasi 46MTT", lat: 41.29556569674832, lng: 71.67576775771224 },
  { name: "Lesmak", lat: 41.288752554198965, lng: 71.67358593143372 },
  { name: "Eskobod Masjidi", lat: 41.301860514497996, lng: 71.677109185418 },
  { name: "26 maktab", lat: 41.301581376297584, lng: 71.68068270682551 },
  { name: "Sentir Iskovot", lat: 41.30336043186136, lng: 71.68120055100401 },
  { name: "Botirobod", lat: 41.30114657777292, lng: 71.68147289640225 },
  { name: "Chayla", lat: 41.288276962764996, lng: 71.66756894091522 },
  { name: "63 maktab Iskovot", lat: 41.3061845192606, lng: 71.68174025989137 },
  { name: "Majnuntol", lat: 41.304158171985435, lng: 71.66512801219282 },
  { name: "Katta stadion", lat: 41.30370261500986, lng: 71.67432977873078 },
  { name: "Mini futbol maydon", lat: 41.286651828772534, lng: 71.68261392144571 },
  { name: "Salmon MFY", lat: 41.30672689060844, lng: 71.67441743227694 },
  { name: "Shaftolizor ko'cha", lat: 41.29790188850283, lng: 71.66194540452163 },
  { name: "41 maktab Iskovot", lat: 41.31585163273073, lng: 71.67369896159833 },
  { name: "Yangi qandiyon", lat: 41.3040325775348, lng: 71.62871250386348 },
  { name: "Eski qandiyon", lat: 41.3050162128886, lng: 71.64642748190177 },
  { name: "Zang", lat: 41.29385860431873, lng: 71.68346294481358 },
  { name: "Hokim metani", lat: 41.283129771816085, lng: 71.68304368460721 },
  { name: "Iskovot metan Davlatniki", lat: 41.27496854261919, lng: 71.6845874061829 },
  { name: "Zarmed", lat: 41.270278799139, lng: 71.68583659635884 },
];

export default function App() {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [nearestDrivers, setNearestDrivers] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState({ customer_phone: '', from_address: '' });
  const [countdown, setCountdown] = useState(0);
  const [sentOrder, setSentOrder] = useState(null);
  const [rejectedMsg, setRejectedMsg] = useState(null);
  const [resendingOrder, setResendingOrder] = useState(null);

  // Manzillar
  const [addressSearch, setAddressSearch] = useState('');
  const [showAddresses, setShowAddresses] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(null);

  // Yon panel
  const [sidePanel, setSidePanel] = useState(null); // null | 'stats' | 'history' | 'block' | 'broadcast'
  const [showAbout, setShowAbout] = useState(false);

  // Statistika
  const [statPeriod, setStatPeriod] = useState('today');
  const [stats, setStats] = useState(null);

  // Tarix
  const [history, setHistory] = useState([]);

  // Xabar yuborish
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);

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
    socketRef.current.on('order_rejected', (data) => {
      setRejectedMsg(`❌ ${data.driver_name} rad etdi!`);
      stopAllTimers();
      setSentOrder(null);
      setCountdown(0);
      fetchOrders();
      setTimeout(() => setRejectedMsg(null), 5000);
    });
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (autoSendRef.current) clearTimeout(autoSendRef.current);
      if (statusCheckerRef.current) clearInterval(statusCheckerRef.current);
    };
  }, []);

  // Yon panel ochilganda ma'lumot yuklash
  useEffect(() => {
    if (sidePanel === 'stats') fetchStats(statPeriod);
    if (sidePanel === 'history') fetchHistory();
  }, [sidePanel]);

  useEffect(() => {
    if (sidePanel === 'stats') fetchStats(statPeriod);
  }, [statPeriod]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API}/order/all?active=true`, { headers: DISPATCHER_HEADERS });
      const data = await res.json();
      setOrders(data.orders);
    } catch (err) {
      console.error('Buyurtmalarni yuklashda xato:', err);
    }
  };

  const fetchDrivers = async () => {
    try {
      const res = await fetch(`${API}/admin/drivers`, { headers: ADMIN_HEADERS });
      const data = await res.json();
      setDrivers(data.drivers);
    } catch (err) {
      console.error('Haydovchilarni yuklashda xato:', err);
    }
  };

  const fetchStats = async (period) => {
    try {
      const res = await fetch(`${API}/order/all?status=finished&limit=500`, { headers: DISPATCHER_HEADERS });
      const data = await res.json();
      const allOrders = data.orders || [];

      const now = new Date();
      const filtered = allOrders.filter(o => {
        if (o.status !== 'finished') return false;
        const d = new Date(o.finished_at || o.created_at);
        if (period === 'today') {
          return d.toDateString() === now.toDateString();
        } else if (period === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          return d >= weekAgo;
        } else if (period === 'month') {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (period === 'year') {
          return d.getFullYear() === now.getFullYear();
        }
        return false;
      });

      const totalOrders = filtered.length;
      const totalEarned = filtered.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
      const companyAmount = totalOrders * 500;
      const driversAmount = totalEarned - companyAmount;
      const avgPrice = totalOrders > 0 ? Math.round(totalEarned / totalOrders) : 0;

      setStats({ totalOrders, totalEarned, companyAmount, driversAmount, avgPrice });
    } catch (err) {
      console.error('Statistikani yuklashda xato:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API}/order/all?status=finished&limit=100`, { headers: DISPATCHER_HEADERS });
      const data = await res.json();
      const finished = (data.orders || []);
      setHistory(finished);
    } catch (err) {
      console.error('Tarixni yuklashda xato:', err);
    }
  };

  const toggleBlock = async (driver) => {
    try {
      await fetch(`${API}/admin/driver/${driver.id}/block`, {
        method: 'PUT',
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ is_blocked: !driver.is_blocked })
      });
      fetchDrivers();
    } catch (err) {
      alert('Xato! Haydovchi holati o\'zgarmadi.');
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    try {
      await fetch(`${API}/driver/broadcast`, {
        method: 'POST',
        headers: DISPATCHER_HEADERS,
        body: JSON.stringify({ message: broadcastMsg })
      });
      setBroadcastSent(true);
      setBroadcastMsg('');
      setTimeout(() => setBroadcastSent(false), 3000);
    } catch (err) {
      alert('Xato! Xabar yuborilmadi.');
    }
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
        headers: DISPATCHER_HEADERS,
        body: JSON.stringify(form),
      });
      const data = await res.json();
      const onlineDrivers = drivers.filter(d => d.latitude && d.longitude && d.is_online);
      const centerLat = selectedAddress ? selectedAddress.lat : VILLAGE_CENTER[0];
      const centerLng = selectedAddress ? selectedAddress.lng : VILLAGE_CENTER[1];
      const sorted = onlineDrivers.map(d => ({
        ...d,
        distance: getDistance(
          centerLat, centerLng,
          parseFloat(d.latitude), parseFloat(d.longitude)
        ).toFixed(2)
      })).sort((a, b) => a.distance - b.distance);
      setNearestDrivers(sorted);
      setSelectedOrder(data.order);
      setForm({ customer_phone: '', from_address: '' });
      setAddressSearch('');
      setSelectedAddress(null);
      fetchOrders();
    } catch (err) {
      alert('Xato yuz berdi!');
    }
  };

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
        headers: DISPATCHER_HEADERS,
        body: JSON.stringify({ order_id: orderId, driver_id: driverId })
      });
      await fetch(`${API}/order/send-to-driver`, {
        method: 'POST',
        headers: DISPATCHER_HEADERS,
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
          if (c <= 1) { clearInterval(countdownRef.current); setSentOrder(null); return 0; }
          return c - 1;
        });
      }, 1000);

      if (autoSendRef.current) clearTimeout(autoSendRef.current);
      autoSendRef.current = setTimeout(() => {
        stopAllTimers(); setSentOrder(null); setCountdown(0); fetchOrders();
      }, TIMEOUT_SECONDS * 1000);

      if (statusCheckerRef.current) clearInterval(statusCheckerRef.current);
      statusCheckerRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API}/order/all?active=true`, { headers: DISPATCHER_HEADERS });
          const data = await res.json();
          const order = data.orders.find(o => o.id === orderId);
          if (order && order.status !== 'assigned') {
            stopAllTimers(); setSentOrder(null); setCountdown(0); fetchOrders();
          }
        } catch (e) {
          console.error('Buyurtma holati tekshirishda xato:', e);
        }
      }, 3000);
    } catch (err) {
      alert('Xato!');
    }
  };

  const resendToDriver = async (driverId) => {
    if (!sentOrder) return;
    stopAllTimers(); setSentOrder(null); setCountdown(0);
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
  };

  const periodLabel = { today: 'Bugun', week: 'Bu hafta', month: 'Bu oy', year: 'Bu yil' };
  const driversOnMap = drivers.filter(d => d.latitude && d.longitude);

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER */}
      <div className="bg-blue-600 text-white p-4 shadow-lg flex justify-between items-center">
        <div className="flex items-center gap-3">
          {/* ☰ HAMBURGER */}
          <button
            onClick={() => setSidePanel(sidePanel ? null : 'stats')}
            className="bg-blue-500 hover:bg-blue-400 p-2 rounded-lg transition"
            title="Menyu"
          >
            <div className="space-y-1">
              <div className="w-5 h-0.5 bg-white"></div>
              <div className="w-5 h-0.5 bg-white"></div>
              <div className="w-5 h-0.5 bg-white"></div>
            </div>
          </button>
          <h1 className="text-2xl font-bold">🚖 TaxiPark Dispetcher Panel</h1>
        </div>
        <div className="flex gap-4 items-center">
          <span className="bg-green-500 px-3 py-1 rounded-full text-sm font-bold">
            🟢 Online: {drivers.filter(d => d.is_online).length}
          </span>
          <span className="bg-orange-500 px-3 py-1 rounded-full text-sm font-bold">
            📋 Yangi: {orders.filter(o => o.status === 'new').length}
          </span>

        </div>
      </div>


      <div className="flex">

        {/* YON PANEL */}
        {sidePanel && (
          <div className="w-80 min-h-screen bg-white shadow-xl border-r flex flex-col">

            {/* Yon panel navigatsiya */}
            <div className="flex border-b">
              {[
                { key: 'stats', icon: '📊', label: 'Stat' },
                { key: 'history', icon: '📋', label: 'Tarix' },
                { key: 'block', icon: '🔒', label: 'Blok' },
                { key: 'broadcast', icon: '📢', label: 'Xabar' },
                { key: 'about', icon: 'ℹ️', label: 'Haqida' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setSidePanel(item.key)}
                  className={`flex-1 py-3 text-xs font-bold flex flex-col items-center gap-1 transition ${
                    sidePanel === item.key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => setSidePanel(null)}
                className="px-3 text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">

              {/* ── STATISTIKA ── */}
              {sidePanel === 'stats' && (
                <div>
                  <h2 className="text-lg font-bold text-blue-600 mb-3">📊 Statistika</h2>

                  {/* Period tugmalari */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {Object.entries(periodLabel).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setStatPeriod(key)}
                        className={`py-2 rounded-lg text-sm font-bold transition ${
                          statPeriod === key
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {stats ? (
                    <div className="space-y-3">
                      <div className="bg-blue-50 rounded-xl p-4 text-center">
                        <p className="text-3xl font-bold text-blue-600">{stats.totalOrders}</p>
                        <p className="text-sm text-gray-500 mt-1">Jami reyslar</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{stats.totalEarned.toLocaleString()} so'm</p>
                        <p className="text-sm text-gray-500 mt-1">Jami daromad</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-red-50 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-red-600">{stats.companyAmount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 mt-1">Kompaniya so'm</p>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-3 text-center">
                          <p className="text-lg font-bold text-purple-600">{stats.driversAmount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 mt-1">Haydovchilar so'm</p>
                        </div>
                      </div>
                      <div className="bg-yellow-50 rounded-xl p-4 text-center">
                        <p className="text-xl font-bold text-yellow-600">{stats.avgPrice.toLocaleString()} so'm</p>
                        <p className="text-sm text-gray-500 mt-1">O'rtacha reys narxi</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-gray-400 py-8">Yuklanmoqda...</p>
                  )}
                </div>
              )}

              {/* ── TARIX ── */}
              {sidePanel === 'history' && (
                <div>
                  <h2 className="text-lg font-bold text-blue-600 mb-3">📋 Tugallangan reyslar</h2>
                  {history.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">Hozircha tarix yo'q</p>
                  ) : (
                    <div className="space-y-2">
                      {history.map(order => (
                        <div key={order.id} className="border rounded-lg p-3 bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-bold text-sm">📞 {order.customer_phone}</p>
                              <p className="text-xs text-gray-500">📍 {order.from_address}</p>
                              <p className="text-xs text-gray-400 mt-1">🕐 {formatDate(order.finished_at || order.created_at)}</p>
                            </div>
                            <p className="font-bold text-green-600 text-sm">
                              {order.total_price ? Math.round(order.total_price).toLocaleString() : 0} so'm
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── BLOKLASH ── */}
              {sidePanel === 'block' && (
                <div>
                  <h2 className="text-lg font-bold text-blue-600 mb-3">🔒 Haydovchilar</h2>
                  {drivers.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">Haydovchilar yo'q</p>
                  ) : (
                    <div className="space-y-2">
                      {drivers.map(driver => (
                        <div key={driver.id} className={`border rounded-lg p-3 ${driver.is_blocked ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-bold text-sm">
                                {driver.is_online ? '🟢' : '⚫'} {driver.full_name}
                              </p>
                              <p className="text-xs text-gray-500">🚗 {driver.car_model} | {driver.car_number}</p>
                              <p className="text-xs text-gray-400">📞 {driver.phone}</p>
                            </div>
                            <button
                              onClick={() => toggleBlock(driver)}
                              className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                                driver.is_blocked
                                  ? 'bg-green-500 text-white hover:bg-green-600'
                                  : 'bg-red-500 text-white hover:bg-red-600'
                              }`}
                            >
                              {driver.is_blocked ? '✅ Ochish' : '🔒 Bloklash'}
                            </button>
                          </div>
                          {driver.is_blocked && (
                            <p className="text-xs text-red-500 font-bold mt-1">⛔ Bloklangan</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── HAQIDA ── */}
              {sidePanel === 'about' && (
                <div className="text-center">
                  <p className="text-5xl mb-4 mt-4">🚖</p>
                  <h2 className="text-2xl font-bold text-blue-600 mb-1">TaxiPark</h2>
                  <p className="text-gray-400 text-sm mb-6">v1.0.0 — Build 2</p>
                  <div className="bg-gray-50 rounded-xl p-4 mb-4 text-left space-y-3">
                    <p className="text-sm"><span className="font-bold text-gray-600">👤 Muallif:</span> Ermagov Muzaffar</p>
                    <p className="text-sm"><span className="font-bold text-gray-600">👥 Jamoa:</span> UzbTILT</p>
                    <p className="text-sm"><span className="font-bold text-gray-600">💼 Rol:</span> Loyiha muallifi va bosh dasturchi</p>
                  </div>
                  <p className="text-xs text-gray-400">© 2026 UzbTILT.</p>
                  <p className="text-xs text-gray-400">Barcha huquqlar himoyalangan.</p>
                </div>
              )}

              {/* ── XABAR YUBORISH ── */}
              {sidePanel === 'broadcast' && (
                <div>
                  <h2 className="text-lg font-bold text-blue-600 mb-3">📢 Hammaga xabar</h2>
                  <p className="text-xs text-gray-500 mb-4">
                    Barcha online haydovchilar telefonida bu xabar chiqadi
                  </p>

                  {broadcastSent && (
                    <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-4 text-center">
                      <p className="text-green-700 font-bold">✅ Xabar yuborildi!</p>
                    </div>
                  )}

                  <textarea
                    className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-blue-400"
                    rows={5}
                    placeholder="Xabar matni..."
                    value={broadcastMsg}
                    onChange={e => setBroadcastMsg(e.target.value)}
                  />

                  <div className="mt-2 mb-4">
                    <p className="text-xs text-gray-400">
                      Online haydovchilar: {drivers.filter(d => d.is_online).length} ta
                    </p>
                  </div>

                  <button
                    onClick={sendBroadcast}
                    disabled={!broadcastMsg.trim()}
                    className={`w-full py-3 rounded-lg font-bold transition ${
                      broadcastMsg.trim()
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    📢 Yuborish
                  </button>

                  <div className="mt-4">
                    <p className="text-xs font-bold text-gray-500 mb-2">Tez xabarlar:</p>
                    {[
                      'Bugun kechqurun yig\'ilish bor!',
                      'Narxlar yangilandi, ilovani yangilang!',
                      'Xizmat ko\'rsatishda ehtiyot bo\'ling!',
                      'Tizim texnik ishlar uchun o\'chadi.',
                    ].map((msg, i) => (
                      <button
                        key={i}
                        onClick={() => setBroadcastMsg(msg)}
                        className="w-full text-left text-xs bg-gray-50 hover:bg-gray-100 border rounded-lg px-3 py-2 mb-1 text-gray-600"
                      >
                        {msg}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ASOSIY KONTENT */}
        <div className="flex-1 p-4 grid grid-cols-3 gap-4">
          <div className="col-span-1">

            {/* RAD ETISH XABARI */}
            {rejectedMsg && (
              <div className="bg-red-50 border-2 border-red-400 rounded-xl p-3 mb-4 flex justify-between items-center">
                <span className="text-red-700 font-bold">{rejectedMsg}</span>
                <button onClick={() => setRejectedMsg(null)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
              </div>
            )}

            {/* COUNTDOWN */}
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
                  <div className="relative">
                    <label className="text-sm text-gray-500">📍 Qayerdan</label>
                    <input
                      className="w-full border rounded-lg p-2 mt-1"
                      placeholder="Manzil qidiring..."
                      value={addressSearch}
                      onChange={e => {
                        setAddressSearch(e.target.value);
                        setShowAddresses(true);
                        setSelectedAddress(null);
                        setForm({ ...form, from_address: e.target.value });
                      }}
                      onFocus={() => setShowAddresses(true)}
                      autoComplete="off"
                    />
                    {showAddresses && addressSearch.length > 0 && (
                      <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                        {ADDRESSES.filter(a =>
                          a.name.toLowerCase().includes(addressSearch.toLowerCase())
                        ).map((addr, i) => (
                          <button
                            key={i}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b last:border-0"
                            onClick={() => {
                              setAddressSearch(addr.name);
                              setSelectedAddress(addr);
                              setForm({ ...form, from_address: addr.name });
                              setShowAddresses(false);
                            }}
                          >
                            📍 {addr.name}
                          </button>
                        ))}
                        {ADDRESSES.filter(a =>
                          a.name.toLowerCase().includes(addressSearch.toLowerCase())
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-400">Topilmadi</div>
                        )}
                      </div>
                    )}
                    {selectedAddress && (
                      <p className="text-xs text-green-600 mt-1">✅ {selectedAddress.name}</p>
                    )}
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

            {/* YAQIN HAYDOVCHILAR */}
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

            {/* AKTIV BUYURTMALAR */}
            <div className="bg-white rounded-xl shadow p-5">
              <h2 className="text-xl font-bold mb-4 text-blue-600">📊 Aktiv buyurtmalar</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {orders.filter(o => o.status !== 'finished').length === 0 ? (
                  <p className="text-gray-400 text-center py-4">Hozircha buyurtma yo'q</p>
                ) : (
                  orders.filter(o => o.status !== 'finished').map(order => (
                    <div key={order.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">📞 {order.customer_phone}</p>
                          <p className="text-sm text-gray-500">📍 {order.from_address}</p>
                          <p className="text-sm font-bold text-green-600">
                            💰 {order.total_price ? Math.round(order.total_price).toLocaleString() : 500} so'm
                          </p>
                          {order.extra_services && (() => {
                            try {
                              const services = JSON.parse(order.extra_services);
                              const EMOJIS = { bagaj: '🧳', tom_bagaj: '🚗', yo5: '👤', yo6: '👥', dastavka: '📦', tortish: '🚛', gaz: '⛽', nasos: '🔧', akum: '🔋', zapas: '🛞' };
                              return services.length > 0 ? (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {services.map(s => (
                                    <span key={s} className="text-xs bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                                      {EMOJIS[s] || '➕'}
                                    </span>
                                  ))}
                                </div>
                              ) : null;
                            } catch(e) { return null; }
                          })()}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(order.status)}`}>
                            {getStatusText(order.status)}
                          </span>
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
    </div>
  );
}