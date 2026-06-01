const express = require('express');
const cors = require('cors');
const http = require('http');
const socketio = require('socket.io');
require('dotenv').config();

const pool = require('./config/db');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const driverRoutes = require('./routes/driverRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const messageRoutes = require('./routes/messageRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/driver', driverRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/message', messageRoutes);

// Test uchun
app.get('/', (req, res) => {
  res.json({ message: 'Taxipark backend ishlayapti!' });
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