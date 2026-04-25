import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

/** Live SQLite file — same path the optional Express API reads via `db-path.txt`. */
export function getUserDataDatabasePath(): string {
  return path.join(app.getPath('userData'), 'pharmacy.db');
}

/** Writes absolute DB path so `backend/db.js` resolves the same file when the API runs. */
export function writeDbPathMarkerFile(): void {
  const userData = app.getPath('userData');
  const dbFile = getUserDataDatabasePath();
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(path.join(userData, 'db-path.txt'), dbFile, 'utf8');
}
