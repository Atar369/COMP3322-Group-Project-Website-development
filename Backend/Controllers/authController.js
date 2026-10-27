const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE email = ? OR phone = ?',
      [normalizedEmail, normalizedPhone]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email or phone number already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Insert customer (role = 'customer', manager_id = NULL)
    const [result] = await pool.query(
      'INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), normalizedEmail, normalizedPhone, password_hash, 'customer']
    );

    const token = jwt.sign(
      { user_id: result.insertId, email, role: userRole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { user_id: result.insertId, name: name.trim(), email: normalizedEmail, phone: normalizedPhone, role: 'customer' },
    });
  } catch (err) {
    console.error('Register error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Email or phone number already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 1. Fetch user including lockout fields
    const [rows] = await pool.query(
      'SELECT user_id, name, email, phone, role, password_hash, failed_attempts, lock_until FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    // 2. Check if the account is currently locked
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(user.lock_until) - new Date()) / 60000);
      return res.status(403).json({ 
        error: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minutes.` 
      });
    }

    // 3. Compare the password
    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      // 4. If password is wrong, increment attempts
      const newAttempts = user.failed_attempts + 1;
      let lockUntil = null;

      // If they reach 5 attempts, lock for 15 minutes
      if (newAttempts >= 5) {
        lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await pool.query(
        'UPDATE users SET failed_attempts = ?, lock_until = ? WHERE user_id = ?',
        [newAttempts, lockUntil, user.user_id]
      );

      if (newAttempts >= 5) {
        return res.status(403).json({ 
          error: 'Too many failed attempts. Your account is locked for 15 minutes.' 
        });
      }
      
      return res.status(401).json({ 
        error: `Invalid email or password. You have ${5 - newAttempts} attempts remaining.` 
      });
    }

    // 5. If password is correct, reset the attempts and lock
    await pool.query(
      'UPDATE users SET failed_attempts = 0, lock_until = NULL WHERE user_id = ?',
      [user.user_id]
    );

    // 6. Generate JWT
    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {user_id: user.user_id, name: user.name, email: user.email, phone: user.phone, role: user.role, manager_id: user.manager_id },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/create-manager
exports.createManager = async (req, res) => {
  try {
    const { name, manager_id, email, phone, password } = req.body;

    const normName = name ? name.trim() : '';
    const normManagerId = manager_id ? manager_id.trim() : '';
    const normEmail = email ? email.trim().toLowerCase() : '';
    const normPhone = phone ? phone.trim() : '';

    // Validation
    if (!normName || !normManagerId || !normEmail || !password || !normPhone) {
      return res.status(400).json({ error: 'Name, manager ID, email, phone, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normEmail)) {
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

    res.status(201).json({
      message: 'Manager created successfully',
      user: { user_id: result.insertId, name: normName, manager_id: normManagerId, email: normEmail, phone: normPhone, role: 'manager' },
    });
  } catch (err) {
    console.error('Create manager error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email, Manager ID, or phone number already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/auth/me (protected)
exports.me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, name, email, phone, role, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Internal server error' });
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
    await pool.query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHash, req.user.user_id]);
    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/auth/forgot-password
// Step 1: User enters email, backend generates token and sends reset link
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const [rows] = await pool.query(
      'SELECT user_id FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(200).json({ message: 'If an account exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?',
      [resetToken, resetTokenExpires, rows[0].user_id]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    console.log(`\n================================`);
    console.log(`PASSWORD RESET LINK: ${resetLink}`);
    console.log(`================================\n`);

    res.status(200).json({
      message: 'Password reset link has been sent to your email.',
      resetToken
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process password reset. Please try again later.' });
  }
};

// POST /api/auth/reset-password
// Step 2: User submits token + new password
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
      'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE user_id = ?',
      [newHash, rows[0].user_id]
    );

    res.status(200).json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password. Please try again later.' });
  }
};
