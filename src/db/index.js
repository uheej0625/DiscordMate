import Database from "better-sqlite3";

const db = new Database("./src/db/file.db");

// 테이블 생성 (이미 있으면 생성하지 않음)
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    discord_id TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('admin', 'whitelist', 'blacklist')) NOT NULL,
    username TEXT NOT NULL,
    global_name TEXT,
    preferred_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// updated_at 자동 갱신 트리거 생성
db.prepare(`
    CREATE TRIGGER IF NOT EXISTS update_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
  `
).run();

// 메세지를 저장할 테이블 생성
db.prepare(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    discord_id TEXT UNIQUE,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`).run();

export default db;