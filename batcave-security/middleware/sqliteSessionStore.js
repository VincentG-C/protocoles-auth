// Session Store persistant pour express-session utilisant SQLite
// TP2 Bonus 1 : Les sessions survivent au redémarrage du serveur
const db = require('../db');

class SQLiteSessionStore {
  async get(sid, callback) {
    try {
      const row = db.prepare('SELECT data, expired_at FROM sessions WHERE sid = ?').get(sid);
      if (!row) {
        return callback(null, null);
      }
      // Vérifier si la session a expiré
      if (new Date(row.expired_at) < new Date()) {
        this.destroy(sid, () => {});
        return callback(null, null);
      }
      try {
        const data = JSON.parse(row.data);
        return callback(null, data);
      } catch (e) {
        return callback(null, null);
      }
    } catch (err) {
      return callback(err);
    }
  }

  set(sid, session, callback) {
    try {
      const maxAge = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 1800000;
      const expiredAt = new Date(Date.now() + maxAge).toISOString();
      const data = JSON.stringify(session);

      db.prepare(
        'INSERT OR REPLACE INTO sessions (sid, data, expired_at) VALUES (?, ?, ?)'
      ).run(sid, data, expiredAt);

      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  touch(sid, session, callback) {
    // Met à jour la date d'expiration
    try {
      const maxAge = session.cookie && session.cookie.maxAge ? session.cookie.maxAge : 1800000;
      const expiredAt = new Date(Date.now() + maxAge).toISOString();
      const data = JSON.stringify(session);

      db.prepare(
        'UPDATE sessions SET data = ?, expired_at = ? WHERE sid = ?'
      ).run(data, expiredAt, sid);

      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }
}

module.exports = SQLiteSessionStore;
