require('dotenv').config();

const express = require('express');
const session = require('express-session');
const SQLiteSessionStore = require('./middleware/sqliteSessionStore');
const { fingerprintCheck } = require('./middleware/authCheck');

// Import des routeurs
const authRouter = require('./routes/auth');
const batcaveRouter = require('./routes/batcave');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// Configuration globale
// ============================================================

// Pour lire les données de formulaire (urlencoded)
app.use(express.urlencoded({ extended: true }));

// Pour lire les données JSON (API)
app.use(express.json());

// Fichiers statiques (public)
app.use(express.static('public'));

// ============================================================
// Configuration des sessions
// ============================================================
app.use(session({
  name: 'bat identity',
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  store: new SQLiteSessionStore(),
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 1800000 // 30 minutes
  }
}));

// ============================================================
// Middleware global : vérification d'empreinte (fingerprint)
// ============================================================
app.use(fingerprintCheck);

// ============================================================
// Routes
// ============================================================
app.use('/auth', authRouter);
app.use('/', batcaveRouter);

// ============================================================
// Démarrage du serveur
// ============================================================
app.listen(PORT, () => {
  console.log(`🦇 Serveur Batcave démarré sur http://localhost:${PORT}`);
  console.log(`   🔑 Session secret configuré : ${process.env.SESSION_SECRET ? '✓' : '✗ (manquant)'}`);
  console.log(`   🗄️  Stockage persistant des sessions : ✓ (SQLite)`);
});
