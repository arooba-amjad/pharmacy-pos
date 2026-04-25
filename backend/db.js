/**
 * SQLite connection with a safe default path outside the app bundle.
 *
 * Desktop: Electron main initializes the same file and runs migrations first (`src/main/db/connection.ts`).
 * This module stays for the optional Express API and dev scripts; migrations here remain idempotent.
 *
 * Resolution order:
 * 1) PHARMACY_DB_PATH — explicit absolute path to the database file
 * 2) db-path.txt under Electron userData (written by electron/main.ts) — scanned from common locations
 * 2b) pharmacy.db in those folders if it exists and is non-empty (Electron may create the file first)
 * 3) PHARMACY_USER_DATA_DIR/pharmacy.db — dev / CI override
 * 4) Legacy dev path: <cwd>/backend/data/pharmacy.sqlite (existing projects)
 *
 * On first use of a new userData DB, if the legacy file exists it is copied once so data is preserved.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { runMigrations } from './migrations.js';

/** Matches Electron `package.json` "name" (userData folder on Windows: %APPDATA%\<name>). */
const ELECTRON_APP_NAME_CANDIDATES = ['pharmacy', 'PharmacyPOS'];

/**
 * @param {string} dir
 * @returns {string | null}
 */
function tryReadDbPathFromFile(dir) {
  const f = path.join(dir, 'db-path.txt');
  if (!fs.existsSync(f)) return null;
  const raw = fs.readFileSync(f, 'utf8').trim();
  if (!raw) return null;
  return path.resolve(raw);
}

function getElectronStyleUserDataDirs() {
  const dirs = [];
  if (process.env.PHARMACY_USER_DATA_DIR) {
    dirs.push(path.resolve(process.env.PHARMACY_USER_DATA_DIR.trim()));
  }
  if (process.platform === 'win32' && process.env.APPDATA) {
    for (const name of ELECTRON_APP_NAME_CANDIDATES) {
      dirs.push(path.join(process.env.APPDATA, name));
    }
  }
  if (process.platform === 'darwin') {
    for (const name of ELECTRON_APP_NAME_CANDIDATES) {
      dirs.push(path.join(os.homedir(), 'Library', 'Application Support', name));
    }
  }
  const xdg = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  for (const name of ELECTRON_APP_NAME_CANDIDATES) {
    dirs.push(path.join(xdg, name));
  }
  return [...new Set(dirs)];
}

/**
 * @returns {string} Absolute path to the SQLite database file
 */
export function resolveDbFilePath() {
  const envPath = process.env.PHARMACY_DB_PATH?.trim();
  if (envPath) return path.resolve(envPath);

  for (const dir of getElectronStyleUserDataDirs()) {
    const fromFile = tryReadDbPathFromFile(dir);
    if (fromFile) return fromFile;
    // Electron may create pharmacy.db before db-path.txt is readable; prefer a non-empty file
    // over legacy dev DB so backups land next to the desktop DB.
    const directDb = path.join(dir, 'pharmacy.db');
    try {
      if (fs.existsSync(directDb) && fs.statSync(directDb).size > 0) {
        return path.resolve(directDb);
      }
    } catch {
      // ignore stat errors
    }
  }

  const explicitUserData = process.env.PHARMACY_USER_DATA_DIR?.trim();
  if (explicitUserData) {
    return path.join(path.resolve(explicitUserData), 'pharmacy.db');
  }

  return path.resolve(process.cwd(), 'backend', 'data', 'pharmacy.sqlite');
}

/** @type {string} Path of the currently open database file */
let _activeDbPath = '';

/**
 * If the target DB file does not exist yet but the legacy dev DB does, copy it once (including WAL sidecars if present).
 * @param {string} targetPath
 */
function maybeMigrateFromLegacyDevDb(targetPath) {
  if (fs.existsSync(targetPath)) return;
  const legacy = path.resolve(process.cwd(), 'backend', 'data', 'pharmacy.sqlite');
  if (!fs.existsSync(legacy)) return;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(legacy, targetPath);
  for (const ext of ['-wal', '-shm']) {
    const side = legacy + ext;
    if (fs.existsSync(side)) {
      try {
        fs.copyFileSync(side, targetPath + ext);
      } catch {
        // ignore optional sidecar copy failures
      }
    }
  }
}

/**
 * @returns {string}
 */
export function getDbFilePath() {
  return _activeDbPath;
}

/** Live binding for services — call `reopenDatabase()` after restore. */
export let db = null;

/**
 * Opens SQLite (WAL, foreign keys), runs migrations. Safe to call after close.
 * @returns {import('better-sqlite3').Database}
 */
export function openDatabase() {
  const filePath = resolveDbFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  maybeMigrateFromLegacyDevDb(filePath);
  _activeDbPath = filePath;
  closeDatabase();
  db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
  }
  db = null;
}

export function reopenDatabase() {
  closeDatabase();
  return openDatabase();
}

openDatabase();

export function nowIso() {
  return new Date().toISOString();
}

export function runInTransaction(fn) {
  const tx = db.transaction(fn);
  return tx();
}

export function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}
