const express = require('express');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const pool = require('./config/db');

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: ${origin} ruxsatsiz`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
};

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: corsOptions,
});

app.use(cors(corsOptions));
app.use(express.json());

// Umumiy limit — har bir IP uchun 1 daqiqada max 100 ta so'rov
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { message: 'Juda ko\'p so\'rov yuborildi. 1 daqiqadan keyin qayta urining.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Login uchun qattiqroq limit — 10 daqiqada max 10 ta urinish
const loginLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { message: 'Juda ko\'p login urinish. 10 daqiqadan keyin qayta urining.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Routes
const authRoutes = require('./routes/authRoutes');
const driverRoutes = require('./routes/driverRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const messageRoutes = require('./routes/messageRoutes');

app.use('/api/auth', loginLimit, authRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/message', messageRoutes);

// Test uchun
app.get('/', (req, res) => {
  res.json({ message: 'Taxipark backend ishlayapti!' });
});

// Tizim haqida va Mualliflik ma'lumotlari (Dinamik Brending)
app.get('/api/system-info', (req, res) => {
  res.json({
    success: true,
    appName: "TaxiPark",
    version: "1.0.0",
    buildNumber: "2",
    developer: {
      name: "Ermagov Muzaffar",
      team: "UzbTILT",
      role: "Loyiha muallifi va bosh dasturchi",
      copyright: "© 2026 UzbTILT. Barcha huquqlar himoyalangan."
    }
  });
});

// Socket.io
const connectedDrivers = {};

io.on('connection', (socket) => {
  console.log('Ulandi:', socket.id);

  socket.on('order_rejected', (data) => {
    console.log('Zakaz rad etildi:', data);
    io.emit('order_rejected', {
      order_id: data.order_id,
      driver_name: data.driver_name
    });
  });

  socket.on('driver_connected', (driverId) => {
    connectedDrivers[driverId] = socket.id;
    console.log('Haydovchi ulandi:', driverId);
  });

  socket.on('disconnect', () => {
    Object.keys(connectedDrivers).forEach(id => {
      if (connectedDrivers[id] === socket.id) {
        delete connectedDrivers[id];
      }
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server ${PORT} portda ishlayapti!`);
});

global.io = io;
global.connectedDrivers = connectedDrivers;