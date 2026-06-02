import React, { useState, useEffect } from 'react';

const API = process.env.REACT_APP_API_URL || 'https://taxipark-production.up.railway.app/api';
const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  'x-admin-key': process.env.REACT_APP_ADMIN_KEY || '',
};

export default function App() {
  const [systemOnline, setSystemOnline] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/admin/system-status`, { headers: ADMIN_HEADERS });
      const data = await res.json();
      setSystemOnline(data.is_online);
    } catch (err) {}
  };

  const toggleSystem = async () => {
    const confirmMsg = systemOnline
      ? '⛔ Tizimni O\'CHIRMOQCHIMISIZ?\n\nBarcha haydovchilar chiqariladi!'
      : '✅ Tizimni YOQMOQCHIMISIZ?';

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      await fetch(`${API}/admin/system-toggle`, {
        method: 'POST',
        headers: ADMIN_HEADERS,
        body: JSON.stringify({ is_online: !systemOnline })
      });
      setSystemOnline(!systemOnline);
    } catch (err) {
      alert('Xato yuz berdi!');
    }
    setLoading(false);
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center ${systemOnline ? 'bg-green-50' : 'bg-red-50'}`}>
      <h1 className="text-2xl font-bold text-gray-700 mb-8">⚙️ TaxiPark</h1>

      <div className={`rounded-3xl shadow-2xl p-12 text-center border-4 w-80 ${systemOnline ? 'bg-white border-green-400' : 'bg-white border-red-400'}`}>
        <p className="text-8xl mb-6">{systemOnline ? '🟢' : '🔴'}</p>
        <p className="text-3xl font-bold mb-2">
          {systemOnline ? 'YOQIQ' : 'O\'CHIQ'}
        </p>
        <p className="text-gray-400 text-sm mb-8">
          {systemOnline ? 'Tizim ishlayapti' : 'Tizim to\'xtatilgan'}
        </p>

        <button
          onClick={toggleSystem}
          disabled={loading}
          className={`w-full py-5 rounded-2xl text-white text-xl font-bold transition shadow-lg ${
            loading
              ? 'bg-gray-400 cursor-not-allowed'
              : systemOnline
                ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                : 'bg-green-500 hover:bg-green-600 active:bg-green-700'
          }`}
        >
          {loading ? '⏳' : systemOnline ? '⛔ O\'CHIRISH' : '✅ YOQISH'}
        </button>
      </div>
    </div>
  );
}