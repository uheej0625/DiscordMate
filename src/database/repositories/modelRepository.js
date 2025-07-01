import { randomUUID } from 'crypto';
import convertToISO from '../../utils/convertToISO.js';

/**
 * Message repository for database operations
 */
class ModelRepository {
  /** 
   * Creates an instance of ModelRepository.
   * @param {import("better-sqlite3").Database} database - Database instance  
  */
  constructor(database) {
    this.db = database;
  }
  /**
   * Save a message to the database.
   * @param {object} param0
   * @param {string} param0.name - Model name
   * @param {string} param0.provider - Model provider
   * @param {string} param0.model - Model type
   * @param {string} param0.key - Model key
   */ 
  create({ name, provider, model, key }) {
    try {
      const result = this.db.prepare(`
        INSERT INTO model (id, name, provider, model, key)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          name,
          provider,
          model,
          key
        );
        return result.changes > 0;
    } catch (error) {
      console.error('Model creation error:', error);
   }
  }
}
export default ModelRepository;