document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const messageEl = document.getElementById('message');

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.className = 'mt-3 alert alert-success';
      messageEl.textContent = 'Connexion réussie ! Redirection...';
      // Les cookies sont automatiquement définis par le serveur
      setTimeout(() => { window.location.href = '/dashboard'; }, 500);
    } else {
      messageEl.className = 'mt-3 alert alert-danger';
      messageEl.textContent = data.error || 'Erreur de connexion.';
    }
  } catch (err) {
    messageEl.className = 'mt-3 alert alert-danger';
    messageEl.textContent = 'Erreur de connexion au serveur.';
  }
});
