/**
 * Messages table schema
 */
export const createMessagesTable = (db) => {

  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      message_id TEXT UNIQUE,
      conversation_id TEXT,

      guild_id TEXT,
      channel_id TEXT NOT NULL,
      author_id TEXT NOT NULL,

      content TEXT,
      attachments_json TEXT,

      generation_id TEXT,

      timestamp INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      deleted_at TEXT, 

      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
      FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE SET NULL
    )
  `).run();
};
