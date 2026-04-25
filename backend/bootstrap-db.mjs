/**
 * One-shot: load db.js so SQLite opens (path from db-path.txt or env) and migrations run.
 * Run from repo root: `node backend/bootstrap-db.mjs`
 */
import { getDbFilePath } from './db.js';

console.log('Database ready:', getDbFilePath());
