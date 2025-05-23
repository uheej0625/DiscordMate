import Database from "better-sqlite3";

const db = new Database("./src/db/file.db");

// 테이블 생성 (이미 있으면 생성하지 않음)
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    status TEXT CHECK(status IN ('admin', 'whitelist', 'blacklist')),
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
  `
).run();

// 대화 데이터를 저장할 테이블 생성
db.prepare(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// 대화 저장 함수
db.saveConversation = (id, userId, message) => {
  const stmt = db.prepare(`
    INSERT INTO conversations (id, user_id, message) VALUES (?, ?, ?)
  `);
  stmt.run(id, userId, message);
};

// 대화 불러오기 함수
db.getConversationsByUser = (userId) => {
  const stmt = db.prepare(`
    SELECT * FROM conversations WHERE user_id = ? ORDER BY timestamp ASC
  `);
  return stmt.all(userId);
};

db.getConversationById = (id) => {
  const stmt = db.prepare(`
    SELECT * FROM conversations WHERE id = ?
  `);
  return stmt.get(id);
};

// 테스트 데이터 삽입 및 조회
const testConversation = () => {
  const testId = "conv1";
  const testUserId = "user1";
  const testMessage = "Hello, this is a test message!";

  // 대화 저장
  db.saveConversation(testId, testUserId, testMessage);
  console.log("대화 저장 완료");

  // 사용자별 대화 조회
  const userConversations = db.getConversationsByUser(testUserId);
  console.log("사용자 대화:", userConversations);

  // ID로 대화 조회
  const conversation = db.getConversationById(testId);
  console.log("특정 대화:", conversation);
};

testConversation();
