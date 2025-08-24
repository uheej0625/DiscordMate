import { getDatabase } from '../database/database.js';
import convertToISO from '../utils/convertToISO.js';
import { v4 as uuidv4 } from 'uuid';
import { GENERATION_STATUS } from '../database/schemas/generations.js';

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
    try {
      const generation = this.db.prepare('SELECT * FROM generations WHERE id = ?').get(id);
      if (generation) {
        // Parse JSON fields
        generation.message_ids_json = JSON.parse(generation.message_ids_json);
      }
      return generation || null;
    } catch (error) {
      throw new Error(`Failed to find generation by ID: ${error.message}`);
    }
  }

  /**
   * Find generations by status
   * @param {string} status - The generation status (GENERATION_STATUS enum)
   * @param {number} [limit=50] - Maximum number of generations to return
   * @param {number} [offset=0] - Number of generations to skip
   * @returns {Array<Object>} Array of generation objects
   * @throws {Error} If the database operation fails
   */
  findByStatus(status, limit = 50, offset = 0) {
    try {
      const generations = this.db.prepare(`
        SELECT * FROM generations 
        WHERE status = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `).all(status, limit, offset);
      
      // Parse JSON fields for each generation
      return generations.map(generation => ({
        ...generation,
        message_ids_json: JSON.parse(generation.message_ids_json)
      }));
    } catch (error) {
      throw new Error(`Failed to find generations by status: ${error.message}`);
    }
  }

  /**
   * Find generations by API provider
   * @param {string} apiProvider - The API provider name
   * @param {number} [limit=50] - Maximum number of generations to return
   * @param {number} [offset=0] - Number of generations to skip
   * @returns {Array<Object>} Array of generation objects
   * @throws {Error} If the database operation fails
   */
  findByApiProvider(apiProvider, limit = 50, offset = 0) {
    try {
      const generations = this.db.prepare(`
        SELECT * FROM generations 
        WHERE api_provider = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `).all(apiProvider, limit, offset);
      
      // Parse JSON fields for each generation
      return generations.map(generation => ({
        ...generation,
        message_ids_json: JSON.parse(generation.message_ids_json)
      }));
    } catch (error) {
      throw new Error(`Failed to find generations by API provider: ${error.message}`);
    }
  }

  /**
   * Find generations within a date range
   * @param {string} startDate - Start date in ISO format
   * @param {string} endDate - End date in ISO format
   * @param {number} [limit=100] - Maximum number of generations to return
   * @param {number} [offset=0] - Number of generations to skip
   * @returns {Array<Object>} Array of generation objects
   * @throws {Error} If the database operation fails
   */
  findByDateRange(startDate, endDate, limit = 100, offset = 0) {
    try {
      const generations = this.db.prepare(`
        SELECT * FROM generations 
        WHERE started_at >= ? AND started_at <= ?
        ORDER BY started_at DESC 
        LIMIT ? OFFSET ?
      `).all(startDate, endDate, limit, offset);
      
      // Parse JSON fields for each generation
      return generations.map(generation => ({
        ...generation,
        message_ids_json: JSON.parse(generation.message_ids_json)
      }));
    } catch (error) {
      throw new Error(`Failed to find generations by date range: ${error.message}`);
    }
  }

  /**
   * Create a new generation record
   * @param {Object} generationData - The generation data
   * @param {Array<string>} generationData.messageIds - Array of Discord message IDs
   * @param {string} [generationData.userInput] - User input that triggered the generation
   * @param {string} [generationData.apiProvider] - API provider name
   * @param {string} [generationData.apiRequest] - API request data
   * @returns {Object|null} The created generation object or null if creation failed
   * @throws {Error} If the database operation fails
   */
  create(generationData) {
    try {
      const id = uuidv4();
      const {
        messageIds,
        userInput = null,
        status,
        startedAt
      } = generationData;

      const messageIdsJson = JSON.stringify(messageIds);

      const result = this.db.prepare(`
        INSERT INTO generations (
          id, status, message_ids_json, user_input, started_at
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        id,
        status,
        messageIdsJson,
        userInput,
        startedAt
      );

      return result.changes > 0 ? this.findById(id) : null;
    } catch (error) {
      throw new Error(`Failed to create generation: ${error.message}`);
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
   * Update a generation with AI output and thinking
   * @param {string} id - The generation ID
   * @param {Object} aiData - AI response data
   * @param {string} [aiData.aiOutput] - AI generated output
   * @param {string} [aiData.aiThinking] - AI thinking process
   * @param {string} [aiData.apiResponse] - API response data
   * @returns {boolean} True if update was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  updateAiData(id, aiData) {
    try {
      const now = convertToISO();
      const {
        aiOutput = null,
        aiThinking = null,
        finishedAt = new Date().toISOString(),
        apiProvider = null,
        apiRequest = null,
        apiResponse = null
      } = aiData;

      const result = this.db.prepare(`
        UPDATE generations 
        SET ai_output = ?, ai_thinking = ?, finished_at = ?, 
        api_provider = ?, api_request = ?, api_response = ?, updated_at = ?
        WHERE id = ?
      `).run(
        aiOutput,
        aiThinking,
        finishedAt,
        apiProvider,
        apiRequest,
        apiResponse,
        now,
        id
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to update generation AI data: ${error.message}`);
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
        SET error = ?, status = ?, finished_at = ?, updated_at = ?
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
    try {
      const result = this.db.prepare('DELETE FROM generations WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete generation: ${error.message}`);
    }
  }

  /**
   * Get total count of generations
   * @returns {number} The total count of generations
   * @throws {Error} If the database operation fails
   */
  count() {
    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM generations').get();
      return result.count;
    } catch (error) {
      throw new Error(`Failed to count generations: ${error.message}`);
    }
  }

  /**
   * Get count of generations by status
   * @param {string} status - The generation status
   * @returns {number} The count of generations with the specified status
   * @throws {Error} If the database operation fails
   */
  countByStatus(status) {
    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM generations WHERE status = ?').get(status);
      return result.count;
    } catch (error) {
      throw new Error(`Failed to count generations by status: ${error.message}`);
    }
  }

  /**
   * Find all generations with pagination
   * @param {number} [limit=50] - Maximum number of generations to return
   * @param {number} [offset=0] - Number of generations to skip
   * @returns {Array<Object>} Array of generation objects
   * @throws {Error} If the database operation fails
   */
  findAll(limit = 50, offset = 0) {
    try {
      const generations = this.db.prepare(`
        SELECT * FROM generations 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `).all(limit, offset);
      
      // Parse JSON fields for each generation
      return generations.map(generation => ({
        ...generation,
        message_ids_json: JSON.parse(generation.message_ids_json)
      }));
    } catch (error) {
      throw new Error(`Failed to find all generations: ${error.message}`);
    }
  }

  /**
   * Find pending generations (for processing queue)
   * @param {number} [limit=10] - Maximum number of pending generations to return
   * @returns {Array<Object>} Array of pending generation objects
   * @throws {Error} If the database operation fails
   */
  findPending(limit = 10) {
    try {
      const generations = this.db.prepare(`
        SELECT * FROM generations 
        WHERE status = ? 
        ORDER BY created_at ASC 
        LIMIT ?
      `).all(GENERATION_STATUS.PENDING, limit);
      
      // Parse JSON fields for each generation
      return generations.map(generation => ({
        ...generation,
        message_ids_json: JSON.parse(generation.message_ids_json)
      }));
    } catch (error) {
      throw new Error(`Failed to find pending generations: ${error.message}`);
    }
  }

  /**
   * Find processing generations (currently being processed)
   * @returns {Array<Object>} Array of processing generation objects
   * @throws {Error} If the database operation fails
   */
  findProcessing() {
    try {
      const generations = this.db.prepare(`
        SELECT * FROM generations 
        WHERE status = ? 
        ORDER BY started_at ASC
      `).all(GENERATION_STATUS.PROCESSING);
      
      // Parse JSON fields for each generation
      return generations.map(generation => ({
        ...generation,
        message_ids_json: JSON.parse(generation.message_ids_json)
      }));
    } catch (error) {
      throw new Error(`Failed to find processing generations: ${error.message}`);
    }
  }

  /**
   * Cancel a generation (set status to CANCELED)
   * @param {string} id - The generation ID
   * @returns {boolean} True if cancellation was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  cancel(id) {
    try {
      return this.updateStatus(id, GENERATION_STATUS.CANCELED);
    } catch (error) {
      throw new Error(`Failed to cancel generation: ${error.message}`);
    }
  }

  /**
   * Mark generation as processing
   * @param {string} id - The generation ID
   * @returns {boolean} True if update was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  markAsProcessing(id) {
    try {
      return this.updateStatus(id, GENERATION_STATUS.PROCESSING);
    } catch (error) {
      throw new Error(`Failed to mark generation as processing: ${error.message}`);
    }
  }

  /**
   * Mark generation as successful
   * @param {string} id - The generation ID
   * @returns {boolean} True if update was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  markAsSuccess(id) {
    try {
      return this.updateStatus(id, GENERATION_STATUS.SUCCESS);
    } catch (error) {
      throw new Error(`Failed to mark generation as success: ${error.message}`);
    }
  }

  /**
   * Get generation statistics
   * @returns {Object} Statistics object with counts by status
   * @throws {Error} If the database operation fails
   */
  getStatistics() {
    try {
      const stats = {};
      
      // Get counts for each status
      Object.values(GENERATION_STATUS).forEach(status => {
        stats[status.toLowerCase()] = this.countByStatus(status);
      });
      
      stats.total = this.count();
      
      return stats;
    } catch (error) {
      throw new Error(`Failed to get generation statistics: ${error.message}`);
    }
  }
}

// Create singleton instance
const generationRepository = new GenerationRepository();

// Export as default
export default generationRepository;
