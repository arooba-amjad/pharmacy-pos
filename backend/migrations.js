/**
 * Versioned SQLite migrations.
 * Keep in sync with `src/main/db/migrations.ts` (Electron main runs the TS copy on first launch).
 *
 * - `meta` table holds `db_version` (integer string).
 * - Each migration runs in a transaction; version is bumped only after success.
 * - Migrations must be idempotent where possible (IF NOT EXISTS, etc.).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @typedef {{ version: number; description?: string; up: (db: import('better-sqlite3').Database) => void }} Migration */

/** @type {Migration[]} */
export const MIGRATIONS = [
  {
    version: 1,
    description: 'Baseline schema from schema.sql (CREATE IF NOT EXISTS)',
    up(db) {
      const exists = db
        .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'medicines' LIMIT 1")
        .get();
      if (exists) return;
      const schemaPath = path.join(__dirname, 'schema.sql');
      const sql = fs.readFileSync(schemaPath, 'utf8');
      db.exec(sql);
    },
  },
  {
    version: 2,
    description: 'Add app_users table for local desktop authentication',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS app_users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    version: 3,
    description: 'Add tax column to sales for persisted invoice totals',
    up(db) {
      const cols = db.prepare("PRAGMA table_info('sales')").all();
      const hasTax = cols.some((c) => String(c.name).toLowerCase() === 'tax');
      if (!hasTax) {
        db.exec('ALTER TABLE sales ADD COLUMN tax REAL NOT NULL DEFAULT 0;');
      }
    },
  },
  {
    version: 4,
    description: 'Sales pricing channel (retail vs wholesale) for invoice labeling',
    up(db) {
      const cols = db.prepare("PRAGMA table_info('sales')").all();
      const hasCh = cols.some((c) => String(c.name).toLowerCase() === 'pricing_channel');
      if (!hasCh) {
        db.exec(
          "ALTER TABLE sales ADD COLUMN pricing_channel TEXT NOT NULL DEFAULT 'retail';"
        );
      }
    },
  },
];

/**
 * Ensures `meta` exists, bootstraps legacy DBs (tables present but no version row),
 * then applies pending migrations in order.
 * @param {import('better-sqlite3').Database} db
 */
export function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const readVersion = () => {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'db_version'").get();
    if (!row?.value) return 0;
    const n = parseInt(String(row.value), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  let current = readVersion();

  // Legacy: database created before migrations — tables exist but no meta row.
  if (current === 0) {
    const hasCore = db
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'medicines' LIMIT 1")
      .get();
    if (hasCore) {
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('db_version', '1')").run();
      current = readVersion();
    }
  }

  for (const mig of MIGRATIONS) {
    if (mig.version <= current) continue;
    db.transaction(() => {
      mig.up(db);
    })();
    db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('db_version', ?)").run(String(mig.version));
    current = mig.version;
  }
}
