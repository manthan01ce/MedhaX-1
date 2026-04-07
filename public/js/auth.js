// Auth page handler
(function() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const errorMsg = document.getElementById('error-msg');

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const btn = document.getElementById('login-btn');
      btn.disabled = true; btn.textContent = 'Logging in...';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error); btn.disabled = false; btn.textContent = 'Login'; return; }
        window.location.href = '/dashboard.html';
      } catch (err) {
        showError('Network error'); btn.disabled = false; btn.textContent = 'Login';
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const confirm = document.getElementById('confirm-password').value;
      const btn = document.getElementById('register-btn');

      if (password !== confirm) { showError('Passwords do not match'); return; }
      btn.disabled = true; btn.textContent = 'Creating account...';

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) { showError(data.error); btn.disabled = false; btn.textContent = 'Create Account'; return; }
        window.location.href = '/dashboard.html';
      } catch (err) {
        showError('Network error'); btn.disabled = false; btn.textContent = 'Create Account';
      }
    });
  }
})();
