import { logger } from '../logger';
import { isFeatureEnabled } from '../features';

type Prepared = {
  run: (...args: unknown[]) => unknown;
  get: (...args: unknown[]) => unknown;
  all: (...args: unknown[]) => unknown;
};

type DbLike = {
  prepare: (sql: string) => Prepared;
  transaction: <T extends (...args: never[]) => unknown>(fn: T) => T;
};

function time<T>(sql: string, op: string, fn: () => T): T {
  const start = Date.now();
  const out = fn();
  const ms = Date.now() - start;
  if (ms > 100 && isFeatureEnabled('query-performance-logs')) {
    logger.warn('Slow query detected', { ms, op, sql });
  }
  return out;
}

export function createObservedDb(db: DbLike): DbLike {
  return {
    transaction: db.transaction.bind(db),
    prepare(sql: string): Prepared {
      const stmt = db.prepare(sql);
      return {
        run: (...args: unknown[]) => time(sql, 'run', () => stmt.run(...args)),
        get: (...args: unknown[]) => time(sql, 'get', () => stmt.get(...args)),
        all: (...args: unknown[]) => time(sql, 'all', () => stmt.all(...args)),
      };
    },
  };
}
