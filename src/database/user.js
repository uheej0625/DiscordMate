import db from './index.js';

export function getUserById(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function createUser({ userId, username, globalName }) {
  db.prepare(`
    INSERT INTO users (id, discord_id, username, global_name, preferred_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'whitelist', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    userId,
    userId,
    username,
    globalName,
    null
  );
}
