import React, { useState, useEffect } from 'react';

const API = process.env.REACT_APP_API_URL || 'https://taxipark-production.up.railway.app/api';
const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  'x-admin-key': process.env.REACT_APP_ADMIN_KEY || '',
};

export default function App() {
  const [tab, setTab] = useState('system');
  const [systemOnline, setSystemOnline] = useState(true);
  const [toggling, setToggling] = useState(false);

  const [drivers, setDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driverResetId, setDriverResetId] = useState(null);
  const [driverNewPass, setDriverNewPass] = useState('');

  const [dispatchers, setDispatchers] = useState([]);
  const [dispLoading, setDispLoading] = useState(false);
  const [dispResetId, setDispResetId] = useState(null);
  const [dispNewPass, setDispNewPass] = useState('');

  useEffect(() => { fetchStatus(); }, []);

  useEffect(() => {
    if (tab === 'drivers') fetchDrivers();
    if (tab === 'dispatchers') fetchDispatchers();
  }, [tab]);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/admin/system-status`, { headers: ADMIN_HEADERS });
      const data = await res.json();
      setSystemOnline(data.is_online);
    } catch (err) {
      console.error('Tizim holati xato:', err);
    }
  };

  const toggleSystem = async () => {
    const msg = systemOnline
      ? '⛔ Tizimni O\'CHIRMOQCHIMISIZ?\n\nBarcha haydovchilar chiqariladi!'
      : '✅ Tizimni YOQMOQCHIMISIZ?';
    if (!window.confirm(msg)) return;
    setToggling(true);
    try {
      const res = await fetch(`${API}/admin/system-toggle`, {
        method: 'POST',
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ is_online: !systemOnline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setSystemOnline(!systemOnline);
    } catch (err) {
      alert(err.message || 'Xato yuz berdi!');
    }
    setToggling(false);
  };

  const fetchDrivers = async () => {
    setDriversLoading(true);
    try {
      const res = await fetch(`${API}/admin/drivers`, { headers: ADMIN_HEADERS });
      const data = await res.json();
      setDrivers(Array.isArray(data.drivers) ? data.drivers : []);
    } catch (err) {
      console.error('Haydovchilar xato:', err);
    }
    setDriversLoading(false);
  };

  const toggleBlock = async (driver) => {
    if (!window.confirm(`${driver.full_name} ni ${driver.is_blocked ? 'blokdan chiqarish' : 'bloklash'}?`)) return;
    try {
      const res = await fetch(`${API}/admin/driver/${driver.id}/block`, {
        method: 'PUT',
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ is_blocked: !driver.is_blocked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      fetchDrivers();
    } catch (err) {
      alert(err.message || 'Xato!');
    }
  };

  const resetDriverPass = async (driverId) => {
    if (!driverNewPass || driverNewPass.length < 6) {
      alert('Parol kamida 6 ta belgidan iborat bo\'lishi kerak!');
      return;
    }
    try {
      const res = await fetch(`${API}/admin/driver/${driverId}/reset-password`, {
        method: 'POST',
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ new_password: driverNewPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert('✅ ' + data.message);
      setDriverResetId(null);
      setDriverNewPass('');
    } catch (err) {
      alert(err.message || 'Xato!');
    }
  };

  const fetchDispatchers = async () => {
    setDispLoading(true);
    try {
      const res = await fetch(`${API}/admin/dispatchers`, { headers: ADMIN_HEADERS });
      const data = await res.json();
      setDispatchers(Array.isArray(data.dispatchers) ? data.dispatchers : []);
    } catch (err) {
      console.error('Dispetcherlar xato:', err);
    }
    setDispLoading(false);
  };

  const resetDispPass = async (dispId) => {
    if (!dispNewPass || dispNewPass.length < 6) {
      alert('Parol kamida 6 ta belgidan iborat bo\'lishi kerak!');
      return;
    }
    try {
      const res = await fetch(`${API}/admin/dispatcher/${dispId}/reset-password`, {
        method: 'POST',
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ new_password: dispNewPass }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert('✅ ' + data.message);
      setDispResetId(null);
      setDispNewPass('');
    } catch (err) {
      alert(err.message || 'Xato!');
    }
  };

  const deleteDispatcher = async (disp) => {
    if (!window.confirm(`${disp.full_name} ni O'CHIRMOQCHIMISIZ?`)) return;
    try {
      const res = await fetch(`${API}/admin/dispatcher/${disp.id}`, {
        method: 'DELETE',
        headers: ADMIN_HEADERS,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      alert('✅ ' + data.message);
      fetchDispatchers();
    } catch (err) {
      alert(err.message || 'Xato!');
    }
  };

  const formatDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
  };

  const TABS = [
    { key: 'system', label: '⚙️ Tizim' },
    { key: 'drivers', label: '🚗 Haydovchilar' },
    { key: 'dispatchers', label: '👤 Dispetcherlar' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* HEADER */}
      <div className="bg-blue-700 text-white px-6 py-4 flex items-center gap-4 shadow">
        <span className="text-2xl font-bold">🚖 TaxiPark Admin</span>
        <span className={`ml-auto text-sm font-bold px-3 py-1 rounded-full ${systemOnline ? 'bg-green-500' : 'bg-red-500'}`}>
          {systemOnline ? '🟢 Tizim yoqiq' : '🔴 Tizim o\'chiq'}
        </span>
      </div>

      {/* TABS */}
      <div className="flex bg-white border-b shadow-sm">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-4 font-bold text-sm transition ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto p-4">

        {/* ── TIZIM ── */}
        {tab === 'system' && (
          <div className="bg-white rounded-2xl shadow p-8 text-center mt-4">
            <p className="text-8xl mb-4">{systemOnline ? '🟢' : '🔴'}</p>
            <p className="text-3xl font-bold mb-1">{systemOnline ? 'YOQIQ' : 'O\'CHIQ'}</p>
            <p className="text-gray-400 text-sm mb-8">
              {systemOnline ? 'Tizim ishlayapti' : 'Tizim to\'xtatilgan'}
            </p>
            <button
              onClick={toggleSystem}
              disabled={toggling}
              className={`w-full py-5 rounded-2xl text-white text-xl font-bold transition shadow-lg ${
                toggling
                  ? 'bg-gray-400 cursor-not-allowed'
                  : systemOnline
                    ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                    : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
              }`}
            >
              {toggling ? '⏳ Kutilmoqda...' : systemOnline ? '⛔ O\'CHIRISH' : '✅ YOQISH'}
            </button>
            <button
              onClick={fetchStatus}
              className="mt-4 text-sm text-blue-500 hover:underline"
            >
              🔄 Holatni yangilash
            </button>
          </div>
        )}

        {/* ── HAYDOVCHILAR ── */}
        {tab === 'drivers' && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-700">🚗 Haydovchilar ({drivers.length})</h2>
              <button onClick={fetchDrivers} className="text-sm text-blue-500 hover:underline">🔄 Yangilash</button>
            </div>

            {driversLoading ? (
              <p className="text-center text-gray-400 py-8">Yuklanmoqda...</p>
            ) : drivers.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Haydovchilar yo'q</p>
            ) : (
              drivers.map(driver => (
                <div key={driver.id} className={`bg-white rounded-xl shadow p-4 border-l-4 ${driver.is_blocked ? 'border-red-400' : driver.is_online ? 'border-green-400' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800">
                        {driver.is_online ? '🟢' : '⚫'} {driver.full_name}
                      </p>
                      <p className="text-sm text-gray-500">📞 {driver.phone}</p>
                      <p className="text-sm text-gray-500">🚗 {driver.car_model} — {driver.car_number}</p>
                      <p className="text-xs text-gray-400">📅 {formatDate(driver.created_at)}</p>
                      {driver.is_blocked && (
                        <span className="text-xs text-red-500 font-bold">⛔ Bloklangan</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <button
                        onClick={() => toggleBlock(driver)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition ${
                          driver.is_blocked ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                        }`}
                      >
                        {driver.is_blocked ? '✅ Ochish' : '🔒 Bloklash'}
                      </button>
                      <button
                        onClick={() => { setDriverResetId(driver.id); setDriverNewPass(''); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-white transition"
                      >
                        🔑 Parol tiklash
                      </button>
                    </div>
                  </div>

                  {driverResetId === driver.id && (
                    <div className="mt-3 pt-3 border-t flex gap-2">
                      <input
                        type="password"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                        placeholder="Yangi parol (kamida 6 ta belgi)"
                        value={driverNewPass}
                        onChange={e => setDriverNewPass(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && resetDriverPass(driver.id)}
                        autoFocus
                      />
                      <button
                        onClick={() => resetDriverPass(driver.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                      >
                        Saqlash
                      </button>
                      <button
                        onClick={() => { setDriverResetId(null); setDriverNewPass(''); }}
                        className="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── DISPETCHERLAR ── */}
        {tab === 'dispatchers' && (
          <div className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-700">👤 Dispetcherlar ({dispatchers.length})</h2>
              <button onClick={fetchDispatchers} className="text-sm text-blue-500 hover:underline">🔄 Yangilash</button>
            </div>

            {dispLoading ? (
              <p className="text-center text-gray-400 py-8">Yuklanmoqda...</p>
            ) : dispatchers.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Dispetcherlar yo'q</p>
            ) : (
              dispatchers.map(disp => (
                <div key={disp.id} className="bg-white rounded-xl shadow p-4 border-l-4 border-blue-300">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800">👤 {disp.full_name}</p>
                      <p className="text-sm text-gray-500">🆔 @{disp.username}</p>
                      <p className="text-xs text-gray-400">📅 {formatDate(disp.created_at)}</p>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <button
                        onClick={() => { setDispResetId(disp.id); setDispNewPass(''); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-white transition"
                      >
                        🔑 Parol tiklash
                      </button>
                      <button
                        onClick={() => deleteDispatcher(disp)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition"
                      >
                        🗑 O'chirish
                      </button>
                    </div>
                  </div>

                  {dispResetId === disp.id && (
                    <div className="mt-3 pt-3 border-t flex gap-2">
                      <input
                        type="password"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                        placeholder="Yangi parol (kamida 6 ta belgi)"
                        value={dispNewPass}
                        onChange={e => setDispNewPass(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && resetDispPass(disp.id)}
                        autoFocus
                      />
                      <button
                        onClick={() => resetDispPass(disp.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                      >
                        Saqlash
                      </button>
                      <button
                        onClick={() => { setDispResetId(null); setDispNewPass(''); }}
                        className="px-3 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}
