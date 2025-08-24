import { getDatabase } from '../database/database.js';
import convertToISO from '../utils/convertToISO.js';
import { USER_ROLE, USER_ACCESS } from '../database/schemas/users.js';

// 싱글톤 데이터베이스 연결 사용
const db = getDatabase();

/**
 * Find a user from the database by userId
 */
export const getById = (userId) => {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(userId) || null;
  } catch (error) {
    throw new Error(`Failed to find user by ID: ${error.message}`);
  }
};

/**
 * Find user by username
 */
export const getByUsername = (username) => {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username) || null;
  } catch (error) {
    throw new Error(`Failed to find user by username: ${error.message}`);
  }
};

/**
 * Create a new user
 */
export const create = ({ userId, username, globalName, role = USER_ROLE.USER }) => {
  try {
    const now = convertToISO(new Date());
    const stmt = db.prepare(`
      INSERT INTO users (id, role, access, username, global_name, preferred_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
    `);
    
    const result = stmt.run(
      userId,
      role,
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
};

/**
 * Update user information
 */
export const update = (userId, updates) => {
  const fields = Object.keys(updates);
  if (fields.length === 0) return false;

  try {
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = [...Object.values(updates), convertToISO(), userId];

    const stmt = db.prepare(`
      UPDATE users 
      SET ${setClause}, updated_at = ? 
      WHERE id = ?
    `);
    
    const result = stmt.run(...values);
    return result.changes > 0;
  } catch (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }
};

/**
 * Delete user by ID
 */
export const deleteUser = (userId) => {
  try {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?');
    const result = stmt.run(userId);
    return result.changes > 0;
  } catch (error) {
    throw new Error(`Failed to delete user: ${error.message}`);
  }
};

/**
 * Find all users with pagination
 */
export const getAll = (limit = 50, offset = 0) => {
  try {
    const stmt = db.prepare(`
      SELECT * FROM users 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `);
    return stmt.all(limit, offset);
  } catch (error) {
    throw new Error(`Failed to get all users: ${error.message}`);
  }
};

/**
 * Get total user count
 */
export const getCount = () => {
  try {
    const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const result = stmt.get();
    return result.count;
  } catch (error) {
    throw new Error(`Failed to count users: ${error.message}`);
  }
};

/**
 * Check if user exists
 */
export const exists = (userId) => {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = stmt.get(userId);
    return !!user;
  } catch (error) {
    throw new Error(`Failed to check if user exists: ${error.message}`);
  }
};

/**
 * Get users by role
 */
export const getByRole = (role) => {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE role = ? ORDER BY created_at DESC');
    return stmt.all(role);
  } catch (error) {
    throw new Error(`Failed to get users by role: ${error.message}`);
  }
};

/**
 * Get users by access level
 */
export const getByAccess = (access) => {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE access = ? ORDER BY created_at DESC');
    return stmt.all(access);
  } catch (error) {
    throw new Error(`Failed to get users by access: ${error.message}`);
  }
};

/**
 * Update user access level
 */
export const updateAccess = (userId, access) => {
  try {
    const stmt = db.prepare(`
      UPDATE users 
      SET access = ?, updated_at = ? 
      WHERE id = ?
    `);
    
    const result = stmt.run(access, convertToISO(), userId);
    return result.changes > 0;
  } catch (error) {
    throw new Error(`Failed to update user access: ${error.message}`);
  }
};

/**
 * Close database connection
 */
export const close = () => {
  db.close();
};
