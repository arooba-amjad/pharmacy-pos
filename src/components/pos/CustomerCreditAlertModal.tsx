import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Wallet, X } from 'lucide-react';
import type { Customer } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';

export interface CustomerCreditAlertModalProps {
  open: boolean;
  customer: Customer;
  onContinue: () => void;
  onViewDetails: () => void;
}

export function CustomerCreditAlertModal({ open, customer, onContinue, onViewDetails }: CustomerCreditAlertModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onContinue();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onContinue();
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        onViewDetails();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onContinue, onViewDetails]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-credit-balance-alert-modal="true"
      className="modal-overlay fixed inset-0 z-[160] flex justify-center"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onContinue();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-alert-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-red-200/90 bg-white shadow-2xl outline-none ring-2 ring-red-500/15 dark:border-red-900/50 dark:bg-card dark:ring-red-500/20"
      >
        <div className="flex items-start gap-3 border-b border-red-100 bg-red-500/[0.07] px-5 py-4 dark:border-red-900/35 dark:bg-red-950/30">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-red-700 dark:text-red-300">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p id="credit-alert-title" className="text-base font-black tracking-tight text-red-950 dark:text-red-50">
              Pending customer credit
            </p>
            <p className="mt-1 text-sm leading-relaxed text-red-900/85 dark:text-red-100/90">
              <span className="font-semibold">{customer.name}</span> has an outstanding balance of{' '}
              <span className="whitespace-nowrap font-black tabular-nums">{formatCurrency(customer.balance)}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="shrink-0 rounded-lg p-1.5 text-red-700/70 transition hover:bg-red-500/10 hover:text-red-900 dark:text-red-300/80 dark:hover:bg-red-500/15"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col gap-2 border-t border-red-100/80 px-5 py-4 dark:border-red-900/30 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onViewDetails}
            className={cn(
              'order-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-foreground transition hover:bg-slate-50 sm:order-1 dark:border-border dark:bg-card dark:hover:bg-muted/40'
            )}
          >
            View details <span className="ml-1 font-mono text-xs font-semibold text-muted-foreground">D</span>
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="order-1 rounded-xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-wide text-primary-foreground shadow-md shadow-primary/25 transition hover:brightness-[1.03] sm:order-2"
          >
            Continue <span className="ml-1 font-mono text-xs font-semibold opacity-90">Enter</span>
          </button>
        </div>
        <p className="border-t border-slate-100 px-5 py-2 text-center text-[10px] font-medium text-muted-foreground dark:border-border/60">
          <kbd className="rounded border border-border bg-muted px-1 font-mono">Esc</kbd> dismiss · Non-blocking — you
          can complete the sale as usual.
        </p>
      </div>
    </div>,
    document.body
  );
}
