const express = require('express');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

// ============================================================
// 1. Initialisation de la base de données
// ============================================================
const db = new Database('database.db');
db.pragma('journal_mode = WAL');

// Création de la table users (avec colonne role pour le bonus)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role     TEXT NOT NULL DEFAULT 'USER'
  )
`);

// Création de la table reports
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// Création de la table logs (bonus)
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT NOT NULL,
    route     TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// ============================================================
// 2. Initialisation d'Express
// ============================================================
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// ============================================================
// 3. Bonus : Compteur d'échecs en mémoire (rate limiting)
// ============================================================
const failureCounter = {}; // { username: { count: number, blockedUntil: timestamp } }

function getFailureInfo(username) {
  if (!failureCounter[username]) {
    failureCounter[username] = { count: 0, blockedUntil: 0 };
  }
  return failureCounter[username];
}

function checkBlocked(username) {
  const info = getFailureInfo(username);
  if (info.blockedUntil > Date.now()) {
    const remaining = Math.ceil((info.blockedUntil - Date.now()) / 1000);
    return remaining;
  }
  // Si le blocage est expiré, réinitialiser
  if (info.blockedUntil > 0 && info.blockedUntil <= Date.now()) {
    failureCounter[username] = { count: 0, blockedUntil: 0 };
  }
  return 0; // pas bloqué
}

function recordFailure(username) {
  const info = getFailureInfo(username);
  info.count += 1;
  if (info.count >= 3) {
    info.blockedUntil = Date.now() + 30000; // 30 secondes
    info.count = 0;
  }
}

// ============================================================
// 4. Middleware d'authentification Basic Auth
// ============================================================
function basicAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    res.status(401).set('WWW-Authenticate', 'Basic realm="Batcave Security"').end();
    return;
  }

  // Format: "Basic <base64>"
  const base64Credentials = authHeader.split(' ')[1];
  if (!base64Credentials) {
    res.status(401).set('WWW-Authenticate', 'Basic realm="Batcave Security"').end();
    return;
  }

  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  if (!username || !password) {
    res.status(401).set('WWW-Authenticate', 'Basic realm="Batcave Security"').end();
    return;
  }

  // Bonus : Vérifier si l'utilisateur est bloqué (trop de tentatives)
  const blockedRemaining = checkBlocked(username);
  if (blockedRemaining > 0) {
    return res.status(429).json({
      error: `Trop de tentatives échouées. Réessayez dans ${blockedRemaining} secondes.`
    });
  }

  // Recherche en base
  const row = db.prepare('SELECT id, username, password, role FROM users WHERE username = ?').get(username);

  if (!row) {
    recordFailure(username);
    res.status(401).set('WWW-Authenticate', 'Basic realm="Batcave Security"').end();
    return;
  }

  // Vérification du mot de passe avec bcrypt
  const match = bcrypt.compareSync(password, row.password);
  if (!match) {
    recordFailure(username);
    res.status(401).set('WWW-Authenticate', 'Basic realm="Batcave Security"').end();
    return;
  }

  // Réinitialiser le compteur d'échecs en cas de succès
  if (failureCounter[username]) {
    failureCounter[username] = { count: 0, blockedUntil: 0 };
  }

  // Bonus : Vérifier le rôle ADMIN
  if (row.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accès refusé. Seuls les administrateurs peuvent accéder à cette ressource.' });
  }

  // Succès : stocker l'utilisateur dans req.user
  req.user = { id: row.id, username: row.username, role: row.role };

  // Bonus : Enregistrer l'accès dans les logs
  const stmt = db.prepare('INSERT INTO logs (username, route) VALUES (?, ?)');
  stmt.run(req.user.username, req.originalUrl);

  next();
}

// ============================================================
// 5. Routes publiques
// ============================================================

// POST /register - Inscription
app.post('/register', (req, res) => {
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
    // Bonus : Le premier utilisateur inscrit devient ADMIN automatiquement
    const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    const role = userCount === 0 ? 'ADMIN' : 'USER';
    const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    const result = stmt.run(trimmedUsername, hashedPassword, role);
    return res.status(201).json({ id: result.lastInsertRowid, username: trimmedUsername, role });
  } catch (err) {
    // Gestion de la contrainte UNIQUE SQL
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Ce nom d\'utilisateur est déjà utilisé.' });
    }
    console.error('Erreur lors de l\'inscription :', err);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// ============================================================
// 6. Routes protégées (nécessitent Basic Auth)
// ============================================================

// GET /bat-computer - Page protégée
app.get('/bat-computer', basicAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'bat-computer.html'));
});

// GET /api/secrets - Liste des gadgets
app.get('/api/secrets', basicAuth, (req, res) => {
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
  res.json(gadgets);
});

// GET /api/me - Informations de l'utilisateur courant
app.get('/api/me', basicAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.id);
  res.json({ id: user.id, username: user.username, role: user.role });
});

// POST /api/reports - Enregistrer un rapport de mission
app.post('/api/reports', basicAuth, (req, res) => {
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Le contenu du rapport est requis.' });
  }

  const stmt = db.prepare('INSERT INTO reports (user_id, content) VALUES (?, ?)');
  const result = stmt.run(req.user.id, content.trim());

  return res.status(201).json({ id: result.lastInsertRowid, message: 'Rapport enregistré.' });
});

// ============================================================
// 7. Bonus : Route /logout
// ============================================================
app.post('/logout', (req, res) => {
  // En Basic Auth, il n'y a pas de vraie session à détruire.
  // On informe le client qu'il doit oublier ses identifiants.
  res.json({
    message: 'Déconnexion réussie. Pour vous déconnecter complètement, effacez vos identifiants du gestionnaire de mots de passe du navigateur.'
  });
});

// ============================================================
// 8. Démarrage du serveur
// ============================================================
app.listen(PORT, () => {
  console.log(`🦇 Serveur Batcave démarré sur http://localhost:${PORT}`);
});
