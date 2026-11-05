const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  timezone: 'Z',
});

pool.on('connection', connection => {
  connection.query("SET time_zone = '+00:00'", error => {
    if (error) console.error('Unable to set database connection timezone to UTC:', error);
  });
});

module.exports = pool;