import { z } from 'zod';
import { safePreOperationBackup } from '../../backup';
import { logDbWrite } from '../../db';
import { syncMedicinesMirror } from '../../medicinesMirrorDb';
import { logger } from '../../logger';
import { MedicineRepo } from '../repos/medicineRepo';
import { batchCreateSchema, idSchema, medicineCreateSchema, medicineUpdateSchema } from '../validation';
import type { IpcHandlerMap } from './types';

type DbLike = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => { changes: number };
    get: (...args: unknown[]) => any;
    all: (...args: unknown[]) => any[];
  };
};

type Deps = {
  db: DbLike;
  nowIso: () => string;
  generateId: (prefix: string) => string;
};

export function createMedicinesHandlers(deps: Deps): IpcHandlerMap {
  const { db, nowIso, generateId } = deps;
  const repo = new MedicineRepo(db);
  return {
    'medicines:list': () => {
      const medicines = repo.listActive();
      const batches = repo.listBatches();
      const byMedicine = new Map<string, unknown[]>();
      for (const row of batches as Array<{ medicine_id: string }>) {
        const current = byMedicine.get(row.medicine_id) ?? [];
        current.push(row);
        byMedicine.set(row.medicine_id, current);
      }
      return (medicines as Array<{ id: string }>).map((m) => ({ ...m, batches: byMedicine.get(m.id) ?? [] }));
    },

    'medicines:create': (payload) => {
      const body = medicineCreateSchema.parse(payload ?? {});
      const id = body.id ?? generateId('med');
      logDbWrite('medicines:create', { id, name: body.name });
      db.prepare(
        `INSERT INTO medicines
        (id, name, generic, type, category, unit_type, unit, tablets_per_pack, volume_ml, supplier_id, supplier_name, manufacturer_id, manufacturer_name, low_stock_threshold, purchase_per_pack, sale_per_pack, total_stock_tablets, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
      ).run(
        id,
        body.name,
        body.generic,
        body.type,
        body.category,
        body.unitType,
        body.unit,
        body.tabletsPerPack,
        body.volumeMl,
        body.supplierId ?? null,
        body.supplierName,
        body.manufacturerId ?? null,
        body.manufacturerName,
        body.lowStockThreshold,
        body.purchasePerPack,
        body.salePerPack,
        nowIso(),
        nowIso()
      );
      syncMedicinesMirror(db);
      return repo.byId(id);
    },

    'medicines:update': (payload) => {
      const parsed = z.object({ id: idSchema, body: medicineUpdateSchema }).parse(payload ?? {});
      logDbWrite('medicines:update', { id: parsed.id });
      const info = db.prepare(
        `UPDATE medicines SET
         name = COALESCE(?, name),
         generic = COALESCE(?, generic),
         category = COALESCE(?, category),
         unit = COALESCE(?, unit),
         tablets_per_pack = COALESCE(?, tablets_per_pack),
         low_stock_threshold = COALESCE(?, low_stock_threshold),
         purchase_per_pack = COALESCE(?, purchase_per_pack),
         sale_per_pack = COALESCE(?, sale_per_pack),
         updated_at = ?
         WHERE id = ?`
      ).run(
        parsed.body.name ?? null,
        parsed.body.generic ?? null,
        parsed.body.category ?? null,
        parsed.body.unit ?? null,
        parsed.body.tabletsPerPack ?? null,
        parsed.body.lowStockThreshold ?? null,
        parsed.body.purchasePerPack ?? null,
        parsed.body.salePerPack ?? null,
        nowIso(),
        parsed.id
      );
      if (!info.changes) throw new Error('Medicine not found.');
      syncMedicinesMirror(db);
      return repo.byId(parsed.id);
    },

    'medicines:remove': (payload) => {
      const id = idSchema.parse(payload);
      safePreOperationBackup('pre-delete-medicine-');
      logDbWrite('medicines:remove', { id });
      db.prepare('UPDATE medicines SET is_active = 0, updated_at = ? WHERE id = ?').run(nowIso(), id);
      syncMedicinesMirror(db);
      logger.info('Medicine soft-deleted', { id });
      return { deleted: true };
    },

    'medicines:addBatch': (payload) => {
      const parsed = z.object({ medicineId: idSchema, body: batchCreateSchema }).parse(payload ?? {});
      const rowId = parsed.body.id ?? generateId('bat');
      logDbWrite('medicines:addBatch', { medicineId: parsed.medicineId, batchId: rowId });
      db.prepare(
        `INSERT INTO batches
        (id, medicine_id, batch_no, expiry_date, quantity_tablets, cost_price_per_tablet, sale_price_per_tablet, sale_price_per_pack, received_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        rowId,
        parsed.medicineId,
        parsed.body.batchNo,
        parsed.body.expiryDate,
        parsed.body.quantityTablets,
        parsed.body.costPricePerTablet,
        parsed.body.salePricePerTablet,
        parsed.body.salePricePerPack,
        nowIso()
      );
      syncMedicinesMirror(db);
      return db.prepare('SELECT * FROM batches WHERE id = ?').get(rowId);
    },
  };
}
