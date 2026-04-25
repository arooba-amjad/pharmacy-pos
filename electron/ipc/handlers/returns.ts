import { z } from 'zod';
import { runInTransaction } from '../transaction';
import { idSchema } from '../validation';
import { logDbWrite } from '../../db';
import type { IpcHandlerMap } from './types';

type DbLike = {
  prepare: (sql: string) => {
    get: (...args: unknown[]) => any;
    all: (...args: unknown[]) => any[];
  };
  transaction: <T extends (...args: never[]) => unknown>(fn: T) => T;
};

type Deps = {
  db: DbLike;
  createReturn: (payload: Record<string, unknown>) => unknown;
};

export function createReturnsHandlers(deps: Deps): IpcHandlerMap {
  return {
    'returns:list': (payload) => {
      const includeItems = z.object({ includeItems: z.boolean().optional().default(false) }).parse(payload ?? {}).includeItems;
      if (!includeItems) return deps.db.prepare('SELECT * FROM returns ORDER BY created_at DESC').all();
      const rows = deps.db.prepare('SELECT * FROM returns ORDER BY created_at DESC').all() as Array<{ id: string }>;
      return rows.map((row) => ({
        ...row,
        items: deps.db.prepare('SELECT * FROM return_items WHERE return_id = ? ORDER BY created_at ASC').all(row.id),
      }));
    },
    'returns:get': (payload) => {
      const id = idSchema.parse(payload);
      const row = deps.db.prepare('SELECT * FROM returns WHERE id = ?').get(id) as { id: string } | undefined;
      if (!row) throw new Error('Return not found.');
      return { ...row, items: deps.db.prepare('SELECT * FROM return_items WHERE return_id = ? ORDER BY created_at ASC').all(id) };
    },
    'returns:create': (payload) => {
      const parsed = (payload ?? {}) as Record<string, unknown>;
      logDbWrite('returns:create');
      return runInTransaction(deps.db, () => deps.createReturn(parsed));
    },
  };
}
