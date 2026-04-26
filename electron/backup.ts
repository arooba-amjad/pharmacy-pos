import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { closeDatabase, getDatabase, getDatabaseVersion, getDbPath } from './db';
import { logger } from './logger';

const BACKUPS_TO_KEEP = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

function getBackupDir(): string {
  const dir = path.join(app.getPath('userData'), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function backupName(prefix = ''): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${prefix}pharmacy-backup-${stamp}.db`;
}

function listBackupFilesByNewest(): string[] {
  const dir = getBackupDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db') && f.includes('pharmacy-backup-'));
  return files.sort((a, b) => {
    const aTime = fs.statSync(path.join(dir, a)).mtimeMs;
    const bTime = fs.statSync(path.join(dir, b)).mtimeMs;
    return bTime - aTime;
  });
}

function listAbsoluteBackups(): string[] {
  const dir = getBackupDir();
  return listBackupFilesByNewest().map((f) => path.join(dir, f));
}

function trimBackups(): void {
  const backups = listAbsoluteBackups();
  for (const old of backups.slice(BACKUPS_TO_KEEP)) {
    try {
      fs.unlinkSync(old);
    } catch {
      // ignore cleanup errors
    }
  }
}

function checkpointWal(): void {
  try {
    const db = getDatabase();
    db.pragma('wal_checkpoint(FULL)');
  } catch (error) {
    logger.warn('WAL checkpoint failed before backup', { error: String(error) });
  }
}

export function createBackup(prefix = ''): string {
  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error('Database not found for backup.');
  }
  checkpointWal();
  const dest = path.join(getBackupDir(), backupName(prefix));
  fs.copyFileSync(dbPath, dest);
  const metaPath = `${dest}.meta.json`;
  fs.writeFileSync(
    metaPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        appVersion: app.getVersion(),
        dbVersion: getDatabaseVersion(),
        dbFileName: path.basename(dbPath),
      },
      null,
      2
    ),
    'utf8'
  );
  trimBackups();
  logger.info('Backup created', { path: dest, metaPath });
  return dest;
}

export function runDailyBackup(): string | null {
  const backups = listAbsoluteBackups();
  if (backups.length > 0) {
    const newest = fs.statSync(backups[0]).mtimeMs;
    if (Date.now() - newest < DAY_MS) return null;
  }
  return createBackup('daily-');
}

export function backupOnStartup(): string {
  return createBackup('startup-');
}

export function restoreBackup(fileName: string): void {
  const safe = path.basename(fileName);
  if (safe !== fileName || !safe.endsWith('.db') || !safe.includes('pharmacy-backup-')) {
    throw new Error('Invalid backup file name.');
  }
  const source = path.join(getBackupDir(), safe);
  if (!fs.existsSync(source)) throw new Error('Backup file not found.');

  const dbPath = getDbPath();
  safePreOperationBackup('pre-restore-');
  closeDatabase();
  for (const ext of ['-wal', '-shm']) {
    try {
      fs.unlinkSync(dbPath + ext);
    } catch {
      // ignore sidecar cleanup issues
    }
  }
  fs.copyFileSync(source, dbPath);
  getDatabase();
  logger.info('Backup restored', { source });
}

export function listBackups(): string[] {
  return listBackupFilesByNewest();
}

export function getLatestBackupFileName(): string | null {
  const files = listBackups();
  return files.length > 0 ? files[0] : null;
}

export function safePreOperationBackup(label: string): string | null {
  try {
    return createBackup(`${label}`);
  } catch (error) {
    logger.warn('Pre-operation backup failed', { label, error: String(error) });
    return null;
  }
}
