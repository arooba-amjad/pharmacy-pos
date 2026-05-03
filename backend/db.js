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
 * If the target file exists but purchase history is missing there while legacy has it, merge purchase data once.
 * @param {string} targetPath
 */
function maybeMigrateFromLegacyDevDb(targetPath) {
  const legacy = path.resolve(process.cwd(), 'backend', 'data', 'pharmacy.sqlite');
  if (!fs.existsSync(legacy)) return;
  const targetExists = fs.existsSync(targetPath);
  if (targetExists) {
    try {
      const targetPurchases = readTableCount(targetPath, 'purchases');
      const legacyPurchases = readTableCount(legacy, 'purchases');
      if (targetPurchases === 0 && legacyPurchases > 0) {
        backupDbFile(targetPath, '.pre-legacy-merge-');
        mergeLegacyPurchases(targetPath, legacy);
      }
    } catch {
      // if scan/merge fails, preserve existing target DB
    }
    return;
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  copyDbWithSidecars(legacy, targetPath);
}

/**
 * @param {string} source
 * @param {string} destination
 */
function copyDbWithSidecars(source, destination) {
  fs.copyFileSync(source, destination);
  for (const ext of ['-wal', '-shm']) {
    const side = source + ext;
    if (fs.existsSync(side)) {
      try {
        fs.copyFileSync(side, destination + ext);
      } catch {
        // ignore optional sidecar copy failures
      }
    }
  }
}

function backupDbFile(dbPath, infix) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${dbPath}${infix}${stamp}.bak`;
  try {
    fs.copyFileSync(dbPath, backupPath);
  } catch {
    // best effort backup
  }
}

/**
 * @param {string} dbPath
 * @param {string} table
 * @returns {number}
 */
function readTableCount(dbPath, table) {
  const scan = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    return Number(scan.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get()?.c ?? 0);
  } finally {
    scan.close();
  }
}

/**
 * Backfill missing purchase history from legacy DB into target DB.
 * Keeps target's existing rows and inserts only missing purchase/purchase_item IDs.
 * @param {string} targetPath
 * @param {string} legacyPath
 */
function mergeLegacyPurchases(targetPath, legacyPath) {
  const targetDb = new Database(targetPath);
  const legacyDb = new Database(legacyPath, { readonly: true, fileMustExist: true });
  try {
    targetDb.pragma('foreign_keys = ON');
    const tx = targetDb.transaction(() => {
      const legacyPurchases = legacyDb
        .prepare('SELECT * FROM purchases ORDER BY created_at ASC')
        .all();
      const insertSupplier = targetDb.prepare(
        `INSERT OR IGNORE INTO suppliers
        (id, name, phone, company, address, balance_payable, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const insertPurchase = targetDb.prepare(
        `INSERT OR IGNORE INTO purchases
        (id, supplier_id, supplier_name, status, subtotal, tax, discount, total, purchase_date, grn_no, notes, created_at, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const hasSupplier = targetDb.prepare('SELECT 1 FROM suppliers WHERE id = ? LIMIT 1');
      const hasMedicine = targetDb.prepare('SELECT 1 FROM medicines WHERE id = ? LIMIT 1');
      const hasPurchase = targetDb.prepare('SELECT 1 FROM purchases WHERE id = ? LIMIT 1');
      const insertPurchaseItem = targetDb.prepare(
        `INSERT OR IGNORE INTO purchase_items
        (id, purchase_id, medicine_id, batch_no, expiry_date, quantity_packs, tablets_per_pack, quantity_tablets, unit_cost_per_tablet, line_total, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const legacySupplierById = legacyDb.prepare('SELECT * FROM suppliers WHERE id = ?');
      const legacyItemsByPurchase = legacyDb.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY created_at ASC');

      for (const p of legacyPurchases) {
        if (!hasSupplier.get(p.supplier_id)) {
          const s = legacySupplierById.get(p.supplier_id);
          const now = new Date().toISOString();
          insertSupplier.run(
            p.supplier_id,
            s?.name ?? p.supplier_name ?? 'Supplier',
            s?.phone ?? '',
            s?.company ?? '',
            s?.address ?? '',
            Number(s?.balance_payable) || 0,
            s?.created_at ?? now,
            s?.updated_at ?? now
          );
        }
        insertPurchase.run(
          p.id,
          p.supplier_id,
          p.supplier_name ?? '',
          p.status ?? 'pending',
          Number(p.subtotal) || 0,
          Number(p.tax) || 0,
          Number(p.discount) || 0,
          Number(p.total) || 0,
          p.purchase_date ?? new Date().toISOString().slice(0, 10),
          p.grn_no ?? '',
          p.notes ?? '',
          p.created_at ?? new Date().toISOString(),
          p.received_at ?? null
        );
        if (!hasPurchase.get(p.id)) continue;
        const legacyItems = legacyItemsByPurchase.all(p.id);
        for (const it of legacyItems) {
          if (!hasMedicine.get(it.medicine_id)) continue;
          insertPurchaseItem.run(
            it.id,
            it.purchase_id,
            it.medicine_id,
            it.batch_no ?? '',
            it.expiry_date ?? '',
            Number(it.quantity_packs) || 0,
            Number(it.tablets_per_pack) || 1,
            Number(it.quantity_tablets) || 0,
            Number(it.unit_cost_per_tablet) || 0,
            Number(it.line_total) || 0,
            it.created_at ?? new Date().toISOString()
          );
        }
      }
    });
    tx();
  } finally {
    legacyDb.close();
    targetDb.close();
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
  db.pragma('synchronous = NORMAL');
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
