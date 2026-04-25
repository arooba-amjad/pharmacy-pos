import { z } from 'zod';
import { safePreOperationBackup } from '../../backup';
import { logDbWrite } from '../../db';
import { runInTransaction } from '../transaction';
import { idSchema, saleCreateSchema } from '../validation';
import type { IpcHandlerMap } from './types';
import { SalesRepo } from '../repos/salesRepo';

type DbLike = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => { changes: number };
    get: (...args: unknown[]) => any;
    all: (...args: unknown[]) => any[];
  };
  transaction: <T extends (...args: never[]) => unknown>(fn: T) => T;
};

type Deps = {
  db: DbLike;
  createSale: (payload: Record<string, unknown>) => unknown;
  reverseSale: (saleId: string) => unknown;
};

export function createSalesHandlers(deps: Deps): IpcHandlerMap {
  const repo = new SalesRepo(deps.db);
  return {
    'sales:list': (payload) => {
      const includeItems = z.object({ includeItems: z.boolean().optional().default(false) }).parse(payload ?? {}).includeItems;
      if (!includeItems) return repo.listSales();
      const rows = repo.listSales() as Array<{ id: string }>;
      return rows.map((row) => ({
        ...row,
        items: repo.saleItems(row.id),
      }));
    },
    'sales:get': (payload) => {
      const id = idSchema.parse(payload);
      const sale = repo.saleById(id) as { id: string } | undefined;
      if (!sale) throw new Error('Sale not found.');
      return { ...sale, items: repo.saleItems(id) };
    },
    'sales:create': (payload) => {
      const parsed = saleCreateSchema.parse(payload ?? {}) as Record<string, unknown>;
      logDbWrite('sales:create', { itemCount: (parsed.items as unknown[]).length });
      return runInTransaction(deps.db, () => deps.createSale(parsed));
    },
    'sales:remove': (payload) => {
      const id = idSchema.parse(payload);
      safePreOperationBackup('pre-delete-sale-');
      logDbWrite('sales:remove', { id });
      return deps.reverseSale(id);
    },
  };
}
