// Middleware : vérifie si l'utilisateur est authentifié via sa session
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  // Non authentifié → redirection vers la page de connexion
  res.status(401);
  res.redirect('/auth/login');
}

// Middleware : vérifie l'empreinte (IP + User-Agent) pour détecter une fraude (TP2 bonus 2)
function fingerprintCheck(req, res, next) {
  if (!req.session || !req.session.user) {
    return next(); // pas de session, rien à vérifier
  }

  const currentIP = req.ip;
  const currentUA = req.headers['user-agent'] || '';

  const sessionIP = req.session.fingerprintIP;
  const sessionUA = req.session.fingerprintUA;

  // Si les empreintes existent en session, on compare
  if (sessionIP && sessionUA) {
    if (sessionIP !== currentIP || sessionUA !== currentUA) {
      // Empreinte différente → fraude suspectée
      const db = require('../db');

      // Enregistrer l'événement de fraude dans l'audit (bonus 3)
      const stmt = db.prepare(
        'INSERT INTO connexions_audit (username, action, ip_address, user_agent) VALUES (?, ?, ?, ?)'
      );
      stmt.run(req.session.user.username, 'FRAUD', currentIP, currentUA);

      // Détruire la session
      req.session.destroy((err) => {
        if (err) console.error('Erreur lors de la destruction de session :', err);
      });

      return res.status(401).send(`
        <html><body style="background:#111;color:red;text-align:center;padding:50px;">
          <h1>🚨 ALERTE DE SÉCURITÉ</h1>
          <p>Votre empreinte numérique a changé. Session détruite pour cause de fraude suspectée.</p>
          <a href="/auth/login" style="color:yellow;">Retour à la connexion</a>
        </body></html>
      `);
    }
  }

  next();
}

module.exports = { isAuthenticated, fingerprintCheck };
