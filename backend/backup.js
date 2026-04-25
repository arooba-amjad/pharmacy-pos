/**
 * Manual / automatic SQLite backups.
 * By default backups go in the same folder as the live DB (see getBackupStorageDirectory).
 * Set PHARMACY_BACKUP_DIR to force an absolute folder (e.g. same as Electron userData).
 */

import fs from 'node:fs';
import path from 'node:path';
import { getDbFilePath } from './db.js';

/**
 * Folder where backup *.db files are written and listed.
 * PHARMACY_BACKUP_DIR overrides; otherwise same directory as the open database file.
 */
export function getBackupStorageDirectory() {
  const env = process.env.PHARMACY_BACKUP_DIR?.trim();
  if (env) return path.resolve(env);
  return path.dirname(getDbFilePath());
}

/** @param {string} dbPath Absolute path to pharmacy.db (source) */
export function createBackupFile(dbPath, { prefix = '' } = {}) {
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file not found; cannot backup.');
  }
  const dir = getBackupStorageDirectory();
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `${prefix}pharmacy-backup-${stamp}.db`;
  const dest = path.join(dir, name);
  fs.copyFileSync(dbPath, dest);
  return dest;
}

/**
 * @param {string} dbDir Directory containing pharmacy.db
 * @returns {string[]} backup filenames only (not full paths)
 */
export function listBackupFiles(dbDir) {
  if (!fs.existsSync(dbDir)) return [];
  return fs
    .readdirSync(dbDir)
    .filter((f) => /pharmacy-backup-/i.test(f) && f.toLowerCase().endsWith('.db'))
    .sort()
    .reverse();
}

/** Remove SQLite WAL/SHM after closing the main DB (clean restore). */
export function removeWalSidecars(dbPath) {
  for (const ext of ['-wal', '-shm']) {
    try {
      fs.unlinkSync(dbPath + ext);
    } catch {
      // ignore
    }
  }
}

/**
 * Validates filename is a simple backup name (no path traversal).
 * @param {string} fileName
 */
export function assertSafeBackupFileName(fileName) {
  const base = path.basename(fileName);
  if (base !== fileName || !/^[\w.-]+\.db$/i.test(base)) {
    throw new Error('Invalid backup file name.');
  }
  if (!/pharmacy-backup-/i.test(base)) {
    throw new Error('Not a recognized backup file.');
  }
  return base;
}
