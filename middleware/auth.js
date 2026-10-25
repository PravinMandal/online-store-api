const jwt = require('jsonwebtoken');
const User = require('../models/user');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!token && req.cookies) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a token',
    });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  const user = await User.findById(payload.id).select('name email role createdAt updatedAt');
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'User no longer exists. Please log in again',
    });
  }

  req.user = user;
  return next();
}

module.exports = requireAuth;
