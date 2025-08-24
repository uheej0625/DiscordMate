import { getDatabase } from '../database/database.js';
import convertToISO from '../utils/convertToISO.js';
import { v4 as uuidv4 } from 'uuid';

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
    try {
      return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(id) || null;
    } catch (error) {
      throw new Error(`Failed to find message by ID: ${error.message}`);
    }
  }

  /**
   * Find a message by its Discord message ID
   * @param {string} messageId - The Discord message ID
   * @returns {Object|null} The message object or null if not found
   * @throws {Error} If the database operation fails
   */
  findByMessageId(messageId) {
    try {
      return this.db.prepare('SELECT * FROM messages WHERE message_id = ?').get(messageId) || null;
    } catch (error) {
      throw new Error(`Failed to find message by message ID: ${error.message}`);
    }
  }

  /**
   * Find messages by channel ID with pagination
   * @param {string} channelId - The Discord channel ID
   * @param {number} [limit=50] - Maximum number of messages to return
   * @param {number} [offset=0] - Number of messages to skip
   * @returns {Array<Object>} Array of message objects
   * @throws {Error} If the database operation fails
   */
  findByChannelId(channelId, limit = 50, offset = 0) {
    try {
      return this.db.prepare(`
        SELECT * FROM messages 
        WHERE channel_id = ? AND deleted_at IS NULL
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `).all(channelId, limit, offset);
    } catch (error) {
      throw new Error(`Failed to find messages by channel ID: ${error.message}`);
    }
  }

  /**
   * Find messages by conversation ID
   * @param {string} conversationId - The conversation ID
   * @returns {Array<Object>} Array of message objects ordered by timestamp
   * @throws {Error} If the database operation fails
   */
  findByConversationId(conversationId) {
    try {
      return this.db.prepare(`
        SELECT * FROM messages 
        WHERE conversation_id = ? AND deleted_at IS NULL
        ORDER BY timestamp ASC
      `).all(conversationId);
    } catch (error) {
      throw new Error(`Failed to find messages by conversation ID: ${error.message}`);
    }
  }

  /**
   * Find messages by author ID with pagination
   * @param {string} authorId - The author's user ID
   * @param {number} [limit=50] - Maximum number of messages to return
   * @param {number} [offset=0] - Number of messages to skip
   * @returns {Array<Object>} Array of message objects
   * @throws {Error} If the database operation fails
   */
  findByAuthorId(authorId, limit = 50, offset = 0) {
    try {
      return this.db.prepare(`
        SELECT * FROM messages 
        WHERE author_id = ? AND deleted_at IS NULL
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `).all(authorId, limit, offset);
    } catch (error) {
      throw new Error(`Failed to find messages by author ID: ${error.message}`);
    }
  }

  /**
   * Create a new message
   * @param {Object} messageData - The message data
   * @param {string} messageData.id - Unique message ID
   * @param {string} messageData.messageId - Discord message ID
   * @param {string} messageData.channelId - Discord channel ID
   * @param {string} messageData.authorId - Author's user ID
   * @param {number} messageData.timestamp - Message timestamp
   * @param {string} [messageData.conversationId] - Conversation ID
   * @param {string} [messageData.guildId] - Discord guild ID
   * @param {string} [messageData.content] - Message content
   * @param {Array} [messageData.attachments] - Message attachments
   * @param {string} [messageData.generationId] - AI generation ID
   * @returns {Object|null} The created message object or null if creation failed
   * @throws {Error} If the database operation fails
   */
  create(messageData) {
    try {
      const id = uuidv4();
      const {
        messageId,
        conversationId = null,
        guildId = null,
        channelId,
        authorId,
        content = null,
        attachments = null,
        generationId = null,
        timestamp
      } = messageData;

      const attachmentsJson = attachments ? JSON.stringify(attachments) : null;

      const result = this.db.prepare(`
        INSERT INTO messages (
          id, message_id, conversation_id, guild_id, channel_id, 
          author_id, content, attachments_json, generation_id, 
          timestamp
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        messageId,
        conversationId,
        guildId,
        channelId,
        authorId,
        content,
        attachmentsJson,
        generationId,
        timestamp
      );

      return result.changes > 0 ? this.findById(id) : null;
    } catch (error) {
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  /**
   * Update an existing message
   * @param {string} id - The message ID to update
   * @param {Object} updates - The fields to update
   * @param {string} [updates.content] - New message content
   * @param {Array} [updates.attachments] - New attachments array
   * @returns {Object|null} The updated message object or null if update failed
   * @throws {Error} If the database operation fails
   */
  update(id, updates) {
    try {
      const { content, attachments } = updates;
      const attachmentsJson = attachments ? JSON.stringify(attachments) : null;
      const now = convertToISO();

      const result = this.db.prepare(`
        UPDATE messages 
        SET content = ?, attachments_json = ?, updated_at = ?
        WHERE id = ?
      `).run(
        content,
        attachmentsJson,
        now,
        id
      );

      return result.changes > 0 ? this.findById(id) : null;
    } catch (error) {
      throw new Error(`Failed to update message: ${error.message}`);
    }
  }

  /**
   * Soft delete a message (sets deleted_at timestamp)
   * @param {string} id - The message ID to delete
   * @returns {boolean} True if deletion was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  softDelete(id) {
    try {
      const now = convertToISO();
      const result = this.db.prepare(`
        UPDATE messages 
        SET deleted_at = ?
        WHERE id = ?
      `).run(now, id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to soft delete message: ${error.message}`);
    }
  }

  /**
   * Hard delete a message (permanently removes from database)
   * @param {string} id - The message ID to delete
   * @returns {boolean} True if deletion was successful, false otherwise
   * @throws {Error} If the database operation fails
   */
  hardDelete(id) {
    try {
      const result = this.db.prepare('DELETE FROM messages WHERE id = ?').run(id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to hard delete message: ${error.message}`);
    }
  }

  /**
   * Get total count of non-deleted messages
   * @returns {number} The total count of messages
   * @throws {Error} If the database operation fails
   */
  count() {
    try {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE deleted_at IS NULL').get();
      return result.count;
    } catch (error) {
      throw new Error(`Failed to count messages: ${error.message}`);
    }
  }

  /**
   * Get count of non-deleted messages in a specific channel
   * @param {string} channelId - The Discord channel ID
   * @returns {number} The count of messages in the channel
   * @throws {Error} If the database operation fails
   */
  countByChannel(channelId) {
    try {
      const result = this.db.prepare(`
        SELECT COUNT(*) as count FROM messages 
        WHERE channel_id = ? AND deleted_at IS NULL
      `).get(channelId);
      return result.count;
    } catch (error) {
      throw new Error(`Failed to count messages by channel: ${error.message}`);
    }
  }

  /**
   * Search messages by content with pagination
   * @param {string} query - The search query string
   * @param {number} [limit=50] - Maximum number of messages to return
   * @param {number} [offset=0] - Number of messages to skip
   * @returns {Array<Object>} Array of matching message objects
   * @throws {Error} If the database operation fails
   */
  search(query, limit = 50, offset = 0) {
    try {
      const searchStmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE content LIKE ? AND deleted_at IS NULL
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `);
      
      return searchStmt.all(`%${query}%`, limit, offset);
    } catch (error) {
      throw new Error(`Failed to search messages: ${error.message}`);
    }
  }

  /**
   * Find messages within a specific date range
   * @param {number} startTimestamp - Start timestamp (inclusive)
   * @param {number} endTimestamp - End timestamp (inclusive)
   * @param {number} [limit=100] - Maximum number of messages to return
   * @param {number} [offset=0] - Number of messages to skip
   * @returns {Array<Object>} Array of message objects within the date range
   * @throws {Error} If the database operation fails
   */
  findByDateRange(startTimestamp, endTimestamp, limit = 100, offset = 0) {
    try {
      const dateRangeStmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE timestamp BETWEEN ? AND ? AND deleted_at IS NULL
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `);
      
      return dateRangeStmt.all(startTimestamp, endTimestamp, limit, offset);
    } catch (error) {
      throw new Error(`Failed to find messages by date range: ${error.message}`);
    }
  }

  /**
   * Find messages that have attachments
   * @param {number} [limit=50] - Maximum number of messages to return
   * @param {number} [offset=0] - Number of messages to skip
   * @returns {Array<Object>} Array of message objects with attachments
   * @throws {Error} If the database operation fails
   */
  findWithAttachments(limit = 50, offset = 0) {
    try {
      const attachmentStmt = this.db.prepare(`
        SELECT * FROM messages 
        WHERE attachments_json IS NOT NULL AND deleted_at IS NULL
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `);
      
      return attachmentStmt.all(limit, offset);
    } catch (error) {
      throw new Error(`Failed to find messages with attachments: ${error.message}`);
    }
  }
}

// Create singleton instance
const messageRepository = new MessageRepository();

// Export as default
export default messageRepository;


