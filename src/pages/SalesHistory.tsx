import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, Printer, Search, Trash2, X } from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import type { Sale } from '@/types';
import { formatSellQuantityLabel } from '@/lib/posCartQuantity';
import { formatCurrency } from '@/lib/utils';
import { displayManufacturerForCartLine } from '@/lib/medicineDisplay';
import { RECEIPT_BRANDING } from '@/lib/receiptConstants';
import { printSaleInvoice, downloadSaleInvoicePdf } from '@/lib/saleReceiptHelpers';

type PayFilter = 'all' | 'cash' | 'credit' | 'today';

function paymentLabel(m: Sale['paymentMethod']): string {
  if (m === 'cash') return 'Cash';
  if (m === 'card') return 'Card';
  return 'Credit';
}

function duesPaidOnSale(s: Sale): number {
  return s.duesPaidWithSale ?? 0;
}

function isToday(ts: string): boolean {
  const d = new Date(ts);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
  );
}

function inDateRange(ts: string, from: string, to: string): boolean {
  if (!from && !to) return true;
  const t = new Date(ts).getTime();
  if (from) {
    const f = new Date(from + 'T00:00:00').getTime();
    if (t < f) return false;
  }
  if (to) {
    const u = new Date(to + 'T23:59:59.999').getTime();
    if (t > u) return false;
  }
  return true;
}

function saleMatchesQuery(s: Sale, q: string): boolean {
  if (!q.trim()) return true;
  const x = q.toLowerCase().trim();
  if (s.invoiceNo.toLowerCase().includes(x)) return true;
  if (s.customer?.name.toLowerCase().includes(x)) return true;
  if (s.customer?.phone.toLowerCase().includes(x)) return true;
  return s.items.some((it) => it.name.toLowerCase().includes(x) || it.generic.toLowerCase().includes(x));
}

export const SalesHistory: React.FC = () => {
  const sales = usePOSBillingStore((s) => s.sales);
  const medicines = usePOSBillingStore((s) => s.medicines);
  const deleteSale = usePOSBillingStore((s) => s.deleteSale);

  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [payFilter, setPayFilter] = useState<PayFilter>('all');
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);

  const filtered = useMemo(() => {
    return [...sales]
      .filter((s) => saleMatchesQuery(s, query))
      .filter((s) => {
        if (payFilter === 'today') return isToday(s.timestamp);
        if (payFilter === 'cash') return s.paymentMethod === 'cash' || s.paymentMethod === 'card';
        if (payFilter === 'credit') return s.paymentMethod === 'credit';
        return true;
      })
      .filter((s) => {
        if (payFilter === 'today') return true;
        return inDateRange(s.timestamp, dateFrom, dateTo);
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [sales, query, dateFrom, dateTo, payFilter]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col gap-3 sm:gap-4 bg-background p-3 sm:p-4 md:p-5 lg:p-6">
      <div>
        <h1 className="fluid-h1 font-bold tracking-tight text-slate-900 dark:text-white">Sales history</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-600 dark:text-zinc-400">Invoices and receipts — quick lookup.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-3 sm:p-4 shadow-sm">
        <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative min-w-0 w-full flex-1 lg:min-w-[12rem]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search invoice, customer, or medicine…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-slate-300 focus:bg-white focus:ring-2 focus:ring-slate-200/80 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={payFilter === 'today'}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={payFilter === 'today'}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Filter</span>
              <select
                value={payFilter}
                onChange={(e) => setPayFilter(e.target.value as PayFilter)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              >
                <option value="all">All</option>
                <option value="cash">Cash / Card</option>
                <option value="credit">Credit</option>
                <option value="today">Today</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="h-full overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-10 text-center text-sm text-slate-500 dark:text-zinc-400">No sales match your filters.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
              {filtered.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900 dark:text-white">{s.invoiceNo}</p>
                      {s.pricingChannel === 'wholesale' ? (
                        <span
                          className="rounded-full bg-teal-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-900 dark:bg-teal-500/20 dark:text-teal-100"
                          title="Checkout was in wholesale / bulk pricing mode"
                        >
                          Bulk sale
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-zinc-400">
                      {s.customer?.name ?? 'Walk-in'}{' '}
                      {s.customer?.phone ? (
                        <span className="text-slate-400">· {s.customer.phone}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">
                      {format(new Date(s.timestamp), 'MMM d, yyyy · h:mm a')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 sm:justify-end">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                        {paymentLabel(s.paymentMethod)}
                      </span>
                      {duesPaidOnSale(s) > 0.001 ? (
                        <span
                          className="rounded-full border border-amber-300/70 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100"
                          title="Part of the payment reduced the customer’s prior balance"
                        >
                          Dues −{formatCurrency(duesPaidOnSale(s))}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(s.total)}
                    </p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        title="View receipt"
                        onClick={() => setReceiptSale(s)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Print invoice"
                        onClick={() => printSaleInvoice(s)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Delete sale"
                        onClick={() => {
                          if (!window.confirm(`Delete sale ${s.invoiceNo}? This cannot be undone.`)) return;
                          void (async () => {
                            await deleteSale(s.id);
                            setReceiptSale((cur) => (cur?.id === s.id ? null : cur));
                          })();
                        }}
                        className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {receiptSale && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setReceiptSale(null)} />
          <div
            role="dialog"
            className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receipt</p>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{RECEIPT_BRANDING.name}</h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{receiptSale.invoiceNo}</p>
                {receiptSale.pricingChannel === 'wholesale' ? (
                  <p className="mt-1">
                    <span className="rounded-full bg-teal-600/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-900 dark:bg-teal-500/20 dark:text-teal-100">
                      Bulk sale
                    </span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setReceiptSale(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4 text-sm">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {format(new Date(receiptSale.timestamp), 'MMMM d, yyyy · h:mm a')}
              </p>
              {receiptSale.customer ? (
                <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-zinc-900">
                  <p className="font-semibold text-slate-900 dark:text-white">{receiptSale.customer.name}</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">{receiptSale.customer.phone}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500">Walk-in customer</p>
              )}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
                <ul className="space-y-2">
                  {receiptSale.items.map((it) => (
                    <li key={it.lineId} className="flex justify-between gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-800 dark:text-zinc-100">{it.name}</p>
                        <p className="text-[10px] font-medium text-slate-500 dark:text-zinc-500">
                          Mfr. {displayManufacturerForCartLine(it, medicines)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">{formatSellQuantityLabel(it)}</p>
                      </div>
                      <span className="shrink-0 self-start tabular-nums font-medium">
                        {formatCurrency(it.quantity * it.unitPrice)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-zinc-800">
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(receiptSale.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Discount</span>
                  <span className="tabular-nums">−{formatCurrency(receiptSale.discountApplied)}</span>
                </div>
                {receiptSale.serviceChargeTotal > 0 ? (
                  <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                    <span>Service & fees</span>
                    <span className="tabular-nums">{formatCurrency(receiptSale.serviceChargeTotal)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Tax</span>
                  <span className="tabular-nums">{formatCurrency(receiptSale.tax)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900 dark:border-zinc-700 dark:text-white">
                  <span>Total</span>
                  <span className="tabular-nums text-primary">{formatCurrency(receiptSale.total)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Payment: <strong>{paymentLabel(receiptSale.paymentMethod)}</strong>
                  {duesPaidOnSale(receiptSale) > 0.001 ? (
                    <span className="ml-2 font-semibold text-amber-800 dark:text-amber-200">
                      · Prior balance paid {formatCurrency(duesPaidOnSale(receiptSale))}
                    </span>
                  ) : null}
                </p>
                {receiptSale.paymentMethod === 'credit' && receiptSale.creditAmount != null ? (
                  <div className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
                    <p className="font-semibold">Credit amount: {formatCurrency(receiptSale.creditAmount)}</p>
                    {receiptSale.paidCashPortion != null && receiptSale.paidCashPortion > 0.001 ? (
                      <p className="mt-0.5 text-amber-900/90 dark:text-amber-200/90">
                        Cash (same invoice): {formatCurrency(receiptSale.paidCashPortion)}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                      Customer dues updated
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2 border-t border-slate-100 p-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setReceiptSale(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium dark:border-zinc-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => downloadSaleInvoicePdf(receiptSale)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium dark:border-zinc-700"
              >
                Save PDF
              </button>
              <button
                type="button"
                onClick={() => printSaleInvoice(receiptSale)}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
