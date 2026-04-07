require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

require('./db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const matchRoutes = require('./routes/matches');
const { setupSocket } = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingTimeout: 30000, pingInterval: 10000 });

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchRoutes);

const { getCategories } = require('./game/questionPicker');
const { authMiddleware } = require('./middleware/auth');
app.get('/api/categories', authMiddleware, (req, res) => {
  res.json({ categories: getCategories() });
});

setupSocket(io);

app.get('*', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'public', req.path);
  if (fs.existsSync(htmlPath)) return res.sendFile(htmlPath);
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🎮 CodeDuel server running at http://localhost:${PORT}\n`);
});
