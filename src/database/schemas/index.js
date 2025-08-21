import { createUsersTable } from './users.js';
import { createMessagesTable } from './messages.js';
import { createModelTable } from './model.js';

/**
 * Initialize all database tables
 * @param {import("better-sqlite3").Database} db - Database instance
 */
export const initializeDatabase = (db) => {
  console.log('Initializing database schema...');
  
  // Create tables in order (dependencies first)
  createUsersTable(db);
  createMessagesTable(db);
  createModelTable(db);

  console.log('Database schema initialized successfully');
};

// Export individual schema functions for manual use
export {
  createUsersTable,
  createMessagesTable,
  createModelTable
};
