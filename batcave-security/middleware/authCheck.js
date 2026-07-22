const jwt = require('jsonwebtoken');

// Middleware : vérifie le JWT (accessToken) dans le cookie ou le header Authorization
function checkJWT(req, res, next) {
  let token = null;

  // 1. Essayer de récupérer le token depuis le cookie (pour les navigateurs)
  if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  // 2. Sinon, essayer depuis le header Authorization: Bearer <token> (Challenge 3)
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Token d\'accès manquant.' });
  }

  // Vérification du JWT
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expiré.', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Token invalide.' });
    }

    // Stocker les informations de l'utilisateur dans req.user
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      is2FAVerified: decoded.is2FAVerified || false
    };

    next();
  });
}

// Middleware : vérifie si l'utilisateur est ADMIN
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'ADMIN') {
    return next();
  }
  return res.status(403).json({ error: 'Accès refusé. Rôle administrateur requis.' });
}

module.exports = { checkJWT, requireAdmin };
