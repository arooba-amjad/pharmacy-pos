import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
fs.rmSync(path.join(root, 'node_modules', '.better-sqlite3-electron-stamp'), { force: true });
