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

/**
 * Messages table schema
 */
export const createMessagesTable = (db) => {
  const statusValues = Object.values(MESSAGE_STATUS).map(s => `'${s}'`).join(', ');
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT,
      guild_id TEXT,
      content TEXT NOT NULL,
      response_status TEXT CHECK(response_status IN (${statusValues})) NOT NULL DEFAULT '${MESSAGE_STATUS.PENDING}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();
};
