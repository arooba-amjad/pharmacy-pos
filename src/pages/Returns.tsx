import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Trash2, Truck, UserRound, X } from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import type { ReturnKind } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { isExpired, parseLocalDay } from '@/lib/posDates';
interface BatchOption {
  batchId: string;
  batchNo: string;
  expiryDate: string;
  unitPrice: number;
  maxTablets: number;
}

interface SearchRow {
  key: string;
  label: string;
  subtitle: string;
  medicineId: string;
  medicineName: string;
  batchOptions: BatchOption[];
  sourceSaleId?: string;
  sourceInvoiceNo?: string;
  sourceCustomerId?: string;
  sourceCustomerName?: string;
  tabletsPerPack: number;
}

interface ReturnCartLine {
  id: string;
  medicineId: string;
  medicineName: string;
  batchOptions: BatchOption[];
  batchIdx: number;
  tablets: number;
  sourceSaleId?: string;
  sourceInvoiceNo?: string;
  sourceCustomerId?: string;
  sourceCustomerName?: string;
}

type QtyMode = 'tablet' | 'packet';

/** Max tablets per line for shelf restock (no invoice); avoids tying qty to a past sale. */
const SHELF_RESTOCK_MAX_TABLETS = 999_999;

function sortFefo<T extends { expiryDate: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => parseLocalDay(a.expiryDate).getTime() - parseLocalDay(b.expiryDate).getTime());
}

export const Returns: React.FC = () => {
  const medicines = usePOSBillingStore((s) => s.medicines);
  const suppliers = usePOSBillingStore((s) => s.suppliers);
  const processReturn = usePOSBillingStore((s) => s.processReturn);
  const hydratePOSData = usePOSBillingStore((s) => s.hydratePOSData);
  const hydrateReferenceData = usePOSBillingStore((s) => s.hydrateReferenceData);
  const hydrateBusinessData = usePOSBillingStore((s) => s.hydrateBusinessData);
  const isSyncing = usePOSBillingStore((s) => s.isSyncing);
  const syncError = usePOSBillingStore((s) => s.syncError);

  const [kind, setKind] = useState<ReturnKind>('customer');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<ReturnCartLine[]>([]);
  const [selectedResultIdx, setSelectedResultIdx] = useState(0);
  const [selectedCartIdx, setSelectedCartIdx] = useState(0);
  const [focusZone, setFocusZone] = useState<'results' | 'cart' | 'batch'>('results');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoRetryAttempt, setAutoRetryAttempt] = useState(0);

  useEffect(() => {
    void hydrateBusinessData();
  }, [hydrateBusinessData]);
  const [pickRow, setPickRow] = useState<SearchRow | null>(null);
  const [pickMode, setPickMode] = useState<QtyMode>('tablet');
  const [pickQty, setPickQty] = useState('1');

  const searchRef = useRef<HTMLInputElement>(null);
  const pickQtyRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cartRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), [suppliers]);

  /** Shelf restock only (no invoice rows — backend `sale_id` stays null). */
  const shelfCustomerRows = useMemo(() => {
    const rows: SearchRow[] = [];
    for (const m of medicines) {
      if (m.batches.length === 0) continue;
      const options = sortFefo(
        m.batches.map((b) => {
          const batchSale = Number(b.salePricePerTablet) || 0;
          const medSale = Number(m.salePricePerTablet) || 0;
          const salePt = batchSale > 0 ? batchSale : medSale > 0 ? medSale : 0.01;
          return {
            batchId: b.id,
            batchNo: b.batchNo,
            expiryDate: b.expiryDate,
            unitPrice: Math.max(0.01, Math.round(salePt * 10000) / 10000),
            maxTablets: SHELF_RESTOCK_MAX_TABLETS,
          };
        })
      );
      rows.push({
        key: `shelf-${m.id}`,
        label: m.name,
        subtitle: `${m.generic || '—'} · Shelf restock · pick batch (FEFO) and quantity`,
        medicineId: m.id,
        medicineName: m.name,
        batchOptions: options,
        tabletsPerPack: Math.max(1, m.tabletsPerPack || 1),
      });
    }
    return rows;
  }, [medicines]);

  const supplierRows = useMemo(() => {
    const rows: SearchRow[] = [];
    for (const m of medicines) {
      const options = sortFefo(
        m.batches
          .filter((b) => b.totalTablets > 0)
          .map((b) => ({
            batchId: b.id,
            batchNo: b.batchNo,
            expiryDate: b.expiryDate,
            unitPrice: b.costPricePerTablet,
            maxTablets: Math.max(0, Math.floor(b.totalTablets)),
          }))
      );
      if (options.length === 0) continue;
      const sup = m.supplierId ? supplierById[m.supplierId] : undefined;
      rows.push({
        key: `sup-${m.id}`,
        label: `${m.name}${sup ? ` · ${sup.name}` : ''}`,
        subtitle: `${m.generic || '—'} · ${options.length} batch${options.length === 1 ? '' : 'es'} available`,
        medicineId: m.id,
        medicineName: m.name,
        batchOptions: options,
        tabletsPerPack: Math.max(1, m.tabletsPerPack || 1),
      });
    }
    return rows;
  }, [medicines, supplierById]);

  const rows = useMemo(() => {
    const base = kind === 'customer' ? shelfCustomerRows : supplierRows;
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.medicineName.toLowerCase().includes(q)
    );
  }, [kind, shelfCustomerRows, supplierRows, query]);

  useEffect(() => {
    setSelectedResultIdx((i) => (rows.length === 0 ? 0 : Math.min(i, rows.length - 1)));
  }, [rows.length]);

  useEffect(() => {
    setCart([]);
    setSelectedCartIdx(0);
    setInlineError(null);
    setFocusZone('results');
  }, [kind]);

  useEffect(() => {
    if (!rows[selectedResultIdx]) return;
    const node = resultRefs.current[rows[selectedResultIdx]!.key];
    if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [rows, selectedResultIdx]);

  useEffect(() => {
    if (!cart[selectedCartIdx]) return;
    const node = cartRefs.current[cart[selectedCartIdx]!.id];
    if (node) node.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [cart, selectedCartIdx]);

  const openAddPrompt = (row: SearchRow) => {
    const mode: QtyMode = row.tabletsPerPack > 1 ? 'packet' : 'tablet';
    setPickRow(row);
    setPickMode(mode);
    setPickQty('1');
    setInlineError(null);
  };

  const confirmAddPrompt = () => {
    if (!pickRow) return;
    const fefo = sortFefo(pickRow.batchOptions);
    const first = fefo[0];
    if (!first) {
      setInlineError('No valid batch available.');
      setPickRow(null);
      return;
    }
    const qty = Math.floor(Number(pickQty));
    if (!Number.isFinite(qty) || qty <= 0) {
      setInlineError('Quantity must be greater than zero.');
      return;
    }
    const tablets = pickMode === 'packet' ? qty * pickRow.tabletsPerPack : qty;
    if (tablets > first.maxTablets) {
      setInlineError(`Max returnable for selected batch is ${first.maxTablets} tablets.`);
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        id: `ret-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        medicineId: pickRow.medicineId,
        medicineName: pickRow.medicineName,
        batchOptions: fefo,
        batchIdx: 0,
        tablets,
        sourceSaleId: pickRow.sourceSaleId,
        sourceInvoiceNo: pickRow.sourceInvoiceNo,
        sourceCustomerId: pickRow.sourceCustomerId,
        sourceCustomerName: pickRow.sourceCustomerName,
      },
    ]);
    setSelectedCartIdx((prev) => Math.max(prev, cart.length));
    setPickRow(null);
    setFocusZone('cart');
  };

  const total = useMemo(
    () =>
      Math.round(
        cart.reduce((acc, l) => {
          const b = l.batchOptions[l.batchIdx];
          if (!b) return acc;
          return acc + l.tablets * b.unitPrice;
        }, 0) * 100
      ) / 100,
    [cart]
  );

  const handleConfirm = async () => {
    if (isSubmitting) return;
    if (cart.length === 0) {
      setInlineError('Return cart is empty.');
      return;
    }
    const payloadLines = cart.map((l) => {
      const b = l.batchOptions[l.batchIdx]!;
      return {
        id: l.id,
        medicineId: l.medicineId,
        medicineName: l.medicineName,
        batchId: b.batchId,
        batchNo: b.batchNo,
        tablets: l.tablets,
        unitPrice: b.unitPrice,
        lineTotal: Math.round(l.tablets * b.unitPrice * 100) / 100,
        sourceSaleId: l.sourceSaleId,
        sourceInvoiceNo: l.sourceInvoiceNo,
      };
    });
    const supplierIds = new Set(
      cart
        .map((l) => medicines.find((m) => m.id === l.medicineId)?.supplierId)
        .filter((id): id is string => Boolean(id))
    );
    if (kind === 'supplier' && supplierIds.size > 1) {
      setInlineError('Supplier return must contain medicines from one supplier.');
      return;
    }
    const selectedSupplierId = kind === 'supplier' ? [...supplierIds][0] : undefined;
    setIsSubmitting(true);
    const r = await processReturn({
      kind,
      settlement: kind === 'customer' ? 'cash' : undefined,
      supplierId: selectedSupplierId,
      supplierName: selectedSupplierId ? supplierById[selectedSupplierId]?.name : undefined,
      lines: payloadLines,
    });
    setIsSubmitting(false);
    if (!r.ok) {
      setInlineError(r.message ?? 'Could not process return.');
      return;
    }
    setCart([]);
    setQuery('');
    setSelectedResultIdx(0);
    setSelectedCartIdx(0);
    setInlineError(null);
    setConfirmOpen(false);
    searchRef.current?.focus();
    searchRef.current?.select();
    setFocusZone('results');
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

  useEffect(() => {
    if (!pickRow) return;
    const t = window.setTimeout(() => pickQtyRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [pickRow]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      if (e.key === 'F1') {
        e.preventDefault();
        if (pickRow) setPickRow(null);
        searchRef.current?.focus();
        searchRef.current?.select();
        setFocusZone('results');
        return;
      }
      if (e.key === 'Tab' && !confirmOpen && !isInput) {
        e.preventDefault();
        setFocusZone((z) => {
          const order: Array<'results' | 'cart' | 'batch'> = ['results', 'cart', 'batch'];
          const i = order.indexOf(z);
          const delta = e.shiftKey ? -1 : 1;
          return order[(i + delta + order.length) % order.length]!;
        });
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        if (pickRow) {
          setPickRow(null);
          return;
        }
        if (confirmOpen) setConfirmOpen(false);
        else if (query.trim()) setQuery('');
        else setInlineError(null);
        setFocusZone('results');
        return;
      }
      if (pickRow) {
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          setPickMode('tablet');
          return;
        }
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault();
          setPickMode('packet');
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmAddPrompt();
        }
        if (e.key === 'Tab' && !isInput) {
          e.preventDefault();
          setPickMode((m) => (m === 'packet' ? 'tablet' : 'packet'));
        }
        return;
      }
      if (confirmOpen) {
        if (e.key === 'Enter') {
          e.preventDefault();
          void handleConfirm();
        }
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (cart.length > 0) setConfirmOpen(true);
        return;
      }
      if ((e.key === '+' || e.key === '=' || e.key === '*') && cart[selectedCartIdx] && !isInput) {
        e.preventDefault();
        setCart((prev) =>
          prev.map((l, idx) => (idx !== selectedCartIdx ? l : { ...l, tablets: Math.min(l.batchOptions[l.batchIdx]!.maxTablets, l.tablets + 1) }))
        );
        return;
      }
      if (e.key === '-' && cart[selectedCartIdx] && !isInput) {
        e.preventDefault();
        setCart((prev) => prev.map((l, idx) => (idx !== selectedCartIdx ? l : { ...l, tablets: Math.max(1, l.tablets - 1) })));
        return;
      }
      if (e.key === 'Delete' && cart[selectedCartIdx] && !isInput) {
        e.preventDefault();
        setCart((prev) => prev.filter((_, idx) => idx !== selectedCartIdx));
        setSelectedCartIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (focusZone === 'results' && !isInput) {
        if (e.key === 'ArrowDown' && rows.length > 0) {
          e.preventDefault();
          setSelectedResultIdx((i) => Math.min(rows.length - 1, i + 1));
          return;
        }
        if (e.key === 'ArrowUp' && rows.length > 0) {
          e.preventDefault();
          setSelectedResultIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === 'Enter' && rows[selectedResultIdx]) {
          e.preventDefault();
          openAddPrompt(rows[selectedResultIdx]!);
          return;
        }
      }
      if (focusZone === 'cart' && !isInput) {
        if (e.key === 'ArrowDown' && cart.length > 0) {
          e.preventDefault();
          setSelectedCartIdx((i) => Math.min(cart.length - 1, i + 1));
          return;
        }
        if (e.key === 'ArrowUp' && cart.length > 0) {
          e.preventDefault();
          setSelectedCartIdx((i) => Math.max(0, i - 1));
          return;
        }
        if (e.key === 'Enter' && cart[selectedCartIdx]) {
          e.preventDefault();
          setFocusZone('batch');
          return;
        }
      }
      if ((focusZone === 'batch' || (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) && cart[selectedCartIdx] && !isInput) {
        const cur = cart[selectedCartIdx]!;
        if (cur.batchOptions.length <= 1) return;
        if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
        e.preventDefault();
        if (e.key === 'Enter') {
          setFocusZone('cart');
          return;
        }
        setCart((prev) =>
          prev.map((l, idx) => {
            if (idx !== selectedCartIdx) return l;
            const nextIdx =
              e.key === 'ArrowRight' || e.key === 'ArrowDown'
                ? Math.min(l.batchOptions.length - 1, l.batchIdx + 1)
                : Math.max(0, l.batchIdx - 1);
            return { ...l, batchIdx: nextIdx, tablets: Math.min(l.tablets, l.batchOptions[nextIdx]!.maxTablets) };
          })
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cart, confirmOpen, focusZone, kind, pickMode, pickQty, pickRow, query, rows, selectedCartIdx, selectedResultIdx]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 sm:gap-4 bg-slate-50/90 p-3 sm:p-4 md:p-5 lg:p-6 dark:bg-zinc-950">
      <header className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="fluid-h1 font-bold text-slate-900 dark:text-white">Returns</h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
            Search a medicine, enter quantity, confirm — stock is added back to your batches (FEFO).{' '}
            <span className="font-semibold text-slate-800 dark:text-zinc-200">No invoices</span> on this screen.
          </p>
        </div>
        <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setKind('customer')}
            className={cn('rounded-lg px-3 py-2 text-xs font-bold', kind === 'customer' ? 'bg-primary text-primary-foreground' : 'text-slate-600 dark:text-zinc-300')}
          >
            <UserRound className="mr-1 inline h-3.5 w-3.5" />
            Shelf restock
          </button>
          <button
            type="button"
            onClick={() => setKind('supplier')}
            className={cn('rounded-lg px-3 py-2 text-xs font-bold', kind === 'supplier' ? 'bg-primary text-primary-foreground' : 'text-slate-600 dark:text-zinc-300')}
          >
            <Truck className="mr-1 inline h-3.5 w-3.5" />
            Supplier return
          </button>
        </div>
      </header>
      {syncError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {syncError}
        </div>
      ) : null}
      {isSyncing ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/25 dark:text-sky-200">
          Syncing latest backend data...
        </div>
      ) : null}
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

      <div className="hide-on-short flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-slate-200 bg-white p-3 text-[11px] sm:text-xs font-semibold text-slate-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <span>F1 Search</span><span>↑↓ Navigate</span><span>Enter Add</span>
        <span>+/- Qty</span><span>Delete Remove</span><span>F3 Confirm</span>
        <span>Tab Zone</span><span>Esc Cancel</span>
        <span className="ml-auto rounded bg-primary/10 px-2 py-0.5 text-primary">Focus: {focusZone}</span>
      </div>

      <div className="grid min-h-0 min-w-0 w-full flex-1 gap-3 lg:gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={kind === 'customer' ? 'Search medicine…' : 'Search medicine for supplier return…'}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                No matching items.
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((r, idx) => (
                  <li key={r.key}>
                    <button
                      ref={(el) => {
                        resultRefs.current[r.key] = el;
                      }}
                      type="button"
                      onClick={() => {
                        setSelectedResultIdx(idx);
                        openAddPrompt(r);
                      }}
                      className={cn(
                        'w-full rounded-xl border px-3 py-2 text-left transition',
                        idx === selectedResultIdx
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                      )}
                    >
                      <p className="font-bold text-slate-900 dark:text-zinc-100">{r.label}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">{r.subtitle}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                        FEFO batch: {r.batchOptions[0]?.batchNo}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="shrink-0 text-sm font-black uppercase tracking-wide text-slate-700 dark:text-zinc-200">Return cart</h2>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-zinc-700 dark:text-zinc-400">
                No items added.
              </p>
            ) : (
              <ul className="space-y-2">
                {cart.map((l, idx) => {
                  const b = l.batchOptions[l.batchIdx]!;
                  return (
                    <li
                      ref={(el) => {
                        cartRefs.current[l.id] = el;
                      }}
                      key={l.id}
                      className={cn(
                        'rounded-xl border px-3 py-2',
                        idx === selectedCartIdx ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-slate-200 dark:border-zinc-700'
                      )}
                      onClick={() => setSelectedCartIdx(idx)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-slate-900 dark:text-zinc-100">{l.medicineName}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCart((prev) => prev.filter((x) => x.id !== l.id));
                            setSelectedCartIdx((i) => Math.max(0, i - 1));
                          }}
                          className="rounded-md p-1 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-zinc-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          aria-label={`Remove ${l.medicineName}`}
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Batch {b.batchNo} · Exp {b.expiryDate}
                        {isExpired(b.expiryDate) ? ' · Expired' : ''}
                      </p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-slate-800 dark:text-zinc-100">
                        {l.tablets} tablets · {formatCurrency(l.tablets * b.unitPrice)}
                      </p>
                      {l.batchOptions.length > 1 ? (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                          <ChevronLeft className="inline h-3.5 w-3.5" /> / <ChevronRight className="inline h-3.5 w-3.5" /> batch
                        </p>
                      ) : null}
                      {idx === selectedCartIdx && focusZone === 'batch' && l.batchOptions.length > 1 ? (
                        <ul className="mt-2 space-y-1 rounded-lg border border-slate-200 bg-white p-2 text-[11px] dark:border-zinc-700 dark:bg-zinc-800">
                          {l.batchOptions.map((opt, optIdx) => (
                            <li
                              key={opt.batchId}
                              className={cn(
                                'flex items-center justify-between rounded px-2 py-1',
                                optIdx === l.batchIdx ? 'bg-primary/15 font-bold text-primary' : 'text-slate-600 dark:text-zinc-300'
                              )}
                            >
                              <span>
                                {opt.batchNo} · {opt.expiryDate}
                                {optIdx === 0 ? ' · FEFO' : ''}
                              </span>
                              <span className="tabular-nums">{opt.maxTablets}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-3 shrink-0 rounded-xl bg-slate-50 p-3 text-sm dark:bg-zinc-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-600 dark:text-zinc-300">Total</span>
              <span className="font-black tabular-nums text-slate-900 dark:text-white">{formatCurrency(total)}</span>
            </div>
            {inlineError ? (
              <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{inlineError}</p>
            ) : null}
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={cart.length === 0 || isSubmitting}
              className={cn(
                'mt-3 w-full rounded-xl py-2.5 text-sm font-black text-primary-foreground',
                cart.length === 0 || isSubmitting ? 'cursor-not-allowed bg-slate-300 dark:bg-zinc-700' : 'bg-primary'
              )}
            >
              {isSubmitting ? 'Submitting...' : 'Confirm return (F3)'}
            </button>
          </div>
        </section>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" aria-label="Close" onClick={() => setConfirmOpen(false)} className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">Confirm return</h3>
                <p className="text-sm text-slate-600 dark:text-zinc-400">
                  {kind === 'customer' ? 'Shelf restock (no invoice)' : 'Supplier return'}
                </p>
              </div>
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-2 text-sm dark:bg-zinc-900">
              {cart.map((l) => (
                <li key={l.id} className="flex items-center justify-between rounded-md bg-white px-2 py-1.5 dark:bg-zinc-800">
                  <span className="truncate font-medium">{l.medicineName}</span>
                  <span className="tabular-nums font-bold">{l.tablets}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="flex-1 rounded-xl border py-2.5 text-sm font-bold dark:border-zinc-700">
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleConfirm()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Confirm (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {pickRow && (
        <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" aria-label="Close" onClick={() => setPickRow(null)} className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="text-base font-black text-slate-900 dark:text-white">Select quantity</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">{pickRow.medicineName}</p>
            <div className="mt-3 inline-flex rounded-lg border border-slate-200 p-1 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setPickMode('packet')}
                className={cn('rounded px-3 py-1.5 text-xs font-bold', pickMode === 'packet' ? 'bg-primary text-primary-foreground' : 'text-slate-600 dark:text-zinc-300')}
              >
                Packet
              </button>
              <button
                type="button"
                onClick={() => setPickMode('tablet')}
                className={cn('rounded px-3 py-1.5 text-xs font-bold', pickMode === 'tablet' ? 'bg-primary text-primary-foreground' : 'text-slate-600 dark:text-zinc-300')}
              >
                Tablet
              </button>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-zinc-400">Quantity</label>
            <input
              ref={pickQtyRef}
              type="number"
              min={1}
              step={1}
              value={pickQty}
              onChange={(e) => setPickQty(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
            <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
              {pickMode === 'packet'
                ? `1 packet = ${pickRow.tabletsPerPack} tablets`
                : 'Quantity in tablets'}
            </p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setPickRow(null)} className="flex-1 rounded-xl border py-2.5 text-sm font-bold dark:border-zinc-700">
                Cancel
              </button>
              <button type="button" onClick={confirmAddPrompt} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-black text-primary-foreground">
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
