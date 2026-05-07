import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HandCoins, X } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

export interface PayDuesModalProps {
  open: boolean;
  /** Outstanding balance before this payment (read-only display). */
  previousBalance: number;
  /** Current invoice total when paying with a sale; 0 for dues-only. */
  currentBill: number;
  onClose: () => void;
  /** Amount applied toward prior balance (≤ previousBalance). Return false (or Promise<false>) to keep the dialog open (e.g. API failure). */
  onConfirm: (amountTowardDues: number) => void | boolean | Promise<void | boolean>;
}

export function PayDuesModal({ open, previousBalance, currentBill, onClose, onConfirm }: PayDuesModalProps) {
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const maxTowardDues = Math.max(0, Math.round(previousBalance * 100) / 100);
  const parsed = useMemo(() => {
    const n = parseFloat(raw.replace(/,/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }, [raw]);

  const remainingPreview = useMemo(() => {
    if (!Number.isFinite(parsed) || parsed < 0) return maxTowardDues;
    const after = Math.round((maxTowardDues - parsed) * 100) / 100;
    return Math.max(0, after);
  }, [parsed, maxTowardDues]);

  useEffect(() => {
    if (!open) return;
    setRaw(maxTowardDues > 0 ? String(maxTowardDues) : '');
    const t = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(t);
  }, [open, maxTowardDues]);

  const submit = useCallback(async () => {
    if (!Number.isFinite(parsed) || parsed < 0) return;
    if (parsed > maxTowardDues + 1e-6) return;
    const result = onConfirm(parsed);
    const resolved = result instanceof Promise ? await result : result;
    if (resolved === false) return;
    onClose();
  }, [parsed, maxTowardDues, onConfirm, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        submit();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose, submit]);

  if (!open || typeof document === 'undefined') return null;

  const invalid = Number.isFinite(parsed) && (parsed < 0 || parsed > maxTowardDues + 1e-6);

  return createPortal(
    <div
      data-pay-dues-modal="true"
      className="modal-overlay fixed inset-0 z-[170] flex justify-center bg-black/45 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pay-dues-title"
        className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-border dark:bg-card"
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-border/80">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
              <HandCoins className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <h2 id="pay-dues-title" className="text-sm font-black tracking-tight text-foreground">
                Pay prior balance
              </h2>
              {currentBill > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Current bill stays <span className="font-bold tabular-nums">{formatCurrency(currentBill)}</span> ·
                  this amount is toward old dues only.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">No sale — balance payment only.</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm dark:bg-muted/10">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Previous balance</p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-foreground">{formatCurrency(maxTowardDues)}</p>
          </div>

          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Amount to pay toward dues
            </span>
            <input
              ref={inputRef}
              type="number"
              min={0}
              max={maxTowardDues}
              step={0.01}
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className={cn(
                'w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-bold tabular-nums outline-none ring-primary/20 focus:ring-2 dark:bg-card',
                invalid ? 'border-red-400' : 'border-slate-200 dark:border-border'
              )}
            />
          </label>

          <div className="rounded-xl border border-emerald-200/60 bg-emerald-500/[0.07] px-3 py-2 text-sm dark:border-emerald-900/40">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900/80 dark:text-emerald-200/90">
              Remaining balance (after this payment)
            </p>
            <p className="mt-0.5 text-lg font-black tabular-nums text-emerald-950 dark:text-emerald-50">
              {formatCurrency(remainingPreview)}
            </p>
          </div>

          {invalid ? (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">Enter between 0 and outstanding dues.</p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold dark:border-border"
            >
              Cancel <kbd className="ml-1 font-mono text-[10px] opacity-70">Esc</kbd>
            </button>
            <button
              type="button"
              disabled={invalid || !Number.isFinite(parsed)}
              onClick={submit}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-black uppercase tracking-wide text-primary-foreground shadow-md shadow-primary/25 disabled:opacity-40"
            >
              OK <kbd className="ml-1 font-mono text-[10px] opacity-90">Enter</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
