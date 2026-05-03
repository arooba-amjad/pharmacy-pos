import { db, generateId, nowIso } from './db.js';

function ensurePositiveInt(v, field) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${field} must be a positive integer.`);
  return n;
}

function ensureNonNegative(v, field) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be non-negative.`);
  return n;
}

function recalcMedicineStock(medicineId) {
  const row =
    db.prepare('SELECT COALESCE(SUM(quantity_tablets),0) AS qty FROM batches WHERE medicine_id = ?').get(medicineId) ?? {
      qty: 0,
    };
  db.prepare('UPDATE medicines SET total_stock_tablets = ?, updated_at = ? WHERE id = ?').run(
    Number(row.qty) || 0,
    nowIso(),
    medicineId
  );
}

function autoBatchNo(medicineId) {
  return `AUTO-${medicineId.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

function resolveSupplier(payload) {
  const supplierId = String(payload.supplierId ?? '').trim();
  const supplierName = String(payload.supplierName ?? '').trim();
  let supplier = null;
  if (supplierId) {
    supplier = db.prepare('SELECT id, name FROM suppliers WHERE id = ?').get(supplierId);
  }
  if (!supplier && supplierName) {
    supplier = db
      .prepare('SELECT id, name FROM suppliers WHERE lower(name) = lower(?)')
      .get(supplierName);
  }
  return supplier;
}

function resolveMedicine(item) {
  const medicineId = String(item.medicineId ?? '').trim();
  const medicineName = String(item.medicineName ?? '').trim();
  let med = null;
  if (medicineId) {
    med = db.prepare('SELECT id, tablets_per_pack FROM medicines WHERE id = ?').get(medicineId);
  }
  if (!med && medicineName) {
    med = db
      .prepare('SELECT id, tablets_per_pack FROM medicines WHERE lower(name) = lower(?)')
      .get(medicineName);
  }
  return med;
}

export function createPendingPurchase(payload) {
  console.log('=== PURCHASE DEBUG START ===');
  console.log('Payload:', JSON.stringify(payload, null, 2));
  const supplierIdRaw = payload?.supplierId;
  console.log('Supplier ID:', supplierIdRaw, typeof supplierIdRaw);
  const supplier = resolveSupplier(payload);
  console.log('Supplier exists:', supplier ?? null);
  if (!supplier) {
    throw new Error('Purchase failed: invalid supplier or medicine reference');
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error('Purchase items are required.');
  console.log({
    supplierId: supplier.id,
    items: payload.items,
  });

  const purchaseId = generateId('pur');
  const purchaseDate = payload.purchaseDate ?? nowIso();
  const preparedItems = [];
  let subtotal = 0;

  for (const item of payload.items) {
    console.log('Medicine ID:', item?.medicineId, typeof item?.medicineId);
    const medById = db.prepare('SELECT * FROM medicines WHERE id = ?').get(String(item?.medicineId ?? ''));
    console.log('Medicine check:', item?.medicineId, medById ?? null);
    const med = resolveMedicine(item);
    if (!med) {
      throw new Error('Purchase failed: invalid supplier or medicine reference');
    }

    const packs = ensurePositiveInt(item.quantityPacks, 'quantityPacks');
    const tpp = Math.max(1, Number(item.tabletsPerPack) || Number(med.tablets_per_pack) || 1);
    const qtyTablets = packs * tpp;
    const unitCost = ensureNonNegative(item.unitCostPerTablet ?? 0, 'unitCostPerTablet');
    const lineTotal = qtyTablets * unitCost;
    subtotal += lineTotal;
    preparedItems.push({
      id: generateId('pit'),
      medicineId: med.id,
      batchNo: String(item.batchNo ?? ''),
      expiryDate: String(item.expiryDate ?? ''),
      packs,
      tpp,
      qtyTablets,
      unitCost,
      lineTotal,
    });
  }

  const medicineIds = Array.from(new Set(preparedItems.map((x) => x.medicineId)));
  if (medicineIds.length === 0) throw new Error('Purchase failed: invalid supplier or medicine reference');
  const marks = medicineIds.map(() => '?').join(',');
  const existingMeds = db
    .prepare(`SELECT id FROM medicines WHERE id IN (${marks})`)
    .all(...medicineIds)
    .map((r) => r.id);
  if (existingMeds.length !== medicineIds.length) {
    throw new Error('Purchase failed: invalid supplier or medicine reference');
  }

  const tax = ensureNonNegative(payload.tax ?? 0, 'tax');
  const discount = ensureNonNegative(payload.discount ?? 0, 'discount');
  const total = subtotal + tax - discount;

  const createPurchaseTx = db.transaction(() => {
    db.prepare(
      `INSERT INTO purchases
      (id, supplier_id, supplier_name, status, subtotal, tax, discount, total, purchase_date, grn_no, notes, created_at)
      VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      purchaseId,
      supplier.id,
      supplier.name,
      subtotal,
      tax,
      discount,
      total,
      purchaseDate,
      String(payload.grnNo ?? ''),
      String(payload.notes ?? ''),
      nowIso()
    );
    console.log('Generated purchaseId:', purchaseId);

    for (const item of preparedItems) {
      db.prepare(
        `INSERT INTO purchase_items
        (id, purchase_id, medicine_id, batch_no, expiry_date, quantity_packs, tablets_per_pack, quantity_tablets, unit_cost_per_tablet, line_total, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        item.id,
        purchaseId,
        item.medicineId,
        item.batchNo,
        item.expiryDate,
        item.packs,
        item.tpp,
        item.qtyTablets,
        item.unitCost,
        item.lineTotal,
        nowIso()
      );
    }
  });
  createPurchaseTx();

  return getPurchaseById(purchaseId);
}

export function getPurchaseById(purchaseId) {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
  if (!purchase) return null;
  const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ? ORDER BY created_at ASC').all(purchaseId);
  return { ...purchase, items };
}

export function receivePurchase(purchaseId) {
  return db.transaction(() => {
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
    if (!purchase) throw new Error('Purchase not found.');
    if (purchase.status !== 'pending') throw new Error('Only pending purchases can be received.');

    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(purchaseId);
    if (items.length === 0) throw new Error('Purchase has no items.');

    // Business rule: receiving a purchase only closes the PO and updates payable.
    // Inventory updates are manual via inventory module actions.

    db.prepare("UPDATE purchases SET status = 'received', received_at = ? WHERE id = ?").run(nowIso(), purchaseId);
    db.prepare(
      'UPDATE suppliers SET balance_payable = balance_payable + ?, updated_at = ? WHERE id = ?'
    ).run(Number(purchase.total) || 0, nowIso(), purchase.supplier_id);

    return getPurchaseById(purchaseId);
  })();
}

/**
 * Record a retail or wholesale sale; allocates stock FEFO and persists line totals.
 *
 * Payload (camelCase; Express POST body or Electron IPC after validation):
 * - customerName, paymentMethod, discount, tax, pricingChannel?: 'retail'|'wholesale'
 * - creditAmount?, counterPayment?, customerId?
 * - items[]: medicineId, quantityMode ('tablet'|'packet'), quantity (sell units),
 *   stockTablets? (canonical shelf units for the line — required alignment with POS),
 *   unitPrice? (negotiated price per sell unit matching quantityMode)
 */
export function createSale(payload) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error('Sale items are required.');

  return db.transaction(() => {
    const saleId = generateId('sal');
    let subtotal = 0;
    const pricingChannel =
      String(payload.pricingChannel ?? '').toLowerCase() === 'wholesale' ? 'wholesale' : 'retail';

    db.prepare(
      `INSERT INTO sales (id, customer_name, payment_method, pricing_channel, subtotal, discount, tax, total, created_at)
       VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?)`
    ).run(
      saleId,
      String(payload.customerName ?? ''),
      String(payload.paymentMethod ?? 'cash'),
      pricingChannel,
      nowIso()
    );

    for (const line of payload.items) {
      const med = db
        .prepare('SELECT id, unit, tablets_per_pack, sale_per_pack FROM medicines WHERE id = ?')
        .get(line.medicineId);
      if (!med) throw new Error(`Medicine not found: ${line.medicineId}`);

      const mode = line.quantityMode === 'packet' ? 'packet' : 'tablet';
      const sellQty = ensurePositiveInt(line.quantity, 'quantity');
      const tpp = Math.max(1, Number(med.tablets_per_pack) || 1);
      const stockTabletsPayloadRaw =
        line.stockTablets != null ? Number(line.stockTablets) : Number(line.stock_tablets);

      const batches = db
        .prepare(
          `SELECT id, batch_no, expiry_date, quantity_tablets, sale_price_per_tablet, sale_price_per_pack
           FROM batches
           WHERE medicine_id = ? AND quantity_tablets > 0 AND date(expiry_date) >= date('now')
           ORDER BY date(expiry_date) ASC, received_at ASC`
        )
        .all(med.id);

      // FEFO allocation:
      // - tablet mode: allocate tablets directly from earliest non-expired lots
      // - packet mode: allocate full packs only (never break packs across tables)
      const allocations = [];
      if (mode === 'packet') {
        let remainingPacks = sellQty;
        for (const batch of batches) {
          if (remainingPacks <= 0) break;
          const batchTablets = Number(batch.quantity_tablets) || 0;
          const fullPacksAvailable = Math.floor(batchTablets / tpp);
          if (fullPacksAvailable <= 0) continue;
          const takePacks = Math.min(remainingPacks, fullPacksAvailable);
          allocations.push({
            batch,
            takeTablets: takePacks * tpp,
            quantityUnits: takePacks,
          });
          remainingPacks -= takePacks;
        }
        if (remainingPacks > 0) {
          throw new Error(`Insufficient full-pack stock for ${med.id}.`);
        }
      } else {
        const tabletsToSell =
          Number.isFinite(stockTabletsPayloadRaw) && stockTabletsPayloadRaw >= 1
            ? ensurePositiveInt(stockTabletsPayloadRaw, 'stockTablets')
            : sellQty;
        let remainingTablets = tabletsToSell;
        for (const batch of batches) {
          if (remainingTablets <= 0) break;
          const takeTablets = Math.min(remainingTablets, Number(batch.quantity_tablets) || 0);
          if (takeTablets <= 0) continue;
          allocations.push({
            batch,
            takeTablets,
            quantityUnits: takeTablets,
          });
          remainingTablets -= takeTablets;
        }
        if (remainingTablets > 0) {
          throw new Error(`Insufficient stock for ${med.id}.`);
        }
      }

      const overrideRaw =
        line.unitPrice != null ? Number(line.unitPrice) : Number(line.unit_price);
      const overrideUnitPrice =
        Number.isFinite(overrideRaw) && overrideRaw >= 0.01 ? Math.round(overrideRaw * 100) / 100 : null;
      const revenueTarget =
        overrideUnitPrice != null ? Math.round(overrideUnitPrice * sellQty * 100) / 100 : null;
      const totalStockTaken = allocations.reduce((sum, a) => sum + a.takeTablets, 0);

      let allocatedCustomRev = 0;
      for (let ai = 0; ai < allocations.length; ai++) {
        const alloc = allocations[ai];
        db.prepare('UPDATE batches SET quantity_tablets = quantity_tablets - ? WHERE id = ?').run(
          alloc.takeTablets,
          alloc.batch.id
        );
        const shelfUnitPrice =
          mode === 'packet'
            ? Number(alloc.batch.sale_price_per_pack || med.sale_per_pack || 0)
            : Number(alloc.batch.sale_price_per_tablet || 0);

        let unitPrice;
        let lineTotal;
        if (revenueTarget != null && totalStockTaken > 0) {
          const isLast = ai === allocations.length - 1;
          lineTotal = isLast
            ? Math.round((revenueTarget - allocatedCustomRev) * 100) / 100
            : Math.round(((revenueTarget * alloc.takeTablets) / totalStockTaken) * 100) / 100;
          allocatedCustomRev += lineTotal;
          unitPrice =
            alloc.quantityUnits > 0 ? Math.round((lineTotal / alloc.quantityUnits) * 100) / 100 : shelfUnitPrice;
        } else {
          unitPrice = shelfUnitPrice;
          lineTotal = Math.round(unitPrice * alloc.quantityUnits * 100) / 100;
        }
        subtotal += lineTotal;

        db.prepare(
          `INSERT INTO sale_items
          (id, sale_id, medicine_id, batch_id, batch_no, quantity_units, quantity_tablets, quantity_mode, unit_price, line_total, expiry_date, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          generateId('sit'),
          saleId,
          med.id,
          alloc.batch.id,
          alloc.batch.batch_no,
          alloc.quantityUnits,
          alloc.takeTablets,
          mode,
          unitPrice,
          lineTotal,
          alloc.batch.expiry_date,
          nowIso()
        );
      }

      recalcMedicineStock(med.id);
    }

    const discount = Math.min(ensureNonNegative(payload.discount ?? 0, 'discount'), subtotal);
    const tax = ensureNonNegative(payload.tax ?? 0, 'tax');
    const total = Math.max(0, subtotal + tax - discount);
    db.prepare('UPDATE sales SET subtotal = ?, discount = ?, tax = ?, total = ? WHERE id = ?').run(
      subtotal,
      discount,
      tax,
      total,
      saleId
    );

    const customerId = String(payload.customerId ?? '').trim();
    if (customerId) {
      const customer = db.prepare('SELECT id, balance_due FROM customers WHERE id = ?').get(customerId);
      if (!customer) throw new Error('Customer not found for credit tracking.');
      const method = String(payload.paymentMethod ?? 'cash');
      const currentBalance = Number(customer.balance_due) || 0;
      let nextBalance = currentBalance;
      if (method === 'credit') {
        const creditAmountRaw = Number(payload.creditAmount ?? total);
        const creditAmount = Math.max(0, Math.min(total, Number.isFinite(creditAmountRaw) ? creditAmountRaw : total));
        nextBalance = Math.round((currentBalance + creditAmount) * 100) / 100;
      } else if (method === 'cash' || method === 'card') {
        const counterRaw = Number(payload.counterPayment ?? total);
        const counter = Math.max(0, Number.isFinite(counterRaw) ? counterRaw : total);
        nextBalance = Math.max(0, Math.round((currentBalance + total - counter) * 100) / 100);
      }
      db.prepare(
        'UPDATE customers SET balance_due = ?, last_purchase_at = ?, updated_at = ? WHERE id = ?'
      ).run(nextBalance, nowIso(), nowIso(), customerId);
    }

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
    return { ...sale, items };
  })();
}

export function createReturn(payload) {
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error('Return items are required.');
  const type = payload.returnType === 'supplier' ? 'supplier' : 'customer';

  return db.transaction(() => {
    const returnId = generateId('ret');
    let subtotal = 0;

    db.prepare(
      `INSERT INTO returns (id, return_type, supplier_id, sale_id, notes, subtotal, total, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?)`
    ).run(
      returnId,
      type,
      payload.supplierId ?? null,
      payload.saleId ?? null,
      String(payload.notes ?? ''),
      nowIso()
    );

    for (const item of payload.items) {
      const medicine = db.prepare('SELECT id FROM medicines WHERE id = ?').get(item.medicineId);
      if (!medicine) throw new Error(`Medicine not found: ${item.medicineId}`);
      const qtyTablets = ensurePositiveInt(item.quantityTablets, 'quantityTablets');
      const unitPrice = ensureNonNegative(item.unitPrice ?? 0, 'unitPrice');
      const lineTotal = qtyTablets * unitPrice;
      subtotal += lineTotal;

      let targetBatch = null;
      if (item.batchId) {
        targetBatch = db
          .prepare('SELECT * FROM batches WHERE id = ? AND medicine_id = ?')
          .get(item.batchId, item.medicineId);
      } else if (item.batchNo) {
        targetBatch = db
          .prepare('SELECT * FROM batches WHERE medicine_id = ? AND batch_no = ?')
          .get(item.medicineId, item.batchNo);
      }

      if (type === 'customer') {
        // Customer returns always restock into the newest lot for this medicine
        // so inventory stays consolidated in the latest batch.
        targetBatch = db
          .prepare(
            `SELECT *
             FROM batches
             WHERE medicine_id = ? AND date(expiry_date) >= date('now')
             ORDER BY
               CASE WHEN received_at IS NULL OR trim(received_at) = '' THEN 1 ELSE 0 END ASC,
               datetime(received_at) DESC,
               CASE
                 WHEN trim(batch_no) GLOB '[0-9]*' THEN CAST(trim(batch_no) AS INTEGER)
                 ELSE -1
               END DESC,
               trim(batch_no) DESC,
               rowid DESC
             LIMIT 1`
          )
          .get(item.medicineId);

        if (!targetBatch) {
          const fallback = db
            .prepare('SELECT * FROM batches WHERE medicine_id = ? ORDER BY datetime(received_at) DESC, id DESC LIMIT 1')
            .get(item.medicineId);
          if (fallback) targetBatch = fallback;
        }

        if (!targetBatch) {
          const med = db
            .prepare('SELECT tablets_per_pack, sale_per_pack FROM medicines WHERE id = ?')
            .get(item.medicineId);
          const tpp = Math.max(1, Number(med?.tablets_per_pack) || 1);
          const batchNo = String(item.batchNo ?? '').trim() || `RET-${Date.now().toString(36).toUpperCase()}`;
          const salePack = Number(med?.sale_per_pack || 0);
          const saleTablet = tpp >= 2 ? salePack / tpp : salePack;
          const id = generateId('bat');
          db.prepare(
            `INSERT INTO batches
            (id, medicine_id, batch_no, expiry_date, quantity_tablets, cost_price_per_tablet, sale_price_per_tablet, sale_price_per_pack, received_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(id, item.medicineId, batchNo, item.expiryDate ?? new Date().toISOString().slice(0, 10), 0, 0, saleTablet, salePack, nowIso());
          targetBatch = db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
        }

        db.prepare('UPDATE batches SET quantity_tablets = quantity_tablets + ? WHERE id = ?').run(qtyTablets, targetBatch.id);
      } else {
        if (!targetBatch) throw new Error('Supplier return requires a valid batch.');
        if (Number(targetBatch.quantity_tablets) < qtyTablets) {
          throw new Error(`Cannot return more than available stock for batch ${targetBatch.batch_no}.`);
        }
        db.prepare('UPDATE batches SET quantity_tablets = quantity_tablets - ? WHERE id = ?').run(qtyTablets, targetBatch.id);
      }

      db.prepare(
        `INSERT INTO return_items
        (id, return_id, medicine_id, batch_id, batch_no, quantity_tablets, unit_price, line_total, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        generateId('rit'),
        returnId,
        item.medicineId,
        targetBatch?.id ?? null,
        targetBatch?.batch_no ?? String(item.batchNo ?? ''),
        qtyTablets,
        unitPrice,
        lineTotal,
        String(item.reason ?? ''),
        nowIso()
      );

      recalcMedicineStock(item.medicineId);
    }

    db.prepare('UPDATE returns SET subtotal = ?, total = ? WHERE id = ?').run(subtotal, subtotal, returnId);

    if (type === 'supplier' && payload.supplierId) {
      db.prepare('UPDATE suppliers SET balance_payable = MAX(0, balance_payable - ?), updated_at = ? WHERE id = ?').run(
        subtotal,
        nowIso(),
        payload.supplierId
      );
    }

    const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(returnId);
    const items = db.prepare('SELECT * FROM return_items WHERE return_id = ?').all(returnId);
    return { ...ret, items };
  })();
}

export function reverseSale(saleId) {
  return db.transaction(() => {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
    if (!sale) throw new Error('Sale not found.');
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
    if (items.length === 0) throw new Error('Sale has no items.');
    for (const item of items) {
      const batch = db.prepare('SELECT id FROM batches WHERE id = ?').get(item.batch_id);
      if (!batch) throw new Error(`Batch not found for sale item: ${item.id}`);
      db.prepare('UPDATE batches SET quantity_tablets = quantity_tablets + ? WHERE id = ?').run(
        Number(item.quantity_tablets) || 0,
        item.batch_id
      );
      recalcMedicineStock(item.medicine_id);
    }
    db.prepare('DELETE FROM sales WHERE id = ?').run(saleId);
    return { reversed: true, saleId };
  })();
}

export function updateBatch(batchId, payload) {
  return db.transaction(() => {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    if (!batch) throw new Error('Batch not found.');
    const qty = payload.quantityTablets;
    const hasQty = qty !== undefined && qty !== null;
    const nextQty = hasQty ? Math.max(0, Math.floor(Number(qty) || 0)) : null;
    db.prepare(
      `UPDATE batches SET
        batch_no = COALESCE(?, batch_no),
        expiry_date = COALESCE(?, expiry_date),
        quantity_tablets = COALESCE(?, quantity_tablets),
        cost_price_per_tablet = COALESCE(?, cost_price_per_tablet),
        sale_price_per_tablet = COALESCE(?, sale_price_per_tablet),
        sale_price_per_pack = COALESCE(?, sale_price_per_pack)
       WHERE id = ?`
    ).run(
      payload.batchNo ?? null,
      payload.expiryDate ?? null,
      hasQty ? nextQty : null,
      payload.costPricePerTablet ?? null,
      payload.salePricePerTablet ?? null,
      payload.salePricePerPack ?? null,
      batchId
    );
    recalcMedicineStock(batch.medicine_id);
    return db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
  })();
}

export function deleteBatch(batchId) {
  return db.transaction(() => {
    const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId);
    if (!batch) throw new Error('Batch not found.');
    const linked = db.prepare('SELECT COUNT(*) AS c FROM sale_items WHERE batch_id = ?').get(batchId);
    if ((Number(linked?.c) || 0) > 0) {
      throw new Error('Cannot delete batch because it is linked to sales.');
    }
    db.prepare('DELETE FROM batches WHERE id = ?').run(batchId);
    recalcMedicineStock(batch.medicine_id);
    return { deleted: true, batchId };
  })();
}
