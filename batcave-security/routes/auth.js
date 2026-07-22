const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

// ============================================================
// GET /auth/login - Affiche le formulaire de connexion
// ============================================================
router.get('/login', (req, res) => {
  // Afficher l'erreur si elle existe dans la query string
  const error = req.query.error ? `<div class="alert alert-danger mt-3">${req.query.error}</div>` : '';

  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connexion - Batcave Security</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-dark text-light">
  <div class="container min-vh-100 d-flex align-items-center justify-content-center">
    <div class="card bg-secondary p-4" style="width: 100%; max-width: 400px;">
      <h1 class="text-center mb-4">🦇 Connexion</h1>
      <form action="/auth/login" method="POST">
        <div class="mb-3">
          <label for="username" class="form-label">Nom d'utilisateur</label>
          <input type="text" class="form-control" id="username" name="username" required>
        </div>
        <div class="mb-3">
          <label for="password" class="form-label">Mot de passe</label>
          <input type="password" class="form-control" id="password" name="password" required>
        </div>
        <button type="submit" class="btn btn-warning w-100">Se connecter</button>
      </form>
      <p class="mt-3 text-center">
        <a href="/register" class="text-warning">Pas encore de compte ? S'inscrire</a>
      </p>
      ${error}
    </div>
  </div>
</body>
</html>
  `);
});

// ============================================================
// POST /auth/login - Traite la connexion utilisateur
// ============================================================
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.redirect('/auth/login?error=Identifiants requis.');
  }

  // Recherche de l'utilisateur en base
  const row = db.prepare('SELECT id, username, password, role FROM users WHERE username = ?').get(username.trim());

  if (!row) {
    return res.redirect('/auth/login?error=Nom d\'utilisateur ou mot de passe incorrect.');
  }

  // Vérification du mot de passe avec bcrypt
  const match = bcrypt.compareSync(password, row.password);
  if (!match) {
    return res.redirect('/auth/login?error=Nom d\'utilisateur ou mot de passe incorrect.');
  }

  // Régénération de la session (anti fixation de session)
  req.session.regenerate((err) => {
    if (err) {
      console.error('Erreur lors de la régénération de session :', err);
      return res.redirect('/auth/login?error=Erreur interne.');
    }

    // Stocker les informations utilisateur dans la session
    req.session.user = {
      id: row.id,
      username: row.username,
      role: row.role
    };

    // Bonus 2 : Stocker l'empreinte (IP + User-Agent)
    req.session.fingerprintIP = req.ip;
    req.session.fingerprintUA = req.headers['user-agent'] || '';

    // Bonus 3 : Enregistrer la connexion dans l'audit
    const stmt = db.prepare(
      'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
    );
    stmt.run(row.username, 'LOGIN', req.ip, req.headers['user-agent'] || '');

    // Sauvegarder explicitement puis rediriger
    req.session.save((err) => {
      if (err) {
        console.error('Erreur lors de la sauvegarde de session :', err);
        return res.redirect('/auth/login?error=Erreur interne.');
      }
      res.redirect('/bat-computer');
    });
  });
});

// ============================================================
// GET /auth/logout - Déconnexion
// ============================================================
router.get('/logout', (req, res) => {
  const username = req.session.user ? req.session.user.username : 'inconnu';

  // Bonus 3 : Enregistrer la déconnexion dans l'audit
  const stmt = db.prepare(
    'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
  );
  stmt.run(username, 'LOGOUT', req.ip, req.headers['user-agent'] || '');

  // Détruire la session
  req.session.destroy((err) => {
    if (err) {
      console.error('Erreur lors de la destruction de session :', err);
    }
    // Effacer le cookie du navigateur
    res.clearCookie('bat identity');
    res.redirect('/auth/login');
  });
});

// ============================================================
// POST /register - Inscription (route publique)
// ============================================================
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  // Validation : username requis
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Le nom d\'utilisateur est requis.' });
  }

  // Validation : username sans espaces
  const trimmedUsername = username.trim();
  if (trimmedUsername.includes(' ')) {
    return res.status(400).json({ error: 'Le nom d\'utilisateur ne doit pas contenir d\'espaces.' });
  }

  // Validation : password requis
  if (!password) {
    return res.status(400).json({ error: 'Le mot de passe est requis.' });
  }

  // Validation : password 8 caractères minimum
  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  // Hachage du mot de passe avec bcrypt
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  // Insertion en base
  try {
    const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    const role = userCount === 0 ? 'ADMIN' : 'USER';
    const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    const result = stmt.run(trimmedUsername, hashedPassword, role);
    return res.status(201).json({ id: result.lastInsertRowid, username: trimmedUsername, role });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà utilisé.' });
    }
    console.error('Erreur lors de l\'inscription :', err);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

module.exports = router;
