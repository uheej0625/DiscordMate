import { getDatabase } from '../database/database.js';
import convertToISO from '../utils/convertToISO.js';
import { v4 as uuidv4 } from 'uuid';
import { GENERATION_STATUS } from '../database/schemas/generations.js';

/**
 * @typedef {Object} GenerationUpdateData
 * @property {string} [status] - Generation status
 * @property {string} [aiOutput] - AI generated output
 * @property {string} [aiThinking] - AI thinking process
 * @property {string} [finishedAt] - Finished timestamp
 * @property {string} [startedAt] - Started timestamp
 * @property {string} [apiProvider] - API provider name
 * @property {string} [apiRequest] - API request data
 * @property {string} [apiResponse] - API response data
 * @property {string} [userInput] - User input text
 * @property {string[]} [messageIds] - Related message IDs
 * @property {string} [reasons] - Reasons for status change
 */

const fieldMapping = {
  status: 'status',
  aiOutput: 'ai_output',
  aiThinking: 'ai_thinking',
  finishedAt: 'finished_at',
  startedAt: 'started_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  apiProvider: 'api_provider',
  apiRequest: 'api_request',
  apiResponse: 'api_response',
  userInput: 'user_input',
  messageIds: 'message_ids_json',
  reasons: 'reasons'
};

// Fields that require JSON parsing
const JSON_FIELDS = new Set(['api_request', 'api_response']);

/**
 * Safely parse JSON value, returning default on error
 * @param {string} value - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed value or default
 */
function safeJsonParse(value, defaultValue = null) {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Convert database result from snake_case to camelCase
 * @param {Object} dbResult - Database result object
 * @returns {Object} Converted object with camelCase keys
 */
function toCamelCase(obj) {
  if (!obj) return null;
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    // Handle JSON array fields (e.g., message_ids_json -> messageIds)
    if (key.endsWith('_json')) {
      // Remove _json suffix before converting to camelCase
      const baseKey = key.replace(/_json$/, '');
      const camelKey = baseKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = safeJsonParse(value, []);
    } 
    // Handle JSON object fields (e.g., api_request -> apiRequest)
    else if (JSON_FIELDS.has(key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = safeJsonParse(value, null);
    } 
    // Regular fields
    else {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = value;
    }
  }
  
  return result;
}

/**
 * Generation Repository Class
 * Handles all database operations related to AI generations
 * @class GenerationRepository
 */
class GenerationRepository {
  /**
   * Creates an instance of GenerationRepository
   * @constructor
   */
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Find a generation by its ID
   * @param {string} id - The generation ID
   * @returns {Object|null} The generation object or null if not found
   * @throws {Error} If the database operation fails
   */
  findById(id) {
    if (!id) return null;

    try {
      const result = this.db.prepare('SELECT * FROM generations WHERE id = ?').get(id);
      
      if (!result) return null;

      return toCamelCase(result);
    } catch (err) {
      throw new Error('Failed to find generation by ID', { cause: err });
    }
  }

  /**
   * Create a new generation record
   * @param {GenerationUpdateData} generationData - The generation data
   * @returns {Object|null} The created generation object or null if creation failed
   * @throws {Error} If the database operation fails
   */
  create(generationData) {
    if (!generationData || Object.keys(generationData).length === 0) return null;

    const id = uuidv4();
    const now = convertToISO();
    const data = { ...generationData, id, createdAt: now, updatedAt: now };
    
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (!fieldMapping[key] && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') continue;
      
      if (key === 'id') fields.id = value;
      else if (key === 'createdAt') fields.created_at = value;
      else if (key === 'updatedAt') fields.updated_at = value;
      else if (fieldMapping[key]) {
        fields[fieldMapping[key]] = key === 'messageIds' ? JSON.stringify(value) : value;
      }
    }

    if (Object.keys(fields).length === 0) return null;

    const columns = Object.keys(fields).join(', ');
    const placeholders = Object.keys(fields).map(() => '?').join(', ');
    const values = Object.values(fields);

    try {
      const result = this.db
        .prepare(`INSERT INTO generations (${columns}) VALUES (${placeholders}) RETURNING *`)
        .get(...values);

      if (!result) return null;

      return toCamelCase(result);
    } catch (err) {
      throw new Error('Failed to create generation', { cause: err });
    }
  }

  /**
   * Update a generation's status
   * @param {string} id - The generation ID
   * @param {string} status - New status (GENERATION_STATUS enum)
   * @returns {boolean} True if update was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  updateStatus(id, status) {
    try {
      const now = convertToISO();
      const updates = { status, updated_at: now };
      
      // If status is SUCCESS, FAILED, or CANCELED, set finished_at
      if ([GENERATION_STATUS.SUCCESS, GENERATION_STATUS.FAILED, GENERATION_STATUS.CANCELED].includes(status)) {
        updates.finished_at = now;
      }

      const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);

      const result = this.db.prepare(`
        UPDATE generations 
        SET ${setClause}
        WHERE id = ?
      `).run(...values, id);

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to update generation status: ${error.message}`);
    }
  }

  /**
   * Update a generation with flexible field updates
   * @param {string} id - The generation ID
   * @param {GenerationUpdateData} updateData - Data to update
   * @returns {Object|null} The updated generation object or null if not found
   * @throws {Error} If the database operation fails
   */
  update(id, updateData) {
    if (!updateData || Object.keys(updateData).length === 0) return null; // nothing to update

    const now = convertToISO();
    const updates = {};

    for (const [key, value] of Object.entries(updateData)) {
      if (!fieldMapping[key]) continue;
      
      // Handle different field types that need JSON stringification
      if (key === 'messageIds' || key === 'apiRequest' || key === 'apiResponse') {
        updates[fieldMapping[key]] = JSON.stringify(value);
      } else {
        updates[fieldMapping[key]] = value;
      }
    }

    if (Object.keys(updates).length === 0) return null;

    updates.updated_at = now;

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    try {
      const result = this.db
      .prepare(`UPDATE generations SET ${setClause} WHERE id = ? RETURNING *`)
      .get(...values, id);

      if (!result) return null;

      return toCamelCase(result);
    } catch (err) {
      throw new Error('Failed to update generation', { cause: err });
    }
  }

  /**
   * Cancel a generation
   * @param {string} id - The generation ID
   * @param {string} reason - Reason for cancellation
   * @returns {boolean} True if cancellation was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  cancel(id, reason) {
    try {
      const now = convertToISO();
      const result = this.db.prepare(`
        UPDATE generations
        SET status = ?, finished_at = ?, updated_at = ?, reasons = ?
        WHERE id = ?
      `).run(
        GENERATION_STATUS.CANCELED,
        now,
        now,
        reason,
        id
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to cancel generation: ${error.message}`);
    }
  }

  /**
   * Update a generation with error information
   * @param {string} id - The generation ID
   * @param {string} error - Error message
   * @returns {boolean} True if update was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  updateError(id, error) {
    try {
      const now = convertToISO();
      
      const result = this.db.prepare(`
        UPDATE generations 
        SET reasons = ?, status = ?, finished_at = ?, updated_at = ?
        WHERE id = ?
      `).run(
        error,
        GENERATION_STATUS.FAILED,
        now,
        now,
        id
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to update generation error: ${error.message}`);
    }
  }

  /**
   * Delete a generation by ID
   * @param {string} id - The generation ID
   * @returns {boolean} True if deletion was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  delete(id) {
    if (!id) return false;

    try {
      const result = this.db.prepare('DELETE FROM generations WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (err) {
      throw new Error('Failed to delete generation', { cause: err });
    }
  }

  /**
   * Find a generation that contains the given message ID in its message_ids_json array
   * @param {string} messageId - The message ID to search for
   * @returns {Object|null} The generation object or null if not found
   * @throws {Error} If the database operation fails
   */
  findByMessageId(messageId) {
    if (!messageId) return null;

    try {
      // Use JSON_EXTRACT to check if messageId exists in the message_ids_json array
      const result = this.db.prepare(`
        SELECT * FROM generations 
        WHERE json_extract(message_ids_json, '$') LIKE ?
      `).get(`%"${messageId}"%`);
      
      if (!result) return null;

      return toCamelCase(result);
    } catch (err) {
      throw new Error('Failed to find generation by message ID', { cause: err });
    }
  }

  /**
   * Find generations with flexible conditions
   * @param {Object} [conditions] - Search conditions using camelCase
   * @param {string} [conditions.status] - Filter by status
   * @param {string} [conditions.userInput] - Filter by user input (partial match)
   * @param {string} [conditions.apiProvider] - Filter by API provider
   * @param {string} [conditions.reasons] - Filter by reasons (partial match)
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Limit number of results
   * @param {number} [options.offset] - Offset for pagination
   * @param {string} [options.orderBy] - Field to order by (camelCase)
   * @param {string} [options.orderDir] - Order direction ('asc' or 'desc')
   * @returns {Array<Object>} Array of generation objects
   * @throws {Error} If the database operation fails
   */
  find(conditions = {}, options = {}) {
    try {
      let query = 'SELECT * FROM generations';
      const whereConditions = [];
      const values = [];

      // Build WHERE conditions
      for (const [key, value] of Object.entries(conditions)) {
        if (value === undefined || value === null) continue;
        
        const dbColumn = fieldMapping[key] || key;
        
        // String fields use LIKE for partial matching
        if (['user_input', 'reasons'].includes(dbColumn)) {
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
      
      return results.map(result => toCamelCase(result));
    } catch (err) {
      throw new Error('Failed to find generations', { cause: err });
    }
  }

}

// Create singleton instance
const generationRepository = new GenerationRepository();

// Export as default
export default generationRepository;
