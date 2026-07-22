document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const messageEl = document.getElementById('message');

  try {
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.className = 'mt-3 alert alert-success';
      messageEl.textContent = 'Inscription réussie ! Vous pouvez maintenant vous connecter.';
      document.getElementById('registerForm').reset();
    } else if (response.status === 409) {
      messageEl.className = 'mt-3 alert alert-danger';
      messageEl.textContent = data.error || 'Ce nom d\'utilisateur est déjà utilisé.';
    } else {
      messageEl.className = 'mt-3 alert alert-danger';
      messageEl.textContent = data.error || 'Erreur lors de l\'inscription.';
    }
  } catch (err) {
    messageEl.className = 'mt-3 alert alert-danger';
    messageEl.textContent = 'Erreur de connexion au serveur.';
  }
});
