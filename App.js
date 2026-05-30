import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { io } from 'socket.io-client';
import * as Location from 'expo-location';

const API = 'https://taxipark-production.up.railway.app/api';
const SOCKET_URL = 'https://taxipark-production.up.railway.app';
const PRICE_PER_KM = 2000;
const BASE_PRICE = 500;

const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export default function App() {
  const [screen, setScreen] = useState('login');
  const [activeTab, setActiveTab] = useState('home');
  const [token, setToken] = useState(null);
  const [driver, setDriver] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  const [incomingOrder, setIncomingOrder] = useState(null);
  const [acceptedOrder, setAcceptedOrder] = useState(null);
  const [isRiding, setIsRiding] = useState(false);

  const [price, setPrice] = useState(BASE_PRICE);
  const [seconds, setSeconds] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [orders, setOrders] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regCar, setRegCar] = useState('');
  const [regCarNumber, setRegCarNumber] = useState('');

  const timerRef = useRef(null);
  const locationRef = useRef(null);
  const lastPosRef = useRef(null);
  const socketRef = useRef(null);
  const driverRef = useRef(null);

  useEffect(() => { checkToken(); }, []);

  useEffect(() => {
    driverRef.current = driver;
  }, [driver]);

  // ✅ Bloklangan haydovchini avtomatik chiqarish
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 403) {
          await AsyncStorage.clear();
          setToken(null);
          setDriver(null);
          setIsOnline(false);
          setIncomingOrder(null);
          setAcceptedOrder(null);
          setIsRiding(false);
          setScreen('login');
          Alert.alert(
            '🔴 Hisob bloklangan!',
            'Hisobingiz admin tomonidan bloklangan. Adminga murojaat qiling.'
          );
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  useEffect(() => {
    if (token) {
      socketRef.current = io(SOCKET_URL);

      socketRef.current.on('connect', () => {
        console.log('Socket ulandi!');
        if (driverRef.current?.id) {
          socketRef.current.emit('driver_connected', driverRef.current.id);
          console.log('driver_connected yuborildi:', driverRef.current.id);
        }
      });

      socketRef.current.on('new_order', (order) => {
        if (!isRiding && !acceptedOrder) {
          setIncomingOrder(order);
        }
      });
    }
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, [token, isRiding, acceptedOrder]);

  useEffect(() => {
    if (token && activeTab === 'history') fetchOrders();
    if (token && activeTab === 'payment') fetchDailyReport();
  }, [activeTab]);

  useEffect(() => {
    if (isOnline && token) startLocationTracking();
    else stopLocationTracking();
    return () => stopLocationTracking();
  }, [isOnline]);

  const startLocationTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    locationRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
      async (loc) => {
        const { latitude, longitude } = loc.coords;
        try {
          await axios.put(`${API}/driver/location`,
            { latitude, longitude },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch (e) {}
      }
    );
  };

  const stopLocationTracking = () => {
    if (locationRef.current) { locationRef.current.remove(); locationRef.current = null; }
  };

  const checkToken = async () => {
    const t = await AsyncStorage.getItem('token');
    const d = await AsyncStorage.getItem('driver');
    if (t && d) {
      const parsedDriver = JSON.parse(d);
      setToken(t);
      setDriver(parsedDriver);
      driverRef.current = parsedDriver;
      setScreen('home');
    }
  };

  const login = async () => {
    try {
      const res = await axios.post(`${API}/auth/login`, { phone, password });
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('driver', JSON.stringify(res.data.driver));
      setToken(res.data.token);
      setDriver(res.data.driver);
      driverRef.current = res.data.driver;
      setScreen('home');
    } catch (err) {
      Alert.alert('Xato!', err.response?.data?.message || 'Xato yuz berdi');
    }
  };

  const register = async () => {
    if (!regName || !phone || !password || !regCar || !regCarNumber) {
      Alert.alert('Xato!', "Barcha maydonlarni to'ldiring!"); return;
    }
    try {
      await axios.post(`${API}/auth/register`, {
        full_name: regName, phone, password, car_model: regCar, car_number: regCarNumber
      });
      Alert.alert('Muvaffaqiyat!', "Ro'yxatdan o'tdingiz! Endi kiring.");
      setScreen('login');
    } catch (err) {
      Alert.alert('Xato!', err.response?.data?.message || 'Xato yuz berdi');
    }
  };

  const logout = async () => {
    await AsyncStorage.clear();
    setToken(null); setDriver(null); setScreen('login');
  };

  const toggleOnline = async (val) => {
    try {
      await axios.put(`${API}/driver/status`,
        { is_online: val },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsOnline(val);
    } catch (err) {
      Alert.alert('Xato!', "Status o'zgartirishda xato");
    }
  };

  const acceptOrder = async () => {
    try {
      await axios.post(`${API}/order/accept`,
        { order_id: incomingOrder.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAcceptedOrder(incomingOrder);
      setIncomingOrder(null);
    } catch (err) {
      Alert.alert('Xato!', 'Qabul qilishda xato');
    }
  };

  const rejectOrder = async () => {
    try {
      await axios.post(`${API}/order/reject`,
        { order_id: incomingOrder.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {}
    setIncomingOrder(null);
  };

  const startRide = async () => {
    try {
      await axios.post(`${API}/order/start`,
        { order_id: acceptedOrder.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsRiding(true);
      setPrice(BASE_PRICE);
      setSeconds(0);
      setDistanceKm(0);
      lastPosRef.current = null;

      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            if (lastPosRef.current) {
              const km = getDistanceKm(lastPosRef.current.lat, lastPosRef.current.lon, latitude, longitude);
              if (km > 0.005) {
                setDistanceKm(d => {
                  const newDist = d + km;
                  setPrice(BASE_PRICE + Math.round(newDist * PRICE_PER_KM));
                  return newDist;
                });
              }
            }
            lastPosRef.current = { lat: latitude, lon: longitude };
            axios.put(`${API}/driver/location`, { latitude, longitude },
              { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
          }
        );
      }
    } catch (err) {
      Alert.alert('Xato!', 'Reysni boshlashda xato');
    }
  };

  const finishRide = async () => {
    try {
      clearInterval(timerRef.current);
      if (locationRef.current) { locationRef.current.remove(); locationRef.current = null; }
      await axios.post(`${API}/order/finish`,
        { order_id: acceptedOrder.id, total_price: price },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Reys tugadi! ✅',
        `📏 Masofa: ${distanceKm.toFixed(2)} km\n💰 Jami: ${price.toLocaleString()} so'm\n🏢 Kompaniya: ${BASE_PRICE.toLocaleString()} so'm\n👤 Sizniki: ${(price - BASE_PRICE).toLocaleString()} so'm`
      );
      setIsRiding(false);
      setAcceptedOrder(null);
      setPrice(BASE_PRICE);
      setSeconds(0);
      setDistanceKm(0);
      lastPosRef.current = null;
    } catch (err) {
      Alert.alert('Xato!', 'Reysni tugatishda xato');
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API}/order/my-orders`, { headers: { Authorization: `Bearer ${token}` } });
      setOrders(res.data.orders);
    } catch (err) {}
  };

  const fetchDailyReport = async () => {
    try {
      const res = await axios.get(`${API}/payment/daily-report`, { headers: { Authorization: `Bearer ${token}` } });
      setDailyReport(res.data);
    } catch (err) {}
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getDate()}.${d.getMonth()+1}.${d.getFullYear()} ${d.getHours()}:${d.getMinutes() < 10 ? '0' : ''}${d.getMinutes()}`;
  };

  const getStatusText = (status) => {
    if (status === 'new') return '🆕 Yangi';
    if (status === 'assigned') return '📤 Yuborildi';
    if (status === 'accepted') return '✋ Qabul qilindi';
    if (status === 'started') return '▶️ Ketmoqda';
    if (status === 'finished') return '✅ Tugadi';
    return status;
  };

  if (screen === 'login') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🚖 TaxiPark</Text>
        <Text style={styles.subtitle}>Haydovchi ilovasi</Text>
        <TextInput style={styles.input} placeholder="Telefon raqam" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Parol" value={password} onChangeText={setPassword} secureTextEntry />
        <TouchableOpacity style={styles.btn} onPress={login}><Text style={styles.btnText}>Kirish</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setScreen('register')} style={styles.linkBtn}>
          <Text style={styles.linkText}>Ro'yxatdan o'tish</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (screen === 'register') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>🚖 TaxiPark</Text>
        <Text style={styles.subtitle}>Ro'yxatdan o'tish</Text>
        <TextInput style={styles.input} placeholder="Ism Familiya" value={regName} onChangeText={setRegName} />
        <TextInput style={styles.input} placeholder="Telefon raqam" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <TextInput style={styles.input} placeholder="Parol" value={password} onChangeText={setPassword} secureTextEntry />
        <TextInput style={styles.input} placeholder="Mashina modeli (Nexia, Cobalt...)" value={regCar} onChangeText={setRegCar} />
        <TextInput style={styles.input} placeholder="Mashina raqami (01A123BC)" value={regCarNumber} onChangeText={setRegCarNumber} autoCapitalize="characters" />
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>⚠️ Mashina ma'lumotlari kiritilgandan so'ng o'zgartirib bo'lmaydi!</Text>
        </View>
        <TouchableOpacity style={styles.btn} onPress={register}><Text style={styles.btnText}>Ro'yxatdan o'tish</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setScreen('login')} style={styles.linkBtn}>
          <Text style={styles.linkText}>Kirish</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: '#f3f4f6'}}>
      <View style={styles.header}>
        <Text style={styles.headerText}>🚖 TaxiPark</Text>
        <Text style={styles.headerSub}>{driver?.full_name}</Text>
      </View>

      <ScrollView style={styles.scroll}>
        {activeTab === 'home' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.driverName}>👤 {driver?.full_name}</Text>
              <Text style={styles.driverInfo}>🚗 {driver?.car_model} | {driver?.car_number}</Text>
              <Text style={styles.driverInfo}>📞 {driver?.phone}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>{isOnline ? '🟢 Men ishlayman' : '🔴 Men dam olaman'}</Text>
                <Switch value={isOnline} onValueChange={toggleOnline} trackColor={{ false: '#ccc', true: '#22c55e' }} />
              </View>
            </View>

            {incomingOrder && !acceptedOrder && !isRiding && (
              <View style={[styles.card, {borderLeftWidth: 4, borderLeftColor: '#f59e0b', backgroundColor: '#fffbeb'}]}>
                <Text style={[styles.orderTitle, {color: '#d97706'}]}>🔔 Yangi zakaz keldi!</Text>
                <Text style={styles.orderInfo}>📞 {incomingOrder.customer_phone}</Text>
                <Text style={styles.orderInfo}>📍 {incomingOrder.from_address}</Text>
                <Text style={styles.orderInfo}>💰 Boshlang'ich: {BASE_PRICE.toLocaleString()} so'm</Text>
                <View style={styles.row}>
                  <TouchableOpacity
                    style={[styles.actionBtn, {backgroundColor: '#16a34a', flex: 1, marginRight: 8}]}
                    onPress={acceptOrder}
                  >
                    <Text style={styles.btnText}>✅ QABUL QILISH</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, {backgroundColor: '#dc2626', flex: 1}]}
                    onPress={rejectOrder}
                  >
                    <Text style={styles.btnText}>❌ RAD ETISH</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {acceptedOrder && !isRiding && (
              <View style={[styles.card, {borderLeftWidth: 4, borderLeftColor: '#8b5cf6', backgroundColor: '#f5f3ff'}]}>
                <Text style={[styles.orderTitle, {color: '#7c3aed'}]}>✋ Zakaz qabul qilindi</Text>
                <Text style={styles.orderInfo}>📞 {acceptedOrder.customer_phone}</Text>
                <Text style={styles.orderInfo}>📍 {acceptedOrder.from_address}</Text>
                <View style={[styles.card, {backgroundColor: '#ede9fe', margin: 0, marginTop: 10}]}>
                  <Text style={{color: '#6d28d9', fontWeight: 'bold', fontSize: 13}}>
                    ℹ️ Yo'lovchiga qo'ng'iroq qiling, moshinaga o'tirgandan keyin "BOSHLASH" ni bosing
                  </Text>
                </View>
                <TouchableOpacity style={[styles.startBtn, {marginTop: 12}]} onPress={startRide}>
                  <Text style={styles.btnText}>▶️ BOSHLASH</Text>
                </TouchableOpacity>
              </View>
            )}

            {isRiding && acceptedOrder && (
              <View style={[styles.card, {borderLeftWidth: 4, borderLeftColor: '#16a34a'}]}>
                <Text style={[styles.orderTitle, {color: '#16a34a'}]}>▶️ Reys davom etmoqda</Text>
                <Text style={styles.orderInfo}>📞 {acceptedOrder.customer_phone}</Text>
                <Text style={styles.orderInfo}>📍 {acceptedOrder.from_address}</Text>
                <View style={styles.meter}>
                  <Text style={styles.meterPrice}>{price.toLocaleString()} so'm</Text>
                  <View style={styles.meterStats}>
                    <Text style={styles.meterStat}>📏 {distanceKm.toFixed(2)} km</Text>
                    <Text style={styles.meterStat}>⏱ {formatTime(seconds)}</Text>
                  </View>
                  <Text style={styles.meterRate}>1 km = {PRICE_PER_KM.toLocaleString()} so'm</Text>
                  <TouchableOpacity style={styles.stopBtn} onPress={finishRide}>
                    <Text style={styles.btnText}>🛑 TUGATISH</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!incomingOrder && !acceptedOrder && !isRiding && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📭 Zakaz kutilmoqda...</Text>
                <Text style={styles.driverInfo}>Online bo'ling va zakaz kuting</Text>
              </View>
            )}
          </View>
        )}

        {activeTab === 'history' && (
          <View>
            <View style={styles.card}><Text style={styles.driverName}>📋 Buyurtmalar tarixi</Text></View>
            {orders.length === 0 ? (
              <View style={styles.card}><Text style={styles.driverInfo}>Hozircha tarix yo'q</Text></View>
            ) : (
              orders.map(order => (
                <View key={order.id} style={styles.card}>
                  <View style={styles.row}>
                    <Text style={styles.orderInfo}>📞 {order.customer_phone}</Text>
                    <Text style={styles.statusBadge}>{getStatusText(order.status)}</Text>
                  </View>
                  <Text style={styles.orderInfo}>📍 {order.from_address}</Text>
                  <Text style={styles.priceText}>💰 {order.total_price ? Math.round(order.total_price).toLocaleString() : 0} so'm</Text>
                  <Text style={styles.dateText}>🕐 {formatDate(order.created_at)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'payment' && (
          <View>
            <View style={styles.card}><Text style={styles.driverName}>💰 Bugungi hisobot</Text></View>
            {dailyReport && dailyReport.total_orders > 0 ? (
              <View>
                <View style={styles.card}>
                  <Text style={styles.reportItem}>📦 Jami reyslar: {dailyReport.total_orders} ta</Text>
                  <Text style={styles.reportItem}>💵 Jami daromad: {Math.round(dailyReport.total_earned).toLocaleString()} so'm</Text>
                  <Text style={[styles.reportItem, {color: '#dc2626'}]}>🏢 Kompaniya: {Math.round(dailyReport.company_amount).toLocaleString()} so'm</Text>
                  <Text style={[styles.reportItem, {color: '#16a34a', fontSize: 18, fontWeight: 'bold'}]}>👤 Sizniki: {Math.round(dailyReport.driver_amount).toLocaleString()} so'm</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>💳 To'lov qilish</Text>
                  <Text style={styles.driverInfo}>Kompaniya kartasi:</Text>
                  <Text style={styles.cardNumber}>8600 **** **** 1234</Text>
                  <Text style={[styles.reportItem, {color: '#dc2626', fontWeight: 'bold'}]}>
                    Miqdor: {Math.round(dailyReport.company_amount).toLocaleString()} so'm
                  </Text>
                  <Text style={styles.driverInfo}>Payme yoki Click orqali o'tkazing</Text>
                </View>
              </View>
            ) : (
              <View style={styles.card}><Text style={styles.driverInfo}>Bugun tugallangan reys yo'q</Text></View>
            )}
          </View>
        )}

        {activeTab === 'profile' && (
          <View>
            <View style={styles.card}><Text style={styles.driverName}>👤 Profil</Text></View>
            <View style={styles.card}>
              <Text style={styles.reportItem}>👤 Ism: {driver?.full_name}</Text>
              <Text style={styles.reportItem}>📞 Tel: {driver?.phone}</Text>
              <Text style={styles.reportItem}>🚗 Mashina: {driver?.car_model}</Text>
              <Text style={styles.reportItem}>🔢 Raqam: {driver?.car_number}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.driverInfo}>⚠️ Ma'lumotlarni o'zgartirish uchun adminga murojaat qiling</Text>
            </View>
            <TouchableOpacity style={[styles.btn, {margin: 10, backgroundColor: '#dc2626'}]} onPress={logout}>
              <Text style={styles.btnText}>🚪 Chiqish</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        {[
          {tab: 'home', icon: '🏠', label: 'Asosiy'},
          {tab: 'history', icon: '📋', label: 'Tarix'},
          {tab: 'payment', icon: '💰', label: "To'lov"},
          {tab: 'profile', icon: '👤', label: 'Profil'},
        ].map(({tab, icon, label}) => (
          <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
            <Text style={styles.tabIcon}>{icon}</Text>
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f3f4f6' },
  scroll: { flex: 1 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: '#1d4ed8', marginBottom: 5 },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#6b7280', marginBottom: 30 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 15, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  btn: { backgroundColor: '#1d4ed8', borderRadius: 10, padding: 15, alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  linkBtn: { alignItems: 'center', marginTop: 5 },
  linkText: { color: '#1d4ed8', fontSize: 15 },
  warningBox: { backgroundColor: '#fef3c7', borderRadius: 10, padding: 12, marginBottom: 15 },
  warningText: { color: '#92400e', fontSize: 13 },
  header: { backgroundColor: '#1d4ed8', padding: 20, paddingTop: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#fff', fontSize: 13 },
  card: { backgroundColor: '#fff', margin: 10, borderRadius: 12, padding: 15, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  driverName: { fontSize: 18, fontWeight: 'bold', color: '#1d4ed8', marginBottom: 5 },
  driverInfo: { fontSize: 14, color: '#6b7280', marginTop: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  orderInfo: { fontSize: 14, color: '#374151', marginBottom: 5 },
  actionBtn: { borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
  meter: { alignItems: 'center', marginTop: 15 },
  meterPrice: { fontSize: 42, fontWeight: 'bold', color: '#16a34a' },
  meterStats: { flexDirection: 'row', gap: 20, marginTop: 5, marginBottom: 5 },
  meterStat: { fontSize: 16, color: '#6b7280', fontWeight: 'bold' },
  meterRate: { fontSize: 12, color: '#9ca3af', marginBottom: 15 },
  startBtn: { backgroundColor: '#16a34a', borderRadius: 10, padding: 15, alignItems: 'center' },
  stopBtn: { backgroundColor: '#dc2626', borderRadius: 10, padding: 15, alignItems: 'center', width: '100%' },
  tabBar: { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingVertical: 8, paddingBottom: 15 },
  tabItem: { flex: 1, alignItems: 'center' },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  tabActive: { color: '#1d4ed8', fontWeight: 'bold' },
  statusBadge: { fontSize: 12, color: '#1d4ed8' },
  priceText: { fontSize: 15, fontWeight: 'bold', color: '#16a34a', marginTop: 5 },
  dateText: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  reportItem: { fontSize: 15, color: '#374151', marginBottom: 8 },
  cardNumber: { fontSize: 18, fontWeight: 'bold', color: '#1d4ed8', marginVertical: 8 },
});