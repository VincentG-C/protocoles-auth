const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../config/db');
const { checkJWT } = require('../middleware/authCheck');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const ACCESS_TOKEN_EXPIRY = '15s';
const REFRESH_TOKEN_DAYS = 7;

// ============================================================
// Helpers
// ============================================================

function generateAccessToken(user, is2FAVerified) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      is2FAVerified: is2FAVerified || false
    },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function setTokenCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    maxAge: 15000
  });

  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
  }
}

function clearAuthCookies(res) {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
}

// ============================================================
// POST /api/auth/register - Inscription
// ============================================================
router.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Le nom d\'utilisateur est requis.' });
  }

  const trimmedUsername = username.trim();
  if (trimmedUsername.includes(' ')) {
    return res.status(400).json({ error: 'Le nom d\'utilisateur ne doit pas contenir d\'espaces.' });
  }

  if (!password) {
    return res.status(400).json({ error: 'Le mot de passe est requis.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

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
    console.error('Erreur inscription :', err);
    return res.status(500).json({ error: 'Erreur interne.' });
  }
});

// ============================================================
// POST /api/auth/login - Connexion
// ============================================================
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Identifiants requis.' });
  }

  const row = db.prepare('SELECT id, username, password, role FROM users WHERE username = ?').get(username.trim());

  if (!row) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  const match = bcrypt.compareSync(password, row.password);
  if (!match) {
    return res.status(401).json({ error: 'Identifiants incorrects.' });
  }

  const accessToken = generateAccessToken(row, false);
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    row.id, refreshToken, expiresAt
  );

  setTokenCookies(res, accessToken, refreshToken);

  return res.json({
    message: 'Connexion réussie.',
    user: { id: row.id, username: row.username, role: row.role }
  });
});

// ============================================================
// POST /api/auth/refresh - Rafraîchir l'accessToken
// ============================================================
router.post('/refresh', (req, res) => {
  const refreshToken = req.cookies && req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token manquant.' });
  }

  const row = db.prepare(
    'SELECT rt.*, u.username, u.role FROM refresh_tokens rt JOIN users u ON rt.user_id = u.id WHERE rt.token = ?'
  ).get(refreshToken);

  if (!row) {
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Refresh token invalide.' });
  }

  if (new Date(row.expires_at) < new Date()) {
    db.prepare('DELETE FROM refresh_tokens WHERE id = ?').run(row.id);
    clearAuthCookies(res);
    return res.status(401).json({ error: 'Refresh token expiré.' });
  }

  // Challenge 1 : ROTATION
  if (row.used === 1) {
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(row.user_id);
    clearAuthCookies(res);
    return res.status(401).json({
      error: 'Rotation compromise. Tous les jetons de cet utilisateur ont été révoqués.'
    });
  }

  db.prepare('UPDATE refresh_tokens SET used = 1 WHERE id = ?').run(row.id);

  const newRefreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(
    row.user_id, newRefreshToken, expiresAt
  );

  const user = { id: row.user_id, username: row.username, role: row.role };
  const accessToken = generateAccessToken(user, false);

  setTokenCookies(res, accessToken, newRefreshToken);

  return res.json({ message: 'Token rafraîchi avec succès.' });
});

// ============================================================
// POST /api/auth/logout - Déconnexion
// ============================================================
router.post('/logout', (req, res) => {
  const refreshToken = req.cookies && req.cookies.refreshToken;

  if (refreshToken) {
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken);
  }

  clearAuthCookies(res);
  return res.json({ message: 'Déconnexion réussie.' });
});

// ============================================================
// POST /api/auth/change-password - Changer mot de passe
// ============================================================
router.post('/change-password', checkJWT, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Ancien et nouveau mot de passe requis.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }

  const match = bcrypt.compareSync(oldPassword, user.password);
  if (!match) {
    return res.status(403).json({ error: 'Ancien mot de passe incorrect.' });
  }

  // Validation ANSSI côté serveur uniquement
  const regexANSSI = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/;
  if (!regexANSSI.test(newPassword)) {
    return res.status(400).json({
      error: 'Le nouveau mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.'
    });
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(newPassword, salt);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

  return res.json({ message: 'Mot de passe modifié avec succès.' });
});

// ============================================================
// Challenge 2 : POST /api/auth/verify-2fa
// ============================================================
router.post('/verify-2fa', checkJWT, (req, res) => {
  const { code } = req.body;

  if (code !== '123456') {
    return res.status(403).json({ error: 'Code de validation incorrect.' });
  }

  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(req.user.id);
  const accessToken = generateAccessToken(user, true);

  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: false,
    maxAge: 15000
  });

  return res.json({ message: 'Validation 2FA réussie. Accès à la Batmobile autorisé.' });
});

module.exports = router;
