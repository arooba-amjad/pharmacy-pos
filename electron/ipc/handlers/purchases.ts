import { z } from 'zod';
import { safePreOperationBackup } from '../../backup';
import { logDbWrite } from '../../db';
import { runInTransaction } from '../transaction';
import { idSchema, purchaseCreateSchema } from '../validation';
import type { IpcHandlerMap } from './types';

type DbLike = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => { changes: number };
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => any[];
  };
  transaction: <T extends (...args: never[]) => unknown>(fn: T) => T;
};

type Deps = {
  db: DbLike;
  createPendingPurchase: (payload: Record<string, unknown>) => unknown;
  getPurchaseById: (purchaseId: string) => unknown;
  receivePurchase: (purchaseId: string) => unknown;
};

export function createPurchasesHandlers(deps: Deps): IpcHandlerMap {
  return {
    'purchases:list': (payload) => {
      const includeItems = z.object({ includeItems: z.boolean().optional().default(false) }).parse(payload ?? {}).includeItems;
      if (!includeItems) return deps.db.prepare('SELECT * FROM purchases ORDER BY created_at DESC').all();
      const rows = deps.db.prepare('SELECT * FROM purchases ORDER BY created_at DESC').all() as Array<{ id: string }>;
      return rows.map((row) => deps.getPurchaseById(row.id));
    },
    'purchases:get': (payload) => deps.getPurchaseById(idSchema.parse(payload)),
    'purchases:create': (payload) => {
      const parsed = purchaseCreateSchema.parse(payload ?? {}) as Record<string, unknown>;
      logDbWrite('purchases:create', { supplierId: parsed.supplierId });
      return runInTransaction(deps.db, () => deps.createPendingPurchase(parsed));
    },
    'purchases:update': (payload) => {
      const parsed = z.object({ id: idSchema, body: z.record(z.string(), z.unknown()) }).parse(payload ?? {});
      void parsed.body;
      return deps.getPurchaseById(parsed.id);
    },
    'purchases:receive': (payload) => deps.receivePurchase(idSchema.parse(payload)),
    'purchases:remove': (payload) => {
      const id = idSchema.parse(payload);
      safePreOperationBackup('pre-delete-purchase-');
      logDbWrite('purchases:remove', { id });
      return runInTransaction(deps.db, () => {
        const purchase = deps.db
          .prepare('SELECT id FROM purchases WHERE id = ?')
          .get(id) as { id: string } | undefined;
        if (!purchase) throw new Error('Purchase not found.');

        deps.db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
        return { deleted: true };
      });
    },
  };
}
