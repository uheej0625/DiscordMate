import { getDatabase } from '../database/database.js';
import convertToISO from '../utils/convertToISO.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * @typedef {Object} MessageUpdateData
 * @property {string} [messageId] - Discord message ID
 * @property {string} [conversationId] - Conversation ID
 * @property {string} [guildId] - Discord guild ID
 * @property {string} [channelId] - Discord channel ID
 * @property {string} [authorId] - Author's user ID
 * @property {string} [content] - Message content
 * @property {Array} [attachments] - Message attachments
 * @property {string} [generationId] - AI generation ID
 * @property {number} [timestamp] - Message timestamp
 * @property {string} [deletedAt] - Deletion timestamp
 */

const fieldMapping = {
  messageId: 'message_id',
  conversationId: 'conversation_id',
  guildId: 'guild_id',
  channelId: 'channel_id',
  authorId: 'author_id',
  content: 'content',
  attachments: 'attachments_json',
  generationId: 'generation_id',
  timestamp: 'timestamp',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at'
};

/**
 * Message Repository Class
 * Handles all database operations related to messages
 * @class MessageRepository
 */
class MessageRepository {
  /**
   * Creates an instance of MessageRepository
   * @constructor
   */
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Find a message by its ID
   * @param {string} id - The message ID
   * @returns {Object|null} The message object or null if not found
   * @throws {Error} If the database operation fails
   */
  findById(id) {
    if (!id) return null;

    try {
      const result = this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
      
      if (!result) return null;

      // Convert snake_case to camelCase for service layer
      return {
        id: result.id,
        messageId: result.message_id,
        conversationId: result.conversation_id,
        guildId: result.guild_id,
        channelId: result.channel_id,
        authorId: result.author_id,
        content: result.content,
        attachments: result.attachments_json ? JSON.parse(result.attachments_json) : [],
        generationId: result.generation_id,
        timestamp: result.timestamp,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        deletedAt: result.deleted_at
      };
    } catch (err) {
      throw new Error('Failed to find message by ID', { cause: err });
    }
  }

  /**
   * Find a message by its Discord message ID
   * @param {string} messageId - The Discord message ID
   * @returns {Object|null} The message object or null if not found
   * @throws {Error} If the database operation fails
   */
  findByMessageId(messageId) {
    if (!messageId) return null;

    try {
      const result = this.db.prepare('SELECT * FROM messages WHERE message_id = ?').get(messageId);
      
      if (!result) return null;

      // Convert snake_case to camelCase for service layer
      return {
        id: result.id,
        messageId: result.message_id,
        conversationId: result.conversation_id,
        guildId: result.guild_id,
        channelId: result.channel_id,
        authorId: result.author_id,
        content: result.content,
        attachments: result.attachments_json ? JSON.parse(result.attachments_json) : [],
        generationId: result.generation_id,
        timestamp: result.timestamp,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        deletedAt: result.deleted_at
      };
    } catch (err) {
      throw new Error('Failed to find message by message ID', { cause: err });
    }
  }

  /**
   * Create a new message
   * @param {MessageUpdateData} messageData - The message data
   * @returns {Object|null} The created message object or null if creation failed
   * @throws {Error} If the database operation fails
   */
  create(messageData) {
    if (!messageData || Object.keys(messageData).length === 0) return null;

    const id = uuidv4();
    const now = convertToISO();
    const data = { ...messageData, id, createdAt: now, updatedAt: now };
    
    const fields = {};
    for (const [key, value] of Object.entries(data)) {
      if (!fieldMapping[key] && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') continue;
      
      if (key === 'id') fields.id = value;
      else if (key === 'createdAt') fields.created_at = value;
      else if (key === 'updatedAt') fields.updated_at = value;
      else if (fieldMapping[key]) {
        fields[fieldMapping[key]] = key === 'attachments' ? JSON.stringify(value) : value;
      }
    }

    if (Object.keys(fields).length === 0) return null;

    const columns = Object.keys(fields).join(', ');
    const placeholders = Object.keys(fields).map(() => '?').join(', ');
    const values = Object.values(fields);

    try {
      const result = this.db
        .prepare(`INSERT INTO messages (${columns}) VALUES (${placeholders}) RETURNING *`)
        .get(...values);

      if (!result) return null;

      return {
        ...result,
        attachments_json: result.attachments_json ? JSON.parse(result.attachments_json) : []
      };
    } catch (err) {
      throw new Error('Failed to create message', { cause: err });
    }
  }

  /**
   * Update a message with flexible field updates
   * @param {string} id - The message ID
   * @param {MessageUpdateData} updateData - Data to update
   * @returns {Object|null} The updated message object or null if not found
   * @throws {Error} If the database operation fails
   */
  update(id, updateData) {
    if (!updateData || Object.keys(updateData).length === 0) return null;

    const now = convertToISO();
    const updates = {};

    for (const [key, value] of Object.entries(updateData)) {
      if (!fieldMapping[key]) continue;
      updates[fieldMapping[key]] = key === 'attachments' ? JSON.stringify(value) : value;
    }

    if (Object.keys(updates).length === 0) return null;

    updates.updated_at = now;

    const setClause = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);

    try {
      const result = this.db
        .prepare(`UPDATE messages SET ${setClause} WHERE id = ? RETURNING *`)
        .get(...values, id);

      if (!result) return null;

      return {
        ...result,
        attachments_json: result.attachments_json ? JSON.parse(result.attachments_json) : []
      };
    } catch (err) {
      throw new Error('Failed to update message', { cause: err });
    }
  }

  /**
   * Delete a message by ID (soft delete)
   * @param {string} id - The message ID
   * @returns {boolean} True if deletion was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  delete(id) {
    if (!id) return false;

    try {
      const now = convertToISO();
      const result = this.db.prepare('UPDATE messages SET deleted_at = ? WHERE id = ?').run(now, id);
      return result.changes > 0;
    } catch (err) {
      throw new Error('Failed to delete message', { cause: err });
    }
  }

  /**
   * Find messages with flexible conditions
   * @param {Object} [conditions] - Search conditions using camelCase
   * @param {string} [conditions.channelId] - Filter by channel ID
   * @param {string} [conditions.authorId] - Filter by author ID
   * @param {string} [conditions.conversationId] - Filter by conversation ID
   * @param {string} [conditions.generationId] - Filter by generation ID
   * @param {string} [conditions.content] - Filter by content (partial match)
   * @param {boolean} [conditions.includeDeleted] - Include deleted messages
   * @param {Object} [options] - Query options
   * @param {number} [options.limit] - Limit number of results
   * @param {number} [options.offset] - Offset for pagination
   * @param {string} [options.orderBy] - Field to order by (camelCase)
   * @param {string} [options.orderDir] - Order direction ('asc' or 'desc')
   * @returns {Array<Object>} Array of message objects
   * @throws {Error} If the database operation fails
   */
  find(conditions = {}, options = {}) {
    try {
      let query = 'SELECT * FROM messages';
      const whereConditions = [];
      const values = [];

      // Default: exclude deleted messages unless specifically requested
      if (!conditions.includeDeleted) {
        whereConditions.push('deleted_at IS NULL');
      }

      // Build WHERE conditions
      for (const [key, value] of Object.entries(conditions)) {
        if (value === undefined || value === null || key === 'includeDeleted') continue;
        
        const dbColumn = fieldMapping[key] || key;
        
        // String fields use LIKE for partial matching
        if (key === 'content') {
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
      const orderBy = options.orderBy ? (fieldMapping[options.orderBy] || options.orderBy) : 'timestamp';
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
      
      // Convert snake_case to camelCase for service layer
      return results.map(result => ({
        id: result.id,
        messageId: result.message_id,
        conversationId: result.conversation_id,
        guildId: result.guild_id,
        channelId: result.channel_id,
        authorId: result.author_id,
        content: result.content,
        attachments: result.attachments_json ? JSON.parse(result.attachments_json) : [],
        generationId: result.generation_id,
        timestamp: result.timestamp,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
        deletedAt: result.deleted_at
      }));
    } catch (err) {
      throw new Error('Failed to find messages', { cause: err });
    }
  }

  /**
   * Hard delete a message by ID
   * @param {string} id - The message ID
   * @returns {boolean} True if deletion was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  hardDelete(id) {
    if (!id) return false;

    try {
      const result = this.db.prepare('DELETE FROM messages WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (err) {
      throw new Error('Failed to hard delete message', { cause: err });
    }
  }
}

// Create singleton instance
const messageRepository = new MessageRepository();

// Export as default
export default messageRepository;


