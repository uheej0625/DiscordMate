export const GENERATION_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED'
};

/**
 * Messages table schema
 */
export const createGenerationsTable = (db) => {
  const statusValues = Object.values(GENERATION_STATUS).map(s => `'${s}'`).join(', ');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      status TEXT
        CHECK(status IN (${statusValues})) NOT NULL,
      message_ids_json TEXT NOT NULL
        CHECK (json_valid(message_ids_json)),

      user_input TEXT,
      ai_output TEXT,
      ai_thinking TEXT,
      error TEXT,

      started_at TEXT NOT NULL,
      finished_at TEXT,

      api_provider TEXT,
      api_request TEXT,
      api_response TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      canceled_at TEXT,
      reason TEXT,
      updated_at TEXT
    )
  `).run(); 
};