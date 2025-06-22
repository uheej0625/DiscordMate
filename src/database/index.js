import Database from 'better-sqlite3';
import MessageRepository from './repositories/messageRepository.js';
import UserRepository from './repositories/userRepository.js';
import { initializeDatabase } from './schemas/index.js';

const db = new Database('./src/database/file.db');

// Initialize database schema
initializeDatabase(db);

const repositories = {
  messageRepository: new MessageRepository(db),
  userRepository: new UserRepository(db),
};

export default repositories;