const jwt = require('jsonwebtoken');
const db = require('../db');

function authMiddleware(req, res, next) {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function socketAuth(socket, next) {
  const cookies = socket.handshake.headers.cookie;
  if (!cookies) return next(new Error('Authentication required'));

  const tokenMatch = cookies.match(/token=([^;]+)/);
  if (!tokenMatch) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(tokenMatch[1], process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return next(new Error('User not found'));
    socket.user = user;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
}

module.exports = { authMiddleware, socketAuth };
