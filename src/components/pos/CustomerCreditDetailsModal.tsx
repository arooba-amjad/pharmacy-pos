import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { Receipt, X } from 'lucide-react';
import type { Customer, Sale } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { lastCreditSaleDateIso } from '@/lib/customerCreditAlerts';
import { customerCreditLedgerStats } from '@/lib/customerCredit';

function paymentLabel(m: Sale['paymentMethod']): string {
  if (m === 'cash') return 'Cash';
  if (m === 'card') return 'Card';
  return 'Credit';
}

export interface CustomerCreditDetailsModalProps {
  open: boolean;
  customer: Customer;
  sales: Sale[];
  onClose: () => void;
}

export function CustomerCreditDetailsModal({ open, customer, sales, onClose }: CustomerCreditDetailsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const lastCreditIso = useMemo(() => lastCreditSaleDateIso(customer), [customer]);
  const stats = useMemo(() => customerCreditLedgerStats(customer), [customer]);

  const recent = useMemo(() => {
    return [...sales]
      .filter((s) => s.customer?.id === customer.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [sales, customer.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  let lastCreditDisplay = '—';
  if (lastCreditIso) {
    try {
      lastCreditDisplay = format(parseISO(lastCreditIso), 'MMM d, yyyy · h:mm a');
    } catch {
      lastCreditDisplay = lastCreditIso;
    }
  }

  return createPortal(
    <div
      data-credit-details-modal="true"
      className="fixed inset-0 z-[165] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-details-title"
        className="relative z-10 flex max-h-[min(88vh,560px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl outline-none dark:border-border dark:bg-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-border/80">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Customer account</p>
            <h2 id="credit-details-title" className="mt-0.5 text-lg font-black tracking-tight text-foreground">
              {customer.name}
            </h2>
            <p className="text-sm text-muted-foreground">{customer.phone}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-amber-200/70 bg-amber-500/[0.08] p-3 dark:border-amber-900/40 dark:bg-amber-950/25">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
                Outstanding balance
              </p>
              <p className="mt-1 text-xl font-black tabular-nums text-amber-950 dark:text-amber-50">
                {formatCurrency(stats.remainingBalance)}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/25 p-3 dark:bg-muted/15">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Credit charged (ledger)</p>
              <p className="mt-1 text-xl font-black tabular-nums text-foreground">{formatCurrency(stats.totalCreditGiven)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/15 px-3 py-2.5 text-sm dark:bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground">Last credit sale</p>
            <p className="mt-0.5 font-bold text-foreground">{lastCreditDisplay}</p>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" aria-hidden />
              Recent invoices
            </p>
            {recent.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                No saved sales for this customer in the current ledger.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {recent.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-sm dark:bg-background/40"
                  >
                    <span className="font-mono text-xs font-bold text-foreground">{s.invoiceNo}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(s.timestamp), 'MMM d, yyyy')}
                    </span>
                    <span className="w-full text-[11px] font-semibold text-muted-foreground sm:w-auto">
                      {paymentLabel(s.paymentMethod)}
                      {s.paymentMethod === 'credit' && s.creditAmount != null
                        ? ` · ${formatCurrency(s.creditAmount)} on account`
                        : null}
                    </span>
                    <span className="ml-auto font-bold tabular-nums text-foreground">{formatCurrency(s.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-3 dark:border-border/80">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white dark:bg-primary dark:text-primary-foreground"
          >
            Close <span className="ml-1 font-mono text-xs opacity-80">Esc</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
