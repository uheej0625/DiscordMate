/**
 * Message response status constants
 */
export const MESSAGE_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PROCESSING: 'PROCESSING',
  DELETED: 'DELETED'
};

export const MESSAGE_ROLE = {
  USER: 'USER',
  ASSISTANT: 'ASSISTANT'  
};

/**
 * Messages table schema
 */
export const createMessagesTable = (db) => {
  const statusValues = Object.values(MESSAGE_STATUS).map(s => `'${s}'`).join(', ');
  const roleValues = Object.values(MESSAGE_ROLE).map(s => `'${s}'`).join(', ');

  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      discord_message_id TEXT UNIQUE NOT NULL,
      conversation_id TEXT,
      turn_id TEXT,
      
      channel_id TEXT NOT NULL,
      guild_id TEXT,

      author_id TEXT NOT NULL,
      author_role TEXT CHECK(author_role IN (${roleValues})) NOT NULL,

      content TEXT NOT NULL,
      attachments_json TEXT,

      response_status TEXT CHECK(response_status IN (${statusValues})) NOT NULL DEFAULT '${MESSAGE_STATUS.PENDING}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();
};
