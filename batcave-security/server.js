require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const db = require('./config/db');
const { checkJWT } = require('./middleware/authCheck');

// Import du routeur d'authentification
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration globale
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// ============================================================
// Routes d'authentification (/api/auth/*)
// ============================================================
app.use('/api/auth', authRouter);

// ============================================================
// Routes utilisateur protégées (/api/user/*)
// ============================================================

// GET /api/user/me - Profil utilisateur (authentifié)
app.get('/api/user/me', checkJWT, (req, res) => {
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  return res.json(user);
});

// GET /api/user/secret-batmobile - Route 2FA (Challenge 2)
app.get('/api/user/secret-batmobile', checkJWT, (req, res) => {
  if (!req.user.is2FAVerified) {
    return res.status(403).json({
      error: 'Accès refusé. Double validation requise. Utilisez POST /api/auth/verify-2fa d\'abord.',
      code: '2FA_REQUIRED'
    });
  }
  return res.json({
    message: '🚗 Commandes de la Batmobile déverrouillées.',
    commands: [
      'Activer le mode furtif',
      'Lancer le turbo',
      'Déployer les ailes',
      'Activer le bouclier électromagnétique'
    ]
  });
});

// ============================================================
// Pages frontend
// ============================================================
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ============================================================
// Démarrage du serveur
// ============================================================
app.listen(PORT, () => {
  console.log(`🦇 Serveur Batcave TP3 démarré sur http://localhost:${PORT}`);
  console.log(`   🔑 JWT secret configuré : ${process.env.JWT_SECRET ? '✓' : '✗ (manquant)'}`);
  console.log(`   ⏱️  AccessToken expire après 15 secondes`);
  console.log(`   📅 RefreshToken expire après 7 jours`);
});
