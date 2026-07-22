# 🦇 Batcave Security - TP2 : Le système de badges

Système d'authentification par session (cookie signé) avec Express, SQLite et Bcrypt pour sécuriser l'accès au Bat-Ordinateur.

## 📦 Installation

```bash
cd batcave-security
npm install
```

## 🚀 Lancement

```bash
npm start
```

Le serveur démarre sur `http://localhost:3000`.

## 📂 Structure du projet

```
batcave-security/
├── server.js                    # Point d'entrée (imports, config sessions, routes principales)
├── db.js                        # Module de connexion SQLite + création des tables
├── package.json                 # Configuration du projet
├── .env                         # Variables d'environnement (PORT, SESSION_SECRET)
├── routes/
│   └── auth.js                  # Routeur d'authentification (/auth/login, /auth/logout)
├── middleware/
│   ├── authCheck.js             # Middleware isAuthenticated + fingerprintCheck
│   └── sqliteSessionStore.js    # Session Store persistant SQLite (bonus 1)
├── public/
│   ├── register.html            # Page d'inscription
│   └── register.js              # Script d'inscription
└── README.md                    # Ce fichier
```

## 🗄️ Tables SQLite

### Table `users`
```sql
CREATE TABLE IF NOT EXISTS users (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role     TEXT NOT NULL DEFAULT 'USER'
);
```

### Table `sessions` (bonus 1 - persistance)
```sql
CREATE TABLE IF NOT EXISTS sessions (
  sid        TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  expired_at DATETIME NOT NULL
);
```

### Table `connexions_audit` (bonus 3 - audit)
```sql
CREATE TABLE IF NOT EXISTS connexions_audit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL,
  action     TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🛣️ Routes

| Méthode | Route            | Auth Required | Description                            |
|---------|------------------|---------------|----------------------------------------|
| GET     | `/auth/login`    | Non           | Formulaire de connexion                |
| POST    | `/auth/login`    | Non           | Traitement de la connexion avec session|
| GET     | `/auth/logout`   | Oui           | Déconnexion + destruction session      |
| GET     | `/bat-computer`  | Oui           | Page protégée du Bat-Ordinateur        |
| POST    | `/register`      | Non           | Inscription d'un nouvel utilisateur    |
| POST    | `/api/reports`   | Oui           | Enregistrer un rapport de mission      |
| GET     | `/admin/audit`   | ADMIN seul    | Tableau des logs de connexion (bonus 3)|

## 🔐 Cycle de vie de la session

1. **GET /auth/login** → Affiche un formulaire HTML (username + password).
2. **POST /auth/login** → Vérifie les identifiants en base (bcrypt), régénère la session (`req.session.regenerate`), stocke `req.session.user = { username, id, role }`, sauvegarde et redirige vers `/bat-computer`.
3. **GET /bat-computer** → Protégée par le middleware `isAuthenticated()`. Si pas de session → redirection 401 vers `/auth/login`.
4. **GET /auth/logout** → Enregistre l'événement dans l'audit, détruit la session, efface le cookie, redirige vers `/auth/login`.

## ⚙️ Configuration des sessions

```javascript
name: 'bat identity'       // Cookie renommé pour masquer express-session
httpOnly: true              // Inaccessible via JavaScript côté client
sameSite: 'strict'          // Anti-CSRF
maxAge: 1800000             // 30 minutes d'inactivité avant déconnexion
```

## 🎯 Fonctionnalités Bonus

### Bonus 1 : Sessions persistantes (SQLite)
- Les sessions sont stockées dans la table SQLite `sessions`.
- Un redémarrage du serveur (Ctrl+C puis `npm start`) ne perd pas la session active.
- Implémentation : `middleware/sqliteSessionStore.js` implémente les méthodes `get`, `set`, `destroy`, `touch` de l'interface `express-session`.

### Bonus 2 : Sécurité par empreinte (Fingerprinting)
- Au login, l'IP (`req.ip`) et le User-Agent sont stockés dans `req.session`.
- Le middleware `fingerprintCheck` compare ces valeurs à chaque requête sur les routes protégées.
- En cas de non-correspondance → session détruite, événement `FRAUD` enregistré dans l'audit, page d'alerte affichée.

### Bonus 3 : Audit de connexion
- Table `connexions_audit` avec les colonnes : id, username, action (LOGIN/LOGOUT/FRAUD), ip_address, user_agent, timestamp.
- Route `GET /admin/audit` (réservée aux ADMIN) : affiche un tableau Bootstrap des 100 derniers événements.

## ✅ Parcours de test

1. Accédez à `http://localhost:3000/register` → créez un compte (le premier est ADMIN).
2. Accédez à `http://localhost:3000/auth/login` → connectez-vous.
3. Vous êtes redirigé vers `/bat-computer` avec message personnalisé.
4. Cliquez sur "Déconnexion" → session détruite.
5. Pour tester le bonus 1 : connectez-vous, coupez le serveur (Ctrl+C), relancez (`npm start`), rafraîchissez `/bat-computer` → toujours connecté.
6. Pour tester l'audit : connectez-vous en tant qu'ADMIN, accédez à `/admin/audit`.
