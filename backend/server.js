import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import {
  createBackupFile,
  listBackupFiles,
  assertSafeBackupFileName,
  removeWalSidecars,
  getBackupStorageDirectory,
} from './backup.js';
import { db, generateId, nowIso, closeDatabase, reopenDatabase, getDbFilePath } from './db.js';
import {
  createPendingPurchase,
  createReturn,
  createSale,
  deleteBatch,
  getPurchaseById,
  receivePurchase,
  reverseSale,
  updateBatch,
} from './services.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function ok(res, data, status = 200) {
  res.status(status).json({ ok: true, success: true, data });
}

function fail(res, message, status = 400) {
  res.status(status).json({ ok: false, success: false, error: message });
}

app.get('/health', (_req, res) => ok(res, { status: 'up', time: nowIso() }));

// --- Admin: backup / restore (lock down in production, e.g. auth or localhost-only) ---
app.get('/api/admin/backups', (_req, res) => {
  try {
    const dbPath = getDbFilePath();
    const dir = getBackupStorageDirectory();
    ok(res, { directory: dir, files: listBackupFiles(dir), database: dbPath });
  } catch (err) {
    fail(res, String(err?.message ?? err), 500);
  }
});

app.post('/api/admin/backup', (_req, res) => {
  try {
    const dest = createBackupFile(getDbFilePath());
    ok(res, { path: dest });
  } catch (err) {
    fail(res, String(err?.message ?? err), 500);
  }
});

// After success, Electron renderers should call `window.electronAPI?.reloadApp?.()` so the UI reconnects to the reopened DB.
app.post('/api/admin/restore', (req, res) => {
  let closed = false;
  try {
    const fileName = assertSafeBackupFileName(String(req.body?.fileName ?? ''));
    const dbPath = getDbFilePath();
    const full = path.join(getBackupStorageDirectory(), fileName);
    if (!fs.existsSync(full)) return fail(res, 'Backup not found.', 404);
    closeDatabase();
    closed = true;
    removeWalSidecars(dbPath);
    fs.copyFileSync(full, dbPath);
    reopenDatabase();
    ok(res, { restored: true, reloadRecommended: true });
  } catch (err) {
    try {
      if (closed) reopenDatabase();
    } catch (reopenErr) {
      // eslint-disable-next-line no-console
      console.error('Failed to reopen database after restore error:', reopenErr);
    }
    fail(res, String(err?.message ?? err), 500);
  }
});

app.get('/api/medicines', (_req, res) => {
  const medicines = db.prepare('SELECT * FROM medicines WHERE is_active = 1 ORDER BY name COLLATE NOCASE').all();
  const batches = db.prepare('SELECT * FROM batches ORDER BY date(expiry_date) ASC').all();
  const byMedicine = new Map();
  for (const b of batches) {
    const arr = byMedicine.get(b.medicine_id) ?? [];
    arr.push(b);
    byMedicine.set(b.medicine_id, arr);
  }
  const rows = medicines.map((m) => ({ ...m, batches: byMedicine.get(m.id) ?? [] }));
  ok(res, rows);
});

app.post('/api/medicines', (req, res) => {
  try {
    const body = req.body ?? {};
    const id = body.id || generateId('med');
    const name = String(body.name ?? '').trim();
    if (!name) return fail(res, 'Medicine name is required.');

    db.prepare(
      `INSERT INTO medicines
      (id, name, generic, type, category, unit_type, unit, tablets_per_pack, volume_ml, supplier_id, supplier_name, manufacturer_id, manufacturer_name, low_stock_threshold, purchase_per_pack, sale_per_pack, total_stock_tablets, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)`
    ).run(
      id,
      name,
      String(body.generic ?? ''),
      String(body.type ?? 'tablet'),
      String(body.category ?? ''),
      String(body.unitType ?? 'tablet'),
      String(body.unit ?? 'Tablet'),
      Math.max(1, Number(body.tabletsPerPack ?? 1)),
      Number(body.volumeMl ?? 0),
      body.supplierId ?? null,
      String(body.supplierName ?? ''),
      body.manufacturerId ?? null,
      String(body.manufacturerName ?? ''),
      Math.max(0, Number(body.lowStockThreshold ?? 0)),
      Math.max(0, Number(body.purchasePerPack ?? 0)),
      Math.max(0, Number(body.salePerPack ?? 0)),
      nowIso(),
      nowIso()
    );
    ok(res, db.prepare('SELECT * FROM medicines WHERE id = ?').get(id), 201);
  } catch (err) {
    fail(res, err.message);
  }
});

app.post('/api/medicines/:id/batches', (req, res) => {
  try {
    const medicineId = req.params.id;
    const med = db.prepare('SELECT id, tablets_per_pack, sale_per_pack FROM medicines WHERE id = ?').get(medicineId);
    if (!med) return fail(res, 'Medicine not found.', 404);
    const body = req.body ?? {};
    const batchNo = String(body.batchNo ?? '').trim();
    if (!batchNo) return fail(res, 'Batch number is required.');
    const expiryDate = String(body.expiryDate ?? '');
    if (!expiryDate) return fail(res, 'Expiry date is required.');
    const qtyTablets = Math.max(0, Math.floor(Number(body.quantityTablets) || 0));
    const tpp = Math.max(1, Number(med.tablets_per_pack) || 1);
    const salePack = Number(body.salePricePerPack ?? med.sale_per_pack ?? 0);
    const salePt = Number(body.salePricePerTablet ?? (tpp >= 2 ? salePack / tpp : salePack));
    const costPt = Math.max(0, Number(body.costPricePerTablet ?? 0));
    const existing = db
      .prepare('SELECT id FROM batches WHERE medicine_id = ? AND batch_no = ?')
      .get(medicineId, batchNo);
    if (existing) {
      db.prepare(
        `UPDATE batches SET
          expiry_date = ?,
          quantity_tablets = quantity_tablets + ?,
          cost_price_per_tablet = ?,
          sale_price_per_tablet = ?,
          sale_price_per_pack = ?
         WHERE id = ?`
      ).run(expiryDate, qtyTablets, costPt, salePt, salePack, existing.id);
      const row = db.prepare('SELECT * FROM batches WHERE id = ?').get(existing.id);
      db.prepare(
        'UPDATE medicines SET total_stock_tablets = COALESCE((SELECT SUM(quantity_tablets) FROM batches WHERE medicine_id = ?), 0), updated_at = ? WHERE id = ?'
      ).run(medicineId, nowIso(), medicineId);
      return ok(res, row, 201);
    }
    const id = body.id || generateId('bat');
    db.prepare(
      `INSERT INTO batches
      (id, medicine_id, batch_no, expiry_date, quantity_tablets, cost_price_per_tablet, sale_price_per_tablet, sale_price_per_pack, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, medicineId, batchNo, expiryDate, qtyTablets, costPt, salePt, salePack, nowIso());
    db.prepare(
      'UPDATE medicines SET total_stock_tablets = COALESCE((SELECT SUM(quantity_tablets) FROM batches WHERE medicine_id = ?), 0), updated_at = ? WHERE id = ?'
    ).run(medicineId, nowIso(), medicineId);
    ok(res, db.prepare('SELECT * FROM batches WHERE id = ?').get(id), 201);
  } catch (err) {
    fail(res, err.message);
  }
});

app.put('/api/medicines/:id', (req, res) => {
  try {
    const id = req.params.id;
    const exists = db.prepare('SELECT id FROM medicines WHERE id = ?').get(id);
    if (!exists) return fail(res, 'Medicine not found.', 404);
    const body = req.body ?? {};
    db.prepare(
      `UPDATE medicines SET
        name = COALESCE(?, name),
        generic = COALESCE(?, generic),
        type = COALESCE(?, type),
        category = COALESCE(?, category),
        unit_type = COALESCE(?, unit_type),
        unit = COALESCE(?, unit),
        tablets_per_pack = COALESCE(?, tablets_per_pack),
        volume_ml = COALESCE(?, volume_ml),
        supplier_id = COALESCE(?, supplier_id),
        supplier_name = COALESCE(?, supplier_name),
        manufacturer_id = COALESCE(?, manufacturer_id),
        manufacturer_name = COALESCE(?, manufacturer_name),
        low_stock_threshold = COALESCE(?, low_stock_threshold),
        purchase_per_pack = COALESCE(?, purchase_per_pack),
        sale_per_pack = COALESCE(?, sale_per_pack),
        updated_at = ?
      WHERE id = ?`
    ).run(
      body.name ?? null,
      body.generic ?? null,
      body.type ?? null,
      body.category ?? null,
      body.unitType ?? null,
      body.unit ?? null,
      body.tabletsPerPack ?? null,
      body.volumeMl ?? null,
      body.supplierId ?? null,
      body.supplierName ?? null,
      body.manufacturerId ?? null,
      body.manufacturerName ?? null,
      body.lowStockThreshold ?? null,
      body.purchasePerPack ?? null,
      body.salePerPack ?? null,
      nowIso(),
      id
    );
    ok(res, db.prepare('SELECT * FROM medicines WHERE id = ?').get(id));
  } catch (err) {
    fail(res, err.message);
  }
});

app.delete('/api/medicines/:id', (req, res) => {
  try {
    const id = req.params.id;
    const deps = db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM batches WHERE medicine_id = ?) AS batch_count,
          (SELECT COUNT(*) FROM purchase_items WHERE medicine_id = ?) AS purchase_count,
          (SELECT COUNT(*) FROM sale_items WHERE medicine_id = ?) AS sale_count`
      )
      .get(id, id, id);
    if (!deps) return fail(res, 'Medicine not found.', 404);
    if (deps.batch_count > 0 || deps.purchase_count > 0 || deps.sale_count > 0) {
      return fail(res, 'Cannot delete medicine because it is linked to stock/purchases/sales.', 409);
    }
    const info = db.prepare('DELETE FROM medicines WHERE id = ?').run(id);
    if (!info.changes) return fail(res, 'Medicine not found.', 404);
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, err.message);
  }
});

function registerPartyRoutes(entity, table, dependencyChecks) {
  app.get(`/api/${entity}`, (_req, res) => {
    ok(res, db.prepare(`SELECT * FROM ${table} ORDER BY name COLLATE NOCASE`).all());
  });

  app.post(`/api/${entity}`, (req, res) => {
    try {
      const body = req.body ?? {};
      const name = String(body.name ?? '').trim();
      if (!name) return fail(res, 'Name is required.');
      const exists = db.prepare(`SELECT id FROM ${table} WHERE lower(name) = lower(?)`).get(name);
      if (exists) return fail(res, `${entity.slice(0, -1)} already exists.`, 409);
      const id = body.id || generateId(table.slice(0, 3));
      db.prepare(
        `INSERT INTO ${table} (id, name, phone, company, address, created_at, updated_at${table === 'suppliers' ? ', balance_payable' : ''})
         VALUES (?, ?, ?, ?, ?, ?, ?${table === 'suppliers' ? ', 0' : ''})`
      ).run(id, name, String(body.phone ?? ''), String(body.company ?? ''), String(body.address ?? ''), nowIso(), nowIso());
      ok(res, db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id), 201);
    } catch (err) {
      fail(res, err.message);
    }
  });

  app.put(`/api/${entity}/:id`, (req, res) => {
    try {
      const id = req.params.id;
      const body = req.body ?? {};
      const info = db
        .prepare(
          `UPDATE ${table} SET
           name = COALESCE(?, name),
           phone = COALESCE(?, phone),
           company = COALESCE(?, company),
           address = COALESCE(?, address),
           updated_at = ?
           WHERE id = ?`
        )
        .run(body.name ?? null, body.phone ?? null, body.company ?? null, body.address ?? null, nowIso(), id);
      if (!info.changes) return fail(res, `${entity.slice(0, -1)} not found.`, 404);
      ok(res, db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id));
    } catch (err) {
      fail(res, err.message);
    }
  });

  app.delete(`/api/${entity}/:id`, (req, res) => {
    try {
      const id = req.params.id;
      for (const dep of dependencyChecks) {
        const count = db.prepare(dep.query).get(id).c;
        if (count > 0) return fail(res, dep.message, 409);
      }
      const info = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
      if (!info.changes) return fail(res, `${entity.slice(0, -1)} not found.`, 404);
      ok(res, { deleted: true });
    } catch (err) {
      fail(res, err.message);
    }
  });
}

registerPartyRoutes('suppliers', 'suppliers', [
  { query: 'SELECT COUNT(*) AS c FROM purchases WHERE supplier_id = ?', message: 'Supplier has linked purchases.' },
  { query: 'SELECT COUNT(*) AS c FROM medicines WHERE supplier_id = ?', message: 'Supplier is linked to medicines.' },
]);

registerPartyRoutes('manufacturers', 'manufacturers', [
  { query: 'SELECT COUNT(*) AS c FROM medicines WHERE manufacturer_id = ?', message: 'Manufacturer is linked to medicines.' },
]);

app.get('/api/customers', (_req, res) => {
  ok(res, db.prepare('SELECT * FROM customers ORDER BY name COLLATE NOCASE').all());
});

app.post('/api/customers', (req, res) => {
  try {
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    if (!name) return fail(res, 'Customer name is required.');
    const id = body.id || generateId('cus');
    const row = {
      id,
      name,
      phone: String(body.phone ?? ''),
      address: String(body.address ?? ''),
      creditLimit: Math.max(0, Number(body.creditLimit ?? 0)),
      balanceDue: Math.max(0, Number(body.balanceDue ?? 0)),
    };
    db.prepare(
      `INSERT INTO customers (id, name, phone, address, credit_limit, balance_due, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(row.id, row.name, row.phone, row.address, row.creditLimit, row.balanceDue, nowIso(), nowIso());
    ok(res, db.prepare('SELECT * FROM customers WHERE id = ?').get(row.id), 201);
  } catch (err) {
    fail(res, err.message);
  }
});

app.put('/api/customers/:id', (req, res) => {
  try {
    const id = req.params.id;
    const body = req.body ?? {};
    const info = db
      .prepare(
        `UPDATE customers SET
         name = COALESCE(?, name),
         phone = COALESCE(?, phone),
         address = COALESCE(?, address),
         credit_limit = COALESCE(?, credit_limit),
         balance_due = COALESCE(?, balance_due),
         last_purchase_at = COALESCE(?, last_purchase_at),
         updated_at = ?
         WHERE id = ?`
      )
      .run(
        body.name ?? null,
        body.phone ?? null,
        body.address ?? null,
        body.creditLimit ?? null,
        body.balanceDue ?? null,
        body.lastPurchaseAt ?? null,
        nowIso(),
        id
      );
    if (!info.changes) return fail(res, 'Customer not found.', 404);
    ok(res, db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
  } catch (err) {
    fail(res, err.message);
  }
});

app.delete('/api/customers/:id', (req, res) => {
  try {
    const id = req.params.id;
    const info = db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    if (!info.changes) return fail(res, 'Customer not found.', 404);
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, err.message);
  }
});

app.post('/api/customers/:id/payments', (req, res) => {
  try {
    const id = req.params.id;
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return fail(res, 'Payment amount must be greater than zero.');
    }
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!customer) return fail(res, 'Customer not found.', 404);
    const current = Number(customer.balance_due) || 0;
    if (amount > current + 1e-6) return fail(res, 'Amount cannot exceed outstanding balance.');
    const next = Math.max(0, Math.round((current - amount) * 100) / 100);
    db.prepare('UPDATE customers SET balance_due = ?, updated_at = ? WHERE id = ?').run(next, nowIso(), id);
    ok(res, db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
  } catch (err) {
    fail(res, err.message);
  }
});

app.get('/api/purchases', (_req, res) => {
  const includeItems = String(_req.query.includeItems ?? '') === '1';
  const rows = db.prepare('SELECT * FROM purchases ORDER BY datetime(created_at) DESC').all();
  if (!includeItems) return ok(res, rows);
  const data = rows.map((p) => {
    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY created_at ASC').all(p.id);
    return { ...p, items };
  });
  ok(res, data);
});

app.get('/api/purchases/:id', (req, res) => {
  const data = getPurchaseById(req.params.id);
  if (!data) return fail(res, 'Purchase not found.', 404);
  ok(res, data);
});

app.post('/api/purchases', (req, res) => {
  try {
    ok(res, createPendingPurchase(req.body ?? {}), 201);
  } catch (err) {
    const msg = String(err?.message ?? '');
    if (msg.toLowerCase().includes('foreign key')) {
      return fail(res, 'Purchase failed: invalid supplier or medicine reference');
    }
    fail(res, msg || 'Purchase failed: invalid supplier or medicine reference');
  }
});

app.put('/api/purchases/:id', (req, res) => {
  try {
    const id = req.params.id;
    const exists = db.prepare('SELECT id, status FROM purchases WHERE id = ?').get(id);
    if (!exists) return fail(res, 'Purchase not found.', 404);
    if (exists.status !== 'pending') return fail(res, 'Only pending purchases can be updated.', 409);

    const body = req.body ?? {};
    const supplier = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(body.supplierId);
    if (!supplier) return fail(res, 'Supplier not found.', 404);
    if (!Array.isArray(body.items) || body.items.length === 0) return fail(res, 'Purchase items are required.');

    db.transaction(() => {
      db.prepare('DELETE FROM purchase_items WHERE purchase_id = ?').run(id);
      let subtotal = 0;
      for (const item of body.items) {
        const med = db.prepare('SELECT id, tablets_per_pack FROM medicines WHERE id = ?').get(item.medicineId);
        if (!med) throw new Error(`Medicine not found: ${item.medicineId}`);
        const packs = Math.max(1, Math.floor(Number(item.quantityPacks) || 0));
        const tpp = Math.max(1, Number(item.tabletsPerPack) || Number(med.tablets_per_pack) || 1);
        const qtyTablets = packs * tpp;
        const unitCost = Math.max(0, Number(item.unitCostPerTablet) || 0);
        const lineTotal = qtyTablets * unitCost;
        subtotal += lineTotal;
        db.prepare(
          `INSERT INTO purchase_items
          (id, purchase_id, medicine_id, batch_no, expiry_date, quantity_packs, tablets_per_pack, quantity_tablets, unit_cost_per_tablet, line_total, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          generateId('pit'),
          id,
          item.medicineId,
          String(item.batchNo ?? ''),
          String(item.expiryDate ?? ''),
          packs,
          tpp,
          qtyTablets,
          unitCost,
          lineTotal,
          nowIso()
        );
      }
      const tax = Math.max(0, Number(body.tax) || 0);
      const discount = Math.max(0, Number(body.discount) || 0);
      const total = subtotal + tax - discount;
      db.prepare(
        `UPDATE purchases SET
          supplier_id = ?, supplier_name = ?, subtotal = ?, tax = ?, discount = ?, total = ?,
          purchase_date = ?, grn_no = ?, notes = ?
         WHERE id = ?`
      ).run(
        supplier.id,
        supplier.name,
        subtotal,
        tax,
        discount,
        total,
        String(body.purchaseDate ?? nowIso()),
        String(body.grnNo ?? ''),
        String(body.notes ?? ''),
        id
      );
    })();
    ok(res, getPurchaseById(id));
  } catch (err) {
    fail(res, err.message);
  }
});

app.delete('/api/purchases/:id', (req, res) => {
  try {
    const id = req.params.id;
    const row = db.prepare('SELECT status FROM purchases WHERE id = ?').get(id);
    if (!row) return fail(res, 'Purchase not found.', 404);
    if (row.status !== 'pending') return fail(res, 'Only pending purchases can be deleted.', 409);
    db.prepare('DELETE FROM purchases WHERE id = ?').run(id);
    ok(res, { deleted: true });
  } catch (err) {
    fail(res, err.message);
  }
});

app.post('/api/purchases/:id/receive', (req, res) => {
  try {
    ok(res, receivePurchase(req.params.id));
  } catch (err) {
    fail(res, err.message);
  }
});

app.get('/api/sales', (_req, res) => {
  const includeItems = String(_req.query.includeItems ?? '') === '1';
  const rows = db.prepare('SELECT * FROM sales ORDER BY datetime(created_at) DESC').all();
  if (!includeItems) return ok(res, rows);
  const data = rows.map((s) => {
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ? ORDER BY created_at ASC').all(s.id);
    return { ...s, items };
  });
  ok(res, data);
});

app.get('/api/sales/:id', (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return fail(res, 'Sale not found.', 404);
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
  ok(res, { ...sale, items });
});

app.post('/api/sales', (req, res) => {
  try {
    ok(res, createSale(req.body ?? {}), 201);
  } catch (err) {
    fail(res, err.message);
  }
});

app.delete('/api/sales/:id', (req, res) => {
  try {
    ok(res, reverseSale(req.params.id));
  } catch (err) {
    fail(res, err.message);
  }
});

app.get('/api/returns', (_req, res) => {
  const includeItems = String(_req.query.includeItems ?? '') === '1';
  const rows = db.prepare('SELECT * FROM returns ORDER BY datetime(created_at) DESC').all();
  if (!includeItems) return ok(res, rows);
  const data = rows.map((r) => {
    const items = db.prepare('SELECT * FROM return_items WHERE return_id = ? ORDER BY created_at ASC').all(r.id);
    return { ...r, items };
  });
  ok(res, data);
});

app.get('/api/returns/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM returns WHERE id = ?').get(req.params.id);
  if (!row) return fail(res, 'Return not found.', 404);
  const items = db.prepare('SELECT * FROM return_items WHERE return_id = ? ORDER BY created_at ASC').all(req.params.id);
  ok(res, { ...row, items });
});

app.post('/api/returns', (req, res) => {
  try {
    ok(res, createReturn(req.body ?? {}), 201);
  } catch (err) {
    fail(res, err.message);
  }
});

app.get('/api/batches', (req, res) => {
  const medicineId = req.query.medicineId;
  if (medicineId) {
    return ok(
      res,
      db.prepare('SELECT * FROM batches WHERE medicine_id = ? ORDER BY date(expiry_date) ASC').all(String(medicineId))
    );
  }
  ok(res, db.prepare('SELECT * FROM batches ORDER BY date(expiry_date) ASC').all());
});

app.put('/api/batches/:id', (req, res) => {
  try {
    ok(res, updateBatch(req.params.id, req.body ?? {}));
  } catch (err) {
    fail(res, err.message);
  }
});

app.delete('/api/batches/:id', (req, res) => {
  try {
    ok(res, deleteBatch(req.params.id));
  } catch (err) {
    fail(res, err.message);
  }
});

const port = Number(process.env.POS_API_PORT || 4789);

/** Daily automatic backup (non-blocking timer). */
const DAY_MS = 24 * 60 * 60 * 1000;
const autoBackupTimer = setInterval(() => {
  try {
    createBackupFile(getDbFilePath(), { prefix: 'auto-' });
    // eslint-disable-next-line no-console
    console.log('[backup] automatic backup created');
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[backup] automatic backup skipped:', e?.message ?? e);
  }
}, DAY_MS);
if (typeof autoBackupTimer.unref === 'function') autoBackupTimer.unref();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Pharmacy POS API running on http://localhost:${port}`);
  // eslint-disable-next-line no-console
  console.log(`[db] database file: ${getDbFilePath()}`);
  // eslint-disable-next-line no-console
  console.log(`[backup] backup folder: ${getBackupStorageDirectory()}`);
});
