/**
 * Match Manager for CodeDuel
 * Server-authoritative game state machine
 */

const { v4: uuidv4 } = require('uuid');
const { generateShapes } = require('./shapeGenerator');
const { validatePlacement, getGridSize } = require('./boardValidator');
const { pickQuestions } = require('./questionPicker');
const db = require('../db');

// In-memory active matches
const activeMatches = new Map();
// Map userId -> matchId for quick lookup
const userMatchMap = new Map();
// Pending challenges
const pendingChallenges = new Map();

const QUESTION_TIME_LIMIT = parseInt(process.env.QUESTION_TIME_LIMIT || '30', 10) * 1000;

function createChallenge(fromUser, toUser, questionCount, category) {
  const challengeId = uuidv4();
  pendingChallenges.set(challengeId, {
    id: challengeId,
    from: fromUser,
    to: toUser,
    questionCount,
    category,
    createdAt: Date.now(),
  });
  // Expire after 60 seconds
  setTimeout(() => {
    pendingChallenges.delete(challengeId);
  }, 60000);
  return challengeId;
}

function getChallenge(challengeId) {
  return pendingChallenges.get(challengeId);
}

function removeChallenge(challengeId) {
  pendingChallenges.delete(challengeId);
}

function isUserInMatch(userId) {
  return userMatchMap.has(userId);
}

function createMatch(challenge) {
  const matchId = uuidv4();
  const gridSize = getGridSize(challenge.questionCount);
  const { shapes, totalCells } = generateShapes(challenge.questionCount);
  const questions = pickQuestions(challenge.category, challenge.questionCount);

  // Save match to DB
  db.prepare(`
    INSERT INTO matches (id, player1_id, player2_id, category, question_count, status)
    VALUES (?, ?, ?, ?, ?, 'placing')
  `).run(matchId, challenge.from.id, challenge.to.id, challenge.category, challenge.questionCount);

  // Save match questions
  const insertQ = db.prepare('INSERT INTO match_questions (match_id, question_id, question_order) VALUES (?, ?, ?)');
  const insertMany = db.transaction((qs) => {
    for (const q of qs) {
      insertQ.run(matchId, q.id, q.questionOrder);
    }
  });
  insertMany(questions);

  const match = {
    id: matchId,
    category: challenge.category,
    questionCount: challenge.questionCount,
    gridSize,
    shapes,
    totalCells,
    questions: questions.map(q => ({
      id: q.id,
      questionOrder: q.questionOrder,
      questionText: q.question_text,
      optionA: q.option_a,
      optionB: q.option_b,
      optionC: q.option_c,
      optionD: q.option_d,
      correctAnswer: q.correct_answer,
      category: q.category,
    })),
    currentQuestionIndex: -1,
    phase: 'placing', // placing | question | digging | results
    players: {},
    questionTimer: null,
    digPhaseTimer: null,
    questionStartTime: null,
  };

  // Init players
  [challenge.from, challenge.to].forEach(user => {
    match.players[user.id] = {
      id: user.id,
      username: user.username,
      socketId: null,
      board: null,
      placed: false,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      answers: {},
      pendingDig: false,
      digsHit: 0,
      digsMiss: 0,
      digsDone: new Set(), // cells already dug
      revealedOnOpponent: [], // cells revealed on opponent's board
    };
  });

  activeMatches.set(matchId, match);
  userMatchMap.set(challenge.from.id, matchId);
  userMatchMap.set(challenge.to.id, matchId);

  return match;
}

function getMatch(matchId) {
  return activeMatches.get(matchId);
}

function getMatchByUser(userId) {
  const matchId = userMatchMap.get(userId);
  return matchId ? activeMatches.get(matchId) : null;
}

function getOpponentId(match, userId) {
  const playerIds = Object.keys(match.players).map(Number);
  return playerIds.find(id => id !== userId);
}

function submitPlacement(matchId, userId, placements) {
  const match = activeMatches.get(matchId);
  if (!match) return { success: false, error: 'Match not found' };
  if (match.phase !== 'placing') return { success: false, error: 'Not in placement phase' };

  const player = match.players[userId];
  if (!player) return { success: false, error: 'Player not in match' };
  if (player.placed) return { success: false, error: 'Already placed shapes' };

  const result = validatePlacement(placements, match.shapes, match.gridSize);
  if (!result.valid) return { success: false, error: result.error };

  player.board = result.board;
  player.placed = true;
  player.placements = placements;

  // Check if both placed
  const allPlaced = Object.values(match.players).every(p => p.placed);

  return { success: true, allPlaced };
}

function startNextQuestion(matchId) {
  const match = activeMatches.get(matchId);
  if (!match) return null;

  match.currentQuestionIndex++;
  if (match.currentQuestionIndex >= match.questions.length) {
    return finishMatch(matchId);
  }

  match.phase = 'question';
  const q = match.questions[match.currentQuestionIndex];

  // Reset answers for this question
  Object.values(match.players).forEach(p => {
    p.pendingDig = false;
  });

  match.questionStartTime = Date.now();

  // Don't send correct answer to clients
  return {
    type: 'question',
    questionNumber: q.questionOrder,
    questionText: q.questionText,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    category: q.category,
    timeLimit: QUESTION_TIME_LIMIT,
    currentIndex: match.currentQuestionIndex,
    totalQuestions: match.questions.length,
  };
}

function submitAnswer(matchId, userId, questionIndex, answer) {
  const match = activeMatches.get(matchId);
  if (!match) return { success: false, error: 'Match not found' };
  if (match.phase !== 'question') return { success: false, error: 'Not in question phase' };
  if (questionIndex !== match.currentQuestionIndex) return { success: false, error: 'Wrong question' };

  const player = match.players[userId];
  if (!player) return { success: false, error: 'Player not in match' };
  if (player.answers[questionIndex] !== undefined) return { success: false, error: 'Already answered' };

  // Check time limit
  const elapsed = Date.now() - match.questionStartTime;
  if (elapsed > QUESTION_TIME_LIMIT + 2000) { // 2s grace
    answer = null; // Treat as timeout
  }

  player.answers[questionIndex] = answer;

  // Check if both answered
  const allAnswered = Object.values(match.players).every(p => p.answers[questionIndex] !== undefined);

  return { success: true, allAnswered };
}

function evaluateQuestion(matchId) {
  const match = activeMatches.get(matchId);
  if (!match) return null;

  const q = match.questions[match.currentQuestionIndex];
  const qNum = q.questionOrder;
  const results = {};
  let anyCorrect = false;

  Object.entries(match.players).forEach(([id, player]) => {
    const userId = parseInt(id);
    const answer = player.answers[match.currentQuestionIndex];
    const correct = answer === q.correctAnswer;

    if (correct) {
      player.score += qNum;
      player.correctCount++;
      player.pendingDig = true;
      anyCorrect = true;
    } else {
      player.wrongCount++;
    }

    results[userId] = {
      correct,
      answer,
      pointsEarned: correct ? qNum : 0,
      canDig: correct,
      totalScore: player.score,
    };
  });

  return {
    correctAnswer: q.correctAnswer,
    questionNumber: qNum,
    results,
    anyCorrect,
  };
}

function submitDig(matchId, userId, row, col) {
  const match = activeMatches.get(matchId);
  if (!match) return { success: false, error: 'Match not found' };

  const player = match.players[userId];
  if (!player) return { success: false, error: 'Player not in match' };
  if (!player.pendingDig) return { success: false, error: 'No dig chance' };

  const cellKey = `${row},${col}`;
  if (player.digsDone.has(cellKey)) {
    return { success: false, error: 'Already dug this cell' };
  }

  const opponentId = getOpponentId(match, userId);
  const opponent = match.players[opponentId];
  if (!opponent || !opponent.board) return { success: false, error: 'Opponent board not ready' };

  // Check bounds
  if (row < 0 || row >= match.gridSize || col < 0 || col >= match.gridSize) {
    return { success: false, error: 'Out of bounds' };
  }

  player.digsDone.add(cellKey);
  player.pendingDig = false;

  const hit = opponent.board[row][col] === 1;
  if (hit) {
    player.digsHit++;
    player.score += 3;
  } else {
    player.digsMiss++;
  }

  player.revealedOnOpponent.push({ row, col, hit });

  return {
    success: true,
    hit,
    bonusPoints: hit ? 3 : 0,
    totalScore: player.score,
  };
}

function skipDig(matchId, userId) {
  const match = activeMatches.get(matchId);
  if (!match) return;
  const player = match.players[userId];
  if (player) player.pendingDig = false;
}

function checkAllDigsDone(matchId) {
  const match = activeMatches.get(matchId);
  if (!match) return true;
  return Object.values(match.players).every(p => !p.pendingDig);
}

function finishMatch(matchId) {
  const match = activeMatches.get(matchId);
  if (!match) return null;

  match.phase = 'results';

  const playerIds = Object.keys(match.players).map(Number);
  const p1 = match.players[playerIds[0]];
  const p2 = match.players[playerIds[1]];

  let winnerId = null;
  let isDraw = false;

  if (p1.score > p2.score) {
    winnerId = playerIds[0];
  } else if (p2.score > p1.score) {
    winnerId = playerIds[1];
  } else {
    isDraw = true;
  }

  // Update DB
  db.prepare(`
    UPDATE matches SET
      status = 'finished',
      winner_id = ?,
      is_draw = ?,
      player1_score = ?,
      player2_score = ?,
      player1_correct = ?,
      player2_correct = ?,
      player1_digs_hit = ?,
      player2_digs_hit = ?,
      player1_digs_miss = ?,
      player2_digs_miss = ?,
      finished_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    winnerId, isDraw ? 1 : 0,
    p1.score, p2.score,
    p1.correctCount, p2.correctCount,
    p1.digsHit, p2.digsHit,
    p1.digsMiss, p2.digsMiss,
    matchId,
  );

  const results = {
    type: 'results',
    matchId,
    winnerId,
    isDraw,
    players: {},
  };

  Object.entries(match.players).forEach(([id, p]) => {
    results.players[id] = {
      username: p.username,
      score: p.score,
      correctCount: p.correctCount,
      wrongCount: p.wrongCount,
      digsHit: p.digsHit,
      digsMiss: p.digsMiss,
      revealedCells: p.revealedOnOpponent.length,
    };
  });

  // Cleanup
  if (match.questionTimer) clearTimeout(match.questionTimer);
  if (match.digPhaseTimer) clearTimeout(match.digPhaseTimer);

  return results;
}

function forfeitMatch(matchId, userId) {
  const match = activeMatches.get(matchId);
  if (!match) return null;

  const opponentId = getOpponentId(match, userId);
  match.phase = 'results';

  db.prepare(`
    UPDATE matches SET status = 'forfeited', winner_id = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(opponentId, matchId);

  // Cleanup timers
  if (match.questionTimer) clearTimeout(match.questionTimer);
  if (match.digPhaseTimer) clearTimeout(match.digPhaseTimer);

  return { winnerId: opponentId, forfeited: true, forfeitedBy: userId };
}

function cleanupMatch(matchId) {
  const match = activeMatches.get(matchId);
  if (match) {
    Object.keys(match.players).forEach(id => userMatchMap.delete(parseInt(id)));
    if (match.questionTimer) clearTimeout(match.questionTimer);
    if (match.digPhaseTimer) clearTimeout(match.digPhaseTimer);
    activeMatches.delete(matchId);
  }
}

module.exports = {
  createChallenge, getChallenge, removeChallenge,
  isUserInMatch, createMatch, getMatch, getMatchByUser, getOpponentId,
  submitPlacement, startNextQuestion, submitAnswer, evaluateQuestion,
  submitDig, skipDig, checkAllDigsDone, finishMatch, forfeitMatch, cleanupMatch,
  activeMatches, pendingChallenges,
};
