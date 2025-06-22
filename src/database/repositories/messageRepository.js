import { randomUUID } from 'crypto';
import convertToISO from '../../utils/convertToISO.js';

/**
 * Message repository for database operations
 */
class MessageRepository {
  /** 
   * Creates an instance of MessageRepository.
   * @param {import("better-sqlite3").Database} database - Database instance  
  */
  constructor(database) {
    this.db = database;
  }
  /**
   * Save a message to the database.
   * @param {object} param0
   * @param {string} param0.discordId - Discord message ID
   * @param {string} param0.userId - Discord user ID
   * @param {string} param0.channelId - Discord channel ID
   * @param {string} param0.guildId - Discord guild ID
   * @param {string} param0.content - Message content
   * @param {number|string|Date} [param0.createdAt] - createdTimestamp(ms) or Date/ISO string (optional)
   * @returns {boolean} True if created successfully, false otherwise
   */  create({ discordId, userId, channelId, guildId, content, createdAt }) {
    try {
      if (createdAt) {
        // 특정 시간을 지정한 경우
        const isoTimestamp = convertToISO(createdAt);
        const result = this.db.prepare(`
          INSERT INTO messages (id, discord_id, user_id, channel_id, guild_id, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          discordId,
          userId,
          channelId,
          guildId,
          content,
          isoTimestamp
        );
        return result.changes > 0;
      } else {
        // 기본값(현재 시간) 사용
        const result = this.db.prepare(`
          INSERT INTO messages (id, discord_id, user_id, channel_id, guild_id, content)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          randomUUID(),
          discordId,
          userId,
          channelId,
          guildId,
          content
        );
        return result.changes > 0;
      }
    } catch (error) {
      console.error('Message creation error:', error);
      return false;
    }
  }
  /**
   * Find a message by its ID
   * @param {string} messageId - Message ID
   * @returns {object|null} Message object or null if not found
   */
  findById(messageId) {
    return this.db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
  }

  /**
   * Find a message by Discord ID
   * @param {string} discordId - Discord message ID
   * @returns {object|null} Message object or null if not found
   */
  findByDiscordId(discordId) {
    return this.db.prepare('SELECT * FROM messages WHERE discord_id = ?').get(discordId);
  }

  /**
   * Find messages by user ID
   * @param {string} userId - User ID
   * @param {number} [limit=50] - Maximum number of messages to return
   * @returns {Array} Array of message objects
   */
  findByUserId(userId, limit = 50) {
    return this.db.prepare(`
      SELECT * FROM messages 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit);
  }

  /**
   * Find messages by channel ID
   * @param {string} channelId - Channel ID
   * @param {number} [limit=50] - Maximum number of messages to return
   * @returns {Array} Array of message objects
   */
  findByChannelId(channelId, limit = 50) {
    return this.db.prepare(`
      SELECT * FROM messages 
      WHERE channel_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(channelId, limit);
  }

  /**
   * Delete a message by ID
   * @param {string} messageId - Message ID
   * @returns {boolean} True if deleted, false if not found
   */
  delete(messageId) {
    const result = this.db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
    return result.changes > 0;
  }

  /**
   * Update a message by ID
   * @param {string} messageId - Message ID
   * @param {object} updates - Fields to update
   * @returns {boolean} True if updated, false if not found
   */
  update(messageId, updates) {
    try {
      const fields = Object.keys(updates);
      if (fields.length === 0) return false;
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = [...Object.values(updates), messageId];
      
      const result = this.db.prepare(`
        UPDATE messages 
        SET ${setClause}
        WHERE id = ?
      `).run(...values);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Message update error:', error);
      return false;
    }
  }

  /**
   * Update a message by Discord ID
   * @param {string} discordId - Discord message ID
   * @param {object} updates - Fields to update
   * @returns {boolean} True if updated, false if not found
   */
  updateByDiscordId(discordId, updates) {
    try {
      const fields = Object.keys(updates);
      if (fields.length === 0) return false;
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = [...Object.values(updates), discordId];
      
      const result = this.db.prepare(`
        UPDATE messages 
        SET ${setClause}
        WHERE discord_id = ?
      `).run(...values);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Message update by Discord ID error:', error);
      return false;
    }
  }
}

export default MessageRepository;