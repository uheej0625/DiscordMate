/**
 * Messages table schema
 */
export const createMessagesTable = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      discord_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      channel_id TEXT,
      guild_id TEXT,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `).run();
};
