import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { getDbPath } from './db';

type DbLike = {
  prepare: (sql: string) => {
    all: (...args: unknown[]) => any[];
  };
};

let mirrorDb: Database.Database | null = null;

export function getMedicinesMirrorPath(): string {
  return path.join(path.dirname(getDbPath()), 'medicines.db');
}

function getMirrorDb(): Database.Database {
  if (mirrorDb) return mirrorDb;
  const mirrorPath = getMedicinesMirrorPath();
  fs.mkdirSync(path.dirname(mirrorPath), { recursive: true });
  mirrorDb = new Database(mirrorPath);
  mirrorDb.pragma('journal_mode = WAL');
  mirrorDb.pragma('foreign_keys = OFF');
  mirrorDb.exec(`
    DROP TABLE IF EXISTS batches;
    DROP TABLE IF EXISTS medicines;

    CREATE TABLE IF NOT EXISTS medicines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_hint TEXT NOT NULL DEFAULT '',
      type_hint TEXT NOT NULL DEFAULT ''
    );
  `);
  return mirrorDb;
}

export function syncMedicinesMirror(mainDb: DbLike): void {
  const mirror = getMirrorDb();
  const medicines = mainDb
    .prepare('SELECT id, name, category, type FROM medicines WHERE is_active = 1 ORDER BY name ASC')
    .all();

  mirror.transaction(() => {
    mirror!.prepare('DELETE FROM medicines').run();

    const insertMedicine = mirror!.prepare(`
      INSERT INTO medicines
      (id, name, category_hint, type_hint)
      VALUES (?, ?, ?, ?)
    `);

    for (const m of medicines) {
      insertMedicine.run(
        m.id,
        m.name,
        m.category ?? '',
        m.type ?? ''
      );
    }
  })();
}

