import { getDatabase } from '../database/database.js';
import convertToISO from '../utils/convertToISO.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {Object} ModelUpdateData
 * @property {string} [name] - Model name
 * @property {string} [provider] - Model provider
 * @property {string} [model] - Model type/identifier
 * @property {string} [key] - Model API key
 * @property {boolean} [isActive] - Model active status
 * @property {Object} [config] - Model configuration
 */

const fieldMapping = {
  name: 'name',
  provider: 'provider',
  model: 'model',
  key: 'key',
  isActive: 'is_active',
  config: 'config_json',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
};

/**
 * Model Repository Class
 * Handles all database operations related to AI models
 * @class ModelRepository
 */
class ModelRepository {
  /**
   * Creates an instance of ModelRepository
   * @constructor
   */
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Find a model by its ID
   * @param {string} id - The model ID
   * @returns {Object|null} The model object or null if not found
   * @throws {Error} If the database operation fails
   */
  findById(id) {
    if (!id) return null;

    try {
      const result = this.db.prepare('SELECT * FROM model WHERE id = ?').get(id);
      
      if (!result) return null;

      return {
        ...result,
        config_json: result.config_json ? JSON.parse(result.config_json) : {}
      };
    } catch (err) {
      throw new Error('Failed to find model by ID', { cause: err });
    }
  }

  /**
   * Find models by provider
   * @param {string} provider - The provider name
   * @returns {Array<Object>} Array of model objects
   * @throws {Error} If the database operation fails
   */
  findByProvider(provider) {
    if (!provider) return [];

    try {
      const results = this.db.prepare('SELECT * FROM model WHERE provider = ? ORDER BY name').all(provider);
      
      return results.map(result => ({
        ...result,
        config_json: result.config_json ? JSON.parse(result.config_json) : {}
      }));
    } catch (err) {
      throw new Error('Failed to find models by provider', { cause: err });
    }
  }

  /**
   * Create a new model
   * @param {ModelUpdateData} modelData - The model data
   * @returns {Object|null} The created model object or null if creation failed
   * @throws {Error} If the database operation fails
   */
  create(modelData) {
    if (!modelData || Object.keys(modelData).length === 0) return null;

    const id = uuidv4();
    const now = convertToISO();
    const data = { 
      ...modelData, 
      id, 
      createdAt: now, 
      updatedAt: now,
      isActive: modelData.isActive ?? true
    };
    
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (!fieldMapping[key] && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') continue;
      
      if (key === 'id') fields.id = value;
      else if (key === 'createdAt') fields.created_at = value;
      else if (key === 'updatedAt') fields.updated_at = value;
      else if (fieldMapping[key]) {
        fields[fieldMapping[key]] = key === 'config' ? JSON.stringify(value) : value;
      }
    }

    if (Object.keys(fields).length === 0) return null;

    const columns = Object.keys(fields).join(', ');
    const placeholders = Object.keys(fields).map(() => '?').join(', ');
    const values = Object.values(fields);

    try {
      const result = this.db
        .prepare(`INSERT INTO model (${columns}) VALUES (${placeholders}) RETURNING *`)
        .get(...values);

      if (!result) return null;

      return {
        ...result,
        config_json: result.config_json ? JSON.parse(result.config_json) : {}
      };
    } catch (err) {
      throw new Error('Failed to create model', { cause: err });
    }
  }

  /**
   * Update a model with flexible field updates
   * @param {string} id - The model ID
   * @param {ModelUpdateData} updateData - Data to update
   * @returns {Object|null} The updated model object or null if not found
   * @throws {Error} If the database operation fails
   */
  update(id, updateData) {
    if (!updateData || Object.keys(updateData).length === 0) return null;

    const now = convertToISO();
    const updates = {};

    for (const [key, value] of Object.entries(updateData)) {
      if (!fieldMapping[key]) continue;
      updates[fieldMapping[key]] = key === 'config' ? JSON.stringify(value) : value;
    }

    if (Object.keys(updates).length === 0) return null;

    updates.updated_at = now;

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    try {
      const result = this.db
        .prepare(`UPDATE model SET ${setClause} WHERE id = ? RETURNING *`)
        .get(...values, id);

      if (!result) return null;

      return {
        ...result,
        config_json: result.config_json ? JSON.parse(result.config_json) : {}
      };
    } catch (err) {
      throw new Error('Failed to update model', { cause: err });
    }
  }

  /**
   * Delete a model by ID
   * @param {string} id - The model ID
   * @returns {boolean} True if deletion was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  delete(id) {
    if (!id) return false;

    try {
      const result = this.db.prepare('DELETE FROM model WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (err) {
      throw new Error('Failed to delete model', { cause: err });
    }
  }

  /**
   * Find models with flexible conditions
   * @param {Object} [conditions] - Search conditions using camelCase
   * @param {string} [conditions.provider] - Filter by provider
   * @param {string} [conditions.name] - Filter by name (partial match)
   * @param {boolean} [conditions.isActive] - Filter by active status
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Limit number of results
   * @param {number} [options.offset] - Offset for pagination
   * @param {string} [options.orderBy] - Field to order by (camelCase)
   * @param {string} [options.orderDir] - Order direction ('asc' or 'desc')
   * @returns {Array<Object>} Array of model objects
   * @throws {Error} If the database operation fails
   */
  find(conditions = {}, options = {}) {
    try {
      let query = 'SELECT * FROM model';
      const whereConditions = [];
      const values = [];

      // Build WHERE conditions
      for (const [key, value] of Object.entries(conditions)) {
        if (value === undefined || value === null) continue;
        
        const dbColumn = fieldMapping[key] || key;
        
        // String fields use LIKE for partial matching
        if (key === 'name') {
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
      const orderBy = options.orderBy ? (fieldMapping[options.orderBy] || options.orderBy) : 'name';
      const orderDir = options.orderDir?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
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
      
      return results.map(result => ({
        ...result,
        config_json: result.config_json ? JSON.parse(result.config_json) : {}
      }));
    } catch (err) {
      throw new Error('Failed to find models', { cause: err });
    }
  }

  /**
   * Get all active models
   * @returns {Array<Object>} Array of active model objects
   * @throws {Error} If the database operation fails
   */
  findActive() {
    return this.find({ isActive: true });
  }

  /**
   * Toggle model active status
   * @param {string} id - The model ID
   * @returns {Object|null} The updated model object or null if not found
   * @throws {Error} If the database operation fails
   */
  toggleActive(id) {
    if (!id) return null;

    try {
      const model = this.findById(id);
      if (!model) return null;

      return this.update(id, { isActive: !model.is_active });
    } catch (err) {
      throw new Error('Failed to toggle model active status', { cause: err });
    }
  }
}

// Create singleton instance
const modelRepository = new ModelRepository();

// Export as default
export default modelRepository;
