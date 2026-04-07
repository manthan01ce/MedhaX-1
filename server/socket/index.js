/**
 * Socket.IO Event Router for CodeDuel
 */

const { socketAuth } = require('../middleware/auth');
const matchManager = require('../game/matchManager');

// Track online users: userId -> { socketId, username }
const onlineUsers = new Map();
// Track socketId -> userId
const socketUserMap = new Map();

function setupSocket(io) {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`[Socket] ${user.username} connected (${socket.id})`);

    // Register online
    onlineUsers.set(user.id, { socketId: socket.id, username: user.username });
    socketUserMap.set(socket.id, user.id);

    // Rejoin match if reconnecting
    const existingMatch = matchManager.getMatchByUser(user.id);
    if (existingMatch) {
      const player = existingMatch.players[user.id];
      if (player) {
        player.socketId = socket.id;
        socket.join(`match:${existingMatch.id}`);
        socket.emit('match:reconnect', {
          matchId: existingMatch.id,
          phase: existingMatch.phase,
          gridSize: existingMatch.gridSize,
          shapes: existingMatch.shapes.map(s => ({ id: s.id, name: s.name, cells: s.cells, size: s.size, rotations: s.rotations })),
          placed: player.placed,
          score: player.score,
          currentQuestionIndex: existingMatch.currentQuestionIndex,
          totalQuestions: existingMatch.questions.length,
          questionCount: existingMatch.questionCount,
          category: existingMatch.category,
          opponentUsername: Object.values(existingMatch.players).find(p => p.id !== user.id)?.username,
          revealedOnOpponent: player.revealedOnOpponent,
        });
      }
    }

    // ====== CHALLENGE EVENTS ======

    socket.on('challenge:send', ({ targetUsername, questionCount, category }) => {
      if (matchManager.isUserInMatch(user.id)) {
        return socket.emit('challenge:error', { error: 'You are already in a match' });
      }

      const targetOnline = [...onlineUsers.values()].find(u => u.username === targetUsername.toLowerCase());
      if (!targetOnline) {
        return socket.emit('challenge:error', { error: 'User is not online' });
      }

      const targetUserId = [...onlineUsers.entries()].find(([, u]) => u.username === targetUsername.toLowerCase())?.[0];
      if (!targetUserId) {
        return socket.emit('challenge:error', { error: 'User not found' });
      }

      if (matchManager.isUserInMatch(targetUserId)) {
        return socket.emit('challenge:error', { error: 'User is already in a match' });
      }

      if (![10, 20, 50].includes(questionCount)) {
        return socket.emit('challenge:error', { error: 'Invalid question count' });
      }

      const challengeId = matchManager.createChallenge(
        { id: user.id, username: user.username },
        { id: targetUserId, username: targetUsername.toLowerCase() },
        questionCount,
        category.toLowerCase()
      );

      // Notify target
      io.to(targetOnline.socketId).emit('challenge:incoming', {
        challengeId,
        from: user.username,
        questionCount,
        category: category.toLowerCase(),
      });

      socket.emit('challenge:sent', { challengeId, to: targetUsername.toLowerCase() });
    });

    socket.on('challenge:accept', ({ challengeId }) => {
      const challenge = matchManager.getChallenge(challengeId);
      if (!challenge) return socket.emit('challenge:error', { error: 'Challenge expired or not found' });
      if (challenge.to.id !== user.id) return socket.emit('challenge:error', { error: 'Not your challenge' });

      if (matchManager.isUserInMatch(user.id) || matchManager.isUserInMatch(challenge.from.id)) {
        return socket.emit('challenge:error', { error: 'A player is already in a match' });
      }

      matchManager.removeChallenge(challengeId);

      // Create match
      const match = matchManager.createMatch(challenge);

      // Set socket IDs
      const fromOnline = onlineUsers.get(challenge.from.id);
      if (fromOnline) {
        match.players[challenge.from.id].socketId = fromOnline.socketId;
        const fromSocket = io.sockets.sockets.get(fromOnline.socketId);
        if (fromSocket) fromSocket.join(`match:${match.id}`);
      }
      match.players[user.id].socketId = socket.id;
      socket.join(`match:${match.id}`);

      const matchData = {
        matchId: match.id,
        gridSize: match.gridSize,
        shapes: match.shapes.map(s => ({ id: s.id, name: s.name, cells: s.cells, size: s.size, rotations: s.rotations })),
        questionCount: match.questionCount,
        category: match.category,
        totalCells: match.totalCells,
      };

      // Notify both players
      if (fromOnline) {
        io.to(fromOnline.socketId).emit('match:created', {
          ...matchData,
          opponentUsername: user.username,
        });
      }
      socket.emit('match:created', {
        ...matchData,
        opponentUsername: challenge.from.username,
      });
    });

    socket.on('challenge:reject', ({ challengeId }) => {
      const challenge = matchManager.getChallenge(challengeId);
      if (!challenge) return;
      matchManager.removeChallenge(challengeId);
      const fromOnline = onlineUsers.get(challenge.from.id);
      if (fromOnline) {
        io.to(fromOnline.socketId).emit('challenge:rejected', { by: user.username });
      }
    });

    // ====== PLACEMENT EVENTS ======

    socket.on('placement:submit', ({ matchId, placements }) => {
      const result = matchManager.submitPlacement(matchId, user.id, placements);
      if (!result.success) {
        return socket.emit('placement:error', { error: result.error });
      }

      socket.emit('placement:confirmed');

      const match = matchManager.getMatch(matchId);
      const opponentId = matchManager.getOpponentId(match, user.id);
      const opponent = match.players[opponentId];
      if (opponent?.socketId) {
        io.to(opponent.socketId).emit('placement:opponent_ready');
      }

      if (result.allPlaced) {
        // Both placed - start quiz
        setTimeout(() => {
          const questionData = matchManager.startNextQuestion(matchId);
          if (questionData && questionData.type === 'question') {
            io.to(`match:${matchId}`).emit('quiz:question', questionData);
            startQuestionTimer(io, matchId);
          }
        }, 1500);
      }
    });

    // ====== QUIZ EVENTS ======

    socket.on('quiz:answer', ({ matchId, questionIndex, answer }) => {
      const result = matchManager.submitAnswer(matchId, user.id, questionIndex, answer);
      if (!result.success) {
        return socket.emit('quiz:error', { error: result.error });
      }

      socket.emit('quiz:answer_locked', { questionIndex });

      if (result.allAnswered) {
        const match = matchManager.getMatch(matchId);
        if (match?.questionTimer) {
          clearTimeout(match.questionTimer);
          match.questionTimer = null;
        }

        processQuestionResults(io, matchId);
      }
    });

    // ====== DIG EVENTS ======

    socket.on('dig:cell', ({ matchId, row, col }) => {
      const result = matchManager.submitDig(matchId, user.id, row, col);
      if (!result.success) {
        return socket.emit('dig:error', { error: result.error });
      }

      socket.emit('dig:result', {
        row, col,
        hit: result.hit,
        bonusPoints: result.bonusPoints,
        totalScore: result.totalScore,
      });

      // Notify opponent
      const match = matchManager.getMatch(matchId);
      const opponentId = matchManager.getOpponentId(match, user.id);
      const opponent = match.players[opponentId];
      if (opponent?.socketId) {
        io.to(opponent.socketId).emit('dig:opponent_dug', {
          row, col,
          hit: result.hit,
        });
      }

      // Check if all digs done
      if (matchManager.checkAllDigsDone(matchId)) {
        clearDigTimer(match);
        advanceToNextQuestion(io, matchId);
      }
    });

    socket.on('dig:skip', ({ matchId }) => {
      matchManager.skipDig(matchId, user.id);
      if (matchManager.checkAllDigsDone(matchId)) {
        const match = matchManager.getMatch(matchId);
        clearDigTimer(match);
        advanceToNextQuestion(io, matchId);
      }
    });

    // ====== DISCONNECT ======

    socket.on('disconnect', () => {
      console.log(`[Socket] ${user.username} disconnected`);
      onlineUsers.delete(user.id);
      socketUserMap.delete(socket.id);

      // Handle match disconnect
      const match = matchManager.getMatchByUser(user.id);
      if (match && match.phase !== 'results') {
        const opponentId = matchManager.getOpponentId(match, user.id);
        const opponent = match.players[opponentId];

        // Give 30 seconds to reconnect, then forfeit
        setTimeout(() => {
          const currentOnline = onlineUsers.get(user.id);
          if (!currentOnline) {
            const forfeitResult = matchManager.forfeitMatch(match.id, user.id);
            if (forfeitResult && opponent?.socketId) {
              io.to(opponent.socketId).emit('match:opponent_disconnected', forfeitResult);
            }
            matchManager.cleanupMatch(match.id);
          }
        }, 30000);

        if (opponent?.socketId) {
          io.to(opponent.socketId).emit('match:opponent_reconnecting');
        }
      }
    });

    // Emit online users count
    socket.on('users:online', () => {
      socket.emit('users:online_list', {
        users: [...onlineUsers.values()].map(u => u.username).filter(u => u !== user.username),
        count: onlineUsers.size,
      });
    });
  });
}

function startQuestionTimer(io, matchId) {
  const match = matchManager.getMatch(matchId);
  if (!match) return;

  const timeLimit = parseInt(process.env.QUESTION_TIME_LIMIT || '30', 10) * 1000;

  match.questionTimer = setTimeout(() => {
    // Auto-submit null for players who haven't answered
    Object.entries(match.players).forEach(([id, player]) => {
      if (player.answers[match.currentQuestionIndex] === undefined) {
        matchManager.submitAnswer(matchId, parseInt(id), match.currentQuestionIndex, null);
      }
    });
    processQuestionResults(io, matchId);
  }, timeLimit + 1000); // +1s grace
}

function processQuestionResults(io, matchId) {
  const evalResult = matchManager.evaluateQuestion(matchId);
  if (!evalResult) return;

  const match = matchManager.getMatch(matchId);
  if (!match) return;

  // Send personalized results to each player
  Object.entries(match.players).forEach(([id, player]) => {
    const userId = parseInt(id);
    const opponentId = matchManager.getOpponentId(match, userId);

    if (player.socketId) {
      io.to(player.socketId).emit('quiz:results', {
        questionNumber: evalResult.questionNumber,
        correctAnswer: evalResult.correctAnswer,
        yourResult: evalResult.results[userId],
        opponentCorrect: evalResult.results[opponentId]?.correct || false,
        opponentScore: match.players[opponentId]?.score || 0,
      });
    }
  });

  // If any player has a dig chance, enter dig phase
  if (evalResult.anyCorrect) {
    match.phase = 'digging';
    Object.entries(match.players).forEach(([id, player]) => {
      if (player.socketId) {
        io.to(player.socketId).emit('dig:phase', {
          canDig: player.pendingDig,
          timeLimit: 15000,
        });
      }
    });

    // Auto-advance after 15 seconds
    match.digPhaseTimer = setTimeout(() => {
      Object.entries(match.players).forEach(([id, player]) => {
        if (player.pendingDig) {
          matchManager.skipDig(matchId, parseInt(id));
        }
      });
      advanceToNextQuestion(io, matchId);
    }, 16000);
  } else {
    // No one gets to dig, move on
    setTimeout(() => advanceToNextQuestion(io, matchId), 2000);
  }
}

function clearDigTimer(match) {
  if (match?.digPhaseTimer) {
    clearTimeout(match.digPhaseTimer);
    match.digPhaseTimer = null;
  }
}

function advanceToNextQuestion(io, matchId) {
  const match = matchManager.getMatch(matchId);
  if (!match) return;

  setTimeout(() => {
    const questionData = matchManager.startNextQuestion(matchId);
    if (!questionData) return;

    if (questionData.type === 'results') {
      // Game over
      Object.entries(match.players).forEach(([id, player]) => {
        if (player.socketId) {
          io.to(player.socketId).emit('match:finished', questionData);
        }
      });
      setTimeout(() => matchManager.cleanupMatch(matchId), 60000);
    } else {
      io.to(`match:${matchId}`).emit('quiz:question', questionData);
      startQuestionTimer(io, matchId);
    }
  }, 1500);
}

module.exports = { setupSocket, onlineUsers };
