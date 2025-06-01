import Database from "better-sqlite3";

const db = new Database("./src/database/file.db");

// Create users table
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    role TEXT CHECK(role IN ('host', 'user')) NOT NULL,
    access TEXT CHECK(access IN ('default', 'whitelist', 'blacklist')) DEFAULT 'default',
    username TEXT NOT NULL,
    global_name TEXT,
    preferred_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`).run();

// Create messages table
db.prepare(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    discord_id TEXT UNIQUE,
    user_id TEXT NOT NULL,
    channel_id TEXT,
    guild_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`).run();

export default db;