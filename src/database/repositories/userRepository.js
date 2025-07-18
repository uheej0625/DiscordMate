import convertToISO from '../../utils/convertToISO.js';
import { USER_ROLE, USER_ACCESS } from '../schemas/users.js';

/**
 * User repository for database operations
 */
class UserRepository {
  /** 
   * Creates an instance of UserRepository.
   * @param {import("better-sqlite3").Database} database - Database instance  
  */
  constructor(database) {
    this.db = database;
  }
  /**
   * Find a user from the database by userId.
   * @param {string} userId - Discord user ID
   */
  findById(userId) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  }

  /**
   * Find user by username
   * @param {string} username - Discord username
   * @returns {object|null} User object or null if not found
   */
  findByUsername(username) {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  /**
   * Save a user to the database.
   * @param {object} param0
   * @param {string} param0.userId - Discord user ID
   * @param {string} param0.username - Discord username
   * @param {string} param0.globalName - Discord global name
   * @param {string|Date|number} [param0.createdAt] - ISO 8601 string, Date, or ms (optional)
   * @returns {boolean} True if created successfully, false otherwise
   */
  create({ userId, username, globalName, createdAt }) {
    try {
      const now = convertToISO(createdAt);
      const result = this.db.prepare(`
        INSERT INTO users (id, role, access, username, global_name, preferred_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
      `).run(
        userId,
        USER_ROLE.USER,
        USER_ACCESS.DEFAULT,
        username,
        globalName,
        now,
        now
      );
      return result.changes > 0;
    } catch (error) {
      console.error('User creation error:', error);
      return false;
    }
  }

  /**
   * Update user information
   * @param {string} userId - User ID
   * @param {object} updates - Fields to update
   * @returns {boolean} True if updated, false if not found
   */
  update(userId, updates) {
    const fields = Object.keys(updates);
    if (fields.length === 0) return false;
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = [...Object.values(updates), convertToISO(), userId];
    
    const result = this.db.prepare(`
      UPDATE users 
      SET ${setClause}, updated_at = ? 
      WHERE id = ?
    `).run(...values);
    
    return result.changes > 0;
  }
  /**
   * Delete user by ID
   * @param {string} userId - User ID
   * @returns {boolean} True if deleted, false if not found
   */
  delete(userId) {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return result.changes > 0;
  }

  /**
   * Find all users with pagination
   * @param {number} [limit=50] - Maximum number of users to return
   * @param {number} [offset=0] - Number of users to skip
   * @returns {Array} Array of user objects
   */
  findAll(limit = 50, offset = 0) {
    return this.db.prepare(`
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  }
}

export default UserRepository;
