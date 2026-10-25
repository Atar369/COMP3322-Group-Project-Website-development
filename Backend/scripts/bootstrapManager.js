require('dotenv').config();

const bcrypt = require('bcryptjs');
const pool = require('../db');

const LOCK_NAME = 'bootstrap-first-manager';

async function bootstrapManager() {
  const name = process.env.BOOTSTRAP_MANAGER_NAME?.trim();
  const managerId = process.env.BOOTSTRAP_MANAGER_ID?.trim();
  const email = process.env.BOOTSTRAP_MANAGER_EMAIL?.trim().toLowerCase();
  const phone = process.env.BOOTSTRAP_MANAGER_PHONE?.trim();
  const password = process.env.BOOTSTRAP_MANAGER_PASSWORD;

  if (!name || !managerId || !email || !phone || !password) {
    throw new Error(
      'Set BOOTSTRAP_MANAGER_NAME, BOOTSTRAP_MANAGER_ID, BOOTSTRAP_MANAGER_EMAIL, BOOTSTRAP_MANAGER_PHONE, and BOOTSTRAP_MANAGER_PASSWORD.'
    );
  }
  if (name.length > 100 || managerId.length > 50 || email.length > 255 || phone.length > 30) {
    throw new Error('Name, email, or phone exceeds the database field limit.');
  }
  if (!email.includes('@')) {
    throw new Error('BOOTSTRAP_MANAGER_EMAIL must be a valid email address.');
  }
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Password must be 12–72 bytes long.');
  }

  const connection = await pool.getConnection();
  let lockAcquired = false;

  try {
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, 10) AS acquired', [LOCK_NAME]);
    if (Number(lockRows[0].acquired) !== 1) {
      throw new Error('Could not acquire the manager bootstrap lock. Try again.');
    }
    lockAcquired = true;

    const [managerRows] = await connection.query(
      "SELECT user_id FROM users WHERE role = 'manager' LIMIT 1"
    );
    if (managerRows.length > 0) {
      throw new Error('A manager account already exists; no account was created.');
    }

    const [existingRows] = await connection.query(
      'SELECT user_id FROM users WHERE email = ? OR manager_id = ? OR phone = ? LIMIT 1',
      [email, managerId, phone]
    );
    if (existingRows.length > 0) {
      throw new Error('The email or phone number is already in use.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await connection.query(
      'INSERT INTO users (name, manager_id, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [name, managerId, email, phone, passwordHash, 'manager']
    );

    console.log(`Created initial manager account (user_id ${result.insertId}).`);
  } finally {
    try {
      if (lockAcquired) {
        await connection.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
      }
    } finally {
      connection.release();
    }
  }
}

bootstrapManager()
  .catch(error => {
    console.error('Manager bootstrap failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
