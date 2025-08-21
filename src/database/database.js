import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from './schemas/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'file.db');

// 싱글톤 데이터베이스 인스턴스
let dbInstance = null;

export const getDatabase = () => {
  if (!dbInstance) {
    dbInstance = new Database(dbPath);
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');
    
    // 스키마 초기화
    initializeDatabase(dbInstance);
    
    console.log('✅ Database connection established');
  }
  return dbInstance;
};

// 데이터베이스 연결 종료
export const closeDatabase = () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('🔌 Database connection closed');
  }
};

// 기본 export
export default getDatabase();