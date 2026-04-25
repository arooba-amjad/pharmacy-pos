/**
 * Main-process SQLite: single source of truth for first-run schema on the desktop.
 * Opens before any BrowserWindow so the UI never renders against an unmigrated file.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getUserDataDatabasePath, writeDbPathMarkerFile } from './paths';
import { runMigrations } from './migrations';

let instance: Database.Database | null = null;

/** If the live DB is new and a legacy dev file exists, copy once (same as backend/db.js). */
function maybeMigrateFromLegacyDevDb(targetPath: string): void {
  if (fs.existsSync(targetPath)) return;
  const legacy = path.resolve(process.cwd(), 'backend', 'data', 'pharmacy.sqlite');
  if (!fs.existsSync(legacy)) return;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(legacy, targetPath);
  for (const ext of ['-wal', '-shm'] as const) {
    const side = legacy + ext;
    if (fs.existsSync(side)) {
      try {
        fs.copyFileSync(side, targetPath + ext);
      } catch {
        // optional sidecars
      }
    }
  }
}

/**
 * Synchronous init: WAL + foreign keys + migrations.
 * Call exactly once per process from `app.whenReady()` before creating windows.
 */
export function initializeMainDatabase(): Database.Database {
  if (instance) return instance;

  writeDbPathMarkerFile();

  const dbPath = getUserDataDatabasePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  maybeMigrateFromLegacyDevDb(dbPath);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);

  instance = db;
  return db;
}

export function getMainDatabase(): Database.Database {
  if (!instance) {
    throw new Error('Database not initialized — initializeMainDatabase() must run at startup');
  }
  return instance;
}

export function shutdownMainDatabase(): void {
  if (instance) {
    try {
      instance.close();
    } catch {
      // ignore double-close
    }
    instance = null;
  }
}
