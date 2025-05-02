import Database from "better-sqlite3";

const db = new Database("./file.db");

// 테이블 생성 (이미 있으면 생성하지 않음)
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    globalName TEXT,
    preferred_name TEXT,
    avatar TEXT,
    banner TEXT,
    name TEXT,
    age INTEGER,
    gender TEXT,
    race TEXT,
    origin TEXT,
    birthday TEXT,
    strength TEXT,
    intelligence TEXT,
    family TEXT,
    past TEXT,
    education TEXT,
    job TEXT,
    income TEXT,
    residence TEXT,
    network TEXT,
    reputation TEXT,
    like TEXT,
    hate TEXT,
    special TEXT,
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
  `).run();

// // 데이터 삽입 예시
// const insertUser = db.prepare(`
//   INSERT INTO users (username, preferred_name, email, password) VALUES (?, ?, ?, ?)
// `);
// insertUser.run("john_doe", "john@example.com", "securepassword123");

// console.log("유저가 추가되었습니다.");
