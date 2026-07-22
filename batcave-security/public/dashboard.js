// ============================================================
// TP3 - Retry Pattern : Fonction fetch avec refresh automatique
// ============================================================

let isRefreshing = false;
let pendingRequests = [];

/**
 * Fonction fetch sécurisée avec Retry Pattern
 * Si le serveur répond 401 (token expiré) :
 *   1. Met la requête en pause
 *   2. Appelle /api/auth/refresh en tâche de fond
 *   3. Rejoue la requête initiale
 *   4. Si le refresh échoue, redirige vers /login
 */
async function securedFetch(url, options = {}) {
  const defaultOptions = {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const fetchOptions = { ...defaultOptions, ...options };
  if (options.headers) {
    // Fusionner les headers
    fetchOptions.headers = { ...defaultOptions.headers, ...options.headers };
  }

  // Première tentative
  let response = await fetch(url, fetchOptions);

  // Si 401 (token expiré), on tente le refresh
  if (response.status === 401) {
    console.log('🔑 Token expiré (401). Tentative de rafraîchissement...');

    if (!isRefreshing) {
      isRefreshing = true;

      try {
        const refreshResponse = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }
        });

        if (refreshResponse.ok) {
          console.log('✅ Token rafraîchi avec succès !');
          isRefreshing = false;

          // Rejouer toutes les requêtes en attente
          pendingRequests.forEach(resolve => resolve());
          pendingRequests = [];

          // Rejouer la requête initiale
          response = await fetch(url, fetchOptions);

          if (response.ok) {
            return response;
          }
        } else {
          console.log('❌ Échec du rafraîchissement. Redirection vers la page de connexion.');
          isRefreshing = false;
          pendingRequests = [];
          window.location.href = '/login';
          return response;
        }
      } catch (err) {
        console.error('Erreur lors du rafraîchissement :', err);
        isRefreshing = false;
        pendingRequests = [];
        window.location.href = '/login';
        return response;
      }
    } else {
      // Un refresh est déjà en cours, on attend
      console.log('⏳ Refresh déjà en cours, mise en attente...');
      await new Promise(resolve => {
        pendingRequests.push(resolve);
      });
      response = await fetch(url, fetchOptions);
      return response;
    }
  }

  return response;
}

// ============================================================
// Fonctions du tableau de bord
// ============================================================

// Charger le profil utilisateur
async function loadProfile() {
  try {
    const response = await securedFetch('/api/user/me');
    if (response.ok) {
      const user = await response.json();
      document.getElementById('welcomeMessage').textContent = `Bienvenue, Justicier ${user.username}`;
      document.getElementById('profileInfo').innerHTML = `
        <p><strong>ID :</strong> ${user.id}</p>
        <p><strong>Nom :</strong> ${user.username}</p>
        <p><strong>Rôle :</strong> <span class="badge ${user.role === 'ADMIN' ? 'bg-warning text-dark' : 'bg-info'}">${user.role}</span></p>
      `;
      console.log('✅ Profil chargé :', user);
    } else {
      document.getElementById('profileInfo').innerHTML = '<p class="text-danger">Erreur de chargement du profil.</p>';
    }
  } catch (err) {
    console.error('Erreur lors du chargement du profil :', err);
    document.getElementById('profileInfo').innerHTML = '<p class="text-danger">Erreur de connexion.</p>';
  }
}

// Déconnexion
async function logout() {
  try {
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.ok) {
      window.location.href = '/login';
    }
  } catch (err) {
    console.error('Erreur lors de la déconnexion :', err);
  }
}

// Changer le mot de passe
document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const oldPassword = document.getElementById('oldPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const messageEl = document.getElementById('changePasswordMessage');

  try {
    const response = await securedFetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword })
    });

    const data = await response.json();

    if (response.ok) {
      messageEl.className = 'alert alert-success';
      messageEl.textContent = '✅ Mot de passe modifié avec succès !';
      document.getElementById('changePasswordForm').reset();
    } else {
      messageEl.className = 'alert alert-danger';
      messageEl.textContent = '❌ ' + (data.error || 'Erreur lors du changement.');
    }
  } catch (err) {
    messageEl.className = 'alert alert-danger';
    messageEl.textContent = '❌ Erreur de connexion.';
  }
});

// Accès Batmobile (avec 2FA)
document.getElementById('batmobileBtn').addEventListener('click', async () => {
  const resultEl = document.getElementById('batmobileResult');
  const twofaSection = document.getElementById('twofaSection');

  try {
    const response = await securedFetch('/api/user/secret-batmobile');
    const data = await response.json();

    if (response.ok) {
      resultEl.className = 'alert alert-success';
      resultEl.innerHTML = `<strong>${data.message}</strong><ul>${data.commands.map(c => `<li>${c}</li>`).join('')}</ul>`;
      twofaSection.style.display = 'none';
    } else if (data.code === '2FA_REQUIRED') {
      resultEl.className = 'alert alert-warning';
      resultEl.textContent = data.error;
      twofaSection.style.display = 'block';
    } else {
      resultEl.className = 'alert alert-danger';
      resultEl.textContent = data.error || 'Erreur';
    }
  } catch (err) {
    resultEl.className = 'alert alert-danger';
    resultEl.textContent = 'Erreur de connexion.';
  }
});

// Valider le code 2FA
document.getElementById('verify2faBtn').addEventListener('click', async () => {
  const code = document.getElementById('twofaCode').value;
  const messageEl = document.getElementById('twofaMessage');

  try {
    const response = await securedFetch('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ code })
    });
    const data = await response.json();

    if (response.ok) {
      messageEl.className = 'alert alert-success';
      messageEl.textContent = '✅ 2FA validée ! Vous pouvez réessayer d\'accéder à la Batmobile.';
    } else {
      messageEl.className = 'alert alert-danger';
      messageEl.textContent = '❌ ' + (data.error || 'Code invalide.');
    }
  } catch (err) {
    messageEl.className = 'alert alert-danger';
    messageEl.textContent = 'Erreur de connexion.';
  }
});

// Bouton rafraîchir
document.getElementById('refreshBtn').addEventListener('click', async () => {
  const refreshInfo = document.getElementById('refreshInfo');
  refreshInfo.innerHTML = '<p class="text-info">🔄 Tentative de rafraîchissement...</p>';
  await loadProfile();
  refreshInfo.innerHTML = '<p class="text-success">✅ Données rafraîchies. Si le token avait expiré, le refresh automatique a fonctionné !</p>';
});

// Bouton déconnexion
document.getElementById('logoutBtn').addEventListener('click', logout);

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', loadProfile);
