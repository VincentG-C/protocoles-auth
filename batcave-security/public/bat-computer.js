// Récupération des identifiants depuis le stockage de session
const username = sessionStorage.getItem('batcave_username');
const password = sessionStorage.getItem('batcave_password');

// Si pas d'identifiants en session, on demande à l'utilisateur
if (!username || !password) {
  const input = prompt('Veuillez entrer vos identifiants (username:password) :');
  if (input) {
    const parts = input.split(':');
    const user = parts[0];
    const pass = parts.slice(1).join(':');
    sessionStorage.setItem('batcave_username', user);
    sessionStorage.setItem('batcave_password', pass);
  } else {
    alert('Identifiants requis pour accéder au Bat-Ordinateur.');
    throw new Error('No credentials');
  }
}

// Recharge après stockage
if (!username || !password) {
  window.location.reload();
}

// Création de l'en-tête Authorization
const storedUsername = sessionStorage.getItem('batcave_username');
const storedPassword = sessionStorage.getItem('batcave_password');
const basicAuth = 'Basic ' + btoa(storedUsername + ':' + storedPassword);

// ============================================================
// 1. Récupération des informations utilisateur (/api/me)
// ============================================================
(async function loadUser() {
  try {
    const response = await fetch('/api/me', {
      headers: { 'Authorization': basicAuth }
    });
    if (response.ok) {
      const data = await response.json();
      document.getElementById('welcomeMessage').textContent =
        'Bienvenue, Justicier ' + data.username;
    }
  } catch (err) {
    console.error('Erreur /api/me :', err);
  }
})();

// ============================================================
// 2. Récupération des secrets (/api/secrets)
// ============================================================
(async function loadSecrets() {
  try {
    const response = await fetch('/api/secrets', {
      headers: { 'Authorization': basicAuth }
    });
    if (response.ok) {
      const gadgets = await response.json();
      const grid = document.getElementById('secretsGrid');
      grid.innerHTML = '';

      gadgets.forEach(gadget => {
        const col = document.createElement('div');
        col.className = 'col-md-3 col-sm-6';

        col.innerHTML = `
          <div class="card bg-secondary text-light h-100">
            <div class="card-body text-center">
              <i class="fas ${gadget.icon} fa-3x mb-3 text-warning"></i>
              <h5 class="card-title">${gadget.name}</h5>
              <p class="card-text">${gadget.desc}</p>
            </div>
          </div>
        `;

        grid.appendChild(col);
      });
    }
  } catch (err) {
    console.error('Erreur /api/secrets :', err);
  }
})();

// ============================================================
// 3. Envoi d'un rapport de mission (/api/reports)
// ============================================================
document.getElementById('reportForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const content = document.getElementById('reportContent').value;
  const messageEl = document.getElementById('reportMessage');

  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': basicAuth
      },
      body: JSON.stringify({ content })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.className = 'alert alert-success';
      messageEl.textContent = '✅ Rapport enregistré avec succès !';
      document.getElementById('reportContent').value = '';
    } else {
      messageEl.className = 'alert alert-danger';
      messageEl.textContent = '❌ ' + (data.error || 'Erreur lors de l\'envoi du rapport.');
    }
  } catch (err) {
    messageEl.className = 'alert alert-danger';
    messageEl.textContent = '❌ Erreur de connexion au serveur.';
  }
});
