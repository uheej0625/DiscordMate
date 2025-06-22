/**
 * Users table schema
 */
export const createUsersTable = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT CHECK(role IN ('host', 'user')) NOT NULL DEFAULT 'user',
      access TEXT CHECK(access IN ('default', 'whitelist', 'blacklist')) NOT NULL DEFAULT 'default',
      username TEXT NOT NULL,
      global_name TEXT,
      preferred_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
};
