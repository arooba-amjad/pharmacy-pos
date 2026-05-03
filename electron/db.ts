import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';
import { runMigrations } from '../src/main/db/migrations';
import { logger } from './logger';

const DB_FILE_NAME = 'pharmacy.db';
const DB_VERSION = 1;
const DEBUG_DB_WRITES = process.env.PHARMACY_DEBUG_DB_WRITES === '1';
const CRASH_SAFE_MODE = process.env.PHARMACY_DEBUG_CRASH_SAFE === '1';

let instance: Database.Database | null = null;
let dbFilePath = '';

export function getDbPath(): string {
  if (!dbFilePath) {
    dbFilePath = path.join(app.getPath('userData'), DB_FILE_NAME);
  }
  return dbFilePath;
}

function ensureMetaTable(db: Database.Database): void {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
}

function setDbVersion(db: Database.Database, version: number): void {
  db.prepare(
    `INSERT INTO app_meta (key, value, updated_at)
     VALUES ('db_version', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(String(version), new Date().toISOString());
}

export function getDatabase(): Database.Database {
  if (instance) return instance;

  const filePath = getDbPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  /** WAL + NORMAL is the usual desktop tradeoff; faster than FULL with acceptable durability for local POS. */
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  if (CRASH_SAFE_MODE) {
    db.pragma('synchronous = FULL');
    logger.warn('Crash-safe mode enabled: synchronous=FULL');
  }
  runMigrations(db);
  ensureMetaTable(db);
  setDbVersion(db, DB_VERSION);

  instance = db;
  if (DEBUG_DB_WRITES) {
    logger.info('DB write debug mode enabled');
  }
  return instance;
}

export function getDatabaseVersion(): number {
  const db = getDatabase();
  const row = db.prepare("SELECT value FROM app_meta WHERE key = 'db_version'").get() as
    | { value: string }
    | undefined;
  return Number(row?.value ?? DB_VERSION);
}

export type IntegrityCheckMode = 'quick' | 'full';

function readIntegrityPragma(db: Database.Database, pragma: 'quick_check' | 'integrity_check'): string {
  const rows = db.prepare(`PRAGMA ${pragma}`).all() as Record<string, unknown>[];
  if (rows.length === 0) return 'empty';
  const parts = rows.map((row) => String(Object.values(row)[0] ?? ''));
  if (parts.length === 1 && parts[0].toLowerCase() === 'ok') return 'ok';
  return parts.join('; ');
}

/** Startup uses `quick` by default (much faster on large DBs). Use `full` after restore or for deep audits. */
export function checkDatabaseIntegrity(mode: IntegrityCheckMode = 'quick'): {
  ok: boolean;
  integrity: string;
  foreignKeyViolations: unknown[];
} {
  const db = getDatabase();
  const pragma = mode === 'quick' ? 'quick_check' : 'integrity_check';
  const integrity = readIntegrityPragma(db, pragma);
  const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all();
  const ok = integrity.toLowerCase() === 'ok' && foreignKeyViolations.length === 0;
  return { ok, integrity, foreignKeyViolations };
}

export function closeDatabase(): void {
  if (!instance) return;
  instance.close();
  instance = null;
}

export function logDbWrite(label: string, payload?: unknown): void {
  if (!DEBUG_DB_WRITES) return;
  logger.info(`DB WRITE ${label}`, payload);
}
