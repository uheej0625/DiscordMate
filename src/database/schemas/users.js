/**
 * User role constants
 */
export const USER_ROLE = {
  HOST: 'HOST',
  USER: 'USER'
};

/**
 * User access constants
 */
export const USER_ACCESS = {
  DEFAULT: 'DEFAULT',
  WHITELIST: 'WHITELIST',
  BLACKLIST: 'BLACKLIST'
};

/**
 * Users table schema
 */
export const createUsersTable = (db) => {
  const roleValues = Object.values(USER_ROLE).map(r => `'${r}'`).join(', ');
  const accessValues = Object.values(USER_ACCESS).map(a => `'${a}'`).join(', ');
  
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT CHECK(role IN (${roleValues})) NOT NULL DEFAULT '${USER_ROLE.USER}',
      access TEXT CHECK(access IN (${accessValues})) NOT NULL DEFAULT '${USER_ACCESS.DEFAULT}',
      username TEXT NOT NULL,
      global_name TEXT,
      preferred_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();
};
