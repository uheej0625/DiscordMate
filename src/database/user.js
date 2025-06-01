import db from './index.js';
import convertToISO from '../utils/convertToISO.js';

/**
 * Get a user from the database by userId.
 * @param {string} userId - Discord user ID
 * @returns {object|null} User object or null if not found
 */
export function getUserById(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

/**
 * Save a user to the database.
 * @param {object} param0
 * @param {string} param0.userId - Discord user ID
 * @param {string} param0.username - Discord username
 * @param {string} param0.globalName - Discord global name
 * @param {string|Date|number} [param0.createdAt] - ISO 8601 string, Date, or ms (optional)
 */
export function saveUser({ userId, username, globalName, createdAt }) {
  const now = convertToISO(createdAt);
  db.prepare(`
    INSERT INTO users (id, role, access, username, global_name, preferred_name, created_at, updated_at)
    VALUES (?, 'user', 'default', ?, ?, NULL, ?, ?)
  `).run(
    userId,
    username,
    globalName,
    now,
    now
  );
}