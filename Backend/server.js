const express = require("express");
const cors = require("cors");
const ensureQueueSchema = require("./middleware/queueSchema");
const queueController = require("./Controllers/queueController");
const bookingController = require("./Controllers/bookingController");
const menuController = require("./Controllers/menuController");

const app = express();
const port = process.env.PORT || 5000;

const TRANSIENT_DATABASE_ERRORS = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'PROTOCOL_CONNECTION_LOST',
]);

async function ensureQueueSchemaWithRetry() {
  const maxAttempts = 15;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await ensureQueueSchema();
      return;
    } catch (error) {
      if (!TRANSIENT_DATABASE_ERRORS.has(error.code) || attempt === maxAttempts) {
        throw error;
      }
      console.warn(`Database is not ready; retrying queue schema setup (${attempt}/${maxAttempts}).`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

app.use(express.json());
app.use(cors());
app.use('/uploads/menu-images', express.static(menuController.MENU_IMAGE_DIR));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use("/api/booking", require("./Routes/bookingRoutes"));
app.use('/api/menu', require('./Routes/menuRoutes'));
app.use('/api/auth', require('./Routes/authRoutes'));
app.use('/api/orders', require('./Routes/orderRoutes'));
app.use('/api/queue', require('./Routes/queueRoutes'));

async function start() {
  await ensureQueueSchemaWithRetry();
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
  });
  setInterval(() => {
    queueController.autoCallCycle().catch(error => {
      console.error('Automatic queue call cycle failed:', error);
    });
  }, 1000);
  setInterval(() => {
    bookingController.markExpiredBookingsNoShow().catch(error => {
      console.error('Automatic booking no-show update failed:', error);
    });
  }, 15_000);
}

start().catch(error => {
  console.error('Backend startup failed:', error);
  process.exit(1);
});
