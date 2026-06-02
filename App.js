import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ScrollView, Switch, Modal, FlatList, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { io } from 'socket.io-client';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';

const API = 'https://taxipark-production.up.railway.app/api';
const SOCKET_URL = 'https://taxipark-production.up.railway.app';
const BASE_PRICE = 500;
const COMPANY_SHARE = 900;
const PAUSE_PRICE_PER_MIN = 200;
const WAITING_FREE_MINUTES = 3;
const WAITING_PRICE_PER_MIN = 1000;
const DAY_RATES  = { first: 6000, second: 5000, rest: 4500 };
const NIGHT_RATES = { first: 8000, second: 7000, rest: 6500 };
const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Background GPS task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  if (data) {
    const { locations } = data;
    const loc = locations[0];
    if (loc) {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        try {
          await fetch(`${API}/driver/location`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude
            })
          });
        } catch (e) {}
      }
    }
  }
});

// Push notification sozlamalari
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Haversine formulasi
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

// Narx hisoblash
const calcPrice = (km, isNight) => {
  const r = isNight ? NIGHT_RATES : DAY_RATES;
  let totalKmPrice = 0;
  if (km <= 1)      totalKmPrice = km * r.first;
  else if (km <= 2) totalKmPrice = r.first + (km - 1) * r.second;
  else              totalKmPrice = r.first + r.second + (km - 2) * r.rest;
  return Math.round(BASE_PRICE + totalKmPrice);
};

// Qo'shimcha xizmatlar ro'yxati
const EXTRA_SERVICES = [
  { id: 'bagaj',       emoji: '🧳', label: 'Bagaj',          price: 3000 },
  { id: 'tom_bagaj',   emoji: '🚗', label: 'Tom bagaj',      price: 10000 },
  { id: 'yo5',         emoji: '👤', label: '5-chi yo\'lovchi', price: 3000 },
  { id: 'yo6',         emoji: '👥', label: '6-chi yo\'lovchi', price: 5000 },
  { id: 'dastavka',    emoji: '📦', label: 'Dastavka',       price: 5000 },
  { id: 'tortish',     emoji: '🚛', label: 'Moshina tortish', price: 50000 },
  { id: 'gaz',         emoji: '⛽', label: 'Gaz o\'tkazish', price: 25000 },
  { id: 'nasos',       emoji: '🔧', label: 'Nasos',          price: 15000 },
  { id: 'akum',        emoji: '🔋', label: 'Akumlyator',     price: 15000 },
  { id: 'zapas',       emoji: '🛞', label: 'Zapas balon',    price: 15000 },
];

export default function App() {
  const [screen, setScreen] = useState('login');
  const [activeTab, setActiveTab] = useState('home');
  const [token, setToken] = useState(null);
  const [driver, setDriver] = useState(null);
  const [isOnline, setIsOnline] = useState(false);

  const [incomingOrder, setIncomingOrder] = useState(null);
  const [acceptedOrder, setAcceptedOrder] = useState(null);
  const [isRiding, setIsRiding] = useState(false);
  const [isArrived, setIsArrived] = useState(false);
  const [waitingSeconds, setWaitingSeconds] = useState(0);

  // Qo'shimcha xizmatlar
  const [showServices, setShowServices] = useState(false);
  const [selectedServices, setSelectedServices] = useState([]);

  // Taxametr
  const [price, setPrice] = useState(BASE_PRICE);
  const [seconds, setSeconds] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [isNightRide, setIsNightRide] = useState(false);

  // Pauza
  const [isPaused, setIsPaused] = useState(false);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const [pausePrice, setPausePrice] = useState(0);

  // Xabarlar
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMessages, setShowMessages] = useState(false);

  const [orders, setOrders] = useState([]);
  const [dailyReport, setDailyReport] = useState(null);

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regCar, setRegCar] = useState('');
  const [regCarNumber, setRegCarNumber] = useState('');

  // Tarif
  const [pendingTariff, setPendingTariff] = useState(null); // tanlangan lekin faollashtirilmagan tarif

  const timerRef = useRef(null);
  const pauseTimerRef = useRef(null);
  const locationRef = useRef(null);
  const lastPosRef = useRef(null);
  const socketRef = useRef(null);
  const driverRef = useRef(null);
  const distanceRef = useRef(0);
  const isNightRef = useRef(false);
  const pauseSecondsRef = useRef(0);
  const tokenRef = useRef(null);
  const extraPriceRef = useRef(0);
  const waitingTimerRef = useRef(null);
  const waitingSecondsRef = useRef(0);

  useEffect(() => { checkToken(); }, []);
  useEffect(() => { driverRef.current = driver; }, [driver]);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // Bloklangan / tarifi tugagan haydovchini ushlash
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      async error => {
        if (error.response?.status === 403) {
          if (error.response?.data?.tariff_expired) {
            // Tarifni yangilash ekraniga o'tkazish
            setScreen('tariff_select');
          } else {
            await AsyncStorage.clear();
            setToken(null); setDriver(null); setIsOnline(false);
            setIncomingOrder(null); setAcceptedOrder(null); setIsRiding(false);
            setScreen('login');
            Alert.alert('🔴 Hisob bloklangan!', 'Hisobingiz admin tomonidan bloklangan. Adminga murojaat qiling.');
          }
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  // Socket
  useEffect(() => {
    if (token) {
      socketRef.current = io(SOCKET_URL);
      socketRef.current.on('connect', () => {
        if (driverRef.current?.id) {
          socketRef.current.emit('driver_connected', driverRef.current.id);
        }
      });
      socketRef.current.on('new_order', (order) => {
        if (!isRiding && !acceptedOrder) setIncomingOrder(order);
      });
      socketRef.current.on('broadcast_message', () => {
        fetchMessages();
      });

      // Tarif faollashtirildi
      socketRef.current.on('tariff_activated', async (data) => {
        const stored = await AsyncStorage.getItem('driver');
        if (stored) {
          const d = { ...JSON.parse(stored), tariff_type: data.tariff_type, tariff_expires_at: data.tariff_expires_at };
          await AsyncStorage.setItem('driver', JSON.stringify(d));
          setDriver(d);
          driverRef.current = d;
        }
        setScreen('home');
        Alert.alert('✅ Tarif faollashtirildi!', `${data.tariff_type === 'half_day' ? 'Yarim kunlik' : data.tariff_type === 'daily' ? 'Kunlik' : data.tariff_type === 'monthly' ? 'Oylik' : 'Donali'} tarif faol.`);
      });

      // Tizim o'chirildi
      socketRef.current.on('system_offline', async (data) => {
        await AsyncStorage.clear();
        setToken(null); setDriver(null); setIsOnline(false);
        setIncomingOrder(null); setAcceptedOrder(null); setIsRiding(false);
        setScreen('login');
       Alert.alert("⛔ Tizim o'chirildi", data.message || "Tizim vaqtincha o'chirildi.");
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

  // Push token olish
  const registerForPushNotifications = async (authToken) => {
    try {
      if (!Device.isDevice) return;
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      await axios.post(`${API}/message/push-token`,
        { expo_push_token: tokenData.data },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
    } catch (e) {}
  };

  const fetchMessages = async () => {
    if (!tokenRef.current) return;
    try {
      const res = await axios.get(`${API}/message/my`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` }
      });
      setMessages(res.data.messages || []);
      setUnreadCount(res.data.unread_count || 0);
    } catch (e) {}
  };

  const openMessages = async () => {
    setShowMessages(true);
    try {
      await axios.put(`${API}/message/read-all`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUnreadCount(0);
    } catch (e) {}
  };

  const startLocationTracking = async () => {
    try {
      const { status: fg } = await Location.requestForegroundPermissionsAsync();
      if (fg !== 'granted') return;

      const { status: bg } = await Location.requestBackgroundPermissionsAsync();

      // Background GPS (ekran o'chganda ham ishlaydi)
      if (bg === 'granted') {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (!isRegistered) {
          await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
            foregroundService: {
              notificationTitle: '🚖 TaxiPark',
              notificationBody: 'GPS faol — haydovchi holati kuzatilmoqda',
              notificationColor: '#1d4ed8',
            },
          });
        }
      } else {
        // Faqat foreground
        locationRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
          async (loc) => {
            try {
              await axios.put(`${API}/driver/location`,
                { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
                { headers: { Authorization: `Bearer ${token}` } }
              );
            } catch (e) {}
          }
        );
      }
    } catch (e) {}
  };

  const stopLocationTracking = async () => {
    if (locationRef.current) { locationRef.current.remove(); locationRef.current = null; }
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
      if (isRegistered) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    } catch (e) {}
  };

  const getTariffScreen = (d) => {
    if (!d.tariff_type) return 'tariff_select';
    if (d.tariff_type === 'per_order') return 'home';
    if (!d.tariff_expires_at || new Date(d.tariff_expires_at) < new Date()) return 'tariff_select';
    return 'home';
  };

  const checkToken = async () => {
    const t = await AsyncStorage.getItem('token');
    const d = await AsyncStorage.getItem('driver');
    if (t && d) {
      const parsedDriver = JSON.parse(d);
      setToken(t); setDriver(parsedDriver);
      driverRef.current = parsedDriver; tokenRef.current = t;
      setScreen(getTariffScreen(parsedDriver));
      fetchMessages();
      registerForPushNotifications(t);
    }
  };

  const login = async () => {
    try {
      const res = await axios.post(`${API}/auth/login`, { phone, password });
      const d = res.data.driver;
      await AsyncStorage.setItem('token', res.data.token);
      await AsyncStorage.setItem('driver', JSON.stringify(d));
      setToken(res.data.token); setDriver(d);
      driverRef.current = d; tokenRef.current = res.data.token;
      setScreen(getTariffScreen(d));
      fetchMessages();
      registerForPushNotifications(res.data.token);
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
    await stopLocationTracking();
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
      setSelectedServices([]);
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

  const handleArrived = () => {
    setIsArrived(true);
    setWaitingSeconds(0);
    waitingSecondsRef.current = 0;
    waitingTimerRef.current = setInterval(() => {
      waitingSecondsRef.current += 1;
      setWaitingSeconds(s => s + 1);
    }, 1000);
  };

  // Xizmat tanlash/bekor qilish
  const toggleService = (serviceId) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const getExtraServicesTotal = (selected) => {
    return selected.reduce((sum, id) => {
      const s = EXTRA_SERVICES.find(s => s.id === id);
      return sum + (s ? s.price : 0);
    }, 0);
  };

  const startRide = async () => {
    // Avval xizmatlar ekranini ko'rsat
    setShowServices(true);
  };

  const confirmStartRide = async () => {
    try {
      setShowServices(false);
      clearInterval(waitingTimerRef.current);

      await axios.post(`${API}/order/start`,
        { order_id: acceptedOrder.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const hour = new Date().getHours();
      const nightMode = hour >= 18 || hour < 6;
      setIsNightRide(nightMode);
      isNightRef.current = nightMode;

      const extraTotal = getExtraServicesTotal(selectedServices);
      extraPriceRef.current = extraTotal;

      setIsRiding(true);
      setPrice(BASE_PRICE + extraTotal);
      setSeconds(0);
      setDistanceKm(0);
      setIsPaused(false);
      setPauseSeconds(0);
      setPausePrice(0);
      lastPosRef.current = null;
      distanceRef.current = 0;
      pauseSecondsRef.current = 0;

      timerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        locationRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 20, timeInterval: 5000 },
          (loc) => {
            const { latitude, longitude } = loc.coords;
            if (!isPaused) {
              if (lastPosRef.current) {
                const km = getDistanceKm(lastPosRef.current.lat, lastPosRef.current.lon, latitude, longitude);
                if (km > 0.005) {
                  distanceRef.current += km;
                  const newDist = distanceRef.current;
                  setDistanceKm(newDist);
                  setPrice(
                    calcPrice(newDist, isNightRef.current) +
                    Math.round(pauseSecondsRef.current / 60) * 200 +
                    extraPriceRef.current
                  );
                }
              }
              lastPosRef.current = { lat: latitude, lon: longitude };
            }
            axios.put(`${API}/driver/location`, { latitude, longitude },
              { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
          }
        );
      }
    } catch (err) {
      Alert.alert('Xato!', 'Reysni boshlashda xato');
    }
  };

  const togglePause = () => {
    if (!isPaused) {
      setIsPaused(true);
      lastPosRef.current = null;
      pauseTimerRef.current = setInterval(() => {
        pauseSecondsRef.current += 1;
        setPauseSeconds(s => {
          const newSec = s + 1;
          const newPausePrice = Math.round(newSec / 60) * 200;
          setPausePrice(newPausePrice);
          setPrice(
            calcPrice(distanceRef.current, isNightRef.current) +
            newPausePrice +
            extraPriceRef.current
          );
          return newSec;
        });
      }, 1000);
    } else {
      setIsPaused(false);
      clearInterval(pauseTimerRef.current);
      lastPosRef.current = null;
    }
  };

  const finishRide = async () => {
    try {
      clearInterval(timerRef.current);
      clearInterval(pauseTimerRef.current);
      clearInterval(waitingTimerRef.current);
      if (locationRef.current) { locationRef.current.remove(); locationRef.current = null; }

      const pauseMinutes = pauseSecondsRef.current / 60;
      const waitingMinutes = waitingSecondsRef.current / 60;
      const extraTotal = extraPriceRef.current;

      const res = await axios.post(`${API}/order/finish`,
        {
          order_id: acceptedOrder.id,
          distance_km: distanceRef.current,
          pause_minutes: pauseMinutes,
          waiting_minutes: waitingMinutes,
          extra_price: extraTotal,
          extra_services: selectedServices
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { total_price, pause_price, waiting_fee, is_night } = res.data;
      const kmPrice = total_price - BASE_PRICE - (pause_price || 0) - (waiting_fee || 0) - extraTotal;

      let alertMsg = `${is_night ? '🌙 Tun narxi' : '☀️ Kunduz narxi'}\n`;
      alertMsg += `📏 Masofa: ${distanceRef.current.toFixed(2)} km\n`;
      alertMsg += `💰 Km narxi: ${kmPrice.toLocaleString()} so'm\n`;
      if (waiting_fee > 0) {
        const billableMins = Math.ceil((waitingSecondsRef.current - WAITING_FREE_MINUTES * 60) / 60);
        alertMsg += `⏳ Kutish: ${billableMins} min = ${waiting_fee.toLocaleString()} so'm\n`;
      }
      if (pause_price > 0) {
        alertMsg += `⏸ Pauza: ${Math.floor(pauseSecondsRef.current / 60)} min = ${pause_price.toLocaleString()} so'm\n`;
      }
      if (extraTotal > 0) {
        const selected = EXTRA_SERVICES.filter(s => selectedServices.includes(s.id));
        selected.forEach(s => {
          alertMsg += `${s.emoji} ${s.label}: +${s.price.toLocaleString()} so'm\n`;
        });
      }
      alertMsg += `🏢 Kompaniya: ${COMPANY_SHARE.toLocaleString()} so'm\n`;
      alertMsg += `━━━━━━━━━━━━━━\n`;
      alertMsg += `💵 JAMI: ${total_price.toLocaleString()} so'm\n`;
      alertMsg += `👤 Sizniki: ${(total_price - COMPANY_SHARE).toLocaleString()} so'm`;

      Alert.alert('Reys tugadi! ✅', alertMsg);

      setIsRiding(false); setIsArrived(false); setAcceptedOrder(null);
      setPrice(BASE_PRICE); setSeconds(0); setDistanceKm(0);
      setIsPaused(false); setPauseSeconds(0); setPausePrice(0);
      setWaitingSeconds(0); setSelectedServices([]);
      lastPosRef.current = null; distanceRef.current = 0;
      pauseSecondsRef.current = 0; extraPriceRef.current = 0;
      waitingSecondsRef.current = 0;
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

  // ===================== XIZMATLAR MODALI =====================
  const ServicesModal = () => {
    const extraTotal = getExtraServicesTotal(selectedServices);
    return (
      <Modal visible={showServices} animationType="slide" onRequestClose={() => setShowServices(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>🛎 Qo'shimcha xizmatlar</Text>
            <TouchableOpacity onPress={() => setShowServices(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.servicesSubtitle}>
              Yo'lovchi bilan kelishilgan qo'shimcha xizmatlarni belgilang
            </Text>

            <View style={styles.servicesGrid}>
              {EXTRA_SERVICES.map(service => {
                const selected = selectedServices.includes(service.id);
                return (
                  <TouchableOpacity
                    key={service.id}
                    style={[styles.serviceItem, selected && styles.serviceItemSelected]}
                    onPress={() => toggleService(service.id)}
                  >
                    <Text style={styles.serviceEmoji}>{service.emoji}</Text>
                    <Text style={[styles.serviceLabel, selected && styles.serviceLabelSelected]}>
                      {service.label}
                    </Text>
                    <Text style={[styles.servicePrice, selected && styles.servicePriceSelected]}>
                      +{service.price.toLocaleString()}
                    </Text>
                    {selected && <Text style={styles.serviceCheck}>✅</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>

            {extraTotal > 0 && (
              <View style={styles.extraTotal}>
                <Text style={styles.extraTotalText}>
                  Qo'shimcha: +{extraTotal.toLocaleString()} so'm
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.servicesFooter}>
            <TouchableOpacity
              style={styles.startRideBtn}
              onPress={confirmStartRide}
            >
              <Text style={styles.btnText}>
                ▶️ BOSHLASH {extraTotal > 0 ? `(+${extraTotal.toLocaleString()} so'm)` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ===================== XABARLAR MODALI =====================
  const MessagesModal = () => (
    <Modal visible={showMessages} animationType="slide" onRequestClose={() => setShowMessages(false)}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>🔔 Xabarlar</Text>
          <TouchableOpacity onPress={() => setShowMessages(false)}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        {messages.length === 0 ? (
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>Hozircha xabar yo'q</Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={[styles.messageItem, !item.is_read && styles.messageUnread]}>
                <View style={styles.messageHeader}>
                  <Text style={styles.messageSender}>🚖 TaxiPark Dispetcher</Text>
                  {!item.is_read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.messageText}>{item.message}</Text>
                <Text style={styles.messageDate}>{formatDate(item.created_at)}</Text>
              </View>
            )}
            contentContainerStyle={{ padding: 16 }}
          />
        )}
      </View>
    </Modal>
  );

  // ===================== TARIF TANLASH =====================
  if (screen === 'tariff_select') {
    const PLANS = [
      { id: 'per_order', name: 'Donali',       price: 'Bepul',          sub: 'Har reysdan 900 so\'m', color: '#6b7280' },
      { id: 'half_day',  name: 'Yarim kunlik', price: '11 000 so\'m',   sub: '12 soat',              color: '#2563eb' },
      { id: 'daily',     name: 'Kunlik',       price: '22 000 so\'m',   sub: '24 soat',              color: '#16a34a' },
      { id: 'monthly',   name: 'Oylik',        price: '29 900 so\'m',   sub: '30 kun',               color: '#7c3aed' },
    ];

    const handleSelectTariff = async (plan) => {
      try {
        const res = await axios.post(`${API}/auth/select-tariff`,
          { tariff_type: plan.id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (plan.id === 'per_order') {
          const d = { ...driver, tariff_type: 'per_order', tariff_expires_at: null };
          await AsyncStorage.setItem('driver', JSON.stringify(d));
          setDriver(d); driverRef.current = d;
          setScreen('home');
        } else {
          setPendingTariff(plan);
          setScreen('tariff_pending');
        }
      } catch (err) {
        Alert.alert('Xato!', err.response?.data?.message || 'Xato yuz berdi');
      }
    };

    return (
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: 60 }]}>
        <Text style={styles.title}>🚖 TaxiPark</Text>
        <Text style={[styles.subtitle, { marginBottom: 8 }]}>Tarif rejasini tanlang</Text>
        {driver?.tariff_type && driver.tariff_type !== 'per_order' && (
          <View style={{ backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#fca5a5' }}>
            <Text style={{ color: '#dc2626', fontWeight: 'bold', textAlign: 'center' }}>⏰ Tarifingiz tugadi!</Text>
            <Text style={{ color: '#dc2626', fontSize: 12, textAlign: 'center', marginTop: 4 }}>Yangi tarif tanlang yoki dispetcherga murojaat qiling: 1054</Text>
          </View>
        )}
        {PLANS.map(plan => (
          <TouchableOpacity
            key={plan.id}
            style={{ backgroundColor: 'white', borderRadius: 14, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: plan.color, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
            onPress={() => handleSelectTariff(plan)}
          >
            <View>
              <Text style={{ fontWeight: 'bold', fontSize: 16, color: plan.color }}>{plan.name}</Text>
              <Text style={{ color: '#6b7280', fontSize: 13, marginTop: 2 }}>{plan.sub}</Text>
            </View>
            <Text style={{ fontWeight: 'bold', fontSize: 16, color: plan.color }}>{plan.price}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={logout} style={[styles.linkBtn, { marginTop: 8 }]}>
          <Text style={[styles.linkText, { color: '#ef4444' }]}>Chiqish</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ===================== TARIF KUTISH =====================
  if (screen === 'tariff_pending') {
    return (
      <View style={[styles.container, { paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 64, textAlign: 'center', marginBottom: 16 }}>⏳</Text>
        <Text style={[styles.title, { fontSize: 22 }]}>To'lovni tasdiqlang</Text>
        <View style={{ backgroundColor: '#f0fdf4', borderRadius: 14, padding: 20, marginBottom: 20, width: '100%', borderWidth: 1, borderColor: '#86efac' }}>
          <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#16a34a', marginBottom: 8 }}>
            {pendingTariff?.name} — {pendingTariff?.price}
          </Text>
          <Text style={{ color: '#374151', fontSize: 14, lineHeight: 22 }}>
            1. {pendingTariff?.price} so'm to'lang{'\n'}
            2. Quyidagi raqamga qo'ng'iroq qiling:{'\n'}
            3. Ismingiz va "Tarifimni faollashtiring" deng
          </Text>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: '#16a34a', borderRadius: 14, paddingVertical: 18, paddingHorizontal: 32, marginBottom: 12, width: '100%', alignItems: 'center' }}
          onPress={() => Linking.openURL('tel:1054')}
        >
          <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 20 }}>📞 1054 ga qo'ng'iroq</Text>
        </TouchableOpacity>
        <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center', marginBottom: 20 }}>
          Dispetcher tarifingizni faollashtirganidan so'ng ilova avtomatik ochiladi
        </Text>
        <TouchableOpacity onPress={() => setScreen('tariff_select')} style={styles.linkBtn}>
          <Text style={styles.linkText}>← Tarif tanlashga qaytish</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ===================== LOGIN =====================
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

  // ===================== REGISTER =====================
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

  // ===================== MAIN =====================
  return (
    <View style={{flex: 1, backgroundColor: '#f3f4f6'}}>
      <ServicesModal />
      <MessagesModal />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerText}>🚖 TaxiPark</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerSub}>{driver?.full_name}</Text>
          <TouchableOpacity style={styles.bellBtn} onPress={openMessages}>
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
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

            {/* Yangi zakaz */}
            {incomingOrder && !acceptedOrder && !isRiding && (
              <View style={[styles.card, {borderLeftWidth: 4, borderLeftColor: '#f59e0b', backgroundColor: '#fffbeb'}]}>
                <Text style={[styles.orderTitle, {color: '#d97706'}]}>🔔 Yangi zakaz keldi!</Text>
                <Text style={styles.orderInfo}>📞 {incomingOrder.customer_phone}</Text>
                <Text style={styles.orderInfo}>📍 {incomingOrder.from_address}</Text>
                <Text style={styles.orderInfo}>💰 Boshlang'ich: {BASE_PRICE.toLocaleString()} so'm</Text>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#16a34a', flex: 1, marginRight: 8}]} onPress={acceptOrder}>
                    <Text style={styles.btnText}>✅ QABUL QILISH</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#dc2626', flex: 1}]} onPress={rejectOrder}>
                    <Text style={styles.btnText}>❌ RAD ETISH</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Qabul qilingan zakaz — klent oldiga ketish */}
            {acceptedOrder && !isArrived && !isRiding && (
              <View style={[styles.card, {borderLeftWidth: 4, borderLeftColor: '#8b5cf6', backgroundColor: '#f5f3ff'}]}>
                <Text style={[styles.orderTitle, {color: '#7c3aed'}]}>✋ Zakaz qabul qilindi</Text>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${acceptedOrder.customer_phone}`)}>
                  <Text style={[styles.orderInfo, {color: '#2563eb', textDecorationLine: 'underline'}]}>
                    📞 {acceptedOrder.customer_phone} (bosing — qo'ng'iroq)
                  </Text>
                </TouchableOpacity>
                <Text style={styles.orderInfo}>📍 {acceptedOrder.from_address}</Text>
                <View style={[styles.card, {backgroundColor: '#ede9fe', margin: 0, marginTop: 10}]}>
                  <Text style={{color: '#6d28d9', fontWeight: 'bold', fontSize: 13}}>
                    ℹ️ Klent oldiga borgach "KELDIM" tugmasini bosing
                  </Text>
                </View>
                <TouchableOpacity style={[styles.startBtn, {marginTop: 12, backgroundColor: '#7c3aed'}]} onPress={handleArrived}>
                  <Text style={styles.btnText}>📍 KELDIM</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Klent kutilmoqda — kutish vaqti */}
            {acceptedOrder && isArrived && !isRiding && (() => {
              const freeSecs = WAITING_FREE_MINUTES * 60;
              const freeLeft = Math.max(0, freeSecs - waitingSeconds);
              const billableSecs = Math.max(0, waitingSeconds - freeSecs);
              const waitingFee = Math.round((billableSecs / 60) * WAITING_PRICE_PER_MIN);
              return (
                <View style={[styles.card, {borderLeftWidth: 4, borderLeftColor: billableSecs > 0 ? '#dc2626' : '#16a34a', backgroundColor: billableSecs > 0 ? '#fef2f2' : '#f0fdf4'}]}>
                  <Text style={[styles.orderTitle, {color: billableSecs > 0 ? '#dc2626' : '#16a34a'}]}>
                    ⏳ Klent kutilmoqda
                  </Text>
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${acceptedOrder.customer_phone}`)}>
                    <Text style={[styles.orderInfo, {color: '#2563eb', textDecorationLine: 'underline'}]}>
                      📞 {acceptedOrder.customer_phone} (bosing — qo'ng'iroq)
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.orderInfo}>📍 {acceptedOrder.from_address}</Text>

                  {freeLeft > 0 ? (
                    <View style={[styles.card, {backgroundColor: '#dcfce7', margin: 0, marginTop: 10, alignItems: 'center'}]}>
                      <Text style={{color: '#16a34a', fontSize: 13}}>Tekin kutish vaqti:</Text>
                      <Text style={{color: '#16a34a', fontSize: 28, fontWeight: 'bold'}}>{formatTime(freeLeft)}</Text>
                    </View>
                  ) : (
                    <View style={[styles.card, {backgroundColor: '#fee2e2', margin: 0, marginTop: 10, alignItems: 'center'}]}>
                      <Text style={{color: '#dc2626', fontSize: 13}}>Kutish haqi:</Text>
                      <Text style={{color: '#dc2626', fontSize: 28, fontWeight: 'bold'}}>{waitingFee.toLocaleString()} so'm</Text>
                      <Text style={{color: '#dc2626', fontSize: 12}}>{Math.ceil(billableSecs / 60)} min × 1,000 so'm</Text>
                    </View>
                  )}

                  <TouchableOpacity style={[styles.startBtn, {marginTop: 12, backgroundColor: '#16a34a'}]} onPress={startRide}>
                    <Text style={styles.btnText}>▶️ YO'LGA TUSHISH</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* Reys davom etmoqda */}
            {isRiding && acceptedOrder && (
              <View style={[styles.card, {borderLeftWidth: 4, borderLeftColor: isPaused ? '#f59e0b' : '#16a34a'}]}>
                <Text style={[styles.orderTitle, {color: isPaused ? '#d97706' : '#16a34a'}]}>
                  {isPaused ? '⏸ Pauza — Kutilmoqda' : '▶️ Reys davom etmoqda'}
                </Text>
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${acceptedOrder.customer_phone}`)}>
                  <Text style={[styles.orderInfo, {color: '#2563eb', textDecorationLine: 'underline'}]}>
                    📞 {acceptedOrder.customer_phone}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.orderInfo}>📍 {acceptedOrder.from_address}</Text>
                <Text style={styles.orderInfo}>{isNightRide ? '🌙 Tun narxi' : '☀️ Kunduz narxi'}</Text>

                {/* Tanlangan xizmatlar */}
                {selectedServices.length > 0 && (
                  <View style={styles.selectedServicesRow}>
                    {EXTRA_SERVICES.filter(s => selectedServices.includes(s.id)).map(s => (
                      <Text key={s.id} style={styles.serviceBadge}>{s.emoji} {s.label}</Text>
                    ))}
                  </View>
                )}

                <View style={styles.meter}>
                  <Text style={[styles.meterPrice, {color: isPaused ? '#d97706' : '#16a34a'}]}>
                    {price.toLocaleString()} so'm
                  </Text>
                  <View style={styles.meterStats}>
                    <Text style={styles.meterStat}>📏 {distanceKm.toFixed(2)} km</Text>
                    <Text style={styles.meterStat}>⏱ {formatTime(seconds)}</Text>
                  </View>
                  {pauseSeconds > 0 && (
                    <View style={styles.pauseInfo}>
                      <Text style={styles.pauseText}>
                        ⏸ Kutish: {formatTime(pauseSeconds)} = {pausePrice.toLocaleString()} so'm
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.pauseBtn, {backgroundColor: isPaused ? '#16a34a' : '#f59e0b'}]}
                    onPress={togglePause}
                  >
                    <Text style={styles.btnText}>{isPaused ? '▶️ DAVOM ETISH' : '⏸ PAUZA'}</Text>
                  </TouchableOpacity>
                  {!isPaused && (
                    <TouchableOpacity style={styles.stopBtn} onPress={finishRide}>
                      <Text style={styles.btnText}>🛑 TUGATISH</Text>
                    </TouchableOpacity>
                  )}
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

        {/* TARIX */}
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

        {/* TO'LOV */}
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

        {/* PROFIL */}
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

      {/* TAB BAR */}
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerSub: { color: '#fff', fontSize: 13 },
  bellBtn: { position: 'relative', padding: 4 },
  bellIcon: { fontSize: 24 },
  badge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
  card: { backgroundColor: '#fff', margin: 10, borderRadius: 12, padding: 15, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold' },
  driverName: { fontSize: 18, fontWeight: 'bold', color: '#1d4ed8', marginBottom: 5 },
  driverInfo: { fontSize: 14, color: '#6b7280', marginTop: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  orderInfo: { fontSize: 14, color: '#374151', marginBottom: 5 },
  actionBtn: { borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
  meter: { alignItems: 'center', marginTop: 15, width: '100%' },
  meterPrice: { fontSize: 42, fontWeight: 'bold' },
  meterStats: { flexDirection: 'row', gap: 20, marginTop: 5, marginBottom: 5 },
  meterStat: { fontSize: 16, color: '#6b7280', fontWeight: 'bold' },
  pauseInfo: { backgroundColor: '#fef3c7', borderRadius: 8, padding: 8, marginBottom: 8, width: '100%', alignItems: 'center' },
  pauseText: { color: '#92400e', fontSize: 13, fontWeight: 'bold' },
  pauseBtn: { borderRadius: 10, padding: 14, alignItems: 'center', width: '100%', marginBottom: 10, marginTop: 10 },
  startBtn: { backgroundColor: '#16a34a', borderRadius: 10, padding: 15, alignItems: 'center' },
  stopBtn: { backgroundColor: '#dc2626', borderRadius: 10, padding: 15, alignItems: 'center', width: '100%' },
  selectedServicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  serviceBadge: { backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#bfdbfe' },
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
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#f3f4f6' },
  modalHeader: { backgroundColor: '#1d4ed8', padding: 20, paddingTop: 50, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  modalClose: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  // Xizmatlar
  servicesSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 16, textAlign: 'center' },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  serviceItem: { width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: '#e5e7eb', elevation: 1 },
  serviceItemSelected: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  serviceEmoji: { fontSize: 28, marginBottom: 6 },
  serviceLabel: { fontSize: 13, fontWeight: 'bold', color: '#374151', textAlign: 'center', marginBottom: 4 },
  serviceLabelSelected: { color: '#1d4ed8' },
  servicePrice: { fontSize: 12, color: '#6b7280' },
  servicePriceSelected: { color: '#1d4ed8', fontWeight: 'bold' },
  serviceCheck: { fontSize: 16, marginTop: 4 },
  extraTotal: { backgroundColor: '#1d4ed8', borderRadius: 12, padding: 14, marginTop: 16, alignItems: 'center' },
  extraTotalText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  servicesFooter: { padding: 16, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  startRideBtn: { backgroundColor: '#16a34a', borderRadius: 10, padding: 16, alignItems: 'center' },
  // Xabarlar
  emptyMessages: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { fontSize: 60, marginBottom: 10 },
  emptyText: { fontSize: 16, color: '#6b7280' },
  messageItem: { backgroundColor: '#fff', borderRadius: 12, padding: 15, marginBottom: 10, elevation: 1 },
  messageUnread: { borderLeftWidth: 4, borderLeftColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  messageSender: { fontSize: 13, fontWeight: 'bold', color: '#1d4ed8' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  messageText: { fontSize: 15, color: '#374151', lineHeight: 22 },
  messageDate: { fontSize: 11, color: '#9ca3af', marginTop: 8 },
});