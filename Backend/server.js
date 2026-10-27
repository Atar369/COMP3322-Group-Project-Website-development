const express = require("express");
const cors = require("cors");
const db = require("./db");
const errorHandler = require("./middleware/errorHandler");
const queueController = require("./Controllers/queueController");
const bookingController = require("./Controllers/bookingController");
const menuController = require("./Controllers/menuController");

const app = express();
const port = process.env.PORT || 5000;

async function waitForDatabase(maxAttempts = 15) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await db.query('SELECT 1'); // Simple ping to check connection
      console.log("Database connected successfully.");
      return;
    } catch (error) {
      console.warn(`Database not ready (attempt ${attempt}/${maxAttempts}). Retrying in 2s...`);
      if (attempt === maxAttempts) {
        throw new Error("Could not connect to the database after multiple attempts.");
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Middleware
app.use(express.json());
app.use(cors());
app.use('/uploads/menu-images', express.static(menuController.MENU_IMAGE_DIR));

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/booking", require("./Routes/bookingRoutes"));
app.use('/api/menu', require('./Routes/menuRoutes'));
app.use('/api/auth', require('./Routes/authRoutes'));
app.use('/api/orders', require('./Routes/orderRoutes'));
app.use('/api/queue', require('./Routes/queueRoutes'));

// Global Error Handler
app.use(errorHandler);

// Background Tasks
function startBackgroundTasks() {
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

// Server Startup
async function start() {
  // 1. Wait for MySQL to be ready
  await waitForDatabase();
  
  // 2. Start the server
  app.listen(port, () => {
    console.log(`Backend listening on port ${port}`);
    // 3. Start the background timers
    startBackgroundTasks();
  });
}

start().catch(error => {
  console.error('Backend startup failed:', error);
  process.exit(1);
});