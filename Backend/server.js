const http = require('http');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');

const db = require('./db');
const errorHandler = require('./middleware/errorHandler');
const queueController = require('./Controllers/queueController');
const bookingController = require('./Controllers/bookingController');
const menuController = require('./Controllers/menuController');
const dashboardRoutes = require('./Routes/dashboardRoutes');
const { attachQueueSocket } = require('./socket');

const app = express();
const port = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

async function waitForDatabase(maxAttempts = 15) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await db.query('SELECT 1');
      console.log('Database connected successfully.');
      return;
    } catch (error) {
      console.warn(`Database not ready (attempt ${attempt}/${maxAttempts}). Retrying in 2s...`);
      if (attempt === maxAttempts) {
        throw new Error('Could not connect to the database after multiple attempts.');
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use('/api/uploads/menu-images', express.static(menuController.MENU_IMAGE_DIR));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/booking', require('./Routes/bookingRoutes'));
app.use('/api/menu', require('./Routes/menuRoutes'));
app.use('/api/auth', require('./Routes/authRoutes'));
app.use('/api/orders', require('./Routes/orderRoutes'));
app.use('/api/queue', require('./Routes/queueRoutes'));
app.use('/api/manager', dashboardRoutes);

// Global error handler
app.use(errorHandler);

// HTTP + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true,
  },
});
attachQueueSocket(io);
app.set('io', io);
queueController.setSocketIo(io);

// Background tasks
const AUTO_CALL_INTERVAL_MS = 2000; // 2s
const AUTO_FINISH_INTERVAL_MS = 60 * 1000; // 1 min
const BOOKING_NO_SHOW_INTERVAL_MS = 15 * 1000; // 15s

function startBackgroundTasks() {
  setInterval(() => {
    queueController.autoCallCycle().catch(error => {
      console.error('Automatic queue call cycle failed:', error);
    });
  }, AUTO_CALL_INTERVAL_MS);

  // Auto-finish queue sessions that have been serving for 1 hour
  setInterval(() => {
    queueController.autoFinishServing().catch(error => {
      console.error('Automatic queue session finish failed:', error);
    });
  }, AUTO_FINISH_INTERVAL_MS);

  setInterval(() => {
    bookingController.markExpiredBookingsNoShow().catch(error => {
      console.error('Automatic booking no-show update failed:', error);
    });
  }, BOOKING_NO_SHOW_INTERVAL_MS);
}

// Startup
async function start() {
  await waitForDatabase();

  server.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
    console.log(`CORS origin: ${FRONTEND_URL}`);
    startBackgroundTasks();
  });
}

start().catch(error => {
  console.error('Backend startup failed:', error);
  process.exit(1);
});