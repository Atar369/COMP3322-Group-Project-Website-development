const jwt = require('jsonwebtoken');
const db = require('../db');

// Accepts either HttpOnly cookie `token` or `Authorization: Bearer <jwt>` header.
exports.verifyToken = async (req, res, next) => {
  const cookieToken = req.cookies?.token;
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.split(' ')[1]
    : null;
  const token = cookieToken || headerToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [users] = await db.query(
      'SELECT role, account_disabled FROM users WHERE user_id = ?',
      [decoded.user_id]
    );
    if (users.length === 0) {
      return res.status(401).json({ error: 'Your account could not be found. Please sign in again.' });
    }
    if (users[0].role === 'customer' && users[0].account_disabled) {
      return res.status(403).json({
        error: 'Your account has been disabled after reaching the booking cancellation limit.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    req.user = decoded; // { user_id, email, role }
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token. Please log in again.' });
    }
    console.error('Authentication check failed:', err);
    return res.status(500).json({ error: 'Unable to verify your account right now.' });
  }
};

// Optional: restrict to certain roles (e.g., 'manager')
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: This action requires ${roles.join(' or ')} privileges.`,
      });
    }
    return next();
  };
};

exports.protect = exports.verifyToken;
exports.managerOnly = exports.requireRole('manager');