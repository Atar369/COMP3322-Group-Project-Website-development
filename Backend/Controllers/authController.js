const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');
const { parseUtcDateTime } = require('../utils/restaurantTime');
const { sendPasswordResetEmail, sendEmailVerificationEmail } = require('../utils/mailer');

const IS_PROD = process.env.NODE_ENV === 'production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_HOURS = 24;
const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPT_RESET_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;      
const MANAGER_PASSWORD_MIN_LENGTH = 12;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: String(process.env.COOKIE_SECURE).toLowerCase() === 'true',
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

function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, tokenHash: crypto.createHash('sha256').update(token).digest('hex') };
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getEmailVerificationLink(token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontendUrl.replace(/\/+$/, '')}/verify-email?token=${token}`;
}

function getEmailDeliveryErrorMessage(error) {
  if (error.code === 'EAUTH' || Number(error.responseCode) === 535) {
    return 'Gmail rejected the SMTP sign-in. Check that SMTP_USER is the full Gmail address and SMTP_PASS is a current Google App Password (not your regular Gmail password).';
  }
  return 'The verification email could not be sent. Please check the mail server settings and try again.';
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Name, email, phone, and password are required' });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    if (!EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!normalizedName || !normalizedPhone) {
      return res.status(400).json({ error: 'Name and phone cannot be blank' });
    }

    const [existing] = await pool.query(
      'SELECT user_id, email, role, account_disabled FROM users WHERE email = ? OR phone = ?',
      [normalizedEmail, normalizedPhone]
    );
    if (existing.length > 0) {
      const disabledEmail = existing.find(
        user => String(user.email).toLowerCase() === normalizedEmail
          && user.role === 'customer'
          && user.account_disabled
      );
      if (disabledEmail) {
        return res.status(409).json({
          error: 'This email belongs to an account disabled after reaching the booking cancellation limit and cannot be registered again.',
        });
      }
      return res.status(409).json({ error: 'Email or phone number already registered' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { token, tokenHash } = createEmailVerificationToken();

    const [result] = await pool.query(
      `INSERT INTO users (
         name, email, phone, password_hash, role, email_verified,
         email_verification_token_hash, email_verification_expires, email_verification_sent_at
       )
       VALUES (?, ?, ?, ?, 'customer', FALSE, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${EMAIL_VERIFICATION_TTL_HOURS} HOUR), UTC_TIMESTAMP())`,
      [normalizedName, normalizedEmail, normalizedPhone, password_hash, tokenHash]
    );

    let emailPreviewUrl;
    try {
      const info = await sendEmailVerificationEmail({
        to: normalizedEmail,
        name: normalizedName,
        verificationLink: getEmailVerificationLink(token),
      });
      emailPreviewUrl = info.previewUrl;
    } catch (mailError) {
      await pool.query(
        `UPDATE users
         SET email_verification_token_hash = NULL,
             email_verification_expires = NULL,
             email_verification_sent_at = NULL
         WHERE user_id = ? AND email_verification_token_hash = ?`,
        [result.insertId, tokenHash]
      );
      console.error('Email verification delivery failed:', mailError);
      return res.status(503).json({
        error: `Your account was created, but ${getEmailDeliveryErrorMessage(mailError)}`,
        email: normalizedEmail,
        verificationPending: true,
      });
    }

    return res.status(201).json({
      message: 'Check your email for a verification link before signing in.',
      email: normalizedEmail,
      ...(!IS_PROD && emailPreviewUrl ? { emailPreviewUrl } : {}),
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
              password_hash, email_verified, account_disabled, failed_attempts, lock_until, last_failed_at,
              (SELECT COUNT(*) FROM booking_cancellation_flags f WHERE f.user_id = users.user_id) AS cancellation_flags
       FROM users WHERE email = ?`,
      [email.trim().toLowerCase()]
    );
    
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const now = Date.now();

    if (user.lock_until) {
      const lockTime = parseUtcDateTime(user.lock_until);
      if (lockTime > now) {
        const minutesLeft = Math.ceil((lockTime - now) / 60000);
        return res.status(403).json({
          error: `Account is locked due to too many failed attempts. Try again in ${minutesLeft} minutes.`,
          locked: true,
          minutesLeft
        });
      } else {
        await pool.query(
          'UPDATE users SET failed_attempts = 0, lock_until = NULL, last_failed_at = NULL WHERE user_id = ?',
          [user.user_id]
        );
        user.failed_attempts = 0;
        user.lock_until = null;
        user.last_failed_at = null;
      }
    }

    if (user.last_failed_at && now - parseUtcDateTime(user.last_failed_at) > FAILED_ATTEMPT_RESET_MS) {
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
             last_failed_at = UTC_TIMESTAMP(),
             lock_until = CASE
               WHEN failed_attempts + 1 >= ? THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)
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

      if (fresh.lock_until && parseUtcDateTime(fresh.lock_until) > Date.now()) {
        return res.status(403).json({
          error: 'Too many failed attempts. Your account is locked for 15 minutes.',
          locked: true,
          minutesLeft: 15
        });
      }

      return res.status(401).json({
        error: 'Invalid email or password.', 
      });
    }

    if (user.role === 'customer' && user.account_disabled) {
      return res.status(403).json({
        error: 'Your account has been disabled after reaching 4 booking cancellation flags. This email cannot be used to register another account.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    if (user.role === 'customer' && !user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
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
      cancellation_flags: Number(user.cancellation_flags),
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

// POST /api/auth/verify-email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [result] = await pool.query(
      `UPDATE users
       SET email_verified = TRUE,
           email_verification_token_hash = NULL,
           email_verification_expires = NULL,
           email_verification_sent_at = NULL
       WHERE email_verification_token_hash = ?
         AND email_verification_expires > UTC_TIMESTAMP()
         AND role = 'customer'
         AND email_verified = FALSE`,
      [tokenHash]
    );

    if (result.affectedRows !== 1) {
      return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
    }

    return res.status(200).json({ message: 'Your email has been verified. You can now sign in.' });
  } catch (err) {
    console.error('Email verification error:', err);
    return res.status(500).json({ error: 'Unable to verify your email right now. Please try again.' });
  }
};

// POST /api/auth/resend-verification
exports.resendEmailVerification = async (req, res) => {
  const genericMessage = 'If an unverified account exists for that email, a verification link will be sent.';

  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const [rows] = await pool.query(
      'SELECT user_id, name, email FROM users WHERE email = ? AND role = ? AND email_verified = FALSE',
      [email, 'customer']
    );
    if (rows.length === 0) {
      return res.status(200).json({ message: genericMessage });
    }

    const user = rows[0];
    const { token, tokenHash } = createEmailVerificationToken();
    const [updateResult] = await pool.query(
      `UPDATE users
       SET email_verification_token_hash = ?,
           email_verification_expires = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${EMAIL_VERIFICATION_TTL_HOURS} HOUR),
           email_verification_sent_at = UTC_TIMESTAMP()
       WHERE user_id = ?
         AND email_verified = FALSE
         AND (
           email_verification_sent_at IS NULL
           OR email_verification_sent_at <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS} SECOND)
         )`,
      [tokenHash, user.user_id]
    );
    if (updateResult.affectedRows !== 1) {
      return res.status(200).json({ message: genericMessage });
    }

    try {
      const info = await sendEmailVerificationEmail({
        to: user.email,
        name: user.name,
        verificationLink: getEmailVerificationLink(token),
      });
      return res.status(200).json({
        message: genericMessage,
        ...(!IS_PROD && info.previewUrl ? { emailPreviewUrl: info.previewUrl } : {}),
      });
    } catch (mailError) {
      await pool.query(
        `UPDATE users
         SET email_verification_token_hash = NULL,
             email_verification_expires = NULL,
             email_verification_sent_at = NULL
         WHERE user_id = ? AND email_verification_token_hash = ?`,
        [user.user_id, tokenHash]
      );
      console.error('Email verification resend failed:', mailError);
      return res.status(503).json({ error: getEmailDeliveryErrorMessage(mailError) });
    }
  } catch (err) {
    console.error('Resend email verification error:', err);
    return res.status(500).json({ error: 'Unable to resend the verification email right now. Please try again.' });
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
    if (password.length < MANAGER_PASSWORD_MIN_LENGTH) {
      return res.status(400).json({ error: `Manager password must be at least ${MANAGER_PASSWORD_MIN_LENGTH} characters` });
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
      `SELECT user_id, name, email, phone, role, manager_id, created_at, account_disabled,
              (SELECT COUNT(*) FROM booking_cancellation_flags f WHERE f.user_id = users.user_id) AS cancellation_flags
       FROM users WHERE user_id = ?`,
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

// PATCH /api/auth/profile (protected) — change personal info
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (name === undefined && phone === undefined) {
      return res.status(400).json({ error: 'Provide a name or phone to update' });
    }

    const updates = [];
    const values = [];

    if (name !== undefined) {
      const normName = String(name).trim();
      if (!normName || normName.length > 100) {
        return res.status(400).json({ error: 'Name is required and must be 100 characters or fewer' });
      }
      updates.push('name = ?');
      values.push(normName);
    }

    if (phone !== undefined) {
      const normPhone = String(phone).trim();
      if (!normPhone || normPhone.length > 30) {
        return res.status(400).json({ error: 'Phone is required and must be 30 characters or fewer' });
      }
      const [existing] = await pool.query(
        'SELECT user_id FROM users WHERE phone = ? AND user_id <> ?',
        [normPhone, req.user.user_id]
      );
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Phone number already in use' });
      }
      updates.push('phone = ?');
      values.push(normPhone);
    }

    values.push(req.user.user_id);
    await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`,
      values
    );

    const [rows] = await pool.query(
      'SELECT user_id, name, email, phone, role, manager_id, created_at FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    return res.status(200).json({ user: rows[0] });
  } catch (err) {
    console.error('Update profile error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Phone number already in use' });
    }
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

    const [rows] = await pool.query(
      'SELECT password_hash, role FROM users WHERE user_id = ?',
      [req.user.user_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const minLength = rows[0].role === 'manager' ? MANAGER_PASSWORD_MIN_LENGTH : MIN_PASSWORD_LENGTH;
    if (newPassword.length < minLength) {
      return res.status(400).json({ error: `New password must be at least ${minLength} characters` });
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
    const resetTokenHash = hashResetToken(resetToken);
    const resetTokenExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await pool.query(
      'UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE user_id = ?',
      [resetTokenHash, resetTokenExpires, user.user_id]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/forgot-password?token=${resetToken}`;

    if (!IS_PROD) {
      console.log(`\n=============================================`);
      console.log(`🔑 PASSWORD RESET LINK: ${resetLink}`);
      console.log(`=============================================\n`);
    }

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

    const tokenHash = hashResetToken(token);
    const [rows] = await pool.query(
      'SELECT user_id, role FROM users WHERE reset_token = ? AND reset_token_expires > UTC_TIMESTAMP()',
      [tokenHash]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const targetRole = rows[0].role;
    const minLength = targetRole === 'manager' ? MANAGER_PASSWORD_MIN_LENGTH : MIN_PASSWORD_LENGTH;
    if (newPassword.length < minLength) {
      return res.status(400).json({ error: `Password must be at least ${minLength} characters` });
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