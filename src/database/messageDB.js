import { randomUUID } from 'crypto';
import convertToISO from '../utils/convertToISO.js';

//todo
//constructor 

/**
 * Message database operations class
 */
class MessageDB {
  /** 
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
   */
  static async create({ discordId, userId, channelId, guildId, content, createdAt }) {
    const isoTimestamp = convertToISO(createdAt);
    
    try {
      db.prepare(`
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
    } catch (error) {
      console.error('Database save error:', error);
    }
  }
}

export default MessageDB;