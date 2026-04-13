// Match page controller - handles all game phases
(async function() {
  // Auth check
  let currentUser = null;
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { window.location.href = '/login.html'; return; }
    currentUser = (await res.json()).user;
  } catch { window.location.href = '/login.html'; return; }

  // Get match data from session storage
  const matchDataStr = sessionStorage.getItem('matchData');
  if (!matchDataStr) { window.location.href = '/dashboard.html'; return; }
  const matchData = JSON.parse(matchDataStr);

  const socket = io();
  let matchId = matchData.matchId;
  let gridSize = matchData.gridSize;
  let shapes = matchData.shapes || [];
  let opponentUsername = matchData.opponentUsername || 'Opponent';

  // State
  let selectedShapeIndex = -1;
  let currentRotation = 0;
  let placedShapes = {}; // shapeId -> { cells, rotationIndex }
  let myBoard = [];
  let opponentBoardState = []; // 0=unknown, 1=miss, 2=hit
  let canDig = false;
  let timerInterval = null;
  let currentQuestionIndex = -1;
  let answered = false;
  let lockedOut = false;

  // Init boards
  function initBoard(size) {
    return Array.from({ length: size }, () => Array(size).fill(0));
  }
  myBoard = initBoard(gridSize);
  opponentBoardState = initBoard(gridSize);

  // Set up UI
  document.getElementById('your-name').textContent = currentUser.username;
  document.getElementById('opp-name').textContent = opponentUsername;

  // === PHASE TRANSITIONS ===
  function showPhase(phase) {
    ['phase-waiting', 'phase-placement', 'phase-quiz', 'phase-results'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
    document.getElementById(`phase-${phase}`).classList.remove('hidden');
    document.getElementById('phase-label').textContent =
      phase === 'waiting' ? 'Waiting...' :
      phase === 'placement' ? 'Place Your Shapes' :
      phase === 'quiz' ? 'Quiz Active' :
      'Match Over';
  }

  // Start in placement phase
  if (matchData.reconnect && matchData.phase !== 'placing') {
    // Handle reconnection to active quiz
    showPhase('quiz');
    renderOpponentBoard();
    renderMyBoardSmall();
    renderShapePalette();
  }

  socket.on('challenge:error', (data) => {
    alert(data.error || 'A problem occurred with the match.');
    window.location.href = '/dashboard.html';
  });

  // === SHAPE PLACEMENT ===
  function renderShapePalette() {
    const palette = document.getElementById('shape-palette');
    palette.innerHTML = shapes.map((shape, i) => {
      const isPlaced = placedShapes[shape.id];
      return `<div class="shape-item ${selectedShapeIndex === i ? 'active' : ''} ${isPlaced ? 'placed' : ''}" data-index="${i}">
        <div>${renderMiniShape(shape, currentRotation)}</div>
        <div>
          <div style="font-weight:600;font-size:0.9rem">${formatShapeName(shape.name)}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">${shape.size} cells</div>
        </div>
        ${isPlaced ? '<span class="badge badge-green">Placed</span>' : ''}
      </div>`;
    }).join('');

    palette.querySelectorAll('.shape-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        if (placedShapes[shapes[idx].id]) return; // Already placed
        selectedShapeIndex = idx;
        currentRotation = 0;
        renderShapePalette();
        renderPlacementBoard();
      });
    });

    updatePlacementStatus();
  }

  function formatShapeName(name) {
    return name.replace(/_/g, ' ').replace(/\d+/g, '').replace(/\b\w/g, c => c.toUpperCase()).trim() || 'Shape';
  }

  function renderMiniShape(shape, rotIndex) {
    const cells = shape.rotations[rotIndex % shape.rotations.length];
    const maxR = Math.max(...cells.map(([r]) => r)) + 1;
    const maxC = Math.max(...cells.map(([, c]) => c)) + 1;
    const set = new Set(cells.map(([r, c]) => `${r},${c}`));

    let html = `<div class="shape-mini-grid" style="grid-template-columns:repeat(${maxC}, 14px)">`;
    for (let r = 0; r < maxR; r++) {
      for (let c = 0; c < maxC; c++) {
        html += `<div class="shape-mini-cell ${set.has(`${r},${c}`) ? '' : 'empty'}"></div>`;
      }
    }
    html += '</div>';
    return html;
  }

  function renderPlacementBoard() {
    const board = document.getElementById('placement-board');
    board.style.gridTemplateColumns = `repeat(${gridSize}, 42px)`;
    board.innerHTML = '';

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        if (myBoard[r][c] === 1) cell.classList.add('cell-ship');
        cell.dataset.row = r;
        cell.dataset.col = c;

        cell.addEventListener('click', () => handlePlacementClick(r, c));
        cell.addEventListener('mouseenter', () => handlePlacementHover(r, c));
        cell.addEventListener('mouseleave', clearPreview);

        board.appendChild(cell);
      }
    }
  }

  function getShapeCells(shapeIndex, row, col, rotation) {
    const shape = shapes[shapeIndex];
    const rotCells = shape.rotations[rotation % shape.rotations.length];
    return rotCells.map(([dr, dc]) => [row + dr, col + dc]);
  }

  function isValidPlacement(cells) {
    return cells.every(([r, c]) => r >= 0 && r < gridSize && c >= 0 && c < gridSize && myBoard[r][c] === 0);
  }

  function handlePlacementHover(row, col) {
    if (selectedShapeIndex < 0) return;
    clearPreview();
    const cells = getShapeCells(selectedShapeIndex, row, col, currentRotation);
    const valid = isValidPlacement(cells);
    cells.forEach(([r, c]) => {
      if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
        const el = document.querySelector(`#placement-board .grid-cell[data-row="${r}"][data-col="${c}"]`);
        if (el) el.classList.add(valid ? 'cell-preview' : 'cell-invalid');
      }
    });
  }

  function clearPreview() {
    document.querySelectorAll('#placement-board .cell-preview, #placement-board .cell-invalid').forEach(el => {
      el.classList.remove('cell-preview', 'cell-invalid');
    });
  }

  function handlePlacementClick(row, col) {
    if (selectedShapeIndex < 0) return;
    const shape = shapes[selectedShapeIndex];
    if (placedShapes[shape.id]) return;

    const cells = getShapeCells(selectedShapeIndex, row, col, currentRotation);
    if (!isValidPlacement(cells)) return;

    // Place shape
    cells.forEach(([r, c]) => { myBoard[r][c] = 1; });
    placedShapes[shape.id] = {
      shapeId: shape.id,
      cells: cells,
      rotationIndex: currentRotation % shape.rotations.length,
    };

    selectedShapeIndex = -1;
    renderPlacementBoard();
    renderShapePalette();
  }

  // Rotate
  document.getElementById('rotate-btn').addEventListener('click', () => {
    if (selectedShapeIndex < 0) return;
    currentRotation = (currentRotation + 1) % 4;
    renderShapePalette();
  });

  // Clear all
  document.getElementById('clear-btn').addEventListener('click', () => {
    myBoard = initBoard(gridSize);
    placedShapes = {};
    selectedShapeIndex = -1;
    currentRotation = 0;
    renderPlacementBoard();
    renderShapePalette();
    updatePlacementStatus();
  });



  // Auto Place
  function autoPlaceAllShapes() {
    // Clear first
    myBoard = initBoard(gridSize);
    placedShapes = {};
    selectedShapeIndex = -1;
    currentRotation = 0;

    const allShapes = [...shapes];
    const placedList = [];

    // Brute force attempt to place all
    let attempts = 0;
    const maxGlobalAttempts = 100;

    while (placedList.length < allShapes.length && attempts < maxGlobalAttempts) {
      attempts++;
      myBoard = initBoard(gridSize);
      placedShapes = {};
      placedList.length = 0;
      let success = true;

      for (let i = 0; i < allShapes.length; i++) {
        const shape = allShapes[i];
        let shapePlaced = false;
        let shapeAttempts = 0;
        const maxShapeAttempts = 500;

        while (!shapePlaced && shapeAttempts < maxShapeAttempts) {
          shapeAttempts++;
          const r = Math.floor(Math.random() * gridSize);
          const c = Math.floor(Math.random() * gridSize);
          const rot = Math.floor(Math.random() * (shape.rotations?.length || 1));
          const cells = getShapeCells(i, r, c, rot);

          if (isValidPlacement(cells)) {
            cells.forEach(([row, col]) => { myBoard[row][col] = 1; });
            placedShapes[shape.id] = {
              shapeId: shape.id,
              cells: cells,
              rotationIndex: rot,
            };
            placedList.push(shape.id);
            shapePlaced = true;
          }
        }

        if (!shapePlaced) {
          success = false;
          break;
        }
      }

      if (success) break;
    }

    renderPlacementBoard();
    renderShapePalette();
    updatePlacementStatus();
    
    if (placedList.length < allShapes.length) {
      console.warn("Could not auto-place all shapes. Try again.");
    }
  }

  document.getElementById('auto-place-btn').addEventListener('click', autoPlaceAllShapes);


  function updatePlacementStatus() {
    const allPlaced = shapes.every(s => placedShapes[s.id]);
    document.getElementById('confirm-placement-btn').disabled = !allPlaced;
    const placed = Object.keys(placedShapes).length;
    document.getElementById('placement-status').textContent = `${placed}/${shapes.length} shapes placed`;
  }

  // Confirm placement
  document.getElementById('confirm-placement-btn').addEventListener('click', () => {
    const placements = Object.values(placedShapes);
    socket.emit('placement:submit', { matchId, placements });
    document.getElementById('confirm-placement-btn').disabled = true;
    document.getElementById('confirm-placement-btn').textContent = 'Waiting for opponent...';
  });

  socket.on('placement:confirmed', () => {
    document.getElementById('placement-status').innerHTML = '<span style="color:var(--accent-green)">✅ Your shapes are locked in!</span>';
  });

  socket.on('placement:opponent_ready', () => {
    document.getElementById('opponent-placement-status').innerHTML = '<span style="color:var(--accent-green)">✅ Opponent has placed their shapes!</span>';
  });

  socket.on('placement:error', ({ error }) => {
    alert('Placement error: ' + error);
    document.getElementById('confirm-placement-btn').disabled = false;
    document.getElementById('confirm-placement-btn').textContent = '✅ Confirm Placement';
  });

  // === QUIZ PHASE ===
  function renderOpponentBoard() {
    const board = document.getElementById('opponent-board');
    board.style.gridTemplateColumns = `repeat(${gridSize}, 42px)`;
    board.innerHTML = '';

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell cell-unknown';
        cell.dataset.row = r;
        cell.dataset.col = c;

        const state = opponentBoardState[r][c];
        if (state === 1) { cell.classList.add('cell-miss', 'cell-dug'); cell.classList.remove('cell-unknown'); }
        else if (state === 2) { cell.classList.add('cell-hit', 'cell-dug'); cell.classList.remove('cell-unknown'); }

        cell.addEventListener('click', () => handleDig(r, c));
        board.appendChild(cell);
      }
    }
  }

  function renderMyBoardSmall() {
    const board = document.getElementById('your-board');
    board.style.gridTemplateColumns = `repeat(${gridSize}, 42px)`;
    board.innerHTML = '';

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = document.createElement('div');
        cell.className = 'grid-cell';
        if (myBoard[r][c] === 1) cell.classList.add('cell-ship');
        board.appendChild(cell);
      }
    }
  }

  socket.on('quiz:question', (data) => {
    showPhase('quiz');
    answered = false;
    canDig = false;
    lockedOut = false;
    currentQuestionIndex = data.currentIndex;

    document.getElementById('q-number').textContent = `Q${data.questionNumber} / ${data.totalQuestions}`;
    document.getElementById('question-progress').textContent = `${data.category.toUpperCase()}`;
    document.getElementById('q-text').textContent = data.questionText;
    document.getElementById('dig-prompt').classList.add('hidden');
    document.getElementById('question-feedback').classList.add('hidden');

    const optionsEl = document.getElementById('q-options');
    const opts = [
      { letter: 'A', text: data.optionA },
      { letter: 'B', text: data.optionB },
      { letter: 'C', text: data.optionC },
      { letter: 'D', text: data.optionD },
    ];
    optionsEl.innerHTML = opts.map(o => `<button class="option-btn" data-answer="${o.letter}"><span class="option-letter">${o.letter}</span>${o.text}</button>`).join('');
    optionsEl.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => submitAnswer(btn.dataset.answer));
    });

    // Timer
    startTimer(data.timeLimit / 1000);
    renderOpponentBoard();
    renderMyBoardSmall();
  });

  function startTimer(seconds) {
    if (timerInterval) clearInterval(timerInterval);
    let remaining = seconds;
    const timerEl = document.getElementById('q-timer');
    timerEl.textContent = remaining;
    timerEl.className = 'question-timer';

    timerInterval = setInterval(() => {
      remaining--;
      timerEl.textContent = remaining;
      if (remaining <= 5) timerEl.className = 'question-timer danger';
      else if (remaining <= 10) timerEl.className = 'question-timer warning';
      if (remaining <= 0) {
        clearInterval(timerInterval);
        if (!answered) {
          submitAnswer(null);
        }
      }
    }, 1000);
    
    // Store current remaining so we can update it
    timerEl.dataset.remaining = remaining;
  }
  
  function reduceTimer(maxSeconds) {
    const timerEl = document.getElementById('q-timer');
    let current = parseInt(timerEl.textContent) || 0;
    if (current > maxSeconds) {
        startTimer(maxSeconds);
    }
  }

  function submitAnswer(answer) {
    if (answered) return;
    answered = true;
    if (timerInterval) clearInterval(timerInterval);

    // Highlight selected
    if (answer) {
      document.querySelectorAll('.option-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.answer === answer) btn.classList.add('selected');
      });
    } else {
      document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);
    }

    socket.emit('quiz:answer', { matchId, questionIndex: currentQuestionIndex, answer });
  }

  socket.on('quiz:answer_locked', () => {
    // Confirmation that answer was received
  });

  socket.on('quiz:instant_result', (data) => {
    document.querySelectorAll('.option-btn').forEach(btn => {
      if (btn.dataset.answer === data.correctAnswer) btn.classList.add('correct');
      if (btn.classList.contains('selected') && btn.dataset.answer !== data.correctAnswer) btn.classList.add('wrong');
    });

    document.getElementById('your-score').textContent = data.totalScore;

    const feedbackEl = document.getElementById('question-feedback');
    feedbackEl.classList.remove('hidden');

    if (data.correct) {
      feedbackEl.innerHTML = `<span style="color:var(--accent-green)">✅ Correct! +${data.pointsEarned} points</span>`;
    } else {
      feedbackEl.innerHTML = `<span style="color:var(--accent-red)">❌ Wrong answer</span> <span style="color:var(--text-muted)">| Waiting for opponent...</span>`;
    }
  });

  socket.on('quiz:opponent_answered', (data) => {
    const feedbackEl = document.getElementById('question-feedback');
    if (data.lockedOut) {
      // Opponent answered correctly — we are locked out
      lockedOut = true;
      if (!answered) {
        answered = true;
        if (timerInterval) clearInterval(timerInterval);
        document.getElementById('q-timer').textContent = '0';
        document.querySelectorAll('.option-btn').forEach(btn => {
          btn.disabled = true;
          // Highlight the correct answer so the locked-out player can see it
          if (data.correctAnswer && btn.dataset.answer === data.correctAnswer) {
            btn.classList.add('correct');
          }
        });
      }
      feedbackEl.classList.remove('hidden');
      feedbackEl.innerHTML = `<span style="color:var(--accent-red)">🔒 Opponent answered correctly! You are locked out.</span>`;
    } else {
      // Opponent answered wrong — we still get to answer with reduced time
      if (!answered) {
        feedbackEl.classList.remove('hidden');
        feedbackEl.innerHTML = `<span style="color:var(--accent-amber)">⚠️ Opponent answered! Hurry up!</span>`;
      }
      reduceTimer(data.reducedTime);
    }
  });

  socket.on('quiz:results', (data) => {
    // Show correct/wrong
    document.querySelectorAll('.option-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.dataset.answer === data.correctAnswer) btn.classList.add('correct');
      if (btn.classList.contains('selected') && btn.dataset.answer !== data.correctAnswer) btn.classList.add('wrong');
    });

    // Update scores
    document.getElementById('your-score').textContent = data.yourResult.totalScore;
    document.getElementById('opp-score').textContent = data.opponentScore;

    // Show feedback
    const feedbackEl = document.getElementById('question-feedback');
    feedbackEl.classList.remove('hidden');
    if (lockedOut) {
      // Player was locked out — don't show "Wrong answer", show lockout message
      feedbackEl.innerHTML = `<span style="color:var(--accent-red)">🔒 Locked out — Opponent answered first!</span>`;
    } else if (data.yourResult.correct) {
      feedbackEl.innerHTML = `<span style="color:var(--accent-green)">✅ Correct! +${data.yourResult.pointsEarned} points</span>`;
    } else {
      feedbackEl.innerHTML = `<span style="color:var(--accent-red)">❌ Wrong answer</span>`;
    }

    if (data.opponentCorrect) {
      feedbackEl.innerHTML += ' <span style="color:var(--text-muted)">| Opponent: ✅</span>';
    } else {
      feedbackEl.innerHTML += ' <span style="color:var(--text-muted)">| Opponent: ❌</span>';
    }
  });

  // === DIG PHASE ===
  socket.on('dig:phase', (data) => {
    canDig = data.canDig;
    if (canDig) {
      document.getElementById('dig-prompt').classList.remove('hidden');
    }
  });

  document.getElementById('skip-dig-btn').addEventListener('click', () => {
    socket.emit('dig:skip', { matchId });
    canDig = false;
    document.getElementById('dig-prompt').classList.add('hidden');
  });

  function handleDig(row, col) {
    if (!canDig) return;
    if (opponentBoardState[row][col] !== 0) return; // Already dug

    socket.emit('dig:cell', { matchId, row, col });
    canDig = false;
    document.getElementById('dig-prompt').classList.add('hidden');
  }

  socket.on('dig:result', ({ row, col, hit, bonusPoints, totalScore }) => {
    opponentBoardState[row][col] = hit ? 2 : 1;
    document.getElementById('your-score').textContent = totalScore;
    renderOpponentBoard();

    const feedbackEl = document.getElementById('question-feedback');
    if (hit) {
      feedbackEl.innerHTML += ` <span style="color:var(--accent-green)">| 🎯 HIT! +${bonusPoints} bonus</span>`;
    } else {
      feedbackEl.innerHTML += ' <span style="color:var(--text-muted)">| 💨 Miss</span>';
    }
  });

  socket.on('dig:opponent_dug', ({ row, col, hit }) => {
    // Mark on our board that opponent dug here
    if (hit) {
      const cells = document.querySelectorAll('#your-board .grid-cell');
      const idx = row * gridSize + col;
      if (cells[idx]) {
        cells[idx].classList.add('cell-hit');
      }
    }
  });

  socket.on('dig:error', ({ error }) => {
    console.warn('Dig error:', error);
  });

  // === RESULTS ===
  socket.on('match:finished', (data) => {
    showPhase('results');

    const titleEl = document.getElementById('result-title');
    const subEl = document.getElementById('result-subtitle');
    const isWinner = data.winnerId === currentUser.id;

    if (data.isDraw) {
      titleEl.textContent = "It's a Draw!";
      titleEl.className = 'draw';
      subEl.textContent = 'Both players finished with the same score';
    } else if (isWinner) {
      titleEl.textContent = '🏆 You Win!';
      titleEl.className = 'win';
      // Show why they won
      if (data.forfeited) {
        if (data.reason === 'cheat') {
          subEl.textContent = '⚖️ Your opponent was disqualified for cheating!';
        } else {
          subEl.textContent = '🚪 Your opponent left the match. Victory by forfeit!';
        }
      } else if (data.winCondition === 'reveal') {
        subEl.textContent = '🎯 You revealed all of your opponent\'s shapes!';
      } else {
        subEl.textContent = '✅ You answered more questions correctly!';
      }
    } else {
      titleEl.textContent = 'You Lost';
      titleEl.className = 'loss';
      // Show why they lost
      if (data.forfeited) {
        if (data.reason === 'cheat') {
          subEl.textContent = '💀 You were disqualified for anti-cheat violations.';
        } else {
          subEl.textContent = '🚪 You left the match and forfeited.';
        }
      } else if (data.winCondition === 'reveal') {
        subEl.textContent = '💀 Your opponent revealed all your shapes!';
      } else {
        subEl.textContent = '📊 Your opponent had more points at the end.';
      }
    }

    const scoresEl = document.getElementById('results-scores');
    scoresEl.innerHTML = Object.entries(data.players).map(([id, p]) => {
      const isMe = parseInt(id) === currentUser.id;
      const isWinnerCard = parseInt(id) === data.winnerId;
      return `<div class="result-player-card ${isWinnerCard ? 'winner' : ''}">
        <div class="result-player-name">${p.username} ${isMe ? '(You)' : ''}</div>
        <div class="result-final-score">${p.score}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.5rem">Final Score</div>
        <div class="result-stats">
          <div class="stat-item"><span class="stat-label">Correct</span><span class="stat-value green">${p.correctCount}</span></div>
          <div class="stat-item"><span class="stat-label">Wrong</span><span class="stat-value red">${p.wrongCount}</span></div>
          <div class="stat-item"><span class="stat-label">Digs Hit</span><span class="stat-value green">${p.digsHit}</span></div>
          <div class="stat-item"><span class="stat-label">Digs Miss</span><span class="stat-value amber">${p.digsMiss}</span></div>
          <div class="stat-item"><span class="stat-label">Cells Found</span><span class="stat-value">${p.revealedCells}</span></div>
          <div class="stat-item"><span class="stat-label">Dig Bonus</span><span class="stat-value green">+${p.digsHit * 3}</span></div>
        </div>
      </div>`;
    }).join('');

    sessionStorage.removeItem('matchData');
  });

  // Opponent disconnected
  socket.on('match:opponent_reconnecting', () => {
    const feedbackEl = document.getElementById('question-feedback');
    feedbackEl.classList.remove('hidden');
    feedbackEl.innerHTML = `
      <div style="padding:1rem;background:rgba(255,170,0,0.1);border-radius:var(--radius-sm);border:1px solid var(--accent-amber)">
        <span style="color:var(--accent-amber)">⚠️ Opponent disconnected.</span><br>
        <span style="font-size:0.8rem;color:var(--text-secondary)">Waiting for them to reconnect... The match will persist.</span>
      </div>
    `;
  });

  // ====== LEAVE MATCH (Immediate) ======
  document.getElementById('leave-match-btn').addEventListener('click', () => {
    socket.emit('match:leave', { matchId });
    window.location.href = '/dashboard.html';
  });

  socket.on('match:go_dashboard', () => {
    window.location.href = '/dashboard.html';
  });

  // ====== ANTI-CHEAT ======
  function triggerCheatWarning() {
    // Only warn if match is active and not finished
    const phaseLabel = document.getElementById('phase-label').textContent;
    if (phaseLabel === 'Match Over' || phaseLabel === 'Waiting...') return;
    
    socket.emit('match:cheat_warning', { matchId });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      triggerCheatWarning();
    }
  });

  document.addEventListener('copy', (e) => {
    triggerCheatWarning();
  });

  socket.on('match:cheat_warning', (data) => {
    const overlay = document.getElementById('cheat-warning-overlay');
    const countEl = document.getElementById('cheat-warning-count');
    
    overlay.classList.remove('hidden');
    countEl.textContent = data.warningCount;
    
    if (data.warningCount >= 3) {
      document.getElementById('cheat-warning-title').textContent = "MATCH FORFEITED";
      document.getElementById('cheat-warning-msg').textContent = "You have been disqualified for repeated anti-cheat violations.";
      document.getElementById('close-cheat-overlay').textContent = "Match Results";
      document.getElementById('close-cheat-overlay').onclick = () => {
        overlay.classList.add('hidden');
      };
    }
  });

  document.getElementById('close-cheat-overlay').addEventListener('click', () => {
    document.getElementById('cheat-warning-overlay').classList.add('hidden');
  });

  // ====== HEADER ACTIONS ======
  document.getElementById('header-leave-btn').addEventListener('click', () => {
    const phaseLabel = document.getElementById('phase-label').textContent;
    if (phaseLabel === 'Match Over') {
      window.location.href = '/dashboard.html';
      return;
    }

    if (confirm("Are you sure you want to leave? This will count as a FORFEIT and you will lose the match.")) {
      socket.emit('match:forfeit', { matchId });
      window.location.href = '/dashboard.html';
    }
  });

  // Handle reconnect data
  if (matchData.reconnect) {
    if (matchData.revealedOnOpponent) {
      matchData.revealedOnOpponent.forEach(({ row, col, hit }) => {
        opponentBoardState[row][col] = hit ? 2 : 1;
      });
    }
    document.getElementById('your-score').textContent = matchData.score || 0;
  }
})();
