# 🦇 Batcave Security - TP1

Système d'authentification Basic Auth sécurisé par Bcrypt et stocké en SQLite pour gérer l'accès au Bat-Ordinateur.

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
├── server.js              # Serveur Express principal
├── package.json           # Configuration du projet
├── database.db            # Base de données SQLite (créée au démarrage)
├── public/
│   ├── register.html      # Page d'inscription
│   ├── register.js        # Script d'inscription
│   └── bat-computer.js    # Script de la page protégée
├── private/
│   └── bat-computer.html  # Page protégée du Bat-Ordinateur
└── README.md              # Ce fichier
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

### Table `reports`
```sql
CREATE TABLE IF NOT EXISTS reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  content    TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Table `logs` (bonus)
```sql
CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL,
  route      TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🛣️ Routes

| Méthode | Route              | Auth Required | Description                          |
|---------|--------------------|---------------|--------------------------------------|
| POST    | `/register`        | Non           | Inscription d'un nouvel utilisateur  |
| GET     | `/bat-computer`    | Oui           | Page protégée du Bat-Ordinateur      |
| GET     | `/api/secrets`     | Oui           | Liste des gadgets de Batman (JSON)   |
| GET     | `/api/me`          | Oui           | Infos de l'utilisateur connecté (JSON) |
| POST    | `/api/reports`     | Oui           | Enregistrer un rapport de mission    |
| POST    | `/logout`          | Non           | Déconnexion (invalidation côté client) |

## ✅ Validation du TP

### 1. Via un navigateur web
1. Accédez à `http://localhost:3000/register` pour créer un compte (le premier utilisateur est automatiquement ADMIN).
2. Accédez à `http://localhost:3000/bat-computer` - la boîte de dialogue Basic Auth native du navigateur apparaît.
3. Saisissez vos identifiants pour accéder à la page protégée.

### 2. Via Postman
1. Méthode : `GET`
2. URL : `http://localhost:3000/api/secrets`
3. Onglet **Authorization** → Type: **Basic Auth** → Entrez username et password.
4. Envoyez la requête.

### 3. Via cURL
```bash
curl -u "votre_pseudo:votre_pass" http://localhost:3000/api/secrets
```

## ⚠️ Contraintes d'inscription

- Le mot de passe doit contenir **au moins 8 caractères**.
- Le nom d'utilisateur ne doit pas contenir d'espaces.
- Les noms d'utilisateur sont uniques (retourne **409 Conflict** en cas de doublon).

## 🎯 Fonctionnalités Bonus

### Rôle ADMIN
- La table `users` contient une colonne `role` (par défaut `'USER'`).
- Seuls les utilisateurs avec le rôle `'ADMIN'` peuvent accéder aux routes protégées.
- **Le premier utilisateur inscrit est automatiquement ADMIN** pour permettre les tests.
- Les utilisateurs suivants reçoivent le rôle `'USER'` et obtiennent une erreur **403 Forbidden**.

### Logs d'accès
- Chaque accès à une route protégée est enregistré dans la table `logs` avec le nom d'utilisateur, la route et un horodatage.
- Vérifiable avec l'extension VS Code SQLite Viewer.

### Blocage après 3 échecs
- 3 erreurs de mot de passe consécutives → blocage **30 secondes**.
- Retourne un code **429 Too Many Requests** pendant le blocage.
- Compteur en mémoire (non persistant).

### Route /logout
- `POST /logout` : informe l'utilisateur qu'il doit effacer ses identifiants du gestionnaire de mots de passe (Basic Auth = pas de session).
