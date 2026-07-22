const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('database.db');
db.pragma('journal_mode = WAL');

// Création de la table users
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

// Création de la table logs (TP1 bonus)
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    username  TEXT NOT NULL,
    route     TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Création de la table de sessions persistantes (TP2 bonus 1)
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid       TEXT PRIMARY KEY,
    data      TEXT NOT NULL,
    expired_at DATETIME NOT NULL
  )
`);

// Création de la table connexions_audit (TP2 bonus 3)
db.exec(`
  CREATE TABLE IF NOT EXISTS connexions_audit (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL,
    action     TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    timestamp  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
