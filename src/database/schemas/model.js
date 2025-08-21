/**
 * Model table schema
 */
export const createModelTable = (db) => {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS model (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      key TEXT NOT NULL
    )
  `).run();
};

