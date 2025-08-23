export const MESSAGE_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED'
};

/**
 * Messages table schema
 */
export const createMessagesTable = (db) => {
  const statusValues = Object.values(MESSAGE_STATUS).map(s => `'${s}'`).join(', ');
  db.prepare(`
    CREATE TABLE IF NOT EXISTS text_generations (
      id TEXT PRIMARY KEY,
      status TEXT
        CHECK(status IN (${statusValues})) NOT NULL,
      message_ids_json TEXT NOT NULL
        CHECK (json_valid(message_ids_json)),

      user_input TEXT,
      ai_output TEXT,
      ai_thinking TEXT,
      error TEXT,

      processing_time INTEGER,
      started_at TEXT NOT NULL,
      finished_at TEXT,

      api_provider TEXT,
      api_request TEXT,
      api_response TEXT,

      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    )
  `).run(); 
};