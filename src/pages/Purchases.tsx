import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import type { Medicine, Purchase, PurchaseLine } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { displayManufacturer } from '@/lib/medicineDisplay';
import { getMedicineAvailability, getMedicineLowStockThresholdTablets } from '@/lib/posSearchHelpers';
import { formatPacksPlusTablets, getMedicineTabletsPerPack, tabletPurchaseFromPack } from '@/lib/stockUnits';
import { getMasterPurchasePricePerPack } from '@/lib/medicineMasterHelpers';

interface LineDraft {
  id: string;
  medicineId: string;
  qty: string;
}

function emptyLine(): LineDraft {
  return {
    id: `ln-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    medicineId: '',
    qty: '1',
  };
}

function nextGrn() {
  return `GRN-${Date.now().toString(36).toUpperCase()}`;
}

function defaultFutureDate(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function sellableTablets(m: Medicine): number {
  return getMedicineAvailability(m).sellableQty;
}

/** Align with reorder UX: at or below configured threshold (sellable, non-expired lots). */
function isLowStockForReorder(m: Medicine): boolean {
  const q = sellableTablets(m);
  const th = getMedicineLowStockThresholdTablets(m);
  return q <= th;
}

type StockTier = 'low' | 'medium' | 'ok';

function stockTier(m: Medicine): StockTier {
  if (isLowStockForReorder(m)) return 'low';
  const q = sellableTablets(m);
  const th = getMedicineLowStockThresholdTablets(m);
  if (th <= 0) return 'ok';
  if (q <= th * 2) return 'medium';
  return 'ok';
}

function sortMedicinesForReorder(meds: Medicine[]): Medicine[] {
  const rank: Record<StockTier, number> = { low: 0, medium: 1, ok: 2 };
  return [...meds].sort((a, b) => {
    const d = rank[stockTier(a)] - rank[stockTier(b)];
    if (d !== 0) return d;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function suggestedReorderPacks(m: Medicine): number {
  const tpp = Math.max(1, getMedicineTabletsPerPack(m));
  const current = sellableTablets(m);
  const th = getMedicineLowStockThresholdTablets(m);
  if (!isLowStockForReorder(m)) return 1;
  const gap = Math.max(0, th - current);
  return Math.max(1, Math.ceil(gap / tpp));
}

function medicinesForSupplier(supplierId: string, medicines: Medicine[]): Medicine[] {
  return medicines.filter((m) => m.supplierId === supplierId);
}

function getPurchasePricePerPack(m: Medicine): number {
  const tpp = Math.max(1, getMedicineTabletsPerPack(m));
  const ppp = getMasterPurchasePricePerPack(m);
  if (ppp != null && ppp > 0) return ppp;
  const fallbackTablet = Math.max(0, m.defaultPurchasePrice ?? 0);
  return Math.round(fallbackTablet * tpp * 100) / 100;
}

interface OrderPick {
  packs: string;
  include: boolean;
}

export const Purchases: React.FC = () => {
  const medicines = usePOSBillingStore((s) => s.medicines);
  const suppliers = usePOSBillingStore((s) => s.suppliers);
  const purchases = usePOSBillingStore((s) => s.purchases);
  const createPurchase = usePOSBillingStore((s) => s.createPurchase);
  const updatePurchase = usePOSBillingStore((s) => s.updatePurchase);
  const deletePurchase = usePOSBillingStore((s) => s.deletePurchase);
  const completePurchase = usePOSBillingStore((s) => s.completePurchase);
  const hydratePOSData = usePOSBillingStore((s) => s.hydratePOSData);
  const hydrateReferenceData = usePOSBillingStore((s) => s.hydrateReferenceData);
  const hydrateBusinessData = usePOSBillingStore((s) => s.hydrateBusinessData);
  const isSyncing = usePOSBillingStore((s) => s.isSyncing);
  const syncError = usePOSBillingStore((s) => s.syncError);
  const taxPercent = useSettingsStore((s) => s.taxPercent);

  const [mainTab, setMainTab] = useState<'reorder' | 'invoices'>('reorder');
  const [reorderStep, setReorderStep] = useState<'suppliers' | 'medicines'>('suppliers');
  const [reorderSupplierId, setReorderSupplierId] = useState<string | null>(null);
  const [orderPicks, setOrderPicks] = useState<Record<string, OrderPick>>({});
  const [focusedSupplierIdx, setFocusedSupplierIdx] = useState(0);
  const supplierGridRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewPurchase, setViewPurchase] = useState<Purchase | null>(null);
  const [reorderActionOpen, setReorderActionOpen] = useState(false);
  const [reorderPayload, setReorderPayload] = useState<Omit<Purchase, 'id' | 'timestamp' | 'status'> | null>(null);
  /** When set, purchase drawer is supplier-locked and medicine pickers are filtered. */
  const [reorderContext, setReorderContext] = useState<{ supplierId: string } | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [grnNo, setGrnNo] = useState(nextGrn);
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [autoRetryAttempt, setAutoRetryAttempt] = useState(0);

  useEffect(() => {
    void Promise.all([hydratePOSData(), hydrateReferenceData(), hydrateBusinessData()]);
  }, [hydratePOSData, hydrateReferenceData, hydrateBusinessData]);

  const supplierStats = useMemo(() => {
    return suppliers.map((s) => {
      const meds = medicinesForSupplier(s.id, medicines);
      const low = meds.filter(isLowStockForReorder).length;
      return { supplier: s, medicineCount: meds.length, lowStockCount: low };
    });
  }, [suppliers, medicines]);

  const activeReorderSupplier = useMemo(
    () => (reorderSupplierId ? suppliers.find((x) => x.id === reorderSupplierId) ?? null : null),
    [reorderSupplierId, suppliers]
  );

  const catalogMedicines = useMemo(() => {
    if (!reorderSupplierId) return [];
    return sortMedicinesForReorder(medicinesForSupplier(reorderSupplierId, medicines));
  }, [reorderSupplierId, medicines]);

  useEffect(() => {
    setFocusedSupplierIdx((i) => {
      if (supplierStats.length === 0) return 0;
      return Math.min(Math.max(0, i), supplierStats.length - 1);
    });
  }, [supplierStats.length]);

  const openSupplierMedicines = useCallback(
    (sid: string) => {
      const meds = sortMedicinesForReorder(medicinesForSupplier(sid, medicines));
      const picks: Record<string, OrderPick> = {};
      for (const m of meds) {
        picks[m.id] = {
          include: false,
          packs: String(isLowStockForReorder(m) ? suggestedReorderPacks(m) : 1),
        };
      }
      setOrderPicks(picks);
      setReorderSupplierId(sid);
      setReorderStep('medicines');
    },
    [medicines]
  );

  const backToSuppliers = useCallback(() => {
    setReorderStep('suppliers');
    setReorderSupplierId(null);
    setOrderPicks({});
  }, []);

  const resetForm = useCallback(() => {
    setReorderContext(null);
    setSupplierId('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
    setGrnNo(nextGrn());
    setLines([emptyLine()]);
    setEditingId(null);
  }, []);

  const openNew = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (p: Purchase) => {
    if (p.status !== 'pending') return;
    setReorderContext(null);
    setEditingId(p.id);
    setSupplierId(p.supplierId);
    setPurchaseDate(p.purchaseDate);
    setGrnNo(p.grnNo);
    setLines(
      p.lines.map((l) => {
        const med = medicines.find((m) => m.id === l.medicineId);
        const tpp = med ? getMedicineTabletsPerPack(med) : 1;
        return {
          id: l.id,
          medicineId: l.medicineId,
          qty: String(Math.round(l.quantity / Math.max(1, tpp))),
        };
      })
    );
    setDrawerOpen(true);
  };

  const { subtotal, taxAmt, total } = useMemo(() => {
    let sub = 0;
    for (const ln of lines) {
      const med = medicines.find((m) => m.id === ln.medicineId);
      if (!med) continue;
      const tpp = getMedicineTabletsPerPack(med);
      const packsOrUnits = Math.max(0, Math.floor(Number(ln.qty) || 0));
      const qtyTablets = packsOrUnits * Math.max(1, tpp);
      const packCost = getPurchasePricePerPack(med);
      const costTablet = packCost > 0 ? tabletPurchaseFromPack(packCost, tpp) : 0;
      if (Number.isFinite(qtyTablets) && Number.isFinite(costTablet) && ln.medicineId)
        sub += qtyTablets * costTablet;
    }
    const disc = 0;
    const after = Math.max(0, sub - disc);
    const tax = Math.round(after * (taxPercent / 100) * 100) / 100;
    const tot = Math.round((after + tax) * 100) / 100;
    return { subtotal: sub, taxAmt: tax, total: tot };
  }, [lines, taxPercent, medicines]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return [...purchases]
      .filter((p) => {
        if (!q) return true;
        if (p.grnNo.toLowerCase().includes(q)) return true;
        if (p.supplierName.toLowerCase().includes(q)) return true;
        return p.lines.some((l) => l.medicineName.toLowerCase().includes(q));
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [purchases, query]);

  const buildPayload = (): Omit<Purchase, 'id' | 'timestamp' | 'status'> | null => {
    const sup = suppliers.find((s) => s.id === supplierId);
    if (!sup || !purchaseDate) return null;
    const pls: PurchaseLine[] = [];
    for (const ln of lines) {
      if (!ln.medicineId) continue;
      const med = medicines.find((m) => m.id === ln.medicineId);
      if (!med) continue;
      const tpp = getMedicineTabletsPerPack(med);
      const packsOrUnits = Math.max(0, Math.floor(Number(ln.qty) || 0));
      const qtyTablets = packsOrUnits * Math.max(1, tpp);
      const packCost = getPurchasePricePerPack(med);
      const costTablet = packCost > 0 ? tabletPurchaseFromPack(packCost, tpp) : 0;
      if (qtyTablets <= 0 || costTablet < 0) continue;
      pls.push({
        id: ln.id,
        medicineId: med.id,
        medicineName: med.name,
        batchNo: `AUTO-${Date.now().toString(36).slice(-5).toUpperCase()}`,
        expiryDate: defaultFutureDate(540),
        quantity: qtyTablets,
        enteredAsPackets: tpp >= 2,
        unitCost: costTablet,
        lineTotal: Math.round(qtyTablets * costTablet * 100) / 100,
      });
    }
    if (pls.length === 0) return null;
    const disc = 0;
    return {
      grnNo: grnNo.trim() || nextGrn(),
      supplierId: sup.id,
      supplierName: sup.name,
      purchaseDate,
      lines: pls,
      subtotal,
      discount: disc,
      tax: taxAmt,
      total,
    };
  };

  const savePending = async () => {
    if (isSaving || isReceiving) return;
    if (isSyncing) {
      setActionError('Please wait for backend sync to finish, then try again.');
      return;
    }
    const payload = buildPayload();
    if (!payload) return;
    try {
      setActionError(null);
      setIsSaving(true);
      if (editingId) await updatePurchase(editingId, payload);
      else await createPurchase(payload);
      setDrawerOpen(false);
      resetForm();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save purchase.');
    } finally {
      setIsSaving(false);
    }
  };

  const receiveStock = async () => {
    if (isSaving || isReceiving) return;
    if (isSyncing) {
      setActionError('Please wait for backend sync to finish, then try again.');
      return;
    }
    const payload = buildPayload();
    if (!payload) return;
    try {
      setActionError(null);
      setIsReceiving(true);
      let id = editingId;
      if (!id) id = await createPurchase(payload);
      else await updatePurchase(id, payload);
      const r = await completePurchase(id);
      if (!r.ok) {
        setActionError(r.message ?? 'Could not complete purchase.');
        return;
      }
      setDrawerOpen(false);
      resetForm();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not receive stock.');
    } finally {
      setIsReceiving(false);
    }
  };

  const buildReorderPayloadFromSelection = (): Omit<Purchase, 'id' | 'timestamp' | 'status'> | null => {
    if (!reorderSupplierId) return null;
    const sup = suppliers.find((s) => s.id === reorderSupplierId);
    if (!sup) return null;
    const purchaseDate = new Date().toISOString().slice(0, 10);
    const pls: PurchaseLine[] = [];
    for (const m of catalogMedicines) {
      const pick = orderPicks[m.id];
      if (!pick?.include) continue;
      const packs = Math.max(0, Math.floor(Number(pick.packs) || 0));
      if (packs <= 0) continue;
      const tpp = Math.max(1, getMedicineTabletsPerPack(m));
      const qtyTablets = packs * tpp;
      const ppp = getMasterPurchasePricePerPack(m);
      const costTablet =
        ppp != null && ppp > 0 ? tabletPurchaseFromPack(ppp, tpp) : Math.max(0, m.defaultPurchasePrice ?? 0);
      const normalizedCost = Math.max(0, Math.round(costTablet * 10000) / 10000);
      const lineTotal = Math.round(qtyTablets * normalizedCost * 100) / 100;
      pls.push({
        id: `ln-${m.id}-${Date.now()}-${pls.length}`,
        medicineId: m.id,
        medicineName: m.name,
        batchNo: `NEW-${Date.now().toString(36).slice(-4).toUpperCase()}`,
        expiryDate: defaultFutureDate(540),
        quantity: qtyTablets,
        enteredAsPackets: tpp >= 2,
        unitCost: normalizedCost,
        lineTotal,
      });
    }
    if (pls.length === 0) return null;
    const subtotal = Math.round(pls.reduce((a, l) => a + l.lineTotal, 0) * 100) / 100;
    const tax = Math.round(subtotal * (taxPercent / 100) * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;
    return {
      grnNo: nextGrn(),
      supplierId: sup.id,
      supplierName: sup.name,
      purchaseDate,
      lines: pls,
      subtotal,
      discount: 0,
      tax,
      total,
    };
  };

  const clearReorderSelection = () => {
    setOrderPicks((prev) => {
      const next: Record<string, OrderPick> = {};
      for (const [id, row] of Object.entries(prev)) next[id] = { ...row, include: false };
      return next;
    });
  };

  const createPurchaseOrderFromSelection = () => {
    const payload = buildReorderPayloadFromSelection();
    if (!payload) {
      window.alert('Select at least one medicine and enter a pack quantity ≥ 1.');
      return;
    }
    setReorderPayload(payload);
    setReorderActionOpen(true);
  };

  const confirmReorderAsPending = async () => {
    if (!reorderPayload) return;
    if (isSyncing) {
      setActionError('Please wait for backend sync to finish, then try again.');
      return;
    }
    try {
      setActionError(null);
      await createPurchase(reorderPayload);
      setReorderActionOpen(false);
      setReorderPayload(null);
      clearReorderSelection();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not create purchase.');
    }
  };

  const retryRefresh = useCallback(async () => {
    await Promise.all([hydratePOSData(), hydrateReferenceData(), hydrateBusinessData()]);
  }, [hydratePOSData, hydrateReferenceData, hydrateBusinessData]);

  useEffect(() => {
    if (!syncError) {
      setAutoRetryAttempt(0);
      return;
    }
    if (isSyncing || autoRetryAttempt >= 3) return;
    const delay = 1000 * 2 ** autoRetryAttempt;
    const t = window.setTimeout(() => {
      setAutoRetryAttempt((a) => a + 1);
      void retryRefresh();
    }, delay);
    return () => window.clearTimeout(t);
  }, [syncError, isSyncing, autoRetryAttempt, retryRefresh]);

  const confirmReorderAsReceived = async () => {
    if (!reorderPayload) return;
    if (isSyncing) {
      setActionError('Please wait for backend sync to finish, then try again.');
      return;
    }
    const id = await createPurchase(reorderPayload);
    const r = await completePurchase(id);
    if (!r.ok) {
      window.alert(r.message ?? 'Could not receive this order.');
      return;
    }
    setReorderActionOpen(false);
    setReorderPayload(null);
    clearReorderSelection();
  };

  const medicineOptions = useMemo(() => {
    if (!reorderContext) return medicines;
    return medicines.filter((m) => m.supplierId === reorderContext.supplierId);
  }, [medicines, reorderContext]);

  /** Selected lines for the right-hand purchase order panel. */
  const reorderSummaryLines = useMemo(() => {
    const rows: { id: string; name: string; packs: number }[] = [];
    for (const m of catalogMedicines) {
      const pick = orderPicks[m.id];
      if (!pick?.include) continue;
      const packs = Math.max(0, Math.floor(Number(pick.packs) || 0));
      if (packs <= 0) continue;
      rows.push({ id: m.id, name: m.name, packs });
    }
    return rows;
  }, [catalogMedicines, orderPicks]);

  const onSupplierGridKeyDown = (e: React.KeyboardEvent) => {
    if (reorderStep !== 'suppliers' || supplierStats.length === 0) return;
    const n = supplierStats.length;
    const cols = typeof window !== 'undefined' && window.innerWidth >= 768 ? 3 : window.innerWidth >= 640 ? 2 : 1;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setFocusedSupplierIdx((i) => Math.min(i + 1, n - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocusedSupplierIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedSupplierIdx((i) => Math.min(i + cols, n - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedSupplierIdx((i) => Math.max(i - cols, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const row = supplierStats[focusedSupplierIdx];
      if (row) openSupplierMedicines(row.supplier.id);
    }
  };

  const printPurchase = (purchase: Purchase) => {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    const rows = purchase.lines
      .map(
        (l) => `
          <tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${l.medicineName}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${l.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(l.lineTotal)}</td>
          </tr>
        `
      )
      .join('');
    popup.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${purchase.grnNo}</title>
      </head>
      <body style="font-family:Arial,sans-serif;padding:24px;color:#0f172a;">
        <h2 style="margin:0 0 6px;">${purchase.grnNo}</h2>
        <p style="margin:0 0 4px;">Supplier: ${purchase.supplierName}</p>
        <p style="margin:0 0 16px;">Date: ${purchase.purchaseDate}</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid #cbd5e1;">Medicine</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid #cbd5e1;">Qty</th>
              <th style="text-align:right;padding:8px;border-bottom:1px solid #cbd5e1;">Line total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:16px;text-align:right;font-weight:700;">Grand total: ${formatCurrency(purchase.total)}</p>
      </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
    popup.close();
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-slate-50/90 p-4 sm:p-6 dark:bg-zinc-950">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Purchases</h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Supplier-centric reordering and goods receiving (GRN).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setMainTab('reorder')}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-bold transition',
                mainTab === 'reorder'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
              )}
            >
              Smart reorder
            </button>
            <button
              type="button"
              onClick={() => setMainTab('invoices')}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-bold transition',
                mainTab === 'invoices'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
              )}
            >
              All invoices
            </button>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            Classic purchase
          </button>
        </div>
      </header>
      {(actionError || syncError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {actionError ?? syncError}
        </div>
      )}
      {isSyncing && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-200">
          Syncing latest backend data...
        </div>
      )}
      {syncError && autoRetryAttempt > 0 && autoRetryAttempt <= 3 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
          Auto-retrying backend sync ({autoRetryAttempt}/3)...
        </div>
      ) : null}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void retryRefresh()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Retry refresh
        </button>
      </div>

      {mainTab === 'reorder' ? (
        <div className="min-h-0 flex-1 flex flex-col gap-4 overflow-hidden">
          {reorderStep === 'suppliers' ? (
            <>
              <div className="rounded-2xl border border-slate-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-50">
                <strong>Flow:</strong> choose a supplier → review linked medicines (low stock first) → select packs →{' '}
                <strong>Confirm order</strong> on the right opens a pre-filled GRN. Use arrow keys + Enter on the grid.
              </div>
              <div
                ref={supplierGridRef}
                role="grid"
                aria-label="Suppliers"
                tabIndex={0}
                onKeyDown={onSupplierGridKeyDown}
                className="min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-2xl"
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {supplierStats.map(({ supplier, medicineCount, lowStockCount }, idx) => (
                    <button
                      key={supplier.id}
                      type="button"
                      role="gridcell"
                      onClick={() => openSupplierMedicines(supplier.id)}
                      className={cn(
                        'rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-zinc-900',
                        idx === focusedSupplierIdx
                          ? 'border-primary ring-2 ring-primary/25'
                          : 'border-slate-200/90 dark:border-zinc-800'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="rounded-xl bg-slate-100 p-2 dark:bg-zinc-800">
                            <Truck className="h-5 w-5 text-slate-600 dark:text-zinc-300" />
                          </div>
                          <h2 className="truncate text-base font-black text-slate-900 dark:text-white">{supplier.name}</h2>
                        </div>
                      </div>
                      {supplier.company ? (
                        <p className="mt-2 truncate text-xs text-slate-500 dark:text-zinc-400">{supplier.company}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
                        Phone: <span className="font-semibold text-slate-700 dark:text-zinc-200">{supplier.phone || '—'}</span>
                      </p>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-zinc-800 dark:text-zinc-200">
                          <Package className="h-3.5 w-3.5 opacity-70" />
                          {medicineCount} medicine{medicineCount === 1 ? '' : 's'}
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black',
                            lowStockCount > 0
                              ? 'bg-red-500/15 text-red-800 ring-1 ring-red-500/25 dark:text-red-200'
                              : 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-200'
                          )}
                        >
                          {lowStockCount > 0 ? (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5" />
                              {lowStockCount} low stock
                            </>
                          ) : (
                            'No low-stock alerts'
                          )}
                        </span>
                      </div>
                      <p className="mt-3 text-[11px] font-semibold text-primary">Open catalog →</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden">
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={backToSuppliers}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Suppliers
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-black text-slate-900 dark:text-white">
                      {activeReorderSupplier?.name ?? 'Supplier'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Only medicines linked to this supplier. Red rows need restocking. Your order builds on the
                      right.
                    </p>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
                  {catalogMedicines.length === 0 ? (
                    <p className="p-10 text-center text-sm text-slate-500 dark:text-zinc-400">
                      No medicines are linked to this supplier yet. Assign <strong>supplier</strong> on the Medicines
                      screen.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
                      {catalogMedicines.map((m) => {
                        const tpp = getMedicineTabletsPerPack(m);
                        const sell = sellableTablets(m);
                        const th = getMedicineLowStockThresholdTablets(m);
                        const low = isLowStockForReorder(m);
                        const tier = stockTier(m);
                        const pick = orderPicks[m.id] ?? { include: false, packs: '1' };
                        return (
                          <li
                            key={m.id}
                            className={cn(
                              'px-4 py-4 transition-colors sm:px-5',
                              low
                                ? 'border-l-4 border-l-red-500 bg-red-50/90 dark:border-l-red-500 dark:bg-red-950/25'
                                : tier === 'medium'
                                  ? 'border-l-4 border-l-amber-400 bg-amber-50/40 dark:border-l-amber-500 dark:bg-amber-950/15'
                                  : 'border-l-4 border-l-transparent bg-white dark:bg-zinc-950/20'
                            )}
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-bold text-slate-900 dark:text-white">{m.name}</h3>
                                  {low ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white shadow-sm">
                                      <AlertTriangle className="h-3 w-3" />
                                      Low stock
                                    </span>
                                  ) : tier === 'medium' ? (
                                    <span className="inline-flex rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-900 dark:text-amber-100">
                                      Medium
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-200">
                                      Healthy
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 dark:text-zinc-400">{m.generic}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-600 dark:text-zinc-400">
                                  <span>
                                    Pack: <strong className="text-slate-900 dark:text-white">{tpp}</strong> tablets
                                    {m.packSize ? <span className="text-slate-400"> · {m.packSize}</span> : null}
                                  </span>
                                  <span>
                                    On hand:{' '}
                                    <strong className="tabular-nums text-slate-900 dark:text-white">
                                      {formatPacksPlusTablets(sell, tpp, m.unit)}
                                    </strong>
                                  </span>
                                  <span>
                                    Low if ≤{' '}
                                    <strong className="tabular-nums text-slate-900 dark:text-white">{th}</strong>{' '}
                                    tablets
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-end gap-3 lg:shrink-0">
                                <label className="flex flex-col text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
                                  Packs
                                  <input
                                    type="number"
                                    min={0}
                                    disabled={!pick.include}
                                    value={pick.packs}
                                    onChange={(e) =>
                                      setOrderPicks((prev) => ({
                                        ...prev,
                                        [m.id]: { ...pick, packs: e.target.value },
                                      }))
                                    }
                                    className="mt-1 w-24 rounded-xl border border-slate-200 px-2 py-2 text-sm font-bold tabular-nums disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                                  />
                                </label>
                                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-800">
                                  <input
                                    type="checkbox"
                                    checked={pick.include}
                                    onChange={(e) => {
                                      const on = e.target.checked;
                                      setOrderPicks((prev) => ({
                                        ...prev,
                                        [m.id]: {
                                          include: on,
                                          packs:
                                            on && (Number(prev[m.id]?.packs) || 0) < 1
                                              ? String(suggestedReorderPacks(m))
                                              : prev[m.id]?.packs ?? '1',
                                        },
                                      }));
                                    }}
                                    className="h-4 w-4 rounded border-slate-300 text-primary"
                                  />
                                  Order
                                </label>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:w-[min(100%,320px)] lg:max-h-[min(100%,calc(100vh-12rem))]">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Purchase order</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-900 dark:text-white">
                    {activeReorderSupplier?.name ?? 'Supplier'}
                  </p>
                </div>
                <div className="min-h-[120px] flex-1 overflow-y-auto px-4 py-3">
                  {reorderSummaryLines.length === 0 ? (
                    <p className="text-center text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
                      Tick <strong className="text-slate-700 dark:text-zinc-300">Order</strong> and set packs for each
                      medicine you want. Lines appear here.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {reorderSummaryLines.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-baseline justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm dark:bg-zinc-800/80"
                        >
                          <span className="min-w-0 flex-1 font-semibold leading-snug text-slate-900 dark:text-white">
                            {row.name}
                          </span>
                          <span className="shrink-0 tabular-nums font-black text-slate-800 dark:text-zinc-100">
                            × {row.packs} {row.packs === 1 ? 'pack' : 'packs'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="border-t border-slate-100 p-4 dark:border-zinc-800">
                  <button
                    type="button"
                    disabled={reorderSummaryLines.length === 0}
                    onClick={createPurchaseOrderFromSelection}
                    className={cn(
                      'w-full rounded-xl py-3 text-sm font-black text-primary-foreground shadow-md transition',
                      reorderSummaryLines.length === 0
                        ? 'cursor-not-allowed bg-slate-300 shadow-none dark:bg-zinc-700 dark:text-zinc-400'
                        : 'bg-primary shadow-primary/25 hover:brightness-[1.03]'
                    )}
                  >
                    Confirm order
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500 dark:text-zinc-500">
                    Quick popup: choose Pending or Received.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="relative max-w-xl shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search supplier or invoice…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            {filtered.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">No purchases yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filtered.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {(() => {
                      const sup = suppliers.find((s) => s.id === p.supplierId);
                      return (
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-slate-100 p-2 dark:bg-zinc-800">
                        <Truck className="h-5 w-5 text-slate-600 dark:text-zinc-300" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{p.grnNo}</p>
                        <p className="text-sm text-slate-600 dark:text-zinc-400">{p.supplierName}</p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">
                          Phone: {sup?.phone?.trim() ? sup.phone : '—'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {format(new Date(p.timestamp), 'MMM d, yyyy · h:mm a')}
                        </p>
                      </div>
                    </div>
                      );
                    })()}
                    <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                      <span
                        className={
                          p.status === 'completed'
                            ? 'rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-200'
                            : 'rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:text-amber-100'
                        }
                      >
                        {p.status === 'completed' ? 'Completed' : 'Pending'}
                      </span>
                      <p className="text-lg font-bold tabular-nums">{formatCurrency(p.total)}</p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title="View"
                          onClick={() => setViewPurchase(p)}
                          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {p.status === 'pending' ? (
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => openEdit(p)}
                            className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {p.status === 'pending' ? (
                          <button
                            type="button"
                            title="Receive stock"
                            onClick={async () => {
                              const r = await completePurchase(p.id);
                              if (!r.ok) window.alert(r.message ?? 'Failed');
                            }}
                            className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                          >
                            Receive
                          </button>
                        ) : null}
                        {p.status === 'pending' ? (
                          <button
                            type="button"
                            title="Delete"
                            onClick={async () => {
                              if (!window.confirm(`Delete draft ${p.grnNo}?`)) return;
                              const ok = await deletePurchase(p.id);
                              if (!ok) setActionError('Could not delete this draft on the server.');
                            }}
                            className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 dark:border-zinc-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => {
              setDrawerOpen(false);
              resetForm();
            }}
          />
          <div className="relative z-10 flex h-full w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                {editingId ? 'Edit purchase' : reorderContext ? 'Purchase order (from reorder)' : 'New purchase'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  resetForm();
                }}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <label className="block text-xs font-semibold text-slate-500">
                Supplier
                <select
                  value={supplierId}
                  disabled={Boolean(reorderContext)}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:disabled:bg-zinc-800"
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {reorderContext ? (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                    Supplier is fixed for this order. Cancel to pick a different supplier from Smart reorder.
                  </p>
                ) : null}
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-500">Line items</span>
                  <button
                    type="button"
                    onClick={() => setLines((ls) => [...ls, emptyLine()])}
                    className="text-xs font-semibold text-primary"
                  >
                    + Add line
                  </button>
                </div>
                {reorderContext ? (
                  <p className="mb-2 rounded-lg bg-sky-500/10 px-2 py-1.5 text-[11px] text-sky-950 dark:text-sky-100">
                    Lines are pre-filled from Smart reorder. Confirm medicine and quantity.
                  </p>
                ) : null}
                <div className="space-y-3">
                  {lines.map((ln) => (
                    <div key={ln.id} className="rounded-xl border border-slate-100 p-3 dark:border-zinc-800">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <select
                          value={ln.medicineId}
                          disabled={Boolean(reorderContext)}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLines((ls) =>
                              ls.map((x) => {
                                if (x.id !== ln.id) return x;
                                return {
                                  ...x,
                                  medicineId: v,
                                };
                              })
                            );
                          }}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white disabled:opacity-60"
                        >
                          <option value="">Medicine…</option>
                          {medicineOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} — Mfr. {displayManufacturer(m)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          placeholder={(() => {
                            const m = medicines.find((x) => x.id === ln.medicineId);
                            const tpp = m ? getMedicineTabletsPerPack(m) : 1;
                            return tpp >= 2 ? 'Packs' : 'Units';
                          })()}
                          value={ln.qty}
                          onChange={(e) =>
                            setLines((ls) => ls.map((x) => (x.id === ln.id ? { ...x, qty: e.target.value } : x)))
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm sm:col-span-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                        />
                      </div>
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          className="mt-2 text-xs text-red-600"
                          onClick={() => setLines((ls) => ls.filter((x) => x.id !== ln.id))}
                        >
                          Remove line
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-zinc-900">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-zinc-400">Subtotal</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-slate-600 dark:text-zinc-400">Tax ({taxPercent}%)</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(taxAmt)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-bold dark:border-zinc-700">
                  <span>Grand total</span>
                  <span className="tabular-nums text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-100 p-4 dark:border-zinc-800 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  resetForm();
                }}
                className="flex-1 rounded-xl border py-2.5 text-sm font-medium dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void savePending()}
                disabled={isSaving || isReceiving}
                className="flex-1 rounded-xl border border-slate-900 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-white dark:text-white"
              >
                {isSaving ? 'Saving...' : 'Save as pending'}
              </button>
              <button
                type="button"
                onClick={() => void receiveStock()}
                disabled={isSaving || isReceiving}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
              >
                {isReceiving ? 'Receiving...' : 'Receive stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {reorderActionOpen && reorderPayload && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => {
              setReorderActionOpen(false);
              setReorderPayload(null);
            }}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Confirm purchase order</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400">{reorderPayload.supplierName}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReorderActionOpen(false);
                  setReorderPayload(null);
                }}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm dark:bg-zinc-900">
              {reorderPayload.lines.map((l) => {
                const med = medicines.find((m) => m.id === l.medicineId);
                const tpp = med ? Math.max(1, getMedicineTabletsPerPack(med)) : 1;
                const packs = Math.max(1, Math.round(l.quantity / tpp));
                return (
                  <li key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 dark:bg-zinc-800">
                    <span className="min-w-0 truncate font-semibold text-slate-900 dark:text-zinc-100">
                      {l.medicineName}
                    </span>
                    <span className="shrink-0 tabular-nums font-black text-slate-800 dark:text-zinc-100">
                      {packs}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setReorderActionOpen(false);
                  setReorderPayload(null);
                }}
                className="rounded-xl border py-2.5 text-sm font-bold dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmReorderAsPending()}
                className="rounded-xl border border-slate-900 py-2.5 text-sm font-bold dark:border-white dark:text-white"
              >
                Pending
              </button>
              <button
                type="button"
                onClick={() => void confirmReorderAsReceived()}
                className="rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-900"
              >
                Received
              </button>
            </div>
          </div>
        </div>
      )}

      {viewPurchase && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setViewPurchase(null)} aria-label="Close" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">{viewPurchase.grnNo}</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400">{viewPurchase.supplierName}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewPurchase(null)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto text-sm">
              {viewPurchase.lines.map((l) => {
                const med = medicines.find((x) => x.id === l.medicineId);
                return (
                  <li key={l.id} className="flex justify-between gap-2 border-b border-slate-50 pb-2 dark:border-zinc-800">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 dark:text-zinc-100">{l.medicineName}</p>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-500">
                        Mfr. {displayManufacturer(med)}
                      </p>
                      <p className="text-slate-500">
                        {l.quantity} tablets
                        {l.enteredAsPackets ? ' (from packs)' : ''}
                      </p>
                    </div>
                    <span className="shrink-0 tabular-nums font-medium">{formatCurrency(l.lineTotal)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-right text-lg font-bold">{formatCurrency(viewPurchase.total)}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => printPurchase(viewPurchase)}
                className="rounded-xl border border-slate-900 py-2 text-sm font-semibold dark:border-white dark:text-white"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setViewPurchase(null)}
                className="rounded-xl border py-2 text-sm font-medium dark:border-zinc-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
