import { getDatabase } from '../database/database.js';
import convertToISO from '../utils/convertToISO.js';
import { USER_ROLE, USER_ACCESS } from '../database/schemas/users.js';

/**
 * @typedef {Object} UserUpdateData
 * @property {string} [userId] - Discord user ID
 * @property {string} [username] - Discord username
 * @property {string} [globalName] - Discord global name
 * @property {string} [preferredName] - User's preferred name
 * @property {string} [role] - User role (USER_ROLE enum)
 * @property {string} [access] - User access level (USER_ACCESS enum)
 */

const fieldMapping = {
  userId: 'id',
  username: 'username',
  globalName: 'global_name',
  preferredName: 'preferred_name',
  role: 'role',
  access: 'access',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
};

/**
 * User Repository Class
 * Handles all database operations related to users
 * @class UserRepository
 */
class UserRepository {
  /**
   * Creates an instance of UserRepository
   * @constructor
   */
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Find a user by its ID
   * @param {string} id - The user ID
   * @returns {Object|null} The user object or null if not found
   * @throws {Error} If the database operation fails
   */
  findById(id) {
    if (!id) return null;

    try {
      const result = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      return result || null;
    } catch (err) {
      throw new Error('Failed to find user by ID', { cause: err });
    }
  }

  /**
   * Find a user by username
   * @param {string} username - The username
   * @returns {Object|null} The user object or null if not found
   * @throws {Error} If the database operation fails
   */
  findByUsername(username) {
    if (!username) return null;

    try {
      const result = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      return result || null;
    } catch (err) {
      throw new Error('Failed to find user by username', { cause: err });
    }
  }

  /**
   * Create a new user
   * @param {UserUpdateData} userData - The user data
   * @returns {Object|null} The created user object or null if creation failed
   * @throws {Error} If the database operation fails
   */
  create(userData) {
    if (!userData || Object.keys(userData).length === 0) return null;

    const now = convertToISO();
    const data = { 
      ...userData, 
      createdAt: now, 
      updatedAt: now,
      role: userData.role || USER_ROLE.USER,
      access: userData.access || USER_ACCESS.DEFAULT
    };
    
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (!fieldMapping[key] && key !== 'createdAt' && key !== 'updatedAt') continue;
      
      if (key === 'createdAt') fields.created_at = value;
      else if (key === 'updatedAt') fields.updated_at = value;
      else if (fieldMapping[key]) {
        fields[fieldMapping[key]] = value;
      }
    }

    if (Object.keys(fields).length === 0) return null;

    const columns = Object.keys(fields).join(', ');
    const placeholders = Object.keys(fields).map(() => '?').join(', ');
    const values = Object.values(fields);

    try {
      const result = this.db
        .prepare(`INSERT INTO users (${columns}) VALUES (${placeholders}) RETURNING *`)
        .get(...values);

      return result || null;
    } catch (err) {
      throw new Error('Failed to create user', { cause: err });
    }
  }

  /**
   * Update a user with flexible field updates
   * @param {string} id - The user ID
   * @param {UserUpdateData} updateData - Data to update
   * @returns {Object|null} The updated user object or null if not found
   * @throws {Error} If the database operation fails
   */
  update(id, updateData) {
    if (!updateData || Object.keys(updateData).length === 0) return null;

    const now = convertToISO();
    const updates = {};

    for (const [key, value] of Object.entries(updateData)) {
      if (!fieldMapping[key]) continue;
      updates[fieldMapping[key]] = value;
    }

    if (Object.keys(updates).length === 0) return null;

    updates.updated_at = now;

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    try {
      const result = this.db
        .prepare(`UPDATE users SET ${setClause} WHERE id = ? RETURNING *`)
        .get(...values, id);

      return result || null;
    } catch (err) {
      throw new Error('Failed to update user', { cause: err });
    }
  }

  /**
   * Delete a user by ID
   * @param {string} id - The user ID
   * @returns {boolean} True if deletion was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  delete(id) {
    if (!id) return false;

    try {
      const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (err) {
      throw new Error('Failed to delete user', { cause: err });
    }
  }

  /**
   * Find users with flexible conditions
   * @param {Object} [conditions] - Search conditions using camelCase
   * @param {string} [conditions.role] - Filter by role
   * @param {string} [conditions.access] - Filter by access level
   * @param {string} [conditions.username] - Filter by username (partial match)
   * @param {string} [conditions.globalName] - Filter by global name (partial match)
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Limit number of results
   * @param {number} [options.offset] - Offset for pagination
   * @param {string} [options.orderBy] - Field to order by (camelCase)
   * @param {string} [options.orderDir] - Order direction ('asc' or 'desc')
   * @returns {Array<Object>} Array of user objects
   * @throws {Error} If the database operation fails
   */
  find(conditions = {}, options = {}) {
    try {
      let query = 'SELECT * FROM users';
      const whereConditions = [];
      const values = [];

      // Build WHERE conditions
      for (const [key, value] of Object.entries(conditions)) {
        if (value === undefined || value === null) continue;
        
        const dbColumn = fieldMapping[key] || key;
        
        // String fields use LIKE for partial matching
        if (['username', 'global_name', 'preferred_name'].includes(dbColumn)) {
          whereConditions.push(`${dbColumn} LIKE ?`);
          values.push(`%${value}%`);
        } else {
          whereConditions.push(`${dbColumn} = ?`);
          values.push(value);
        }
      }

      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }

      // Add ORDER BY
      const orderBy = options.orderBy ? (fieldMapping[options.orderBy] || options.orderBy) : 'created_at';
      const orderDir = options.orderDir?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      query += ` ORDER BY ${orderBy} ${orderDir}`;

      // Add LIMIT and OFFSET
      if (options.limit) {
        query += ' LIMIT ?';
        values.push(options.limit);
      }

      if (options.offset) {
        query += ' OFFSET ?';
        values.push(options.offset);
      }

      const results = this.db.prepare(query).all(...values);
      return results;
    } catch (err) {
      throw new Error('Failed to find users', { cause: err });
    }
  }

  /**
   * Check if user exists
   * @param {string} id - The user ID
   * @returns {boolean} True if user exists, false otherwise
   * @throws {Error} If the database operation fails
   */
  exists(id) {
    if (!id) return false;

    try {
      const result = this.db.prepare('SELECT 1 FROM users WHERE id = ?').get(id);
      return !!result;
    } catch (err) {
      throw new Error('Failed to check if user exists', { cause: err });
    }
  }

  /**
   * Get total user count
   * @returns {number} Total number of users
   * @throws {Error} If the database operation fails
   */
  count() {
    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM users').get();
      return result.count;
    } catch (err) {
      throw new Error('Failed to count users', { cause: err });
    }
  }
}

// Export as default
export default new UserRepository();
