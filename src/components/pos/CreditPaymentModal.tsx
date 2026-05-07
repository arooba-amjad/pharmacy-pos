import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

export interface CreditPaymentModalProps {
  open: boolean;
  customerName: string;
  invoiceTotal: number;
  defaultCreditAmount: number;
  onConfirm: (creditAmount: number) => void;
  onCancel: () => void;
}

export function CreditPaymentModal({
  open,
  customerName,
  invoiceTotal,
  defaultCreditAmount,
  onConfirm,
  onCancel,
}: CreditPaymentModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [val, setVal] = React.useState('');

  useEffect(() => {
    if (!open) return;
    const capped = Math.min(defaultCreditAmount, invoiceTotal);
    setVal(String(Math.round(capped * 100) / 100));
    const t = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(t);
  }, [open, defaultCreditAmount, invoiceTotal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onCancel]);

  if (!open) return null;

  const submit = () => {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return;
    const cap = Math.round(invoiceTotal * 100) / 100;
    const amt = Math.min(Math.round(n * 100) / 100, cap);
    if (amt <= 0) return;
    onConfirm(amt);
  };

  const node = (
    <div
      className="modal-overlay fixed inset-0 z-[190] flex justify-center bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-pay-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-border dark:bg-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-border/60">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary">Credit payment</p>
            <h2 id="credit-pay-title" className="text-lg font-black tracking-tight text-foreground">
              Charge to customer account
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl p-2 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Customer</p>
            <p className="mt-1 text-sm font-bold text-foreground">{customerName}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Invoice total</p>
            <p className="mt-1 text-lg font-black tabular-nums text-foreground">{formatCurrency(invoiceTotal)}</p>
          </div>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Credit amount (max {formatCurrency(invoiceTotal)})
            </span>
            <input
              ref={inputRef}
              type="number"
              min={0.01}
              step={0.01}
              max={invoiceTotal}
              value={val}
              onChange={(e) => setVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold tabular-nums dark:border-border dark:bg-background"
            />
          </label>
          <p className="text-[11px] text-muted-foreground">
            <kbd className="rounded bg-muted px-1 font-mono">Enter</kbd> confirm ·{' '}
            <kbd className="rounded bg-muted px-1 font-mono">Esc</kbd> cancel
          </p>
        </div>
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-4 dark:border-border/60 dark:bg-muted/20">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border py-2.5 text-sm font-bold hover:bg-muted/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className={cn(
              'flex-1 rounded-xl py-2.5 text-sm font-black text-white shadow-sm',
              'bg-primary hover:brightness-[1.03]'
            )}
          >
            Confirm credit
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(node, document.body) : null;
}
