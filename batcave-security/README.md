# 🦇 Batcave Security - TP3 : Le système de jetons

Système d'authentification **stateless JWT** avec accessToken / refreshToken pour sécuriser l'accès au Bat-Ordinateur.

> **Architecture** : Modèle sans session (stateless) — les cookies contiennent les jetons, pas de session en RAM.

---

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

---

## 📂 Structure du projet

```
batcave-security/
├── server.js                    # Point d'entrée (Express, cookie-parser, routes)
├── package.json                 # Configuration npm (start: node --watch server.js)
├── .env                         # Variables d'environnement (PORT, JWT_SECRET)
├── schema-sequence.png          # Schéma de séquence du flux JWT
├── config/
│   └── db.js                    # Connexion SQLite + création des tables
├── middleware/
│   └── authCheck.js             # Middleware checkJWT (cookie + Bearer) + requireAdmin
├── routes/
│   └── auth.js                  # Toutes les routes d'authentification (/api/auth/*)
└── public/
    ├── login.html               # Page de connexion
    ├── login.js                 # Script connexion
    ├── register.html            # Page d'inscription
    ├── register.js              # Script inscription
    ├── dashboard.html           # Tableau de bord protégé
    └── dashboard.js             # Script avec Retry Pattern (refresh automatique)
```

---

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

### Table `refresh_tokens`
```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  token      TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 🛣️ Routes

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/register` | ❌ | Inscription (validation 8 car. min, trim, 409) |
| POST | `/api/auth/login` | ❌ | Connexion → génère accessToken (JWT 15s) + refreshToken (7j) **en cookies** |
| POST | `/api/auth/refresh` | ❌ | Rafraîchit l'accessToken via le refreshToken cookie |
| POST | `/api/auth/logout` | ❌ | Supprime le refreshToken de la BDD + efface les cookies |
| POST | `/api/auth/change-password` | ✅ JWT | Change le mot de passe (validation ANSSI côté serveur) |
| POST | `/api/auth/verify-2fa` | ✅ JWT | Valide le code 2FA et délivre un JWT avec `is2FAVerified: true` |
| GET | `/api/user/me` | ✅ JWT | Profil utilisateur |
| GET | `/api/user/secret-batmobile` | ✅ JWT + 2FA | Commandes Batmobile (accès si is2FAVerified) |

---

## 🔐 Configuration des cookies

| Cookie | Type | httpOnly | sameSite | maxAge |
|--------|------|----------|----------|--------|
| `accessToken` | JWT signé | ✅ | `strict` | 15 secondes |
| `refreshToken` | Chaîne aléatoire (48 bytes hex) | ✅ | `strict` | 7 jours |

---

## 🔄 Retry Pattern (dashboard.js)

La fonction `securedFetch()` encapsule `fetch()` :

1. Envoie la requête normalement
2. Si **401** (token expiré) :
   - Met la requête en pause
   - Appelle `POST /api/auth/refresh` en arrière-plan
   - Le serveur effectue la **rotation** (marque l'ancien token `used=1`, en crée un nouveau)
   - Rejoue la requête initiale automatiquement
3. Si plusieurs requêtes échouent simultanément, une seule est mise en file d'attente
4. Si le refresh échoue → redirection vers `/login`

---

## 🎯 Challenges

### Challenge 1 : Rotation de refreshToken
- À chaque `POST /refresh`, l'ancien token est marqué `used=1` et un **nouveau** refreshToken est généré
- Si un token `used=1` est représenté → **TOUS les refreshTokens de l'utilisateur sont supprimés** (vol détecté)

### Challenge 2 : Double validation (2FA)
- Le JWT initial contient `is2FAVerified: false`
- Route `/api/user/secret-batmobile` vérifie `is2FAVerified === true`
- `POST /api/auth/verify-2fa` avec code `123456` émet un nouveau JWT avec `is2FAVerified: true`

### Challenge 3 : Support du header Authorization (Bearer)
- Le middleware `checkJWT` accepte **deux méthodes** :
  1. Cookie `accessToken` (navigateur)
  2. Header `Authorization: Bearer <token>` (clients comme curl/Postman)

---

## ✅ Validation (DevTools)

1. **Connexion** : `POST /api/auth/login` → les deux cookies `accessToken` et `refreshToken` apparaissent dans Application / Cookies
2. **Attendre 15s** : le cookie `accessToken` disparaît, `refreshToken` reste
3. **Rafraîchir** : cliquer sur "Rafraîchir les données" → le `accessToken` réapparaît (refresh invisible)
4. **Déconnexion** : `POST /api/auth/logout` → les cookies disparaissent, la ligne est supprimée de `refresh_tokens` en BDD

---

## 🧪 Test avec curl

```bash
# 1. Connexion
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"batman","password":"password123"}'

# 2. Récupérer le profil (avec cookies)
curl -b cookies.txt http://localhost:3000/api/user/me

# 3. Récupérer le profil (avec Bearer token - Challenge 3)
JWT="<copier le token depuis le cookie accessToken>"
curl -H "Authorization: Bearer $JWT" http://localhost:3000/api/user/me

# 4. Rafraîchir le token (avec cookies)
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/refresh

# 5. Déconnexion
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/logout
```

---

## 📋 Rappel des consignes de validation

| Étape | Action | Résultat attendu |
|-------|--------|------------------|
| 1 | Connexion | 2 cookies dans DevTools |
| 2 | Attendre 15s | Cookie `accessToken` disparaît, `refreshToken` reste |
| 3 | Action dashboard | Refresh automatique, `accessToken` réapparaît |
| 4 | Déconnexion | Cookies effacés, ligne supprimée en BDD |
