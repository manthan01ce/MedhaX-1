// Dashboard controller
(async function() {
  // Check auth
  let currentUser = null;
  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) { window.location.href = '/login.html'; return; }
    const data = await res.json();
    currentUser = data.user;
  } catch { window.location.href = '/login.html'; return; }

  // Set user info
  document.getElementById('user-display').textContent = currentUser.username;
  document.getElementById('user-avatar').textContent = currentUser.username[0].toUpperCase();
  document.getElementById('welcome-name').textContent = currentUser.username;

  // Logout
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  });

  // Socket connection
  const socket = io();
  let pendingChallengeId = null;
  let challengeTargetUsername = null;

  // Load categories
  let categories = [];
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    categories = data.categories;
    const sel = document.getElementById('category-select');
    sel.innerHTML = categories.map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join('');
  } catch {}

  // Load match history
  async function loadHistory() {
    try {
      const res = await fetch('/api/matches/history');
      const data = await res.json();
      const el = document.getElementById('match-history');
      if (!data.matches.length) {
        el.innerHTML = '<p style="color:var(--text-muted);text-align:center">No matches yet. Challenge someone!</p>';
        return;
      }
      let wins = 0, losses = 0, draws = 0;
      el.innerHTML = data.matches.map(m => {
        const isP1 = m.player1_id === currentUser.id;
        const oppName = isP1 ? m.player2_username : m.player1_username;
        const myScore = isP1 ? m.player1_score : m.player2_score;
        const oppScore = isP1 ? m.player2_score : m.player1_score;
        let result, cls;
        if (m.is_draw) { result = 'Draw'; cls = 'draw'; draws++; }
        else if (m.winner_id === currentUser.id) { result = 'Win'; cls = 'win'; wins++; }
        else { result = 'Loss'; cls = 'loss'; losses++; }
        return `<div class="match-item">
          <div><strong>vs ${oppName}</strong> <span class="badge badge-blue">${m.category}</span></div>
          <div>${myScore} - ${oppScore}</div>
          <div class="match-result ${cls}">${result}</div>
        </div>`;
      }).join('');

      // Update stats
      const statsEl = document.getElementById('user-stats');
      const total = wins + losses + draws;
      statsEl.innerHTML = `
        <div class="result-stats" style="grid-template-columns:1fr">
          <div class="stat-item"><span class="stat-label">Matches</span><span class="stat-value">${total}</span></div>
          <div class="stat-item"><span class="stat-label">Wins</span><span class="stat-value green">${wins}</span></div>
          <div class="stat-item"><span class="stat-label">Losses</span><span class="stat-value red">${losses}</span></div>
          <div class="stat-item"><span class="stat-label">Draws</span><span class="stat-value amber">${draws}</span></div>
          <div class="stat-item"><span class="stat-label">Win Rate</span><span class="stat-value">${total ? Math.round(wins/total*100) : 0}%</span></div>
        </div>`;
    } catch {}
  }
  loadHistory();

  // Request online users on load
  socket.emit('users:online');

  socket.on('users:online_list', ({ users, count }) => {
    const el = document.getElementById('online-users');
    const otherUsers = users.filter(u => u !== currentUser.username);
    if (!otherUsers.length) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">No other users online. Open another browser window and log in as a different user to test!</p>';
      return;
    }

    el.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:0.5rem">Online users (${users.length}):</p>` +
      otherUsers.map(u => `<div class="user-item"><span><span class="online-dot"></span> <span class="username">${u}</span></span><button class="btn btn-primary btn-sm challenge-user-btn" data-username="${u}">Challenge</button></div>`).join('');

    el.querySelectorAll('.challenge-user-btn').forEach(btn => {
      btn.addEventListener('click', () => openChallengeModal(btn.dataset.username));
    });
  });

  // Search
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');
  const searchResults = document.getElementById('search-results');

  async function doSearch() {
    const q = searchInput.value.trim();
    if (!q) { searchResults.innerHTML = ''; return; }
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!data.users.length) {
        searchResults.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem">No users found</p>';
        return;
      }
      searchResults.innerHTML = data.users.map(u =>
        `<div class="user-item"><span class="username">${u.username}</span><button class="btn btn-primary btn-sm challenge-user-btn" data-username="${u.username}">Challenge</button></div>`
      ).join('');
      searchResults.querySelectorAll('.challenge-user-btn').forEach(btn => {
        btn.addEventListener('click', () => openChallengeModal(btn.dataset.username));
      });
    } catch {}
  }
  searchBtn.addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  // Challenge modal
  const modal = document.getElementById('challenge-modal');
  function openChallengeModal(username) {
    challengeTargetUsername = username;
    document.getElementById('challenge-target').textContent = username;
    modal.classList.remove('hidden');
  }
  document.getElementById('cancel-challenge-btn').addEventListener('click', () => modal.classList.add('hidden'));

  document.getElementById('send-challenge-btn').addEventListener('click', () => {
    const questionCount = parseInt(document.getElementById('question-count').value);
    const category = document.getElementById('category-select').value;
    if (!category) { alert('Please select a category'); return; }

    socket.emit('challenge:send', {
      targetUsername: challengeTargetUsername,
      questionCount,
      category,
    });
    modal.classList.add('hidden');

    // Show waiting overlay
    document.getElementById('waiting-target').textContent = challengeTargetUsername;
    document.getElementById('waiting-overlay').classList.remove('hidden');
  });

  document.getElementById('cancel-waiting-btn').addEventListener('click', () => {
    document.getElementById('waiting-overlay').classList.add('hidden');
  });

  // Challenge sent confirmation
  socket.on('challenge:sent', ({ challengeId, to }) => {
    pendingChallengeId = challengeId;
  });

  socket.on('challenge:error', ({ error }) => {
    document.getElementById('waiting-overlay').classList.add('hidden');
    alert(error);
  });

  socket.on('challenge:rejected', ({ by }) => {
    document.getElementById('waiting-overlay').classList.add('hidden');
    showToast(`${by} rejected your challenge`, 'error');
  });

  // Incoming challenge
  socket.on('challenge:incoming', ({ challengeId, from, questionCount, category }) => {
    pendingChallengeId = challengeId;
    const el = document.getElementById('incoming-challenge');
    document.getElementById('challenger-name').textContent = from;
    document.getElementById('challenge-info').textContent = `${questionCount} questions • ${category.toUpperCase()}`;
    el.classList.remove('hidden');
  });

  document.getElementById('accept-challenge-btn').addEventListener('click', () => {
    socket.emit('challenge:accept', { challengeId: pendingChallengeId });
    document.getElementById('incoming-challenge').classList.add('hidden');
  });

  document.getElementById('reject-challenge-btn').addEventListener('click', () => {
    socket.emit('challenge:reject', { challengeId: pendingChallengeId });
    document.getElementById('incoming-challenge').classList.add('hidden');
  });

  // Match created - redirect to match page
  socket.on('match:created', (data) => {
    // Store match data for the match page
    sessionStorage.setItem('matchData', JSON.stringify(data));
    window.location.href = '/match.html';
  });

  // Reconnect to existing match
  socket.on('match:reconnect', (data) => {
    sessionStorage.setItem('matchData', JSON.stringify({ ...data, matchId: data.matchId, reconnect: true }));
    window.location.href = '/match.html';
  });

  function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }
})();
