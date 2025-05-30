import db from './index.js';

export function getUserById(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

export function createUser({ userId, username, globalName }) {
  db.prepare(`
    INSERT INTO users (id, role, access, username, global_name, preferred_name, created_at, updated_at)
    VALUES (?, 'user', 'default', ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    userId,
    username,
    globalName
  );
}
