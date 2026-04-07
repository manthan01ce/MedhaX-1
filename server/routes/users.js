const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Search users by username
router.get('/search', authMiddleware, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json({ users: [] });
    }
    const users = db.prepare(
      'SELECT id, username FROM users WHERE username LIKE ? AND id != ? LIMIT 10'
    ).all(`%${q}%`, req.user.id);
    res.json({ users });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
