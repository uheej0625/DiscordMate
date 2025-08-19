/**
 * Message response status constants
 */
export const MESSAGE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED'
};

/**
 * Messages table schema
 */
export const createMessagesTable = (db) => {
  const statusValues = Object.values(MESSAGE_STATUS).map(s => `'${s}'`).join(', ');

  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      message_id TEXT UNIQUE NOT NULL,
      conversation_id TEXT,

      channel_id TEXT NOT NULL,
      guild_id TEXT,

      author_id TEXT NOT NULL,

      content TEXT,
      thinking TEXT,
      attachments TEXT,

      status TEXT
        CHECK(status IN (${statusValues})) NOT NULL 
        DEFAULT '${MESSAGE_STATUS.PENDING}',
      error TEXT,

      message_timestamp INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      deleted_at TEXT, 
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
    )
  `).run();
};
