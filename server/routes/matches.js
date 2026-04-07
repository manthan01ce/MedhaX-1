const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get match history for current user
router.get('/history', authMiddleware, (req, res) => {
  try {
    const matches = db.prepare(`
      SELECT m.*, 
        u1.username as player1_username,
        u2.username as player2_username
      FROM matches m
      JOIN users u1 ON m.player1_id = u1.id
      JOIN users u2 ON m.player2_id = u2.id
      WHERE (m.player1_id = ? OR m.player2_id = ?) AND m.status = 'finished'
      ORDER BY m.finished_at DESC
      LIMIT 20
    `).all(req.user.id, req.user.id);
    res.json({ matches });
  } catch (err) {
    console.error('Match history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
