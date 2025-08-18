import { randomUUID } from 'node:crypto';
import { getDatabase } from '../database/database.js';
import { MESSAGE_STATUS } from '../database/schemas/messages.js';

const db = getDatabase();

// Prepared statements for better performance
const statements = {
  insert: db.prepare(`
    INSERT INTO messages (
      id, message_id, conversation_id, compose_id,
      channel_id, guild_id, author_id, content, thinking,
      attachments, status, error, message_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  update: db.prepare(`
    UPDATE messages 
    SET content = ?, thinking = ?, attachments = ?, status = ?, 
        error = ?, updated_at = datetime('now')
    WHERE id = ?
  `),
  
  updateStatus: db.prepare(`
    UPDATE messages 
    SET status = ?, error = ?, updated_at = datetime('now')
    WHERE id = ?
  `),
  
  findById: db.prepare('SELECT * FROM messages WHERE id = ?'),
  findByMessageId: db.prepare('SELECT * FROM messages WHERE message_id = ?'),
  findByConversationId: db.prepare(`
    SELECT * FROM messages 
    WHERE conversation_id = ? 
    ORDER BY message_timestamp ASC
  `),
  findByChannelId: db.prepare(`
    SELECT * FROM messages 
    WHERE channel_id = ? 
    ORDER BY message_timestamp DESC 
    LIMIT ?
  `),
  findByAuthorId: db.prepare(`
    SELECT * FROM messages 
    WHERE author_id = ? 
    ORDER BY message_timestamp DESC 
    LIMIT ?
  `),
  findByStatus: db.prepare(`
    SELECT * FROM messages 
    WHERE status = ? 
    ORDER BY message_timestamp DESC
  `),
  softDelete: db.prepare(`
    UPDATE messages 
    SET deleted_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `),
  hardDelete: db.prepare('DELETE FROM messages WHERE id = ?'),
  count: db.prepare('SELECT COUNT(*) as count FROM messages WHERE deleted_at IS NULL'),
    countByStatus: db.prepare('SELECT COUNT(*) as count FROM messages WHERE status = ? AND deleted_at IS NULL')
};
;

// Helper function to parse attachments
const parseMessage = (message) => {
  if (message && message.attachments) {
    message.attachments = JSON.parse(message.attachments);
  }
  return message;
};

/**
 * Create a new message
 */
export const create = async (messageData) => {
  const id = randomUUID();
  const {
    message_id,
    conversation_id = null,
    compose_id = null,
    channel_id,
    guild_id = null,
    author_id,
    content = null,
    thinking = null,
    attachments = null,
    status = MESSAGE_STATUS.PENDING,
    error = null,
    message_timestamp
  } = messageData;

  try {
    statements.insert.run(
      id, message_id, conversation_id, compose_id,
      channel_id, guild_id, author_id, content, thinking,
      JSON.stringify(attachments), status, error, message_timestamp
    );

    return parseMessage(statements.findById.get(id));
  } catch (error) {
    throw new Error(`Failed to create message: ${error.message}`);
  }
};

/**
 * Update an existing message
 */
export const update = async (id, updateData) => {
  const {
    content,
    thinking,
    attachments,
    status,
    error
  } = updateData;

  try {
    const result = statements.update.run(
      content,
      thinking,
      JSON.stringify(attachments),
      status,
      error,
      id
    );

    if (result.changes === 0) {
      return null;
    }

    return parseMessage(statements.findById.get(id));
  } catch (err) {
    throw new Error(`Failed to update message: ${err.message}`);
  }
};

/**
 * Update message status
 */
export const updateStatus = async (id, status, error = null) => {
  try {
    const result = statements.updateStatus.run(status, error, id);
    
    if (result.changes === 0) {
      return null;
    }

    return parseMessage(statements.findById.get(id));
  } catch (err) {
    throw new Error(`Failed to update message status: ${err.message}`);
  }
};

/**
 * Find message by ID
 */
export const getById = async (id) => {
  try {
    const message = statements.findById.get(id);
    return parseMessage(message) || null;
  } catch (error) {
    throw new Error(`Failed to find message by ID: ${error.message}`);
  }
};

/**
 * Find message by Discord message ID
 */
export const getByMessageId = async (messageId) => {
  try {
    const message = statements.findByMessageId.get(messageId);
    return parseMessage(message) || null;
  } catch (error) {
    throw new Error(`Failed to find message by message ID: ${error.message}`);
  }
};

/**
 * Get messages by conversation ID
 */
export const getByConversationId = async (conversationId) => {
  try {
    const messages = statements.findByConversationId.all(conversationId);
    return messages.map(parseMessage);
  } catch (error) {
    throw new Error(`Failed to find messages by conversation ID: ${error.message}`);
  }
};

/**
 * Get recent messages by channel ID
 */
export const getByChannelId = async (channelId, limit = 50) => {
  try {
    const messages = statements.findByChannelId.all(channelId, limit);
    return messages.map(parseMessage);
  } catch (error) {
    throw new Error(`Failed to find messages by channel ID: ${error.message}`);
  }
};

/**
 * Get messages by author ID
 */
export const getByAuthorId = async (authorId, limit = 100) => {
  try {
    const messages = statements.findByAuthorId.all(authorId, limit);
    return messages.map(parseMessage);
  } catch (error) {
    throw new Error(`Failed to find messages by author ID: ${error.message}`);
  }
};

/**
 * Get messages by status
 */
export const getByStatus = async (status) => {
  try {
    const messages = statements.findByStatus.all(status);
    return messages.map(parseMessage);
  } catch (error) {
    throw new Error(`Failed to find messages by status: ${error.message}`);
  }
};

/**
 * Soft delete a message
 */
export const deleteMessage = async (id) => {
  try {
    const result = statements.softDelete.run(id);
    return result.changes > 0;
  } catch (error) {
    throw new Error(`Failed to delete message: ${error.message}`);
  }
};

/**
 * Permanently delete a message
 */
export const hardDelete = async (id) => {
  try {
    const result = statements.hardDelete.run(id);
    return result.changes > 0;
  } catch (error) {
    throw new Error(`Failed to hard delete message: ${error.message}`);
  }
};

/**
 * Get total message count
 */
export const getCount = async () => {
  try {
    const result = statements.count.get();
    return result.count;
  } catch (error) {
    throw new Error(`Failed to count messages: ${error.message}`);
  }
};

/**
 * Get message count by status
 */
export const getCountByStatus = async (status) => {
  try {
    const result = statements.countByStatus.get(status);
    return result.count;
  } catch (error) {
    throw new Error(`Failed to count messages by status: ${error.message}`);
  }
};

/**
 * Close database connection
 */
export const close = () => {
  db.close();
};


