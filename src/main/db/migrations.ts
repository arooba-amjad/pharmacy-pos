/**
 * Versioned migrations for the POS SQLite database.
 * Uses `meta.db_version` (same contract as `backend/migrations.js`) so Express and Electron stay aligned.
 * Each pending migration runs inside a transaction; version is written only after success.
 */

import type Database from 'better-sqlite3';
import baselineSchema from '../../../backend/schema.sql?raw';

export type Migration = {
  version: number;
  description?: string;
  up: (db: Database.Database) => void;
};

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Baseline schema (CREATE IF NOT EXISTS)',
    up(db) {
      const exists = db
        .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'medicines' LIMIT 1")
        .get();
      if (exists) return;
      db.exec(String(baselineSchema));
    },
  },
];

function readVersion(db: Database.Database): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'db_version'").get() as { value: string } | undefined;
  if (!row?.value) return 0;
  const n = parseInt(String(row.value), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Idempotent migration runner. Safe to call on every startup.
 * Duplicate runs are prevented by version checks (not by locking — main process is single-threaded).
 */
export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  let current = readVersion(db);

  // Legacy DB: had tables before `meta` / migrations existed.
  if (current === 0) {
    const hasCore = db
      .prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'medicines' LIMIT 1")
      .get();
    if (hasCore) {
      db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('db_version', '1')").run();
      current = readVersion(db);
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
