import { z } from 'zod';
import { safePreOperationBackup } from '../../backup';
import { logDbWrite } from '../../db';
import { syncMedicinesMirror } from '../../medicinesMirrorDb';
import { idSchema } from '../validation';
import type { IpcHandlerMap } from './types';

type DbLike = {
  prepare: (sql: string) => {
    all: (...args: unknown[]) => any[];
  };
};

type Deps = {
  db: DbLike;
  updateBatch: (batchId: string, payload: Record<string, unknown>) => unknown;
  deleteBatch: (batchId: string) => unknown;
};

export function createBatchesHandlers(deps: Deps): IpcHandlerMap {
  return {
    'batches:list': (payload) => {
      const parsed = z.object({ medicineId: z.string().trim().optional() }).parse(payload ?? {});
      if (parsed.medicineId) {
        return deps.db.prepare('SELECT * FROM batches WHERE medicine_id = ? ORDER BY date(expiry_date) ASC').all(parsed.medicineId);
      }
      return deps.db.prepare('SELECT * FROM batches ORDER BY date(expiry_date) ASC').all();
    },
    'batches:update': (payload) => {
      const parsed = z.object({ id: idSchema, body: z.record(z.string(), z.unknown()) }).parse(payload ?? {});
      logDbWrite('batches:update', { id: parsed.id });
      const updated = deps.updateBatch(parsed.id, parsed.body as Record<string, unknown>);
      syncMedicinesMirror(deps.db);
      return updated;
    },
    'batches:remove': (payload) => {
      const id = idSchema.parse(payload);
      safePreOperationBackup('pre-delete-batch-');
      logDbWrite('batches:remove', { id });
      const removed = deps.deleteBatch(id);
      syncMedicinesMirror(deps.db);
      return removed;
    },
  };
}
