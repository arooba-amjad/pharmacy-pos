import { z } from 'zod';
import { safePreOperationBackup } from '../../backup';
import { logDbWrite } from '../../db';
import { customerUpsertSchema, idSchema, supplierUpsertSchema } from '../validation';
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

export function createSuppliersHandlers(deps: Deps): IpcHandlerMap {
  const { db, nowIso, generateId } = deps;
  return {
    'suppliers:list': () => db.prepare('SELECT * FROM suppliers ORDER BY name COLLATE NOCASE').all(),
    'suppliers:create': (payload) => {
      const body = supplierUpsertSchema.parse(payload ?? {});
      const id = body.id ?? generateId('sup');
      logDbWrite('suppliers:create', { id, name: body.name });
      db.prepare(
        `INSERT INTO suppliers (id, name, phone, company, address, balance_payable, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
      ).run(id, body.name, body.phone, body.company, body.address, nowIso(), nowIso());
      return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    },
    'suppliers:update': (payload) => {
      const parsed = z.object({ id: idSchema, body: supplierUpsertSchema.partial() }).parse(payload ?? {});
      logDbWrite('suppliers:update', { id: parsed.id });
      const info = db.prepare(
        `UPDATE suppliers SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         company = COALESCE(?, company),
         address = COALESCE(?, address),
         updated_at = ?
         WHERE id = ?`
      ).run(parsed.body.name ?? null, parsed.body.phone ?? null, parsed.body.company ?? null, parsed.body.address ?? null, nowIso(), parsed.id);
      if (!info.changes) throw new Error('Supplier not found.');
      return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(parsed.id);
    },
    'suppliers:remove': (payload) => {
      const id = idSchema.parse(payload);
      safePreOperationBackup('pre-delete-supplier-');
      logDbWrite('suppliers:remove', { id });
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
      return { deleted: true };
    },

    'manufacturers:list': () => db.prepare('SELECT * FROM manufacturers ORDER BY name COLLATE NOCASE').all(),
    'manufacturers:create': (payload) => {
      const body = supplierUpsertSchema.parse(payload ?? {});
      const id = body.id ?? generateId('man');
      logDbWrite('manufacturers:create', { id, name: body.name });
      db.prepare(
        `INSERT INTO manufacturers (id, name, phone, company, address, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, body.name, body.phone, body.company, body.address, nowIso(), nowIso());
      return db.prepare('SELECT * FROM manufacturers WHERE id = ?').get(id);
    },
    'manufacturers:update': (payload) => {
      const parsed = z.object({ id: idSchema, body: supplierUpsertSchema.partial() }).parse(payload ?? {});
      logDbWrite('manufacturers:update', { id: parsed.id });
      const info = db.prepare(
        `UPDATE manufacturers SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         company = COALESCE(?, company),
         address = COALESCE(?, address),
         updated_at = ?
         WHERE id = ?`
      ).run(parsed.body.name ?? null, parsed.body.phone ?? null, parsed.body.company ?? null, parsed.body.address ?? null, nowIso(), parsed.id);
      if (!info.changes) throw new Error('Manufacturer not found.');
      return db.prepare('SELECT * FROM manufacturers WHERE id = ?').get(parsed.id);
    },
    'manufacturers:remove': (payload) => {
      const id = idSchema.parse(payload);
      safePreOperationBackup('pre-delete-manufacturer-');
      logDbWrite('manufacturers:remove', { id });
      db.prepare('DELETE FROM manufacturers WHERE id = ?').run(id);
      return { deleted: true };
    },

    'customers:list': () => db.prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE').all(),
    'customers:create': (payload) => {
      const body = customerUpsertSchema.parse(payload ?? {});
      const id = body.id ?? generateId('cus');
      logDbWrite('customers:create', { id, name: body.name });
      db.prepare(
        `INSERT INTO customers (id, name, phone, address, credit_limit, balance_due, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, body.name, body.phone, body.address, body.creditLimit, body.balanceDue, nowIso(), nowIso());
      return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    },
    'customers:update': (payload) => {
      const parsed = z.object({ id: idSchema, body: customerUpsertSchema.partial() }).parse(payload ?? {});
      logDbWrite('customers:update', { id: parsed.id });
      const info = db.prepare(
        `UPDATE customers SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         address = COALESCE(?, address),
         credit_limit = COALESCE(?, credit_limit),
         balance_due = COALESCE(?, balance_due),
         updated_at = ?
         WHERE id = ?`
      ).run(
        parsed.body.name ?? null,
        parsed.body.phone ?? null,
        parsed.body.address ?? null,
        parsed.body.creditLimit ?? null,
        parsed.body.balanceDue ?? null,
        nowIso(),
        parsed.id
      );
      if (!info.changes) throw new Error('Customer not found.');
      return db.prepare('SELECT * FROM customers WHERE id = ?').get(parsed.id);
    },
    'customers:remove': (payload) => {
      const id = idSchema.parse(payload);
      safePreOperationBackup('pre-delete-customer-');
      logDbWrite('customers:remove', { id });
      db.prepare('DELETE FROM customers WHERE id = ?').run(id);
      return { deleted: true };
    },
    'customers:payBalance': (payload) => {
      const parsed = z.object({ id: idSchema, amount: z.coerce.number().min(0) }).parse(payload ?? {});
      logDbWrite('customers:payBalance', { id: parsed.id, amount: parsed.amount });
      db.prepare('UPDATE customers SET balance_due = MAX(0, balance_due - ?), updated_at = ? WHERE id = ?').run(parsed.amount, nowIso(), parsed.id);
      return db.prepare('SELECT * FROM customers WHERE id = ?').get(parsed.id);
    },
  };
}
