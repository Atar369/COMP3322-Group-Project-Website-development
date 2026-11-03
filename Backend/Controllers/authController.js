const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const { sendPasswordResetEmail } = require('../utils/mailer');

const IS_PROD = process.env.NODE_ENV === 'production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_RESET_MS = 15 * 60 * 1000;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: IS_PROD ? 'strict' : 'lax',
    secure: IS_PROD,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function signToken(user) {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    if (!normalizedName || !normalizedPhone) {
      return res.status(400).json({ error: 'Name and phone cannot be blank' });
    }

    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE email = ? OR phone = ?',
      [normalizedEmail, normalizedPhone]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email or phone number already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [normalizedName, normalizedEmail, normalizedPhone, password_hash, 'customer']
    );

    const user = {
      user_id: result.insertId,
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      role: 'customer',
    };

    const token = signToken(user);
    res.cookie('token', token, cookieOptions());

    return res.status(201).json({
      message: 'User registered successfully',
      user,
      ...(IS_PROD ? {} : { token }),
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email or phone number already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [rows] = await pool.query(
      `SELECT user_id, name, email, phone, role, manager_id,
              password_hash, failed_attempts, lock_until, last_failed_at
       FROM users WHERE email = ?`,
      [email.trim().toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const now = new Date();

    if (user.lock_until && new Date(user.lock_until) <= now) {
      await pool.query(
        'UPDATE users SET failed_attempts = 0, lock_until = NULL, last_failed_at = NULL WHERE user_id = ?',
        [user.user_id]
      );
      user.failed_attempts = 0;
      user.lock_until = null;
      user.last_failed_at = null;
    }

    if (user.lock_until && new Date(user.lock_until) > now) {
      const minutesLeft = Math.ceil((new Date(user.lock_until) - now) / 60000);
      return res.status(403).json({
        error: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
      });
    }

    if (user.last_failed_at && now - new Date(user.last_failed_at) > FAILED_ATTEMPT_RESET_MS) {
      await pool.query(
        'UPDATE users SET failed_attempts = 0, last_failed_at = NULL WHERE user_id = ?',
        [user.user_id]
      );
      user.failed_attempts = 0;
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      await pool.query(
        `UPDATE users
         SET failed_attempts = failed_attempts + 1,
             last_failed_at = NOW(),
             lock_until = CASE
               WHEN failed_attempts + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE)
               ELSE lock_until
             END
         WHERE user_id = ?`,
        [MAX_FAILED_ATTEMPTS, user.user_id]
      );

      const [freshRows] = await pool.query(
        'SELECT failed_attempts, lock_until FROM users WHERE user_id = ?',
        [user.user_id]
      );
      const fresh = freshRows[0] || { failed_attempts: 1, lock_until: null };

      if (fresh.lock_until && new Date(fresh.lock_until) > new Date()) {
        return res.status(403).json({
          error: 'Too many failed attempts. Your account is locked for 15 minutes.',
        });
      }

      const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - Number(fresh.failed_attempts));
      return res.status(401).json({
        error: `Invalid email or password. You have ${remaining} attempts remaining.`,
      });
    }

    await pool.query(
      'UPDATE users SET failed_attempts = 0, lock_until = NULL, last_failed_at = NULL WHERE user_id = ?',
      [user.user_id]
    );

    const safeUser = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      manager_id: user.manager_id,
    };

    const token = signToken(safeUser);
    res.cookie('token', token, cookieOptions());

    return res.status(200).json({
      message: 'Login successful',
      user: safeUser,
      ...(IS_PROD ? {} : { token }),
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/create-manager (manager-only)
exports.createManager = async (req, res) => {
  try {
    const { name, manager_id, email, phone, password } = req.body;

    const normName = name ? name.trim() : '';
    const normManagerId = manager_id ? manager_id.trim() : '';
    const normEmail = email ? email.trim().toLowerCase() : '';
    const normPhone = phone ? phone.trim() : '';

    if (!normName || !normManagerId || !normEmail || !password || !normPhone) {
      return res.status(400).json({ error: 'Name, manager ID, email, phone, and password are required' });
    }
    if (password.length < 12) {
      return res.status(400).json({ error: 'Manager password must be at least 12 characters' });
    }
    if (!EMAIL_REGEX.test(normEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE email = ? OR manager_id = ? OR phone = ?',
      [normEmail, normManagerId, normPhone]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email, Manager ID, or phone number already exists' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, manager_id, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
      [normName, normManagerId, normEmail, normPhone, password_hash, 'manager']
    );

    return res.status(201).json({
      message: 'Manager created successfully',
      user: {
        user_id: result.insertId,
        name: normName,
        manager_id: normManagerId,
        email: normEmail,
        phone: normPhone,
        role: 'manager',
      },
    });
  } catch (err) {
    console.error('Create manager error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email, Manager ID, or phone number already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/auth/me (protected)
exports.me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, name, email, phone, role, manager_id, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/change-password (protected)
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const [rows] = await pool.query(
      'SELECT password_hash FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users
       SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL,
           failed_attempts = 0, lock_until = NULL, last_failed_at = NULL
       WHERE user_id = ?`,
      [newHash, req.user.user_id]
    );
    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  const genericMessage = 'If an account exists for that email, a password reset link has been sent.';

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(200).json({ message: genericMessage });
    }

    const [rows] = await pool.query(
      'SELECT user_id, name, email FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    if (rows.length === 0) {
      return res.status(200).json({ message: genericMessage });
    }

    const user = rows[0];
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?',
      [resetToken, resetTokenExpires, user.user_id]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/forgot-password?token=${resetToken}`;

    console.log(`\n=============================================`);
    console.log(`🔑 PASSWORD RESET LINK: ${resetLink}`);
    console.log(`=============================================\n`);

    try {
      await sendPasswordResetEmail({ to: user.email, name: user.name, resetLink });
    } catch (mailError) {
      console.error('Password reset email failed:', mailError);
    }

    return res.status(200).json({
      message: genericMessage,
      ...(IS_PROD ? {} : { resetToken, resetLink }),
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(200).json({ message: genericMessage });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const [rows] = await pool.query(
      'SELECT user_id FROM users WHERE reset_token = ? AND reset_token_expires > NOW()',
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE users
       SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL,
           failed_attempts = 0, lock_until = NULL, last_failed_at = NULL
       WHERE user_id = ?`,
      [newHash, rows[0].user_id]
    );

    return res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset password. Please try again later.' });
  }
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  res.clearCookie('token', { path: '/' });
  return res.status(200).json({ message: 'Logged out.' });
};