const express = require('express');
const db = require('../db');
const { isAuthenticated } = require('../middleware/authCheck');

const router = express.Router();

// Toutes les routes de ce routeur nécessitent une authentification
router.use(isAuthenticated);

// ============================================================
// GET /bat-computer - Page protégée du Bat-Ordinateur
// ============================================================
router.get('/bat-computer', (req, res) => {
  const gadgets = [
    { name: 'Batarang', desc: 'Arme de jet', icon: 'fa-shuriken' },
    { name: 'Batmobile', desc: 'Véhicule blindé', icon: 'fa-car' },
    { name: 'Batwing', desc: 'Avion furtif', icon: 'fa-plane' },
    { name: 'Grappling Gun', desc: 'Pistolet à grappin', icon: 'fa-hook' },
    { name: 'Batcomputer', desc: 'Ordinateur central', icon: 'fa-desktop' },
    { name: 'Utility Belt', desc: 'Ceinture multifonction', icon: 'fa-tools' },
    { name: 'Smoke Pellets', desc: 'Grenades fumigènes', icon: 'fa-smog' },
    { name: 'Night Vision Goggles', desc: 'Lunettes de vision nocturne', icon: 'fa-moon' }
  ];

  const username = req.session.user.username;

  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bat-Ordinateur</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-dark text-light">
  <div class="container py-5">
    <header class="text-center mb-5">
      <h1>🦇 Bat-Ordinateur</h1>
      <p class="lead">Bienvenue, Justicier ${username}</p>
      <a href="/auth/logout" class="btn btn-outline-danger btn-sm">Déconnexion</a>
      ${req.session.user.role === 'ADMIN' ? '<a href="/admin/audit" class="btn btn-outline-info btn-sm ms-2">Audit</a>' : ''}
    </header>

    <!-- Section Arsenal -->
    <section>
      <h2 class="mb-4">🧰 Arsenal de Batman</h2>
      <div class="row g-4">
        ${gadgets.map(g => `
          <div class="col-md-3 col-sm-6">
            <div class="card bg-secondary text-light h-100">
              <div class="card-body text-center">
                <i class="fas ${g.icon} fa-3x mb-3 text-warning"></i>
                <h5 class="card-title">${g.name}</h5>
                <p class="card-text">${g.desc}</p>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- Section Rapport de mission -->
    <section class="mt-5">
      <h2 class="mb-4">📝 Rapport de mission</h2>
      <form id="reportForm">
        <div class="mb-3">
          <textarea class="form-control" id="reportContent" rows="4" placeholder="Décrivez votre mission..." required></textarea>
        </div>
        <button type="submit" class="btn btn-warning">Envoyer le rapport</button>
      </form>
      <div id="reportMessage" class="mt-3"></div>
    </section>
  </div>

  <script>
    document.getElementById('reportForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const content = document.getElementById('reportContent').value;
      const messageEl = document.getElementById('reportMessage');

      try {
        const response = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
  </script>
</body>
</html>
  `);
});

// ============================================================
// POST /api/reports - Enregistrer un rapport de mission
// ============================================================
router.post('/api/reports', (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Le contenu du rapport est requis.' });
  }

  const stmt = db.prepare('INSERT INTO reports (user_id, content) VALUES (?, ?)');
  const result = stmt.run(req.session.user.id, content.trim());

  return res.status(201).json({ id: result.lastInsertRowid, message: 'Rapport enregistré.' });
});

// ============================================================
// GET /admin/audit - Page d'administration des logs (réservé ADMIN)
// ============================================================
router.get('/admin/audit', (req, res) => {
  // Vérifier le rôle ADMIN
  if (req.session.user.role !== 'ADMIN') {
    return res.status(403).send(`
      <html><body style="background:#111;color:red;text-align:center;padding:50px;">
        <h1>🚫 Accès refusé</h1>
        <p>Seuls les administrateurs peuvent consulter les logs d'audit.</p>
        <a href="/bat-computer" style="color:yellow;">Retour au Bat-Ordinateur</a>
      </body></html>
    `);
  }

  const rows = db.prepare('SELECT * FROM connexions_audit ORDER BY timestamp DESC LIMIT 100').all();

  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audit - Batcave Security</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-dark text-light">
  <div class="container py-5">
    <h1 class="mb-4">📋 Audit des connexions</h1>
    <a href="/bat-computer" class="btn btn-outline-warning mb-3">← Retour au Bat-Ordinateur</a>
    <table class="table table-dark table-striped">
      <thead>
        <tr>
          <th>ID</th>
          <th>Username</th>
          <th>Action</th>
          <th>IP</th>
          <th>User-Agent</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
          <tr>
            <td>${r.id}</td>
            <td>${r.username}</td>
            <td>
              <span class="badge ${r.action === 'LOGIN' ? 'bg-success' : r.action === 'LOGOUT' ? 'bg-secondary' : 'bg-danger'}">
                ${r.action}
              </span>
            </td>
            <td>${r.ip_address || '-'}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.user_agent || ''}">
              ${r.user_agent ? r.user_agent.substring(0, 50) + '...' : '-'}
            </td>
            <td>${r.timestamp || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>
  `);
});

module.exports = router;
