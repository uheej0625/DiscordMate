import { randomUUID } from 'crypto';
import convertToISO from '../utils/convertToISO.js';
import { MESSAGE_STATUS, MESSAGE_ROLE } from '../database/schemas/messages.js';

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
	 * @param {string} param0.discordMessageId - Discord message ID
	 * @param {string} [param0.conversationId] - Conversation ID (optional)
	 * @param {string} param0.turnId - Turn ID (optional)
	 * @param {string} param0.channelId - Discord channel ID
	 * @param {string} [param0.guildId] - Discord guild ID (optional)
	 * @param {string} param0.authorId - Author ID
	 * @param {string} param0.authorRole - Author role (user/assistant)
	 * @param {string} param0.content - Message content
	 * @param {Array} [param0.attachments] - Message attachments (optional)
	 * @param {string} [param0.responseStatus] - Response status (optional)
	 * @param {number|string|Date} [param0.createdAt] - createdTimestamp(ms) or Date/ISO string (optional)
	 * @returns {boolean} True if created successfully, false otherwise
	 */  
	create({ discordMessageId, conversationId, turnId, channelId, guildId, authorId, authorRole, content, attachments, responseStatus, createdAt }) {
		try {
			const attachmentsJson = attachments ? JSON.stringify(attachments) : null;
			const status = responseStatus || MESSAGE_STATUS.PENDING;

			if (createdAt) {
				// 특정 시간을 지정한 경우
				const isoTimestamp = convertToISO(createdAt);
				const result = this.db.prepare(`
					INSERT INTO messages (id, discord_message_id, conversation_id, turn_id, channel_id, guild_id, author_id, author_role, content, attachments_json, response_status, created_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`).run(
					randomUUID(),
					discordMessageId,
					conversationId,
					turnId,
					channelId,
					guildId,
					authorId,
					authorRole,
					content,
					attachmentsJson,
					status,
					isoTimestamp
				);
				return result.changes > 0;
			} else {
				// 기본값(현재 시간) 사용
				const result = this.db.prepare(`
					INSERT INTO messages (id, discord_message_id, conversation_id, turn_id, channel_id, guild_id, author_id, author_role, content, attachments_json, response_status)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`).run(
					randomUUID(),
					discordMessageId,
					conversationId,
					turnId,
					channelId,
					guildId,
					authorId,
					authorRole,
					content,
					attachmentsJson,
					status
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
	 * Find a message by Discord message ID
	 * @param {string} discordMessageId - Discord message ID
	 * @returns {object|null} Message object or null if not found
	 */
	findByDiscordMessageId(discordMessageId) {
		return this.db.prepare('SELECT * FROM messages WHERE discord_message_id = ?').get(discordMessageId);
	}

	/**
	 * Find messages by author ID
	 * @param {string} authorId - Author ID
	 * @param {number} [limit=50] - Maximum number of messages to return
	 * @returns {Array} Array of message objects
	 */
	findByAuthorId(authorId, limit = 50) {
		return this.db.prepare(`
			SELECT * FROM messages 
			WHERE author_id = ? 
			ORDER BY created_at DESC 
			LIMIT ?
		`).all(authorId, limit);
	}

	/**
	 * Find messages by conversation ID
	 * @param {string} conversationId - Conversation ID
	 * @param {number} [limit=50] - Maximum number of messages to return
	 * @returns {Array} Array of message objects
	 */
	findByConversationId(conversationId, limit = 50) {
		return this.db.prepare(`
			SELECT * FROM messages 
			WHERE conversation_id = ? 
			ORDER BY created_at DESC 
			LIMIT ?
		`).all(conversationId, limit);
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
	 * Update a message by Discord message ID
	 * @param {string} discordMessageId - Discord message ID
	 * @param {object} updates - Fields to update
	 * @returns {boolean} True if updated, false if not found
	 */
	updateByDiscordMessageId(discordMessageId, updates) {
		try {
			const fields = Object.keys(updates);
			if (fields.length === 0) return false;
      
			const setClause = fields.map(field => `${field} = ?`).join(', ');
			const values = [...Object.values(updates), discordMessageId];
      
			const result = this.db.prepare(`
				UPDATE messages 
				SET ${setClause}
				WHERE discord_message_id = ?
			`).run(...values);
      
			return result.changes > 0;
		} catch (error) {
			console.error('Message update by Discord message ID error:', error);
			return false;
		}
	}
}

export default MessageRepository;
